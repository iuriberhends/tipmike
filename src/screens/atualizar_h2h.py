# -*- coding: utf-8 -*-
"""
atualizar_h2h.py v2 — mantém h2h_matches a partir dos ticks. BLINDADO.

O v1 funcionava, mas do jeito que derruba sistema em silêncio:
  - SEM trava de instância: hoje havia TRÊS cópias rodando na VPS
    (duas desde 28/07 + uma de 02/08) disputando o mesmo trabalho;
  - `desde = now()` no boot: se o processo cair e voltar 2h depois,
    os jogos dessas 2h NUNCA entram (buraco permanente e invisível);
  - processo solto (sem serviço): morre e ninguém fica sabendo — o
    mesmo filme do fase2, que congelou o h2h_historico por 50 dias.

Agora o backtest v15 DEPENDE desta tabela (a perna rápida do H2H lê
daqui), então o v2 fecha os três buracos:
  1. INSTÂNCIA ÚNICA por trava de porta local (47231): segunda cópia
     detecta e sai na hora com mensagem clara.
  2. RETOMADA REAL: cada ciclo processa desde MAX(ts_fim) da própria
     tabela − 15min (janela deslizante idempotente — o ON CONFLICT
     absorve o overlap). Queda de horas = recuperação automática no
     primeiro ciclo de volta.
  3. Pronto pra rodar como SERVIÇO nssm (log em arquivo, flush, saída
     limpa) — instruções no fim deste cabeçalho.

Instalar como serviço (cmd como ADMIN, depois de MATAR as cópias soltas):
    taskkill /f /pid 5248 & taskkill /f /pid 5296 & taskkill /f /pid 11204
    "C:\\nssm-2.24\\win64\\nssm.exe" install atualizarh2h "C:\\Users\\Administrator\\PyCharmMiscProject\\.venv\\Scripts\\python.exe" "C:\\Users\\Administrator\\PyCharmMiscProject\\atualizar_h2h.py"
    "C:\\nssm-2.24\\win64\\nssm.exe" set atualizarh2h AppDirectory "C:\\Users\\Administrator\\PyCharmMiscProject"
    "C:\\nssm-2.24\\win64\\nssm.exe" set atualizarh2h AppStdout "C:\\Users\\Administrator\\PyCharmMiscProject\\atualizar_h2h.log"
    "C:\\nssm-2.24\\win64\\nssm.exe" set atualizarh2h AppStderr "C:\\Users\\Administrator\\PyCharmMiscProject\\atualizar_h2h.log"
    "C:\\nssm-2.24\\win64\\nssm.exe" set atualizarh2h AppExit Default Restart
    "C:\\nssm-2.24\\win64\\nssm.exe" start atualizarh2h

Uso manual (diagnóstico):
    python atualizar_h2h.py --populate   -> popula tudo do zero (1x)
    python atualizar_h2h.py --uma-vez    -> roda 1 ciclo e sai
    python atualizar_h2h.py              -> loop contínuo (60s)
"""

import asyncio
import argparse
import socket
import sys
from datetime import datetime, timedelta, timezone

import asyncpg

PG_DSN = "postgresql://postgres:mikedb0702@localhost:5432/mikedb"

PORTA_TRAVA = 47231          # trava de instância única (localhost)
INTERVALO_S = 60             # ciclo do loop
MARGEM_RETOMADA = timedelta(minutes=15)   # overlap idempotente por ciclo
RECUO_MAXIMO = timedelta(days=3)          # teto do catch-up (retenção dos ticks)

CREATE_TABLE = """
CREATE TABLE IF NOT EXISTS h2h_matches (
    id          BIGSERIAL PRIMARY KEY,
    bookmaker   TEXT NOT NULL,
    sport       TEXT NOT NULL,
    liga        TEXT NOT NULL,
    event_id    TEXT NOT NULL,
    jogador_a   TEXT NOT NULL,
    jogador_b   TEXT NOT NULL,
    score_a     SMALLINT,
    score_b     SMALLINT,
    total       SMALLINT,
    ts_fim      TIMESTAMPTZ,
    UNIQUE (bookmaker, event_id)
);
CREATE INDEX IF NOT EXISTS idx_h2h_par   ON h2h_matches (jogador_a, jogador_b);
CREATE INDEX IF NOT EXISTS idx_h2h_sport ON h2h_matches (sport, liga);
CREATE INDEX IF NOT EXISTS idx_h2h_ts    ON h2h_matches (ts_fim DESC);
-- v2: indice na medida da consulta do runner v15 (casa+esporte+par).
-- O idx_h2h_par sozinho ja resolvia em ~5ms; este derruba pra ~1ms e
-- livra o filtro posterior. Barato: a tabela inteira tem ~660k linhas.
CREATE INDEX IF NOT EXISTS idx_h2h_casa_par
    ON h2h_matches (bookmaker, sport, jogador_a, jogador_b);
"""

