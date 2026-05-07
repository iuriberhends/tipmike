import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  Search, ChevronDown, ChevronUp, Home, Clock, ExternalLink, X, FilterX,
  Gamepad2, Snowflake, Check, RefreshCw, TrendingUp, TrendingDown,
  BarChart2, Activity, Zap, ChevronRight
} from 'lucide-react';
import MikeHeader from '../shared/MikeHeader.jsx';
import { ApiEventos, ApiH2H } from '../lib/api.js';

// ============================================================
// TEMAS POR ESPORTE
// ============================================================
const TEMA = {
  'E-Football': {
    icone: Gamepad2, label: 'e-Soccer',
    cardBorder: 'rgba(16,185,129,0.5)', headerBg: 'bg-emerald-900/40',
    headerText: 'text-emerald-300', dot: 'bg-emerald-400',
    timerText: 'text-emerald-300', timerIcon: 'text-emerald-400/80',
    btnActive: 'bg-emerald-500/15 border-emerald-500 text-emerald-300',
  },
  'E-Basketball': {
    icone: Gamepad2, label: 'e-Basket',
    cardBorder: 'rgba(244,63,94,0.5)', headerBg: 'bg-rose-950/50',
    headerText: 'text-rose-400', dot: 'bg-rose-400',
    timerText: 'text-rose-400', timerIcon: 'text-rose-400/80',
    btnActive: 'bg-rose-500/15 border-rose-500 text-rose-300',
  },
  'E-Hockey': {
    icone: Snowflake, label: 'e-Hockey',
    cardBorder: 'rgba(6,182,212,0.5)', headerBg: 'bg-cyan-950/50',
    headerText: 'text-cyan-300', dot: 'bg-cyan-400',
    timerText: 'text-cyan-300', timerIcon: 'text-cyan-400/80',
    btnActive: 'bg-cyan-500/15 border-cyan-500 text-cyan-300',
  },
};

const ESPORTES = [
  { id: 'E-Football',   label: 'e-Soccer' },
  { id: 'E-Basketball', label: 'e-Basket' },
  { id: 'E-Hockey',     label: 'e-Hockey' },
];

// Nomes amigáveis para mercados
const MERCADO_NOMES = {
  'OVER_UNDER':    'Over/Under',
  'HANDICAP':      'Handicap',
  'MATCH_RESULT':  'Resultado Final',
  'PLAYER_TOTAL':  'Jogador - Gols',
  'PERIOD_TOTAL':  'Total por Período',
  'PERIOD_RESULT': 'Resultado Período',
  'CORRECT_SCORE': 'Placar Correto',
  'BTTS':          'Ambos Marcam',
  'DOUBLE_CHANCE': 'Dupla Hipótese',
  'ODD_EVEN':      'Par/Ímpar',
  'SCORE_UPDATE':  null, // esconde
};

function nomeAmigavel(mercado, tipo) {
  if (MERCADO_NOMES[tipo] === null) return null; // esconde SCORE_UPDATE
  if (MERCADO_NOMES[tipo]) return MERCADO_NOMES[tipo];
  return (mercado || '').replace(/\s*\[\d+\]\s*/g, '').trim() || tipo || 'Mercado';
}

function normalizaTxt(s) {
  return (s || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// ============================================================
// HOOKS
// ============================================================
function useEventosLive(sport) {
  const [state, setState] = useState({ data: [], loading: true, error: null });
  const lastReq = useRef(0);

  const fetch_ = useCallback(async () => {
    const id = ++lastReq.current;
    setState(s => ({ ...s, loading: true }));
    try {
      const params = {};
      if (sport) params.sport = sport;
      const data = await ApiEventos.live(params);
      if (id === lastReq.current) setState({ data: data || [], loading: false, error: null });
    } catch (e) {
      if (id === lastReq.current) setState({ data: [], loading: false, error: e });
    }
  }, [sport]);

  useEffect(() => { fetch_(); }, [fetch_]);
  return { ...state, refetch: fetch_ };
}

function useOddsEvento(eventId) {
  const [odds, setOdds] = useState([]);
  useEffect(() => {
    if (!eventId) return;
    ApiEventos.odds(eventId).then(d => setOdds(d || [])).catch(() => setOdds([]));
  }, [eventId]);
  return odds;
}

function useH2H(ja, jb, enabled) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!enabled || !ja || !jb) return;
    setLoading(true);
    ApiH2H.stats(ja, jb, { limit: 20 })
      .then(d => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [ja, jb, enabled]);
  return { data, loading };
}

