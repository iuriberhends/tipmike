import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  Search, Bell, ChevronDown, ChevronUp, Home, Activity,
  Clock, ExternalLink, X, FilterX, Gamepad2, Disc, Snowflake, CircleDot, Zap, Check, Wifi, Flame, AlertCircle,
  RefreshCw
} from 'lucide-react';
import MikeHeader from '../shared/MikeHeader.jsx';
import { ApiEventos, ApiH2H } from '../lib/api.js';

// ============================================================
// ESPORTES / TEMAS (mantidos do original)
// ============================================================
const ESPORTE_TEMA = {
  'E-Football': {
    icone: Gamepad2, cardBorder: 'rgba(16, 185, 129, 0.5)',
    headerBg: 'bg-emerald-900/40', headerBorder: 'border-emerald-500/30',
    headerText: 'text-emerald-300', headerSubText: 'text-emerald-400/60',
    headerDot: 'bg-emerald-400', headerTimer: 'text-emerald-300',
    timerIcon: 'text-emerald-400/80', btnBg: 'bg-emerald-500/15',
    btnBorder: 'border-emerald-500', btnText: 'text-emerald-300',
    bet365Bg: 'bg-emerald-500/90', bet365Text: 'text-emerald-950',
    bet365Shadow: 'shadow-emerald-500/30',
  },
  'E-Basketball': {
    icone: Gamepad2, cardBorder: 'rgba(244, 63, 94, 0.5)',
    headerBg: 'bg-rose-950/50', headerBorder: 'border-rose-500/30',
    headerText: 'text-rose-400', headerSubText: 'text-rose-400/60',
    headerDot: 'bg-emerald-400', headerTimer: 'text-rose-400',
    timerIcon: 'text-rose-400/80', btnBg: 'bg-rose-500/15',
    btnBorder: 'border-rose-500', btnText: 'text-rose-300',
    bet365Bg: 'bg-emerald-500/90', bet365Text: 'text-emerald-950',
    bet365Shadow: 'shadow-emerald-500/30',
  },
  'E-Hockey': {
    icone: Snowflake, cardBorder: 'rgba(6, 182, 212, 0.5)',
    headerBg: 'bg-cyan-950/50', headerBorder: 'border-cyan-500/30',
    headerText: 'text-cyan-300', headerSubText: 'text-cyan-400/60',
    headerDot: 'bg-emerald-400', headerTimer: 'text-cyan-300',
    timerIcon: 'text-cyan-400/80', btnBg: 'bg-cyan-500/15',
    btnBorder: 'border-cyan-500', btnText: 'text-cyan-300',
    bet365Bg: 'bg-emerald-500/90', bet365Text: 'text-emerald-950',
    bet365Shadow: 'shadow-emerald-500/30',
  },
};

const ESPORTES_LIVE = [
  { id: 'E-Football',   label: 'e-Soccer'  },
  { id: 'E-Basketball', label: 'e-Basket'  },
  { id: 'E-Hockey',     label: 'e-Hockey'  },
];

// Mapeia sport da API para label amigável
const SPORT_LABEL = {
  'E-Football':   'e-Soccer',
  'E-Basketball': 'e-Basket',
  'E-Hockey':     'e-Hockey',
};

function normalizaTxt(s) {
  return (s || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// ============================================================
// HOOKS DE DADOS REAIS
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
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!eventId) return;
    setLoading(true);
    ApiEventos.odds(eventId)
      .then(data => setOdds(data || []))
      .catch(() => setOdds([]))
      .finally(() => setLoading(false));
  }, [eventId]);

  return { odds, loading };
}

// Agrupa odds por mercado_tipo
function agruparMercados(odds) {
  const mapa = {};
  for (const o of odds) {
    const tipo = o.mercado || o.mercado_tipo || 'Mercado';
    if (!mapa[tipo]) mapa[tipo] = { nome: tipo, linhas: [] };
    mapa[tipo].linhas.push({
      sel: o.selecao || '',
      odd: o.odds || null,
      linha: o.linha || '',
      ult10: 0,
      total: 0,
    });
  }
  return Object.values(mapa);
}

