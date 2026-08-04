// src/shared/MikeDbPanel.jsx
// ---------------------------------------------------------------------------
// Aba "MikeDB" da seção 1 do backtest avulso.
//
// O servidor gera o parquet (histórico dos coletores ou BetsAPI) e devolve o
// MESMO upload_id do upload manual — daqui pra frente o fluxo é idêntico.
//
// v2 (UX): o <select> nativo era ILEGÍVEL no tema escuro — o popup do Windows
// é claro e o texto herdava a cor clara do tema, então as opções sumiam.
// Trocado por controles próprios:
//   • Casa / Mercado / Origem -> segmentado (1 clique, tudo à vista, sem popup)
//   • Liga                    -> combobox COM BUSCA (são 224: rolar num select
//                                nativo é inviável)
//   • Período                 -> atalhos (7/15/30d, tudo) + datas com limites
//   • rodapé com o resumo do que vai ser gerado + aviso de recorte gigante
// ---------------------------------------------------------------------------
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Play, Download, RefreshCw, CheckCircle2, AlertTriangle, Terminal,
  Search, ChevronDown, X, Calendar,
} from 'lucide-react';
import { ApiMikeDb } from '../lib/api.js';

const POLL_MS = 2000;
const STALL_MS = 15 * 60 * 1000;
const TETO_MS = 8 * 60 * 60 * 1000;

// nomes de pasta vêm sanitizados e com mojibake ("Liga_dos_CampeÃµes"):
// arruma só pra EXIBIR — o valor enviado ao servidor é sempre o cru.
const MOJIBAKE = [['Ã§', 'ç'], ['Ã£', 'ã'], ['Ãµ', 'õ'], ['Ã©', 'é'], ['Ã¡', 'á'],
                  ['Ã­', 'í'], ['Ã³', 'ó'], ['Ãº', 'ú'], ['Ã ', 'à'], ['Ã¢', 'â'],
                  ['Ãª', 'ê'], ['Ã´', 'ô'], ['Ã‡', 'Ç'], ['Ã‰', 'É'], ['Âº', 'º']];

function bonito(v) {
  let s = String(v || '');
  MOJIBAKE.forEach(([a, b]) => { s = s.split(a).join(b); });
  return s.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
}

const MERCADOS = [
  { valor: '', rotulo: 'Todos' },
  { valor: 'HANDICAP', rotulo: 'Handicap' },
  { valor: 'OVER_UNDER', rotulo: 'Over/Under' },
  { valor: 'MATCH_RESULT', rotulo: 'Money Line' },
];

