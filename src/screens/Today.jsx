import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Search, Bell, Settings, ChevronDown, Home, Activity, Store, Bot, Table2, BarChart3, Plus,
  Clock, ExternalLink, X, FilterX, RefreshCw, Radio
} from 'lucide-react';
import MikeHeader from '../shared/MikeHeader.jsx';
import { ApiEventos, ApiStats } from '../lib/api.js';

// ============================================================
// CONFIG
// ============================================================
const USE_MOCK = false; // 🔌 false = dados reais da API

// ============================================================
// MAPA DE TEAM_ID -> usado pra montar URL de logo
// ============================================================
const TEAM_IDS = {
  'AC Milan': 489, 'Alaves': 542, 'Almere City FC': 419, 'Alverca': 4724, 'Angers': 77,
  'Arouca': 240, 'Atletico Madrid': 530, 'Atletico-MG': 1062, 'Bahia': 118, 'Barcelona': 529,
  'Bayer Leverkusen': 168, 'Bayern München': 157, 'Bayern munchen': 157, 'Boca Juniors': 451,
  'Bolívar': 3702, 'Borussia Dortmund': 165, 'Bor. Dortmund': 165, 'Borussia Mönchengladbach': 163,
  'Bournemouth': 35, 'Brentford': 55, 'Cagliari': 490, 'Celta Vigo': 538, 'Chelsea': 49,
  'Club Nacional': 2356, 'Corinthians': 131, 'Coritiba': 147, 'Crystal Palace': 52,
  'De Graafschap': 199, 'Eintracht Frankfurt': 169, 'Eint. Frankfurt': 169, 'Elche': 797,
  'Espanyol': 540, 'Estoril': 230, 'Estudiantes L.P.': 450, 'FC Porto': 212, 'Porto': 212,
  'FC St. Pauli': 186, 'FSV Mainz 05': 164, 'Famalicao': 242, 'Feyenoord': 209, 'Fiorentina': 502,
  'Fluminense': 124, 'GIL Vicente': 762, 'GO Ahead Eagles': 410, 'Genoa': 495, 'Gremio': 130,
  'Guimaraes': 224, 'Heerenveen': 210, 'Hellas Verona': 504, 'Heracles': 206,
  'Independiente del Valle': 1153, 'Inter': 505, 'Lanus': 446, 'Lazio': 487, 'Le Havre': 111,
  'Lens': 116, 'Libertad Asuncion': 1179, 'Liverpool': 40, 'Manchester City': 50, 'Man. City': 50,
  'Manchester United': 33, 'Marseille': 81, 'Nantes': 83, 'Nice': 84, 'Nottingham Forest': 65,
  'Osasuna': 727, 'Oviedo': 718, 'Palmeiras': 121, 'Paris Saint Germain': 85, 'Parma': 523,
  'RB Bragantino': 794, 'RB Leipzig': 173, 'Rayo Vallecano': 728, 'Real Madrid': 541, 'Roma': 497,
  'Real Sociedad': 548, 'Remo': 1198, 'Rennes': 94, 'SC Braga': 217, 'SC Freiburg': 160,
  'Santos': 128, 'Sassuolo': 488, 'Stade Brestois 29': 106, 'Strasbourg': 95, 'Telstar': 427,
  'Tondela': 218, 'Tottenham': 47, 'Toulouse': 96, 'Twente': 415, 'Udinese': 494,
  'Vasco DA Gama': 133, 'VfL Wolfsburg': 161, 'Waalwijk': 417, 'Werder Bremen': 162,
  'Willem II': 195, 'Wolves': 39, 'Atalanta': 499, 'Bologna': 500, 'Botafogo': 120,
  'Cruzeiro': 135, 'Cremonese': 521, 'AS Roma': 497, 'Everton': 45, 'Sporting CP': 228,
  'Sevilla': 536, 'Ajax': 194, 'Aston Villa': 66, 'Fenerbahce': 645, 'RB Salzburg': 571,
};

const LOGO_URL = (nome) => {
  const id = TEAM_IDS[nome];
  return id ? `https://media.api-sports.io/football/teams/${id}.png` : null;
};

