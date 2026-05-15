"""
coletor_betano.py — Coleta tick-by-tick Betano (E-Football + E-Basketball)
Via CDP (Chrome aberto com --remote-debugging-port=9225)
Salva PostgreSQL + JSONL backup.

═══════════════════════════════════════════════════════════════════
CORREÇÕES vs versão anterior:

[BUG CRÍTICO]
⭐ Coletor parava antes do FT por causa do fechamento de mercados:
   - Quando Betano fecha os últimos mercados (~2-4 min antes do FT real),
     o evento some do overview live e o coletor abandona o jogo.
   - SOLUÇÃO: eventos que somem do overview vão pra "ending_events" e
     continuam sendo consultados via /events/{eid}/?isInit=true por
     até ENDING_TTL_SEG=300s (5 min), pegando o placar até o fim real.
   - Tick especial SCORE_UPDATE gerado sempre que o placar muda
     (independente de haver odd ativa).

[BUGS MENORES]
1. Score sobrescrito em parse_event_detail — fix
2. Score parser com fallback inválido (home=None vs ausente) — fix
3. Memory leaks em prev_odds/last_detail/events_seen — cleanup_event()
4. JSONL com rotação diária
5. INSERT com ON CONFLICT DO NOTHING (constraint única adicionada)
6. httpx.AsyncClient persistente pro Telegram
7. POLL_DETAIL ajustado (era no-op)
8. Score do detail (não só do overview) — pega placar quando evento já saiu

python coletor_betano.py
Ctrl+C = para
═══════════════════════════════════════════════════════════════════
"""

import asyncio
import asyncpg
import aiohttp
import httpx
import json
import time
import re
import os
import subprocess
import traceback
from datetime import datetime, timezone

try:
    import psutil
    PSUTIL_OK = True
except ImportError:
    PSUTIL_OK = False

# ══════════════════════════════════════════════════════════════════
# CONFIG
# ══════════════════════════════════════════════════════════════════

CDP          = "http://localhost:9225"
CDP_PORT     = 9225
BETANO_URL   = "https://www.betano.bet.br/live/"
BETANO_API   = "https://www.betano.bet.br/danae-webapi/api/live"

TG_TOKEN     = "8408393785:AAGhclFqeB4FRnLvr_6mTQDuvbHYQZPoqXo"
TG_CHAT_ID   = "6622310450"
TG_ENABLED   = bool(TG_TOKEN and TG_CHAT_ID)

POLL_OVERVIEW            = 0.5
POLL_DETAIL              = 0.4      # ← agora tem efeito (antes era >= POLL_OVERVIEW)
POLL_ENDING              = 2.0      # ⭐ polling lento pra eventos saindo do ar
ENDING_TTL_SEG           = 300      # ⭐ tenta por 5 min após sumir do overview
OUTPUT                   = "betano_ticks.jsonl"
PG_DSN                   = "postgresql://postgres:mikedb0702@localhost:5432/mikedb"
ESPORT_KEYWORDS          = ["minutos de jogo", "minutes"]
ALERTA_SEM_TICK_SEG      = 120
ALERTA_ERROS_SEGUIDOS    = 10
ALERTA_COOLDOWN          = 300

# Caminhos do Chrome — primeiro que existir é usado
CHROME_PATHS = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
]

CHROME_PROC = None  # referência global ao processo

# ══════════════════════════════════════════════════════════════════
# CHROME MANAGER
# ══════════════════════════════════════════════════════════════════

def find_chrome():
    for p in CHROME_PATHS:
        if os.path.exists(p):
            return p
    raise FileNotFoundError("Chrome/Brave não encontrado. Ajuste CHROME_PATHS no script.")


def chrome_rodando():
    try:
        import urllib.request
        urllib.request.urlopen(f"http://localhost:{CDP_PORT}/json", timeout=2)
        return True
    except:
        return False


def matar_chrome():
    global CHROME_PROC
    killed = 0
    if PSUTIL_OK:
        for proc in psutil.process_iter(['name', 'pid']):
            nome = proc.info['name'].lower()
            if 'chrome' in nome or 'brave' in nome:
                try:
                    proc.kill()
                    killed += 1
                except:
                    pass
    if CHROME_PROC:
        try:
            CHROME_PROC.kill()
        except:
            pass
        CHROME_PROC = None
    return killed


def abrir_chrome():
    global CHROME_PROC
    exe = find_chrome()
    cmd = [
        exe,
        f"--remote-debugging-port={CDP_PORT}",
        "--remote-allow-origins=*",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-popup-blocking",
        "--disable-notifications",
        r"--user-data-dir=C:\ChromeProfileBetano",
        BETANO_URL,
    ]
    CHROME_PROC = subprocess.Popen(cmd)
    return CHROME_PROC


async def garantir_chrome():
    if chrome_rodando():
        return True
    print("  🌐 Chrome não detectado — abrindo...")
    try:
        matar_chrome()
        await asyncio.sleep(1)
        abrir_chrome()
        for i in range(30):
            await asyncio.sleep(0.5)
            if chrome_rodando():
                print(f"  ✅ Chrome pronto ({(i+1)*0.5:.1f}s)")
                await asyncio.sleep(4)
                return True
        print("  ❌ Chrome não respondeu em 15s")
        return False
    except Exception as e:
        print(f"  ❌ Erro ao abrir Chrome: {e}")
        return False