// ============================================================
// COMPONENTES
// ============================================================
function corPct(pct) {
  if (pct >= 60) return 'text-emerald-400';
  if (pct >= 50) return 'text-emerald-500';
  if (pct < 30) return 'text-rose-400';
  return 'text-[--mike-fg]';
}

function TabelaMercado({ mercado }) {
  return (
    <div className="rounded-md overflow-hidden" style={{ backgroundColor: '#0d1220', border: '0.5px solid rgba(60, 85, 130, 0.4)' }}>
      <div className="px-2 py-1 text-center" style={{ backgroundColor: '#1a2540', borderBottom: '0.5px solid rgba(60, 85, 130, 0.4)' }}>
        <span className="text-[10px] font-bold text-[--mike-fg] tracking-wide">{mercado.nome}</span>
      </div>
      <div className="px-2 py-0.5">
        <div className="flex items-center text-[8px] uppercase tracking-wider font-bold text-[--mike-fg-muted] gap-2">
          <div className="flex-1 min-w-0" />
          <div className="w-9 text-right flex-shrink-0">Odd</div>
          <div className="w-11 text-right flex-shrink-0">Total</div>
        </div>
        {mercado.linhas.map((l, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="flex-1 min-w-0 text-[10px] text-[--mike-fg-soft] truncate">
              {l.sel}{l.linha ? ` ${l.linha}` : ''}
            </div>
            <div className="w-9 text-right text-[10px] font-mono font-semibold text-[--mike-fg] flex-shrink-0">
              {l.odd === null ? <span className="text-[--mike-fg-muted]">N/A</span> : Number(l.odd).toFixed(2)}
            </div>
            <div className={`w-11 text-right text-[10px] font-mono font-bold flex-shrink-0 ${corPct(l.total)}`}>
              {l.total.toFixed(1)}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CardLive({ ev, onAbrirPartida, onAbrirH2H }) {
  const tema = ESPORTE_TEMA[ev.sport] || ESPORTE_TEMA['E-Football'];
  const { odds } = useOddsEvento(ev.event_id);
  const mercados = useMemo(() => agruparMercados(odds), [odds]);

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

  const hora = ev.ultimo_tick
    ? new Date(ev.ultimo_tick).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div className="rounded-lg bg-[--mike-card] overflow-hidden shadow-lg shadow-black/30" style={{ border: `0.5px solid ${tema.cardBorder}` }}>
      {/* Header */}
      <div className={`px-3 py-1.5 ${tema.headerBg} flex items-center justify-between`}>
        <div className="flex items-center gap-1.5 min-w-0">
          <div className={`w-1.5 h-1.5 rounded-full ${tema.headerDot} animate-pulse flex-shrink-0`} />
          <span className={`text-[11px] font-bold ${tema.headerText} truncate`}>
            {ev.liga || ev.sport}
          </span>
          <span className={`text-[9px] ${tema.headerSubText} flex-shrink-0`}>
            {SPORT_LABEL[ev.sport] || ev.sport}
          </span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Clock className={`w-2.5 h-2.5 ${tema.timerIcon}`} />
          <span className={`text-[10px] font-mono font-bold ${tema.headerTimer}`}>
            {ev.live_time || hora}
          </span>
          <span className="text-[8px] font-bold px-1 py-px rounded bg-red-500/20 text-red-400 border border-red-500/30 ml-1">
            AO VIVO
          </span>
        </div>
      </div>

      <div className="px-3 py-2">
        {/* Confronto */}
        <button
          onClick={() => onAbrirPartida?.(ev)}
          className="w-full flex items-center justify-center gap-3 mb-2 hover:bg-[--mike-card-hover]/40 rounded-md py-1 transition cursor-pointer"
        >
          <div className="text-right min-w-0 leading-tight max-w-[40%]">
            <div className="text-[13px] font-bold text-[--mike-fg] truncate">{ev.jogador_a || '?'}</div>
          </div>

          <div className={`flex items-center justify-center gap-1.5 min-w-[60px] px-3 py-1 rounded-md bg-[--mike-card-2] font-mono text-sm font-black transition-all ${placarPiscou ? 'ring-2 ring-emerald-400' : ''}`}>
            <span className="text-[--mike-fg]">{ev.score_home ?? '-'}</span>
            <span className="text-[--mike-fg-muted]">-</span>
            <span className="text-[--mike-fg]">{ev.score_away ?? '-'}</span>
          </div>

          <div className="text-left min-w-0 leading-tight max-w-[40%]">
            <div className="text-[13px] font-bold text-[--mike-fg] truncate">{ev.jogador_b || '?'}</div>
          </div>
        </button>

        {/* Botões */}
        <div className="flex items-center justify-center gap-1 mt-2 mb-2">
          <button
            onClick={() => onAbrirH2H?.(ev)}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-[--mike-card-2] hover:bg-[--mike-accent]/10 text-[9px] font-bold text-[--mike-fg-soft] hover:text-[--mike-accent] transition"
          >
            H2H <ExternalLink className="w-2 h-2" />
          </button>
          <span className="text-[9px] text-[--mike-fg-muted] px-2">{ev.bookmaker}</span>
        </div>

        {/* Mercados */}
        {mercados.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5" style={{ maxHeight: '195px', overflowY: 'auto' }}>
            {mercados.slice(0, 6).map((m, i) => (
              <TabelaMercado key={i} mercado={m} />
            ))}
          </div>
        ) : (
          <div className="text-center py-3 text-[10px] text-[--mike-fg-muted]">
            Carregando odds...
          </div>
        )}
      </div>
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="rounded-lg overflow-hidden bg-[--mike-card]" style={{ border: '0.5px solid rgba(60, 85, 130, 0.4)' }}>
      <div className="px-3 py-2 flex items-center justify-between" style={{ backgroundColor: 'rgba(16, 24, 40, 0.6)' }}>
        <div className="mike-skeleton h-3 w-32" />
        <div className="mike-skeleton h-3 w-12" />
      </div>
      <div className="px-3 py-2 space-y-2.5">
        <div className="flex items-center justify-center gap-3 py-1">
          <div className="mike-skeleton h-3 w-20" />
          <div className="mike-skeleton h-7 w-14 rounded-md" />
          <div className="mike-skeleton h-3 w-20" />
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {[1,2,3,4].map(i => <div key={i} className="mike-skeleton h-20" />)}
        </div>
      </div>
    </div>
  );
}

function MikeSelect({ value, onChange, options }) {
  const [aberto, setAberto] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setAberto(false);
    };
    if (aberto) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [aberto]);

  const selecionada = options.find(o => o.value === value);

  return (
    <div ref={wrapperRef} className="relative w-full">
      <button onClick={() => setAberto(!aberto)} className="mike-border-thin w-full flex items-center justify-between px-2.5 py-1.5 rounded-md bg-transparent text-xs text-[--mike-fg]">
        <span>{selecionada?.label || ''}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-[--mike-fg-muted] flex-shrink-0 transition-transform ${aberto ? 'rotate-180' : ''}`} />
      </button>
      {aberto && (
        <div className="absolute z-40 left-0 right-0 mt-1 rounded-md overflow-y-auto" style={{ backgroundColor: '#0d1220', border: '0.5px solid rgba(60,85,130,0.4)', maxHeight: '200px' }}>
          {options.map(o => (
            <button key={o.value} onClick={() => { onChange(o.value); setAberto(false); }}
              className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left transition ${value === o.value ? 'bg-[--mike-accent]/15 text-[--mike-accent] font-semibold' : 'text-[--mike-fg-soft] hover:bg-[--mike-card-2]/50'}`}>
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
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [torneio, setTorneio] = useState('todos');
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(0);

  const { data: eventosLive, loading, refetch } = useEventosLive(esporteAtivo);

  // Filtra por busca e torneio
  const eventosFiltrados = useMemo(() => {
    let evs = eventosLive || [];
    if (torneio !== 'todos') evs = evs.filter(e => e.liga === torneio);
    if (busca) {
      const t = normalizaTxt(busca);
      evs = evs.filter(e => [e.jogador_a, e.jogador_b, e.liga, e.sport].some(c => normalizaTxt(c).includes(t)));
    }
    return evs;
  }, [eventosLive, torneio, busca]);

  // Torneios disponíveis
  const torneios = useMemo(() => {
    const set = new Set((eventosLive || []).map(e => e.liga).filter(Boolean));
    return Array.from(set).sort();
  }, [eventosLive]);

  const handleNavegar = (telaId) => {
    setTelaAtiva(telaId);
    if (onNavegar) onNavegar(telaId);
  };

  const handleAbrirPartida = (ev) => {
    if (onAbrirPartida) onAbrirPartida(ev);
  };

  const handleAbrirH2H = (ev) => {
    if (onNavegar) onNavegar('h2h', { ja: ev.jogador_a, jb: ev.jogador_b });
  };

  const fazerRefresh = useCallback(() => {
    setRefreshing(true);
    refetch().finally(() => { setRefreshing(false); setUltimaAtualizacao(0); });
  }, [refetch]);

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

  const algumFiltroAtivo = torneio !== 'todos' || busca;

  const themeVars = {
    '--mike-bg': '#0b0f1a', '--mike-bg-2': '#070a13', '--mike-card': '#141a28',
    '--mike-card-2': '#1a2030', '--mike-card-hover': '#1d2434', '--mike-border': '#222a3d',
    '--mike-fg': '#eaeef7', '--mike-fg-soft': '#a8b3c9', '--mike-fg-muted': '#6b7691',
    '--mike-accent': '#10b981', '--mike-accent-2': '#0891b2',
  };

  return (
    <div className="min-h-screen" style={{ ...themeVars, backgroundColor: 'var(--mike-bg)', color: 'var(--mike-fg)', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <style>{`
        .scrollbar-none::-webkit-scrollbar { display: none; }
        .scrollbar-none { scrollbar-width: none; }
        .mike-border-thin { border: 0.5px solid rgba(60,85,130,0.4) !important; }
        .mike-border-thin:hover { border-color: rgba(80,110,170,0.7) !important; }
        .mike-border-thin:focus { border-color: rgba(16,185,129,0.7) !important; outline: none; }
        @keyframes mike-shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        .mike-skeleton { background: linear-gradient(90deg, rgba(60,85,130,0.1) 0%, rgba(60,85,130,0.25) 50%, rgba(60,85,130,0.1) 100%); background-size: 200% 100%; animation: mike-shimmer 1.5s infinite linear; border-radius: 4px; }
        @keyframes mike-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .mike-spin { animation: mike-spin 0.8s linear infinite; }
        @keyframes mike-refresh-pulse { 0%,100% { opacity:0.4; transform:scale(1); } 50% { opacity:1; transform:scale(1.2); } }
        .mike-refresh-dot { animation: mike-refresh-pulse 1s ease-in-out infinite; }
      `}</style>

      <MikeHeader telaAtiva={telaAtiva} onNavegar={handleNavegar} />

      <main className="max-w-screen-2xl mx-auto px-4 lg:px-8 py-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs text-[--mike-fg-muted] mb-4">
          <Home className="w-3.5 h-3.5" />
          <span>Início</span>
          <span>›</span>
          <span className="text-[--mike-fg] font-semibold">Ao Vivo</span>
        </div>

        {/* Filtros de esporte */}
        <div className="mb-4">
          <h3 className="text-xs text-[--mike-fg-muted] mb-2">Escolha o esporte</h3>
          <div className="flex flex-wrap gap-2">
            {ESPORTES_LIVE.map((e) => {
              const ativo = esporteAtivo === e.id;
              const tema = ESPORTE_TEMA[e.id];
              const Icone = tema.icone;
              return (
                <button key={e.id} onClick={() => setEsporteAtivo(ativo ? null : e.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold transition ${
                    ativo ? `${tema.btnBg} border ${tema.btnBorder} ${tema.btnText}` : 'mike-border-thin bg-transparent text-[--mike-fg-muted] hover:text-[--mike-fg]'
                  }`}>
                  <Icone className="w-3.5 h-3.5" />
                  {e.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Busca + filtros + refresh */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="mike-border-thin flex-1 min-w-[200px] flex items-center gap-2 px-3 py-2 rounded-md bg-transparent">
            <Search className="w-4 h-4 text-[--mike-fg-muted]" />
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar jogadores, ligas..." className="flex-1 bg-transparent text-xs text-[--mike-fg] placeholder:text-[--mike-fg-muted] outline-none" />
            {busca && <button onClick={() => setBusca('')}><X className="w-3.5 h-3.5 text-[--mike-fg-muted]" /></button>}
          </div>
          <button onClick={fazerRefresh} disabled={refreshing || loading}
            className="px-3 py-2 rounded-md mike-border-thin bg-transparent text-[--mike-fg-muted] hover:text-[--mike-accent] transition disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'mike-spin' : ''}`} />
          </button>
          <button onClick={() => setFiltrosAbertos(!filtrosAbertos)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold transition ${filtrosAbertos ? 'bg-[--mike-accent]/15 text-[--mike-accent]' : 'mike-border-thin bg-transparent text-[--mike-fg-soft]'}`}>
            {filtrosAbertos ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            Filtros
            {algumFiltroAtivo && <span className="ml-0.5 px-1.5 py-0 rounded-full text-[9px] font-black bg-[--mike-accent] text-[--mike-bg]">!</span>}
          </button>
        </div>

        {/* Filtros expansíveis */}
        {filtrosAbertos && (
          <div className="mb-4 rounded-lg p-4" style={{ border: '0.5px solid rgba(60,85,130,0.4)' }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-[--mike-fg]">Filtros</h3>
              <span className="text-[10px] text-[--mike-fg-muted]">{eventosFiltrados.length} partidas</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-[--mike-fg-muted] mb-1">Torneio</label>
                <MikeSelect value={torneio} onChange={setTorneio} options={[
                  { value: 'todos', label: 'Todos os torneios' },
                  ...torneios.map(t => ({ value: t, label: t })),
                ]} />
              </div>
            </div>
            {algumFiltroAtivo && (
              <button onClick={() => { setTorneio('todos'); setBusca(''); }}
                className="mt-3 mike-border-thin px-3 py-1.5 rounded-md text-xs text-[--mike-fg] hover:text-rose-400 transition bg-transparent">
                Limpar filtros
              </button>
            )}
          </div>
        )}

        {/* Status */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="mike-refresh-dot inline-block w-1.5 h-1.5 rounded-full bg-red-400" />
            <span className="text-xs font-bold text-[--mike-fg]">{eventosFiltrados.length} ao vivo</span>
          </div>
          <span className="text-[10px] text-[--mike-fg-muted]">
            {refreshing ? 'Atualizando...' : `Próxima atualização em ${15 - ultimaAtualizacao}s`}
          </span>
        </div>

        {/* Grid de cards */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[1,2,3,4].map(i => <CardSkeleton key={i} />)}
          </div>
        ) : eventosFiltrados.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {eventosFiltrados.map(ev => (
              <CardLive key={`${ev.bookmaker}-${ev.event_id}`} ev={ev} onAbrirPartida={handleAbrirPartida} onAbrirH2H={handleAbrirH2H} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl bg-[--mike-card] border border-[--mike-border] py-16 px-6 text-center">
            <FilterX className="w-12 h-12 text-[--mike-fg-muted] opacity-40 mx-auto mb-3" />
            <p className="text-sm text-[--mike-fg] font-semibold mb-1">Nenhuma partida encontrada</p>
            <p className="text-xs text-[--mike-fg-muted]">
              {esporteAtivo ? `Nenhum jogo ao vivo de ${SPORT_LABEL[esporteAtivo] || esporteAtivo} no momento.` : 'Nenhum jogo ao vivo no momento.'}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
