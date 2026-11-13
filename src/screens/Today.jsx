import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Search, Bell, Settings, ChevronDown, Home, Activity, Store, Bot, Table2, BarChart3, Plus,
  Clock, ExternalLink, X, FilterX, RefreshCw, Radio, ChevronRight, History, Zap
} from 'lucide-react';
import MikeHeader from '../shared/MikeHeader.jsx';
import { EstadoVazio, EstadoErro } from '../shared/Estados.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { ApiEventos, ApiStats } from '../lib/api.js';
import { usePais } from '../context/PaisContext.jsx';

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
  'E-Football': { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30', activeBg: 'bg-emerald-500', activeText: 'text-emerald-950', activeBorder: 'border-emerald-500', activeShadow: 'shadow-emerald-500/40' },
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
// nov/2026: data/hora no fuso do país escolhido (fmt = formatarData/formatarHora
// do PaisContext). O tick vem em ISO com fuso (timestamptz): /eventos/live manda
// `ultimo_tick` e /eventos/finished manda `ts`.
function normalizarEvento(ev, fmt) {
  const instante = ev.ultimo_tick || ev.ts || null;
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
    hora: instante ? fmt.formatarHora(instante) : '',
    data: instante ? fmt.formatarData(instante) : '',
    bookmaker: ev.bookmaker,
    aoVivo: true,
    live_time: ev.live_time || '',
    event_id: ev.event_id,
  };
}

// ============================================================
// COMPONENTES
// ============================================================