async def reiniciar_chrome():
    print("  🔄 Reiniciando Chrome...")
    matar_chrome()
    await asyncio.sleep(2)
    return await garantir_chrome()

# ══════════════════════════════════════════════════════════════════
# JSONL WRITER COM ROTAÇÃO DIÁRIA
# ══════════════════════════════════════════════════════════════════

class JSONLWriter:
    """Append-only JSONL com rotação diária automática."""
    def __init__(self, base_path):
        self.base_path = base_path
        self.current_date = None
        self.fp = None
        self._rotate_if_needed()

    def _rotate_if_needed(self):
        today = datetime.now().strftime("%Y-%m-%d")
        if today != self.current_date:
            if self.fp:
                try: self.fp.close()
                except: pass
            base, ext = os.path.splitext(self.base_path)
            path = f"{base}_{today}{ext}"
            self.fp = open(path, "a", encoding="utf-8")
            self.current_date = today

    def write(self, obj):
        self._rotate_if_needed()
        self.fp.write(json.dumps(obj, ensure_ascii=False) + "\n")

    def flush(self):
        if self.fp:
            try: self.fp.flush()
            except: pass

    def close(self):
        if self.fp:
            try: self.fp.close()
            except: pass

# ══════════════════════════════════════════════════════════════════
# POSTGRES
# ══════════════════════════════════════════════════════════════════

CREATE_INDEXES = """
CREATE INDEX IF NOT EXISTS idx_ticks_ts        ON ticks (ts);
CREATE INDEX IF NOT EXISTS idx_ticks_bookmaker ON ticks (bookmaker);
CREATE INDEX IF NOT EXISTS idx_ticks_event     ON ticks (event_id);
CREATE INDEX IF NOT EXISTS idx_ticks_sport     ON ticks (sport);
CREATE INDEX IF NOT EXISTS idx_ticks_liga      ON ticks (liga);
CREATE INDEX IF NOT EXISTS idx_ticks_jogador   ON ticks (jogador_a, jogador_b);
CREATE INDEX IF NOT EXISTS idx_ticks_bk_ev_sel ON ticks (bookmaker, event_id, selecao_id);
"""

CREATE_UNIQUE_INDEX = """
CREATE UNIQUE INDEX IF NOT EXISTS uq_ticks_bk_ev_sel_ts
    ON ticks (bookmaker, event_id, selecao_id, ts);
"""

INSERT_TICK = """
INSERT INTO ticks (
    ts, bookmaker, sport, liga, categoria, event_id, evento,
    time_a, jogador_a, time_b, jogador_b,
    score_home, score_away, live_time,
    mercado, mercado_id, mercado_tipo, linha,
    selecao_id, selecao, odds, odd_status, competitor_id
) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
ON CONFLICT (bookmaker, event_id, selecao_id, ts) DO NOTHING
"""

INSERT_TICK_NO_CONFLICT = """
INSERT INTO ticks (
    ts, bookmaker, sport, liga, categoria, event_id, evento,
    time_a, jogador_a, time_b, jogador_b,
    score_home, score_away, live_time,
    mercado, mercado_id, mercado_tipo, linha,
    selecao_id, selecao, odds, odd_status, competitor_id
) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
"""

async def pg_connect():
    pool = await asyncpg.create_pool(PG_DSN, min_size=2, max_size=5)
    insert_sql = INSERT_TICK
    async with pool.acquire() as conn:
        await conn.execute(CREATE_INDEXES)
        try:
            await conn.execute(CREATE_UNIQUE_INDEX)
        except Exception as e:
            print(f"⚠️  Unique index não criado: {e}")
            insert_sql = INSERT_TICK_NO_CONFLICT
    return pool, insert_sql

async def pg_insert_batch(pool, insert_sql, rows):
    if not rows: return
    async with pool.acquire() as conn:
        await conn.executemany(insert_sql, rows)

# ══════════════════════════════════════════════════════════════════
# TELEGRAM
# ══════════════════════════════════════════════════════════════════

async def tg_send(msg, client=None):
    if not TG_ENABLED: return
    url  = f"https://api.telegram.org/bot{TG_TOKEN}/sendMessage"
    body = {"chat_id": TG_CHAT_ID, "text": f"🔔 BETANO\n{msg}", "parse_mode": "HTML"}
    try:
        if client:
            await client.post(url, json=body, timeout=10)
        else:
            async with httpx.AsyncClient(timeout=10) as c:
                await c.post(url, json=body)
    except: pass

# ══════════════════════════════════════════════════════════════════
# CDP HELPERS
# ══════════════════════════════════════════════════════════════════

async def cdp_connect():
    session = aiohttp.ClientSession()
    async with session.get(f"{CDP}/json") as r:
        abas = await r.json()
    aba = next(
        (a for a in abas if "betano" in a.get("url", "").lower() and "webSocketDebuggerUrl" in a),
        None
    )
    if not aba:
        aba = next((a for a in abas if "webSocketDebuggerUrl" in a), None)
    if not aba:
        await session.close()
        raise Exception("Nenhuma aba CDP disponível")
    ws = await session.ws_connect(aba["webSocketDebuggerUrl"], max_msg_size=50 * 1024 * 1024)
    return session, ws, aba["url"]


