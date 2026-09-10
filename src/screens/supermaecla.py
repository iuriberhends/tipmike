r"""
supermae.py - Bot Superbet Adriatic UNIFICADO
3 estrategias + JUROS COMPOSTOS + COMANDOS TG + POOL DINAMICO + COOLDOWN PREVENTIVO

ESTRATEGIAS:
[1] OVER FT (mkt 200586): Mais de X pontos da partida
[2] Q4 VENCENDO (mkt 200587/588 + 200601/602): Over jogador GANHANDO
[3] Q4 PERDENDO (mkt 200587/588 + 200601/602): Over jogador PERDENDO
[4] HC ZEBRA (mkt 200585): Handicap FT (inc. prorrog.) na zebra, alvos do H2H
    do TipManager — portada do sporty1.py (SportyBet). STAKE FIXA R$15 (TESTE),
    fora do esquema de juros compostos. Deps: pip install requests curl_cffi pycryptodome

POOL DINAMICO (accounts.json):
    - Contas carregadas de accounts.json (nao mais hardcoded)
    - Tracking de duracao ativa por conta (login -> primeiro sinal de limitacao)
    - Cooldown preventivo: se media das ultimas 2 contas que limitaram < 3h ativa
      -> pausa 30min antes de logar a proxima

MODO EMERGENCIA:
    - 3 ciclos seguidos com [banca] nao conseguiu ler DOM -> pausa total + alerta TG
    - 2 falhas de login consecutivas em contas diferentes -> pausa total + alerta TG
    - Sai do modo emergencia so com /retomar

JUROS COMPOSTOS:
    - PCT_* mudavel via TG (/stake FT 3.5)
    - Limites (TETO_*, MULT_JOGO_*, TETO_ABS_JOGO_*) hardcoded
    - High-watermark: saldo SO SOBE, nunca DESCE

COMANDOS TG:
    /saldo /status /refresh /stop /help     (originais)
    /stats                                  (lucro do dia, contas usadas, tempo medio)
    /stake FT 3.5 | /stake VENC 5.0 | /stake PERD 4.0
    /banca 3000                             (muda high-watermark inicial)
    /trocar | /trocar user                  (forca troca)
    /pausar | /retomar                      (pausa total)
    /addconta user pass | /rmconta user | /listcontas
"""

import asyncio
import json
import random
import re
import time as _time
import uuid as uuidlib
from dataclasses import dataclass, field
from datetime import datetime, date
from pathlib import Path
from typing import Optional

import httpx
from playwright.async_api import async_playwright

# --- deps da ESTRATEGIA 4 (HC ZEBRA via TipManager) ---
import gzip

# --- BRACO DE SINAIS MikeDB (le tips do bot autorizado e aposta) ---
# Import tolerante: se o modulo/asyncpg faltar, o supermae roda sem o braco.
try:
    import mikedb_sinais as _mikedb
    _MIKEDB_OK = True
except Exception as _e_mike:
    _mikedb = None
    _MIKEDB_OK = False
    print(f"[mikedb] braco de sinais indisponivel no import: {_e_mike}")

# ==================== MODO SO CLA (v13) ====================
# True = este processo roda SOMENTE a Estrategia 5 (UNDER CLA): braco de sinais MikeDB
# desligado, scan do e-basket (EAL) desligado, FT/VENC/PERD/HC ja estao False abaixo.
SO_CLA = True
if SO_CLA:
    _mikedb = None
    _MIKEDB_OK = False
try:
    import requests
    from curl_cffi import requests as cffi
    from Crypto.Cipher import AES
except ImportError as _imp_err:
    print("=" * 70)
    print(f"[FATAL] Dependencia da ESTRATEGIA HC (TipManager) faltando: {_imp_err}")
    print("Instale no venv do supermae:")
    print("    pip install requests curl_cffi pycryptodome")
    print("=" * 70)
    raise SystemExit(1)

# ==================== CONFIG GERAL ====================
CDP_PORT = 9267   # instancia PROPRIA do Chrome pra este bot (--remote-debugging-port=9260)
TIDS_SUPERBET = {89069: 'EAL'}   # v12.4: SO a liga da Adriatic (EAL/NextGen). Mixed(80566) fora do scan enquanto so a PERFEITA roda
SPORT_ID = 70

SCAN_INTERVAL = 0
ODD_MIN, ODD_MAX = 1.30, 10.0
JOGO_TIMEOUT_SEG = 130

# ==================== POOL DE CONTAS DINAMICO ====================
ACCOUNTS_FILE = Path("accounts.json")

# Estrutura do accounts.json:
# {
#   "contas": [
#     {"user": "marcostheoseg", "senha": "Marcos-10", "ativo": true,
#      "ultimo_uso": "2026-05-10T00:49:31", "duracao_ultima": 4823,
#      "limitou_ultima": true, "falha_login_count": 0}
#   ],
#   "conta_atual": "marcostheoseg",
#   "estado": "rodando",          # rodando | pausado | cooldown | emergencia
#   "pausado_ate": null,          # timestamp epoch ou null
#   "motivo_pausa": null
# }

# Sem contas hardcoded. Adicione via /addconta no Telegram.
CONTAS_DEFAULT: list[dict] = []

# Memoria viva (carregada do accounts.json)
CONTAS: list[dict] = []        # lista de dicts mutavel
_CONTA_IDX = 0                 # indice da conta atual em CONTAS
_ACCOUNTS_LOCK = asyncio.Lock()

# Sentinela usada quando CONTAS esta vazio. NAO eh uma conta real - so evita
# crash em codigo legado que le USUARIO/SENHA sem checar pool.
_CONTA_SENTINELA = {"user": "<sem_conta>", "senha": "", "ativo": False,
                    "ultimo_uso": None, "duracao_ultima": 0,
                    "limitou_ultima": False, "falha_login_count": 0}