# resultado final de cada jogo = tick de maior soma de placar (mesma
# regra do v1 — placar só cresce; empate de soma decide pelo tick mais
# recente via DISTINCT ON ... ts DESC)
QUERY_UPSERT = """
WITH max_scores AS (
    SELECT event_id, bookmaker, MAX(score_home + score_away) AS max_total
    FROM ticks
    WHERE jogador_a IS NOT NULL AND jogador_b IS NOT NULL
      AND score_home IS NOT NULL AND score_away IS NOT NULL
      AND ts >= $1
    GROUP BY event_id, bookmaker
),
final_ticks AS (
    SELECT DISTINCT ON (t.event_id, t.bookmaker)
        t.bookmaker, t.sport, t.liga, t.event_id,
        t.jogador_a, t.jogador_b, t.score_home, t.score_away, t.ts
    FROM ticks t
    INNER JOIN max_scores ms
        ON t.event_id = ms.event_id AND t.bookmaker = ms.bookmaker
       AND (t.score_home + t.score_away) = ms.max_total
    WHERE t.jogador_a IS NOT NULL AND t.jogador_b IS NOT NULL
    ORDER BY t.event_id, t.bookmaker, t.ts DESC
)
INSERT INTO h2h_matches (bookmaker, sport, liga, event_id, jogador_a,
                         jogador_b, score_a, score_b, total, ts_fim)
SELECT
    bookmaker,
    COALESCE(sport, 'unknown'),
    COALESCE(liga, 'unknown'),
    event_id,
    CASE WHEN jogador_a <= jogador_b THEN jogador_a ELSE jogador_b END,
    CASE WHEN jogador_a <= jogador_b THEN jogador_b ELSE jogador_a END,
    CASE WHEN jogador_a <= jogador_b THEN score_home ELSE score_away END,
    CASE WHEN jogador_a <= jogador_b THEN score_away ELSE score_home END,
    score_home + score_away,
    ts
FROM final_ticks
ON CONFLICT (bookmaker, event_id) DO UPDATE
    SET score_a = EXCLUDED.score_a,
        score_b = EXCLUDED.score_b,
        total   = EXCLUDED.total,
        ts_fim  = EXCLUDED.ts_fim
WHERE h2h_matches.total < EXCLUDED.total
RETURNING id
"""

QUERY_POPULATE = QUERY_UPSERT.replace("AND ts >= $1\n", "")


def _log(msg: str):
    print(f"[{datetime.now().strftime('%d/%m %H:%M:%S')}] {msg}", flush=True)


def travar_instancia() -> socket.socket:
    """Trava de instância única via bind em porta local. A segunda cópia
    falha no bind e sai — em vez de trabalhar em duplicata (havia TRÊS)."""
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.bind(("127.0.0.1", PORTA_TRAVA))
        s.listen(1)
        return s
    except OSError:
        _log(f"JA EXISTE outra instancia (porta {PORTA_TRAVA} ocupada). Saindo.")
        sys.exit(0)


async def ponto_de_retomada(conn) -> datetime:
    """De onde continuar: MAX(ts_fim) da propria tabela − margem.
    Queda de horas => o primeiro ciclo cobre o buraco inteiro (ate o
    teto da retencao dos ticks). Tabela vazia => recuo maximo."""
    ultimo = await conn.fetchval("SELECT MAX(ts_fim) FROM h2h_matches")
    agora = datetime.now(timezone.utc)
    if ultimo is None:
        return agora - RECUO_MAXIMO
    desde = ultimo - MARGEM_RETOMADA
    if agora - desde > RECUO_MAXIMO:
        desde = agora - RECUO_MAXIMO
    return desde


async def um_ciclo(pool) -> int:
    async with pool.acquire() as conn:
        desde = await ponto_de_retomada(conn)
        rows = await conn.fetch(QUERY_UPSERT, desde)
        return len(rows)


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--populate", action="store_true")
    ap.add_argument("--uma-vez", action="store_true")
    args = ap.parse_args()

    trava = travar_instancia()  # noqa: F841 (mantida viva pelo escopo)

    pool = await asyncpg.create_pool(PG_DSN, min_size=1, max_size=3)
    try:
        async with pool.acquire() as conn:
            await conn.execute(CREATE_TABLE)
        _log("tabela/indices OK")

        if args.populate:
            async with pool.acquire() as conn:
                rows = await conn.fetch(QUERY_POPULATE)
                total = await conn.fetchval("SELECT COUNT(*) FROM h2h_matches")
            _log(f"populate: {len(rows)} upserts | total {total}")
            return

        if args.uma_vez:
            n = await um_ciclo(pool)
            _log(f"ciclo unico: {n} upserts")
            return

        _log(f"loop continuo ({INTERVALO_S}s), retomada automatica ate "
             f"{RECUO_MAXIMO.days}d pra tras")
        while True:
            try:
                n = await um_ciclo(pool)
                if n:
                    _log(f"+{n} jogos")
            except Exception as e:
                _log(f"AVISO: {str(e)[:200]}")
            await asyncio.sleep(INTERVALO_S)
    finally:
        await pool.close()


if __name__ == "__main__":
    asyncio.run(main())