async def cdp_fetch(ws, url, req_id):
    js = f"""
    fetch("{url}", {{
        headers: {{"Accept":"application/json","X-Operator":"8","X-Language":"5"}},
        credentials: "include"
    }}).then(r => r.text()).catch(e => JSON.stringify({{cdpError: e.message}}))
    """
    await ws.send_json({
        "id": req_id,
        "method": "Runtime.evaluate",
        "params": {"expression": js, "awaitPromise": True, "returnByValue": True}
    })
    while True:
        msg = await asyncio.wait_for(ws.receive(), timeout=15)
        if msg.type != aiohttp.WSMsgType.TEXT: continue
        data = json.loads(msg.data)
        if data.get("id") == req_id:
            val = data.get("result", {}).get("result", {}).get("value", "")
            if not val: return None
            try: return json.loads(val)
            except: return None

# ══════════════════════════════════════════════════════════════════
# PARSERS
# ══════════════════════════════════════════════════════════════════

def resolve(obj):
    if isinstance(obj, dict) and "byId" in obj:
        return obj["byId"]
    return obj if isinstance(obj, dict) else {}


def parse_participants(participants):
    if not participants or len(participants) < 2:
        return "?", "?", "?", "?"
    def extract(p):
        name = p.get("name", "?")
        name = re.sub(r'\s*\(e?sports?\)\s*$', '', name, flags=re.IGNORECASE)
        m = re.match(r'^(.+?)\s*\(([^)]+)\)\s*$', name)
        if m: return m.group(1).strip(), m.group(2).strip()
        return name, name
    ta, pa = extract(participants[0])
    tb, pb = extract(participants[1])
    return ta, pa, tb, pb


def get_score_safe(score, key_main, key_alt):
    """
    Pega score com fallback REAL (testa None, não só ausência da chave).
    Bug original: score.get("home", score.get("1")) → se "home" existe e é None,
    retorna None em vez do fallback "1".
    """
    if not isinstance(score, dict): return None
    v = score.get(key_main)
    if v is None:
        v = score.get(key_alt)
    if v is None: return None
    try: return int(v)
    except (ValueError, TypeError): return None


def get_overview_esports(overview):
    events_raw  = resolve(overview.get("events", {}))
    leagues_raw = resolve(overview.get("leagues", {}))
    league_names = {}
    for lid, lg in leagues_raw.items():
        if isinstance(lg, dict):
            key = int(lid) if str(lid).isdigit() else lid
            league_names[key] = lg.get("name", "?")
    results = []
    for eid, ev in events_raw.items():
        if not isinstance(ev, dict): continue
        sport_id    = str(ev.get("sportId", ""))
        league_id   = ev.get("leagueId")
        league_name = league_names.get(league_id, "?")
        if not any(kw in league_name.lower() for kw in ESPORT_KEYWORDS): continue
        live_data = ev.get("liveData", {}) or {}
        score     = live_data.get("score", {}) or {}
        results.append({
            "event_id":     str(eid),
            "sport":        "E-Basketball" if sport_id == "BASK" else "E-Football",
            "league_name":  league_name,
            "participants": ev.get("participants", []),
            "score_home":   get_score_safe(score, "home", "1"),
            "score_away":   get_score_safe(score, "away", "2"),
            "period":       live_data.get("periodDescription", ""),
            "live_time":    live_data.get("time", ""),
        })
    return results


def format_clock_time(seconds_since_start, clock_stopped=False):
    """
    FIX BUG eFoot: converte secondsSinceStart em formato amigável "M'SS".
    Exemplos:
        0     → ""        (jogo não começou)
        65    → "1'05"
        247   → "4'07"
        480   → "8'00"
    Se clockStopped=True E seconds=0 → jogo não começou ainda, retorna "".
    """
    if seconds_since_start is None:
        return ""
    try:
        s = int(seconds_since_start)
    except (TypeError, ValueError):
        return ""
    if s == 0 and clock_stopped:
        return ""  # jogo ainda não começou
    minute = s // 60
    sec    = s % 60
    return f"{minute}'{sec:02d}"


def extract_score_from_detail(detail):
    """
    Extrai score direto do payload do detail.
    Crítico pra eventos em ending_events (não estão mais no overview).

    BUG FIX live_time eFoot: o detail eFoot da Betano usa estrutura DIFERENTE
    do eBasket. eFoot tem `liveData.clock.secondsSinceStart`, eBasket tem
    `liveData.time` ou `liveData.periodDescription`. Tentamos ambos.
    """
    if not isinstance(detail, dict):
        return None, None, ""

    # Path 1: liveData no root
    live_data = detail.get("liveData") if isinstance(detail.get("liveData"), dict) else None
    # Path 2: detail.event.liveData (CASO REAL eFoot — confirmado em dump)
    if not live_data:
        ev = detail.get("event")
        if isinstance(ev, dict):
            live_data = ev.get("liveData") if isinstance(ev.get("liveData"), dict) else None
    # Path 3: detail.events[byId][eid].liveData (fallback se vier estrutura overview-like)
    if not live_data:
        evs = resolve(detail.get("events", {}))
        if isinstance(evs, dict) and len(evs) >= 1:
            first = next(iter(evs.values()), None)
            if isinstance(first, dict):
                live_data = first.get("liveData") if isinstance(first.get("liveData"), dict) else None

    if not live_data:
        return None, None, ""

    score = live_data.get("score", {}) or {}
    sh = get_score_safe(score, "home", "1")
    sa = get_score_safe(score, "away", "2")

    # FIX BUG live_time:
    # 1. eBasket: tenta `time` (string tipo "Q2") OU `periodDescription`
    # 2. eFoot:   tenta `clock.secondsSinceStart` → converte pra "M'SS"
    live_time = live_data.get("time", "") or live_data.get("periodDescription", "")
    if not live_time:
        clock = live_data.get("clock", {}) or {}
        if isinstance(clock, dict):
            secs = clock.get("secondsSinceStart")
            stopped = bool(clock.get("clockStopped", False))
            live_time = format_clock_time(secs, stopped)

    return sh, sa, live_time