def _accounts_carregar() -> dict:
    """Carrega accounts.json. Cria VAZIO se nao existir."""
    if not ACCOUNTS_FILE.exists():
        data = {
            "contas": [],
            "conta_atual": None,
            "estado": "rodando",
            "pausado_ate": None,
            "motivo_pausa": None,
        }
        try:
            ACCOUNTS_FILE.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
        except Exception:
            pass
        return data
    try:
        return json.loads(ACCOUNTS_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {"contas": [], "conta_atual": None, "estado": "rodando",
                "pausado_ate": None, "motivo_pausa": None}


def _accounts_salvar(data: dict):
    """Salva accounts.json atomicamente."""
    try:
        tmp = ACCOUNTS_FILE.with_suffix(".tmp")
        tmp.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
        tmp.replace(ACCOUNTS_FILE)
    except Exception as e:
        try: log_ev(f"  [accounts] falha salvar: {str(e)[:80]}")
        except Exception: pass


def _accounts_sync_to_disk():
    """Reescreve accounts.json com o estado em memoria (CONTAS, _CONTA_IDX)."""
    data = _accounts_carregar()
    data["contas"] = list(CONTAS)
    if 0 <= _CONTA_IDX < len(CONTAS):
        data["conta_atual"] = CONTAS[_CONTA_IDX]["user"]
    else:
        data["conta_atual"] = None
    _accounts_salvar(data)


def _accounts_init():
    """Carrega accounts.json pra memoria. Aceita pool vazia (vai pra AGUARDANDO_CONTA no boot)."""
    global CONTAS, _CONTA_IDX
    data = _accounts_carregar()
    contas = data.get("contas", []) or []
    CONTAS = contas
    if not CONTAS:
        _CONTA_IDX = 0
        return
    # Localiza a conta_atual no array
    user_atual = data.get("conta_atual")
    _CONTA_IDX = 0
    for i, c in enumerate(CONTAS):
        if c.get("user") == user_atual and c.get("ativo", True):
            _CONTA_IDX = i
            break
    else:
        # Nao encontrou ou nao ativa: pega primeira ativa
        for i, c in enumerate(CONTAS):
            if c.get("ativo", True):
                _CONTA_IDX = i
                break


def conta_ativa() -> dict:
    """Retorna o dict da conta atualmente em uso. Retorna sentinela se pool vazia."""
    if 0 <= _CONTA_IDX < len(CONTAS):
        return CONTAS[_CONTA_IDX]
    if CONTAS:
        return CONTAS[0]
    # Pool vazia: retorna sentinela. NAO eh conta real - so evita IndexError.
    return _CONTA_SENTINELA


class _DynStr:
    """String dinamica que sempre reflete a conta_ativa() atual."""
    def __init__(self, key): self._k = key
    def __str__(self): return conta_ativa()[self._k]
    def __repr__(self): return conta_ativa()[self._k]
    def __format__(self, spec): return format(conta_ativa()[self._k], spec)
    def __eq__(self, o): return conta_ativa()[self._k] == o
    def __hash__(self): return hash(conta_ativa()[self._k])


USUARIO = _DynStr("user")
SENHA = _DynStr("senha")

SB_API = "https://production-superbet-offer-br.freetls.fastly.net"
SB_BET_URL = "https://api.web.production.betler.superbet.bet.br/legacy-web/betting/submitTicket?clientSourceType=Desktop_new"
SB_HOME = "https://superbet.bet.br"
SB_DOMAIN = "superbet.bet.br"

# ==================== TELEGRAM ====================
# INTEGRACAO REMOVIDA (versao de teste HC): sem token, sem envio, sem polling.
# tg_send vira no-op e o polling encerra na hora (guards checam TG_ATIVO/TG_TOKEN),
# entao NENHUM byte sai pra api.telegram.org.
# Acompanhamento do bot: 100% pelos logs (bot_eventos.log / tela).
# Controles que eram por comando TG (/estrat /stake /teto /pause...) agora sao
# pelas constantes de config + restart do bot.
# Pra religar no futuro: recolocar TG_TOKEN/TG_CHAT_ID (do supermae antigo) e TG_ATIVO = True.
TG_TOKEN = ""
TG_CHAT_ID = ""
TG_ATIVO = False
TG_AUTHORIZED_CHATS = {int(TG_CHAT_ID)} if TG_CHAT_ID else set()

# ==================== PERSONALIZACAO ====================
USER_NAME = "Santos"   # mudavel via /nome no TG
NOME_FILE = Path("user_name.txt")
if NOME_FILE.exists():
    try:
        nome_salvo = NOME_FILE.read_text(encoding="utf-8").strip()
        if nome_salvo:
            USER_NAME = nome_salvo
    except Exception: pass


def _saudacao_horario() -> tuple[str, str]:
    """Retorna (emoji, texto) baseado na hora atual."""
    h = datetime.now().hour
    if 5 <= h < 12:  return ("🌅", "Bom dia")
    if 12 <= h < 18: return ("☀️", "Boa tarde")
    if 18 <= h < 22: return ("🌙", "Boa noite")
    return ("🌌", "Boa madrugada")


def saudacao(formal: bool = False) -> str:
    """Saudacao completa com horario + nome. Ex: '☀️ Boa tarde, Santos!'"""
    emo, txt = _saudacao_horario()
    if formal:
        return f"{emo} <b>{txt}, {USER_NAME}!</b>"
    cumps = ["Salve", "Eai", "Fala", "Boa", "Suave"]
    return f"{emo} <b>{random.choice(cumps)}, {USER_NAME}!</b>"


def header(emoji: str, titulo: str) -> str:
    """Header decorado pra mensagens importantes."""
    return f"━━━━━━━━━━━━━━━━━\n{emoji} <b>{titulo}</b>\n━━━━━━━━━━━━━━━━━"


def divisor() -> str:
    return "━━━━━━━━━━━━━━━━━"


def _frase_lucro(delta: float) -> str:
    """Frase divertida baseada no resultado."""
    if delta > 100:    return random.choice(["MONSTRO! 🚀", "subindo forte! 🔥", "lucrando alto 💰", "BORA! 💪"])
    if delta > 0:      return random.choice(["no verde 🟢", "lucrando 📈", "indo bem ✨", "no positivo 👍"])
    if delta == 0:     return random.choice(["empatado 😐", "no zero a zero ⚖️", "neutro 📊"])
    if delta > -100:   return random.choice(["leve queda 📉", "recuperavel ⚠️", "no vermelho leve 🟡"])
    return random.choice(["DD pesado 💀", "no vermelho forte 🔻", "dia ruim 😬", "mantenha a fe 🙏"])


async def tg_send(msg: str, reply_chat_id: Optional[int] = None):
    if not TG_ATIVO or not TG_TOKEN:
        return
    chat_id = reply_chat_id if reply_chat_id else TG_CHAT_ID
    if not chat_id:
        return
    try:
        url = f"https://api.telegram.org/bot{TG_TOKEN}/sendMessage"
        async with httpx.AsyncClient(timeout=5) as c:
            await c.post(url, json={
                "chat_id": chat_id, "text": msg,
                "parse_mode": "HTML", "disable_web_page_preview": True,
            })
    except Exception as e:
        try: log_ev(f"  [tg] falha: {str(e)[:60]}")
        except Exception: pass


APOSTA_LOCK = asyncio.Lock()
APOSTA_FILA_TIMEOUT = 5.0   # v12.4: subiu de 2->5s pra acomodar a rajada paralela de tips da MikeDB (escada de linhas disputando o lock do POST)

_OVERASK_AVISADO = False
_CUPOM_NEGADO_AVISADO = False

THRESHOLD_OVERASK_TROCA = 4
THRESHOLD_CUPOM_NEGADO_TROCA = 4
_COUNT_OVERASK = 0
_COUNT_CUPOM_NEGADO = 0
PRECISA_TROCAR_CONTA = False

# Threshold: max permitido pela casa < este valor = LIMITACAO REAL
# Acima disso, soh ajusta stake e segue (nao conta como overask serio)
# v12.4: acompanha a stake (R$100) - detecta corte proporcional (~2/3)
# (casa cortar de 100 pra <65 = limitando; entre 65-100 ainda ajusta e aposta)
STAKE_MIN_LIMITADO = 65.0

# Memoria do ultimo max aceito pela casa por estrategia (ajusta proximas apostas)
# Reseta a cada troca de conta.
_LIMITE_CASA = {"FT": 0.0, "VENC": 0.0, "PERD": 0.0, "HC": 0.0, "CLA": 0.0}

# Controle de troca forcada (definidos aqui pra serem visiveis a todas as funcoes)
_TROCA_FORCADA_USER: Optional[str] = None  # se None, proxima ativa apos atual
_TROCA_MANUAL = False                       # se True, nao entra no historico de cooldown

# Flag global pra parar bot via /stop
PARAR_BOT = False

# Flag global pra pausa via /pausar (modo manual ou cooldown ou emergencia)
PAUSADO = False
PAUSADO_ATE = 0.0           # timestamp epoch quando despausa (0 = manual indefinido)
MOTIVO_PAUSA = ""           # texto descritivo

# Modo emergencia (precisa de /retomar manual pra sair)
EMERGENCIA = False
MOTIVO_EMERGENCIA = ""

# Modo AGUARDANDO_CONTA: pool sem contas ativas, espera /addconta
# Sai automaticamente quando /addconta adicionar uma conta valida (sem precisar /retomar)
AGUARDANDO_CONTA = False

# Contadores de falha pra modo emergencia
_DOM_FAIL_STREAK = 0           # quantos ciclos seguidos sem ler DOM
_LOGIN_FAIL_STREAK = 0         # quantas falhas de login seguidas
_LOGIN_FAIL_LAST_USER = ""     # ultima conta que falhou login
LIMITE_DOM_FAIL = 3
LIMITE_LOGIN_FAIL = 2
MAX_FALHAS_LOGIN_POR_CONTA = 3   # apos N falhas seguidas, desativa a conta automaticamente

# ==================== SALDO ZERADO ====================
# Se banca < (SALDO_ZERADO_MULT_STAKE * stake_FT_atual) por SALDO_ZERADO_JANELA_SEG
# SEM nenhuma aposta aberta em FT/VENC/PERD/HC -> troca conta auto.
# NAO entra no historico de cooldown (e falha financeira, nao limitacao da casa).
SALDO_ZERADO_ATIVO = True
SALDO_ZERADO_MULT_STAKE = 2.0          # banca < 2x stake_FT = "zerou"
SALDO_ZERADO_JANELA_SEG = 10 * 60      # 10 min sem aposta aberta
_SALDO_ZERADO_DESDE = 0.0              # ts em que iniciou condicao (0 = nao zerado)
_SALDO_ZERADO_AVISADO = False          # evita flood TG

# Referencia da page (pra comandos TG poderem ler saldo)
_PAGE_REF = None
_CTX_REF = None
_API_REF = None   # cliente httpx do loop (pro handler de execucao imediata da MikeDB)
_JOGOS_REF: dict = {}

# ==================== COOLDOWN PREVENTIVO ====================
COOLDOWN_ATIVO = True
COOLDOWN_JANELA = 1                    # ultimas N contas que LIMITARAM
COOLDOWN_LIMITE_HORAS = 2.0            # se media < X horas ativa
COOLDOWN_PAUSA_SEG = 120 * 60           # entao pausa Y segundos antes de logar proxima

# Tracking da conta atual: quando logou, quando deu primeiro sinal de limitacao
_CONTA_LOGIN_TS = 0.0           # timestamp do login da conta atual
_CONTA_PRIMEIRA_LIMITACAO = 0.0 # timestamp do primeiro sinal de limitacao (0 se ainda OK)

# Historico das ultimas N contas que LIMITARAM (em segundos de duracao ativa)
# Trocas via /trocar manual NAO entram aqui.
_HIST_LIMITACOES: list[float] = []   # [duracao1_seg, duracao2_seg, ...]

# ==================== CIRCUITO QUEBRA-LOOP ====================
# Anti-hammering: se trocar N vezes em janela curta, entra em EMERGENCIA.
# Protege contra: DOM_FAIL global, overask em rajada, saldo zerado consecutivo, etc.
ANTI_LOOP_ATIVO = True
LIMITE_TROCAS_RAJADA = 5              # 5 trocas seguidas
JANELA_TROCAS_RAJADA_SEG = 15 * 60    # em 15 minutos
_TROCAS_TIMESTAMPS: list[float] = []  # ts das trocas (nao-manuais) recentes

def _registrar_troca_para_anti_loop() -> bool:
    """Registra uma troca nao-manual. Retorna True se passou do limite (deve entrar em emergencia)."""
    global _TROCAS_TIMESTAMPS
    if not ANTI_LOOP_ATIVO:
        return False
    agora = _time.time()
    # Limpa trocas antigas (fora da janela)
    _TROCAS_TIMESTAMPS = [t for t in _TROCAS_TIMESTAMPS if agora - t < JANELA_TROCAS_RAJADA_SEG]
    _TROCAS_TIMESTAMPS.append(agora)
    return len(_TROCAS_TIMESTAMPS) >= LIMITE_TROCAS_RAJADA


def _resetar_anti_loop():
    """Reseta o circuito (chamar quando o bot esta rodando OK)."""
    global _TROCAS_TIMESTAMPS
    _TROCAS_TIMESTAMPS = []


def _registrar_limitacao_atual():
    """Marca o instante em que a conta atual deu primeiro sinal de limitacao.
    Idempotente: so registra a PRIMEIRA limitacao."""
    global _CONTA_PRIMEIRA_LIMITACAO
    if _CONTA_PRIMEIRA_LIMITACAO == 0.0 and _CONTA_LOGIN_TS > 0:
        _CONTA_PRIMEIRA_LIMITACAO = _time.time()
        duracao = _CONTA_PRIMEIRA_LIMITACAO - _CONTA_LOGIN_TS
        log_ev(f"  [cooldown] primeira limitacao registrada: {duracao/60:.1f}min ativa")


def _empurrar_para_historico_limitacao():
    """Apos confirmacao de troca por limitacao, empurra a duracao ativa pro historico.
    Tambem atualiza accounts.json com duracao_ultima da conta que saiu."""
    global _HIST_LIMITACOES
    if _CONTA_LOGIN_TS == 0:
        return
    # Se primeira limitacao nunca foi marcada, usa "agora" como fim (ex: 4 cupons negados sequenciais)
    fim = _CONTA_PRIMEIRA_LIMITACAO if _CONTA_PRIMEIRA_LIMITACAO > 0 else _time.time()
    duracao = max(60.0, fim - _CONTA_LOGIN_TS)  # piso 60s
    _HIST_LIMITACOES.append(duracao)
    # Mantem janela
    if len(_HIST_LIMITACOES) > COOLDOWN_JANELA:
        _HIST_LIMITACOES = _HIST_LIMITACOES[-COOLDOWN_JANELA:]
    # Atualiza accounts.json
    try:
        c = conta_ativa()
        c["duracao_ultima"] = int(duracao)
        c["limitou_ultima"] = True
        c["ultimo_uso"] = datetime.now().isoformat(timespec="seconds")
        _accounts_sync_to_disk()
    except Exception:
        pass
    log_ev(f"  [cooldown] historico: {[f'{d/3600:.2f}h' for d in _HIST_LIMITACOES]}")


def _calcular_cooldown_necessario() -> float:
    """Retorna segundos de cooldown necessarios antes de logar proxima conta.
    0 = pode logar agora."""
    if not COOLDOWN_ATIVO:
        return 0.0
    if len(_HIST_LIMITACOES) < COOLDOWN_JANELA:
        return 0.0
    media_seg = sum(_HIST_LIMITACOES) / len(_HIST_LIMITACOES)
    media_horas = media_seg / 3600
    if media_horas < COOLDOWN_LIMITE_HORAS:
        log_ev(f"  [cooldown] media ultimas {COOLDOWN_JANELA} contas: {media_horas:.2f}h < {COOLDOWN_LIMITE_HORAS}h -> pausa {COOLDOWN_PAUSA_SEG/60:.0f}min")
        return float(COOLDOWN_PAUSA_SEG)
    log_ev(f"  [cooldown] media ultimas {COOLDOWN_JANELA} contas: {media_horas:.2f}h >= {COOLDOWN_LIMITE_HORAS}h -> sem pausa")
    return 0.0


# ==================== STATS DO DIA ====================
# Reseta toda meia-noite. Usado por /stats.
_STATS_DIA = {
    "data": str(date.today()),
    "tickets_ok": 0,
    "stake_total": 0.0,
    "lucro_aproximado": 0.0,    # delta vs banca inicial do dia
    "banca_inicial_dia": 0.0,
    "contas_usadas": [],         # lista de users que rodaram hoje
    "trocas_count": 0,
    "tempo_total_ativo_seg": 0.0,
}

def _stats_check_reset():
    global _STATS_DIA
    hoje = str(date.today())
    if _STATS_DIA["data"] != hoje:
        _STATS_DIA = {
            "data": hoje,
            "tickets_ok": 0,
            "stake_total": 0.0,
            "lucro_aproximado": 0.0,
            "banca_inicial_dia": _BANCA_ATUAL,
            "contas_usadas": [conta_ativa()["user"]] if CONTAS else [],
            "trocas_count": 0,
            "tempo_total_ativo_seg": 0.0,
        }


def _stats_registrar_ticket(stake_real: float):
    _stats_check_reset()
    _STATS_DIA["tickets_ok"] += 1
    _STATS_DIA["stake_total"] += stake_real
    # Ticket OK -> bot ta funcionando -> reseta circuito anti-loop
    _resetar_anti_loop()


def _stats_registrar_troca(duracao_seg: float, motivo: str):
    _stats_check_reset()
    _STATS_DIA["trocas_count"] += 1
    _STATS_DIA["tempo_total_ativo_seg"] += duracao_seg


def _stats_registrar_conta_nova(user: str):
    _stats_check_reset()
    if user and user not in _STATS_DIA["contas_usadas"]:
        _STATS_DIA["contas_usadas"].append(user)


# ==================== JUROS COMPOSTOS ====================
JUROS_COMPOSTOS_ATIVO = True

# % da banca + teto absoluto (cada estrategia independente)
# PCT_* SAO MUTAVEIS via /stake FT 3.5  (recebe % humano e divide por 100)
PCT_FT      = 0.04   # 3.0% da banca
TETO_FT     = 250.0

PCT_VENC    = 0.07   # 5.0% da banca
TETO_VENC   = 250.0

PCT_PERD    = 0.07   # 4.0% da banca
TETO_PERD   = 250.0

STAKE_MIN_VIAVEL_GLOBAL = 30.0

REFRESH_BANCA_SEG = 600   # 10 min

BANCA_STATE_FILE = Path("banca_state.json")

# Estado interno
_BANCA_LOCK = asyncio.Lock()
_BANCA_ATUAL = 0.0
_BANCA_TS = 0.0
_ULTIMA_LEITURA = 0.0
_BANCA_INICIAL = 0.0

# Ultima stake calculada com sucesso (usada como fallback se nao ler banca)
_ULTIMA_STAKE = {"FT": 0.0, "VENC": 0.0, "PERD": 0.0, "CLA": 0.0}
# Flag pra avisar 1x quando saldo nao for reconhecido (evita flood TG)
_AVISO_SALDO_NAO_RECONHECIDO = False


# ==================== PARSE SALDO + BANCA STATE ====================
def _parse_saldo_str(txt: str) -> Optional[float]:
    """Parseia formatos da Superbet:
    - '2.74K'        (mobile abreviado: K=mil, M=milhao)
    - '2.740,00'     (desktop BR: ponto=milhar, virgula=decimal)
    - '2,740.00'     (US fallback)
    - '2740'         (cru)"""
    if not txt:
        return None
    s = txt.strip().upper().replace("R$", "").replace(" ", "").replace("\xa0", "")
    if not s:
        return None

    mult = 1.0
    if s.endswith("K"): mult = 1_000.0; s = s[:-1]
    elif s.endswith("M"): mult = 1_000_000.0; s = s[:-1]
    elif s.endswith("B"): mult = 1_000_000_000.0; s = s[:-1]

    if "," in s and "." in s:
        s = s.replace(".", "").replace(",", ".")
    elif "," in s:
        s = s.replace(",", ".")
    elif "." in s:
        if mult > 1:
            pass
        else:
            partes = s.split(".")
            if len(partes) >= 2 and len(partes[-1]) == 3:
                s = s.replace(".", "")

    try:
        valor = float(s) * mult
        if valor < 0 or valor > 1e9:
            return None
        return valor
    except Exception:
        return None


def _carrega_banca_state() -> dict:
    if not BANCA_STATE_FILE.exists():
        return {}
    try:
        return json.loads(BANCA_STATE_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _salva_banca_state():
    try:
        data = {
            "banca_atual": _BANCA_ATUAL,
            "banca_inicial": _BANCA_INICIAL,
            "banca_ts": _BANCA_TS,
            "conta": str(USUARIO),
            "updated_at": datetime.now().isoformat(timespec="seconds"),
        }
        BANCA_STATE_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")
    except Exception as e:
        try: log_ev(f"  [banca] falha salvar state: {str(e)[:60]}")
        except Exception: pass


async def ler_saldo_dom(page) -> Optional[float]:
    seletores = [
        ".e2e-balance .e2e-currency__amount",
        ".mobile-header-balance .e2e-currency__amount",
        ".balance .e2e-currency__amount",
        ".e2e-currency__amount",
    ]
    for sel in seletores:
        try:
            loc = page.locator(sel).first
            if await loc.count() == 0: continue
            try:
                txt = await loc.inner_text(timeout=2000)
            except Exception:
                continue
            valor = _parse_saldo_str(txt)
            if valor is not None and valor > 0:
                return valor
        except Exception:
            continue
    return None


async def atualizar_banca(page, force=False) -> Optional[float]:
    """Le saldo do DOM e atualiza high-watermark (so sobe).

    Tambem trackeia falhas de leitura DOM para acionar modo emergencia
    (3 falhas seguidas = EMERGENCIA). Resetar streak qualquer leitura OK.
    """
    global _BANCA_ATUAL, _BANCA_TS, _BANCA_INICIAL, _ULTIMA_LEITURA
    global _AVISO_SALDO_NAO_RECONHECIDO
    global _DOM_FAIL_STREAK

    agora = _time.time()
    if not force and (agora - _ULTIMA_LEITURA) < 5:
        return None
    _ULTIMA_LEITURA = agora

    try:
        valor = await ler_saldo_dom(page)
    except Exception as e:
        log_ev(f"  [banca] erro le DOM: {str(e)[:60]}")
        _DOM_FAIL_STREAK += 1
        await _check_emergencia_dom()
        return None

    if valor is None:
        log_ev(f"  [banca] nao conseguiu ler DOM (streak={_DOM_FAIL_STREAK + 1}/{LIMITE_DOM_FAIL})")
        _DOM_FAIL_STREAK += 1
        await _check_emergencia_dom()
        return None

    # Leitura OK -> reseta streak
    if _DOM_FAIL_STREAK > 0:
        log_ev(f"  [banca] streak DOM resetado (era {_DOM_FAIL_STREAK})")
    _DOM_FAIL_STREAK = 0

    if _AVISO_SALDO_NAO_RECONHECIDO:
        _AVISO_SALDO_NAO_RECONHECIDO = False
        log_ev("  [banca] saldo voltou a ser reconhecido")
        asyncio.create_task(tg_send(
            f"✅ <b>SALDO RECONHECIDO NOVAMENTE</b>\n"
            f"banca: R${valor:,.2f}\n"
            f"voltou a calcular pelas %"
        ))

    async with _BANCA_LOCK:
        if _BANCA_INICIAL == 0.0:
            _BANCA_INICIAL = valor
            log_ev(f"  [banca] inicial: R${valor:,.2f}")

        if valor > _BANCA_ATUAL:
            antigo = _BANCA_ATUAL
            _BANCA_ATUAL = valor
            _BANCA_TS = agora
            delta = valor - antigo
            if antigo > 0:
                log_ev(f"  [banca] SUBIU R${antigo:,.2f} -> R${valor:,.2f} (+R${delta:,.2f})")
                asyncio.create_task(tg_send(
                    f"📈 <b>BANCA SUBIU</b>\n"
                    f"R${antigo:,.2f} → R${valor:,.2f}\n"
                    f"+R${delta:,.2f}"
                ))
            _salva_banca_state()
        elif valor < _BANCA_ATUAL:
            log_ev(f"  [banca] desceu (R${valor:,.2f} < R${_BANCA_ATUAL:,.2f}) - mantem high-watermark")

    return valor


async def _check_emergencia_dom():
    """DOM_FAIL_STREAK >= LIMITE -> DISPARA TROCA DE CONTA automaticamente.
    Antes virava EMERGENCIA; agora trata como sinal de que a casa derrubou a sessao
    (limitacao silenciosa) e troca de conta sozinho.
    Soh vira emergencia se a pool INTEIRA tambem nao ler DOM (cenario extremamente raro)."""
    global _DOM_FAIL_STREAK
    global EMERGENCIA, MOTIVO_EMERGENCIA, PAUSADO, MOTIVO_PAUSA
    global PRECISA_TROCAR_CONTA, _TROCA_MANUAL, _TROCA_FORCADA_USER
    if EMERGENCIA or PRECISA_TROCAR_CONTA:
        return
    if _DOM_FAIL_STREAK >= LIMITE_DOM_FAIL:
        log_ev(f"  [dom_fail] streak={_DOM_FAIL_STREAK}/{LIMITE_DOM_FAIL} -> trocando conta (limitacao silenciosa?)")
        # Marca como nao-manual pra contar no cooldown
        _TROCA_FORCADA_USER = None
        _TROCA_MANUAL = False
        PRECISA_TROCAR_CONTA = True
        # Reseta streak agora; se proxima conta tambem falhar DOM, vira a contar de novo
        _DOM_FAIL_STREAK = 0
        await tg_send(
            f"🔄 <b>DOM nao lido x{LIMITE_DOM_FAIL}</b>\n"
            f"conta: <code>{USUARIO}</code>\n"
            f"<i>trocando conta automaticamente (provavel limitacao silenciosa)</i>"
        )


async def _check_emergencia_login():
    """LOGIN_FAIL: tenta proxima conta automaticamente.
    Nao tem mais limite global - so para se a POOL INTEIRA falhar (vira AGUARDANDO_CONTA)."""
    # Nao faz nada aqui agora: o fluxo principal (boot + trocar_conta + loop) ja
    # itera pela pool automaticamente quando login falha. Esta funcao fica como
    # no-op pra compatibilidade com chamadas existentes.
    return


def calc_stake(pct: float, teto: float, chave: str) -> float:
    """Stake = min(banca * pct, teto), respeitando piso global.
    chave: 'FT' / 'VENC' / 'PERD' - identifica a estrategia pra fallback"""
    global _AVISO_SALDO_NAO_RECONHECIDO

    if not JUROS_COMPOSTOS_ATIVO:
        return teto

    if _BANCA_ATUAL <= 0:
        ultima = _ULTIMA_STAKE.get(chave, 0.0)
        if ultima > 0:
            stake_fallback = ultima
            origem = f"ultima ({chave})"
        else:
            stake_fallback = teto
            origem = "teto (sem ultima)"

        if not _AVISO_SALDO_NAO_RECONHECIDO:
            _AVISO_SALDO_NAO_RECONHECIDO = True
            log_ev(f"  [banca] SALDO NAO RECONHECIDO - usando {origem} = R${stake_fallback:.2f}")
            asyncio.create_task(tg_send(
                f"⚠️ <b>SALDO NAO RECONHECIDO</b>\n"
                f"Bot esta usando a ULTIMA stake calculada como fallback:\n"
                f"• FT:   R${_ULTIMA_STAKE['FT']:.2f}\n"
                f"• VENC: R${_ULTIMA_STAKE['VENC']:.2f}\n"
                f"• PERD: R${_ULTIMA_STAKE['PERD']:.2f}\n"
                f"\n<i>Use /refresh pra tentar ler novamente</i>"
            ))
        return round(stake_fallback, 2)

    bruto = _BANCA_ATUAL * pct
    stake = min(bruto, teto)
    # Se a casa ja sinalizou um max menor pra essa estrategia, respeita
    limite_casa = _LIMITE_CASA.get(chave, 0.0)
    if limite_casa > 0:
        stake = min(stake, limite_casa)
    stake = max(stake, STAKE_MIN_VIAVEL_GLOBAL)
    stake = round(stake, 2)
    _ULTIMA_STAKE[chave] = stake
    return stake


def calc_stake_preview(pct: float, teto: float, chave: str) -> float:
    """Versao SILENCIOSA da calc_stake pra uso informativo."""
    if not JUROS_COMPOSTOS_ATIVO:
        return teto
    if _BANCA_ATUAL <= 0:
        ultima = _ULTIMA_STAKE.get(chave, 0.0)
        return round(ultima if ultima > 0 else teto, 2)
    bruto = _BANCA_ATUAL * pct
    stake = min(bruto, teto)
    stake = max(stake, STAKE_MIN_VIAVEL_GLOBAL)
    return round(stake, 2)


# ==================== HELPER NORM ====================
def _norm_par(s):
    return frozenset(str(x).strip().upper() for x in s)

def _norm_set(s):
    return {str(x).strip().upper() for x in s}


# Compat: PARES_TOXICOS_FT esvaziado (BL condicional substitui)
PARES_TOXICOS_FT = set()

# ==================== ESTRATEGIA 1: OVER FT ====================
# Backtest 7.8d Adriatic+EAL: |diff|>=12, delta<=6, cap=20, BL condicional (n>=60)
# Resultado: 2.340 tips, WR 77.9%, ROI +38.2%, +893u, DD -23.7u, 8/8 green days
ESTRATEGIA_OVER_FT_ATIVA = False   # DESLIGADA (v12: bot roda SO a HC GIRO)
MKT_OVER_FT = 200586
DIFF_MIN_FT = 12
PERIODOS_OVER_FT = {"Q1", "Q2", "Q3", "Q4"}     # Q1 incluso (validado)
LINHA_MIN_OVER_FT = 30.0
LINHA_MAX_OVER_FT = 150.0
MAX_APOSTAS_OVER_FT = 20                          # cap pra delta=6 (max real ~7 ent/jogo)

# Delta superior: linha apostada nao pode subir mais que X pts acima da PRIMEIRA linha
# vigente no instante do 1o sinal (|diff|>=12).
# Linha CAINDO abaixo da ancora E PERMITIDA (so freia subida exagerada).
DELTA_MAX_OVER_FT = 6.0

# BL condicional baseada em papel no momento do sinal (n>=60 no papel relevante).
BL_FT_LADROES = _norm_set({"CAIRO", "LAGOS"})                                          # skip se em A OU B
BL_FT_VENC    = _norm_set({"BERLIN", "MADRID", "MOSCOW", "SHANGHAI", "SYDNEY", "VALENCIA"})  # skip se vencedor
BL_FT_PERD    = _norm_set({"ATHENS", "BANGKOK", "BOGOTA", "OTTAWA"})                   # skip se perdedor

# Compat: mantido como vazio pra nao quebrar refs antigas
BLACKLIST_OVER_FT = _norm_set(set())

FATOR_OVERASK_FT = 0.80
MAX_TENTATIVAS_OVERASK_FT = 1

MULT_JOGO_FT = 20                                 # alinhado com MAX_APOSTAS_OVER_FT
TETO_ABS_JOGO_FT = 1500.0

def stake_max_jogo_ft():
    if not JUROS_COMPOSTOS_ATIVO or _BANCA_ATUAL <= 0:
        return TETO_ABS_JOGO_FT
    stake_individual = calc_stake_preview(PCT_FT, TETO_FT, "FT")
    return min(stake_individual * MULT_JOGO_FT, TETO_ABS_JOGO_FT)


def _ft_deve_pular(na, nb, sh, sa):
    """BL condicional OVER FT.
    Retorna motivo do skip (str) se deve pular, None se OK pra apostar.
    Aplica regra baseada em papel (vencedor/perdedor) no momento do sinal."""
    if not na or not nb:
        return None
    na_u = str(na).strip().upper()
    nb_u = str(nb).strip().upper()
    # 1. Ladrao total
    if na_u in BL_FT_LADROES:
        return f"LADRAO {na_u}"
    if nb_u in BL_FT_LADROES:
        return f"LADRAO {nb_u}"
    # 2. Identifica papel (filtro diff>=12 garante que nao ha empate)
    if sh > sa:
        vencedor, perdedor = na_u, nb_u
    elif sa > sh:
        vencedor, perdedor = nb_u, na_u
    else:
        return None
    # 3. Ruim quando vence
    if vencedor in BL_FT_VENC:
        return f"BL_VENC {vencedor}"
    # 4. Ruim quando perde
    if perdedor in BL_FT_PERD:
        return f"BL_PERD {perdedor}"
    return None

# ==================== ESTRATEGIA 2: Q4 VENCENDO ====================
# Backtest 8d Adriatic+EAL (linhas soltas, dedup):
# diff>=12, above[10,20], BL={MADRID,VALENCIA,BERLIN,MEDELLIN,BANGKOK} + 4 H2H
# => n=875, WR 76.2%, ROI +36.86%, +322u, 8/8 green, pior dia +20.4u
ESTRATEGIA_VENCENDO_ATIVA = False  # DESLIGADA (v12: bot roda SO a HC GIRO)
MKT_TOTAL_HOME = 200587
MKT_TOTAL_AWAY = 200588
MKT_Q4_HOME = 200601
MKT_Q4_AWAY = 200602
USAR_TOTAL_PARTIDA_VENC = True
USAR_PTS_Q4_VENC = True
PERIODOS_VENC = {"Q3", "Q4"}
DIFF_MIN_VENC = 12
LINE_ABOVE_MIN_VENC = 10.0
LINE_ABOVE_MAX_VENC = 20.0
MULT_JOGO_VENC = 14
TETO_ABS_JOGO_VENC = 2900.0
FATOR_OVERASK_VENC = 0.80
MAX_TENTATIVAS_OVERASK_VENC = 1
MAX_APOSTAS_TOTAL_VENC = 8
MAX_APOSTAS_Q4_VENC = 8
# BL revisada com base no ranking de ROI por jogador (dedup, v=10..20):
# MADRID(-34%, n=16), VALENCIA(-24%, n=29), BANGKOK(+4.5%, n=58, marginal),
# BERLIN(+15.5%, n=89, marginal), MEDELLIN(+22%, n=34, marginal mas santos quis fora).
# Removidos da BL antiga por serem LUCRATIVOS: BOGOTA(+21%), DUBLIN(+47%), MELBOURNE(+41%).
BLACKLIST_VENC = _norm_set({"MADRID", "VALENCIA", "BERLIN", "MEDELLIN", "BANGKOK"})
# H2H revisado: pares com ROI < -15% em n>=15 (dedup)
H2H_TOXICOS_VENC = {
    ("KRAKOW", "PARIS"),       # ROI -72%, n=19
    ("CAIRO", "KIEV"),         # ROI -56%, n=16
    ("DUBLIN", "MELBOURNE"),   # ROI -25%, n=33
    ("LIMA", "MELBOURNE"),     # ROI -17%, n=15
}
H2H_TOXICOS_VENC = {_norm_par(p) for p in H2H_TOXICOS_VENC}

def stake_max_jogo_venc():
    if not JUROS_COMPOSTOS_ATIVO or _BANCA_ATUAL <= 0:
        return TETO_ABS_JOGO_VENC
    stake_individual = calc_stake_preview(PCT_VENC, TETO_VENC, "VENC")
    return min(stake_individual * MULT_JOGO_VENC, TETO_ABS_JOGO_VENC)

# ==================== ESTRATEGIA 3: Q4 PERDENDO ====================
# Backtest 8d Adriatic+EAL (linhas soltas, dedup):
# diff<=-16, above[10,20], BL={AMSTERDAM,ATHENS} => n=541, WR 82.3%, ROI +47.94%, +259u, 8/8 green
ESTRATEGIA_PERDENDO_ATIVA = False  # DESLIGADA (v12: bot roda SO a HC GIRO)
USAR_TOTAL_PARTIDA_PERD = True
USAR_PTS_Q4_PERD = True
PERIODOS_PERD = {"Q3", "Q4"}
DIFF_MIN_PERD = 16
LINE_ABOVE_MIN_PERD = 10.0
LINE_ABOVE_MAX_PERD = 20.0
MULT_JOGO_PERD = 12
TETO_ABS_JOGO_PERD = 2500.0
FATOR_OVERASK_PERD = 0.80
MAX_TENTATIVAS_OVERASK_PERD = 1
MAX_APOSTAS_TOTAL_PERD = 8
MAX_APOSTAS_Q4_PERD = 12
# BL revisada: AMSTERDAM (-1.8%, n=22) e ATHENS (-0.3%, n=31) — únicos com ROI nao-positivo e volume relevante.
# Banidos do BL antigo (eram LUCRATIVOS): MUMBAI(+20%), PANAMA(+62%), MELBOURNE(+87%), MOSCOW(sem volume).
BLACKLIST_PERD = _norm_set({"AMSTERDAM", "ATHENS"})
# H2H VAZIO: nenhum par H2H tem ROI claramente negativo em PERD (dedup, n>=15)
H2H_TOXICOS_PERD = set()
H2H_TOXICOS_PERD = {_norm_par(p) for p in H2H_TOXICOS_PERD}

def stake_max_jogo_perd():
    if not JUROS_COMPOSTOS_ATIVO or _BANCA_ATUAL <= 0:
        return TETO_ABS_JOGO_PERD
    stake_individual = calc_stake_preview(PCT_PERD, TETO_PERD, "PERD")
    return min(stake_individual * MULT_JOGO_PERD, TETO_ABS_JOGO_PERD)

# ========= ESTRATEGIA 4: HC MULTI-LIGA (TipManager, v12.3) =========
# v12.3: estrategias amarradas a LIGA (tid) — dupla armada: 54 B na
# Mixed (80566/t7) + 61 PERFEITA na EAL NextGen (89069/t43). 56 GIRO e
# 57 FUNDA ficam na tabela DESLIGADAS (ativa=False) — religa em 1 palavra.
# Scan multi-torneio com carimbo _tid; rosters t7+t43 mesclados no TM.
# (historico v12.2 TRIPLA abaixo)
# v12.2 TRIPLA: as 3 campeas da GG Mixed rodando JUNTAS na mesma conta,
# espelhos locais dos bots do painel: 56 GIRO (Ult.10>=70, L>=4.5,
# folga>=1.5, teto 7), 54 B (Ult.10>=70, L>=6.5, folga>=5.5, teto 3) e
# 57 FUNDA (Ult.30>=80, L>=6.5, folga>=5.5, teto 5). Linha aprovada por
# mais de uma = UMA aposta fisica (stake unica) com credito de TODAS as
# aprovadoras no CSV (apostas_supermae.csv) e nos tetos logicos. Teto
# FISICO por jogo continua 7. LIGA: TID 80566 / TM t7 / mkt 200585.
ESTRATEGIA_HC_ATIVA = False   # v12.4: bot 61 aposta SO pelo sinal da MikeDB (braco de sinais). Via TM desligada pra nao duplicar aposta; TipManager nem carrega.
# --- estrategias por LIGA (tid); 'ativa' liga/desliga cada uma em 1 palavra ---
# folga_min=None = estrategia SEM gate de folga (PERFEITA e escada pura).
# wr_min 0.995 = exigir 100% com seguranca de float (pct vem 1.0 exato do TM).
ESTRATEGIAS_HC = (
    dict(id=54, nome="B54",      ativa=False, tid=80566, janela="last_10", wr_min=0.70,  linha_min=6.5, linha_max=40.0, folga_min=5.5,  teto=3),
    dict(id=61, nome="PERFEITA", ativa=True,  tid=89069, janela="last_10", wr_min=0.995, linha_min=6.5, linha_max=40.0, folga_min=None, teto=7),
    dict(id=56, nome="GIRO",     ativa=False, tid=80566, janela="last_10", wr_min=0.70,  linha_min=4.5, linha_max=40.0, folga_min=1.5,  teto=7),
    dict(id=57, nome="FUNDA",    ativa=False, tid=80566, janela="last_30", wr_min=0.80,  linha_min=6.5, linha_max=40.0, folga_min=5.5,  teto=5),
)
HC_JANELAS = tuple(dict.fromkeys(e["janela"] for e in ESTRATEGIAS_HC if e["ativa"]))
HC_ROTULO_BOOT = " + ".join(f"{e['id']} {e['nome']}({TIDS_SUPERBET.get(e['tid'], '?')})"
                            for e in ESTRATEGIAS_HC if e["ativa"])
MKT_HC_FT = 200585                 # "Handicap (Inc. prorrogacao)" = FT; quartos/2T tem OUTRO marketId
HC_LINHA_MIN = 4.5
HC_LINHA_MAX = 40.0
HC_WR_MIN = 0.70                   # cobertura minima da linha nas ULTIMAS 10 (HC_WR_JANELA)
HC_MIN_PARTIDAS = 0                # sem piso (igual ao GIRO minerado); piso 5 travou no vivo - investigar TipManager.n antes de reativar
HC_WR_JANELA = "last_10"           # janela da cobertura (GIRO = Ult.10); fail-closed se ausente
HC_FOLGA_MIN = 1.5                 # folga minima na ENTRADA: linha - deficit do lado apostado
HC_MAX_LINHAS_JOGO = 7
HC_ODD_MIN, HC_ODD_MAX = 1.30, 10.0

# >>> stake FIXA de R$5 por aposta (NAO usa juros compostos / % banca) <<<
HC_STAKE_TESTE = 30.0

# Blacklists da estrategia campea (mesmas do sporty5 / bot_40).
# Pra rodar o sporty1 "puro": esvazia FAVORITO e PARES.
BLACKLIST_HC_ZEBRA = _norm_set({"AMSTERDAM", "BOGOTA", "CAIRO"})    # nunca aposta essa zebra
BLACKLIST_HC_FAVORITO = _norm_set({"BOGOTA"})                       # nunca aposta zebra CONTRA esse favorito
BLACKLIST_HC_PARES = {_norm_par(p) for p in {
    ("MADRID", "MELBOURNE"),
    ("MEDELLIN", "BOGOTA"),
}}                                                                  # pula o jogo inteiro

FATOR_OVERASK_HC = 0.80
MAX_TENTATIVAS_OVERASK_HC = 2

# ==================== ESTRATEGIA 5: UNDER CLA (e-football, jogo atropelado) ====================
# Achado do engenheiro (07/09/2026): Cyber Live Arena, Total de Gols do jogo, UNDER quando alguem
# abre 4+ gols de vantagem. Linha >= 5,5 e odd >= 1,60. Sem chip, sem blacklist, sem teto por jogo.
# Base 08/08->06/09 na Superbet: 494 ap, +170u, ROI 34,5% (odd media 2,15). Estrelabet: 876 ap, +214u, 24,4%.
ESTRATEGIA_UNDER_CLA_ATIVA = True
SPORT_ID_FUT = 75                    # sportId do E-Football na Superbet (conferido ao vivo na API de oferta em 08/09/2026)
TIDS_CLA = {94993}                   # tournamentId da Cyber Live Arena na Superbet (routers/torneios.py da tipmike_api + conferido ao vivo). O by-date NAO traz tournamentName, entao o filtro e por ID
CLA_NOMES_TID = {94993: "Cyber Live Arena"}
SPORT_NOMES = {70: "E-Sport Basquete", 75: "E-Sport Futebol"}
CLA_NOME_RE = re.compile(r"cyber\s*live\s*arena|\bCLA\b", re.IGNORECASE)
MKT_OU_FT_FUT = 200550               # "Total de Gols" (jogo inteiro) no e-football da Superbet (conferido no acervo MikeDB)
CLA_DIFF_MIN = 4                     # |placar casa - fora| minimo pra disparar
CLA_LINHA_MIN = 0.0                  # linha minima do under (0 = todas as linhas; o achado com linha>=5,5 dava 20,3% vs 18,4% solto)
CLA_LINHA_MAX = 30.0
CLA_ODD_MIN, CLA_ODD_MAX = 1.60, 6.0
CLA_PERIODOS = None                  # None = qualquer momento do jogo (validado: o efeito e da margem, nao do tempo)
MAX_APOSTAS_CLA = 0                  # 0 = sem teto de entradas por jogo (uma por linha nova que a casa abrir)
CLA_STAKE_FIXA = 1.0                 # > 0 = stake FIXA em R$ (ignora % da banca, teto e piso global de R$30). 0 = usa PCT/TETO
PCT_CLA     = 0.02                   # % da banca por aposta (so vale se CLA_STAKE_FIXA == 0)
TETO_CLA    = 100.0                  # teto em R$ por aposta (so vale se CLA_STAKE_FIXA == 0)
CLA_STAKE_MIN = 1.0                  # piso desta estrategia (a casa nao aceita abaixo disso)
MULT_JOGO_CLA = 8                    # trava de seguranca: max R$ por jogo = MULT x stake
FATOR_OVERASK_CLA = 0.80
MAX_TENTATIVAS_OVERASK_CLA = 1
CLA_CSV = Path("sinais_under_cla.csv")   # TODO sinal (apostado ou nao) vai pra ca: e o que mede a CAPTURA real
_SPORT_ID_FUT_APRENDIDO = 0
_CLA_AVISO_SPORT = False
_CLA_STATS = {"sinais": 0, "apostas": 0, "recusas": 0, "stake": 0.0}


def stake_max_jogo_cla():
    """Teto de grana por jogo na UNDER CLA: MULT_JOGO_CLA x stake individual."""
    try:
        if CLA_STAKE_FIXA > 0:
            return CLA_STAKE_FIXA * MULT_JOGO_CLA
        return calc_stake_preview(PCT_CLA, TETO_CLA, "CLA") * MULT_JOGO_CLA
    except Exception:
        return (CLA_STAKE_FIXA if CLA_STAKE_FIXA > 0 else TETO_CLA) * MULT_JOGO_CLA


def _cla_csv_registrar(evento, jogo, placar, diff, periodo, linha, odd_pedida, stake_pedida, status, detalhe="", odd_aceita="", stake_real=""):
    """Registra TODO sinal (apostado, recusado, pulado). Sem isso nao da pra medir captura."""
    try:
        novo = not CLA_CSV.exists()
        with open(CLA_CSV, "a", encoding="utf-8", newline="") as f:
            if novo:
                f.write("ts;evento_id;jogo;placar;diff;periodo;linha;odd_pedida;stake_pedida;status;detalhe;odd_aceita;stake_real;conta\n")
            def _c(x):
                return str(x).replace(";", ",").replace("\n", " ")
            f.write(";".join(_c(x) for x in [
                datetime.now().strftime("%Y-%m-%d %H:%M:%S"), evento, jogo, placar, diff, periodo, linha,
                odd_pedida, f"{stake_pedida:.2f}" if isinstance(stake_pedida, (int, float)) else stake_pedida,
                status, detalhe, odd_aceita, stake_real, (USUARIO if CONTAS else "")]) + "\n")
    except Exception as e:
        try: log_ev(f"[CLA] csv err: {str(e)[:80]}")
        except Exception: pass
HC_RETRY_COOLDOWN_S = 4            # falhou a aposta: espera antes de re-tentar a MESMA linha
HC_TM_RETRY_S = 15                 # H2H nao veio (TM lento): re-tenta a descoberta em Xs
HC_TM_REBOOT_S = 300               # TipManager fora do ar: re-tenta login/players a cada Xs
HC_TG_POR_APOSTA = True            # manda cada aposta HC no Telegram (util no teste)

HC_CSV_ARQ = Path("apostas_supermae.csv")


def _hc_csv_registrar(rotulo, jogo, nick, linha, odd, stake, p10, p30, folga, placar, comprovante):
    """Uma linha por aposta REAL com o(s) cerebro(s) de origem (56/54/57).
    sep=; e virgula decimal (abre direto no Excel BR). NUNCA derruba a aposta."""
    def _num(x):
        try:
            return str(float(x)).replace('.', ',')
        except (TypeError, ValueError):
            return ''
    try:
        novo = not HC_CSV_ARQ.exists()
        try:
            conta = conta_ativa().get('user', '?')
        except Exception:
            conta = '?'
        with open(HC_CSV_ARQ, 'a', encoding='utf-8-sig', newline='') as f:
            import csv as _csv
            w = _csv.writer(f, delimiter=';')
            if novo:
                w.writerow(['data_hora', 'estrategias', 'jogo', 'nick', 'linha', 'odd',
                            'stake', 'ult10', 'ult30', 'folga', 'placar_envio', 'conta', 'comprovante'])
            w.writerow([datetime.now().strftime('%d/%m/%Y %H:%M:%S'), rotulo, jogo, nick,
                        _num(linha), _num(odd), _num(stake), _num(p10), _num(p30),
                        _num(folga), placar, conta, comprovante])
    except Exception as e:
        log_ev(f"[csv] falha ao registrar aposta: {type(e).__name__}: {str(e)[:80]}")


def stake_max_jogo_hc():
    """Teto de grana por jogo na HC: stake fixa x max de linhas."""
    return HC_STAKE_TESTE * HC_MAX_LINHAS_JOGO


# ==================== LOGS ====================
LOG_EV = Path("bot_eventos.log")
LOG_SCAN = Path("bot_scan.log")

def ts():
    return datetime.now().strftime("%H:%M:%S")

def log_ev(msg):
    line = f"[{ts()}] {msg}"
    try: print(line, flush=True)
    except Exception: pass
    try:
        with open(LOG_EV, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except Exception: pass

def log_scan(msg):
    try:
        with open(LOG_SCAN, "a", encoding="utf-8") as f:
            f.write(f"[{ts()}] {msg}\n")
    except Exception: pass


# ==================== TIPMANAGER (ESTRATEGIA HC) ====================
# Credenciais/endpoints identicos ao sporty1.py. ATENCAO: o endpoint de H2H
# (h2h.tipmanager.xyz:2087) so responde de DENTRO da VPS (allowlist de IP).
TM_EMAIL = "igorpjacadastros@gmail.com"
TM_SENHA = "IgoR*Ethan2022"
TM_SUP = "https://jnurxezspleufiooyekw.supabase.co"
TM_ANON = "sb_publishable_kApTLSOlncxHBxBkred3cA_XGCNRVFW"
TM_APP = ("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
          "eyJleHAiOjIwMDk5NDcwNjgsImlhdCI6MTY5ODkwNzA2OCwidXNlciI6InRpcG1hbmFnZXIifQ."
          "icE5hbAKg9-V_DjxlXZem-hmmo5NIPsudULFD-nOwCk")
TM_KEY = b"bd084427da1431cc42b8c8c4c0b5fe3a"
TM_SPORT = 2
TM_TIDS = (7, 43)                  # torneios do TipManager: t7 = GG Mixed, t43 = EAL/Adriatic (rosters mesclados)
TM_TID = 7                         # legado (logs antigos)
TM_H2H_URL = "https://h2h.tipmanager.xyz:2087/v2/ebasket_encrypted"
TM_PLAYERS_URL = f"https://api.tipmanager.net/v1/players?id_sport={TM_SPORT}&id_tournament={TM_TID}&place=9"

_HC_ALERTAS: dict = {}          # chave -> ts do ultimo aviso (anti-flood TG)
HC_ALERT_COOLDOWN = 900         # 15 min


async def _hc_aviso(chave, msg):
    """Aviso grave da HC no Telegram, com anti-flood por tipo de erro."""
    agora = _time.time()
    if agora - _HC_ALERTAS.get(chave, 0) < HC_ALERT_COOLDOWN:
        return
    _HC_ALERTAS[chave] = agora
    log_ev(f"[HC AVISO] {chave}: {msg}")
    try:
        await tg_send(f"\U0001f6a8 <b>HC ZEBRA</b>\n{msg}")
    except Exception:
        pass


_HC_HIST_KEYS_LOGADO = False


def _hc_hist_keys_debug(hist):
    """Loga UMA vez as chaves de janela do payload (se 'last_10' nao existir,
    o nome real da janela aparece no bot_eventos.log pra ajustar HC_WR_JANELA)."""
    global _HC_HIST_KEYS_LOGADO
    if _HC_HIST_KEYS_LOGADO:
        return
    _HC_HIST_KEYS_LOGADO = True
    try:
        log_ev(f"[HC] janelas disponiveis no historical do TipManager: {sorted((hist or {}).keys())}")
    except Exception:
        pass


class TipManager:
    """Cliente do TipManager (igual sporty1.py): login Supabase + H2H AES-GCM."""

    def __init__(self):
        self.token = None
        self.exp = 0
        self.ids = {}
        self._c = {}
        self._lock = asyncio.Lock()
        self.falhas = 0

    @staticmethod
    def _dec(data):
        iv, ct, tag = data[:12], data[12:-16], data[-16:]
        c = AES.new(TM_KEY, AES.MODE_GCM, nonce=iv, mac_len=16)
        c.update(b"")
        return json.loads(gzip.decompress(c.decrypt_and_verify(ct, tag)))

    async def login(self):
        async with self._lock:
            if self.token and _time.time() < self.exp:
                return
            wait = 5
            for _ in range(8):
                try:
                    def _do():
                        r = requests.post(f"{TM_SUP}/auth/v1/token?grant_type=password",
                            headers={"apikey": TM_ANON, "Content-Type": "application/json"},
                            json={"email": TM_EMAIL, "password": TM_SENHA}, timeout=20)
                        r.raise_for_status()
                        return r.json()
                    d = await asyncio.to_thread(_do)
                    self.token = d["access_token"]
                    self.exp = _time.time() + 45 * 60
                    log_ev("[tm] login ok")
                    return
                except Exception as e:
                    log_ev(f"[tm] login erro {str(e)[:50]} retry {wait}s")
                    await asyncio.sleep(wait)
                    wait = min(wait * 2, 60)
            await _hc_aviso("tm_login", "TipManager: nao consegui logar (varias tentativas)")

    async def load_players(self):
        for _ in range(3):
            try:
                novos, por_t = {}, []
                relogar = False
                for _tid in TM_TIDS:
                    def _do(t=_tid):
                        return requests.get(
                            f"https://api.tipmanager.net/v1/players?id_sport={TM_SPORT}&id_tournament={t}&place=9",
                            headers={"Authorization": f"Bearer {TM_APP}"}, timeout=15)
                    r = await asyncio.to_thread(_do)
                    if r.status_code == 401:
                        relogar = True
                        break
                    r.raise_for_status()
                    lote = {p["description"].strip().lower(): p["id"] for p in r.json()}
                    por_t.append(f"t{_tid}={len(lote)}")
                    novos.update(lote)
                if relogar:
                    self.token = None
                    await self.login()
                    continue
                self.ids = novos
                log_ev(f"[tm] {len(self.ids)} players ({' + '.join(por_t)})")
                return
            except Exception as e:
                log_ev(f"[tm] players {str(e)[:50]}")
                await asyncio.sleep(3)
        if not self.ids:
            await _hc_aviso("tm_players", "TipManager: nao carregou players")

    async def h2h(self, na, nb):
        if not self.token or _time.time() >= self.exp:
            await self.login()
        ida = self.ids.get((na or "").strip().lower())
        idb = self.ids.get((nb or "").strip().lower())
        if not ida or not idb:
            return None
        key = tuple(sorted([ida, idb]))
        c = self._c.get(key)
        if c and _time.time() - c[0] < 600:
            return c[1]
        body = {"id_sport": TM_SPORT, "id_player_a": ida, "id_player_b": idb,
                "timezone": "America/Sao_Paulo", "hour_range": [0, 24]}
        for tent in range(5):
            try:
                def _do(tk):
                    return cffi.post(TM_H2H_URL, json=body,
                        headers={"Authorization": f"Bearer {TM_APP}", "x-api-key": tk,
                                 "Content-Type": "application/json",
                                 "Origin": "https://tipmanager.net", "Referer": "https://tipmanager.net/"},
                        impersonate="chrome110", timeout=25, verify=False)
                r = await asyncio.to_thread(_do, self.token)
                if r.status_code == 200:
                    d = self._dec(r.content)
                    if d:
                        self._c[key] = (_time.time(), d)
                    self.falhas = 0
                    return d
                elif r.status_code == 401:
                    self.token = None
                    await self.login()
                    continue
                elif r.status_code in (429, 502, 503, 504):
                    await asyncio.sleep(4)
                    continue
                else:
                    await asyncio.sleep(2)
            except Exception as e:
                log_ev(f"[tm] h2h {str(e)[:50]}")
                await asyncio.sleep(2 * (tent + 1))
        self.falhas += 1
        if self.falhas >= 5:
            await _hc_aviso("tm_h2h", "TipManager: H2H falhando seguido (5x) - "
                                      "confere se o bot ta rodando NA VPS (endpoint tem allowlist de IP)")
        return None

    @staticmethod
    def n(h2h):
        return len((h2h or {}).get("info", {}).get("last_50") or [])

    @staticmethod
    def _role(h2h, alvo):
        info = h2h.get("info", {})
        a = (alvo or "").strip().lower()
        if a == (info.get("player_a") or "").strip().lower():
            return "a"
        if a == (info.get("player_b") or "").strip().lower():
            return "b"
        return None

    @staticmethod
    def pct(h2h, alvo, linha, janela=None):
        """Cobertura do lado + do `alvo` na linha. janela=None -> bucket 'all'
        (historico completo); janela='last_10' -> ultimas 10 (GIRO).
        FAIL-CLOSED: janela pedida ausente no payload -> None (e loga as chaves 1x)."""
        if not h2h:
            return None
        role = TipManager._role(h2h, alvo)
        if not role:
            return None
        k = f"pct_team_{role}_plus"
        if janela:
            aliases = (janela, janela.replace("_", ""))
        else:
            aliases = ("all",)
        for it in (h2h.get("ah_ft") or []):
            try:
                if abs(float(it.get("line")) - float(linha)) < 1e-6:
                    hist = (it.get("historical") or {})
                    for al in aliases:
                        b = hist.get(al)
                        if isinstance(b, dict) and b.get(k) is not None:
                            return float(b[k])
                    if janela:
                        _hc_hist_keys_debug(hist)
                    return None
            except (TypeError, ValueError):
                continue
        return None


# Estado global do TipManager (compartilhado pelas descobertas de jogo)
_TM: Optional[TipManager] = None
_TM_BOOTANDO = False
_TM_ULTIMA_TENTATIVA = 0.0


def _tm_pronto() -> bool:
    return _TM is not None and bool(_TM.ids)


async def _tm_boot():
    """Login + players do TipManager. Roda em background; re-chamavel se falhar."""
    global _TM, _TM_BOOTANDO, _TM_ULTIMA_TENTATIVA
    if _TM_BOOTANDO:
        return
    _TM_BOOTANDO = True
    _TM_ULTIMA_TENTATIVA = _time.time()
    try:
        if _TM is None:
            _TM = TipManager()
        await _TM.login()
        await _TM.load_players()
        if _tm_pronto():
            log_ev(f"[tm] PRONTO: {len(_TM.ids)} players (t{'+'.join(map(str, TM_TIDS))}) - HC liberada")
        else:
            log_ev("[tm] boot terminou SEM players - HC em espera (re-tenta sozinho)")
    except Exception as e:
        log_ev(f"[tm] boot exc: {type(e).__name__}: {str(e)[:100]}")
    finally:
        _TM_BOOTANDO = False


def calcular_targets_hc(h2h, na, nb, tid):
    """Linhas-alvo do jogo (1x por jogo) pra TRIPLA.
    Retorna {nick: {linha: frozenset(ids das estrategias que aprovam)}}.
    Cada estrategia exige a SUA janela (fail-closed se ausente), o SEU
    wr_min e a SUA faixa de linha; folga e teto ficam pro vivo."""
    targets = {na: {}, nb: {}}
    linhas = set()
    for it in (h2h.get("ah_ft") or []):
        try:
            linhas.add(float(it.get("line")))
        except (TypeError, ValueError):
            pass
    for ln in linhas:
        if ln < HC_LINHA_MIN or ln > HC_LINHA_MAX:
            continue
        for nk, opp in ((na, nb), (nb, na)):
            if nk in BLACKLIST_HC_ZEBRA:
                continue
            if opp in BLACKLIST_HC_FAVORITO:
                continue
            pcts = {j: TipManager.pct(h2h, nk, ln, janela=j) for j in HC_JANELAS}
            aprov = set()
            for e in ESTRATEGIAS_HC:
                if not e["ativa"] or e["tid"] != tid:
                    continue
                p = pcts.get(e["janela"])
                if (p is not None and p >= e["wr_min"]
                        and e["linha_min"] <= ln <= e["linha_max"]):
                    aprov.add(e["id"])
            if aprov:
                targets[nk][ln] = frozenset(aprov)
    return targets


_RE_HC_NOME = re.compile(r"\(([^()]+)\)\s*\(([+-]?\d+(?:\.\d+)?)\)\s*$")


def parse_hc_outcome(o):
    """Outcome do mkt 200585: name = 'Time X (NICK) (+13.5)'.
    Retorna (NICK_UPPER, linha_assinada) ou (None, None)."""
    try:
        m = _RE_HC_NOME.search(o.get("name") or "")
        if not m:
            return None, None
        return m.group(1).strip().upper(), float(m.group(2))
    except Exception:
        return None, None


def _hc_criar_validador(nick_alvo, linhas_alvo):
    """Validador passado pro apostar_com_overask: re-checa a odd FRESCA antes
    de postar. A Superbet mantem o MESMO uuid quando a linha do HC se move -
    sem essa checagem o bot apostaria a linha nova sem querer."""
    linhas = set(linhas_alvo)

    def _val(odd):
        try:
            nk, signed = parse_hc_outcome(odd)
            if nk is None or signed is None:
                return False, "nome do outcome nao parseou"
            if nk != nick_alvo:
                return False, f"outcome virou {nk}"
            if signed <= 0:
                return False, "virou lado - (favorito)"
            if signed not in linhas:
                return False, f"linha moveu p/ +{signed:g} (re-avalia no proximo scan)"
            price = odd.get("price", 0)
            if not price or price < HC_ODD_MIN or price > HC_ODD_MAX:
                return False, f"odd {price} fora [{HC_ODD_MIN},{HC_ODD_MAX}]"
            return True, ""
        except Exception as e:
            return False, f"exc no validador: {str(e)[:40]}"

    return _val


# ==================== SALDO ZERADO - CHECK ====================
def _check_saldo_zerado(jogos):
    """Verifica se a banca esta abaixo de SALDO_ZERADO_MULT_STAKE * stake_FT
    sem nenhuma aposta aberta em FT/VENC/PERD/HC por SALDO_ZERADO_JANELA_SEG.
    Quando dispara: marca troca conta auto (NAO entra no historico de cooldown)."""
    global _SALDO_ZERADO_DESDE, _SALDO_ZERADO_AVISADO
    global PRECISA_TROCAR_CONTA, _TROCA_MANUAL, _TROCA_FORCADA_USER

    if not SALDO_ZERADO_ATIVO:
        return
    if PAUSADO or EMERGENCIA or PRECISA_TROCAR_CONTA:
        return
    if _BANCA_ATUAL <= 0:
        # banca nao reconhecida -- nao da pra avaliar; reseta janela pra nao false positive
        if _SALDO_ZERADO_DESDE > 0:
            _SALDO_ZERADO_DESDE = 0.0
            _SALDO_ZERADO_AVISADO = False
        return

    # stake FT atual (dinamica, segue PCT_FT mudado via /stake)
    stake_ft = calc_stake_preview(PCT_FT, TETO_FT, "FT")
    threshold = stake_ft * SALDO_ZERADO_MULT_STAKE

    # tem alguma aposta aberta em qualquer estrategia?
    tem_aberta = any(
        (j.ft_stake + j.venc_stake + j.perd_stake + j.hc_stake) > 0
        for j in jogos.values()
    )

    agora = _time.time()
    zerado_agora = (_BANCA_ATUAL < threshold) and (not tem_aberta)

    if not zerado_agora:
        # Saiu da condicao (banca subiu OU tem aposta aberta) -> reset janela
        if _SALDO_ZERADO_DESDE > 0:
            log_ev(f"  [saldo-zerado] saiu da condicao (banca=R${_BANCA_ATUAL:,.2f} >= R${threshold:.2f} OU aposta aberta)")
            _SALDO_ZERADO_DESDE = 0.0
            _SALDO_ZERADO_AVISADO = False
        return

    # Entrou agora na condicao -> marca inicio da janela
    if _SALDO_ZERADO_DESDE == 0.0:
        _SALDO_ZERADO_DESDE = agora
        log_ev(f"  [saldo-zerado] DETECTADO: banca R${_BANCA_ATUAL:,.2f} < R${threshold:.2f} (2x stake_FT R${stake_ft:.2f}), iniciando janela {SALDO_ZERADO_JANELA_SEG/60:.0f}min")
        if not _SALDO_ZERADO_AVISADO:
            _SALDO_ZERADO_AVISADO = True
            asyncio.create_task(tg_send(
                f"💸 <b>SALDO BAIXO</b> [{USUARIO}]\n"
                f"banca: R${_BANCA_ATUAL:,.2f}\n"
                f"threshold: < R${threshold:.2f} (2x stake_FT R${stake_ft:.2f})\n"
                f"sem apostas abertas. aguardando {SALDO_ZERADO_JANELA_SEG/60:.0f}min antes de trocar conta."
            ))
        return

    # Ja marcado, checa se completou a janela
    decorrido = agora - _SALDO_ZERADO_DESDE
    if decorrido >= SALDO_ZERADO_JANELA_SEG:
        log_ev(f"  [saldo-zerado] JANELA COMPLETA ({decorrido/60:.1f}min) -> TROCANDO CONTA (sem cooldown)")
        # Troca como MANUAL pra nao contar no historico de cooldown
        _TROCA_FORCADA_USER = None
        _TROCA_MANUAL = True
        PRECISA_TROCAR_CONTA = True
        asyncio.create_task(tg_send(
            f"💸 <b>SALDO ZERADO</b> 😬\n"
            f"━━━━━━━━━━━━━━━━━\n"
            f"{USER_NAME}, a banca dessa conta ficou muito baixa!\n"
            f"\n"
            f"👤 conta: <code>{USUARIO}</code>\n"
            f"🏦 banca: R${_BANCA_ATUAL:,.2f} <i>(&lt; R${threshold:.2f})</i>\n"
            f"⏱️  sem aposta aberta por {decorrido/60:.0f}min\n"
            f"\n🔄 <b>trocando conta</b>\n"
            f"<i>(falha financeira -- nao entra no cooldown)</i>"
        ))
        # Reset pra proxima conta comecar limpa
        _SALDO_ZERADO_DESDE = 0.0
        _SALDO_ZERADO_AVISADO = False


# ==================== COMANDOS TELEGRAM ====================
def _fmt_dur(seg: float) -> str:
    if seg < 60: return f"{seg:.0f}s"
    if seg < 3600: return f"{seg/60:.1f}min"
    return f"{seg/3600:.2f}h"


async def cmd_saldo(reply_chat_id, args=None):
    """Responde com banca atual + stakes calculadas."""
    stake_ft = calc_stake_preview(PCT_FT, TETO_FT, "FT")
    stake_venc = calc_stake_preview(PCT_VENC, TETO_VENC, "VENC")
    stake_perd = calc_stake_preview(PCT_PERD, TETO_PERD, "PERD")
    max_jogo_ft = stake_max_jogo_ft()
    max_jogo_venc = stake_max_jogo_venc()
    max_jogo_perd = stake_max_jogo_perd()

    if _BANCA_ATUAL <= 0:
        banca_txt = "<i>nao lida ainda</i>"
        delta_txt = ""
    else:
        banca_txt = f"R${_BANCA_ATUAL:,.2f}"
        if _BANCA_INICIAL > 0 and _BANCA_INICIAL != _BANCA_ATUAL:
            delta = _BANCA_ATUAL - _BANCA_INICIAL
            pct = (delta / _BANCA_INICIAL) * 100
            sinal = "+" if delta >= 0 else ""
            delta_txt = f"\n📊 vs inicial (R${_BANCA_INICIAL:,.2f}): {sinal}R${delta:,.2f} ({sinal}{pct:.1f}%)"
        else:
            delta_txt = ""

    if _BANCA_TS > 0:
        idade = _time.time() - _BANCA_TS
        if idade < 60: ts_txt = f"{idade:.0f}s atras"
        elif idade < 3600: ts_txt = f"{idade/60:.0f}min atras"
        else: ts_txt = f"{idade/3600:.1f}h atras"
    else:
        ts_txt = "nunca"

    juros_txt = "✅ ON" if JUROS_COMPOSTOS_ATIVO else "❌ OFF"
    s = saudacao()
    delta_real = _BANCA_ATUAL - _BANCA_INICIAL if _BANCA_INICIAL > 0 else 0
    frase = _frase_lucro(delta_real)

    msg = (
        f"{s}\n"
        f"\n"
        f"💰 <b>SEU SALDO</b>\n"
        f"{divisor()}\n"
        f"👤 conta: <code>{USUARIO if CONTAS else '&lt;sem contas&gt;'}</code>\n"
        f"🏦 banca: {banca_txt} <i>({frase})</i>\n"
        f"🕐 ultima leitura: {ts_txt}{delta_txt}\n"
        f"\n"
        f"📈 <b>juros compostos: {juros_txt}</b>\n"
        f"\n"
        f"📌 <b>stakes individuais</b>\n"
        f"  ⚽ FT:   R${stake_ft:.2f} <i>({PCT_FT*100:.1f}% • teto R${TETO_FT:.0f})</i>\n"
        f"  🏀 VENC: R${stake_venc:.2f} <i>({PCT_VENC*100:.1f}% • teto R${TETO_VENC:.0f})</i>\n"
        f"  🎯 PERD: R${stake_perd:.2f} <i>({PCT_PERD*100:.1f}% • teto R${TETO_PERD:.0f})</i>\n"
        f"\n"
        f"🎮 <b>max acumulado por jogo</b>\n"
        f"  ⚽ FT:   R${max_jogo_ft:.2f} <i>(stake×{MULT_JOGO_FT}, abs R${TETO_ABS_JOGO_FT:.0f})</i>\n"
        f"  🏀 VENC: R${max_jogo_venc:.2f} <i>(stake×{MULT_JOGO_VENC}, abs R${TETO_ABS_JOGO_VENC:.0f})</i>\n"
        f"  🎯 PERD: R${max_jogo_perd:.2f} <i>(stake×{MULT_JOGO_PERD}, abs R${TETO_ABS_JOGO_PERD:.0f})</i>\n"
        f"{divisor()}\n"
        f"<i>/refresh pra forcar releitura 🔄</i>"
    )
    await tg_send(msg, reply_chat_id=reply_chat_id)


async def cmd_status(reply_chat_id, args=None):
    """Status completo do bot."""
    stake_ft = calc_stake_preview(PCT_FT, TETO_FT, "FT")
    stake_venc = calc_stake_preview(PCT_VENC, TETO_VENC, "VENC")
    stake_perd = calc_stake_preview(PCT_PERD, TETO_PERD, "PERD")
    n_jogos = len(_JOGOS_REF)

    n_ft = sum(len(j.ft_apostadas) for j in _JOGOS_REF.values())
    n_venc = sum(len(j.venc_apostadas) for j in _JOGOS_REF.values())
    n_perd = sum(len(j.perd_apostadas) for j in _JOGOS_REF.values())
    stake_venc_total = sum(j.venc_stake for j in _JOGOS_REF.values())
    stake_perd_total = sum(j.perd_stake for j in _JOGOS_REF.values())
    n_hc = sum(len(getattr(j, "hc_apostadas", ())) for j in _JOGOS_REF.values())
    stake_hc_total = sum(getattr(j, "hc_stake", 0.0) for j in _JOGOS_REF.values())

    banca_txt = f"R${_BANCA_ATUAL:,.2f}" if _BANCA_ATUAL > 0 else "<i>nao lida</i>"

    estrats = []
    if ESTRATEGIA_OVER_FT_ATIVA: estrats.append("FT")
    if ESTRATEGIA_VENCENDO_ATIVA: estrats.append("VENC")
    if ESTRATEGIA_PERDENDO_ATIVA: estrats.append("PERD")
    if ESTRATEGIA_HC_ATIVA: estrats.append("HC")
    if ESTRATEGIA_UNDER_CLA_ATIVA: estrats.append("CLA")

    # Estado geral
    if EMERGENCIA:
        estado = f"🚨 EMERGENCIA ({MOTIVO_EMERGENCIA})"
    elif AGUARDANDO_CONTA:
        ativas = sum(1 for c in CONTAS if c.get("ativo", True))
        estado = f"🟡 AGUARDANDO_CONTA ({ativas} ativas)"
    elif PAUSADO:
        if PAUSADO_ATE > 0:
            falta = max(0, PAUSADO_ATE - _time.time())
            estado = f"⏸️ PAUSADO ({_fmt_dur(falta)} restantes)"
        else:
            estado = "⏸️ PAUSADO (manual)"
    else:
        estado = "▶️ RODANDO"

    # Tempo ativo da conta atual
    if _CONTA_LOGIN_TS > 0:
        ativa_ha = _time.time() - _CONTA_LOGIN_TS
        ativa_txt = _fmt_dur(ativa_ha)
        if _CONTA_PRIMEIRA_LIMITACAO > 0:
            ativa_txt += " ⚠️ (limitacao detectada)"
    else:
        ativa_txt = "?"

    if CONTAS:
        conta_linha = f"👤 conta: <code>{USUARIO}</code> ({_CONTA_IDX+1}/{len(CONTAS)})\n"
    else:
        conta_linha = f"👤 conta: <code>&lt;sem contas&gt;</code> - use /addconta\n"

    s = saudacao()
    msg = (
        f"{s}\n"
        f"\n"
        f"📊 <b>STATUS GERAL</b> {estado}\n"
        f"{divisor()}\n"
        f"{conta_linha}"
        f"⏱️ ativa ha: {ativa_txt}\n"
        f"🏦 banca: {banca_txt}\n"
        f"🎯 estrategias: {', '.join(estrats) or 'NENHUMA ⚠️'}\n"
        f"📈 juros: {'✅ ON' if JUROS_COMPOSTOS_ATIVO else '❌ OFF'}\n"
        f"\n"
        f"🎮 <b>jogos ativos: {n_jogos}</b>\n"
        f"  ⚽ FT em curso: {n_ft} linhas\n"
        f"  🏀 VENC em curso: {n_venc} apostas <i>(R${stake_venc_total:.2f})</i>\n"
        f"  🎯 PERD em curso: {n_perd} apostas <i>(R${stake_perd_total:.2f})</i>\n"
        f"  🦓 HC em curso: {n_hc} linhas <i>(R${stake_hc_total:.2f})</i>\n"
        f"\n"
        f"💵 <b>stakes atuais</b>\n"
        f"  ⚽ FT:   R${stake_ft:.2f} <i>({PCT_FT*100:.1f}%)</i>\n"
        f"  🏀 VENC: R${stake_venc:.2f} <i>({PCT_VENC*100:.1f}%)</i>\n"
        f"  🎯 PERD: R${stake_perd:.2f} <i>({PCT_PERD*100:.1f}%)</i>\n"
        f"  🦓 HC:   R${HC_STAKE_TESTE:.2f} <i>(FIXA - teste - TM {'OK' if _tm_pronto() else 'OFF'})</i>\n"
        f"\n"
        f"⚠️ <b>contadores de seguranca</b>\n"
        f"  • overasks: {_COUNT_OVERASK}/{THRESHOLD_OVERASK_TROCA}\n"
        f"  • cupons negados: {_COUNT_CUPOM_NEGADO}/{THRESHOLD_CUPOM_NEGADO_TROCA}\n"
        f"  • DOM fail: {_DOM_FAIL_STREAK}/{LIMITE_DOM_FAIL}\n"
        f"  • login fail: {_LOGIN_FAIL_STREAK}/{LIMITE_LOGIN_FAIL}\n"
        f"{divisor()}\n"
        f"<i>/saldo /stats /listcontas /help</i>"
    )
    await tg_send(msg, reply_chat_id=reply_chat_id)


async def cmd_refresh(reply_chat_id, args=None):
    """Forca releitura do saldo agora."""
    if args and args[0].lower() in ("?", "help", "ajuda"):
        await tg_send(
            "📚 <b>/refresh</b> - forca releitura do saldo agora\n"
            "\n"
            "<b>o que faz:</b>\n"
            "le o header da Superbet AGORA pra ver o saldo atual\n"
            "e atualiza o high-watermark se subiu.\n"
            "\n"
            "<b>quando usar:</b>\n"
            "• vc acabou de fazer deposito e quer atualizar a banca\n"
            "• o bot avisa que nao reconheceu o saldo\n"
            "• vc quer ver o saldo real (nao o cache do bot)\n"
            "\n"
            "<i>obs: high-watermark so SOBE - se o valor lido for menor,\n"
            "o bot mantem o maior (juros compostos protegidos).</i>",
            reply_chat_id=reply_chat_id
        )
        return
    if _PAGE_REF is None:
        await tg_send("⚠️ page nao disponivel ainda", reply_chat_id=reply_chat_id)
        return
    await tg_send("🔄 lendo saldo...", reply_chat_id=reply_chat_id)
    try:
        valor = await atualizar_banca(_PAGE_REF, force=True)
        if valor is None:
            await tg_send(
                f"❌ falhou ler DOM\n"
                f"high-watermark mantido: R${_BANCA_ATUAL:,.2f}",
                reply_chat_id=reply_chat_id
            )
        else:
            sub = "📈 SUBIU" if valor > _BANCA_ATUAL else ("📉 desceu (mantido)" if valor < _BANCA_ATUAL else "= igual")
            await tg_send(
                f"✅ saldo lido: R${valor:,.2f}\n"
                f"high-watermark: R${_BANCA_ATUAL:,.2f}\n"
                f"{sub}",
                reply_chat_id=reply_chat_id
            )
    except Exception as e:
        await tg_send(f"❌ erro: {str(e)[:120]}", reply_chat_id=reply_chat_id)


async def cmd_stop(reply_chat_id, args=None):
    """Para o bot graciosamente."""
    global PARAR_BOT
    if args and args[0].lower() in ("?", "help", "ajuda"):
        await tg_send(
            "📚 <b>/stop</b> - ENCERRA o bot (mata o processo)\n"
            "\n"
            "⚠️ <b>diferente de /pausar:</b>\n"
            "• /pausar → bot pausa mas continua rodando (volta com /retomar)\n"
            "• /stop  → bot ENCERRA, precisa rodar de novo no VPS\n"
            "\n"
            "<b>quando usar:</b>\n"
            "• vc vai mexer no codigo\n"
            "• vc quer parar de vez (e nao planeja retomar logo)\n"
            "• alguma coisa muito errada que pausa nao resolve\n"
            "\n"
            "<i>se for so pausa temporaria, use /pausar</i>",
            reply_chat_id=reply_chat_id
        )
        return
    PARAR_BOT = True
    await tg_send(
        "🛑 <b>STOP recebido</b>\n"
        "bot vai encerrar no proximo ciclo",
        reply_chat_id=reply_chat_id
    )


async def cmd_nome(reply_chat_id, args=None):
    """/nome - mostra nome atual
    /nome NovoNome - muda o nome usado nas saudacoes"""
    global USER_NAME
    if not args or (len(args) == 1 and args[0].lower() in ("?", "help", "ajuda")):
        await tg_send(
            "📚 <b>/nome</b> - personaliza o nome nas saudacoes\n"
            "\n"
            "<b>uso:</b>\n"
            f"<code>/nome</code> → mostra nome atual ({USER_NAME})\n"
            "<code>/nome Santos</code> → muda nome\n"
            "\n"
            "<i>o nome aparece em todas as mensagens do bot</i>\n"
            "<i>(salva em user_name.txt, persiste no reboot)</i>",
            reply_chat_id=reply_chat_id
        )
        return
    novo = " ".join(args).strip()
    if len(novo) > 30 or not novo:
        await tg_send("⚠️ nome invalido (max 30 chars)", reply_chat_id=reply_chat_id)
        return
    antigo = USER_NAME
    USER_NAME = novo
    try:
        NOME_FILE.write_text(novo, encoding="utf-8")
    except Exception as e:
        log_ev(f"[nome] falha salvar: {str(e)[:60]}")
    s = saudacao()
    await tg_send(
        f"✅ <b>nome atualizado!</b>\n"
        f"{antigo} → <b>{novo}</b>\n"
        f"\n{s} agora eh sempre assim 😎",
        reply_chat_id=reply_chat_id
    )


async def cmd_help(reply_chat_id, args=None):
    s = saudacao()
    msg = (
        f"{s}\n"
        f"\n"
        f"🤖 <b>COMANDOS DO BOT</b>\n"
        f"<i>(use <code>/comando ?</code> pra manual detalhado)</i>\n"
        "\n<b>📊 info</b>\n"
        "/saldo   - banca + stakes atuais\n"
        "/status  - status geral do bot\n"
        "/stats   - lucro do dia + contas usadas\n"
        "/listcontas - pool de contas\n"
        "/refresh - forca releitura saldo\n"
        "\n<b>🎮 controle</b>\n"
        "/pausar  - pausa total (manual)\n"
        "/retomar - sai de pausa/emergencia/aguardando_conta\n"
        "/trocar [user] - forca troca de conta\n"
        "/relogar - reload + login conta atual\n"
        "/stop    - encerra o bot\n"
        "\n<b>⚙️ config (use ? em cada um)</b>\n"
        "/stake FT 3.5 - % da banca por aposta\n"
        "/teto FT 300 - stake max R$ por aposta\n"
        "/maxjogo FT 20 [1500] - mult + teto absoluto por jogo\n"
        "/banca 3000 - high-watermark manual\n"
        "/juros on|off - liga/desliga juros compostos\n"
        "/estrat FT on|off - liga/desliga estrategia\n"
        "/cooldown [janela|limite|pausa] - cooldown preventivo\n"
        "\n<b>👥 pool de contas</b>\n"
        "/addconta user pass - adiciona ou ATUALIZA senha\n"
        "/senha user nova - troca so a senha\n"
        "/rmconta user [--del] - desativa ou remove\n"
        "/limpar confirmar - APAGA TODAS (perigoso)\n"
        f"\n<b>🎨 personalizacao</b>\n"
        f"/nome {USER_NAME} - muda nome das saudacoes\n"
    )
    await tg_send(msg, reply_chat_id=reply_chat_id)


async def cmd_stats(reply_chat_id, args=None):
    """Lucro do dia, contas usadas, tempo medio ativo."""
    _stats_check_reset()
    s = _STATS_DIA

    if s["banca_inicial_dia"] > 0 and _BANCA_ATUAL > 0:
        delta_dia = _BANCA_ATUAL - s["banca_inicial_dia"]
        pct_dia = (delta_dia / s["banca_inicial_dia"]) * 100
        sinal = "+" if delta_dia >= 0 else ""
        delta_txt = f"{sinal}R${delta_dia:,.2f} ({sinal}{pct_dia:.1f}%)"
        emoji_delta = "📈" if delta_dia > 0 else ("📉" if delta_dia < 0 else "⚖️")
        frase = _frase_lucro(delta_dia)
    else:
        delta_dia = 0
        delta_txt = "<i>aguardando leitura</i>"
        emoji_delta = "⏳"
        frase = "ainda calculando..."

    # Tempo medio ativo das contas que limitaram (do historico)
    if _HIST_LIMITACOES:
        media = sum(_HIST_LIMITACOES) / len(_HIST_LIMITACOES)
        media_txt = _fmt_dur(media)
    else:
        media_txt = "<i>n/a</i>"

    # Conta atual ativa ha quanto tempo
    if _CONTA_LOGIN_TS > 0:
        ativa_atual = _fmt_dur(_time.time() - _CONTA_LOGIN_TS)
    else:
        ativa_atual = "?"

    contas_str = ", ".join(s["contas_usadas"]) if s["contas_usadas"] else "<i>nenhuma</i>"

    saud = saudacao()
    # Pergunta retorica baseada no horario
    h = datetime.now().hour
    if 5 <= h < 12:
        pergunta = f"como tao os lucros essa manha, <b>{USER_NAME}</b>?"
    elif 12 <= h < 18:
        pergunta = f"como tao os lucros essa tarde, <b>{USER_NAME}</b>?"
    elif 18 <= h < 22:
        pergunta = f"como tao os lucros essa noite, <b>{USER_NAME}</b>?"
    else:
        pergunta = f"varando a madruga atras de lucro, <b>{USER_NAME}</b>?"

    msg = (
        f"{saud}\n"
        f"\n{pergunta}\n"
        f"\n"
        f"📊 <b>STATS DO DIA</b> <i>({s['data']})</i>\n"
        f"{divisor()}\n"
        f"🏦 banca atual: <b>R${_BANCA_ATUAL:,.2f}</b>\n"
        f"📍 inicial do dia: R${s['banca_inicial_dia']:,.2f}\n"
        f"{emoji_delta} resultado: <b>{delta_txt}</b>\n"
        f"   <i>{frase}</i>\n"
        f"\n"
        f"🎫 tickets confirmados: <b>{s['tickets_ok']}</b>\n"
        f"💸 stake total: R${s['stake_total']:,.2f}\n"
        f"\n"
        f"👥 contas usadas hoje: <b>{len(s['contas_usadas'])}</b>\n"
        f"<code>{contas_str}</code>\n"
        f"🔄 trocas: {s['trocas_count']}\n"
        f"\n"
        f"⏱️ <b>tempo ativo</b>\n"
        f"  • conta atual: {ativa_atual}\n"
        f"  • media (ult {COOLDOWN_JANELA} limitadas): {media_txt}\n"
        f"{divisor()}"
    )
    await tg_send(msg, reply_chat_id=reply_chat_id)


async def cmd_stake(reply_chat_id, args):
    """/stake FT 3.5  ou  /stake VENC 5.0  ou  /stake PERD 4.0
    Muda apenas a porcentagem da banca."""
    global PCT_FT, PCT_VENC, PCT_PERD
    if not args or (len(args) == 1 and args[0].lower() in ("?", "help", "ajuda")):
        await tg_send(
            "📚 <b>/stake</b> - muda a % da banca usada como stake\n"
            "\n"
            "<b>como funciona:</b>\n"
            "stake_real = MIN(banca × %, teto)\n"
            "se /juros off: stake = teto (sem % da banca)\n"
            "\n"
            "<b>uso:</b>\n"
            "<code>/stake FT 3.5</code> → FT vai usar 3.5% da banca\n"
            "<code>/stake VENC 5.0</code> → Q4 vencendo 5%\n"
            "<code>/stake PERD 4.0</code> → Q4 perdendo 4%\n"
            "\n"
            "<b>faixa permitida:</b> 0.1 a 50%\n"
            "\n"
            f"<b>valores atuais:</b>\n"
            f"• FT:   {PCT_FT*100:.1f}% (teto R${TETO_FT:.0f})\n"
            f"• VENC: {PCT_VENC*100:.1f}% (teto R${TETO_VENC:.0f})\n"
            f"• PERD: {PCT_PERD*100:.1f}% (teto R${TETO_PERD:.0f})\n"
            "\n"
            "<i>pra mudar o teto absoluto, use /teto</i>",
            reply_chat_id=reply_chat_id
        )
        return
    if len(args) < 2:
        await tg_send(
            "⚠️ uso: <code>/stake FT 3.5</code>\nuse <code>/stake ?</code> pra ver o manual",
            reply_chat_id=reply_chat_id
        )
        return

    estrat = args[0].upper()
    try:
        novo_pct = float(args[1].replace(",", "."))
    except Exception:
        await tg_send(f"⚠️ valor invalido: {args[1]}", reply_chat_id=reply_chat_id)
        return

    if novo_pct <= 0 or novo_pct > 50:
        await tg_send(f"⚠️ valor fora da faixa (0-50%): {novo_pct}", reply_chat_id=reply_chat_id)
        return

    pct_decimal = novo_pct / 100.0

    if estrat == "FT":
        antigo = PCT_FT * 100
        PCT_FT = pct_decimal
        nova_stake = calc_stake_preview(PCT_FT, TETO_FT, "FT")
        await tg_send(
            f"✅ <b>FT atualizado</b>\n"
            f"% banca: {antigo:.1f}% → {novo_pct:.1f}%\n"
            f"stake atual: R${nova_stake:.2f} (teto R${TETO_FT:.0f})",
            reply_chat_id=reply_chat_id
        )
    elif estrat == "VENC":
        antigo = PCT_VENC * 100
        PCT_VENC = pct_decimal
        nova_stake = calc_stake_preview(PCT_VENC, TETO_VENC, "VENC")
        await tg_send(
            f"✅ <b>VENC atualizado</b>\n"
            f"% banca: {antigo:.1f}% → {novo_pct:.1f}%\n"
            f"stake atual: R${nova_stake:.2f} (teto R${TETO_VENC:.0f})",
            reply_chat_id=reply_chat_id
        )
    elif estrat == "PERD":
        antigo = PCT_PERD * 100
        PCT_PERD = pct_decimal
        nova_stake = calc_stake_preview(PCT_PERD, TETO_PERD, "PERD")
        await tg_send(
            f"✅ <b>PERD atualizado</b>\n"
            f"% banca: {antigo:.1f}% → {novo_pct:.1f}%\n"
            f"stake atual: R${nova_stake:.2f} (teto R${TETO_PERD:.0f})",
            reply_chat_id=reply_chat_id
        )
    else:
        await tg_send(
            f"⚠️ estrategia invalida: {estrat}\n"
            f"use FT | VENC | PERD",
            reply_chat_id=reply_chat_id
        )


async def cmd_banca(reply_chat_id, args):
    """/banca 3000 - muda high-watermark inicial manualmente."""
    global _BANCA_ATUAL, _BANCA_INICIAL, _BANCA_TS
    if not args or (len(args) == 1 and args[0].lower() in ("?", "help", "ajuda")):
        await tg_send(
            "📚 <b>/banca</b> - ajusta o high-watermark manualmente\n"
            "\n"
            "<b>como funciona:</b>\n"
            "o bot guarda o MAIOR valor de banca ja lido (high-watermark)\n"
            "e usa isso pra calcular stakes com juros compostos.\n"
            "a banca SO SOBE - nunca desce - mesmo apos perdas\n"
            "(soh sobe quando o saldo lido for MAIOR que o atual).\n"
            "\n"
            "<b>quando usar /banca:</b>\n"
            "• vc fez deposito/saque e quer resetar pro valor real\n"
            "• o bot ta com banca state antiga inflada\n"
            "• vc trocou de conta e quer comecar do zero\n"
            "\n"
            "<b>uso:</b>\n"
            "<code>/banca 3000</code> → forca high-watermark = R$3000\n"
            "<code>/banca 0</code> → reseta (bot vai reler do header)\n"
            "\n"
            f"<b>valores atuais:</b>\n"
            f"• banca atual: R${_BANCA_ATUAL:,.2f}\n"
            f"• banca inicial: R${_BANCA_INICIAL:,.2f}\n"
            "\n"
            "<i>relacionados: /refresh (forca releitura do header)</i>",
            reply_chat_id=reply_chat_id
        )
        return
    try:
        novo = float(args[0].replace(",", ".").replace("R$", "").strip())
    except Exception:
        await tg_send(f"⚠️ valor invalido: {args[0]}", reply_chat_id=reply_chat_id)
        return
    if novo <= 0 or novo > 1e8:
        await tg_send(f"⚠️ fora da faixa: {novo}", reply_chat_id=reply_chat_id)
        return

    async with _BANCA_LOCK:
        antigo = _BANCA_ATUAL
        _BANCA_ATUAL = novo
        _BANCA_INICIAL = novo
        _BANCA_TS = _time.time()
        _salva_banca_state()

    log_ev(f"  [banca] manual via TG: R${antigo:,.2f} -> R${novo:,.2f}")
    await tg_send(
        f"✅ <b>BANCA AJUSTADA MANUALMENTE</b>\n"
        f"R${antigo:,.2f} → R${novo:,.2f}\n"
        f"high-watermark resetado pra R${novo:,.2f}",
        reply_chat_id=reply_chat_id
    )


async def cmd_teto(reply_chat_id, args):
    """/teto FT 300 | VENC 500 | PERD 400 - muda o TETO_* (stake max em R$).
    /teto - mostra os tetos atuais."""
    global TETO_FT, TETO_VENC, TETO_PERD
    if not args or (len(args) == 1 and args[0].lower() in ("?", "help", "ajuda")):
        await tg_send(
            "📚 <b>/teto</b> - muda o stake MAXIMO em R$ por aposta\n"
            "\n"
            "<b>como funciona:</b>\n"
            "stake_real = MIN(banca × %, <b>teto</b>)\n"
            "ou seja, mesmo que a % aplicada na banca dê um valor MAIOR,\n"
            "o stake fica limitado a esse teto.\n"
            "\n"
            "<b>uso:</b>\n"
            "<code>/teto FT 300</code> → FT max R$300/aposta\n"
            "<code>/teto VENC 500</code>\n"
            "<code>/teto PERD 400</code>\n"
            "\n"
            "<b>faixa permitida:</b> R$ 1 a 100.000\n"
            "\n"
            f"<b>valores atuais:</b>\n"
            f"• FT:   R${TETO_FT:.0f}  ({PCT_FT*100:.1f}% banca)\n"
            f"• VENC: R${TETO_VENC:.0f}  ({PCT_VENC*100:.1f}% banca)\n"
            f"• PERD: R${TETO_PERD:.0f}  ({PCT_PERD*100:.1f}% banca)\n"
            "\n"
            "<i>relacionados: /stake (% banca), /maxjogo (teto por jogo)</i>",
            reply_chat_id=reply_chat_id
        )
        return
    if len(args) < 2:
        await tg_send(
            "⚠️ uso: <code>/teto FT 300</code>\nuse <code>/teto ?</code> pra ver o manual",
            reply_chat_id=reply_chat_id
        )
        return
    estrat = args[0].upper()
    try:
        novo = float(args[1].replace(",", "."))
    except Exception:
        await tg_send(f"⚠️ valor invalido: {args[1]}", reply_chat_id=reply_chat_id)
        return
    if novo <= 0 or novo > 100000:
        await tg_send(f"⚠️ valor fora da faixa (0-100000): {novo}", reply_chat_id=reply_chat_id)
        return

    if estrat == "FT":
        antigo = TETO_FT
        TETO_FT = novo
        nova_stake = calc_stake_preview(PCT_FT, TETO_FT, "FT")
        await tg_send(
            f"✅ <b>TETO FT atualizado</b>\n"
            f"R${antigo:.0f} → R${novo:.0f}\n"
            f"stake atual: R${nova_stake:.2f} ({PCT_FT*100:.1f}% banca)",
            reply_chat_id=reply_chat_id
        )
    elif estrat == "VENC":
        antigo = TETO_VENC
        TETO_VENC = novo
        nova_stake = calc_stake_preview(PCT_VENC, TETO_VENC, "VENC")
        await tg_send(
            f"✅ <b>TETO VENC atualizado</b>\n"
            f"R${antigo:.0f} → R${novo:.0f}\n"
            f"stake atual: R${nova_stake:.2f} ({PCT_VENC*100:.1f}% banca)",
            reply_chat_id=reply_chat_id
        )
    elif estrat == "PERD":
        antigo = TETO_PERD
        TETO_PERD = novo
        nova_stake = calc_stake_preview(PCT_PERD, TETO_PERD, "PERD")
        await tg_send(
            f"✅ <b>TETO PERD atualizado</b>\n"
            f"R${antigo:.0f} → R${novo:.0f}\n"
            f"stake atual: R${nova_stake:.2f} ({PCT_PERD*100:.1f}% banca)",
            reply_chat_id=reply_chat_id
        )
    else:
        await tg_send(
            f"⚠️ estrategia invalida: {estrat}\nuse FT | VENC | PERD",
            reply_chat_id=reply_chat_id
        )


async def cmd_cooldown(reply_chat_id, args):
    """/cooldown - mostra config atual
    /cooldown on | off - liga/desliga
    /cooldown janela N - muda N contas (1-10)
    /cooldown limite H - muda limite em HORAS (0.5-24)
    /cooldown pausa M - muda pausa em MINUTOS (1-720)
    /cooldown N H M - shortcut: janela=N, limite=H, pausa=M (ex: /cooldown 2 3 90)"""
    global COOLDOWN_ATIVO, COOLDOWN_JANELA, COOLDOWN_LIMITE_HORAS, COOLDOWN_PAUSA_SEG
    global _HIST_LIMITACOES

    if not args or (len(args) == 1 and args[0].lower() in ("?", "help", "ajuda")):
        # Mostra config atual + manual
        status = "✅ ON" if COOLDOWN_ATIVO else "❌ OFF"
        hist_str = ", ".join([f"{d/3600:.2f}h" for d in _HIST_LIMITACOES]) or "vazio"
        await tg_send(
            "📚 <b>/cooldown</b> - pausa preventiva entre contas\n"
            "\n"
            "<b>como funciona:</b>\n"
            "quando a casa LIMITA uma conta, registra quanto tempo ela\n"
            "ficou ATIVA antes da limitacao. Se a media das ultimas N\n"
            "contas ficou abaixo do LIMITE (h), pausa antes de logar\n"
            "a proxima (pra dar tempo da casa esfriar o seu IP/perfil).\n"
            "\n"
            "<b>3 parametros:</b>\n"
            "• <b>janela</b>: quantas ultimas contas considerar (1-10)\n"
            "• <b>limite</b>: media de horas pra disparar pausa (0.1-24h)\n"
            "• <b>pausa</b>: tamanho da pausa em minutos (1-720)\n"
            "\n"
            "<b>uso:</b>\n"
            "<code>/cooldown on</code> ou <code>off</code>\n"
            "<code>/cooldown janela 2</code>\n"
            "<code>/cooldown limite 2.5</code>\n"
            "<code>/cooldown pausa 90</code>\n"
            "<code>/cooldown 2 2.5 90</code> (shortcut: janela limite pausa)\n"
            "\n"
            f"<b>config atual:</b> {status}\n"
            f"• janela: {COOLDOWN_JANELA} contas\n"
            f"• limite: {COOLDOWN_LIMITE_HORAS:.2f}h\n"
            f"• pausa: {COOLDOWN_PAUSA_SEG/60:.0f}min\n"
            f"\n<b>historico:</b> {hist_str}\n"
            f"\n<i>trocas manuais (via /trocar) NAO entram no historico</i>",
            reply_chat_id=reply_chat_id
        )
        return

    # /cooldown on | off
    if len(args) == 1 and args[0].lower() in ("on", "off", "1", "0", "ativo", "inativo"):
        novo = args[0].lower() in ("on", "1", "ativo")
        antigo = COOLDOWN_ATIVO
        COOLDOWN_ATIVO = novo
        await tg_send(
            f"✅ <b>cooldown {'ON' if novo else 'OFF'}</b>\n"
            f"(era {'ON' if antigo else 'OFF'})",
            reply_chat_id=reply_chat_id
        )
        return

    # /cooldown N H M shortcut (3 numeros) - so se args[0] for numerico
    if len(args) == 3 and args[0].replace(".", "").replace(",", "").isdigit():
        try:
            jan = int(args[0])
            lim = float(args[1].replace(",", "."))
            pau = float(args[2].replace(",", "."))
        except Exception:
            await tg_send(
                "⚠️ shortcut: <code>/cooldown janela limite_horas pausa_min</code>\n"
                "ex: <code>/cooldown 2 2.5 90</code>",
                reply_chat_id=reply_chat_id
            )
            return
        if not (1 <= jan <= 10) or not (0.1 <= lim <= 24) or not (1 <= pau <= 720):
            await tg_send(
                "⚠️ faixas: janela 1-10, limite 0.1-24h, pausa 1-720min",
                reply_chat_id=reply_chat_id
            )
            return
        COOLDOWN_JANELA = jan
        COOLDOWN_LIMITE_HORAS = lim
        COOLDOWN_PAUSA_SEG = int(pau * 60)
        # Trunca historico se ficou maior que a janela nova
        if len(_HIST_LIMITACOES) > COOLDOWN_JANELA:
            _HIST_LIMITACOES = _HIST_LIMITACOES[-COOLDOWN_JANELA:]
        await tg_send(
            f"✅ <b>COOLDOWN ATUALIZADO</b>\n"
            f"janela: {COOLDOWN_JANELA} contas\n"
            f"limite: {COOLDOWN_LIMITE_HORAS:.2f}h\n"
            f"pausa: {COOLDOWN_PAUSA_SEG/60:.0f}min",
            reply_chat_id=reply_chat_id
        )
        return

    # /cooldown KEY VALUE
    if len(args) < 2:
        await tg_send(
            "⚠️ uso: <code>/cooldown janela 2</code> | <code>/cooldown limite 2.5</code> | <code>/cooldown pausa 90</code>",
            reply_chat_id=reply_chat_id
        )
        return
    chave = args[0].lower()
    try:
        valor = float(args[1].replace(",", "."))
    except Exception:
        await tg_send(f"⚠️ valor invalido: {args[1]}", reply_chat_id=reply_chat_id)
        return

    if chave in ("janela", "j", "n"):
        if not (1 <= valor <= 10):
            await tg_send("⚠️ janela: 1-10 contas", reply_chat_id=reply_chat_id)
            return
        antigo = COOLDOWN_JANELA
        COOLDOWN_JANELA = int(valor)
        if len(_HIST_LIMITACOES) > COOLDOWN_JANELA:
            _HIST_LIMITACOES = _HIST_LIMITACOES[-COOLDOWN_JANELA:]
        await tg_send(
            f"✅ <b>janela: {antigo} → {COOLDOWN_JANELA} contas</b>",
            reply_chat_id=reply_chat_id
        )
    elif chave in ("limite", "l", "h", "horas"):
        if not (0.1 <= valor <= 24):
            await tg_send("⚠️ limite: 0.1-24 horas", reply_chat_id=reply_chat_id)
            return
        antigo = COOLDOWN_LIMITE_HORAS
        COOLDOWN_LIMITE_HORAS = valor
        await tg_send(
            f"✅ <b>limite: {antigo:.2f}h → {COOLDOWN_LIMITE_HORAS:.2f}h</b>",
            reply_chat_id=reply_chat_id
        )
    elif chave in ("pausa", "p", "min", "minutos"):
        if not (1 <= valor <= 720):
            await tg_send("⚠️ pausa: 1-720 minutos", reply_chat_id=reply_chat_id)
            return
        antigo = COOLDOWN_PAUSA_SEG
        COOLDOWN_PAUSA_SEG = int(valor * 60)
        await tg_send(
            f"✅ <b>pausa: {antigo/60:.0f}min → {COOLDOWN_PAUSA_SEG/60:.0f}min</b>",
            reply_chat_id=reply_chat_id
        )
    else:
        await tg_send(
            f"⚠️ chave invalida: {chave}\nuse: janela | limite | pausa | on | off",
            reply_chat_id=reply_chat_id
        )


async def cmd_estrat(reply_chat_id, args):
    """/estrat - mostra status das 3
    /estrat FT on | off
    /estrat VENC on | off
    /estrat PERD on | off
    Liga/desliga estrategia individual sem matar o bot."""
    global ESTRATEGIA_OVER_FT_ATIVA, ESTRATEGIA_VENCENDO_ATIVA, ESTRATEGIA_PERDENDO_ATIVA, ESTRATEGIA_HC_ATIVA, ESTRATEGIA_UNDER_CLA_ATIVA

    if not args or (len(args) == 1 and args[0].lower() in ("?", "help", "ajuda")):
        cla = "✅ ON" if ESTRATEGIA_UNDER_CLA_ATIVA else "❌ OFF"
        ft  = "✅ ON" if ESTRATEGIA_OVER_FT_ATIVA  else "❌ OFF"
        vn  = "✅ ON" if ESTRATEGIA_VENCENDO_ATIVA else "❌ OFF"
        pd  = "✅ ON" if ESTRATEGIA_PERDENDO_ATIVA else "❌ OFF"
        hc  = "✅ ON" if ESTRATEGIA_HC_ATIVA       else "❌ OFF"
        await tg_send(
            "📚 <b>/estrat</b> - liga/desliga estrategia individual\n"
            "\n"
            "<b>estrategias do bot:</b>\n"
            "• <b>FT</b> = Over pontos FT (mkt 200586)\n"
            "• <b>VENC</b> = Q4 jogador VENCENDO\n"
            "• <b>PERD</b> = Q4 jogador PERDENDO\n"
            "• <b>HC</b> = HC FT zebra (TipManager) - teste, stake fixa\n"
            "• <b>CLA</b> = UNDER gols FT no e-football CLA, |placar| >= 4, linha >= 5,5, odd >= 1,60\n"
            "\n"
            "<b>importante:</b> desligar NAO cancela apostas ja abertas,\n"
            "soh impede novas entradas dessa estrategia.\n"
            "\n"
            "<b>uso:</b>\n"
            "<code>/estrat FT off</code> → desliga FT\n"
            "<code>/estrat VENC on</code> → liga VENC\n"
            "\n"
            f"<b>status atual:</b>\n"
            f"• FT:   {ft}\n"
            f"• VENC: {vn}\n"
            f"• PERD: {pd}\n"
            f"• HC:   {hc}\n"
            f"• CLA:  {cla}  <i>(sinais {_CLA_STATS['sinais']} · apostas {_CLA_STATS['apostas']} · recusas {_CLA_STATS['recusas']} · R${_CLA_STATS['stake']:.0f})</i>\n"
            "\n"
            "<i>uso tipico: vc nota que FT ta perdendo, manda /estrat FT off</i>",
            reply_chat_id=reply_chat_id
        )
        return

    if len(args) < 2:
        await tg_send(
            "⚠️ uso: <code>/estrat FT on | off</code>\nuse <code>/estrat ?</code> pra ver o manual",
            reply_chat_id=reply_chat_id
        )
        return

    estrat = args[0].upper()
    novo_str = args[1].lower()
    if novo_str not in ("on", "off", "1", "0", "ativo", "inativo"):
        await tg_send(f"⚠️ use on | off (recebi: {args[1]})", reply_chat_id=reply_chat_id)
        return
    novo = novo_str in ("on", "1", "ativo")

    if estrat == "FT":
        antigo = ESTRATEGIA_OVER_FT_ATIVA
        ESTRATEGIA_OVER_FT_ATIVA = novo
        await tg_send(
            f"✅ <b>FT: {'ON' if antigo else 'OFF'} → {'ON' if novo else 'OFF'}</b>\n"
            f"<i>nao gera novas entradas; apostas ja abertas seguem normalmente</i>",
            reply_chat_id=reply_chat_id
        )
    elif estrat == "VENC":
        antigo = ESTRATEGIA_VENCENDO_ATIVA
        ESTRATEGIA_VENCENDO_ATIVA = novo
        await tg_send(
            f"✅ <b>VENC: {'ON' if antigo else 'OFF'} → {'ON' if novo else 'OFF'}</b>\n"
            f"<i>nao gera novas entradas; apostas ja abertas seguem normalmente</i>",
            reply_chat_id=reply_chat_id
        )
    elif estrat == "PERD":
        antigo = ESTRATEGIA_PERDENDO_ATIVA
        ESTRATEGIA_PERDENDO_ATIVA = novo
        await tg_send(
            f"✅ <b>PERD: {'ON' if antigo else 'OFF'} → {'ON' if novo else 'OFF'}</b>\n"
            f"<i>nao gera novas entradas; apostas ja abertas seguem normalmente</i>",
            reply_chat_id=reply_chat_id
        )
    elif estrat == "HC":
        antigo = ESTRATEGIA_HC_ATIVA
        ESTRATEGIA_HC_ATIVA = novo
        if novo and not _tm_pronto() and not _TM_BOOTANDO:
            asyncio.create_task(_tm_boot())
        await tg_send(
            f"✅ <b>HC: {'ON' if antigo else 'OFF'} → {'ON' if novo else 'OFF'}</b>\n"
            f"<i>stake fixa R${HC_STAKE_TESTE:.2f} (teste) - nao gera novas entradas; apostas ja abertas seguem</i>",
            reply_chat_id=reply_chat_id
        )
    elif estrat == "CLA":
        antigo = ESTRATEGIA_UNDER_CLA_ATIVA
        ESTRATEGIA_UNDER_CLA_ATIVA = novo
        await tg_send(
            f"✅ <b>CLA: {'ON' if antigo else 'OFF'} → {'ON' if novo else 'OFF'}</b>\n"
            f"<i>UNDER gols FT · |placar| >= {CLA_DIFF_MIN} · linha >= {CLA_LINHA_MIN} · odd >= {CLA_ODD_MIN} · stake {('fixa R$%.2f' % CLA_STAKE_FIXA) if CLA_STAKE_FIXA > 0 else ('%.1f%% banca (teto R$%.0f)' % (PCT_CLA*100, TETO_CLA))}</i>",
            reply_chat_id=reply_chat_id
        )
    else:
        await tg_send(
            f"⚠️ estrategia invalida: {estrat}\nuse FT | VENC | PERD | HC | CLA",
            reply_chat_id=reply_chat_id
        )


async def cmd_juros(reply_chat_id, args):
    """/juros - mostra status
    /juros on | off - liga/desliga juros compostos"""
    global JUROS_COMPOSTOS_ATIVO

    if not args or (len(args) == 1 and args[0].lower() in ("?", "help", "ajuda")):
        status = "✅ ON" if JUROS_COMPOSTOS_ATIVO else "❌ OFF"
        s_ft   = calc_stake_preview(PCT_FT,   TETO_FT,   "FT")
        s_venc = calc_stake_preview(PCT_VENC, TETO_VENC, "VENC")
        s_perd = calc_stake_preview(PCT_PERD, TETO_PERD, "PERD")
        await tg_send(
            "📚 <b>/juros</b> - liga/desliga juros compostos\n"
            "\n"
            "<b>com juros ON:</b>\n"
            "stake = MIN(banca × %, teto)\n"
            "stake CRESCE conforme a banca cresce\n"
            "(high-watermark: banca so SOBE, nunca desce)\n"
            "\n"
            "<b>com juros OFF:</b>\n"
            "stake = teto puro (R$ fixo, ignora % e banca)\n"
            "util pra testar estrategia ou bater stake constante\n"
            "\n"
            "<b>uso:</b>\n"
            "<code>/juros on</code>\n"
            "<code>/juros off</code>\n"
            "\n"
            f"<b>status atual: {status}</b>\n"
            f"\n<b>stakes que serao usadas AGORA:</b>\n"
            f"• FT:   R${s_ft:.2f}\n"
            f"• VENC: R${s_venc:.2f}\n"
            f"• PERD: R${s_perd:.2f}",
            reply_chat_id=reply_chat_id
        )
        return

    novo_str = args[0].lower()
    if novo_str not in ("on", "off", "1", "0", "ativo", "inativo"):
        await tg_send(f"⚠️ use on | off (recebi: {args[0]})", reply_chat_id=reply_chat_id)
        return
    novo = novo_str in ("on", "1", "ativo")
    antigo = JUROS_COMPOSTOS_ATIVO
    JUROS_COMPOSTOS_ATIVO = novo

    # Mostra previews das novas stakes
    s_ft   = calc_stake_preview(PCT_FT,   TETO_FT,   "FT")
    s_venc = calc_stake_preview(PCT_VENC, TETO_VENC, "VENC")
    s_perd = calc_stake_preview(PCT_PERD, TETO_PERD, "PERD")
    await tg_send(
        f"✅ <b>JUROS: {'ON' if antigo else 'OFF'} → {'ON' if novo else 'OFF'}</b>\n"
        f"\n<b>stakes apos mudanca:</b>\n"
        f"• FT:   R${s_ft:.2f}\n"
        f"• VENC: R${s_venc:.2f}\n"
        f"• PERD: R${s_perd:.2f}",
        reply_chat_id=reply_chat_id
    )


async def cmd_maxjogo(reply_chat_id, args):
    """/maxjogo - mostra atuais
    /maxjogo FT 20         - muda so MULT_JOGO_FT (x stake)
    /maxjogo FT 20 1500    - muda MULT_JOGO_FT + TETO_ABS_JOGO_FT
    Controla max stake total por jogo (stake_individual × MULT, com teto absoluto)."""
    global MULT_JOGO_FT, MULT_JOGO_VENC, MULT_JOGO_PERD
    global TETO_ABS_JOGO_FT, TETO_ABS_JOGO_VENC, TETO_ABS_JOGO_PERD

    if not args or (len(args) == 1 and args[0].lower() in ("?", "help", "ajuda")):
        await tg_send(
            "📚 <b>/maxjogo</b> - limite de stake TOTAL por jogo\n"
            "\n"
            "<b>como funciona:</b>\n"
            "max_jogo = MIN(stake_individual × MULT, teto_abs)\n"
            "\n"
            "exemplo: FT mult=20, teto_abs=1500, stake=100\n"
            "→ max por jogo = MIN(100×20, 1500) = 1500\n"
            "→ no MAXIMO R$1500 entram naquele jogo somando TUDO\n"
            "\n"
            "<b>uso:</b>\n"
            "<code>/maxjogo FT 20</code> → muda so o MULT (20× a stake)\n"
            "<code>/maxjogo FT 20 1500</code> → muda MULT + teto absoluto\n"
            "<code>/maxjogo VENC 14 2900</code>\n"
            "\n"
            "<b>faixas:</b> mult 1-100, teto 10-100000\n"
            "\n"
            f"<b>valores atuais:</b>\n"
            f"• FT:   stake×{MULT_JOGO_FT}  | teto abs R${TETO_ABS_JOGO_FT:.0f}\n"
            f"• VENC: stake×{MULT_JOGO_VENC}  | teto abs R${TETO_ABS_JOGO_VENC:.0f}\n"
            f"• PERD: stake×{MULT_JOGO_PERD}  | teto abs R${TETO_ABS_JOGO_PERD:.0f}",
            reply_chat_id=reply_chat_id
        )
        return

    if len(args) < 2:
        await tg_send(
            "⚠️ uso: <code>/maxjogo FT 20 [1500]</code>\nuse <code>/maxjogo ?</code> pra ver o manual",
            reply_chat_id=reply_chat_id
        )
        return

    estrat = args[0].upper()
    try:
        novo_mult = float(args[1].replace(",", "."))
    except Exception:
        await tg_send(f"⚠️ mult invalido: {args[1]}", reply_chat_id=reply_chat_id)
        return
    if not (1 <= novo_mult <= 100):
        await tg_send("⚠️ mult fora da faixa (1-100)", reply_chat_id=reply_chat_id)
        return

    novo_teto = None
    if len(args) >= 3:
        try:
            novo_teto = float(args[2].replace(",", "."))
        except Exception:
            await tg_send(f"⚠️ teto invalido: {args[2]}", reply_chat_id=reply_chat_id)
            return
        if not (10 <= novo_teto <= 100000):
            await tg_send("⚠️ teto fora da faixa (10-100000)", reply_chat_id=reply_chat_id)
            return

    if estrat == "FT":
        antigo_m, antigo_t = MULT_JOGO_FT, TETO_ABS_JOGO_FT
        MULT_JOGO_FT = int(novo_mult) if novo_mult.is_integer() else novo_mult
        if novo_teto is not None: TETO_ABS_JOGO_FT = novo_teto
        await tg_send(
            f"✅ <b>FT atualizado</b>\n"
            f"mult: {antigo_m} → {MULT_JOGO_FT}\n"
            f"teto abs: R${antigo_t:.0f} → R${TETO_ABS_JOGO_FT:.0f}",
            reply_chat_id=reply_chat_id
        )
    elif estrat == "VENC":
        antigo_m, antigo_t = MULT_JOGO_VENC, TETO_ABS_JOGO_VENC
        MULT_JOGO_VENC = int(novo_mult) if novo_mult.is_integer() else novo_mult
        if novo_teto is not None: TETO_ABS_JOGO_VENC = novo_teto
        await tg_send(
            f"✅ <b>VENC atualizado</b>\n"
            f"mult: {antigo_m} → {MULT_JOGO_VENC}\n"
            f"teto abs: R${antigo_t:.0f} → R${TETO_ABS_JOGO_VENC:.0f}",
            reply_chat_id=reply_chat_id
        )
    elif estrat == "PERD":
        antigo_m, antigo_t = MULT_JOGO_PERD, TETO_ABS_JOGO_PERD
        MULT_JOGO_PERD = int(novo_mult) if novo_mult.is_integer() else novo_mult
        if novo_teto is not None: TETO_ABS_JOGO_PERD = novo_teto
        await tg_send(
            f"✅ <b>PERD atualizado</b>\n"
            f"mult: {antigo_m} → {MULT_JOGO_PERD}\n"
            f"teto abs: R${antigo_t:.0f} → R${TETO_ABS_JOGO_PERD:.0f}",
            reply_chat_id=reply_chat_id
        )
    else:
        await tg_send(
            f"⚠️ estrategia invalida: {estrat}\nuse FT | VENC | PERD",
            reply_chat_id=reply_chat_id
        )


async def cmd_pausar(reply_chat_id, args=None):
    """Pausa total do bot (manual, sem prazo). Sai com /retomar."""
    global PAUSADO, MOTIVO_PAUSA, PAUSADO_ATE
    if args and args[0].lower() in ("?", "help", "ajuda"):
        await tg_send(
            "📚 <b>/pausar</b> - pausa total do bot\n"
            "\n"
            "<b>o que faz:</b>\n"
            "• para de escanear jogos\n"
            "• para de aceitar apostas novas\n"
            "• apostas ja abertas seguem (a casa resolve sozinha)\n"
            "• mantem login ativo\n"
            "\n"
            "<b>sem prazo:</b> fica pausado ate vc mandar /retomar\n"
            "\n"
            "<b>uso:</b>\n"
            "<code>/pausar</code> → pausa\n"
            "<code>/retomar</code> → volta a rodar\n"
            "\n"
            "<i>diferente de /stop, que encerra o processo</i>",
            reply_chat_id=reply_chat_id
        )
        return
    PAUSADO = True
    PAUSADO_ATE = 0.0
    MOTIVO_PAUSA = "manual via TG"
    log_ev("[pausa] manual via TG")
    await tg_send(
        "⏸️ <b>BOT PAUSADO</b>\n"
        "modo manual (sem prazo)\n"
        "use <b>/retomar</b> pra voltar",
        reply_chat_id=reply_chat_id
    )


async def cmd_retomar(reply_chat_id, args=None):
    """Sai de pausa OU emergencia OU aguardando_conta (se houver conta ativa)."""
    global PAUSADO, MOTIVO_PAUSA, PAUSADO_ATE, EMERGENCIA, MOTIVO_EMERGENCIA
    global _DOM_FAIL_STREAK, _LOGIN_FAIL_STREAK
    global AGUARDANDO_CONTA, POOL_ESGOTADA, PRECISA_TROCAR_CONTA
    global _TROCA_FORCADA_USER, _TROCA_MANUAL

    # Reseta circuito anti-loop (intervencao manual = problema resolvido)
    _resetar_anti_loop()

    estava_emergencia = EMERGENCIA
    estava_aguardando = AGUARDANDO_CONTA
    ativas = sum(1 for c in CONTAS if c.get("ativo", True))

    # Se ta em AGUARDANDO_CONTA mas tem conta ativa, sai e dispara troca
    if AGUARDANDO_CONTA:
        if ativas == 0:
            await tg_send(
                "⚠️ <b>nao posso retomar</b>\n"
                "AGUARDANDO_CONTA + pool sem nenhuma conta ativa\n"
                "<i>use /addconta user pass primeiro</i>",
                reply_chat_id=reply_chat_id
            )
            return
        AGUARDANDO_CONTA = False
        POOL_ESGOTADA = False
        # Marca _CONTA_IDX invalido pra _proxima_conta_idx pegar qualquer ativa
        global _CONTA_IDX
        _CONTA_IDX = -1
        _TROCA_FORCADA_USER = None
        _TROCA_MANUAL = True
        PRECISA_TROCAR_CONTA = True

    PAUSADO = False
    PAUSADO_ATE = 0.0
    MOTIVO_PAUSA = ""
    if estava_emergencia:
        EMERGENCIA = False
        MOTIVO_EMERGENCIA = ""
        _DOM_FAIL_STREAK = 0
        _LOGIN_FAIL_STREAK = 0
        log_ev("[retomar] saiu da EMERGENCIA via TG")
        await tg_send(
            "▶️ <b>EMERGENCIA RESETADA</b>\n"
            "streaks zerados, bot voltando ao normal",
            reply_chat_id=reply_chat_id
        )
    elif estava_aguardando:
        log_ev(f"[retomar] saiu de AGUARDANDO_CONTA via TG ({ativas} ativas)")
        await tg_send(
            f"▶️ <b>RETOMADO de AGUARDANDO_CONTA</b>\n"
            f"{ativas} contas ativas - bot vai tentar logar",
            reply_chat_id=reply_chat_id
        )
    else:
        log_ev("[retomar] sai de pausa via TG")
        await tg_send(
            "▶️ <b>BOT RETOMADO</b>",
            reply_chat_id=reply_chat_id
        )


async def cmd_trocar(reply_chat_id, args):
    """/trocar [user]  - forca troca. Sem user = proxima ativa da fila."""
    global PRECISA_TROCAR_CONTA, _TROCA_FORCADA_USER, _TROCA_MANUAL
    if args and args[0].lower() in ("?", "help", "ajuda"):
        ativas = sum(1 for c in CONTAS if c.get("ativo", True))
        await tg_send(
            "📚 <b>/trocar</b> - forca troca manual de conta\n"
            "\n"
            "<b>2 modos:</b>\n"
            "<code>/trocar</code> → pega proxima ativa da fila (round-robin)\n"
            "<code>/trocar santos7</code> → troca pra conta especifica\n"
            "\n"
            "<b>o que acontece:</b>\n"
            "• logout da conta atual (limpa cookies, storage, IDB, etc)\n"
            "• login na nova conta\n"
            "• le saldo novo\n"
            "• reset de contadores (overask, cupom_negado, limites_casa)\n"
            "\n"
            "<b>importante:</b>\n"
            "• troca MANUAL nao conta pro cooldown preventivo\n"
            "• se a conta especificada esta INATIVA, falha\n"
            "  (use /senha pra reativar)\n"
            "\n"
            f"<b>pool atual:</b> {ativas} ativas\n"
            f"<b>conta atual:</b> <code>{USUARIO if CONTAS else '&lt;sem conta&gt;'}</code>\n"
            "\n"
            "<i>relacionados: /relogar (re-login na atual), /listcontas</i>",
            reply_chat_id=reply_chat_id
        )
        return
    if not CONTAS:
        await tg_send("⚠️ pool vazia - use /addconta", reply_chat_id=reply_chat_id)
        return
    target = args[0] if args else None
    if target:
        idx = next((i for i, c in enumerate(CONTAS)
                    if c["user"].lower() == target.lower() and c.get("ativo", True)), None)
        if idx is None:
            await tg_send(
                f"⚠️ conta nao encontrada ou inativa: <code>{target}</code>\n"
                "use /listcontas",
                reply_chat_id=reply_chat_id
            )
            return
        _TROCA_FORCADA_USER = CONTAS[idx]["user"]
    else:
        _TROCA_FORCADA_USER = None  # proxima ativa apos atual

    _TROCA_MANUAL = True  # nao entra no historico de cooldown
    PRECISA_TROCAR_CONTA = True
    await tg_send(
        f"🔄 <b>TROCA FORCADA</b>\n"
        f"alvo: {_TROCA_FORCADA_USER or 'proxima ativa'}\n"
        f"<i>(nao conta pro cooldown)</i>",
        reply_chat_id=reply_chat_id
    )


async def cmd_addconta(reply_chat_id, args):
    """/addconta user pass - adiciona OU atualiza senha + reativa se ja existe."""
    global POOL_ESGOTADA, AGUARDANDO_CONTA, PAUSADO, MOTIVO_PAUSA, PAUSADO_ATE
    global PRECISA_TROCAR_CONTA, _TROCA_FORCADA_USER, _TROCA_MANUAL
    if not args or (len(args) == 1 and args[0].lower() in ("?", "help", "ajuda")):
        ativas = sum(1 for c in CONTAS if c.get("ativo", True))
        await tg_send(
            "📚 <b>/addconta</b> - adiciona uma conta na pool\n"
            "\n"
            "<b>uso:</b>\n"
            "<code>/addconta usuario senha</code>\n"
            "\n"
            "<b>comportamento:</b>\n"
            "• se a conta NAO existe → adiciona nova\n"
            "• se a conta JA existe → atualiza senha + reativa + zera falhas\n"
            "• se o bot ta em AGUARDANDO_CONTA → sai automaticamente e\n"
            "  tenta logar com a conta nova\n"
            "\n"
            "<b>exemplos:</b>\n"
            "<code>/addconta santos7 minhasenha123</code>\n"
            "<code>/addconta maria_bet Pass@2024</code>\n"
            "\n"
            "<b>obs:</b> a senha pode ter espacos (tudo apos o user vira senha)\n"
            "\n"
            f"<b>pool atual:</b> {ativas} ativas / {len(CONTAS)} total\n"
            f"\n<i>relacionados: /senha (troca senha), /rmconta (desativa)</i>",
            reply_chat_id=reply_chat_id
        )
        return
    if len(args) < 2:
        await tg_send(
            "⚠️ uso: <code>/addconta usuario senha</code>\nuse <code>/addconta ?</code> pra ver o manual",
            reply_chat_id=reply_chat_id
        )
        return
    user = args[0]
    senha = " ".join(args[1:])  # senha pode ter espaco
    acao = ""
    async with _ACCOUNTS_LOCK:
        idx = next((i for i, c in enumerate(CONTAS) if c["user"] == user), None)
        if idx is not None:
            # Conta ja existe: atualiza senha + reativa + zera contadores de falha
            senha_antiga = CONTAS[idx].get("senha", "")
            CONTAS[idx]["senha"] = senha
            CONTAS[idx]["ativo"] = True
            CONTAS[idx]["falha_login_count"] = 0
            mudou_senha = senha_antiga != senha
            if mudou_senha:
                acao = "atualizada (senha nova + reativada)"
            else:
                acao = "reativada (senha igual)"
        else:
            CONTAS.append({
                "user": user, "senha": senha, "ativo": True,
                "ultimo_uso": None, "duracao_ultima": 0,
                "limitou_ultima": False, "falha_login_count": 0,
            })
            acao = "adicionada"
        _accounts_sync_to_disk()

    ativas = sum(1 for c in CONTAS if c.get("ativo", True))
    log_ev(f"[addconta] {user} {acao} (pool agora: {ativas} ativas / {len(CONTAS)} total)")
    extra = ""
    # Se estava aguardando conta (pool esgotada), sai do estado automaticamente
    if AGUARDANDO_CONTA and ativas > 0:
        AGUARDANDO_CONTA = False
        POOL_ESGOTADA = False
        PAUSADO = False
        PAUSADO_ATE = 0.0
        MOTIVO_PAUSA = ""
        # BLINDAGEM: zera os contadores de limitacao AQUI tambem (nao so no
        # trocar_conta). Garante que a conta nova SEMPRE comeca com o contador
        # limpo - se o trocar_conta falhar/retornar cedo, a conta nova nao herda
        # o _COUNT_OVERASK da conta anterior (que era o bug: conta nova ja entrava
        # perto de 4/4 e limitava na 1a aposta).
        global _COUNT_OVERASK, _COUNT_CUPOM_NEGADO, _OVERASK_AVISADO, _CUPOM_NEGADO_AVISADO
        _COUNT_OVERASK = 0
        _COUNT_CUPOM_NEGADO = 0
        _OVERASK_AVISADO = False
        _CUPOM_NEGADO_AVISADO = False
        # Marca _CONTA_IDX como invalido: nao tinha conta ativa antes, agora vai logar do zero
        global _CONTA_IDX
        _CONTA_IDX = -1
        # Sinaliza troca forcada pra essa conta
        _TROCA_FORCADA_USER = user
        _TROCA_MANUAL = True  # nao conta pro cooldown
        PRECISA_TROCAR_CONTA = True
        extra = "\n🟢 <b>saindo de AGUARDANDO_CONTA</b> - bot vai logar essa conta"
    await tg_send(
        f"✅ <b>conta {acao}</b>\n"
        f"<code>{user}</code>\n"
        f"pool: {ativas} ativas / {len(CONTAS)} total{extra}",
        reply_chat_id=reply_chat_id
    )


async def cmd_rmconta(reply_chat_id, args):
    """/rmconta user [--del] - desativa (default) ou remove de vez com --del."""
    global _CONTA_IDX
    global PRECISA_TROCAR_CONTA, _TROCA_MANUAL, _TROCA_FORCADA_USER
    if not args or (len(args) == 1 and args[0].lower() in ("?", "help", "ajuda")):
        await tg_send(
            "📚 <b>/rmconta</b> - remove uma conta da pool\n"
            "\n"
            "<b>2 modos:</b>\n"
            "1) sem flag → marca como inativa (preserva no accounts.json)\n"
            "   util pra desativar temporariamente sem perder historico\n"
            "\n"
            "2) com <code>--del</code> → REMOVE de vez do accounts.json\n"
            "   util quando vc adicionou a conta errada\n"
            "\n"
            "<b>uso:</b>\n"
            "<code>/rmconta santos7</code> → desativa\n"
            "<code>/rmconta santos7 --del</code> → REMOVE\n"
            "\n"
            "<b>se a conta removida for a ATIVA:</b>\n"
            "• o bot dispara troca pra proxima da pool\n"
            "• se nao tem outra ativa → vai pra AGUARDANDO_CONTA\n"
            "\n"
            "<b>blindagem:</b> /rmconta --del durante troca de conta\n"
            "espera ate 10s pra evitar race condition\n"
            "\n"
            "<i>relacionados: /senha (reativa + troca senha), /addconta</i>",
            reply_chat_id=reply_chat_id
        )
        return
    user = args[0]
    del_real = ("--del" in args) or ("-d" in args)
    # BLINDAGEM: --del durante troca pode quebrar trocar_conta. Aguarda ate 10s.
    if del_real and _TROCANDO_CONTA:
        espera = 0.0
        while _TROCANDO_CONTA and espera < 10.0:
            await asyncio.sleep(0.5)
            espera += 0.5
        if _TROCANDO_CONTA:
            await tg_send(
                "⚠️ troca de conta em andamento - rmconta --del cancelado\n"
                "tente novamente em alguns segundos",
                reply_chat_id=reply_chat_id
            )
            return
    async with _ACCOUNTS_LOCK:
        idx = next((i for i, c in enumerate(CONTAS) if c["user"] == user), None)
        if idx is None:
            await tg_send(f"⚠️ conta nao encontrada: <code>{user}</code>", reply_chat_id=reply_chat_id)
            return
        era_atual = (idx == _CONTA_IDX)
        if del_real:
            CONTAS.pop(idx)
            # Ajusta _CONTA_IDX se a removida estava antes
            if idx < _CONTA_IDX:
                _CONTA_IDX -= 1
            elif idx == _CONTA_IDX:
                _CONTA_IDX = 0  # vai recalcular na proxima troca
            acao = "REMOVIDA do accounts.json"
        else:
            CONTAS[idx]["ativo"] = False
            acao = "desativada (ainda no accounts.json)"
        # se removeu/desativou a conta_atual, sinaliza troca
        if era_atual:
            _TROCA_FORCADA_USER = None
            _TROCA_MANUAL = True
            PRECISA_TROCAR_CONTA = True
            extra = "\n⚠️ era a conta ATIVA - troca disparada"
        else:
            extra = ""
        _accounts_sync_to_disk()
    ativas = sum(1 for c in CONTAS if c.get("ativo", True))
    log_ev(f"[rmconta] {user} {acao} (pool agora: {ativas} ativas / {len(CONTAS)} total)")
    await tg_send(
        f"✅ <b>conta {acao}</b>\n"
        f"<code>{user}</code>{extra}\n"
        f"pool: {ativas} ativas / {len(CONTAS)} total",
        reply_chat_id=reply_chat_id
    )


async def cmd_senha(reply_chat_id, args):
    """/senha user novasenha - troca SO a senha de uma conta existente."""
    global POOL_ESGOTADA, AGUARDANDO_CONTA, PAUSADO, MOTIVO_PAUSA, PAUSADO_ATE
    global PRECISA_TROCAR_CONTA, _TROCA_FORCADA_USER, _TROCA_MANUAL
    if not args or (len(args) == 1 and args[0].lower() in ("?", "help", "ajuda")):
        await tg_send(
            "📚 <b>/senha</b> - troca a senha de uma conta ja existente\n"
            "\n"
            "<b>uso:</b>\n"
            "<code>/senha usuario nova_senha</code>\n"
            "\n"
            "<b>comportamento:</b>\n"
            "• zera o contador de falhas de login dessa conta\n"
            "• se a conta tava DESATIVADA, REATIVA automaticamente\n"
            "• se o bot ta em AGUARDANDO_CONTA, sai e tenta logar\n"
            "\n"
            "<b>exemplo:</b>\n"
            "<code>/senha santos7 novaSenha456</code>\n"
            "\n"
            "<b>diferenca pra /addconta:</b>\n"
            "• /senha → exige que a conta JA exista\n"
            "• /addconta → adiciona se nao existe, atualiza se existe\n"
            "\n"
            "<i>na pratica fazem quase a mesma coisa quando a conta existe</i>",
            reply_chat_id=reply_chat_id
        )
        return
    if len(args) < 2:
        await tg_send(
            "⚠️ uso: <code>/senha usuario nova_senha</code>\nuse <code>/senha ?</code> pra ver o manual",
            reply_chat_id=reply_chat_id
        )
        return
    user = args[0]
    nova = " ".join(args[1:])
    foi_reativada = False
    async with _ACCOUNTS_LOCK:
        idx = next((i for i, c in enumerate(CONTAS) if c["user"] == user), None)
        if idx is None:
            await tg_send(
                f"⚠️ conta nao encontrada: <code>{user}</code>\n"
                "use /addconta pra adicionar",
                reply_chat_id=reply_chat_id
            )
            return
        antiga = CONTAS[idx].get("senha", "")
        CONTAS[idx]["senha"] = nova
        CONTAS[idx]["falha_login_count"] = 0  # zera falhas, senha mudou
        # Se nao tava ativa, reativa
        if not CONTAS[idx].get("ativo", True):
            CONTAS[idx]["ativo"] = True
            foi_reativada = True
            reativada = " + reativada"
        else:
            reativada = ""
        _accounts_sync_to_disk()
    log_ev(f"[senha] trocada {user}{reativada} (era '{antiga[:3]}***' -> '{nova[:3]}***')")
    extra = ""
    ativas = sum(1 for c in CONTAS if c.get("ativo", True))
    if foi_reativada and AGUARDANDO_CONTA and ativas > 0:
        AGUARDANDO_CONTA = False
        POOL_ESGOTADA = False
        PAUSADO = False
        PAUSADO_ATE = 0.0
        MOTIVO_PAUSA = ""
        global _CONTA_IDX
        _CONTA_IDX = -1
        _TROCA_FORCADA_USER = user
        _TROCA_MANUAL = True
        PRECISA_TROCAR_CONTA = True
        extra = "\n🟢 <b>saindo de AGUARDANDO_CONTA</b> - bot vai logar essa conta"
    await tg_send(
        f"✅ <b>senha atualizada</b>\n"
        f"<code>{user}</code>{reativada}\n"
        f"falha_login_count zerado{extra}",
        reply_chat_id=reply_chat_id
    )


async def cmd_limpar(reply_chat_id, args=None):
    """/limpar confirmar - ESVAZIA a pool de contas inteira e entra em AGUARDANDO_CONTA.
    Bot fica esperando /addconta pra comecar a rodar de novo.
    USE COM CUIDADO - remove TUDO do accounts.json."""
    global POOL_ESGOTADA, AGUARDANDO_CONTA, PAUSADO, MOTIVO_PAUSA, PAUSADO_ATE
    global PRECISA_TROCAR_CONTA, _TROCA_FORCADA_USER, _TROCA_MANUAL
    global _CONTA_IDX, _CONTA_LOGIN_TS, _CONTA_PRIMEIRA_LIMITACAO
    global _HIST_LIMITACOES

    # Sem args ou com ? → mostra manual + AVISO de destruicao
    if not args or (len(args) == 1 and args[0].lower() in ("?", "help", "ajuda")):
        ativas = sum(1 for c in CONTAS if c.get("ativo", True))
        await tg_send(
            "📚 <b>/limpar</b> - APAGA TODAS as contas do accounts.json\n"
            "\n"
            "⚠️ <b>OPERACAO DESTRUTIVA</b> ⚠️\n"
            "\n"
            "<b>o que faz:</b>\n"
            "• remove TODAS as contas (ativas e inativas)\n"
            "• reseta o historico de limitacoes\n"
            "• cancela troca pendente\n"
            "• coloca o bot em AGUARDANDO_CONTA + PAUSADO\n"
            "\n"
            "<b>pra confirmar, use:</b>\n"
            "<code>/limpar confirmar</code>\n"
            "\n"
            "<b>depois disso:</b>\n"
            "use <code>/addconta user pass</code> pra colocar contas novas.\n"
            "o bot retoma SOZINHO assim que vc adicionar uma.\n"
            "\n"
            f"<b>pool atual:</b> {ativas} ativas / {len(CONTAS)} total",
            reply_chat_id=reply_chat_id
        )
        return

    # Exige a palavra "confirmar"
    if args[0].lower() not in ("confirmar", "sim", "yes", "ok"):
        await tg_send(
            "⚠️ <b>confirmacao obrigatoria</b>\n"
            "operacao destrutiva. use:\n"
            "<code>/limpar confirmar</code>\n"
            "\n<i>(ou /limpar ? pra ver o manual)</i>",
            reply_chat_id=reply_chat_id
        )
        return

    # BLINDAGEM: se trocar_conta esta em andamento, espera ate 10s
    espera = 0.0
    while _TROCANDO_CONTA and espera < 10.0:
        await asyncio.sleep(0.5)
        espera += 0.5
    if _TROCANDO_CONTA:
        await tg_send(
            "⚠️ <b>troca de conta em andamento</b>\n"
            "tente novamente em alguns segundos",
            reply_chat_id=reply_chat_id
        )
        return

    qtd = len(CONTAS)
    async with _ACCOUNTS_LOCK:
        CONTAS.clear()
        _CONTA_IDX = 0
        _accounts_sync_to_disk()

    # Reseta estado da conta atual (nao tem mais conta!)
    _CONTA_LOGIN_TS = 0.0
    _CONTA_PRIMEIRA_LIMITACAO = 0.0
    _HIST_LIMITACOES = []
    # Cancela qualquer troca pendente (nao tem conta pra trocar)
    PRECISA_TROCAR_CONTA = False
    _TROCA_FORCADA_USER = None
    _TROCA_MANUAL = False
    # Entra em AGUARDANDO_CONTA
    POOL_ESGOTADA = True
    AGUARDANDO_CONTA = True
    PAUSADO = True
    PAUSADO_ATE = 0.0
    MOTIVO_PAUSA = "AGUARDANDO_CONTA (pool limpa via /limpar)"

    log_ev(f"[limpar] pool inteira esvaziada via TG ({qtd} contas removidas)")
    await tg_send(
        f"🧹 <b>POOL LIMPA</b>\n"
        f"removidas: {qtd} contas\n"
        f"<b>BOT EM AGUARDANDO_CONTA</b>\n"
        f"<i>use /addconta user pass pra comecar a rodar</i>",
        reply_chat_id=reply_chat_id
    )


async def cmd_relogar(reply_chat_id, args=None):
    """/relogar - forca reload + login na conta atual (sem trocar de conta)."""
    global _PAGE_REF, _CTX_REF
    if not _PAGE_REF or not _CTX_REF:
        await tg_send("⚠️ page/ctx nao inicializados ainda", reply_chat_id=reply_chat_id)
        return
    # BLINDAGEM: nao relogar se trocar_conta ja esta em andamento (race condition)
    if _TROCANDO_CONTA:
        await tg_send(
            "⚠️ troca de conta em andamento, relogin ignorado",
            reply_chat_id=reply_chat_id
        )
        return
    # BLINDAGEM: nao relogar se em AGUARDANDO_CONTA (pool vazia)
    if AGUARDANDO_CONTA or not CONTAS:
        await tg_send(
            "⚠️ pool vazia/aguardando conta - use /addconta primeiro",
            reply_chat_id=reply_chat_id
        )
        return
    user = str(USUARIO)
    log_ev(f"[relogar] forcado via TG, conta atual: {user}")
    await tg_send(
        f"🔄 <b>RELOGANDO</b> <code>{user}</code>\n"
        f"<i>reload + login na conta atual...</i>",
        reply_chat_id=reply_chat_id
    )
    try:
        page = _PAGE_REF
        if SB_DOMAIN not in (page.url or ""):
            try:
                page = await _get_superbet_page(_CTX_REF)
                _PAGE_REF = page
            except Exception: pass
        try:
            await page.reload(wait_until="domcontentloaded", timeout=30000)
            await asyncio.sleep(2)
        except Exception as e:
            log_ev(f"[relogar] reload err: {str(e)[:80]}")
        await fechar_todos_modais(page)
        if not await checar_login(page):
            ok = await fazer_login(page)
            if ok:
                await init_bet_config(page)
                await asyncio.sleep(1.5)
                await atualizar_banca(page, force=True)
                await tg_send(
                    f"✅ <b>RELOGADO</b> <code>{user}</code>\n"
                    f"banca: R${_BANCA_ATUAL:,.2f}",
                    reply_chat_id=reply_chat_id
                )
            else:
                await tg_send(
                    f"⚠️ <b>FALHA RELOGIN</b> <code>{user}</code>\n"
                    f"vai cair no fluxo normal de troca de conta",
                    reply_chat_id=reply_chat_id
                )
        else:
            await asyncio.sleep(1.5)
            await atualizar_banca(page, force=True)
            await tg_send(
                f"✅ <b>JA TAVA LOGADO</b> <code>{user}</code>\n"
                f"banca: R${_BANCA_ATUAL:,.2f}",
                reply_chat_id=reply_chat_id
            )
    except Exception as e:
        log_ev(f"[relogar] err: {type(e).__name__}: {str(e)[:120]}")
        await tg_send(
            f"❌ erro no relogar: {str(e)[:120]}",
            reply_chat_id=reply_chat_id
        )


async def cmd_listcontas(reply_chat_id, args=None):
    """Lista todas as contas com status."""
    if not CONTAS:
        await tg_send("⚠️ pool vazia", reply_chat_id=reply_chat_id)
        return
    linhas = []
    for i, c in enumerate(CONTAS):
        marker = "👉" if i == _CONTA_IDX else "  "
        ativo = "✅" if c.get("ativo", True) else "❌"
        user = c["user"]
        ultimo = c.get("ultimo_uso") or "nunca"
        if isinstance(ultimo, str) and "T" in ultimo:
            ultimo = ultimo.split("T")[0] + " " + ultimo.split("T")[1][:5]
        dur = c.get("duracao_ultima", 0)
        dur_txt = _fmt_dur(dur) if dur > 0 else "?"
        limitou = "⚠️lim" if c.get("limitou_ultima") else "ok"
        falhas = c.get("falha_login_count", 0)
        falhas_txt = f" [⚠️{falhas} falhas login]" if falhas > 0 else ""
        linhas.append(f"{marker} {ativo} <code>{user}</code> | ult: {ultimo} | dur: {dur_txt} | {limitou}{falhas_txt}")

    n_ativas = sum(1 for c in CONTAS if c.get("ativo", True))
    msg = (
        f"📋 <b>POOL DE CONTAS</b> ({n_ativas} ativas / {len(CONTAS)} total)\n\n"
        + "\n".join(linhas)
        + "\n\n<i>/addconta /rmconta /trocar</i>"
    )
    await tg_send(msg, reply_chat_id=reply_chat_id)




# ==================== TELEGRAM POLLING ====================
async def telegram_polling_loop():
    """Long-polling do Telegram. Roda em paralelo com o resto do bot.
    So responde comandos vindos de TG_AUTHORIZED_CHATS."""
    if not TG_ATIVO or not TG_TOKEN:
        log_ev("[tg-poll] desligado (TG_ATIVO=False)")
        return

    base = f"https://api.telegram.org/bot{TG_TOKEN}"
    last_update_id = 0

    try:
        async with httpx.AsyncClient(timeout=10) as c:
            r = await c.get(f"{base}/getUpdates", params={"offset": -1, "timeout": 0})
            j = r.json()
            if j.get("ok") and j.get("result"):
                last_update_id = j["result"][-1]["update_id"]
                log_ev(f"[tg-poll] drain: ultimo update_id={last_update_id}")
    except Exception as e:
        log_ev(f"[tg-poll] drain falhou: {str(e)[:60]}")

    log_ev("[tg-poll] listener iniciado")

    handlers = {
        "/saldo": cmd_saldo,
        "/status": cmd_status,
        "/refresh": cmd_refresh,
        "/stop": cmd_stop,
        "/help": cmd_help,
        "/start": cmd_help,
        "/stats": cmd_stats,
        "/stake": cmd_stake,
        "/teto": cmd_teto,
        "/banca": cmd_banca,
        "/cooldown": cmd_cooldown,
        "/estrat": cmd_estrat,
        "/juros": cmd_juros,
        "/maxjogo": cmd_maxjogo,
        "/pausar": cmd_pausar,
        "/retomar": cmd_retomar,
        "/trocar": cmd_trocar,
        "/addconta": cmd_addconta,
        "/rmconta": cmd_rmconta,
        "/senha": cmd_senha,
        "/listcontas": cmd_listcontas,
        "/limpar": cmd_limpar,
        "/relogar": cmd_relogar,
        "/nome": cmd_nome,
    }

    while not PARAR_BOT:
        try:
            async with httpx.AsyncClient(timeout=35) as c:
                r = await c.get(
                    f"{base}/getUpdates",
                    params={"offset": last_update_id + 1, "timeout": 25},
                    timeout=35,
                )
                j = r.json()
                if not j.get("ok"):
                    await asyncio.sleep(3)
                    continue
                for upd in j.get("result", []):
                    last_update_id = max(last_update_id, upd["update_id"])
                    msg = upd.get("message") or upd.get("edited_message")
                    if not msg:
                        continue
                    chat = msg.get("chat", {})
                    chat_id = chat.get("id")
                    if chat_id not in TG_AUTHORIZED_CHATS:
                        log_ev(f"[tg-poll] ignorando chat nao autorizado: {chat_id}")
                        continue
                    text = (msg.get("text") or "").strip()
                    if not text:
                        continue
                    parts = text.split()
                    cmd = parts[0].lower()
                    args = parts[1:] if len(parts) > 1 else []
                    if "@" in cmd:
                        cmd = cmd.split("@", 1)[0]
                    handler = handlers.get(cmd)
                    if handler:
                        log_ev(f"[tg-poll] cmd={cmd} args={args}")
                        try:
                            await handler(chat_id, args)
                        except TypeError:
                            # Handlers antigos sem `args`
                            try: await handler(chat_id)
                            except Exception as e:
                                log_ev(f"[tg-poll] handler {cmd} err: {str(e)[:80]}")
                                try: await tg_send(f"❌ erro no comando: {str(e)[:120]}", reply_chat_id=chat_id)
                                except Exception: pass
                        except Exception as e:
                            log_ev(f"[tg-poll] handler {cmd} err: {str(e)[:80]}")
                            try: await tg_send(f"❌ erro no comando: {str(e)[:120]}", reply_chat_id=chat_id)
                            except Exception: pass
        except httpx.TimeoutException:
            pass
        except asyncio.CancelledError:
            log_ev("[tg-poll] cancelado")
            break
        except Exception as e:
            log_ev(f"[tg-poll] err: {type(e).__name__}: {str(e)[:80]}")
            await asyncio.sleep(3)

    log_ev("[tg-poll] encerrado")


# ==================== SCANNER ====================
async def scan_adriatic(client):
    eventos = []
    if SO_CLA:
        return []   # modo SO CLA: nao varre o e-basket
    try:
        r = await asyncio.wait_for(
            client.get(f"{SB_API}/v2/pt-BR/events/by-date", params={
                "currentStatus": "active", "offerState": "live",
                "startDate": "2026-04-01 00:00:00", "sportId": str(SPORT_ID),
            }, timeout=8),
            timeout=10,
        )
        data = r.json().get("data", []) if r.status_code == 200 else []
    except asyncio.TimeoutError:
        log_ev("scan TIMEOUT"); return []
    except Exception as e:
        log_ev(f"scan err: {str(e)[:100]}"); return []

    evs = [e for e in data if e.get("tournamentId") in TIDS_SUPERBET and e.get("eventId")]
    if not evs: return []

    async def _fetch_det(eid):
        try:
            r = await asyncio.wait_for(
                client.get(f"{SB_API}/v2/pt-BR/events/{eid}", timeout=6),
                timeout=8,
            )
            if r.status_code != 200: return None
            det = r.json().get("data", [])
            return det[0] if det else None
        except Exception:
            return None

    results = await asyncio.gather(
        *[_fetch_det(e["eventId"]) for e in evs],
        return_exceptions=True,
    )
    for e_src, r in zip(evs, results):
        if r and not isinstance(r, Exception):
            r["_tid"] = e_src.get("tournamentId")   # carimbo da liga (pro roteio das estrategias)
            eventos.append(r)
    return eventos


async def scan_cla(client):
    """Scanner do e-football (CLA). Igual ao scan_adriatic, mas no sportId do futebol e filtrando a liga por NOME.
    Se SPORT_ID_FUT == 0, tenta descobrir: pede o by-date sem sportId e aprende pelo evento da CLA."""
    global _SPORT_ID_FUT_APRENDIDO, _CLA_AVISO_SPORT
    sport = SPORT_ID_FUT or _SPORT_ID_FUT_APRENDIDO
    params = {"currentStatus": "active", "offerState": "live", "startDate": "2026-04-01 00:00:00"}
    if sport:
        params["sportId"] = str(sport)
    try:
        r = await asyncio.wait_for(client.get(f"{SB_API}/v2/pt-BR/events/by-date", params=params, timeout=8), timeout=10)
        if r.status_code != 200:
            if not _CLA_AVISO_SPORT:
                _CLA_AVISO_SPORT = True
                log_ev(f"[CLA] by-date HTTP {r.status_code} (sportId={sport or 'nenhum'}). Se persistir, preencha SPORT_ID_FUT.")
            return []
        data = r.json().get("data", []) or []
    except asyncio.TimeoutError:
        log_ev("[CLA] scan TIMEOUT"); return []
    except Exception as e:
        log_ev(f"[CLA] scan err: {str(e)[:100]}"); return []

    def _eh_cla(e):
        try:
            if TIDS_CLA and e.get("tournamentId") in TIDS_CLA:
                return True
            nome = f"{e.get('tournamentName','')} {e.get('categoryName','')} {e.get('competitionName','')}"
            return bool(CLA_NOME_RE.search(nome))
        except Exception:
            return False

    evs = [e for e in data if e.get("eventId") and _eh_cla(e)]
    if not evs:
        return []
    if not sport:
        try:
            sid = int(evs[0].get("sportId") or 0)
            if sid:
                _SPORT_ID_FUT_APRENDIDO = sid
                log_ev(f"[CLA] sportId do e-football aprendido: {sid} (torneio: {evs[0].get('tournamentName','')})")
        except Exception:
            pass

    async def _fetch_det(eid):
        try:
            r = await asyncio.wait_for(client.get(f"{SB_API}/v2/pt-BR/events/{eid}", timeout=6), timeout=8)
            if r.status_code != 200: return None
            det = r.json().get("data", [])
            return det[0] if det else None
        except Exception:
            return None

    eventos = []
    results = await asyncio.gather(*[_fetch_det(e["eventId"]) for e in evs], return_exceptions=True)
    for e_src, r in zip(evs, results):
        if r and not isinstance(r, Exception):
            r["_tid"] = e_src.get("tournamentId")
            r["_cla"] = True
            # garante os campos que o ticket precisa (montar_body le do evento quando existirem)
            for k in ("sportId", "tournamentId"):
                if not r.get(k) and e_src.get(k):
                    r[k] = e_src.get(k)
            try:
                if not r.get("sportName"):
                    r["sportName"] = SPORT_NOMES.get(int(r.get("sportId") or 0), "E-Sport Futebol")
                if not r.get("tournamentName"):
                    r["tournamentName"] = CLA_NOMES_TID.get(int(r.get("tournamentId") or 0), "Cyber Live Arena")
            except Exception:
                pass
            eventos.append(r)
    return eventos


def parse_score(d):
    try:
        meta = d.get("metadata", {}) or {}
        return int(meta.get("homeTeamScore")), int(meta.get("awayTeamScore"))
    except Exception:
        return None, None


def parse_nicks(match_name):
    try:
        parts = match_name.split("·")
        if len(parts) != 2: return None, None
        def ext(s):
            m = re.search(r'\(([^)]+)\)', s)
            return m.group(1).strip().upper() if m else s.strip().upper()
        return ext(parts[0]), ext(parts[1])
    except Exception:
        return None, None


def normalizar_periodo(raw):
    p = (raw or "").upper().strip()
    m = re.match(r"^(\d)Q$", p)
    if m: return f"Q{m.group(1)}"
    return p


def parse_quartos(meta):
    out = {}
    try:
        periods = meta.get("periods") or []
        for p in periods:
            if p.get("type") != "RegularPeriod": continue
            num = p.get("num")
            try:
                h = int(p.get("homeTeamScore"))
                a = int(p.get("awayTeamScore"))
                out[num] = (h, a)
            except Exception: continue
    except Exception: pass
    return out


def pts_no_q4(meta, is_home):
    qs = parse_quartos(meta)
    if 4 not in qs: return 0
    return qs[4][0] if is_home else qs[4][1]


def extrair_linha_sbv(sbv, eh_q4):
    try:
        s = str(sbv or "")
        if eh_q4:
            if "-" in s: return float(s.split("-", 1)[1])
            return float(s)
        else:
            return float(s)
    except Exception:
        return None


def extrair_nick_da_info(info):
    try:
        m = re.search(r"\(([^)]+)\)", info or "")
        return m.group(1).strip().upper() if m else None
    except Exception:
        return None


# ==================== APOSTA ====================
_bet_config = {}

async def init_bet_config(page):
    ls = {}
    try:
        ls = await page.evaluate(
            "() => { const o = {}; for (let i=0;i<localStorage.length;i++) "
            "{ const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; }"
        )
    except Exception: ls = {}
    _bet_config["device_id"] = ls.get("device_id") or str(uuidlib.uuid4())
    _bet_config["anon_key"] = ls.get("ldAnonymousUserKey") or "ANONYMOUS_USER-872"
    geo = "brBahia"
    try:
        g = json.loads(ls.get("lastSuccessfulGeoVault", "{}"))
        if g.get("value", {}).get("areaCode"):
            geo = g["value"]["areaCode"]
    except Exception: pass
    _bet_config["geo"] = geo
    log_ev(f"Bet cfg: device={_bet_config['device_id'][:12]} geo={geo}")


async def get_odd_fresca(api, eid, odd_uuid, market_id):
    try:
        r = await asyncio.wait_for(api.get(f"{SB_API}/v2/pt-BR/events/{eid}", timeout=8), timeout=10)
        if r.status_code != 200: return None, None
        det = r.json().get("data", [])
        if not det: return None, None
        d = det[0]
        for o in (d.get("odds") or []):
            if o.get("uuid") == odd_uuid and o.get("status") == "active":
                return d, o
        return d, None
    except Exception:
        return None, None


def montar_body(d, odd, stake):
    try:
        parts = d.get("matchName", "").split("·")
        team1 = parts[0].strip() if len(parts) >= 1 else ""
        team2 = parts[1].strip() if len(parts) >= 2 else ""
        item = {
            "value": str(odd["price"]), "type": "sport", "fix": False,
            "betRadarId": str(d.get("incrementId", "")), "eventId": d.get("eventId"),
            "eventUuid": d.get("uuid"), "oddUuid": odd["uuid"],
            "sourceType": 101, "sourceScreen": 100,
            "betGroupId": odd["marketId"], "eventName": d.get("matchName", ""),
            "eventCode": d.get("matchCode", 0), "live": True,
            "marketId": odd["marketId"], "marketName": odd.get("marketName", ""),
            "marketUuid": odd.get("marketUuid", ""),
            "matchDate": d.get("matchDate", ""), "matchDateUtc": d.get("matchDate", ""),
            "matchId": d.get("eventId"), "matchName": d.get("matchName", ""),
            "oddDescription": odd.get("info", ""), "oddFullName": odd.get("name", ""),
            "oddId": odd.get("outcomeId", 0), "oddName": odd.get("name", ""),
            "oddTypeId": odd.get("outcomeId", 0), "rules": [],
            "sbValue": odd.get("specialBetValue", ""), "selected": True,
            "sportId": d.get("sportId") or SPORT_ID, "sportName": d.get("sportName") or "E-Sport Basquete",
            "teamId1": str(d.get("homeTeamId", "")), "teamId2": str(d.get("awayTeamId", "")),
            "teamnameone": team1, "teamnametwo": team2,
            "tournamentId": d.get("tournamentId"), "tournamentName": d.get("tournamentName") or "EAL - NextGen",
            "uuid": odd["uuid"],
        }
        return {
            "ticketOnline": "online", "total": stake, "betType": "prematch", "combs": "",
            "items": [item], "clientSourceType": "Desktop_new", "paymentBonusType": 1,
            "locale": "pt-BR",
            "requestDetails": {
                "ldAnonymousUserKey": _bet_config.get("anon_key", "ANONYMOUS_USER-872"),
                "deviceId": _bet_config.get("device_id", str(uuidlib.uuid4())),
                "isDeviceIdTestFlagOnSubscribed": "false",
                "isDeviceIdTestFlagOnInitial": "false",
            },
            "geoLocation": _bet_config.get("geo", "brBahia"),
            "deviceIdentifier": _bet_config.get("device_id", str(uuidlib.uuid4())),
            "autoAcceptChanges": "1", "ticketUuid": str(uuidlib.uuid4()),
        }
    except Exception:
        return None


def extrair_max_stake(j):
    paths = []
    try:
        if isinstance(j.get("data"), dict):
            paths.append(j["data"].get("maxStake"))
            paths.append(j["data"].get("max_stake"))
            paths.append(j["data"].get("maxAmount"))
        if isinstance(j.get("additionalData"), dict):
            paths.append(j["additionalData"].get("maxStake"))
            paths.append(j["additionalData"].get("max_stake"))
        paths.append(j.get("maxStake"))
    except Exception: pass
    for c in paths:
        try:
            if c is not None:
                v = float(c)
                if v > 0: return v
        except Exception: continue
    notice = str(j.get("notice", "")) + " " + str(j.get("errorMessage", ""))
    m = re.search(r"R?\$?\s*(\d{1,6}(?:[.,]\d{1,2})?)", notice)
    if m:
        try: return float(m.group(1).replace(",", "."))
        except Exception: pass
    return None


def detecta_overask(err, note):
    s = (str(err) + " " + str(note)).lower()
    keywords = ["maxstake", "max stake", "máximo", "maximo",
                "limite", "overask", "limit", "max amount",
                "valor máx", "valor max"]
    return any(k in s for k in keywords)


async def apostar_com_overask(ctx, api, eid, odd_inicial, stake_inicial,
                              fator_overask, max_tentativas, stake_min_viavel,
                              validar_odd_fn=None):
    t_pedido = _time.monotonic()
    try:
        await asyncio.wait_for(APOSTA_LOCK.acquire(), timeout=APOSTA_FILA_TIMEOUT)
    except asyncio.TimeoutError:
        return False, f"fila cheia ({APOSTA_FILA_TIMEOUT}s)", 0.0

    try:
        espera = _time.monotonic() - t_pedido
        if espera > 1.5:
            log_ev(f"  [lock] esperou {espera:.1f}s na fila")
        return await _apostar_com_overask_inner(
            ctx, api, eid, odd_inicial, stake_inicial,
            fator_overask, max_tentativas, stake_min_viavel,
            validar_odd_fn=validar_odd_fn,
        )
    finally:
        APOSTA_LOCK.release()


async def _apostar_com_overask_inner(ctx, api, eid, odd_inicial, stake_inicial,
                                     fator_overask, max_tentativas, stake_min_viavel,
                                     validar_odd_fn=None):
    stake_atual = stake_inicial
    odd = odd_inicial

    for tent in range(1, max_tentativas + 1):
        if stake_atual < stake_min_viavel:
            return False, f"stake < R${stake_min_viavel}", 0.0

        d_fresh, odd_fresh = await get_odd_fresca(api, eid, odd["uuid"], odd["marketId"])
        if not odd_fresh:
            return False, "odd sumiu", 0.0
        d = d_fresh
        odd = odd_fresh
        # Validacao extra (usada pela HC): garante que a odd FRESCA ainda e o
        # alvo pedido - a Superbet mantem o MESMO uuid quando a linha se move.
        if validar_odd_fn is not None:
            try:
                ok_v, motivo_v = validar_odd_fn(odd)
            except Exception as e:
                ok_v, motivo_v = False, f"validador exc {str(e)[:40]}"
            if not ok_v:
                return False, f"validacao: {motivo_v}", 0.0
        body = montar_body(d, odd, stake_atual)
        if not body:
            return False, "erro montar body", 0.0

        try:
            cookies_list = await ctx.cookies([
                "https://superbet.bet.br",
                "https://api.web.production.betler.superbet.bet.br",
            ])
            cookies = {c["name"]: c["value"] for c in cookies_list}
        except Exception:
            cookies = {}

        headers = {
            "accept": "application/json, text/plain, */*",
            "content-type": "application/json",
            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                          "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
            "referer": "https://superbet.bet.br/",
            "origin": "https://superbet.bet.br",
            "sec-ch-ua-platform": '"Windows"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua": '"Google Chrome";v="147", "Not.A/Brand";v="8", "Chromium";v="147"',
        }

        try:
            async with httpx.AsyncClient(timeout=20, cookies=cookies) as c:
                resp = await c.post(SB_BET_URL, headers=headers, json=body)
                try:
                    j = resp.json()
                except Exception:
                    return False, f"resp nao-json status={resp.status_code}", 0.0

                if not j.get("error"):
                    ticket = j.get("data", {}).get("ticketId", "?")
                    return True, ticket, stake_atual

                err = j.get("errorCode", "")
                note = j.get("notice", "")

                if detecta_overask(err, note):
                    global _OVERASK_AVISADO, PRECISA_TROCAR_CONTA, _COUNT_OVERASK
                    max_stake = extrair_max_stake(j)

                    # ============ LOGICA NOVA ============
                    # max >= STAKE_MIN_LIMITADO (R$50): so ajusta stake e re-tenta, NAO conta overask
                    # max <  STAKE_MIN_LIMITADO: limitacao REAL, incrementa contador
                    # max nao extraido: trata como limitacao real (incerto)

                    if max_stake and max_stake >= STAKE_MIN_LIMITADO:
                        # AJUSTE DE STAKE, nao limitacao
                        # Memoriza esse teto pra proximas apostas dessa estrategia
                        mid = odd.get("marketId")
                        if mid == MKT_OVER_FT:
                            _LIMITE_CASA["FT"] = max_stake
                            chave_log = "FT"
                        elif mid == MKT_HC_FT:
                            _LIMITE_CASA["HC"] = max_stake
                            chave_log = "HC"
                        elif mid in (MKT_TOTAL_HOME, MKT_TOTAL_AWAY, MKT_Q4_HOME, MKT_Q4_AWAY):
                            chave_log = "VENC/PERD"
                            _LIMITE_CASA["VENC"] = min(_LIMITE_CASA["VENC"] or max_stake, max_stake)
                            _LIMITE_CASA["PERD"] = min(_LIMITE_CASA["PERD"] or max_stake, max_stake)
                        else:
                            chave_log = "?"

                        novo = round(max_stake, 2)
                        log_ev(f"  AJUSTE tent{tent}: pedido R${stake_atual} -> casa aceita R${max_stake} (>= R${STAKE_MIN_LIMITADO}, segue) [memoria {chave_log}]")
                        stake_atual = novo
                        await asyncio.sleep(0.3)
                        continue

                    # max < 50 OU nao extraido = LIMITACAO REAL
                    _COUNT_OVERASK += 1
                    _registrar_limitacao_atual()
                    if _COUNT_OVERASK >= THRESHOLD_OVERASK_TROCA:
                        PRECISA_TROCAR_CONTA = True

                    if max_stake:
                        novo = round(max_stake * fator_overask, 2)
                        log_ev(f"  LIMITADO tent{tent}: max=R${max_stake} < R${STAKE_MIN_LIMITADO} (count={_COUNT_OVERASK}/{THRESHOLD_OVERASK_TROCA})")
                        if not _OVERASK_AVISADO:
                            _OVERASK_AVISADO = True
                            asyncio.create_task(tg_send(
                                f"⚠️ <b>LIMITADO</b> [{USUARIO}]\n"
                                f"eid={eid}\n"
                                f"stake pedida: R${stake_atual}\n"
                                f"max permitido: R${max_stake} (< R${STAKE_MIN_LIMITADO:.0f})\n"
                                f"contador: {_COUNT_OVERASK}/{THRESHOLD_OVERASK_TROCA}"
                            ))
                    else:
                        novo = round(stake_atual * fator_overask, 2)
                        log_ev(f"  LIMITADO tent{tent}: max nao extraido ({err}/{note[:50]}) (count={_COUNT_OVERASK}/{THRESHOLD_OVERASK_TROCA})")
                        if not _OVERASK_AVISADO:
                            _OVERASK_AVISADO = True
                            asyncio.create_task(tg_send(
                                f"⚠️ <b>LIMITADO</b> [{USUARIO}]\n"
                                f"eid={eid}\n"
                                f"stake pedida: R${stake_atual}\n"
                                f"max nao extraido ({err})\n"
                                f"contador: {_COUNT_OVERASK}/{THRESHOLD_OVERASK_TROCA}"
                            ))
                    stake_atual = novo
                    await asyncio.sleep(0.4)
                    continue

                log_ev(f"  tent{tent}: {err} ({note})")

                txt_full = f"{err} {note}".lower()
                if any(k in txt_full for k in [
                    "cupom negado", "cupom recusado", "ticketrejected",
                    "betrejected", "rejected", "negado", "recusado",
                ]):
                    global _CUPOM_NEGADO_AVISADO, _COUNT_CUPOM_NEGADO
                    _COUNT_CUPOM_NEGADO += 1
                    _registrar_limitacao_atual()
                    if _COUNT_CUPOM_NEGADO >= THRESHOLD_CUPOM_NEGADO_TROCA:
                        PRECISA_TROCAR_CONTA = True
                    log_ev(f"  CUPOM NEGADO ({_COUNT_CUPOM_NEGADO}/{THRESHOLD_CUPOM_NEGADO_TROCA}): {err}")
                    if not _CUPOM_NEGADO_AVISADO:
                        _CUPOM_NEGADO_AVISADO = True
                        asyncio.create_task(tg_send(
                            f"❌ <b>CUPOM NEGADO</b> [{USUARIO}]\n"
                            f"eid={eid}\nstake: R${stake_atual}\n"
                            f"err: {err}\nmsg: {note[:200]}\n"
                            f"contador: {_COUNT_CUPOM_NEGADO}/{THRESHOLD_CUPOM_NEGADO_TROCA}"
                        ))

                if err in ("oddNotActive", "oddsChanged", "priceChanged", "marketClosed"):
                    await asyncio.sleep(0.3)
                    continue
                # Detecta sessionNotValid -> registra como limitacao (sessao morreu = troca conta)
                if "session" in (err or "").lower() and "valid" in (err or "").lower():
                    _registrar_limitacao_atual()
                return False, f"{err}: {note}", 0.0

        except Exception as e:
            # DIAGNOSTICO: os timeouts do httpx tem str(e) VAZIO - sem o TIPO da
            # excecao o log vira "exc:" pelado e nao da pra saber o culpado.
            #   ConnectTimeout = nao consegue abrir TCP (rede/bloqueio)
            #   ReadTimeout    = conectou e a casa nao respondeu (tarpit/lentidao)
            #   PoolTimeout    = conexoes do proprio cliente esgotadas (lado nosso)
            _tipo = type(e).__name__
            log_ev(f"  tent{tent} exc: {_tipo}: {str(e)[:80] or repr(e)[:80]}")
            # AMBIGUO (padrao do botbetsson3): timeout/erro de rede NAO prova que a
            # aposta nao entrou - ela pode ter landado no servidor. NUNCA re-tentar,
            # senao a proxima tentativa DOBRA a aposta com dinheiro real.
            if "Timeout" in _tipo or "Connect" in _tipo or "Read" in _tipo:
                log_ev(f"  AMBIGUO ({_tipo}) - NAO re-tento (a aposta pode ter entrado)")
                return False, f"AMBIGUO:{_tipo}", 0.0
            await asyncio.sleep(0.4)

    return False, f"esgotou {max_tentativas} tent", 0.0


# ==================== LOGIN ====================
async def _get_superbet_page(ctx):
    for pg in ctx.pages:
        try:
            if SB_DOMAIN in (pg.url or ""):
                try: await pg.bring_to_front()
                except Exception: pass
                return pg
        except Exception: continue
    for pg in ctx.pages:
        try:
            url = (pg.url or "")
            if url in ("", "about:blank") or url.startswith("chrome://newtab"):
                try: await pg.bring_to_front()
                except Exception: pass
                await pg.goto(f"{SB_HOME}/", wait_until="domcontentloaded", timeout=30000)
                return pg
        except Exception: continue
    pg = await ctx.new_page()
    await pg.goto(f"{SB_HOME}/", wait_until="domcontentloaded", timeout=30000)
    return pg


async def checar_login(page, timeout_ms=3000):
    """FAIL-CLOSED (v12): logado exige evidencia POSITIVA cruzada.
    1) Botao ENTRAR visivel -> DESLOGADO, ponto final (evidencia negativa manda).
    2) So marcadores FORTES contam (os mesmos que o pos-login espera).
    3) Bloco de saldo no DOM tambem vale como prova (so renderiza logado).
    Ambiguidade -> False: forca o fazer_login da pool em vez de assumir."""
    for sel in ("button.e2e-login", 'button:has(span:has-text("entrar"))'):
        try:
            loc = page.locator(sel).first
            if await loc.count() > 0 and await loc.is_visible(timeout=800):
                return False
        except Exception:
            continue
    for sel in ("button.e2e-account-user-info", ".e2e-mobile-account-user-info"):
        try:
            loc = page.locator(sel).first
            if await loc.count() > 0:
                try:
                    if await loc.is_visible(timeout=timeout_ms): return True
                except Exception: continue
        except Exception: continue
    for sel in (".e2e-balance .e2e-currency__amount",
                ".mobile-header-balance .e2e-currency__amount",
                ".balance .e2e-currency__amount"):
        try:
            if await page.locator(sel).first.count() > 0:
                return True
        except Exception:
            continue
    return False


async def fechar_banner_cookies(page) -> bool:
    """Fecha banner de cookies OneTrust com clique NATURAL (sem force, sem JS eval).
    Espera o botao aparecer ate 3s. Se nao aparecer, retorna False silenciosamente."""
    try:
        btn = page.locator("#onetrust-accept-btn-handler").first
        # Espera ate 3s pelo botao aparecer (banner pode demorar pra renderizar)
        try:
            await btn.wait_for(state="visible", timeout=3000)
        except Exception:
            return False  # banner nao apareceu, nada a fazer
        # Clique NATURAL - sem force, sem JS, simula mouse real
        await btn.click(timeout=3000)
        await asyncio.sleep(0.8)
        log_ev("[cookies] banner aceito")
        return True
    except Exception as e:
        log_ev(f"[cookies] erro fechar banner (segue mesmo assim): {str(e)[:80]}")
        return False


async def fechar_todos_modais(page):
    sessao_expirada = False
    seletores = ['button[data-action="dismiss"]', 'button[data-action="secondary"]',
                 'button.e2e-close-modal', 'button[aria-label*="fechar" i]',
                 'button[aria-label*="close" i]', 'button.cookie-accept',
                 'button:has-text("Aceitar")', 'button:has-text("Entendi")', 'button:has-text("OK")']
    for _ in range(6):
        fechou = False
        for sel in seletores:
            try:
                btn = page.locator(sel).first
                if await btn.count() == 0: continue
                try:
                    if not await btn.is_visible(timeout=500): continue
                except Exception: continue
                try:
                    titulo_el = page.locator(".e2e-modal-title").first
                    titulo = (await titulo_el.inner_text())[:60] if await titulo_el.count() > 0 else "?"
                except Exception: titulo = "?"
                if any(k in titulo.upper() for k in ("ENTRE","ENTRAR","LOGIN","JOGAR","SESSAO","SESSÃO")):
                    sessao_expirada = True
                try: await btn.click(timeout=2000)
                except Exception:
                    try: await btn.click(timeout=2000, force=True)
                    except Exception: continue
                log_ev(f"Modal fechado: {titulo}")
                await asyncio.sleep(0.5)
                fechou = True
                break
            except Exception: continue
        if not fechou: break
    try: await page.keyboard.press("Escape"); await asyncio.sleep(0.3)
    except Exception: pass
    return sessao_expirada


async def fazer_login(page):
    """Faz login. Em caso de sucesso registra _CONTA_LOGIN_TS pro cooldown.
    Em caso de falha, incrementa _LOGIN_FAIL_STREAK pra modo emergencia."""
    global _CONTA_LOGIN_TS, _CONTA_PRIMEIRA_LIMITACAO
    global _LOGIN_FAIL_STREAK, _LOGIN_FAIL_LAST_USER

    user = str(USUARIO)
    log_ev(f"Login... user={user} url={page.url}")
    try:
        if SB_DOMAIN not in (page.url or ""):
            await page.goto(f"{SB_HOME}/", wait_until="domcontentloaded", timeout=30000)
        try: await page.bring_to_front()
        except Exception: pass
        try: await page.wait_for_load_state("networkidle", timeout=15000)
        except Exception: pass
        await asyncio.sleep(1.5)
        # Banner de cookies bloqueia cliques. Aceita normalmente (clique humano).
        await fechar_banner_cookies(page)
        await fechar_todos_modais(page)
        for i in range(3):
            if await checar_login(page):
                log_ev(f"Ja logado (check {i+1})")
                if _CONTA_LOGIN_TS == 0.0:
                    _CONTA_LOGIN_TS = _time.time()
                    _CONTA_PRIMEIRA_LIMITACAO = 0.0
                    _stats_registrar_conta_nova(user)
                _LOGIN_FAIL_STREAK = 0
                _LOGIN_FAIL_LAST_USER = ""
                return True
            await asyncio.sleep(1)
            await fechar_todos_modais(page)
        for sel in ("button.e2e-login", 'button:has(span:has-text("entrar"))'):
            try:
                loc = page.locator(sel).first
                if await loc.count() == 0: continue
                try: await loc.scroll_into_view_if_needed(timeout=3000)
                except Exception: pass
                try: await loc.click(timeout=4000)
                except Exception:
                    try: await loc.click(timeout=4000, force=True)
                    except Exception:
                        try: await loc.evaluate("el => el.click()")
                        except Exception: continue
                break
            except Exception: continue
        SEL_USER = "input[name='usernameOrEmail'], input[name='email']"
        await page.wait_for_selector(SEL_USER, timeout=10000, state="visible")
        await asyncio.sleep(1)
        await page.focus(SEL_USER); await asyncio.sleep(0.4)
        await page.keyboard.type(str(USUARIO), delay=90); await asyncio.sleep(0.4)
        await page.focus("input[name='password']"); await asyncio.sleep(0.4)
        await page.keyboard.type(str(SENHA), delay=90); await asyncio.sleep(0.4)
        try: await page.click("#login-modal-submit", timeout=5000)
        except Exception:
            try: await page.locator("#login-modal-submit").click(timeout=3000, force=True)
            except Exception: await page.keyboard.press("Enter")
        for tent in range(2):
            try:
                await page.wait_for_selector(
                    "button.e2e-account-user-info, .e2e-mobile-account-user-info",
                    timeout=30000, state="visible",
                )
                log_ev("Login OK")
                _CONTA_LOGIN_TS = _time.time()
                _CONTA_PRIMEIRA_LIMITACAO = 0.0
                _stats_registrar_conta_nova(user)
                _LOGIN_FAIL_STREAK = 0
                _LOGIN_FAIL_LAST_USER = ""
                try:
                    conta_ativa()["falha_login_count"] = 0
                    _accounts_sync_to_disk()
                except Exception: pass
                return True
            except Exception:
                log_ev(f"aguardando conta (tent {tent+1})...")
                await fechar_todos_modais(page)

        log_ev(f"login err: nao apareceu user-info pra {user}")
        if _LOGIN_FAIL_LAST_USER != user:
            _LOGIN_FAIL_STREAK += 1
            _LOGIN_FAIL_LAST_USER = user
        try:
            conta_ativa()["falha_login_count"] = conta_ativa().get("falha_login_count", 0) + 1
            _accounts_sync_to_disk()
        except Exception: pass
        await _check_emergencia_login()
        return False
    except Exception as e:
        log_ev(f"login err: {str(e)[:120]}")
        if _LOGIN_FAIL_LAST_USER != user:
            _LOGIN_FAIL_STREAK += 1
            _LOGIN_FAIL_LAST_USER = user
        try:
            conta_ativa()["falha_login_count"] = conta_ativa().get("falha_login_count", 0) + 1
            _accounts_sync_to_disk()
        except Exception: pass
        await _check_emergencia_login()
        return False


# ==================== TROCA DE CONTA ====================
_TROCANDO_CONTA = False
POOL_ESGOTADA = False


def _proxima_conta_idx(skip_atual=True) -> Optional[int]:
    """Retorna o idx da proxima conta ATIVA na pool.
    Se _CONTA_IDX nao aponta pra conta valida (ex: saiu de AGUARDANDO_CONTA),
    skip_atual eh ignorado (porque nao tem 'atual' pra pular)."""
    sem_conta_atual = not (0 <= _CONTA_IDX < len(CONTAS))
    skip = skip_atual and not sem_conta_atual

    if _TROCA_FORCADA_USER:
        for i, c in enumerate(CONTAS):
            if c.get("user") == _TROCA_FORCADA_USER and c.get("ativo", True):
                if not skip or i != _CONTA_IDX:
                    return i
        return None
    n = len(CONTAS)
    if n == 0:
        return None
    # Se sem conta atual, comeca do idx 0; senao gira a partir da atual
    start = 0 if sem_conta_atual else _CONTA_IDX
    for offset in range(0 if sem_conta_atual else 1, n + 1):
        i = (start + offset) % n
        if i == _CONTA_IDX and skip:
            continue
        if CONTAS[i].get("ativo", True):
            return i
    return None


async def _logout_e_limpar_storage(page, ctx):
    log_ev("[troca] limpando storage...")
    try:
        for sel in ("button.e2e-account-user-info",
                    "[data-testid='account-button']",
                    "button.e2e-my-account"):
            try:
                btn = page.locator(sel).first
                if await btn.count() > 0 and await btn.is_visible(timeout=1500):
                    await btn.click(timeout=2500)
                    await asyncio.sleep(0.8)
                    break
            except Exception: continue
        for sel in ('button:has-text("Sair")', 'button:has-text("Logout")',
                    'a:has-text("Sair")', '[data-testid="logout"]'):
            try:
                btn = page.locator(sel).first
                if await btn.count() > 0 and await btn.is_visible(timeout=1500):
                    await btn.click(timeout=2500)
                    await asyncio.sleep(1.0)
                    log_ev("[troca] logout UI OK")
                    break
            except Exception: continue
    except Exception as e:
        log_ev(f"[troca] logout UI falhou: {str(e)[:80]} (segue mesmo assim)")

    try:
        await ctx.clear_cookies()
        log_ev("[troca] cookies limpos")
    except Exception as e:
        log_ev(f"[troca] clear_cookies err: {str(e)[:60]}")

    try: await ctx.clear_permissions()
    except Exception: pass

    try:
        await page.evaluate("""async () => {
            try { localStorage.clear(); } catch(e) {}
            try { sessionStorage.clear(); } catch(e) {}
            try {
                if (window.indexedDB && indexedDB.databases) {
                    const dbs = await indexedDB.databases();
                    for (const db of dbs) {
                        if (db.name) { try { indexedDB.deleteDatabase(db.name); } catch(e) {} }
                    }
                }
            } catch(e) {}
            try {
                if (window.caches) {
                    const ks = await caches.keys();
                    for (const k of ks) { try { await caches.delete(k); } catch(e) {} }
                }
            } catch(e) {}
            try {
                if (navigator.serviceWorker) {
                    const regs = await navigator.serviceWorker.getRegistrations();
                    for (const r of regs) { try { await r.unregister(); } catch(e) {} }
                }
            } catch(e) {}
        }""")
        log_ev("[troca] LS/SS/IDB/caches/SW limpos")
    except Exception as e:
        log_ev(f"[troca] limpeza JS err: {str(e)[:80]}")

    try:
        cdp = await ctx.new_cdp_session(page)
        try:
            await cdp.send("Network.clearBrowserCache")
            await cdp.send("Network.clearBrowserCookies")
            log_ev("[troca] cache HTTP limpo via CDP")
        except Exception: pass
        try: await cdp.detach()
        except Exception: pass
    except Exception: pass

    try:
        await page.goto(f"{SB_HOME}/", wait_until="domcontentloaded", timeout=30000)
        await asyncio.sleep(1.5)
        # Apos limpar cookies, o banner reaparece. Aceita normal (clique humano).
        await fechar_banner_cookies(page)
    except Exception as e:
        log_ev(f"[troca] reload err: {str(e)[:80]}")


async def trocar_conta(page, ctx):
    """Logout, escolhe proxima conta da pool, faz login.
    Aplica COOLDOWN preventivo se troca foi por LIMITACAO (nao manual)."""
    global _CONTA_IDX, _TROCANDO_CONTA, POOL_ESGOTADA
    global _OVERASK_AVISADO, _CUPOM_NEGADO_AVISADO
    global _COUNT_OVERASK, _COUNT_CUPOM_NEGADO
    global _BANCA_ATUAL, _BANCA_INICIAL, _BANCA_TS
    global _CONTA_LOGIN_TS, _CONTA_PRIMEIRA_LIMITACAO
    global _TROCA_FORCADA_USER, _TROCA_MANUAL
    global PAUSADO, MOTIVO_PAUSA, PAUSADO_ATE
    global PRECISA_TROCAR_CONTA, AGUARDANDO_CONTA

    if _TROCANDO_CONTA:
        log_ev("[troca] ja em andamento, ignora")
        return False
    _TROCANDO_CONTA = True

    try:
        conta_atual = conta_ativa()["user"]

        prox_idx = _proxima_conta_idx(skip_atual=True)
        if prox_idx is None:
            log_ev(f"[troca] POOL ESGOTADA apos {conta_atual}")
            POOL_ESGOTADA = True
            AGUARDANDO_CONTA = True
            PAUSADO = True
            PAUSADO_ATE = 0.0
            MOTIVO_PAUSA = "AGUARDANDO_CONTA (pool esgotada)"
            ativas = sum(1 for c in CONTAS if c.get("ativo", True))
            await tg_send(
                f"🟡 <b>POOL ESGOTADA</b>\n"
                f"{divisor()}\n"
                f"{USER_NAME}, a pool acabou! 😱\n"
                f"\n"
                f"👤 ultima conta: <code>{conta_atual}</code>\n"
                f"📊 contas ativas: {ativas}\n"
                f"\n"
                f"⏸️ <b>BOT EM ESPERA</b> <i>(NAO encerrou)</i>\n"
                f"\n"
                f"<b>pra continuar:</b>\n"
                f"<code>/addconta user pass</code>\n"
                f"\n<i>o bot retoma SOZINHO assim que houver conta nova 🔁</i>"
            )
            return False

        prox_conta = CONTAS[prox_idx]["user"]
        eh_manual = _TROCA_MANUAL
        _TROCA_MANUAL = False
        _TROCA_FORCADA_USER = None

        if not eh_manual:
            _empurrar_para_historico_limitacao()

        # CIRCUITO QUEBRA-LOOP: trocas em rajada -> EMERGENCIA (evita hammering infinito)
        if not eh_manual:
            estourou = _registrar_troca_para_anti_loop()
            if estourou:
                global EMERGENCIA, MOTIVO_EMERGENCIA
                EMERGENCIA = True
                MOTIVO_EMERGENCIA = f"LOOP_DETECTADO ({len(_TROCAS_TIMESTAMPS)} trocas em {JANELA_TROCAS_RAJADA_SEG/60:.0f}min)"
                PAUSADO = True
                MOTIVO_PAUSA = f"emergencia: {MOTIVO_EMERGENCIA}"
                log_ev(f"  [ANTI-LOOP] {MOTIVO_EMERGENCIA} -> ENTRANDO EM EMERGENCIA")
                await tg_send(
                    f"🚨 <b>CIRCUITO QUEBRA-LOOP DISPAROU</b>\n"
                    f"{divisor()}\n"
                    f"{USER_NAME}, o bot trocou de conta <b>{len(_TROCAS_TIMESTAMPS)} vezes</b>\n"
                    f"em apenas {JANELA_TROCAS_RAJADA_SEG/60:.0f} minutos! 🛑\n"
                    f"\n"
                    f"<b>provaveis causas:</b>\n"
                    f"• site da Superbet com problema\n"
                    f"• bug de parsing (DOM mudou)\n"
                    f"• IP/proxy bloqueado pela casa\n"
                    f"• todas as contas com saldo baixo\n"
                    f"\n"
                    f"<b>bot PAUSOU pra evitar hammering.</b>\n"
                    f"verifique o problema e use <code>/retomar</code>\n"
                    f"(o /retomar zera o contador automaticamente)"
                )
                _TROCANDO_CONTA = False
                return False

        if _CONTA_LOGIN_TS > 0:
            duracao_ativa = _time.time() - _CONTA_LOGIN_TS
            _stats_registrar_troca(duracao_ativa, "limitacao" if not eh_manual else "manual")
        else:
            duracao_ativa = 0.0

        eh_primeiro_login = not (0 <= _CONTA_IDX < len(CONTAS))  # idx invalido = AGUARDANDO_CONTA saindo
        log_ev(f"[troca] {conta_atual} -> {prox_conta} ({'manual' if eh_manual else 'limitacao'}{', primeiro login' if eh_primeiro_login else ''}, ativa={_fmt_dur(duracao_ativa)})")

        if eh_primeiro_login:
            await tg_send(
                f"🔑 <b>PRIMEIRO LOGIN</b> ✨\n"
                f"{divisor()}\n"
                f"{USER_NAME}, vamos comecar a trampar!\n"
                f"\n"
                f"👤 conta: <code>{prox_conta}</code>"
            )
        else:
            motivo_emoji = "🖐️" if eh_manual else "🚧"
            motivo_txt = "manual" if eh_manual else "LIMITADA"
            await tg_send(
                f"🔄 <b>TROCANDO CONTA</b> {motivo_emoji}\n"
                f"{divisor()}\n"
                f"➡️  saindo: <code>{conta_atual}</code> <i>({motivo_txt})</i>\n"
                f"⬅️  entrando: <code>{prox_conta}</code>\n"
                f"⏱️  ativa por: {_fmt_dur(duracao_ativa)}"
            )

        cooldown_seg = _calcular_cooldown_necessario() if not eh_manual else 0.0

        await _logout_e_limpar_storage(page, ctx)

        _CONTA_IDX = prox_idx
        _accounts_sync_to_disk()

        _OVERASK_AVISADO = False
        _CUPOM_NEGADO_AVISADO = False
        _COUNT_OVERASK = 0
        _COUNT_CUPOM_NEGADO = 0
        _CONTA_LOGIN_TS = 0.0
        _CONTA_PRIMEIRA_LIMITACAO = 0.0
        # Reset saldo zerado (nova conta = comeca limpa)
        global _SALDO_ZERADO_DESDE, _SALDO_ZERADO_AVISADO
        _SALDO_ZERADO_DESDE = 0.0
        _SALDO_ZERADO_AVISADO = False
        # Reseta memoria de limites da casa (nova conta = novos limites)
        for k in _LIMITE_CASA:
            _LIMITE_CASA[k] = 0.0

        async with _BANCA_LOCK:
            _BANCA_ATUAL = 0.0
            _BANCA_INICIAL = 0.0
            _BANCA_TS = 0.0

        if cooldown_seg > 0:
            PAUSADO = True
            PAUSADO_ATE = _time.time() + cooldown_seg
            MOTIVO_PAUSA = f"cooldown preventivo {cooldown_seg/60:.0f}min"
            log_ev(f"[cooldown] aguardando {cooldown_seg/60:.0f}min antes de logar {prox_conta}")
            await tg_send(
                f"⏳ <b>COOLDOWN PREVENTIVO</b>\n"
                f"{divisor()}\n"
                f"{USER_NAME}, ult {COOLDOWN_JANELA} contas duraram pouco ativas 🥵\n"
                f"\n"
                f"⏱️  pausando: <b>{cooldown_seg/60:.0f} min</b>\n"
                f"⬅️  proxima conta: <code>{prox_conta}</code>\n"
                f"\n<i>(/retomar pra pular o cooldown)</i>"
            )
            t0 = _time.time()
            while _time.time() < PAUSADO_ATE and not PARAR_BOT:
                if not PAUSADO:
                    log_ev("[cooldown] usuario retomou manualmente, pulando espera")
                    break
                await asyncio.sleep(5)
            PAUSADO = False
            PAUSADO_ATE = 0.0
            MOTIVO_PAUSA = ""
            log_ev(f"[cooldown] terminou ({_fmt_dur(_time.time()-t0)}), tentando login {prox_conta}")

        try:
            await page.goto(f"{SB_HOME}/", wait_until="domcontentloaded", timeout=30000)
            await asyncio.sleep(2)
        except Exception: pass
        await fechar_todos_modais(page)

        ok = await fazer_login(page)
        if ok:
            await init_bet_config(page)
            await asyncio.sleep(2)
            await atualizar_banca(page, force=True)
            log_ev(f"[troca] OK, agora rodando como {prox_conta}")
            await tg_send(
                f"✅ <b>LOGADO COM SUCESSO</b> 🎉\n"
                f"{divisor()}\n"
                f"👤 conta: <code>{prox_conta}</code>\n"
                f"🏦 banca: R${_BANCA_ATUAL:,.2f}\n"
                f"\n<i>bora trabalhar, {USER_NAME}! 🚀</i>"
            )
            return True
        else:
            # FALHA login na conta nova: incrementa contador da conta, e se passou do limite, desativa
            log_ev(f"[troca] FALHA login {prox_conta}")
            try:
                falhas_atual = CONTAS[prox_idx].get("falha_login_count", 0)
                if falhas_atual >= MAX_FALHAS_LOGIN_POR_CONTA:
                    CONTAS[prox_idx]["ativo"] = False
                    log_ev(f"[troca] {prox_conta} desativada automaticamente ({falhas_atual} falhas >= {MAX_FALHAS_LOGIN_POR_CONTA})")
                    await tg_send(
                        f"❌ <b>CONTA AUTO-DESATIVADA</b>\n"
                        f"{divisor()}\n"
                        f"👤 <code>{prox_conta}</code>\n"
                        f"💔 {falhas_atual} falhas de login seguidas\n"
                        f"\n<i>{USER_NAME}, use <code>/senha {prox_conta} novasenha</code> pra reativar</i>"
                    )
                    _accounts_sync_to_disk()
                else:
                    await tg_send(
                        f"⚠️ <b>FALHA LOGIN</b>\n"
                        f"👤 <code>{prox_conta}</code>\n"
                        f"📊 falhas: {falhas_atual}/{MAX_FALHAS_LOGIN_POR_CONTA}\n"
                        f"\n<i>tentando proxima conta da pool... 🔄</i>"
                    )
            except Exception: pass
            # SINALIZA PRO LOOP TENTAR PROXIMA CONTA AUTOMATICAMENTE
            PRECISA_TROCAR_CONTA = True
            _TROCA_MANUAL = False
            _TROCA_FORCADA_USER = None
            return False
    finally:
        _TROCANDO_CONTA = False


# ==================== ESTADO ====================
@dataclass
class Jogo:
    event_id: int
    match_name: str
    nick_a: Optional[str] = None
    nick_b: Optional[str] = None
    ultimo_visto: float = 0.0
    ft_apostadas: set = field(default_factory=set)
    ft_stake: float = 0.0
    ft_linha_ancora: Optional[float] = None   # 1a linha vista no instante do 1o sinal |diff|>=12
    venc_apostadas: set = field(default_factory=set)
    venc_stake: float = 0.0
    perd_apostadas: set = field(default_factory=set)
    perd_stake: float = 0.0
    # --- ESTRATEGIA 4: HC ZEBRA ---
    hc_apostadas: set = field(default_factory=set)      # {(nick, linha)}
    hc_stake: float = 0.0
    hc_targets: Optional[dict] = None                   # {nick: {linha: frozenset(ids)}} do TipManager
    hc_cont_estr: dict = field(default_factory=dict)    # {estr_id: n creditadas} (teto logico)
    hc_h2h: Optional[dict] = None
    hc_tm_status: str = "pendente"                      # pendente | ok | sem_alvo
    hc_tm_task: Optional[object] = None
    hc_tm_retry_apos: float = 0.0
    hc_cooldown: dict = field(default_factory=dict)     # {(nick, linha): ts liberacao}
    hc_log_flags: set = field(default_factory=set)      # avisos 1x por jogo
    tid: int = 0                                        # tournamentId da liga (roteio das estrategias)
    # --- ESTRATEGIA 5: UNDER CLA ---
    cla_apostadas: set = field(default_factory=set)     # {linha} ja apostadas neste jogo
    cla_stake: float = 0.0
    cla_sinais: int = 0
    cla_log_flags: set = field(default_factory=set)


# ==================== ESTRATEGIA 1: OVER FT ====================
async def processar_over_ft(ctx, api, ev, jg, sh, sa, periodo, na, nb):
    if not ESTRATEGIA_OVER_FT_ATIVA: return
    if PAUSADO or EMERGENCIA: return
    eid = ev.get("eventId")
    mn = ev.get("matchName", "")
    odds = ev.get("odds") or []

    if periodo not in PERIODOS_OVER_FT: return
    diff = abs(sh - sa)
    if diff < DIFF_MIN_FT:
        log_scan(f"{mn} | OVER_FT diff={diff} < {DIFF_MIN_FT}")
        return

    # BL CONDICIONAL (ladroes totais + ruim_venc + ruim_perd, baseado em papel no sinal)
    motivo_bl = _ft_deve_pular(na, nb, sh, sa)
    if motivo_bl:
        log_scan(f"{mn} | OVER_FT skip: {motivo_bl}")
        return

    cand = []
    for o in odds:
        try:
            if o.get("marketId") != MKT_OVER_FT: continue
            if o.get("status") != "active": continue
            if "mais de" not in (o.get("name") or "").lower(): continue
            price = o.get("price", 0)
            if price < ODD_MIN or price > ODD_MAX: continue
            linha = float(o.get("specialBetValue") or 0)
            if linha < LINHA_MIN_OVER_FT or linha > LINHA_MAX_OVER_FT: continue
            if linha in jg.ft_apostadas: continue
            cand.append((linha, o))
        except Exception: continue

    if not cand:
        return

    # ANCORA: salva a MENOR linha disponivel no instante do PRIMEIRO sinal valido do jogo.
    # Linhas futuras so podem ser apostadas se <= ancora + DELTA_MAX_OVER_FT.
    # Linhas ABAIXO da ancora SAO PERMITIDAS (linha caindo = time pausou pontos, mas total ja vai alto).
    if jg.ft_linha_ancora is None:
        jg.ft_linha_ancora = min(l for l, _ in cand)
        log_ev(f"[FT] ANCORA setada: {mn} {sh}-{sa} per={periodo} ancora={jg.ft_linha_ancora}")

    ancora = jg.ft_linha_ancora
    limite_sup = ancora + DELTA_MAX_OVER_FT

    cand.sort(key=lambda x: x[0])
    stake_max_jogo = stake_max_jogo_ft()
    for linha, odd in cand:
        # FREIO SUPERIOR -- linha subiu demais (casa ja ajustou)
        if linha > limite_sup:
            log_scan(f"{mn} | OVER_FT skip linha {linha} > ancora+delta ({ancora}+{DELTA_MAX_OVER_FT}={limite_sup})")
            continue
        # Pra baixo (linha < ancora) e ACEITO

        if MAX_APOSTAS_OVER_FT > 0 and len(jg.ft_apostadas) >= MAX_APOSTAS_OVER_FT:
            log_ev(f"LIMITE FT: {mn} {len(jg.ft_apostadas)}/{MAX_APOSTAS_OVER_FT} entradas, parando")
            break
        if jg.ft_stake >= stake_max_jogo:
            log_ev(f"LIMITE FT: {mn} R${jg.ft_stake:.2f}/R${stake_max_jogo:.2f}, parando")
            break
        stake_calc = calc_stake(PCT_FT, TETO_FT, "FT")
        stake_disp = stake_max_jogo - jg.ft_stake
        if stake_disp < STAKE_MIN_VIAVEL_GLOBAL:
            log_ev(f"LIMITE FT: {mn} R${jg.ft_stake:.2f}/R${stake_max_jogo:.2f}, restante < min")
            break
        stake = min(stake_calc, stake_disp)
        delta_atual = linha - ancora
        log_ev(f"TRIGGER OVER_FT: {mn} {sh}-{sa} diff={diff} per={periodo} >> Mais de {linha} (delta={delta_atual:+.1f}) @{odd['price']} stake=R${stake:.2f} (banca=R${_BANCA_ATUAL:,.2f}, acum jogo: R${jg.ft_stake:.2f}/R${stake_max_jogo:.2f})")
        jg.ft_apostadas.add(linha)
        try:
            ok, ret, stake_real = await asyncio.wait_for(
                apostar_com_overask(ctx, api, eid, odd, stake,
                                    FATOR_OVERASK_FT, MAX_TENTATIVAS_OVERASK_FT, STAKE_MIN_VIAVEL_GLOBAL),
                timeout=30,
            )
        except asyncio.TimeoutError:
            ok, ret, stake_real = False, "timeout", 0.0
        if ok:
            jg.ft_stake += stake_real
            _stats_registrar_ticket(stake_real)
            log_ev(f"  TICKET {ret} OVER_FT Mais de {linha} R${stake_real:.2f} (acum: R${jg.ft_stake:.2f})")
        else:
            log_ev(f"  X {ret}")
            jg.ft_apostadas.discard(linha)


# ==================== ESTRATEGIA 5: UNDER CLA ====================
async def processar_under_cla(ctx, api, ev, jg, sh, sa, periodo, na, nb):
    """UNDER no Total de Gols do jogo quando |placar| >= CLA_DIFF_MIN. Linha >= 5,5, odd >= 1,60.
    Sem chip, sem blacklist. Uma aposta por linha nova; sem teto de entradas (MAX_APOSTAS_CLA=0).
    TODO sinal vai pro CSV, apostado ou nao (medida de captura)."""
    if not ESTRATEGIA_UNDER_CLA_ATIVA: return
    if PAUSADO or EMERGENCIA: return
    try:
        eid = ev.get("eventId")
        mn = ev.get("matchName", "")
        odds = ev.get("odds") or []
        diff = abs(int(sh) - int(sa))
    except Exception as e:
        log_scan(f"CLA parse err: {str(e)[:60]}"); return

    if CLA_PERIODOS and periodo not in CLA_PERIODOS:
        return
    if diff < CLA_DIFF_MIN:
        log_scan(f"{mn} | CLA diff={diff} < {CLA_DIFF_MIN}")
        return

    cand = []
    for o in odds:
        try:
            if o.get("marketId") != MKT_OU_FT_FUT: continue
            if o.get("status") != "active": continue
            nome = (o.get("name") or "").lower()
            if "menos de" not in nome: continue
            price = float(o.get("price") or 0)
            linha = float(o.get("specialBetValue") or 0)
            if linha <= 0: continue
            if linha in jg.cla_apostadas: continue
            cand.append((linha, price, o))
        except Exception:
            continue

    if not cand:
        if "sem_linha" not in jg.cla_log_flags:
            jg.cla_log_flags.add("sem_linha")
            log_scan(f"{mn} | CLA diff={diff} mas sem under aberto no mkt {MKT_OU_FT_FUT}")
        return

    cand.sort(key=lambda x: x[0])
    stake_max_jogo = stake_max_jogo_cla()
    placar = f"{sh}-{sa}"
    for linha, price, odd in cand:
        # sinal existe; registra mesmo que va pular
        jg.cla_sinais += 1
        _CLA_STATS["sinais"] += 1
        if linha < CLA_LINHA_MIN or linha > CLA_LINHA_MAX:
            _cla_csv_registrar(eid, mn, placar, diff, periodo, linha, price, 0, "pulado", f"linha fora [{CLA_LINHA_MIN},{CLA_LINHA_MAX}]")
            jg.cla_apostadas.add(linha)   # nao reavaliar a mesma linha
            continue
        if price < CLA_ODD_MIN or price > CLA_ODD_MAX:
            _cla_csv_registrar(eid, mn, placar, diff, periodo, linha, price, 0, "pulado", f"odd fora [{CLA_ODD_MIN},{CLA_ODD_MAX}]")
            continue   # a odd pode subir; nao marca a linha
        if MAX_APOSTAS_CLA > 0 and len(jg.cla_apostadas) >= MAX_APOSTAS_CLA:
            _cla_csv_registrar(eid, mn, placar, diff, periodo, linha, price, 0, "pulado", f"teto {MAX_APOSTAS_CLA} entradas/jogo")
            break
        if jg.cla_stake >= stake_max_jogo:
            _cla_csv_registrar(eid, mn, placar, diff, periodo, linha, price, 0, "pulado", f"teto R${stake_max_jogo:.0f}/jogo")
            break
        stake_calc = CLA_STAKE_FIXA if CLA_STAKE_FIXA > 0 else calc_stake(PCT_CLA, TETO_CLA, "CLA")
        stake_disp = stake_max_jogo - jg.cla_stake
        if stake_disp < CLA_STAKE_MIN:
            _cla_csv_registrar(eid, mn, placar, diff, periodo, linha, price, 0, "pulado", "restante do jogo < stake minima")
            break
        stake = round(min(stake_calc, stake_disp), 2)
        log_ev(f"TRIGGER UNDER_CLA: {mn} {placar} diff={diff} per={periodo} >> Menos de {linha} @{price} stake=R${stake:.2f} (banca=R${_BANCA_ATUAL:,.2f}, acum jogo: R${jg.cla_stake:.2f}/R${stake_max_jogo:.2f})")
        jg.cla_apostadas.add(linha)
        try:
            ok, ret, stake_real = await asyncio.wait_for(
                apostar_com_overask(ctx, api, eid, odd, stake,
                                    FATOR_OVERASK_CLA, MAX_TENTATIVAS_OVERASK_CLA, CLA_STAKE_MIN),
                timeout=30,
            )
        except asyncio.TimeoutError:
            ok, ret, stake_real = False, "timeout", 0.0
        except Exception as e:
            ok, ret, stake_real = False, f"exc {type(e).__name__}: {str(e)[:60]}", 0.0
        if ok:
            jg.cla_stake += float(stake_real or 0)
            _CLA_STATS["apostas"] += 1; _CLA_STATS["stake"] += float(stake_real or 0)
            try: _stats_registrar_ticket(stake_real)
            except Exception: pass
            log_ev(f"  TICKET {ret} UNDER_CLA Menos de {linha} R${stake_real:.2f} (acum: R${jg.cla_stake:.2f})")
            _cla_csv_registrar(eid, mn, placar, diff, periodo, linha, price, stake, "apostado", f"ticket {ret}", price, f"{float(stake_real or 0):.2f}")
        else:
            _CLA_STATS["recusas"] += 1
            log_ev(f"  X UNDER_CLA {ret}")
            _cla_csv_registrar(eid, mn, placar, diff, periodo, linha, price, stake, "recusado", str(ret)[:120])
            jg.cla_apostadas.discard(linha)


# ==================== HELPER COMUM Q4 ====================
async def _processar_q4_lado(ctx, api, ev, jg, sh, sa, periodo, na, nb,
                             modo,
                             nick_alvo, pts_atual_total, mid_total, mid_q4,
                             usar_total, usar_q4,
                             line_min, line_max,
                             pct_estrat, teto_estrat,
                             stake_max_jogo_fn,
                             max_apostas_total, max_apostas_q4,
                             fator_overask, max_tent,
                             apostadas_set_attr, stake_attr):
    if PAUSADO or EMERGENCIA: return
    eid = ev.get("eventId")
    mn = ev.get("matchName", "")
    odds = ev.get("odds") or []
    apostadas_set = getattr(jg, apostadas_set_attr)
    stake_atual_jogo = getattr(jg, stake_attr)

    stake_max_jogo = stake_max_jogo_fn()
    if stake_atual_jogo >= stake_max_jogo:
        return

    meta = ev.get("metadata", {}) or {}
    is_home = (sh > sa) if modo == "VENC" else (sh < sa)
    pts_q4_jogador = pts_no_q4(meta, is_home)

    if usar_total:
        cand_t = []
        for o in odds:
            try:
                if o.get("marketId") != mid_total: continue
                if o.get("status") != "active": continue
                if "mais de" not in (o.get("name") or "").lower(): continue
                nick_info = extrair_nick_da_info(o.get("info", ""))
                if nick_info and nick_info != nick_alvo: continue
                price = o.get("price", 0)
                if price < ODD_MIN or price > ODD_MAX: continue
                linha = extrair_linha_sbv(o.get("specialBetValue"), eh_q4=False)
                if linha is None: continue
                line_above = linha - pts_atual_total
                if line_above < line_min or line_above > line_max: continue
                if (mid_total, linha) in apostadas_set: continue
                cand_t.append((linha, o, line_above))
            except Exception: continue

        cand_t.sort(key=lambda x: -x[0])
        for linha, odd, line_above in cand_t:
            count = sum(1 for k in apostadas_set if k[0] == mid_total)
            if max_apostas_total > 0 and count >= max_apostas_total:
                break
            stake_atual_jogo = getattr(jg, stake_attr)
            stake_disp = stake_max_jogo - stake_atual_jogo
            if stake_disp < STAKE_MIN_VIAVEL_GLOBAL:
                log_ev(f"LIMITE {modo}: {mn} R${stake_atual_jogo:.2f}/R${stake_max_jogo:.2f}, parando TOTAL")
                break
            stake_calc = calc_stake(pct_estrat, teto_estrat, modo)
            stake_usar = min(stake_calc, stake_disp)

            log_ev(f"TRIGGER {modo}_TOTAL: {mn} {sh}-{sa} {nick_alvo} pts={pts_atual_total} line={linha} above={line_above:.1f} @{odd['price']} stake=R${stake_usar:.2f} (banca=R${_BANCA_ATUAL:,.2f})")
            apostadas_set.add((mid_total, linha))
            try:
                ok, ret, stake_real = await asyncio.wait_for(
                    apostar_com_overask(ctx, api, eid, odd, stake_usar,
                                        fator_overask, max_tent, STAKE_MIN_VIAVEL_GLOBAL),
                    timeout=30,
                )
            except asyncio.TimeoutError:
                ok, ret, stake_real = False, "timeout", 0.0
            if ok:
                setattr(jg, stake_attr, getattr(jg, stake_attr) + stake_real)
                _stats_registrar_ticket(stake_real)
                log_ev(f"  TICKET {ret} {modo}_TOTAL {nick_alvo} >{linha} R${stake_real:.2f} (acum: R${getattr(jg, stake_attr):.2f})")
            else:
                log_ev(f"  X {ret}")
                apostadas_set.discard((mid_total, linha))

    if usar_q4 and periodo == "Q4":
        cand_q = []
        for o in odds:
            try:
                if o.get("marketId") != mid_q4: continue
                if o.get("status") != "active": continue
                if "mais de" not in (o.get("name") or "").lower(): continue
                nick_info = extrair_nick_da_info(o.get("info", ""))
                if nick_info and nick_info != nick_alvo: continue
                price = o.get("price", 0)
                if price < ODD_MIN or price > ODD_MAX: continue
                linha = extrair_linha_sbv(o.get("specialBetValue"), eh_q4=True)
                if linha is None: continue
                line_above = linha - pts_q4_jogador
                if line_above < line_min or line_above > line_max: continue
                if (mid_q4, linha) in apostadas_set: continue
                cand_q.append((linha, o, line_above))
            except Exception: continue

        cand_q.sort(key=lambda x: -x[0])
        for linha, odd, line_above in cand_q:
            count = sum(1 for k in apostadas_set if k[0] == mid_q4)
            if max_apostas_q4 > 0 and count >= max_apostas_q4:
                break
            stake_atual_jogo = getattr(jg, stake_attr)
            stake_disp = stake_max_jogo - stake_atual_jogo
            if stake_disp < STAKE_MIN_VIAVEL_GLOBAL:
                log_ev(f"LIMITE {modo}: {mn} R${stake_atual_jogo:.2f}/R${stake_max_jogo:.2f}, parando Q4")
                break
            stake_calc = calc_stake(pct_estrat, teto_estrat, modo)
            stake_usar = min(stake_calc, stake_disp)

            log_ev(f"TRIGGER {modo}_Q4: {mn} {sh}-{sa} {nick_alvo} ptsQ4={pts_q4_jogador} line={linha} above={line_above:.1f} @{odd['price']} stake=R${stake_usar:.2f} (banca=R${_BANCA_ATUAL:,.2f})")
            apostadas_set.add((mid_q4, linha))
            try:
                ok, ret, stake_real = await asyncio.wait_for(
                    apostar_com_overask(ctx, api, eid, odd, stake_usar,
                                        fator_overask, max_tent, STAKE_MIN_VIAVEL_GLOBAL),
                    timeout=30,
                )
            except asyncio.TimeoutError:
                ok, ret, stake_real = False, "timeout", 0.0
            if ok:
                setattr(jg, stake_attr, getattr(jg, stake_attr) + stake_real)
                _stats_registrar_ticket(stake_real)
                log_ev(f"  TICKET {ret} {modo}_Q4 {nick_alvo} >{linha} R${stake_real:.2f} (acum: R${getattr(jg, stake_attr):.2f})")
            else:
                log_ev(f"  X {ret}")
                apostadas_set.discard((mid_q4, linha))


# ==================== ESTRATEGIA 2: Q4 VENCENDO ====================
async def processar_q4_vencendo(ctx, api, ev, jg, sh, sa, periodo, na, nb):
    if not ESTRATEGIA_VENCENDO_ATIVA: return
    if periodo not in PERIODOS_VENC: return
    if sh == sa: return
    diff = abs(sh - sa)
    if diff < DIFF_MIN_VENC: return

    if sh > sa:
        nick_alvo = na; pts_atual = sh
        mid_total = MKT_TOTAL_HOME; mid_q4 = MKT_Q4_HOME
    else:
        nick_alvo = nb; pts_atual = sa
        mid_total = MKT_TOTAL_AWAY; mid_q4 = MKT_Q4_AWAY

    if not nick_alvo: return

    mn = ev.get("matchName", "")
    if nick_alvo in BLACKLIST_VENC:
        log_scan(f"{mn} | VENC blacklist {nick_alvo}")
        return
    opp = nb if nick_alvo == na else na
    if frozenset({nick_alvo, opp}) in H2H_TOXICOS_VENC:
        log_scan(f"{mn} | VENC H2H toxico {nick_alvo} vs {opp}")
        return

    await _processar_q4_lado(
        ctx, api, ev, jg, sh, sa, periodo, na, nb,
        modo="VENC",
        nick_alvo=nick_alvo, pts_atual_total=pts_atual,
        mid_total=mid_total, mid_q4=mid_q4,
        usar_total=USAR_TOTAL_PARTIDA_VENC, usar_q4=USAR_PTS_Q4_VENC,
        line_min=LINE_ABOVE_MIN_VENC, line_max=LINE_ABOVE_MAX_VENC,
        pct_estrat=PCT_VENC, teto_estrat=TETO_VENC,
        stake_max_jogo_fn=stake_max_jogo_venc,
        max_apostas_total=MAX_APOSTAS_TOTAL_VENC, max_apostas_q4=MAX_APOSTAS_Q4_VENC,
        fator_overask=FATOR_OVERASK_VENC, max_tent=MAX_TENTATIVAS_OVERASK_VENC,
        apostadas_set_attr="venc_apostadas", stake_attr="venc_stake",
    )


# ==================== ESTRATEGIA 3: Q4 PERDENDO ====================
async def processar_q4_perdendo(ctx, api, ev, jg, sh, sa, periodo, na, nb):
    if not ESTRATEGIA_PERDENDO_ATIVA: return
    if periodo not in PERIODOS_PERD: return
    if sh == sa: return
    diff = abs(sh - sa)
    if diff < DIFF_MIN_PERD: return

    if sh < sa:
        nick_alvo = na; pts_atual = sh
        mid_total = MKT_TOTAL_HOME; mid_q4 = MKT_Q4_HOME
    else:
        nick_alvo = nb; pts_atual = sa
        mid_total = MKT_TOTAL_AWAY; mid_q4 = MKT_Q4_AWAY

    if not nick_alvo: return

    mn = ev.get("matchName", "")
    if nick_alvo in BLACKLIST_PERD:
        log_scan(f"{mn} | PERD blacklist {nick_alvo}")
        return
    opp = nb if nick_alvo == na else na
    if frozenset({nick_alvo, opp}) in H2H_TOXICOS_PERD:
        log_scan(f"{mn} | PERD H2H toxico {nick_alvo} vs {opp}")
        return

    await _processar_q4_lado(
        ctx, api, ev, jg, sh, sa, periodo, na, nb,
        modo="PERD",
        nick_alvo=nick_alvo, pts_atual_total=pts_atual,
        mid_total=mid_total, mid_q4=mid_q4,
        usar_total=USAR_TOTAL_PARTIDA_PERD, usar_q4=USAR_PTS_Q4_PERD,
        line_min=LINE_ABOVE_MIN_PERD, line_max=LINE_ABOVE_MAX_PERD,
        pct_estrat=PCT_PERD, teto_estrat=TETO_PERD,
        stake_max_jogo_fn=stake_max_jogo_perd,
        max_apostas_total=MAX_APOSTAS_TOTAL_PERD, max_apostas_q4=MAX_APOSTAS_Q4_PERD,
        fator_overask=FATOR_OVERASK_PERD, max_tent=MAX_TENTATIVAS_OVERASK_PERD,
        apostadas_set_attr="perd_apostadas", stake_attr="perd_stake",
    )


# ==================== ESTRATEGIA 4: HC ZEBRA (processamento) ====================
async def _hc_descobrir(jg, na, nb):
    """Descoberta 1x por jogo (roda em BACKGROUND pra nao travar o scan):
    resolve o par no TipManager, puxa o H2H e calcula as linhas-alvo."""
    mn = jg.match_name
    try:
        if _TM is None or not _TM.ids:
            jg.hc_tm_retry_apos = _time.time() + HC_TM_RETRY_S
            return
        res_a = (na or "").strip().lower() in _TM.ids
        res_b = (nb or "").strip().lower() in _TM.ids
        if not (res_a and res_b):
            jg.hc_tm_status = "sem_alvo"
            jg.hc_targets = {na: {}, nb: {}}
            log_ev(f"[HC] IGNORADO {na}x{nb}: nick fora do TipManager t{'+'.join(map(str, TM_TIDS))} "
                   f"[{na}={'ok' if res_a else 'X'} {nb}={'ok' if res_b else 'X'}]")
            return
        h2h = await _TM.h2h(na, nb)
        if not h2h:
            jg.hc_tm_retry_apos = _time.time() + HC_TM_RETRY_S
            log_scan(f"{mn} | HC h2h ainda nao veio (TM lento) - retento em {HC_TM_RETRY_S}s")
            return
        nn = TipManager.n(h2h)
        if nn < HC_MIN_PARTIDAS:
            jg.hc_tm_status = "sem_alvo"
            jg.hc_targets = {na: {}, nb: {}}
            jg.hc_h2h = h2h
            log_ev(f"[HC] {na}x{nb}: H2H com {nn} jogos (<{HC_MIN_PARTIDAS}) - sem alvos")
            return
        targets = calcular_targets_hc(h2h, na, nb, getattr(jg, "tid", 0))
        jg.hc_targets = targets
        jg.hc_h2h = h2h
        alvos = {k: sorted(v) for k, v in targets.items() if v}
        if alvos:
            jg.hc_tm_status = "ok"
            tot = sum(len(v) for v in alvos.values())
            mn_l = min(min(v) for v in alvos.values())
            mx_l = max(max(v) for v in alvos.values())
            log_ev(f"[HC] NOVO JOGO {na}x{nb} - n={nn} - {tot} alvos ({mn_l:g}-{mx_l:g}) - {alvos}")
        else:
            jg.hc_tm_status = "sem_alvo"
            log_ev(f"[HC] NOVO JOGO {na}x{nb} - n={nn} - sem alvos (WR<{HC_WR_MIN:.0%} ou blacklist)")
    except Exception as e:
        jg.hc_tm_retry_apos = _time.time() + HC_TM_RETRY_S
        log_ev(f"[HC] descobrir exc {na}x{nb}: {type(e).__name__}: {str(e)[:80]}")
    finally:
        jg.hc_tm_task = None


async def processar_hc_zebra(ctx, api, ev, jg, sh, sa, periodo, na, nb):
    """ESTRATEGIA 4 (TESTE): HC FT zebra via TipManager, stake FIXA (HC_STAKE_TESTE).
    Aposta SO o lado + quando uma linha-alvo abre ATIVA no mkt 200585."""
    if not ESTRATEGIA_HC_ATIVA:
        return
    if PAUSADO or EMERGENCIA:
        return
    if not na or not nb:
        return
    eid = ev.get("eventId")
    mn = ev.get("matchName", "")

    # Par toxico: corta o jogo inteiro (log 1x)
    if frozenset({na, nb}) in BLACKLIST_HC_PARES:
        if "par_toxico" not in jg.hc_log_flags:
            jg.hc_log_flags.add("par_toxico")
            log_ev(f"[HC] skip par toxico: {na}x{nb}")
        return

    # TipManager fora/carregando: espera (e re-boota sozinho de tempos em tempos)
    if not _tm_pronto():
        if (not _TM_BOOTANDO) and (_time.time() - _TM_ULTIMA_TENTATIVA > HC_TM_REBOOT_S):
            asyncio.create_task(_tm_boot())
        if "tm_off" not in jg.hc_log_flags:
            jg.hc_log_flags.add("tm_off")
            log_scan(f"{mn} | HC aguardando TipManager (login/players)")
        return

    # Descoberta (1x por jogo, em background)
    if jg.hc_tm_status == "pendente":
        if jg.hc_tm_task is None and _time.time() >= jg.hc_tm_retry_apos:
            jg.hc_tm_task = asyncio.create_task(_hc_descobrir(jg, na, nb))
        return
    if jg.hc_tm_status != "ok":
        return

    targets = jg.hc_targets or {}
    if not any(targets.values()):
        return
    if len(jg.hc_apostadas) >= HC_MAX_LINHAS_JOGO:
        return
    stake_max_jogo = stake_max_jogo_hc()
    if jg.hc_stake >= stake_max_jogo:
        return

    odds = ev.get("odds") or []
    agora = _time.time()
    for o in odds:
        try:
            if o.get("marketId") != MKT_HC_FT:
                continue
            if o.get("status") != "active":
                continue
            nk, signed = parse_hc_outcome(o)
            if nk is None or signed is None:
                continue
            if signed <= 0:
                continue                     # so o lado + (zebra)
            line = signed
            tgt = targets.get(nk, {})
            aprov_ids = tgt.get(line)
            if not aprov_ids:
                continue
            if (nk, line) in jg.hc_apostadas:
                continue
            if jg.hc_cooldown.get((nk, line), 0) > agora:
                continue
            # ---- FOLGA (v12): so entra se o lado apostado JA cobre por HC_FOLGA_MIN ----
            try:
                _sh, _sa = int(sh), int(sa)
            except (TypeError, ValueError):
                log_scan(f"{mn} | HC {nk}+{line:g}: placar indisponivel ({sh}-{sa}) - folga incalculavel, pulo")
                continue
            if nk == na:
                _deficit = _sa - _sh
            elif nk == nb:
                _deficit = _sh - _sa
            else:
                log_scan(f"{mn} | HC {nk}: nick nao casa com {na}/{nb} - pulo")
                continue
            _folga = line - _deficit
            aprov_vivas = [e for e in ESTRATEGIAS_HC
                           if e["id"] in aprov_ids
                           and (e["folga_min"] is None or _folga >= e["folga_min"])
                           and jg.hc_cont_estr.get(e["id"], 0) < e["teto"]]
            if not aprov_vivas:
                log_scan(f"{mn} | HC {nk}+{line:g}: sem estrategia viva (folga {_folga:g}, tetos {jg.hc_cont_estr}) - aguardo")
                continue
            rotulo = "+".join(str(e["id"]) for e in aprov_vivas)
            price = o.get("price", 0)
            if not price or price < HC_ODD_MIN or price > HC_ODD_MAX:
                log_scan(f"{mn} | HC {nk}+{line:g} odd {price} fora [{HC_ODD_MIN},{HC_ODD_MAX}]")
                continue
            if len(jg.hc_apostadas) >= HC_MAX_LINHAS_JOGO:
                log_ev(f"LIMITE HC: {mn} {len(jg.hc_apostadas)}/{HC_MAX_LINHAS_JOGO} linhas, parando")
                break
            if jg.hc_stake >= stake_max_jogo:
                log_ev(f"LIMITE HC: {mn} R${jg.hc_stake:.2f}/R${stake_max_jogo:.2f}, parando")
                break

            stake = HC_STAKE_TESTE
            limite_casa = _LIMITE_CASA.get("HC", 0.0)
            if limite_casa > 0:
                stake = min(stake, limite_casa)
            if stake < STAKE_MIN_VIAVEL_GLOBAL:
                log_ev(f"[HC] stake R${stake:.2f} < min viavel R${STAKE_MIN_VIAVEL_GLOBAL:.2f} - pulando")
                break

            p10 = TipManager.pct(jg.hc_h2h, nk, line, janela="last_10")
            p30 = TipManager.pct(jg.hc_h2h, nk, line, janela="last_30")
            log_ev(f"TRIGGER HC[{rotulo}]: {mn} {sh}-{sa} per={periodo} >> {nk} +{line:g} @{price} "
                   f"ult10={(p10 or 0):.0%} ult30={(p30 or 0):.0%} folga={_folga:g} stake=R${stake:.2f}")
            jg.hc_apostadas.add((nk, line))
            validador = _hc_criar_validador(nk, set(tgt.keys()))
            try:
                ok, ret, stake_real = await asyncio.wait_for(
                    apostar_com_overask(ctx, api, eid, o, stake,
                                        FATOR_OVERASK_HC, MAX_TENTATIVAS_OVERASK_HC,
                                        STAKE_MIN_VIAVEL_GLOBAL,
                                        validar_odd_fn=validador),
                    timeout=30,
                )
            except asyncio.TimeoutError:
                ok, ret, stake_real = False, "timeout", 0.0
            except Exception as e:
                ok, ret, stake_real = False, f"exc {type(e).__name__}: {str(e)[:80]}", 0.0

            if ok:
                jg.hc_stake += stake_real
                for e in aprov_vivas:
                    jg.hc_cont_estr[e["id"]] = jg.hc_cont_estr.get(e["id"], 0) + 1
                _stats_registrar_ticket(stake_real)
                _hc_csv_registrar(rotulo, mn, nk, line, price, stake_real,
                                  p10, p30, _folga, f"{sh}-{sa}", ret)
                log_ev(f"  TICKET {ret} HC[{rotulo}] {nk} +{line:g} R${stake_real:.2f} "
                       f"(acum: {len(jg.hc_apostadas)}/{HC_MAX_LINHAS_JOGO} linhas, R${jg.hc_stake:.2f}, tetos {jg.hc_cont_estr})")
                if HC_TG_POR_APOSTA:
                    asyncio.create_task(tg_send(
                        f"\U0001f993 <b>APOSTADO - HC [{rotulo}]</b>\n"
                        f"{divisor()}\n"
                        f"<b>{nk} +{line:g}</b> @ <b>{price}</b> - R${stake_real:.2f}\n"
                        f"\U0001f3c0 {mn}\n"
                        f"\U0001f4ca {sh}-{sa} - {periodo}\n"
                        f"\U0001f4c8 Ult10 {(p10 or 0):.0%} Ult30 {(p30 or 0):.0%} - folga {_folga:g} - \U0001f9fe {ret}"
                    ))
            else:
                log_ev(f"  X HC {nk}+{line:g}: {ret}")
                jg.hc_apostadas.discard((nk, line))
                jg.hc_cooldown[(nk, line)] = _time.time() + HC_RETRY_COOLDOWN_S
        except Exception as e:
            log_ev(f"[HC] proc odd exc: {type(e).__name__}: {str(e)[:80]}")
            continue


async def _mikedb_postar_odd(ctx, api, d, odd, stake):
    """Posta UMA odd especifica na Superbet (1 shot). Reaproveita montar_body,
    cookies e o POST do overask, mas SEM re-buscar por uuid (quem re-acha por
    linha e o chamador). Trata overask/limitacao (ajusta stake e sinaliza), e
    devolve (ok, ticket_ou_motivo, stake_real). Usa APOSTA_LOCK pra serializar
    com as outras apostas (uma por vez na conta). NUNCA levanta."""
    global _COUNT_OVERASK, PRECISA_TROCAR_CONTA, _OVERASK_AVISADO
    try:
        try:
            await asyncio.wait_for(APOSTA_LOCK.acquire(), timeout=APOSTA_FILA_TIMEOUT)
        except asyncio.TimeoutError:
            return False, "fila cheia", 0.0
        try:
            stake_atual = stake
            if stake_atual < STAKE_MIN_VIAVEL_GLOBAL:
                return False, "stake < min", 0.0
            body = montar_body(d, odd, stake_atual)
            if not body:
                return False, "erro montar body", 0.0
            try:
                cookies_list = await ctx.cookies([
                    "https://superbet.bet.br",
                    "https://api.web.production.betler.superbet.bet.br",
                ])
                cookies = {c["name"]: c["value"] for c in cookies_list}
            except Exception:
                cookies = {}
            headers = {
                "accept": "application/json, text/plain, */*",
                "content-type": "application/json",
                "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                              "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
                "referer": "https://superbet.bet.br/",
                "origin": "https://superbet.bet.br",
                "sec-ch-ua-platform": '"Windows"',
                "sec-ch-ua-mobile": "?0",
                "sec-ch-ua": '"Google Chrome";v="147", "Not.A/Brand";v="8", "Chromium";v="147"',
            }
            async with httpx.AsyncClient(timeout=15, cookies=cookies) as c:
                resp = await c.post(SB_BET_URL, headers=headers, json=body)
                try:
                    j = resp.json()
                except Exception:
                    return False, f"AMBIGUO:resp nao-json status={resp.status_code}", 0.0
                if not j.get("error"):
                    ticket = j.get("data", {}).get("ticketId", "?")
                    return True, ticket, stake_atual
                err = j.get("errorCode", "")
                note = j.get("notice", "")
                # overask/limitacao: memoriza teto de HC e sinaliza; o chamador re-tenta
                if detecta_overask(err, note):
                    max_stake = extrair_max_stake(j)
                    if max_stake and max_stake >= STAKE_MIN_LIMITADO:
                        _LIMITE_CASA["HC"] = max_stake
                        log_ev(f"  [mikedb] AJUSTE: casa aceita R${max_stake} (memoria HC)")
                        return False, f"overask ajuste max={max_stake}", 0.0
                    _COUNT_OVERASK += 1
                    _registrar_limitacao_atual()
                    if _COUNT_OVERASK >= THRESHOLD_OVERASK_TROCA:
                        PRECISA_TROCAR_CONTA = True
                    log_ev(f"  [mikedb] LIMITADO max={max_stake} (count={_COUNT_OVERASK}/{THRESHOLD_OVERASK_TROCA})")
                    return False, f"limitado max={max_stake}", 0.0
                # odd mudou/fechou: sinaliza pro chamador re-achar por linha
                if err in ("oddNotActive", "oddsChanged", "priceChanged", "marketClosed"):
                    return False, f"{err}", 0.0
                # CUPOM NEGADO / customerRejected: quando a conta LIMITA, a Superbet
                # rejeita os cupons com esse erro (nao com "maxstake"). Trata como
                # limitacao pra disparar a troca de conta. So troca ao REPETIR
                # (THRESHOLD) - um cupom negado isolado (odd) nao troca a conta a toa.
                _s_err = (str(err) + " " + str(note)).lower()
                if ("customerrejected" in _s_err or "cupom" in _s_err
                        or "negad" in _s_err or "rejected" in _s_err):
                    _COUNT_OVERASK += 1
                    _registrar_limitacao_atual()
                    if _COUNT_OVERASK >= THRESHOLD_OVERASK_TROCA:
                        PRECISA_TROCAR_CONTA = True
                    log_ev(f"  [mikedb] CUPOM NEGADO (prov. conta limitada) "
                           f"count={_COUNT_OVERASK}/{THRESHOLD_OVERASK_TROCA}"
                           + (" -> TROCAR CONTA" if PRECISA_TROCAR_CONTA else ""))
                    return False, "cupom negado (limitacao?)", 0.0
                # sessao morta: registra E conta pro threshold (sessao caindo repetido
                # tambem deve trocar de conta, nao so relogar em loop).
                if "session" in (err or "").lower() and "valid" in (err or "").lower():
                    _COUNT_OVERASK += 1
                    _registrar_limitacao_atual()
                    if _COUNT_OVERASK >= THRESHOLD_OVERASK_TROCA:
                        PRECISA_TROCAR_CONTA = True
                    log_ev(f"  [mikedb] sessionNotValid count={_COUNT_OVERASK}/{THRESHOLD_OVERASK_TROCA}"
                           + (" -> TROCAR CONTA" if PRECISA_TROCAR_CONTA else ""))
                    return False, f"{err}", 0.0
                return False, f"{err}: {note}"[:100], 0.0
        finally:
            APOSTA_LOCK.release()
    except Exception as e:
        # AMBIGUO (padrao do botbetsson3): timeout/erro de rede NAO prova que a aposta
        # nao entrou - ela pode ter landado no servidor. Prefixo AMBIGUO: faz o chamador
        # NUNCA re-tentar (evita APOSTA DUPLA com dinheiro real).
        return False, f"AMBIGUO:exc {type(e).__name__}: {str(e)[:50]}", 0.0


async def _handler_tip_imediata(aposta_id: int):
    """Chamado NA HORA que o NOTIFY aposta_nova chega (via callback do braco),
    sem esperar o loop principal/scan. Faz o claim da tip e aposta imediatamente.
    Isso corta a latencia: antes a tip esperava o ciclo dar a volta (o scan_adriatic
    no meio podia atrasar 1-2s); agora aposta assim que o sinal chega.
    BLINDADO: qualquer falha vira log e nao derruba nada. Usa _CTX_REF/_API_REF
    (setados no loop). Se ainda nao ha api/ctx (boot), a fila+poll pega depois."""
    global _API_REF, _CTX_REF
    try:
        if not _MIKEDB_OK or _mikedb is None:
            return
        ctx = _CTX_REF
        api = _API_REF
        if ctx is None or api is None:
            # boot ainda: deixa a tip pra fila (o poll de seguranca pega)
            try:
                _mikedb.ESTADO.tips_pendentes.put_nowait(aposta_id)
            except Exception:
                pass
            return
        # nao aposta se o bot nao esta operando
        if PAUSADO or EMERGENCIA or AGUARDANDO_CONTA or PRECISA_TROCAR_CONTA:
            try:
                _mikedb.ESTADO.tips_pendentes.put_nowait(aposta_id)  # tenta de novo depois
            except Exception:
                pass
            return
        tip = await _mikedb.claim_uma(aposta_id)
        if not tip:
            return   # outro claim pegou, ou bot nao autorizado, ou tip velha
        _t0 = _time.monotonic()
        try:
            _ok, _det = await executar_tip_mikedb(ctx, api, tip)
        except Exception as _e:
            _ok, _det = False, f"exc {type(_e).__name__}"
            log_ev(f"[mikedb] handler exec err: {str(_e)[:80]}")
        _lat = (_time.monotonic() - _t0) * 1000
        if _ok:
            _mikedb.ESTADO.total_apostadas += 1
            log_ev(f"[mikedb] IMEDIATO ok em {_lat:.0f}ms")
        else:
            _mikedb.ESTADO.total_ignoradas += 1
        try:
            await _mikedb.marcar_resultado_execucao(aposta_id, _ok, _det)
        except Exception:
            pass
    except Exception as e:
        try:
            log_ev(f"[mikedb] handler imediato exc: {type(e).__name__}: {str(e)[:80]}")
        except Exception:
            pass


async def executar_tip_mikedb(ctx, api, tip: dict):
    """Executa UMA tip vinda da MikeDB (bot autorizado) na Superbet, com o motor
    de aposta que ja existe (apostar_com_overask). A tip ja passou pelo claim
    atomico e pelo filtro de bot autorizado no modulo mikedb_sinais.

    A ODD e RELIDA FRESCA da Superbet no momento da execucao (a odd que a MikeDB
    gravou e passado; no vivo a linha anda). So aposta o lado ZEBRA (handicap +).

    BLINDADO: qualquer falha vira log + reporte e NAO derruba o loop. Retorna
    (ok, detalhe)."""
    aid = tip.get("id")
    eid = tip.get("event_id")
    linha_tip = tip.get("linha")
    selecao = str(tip.get("selecao") or "")
    motivo = str(tip.get("motivo") or "")
    try:
        if not eid or linha_tip is None:
            return False, "tip sem event_id/linha"
        try:
            linha_alvo = float(linha_tip)
        except (TypeError, ValueError):
            return False, f"linha invalida {linha_tip!r}"

        # Guardas de estado: nao aposta se o bot nao esta operando
        if PAUSADO or EMERGENCIA or AGUARDANDO_CONTA or PRECISA_TROCAR_CONTA:
            return False, "bot nao-operando (pausa/emergencia/troca)"

        # 1) Buscar o evento fresco na Superbet pelo event_id da tip
        try:
            r = await asyncio.wait_for(
                api.get(f"{SB_API}/v2/pt-BR/events/{eid}", timeout=8), timeout=10)
            ev = (r.json() or {}).get("data") if r.status_code == 200 else None
            if isinstance(ev, list):
                ev = ev[0] if ev else None
        except Exception as e:
            return False, f"evento nao carregou: {str(e)[:60]}"
        if not ev:
            return False, f"evento {eid} nao encontrado na Superbet"

        mn = ev.get("matchName", "")
        na, nb = parse_nicks(mn)

        # 2) Achar a odd de HC FT da linha alvo (lado zebra +). Helper re-usavel:
        #    a Superbet TROCA o uuid quando a odd se move, entao a cada tentativa a
        #    gente re-acha a odd ATIVA pela LINHA (uuid fresco) em vez de insistir no
        #    uuid velho (que da oddNotActive). Essa e a causa raiz do "esgotou tent".
        def _achar_odd_linha(ev_dict):
            for oo in (ev_dict.get("odds") or []):
                if oo.get("marketId") != MKT_HC_FT:
                    continue
                if oo.get("status") != "active":
                    continue
                nk2, signed2 = parse_hc_outcome(oo)
                if nk2 is None or signed2 is None or signed2 <= 0:
                    continue
                if abs(signed2 - linha_alvo) > 0.01:
                    continue
                if selecao and nk2 and nk2.upper() not in selecao.upper() and selecao.upper() not in (nk2 or "").upper():
                    continue
                return oo, nk2
            return None, None

        o, nk = _achar_odd_linha(ev)
        if o is None:
            return False, f"odd HC linha {linha_alvo:g} nao disponivel agora em {mn}"
        line = linha_alvo
        price0 = o.get("price", 0)
        if not price0 or price0 < HC_ODD_MIN or price0 > HC_ODD_MAX:
            return False, f"odd {price0} fora [{HC_ODD_MIN},{HC_ODD_MAX}]"

        # 3) Stake
        stake = float(_mikedb.STAKE_SINAL) if _mikedb else 50.0
        limite_casa = _LIMITE_CASA.get("HC", 0.0)
        if limite_casa > 0:
            stake = min(stake, limite_casa)
        if stake < STAKE_MIN_VIAVEL_GLOBAL:
            return False, f"stake R${stake:.2f} < min viavel"

        log_ev(f"[mikedb] TIP bot={tip.get('bot_id')} id={aid} >> {nk} +{line:g} @{price0} "
               f"R${stake:.2f}  ({mn})  motivo: {motivo[:60]}")

        # 4) Loop de aposta com RE-ACHADO por linha (resolve oddNotActive na raiz).
        #    A cada tentativa pega evento fresco, re-acha a odd ATIVA da linha (uuid
        #    novo) e posta 1 shot via _mikedb_postar_odd. Aceita a odd nova da MESMA
        #    linha - nao insiste no uuid morto. Mais tentativas que o overask padrao.
        # ORCAMENTO DE TEMPO (padrao do sporty1) em vez de N tentativas fixas: enquanto
        # a linha ainda for alvo e couber no orcamento, re-tenta com odd fresca. Da MAIS
        # chances numa odd que oscila do que um contador fixo baixo.
        MIKEDB_BUDGET_S = 6.0        # teto de tempo por tip (cede a vez depois disso)
        MIKEDB_ESPERA_S = 0.15       # micro-espera entre tentativas (era 0.25)
        MIKEDB_TENT_TETO = 12        # trava de seguranca (nunca loop infinito)
        _t_ini = _time.monotonic()
        ok, ret, stake_real, price = False, "", 0.0, price0
        _t = 0
        try:
            while True:
                _t += 1
                if _t > MIKEDB_TENT_TETO or (_time.monotonic() - _t_ini) > MIKEDB_BUDGET_S:
                    if not ok:
                        ret = ret or f"esgotou orcamento {MIKEDB_BUDGET_S:g}s ({_t-1} tent)"
                    break
                if _t == 1:
                    ev_fresh = ev
                else:
                    try:
                        _r = await asyncio.wait_for(
                            api.get(f"{SB_API}/v2/pt-BR/events/{eid}", timeout=4), timeout=5)
                        _d = (_r.json() or {}).get("data") if _r.status_code == 200 else None
                        if isinstance(_d, list):
                            _d = _d[0] if _d else None
                        ev_fresh = _d or ev
                    except Exception:
                        ev_fresh = ev
                o_fresh, nk_fresh = _achar_odd_linha(ev_fresh)
                if o_fresh is None:
                    await asyncio.sleep(MIKEDB_ESPERA_S)
                    continue
                price = o_fresh.get("price", 0) or price
                if price < HC_ODD_MIN or price > HC_ODD_MAX:
                    return False, f"odd {price} fora [{HC_ODD_MIN},{HC_ODD_MAX}]"
                # guarda de estado a cada volta: se o bot saiu de operacao no meio
                # (limitou/troca/pausa), para de martelar.
                if PAUSADO or EMERGENCIA or AGUARDANDO_CONTA or PRECISA_TROCAR_CONTA:
                    return False, "bot saiu de operacao no meio da tentativa"
                ok, ret, stake_real = await asyncio.wait_for(
                    _mikedb_postar_odd(ctx, api, ev_fresh, o_fresh, stake), timeout=20)
                if ok:
                    break
                # AMBIGUO: a aposta PODE ter entrado (timeout/rede). NUNCA re-tenta.
                if isinstance(ret, str) and ret.startswith("AMBIGUO:"):
                    log_ev(f"  [mikedb] AMBIGUO - NAO re-tento (pode ter entrado): {ret[:70]}")
                    return False, ret
                # limitacao ja tratada no postar_odd: se disparou troca, para aqui
                if PRECISA_TROCAR_CONTA:
                    return False, ret or "limitado (troca de conta)"
                await asyncio.sleep(MIKEDB_ESPERA_S)
        except asyncio.TimeoutError:
            return False, "timeout na aposta"
        except Exception as e:
            return False, f"aposta exc {type(e).__name__}: {str(e)[:60]}"

        if ok:
            _stats_registrar_ticket(stake_real)
            try:
                _hc_csv_registrar(f"MIKEDB:{tip.get('bot_id')}", mn, nk, line, price,
                                  stake_real, None, None, 0.0, "", ret)
            except Exception:
                pass
            if HC_TG_POR_APOSTA:
                asyncio.create_task(tg_send(
                    f"\U0001f993 <b>APOSTADO - MIKEDB (bot {tip.get('bot_id')})</b>\n"
                    f"{divisor()}\n"
                    f"<b>{nk} +{line:g}</b> @ <b>{price}</b> - R${stake_real:.2f}\n"
                    f"\U0001f3c0 {mn}\n"
                    f"\U0001f9fe {ret}\n"
                    f"<i>{motivo[:80]}</i>"
                ))
            log_ev(f"[mikedb] TICKET {ret}: {nk} +{line:g} R${stake_real:.2f}")
            return True, f"green_ticket {ret}"
        else:
            log_ev(f"[mikedb] X aposta {nk}+{line:g}: {ret}")
            return False, str(ret)[:100]
    except Exception as e:
        log_ev(f"[mikedb] executar_tip exc id={aid}: {type(e).__name__}: {str(e)[:80]}")
        return False, f"exc {type(e).__name__}"


# ==================== MAIN ====================
async def _boot_logar_qualquer_conta(page, ctx) -> bool:
    """Tenta logar com a conta atual. Se falhar, itera pela pool inteira tentando outras.
    Retorna True se algum login deu OK, False se a pool inteira falhou.
    Em caso de False, deixa o bot em estado AGUARDANDO_CONTA (nao mata o processo)."""
    global _CONTA_IDX, _CONTA_LOGIN_TS, _CONTA_PRIMEIRA_LIMITACAO
    global POOL_ESGOTADA, AGUARDANDO_CONTA, PAUSADO, MOTIVO_PAUSA, PAUSADO_ATE

    if not CONTAS:
        log_ev("[boot] CONTAS vazio!")
        AGUARDANDO_CONTA = True
        POOL_ESGOTADA = True
        PAUSADO = True
        MOTIVO_PAUSA = "AGUARDANDO_CONTA (CONTAS vazio)"
        await tg_send(
            f"🟡 <b>POOL VAZIA NO BOOT</b>\n"
            f"<b>BOT EM ESPERA</b>\n"
            f"<i>use /addconta user pass</i>"
        )
        return False

    # Quantas contas vamos tentar no maximo: todas as ativas + folga de 1
    n_ativas = sum(1 for c in CONTAS if c.get("ativo", True))
    max_tent = n_ativas + 1
    tent = 0

    while tent < max_tent:
        tent += 1

        # Pula contas inativas
        if not conta_ativa().get("ativo", True):
            prox = _proxima_conta_idx(skip_atual=True)
            if prox is None:
                break
            _CONTA_IDX = prox
            _accounts_sync_to_disk()
            continue

        try: await fechar_todos_modais(page)
        except Exception: pass

        if await checar_login(page):
            _CONTA_LOGIN_TS = _time.time()
            _CONTA_PRIMEIRA_LIMITACAO = 0.0
            _stats_registrar_conta_nova(str(USUARIO))
            log_ev(f"[boot] ja estava logado em {USUARIO}")
            return True

        user_atual = str(USUARIO)
        log_ev(f"[boot] tentando login: {user_atual} (tentativa {tent}/{max_tent})")
        ok = await fazer_login(page)
        if ok:
            log_ev(f"[boot] login OK: {user_atual}")
            return True

        # Falhou: incrementa falha_login_count, desativa se passou do limite
        log_ev(f"[boot] login falhou: {user_atual}")
        try:
            falhas = conta_ativa().get("falha_login_count", 0)
            if falhas >= MAX_FALHAS_LOGIN_POR_CONTA:
                conta_ativa()["ativo"] = False
                log_ev(f"[boot] {user_atual} auto-desativada ({falhas} falhas)")
                await tg_send(
                    f"❌ <b>CONTA AUTO-DESATIVADA NO BOOT</b>\n"
                    f"<code>{user_atual}</code> ({falhas} falhas)"
                )
                _accounts_sync_to_disk()
        except Exception: pass

        # Procura proxima conta ativa
        prox = _proxima_conta_idx(skip_atual=True)
        if prox is None:
            log_ev("[boot] sem mais contas ativas pra tentar")
            break

        # Limpa storage antes de tentar a proxima
        await tg_send(
            f"⚠️ falha login boot: <code>{user_atual}</code>\n"
            f"tentando proxima: <code>{CONTAS[prox]['user']}</code>"
        )
        try:
            await _logout_e_limpar_storage(page, ctx)
        except Exception as e:
            log_ev(f"[boot] limpeza storage err (segue): {str(e)[:80]}")

        _CONTA_IDX = prox
        _accounts_sync_to_disk()
        try:
            await page.goto(f"{SB_HOME}/", wait_until="domcontentloaded", timeout=30000)
            await asyncio.sleep(2)
        except Exception: pass

    # Esgotou: entra em AGUARDANDO_CONTA
    log_ev("[boot] POOL ESGOTADA no boot - entrando em AGUARDANDO_CONTA")
    POOL_ESGOTADA = True
    AGUARDANDO_CONTA = True
    PAUSADO = True
    PAUSADO_ATE = 0.0
    MOTIVO_PAUSA = "AGUARDANDO_CONTA (pool esgotada no boot)"
    await tg_send(
        f"🟡 <b>POOL ESGOTADA NO BOOT</b>\n"
        f"{divisor()}\n"
        f"😱 {USER_NAME}, nenhuma conta da pool conseguiu logar\n"
        f"\n"
        f"⏸️ <b>BOT EM ESPERA</b> <i>(NAO encerrou)</i>\n"
        f"\n<b>pra tentar de novo:</b>\n"
        f"<code>/addconta user pass</code>\n"
        f"<code>/senha user nova_senha</code> (reativa conta existente)"
    )
    return False


def _is_cdp_dead(exc: Exception) -> bool:
    """Detecta se a excecao indica que o CDP/Chrome morreu e precisa reconectar."""
    name = type(exc).__name__
    msg = str(exc).lower()
    # Erros tipicos do playwright quando Chrome cai
    sinais_nome = (
        "TargetClosedError",
        "BrowserClosedError",
        "ConnectionRefusedError",
        "ConnectionResetError",
        "ConnectionError",
    )
    if any(s.lower() in name.lower() for s in sinais_nome):
        return True
    sinais_msg = (
        "target page, context or browser has been closed",
        "browser has been closed",
        "browser closed",
        "websocket closed",
        "connection refused",
        "connection reset",
        "playwright is not connected",
        "the browser is not connected",
        "page, context or browser has been closed",
    )
    return any(s in msg for s in sinais_msg)


async def main():
    global _BANCA_ATUAL, _BANCA_INICIAL, _BANCA_TS
    global _PAGE_REF, _CTX_REF, _JOGOS_REF
    global PRECISA_TROCAR_CONTA
    global _CONTA_LOGIN_TS, _CONTA_PRIMEIRA_LIMITACAO
    global PAUSADO, PAUSADO_ATE, MOTIVO_PAUSA

    _accounts_init()

    log_ev("=" * 70)
    log_ev("SUPERMAE - 4 ESTRATEGIAS (FT/VENC/PERD/HC) + JUROS COMPOSTOS + TG + POOL DINAMICO")
    log_ev("-" * 70)
    log_ev(f"POOL: {len(CONTAS)} contas total, {sum(1 for c in CONTAS if c.get('ativo', True))} ativas")
    if CONTAS:
        log_ev(f"Conta inicial: {USUARIO} (idx={_CONTA_IDX})")
    else:
        log_ev(f"<sem contas> - bot vai entrar em AGUARDANDO_CONTA")
        log_ev(f"             use /addconta user pass no Telegram pra comecar")
    log_ev(f"COOLDOWN: ativo={COOLDOWN_ATIVO} janela={COOLDOWN_JANELA} limite={COOLDOWN_LIMITE_HORAS}h pausa={COOLDOWN_PAUSA_SEG/60:.0f}min")
    log_ev(f"EMERGENCIA: dom_fail={LIMITE_DOM_FAIL} login_fail={LIMITE_LOGIN_FAIL}")
    log_ev("-" * 70)
    log_ev(f"JUROS_COMPOSTOS_ATIVO = {JUROS_COMPOSTOS_ATIVO}")
    if JUROS_COMPOSTOS_ATIVO:
        log_ev(f"  FT:   {PCT_FT*100:.1f}% banca, teto stake R${TETO_FT} (jogo: stake×{MULT_JOGO_FT}, teto abs R${TETO_ABS_JOGO_FT})")
        log_ev(f"  VENC: {PCT_VENC*100:.1f}% banca, teto stake R${TETO_VENC} (jogo: stake×{MULT_JOGO_VENC}, teto abs R${TETO_ABS_JOGO_VENC})")
        log_ev(f"  PERD: {PCT_PERD*100:.1f}% banca, teto stake R${TETO_PERD} (jogo: stake×{MULT_JOGO_PERD}, teto abs R${TETO_ABS_JOGO_PERD})")
    log_ev(f"HC ZEBRA (TESTE): {'ON' if ESTRATEGIA_HC_ATIVA else 'OFF'} - stake FIXA R${HC_STAKE_TESTE:.2f} - "
           f"MULTI {HC_ROTULO_BOOT} - CSV {HC_CSV_ARQ.name} - "
           f"max {HC_MAX_LINHAS_JOGO} linhas/jogo - mkt {MKT_HC_FT}")
    log_ev("-" * 70)
    log_ev(f"Comandos TG: /saldo /status /stats /refresh /stop /help")
    log_ev(f"             /pausar /retomar /trocar /relogar")
    log_ev(f"             /stake /teto /maxjogo /banca /juros /estrat /cooldown")
    log_ev(f"             /addconta /senha /rmconta /listcontas /limpar")
    log_ev("=" * 70)

    state = _carrega_banca_state()
    if state and state.get("conta") == str(USUARIO):
        _BANCA_ATUAL = float(state.get("banca_atual", 0.0))
        _BANCA_INICIAL = float(state.get("banca_inicial", 0.0))
        _BANCA_TS = float(state.get("banca_ts", 0.0))
        log_ev(f"[banca] state: high-watermark R${_BANCA_ATUAL:,.2f} (inicial R${_BANCA_INICIAL:,.2f})")

    _stats_check_reset()
    _STATS_DIA["banca_inicial_dia"] = _BANCA_ATUAL

    if CONTAS:
        s = saudacao()
        msg_inicial = (
            f"{s}\n"
            f"\n"
            f"🤖 <b>SUPERMAE ONLINE</b>\n"
            f"{divisor()}\n"
            f"👤 conta: <code>{USUARIO}</code> ({_CONTA_IDX+1}/{len(CONTAS)})\n"
            f"💰 banca state: R${_BANCA_ATUAL:,.2f}\n"
            f"📈 juros compostos: {'✅ ON' if JUROS_COMPOSTOS_ATIVO else '❌ OFF'}\n"
            f"🎯 estrategias: {('FT ' if ESTRATEGIA_OVER_FT_ATIVA else '')}"
            f"{('VENC ' if ESTRATEGIA_VENCENDO_ATIVA else '')}"
            f"{('PERD ' if ESTRATEGIA_PERDENDO_ATIVA else '')}"
            f"{('HC[R$' + format(HC_STAKE_TESTE, '.0f') + ' teste]' if ESTRATEGIA_HC_ATIVA else '')}\n"
            f"{divisor()}\n"
            f"\n<i>bora trampar! 🚀  /help pra comandos</i>"
        )
    else:
        s = saudacao()
        msg_inicial = (
            f"{s}\n"
            f"\n"
            f"🟡 <b>SUPERMAE iniciado SEM CONTAS</b>\n"
            f"{divisor()}\n"
            f"⏳ aguardando voce adicionar uma conta\n"
            f"\n<b>pra comecar:</b>\n"
            f"<code>/addconta usuario senha</code>\n"
            f"\n<i>/help pra ver todos os comandos 🤖</i>"
        )
    asyncio.create_task(tg_send(msg_inicial))

    tg_task = asyncio.create_task(telegram_polling_loop())

    # TipManager (ESTRATEGIA HC): login+players em background (nao trava o boot)
    if ESTRATEGIA_HC_ATIVA:
        asyncio.create_task(_tm_boot())

    # BRACO DE SINAIS MikeDB: conecta no banco da MikeDB (outra VPS) e liga o
    # LISTEN. Best-effort: se falhar, o supermae segue pela via normal.
    if _MIKEDB_OK and _mikedb is not None:
        asyncio.create_task(_mikedb.iniciar(logger=log_ev))
        log_ev(f"[mikedb] braco de sinais: conectando (bots {list(_mikedb.BOTS_AUTORIZADOS)}, "
               f"stake R${_mikedb.STAKE_SINAL:.0f}, host {_mikedb._host_do_dsn()})")
    else:
        log_ev("[mikedb] braco de sinais DESLIGADO (modulo/asyncpg ausente)")

    jogos: dict[int, Jogo] = {}
    _JOGOS_REF = jogos
    ultimo_check_login = 0
    ultimo_guarda_sessao = 0.0
    _relog_backoff = 0.0
    ultimo_heartbeat = 0
    ultimo_refresh_banca = 0
    ciclo = 0
    # Anti-flood do loop interno: detecta mesmo erro repetindo e aumenta sleep
    erro_loop_anterior = ""
    erro_loop_streak = 0

    # ==================== WATCHDOG LOOP EXTERNO (CDP) ====================
    # Wrap externo: se o Chrome/CDP morre, reconecta sozinho a cada 30s.
    # O loop interno faz o trabalho real; ele so eh re-executado se CDP cair.
    consec_cdp_falhas = 0
    avisou_cdp_morto = False
    while not PARAR_BOT:
        try:
            async with async_playwright() as p:
                browser = await p.chromium.connect_over_cdp(f"http://localhost:{CDP_PORT}")
                ctx = browser.contexts[0]
                _CTX_REF = ctx
                page = await _get_superbet_page(ctx)
                _PAGE_REF = page
                log_ev(f"Aba ativa: {page.url}")
                consec_cdp_falhas = 0
                if avisou_cdp_morto:
                    avisou_cdp_morto = False
                    await tg_send(f"✅ <b>CDP reconectado</b>\nbot voltando ao normal")

                # ==================== BOOT RESILIENTE ====================
                # Tenta logar a conta atual; se falhar, tenta proxima da pool.
                # Se pool inteira falhar, entra em AGUARDANDO_CONTA e fica esperando /addconta.
                login_ok = await _boot_logar_qualquer_conta(page, ctx)
                if not login_ok:
                    # Pool esgotada no boot -> entra no loop ja em AGUARDANDO_CONTA,
                    # bot fica esperando /addconta retomar. NAO mata mais o processo.
                    log_ev("[boot] pool esgotada no boot, entrando em modo AGUARDANDO_CONTA")
                else:
                    log_ev("Logado OK")
                    await init_bet_config(page)
                    await asyncio.sleep(1.5)
                    valor_lido = await atualizar_banca(page, force=True)
                    if valor_lido is None and _BANCA_ATUAL == 0:
                        log_ev("[banca] AVISO: nao leu saldo inicial")
                        await tg_send(
                            f"⚠️ <b>BANCA NAO LIDA NO BOOT</b>\n"
                            f"Bot vai usar TETO como stake ate conseguir ler.\n"
                            f"Verifique se ha saldo visivel no header."
                        )
                    ultimo_refresh_banca = _time.time()
                    if _STATS_DIA["banca_inicial_dia"] == 0 and _BANCA_ATUAL > 0:
                        _STATS_DIA["banca_inicial_dia"] = _BANCA_ATUAL

                # ==================== LOOP PRINCIPAL ====================
                async with httpx.AsyncClient(
                    timeout=10,
                    limits=httpx.Limits(max_connections=50, max_keepalive_connections=20),
                ) as api:
                    _API_REF = api   # expoe pro handler de execucao imediata
                    # Registra o handler que aposta a tip NA HORA que o NOTIFY chega
                    # (sem esperar o ciclo/scan). Latencia minima sinal->aposta.
                    if _MIKEDB_OK and _mikedb is not None:
                        _mikedb.set_exec_handler(_handler_tip_imediata)
                    while not PARAR_BOT:
                        try:
                            agora = _time.time()
                            ciclo += 1

                            if EMERGENCIA or PAUSADO or AGUARDANDO_CONTA:
                                # AGUARDANDO_CONTA sai automaticamente quando /addconta executar
                                # (a flag eh resetada pelo cmd_addconta + PRECISA_TROCAR_CONTA dispara troca)
                                if AGUARDANDO_CONTA and not PAUSADO:
                                    # /addconta ja desligou AGUARDANDO_CONTA, deixa o ciclo seguir
                                    pass
                                elif PAUSADO and not EMERGENCIA and PAUSADO_ATE > 0 and agora >= PAUSADO_ATE:
                                    log_ev("[pausa] tempo expirou, retomando")
                                    await tg_send(
                                        f"▶️ <b>BOT RETOMADO</b>\n"
                                        f"pausa expirou ({MOTIVO_PAUSA})"
                                    )
                                    PAUSADO = False
                                    PAUSADO_ATE = 0.0
                                    MOTIVO_PAUSA = ""
                                else:
                                    if agora - ultimo_heartbeat >= 60:
                                        ultimo_heartbeat = agora
                                        if EMERGENCIA:
                                            log_ev(f"[EMERGENCIA] {MOTIVO_EMERGENCIA} - aguardando /retomar")
                                        elif AGUARDANDO_CONTA:
                                            ativas = sum(1 for c in CONTAS if c.get("ativo", True))
                                            log_ev(f"[AGUARDANDO_CONTA] pool esgotada, {ativas} ativas - aguardando /addconta")
                                        else:
                                            if PAUSADO_ATE > 0:
                                                falta = max(0, PAUSADO_ATE - agora)
                                                log_ev(f"[PAUSADO] {MOTIVO_PAUSA} (restam {_fmt_dur(falta)})")
                                            else:
                                                log_ev(f"[PAUSADO] {MOTIVO_PAUSA} (manual)")
                                    await asyncio.sleep(5)
                                    continue

                            if PRECISA_TROCAR_CONTA:
                                async with APOSTA_LOCK:
                                    PRECISA_TROCAR_CONTA = False
                                    ok = await trocar_conta(page, ctx)
                                    _PAGE_REF = page
                                # POOL_ESGOTADA agora NAO mata o bot - vira AGUARDANDO_CONTA
                                # e o proprio loop ja trata isso no topo do ciclo.
                                if not ok and not EMERGENCIA and not AGUARDANDO_CONTA:
                                    log_ev("Falha na troca, vai cair em retry no proximo ciclo")
                                jogos.clear()
                                ultimo_check_login = _time.time()
                                ultimo_refresh_banca = _time.time()
                                continue

                            if agora - ultimo_heartbeat >= 20:
                                ultimo_heartbeat = agora
                                log_ev(f"heartbeat ciclo={ciclo} jogos={len(jogos)} banca=R${_BANCA_ATUAL:,.2f}"
                                       + (f" tm={'ok' if _tm_pronto() else 'OFF'}" if ESTRATEGIA_HC_ATIVA else "")
                                       + (f" {_mikedb.resumo()}" if (_MIKEDB_OK and _mikedb) else ""))

                            # ===== BRACO DE SINAIS MikeDB: consome tips e aposta =====
                            # LISTEN + poll ja coletaram e fizeram o claim atomico das
                            # tips do bot autorizado; aqui so executa cada uma na Superbet.
                            if _MIKEDB_OK and _mikedb and _mikedb.sinais_ok():
                                try:
                                    _tips = await _mikedb.coletar_tips_para_apostar(max_tips=8)
                                except Exception as _e:
                                    _tips = []
                                    log_ev(f"[mikedb] coleta err: {str(_e)[:80]}")
                                # RAJADA EM PARALELO: as tips do bot 61 vem em escada de
                                # linhas quase simultanea (12.5/13.5/14.5...). Serializar
                                # fazia a odd das seguintes envelhecer na fila enquanto a
                                # 1a tentava. Agora cada tip busca sua odd fresca AO MESMO
                                # tempo; o APOSTA_LOCK dentro de _mikedb_postar_odd ainda
                                # serializa so o POST final (momento critico protegido).
                                async def _exec_uma_tip(_tip):
                                    try:
                                        _ok, _det = await executar_tip_mikedb(ctx, api, _tip)
                                    except Exception as _e:
                                        _ok, _det = False, f"exc {type(_e).__name__}"
                                        log_ev(f"[mikedb] exec err: {str(_e)[:80]}")
                                    if _ok:
                                        _mikedb.ESTADO.total_apostadas += 1
                                    else:
                                        _mikedb.ESTADO.total_ignoradas += 1
                                    try:
                                        await _mikedb.marcar_resultado_execucao(_tip.get('id'), _ok, _det)
                                    except Exception:
                                        pass
                                if _tips:
                                    await asyncio.gather(
                                        *[_exec_uma_tip(_t) for _t in _tips],
                                        return_exceptions=True,
                                    )

                            # check de saldo zerado (troca conta auto se banca < 2x stake_FT por 10min sem aposta)
                            _check_saldo_zerado(jogos)

                            if JUROS_COMPOSTOS_ATIVO and (agora - ultimo_refresh_banca) >= REFRESH_BANCA_SEG:
                                ultimo_refresh_banca = agora
                                await atualizar_banca(page, force=True)

                            # GUARDA RAPIDO DE SESSAO (v12.4): nao espera os 10min.
                            # A cada 30s confere se deslogou; se sim, reloga JA e continua
                            # re-tentando em intervalo curto (backoff ate 120s) ate reconectar.
                            if (not PAUSADO and not EMERGENCIA and not AGUARDANDO_CONTA
                                    and not PRECISA_TROCAR_CONTA
                                    and agora - ultimo_guarda_sessao >= 30
                                    and agora - ultimo_guarda_sessao >= _relog_backoff):
                                ultimo_guarda_sessao = agora
                                try:
                                    _logado = await checar_login(page)
                                except Exception as _e:
                                    log_ev(f"[guarda] checar_login err: {str(_e)[:80]}")
                                    _logado = True
                                if not _logado:
                                    async with APOSTA_LOCK:
                                        log_ev("[guarda] DESLOGADO -> relogin imediato")
                                        try:
                                            if SB_DOMAIN not in (page.url or ""):
                                                page = await _get_superbet_page(ctx)
                                                _PAGE_REF = page
                                            try:
                                                await page.reload(wait_until="domcontentloaded", timeout=30000)
                                                await asyncio.sleep(2)
                                            except Exception as _e:
                                                log_ev(f"[guarda] reload err: {str(_e)[:80]}")
                                            await fechar_banner_cookies(page)
                                            await fechar_todos_modais(page)
                                            _ok_relog = await fazer_login(page)
                                        except Exception as _e:
                                            log_ev(f"[guarda] relogin err: {type(_e).__name__}: {str(_e)[:100]}")
                                            _ok_relog = False
                                    if _ok_relog:
                                        log_ev("[guarda] relogin OK - sessao restaurada")
                                        _relog_backoff = 0.0
                                        try: await init_bet_config(page)
                                        except Exception: pass
                                        if JUROS_COMPOSTOS_ATIVO:
                                            try:
                                                await asyncio.sleep(1.0)
                                                await atualizar_banca(page, force=True)
                                                ultimo_refresh_banca = agora
                                            except Exception: pass
                                        ultimo_check_login = agora
                                    else:
                                        _relog_backoff = min((_relog_backoff or 30.0) * 2, 120.0)
                                        log_ev(f"[guarda] relogin FALHOU - re-tenta em {_relog_backoff:.0f}s")
                                    jogos.clear()
                                    continue
                                else:
                                    _relog_backoff = 0.0

                            if agora - ultimo_check_login > 600:
                                ultimo_check_login = agora
                                log_ev("Check periodico: reload")
                                if SB_DOMAIN not in (page.url or ""):
                                    page = await _get_superbet_page(ctx)
                                    _PAGE_REF = page
                                try:
                                    await page.reload(wait_until="domcontentloaded", timeout=30000)
                                    await asyncio.sleep(2)
                                except Exception as e:
                                    log_ev(f"reload err: {str(e)[:80]}")
                                await fechar_todos_modais(page)
                                if not await checar_login(page):
                                    await fazer_login(page)
                                    await init_bet_config(page)
                                if JUROS_COMPOSTOS_ATIVO:
                                    await asyncio.sleep(1.5)
                                    await atualizar_banca(page, force=True)
                                    ultimo_refresh_banca = agora

                            if await fechar_todos_modais(page):
                                log_ev("Modal SESSAO - reload+login")
                                if SB_DOMAIN not in (page.url or ""):
                                    page = await _get_superbet_page(ctx)
                                    _PAGE_REF = page
                                try:
                                    await page.reload(wait_until="domcontentloaded", timeout=30000)
                                    await asyncio.sleep(2)
                                except Exception: pass
                                await fechar_todos_modais(page)
                                if not await checar_login(page):
                                    await fazer_login(page)
                                    await init_bet_config(page)

                            evs = await scan_adriatic(api)
                            log_scan(f">>> SCAN {len(evs)} jogos")
                            ids_ativos = set()

                            async def _proc_jogo(ev):
                                eid = ev.get("eventId")
                                if not eid: return None
                                mn = ev.get("matchName", "")
                                na, nb = parse_nicks(mn)

                                if eid not in jogos:
                                    jogos[eid] = Jogo(event_id=eid, match_name=mn, nick_a=na, nick_b=nb, tid=ev.get('_tid') or ev.get('tournamentId') or 0)
                                    log_ev(f"Jogo novo: {mn} (eid={eid})")

                                jg = jogos[eid]
                                jg.ultimo_visto = agora

                                sh, sa = parse_score(ev)
                                if sh is None or sa is None:
                                    return eid

                                meta = ev.get("metadata", {}) or {}
                                periodo = normalizar_periodo(meta.get("periodStatus"))

                                await processar_over_ft(ctx, api, ev, jg, sh, sa, periodo, na, nb)
                                await processar_q4_vencendo(ctx, api, ev, jg, sh, sa, periodo, na, nb)
                                await processar_q4_perdendo(ctx, api, ev, jg, sh, sa, periodo, na, nb)
                                await processar_hc_zebra(ctx, api, ev, jg, sh, sa, periodo, na, nb)
                                return eid

                            procs = await asyncio.gather(
                                *[_proc_jogo(ev) for ev in evs],
                                return_exceptions=True,
                            )
                            for eid in procs:
                                if isinstance(eid, int):
                                    ids_ativos.add(eid)

                            # ===== ESTRATEGIA 5: UNDER CLA (e-football) =====
                            if ESTRATEGIA_UNDER_CLA_ATIVA and not PAUSADO and not EMERGENCIA:
                                try:
                                    evs_cla = await scan_cla(api)
                                    log_scan(f">>> SCAN CLA {len(evs_cla)} jogos")

                                    async def _proc_cla(ev):
                                        try:
                                            eid = ev.get("eventId")
                                            if not eid: return None
                                            mn = ev.get("matchName", "")
                                            na, nb = parse_nicks(mn)
                                            if eid not in jogos:
                                                jogos[eid] = Jogo(event_id=eid, match_name=mn, nick_a=na, nick_b=nb, tid=ev.get('_tid') or ev.get('tournamentId') or 0)
                                                log_ev(f"Jogo novo (CLA): {mn} (eid={eid})")
                                            jg = jogos[eid]
                                            jg.ultimo_visto = agora
                                            sh, sa = parse_score(ev)
                                            if sh is None or sa is None:
                                                return eid
                                            meta = ev.get("metadata", {}) or {}
                                            periodo = normalizar_periodo(meta.get("periodStatus"))
                                            await processar_under_cla(ctx, api, ev, jg, sh, sa, periodo, na, nb)
                                            return eid
                                        except Exception as e:
                                            log_ev(f"[CLA] proc err {ev.get('matchName','?')}: {str(e)[:80]}")
                                            return ev.get("eventId")

                                    procs_cla = await asyncio.gather(*[_proc_cla(ev) for ev in evs_cla], return_exceptions=True)
                                    for eid in procs_cla:
                                        if isinstance(eid, int):
                                            ids_ativos.add(eid)
                                except Exception as e:
                                    log_ev(f"[CLA] bloco err: {type(e).__name__}: {str(e)[:100]}")

                            for eid in list(jogos.keys()):
                                jg = jogos[eid]
                                if eid in ids_ativos: continue
                                if agora - jg.ultimo_visto >= JOGO_TIMEOUT_SEG:
                                    log_ev(f"Jogo sumiu: {jg.match_name} ft:{len(jg.ft_apostadas)}/R${jg.ft_stake:.0f} venc:{len(jg.venc_apostadas)}/R${jg.venc_stake:.0f} perd:{len(jg.perd_apostadas)}/R${jg.perd_stake:.0f} hc:{len(jg.hc_apostadas)}/R${jg.hc_stake:.0f}")
                                    jogos.pop(eid)

                            # Ciclo completou OK: reseta o anti-flood do loop
                            if erro_loop_streak > 0:
                                erro_loop_streak = 0
                                erro_loop_anterior = ""

                            await asyncio.sleep(SCAN_INTERVAL)

                        except KeyboardInterrupt:
                            raise
                        except Exception as e:
                            # Detecta erros de CDP/Chrome morto - re-raise pra reconectar
                            if _is_cdp_dead(e):
                                log_ev(f"[watchdog] CDP/Chrome morto detectado: {type(e).__name__}: {str(e)[:120]}")
                                raise
                            # Erro normal: log + sleep com backoff suave se o mesmo erro persiste
                            erro_atual = f"{type(e).__name__}:{str(e)[:80]}"
                            if erro_atual == erro_loop_anterior:
                                erro_loop_streak += 1
                            else:
                                erro_loop_streak = 1
                                erro_loop_anterior = erro_atual
                            # Backoff: 2s, 5s, 15s, 60s, 120s (depois mantem)
                            backoffs_loop = [2, 5, 15, 60, 120]
                            espera = backoffs_loop[min(erro_loop_streak - 1, len(backoffs_loop) - 1)]
                            if erro_loop_streak == 5:
                                log_ev(f"loop: MESMO ERRO {erro_loop_streak}x - dando espacada de {espera}s")
                                try:
                                    await tg_send(
                                        f"⚠️ <b>erro persistente no loop</b>\n"
                                        f"<code>{erro_atual[:200]}</code>\n"
                                        f"ja repetiu {erro_loop_streak}x - vou esperar mais entre tentativas\n"
                                        f"<i>verifica os logs, {USER_NAME}</i>"
                                    )
                                except Exception: pass
                            else:
                                log_ev(f"loop ({erro_loop_streak}x): {erro_atual}")
                            await asyncio.sleep(espera)

        except KeyboardInterrupt:
            break
        except Exception as e:
            # Erro propagado de dentro: ou CDP morto, ou falha no boot. Reconecta com backoff.
            if _is_cdp_dead(e) or "connect_over_cdp" in str(e).lower() or "ECONNREFUSED" in str(e):
                consec_cdp_falhas += 1
                # Backoff exponencial: 30s, 60s, 120s, 5min, 10min, depois capa em 10min
                backoffs = [30, 60, 120, 300, 600]
                espera = backoffs[min(consec_cdp_falhas - 1, len(backoffs) - 1)]
                log_ev(f"[watchdog] CDP morto/nao conecta ({consec_cdp_falhas}) - aguardando {espera}s")
                if consec_cdp_falhas <= 3:
                    try:
                        await tg_send(
                            f"⚠️ <b>CDP/Chrome desconectado</b>\n"
                            f"tentativa {consec_cdp_falhas} em {espera}s ({espera/60:.0f}min)\n"
                            f"<i>verifique se o Chrome ta rodando na porta {CDP_PORT}</i>"
                        )
                    except Exception: pass
                elif not avisou_cdp_morto:
                    avisou_cdp_morto = True
                    try:
                        await tg_send(
                            f"🚨 <b>CDP NAO RECONECTA</b>\n"
                            f"{consec_cdp_falhas} tentativas falharam\n"
                            f"<i>bot vai continuar tentando com backoff (max {backoffs[-1]/60:.0f}min entre tentativas)</i>"
                        )
                    except Exception: pass
                await asyncio.sleep(espera)
                continue
            else:
                # Erro inesperado - backoff suave (5s, 30s, 2min, 5min, cap 5min)
                consec_cdp_falhas += 1
                backoffs_err = [5, 30, 120, 300]
                espera = backoffs_err[min(consec_cdp_falhas - 1, len(backoffs_err) - 1)]
                log_ev(f"[watchdog] erro inesperado #{consec_cdp_falhas}: {type(e).__name__}: {str(e)[:120]}")
                if consec_cdp_falhas <= 2:
                    try:
                        await tg_send(
                            f"⚠️ <b>erro inesperado no watchdog</b>\n"
                            f"<code>{type(e).__name__}: {str(e)[:200]}</code>\n"
                            f"<i>retentando em {espera}s</i>"
                        )
                    except Exception: pass
                await asyncio.sleep(espera)
                continue

    log_ev("Encerrando...")
    await tg_send(
        f"🔴 <b>BOT ENCERRADO</b>\n"
        f"{divisor()}\n"
        f"até a próxima, <b>{USER_NAME}</b>! 👋\n"
        f"\n"
        f"👤 ultima conta: <code>{USUARIO if CONTAS else '&lt;sem conta&gt;'}</code>\n"
        f"🏦 banca final: R${_BANCA_ATUAL:,.2f}"
    )
    try:
        tg_task.cancel()
        await asyncio.sleep(0.5)
    except Exception: pass
    log_ev("Fim.")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[main] Ctrl+C")