// Número que "corre" até o valor novo em vez de trocar de uma vez.
function useContagem(alvo, ms = 700) {
  const [valor, setValor] = useState(0);
  const atualRef = useRef(0);
  useEffect(() => {
    const de = atualRef.current;
    const para = Number(alvo) || 0;
    if (de === para) return undefined;
    const t0 = performance.now();
    let quadro;
    const passo = (t) => {
      const k = Math.min(1, (t - t0) / ms);
      const suave = 1 - Math.pow(1 - k, 3);
      const agora = Math.round(de + (para - de) * suave);
      atualRef.current = agora;
      setValor(agora);
      if (k < 1) quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [alvo, ms]);
  return valor;
}

const KPI_TONS = {
  vivo:  { chip: 'bg-red-500/15 border-red-500/30 text-red-400',             brilho: 'rgba(239, 68, 68, 0.22)' },
  marca: { chip: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300', brilho: 'rgba(43, 205, 185, 0.22)' },
  info:  { chip: 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300',          brilho: 'rgba(56, 189, 248, 0.2)' },
};

function CartaoKpi({ icone: Icone, rotulo, valor, tom = 'marca', pulsando = false, carregando = false, legenda }) {
  const contado = useContagem(valor);
  const t = KPI_TONS[tom] || KPI_TONS.marca;
  return (
    <div className="mike-kpi rounded-2xl p-3 sm:px-4 sm:py-3.5 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 min-w-0" style={{ '--mike-kpi-brilho': t.brilho }}>
      <div className={`relative w-8 h-8 sm:w-10 sm:h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${t.chip}`}>
        <Icone className="w-4 h-4" />
        {pulsando && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500 mike-pulse-live" />}
      </div>
      <div className="min-w-0">
        <div className="text-[10px] text-[--mike-fg-muted] uppercase tracking-wider font-semibold truncate">{rotulo}</div>
        {carregando ? (
          <div className="mike-skeleton h-6 w-14 mt-1" />
        ) : (
          <div className="font-display text-xl sm:text-2xl font-bold text-[--mike-fg] leading-tight tabular-nums truncate">
            {contado.toLocaleString('pt-BR')}
          </div>
        )}
        {legenda && <div className="hidden sm:block text-[10px] text-[--mike-fg-muted] truncate">{legenda}</div>}
      </div>
    </div>
  );
}

// Botão de atualizar com o anel que mostra quanto falta para a próxima atualização automática.
function BotaoAtualizar({ onClick, girando, desabilitado, segundos, total = 15 }) {
  const raio = 15;
  const volta = 2 * Math.PI * raio;
  const fracao = Math.max(0, Math.min(1, segundos / total));
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desabilitado}
      className="relative w-11 h-11 flex-shrink-0 rounded-xl bg-[--mike-card] border border-[--mike-border] hover:bg-[--mike-card-hover] hover:border-[--mike-accent] text-[--mike-fg-muted] hover:text-[--mike-accent] transition disabled:opacity-50 flex items-center justify-center"
      title={`Atualizar agora (automático em ${Math.max(0, total - segundos)}s)`}
      aria-label="Atualizar agora"
    >
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 44 44" aria-hidden>
        <circle cx="22" cy="22" r={raio} fill="none" stroke="rgba(50, 100, 104, 0.35)" strokeWidth="2" />
        <circle
          cx="22" cy="22" r={raio} fill="none" stroke="var(--mike-accent)" strokeWidth="2" strokeLinecap="round"
          strokeDasharray={volta} strokeDashoffset={volta * (1 - fracao)}
          style={{ transition: 'stroke-dashoffset 1s linear' }}
        />
      </svg>
      <RefreshCw className={`w-3.5 h-3.5 ${girando ? 'mike-spin' : ''}`} />
    </button>
  );
}

function PillEsporte({ esporte }) {
  const c = ESPORTE_CORES[esporte] || ESPORTE_CORES['E-Football'];
  const label = esporte === 'E-Football' ? 'e-Soccer' : esporte === 'E-Basketball' ? 'e-Basket' : esporte;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border flex-shrink-0 ${c.bg} ${c.text} ${c.border}`}>
      {label}
    </span>
  );
}

function Placar({ a, b }) {
  return (
    <div className="flex items-center justify-center gap-1.5 min-w-[64px] px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500/20 to-emerald-500/10 border border-emerald-500/40 font-mono text-base font-black shadow-lg shadow-emerald-500/10 flex-shrink-0">
      <span className={a > b ? 'text-emerald-300' : a < b ? 'text-red-400' : 'text-[--mike-fg]'}>{a ?? '-'}</span>
      <span className="text-[--mike-fg-muted]">:</span>
      <span className={b > a ? 'text-emerald-300' : b < a ? 'text-red-400' : 'text-[--mike-fg]'}>{b ?? '-'}</span>
    </div>
  );
}

function CardPartidaPainel({ p, tipo, onAbrirPartida }) {
  const isAnt = tipo === 'anterior';
  const aoVivoAgora = !isAnt && p.aoVivo;
  const temPlacar = p.placarA != null && p.placarB != null;
  // Sem onAbrirPartida (tela de Partida desligada em config/paineis.js) a linha
  // é só informação: não vira botão, não ganha cursor de clique nem seta.
  const clicavel = Boolean(onAbrirPartida);
  const abrir = () => onAbrirPartida?.(p);
  const interacao = clicavel
    ? { onClick: abrir, onKeyDown: (e) => { if (e.key === 'Enter') { e.preventDefault(); abrir(); } }, role: 'button', tabIndex: 0 }
    : {};

  return (
    <div
      {...interacao}
      className={`group relative px-4 py-3 border-b border-mike-border/60 last:border-b-0 ${clicavel ? 'mike-linha-partida cursor-pointer' : 'transition-colors hover:bg-mike-card-2/60'}`}
    >
      <div className="flex items-center gap-2 mb-2 min-w-0">
        <PillEsporte esporte={p.esporte} />
        <span className="text-[10px] text-[--mike-fg-muted] truncate flex-1 min-w-0">{p.liga}</span>
        {aoVivoAgora && (
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-500/15 border border-red-500/40 flex-shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 mike-pulse-live" />
            <span className="text-[9px] font-bold text-red-400 tracking-wider">AO VIVO{p.live_time ? ` · ${p.live_time}` : ''}</span>
          </span>
        )}
        <span className="text-[11px] font-mono text-[--mike-fg-soft] whitespace-nowrap flex-shrink-0">
          <span className="hidden sm:inline">{p.data}, </span><span className="text-[--mike-fg]">{p.hora}</span>
        </span>
        {clicavel && <ChevronRight className="w-3.5 h-3.5 text-[--mike-fg-muted] opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition flex-shrink-0 hidden sm:block" />}
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-2 min-w-0 justify-end">
          <div className="text-right min-w-0 leading-tight">
            <div className="text-[13px] font-bold text-[--mike-fg] truncate">{p.jogadorA}</div>
            {p.timeA && <div className="text-[10px] text-[--mike-fg-muted] truncate">{p.timeA}</div>}
          </div>
          {p.timeA && <TeamLogo nome={p.timeA} size={30} />}
        </div>

        {(isAnt || temPlacar) ? (
          <Placar a={p.placarA} b={p.placarB} />
        ) : (
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-slate-700/80 to-slate-800/80 border border-slate-600/60 shadow-inner flex-shrink-0">
            <span className="italic font-bold text-[10px] text-slate-300 tracking-wider">vs</span>
          </div>
        )}

        <div className="flex items-center gap-2 min-w-0">
          {p.timeB && <TeamLogo nome={p.timeB} size={30} />}
          <div className="min-w-0 leading-tight">
            <div className="text-[13px] font-bold text-[--mike-fg] truncate">{p.jogadorB}</div>
            {p.timeB && <div className="text-[10px] text-[--mike-fg-muted] truncate">{p.timeB}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

const ROTULO_ESPORTE = { 'E-Football': 'e-Soccer', 'E-Basketball': 'e-Basket', 'E-Hockey': 'e-Hockey' };

function PainelPartidas({ titulo, icone: Icone = Clock, vivo = false, partidas, tipo, esporteAtivo, busca, erro, onTentar, onAbrirPartida }) {
  const filtrando = Boolean(busca || esporteAtivo);
  return (
    <section className="mike-painel rounded-2xl bg-[--mike-card] border border-[--mike-border] overflow-hidden shadow-2xl shadow-black/40 flex flex-col" style={{ maxHeight: '620px' }}>
      <header className="px-4 sm:px-5 py-3.5 flex items-center justify-between gap-2 flex-shrink-0 border-b border-[--mike-border]">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`w-7 h-7 rounded-lg border flex items-center justify-center flex-shrink-0 ${vivo ? 'bg-red-500/15 border-red-500/30 text-red-400' : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'}`}>
            <Icone className="w-3.5 h-3.5" />
          </span>
          <h2 className="text-sm font-bold text-[--mike-fg] truncate m-0">{titulo}</h2>
          {vivo && partidas.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-red-500 mike-pulse-live flex-shrink-0" />}
        </div>
        <span className="text-[10px] font-mono font-bold text-[--mike-fg-soft] px-2 py-1 rounded-md bg-[--mike-card-2] border border-[--mike-border] flex-shrink-0">
          {partidas.length} {partidas.length === 1 ? 'jogo' : 'jogos'}
        </span>
      </header>

      {erro ? (
        <EstadoErro
          className="flex-1"
          titulo="Não deu para carregar as partidas"
          mensagem={String(erro.message || erro)}
          onTentar={onTentar}
        />
      ) : partidas.length > 0 ? (
        <div className="overflow-y-auto flex-1 mike-scroll">
          {partidas.map((p, i) => (
            // o mesmo jogo pode vir de mais de uma casa: a chave leva a casa e a posição
            <CardPartidaPainel key={`${p.id}|${p.bookmaker || ""}|${i}`} p={p} tipo={tipo} onAbrirPartida={onAbrirPartida} />
          ))}
        </div>
      ) : (
        <EstadoVazio
          className="flex-1"
          icone={filtrando ? FilterX : (vivo ? Radio : Clock)}
          titulo={filtrando ? 'Nenhum jogo com esse filtro' : (vivo ? 'Nenhum jogo ao vivo agora' : 'Nenhum jogo recente')}
          descricao={
            busca ? `Nada encontrado para "${busca}".`
              : esporteAtivo ? `Sem jogos de ${ROTULO_ESPORTE[esporteAtivo] || esporteAtivo} no momento.`
              : 'A lista se atualiza sozinha a cada 15 segundos.'
          }
        />
      )}
    </section>
  );
}

function SkeletonPainel() {
  return (
    <div className="rounded-2xl bg-[--mike-card] border border-[--mike-border] overflow-hidden flex flex-col" style={{ maxHeight: '620px' }}>
      <div className="px-5 py-4 border-b border-[--mike-border] flex items-center gap-2.5">
        <div className="mike-skeleton h-7 w-7 rounded-lg" />
        <div className="mike-skeleton h-3.5 w-32 rounded" />
      </div>
      <div className="p-2 space-y-1.5 flex-1">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="px-3 py-2.5 rounded-md space-y-2.5">
            <div className="flex items-center gap-2">
              <div className="mike-skeleton h-4 w-14 rounded" />
              <div className="mike-skeleton h-2 w-24 rounded" />
              <div className="flex-1" />
              <div className="mike-skeleton h-2 w-16 rounded" />
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 flex justify-end"><div className="mike-skeleton h-3 w-24 rounded" /></div>
              <div className="mike-skeleton h-8 w-16 rounded-lg" />
              <div className="flex-1"><div className="mike-skeleton h-3 w-24 rounded" /></div>
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
  const buscaRef = useRef(null);
  const { usuario } = useAuth();

  const filtros = useMemo(() => ({ sport: esporteAtivo }), [esporteAtivo]);

  // Dados reais da API
  const { data: eventosLive,     loading: loadingLive,     error: erroLive,     refetch: refetchLive }     = useEventosLive(filtros);
  const { data: eventosFinished, loading: loadingFinished, error: erroFinished, refetch: refetchFinished } = useEventosFinished(filtros);
  const { data: statsDash,       loading: loadingStats,    refetch: refetchStats }                          = useStatsDashboard();

  const loading = loadingLive || loadingFinished;
  // O esqueleto só aparece na primeira carga; nas atualizações de 15 em 15s
  // a lista continua na tela (antes ela piscava a cada atualização).
  const [jaCarregou, setJaCarregou] = useState(false);
  useEffect(() => { if (!loading) setJaCarregou(true); }, [loading]);
  const primeiraCarga = loading && !jaCarregou;

  // Data/hora dos jogos no fuso do país escolhido
  const { formatarData, formatarHora } = usePais();
  const fmt = useMemo(() => ({ formatarData, formatarHora }), [formatarData, formatarHora]);

  // Normaliza e filtra por busca
  const proximasFiltradas = useMemo(() => {
    let evs = (eventosLive || []).map(ev => normalizarEvento(ev, fmt));
    if (busca) {
      const t = normalizaBusca(busca);
      evs = evs.filter(p => [p.jogadorA, p.jogadorB, p.liga, p.esporte].some(c => normalizaBusca(c).includes(t)));
    }
    return evs;
  }, [eventosLive, busca, fmt]);

  const anterioresFiltradas = useMemo(() => {
    let evs = (eventosFinished || []).map(ev => normalizarEvento(ev, fmt));
    if (busca) {
      const t = normalizaBusca(busca);
      evs = evs.filter(p => [p.jogadorA, p.jogadorB, p.liga, p.esporte].some(c => normalizaBusca(c).includes(t)));
    }
    return evs;
  }, [eventosFinished, busca, fmt]);

  const stats = useMemo(() => ({
    aoVivo:   proximasFiltradas.length,
    proximas: 0,
    recentes: anterioresFiltradas.length,
    ticksHora: statsDash?.ticks_ultima_hora || 0,
  }), [proximasFiltradas, anterioresFiltradas, statsDash]);

  const handleNavegar = (telaId, contexto) => {
    setTelaAtiva(telaId);
    if (onNavegar) onNavegar(telaId, contexto);
  };

  const handleAbrirPartida = onAbrirPartida ? (partida) => onAbrirPartida(partida) : undefined;

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

  // Atalho "/": põe o cursor na busca (se a pessoa não estiver digitando em outro campo)
  useEffect(() => {
    const aoTeclar = (e) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      const alvo = e.target;
      const digitando = alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.tagName === 'SELECT' || alvo.isContentEditable);
      if (digitando) return;
      e.preventDefault();
      buscaRef.current?.focus();
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, []);

  const primeiroNome = (usuario?.nome || '').trim().split(/\s+/)[0] || '';
  const hoje = useMemo(() => {
    const t = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    return t.charAt(0).toUpperCase() + t.slice(1);
  }, []);
  const casasAtivas = statsDash?.bookmakers_ativos || [];

  const themeVars = {
    '--mike-bg': '#060b0f', '--mike-bg-2': '#04080b', '--mike-card': '#0b1519',
    '--mike-card-2': '#0f1c21', '--mike-card-hover': '#132429', '--mike-border': '#1a2c31',
    '--mike-fg': '#eef8f6', '--mike-fg-soft': '#a9bfbf', '--mike-fg-muted': '#6c8689',
    '--mike-accent': '#2bcdb9', '--mike-accent-2': '#0d847a',
  };

  return (
    <div className="min-h-screen" style={{ ...themeVars, backgroundColor: 'var(--mike-bg)', color: 'var(--mike-fg)', fontFamily: 'var(--mike-font)' }}>
      <style>{`
        .mike-scroll::-webkit-scrollbar { width: 8px; }
        .mike-scroll::-webkit-scrollbar-track { background: transparent; }
        .mike-scroll::-webkit-scrollbar-thumb { background: rgba(43,205,185,0.3); border-radius: 4px; border: 2px solid transparent; background-clip: padding-box; }
        .mike-scroll::-webkit-scrollbar-thumb:hover { background: rgba(43,205,185,0.6); background-clip: padding-box; border: 2px solid transparent; }
        .mike-scroll { scrollbar-width: thin; scrollbar-color: rgba(43,205,185,0.3) transparent; }
        @keyframes mike-shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        .mike-skeleton { background: linear-gradient(90deg, rgba(50,100,104,0.1) 0%, rgba(50,100,104,0.25) 50%, rgba(50,100,104,0.1) 100%); background-size: 200% 100%; animation: mike-shimmer 1.5s infinite linear; border-radius: 4px; }
        @keyframes mike-refresh-pulse { 0%, 100% { opacity: 0.4; transform: scale(1); } 50% { opacity: 1; transform: scale(1.2); } }
        .mike-refresh-dot { animation: mike-refresh-pulse 1s ease-in-out infinite; }
        @keyframes mike-live-pulse { 0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(239,68,68,0.7); } 50% { opacity: 0.8; box-shadow: 0 0 0 5px rgba(239,68,68,0); } }
        .mike-pulse-live { animation: mike-live-pulse 1.4s ease-out infinite; }
        @keyframes mike-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .mike-spin { animation: mike-spin 0.8s linear infinite; }
      `}</style>

      <MikeHeader telaAtiva={telaAtiva} onNavegar={handleNavegar} />

      <main className="max-w-screen-xl mx-auto px-4 lg:px-8 pt-7 sm:pt-9 pb-10">
        {/* TOPO: saudação + busca */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5 mb-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-[--mike-fg-muted]">
              <span className="mike-ponto-vivo" />
              {hoje}
            </div>
            <h1 className="text-2xl md:text-[2rem] font-bold text-[--mike-fg] mt-2 mb-0 leading-tight">
              {primeiroNome ? <>Olá, <span className="text-[--mike-menta]">{primeiroNome}</span></> : 'Partidas do dia'}
            </h1>
            <p className="text-sm text-[--mike-fg-muted] mt-1.5 mb-0">Acompanhe todas as partidas do dia, ao vivo e encerradas.</p>
          </div>

          <div className="w-full lg:w-[440px] flex gap-2 flex-shrink-0">
            <div className="flex-1 min-w-0 h-11 flex items-center gap-2 px-3.5 rounded-xl bg-[--mike-card] border border-[--mike-border] focus-within:border-[--mike-accent] focus-within:shadow-[0_0_0_3px_rgba(43,205,185,0.14)] transition">
              <Search className="w-4 h-4 text-[--mike-fg-muted] flex-shrink-0" />
              <input
                ref={buscaRef}
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') { setBusca(''); e.currentTarget.blur(); } }}
                placeholder="Buscar jogador, liga ou esporte"
                className="flex-1 min-w-0 bg-transparent outline-none text-sm placeholder:text-[--mike-fg-muted]"
                aria-label="Buscar partidas"
              />
              {busca ? (
                <button type="button" onClick={() => setBusca('')} className="p-1 rounded hover:bg-[--mike-card-hover] text-[--mike-fg-muted] hover:text-[--mike-fg] transition" aria-label="Limpar busca">
                  <X className="w-4 h-4" />
                </button>
              ) : (
                <kbd className="mike-kbd hidden md:inline-flex" title="Aperte / para buscar">/</kbd>
              )}
            </div>
            <BotaoAtualizar onClick={fazerRefresh} girando={refreshing} desabilitado={refreshing || loading} segundos={ultimaAtualizacao} />
          </div>
        </div>

        {/* NÚMEROS DO MOMENTO */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3 mb-5">
          <CartaoKpi icone={Radio} rotulo="Ao vivo" valor={stats.aoVivo} tom="vivo" pulsando={stats.aoVivo > 0} carregando={primeiraCarga} legenda="jogos em andamento" />
          <CartaoKpi icone={History} rotulo="Recentes" valor={stats.recentes} tom="marca" carregando={primeiraCarga} legenda="últimos encerrados" />
          <CartaoKpi icone={Zap} rotulo="Ticks/hora" valor={stats.ticksHora} tom="info" carregando={loadingStats} legenda="leituras de odds na última hora" />
        </div>

        {/* FILTRO DE ESPORTE */}
        <div className="w-full overflow-x-auto pb-1 mb-4 scrollbar-none">
          <div className="flex items-center gap-2 min-w-min">
            <button
              type="button"
              onClick={() => setEsporteAtivo(null)}
              className={`px-3.5 h-8 rounded-full text-xs font-semibold border transition whitespace-nowrap ${!esporteAtivo ? 'bg-mike-accent/15 text-[--mike-menta] border-mike-accent/50' : 'bg-[--mike-card] text-[--mike-fg-muted] border-[--mike-border] hover:bg-[--mike-card-hover] hover:text-[--mike-fg]'}`}
            >
              Todos
            </button>
            {ESPORTES_FILTROS.map((e) => {
              const cores = ESPORTE_CORES[e.id] || ESPORTE_CORES['E-Football'];
              const ativo = esporteAtivo === e.id;
              return (
                <button key={e.id} type="button" onClick={() => setEsporteAtivo(ativo ? null : e.id)}
                  className={`px-3.5 h-8 rounded-full text-xs font-semibold border transition whitespace-nowrap ${ativo ? `${cores.activeBg} ${cores.activeText} ${cores.activeBorder} shadow-lg ${cores.activeShadow}` : 'bg-[--mike-card] text-[--mike-fg-muted] border-[--mike-border] hover:bg-[--mike-card-hover] hover:text-[--mike-fg]'}`}>
                  {e.label}
                </button>
              );
            })}
            {(esporteAtivo || busca) && (
              <button type="button" onClick={() => { setEsporteAtivo(null); setBusca(''); }} className="ml-1 px-3 h-8 rounded-full text-xs font-medium border border-[--mike-border] text-[--mike-fg-muted] hover:text-[--mike-fg] hover:border-mike-accent/40 transition flex items-center gap-1.5 whitespace-nowrap">
                <FilterX className="w-3 h-3" />
                Limpar filtros
              </button>
            )}
          </div>
        </div>

        {/* PAINÉIS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5 mb-8">
          {primeiraCarga ? (
            <><SkeletonPainel /><SkeletonPainel /></>
          ) : (
            <>
              <PainelPartidas titulo="Ao vivo agora" icone={Radio} vivo partidas={proximasFiltradas} tipo="proxima" esporteAtivo={esporteAtivo} busca={busca} erro={erroLive} onTentar={fazerRefresh} onAbrirPartida={handleAbrirPartida} />
              <PainelPartidas titulo="Partidas anteriores" icone={Clock} partidas={anterioresFiltradas} tipo="anterior" esporteAtivo={esporteAtivo} busca={busca} erro={erroFinished} onTentar={fazerRefresh} onAbrirPartida={handleAbrirPartida} />
            </>
          )}
        </div>

        {/* STATUS */}
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-[11px] text-[--mike-fg-muted]">
          <span className="flex items-center gap-1.5">
            <span className="mike-refresh-dot inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
            {refreshing ? 'Atualizando...' : `Próxima atualização em ${15 - ultimaAtualizacao}s`}
          </span>
          {casasAtivas.length > 0 && (
            <span className="flex flex-wrap items-center justify-center gap-1.5">
              {casasAtivas.map((c) => (
                <span key={c} className="px-2 py-0.5 rounded-md bg-[--mike-card] border border-[--mike-border] text-[--mike-fg-soft] font-medium">{c}</span>
              ))}
            </span>
          )}
        </div>
      </main>
    </div>
  );
}