def parse_event_detail(detail, ev_info, ts_now):
    """
    Retorna (ticks_json, score_home, score_away, live_time).
    Score vem do detail se possível; fallback pro ev_info (overview).
    """
    if not detail or not isinstance(detail, dict):
        return [], ev_info.get("score_home"), ev_info.get("score_away"), ev_info.get("live_time", "")

    markets_raw    = resolve(detail.get("markets", {}))
    selections_raw = resolve(detail.get("selections", {}))

    ta, pa, tb, pb = parse_participants(ev_info.get("participants", []))
    event_name = f"{ta} ({pa}) vs {tb} ({pb})" if pa != ta else f"{ta} vs {tb}"
    sport      = ev_info.get("sport", "E-Football")
    liga       = ev_info.get("league_name", "?")
    eid        = ev_info["event_id"]

    # Score: detail PRIMEIRO, fallback ev_info (overview)
    sh_det, sa_det, live_time_det = extract_score_from_detail(detail)
    score_home = sh_det if sh_det is not None else ev_info.get("score_home")
    score_away = sa_det if sa_det is not None else ev_info.get("score_away")
    live_time  = live_time_det or ev_info.get("live_time", ev_info.get("period", ""))

    # Garantir int (sem sobrescrever depois — bug fix)
    score_home = int(score_home) if score_home is not None else None
    score_away = int(score_away) if score_away is not None else None

    ts_str     = ts_now.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
    ticks_json = []

    for mid, mkt in markets_raw.items():
        if not isinstance(mkt, dict): continue
        mkt_name = mkt.get("name", "?")
        mkt_type = str(mkt.get("templateId", mkt.get("typeId", 0)))
        handicap = str(mkt.get("handicap", ""))
        for sel_id in mkt.get("selectionIdList", []):
            sel = selections_raw.get(str(sel_id), {})
            if not isinstance(sel, dict): continue
            odds = sel.get("price", sel.get("odds", 0))
            if not odds or float(odds) <= 1.0: continue
            odd_status    = 0 if sel.get("isActive", True) else 1
            linha         = str(sel.get("handicap", handicap))
            selecao       = sel.get("name", "?")
            competitor_id = sel.get("competitorId")
            ticks_json.append({
                "ts": ts_str, "bookmaker": "betano",
                "sport": sport, "liga": liga, "categoria": "",
                "event_id": eid, "evento": event_name,
                "time_a": ta, "jogador_a": pa, "time_b": tb, "jogador_b": pb,
                "score_home": score_home, "score_away": score_away, "live_time": live_time,
                "mercado": mkt_name, "mercado_id": str(mid), "mercado_tipo": mkt_type,
                "linha": linha, "selecao_id": str(sel_id), "selecao": selecao,
                "odds": float(odds), "odd_status": odd_status,
                "competitor_id": str(competitor_id) if competitor_id else None,
            })
    return ticks_json, score_home, score_away, live_time


def make_score_update_tick(eid, ev_info, score_home, score_away, live_time, ts_now):
    """
    Tick especial SCORE_UPDATE — captura mudança de placar mesmo sem odds ativas.
    Crítico nos minutos finais quando todos os mercados foram fechados.

    selecao_id="score_update" garante que o filter_new_ticks não confunda
    com tick de odd real, mas o filter_score_change controla a inserção.
    """
    ta, pa, tb, pb = parse_participants(ev_info.get("participants", []))
    event_name = f"{ta} ({pa}) vs {tb} ({pb})" if pa != ta else f"{ta} vs {tb}"
    sport = ev_info.get("sport", "E-Football")
    liga  = ev_info.get("league_name", "?")
    ts_str = ts_now.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"

    return {
        "ts": ts_str, "bookmaker": "betano",
        "sport": sport, "liga": liga, "categoria": "",
        "event_id": eid, "evento": event_name,
        "time_a": ta, "jogador_a": pa, "time_b": tb, "jogador_b": pb,
        "score_home": score_home, "score_away": score_away, "live_time": live_time,
        "mercado": "SCORE_UPDATE", "mercado_id": "score_update", "mercado_tipo": "SCORE_UPDATE",
        "linha": "", "selecao_id": "score_update", "selecao": "score_update",
        "odds": None, "odd_status": 1, "competitor_id": None,
    }

# ══════════════════════════════════════════════════════════════════
# ESTADO
# ══════════════════════════════════════════════════════════════════