function TeamLogo({ nome, size = 28 }) {
  const url = LOGO_URL(nome);
  const [erro, setErro] = useState(false);
  if (!url || erro) {
    const inicial = (nome || '?').charAt(0).toUpperCase();
    const cores = ['from-blue-500 to-blue-700','from-red-500 to-red-700','from-emerald-500 to-emerald-700','from-amber-500 to-amber-700','from-purple-500 to-purple-700','from-rose-500 to-rose-700'];
    const corIdx = (nome || '').charCodeAt(0) % cores.length;
    return (
      <div className={`rounded-full bg-gradient-to-br ${cores[corIdx]} flex items-center justify-center font-black text-white text-xs flex-shrink-0`} style={{ width: size, height: size, fontSize: size * 0.45 }}>
        {inicial}
      </div>
    );
  }
  return <img src={url} alt={nome} onError={() => setErro(true)} className="object-contain flex-shrink-0" style={{ width: size, height: size }} />;
}

// ============================================================
// ESPORTES
// ============================================================
const ESPORTE_CORES = {
  'E-Football': { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30', activeBg: 'bg-emerald-500', activeText: 'text-white', activeBorder: 'border-emerald-500', activeShadow: 'shadow-emerald-500/40' },
  'E-Basketball': { bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/30', activeBg: 'bg-orange-500', activeText: 'text-white', activeBorder: 'border-orange-500', activeShadow: 'shadow-orange-500/40' },
  'E-Hockey': { bg: 'bg-cyan-500/15', text: 'text-cyan-400', border: 'border-cyan-500/30', activeBg: 'bg-cyan-500', activeText: 'text-white', activeBorder: 'border-cyan-500', activeShadow: 'shadow-cyan-500/40' },
};

const ESPORTES_FILTROS = [
  { id: 'E-Football',   label: 'e-Soccer'  },
  { id: 'E-Basketball', label: 'e-Basket'  },
  { id: 'E-Hockey',     label: 'e-Hockey'  },
];

function normalizaBusca(s) {
  return (s || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// ============================================================
// HOOKS DE DADOS REAIS
// ============================================================

function useEventosLive(filtros) {
  const [state, setState] = useState({ data: [], loading: true, error: null });
  const lastReq = useRef(0);

  const fetch_ = useCallback(async () => {
    const id = ++lastReq.current;
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const params = {};
      if (filtros.sport) params.sport = filtros.sport;
      const data = await ApiEventos.live(params);
      if (id === lastReq.current) setState({ data: data || [], loading: false, error: null });
    } catch (e) {
      if (id === lastReq.current) setState({ data: [], loading: false, error: e });
    }
  }, [filtros.sport]);

  useEffect(() => { fetch_(); }, [fetch_]);
  return { ...state, refetch: fetch_ };
}

function useEventosFinished(filtros) {
  const [state, setState] = useState({ data: [], loading: true, error: null });
  const lastReq = useRef(0);

  const fetch_ = useCallback(async () => {
    const id = ++lastReq.current;
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const params = { limit: 50 };
      if (filtros.sport) params.sport = filtros.sport;
      const data = await ApiEventos.finished(params);
      if (id === lastReq.current) setState({ data: data || [], loading: false, error: null });
    } catch (e) {
      if (id === lastReq.current) setState({ data: [], loading: false, error: e });
    }
  }, [filtros.sport]);

  useEffect(() => { fetch_(); }, [fetch_]);
  return { ...state, refetch: fetch_ };
}

function useStatsDashboard() {
  const [state, setState] = useState({ data: null, loading: true, error: null });

  const fetch_ = useCallback(async () => {
    try {
      const data = await ApiStats.dashboard();
      setState({ data, loading: false, error: null });
    } catch (e) {
      setState({ data: null, loading: false, error: e });
    }
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);
  return { ...state, refetch: fetch_ };
}

// ============================================================
// NORMALIZAÇÃO: evento da API → formato do card
// ============================================================
function normalizarEvento(ev) {
  return {
    id: ev.event_id,
    esporte: ev.sport || '',
    liga: ev.liga || '',
    jogadorA: ev.jogador_a || '',
    jogadorB: ev.jogador_b || '',
    timeA: '',
    timeB: '',
    placarA: ev.score_home,
    placarB: ev.score_away,
    hora: ev.ultimo_tick ? new Date(ev.ultimo_tick).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '',
    data: ev.ultimo_tick ? new Date(ev.ultimo_tick).toLocaleDateString('pt-BR') : '',
    bookmaker: ev.bookmaker,
    aoVivo: true,
    live_time: ev.live_time || '',
    event_id: ev.event_id,
  };
}

// ============================================================
// COMPONENTES
// ============================================================
function PillEsporte({ esporte }) {
  const c = ESPORTE_CORES[esporte] || ESPORTE_CORES['E-Football'];
  const label = esporte === 'E-Football' ? 'e-Soccer' : esporte === 'E-Basketball' ? 'e-Basket' : esporte;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border ${c.bg} ${c.text} ${c.border}`}>
      {label}
    </span>
  );
}

function BotaoH2H({ tipo = 'h2h', onClick }) {
  return (
    <button onClick={(e) => { e.stopPropagation(); onClick?.(); }} className="flex items-center gap-1 px-2 py-1 rounded-md bg-[--mike-card-2] border border-[--mike-border] hover:border-[--mike-accent] hover:bg-[--mike-accent]/5 text-[10px] font-semibold text-[--mike-fg-soft] hover:text-[--mike-accent] transition">
      {tipo === 'h2h' ? 'H2H' : 'H2H + Time'}
      <ExternalLink className="w-2.5 h-2.5" />
    </button>
  );
}

function CardPartidaPainel({ p, tipo, onAbrirPartida, onAbrirH2H }) {
  const isAnt = tipo === 'anterior';
  const aoVivoAgora = !isAnt && p.aoVivo;

  return (
    <div onClick={() => onAbrirPartida?.(p)} className="px-4 py-3 hover:bg-[--mike-card-hover] transition cursor-pointer border-b border-[--mike-border]/40 last:border-b-0 relative">
      {aoVivoAgora && (
        <div className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-500/15 border border-red-500/40">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 mike-pulse-live" />
          <span className="text-[9px] font-bold text-red-400 tracking-wider">AO VIVO</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 mb-2">
        <div className={`flex flex-col gap-0.5 min-w-0 ${aoVivoAgora ? 'pl-20' : ''}`}>
          <PillEsporte esporte={p.esporte} />
          <span className="text-[10px] text-[--mike-fg-muted] truncate">{p.liga}</span>
          {p.live_time && <span className="text-[9px] text-emerald-400/70">{p.live_time}</span>}
        </div>
        <div className="text-[11px] font-mono text-[--mike-fg-soft] whitespace-nowrap">
          {p.data}, <span className="text-[--mike-fg]">{p.hora}</span>
        </div>
        <div className="flex items-center gap-1">
          <BotaoH2H tipo="h2h" onClick={() => onAbrirH2H?.(p)} />
        </div>
      </div>

      {isAnt ? (
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {p.timeA && <TeamLogo nome={p.timeA} size={32} />}
            <div className="min-w-0 leading-tight">
              <div className="text-[13px] font-bold text-[--mike-fg] truncate">{p.jogadorA}</div>
              {p.timeA && <div className="text-[10px] text-[--mike-fg-muted] truncate">{p.timeA}</div>}
            </div>
          </div>
          <div className="flex items-center justify-center gap-1.5 min-w-[64px] px-3 py-1.5 rounded-md bg-gradient-to-r from-emerald-500/20 to-emerald-500/10 border border-emerald-500/40 font-mono text-base font-black shadow-lg shadow-emerald-500/10">
            <span className={p.placarA > p.placarB ? 'text-emerald-300' : p.placarA < p.placarB ? 'text-red-400' : 'text-[--mike-fg]'}>{p.placarA ?? '-'}</span>
            <span className="text-[--mike-fg-muted]">:</span>
            <span className={p.placarB > p.placarA ? 'text-emerald-300' : p.placarB < p.placarA ? 'text-red-400' : 'text-[--mike-fg]'}>{p.placarB ?? '-'}</span>
          </div>
          <div className="flex items-center gap-2 justify-end min-w-0">
            <div className="text-right min-w-0 leading-tight">
              <div className="text-[13px] font-bold text-[--mike-fg] truncate">{p.jogadorB}</div>
              {p.timeB && <div className="text-[10px] text-[--mike-fg-muted] truncate">{p.timeB}</div>}
            </div>
            {p.timeB && <TeamLogo nome={p.timeB} size={32} />}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-4">
          <div className="flex items-center gap-2 justify-end min-w-0 flex-1 max-w-[40%]">
            <div className="text-right min-w-0 leading-tight">
              <div className="text-[13px] font-bold text-[--mike-fg] truncate">{p.jogadorA}</div>
            </div>
          </div>
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-slate-700/80 to-slate-800/80 border border-slate-600/60 shadow-inner flex-shrink-0">
            <span className="font-serif italic font-bold text-[10px] text-slate-300 tracking-wider">vs</span>
          </div>
          <div className="flex items-center gap-2 min-w-0 flex-1 max-w-[40%]">
            <div className="min-w-0 leading-tight">
              <div className="text-[13px] font-bold text-[--mike-fg] truncate">{p.jogadorB}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PainelPartidas({ titulo, partidas, tipo, esporteAtivo, onAbrirPartida, onAbrirH2H }) {
  return (
    <div className="rounded-2xl bg-[--mike-card] border border-[--mike-border] overflow-hidden shadow-2xl shadow-black/40 flex flex-col" style={{ maxHeight: '600px' }}>
      <div className="px-5 py-3.5 bg-gradient-to-r from-[--mike-accent] via-[--mike-accent]/80 to-[--mike-accent-2] flex items-center justify-between gap-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-[--mike-bg]" />
          <h2 className="text-sm font-bold text-[--mike-bg]">{titulo}</h2>
        </div>
        <span className="text-[10px] font-mono font-bold text-[--mike-bg]/80 px-2 py-0.5 rounded bg-[--mike-bg]/15">
          {partidas.length} {partidas.length === 1 ? 'jogo' : 'jogos'}
        </span>
      </div>
      {partidas.length > 0 ? (
        <div className="overflow-y-auto flex-1 mike-scroll">
          {partidas.map((p) => (
            <CardPartidaPainel key={p.id} p={p} tipo={tipo} onAbrirPartida={onAbrirPartida} onAbrirH2H={onAbrirH2H} />
          ))}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center py-12 px-6 text-center gap-2">
          <FilterX className="w-8 h-8 text-[--mike-fg-muted] opacity-50" />
          <p className="text-xs text-[--mike-fg-muted]">
            {esporteAtivo ? `Nenhum jogo de ${esporteAtivo}` : 'Nenhum jogo encontrado'}
          </p>
        </div>
      )}
    </div>
  );
}

function SkeletonPainel() {
  return (
    <div className="rounded-2xl bg-[--mike-card] border border-[--mike-border] overflow-hidden flex flex-col" style={{ maxHeight: '600px' }}>
      <div className="px-5 py-3.5" style={{ background: 'linear-gradient(90deg, rgba(16,185,129,0.15), rgba(8,145,178,0.15))' }}>
        <div className="mike-skeleton h-3.5 w-32 rounded" />
      </div>
      <div className="p-2 space-y-1.5 flex-1">
        {[1,2,3,4,5,6].map(i => (
          <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-md">
            <div className="mike-skeleton h-2 w-20 rounded" />
            <div className="flex-1 flex items-center justify-between gap-2">
              <div className="mike-skeleton h-3 w-24 rounded" />
              <div className="mike-skeleton h-5 w-12 rounded-md" />
              <div className="mike-skeleton h-3 w-24 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// TELA PRINCIPAL
// ============================================================
export default function Today({ onNavegar, onAbrirPartida }) {
  const [esporteAtivo, setEsporteAtivo] = useState(null);
  const [busca, setBusca] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(0);
  const [telaAtiva, setTelaAtiva] = useState('today');

  const filtros = useMemo(() => ({ sport: esporteAtivo }), [esporteAtivo]);

  // Dados reais da API
  const { data: eventosLive,     loading: loadingLive,     refetch: refetchLive }     = useEventosLive(filtros);
  const { data: eventosFinished, loading: loadingFinished, refetch: refetchFinished } = useEventosFinished(filtros);
  const { data: statsDash,       refetch: refetchStats }                               = useStatsDashboard();

  const loading = loadingLive || loadingFinished;

  // Normaliza e filtra por busca
  const proximasFiltradas = useMemo(() => {
    let evs = (eventosLive || []).map(normalizarEvento);
    if (busca) {
      const t = normalizaBusca(busca);
      evs = evs.filter(p => [p.jogadorA, p.jogadorB, p.liga, p.esporte].some(c => normalizaBusca(c).includes(t)));
    }
    return evs;
  }, [eventosLive, busca]);

  const anterioresFiltradas = useMemo(() => {
    let evs = (eventosFinished || []).map(normalizarEvento);
    if (busca) {
      const t = normalizaBusca(busca);
      evs = evs.filter(p => [p.jogadorA, p.jogadorB, p.liga, p.esporte].some(c => normalizaBusca(c).includes(t)));
    }
    return evs;
  }, [eventosFinished, busca]);

  const stats = useMemo(() => ({
    aoVivo:   proximasFiltradas.length,
    proximas: 0,
    recentes: anterioresFiltradas.length,
    ticksHora: statsDash?.ticks_ultima_hora || 0,
  }), [proximasFiltradas, anterioresFiltradas, statsDash]);

  const handleNavegar = (telaId) => {
    setTelaAtiva(telaId);
    if (onNavegar) onNavegar(telaId);
  };

  const handleAbrirPartida = (partida) => {
    if (onAbrirPartida) onAbrirPartida(partida);
  };

  const handleAbrirH2H = (partida) => {
    if (onNavegar) onNavegar('h2h', { partida });
  };

  const fazerRefresh = useCallback(() => {
    setRefreshing(true);
    Promise.all([refetchLive(), refetchFinished(), refetchStats()])
      .finally(() => { setRefreshing(false); setUltimaAtualizacao(0); });
  }, [refetchLive, refetchFinished, refetchStats]);

  // Auto-refresh a cada 15s
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

  const themeVars = {
    '--mike-bg': '#0b0f1a', '--mike-bg-2': '#070a13', '--mike-card': '#141a28',
    '--mike-card-2': '#1a2030', '--mike-card-hover': '#1d2434', '--mike-border': '#222a3d',
    '--mike-fg': '#eaeef7', '--mike-fg-soft': '#a8b3c9', '--mike-fg-muted': '#6b7691',
    '--mike-accent': '#10b981', '--mike-accent-2': '#0891b2',
  };

  return (
    <div className="min-h-screen" style={{ ...themeVars, backgroundColor: 'var(--mike-bg)', color: 'var(--mike-fg)', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <style>{`
        .mike-scroll::-webkit-scrollbar { width: 8px; }
        .mike-scroll::-webkit-scrollbar-track { background: transparent; }
        .mike-scroll::-webkit-scrollbar-thumb { background: rgba(16,185,129,0.3); border-radius: 4px; border: 2px solid transparent; background-clip: padding-box; }
        .mike-scroll::-webkit-scrollbar-thumb:hover { background: rgba(16,185,129,0.6); background-clip: padding-box; border: 2px solid transparent; }
        .mike-scroll { scrollbar-width: thin; scrollbar-color: rgba(16,185,129,0.3) transparent; }
        .scrollbar-none::-webkit-scrollbar { display: none; }
        .scrollbar-none { scrollbar-width: none; }
        @keyframes mike-shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        .mike-skeleton { background: linear-gradient(90deg, rgba(60,85,130,0.1) 0%, rgba(60,85,130,0.25) 50%, rgba(60,85,130,0.1) 100%); background-size: 200% 100%; animation: mike-shimmer 1.5s infinite linear; border-radius: 4px; }
        @keyframes mike-refresh-pulse { 0%, 100% { opacity: 0.4; transform: scale(1); } 50% { opacity: 1; transform: scale(1.2); } }
        .mike-refresh-dot { animation: mike-refresh-pulse 1s ease-in-out infinite; }
        @keyframes mike-live-pulse { 0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(239,68,68,0.7); } 50% { opacity: 0.8; box-shadow: 0 0 0 5px rgba(239,68,68,0); } }
        .mike-pulse-live { animation: mike-live-pulse 1.4s ease-out infinite; }
        @keyframes mike-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .mike-spin { animation: mike-spin 0.8s linear infinite; }
      `}</style>

      <MikeHeader telaAtiva={telaAtiva} onNavegar={handleNavegar} />

      <main className="max-w-screen-xl mx-auto px-4 lg:px-8 py-10">
        {/* HERO */}
        <div className="flex flex-col items-center gap-4 mb-8">
          <div className="grid grid-cols-3 gap-3 w-full max-w-2xl">
            <div className="rounded-xl bg-[--mike-card] border border-[--mike-border] px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-red-500/15 border border-red-500/30 flex items-center justify-center flex-shrink-0">
                <Radio className="w-4 h-4 text-red-400" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] text-[--mike-fg-muted] uppercase tracking-wider truncate">Ao vivo</div>
                <div className="text-xl font-black text-[--mike-fg] leading-tight">{stats.aoVivo}</div>
              </div>
            </div>
            <div className="rounded-xl bg-[--mike-card] border border-[--mike-border] px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
                <Activity className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] text-[--mike-fg-muted] uppercase tracking-wider truncate">Recentes</div>
                <div className="text-xl font-black text-[--mike-fg] leading-tight">{stats.recentes}</div>
              </div>
            </div>
            <div className="rounded-xl bg-[--mike-card] border border-[--mike-border] px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center flex-shrink-0">
                <Activity className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] text-[--mike-fg-muted] uppercase tracking-wider truncate">Ticks/hora</div>
                <div className="text-xl font-black text-[--mike-fg] leading-tight">{stats.ticksHora.toLocaleString()}</div>
              </div>
            </div>
          </div>

          <h1 className="text-2xl md:text-3xl font-black text-center text-[--mike-fg] max-w-md mt-2">
            Acompanhe todas as partidas do dia
          </h1>

          <div className="w-full max-w-md flex gap-2">
            <div className="flex-1 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[--mike-card] border border-[--mike-border] shadow-sm focus-within:border-[--mike-accent] transition">
              <Search className="w-4 h-4 text-[--mike-fg-muted] flex-shrink-0" />
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Busque jogadores, ligas ou esportes" className="flex-1 bg-transparent outline-none text-sm placeholder:text-[--mike-fg-muted]" />
              {busca && (
                <button onClick={() => setBusca('')} className="p-0.5 rounded hover:bg-[--mike-card-hover] text-[--mike-fg-muted] hover:text-[--mike-fg] transition">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <button onClick={fazerRefresh} disabled={refreshing || loading} className="px-3 rounded-lg bg-[--mike-card] border border-[--mike-border] hover:bg-[--mike-card-hover] hover:border-[--mike-accent] text-[--mike-fg-muted] hover:text-[--mike-accent] transition disabled:opacity-50" title={`Atualizar (auto em ${15 - ultimaAtualizacao}s)`}>
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'mike-spin' : ''}`} />
            </button>
          </div>

          <div className="w-full overflow-x-auto pb-2 scrollbar-none">
            <div className="flex justify-start md:justify-center items-center gap-2.5 min-w-min">
              {ESPORTES_FILTROS.map((e) => {
                const cores = ESPORTE_CORES[e.id] || ESPORTE_CORES['E-Football'];
                const ativo = esporteAtivo === e.id;
                return (
                  <button key={e.id} onClick={() => setEsporteAtivo(ativo ? null : e.id)}
                    className={`px-3.5 py-1 rounded-full text-xs font-semibold border transition whitespace-nowrap ${ativo ? `${cores.activeBg} ${cores.activeText} ${cores.activeBorder} shadow-lg ${cores.activeShadow}` : 'bg-[--mike-card] text-[--mike-fg-muted] border-[--mike-border] hover:bg-[--mike-card-hover] hover:text-[--mike-fg]'}`}>
                    {e.label}
                  </button>
                );
              })}
              {(esporteAtivo || busca) && (
                <button onClick={() => { setEsporteAtivo(null); setBusca(''); }} className="ml-1 px-3 py-1 rounded-full text-xs font-medium border border-[--mike-border] text-[--mike-fg-muted] hover:text-[--mike-fg] hover:border-[--mike-accent]/40 transition flex items-center gap-1.5 whitespace-nowrap">
                  <FilterX className="w-3 h-3" />
                  Limpar filtros
                </button>
              )}
            </div>
          </div>
        </div>

        {/* GRID PAINEIS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-10">
          {loading ? (
            <><SkeletonPainel /><SkeletonPainel /></>
          ) : (
            <>
              <PainelPartidas titulo="Partidas anteriores" partidas={anterioresFiltradas} tipo="anterior" esporteAtivo={esporteAtivo} onAbrirPartida={handleAbrirPartida} onAbrirH2H={handleAbrirH2H} />
              <PainelPartidas titulo="Ao vivo agora" partidas={proximasFiltradas} tipo="proxima" esporteAtivo={esporteAtivo} onAbrirPartida={handleAbrirPartida} onAbrirH2H={handleAbrirH2H} />
            </>
          )}
        </div>

        {/* STATUS */}
        <div className="text-center">
          <p className="text-[10px] text-[--mike-fg-muted] flex items-center justify-center gap-1.5">
            <span className="mike-refresh-dot inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
            {refreshing ? 'Atualizando...' : `Próxima atualização em ${15 - ultimaAtualizacao}s`}
            {statsDash?.bookmakers_ativos?.length > 0 && (
              <span className="ml-2">· {statsDash.bookmakers_ativos.join(', ')}</span>
            )}
          </p>
        </div>
      </main>
    </div>
  );
}