const iso = (d) => d.toISOString().slice(0, 10);
function diasEntre(a, b) {
  if (!a || !b) return null;
  const ms = new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`);
  return Math.max(0, Math.round(ms / 86400000)) + 1;
}

/* ---------------------------------------------------------- segmentado --- */
function Segmentado({ valor, onChange, opcoes, disabled }) {
  return (
    <div className="flex flex-wrap gap-1">
      {opcoes.map((o) => {
        const ativo = valor === o.valor;
        return (
          <button key={o.valor || '_'} type="button" disabled={disabled}
            onClick={() => onChange(o.valor)}
            className="px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition disabled:opacity-40"
            style={ativo
              ? { backgroundColor: 'rgba(6,182,212,0.16)', color: '#22d3ee', border: '0.5px solid rgba(6,182,212,0.45)' }
              : { color: 'var(--mike-fg-muted)', border: '0.5px solid rgba(255,255,255,0.08)' }}>
            {o.rotulo}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------ combobox --- */
function ComboLiga({ ligas, valor, onChange, disabled }) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const caixaRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!aberto) return undefined;
    const fora = (e) => { if (caixaRef.current && !caixaRef.current.contains(e.target)) setAberto(false); };
    const esc = (e) => { if (e.key === 'Escape') setAberto(false); };
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', esc);
    const t = setTimeout(() => inputRef.current?.focus(), 10);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', fora);
      document.removeEventListener('keydown', esc);
    };
  }, [aberto]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return ligas;
    return ligas.filter((l) => bonito(l.liga).toLowerCase().includes(q));
  }, [ligas, busca]);

  const selecionada = ligas.find((l) => l.liga === valor);

  return (
    <div className="relative" ref={caixaRef}>
      <button type="button" disabled={disabled} onClick={() => setAberto((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-md text-[11px] transition disabled:opacity-40 mike-border-thin hover:border-cyan-500/40"
        style={{ color: selecionada ? 'var(--mike-fg)' : 'var(--mike-fg-muted)' }}>
        <span className="truncate text-left">
          {selecionada ? bonito(selecionada.liga) : 'Todas as ligas'}
        </span>
        <span className="flex items-center gap-1 shrink-0">
          {selecionada && (
            <X className="w-3 h-3 opacity-60 hover:opacity-100"
               onClick={(e) => { e.stopPropagation(); onChange(''); }} />
          )}
          <ChevronDown className="w-3.5 h-3.5 opacity-60" />
        </span>
      </button>

      {aberto && (
        <div className="absolute z-30 mt-1 w-full rounded-md overflow-hidden shadow-2xl"
             style={{ backgroundColor: '#0d1424', border: '0.5px solid rgba(255,255,255,0.12)' }}>
          <div className="flex items-center gap-1.5 px-2 py-1.5"
               style={{ borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
            <Search className="w-3 h-3 text-[--mike-fg-muted] shrink-0" />
            <input ref={inputRef} value={busca} onChange={(e) => setBusca(e.target.value)}
                   placeholder="buscar liga..."
                   className="w-full bg-transparent outline-none text-[11px] text-[--mike-fg] placeholder:text-[--mike-fg-muted]" />
            <span className="text-[9px] text-[--mike-fg-muted] shrink-0">{filtradas.length}</span>
          </div>
          <div className="max-h-56 overflow-auto">
            <button type="button" onClick={() => { onChange(''); setAberto(false); }}
              className="w-full text-left px-2.5 py-1.5 text-[11px] hover:bg-cyan-500/10 transition"
              style={{ color: !valor ? '#22d3ee' : 'var(--mike-fg-soft)' }}>
              Todas as ligas
            </button>
            {filtradas.map((l) => (
              <button key={l.liga} type="button"
                onClick={() => { onChange(l.liga); setAberto(false); setBusca(''); }}
                className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-[11px] hover:bg-cyan-500/10 transition"
                style={{ color: valor === l.liga ? '#22d3ee' : 'var(--mike-fg-soft)' }}>
                <span className="truncate text-left">{bonito(l.liga)}</span>
                <span className="text-[9px] text-[--mike-fg-muted] shrink-0">{l.dias}d</span>
              </button>
            ))}
            {filtradas.length === 0 && (
              <div className="px-2.5 py-3 text-[10px] text-[--mike-fg-muted] text-center">
                nenhuma liga encontrada
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================== painel === */
export default function MikeDbPanel({ onGerado }) {
  const [status, setStatus] = useState(null);
  const [catalogo, setCatalogo] = useState(null);
  const [carregando, setCarregando] = useState(true);

  const [casa, setCasa] = useState('');
  const [liga, setLiga] = useState('');
  const [mercado, setMercado] = useState('');
  const [jogador, setJogador] = useState('');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [via, setVia] = useState('auto');

  const [fase, setFase] = useState('idle');
  const [pct, setPct] = useState(0);
  const [etapa, setEtapa] = useState('');
  const [log, setLog] = useState([]);
  const [verLog, setVerLog] = useState(false);
  const [erro, setErro] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [baixando, setBaixando] = useState(false);

  const pollRef = useRef(null);
  const vivoRef = useRef(true);
  useEffect(() => () => { vivoRef.current = false; clearInterval(pollRef.current); }, []);

  const carregar = useCallback(async (casaAlvo, manterDatas) => {
    setCarregando(true); setErro(null);
    try {
      const [st, cat] = await Promise.all([
        ApiMikeDb.status(),
        ApiMikeDb.catalogo(casaAlvo || undefined),
      ]);
      if (!vivoRef.current) return;
      setStatus(st); setCatalogo(cat);
      if (cat?.periodo && !manterDatas) { setDe(cat.periodo.de); setAte(cat.periodo.ate); }
    } catch (e) {
      setErro(String(e.message || e));
    } finally {
      if (vivoRef.current) setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar('', false); /* eslint-disable-next-line */ }, []);

  const trocarCasa = async (nova) => {
    setCasa(nova); setLiga(''); setVia('auto');
    await carregar(nova, true);
  };

  const atalhoPeriodo = (dias) => {
    const fim = catalogo?.periodo?.ate || iso(new Date());
    if (!dias) { setDe(catalogo?.periodo?.de || ''); setAte(fim); return; }
    const d = new Date(`${fim}T00:00:00`);
    d.setDate(d.getDate() - (dias - 1));
    setDe(iso(d)); setAte(fim);
  };

  const casaEhBet365 = (casa || '').toLowerCase() === 'bet365';
  const usandoBetsapi = via === 'betsapi' || (via === 'auto' && casaEhBet365);
  const ligasDisp = catalogo?.ligas || [];
  const nDias = diasEntre(de, ate);
  const recorteGrande = !liga && !casa && (nDias || 0) > 30;

  /* ------------------------------------------------------------ gerar --- */
  const seguir = useCallback((jobId) => {
    const inicio = Date.now();
    let ultimoAvanco = Date.now(); let ultimoPct = -1;
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const parado = Date.now() - ultimoAvanco > STALL_MS;
      if (parado || Date.now() - inicio > TETO_MS) {
        clearInterval(pollRef.current);
        if (vivoRef.current) {
          setFase('idle');
          setErro(parado ? 'A geração ficou 15min sem avançar — pode ter morrido no servidor.'
                         : 'Acompanhamento encerrado; o job pode seguir no servidor.');
        }
        return;
      }
      try {
        const j = await ApiMikeDb.job(jobId);
        if (!vivoRef.current) return;
        if (j.progresso !== ultimoPct) { ultimoPct = j.progresso; ultimoAvanco = Date.now(); }
        setPct(j.progresso || 0); setEtapa(j.etapa || ''); setLog(j.log || []);
        if (j.status === 'concluido') {
          clearInterval(pollRef.current);
          setResultado(j.resultado); setFase('pronto');
          onGerado?.(j.resultado);
        } else if (j.status === 'erro') {
          clearInterval(pollRef.current);
          setErro(j.erro || 'falhou'); setFase('idle'); setVerLog(true);
        }
      } catch (e) {
        clearInterval(pollRef.current);
        if (vivoRef.current) { setErro(String(e.message || e)); setFase('idle'); }
      }
    }, POLL_MS);
  }, [onGerado]);

  const gerar = async () => {
    setErro(null); setResultado(null); setLog([]); setPct(0);
    setEtapa('enviando pedido...'); setFase('gerando');
    try {
      const { job_id } = await ApiMikeDb.gerar({
        casa: casa || undefined, liga: liga || undefined,
        mercado: mercado || undefined, jogador: jogador || undefined,
        de: de || undefined, ate: ate || undefined, via,
      });
      seguir(job_id);
    } catch (e) { setErro(String(e.message || e)); setFase('idle'); }
  };

  const baixar = async () => {
    if (!resultado?.upload_id) return;
    setBaixando(true);
    try { await ApiMikeDb.download(resultado.upload_id, resultado.arquivo); }
    catch (e) { setErro(`falha ao baixar: ${e.message || e}`); }
    finally { setBaixando(false); }
  };

  /* --------------------------------------------------------------- UI --- */
  const gerando = fase === 'gerando';
  const labelCls = 'block text-[10px] font-semibold text-[--mike-fg-muted] mb-1.5';
  const dataCls = 'w-full px-2 py-1.5 rounded-md text-[11px] bg-transparent mike-border-thin text-[--mike-fg] outline-none focus:border-cyan-500/60 transition [color-scheme:dark]';

  if (carregando && !catalogo) {
    return (
      <div className="flex items-center gap-2 text-[11px] text-[--mike-fg-muted] py-4">
        <RefreshCw className="w-3.5 h-3.5 mike-spin" /> lendo o catálogo do servidor...
      </div>
    );
  }

  return (
    <div className="space-y-3.5">
      {status && !status.hist_existe && (
        <div className="rounded-md p-2 text-[10px] flex items-start gap-1.5"
             style={{ backgroundColor: 'rgba(245,158,11,0.08)', border: '0.5px solid rgba(245,158,11,0.3)' }}>
          <AlertTriangle className="w-3 h-3 text-amber-400 mt-0.5 shrink-0" />
          <span className="text-amber-300">histórico não encontrado em <code>{status.hist_dir}</code></span>
        </div>
      )}

      {/* CASA */}
      <div>
        <label className={labelCls}>Casa</label>
        <Segmentado disabled={gerando} valor={casa} onChange={trocarCasa}
          opcoes={[{ valor: '', rotulo: 'Todas' },
                   ...(catalogo?.casas || []).map((c) => ({ valor: c, rotulo: c }))]} />
      </div>

      {/* bet365: duas origens possíveis */}
      {casaEhBet365 && (
        <div>
          <label className={labelCls}>Origem dos ticks</label>
          <Segmentado disabled={gerando} valor={usandoBetsapi ? 'betsapi' : 'historico'}
            onChange={setVia}
            opcoes={[{ valor: 'historico', rotulo: `Histórico local${ligasDisp.length ? '' : ' (vazio)'}` },
                     { valor: 'betsapi', rotulo: 'Raspar BetsAPI' }]} />
          {usandoBetsapi && (
            <div className="mt-1.5 text-[10px] flex items-start gap-1.5"
                 style={{ color: status?.chrome_cdp_aberto ? '#34d399' : '#fbbf24' }}>
              {status?.chrome_cdp_aberto
                ? <><CheckCircle2 className="w-3 h-3 mt-0.5 shrink-0" /> Chrome do CDP aberto — pode raspar (períodos longos levam horas).</>
                : <><AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" /> Chrome do CDP fechado — abra na VPS com --remote-debugging-port=9222 logado na BetsAPI.</>}
            </div>
          )}
        </div>
      )}

      {/* LIGA */}
      <div>
        <label className={labelCls}>
          Liga{!usandoBetsapi && ligasDisp.length ? <span className="opacity-60"> · {ligasDisp.length} disponíveis</span> : null}
        </label>
        {usandoBetsapi ? (
          <Segmentado disabled={gerando} valor={liga} onChange={setLiga}
            opcoes={(status?.ligas_betsapi || []).map((l) => ({ valor: l.valor, rotulo: l.rotulo }))} />
        ) : (
          <ComboLiga ligas={ligasDisp} valor={liga} onChange={setLiga} disabled={gerando} />
        )}
      </div>

      {/* PERÍODO */}
      <div>
        <label className={labelCls}>Período</label>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1">
            {[[7, '7d'], [15, '15d'], [30, '30d'], [0, 'Tudo']].map(([d, r]) => (
              <button key={r} type="button" disabled={gerando} onClick={() => atalhoPeriodo(d)}
                className="px-2 py-1.5 rounded-md text-[10px] font-semibold text-[--mike-fg-muted] hover:text-cyan-300 transition disabled:opacity-40"
                style={{ border: '0.5px solid rgba(255,255,255,0.08)' }}>
                {r}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 flex-1" style={{ minWidth: 240 }}>
            <input type="date" className={dataCls} value={de} disabled={gerando}
                   min={catalogo?.periodo?.de} max={catalogo?.periodo?.ate}
                   onChange={(e) => setDe(e.target.value)} />
            <span className="text-[--mike-fg-muted] text-[10px]">até</span>
            <input type="date" className={dataCls} value={ate} disabled={gerando}
                   min={catalogo?.periodo?.de} max={catalogo?.periodo?.ate}
                   onChange={(e) => setAte(e.target.value)} />
          </div>
        </div>
        {catalogo?.periodo && (
          <div className="mt-1 text-[9px] text-[--mike-fg-muted] flex items-center gap-1">
            <Calendar className="w-2.5 h-2.5" />
            histórico cobre {catalogo.periodo.de} a {catalogo.periodo.ate}
          </div>
        )}
      </div>

      {/* MERCADO + JOGADOR */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Mercado</label>
          <Segmentado disabled={gerando} valor={mercado} onChange={setMercado} opcoes={MERCADOS} />
        </div>
        <div>
          <label className={labelCls}>Jogador <span className="opacity-60">· opcional</span></label>
          <input className="w-full px-2.5 py-1.5 rounded-md text-[11px] bg-transparent mike-border-thin text-[--mike-fg] outline-none focus:border-cyan-500/60 transition placeholder:text-[--mike-fg-muted]"
                 value={jogador} disabled={gerando} placeholder="ex: CARNAGE"
                 onChange={(e) => setJogador(e.target.value.toUpperCase())} />
        </div>
      </div>

      {/* RESUMO DA SELEÇÃO + AÇÃO */}
      <div className="rounded-md p-2.5 flex flex-wrap items-center justify-between gap-2"
           style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '0.5px solid rgba(255,255,255,0.07)' }}>
        <div className="text-[10px] text-[--mike-fg-soft] flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="font-semibold text-[--mike-fg]">{casa || 'todas as casas'}</span>
          <span className="opacity-40">·</span>
          <span>{liga ? bonito(liga) : 'todas as ligas'}</span>
          <span className="opacity-40">·</span>
          <span>{nDias ? `${nDias} dia${nDias > 1 ? 's' : ''}` : 'período aberto'}</span>
          {mercado && (<><span className="opacity-40">·</span><span>{MERCADOS.find((m) => m.valor === mercado)?.rotulo}</span></>)}
          {jogador && (<><span className="opacity-40">·</span><span>{jogador}</span></>)}
        </div>
        <div className="flex items-center gap-2">
          {resultado?.upload_id && (
            <button onClick={baixar} disabled={baixando}
              className="flex items-center gap-1.5 px-3 py-2 rounded-md text-[11px] font-semibold mike-border-thin text-[--mike-fg-soft] hover:text-[--mike-fg] transition">
              {baixando ? <RefreshCw className="w-3.5 h-3.5 mike-spin" /> : <Download className="w-3.5 h-3.5" />}
              Baixar
            </button>
          )}
          {log.length > 0 && (
            <button onClick={() => setVerLog((v) => !v)}
              className="flex items-center gap-1 px-2 py-2 rounded-md text-[10px] text-[--mike-fg-muted] hover:text-[--mike-fg] transition">
              <Terminal className="w-3 h-3" /> log
            </button>
          )}
          <button onClick={gerar} disabled={gerando}
            className="flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-bold transition disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: gerando ? 'rgba(6,182,212,0.2)' : '#06b6d4', color: gerando ? '#6b7691' : '#0b0f1a' }}>
            {gerando ? <><RefreshCw className="w-3.5 h-3.5 mike-spin" /> Gerando...</>
                     : <><Play className="w-3.5 h-3.5" /> Gerar ticks</>}
          </button>
        </div>
      </div>

      {recorteGrande && !gerando && (
        <div className="text-[10px] flex items-start gap-1.5" style={{ color: '#fbbf24' }}>
          <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
          todas as casas e ligas em {nDias} dias vira um arquivo enorme e lento — escolha ao menos a casa.
        </div>
      )}

      {gerando && (
        <div className="space-y-1">
          <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
            <div className="h-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: '#06b6d4' }} />
          </div>
          <div className="flex justify-between text-[10px] text-[--mike-fg-muted]">
            <span>{etapa}</span><span>{pct}%</span>
          </div>
        </div>
      )}

      {resultado && (
        <div className="rounded-md p-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px]"
             style={{ backgroundColor: 'rgba(16,185,129,0.06)', border: '0.5px solid rgba(16,185,129,0.25)' }}>
          <span className="flex items-center gap-1 text-emerald-400 font-bold">
            <CheckCircle2 className="w-3 h-3" /> {(resultado.linhas ?? 0).toLocaleString()} ticks
          </span>
          <span className="text-[--mike-fg-muted]">
            {resultado.ts_min?.slice(0, 10) || '?'} a {resultado.ts_max?.slice(0, 10) || '?'}
          </span>
          <span className="text-[--mike-fg-muted]">casas: {resultado.casas?.join(', ') || '-'}</span>
          <span className="text-emerald-400/70">pronto pro backtest ↓</span>
        </div>
      )}

      {erro && (
        <div className="rounded-md p-2 text-[10px] text-red-300 flex items-start gap-1.5"
             style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '0.5px solid rgba(239,68,68,0.3)' }}>
          <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" /> <span>{erro}</span>
        </div>
      )}

      {verLog && log.length > 0 && (
        <pre className="rounded-md p-2 text-[9px] leading-relaxed overflow-auto max-h-52"
             style={{ backgroundColor: 'rgba(0,0,0,0.35)', border: '0.5px solid rgba(255,255,255,0.07)', color: '#8b93a7', fontFamily: 'ui-monospace, monospace' }}>
          {log.join('\n')}
        </pre>
      )}
    </div>
  );
}