class State:
    def __init__(self):
        self.prev_odds       = {}    # {(eid, sel_id): (odds, odd_status)}
        self.last_score      = {}    # {eid: (score_home, score_away)}  ⭐
        self.last_detail     = {}    # {eid: timestamp}
        self.events          = {}    # eventos ativos no overview
        self.ending_events   = {}    # ⭐ {eid: {first_seen, ev_info, attempts, last_det_ok}}
        self.ticks_saved     = 0
        self.score_updates   = 0     # ⭐ counter
        self.cycles          = 0
        self.errors          = 0
        self.erros_seguidos  = 0
        self.events_seen     = set()
        self.start           = time.time()
        self.last_tick_time  = time.time()
        self.ultimo_alerta   = {}
        self.req_counter     = 100
        self.chrome_restarts = 0

    def next_req_id(self):
        self.req_counter += 1
        return self.req_counter

    async def watchdog(self, client=None):
        now      = time.time()
        sem_tick = now - self.last_tick_time
        if sem_tick > ALERTA_SEM_TICK_SEG:
            last = self.ultimo_alerta.get("sem_tick", 0)
            if now - last >= ALERTA_COOLDOWN:
                self.ultimo_alerta["sem_tick"] = now
                await tg_send(f"⚠️ SEM TICKS há {sem_tick:.0f}s\nEventos: {len(self.events)}\nEnding: {len(self.ending_events)}\nErros: {self.errors}", client)
        if self.erros_seguidos >= ALERTA_ERROS_SEGUIDOS:
            last = self.ultimo_alerta.get("erros", 0)
            if now - last >= ALERTA_COOLDOWN:
                self.ultimo_alerta["erros"] = now
                await tg_send(f"🚨 {self.erros_seguidos} ERROS SEGUIDOS\nCDP pode estar fora.", client)

    def filter_new_ticks(self, ticks_json):
        """Retorna apenas os ticks com odds/status novos (dedup baseado em prev_odds)."""
        new_json = []
        for t in ticks_json:
            key  = (t["event_id"], t["selecao_id"])
            val  = (t["odds"], t["odd_status"])
            prev = self.prev_odds.get(key)
            if prev is None or prev != val:
                self.prev_odds[key]  = val
                new_json.append(t)
                self.ticks_saved    += 1
                self.last_tick_time  = time.time()
                self.erros_seguidos  = 0
        return new_json

    def filter_score_change(self, eid, score_home, score_away):
        """
        Retorna True se o placar mudou desde a última vez (ou primeira vez visto).
        Usado pra disparar SCORE_UPDATE tick.
        """
        if score_home is None and score_away is None:
            return False
        new = (score_home, score_away)
        prev = self.last_score.get(eid)
        if prev != new:
            self.last_score[eid] = new
            self.last_tick_time  = time.time()
            self.score_updates  += 1
            return True
        return False

    def cleanup_event(self, eid):
        """Remove TUDO relacionado a um evento — chama quando termina de vez."""
        self.events.pop(eid, None)
        self.ending_events.pop(eid, None)
        self.last_detail.pop(eid, None)
        self.last_score.pop(eid, None)
        # Remove todas as keys de prev_odds desse evento
        self.prev_odds = {k: v for k, v in self.prev_odds.items() if k[0] != eid}

# ══════════════════════════════════════════════════════════════════
# DASHBOARD
# ══════════════════════════════════════════════════════════════════

def dashboard(state):
    os.system('cls' if os.name == 'nt' else 'clear')
    elapsed = time.time() - state.start
    rps     = state.ticks_saved / elapsed if elapsed > 0 else 0
    print(f"{'═'*70}")
    print(f"  📡 COLETOR BETANO — PostgreSQL + JSONL (CDP Auto)")
    print(f"{'═'*70}")
    print(f"  Uptime: {elapsed:.0f}s | Ciclos: {state.cycles} | Ticks: {state.ticks_saved} ({rps:.1f}/s) | ScoreUpd: {state.score_updates}")
    print(f"  Ativos: {len(state.events)} | Ending: {len(state.ending_events)} | Vistos: {len(state.events_seen)}")
    print(f"  Erros: {state.errors} | Chrome restarts: {state.chrome_restarts}")
    print(f"{'─'*70}")
    if not state.events and not state.ending_events:
        print(f"\n  ⏳ Aguardando eventos e-sports...")
    else:
        for eid, info in state.events.items():
            sc = f"{info.get('score_home','?')}-{info.get('score_away','?')}"
            print(f"\n  🎮 [LIVE] {info['sport']} | {info['liga']}")
            print(f"    {info['team_a']:20s} ({info['player_a']}) vs {info['team_b']:20s} ({info['player_b']})")
            print(f"    Score: {sc} | {info.get('live_time','')} | {info.get('n_markets',0)} mercados")
        for eid, info in state.ending_events.items():
            ev_info = info["ev_info"]
            ta, pa, tb, pb = parse_participants(ev_info.get("participants", []))
            sc_prev = state.last_score.get(eid, ("?", "?"))
            age     = time.time() - info["first_seen"]
            print(f"\n  🔚 [ENDING {age:.0f}s/{ENDING_TTL_SEG}s] {ev_info.get('sport','?')} | {ev_info.get('league_name','?')}")
            print(f"    {ta:20s} ({pa}) vs {tb:20s} ({pb})")
            print(f"    Score: {sc_prev[0]}-{sc_prev[1]} | tentativas: {info['attempts']}")
    print(f"\n{'─'*70}\n  Ctrl+C = parar")

# ══════════════════════════════════════════════════════════════════
# PROCESSORS
# ══════════════════════════════════════════════════════════════════