// ============================================================
// PROCESSAMENTO DE ODDS
// ============================================================
function processarMercados(odds) {
  const mapa = new Map();
  for (const o of odds) {
    const nome = nomeAmigavel(o.mercado, o.mercado_tipo);
    if (!nome) continue; // esconde SCORE_UPDATE
    if (!mapa.has(nome)) mapa.set(nome, { nome, linhas: [] });
    mapa.get(nome).linhas.push({
      sel: o.selecao || '',
      odd: o.odds ? Number(o.odds) : null,
      linha: o.linha || '',
    });
  }
  const prioridade = ['Over/Under', 'Resultado Final', 'Handicap', 'Jogador - Gols', 'Ambos Marcam'];
  const todos = Array.from(mapa.values());
  todos.sort((a, b) => {
    const ia = prioridade.findIndex(p => a.nome.includes(p));
    const ib = prioridade.findIndex(p => b.nome.includes(p));
    if (ia === -1 && ib === -1) return 0;
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
  return todos;
}

// ============================================================
// COMPONENTES
// ============================================================
function BookmakerChip({ casa }) {
  const cores = {
    bet365:     'bg-emerald-500/15 border-emerald-500/40 text-emerald-300',
    betano:     'bg-blue-500/15 border-blue-500/40 text-blue-300',
    superbet:   'bg-amber-500/15 border-amber-500/40 text-amber-300',
    estrelabet: 'bg-purple-500/15 border-purple-500/40 text-purple-300',
  };
  return (
    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${cores[casa] || 'bg-slate-500/15 border-slate-500/40 text-slate-300'}`}>
      {casa}
    </span>
  );
}

function TabelaMercado({ mercado }) {
  const maxOdd = Math.max(...mercado.linhas.map(l => l.odd || 0));
  return (
    <div className="rounded-md overflow-hidden" style={{ backgroundColor: '#0d1220', border: '0.5px solid rgba(60,85,130,0.4)' }}>
      <div className="px-2 py-1 text-center" style={{ backgroundColor: '#1a2540', borderBottom: '0.5px solid rgba(60,85,130,0.4)' }}>
        <span className="text-[10px] font-bold text-[--mike-fg]">{mercado.nome}</span>
      </div>
      <div className="px-2 py-1">
        {mercado.linhas.map((l, i) => (
          <div key={i} className="flex items-center gap-1.5 py-0.5">
            <div className="flex-1 min-w-0 text-[10px] text-[--mike-fg-soft] truncate">
              {l.sel}{l.linha ? ` ${l.linha}` : ''}
            </div>
            <div className={`text-[10px] font-mono font-bold flex-shrink-0 px-1 rounded ${
              l.odd === maxOdd && maxOdd > 1.5 ? 'text-emerald-300 bg-emerald-500/10' : 'text-[--mike-fg]'
            }`}>
              {l.odd === null ? '—' : l.odd.toFixed(2)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniBarraGols({ jogos }) {
  if (!jogos?.length) return null;
  return (
    <div className="flex items-end gap-0.5" style={{ height: 20 }}>
      {jogos.slice(0, 6).map((j, i) => {
        const g = (j.score_home || 0) + (j.score_away || 0);
        const h = Math.min(Math.max(g, 1), 12);
        const cor = g >= 7 ? 'bg-emerald-400' : g >= 4 ? 'bg-amber-400' : 'bg-rose-400';
        return (
          <div key={i} title={`${j.score_home}-${j.score_away} (${g} gols)`}
            className={`w-2 rounded-sm ${cor} opacity-75 hover:opacity-100 transition-opacity`}
            style={{ height: `${(h / 12) * 20}px` }} />
        );
      })}
    </div>
  );
}

function PainelH2H({ ja, jb }) {
  const { data, loading } = useH2H(ja, jb, true);

  if (loading) return (
    <div className="px-3 py-2 border-t border-[--mike-border]/30 flex items-center justify-center gap-2">
      <Activity className="w-3.5 h-3.5 text-[--mike-fg-muted] animate-pulse" />
      <span className="text-[10px] text-[--mike-fg-muted]">Carregando H2H...</span>
    </div>
  );

  if (!data || data.total_jogos === 0) return (
    <div className="px-3 py-2 border-t border-[--mike-border]/30 text-center">
      <p className="text-[10px] text-[--mike-fg-muted]">Sem histórico H2H disponível</p>
    </div>
  );

  const jogos = data.jogos || [];
  let vA = 0, vB = 0, emp = 0;
  for (const j of jogos) {
    const isA = normalizaTxt(j.jogador_a || '') === normalizaTxt(ja);
    const sh = j.score_home || 0, sa = j.score_away || 0;
    if (sh > sa) isA ? vA++ : vB++;
    else if (sa > sh) isA ? vB++ : vA++;
    else emp++;
  }
  const total = vA + vB + emp || 1;
  const pctA = Math.round((vA / total) * 100);
  const pctEmp = Math.round((emp / total) * 100);
  const pctB = Math.round((vB / total) * 100);

  return (
    <div className="px-3 py-3 border-t border-[--mike-border]/30 space-y-2.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-bold text-[--mike-fg-muted] uppercase tracking-wider flex items-center gap-1">
          <BarChart2 className="w-3 h-3" /> H2H — {data.total_jogos} jogos
        </span>
        {data.media_gols_ft && (
          <span className="text-[9px] text-[--mike-fg-soft]">
            Média: <span className="text-amber-300 font-bold">{data.media_gols_ft.toFixed(1)} gols</span>
          </span>
        )}
      </div>

      {/* Nomes */}
      <div className="flex items-center justify-between text-[10px] font-bold">
        <span className="text-emerald-400 truncate max-w-[40%]">{ja}</span>
        <span className="text-[--mike-fg-muted] text-[9px]">{emp} empates</span>
        <span className="text-rose-400 truncate max-w-[40%] text-right">{jb}</span>
      </div>

      {/* Barra de vitórias */}
      <div className="flex items-center gap-1.5">
        <span className="text-[9px] font-black text-emerald-400 w-7 text-right flex-shrink-0">{pctA}%</span>
        <div className="flex-1 h-2.5 rounded-full overflow-hidden bg-[--mike-card-2] flex">
          <div className="h-full bg-emerald-500/80 transition-all rounded-l-full" style={{ width: `${pctA}%` }} />
          <div className="h-full bg-slate-600/60 transition-all" style={{ width: `${pctEmp}%` }} />
          <div className="h-full bg-rose-500/80 transition-all rounded-r-full" style={{ width: `${pctB}%` }} />
        </div>
        <span className="text-[9px] font-black text-rose-400 w-7 text-left flex-shrink-0">{pctB}%</span>
      </div>

      {/* Gols por jogo */}
      <div className="flex items-center justify-between">
        <span className="text-[9px] text-[--mike-fg-muted]">Gols/jogo (últimos {Math.min(jogos.length, 6)})</span>
        <MiniBarraGols jogos={jogos} />
      </div>

      {/* Últimos 3 resultados */}
      <div className="space-y-1">
        {jogos.slice(0, 3).map((j, i) => {
          const gols = (j.score_home || 0) + (j.score_away || 0);
          const corGols = gols >= 7 ? 'text-emerald-400' : gols >= 4 ? 'text-amber-400' : 'text-rose-400';
          return (
            <div key={i} className="flex items-center justify-between text-[9px] px-2 py-1 rounded bg-[--mike-card-2]/60">
              <span className="text-[--mike-fg-soft] truncate max-w-[32%]">{j.jogador_a}</span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-black text-[--mike-fg]">{j.score_home} — {j.score_away}</span>
                <span className={`font-bold ${corGols}`}>({gols})</span>
              </div>
              <span className="text-[--mike-fg-soft] truncate max-w-[32%] text-right">{j.jogador_b}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CardLive({ ev, onAbrirPartida }) {
  const tema = TEMA[ev.sport] || TEMA['E-Football'];
  const odds = useOddsEvento(ev.event_id);
  const mercados = useMemo(() => processarMercados(odds), [odds]);
  const [h2hAberto, setH2hAberto] = useState(false);
  const [placarPiscou, setPlacarPiscou] = useState(false);
  const placarRef = useRef(`${ev.score_home}-${ev.score_away}`);

  useEffect(() => {
    const novo = `${ev.score_home}-${ev.score_away}`;
    if (placarRef.current !== novo) {
      placarRef.current = novo;
      setPlacarPiscou(true);
      const t = setTimeout(() => setPlacarPiscou(false), 1500);
      return () => clearTimeout(t);
    }
  }, [ev.score_home, ev.score_away]);

  // Tendência de ritmo de gols
  const tendencia = useMemo(() => {
    const gols = (ev.score_home || 0) + (ev.score_away || 0);
    const tempoStr = ev.live_time || '';
    const min = parseInt(tempoStr) || 0;
    if (min < 3 || gols === 0) return null;
    const ritmo = (gols / min) * 90;
    if (ritmo > 7) return { Icon: TrendingUp, label: `${ritmo.toFixed(1)}/jogo`, cor: 'text-emerald-400' };
    if (ritmo < 2.5) return { Icon: TrendingDown, label: `${ritmo.toFixed(1)}/jogo`, cor: 'text-rose-400' };
    return null;
  }, [ev.score_home, ev.score_away, ev.live_time]);

  const ligaLabel = (ev.liga || '')
    .replace(/^ESOC/, '')
    .replace(/CERBATTLE$/, 'Battle')
    .replace(/BATVOL-\d+/, 'Battle Volta')
    .replace(/-\d+MP$/, '')
    .replace(/^B-/, '')
    .trim() || ev.liga;

  const totalGols = (ev.score_home || 0) + (ev.score_away || 0);

  return (
    <div className="rounded-xl overflow-hidden shadow-xl shadow-black/40 flex flex-col" style={{ border: `0.5px solid ${tema.cardBorder}`, backgroundColor: 'var(--mike-card)' }}>

      {/* HEADER */}
      <div className={`px-3 py-2 ${tema.headerBg} flex items-center justify-between gap-2`}>
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className={`w-1.5 h-1.5 rounded-full ${tema.dot} animate-pulse flex-shrink-0`} />
          <span className={`text-[11px] font-bold ${tema.headerText} truncate`}>{ligaLabel}</span>
          {tendencia && (
            <span className={`flex items-center gap-0.5 text-[9px] font-bold ${tendencia.cor} flex-shrink-0`}>
              <tendencia.Icon className="w-2.5 h-2.5" />{tendencia.label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Clock className={`w-2.5 h-2.5 ${tema.timerIcon}`} />
          <span className={`text-[10px] font-mono font-bold ${tema.timerText}`}>{ev.live_time || '--'}</span>
          <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">AO VIVO</span>
        </div>
      </div>

      {/* CONFRONTO */}
      <button onClick={() => onAbrirPartida?.(ev)}
        className="w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-[--mike-card-hover]/40 transition">
        <div className="text-right min-w-0 flex-1">
          <div className="text-[14px] font-black text-[--mike-fg] truncate">{ev.jogador_a || '?'}</div>
          {ev.score_home > ev.score_away && (
            <div className="text-[9px] font-bold text-emerald-400 flex items-center justify-end gap-0.5 mt-0.5">
              <Zap className="w-2.5 h-2.5" fill="currentColor" /> vencendo
            </div>
          )}
        </div>

        <div className="flex flex-col items-center flex-shrink-0">
          <div className={`flex items-center gap-2 min-w-[72px] px-3 py-1.5 rounded-lg font-mono text-lg font-black transition-all ${
            placarPiscou ? 'ring-2 ring-emerald-400 bg-emerald-500/10' : 'bg-[--mike-card-2]'
          }`}>
            <span className={ev.score_home > ev.score_away ? 'text-emerald-300' : ev.score_home < ev.score_away ? 'text-rose-400' : 'text-[--mike-fg]'}>
              {ev.score_home ?? '-'}
            </span>
            <span className="text-[--mike-fg-muted] text-sm">×</span>
            <span className={ev.score_away > ev.score_home ? 'text-emerald-300' : ev.score_away < ev.score_home ? 'text-rose-400' : 'text-[--mike-fg]'}>
              {ev.score_away ?? '-'}
            </span>
          </div>
          <span className="text-[8px] text-[--mike-fg-muted] mt-0.5">{totalGols} gols</span>
        </div>

        <div className="text-left min-w-0 flex-1">
          <div className="text-[14px] font-black text-[--mike-fg] truncate">{ev.jogador_b || '?'}</div>
          {ev.score_away > ev.score_home && (
            <div className="text-[9px] font-bold text-emerald-400 flex items-center gap-0.5 mt-0.5">
              <Zap className="w-2.5 h-2.5" fill="currentColor" /> vencendo
            </div>
          )}
        </div>
      </button>

      {/* CASAS + H2H */}
      <div className="px-3 pb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 flex-wrap">
          {(ev.casas || [ev.bookmaker]).map(c => <BookmakerChip key={c} casa={c} />)}
        </div>
        <button onClick={() => setH2hAberto(!h2hAberto)}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition border ${
            h2hAberto
              ? 'bg-[--mike-accent]/15 border-[--mike-accent]/50 text-[--mike-accent]'
              : 'bg-[--mike-card-2] border-[--mike-border] text-[--mike-fg-soft] hover:text-[--mike-accent] hover:border-[--mike-accent]/40'
          }`}>
          <BarChart2 className="w-3 h-3" />
          H2H
          <ChevronDown className={`w-3 h-3 transition-transform ${h2hAberto ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* H2H EXPANSÍVEL */}
      {h2hAberto && <PainelH2H ja={ev.jogador_a} jb={ev.jogador_b} />}

      {/* DIVISOR */}
      <div className="mx-3" style={{ height: '0.5px', backgroundColor: 'rgba(60,85,130,0.3)' }} />

      {/* MERCADOS */}
      <div className="px-3 py-2.5">
        {mercados.length > 0 ? (
          <>
            <div className="grid grid-cols-2 gap-1.5" style={{ maxHeight: 220, overflowY: 'auto' }}>
              {mercados.slice(0, 8).map((m, i) => <TabelaMercado key={i} mercado={m} />)}
            </div>
            {mercados.length > 8 && (
              <button className="w-full mt-1.5 text-[10px] text-[--mike-fg-muted] hover:text-[--mike-accent] flex items-center justify-center gap-1 transition py-1">
                +{mercados.length - 8} mercados <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </>
        ) : (
          <div className="py-4 text-center">
            <Activity className="w-4 h-4 text-[--mike-fg-muted] mx-auto mb-1 animate-pulse" />
            <p className="text-[10px] text-[--mike-fg-muted]">Carregando odds...</p>
          </div>
        )}
      </div>
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="rounded-xl overflow-hidden bg-[--mike-card]" style={{ border: '0.5px solid rgba(60,85,130,0.3)' }}>
      <div className="px-3 py-2 flex items-center justify-between" style={{ backgroundColor: 'rgba(16,24,40,0.6)' }}>
        <div className="mike-skeleton h-3 w-32" /><div className="mike-skeleton h-3 w-16" />
      </div>
      <div className="px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex-1"><div className="mike-skeleton h-4 w-20 ml-auto" /></div>
        <div className="mike-skeleton h-10 w-20 rounded-lg flex-shrink-0" />
        <div className="flex-1"><div className="mike-skeleton h-4 w-20" /></div>
      </div>
      <div className="px-3 pb-2 flex gap-1">
        <div className="mike-skeleton h-5 w-14 rounded" /><div className="mike-skeleton h-5 w-14 rounded" />
      </div>
      <div className="mx-3 h-px" style={{ backgroundColor: 'rgba(60,85,130,0.3)' }} />
      <div className="px-3 py-2 grid grid-cols-2 gap-1.5">
        {[1,2,3,4].map(i => <div key={i} className="mike-skeleton h-16 rounded-md" />)}
      </div>
    </div>
  );
}

function MikeSelect({ value, onChange, options }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    if (open) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  const sel = options.find(o => o.value === value);
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className="mike-border-thin flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-transparent text-xs text-[--mike-fg] min-w-[150px]">
        <span className="flex-1 text-left truncate">{sel?.label || ''}</span>
        <ChevronDown className={`w-3 h-3 text-[--mike-fg-muted] flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-40 left-0 mt-1 rounded-lg overflow-y-auto min-w-full" style={{ backgroundColor: '#0d1220', border: '0.5px solid rgba(60,85,130,0.4)', maxHeight: 220, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
          {options.map(o => (
            <button key={o.value} onClick={() => { onChange(o.value); setOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left transition ${value === o.value ? 'bg-[--mike-accent]/15 text-[--mike-accent] font-semibold' : 'text-[--mike-fg-soft] hover:bg-[--mike-card-2]/60'}`}>
              <span>{o.label}</span>
              {value === o.value && <Check className="w-3 h-3" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// TELA PRINCIPAL
// ============================================================
export default function Live({ onNavegar, onAbrirPartida }) {
  const [esporteAtivo, setEsporteAtivo] = useState('E-Football');
  const [busca, setBusca] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [telaAtiva, setTelaAtiva] = useState('live');
  const [torneio, setTorneio] = useState('todos');
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(0);

  const { data: eventosLive, loading, refetch } = useEventosLive(esporteAtivo);

  // Agrupa por par, consolida casas, prioriza melhor event_id
  const eventosAgrupados = useMemo(() => {
    const mapa = new Map();
    const priorCasas = ['bet365', 'superbet', 'betano', 'estrelabet'];
    for (const ev of (eventosLive || [])) {
      const chave = `${normalizaTxt(ev.jogador_a || '')}||${normalizaTxt(ev.jogador_b || '')}`;
      if (!mapa.has(chave)) {
        mapa.set(chave, { ...ev, casas: [ev.bookmaker] });
      } else {
        const existing = mapa.get(chave);
        if (!existing.casas.includes(ev.bookmaker)) existing.casas.push(ev.bookmaker);
        // Troca event_id se nova casa tem prioridade maior
        const iEx = priorCasas.indexOf(existing.bookmaker);
        const iNew = priorCasas.indexOf(ev.bookmaker);
        if (iNew !== -1 && (iEx === -1 || iNew < iEx)) {
          mapa.set(chave, { ...ev, casas: existing.casas });
        }
      }
    }
    return Array.from(mapa.values());
  }, [eventosLive]);

  // Filtra + ordena por gols (mais ação primeiro)
  const eventosFiltrados = useMemo(() => {
    let evs = eventosAgrupados;
    if (torneio !== 'todos') evs = evs.filter(e => e.liga === torneio);
    if (busca) {
      const t = normalizaTxt(busca);
      evs = evs.filter(e => [e.jogador_a, e.jogador_b, e.liga].some(c => normalizaTxt(c).includes(t)));
    }
    return [...evs].sort((a, b) => {
      const ga = (a.score_home || 0) + (a.score_away || 0);
      const gb = (b.score_home || 0) + (b.score_away || 0);
      return gb - ga;
    });
  }, [eventosAgrupados, torneio, busca]);

  const torneios = useMemo(() => {
    const s = new Set(eventosAgrupados.map(e => e.liga).filter(Boolean));
    return Array.from(s).sort();
  }, [eventosAgrupados]);

  const stats = useMemo(() => ({
    partidas: eventosFiltrados.length,
    gols: eventosFiltrados.reduce((s, e) => s + (e.score_home || 0) + (e.score_away || 0), 0),
    casas: new Set(eventosFiltrados.flatMap(e => e.casas || [e.bookmaker])).size,
  }), [eventosFiltrados]);

  const fazerRefresh = useCallback(() => {
    setRefreshing(true);
    refetch().finally(() => { setRefreshing(false); setUltimaAtualizacao(0); });
  }, [refetch]);

  useEffect(() => {
    if (loading) return;
    const id = setInterval(() => {
      setUltimaAtualizacao(s => {
        if (s + 1 >= 15) { fazerRefresh(); return 0; }
        return s + 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [loading, fazerRefresh]);

  const algumFiltro = torneio !== 'todos' || busca;

  const themeVars = {
    '--mike-bg': '#0b0f1a', '--mike-bg-2': '#070a13', '--mike-card': '#141a28',
    '--mike-card-2': '#1a2030', '--mike-card-hover': '#1d2434', '--mike-border': '#222a3d',
    '--mike-fg': '#eaeef7', '--mike-fg-soft': '#a8b3c9', '--mike-fg-muted': '#6b7691',
    '--mike-accent': '#10b981', '--mike-accent-2': '#0891b2',
  };

  return (
    <div className="min-h-screen" style={{ ...themeVars, backgroundColor: 'var(--mike-bg)', color: 'var(--mike-fg)', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <style>{`
        .mike-border-thin { border: 0.5px solid rgba(60,85,130,0.4) !important; }
        .mike-border-thin:hover { border-color: rgba(80,110,170,0.7) !important; }
        .mike-border-thin:focus { border-color: rgba(16,185,129,0.7) !important; outline: none; }
        @keyframes mike-shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        .mike-skeleton { background: linear-gradient(90deg, rgba(60,85,130,0.1) 0%, rgba(60,85,130,0.25) 50%, rgba(60,85,130,0.1) 100%); background-size: 200% 100%; animation: mike-shimmer 1.5s infinite linear; border-radius: 4px; }
        @keyframes mike-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .mike-spin { animation: mike-spin 0.8s linear infinite; }
        @keyframes mike-pulse-dot { 0%,100% { opacity:0.5; transform:scale(1); } 50% { opacity:1; transform:scale(1.3); } }
        .mike-live-dot { animation: mike-pulse-dot 1.2s ease-in-out infinite; }
      `}</style>

      <MikeHeader telaAtiva={telaAtiva} onNavegar={id => { setTelaAtiva(id); onNavegar?.(id); }} />

      <main className="max-w-screen-2xl mx-auto px-4 lg:px-8 py-6">

        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs text-[--mike-fg-muted] mb-5">
          <Home className="w-3.5 h-3.5" />
          <span>Início</span>
          <span>›</span>
          <span className="text-[--mike-fg] font-semibold flex items-center gap-1.5">
            <span className="mike-live-dot w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />
            Ao Vivo
          </span>
        </div>

        {/* Stats rápidas */}
        {!loading && (
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { label: 'Partidas', value: stats.partidas, Icon: Activity, cor: 'text-red-400', bg: 'bg-red-500/15 border-red-500/30' },
              { label: 'Gols ao vivo', value: stats.gols, Icon: Zap, cor: 'text-emerald-400', bg: 'bg-emerald-500/15 border-emerald-500/30' },
              { label: 'Casas monitoradas', value: stats.casas, Icon: BarChart2, cor: 'text-blue-400', bg: 'bg-blue-500/15 border-blue-500/30' },
            ].map(({ label, value, Icon, cor, bg }) => (
              <div key={label} className="rounded-xl bg-[--mike-card] mike-border-thin px-4 py-3 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg border flex items-center justify-center flex-shrink-0 ${bg}`}>
                  <Icon className={`w-4 h-4 ${cor}`} />
                </div>
                <div>
                  <div className="text-[9px] text-[--mike-fg-muted] uppercase tracking-wider">{label}</div>
                  <div className="text-2xl font-black text-[--mike-fg] leading-tight">{value}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Filtros de esporte */}
        <div className="flex flex-wrap gap-2 mb-4">
          {ESPORTES.map(e => {
            const t = TEMA[e.id];
            const ativo = esporteAtivo === e.id;
            const Icone = t.icone;
            return (
              <button key={e.id} onClick={() => setEsporteAtivo(ativo ? null : e.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition ${ativo ? t.btnActive : 'mike-border-thin bg-transparent text-[--mike-fg-muted] hover:text-[--mike-fg]'}`}>
                <Icone className="w-3.5 h-3.5" />{e.label}
              </button>
            );
          })}
        </div>

        {/* Busca + torneio + refresh */}
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <div className="mike-border-thin flex-1 min-w-[200px] flex items-center gap-2 px-3 py-2 rounded-lg bg-transparent">
            <Search className="w-4 h-4 text-[--mike-fg-muted]" />
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar jogadores, ligas..."
              className="flex-1 bg-transparent text-xs text-[--mike-fg] placeholder:text-[--mike-fg-muted] outline-none" />
            {busca && <button onClick={() => setBusca('')}><X className="w-3.5 h-3.5 text-[--mike-fg-muted]" /></button>}
          </div>
          <MikeSelect value={torneio} onChange={setTorneio} options={[
            { value: 'todos', label: 'Todos os torneios' },
            ...torneios.map(t => ({ value: t, label: t.length > 32 ? t.substring(0, 30) + '…' : t })),
          ]} />
          <button onClick={fazerRefresh} disabled={refreshing || loading}
            className="px-3 py-2 rounded-lg mike-border-thin bg-transparent text-[--mike-fg-muted] hover:text-[--mike-accent] transition disabled:opacity-50"
            title="Atualizar">
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'mike-spin' : ''}`} />
          </button>
          {algumFiltro && (
            <button onClick={() => { setTorneio('todos'); setBusca(''); }}
              className="flex items-center gap-1 px-3 py-2 rounded-lg mike-border-thin bg-transparent text-xs text-rose-400 hover:text-rose-300 transition">
              <FilterX className="w-3.5 h-3.5" /> Limpar
            </button>
          )}
        </div>

        {/* Status bar */}
        <div className="flex items-center gap-2 mb-4 text-[10px] text-[--mike-fg-muted]">
          <span className="mike-live-dot w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />
          <span><span className="text-[--mike-fg] font-bold">{eventosFiltrados.length}</span> partidas ao vivo</span>
          <span>·</span>
          <span>{refreshing ? 'Atualizando...' : `próxima atualização em ${15 - ultimaAtualizacao}s`}</span>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1,2,3,4,5,6].map(i => <CardSkeleton key={i} />)}
          </div>
        ) : eventosFiltrados.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {eventosFiltrados.map(ev => (
              <CardLive key={`${ev.jogador_a}||${ev.jogador_b}`} ev={ev} onAbrirPartida={onAbrirPartida} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl bg-[--mike-card] mike-border-thin py-16 px-6 text-center">
            <FilterX className="w-12 h-12 text-[--mike-fg-muted] opacity-40 mx-auto mb-3" />
            <p className="text-sm font-semibold mb-1">Nenhuma partida encontrada</p>
            <p className="text-xs text-[--mike-fg-muted]">
              {esporteAtivo ? `Nenhum jogo ao vivo de ${TEMA[esporteAtivo]?.label || esporteAtivo} no momento.` : 'Nenhum jogo ao vivo no momento.'}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