async def process_active_event(ws, ev, state, fp, pool, insert_sql, ts_now):
    """Processa evento que tá no overview agora — busca detail e extrai ticks."""
    eid = ev["event_id"]
    state.events_seen.add(eid)
    now = time.time()

    if now - state.last_detail.get(eid, 0) < POLL_DETAIL:
        return  # throttle

    det = await cdp_fetch(ws, f"{BETANO_API}/events/{eid}/?isInit=true", state.next_req_id())
    if not det:
        state.errors += 1; state.erros_seguidos += 1
        return

    state.last_detail[eid] = time.time()
    ticks_json, sh, sa, live_time = parse_event_detail(det, ev, ts_now)

    # 1) Salva ticks de odds que mudaram
    new_json = state.filter_new_ticks(ticks_json)
    if new_json:
        for t in new_json:
            fp.write(t)
        fp.flush()
        pg_rows = _ticks_to_pg(new_json)
        if pg_rows:
            try:
                await pg_insert_batch(pool, insert_sql, pg_rows)
            except Exception as e:
                print(f"  ⚠️ PG: {e}")

    # 2) Salva SCORE_UPDATE se placar mudou
    if state.filter_score_change(eid, sh, sa):
        su = make_score_update_tick(eid, ev, sh, sa, live_time, ts_now)
        fp.write(su)
        fp.flush()
        pg_rows = _ticks_to_pg([su])
        if pg_rows:
            try:
                await pg_insert_batch(pool, insert_sql, pg_rows)
            except Exception as e:
                print(f"  ⚠️ PG SU: {e}")

    # 3) Atualiza estado pro dashboard
    ta, pa, tb, pb = parse_participants(ev.get("participants", []))
    state.events[eid] = {
        "sport": ev["sport"], "liga": ev["league_name"],
        "team_a": ta, "player_a": pa, "team_b": tb, "player_b": pb,
        "score_home": sh if sh is not None else ev.get("score_home"),
        "score_away": sa if sa is not None else ev.get("score_away"),
        "live_time": live_time,
        "n_markets": len(ticks_json),
    }


async def process_ending_event(ws, eid, info, state, fp, pool, insert_sql, ts_now):
    now = time.time()
    if now - state.last_detail.get(eid, 0) < POLL_ENDING:
        return

    det = await cdp_fetch(ws, f"{BETANO_API}/events/{eid}/?isInit=true", state.next_req_id())
    state.last_detail[eid] = time.time()
    info["attempts"] += 1

    if not det or not isinstance(det, dict):
        return

    ev_info = info["ev_info"]
    ticks_json, sh, sa, live_time = parse_event_detail(det, ev_info, ts_now)

    new_json = state.filter_new_ticks(ticks_json)
    if new_json:
        for t in new_json:
            fp.write(t)
        fp.flush()
        pg_rows = _ticks_to_pg(new_json)
        if pg_rows:
            try:
                await pg_insert_batch(pool, insert_sql, pg_rows)
            except Exception as e:
                print(f"  ⚠️ PG ending: {e}")

    if state.filter_score_change(eid, sh, sa):
        su = make_score_update_tick(eid, ev_info, sh, sa, live_time, ts_now)
        fp.write(su)
        fp.flush()
        pg_rows = _ticks_to_pg([su])
        if pg_rows:
            try:
                await pg_insert_batch(pool, insert_sql, pg_rows)
            except Exception as e:
                print(f"  ⚠️ PG SU ending: {e}")
        info["last_det_ok"] = time.time()

# ══════════════════════════════════════════════════════════════════
# MAIN LOOP
# ══════════════════════════════════════════════════════════════════

def _ticks_to_pg(ticks):
    """Converte lista de tick dicts em tuplas para INSERT no PostgreSQL."""
    rows = []
    for t in ticks:
        try:
            ts_val = datetime.fromisoformat(t["ts"].replace("Z", "+00:00"))
            rows.append((
                ts_val,
                t.get("bookmaker", "betano"),
                t.get("sport"), t.get("liga"), t.get("categoria"),
                t.get("event_id", ""), t.get("evento"),
                t.get("time_a"), t.get("jogador_a"),
                t.get("time_b"), t.get("jogador_b"),
                t.get("score_home"), t.get("score_away"),
                t.get("live_time"),
                t.get("mercado"), t.get("mercado_id"), t.get("mercado_tipo"),
                t.get("linha"),
                t.get("selecao_id", ""), t.get("selecao"),
                t.get("odds"), t.get("odd_status"),
                t.get("competitor_id"),
            ))
        except Exception:
            pass
    return rows

async def main():
    state = State()
    print(f"📡 Coletor Betano iniciando...")
    print(f"   DB:       {PG_DSN}")
    print(f"   Backup:   {OUTPUT}")
    print(f"   Telegram: {'ON' if TG_ENABLED else 'OFF'}\n")

    # PostgreSQL
    print("🔌 Conectando PostgreSQL...")
    try:
        pool, insert_sql = await pg_connect()
        print("✅ PostgreSQL OK\n")
    except Exception as e:
        print(f"❌ PG falhou: {e}")
        return

    # Chrome
    print("🌐 Verificando Chrome...")
    if not await garantir_chrome():
        print("❌ Não foi possível abrir o Chrome. Abra manualmente com:")
        print(f'   chrome.exe --remote-debugging-port={CDP_PORT} {BETANO_URL}')
        await pool.close()
        return

    # CDP
    print("🔌 Conectando CDP...")
    session, ws = None, None
    for tentativa in range(3):
        try:
            session, ws, url = await cdp_connect()
            print(f"✅ CDP OK: {url}\n")
            break
        except Exception as e:
            print(f"  Tentativa {tentativa+1}/3 falhou: {e}")
            await asyncio.sleep(2)
    else:
        print("❌ CDP falhou após 3 tentativas")
        await pool.close()
        return

    jsonl = JSONLWriter(OUTPUT)
    tg_client = httpx.AsyncClient(timeout=10)

    last_dash = 0
    await tg_send("✅ Coletor INICIADO\nE-Football + E-Basketball\nPostgreSQL + JSONL + Score-update + CDP Auto-restart", tg_client)

    async def reconectar_cdp():
        nonlocal session, ws
        for _ in range(3):
            try:
                if ws:    await ws.close()
                if session: await session.close()
            except: pass
            try:
                session, ws, url = await cdp_connect()
                print(f"  ✅ CDP reconectado: {url}")
                return True
            except:
                await asyncio.sleep(2)
        return False

    async def reiniciar_tudo():
        nonlocal session, ws
        state.chrome_restarts += 1
        await tg_send(f"🔄 Reiniciando Chrome (#{state.chrome_restarts})...", tg_client)
        ok = await reiniciar_chrome()
        if not ok:
            return False
        return await reconectar_cdp()

    try:
        while True:
            t0 = time.time()
            state.cycles += 1

            try:
                ov = await cdp_fetch(ws, f"{BETANO_API}/overview/2?isInit=true&includeVirtuals=true", state.next_req_id())

                if not ov or (isinstance(ov, dict) and "cdpError" in ov):
                    state.errors         += 1
                    state.erros_seguidos += 1
                else:
                    state.erros_seguidos = 0
                    esports  = get_overview_esports(ov)
                    ts_now   = datetime.now(timezone.utc)
                    now      = time.time()
                    overview_eids = {ev["event_id"] for ev in esports}

                    # ─── 1) Eventos ATIVOS no overview ───────────────────────
                    for ev in esports:
                        await process_active_event(ws, ev, state, jsonl, pool, insert_sql, ts_now)

                    # ─── 2) Move events que sumiram do overview pra ENDING ───
                    for eid in list(state.events):
                        if eid not in overview_eids:
                            old = state.events[eid]
                            ev_info_snapshot = {
                                "event_id": eid,
                                "sport": old["sport"],
                                "league_name": old["liga"],
                                "participants": [
                                    {"name": f"{old['team_a']} ({old['player_a']})"},
                                    {"name": f"{old['team_b']} ({old['player_b']})"},
                                ],
                                "score_home": old.get("score_home"),
                                "score_away": old.get("score_away"),
                                "live_time": old.get("live_time", ""),
                            }
                            state.ending_events[eid] = {
                                "first_seen": now,
                                "ev_info": ev_info_snapshot,
                                "attempts": 0,
                                "last_det_ok": now,
                            }
                            del state.events[eid]
                            print(f"  🔚 Evento {eid} entrou em ENDING (overview removeu)")

                    # ─── 3) Processa ENDING events (até TTL) ─────────────────
                    for eid in list(state.ending_events):
                        info = state.ending_events[eid]
                        age  = now - info["first_seen"]
                        if age > ENDING_TTL_SEG:
                            print(f"  ✅ Evento {eid} finalizado (TTL atingido, {age:.0f}s)")
                            state.cleanup_event(eid)
                            continue
                        if eid in overview_eids:
                            print(f"  🔄 Evento {eid} voltou ao overview")
                            state.ending_events.pop(eid, None)
                            continue
                        await process_ending_event(ws, eid, info, state, jsonl, pool, insert_sql, ts_now)

            except asyncio.TimeoutError:
                state.errors += 1; state.erros_seguidos += 1
                print("  ⚠️ CDP timeout — tentando reconectar...")
                if not await reconectar_cdp():
                    print("  ⚠️ Reconexão falhou — reiniciando Chrome...")
                    if not await reiniciar_tudo():
                        print("  ❌ Chrome não respondeu. Aguardando 30s...")
                        await asyncio.sleep(30)

            except aiohttp.ClientError:
                state.errors += 1; state.erros_seguidos += 1
                print("  ⚠️ Erro de conexão CDP — reconectando...")
                if not await reconectar_cdp():
                    await reiniciar_tudo()

            except Exception as e:
                state.errors += 1; state.erros_seguidos += 1
                print(f"  ❌ {type(e).__name__}: {e}")

            await state.watchdog(tg_client)

            if time.time() - last_dash >= 1:
                dashboard(state)
                last_dash = time.time()

            wait = max(0, POLL_OVERVIEW - (time.time() - t0))
            if wait > 0:
                await asyncio.sleep(wait)

    except KeyboardInterrupt:
        await tg_send(
            f"⏹️ PARADO\nTicks: {state.ticks_saved} | ScoreUpd: {state.score_updates} | "
            f"Chrome restarts: {state.chrome_restarts}",
            tg_client
        )

    except Exception as e:
        await tg_send(f"💀 CRASH\n{type(e).__name__}: {e}", tg_client)
        print(f"\n💀 CRASH:\n{traceback.format_exc()}")

    finally:
        jsonl.close()
        try: await tg_client.aclose()
        except: pass
        try:
            await ws.close()
            await session.close()
        except: pass
        try:
            await pool.close()
        except: pass

    elapsed = time.time() - state.start
    print(f"\n⏹️  {elapsed:.0f}s | {state.ticks_saved} ticks | {state.score_updates} score-updates | "
          f"{state.chrome_restarts} restarts")
    # CDP
    print("🔌 Conectando CDP...")
    session, ws = None, None
    for tentativa in range(3):
        try:
            session, ws, url = await cdp_connect()
            print(f"✅ CDP OK: {url}\n")
            break
        except Exception as e:
            print(f"  Tentativa {tentativa+1}/3 falhou: {e}")
            await asyncio.sleep(2)
    else:
        print("❌ CDP falhou após 3 tentativas")
        return

    # JSONL writer com rotação
    jsonl = JSONLWriter(OUTPUT)

    # httpx persistente pro Telegram (evita criar/fechar sessão a cada alerta)
    tg_client = httpx.AsyncClient(timeout=10)

    last_dash = 0
    await tg_send("✅ Coletor INICIADO\nE-Football + E-Basketball\nJSONL + Score-update + CDP Auto-restart", tg_client)

    async def reconectar_cdp():
        nonlocal session, ws
        for _ in range(3):
            try:
                if ws:    await ws.close()
                if session: await session.close()
            except: pass
            try:
                session, ws, url = await cdp_connect()
                print(f"  ✅ CDP reconectado: {url}")
                return True
            except:
                await asyncio.sleep(2)
        return False

    async def reiniciar_tudo():
        nonlocal session, ws
        state.chrome_restarts += 1
        await tg_send(f"🔄 Reiniciando Chrome (#{state.chrome_restarts})...", tg_client)
        ok = await reiniciar_chrome()
        if not ok:
            return False
        return await reconectar_cdp()

    try:
        while True:
            t0 = time.time()
            state.cycles += 1

            try:
                ov = await cdp_fetch(ws, f"{BETANO_API}/overview/2?isInit=true&includeVirtuals=true", state.next_req_id())

                if not ov or (isinstance(ov, dict) and "cdpError" in ov):
                    state.errors         += 1
                    state.erros_seguidos += 1
                else:
                    state.erros_seguidos = 0
                    esports  = get_overview_esports(ov)
                    ts_now   = datetime.now(timezone.utc)
                    now      = time.time()
                    overview_eids = {ev["event_id"] for ev in esports}

                    # ─── 1) Eventos ATIVOS no overview ───────────────────────
                    for ev in esports:
                        await process_active_event(ws, ev, state, jsonl, ts_now)

                    # ─── 2) Move events que sumiram do overview pra ENDING ───
                    for eid in list(state.events):
                        if eid not in overview_eids:
                            # Snapshot do último estado conhecido pro processamento ending
                            old = state.events[eid]
                            ev_info_snapshot = {
                                "event_id": eid,
                                "sport": old["sport"],
                                "league_name": old["liga"],
                                "participants": [
                                    {"name": f"{old['team_a']} ({old['player_a']})"},
                                    {"name": f"{old['team_b']} ({old['player_b']})"},
                                ],
                                "score_home": old.get("score_home"),
                                "score_away": old.get("score_away"),
                                "live_time": old.get("live_time", ""),
                            }
                            state.ending_events[eid] = {
                                "first_seen": now,
                                "ev_info": ev_info_snapshot,
                                "attempts": 0,
                                "last_det_ok": now,
                            }
                            del state.events[eid]
                            print(f"  🔚 Evento {eid} entrou em ENDING (overview removeu)")

                    # ─── 3) Processa ENDING events (até TTL) ─────────────────
                    for eid in list(state.ending_events):
                        info = state.ending_events[eid]
                        age  = now - info["first_seen"]
                        if age > ENDING_TTL_SEG:
                            print(f"  ✅ Evento {eid} finalizado (TTL atingido, {age:.0f}s)")
                            state.cleanup_event(eid)
                            continue
                        # Se evento voltou pro overview, sai de ending
                        if eid in overview_eids:
                            print(f"  🔄 Evento {eid} voltou ao overview")
                            state.ending_events.pop(eid, None)
                            continue
                        await process_ending_event(ws, eid, info, state, jsonl, pool, insert_sql, ts_now)

            except asyncio.TimeoutError:
                state.errors += 1; state.erros_seguidos += 1
                print("  ⚠️ CDP timeout — tentando reconectar...")
                if not await reconectar_cdp():
                    print("  ⚠️ Reconexão falhou — reiniciando Chrome...")
                    if not await reiniciar_tudo():
                        print("  ❌ Chrome não respondeu. Aguardando 30s...")
                        await asyncio.sleep(30)

            except aiohttp.ClientError:
                state.errors += 1; state.erros_seguidos += 1
                print("  ⚠️ Erro de conexão CDP — reconectando...")
                if not await reconectar_cdp():
                    await reiniciar_tudo()

            except Exception as e:
                state.errors += 1; state.erros_seguidos += 1
                print(f"  ❌ {type(e).__name__}: {e}")

            await state.watchdog(tg_client)

            if time.time() - last_dash >= 1:
                dashboard(state)
                last_dash = time.time()

            wait = max(0, POLL_OVERVIEW - (time.time() - t0))
            if wait > 0:
                await asyncio.sleep(wait)

    except KeyboardInterrupt:
        await tg_send(
            f"⏹️ PARADO\nTicks: {state.ticks_saved} | ScoreUpd: {state.score_updates} | "
            f"Chrome restarts: {state.chrome_restarts}",
            tg_client
        )

    except Exception as e:
        await tg_send(f"💀 CRASH\n{type(e).__name__}: {e}", tg_client)
        print(f"\n💀 CRASH:\n{traceback.format_exc()}")


if __name__ == "__main__":
    asyncio.run(main())
