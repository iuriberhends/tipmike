// ============================================================
// tipmike_bots.jsx (SINGLE FILE - arquitetura embutida)
//
// Esta versão tem TODA a arquitetura plug-and-play num arquivo
// só pra rodar em artifact React. Quando migrar pro projeto real,
// quebra nos arquivos da pasta tipmike/ (lib, data, hooks, screens).
//
// ESTRUTURA:
//   1. CONSTANTES (CASAS, ESTRATEGIAS, STATUS_BOT, CONTAS, ESPORTES)
//   2. HELPERS (hashStr, seeded, normaliza, escalarMetricasPorPeriodo)
//   3. MOCKS (MOCK_BOTS_BASE + handlers por endpoint)
//   4. API CLIENT (apiGet, apiMutate)
//   5. HOOKS (useApiQuery, useApiMutation, useBotsData, etc)
//   6. COMPONENTES (Header, MikeSelect, Sparkline, PainelDesempenho, CardBot)
//   7. APP
// ============================================================

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Search, Bell, Settings, ChevronDown, ChevronUp, Home, Activity, Store, Bot, Table2, BarChart3, Plus,
  Clock, ExternalLink, X, FilterX, Check, Wifi, Flame, AlertCircle,
  Play, Pause, Square, RefreshCw, Power, MoreVertical, Calendar, BellRing,
  TrendingUp, TrendingDown, DollarSign, Target, Percent, Hash, Users, Share2,
  Download, Upload, Edit2, Copy, Trash2, Eye, History, Filter, ArrowUpDown,
  ChevronRight, Zap, Shield, AlertTriangle, CheckCircle2,
} from 'lucide-react';

// ============================================================
// 1. CONSTANTES
// ============================================================

const CASAS = {
  betano:     { id: 'betano',     label: 'Betano',     bg: 'bg-orange-500',  text: 'text-orange-50' },
  superbet:   { id: 'superbet',   label: 'Superbet',   bg: 'bg-red-500',     text: 'text-red-50' },
  bet365:     { id: 'bet365',     label: 'Bet365',     bg: 'bg-emerald-500', text: 'text-emerald-950' },
  estrelabet: { id: 'estrelabet', label: 'Estrelabet', bg: 'bg-yellow-500',  text: 'text-yellow-950' },
  novibet:    { id: 'novibet',    label: 'Novibet',    bg: 'bg-blue-500',    text: 'text-blue-50' },
  vupi:       { id: 'vupi',       label: 'Vupi',       bg: 'bg-purple-500',  text: 'text-purple-50' },
};

const ESTRATEGIAS = {
  oft:      { id: 'oft',      label: 'OFT',      desc: 'Over First Time' },
  oht:      { id: 'oht',      label: 'OHT',      desc: 'Over Half Time' },
  hc_ft:    { id: 'hc_ft',    label: 'HC FT',    desc: 'Handicap Full Time' },
  under_ht: { id: 'under_ht', label: 'Under HT', desc: 'Under Half Time' },
  over_ft:  { id: 'over_ft',  label: 'Over FT',  desc: 'Over Full Time' },
  ml:       { id: 'ml',       label: 'ML',       desc: 'Money Line' },
  hc_h2h:   { id: 'hc_h2h',   label: 'HC H2H',   desc: 'Handicap H2H' },
  ou:       { id: 'ou',       label: 'O/U',      desc: 'Over/Under' },
};

const STATUS_BOT = {
  rodando:  { id: 'rodando',  label: 'Rodando',  color: 'bg-emerald-500', pulse: true,  Icon: Play },
  pausado:  { id: 'pausado',  label: 'Pausado',  color: 'bg-amber-500',   pulse: false, Icon: Pause },
  parado:   { id: 'parado',   label: 'Parado',   color: 'bg-rose-500',    pulse: false, Icon: Square },
  erro:     { id: 'erro',     label: 'Erro',     color: 'bg-rose-600',    pulse: true,  Icon: AlertTriangle },
  agendado: { id: 'agendado', label: 'Agendado', color: 'bg-blue-500',    pulse: false, Icon: Calendar },
};

const CONTAS = [
  { id: 'principal', nome: 'Conta Principal' },
  { id: 'rotacao_1', nome: 'Rotação 1' },
  { id: 'rotacao_2', nome: 'Rotação 2' },
];

const ESPORTES = [
  { id: 'e-Soccer',     label: 'e-Soccer' },
  { id: 'e-Basket',     label: 'e-Basket' },
  { id: 'e-Hockey',     label: 'e-Hockey' },
  { id: 'e-NFL',        label: 'e-NFL' },
  { id: 'Table Tennis', label: 'Tênis de Mesa' },
  { id: 'CS2',          label: 'Counter-Strike 2' },
  { id: 'Tênis',        label: 'Tênis' },
  { id: 'Futebol',      label: 'Futebol' },
];

const NAV_ITEMS = [
  { id: 'today',       label: 'Início',          icon: Home },
  { id: 'live',        label: 'Ao Vivo',         icon: Activity },
  { id: 'marketplace', label: 'Mercado de Bots', icon: Store },
  { id: 'bots',        label: 'Bots',            icon: Bot },
  { id: 'tables',      label: 'Tabelas',         icon: Table2 },
  { id: 'stats',       label: 'Estatísticas',    icon: BarChart3, novo: true },
  { id: 'extras',      label: 'Extras',          icon: Plus },
];

// ============================================================
// 2. HELPERS
// ============================================================

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h = (h ^ s.charCodeAt(i)) * 16777619;
    h = h >>> 0;
  }
  return h;
}

function seeded(seed) {
  let st = seed >>> 0;
  return () => {
    st = (st * 1664525 + 1013904223) >>> 0;
    return st / 0xffffffff;
  };
}

function normaliza(s) {
  return (s || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Formata numero compacto: 1234 -> "1.2K", 1234567 -> "1.2M"
// Mantem ate 999 sem abreviar; valores intermediarios mostram 1 decimal
function formatCompacto(n, opts = {}) {
  const { decimais = 1, prefixoSinal = false } = opts;
  if (n === null || n === undefined || isNaN(n)) return '0';
  const sinal = prefixoSinal && n > 0 ? '+' : '';
  const abs = Math.abs(n);
  if (abs < 1000) {
    // Pequeno: usa 2 decimais se nao for inteiro
    const formatado = Number.isInteger(n) ? n.toString() : n.toFixed(decimais);
    return `${sinal}${formatado}`;
  }
  if (abs < 1_000_000) {
    return `${sinal}${(n / 1000).toFixed(decimais)}K`;
  }
  if (abs < 1_000_000_000) {
    return `${sinal}${(n / 1_000_000).toFixed(decimais)}M`;
  }
  return `${sinal}${(n / 1_000_000_000).toFixed(decimais)}B`;
}

// Os mocks abaixo representam metricas BASE = "hoje" (1 dia tipico)
// Outros periodos escalam a partir disso (ontem ~ hoje, 7d ~ 7x, 30d ~ 30x, geral ~ acumulado historico)
const PERIODO_MULTIPLICADOR = {
  hoje:   { entradas: 1.0,  ruido: 0.0 },
  ontem:  { entradas: 0.95, ruido: 0.15 },
  '24h':  { entradas: 1.05, ruido: 0.05 },
  '7d':   { entradas: 6.8,  ruido: 0.10 },
  '30d':  { entradas: 28,   ruido: 0.08 },
  geral:  { entradas: 95,   ruido: 0.05 }, // ~3 meses acumulados
};

function escalarMetricasPorPeriodo(metricasBase, periodo, seed) {
  const cfg = PERIODO_MULTIPLICADOR[periodo];
  if (!cfg) return metricasBase;
  if (cfg.entradas === 1.0 && cfg.ruido === 0) return metricasBase;

  const r = seeded(seed + hashStr(periodo));
  const ruido = (r() - 0.5) * cfg.ruido * 2;

  const entradas = Math.round(metricasBase.entradas * (cfg.entradas + ruido));
  const lucroBase = metricasBase.lucro * (cfg.entradas + ruido);
  const fatorRoi = 1 + (r() - 0.5) * 0.3;
  const lucro = +(lucroBase * fatorRoi).toFixed(2);

  const stake = metricasBase.stake;
  const roi = entradas > 0 ? +((lucro / (entradas * stake)) * 100).toFixed(2) : 0;
  const wr = +Math.max(0, Math.min(100, metricasBase.wr + (r() - 0.5) * 6)).toFixed(1);
  const ddFator = periodo === 'hoje' || periodo === '24h' ? 0.4 : periodo === 'geral' ? 1.0 : 0.7;
  const dd = +(metricasBase.dd * ddFator * (1 + (r() - 0.5) * 0.4)).toFixed(1);

  return { ...metricasBase, entradas, lucro, roi, wr, dd, sequencia: metricasBase.sequencia };
}

// ============================================================
// 3. MOCKS
// ============================================================

const MOCK_BOTS_BASE = [];

// Estado mutavel dos bots em memoria (status, favorito)
const botsOverrides = {};

function hidratarBot(botBase, periodoPrincipal = 'geral') {
  const override = botsOverrides[botBase.id] || {};
  const seed = hashStr(`bot-${botBase.id}`);

  // Calcula metricas pra TODOS os periodos (mock simples; em prod seria query agregada)
  const periodos = ['hoje', 'ontem', '24h', '7d', '30d', 'geral'];
  const metricasPorPeriodo = {};
  periodos.forEach(p => {
    metricasPorPeriodo[p] = escalarMetricasPorPeriodo(botBase.metricasBase, p, seed);
  });

  return {
    ...botBase,
    status: override.status ?? botBase.status,
    favorito: override.favorito ?? botBase.favorito,
    metricas: metricasPorPeriodo[periodoPrincipal],  // metrica "principal" (compat)
    metricasPorPeriodo,  // todas pra UI escolher
  };
}

// ============================================================
// 4. API CLIENT (mock-only nesta versao single-file)
// ============================================================

const MOCK_LATENCY = { min: 80, max: 250 };

function simularLatencia() {
  const ms = MOCK_LATENCY.min + Math.random() * (MOCK_LATENCY.max - MOCK_LATENCY.min);
  return new Promise(resolve => setTimeout(resolve, ms));
}

const mockResponses = {
  '/bots': (params) => {
    const { conta, casa, estrategia, esporte, status, busca, periodo = 'geral' } = params;
    let bots = MOCK_BOTS_BASE.map(b => hidratarBot(b, periodo));
    if (conta && conta !== 'todas')           bots = bots.filter(b => b.conta === conta);
    if (casa && casa !== 'todas')             bots = bots.filter(b => b.casa === casa);
    if (estrategia && estrategia !== 'todas') bots = bots.filter(b => b.estrategia === estrategia);
    if (esporte && esporte !== 'todas')       bots = bots.filter(b => b.esporte === esporte);
    if (status && status !== 'todos')         bots = bots.filter(b => b.status === status);
    if (busca) {
      const t = normaliza(busca);
      bots = bots.filter(b => {
        const campos = [b.nome, b.liga, CASAS[b.casa]?.label, ESTRATEGIAS[b.estrategia]?.label];
        return campos.some(c => normaliza(c).includes(t));
      });
    }
    return { bots, total: bots.length };
  },

  '/bots/metricas-globais': (params) => {
    const { periodo = 'hoje', ...filtros } = params;
    const { bots } = mockResponses['/bots']({ ...filtros, periodo });

    if (bots.length === 0) {
      return { entradas: 0, lucro: 0, roi: 0, wr: 0, dd: 0, stake: 4.0, sequencia: 0 };
    }
    const totalEntradas = bots.reduce((s, b) => s + b.metricas.entradas, 0);
    const totalLucro = bots.reduce((s, b) => s + b.metricas.lucro, 0);
    const stakeMedio = totalEntradas > 0
      ? bots.reduce((s, b) => s + b.metricas.stake * b.metricas.entradas, 0) / totalEntradas
      : 4.0;
    const roi = totalEntradas > 0 ? (totalLucro / (totalEntradas * stakeMedio)) * 100 : 0;
    const wr = totalEntradas > 0
      ? bots.reduce((s, b) => s + b.metricas.wr * b.metricas.entradas, 0) / totalEntradas
      : 0;
    const dds = bots.map(b => b.metricas.dd).filter(d => typeof d === 'number');
    const dd = dds.length > 0 ? Math.min(...dds) : 0;
    return {
      entradas: totalEntradas,
      lucro: +totalLucro.toFixed(2),
      roi: +roi.toFixed(2),
      wr: +wr.toFixed(1),
      dd: +dd.toFixed(1),
      stake: +stakeMedio.toFixed(2),
      sequencia: 0,
      periodo,
    };
  },

  // Batch: retorna metricas globais pra MULTIPLOS periodos numa request
  // 🔌 BACKEND: GET /bots/metricas-globais-multi?periodos=hoje,7d,30d,geral
  //             Retorna { hoje: {...}, '7d': {...}, '30d': {...}, geral: {...} }
  '/bots/metricas-globais-multi': (params) => {
    const { periodos = ['hoje', 'geral'], ...filtros } = params;
    const result = {};
    periodos.forEach(p => {
      result[p] = mockResponses['/bots/metricas-globais']({ ...filtros, periodo: p });
    });
    return result;
  },

  'PATCH /bots/:id': ({ id, ...campos }) => {
    botsOverrides[id] = { ...botsOverrides[id], ...campos };
    return { ok: true, id, ...campos };
  },

  'DELETE /bots/:id': ({ id }) => {
    const idx = MOCK_BOTS_BASE.findIndex(b => b.id === Number(id));
    if (idx === -1) throw new Error(`Bot ${id} não encontrado`);
    MOCK_BOTS_BASE.splice(idx, 1);
    delete botsOverrides[id];
    return { ok: true, id: Number(id) };
  },

  'POST /bots/:id/clonar': ({ id }) => {
    const bot = MOCK_BOTS_BASE.find(b => b.id === Number(id));
    if (!bot) throw new Error(`Bot ${id} não encontrado`);
    const novoId = Math.max(...MOCK_BOTS_BASE.map(b => b.id)) + 1;
    return { ok: true, novoId, mensagem: `Bot "${bot.nome}" clonado como #${novoId}` };
  },
};

async function apiGet(endpoint, params) {
  await simularLatencia();
  const handler = mockResponses[endpoint];
  if (!handler) throw new Error(`[MOCK] Endpoint não implementado: GET ${endpoint}`);
  return handler(params || {});
}

async function apiMutate(method, endpoint, body) {
  await simularLatencia();
  const key = `${method} ${endpoint}`;
  // Tenta match exato, depois match com :id wildcard
  let handler = mockResponses[key];
  if (!handler) {
    // Tenta achar handler com :id (ex: PATCH /bots/:id)
    const matchKey = Object.keys(mockResponses).find(k => {
      if (!k.startsWith(method + ' ')) return false;
      const pattern = k.replace(method + ' ', '').replace(/:[a-z]+/g, '[^/]+');
      const re = new RegExp('^' + pattern + '$');
      return re.test(endpoint);
    });
    if (matchKey) {
      handler = mockResponses[matchKey];
      // Extrai :id do endpoint
      const idMatch = endpoint.match(/\/(\d+)/);
      if (idMatch) body = { id: idMatch[1], ...body };
    }
  }
  if (!handler) {
    console.warn(`[MOCK] Mutação não implementada: ${key} - retornando body`);
    return body;
  }
  return handler(body);
}

// ============================================================
// 5. HOOKS
// ============================================================

function useApiQuery(endpoint, params) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const lastReqRef = useRef(0);
  const paramsKey = JSON.stringify(params);

  const fetchData = useCallback(async () => {
    const reqId = ++lastReqRef.current;
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const data = await apiGet(endpoint, params);
      if (reqId === lastReqRef.current) {
        setState({ data, loading: false, error: null });
      }
    } catch (error) {
      if (reqId === lastReqRef.current) {
        setState({ data: null, loading: false, error });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, paramsKey]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return { data: state.data, loading: state.loading, error: state.error, refetch: fetchData };
}

function useApiMutation(method, endpointFn, opts = {}) {
  const { onSuccess } = opts;
  const [loading, setLoading] = useState(false);

  const mutate = useCallback(async (body) => {
    setLoading(true);
    try {
      const endpoint = typeof endpointFn === 'function' ? endpointFn(body) : endpointFn;
      const data = await apiMutate(method, endpoint, body);
      setLoading(false);
      onSuccess?.(data, body);
      return data;
    } catch (error) {
      setLoading(false);
      throw error;
    }
  }, [method, endpointFn, onSuccess]);

  return { mutate, loading };
}

function useBotsData(filtros) {
  const { data, loading, error, refetch } = useApiQuery('/bots', filtros);
  return {
    bots: data?.bots || [],
    total: data?.total || 0,
    loading, error, refetch,
  };
}

function useBotMetricasGlobais(params) {
  const { data, loading } = useApiQuery('/bots/metricas-globais', params);
  return {
    metricas: data || { entradas: 0, lucro: 0, roi: 0, wr: 0, dd: 0, stake: 4.0, sequencia: 0 },
    loading,
  };
}

// Batch: 1 request retorna metricas pra varios periodos
// Use isto em vez de useBotMetricasGlobais multiplas vezes
function useBotMetricasMulti(periodos, filtros) {
  const { data, loading } = useApiQuery('/bots/metricas-globais-multi', { periodos, ...filtros });
  const empty = { entradas: 0, lucro: 0, roi: 0, wr: 0, dd: 0, stake: 4.0, sequencia: 0 };
  return {
    metricas: data || periodos.reduce((acc, p) => ({ ...acc, [p]: empty }), {}),
    loading,
  };
}

function useBotUpdate(opts) {
  return useApiMutation('PATCH', ({ id }) => `/bots/${id}`, opts);
}

function useBotClonar(opts) {
  return useApiMutation('POST', ({ id }) => `/bots/${id}/clonar`, opts);
}

function useBotDeletar(opts) {
  return useApiMutation('DELETE', ({ id }) => `/bots/${id}`, opts);
}

// ============================================================
// 6. COMPONENTES
// ============================================================

function Sparkline({ data, color = '#10b981', width = 100, height = 28 }) {
  if (!data || data.length === 0) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = 2;
  const w = width - padding * 2;
  const h = height - padding * 2;
  const step = w / (data.length - 1);
  const points = data.map((v, i) => {
    const x = padding + i * step;
    const y = padding + h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(' ');
  const lastPoint = data[data.length - 1];
  const lastX = padding + (data.length - 1) * step;
  const lastY = padding + h - ((lastPoint - min) / range) * h;
  return (
    <svg width={width} height={height} className="block">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r="2" fill={color} />
    </svg>
  );
}

function MikeSelect({ value, onChange, options, placeholder = 'Selecione', width = 'w-full' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const selected = options.find(o => o.value === value);

  return (
    <div ref={ref} className={`relative ${width}`}>
      <button
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition mike-border-thin bg-transparent text-[--mike-fg] hover:text-[--mike-fg] ${open ? 'border-[--mike-accent]' : ''}`}
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <ChevronDown className={`w-3 h-3 flex-shrink-0 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 rounded-md overflow-hidden z-30 max-h-64 overflow-y-auto" style={{
          backgroundColor: 'var(--mike-card)',
          border: '0.5px solid rgba(60, 85, 130, 0.6)',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
        }}>
          {options.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full text-left px-3 py-1.5 text-xs transition ${
                opt.value === value
                  ? 'bg-[--mike-accent]/10 text-[--mike-accent]'
                  : 'text-[--mike-fg-soft] hover:bg-[--mike-card-hover] hover:text-[--mike-fg]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Header({ telaAtiva, onNavegar }) {
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);

  return (
    <header className="sticky top-0 z-30 backdrop-blur-md" style={{
      backgroundColor: 'rgba(11, 15, 26, 0.8)',
      borderBottom: '0.5px solid rgba(60, 85, 130, 0.4)',
    }}>
      <div className="max-w-screen-xl mx-auto px-4 lg:px-8 h-14 flex items-center gap-4">
        {/* Hamburger (mobile) */}
        <button
          onClick={() => setMenuMobileAberto(!menuMobileAberto)}
          className="md:hidden p-1 rounded text-[--mike-fg-muted] hover:text-[--mike-fg] transition"
          title="Menu"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {menuMobileAberto ? <path d="M6 18L18 6M6 6l12 12" /> : <path d="M3 12h18M3 6h18M3 18h18" />}
          </svg>
        </button>

        <button
          onClick={() => { onNavegar?.('today'); setMenuMobileAberto(false); }}
          className="flex items-center gap-2 hover:opacity-90 transition"
          title="Início"
        >
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-[--mike-accent] to-[--mike-accent-2] flex items-center justify-center shadow-md shadow-[--mike-accent]/30">
            <span className="font-black text-[--mike-bg] text-base leading-none">M</span>
          </div>
          <span className="font-black text-[--mike-fg] tracking-tight text-base" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            TIPMIKE
          </span>
        </button>

        <div className="hidden md:flex items-center gap-1 ml-4">
          {NAV_ITEMS.map((n) => {
            const Icone = n.icon;
            const ativa = telaAtiva === n.id;
            return (
              <button
                key={n.id}
                onClick={() => onNavegar?.(n.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition relative ${
                  ativa ? 'text-[--mike-accent]' : 'text-[--mike-fg-muted] hover:text-[--mike-fg]'
                }`}
              >
                <Icone className="w-3.5 h-3.5" />
                {n.label}
                {n.novo && (
                  <span className="absolute -top-1 -right-1 px-1 rounded-sm bg-amber-500 text-amber-950 text-[7px] font-black">NOVO</span>
                )}
                {ativa && <div className="absolute -bottom-2 left-2 right-2 h-0.5 bg-[--mike-accent] rounded-full" />}
              </button>
            );
          })}
        </div>

        <div className="flex-1" />

        <button className="text-[--mike-fg-muted] hover:text-[--mike-fg] transition">
          <Bell className="w-4 h-4" />
        </button>
        <button className="text-[--mike-fg-muted] hover:text-[--mike-fg] transition hidden sm:block">
          <Settings className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2 pl-3" style={{ borderLeft: '0.5px solid rgba(60, 85, 130, 0.4)' }}>
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[--mike-accent] to-[--mike-accent-2] flex items-center justify-center font-black text-[--mike-bg] text-xs">S</div>
          <div className="hidden lg:flex flex-col leading-tight">
            <span className="text-[11px] text-[--mike-fg] font-semibold">Santos</span>
            <span className="text-[9px] text-[--mike-fg-muted]">BOT (eSports)</span>
          </div>
        </div>
      </div>

      {/* Drawer mobile */}
      {menuMobileAberto && (
        <div className="md:hidden border-t" style={{ borderColor: 'rgba(60,85,130,0.4)' }}>
          <nav className="px-4 py-2 grid grid-cols-2 gap-1">
            {NAV_ITEMS.map((n) => {
              const Icone = n.icon;
              const ativa = telaAtiva === n.id;
              return (
                <button
                  key={n.id}
                  onClick={() => { onNavegar?.(n.id); setMenuMobileAberto(false); }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-semibold transition ${
                    ativa ? 'bg-[--mike-accent]/15 text-[--mike-accent]' : 'text-[--mike-fg-soft] hover:bg-[--mike-card-hover]'
                  }`}
                >
                  <Icone className="w-3.5 h-3.5" />
                  {n.label}
                  {n.novo && <span className="px-1 rounded-sm bg-amber-500 text-amber-950 text-[7px] font-black ml-auto">NOVO</span>}
                </button>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
}

function PainelDesempenho({ titulo, periodo, onPeriodoChange, metricas, loading, periodoOptions }) {
  return (
    <div className="rounded-lg p-4 relative" style={{
      backgroundColor: 'transparent',
      border: '0.5px solid rgba(60, 85, 130, 0.4)',
    }}>
      {loading && (
        <div className="absolute top-3 right-3">
          <RefreshCw className="w-3 h-3 text-[--mike-fg-muted] mike-spin" />
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-[--mike-fg]">{titulo}</h3>
        {periodoOptions && (
          <MikeSelect value={periodo} onChange={onPeriodoChange} options={periodoOptions} width="w-28" />
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="rounded-md p-2.5 min-w-0 overflow-hidden" style={{ border: '0.5px solid rgba(60,85,130,0.4)' }}>
          <div className="flex items-center gap-1.5 mb-1">
            <Hash className="w-3 h-3 text-cyan-400 flex-shrink-0" />
            <span className="text-[9px] uppercase tracking-wider text-[--mike-fg-muted] font-semibold">Entradas</span>
          </div>
          <div className="text-lg font-black font-mono text-[--mike-fg] truncate" title={metricas.entradas}>
            {formatCompacto(metricas.entradas)}
          </div>
        </div>

        <div className="rounded-md p-2.5 min-w-0 overflow-hidden" style={{ border: '0.5px solid rgba(60,85,130,0.4)' }}>
          <div className="flex items-center gap-1.5 mb-1">
            <DollarSign className={`w-3 h-3 flex-shrink-0 ${metricas.lucro >= 0 ? 'text-emerald-400' : 'text-rose-400'}`} />
            <span className="text-[9px] uppercase tracking-wider text-[--mike-fg-muted] font-semibold">Lucro</span>
          </div>
          <div className={`text-lg font-black font-mono truncate ${metricas.lucro >= 0 ? 'text-emerald-400' : 'text-rose-400'}`} title={`${metricas.lucro >= 0 ? '+' : ''}${metricas.lucro.toFixed(2)}u`}>
            {formatCompacto(metricas.lucro, { prefixoSinal: true })}u
          </div>
        </div>

        <div className="rounded-md p-2.5 min-w-0 overflow-hidden" style={{ border: '0.5px solid rgba(60,85,130,0.4)' }}>
          <div className="flex items-center gap-1.5 mb-1">
            <Percent className={`w-3 h-3 flex-shrink-0 ${metricas.roi >= 0 ? 'text-emerald-400' : 'text-rose-400'}`} />
            <span className="text-[9px] uppercase tracking-wider text-[--mike-fg-muted] font-semibold">ROI</span>
          </div>
          <div className={`text-lg font-black font-mono truncate ${metricas.roi >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {metricas.roi >= 0 ? '+' : ''}{metricas.roi.toFixed(1)}%
          </div>
        </div>

        <div className="rounded-md p-2.5 min-w-0 overflow-hidden" style={{ border: '0.5px solid rgba(60,85,130,0.4)' }}>
          <div className="flex items-center gap-1.5 mb-1">
            <Target className="w-3 h-3 text-amber-400 flex-shrink-0" />
            <span className="text-[9px] uppercase tracking-wider text-[--mike-fg-muted] font-semibold">WR</span>
          </div>
          <div className="text-lg font-black font-mono text-[--mike-fg] truncate">{metricas.wr.toFixed(1)}%</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mt-3 pt-3" style={{ borderTop: '0.5px solid rgba(60,85,130,0.4)' }}>
        <div className="text-center" title="Drawdown máximo: maior queda do banco antes de recuperar. Indica o risco do bot.">
          <div className="text-[9px] uppercase tracking-wider text-[--mike-fg-muted] font-semibold cursor-help">DD máx ⓘ</div>
          <div className="text-sm font-bold font-mono text-rose-400 mt-0.5">{metricas.dd}u</div>
        </div>
        <div className="text-center" title="Valor médio apostado por entrada">
          <div className="text-[9px] uppercase tracking-wider text-[--mike-fg-muted] font-semibold cursor-help">Stake médio ⓘ</div>
          <div className="text-sm font-bold font-mono text-[--mike-fg] mt-0.5">{metricas.stake.toFixed(1)}u</div>
        </div>
        <div className="text-center" title="Sequência atual: + green seguidos, − red seguidos">
          <div className="text-[9px] uppercase tracking-wider text-[--mike-fg-muted] font-semibold cursor-help">Sequência ⓘ</div>
          <div className={`text-sm font-bold font-mono mt-0.5 ${metricas.sequencia > 0 ? 'text-emerald-400' : metricas.sequencia < 0 ? 'text-rose-400' : 'text-[--mike-fg-muted]'}`}>
            {metricas.sequencia > 0 ? '+' : ''}{metricas.sequencia}
          </div>
        </div>
      </div>
    </div>
  );
}

function CardBot({ bot, expandido, onToggle, onAcao, periodoVisao = 'geral' }) {
  const casa = CASAS[bot.casa];
  const estrategia = ESTRATEGIAS[bot.estrategia];
  const status = STATUS_BOT[bot.status];
  const StatusIcon = status.Icon;

  // Métricas do período da visão (default: geral acumulado)
  const m = bot.metricasPorPeriodo[periodoVisao] || bot.metricas;
  const mHoje = bot.metricasPorPeriodo.hoje;

  return (
    <div className="rounded-md overflow-hidden transition" style={{
      backgroundColor: 'transparent',
      border: '0.5px solid rgba(60, 85, 130, 0.4)',
    }}>
      <div className="flex items-stretch">
        <div className={`w-1 flex-shrink-0 ${status.color} ${status.pulse ? 'animate-pulse' : ''}`} />

        <div className="flex-1 min-w-0">
          {/* LINHA 1: Identidade do bot + Status + Acoes rapidas */}
          <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5">
            <button onClick={() => onAcao('favoritar', bot.id)} className="flex-shrink-0 transition hover:scale-110">
              <svg className={`w-3.5 h-3.5 ${bot.favorito ? 'text-amber-400 fill-amber-400' : 'text-[--mike-fg-muted]'}`} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2">
                <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
              </svg>
            </button>

            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold flex-shrink-0 ${casa.bg} ${casa.text}`}>
              {casa.label}
            </span>

            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 flex-shrink-0">
              {estrategia.label}
            </span>

            <span className="text-[10px] text-[--mike-fg-muted] flex-shrink-0">{bot.esporte}</span>

            <div className="flex-1 min-w-0 flex items-center gap-2">
              <button
                onClick={() => onToggle(bot.id)}
                className="text-xs font-bold text-[--mike-fg] truncate text-left hover:text-[--mike-accent] transition uppercase"
                style={{ letterSpacing: '0.02em' }}
                title="Ver detalhes"
              >
                {bot.nome}
              </button>
            </div>

            {/* Status + acoes (sempre visiveis) */}
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold flex-shrink-0 ${status.color} text-white`}>
              {StatusIcon && <StatusIcon className="w-2.5 h-2.5" />}
              <span className="hidden sm:inline">{status.label}</span>
            </div>

            <div className="flex items-center gap-0.5 flex-shrink-0">
              <button
                onClick={() => onAcao(bot.status === 'rodando' ? 'pausar' : 'rodar', bot.id)}
                className="p-1.5 rounded hover:bg-[--mike-accent]/15 text-[--mike-fg-muted] hover:text-[--mike-accent] transition"
                title={bot.status === 'rodando' ? 'Pausar' : 'Rodar'}
              >
                {bot.status === 'rodando' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => onToggle(bot.id)}
                className="p-1.5 rounded hover:bg-[--mike-accent]/15 text-[--mike-fg-muted] hover:text-[--mike-accent] transition"
                title="Ver detalhes"
              >
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expandido ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>

          {/* LINHA 2: Métricas + Sparkline (sempre visivel) */}
          <div className="flex items-center gap-3 px-3 pb-2.5">
            {/* Metricas Geral (acumulado) */}
            <div className="flex items-center gap-1 text-[10px] flex-shrink-0">
              <span className="text-[--mike-fg-muted] uppercase tracking-wider text-[9px]">Geral</span>
              <span className={`font-mono font-bold ${m.lucro >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {formatCompacto(m.lucro, { prefixoSinal: true })}u
              </span>
              <span className={`font-mono ${m.roi >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                ({m.roi >= 0 ? '+' : ''}{m.roi.toFixed(1)}%)
              </span>
            </div>

            {/* Metricas Hoje (separadas) */}
            <div className="hidden sm:flex items-center gap-1 text-[10px] flex-shrink-0">
              <span className="text-[--mike-fg-muted] uppercase tracking-wider text-[9px]">Hoje</span>
              <span className={`font-mono font-bold ${mHoje.lucro >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {formatCompacto(mHoje.lucro, { prefixoSinal: true })}u
              </span>
              <span className="text-[--mike-fg-muted] font-mono">
                ({mHoje.entradas} entr.)
              </span>
            </div>

            {/* WR */}
            <div className="hidden md:flex items-center gap-1 text-[10px] flex-shrink-0">
              <Target className="w-2.5 h-2.5 text-amber-400" />
              <span className="text-amber-400 font-mono font-bold">{m.wr.toFixed(1)}%</span>
            </div>

            <div className="flex-1 min-w-0" />

            {/* Sparkline */}
            <div className="hidden sm:block flex-shrink-0">
              <Sparkline data={bot.sparkline} width={80} height={20} color={m.lucro >= 0 ? '#10b981' : '#f43f5e'} />
            </div>

            {/* ID */}
            <span className="text-[9px] text-[--mike-fg-muted] font-mono flex-shrink-0">#{bot.id.toString().padStart(4, '0')}</span>

            {bot.automatizado && (
              <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-semibold flex-shrink-0 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" title="Bot automatizado (24/7)">
                <Zap className="w-2 h-2" />
                <span className="hidden md:inline">Auto</span>
              </div>
            )}
          </div>

          {/* Detalhes expandidos */}
          {expandido && (
            <div className="px-3 pb-3" style={{ borderTop: '0.5px solid rgba(60,85,130,0.2)' }}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3">
                <div>
                  <h4 className="text-[10px] uppercase tracking-wider text-[--mike-fg-muted] font-bold mb-2">Configuração</h4>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[--mike-fg-muted]">Liga:</span>
                      <span className="text-[--mike-fg] font-medium">{bot.liga}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[--mike-fg-muted]">Conta:</span>
                      <span className="text-[--mike-fg] font-medium">{CONTAS.find(c => c.id === bot.conta)?.nome || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[--mike-fg-muted]">Estratégia:</span>
                      <span className="text-[--mike-fg] font-medium">{estrategia.desc}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[--mike-fg-muted]">Agendamento:</span>
                      <span className="text-[--mike-fg] font-medium">{bot.agendamento || '—'}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-[10px] uppercase tracking-wider text-[--mike-fg-muted] font-bold mb-2">Performance Geral</h4>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[--mike-fg-muted]">Total apostas:</span>
                      <span className="text-[--mike-fg] font-mono font-bold">{m.entradas}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[--mike-fg-muted]">Lucro acumulado:</span>
                      <span className={`font-mono font-bold ${m.lucro >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {m.lucro >= 0 ? '+' : ''}{m.lucro.toFixed(2)}u
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[--mike-fg-muted]">Win Rate:</span>
                      <span className="text-amber-400 font-mono font-bold">{m.wr.toFixed(1)}%</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[--mike-fg-muted]">Drawdown máx:</span>
                      <span className="text-rose-400 font-mono font-bold" title="Maior queda do bot em uma sequência ruim">
                        {m.dd}u
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-[10px] uppercase tracking-wider text-[--mike-fg-muted] font-bold mb-2">Últimas apostas</h4>
                  {bot.ultimasApostas.length > 0 ? (
                    <div className="space-y-1">
                      {bot.ultimasApostas.slice(0, 4).map((a, i) => (
                        <div key={i} className="flex items-center gap-2 text-[10px] py-1 px-1.5 rounded" style={{ backgroundColor: 'rgba(60,85,130,0.05)' }}>
                          <span className="text-[--mike-fg-muted] font-mono">{a.time}</span>
                          <span className="flex-1 text-[--mike-fg] truncate">{a.sel}</span>
                          <span className="text-[--mike-fg-soft] font-mono text-[9px]">@{a.odd}</span>
                          <span className={`font-mono font-bold ${a.status === 'green' ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {a.pl >= 0 ? '+' : ''}{a.pl.toFixed(1)}u
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] text-[--mike-fg-muted] italic">Sem apostas recentes</p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 mt-3 pt-3" style={{ borderTop: '0.5px solid rgba(60,85,130,0.2)' }}>
                <button onClick={() => onAcao('historico', bot.id)} className="mike-border-thin flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-semibold bg-transparent text-[--mike-fg-soft] hover:text-[--mike-accent] transition">
                  <History className="w-3 h-3" /> Histórico
                </button>
                <button onClick={() => onAcao('editar', bot.id)} className="mike-border-thin flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-semibold bg-transparent text-[--mike-fg-soft] hover:text-[--mike-accent] transition">
                  <Edit2 className="w-3 h-3" /> Editar
                </button>
                <button onClick={() => onAcao('clonar', bot.id)} className="mike-border-thin flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-semibold bg-transparent text-[--mike-fg-soft] hover:text-[--mike-accent] transition">
                  <Copy className="w-3 h-3" /> Clonar
                </button>
                <button onClick={() => onAcao('agendar', bot.id)} className="mike-border-thin flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-semibold bg-transparent text-[--mike-fg-soft] hover:text-[--mike-accent] transition">
                  <Clock className="w-3 h-3" /> Agendar
                </button>
                <button onClick={() => onAcao('alertas', bot.id)} className="mike-border-thin flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-semibold bg-transparent text-[--mike-fg-soft] hover:text-[--mike-accent] transition">
                  <BellRing className="w-3 h-3" /> Alertas
                </button>
                <button onClick={() => onAcao('compartilhar', bot.id)} className="mike-border-thin flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-semibold bg-transparent text-[--mike-fg-soft] hover:text-[--mike-accent] transition">
                  <Share2 className="w-3 h-3" /> Compartilhar
                </button>
                <div className="flex-1" />
                <button onClick={() => onAcao('parar', bot.id)} className="px-2.5 py-1 rounded text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30 hover:bg-rose-500/25 transition">
                  Parar Bot
                </button>
                <button onClick={() => onAcao('deletar', bot.id)} className="px-2.5 py-1 rounded text-[10px] font-bold bg-rose-700/20 text-rose-300 border border-rose-700/40 hover:bg-rose-700/35 transition flex items-center gap-1">
                  <Trash2 className="w-3 h-3" /> Deletar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 7. APP PRINCIPAL
// ============================================================

export default function App({ onNavegar: onNavegarExterno } = {}) {
  const [contaAtiva, setContaAtiva] = useState('todas');
  const [periodoDia, setPeriodoDia] = useState('hoje');
  const [periodoGeral, setPeriodoGeral] = useState('geral');
  const [busca, setBusca] = useState('');
  const [filtroCasa, setFiltroCasa] = useState('todas');
  const [filtroEstrategia, setFiltroEstrategia] = useState('todas');
  const [filtroEsporte, setFiltroEsporte] = useState('todas');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [agruparPor, setAgruparPor] = useState('casa_estrategia');
  const [ordenacao, setOrdenacao] = useState('roi_geral');
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [bannerVisivel, setBannerVisivel] = useState(true);
  const [expandidos, setExpandidos] = useState(new Set([1, 3]));
  const [toasts, setToasts] = useState([]);
  const [telaAtiva, setTelaAtiva] = useState('bots');
  const [modalAcao, setModalAcao] = useState(null);
  const [modalConfirm, setModalConfirm] = useState(null);

  const adicionarToast = useCallback((mensagem, tipo = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, mensagem, tipo }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  const handleNavegar = (telaId, ctx) => {
    setTelaAtiva(telaId);
    if (onNavegarExterno) {
      // Em modo orquestrador: navega de verdade
      onNavegarExterno(telaId, ctx);
    } else {
      // Standalone: mostra modal informativo
      setModalAcao({ tipo: 'navegar', destino: telaId });
    }
  };

  // Filtros aplicados
  const filtrosBots = useMemo(() => ({
    conta: contaAtiva,
    casa: filtroCasa,
    estrategia: filtroEstrategia,
    esporte: filtroEsporte,
    status: filtroStatus,
    busca,
    periodo: 'geral',
  }), [contaAtiva, filtroCasa, filtroEstrategia, filtroEsporte, filtroStatus, busca]);

  // Hooks de dados
  const { bots, loading: loadingBots, refetch: refetchBots } = useBotsData(filtrosBots);

  // Batch: 1 request pega metricas de TODOS os periodos pros 2 paineis
  const { metricas: metricasMulti, loading: loadingMetricas } = useBotMetricasMulti(
    [periodoDia, periodoGeral],
    filtrosBots,
  );
  const metricasDia = metricasMulti[periodoDia] || { entradas: 0, lucro: 0, roi: 0, wr: 0, dd: 0, stake: 4.0, sequencia: 0 };
  const metricasGeral = metricasMulti[periodoGeral] || { entradas: 0, lucro: 0, roi: 0, wr: 0, dd: 0, stake: 4.0, sequencia: 0 };

  const updateBot = useBotUpdate({ onSuccess: () => refetchBots() });
  const clonarBot = useBotClonar({
    onSuccess: (data) => {
      adicionarToast(data.mensagem, 'success');
      refetchBots();
    },
  });

  const deletarBot = useBotDeletar({
    onSuccess: (data, body) => {
      const bot = bots.find(b => b.id === body.id);
      adicionarToast(`Bot "${bot?.nome || '#' + body.id}" deletado`, 'error');
      refetchBots();
    },
  });

  // Ordenação + Agrupamento
  const botsOrdenados = useMemo(() => {
    const sorted = [...bots];
    sorted.sort((a, b) => {
      if (ordenacao === 'roi_geral') return b.metricas.roi - a.metricas.roi;
      if (ordenacao === 'lucro_geral') return b.metricas.lucro - a.metricas.lucro;
      if (ordenacao === 'entradas') return b.metricas.entradas - a.metricas.entradas;
      if (ordenacao === 'nome') return a.nome.localeCompare(b.nome);
      if (ordenacao === 'favoritos') return (b.favorito ? 1 : 0) - (a.favorito ? 1 : 0);
      return 0;
    });
    return sorted;
  }, [bots, ordenacao]);

  const botsAgrupados = useMemo(() => {
    if (agruparPor === 'nenhum') return [{ titulo: 'Todos os bots', bots: botsOrdenados }];
    const grupos = {};
    botsOrdenados.forEach(b => {
      let chave;
      if (agruparPor === 'casa') chave = CASAS[b.casa].label;
      else if (agruparPor === 'estrategia') chave = ESTRATEGIAS[b.estrategia].label;
      else if (agruparPor === 'esporte') chave = b.esporte;
      else if (agruparPor === 'status') chave = STATUS_BOT[b.status].label;
      else chave = `${CASAS[b.casa].label} · ${ESTRATEGIAS[b.estrategia].label}`;
      if (!grupos[chave]) grupos[chave] = [];
      grupos[chave].push(b);
    });
    return Object.entries(grupos).map(([titulo, bots]) => ({ titulo, bots }));
  }, [botsOrdenados, agruparPor]);

  const toggleExpandido = (id) => {
    setExpandidos(prev => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  };

  const handleAcao = async (acao, botId) => {
    const bot = bots.find(b => b.id === botId);
    if (!bot) return;

    if (acao === 'rodar' || acao === 'pausar') {
      const novoStatus = acao === 'rodar' ? 'rodando' : 'pausado';
      try {
        await updateBot.mutate({ id: botId, status: novoStatus });
        adicionarToast(`Bot "${bot.nome}" ${acao === 'rodar' ? 'iniciado' : 'pausado'}`, acao === 'rodar' ? 'success' : 'warn');
      } catch (e) {
        adicionarToast(`Erro: ${e.message}`, 'error');
      }
      return;
    }

    if (acao === 'parar') {
      setModalConfirm({
        tipo: 'parar',
        bot,
        onConfirm: async () => {
          try {
            await updateBot.mutate({ id: botId, status: 'parado' });
            adicionarToast(`Bot "${bot.nome}" parado`, 'error');
          } catch (e) {
            adicionarToast(`Erro: ${e.message}`, 'error');
          }
          setModalConfirm(null);
        },
      });
      return;
    }

    if (acao === 'favoritar') {
      const novoFav = !bot.favorito;
      try {
        await updateBot.mutate({ id: botId, favorito: novoFav });
        adicionarToast(novoFav ? `"${bot.nome}" favoritado` : `Removido dos favoritos`, 'info');
      } catch (e) {
        adicionarToast(`Erro: ${e.message}`, 'error');
      }
      return;
    }

    if (acao === 'deletar') {
      setModalConfirm({
        tipo: 'deletar',
        bot,
        onConfirm: async () => {
          try {
            await deletarBot.mutate({ id: botId });
          } catch (e) {
            adicionarToast(`Erro ao deletar: ${e.message}`, 'error');
          }
          setModalConfirm(null);
        },
      });
      return;
    }

    if (acao === 'clonar') {
      await clonarBot.mutate({ id: botId });
      return;
    }

    if (acao === 'compartilhar') {
      const link = `https://tipmike.com/bots/${bot.id}`;
      adicionarToast(`Link copiado: ${link}`, 'success');
      return;
    }

    if (acao === 'historico') {
      if (onNavegarExterno) onNavegarExterno('historico', { botId: bot.id });
      else setModalAcao({ tipo: 'historico', bot });
      return;
    }
    if (acao === 'editar') {
      if (onNavegarExterno) onNavegarExterno('criar_bot', { botId: bot.id });
      else setModalAcao({ tipo: 'editar', bot });
      return;
    }
    if (acao === 'agendar')   { setModalAcao({ tipo: 'agendar', bot }); return; }
    if (acao === 'alertas')   { setModalAcao({ tipo: 'alertas', bot }); return; }
  };

  // Esc fecha modais
  useEffect(() => {
    const handler = (e) => {
      if (e.key !== 'Escape') return;
      if (modalAcao) setModalAcao(null);
      else if (modalConfirm) setModalConfirm(null);
      else if (filtrosAbertos) setFiltrosAbertos(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [modalAcao, modalConfirm, filtrosAbertos]);

  const themeVars = {
    '--mike-bg': '#0b0f1a',
    '--mike-bg-2': '#070a13',
    '--mike-card': '#141a28',
    '--mike-card-2': '#1a2030',
    '--mike-card-hover': '#1c2336',
    '--mike-border': '#222a3d',
    '--mike-fg': '#eaeef7',
    '--mike-fg-soft': '#b8c0d4',
    '--mike-fg-muted': '#6b7691',
    '--mike-accent': '#10b981',
    '--mike-accent-2': '#0891b2',
  };

  const algumFiltroAtivo = filtroCasa !== 'todas' || filtroEstrategia !== 'todas' ||
                          filtroEsporte !== 'todas' || filtroStatus !== 'todos' || busca;

  return (
    <div className="min-h-screen" style={{
      ...themeVars,
      backgroundColor: 'var(--mike-bg)',
      color: 'var(--mike-fg)',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <style>{`
        .mike-border-thin { border: 0.5px solid rgba(60, 85, 130, 0.4) !important; }
        .mike-border-thin:hover { border-color: rgba(80, 110, 170, 0.7) !important; }
        .mike-border-thin:focus { border-color: rgba(16, 185, 129, 0.7) !important; outline: none; }

        @keyframes mike-toast-in { 0% { transform: translateX(120%); opacity: 0; } 100% { transform: translateX(0); opacity: 1; } }
        .mike-toast-in { animation: mike-toast-in 0.3s ease-out; }

        @keyframes mike-modal-fade {
          from { opacity: 0; transform: translateY(8px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        @keyframes mike-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .mike-spin { animation: mike-spin 0.8s linear infinite; }
      `}</style>

      <Header telaAtiva={telaAtiva} onNavegar={handleNavegar} />

      <main className="max-w-screen-xl mx-auto px-4 lg:px-8 py-6">
        {/* Banner */}
        {bannerVisivel && (
          <div className="mb-4 rounded-md flex items-center gap-3 px-4 py-3" style={{
            backgroundColor: 'rgba(8, 145, 178, 0.1)',
            border: '0.5px solid rgba(8, 145, 178, 0.4)',
          }}>
            <AlertCircle className="w-4 h-4 text-cyan-400 flex-shrink-0" />
            <p className="flex-1 text-xs text-[--mike-fg-soft]">
              Timezone atual: <span className="text-[--mike-fg] font-semibold">America/Sao_Paulo (BRT)</span>.
              Bots agendados respeitam este horário.{' '}
              <button
                className="text-cyan-400 hover:text-cyan-300 underline cursor-pointer font-semibold"
                onClick={() => setModalAcao({ tipo: 'timezone' })}
              >
                Alterar
              </button>
            </p>
            <button onClick={() => setBannerVisivel(false)} className="text-[--mike-fg-muted] hover:text-[--mike-fg] transition">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-[--mike-fg-muted] mb-4">
          <Home className="w-3 h-3" />
          <span>Início</span>
          <ChevronRight className="w-3 h-3" />
          <span className="text-[--mike-fg] font-semibold">Bots</span>
        </div>

        {/* Header da página */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <div>
            <h1 className="text-xl font-black text-[--mike-fg] flex items-center gap-2">
              <Bot className="w-5 h-5 text-cyan-400" />
              Meus Bots
            </h1>
            <p className="text-[11px] text-[--mike-fg-muted] mt-0.5">
              Bots criados: <span className="text-[--mike-fg] font-semibold">{bots.length}/15</span>
            </p>
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-[--mike-fg-muted] font-bold">Conta:</span>
            <MikeSelect
              value={contaAtiva}
              onChange={setContaAtiva}
              width="w-44"
              options={[
                { value: 'todas', label: '📊 Todas as contas' },
                ...CONTAS.map(c => ({ value: c.id, label: `👤 ${c.nome}` })),
              ]}
            />
          </div>

          <button
            onClick={() => adicionarToast(`${bots.length} bots exportados pra CSV`, 'success')}
            className="mike-border-thin flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-transparent text-xs font-semibold text-[--mike-fg-soft] hover:text-[--mike-fg] transition"
          >
            <Download className="w-3.5 h-3.5" /> Baixar
          </button>
          <button
            onClick={() => onNavegarExterno ? onNavegarExterno('criar_bot') : setModalAcao({ tipo: 'criar_bot' })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[--mike-accent] hover:bg-emerald-400 text-[--mike-bg] text-xs font-bold transition shadow-md shadow-[--mike-accent]/30"
          >
            <Plus className="w-3.5 h-3.5" /> Novo Bot
          </button>
        </div>

        {/* Painéis de desempenho */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          <PainelDesempenho
            titulo="Desempenho do dia"
            periodo={periodoDia}
            onPeriodoChange={setPeriodoDia}
            metricas={metricasDia}
            loading={loadingMetricas}
            periodoOptions={[
              { value: 'hoje', label: 'Hoje' },
              { value: 'ontem', label: 'Ontem' },
              { value: '24h', label: 'Últimas 24h' },
              { value: '7d', label: 'Últimos 7d' },
            ]}
          />
          <PainelDesempenho
            titulo="Desempenho geral"
            periodo={periodoGeral}
            onPeriodoChange={setPeriodoGeral}
            metricas={metricasGeral}
            loading={loadingMetricas}
            periodoOptions={[
              { value: 'geral', label: 'Geral (tudo)' },
              { value: '30d', label: '30 dias' },
              { value: '7d', label: '7 dias' },
            ]}
          />
        </div>

        {/* Linha de busca/agrupamento/ordenacao/filtros */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="mike-border-thin flex-1 min-w-[200px] flex items-center gap-2 px-3 py-1.5 rounded-md bg-transparent transition">
            <Search className="w-3.5 h-3.5 text-[--mike-fg-muted]" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, casa, estratégia..."
              className="flex-1 bg-transparent text-xs text-[--mike-fg] placeholder:text-[--mike-fg-muted] outline-none"
            />
            {busca && (
              <button onClick={() => setBusca('')} className="text-[--mike-fg-muted] hover:text-[--mike-fg]">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <MikeSelect
            value={agruparPor}
            onChange={setAgruparPor}
            width="w-44"
            options={[
              { value: 'casa_estrategia', label: 'Agrupar: Casa + Estratégia' },
              { value: 'casa', label: 'Agrupar por Casa' },
              { value: 'estrategia', label: 'Agrupar por Estratégia' },
              { value: 'esporte', label: 'Agrupar por Esporte' },
              { value: 'status', label: 'Agrupar por Status' },
              { value: 'nenhum', label: 'Sem agrupamento' },
            ]}
          />

          <MikeSelect
            value={ordenacao}
            onChange={setOrdenacao}
            width="w-40"
            options={[
              { value: 'roi_geral', label: '↓ ROI' },
              { value: 'lucro_geral', label: '↓ Lucro' },
              { value: 'entradas', label: '↓ Entradas' },
              { value: 'nome', label: '↑ Nome A-Z' },
              { value: 'favoritos', label: '★ Favoritos' },
            ]}
          />

          <button
            onClick={() => setFiltrosAbertos(!filtrosAbertos)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
              filtrosAbertos
                ? 'bg-[--mike-accent]/15 text-[--mike-accent]'
                : algumFiltroAtivo
                  ? 'mike-border-thin bg-transparent text-[--mike-fg]'
                  : 'mike-border-thin bg-transparent text-[--mike-fg-soft] hover:text-[--mike-fg]'
            }`}
            style={filtrosAbertos ? { border: '0.5px solid rgba(16, 185, 129, 0.5)' } : {}}
          >
            <Filter className="w-3.5 h-3.5" />
            Filtros
            {algumFiltroAtivo && (
              <span className="ml-0.5 px-1.5 py-0 rounded-full bg-[--mike-accent] text-[--mike-bg] text-[9px] font-black">
                {[filtroCasa !== 'todas', filtroEstrategia !== 'todas', filtroEsporte !== 'todas', filtroStatus !== 'todos', busca].filter(Boolean).length}
              </span>
            )}
          </button>
        </div>

        {/* Painel filtros */}
        {filtrosAbertos && (
          <div className="mb-4 rounded-lg p-3" style={{ backgroundColor: 'transparent', border: '0.5px solid rgba(60, 85, 130, 0.4)' }}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[10px] text-[--mike-fg-muted] mb-1">Casa</label>
                <MikeSelect value={filtroCasa} onChange={setFiltroCasa} options={[
                  { value: 'todas', label: 'Todas' },
                  ...Object.values(CASAS).map(c => ({ value: c.id, label: c.label })),
                ]} />
              </div>
              <div>
                <label className="block text-[10px] text-[--mike-fg-muted] mb-1">Estratégia</label>
                <MikeSelect value={filtroEstrategia} onChange={setFiltroEstrategia} options={[
                  { value: 'todas', label: 'Todas' },
                  ...Object.values(ESTRATEGIAS).map(e => ({ value: e.id, label: `${e.label} (${e.desc})` })),
                ]} />
              </div>
              <div>
                <label className="block text-[10px] text-[--mike-fg-muted] mb-1">Esporte</label>
                <MikeSelect value={filtroEsporte} onChange={setFiltroEsporte} options={[
                  { value: 'todas', label: 'Todos' },
                  ...ESPORTES.map(e => ({ value: e.id, label: e.label })),
                ]} />
              </div>
              <div>
                <label className="block text-[10px] text-[--mike-fg-muted] mb-1">Status</label>
                <MikeSelect value={filtroStatus} onChange={setFiltroStatus} options={[
                  { value: 'todos', label: 'Todos' },
                  ...Object.values(STATUS_BOT).map(s => ({ value: s.id, label: s.label })),
                ]} />
              </div>
            </div>
          </div>
        )}

        {/* LISTA */}
        {loadingBots ? (
          <div className="flex items-center justify-center py-20 gap-2 text-[--mike-fg-muted] text-xs">
            <RefreshCw className="w-4 h-4 mike-spin" />
            Carregando bots...
          </div>
        ) : botsOrdenados.length > 0 ? (
          <>
            {botsAgrupados.map(grupo => (
              <section key={grupo.titulo} className="mb-5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1 h-4 rounded-full bg-cyan-500" />
                  <h2 className="text-sm font-bold text-[--mike-fg]">
                    {grupo.titulo}
                    <span className="ml-2 text-xs font-mono font-normal text-[--mike-fg-muted]">
                      ({grupo.bots.length})
                    </span>
                  </h2>
                </div>
                <div className="space-y-1.5">
                  {grupo.bots.map(bot => (
                    <CardBot
                      key={bot.id}
                      bot={bot}
                      expandido={expandidos.has(bot.id)}
                      onToggle={toggleExpandido}
                      onAcao={handleAcao}
                    />
                  ))}
                </div>
              </section>
            ))}
          </>
        ) : (
          <div className="rounded-2xl py-12 px-6 text-center" style={{
            backgroundColor: 'transparent',
            border: '0.5px solid rgba(60, 85, 130, 0.4)',
          }}>
            <Bot className="w-12 h-12 text-[--mike-fg-muted] opacity-40 mx-auto mb-3" />
            <p className="text-sm text-[--mike-fg] font-semibold mb-1">Nenhum bot encontrado</p>
            <p className="text-xs text-[--mike-fg-muted] mb-4">
              {algumFiltroAtivo || contaAtiva !== 'todas'
                ? 'Os filtros aplicados não retornaram nenhum bot.'
                : 'Crie seu primeiro bot pra começar a operar automaticamente.'}
            </p>
            {(algumFiltroAtivo || contaAtiva !== 'todas') ? (
              <button
                onClick={() => {
                  setFiltroCasa('todas');
                  setFiltroEstrategia('todas');
                  setFiltroEsporte('todas');
                  setFiltroStatus('todos');
                  setBusca('');
                  setContaAtiva('todas');
                  adicionarToast('Filtros limpos', 'info');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-[--mike-accent]/10 border border-[--mike-accent]/40 text-[--mike-accent] hover:bg-[--mike-accent]/15 transition"
              >
                <FilterX className="w-3 h-3" /> Limpar filtros
              </button>
            ) : (
              <button
                onClick={() => onNavegarExterno ? onNavegarExterno('criar_bot') : setModalAcao({ tipo: 'criar_bot' })}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-[--mike-accent] text-[--mike-bg] hover:bg-emerald-400 transition shadow-md"
              >
                <Plus className="w-3 h-3" /> Criar primeiro bot
              </button>
            )}
          </div>
        )}

        {/* FAB */}
        <button
          onClick={() => onNavegarExterno ? onNavegarExterno('criar_bot') : setModalAcao({ tipo: 'criar_bot' })}
          className="fixed bottom-6 right-6 z-30 w-14 h-14 rounded-full bg-[--mike-accent] hover:bg-emerald-400 text-[--mike-bg] flex items-center justify-center shadow-2xl shadow-[--mike-accent]/40 hover:scale-110 transition-transform"
          title="Criar novo bot"
        >
          <Plus className="w-6 h-6" strokeWidth={3} />
        </button>
      </main>

      {/* TOASTS */}
      <div className="fixed bottom-4 left-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => {
          const corMap = {
            success: { bg: 'bg-emerald-500/95', icon: <CheckCircle2 className="w-4 h-4" /> },
            warn:    { bg: 'bg-amber-500/95',   icon: <AlertCircle className="w-4 h-4" /> },
            error:   { bg: 'bg-rose-500/95',    icon: <AlertTriangle className="w-4 h-4" /> },
            info:    { bg: 'bg-cyan-500/95',    icon: <AlertCircle className="w-4 h-4" /> },
          };
          const cor = corMap[t.tipo] || corMap.info;
          return (
            <div key={t.id} className={`mike-toast-in pointer-events-auto rounded-md ${cor.bg} text-white px-3 py-2 text-xs font-semibold flex items-center gap-2 shadow-lg max-w-sm`}>
              {cor.icon}
              {t.mensagem}
            </div>
          );
        })}
      </div>

      {/* MODAL CONFIRMACAO */}
      {modalConfirm && (
        <div onClick={() => setModalConfirm(null)} className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <div onClick={e => e.stopPropagation()} className="rounded-2xl p-6 max-w-sm w-full" style={{
            backgroundColor: 'var(--mike-card)',
            border: '0.5px solid rgba(60, 85, 130, 0.6)',
            animation: 'mike-modal-fade 200ms ease-out',
          }}>
            <div className="flex items-start gap-3 mb-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${modalConfirm.tipo === 'deletar' ? 'bg-rose-800/30 border border-rose-700/50' : 'bg-rose-500/15 border border-rose-500/40'}`}>
                {modalConfirm.tipo === 'deletar' ? <Trash2 className="w-5 h-5 text-rose-300" /> : <AlertTriangle className="w-5 h-5 text-rose-400" />}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold text-[--mike-fg] mb-1">
                  {modalConfirm.tipo === 'deletar' ? 'Deletar bot?' : 'Parar bot?'}
                </h3>
                <p className="text-xs text-[--mike-fg-muted] leading-relaxed">
                  {modalConfirm.tipo === 'deletar'
                    ? <><span>Tem certeza que quer </span><span className="text-rose-300 font-bold">deletar permanentemente</span><span> o bot </span><span className="text-[--mike-fg] font-semibold">"{modalConfirm.bot.nome}"</span><span>? Esta ação não pode ser desfeita.</span></>
                    : <><span>Tem certeza que quer parar </span><span className="text-[--mike-fg] font-semibold">"{modalConfirm.bot.nome}"</span><span>? Apostas em andamento serão canceladas.</span></>}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 justify-end">
              <button onClick={() => setModalConfirm(null)} className="px-3 py-1.5 rounded-md text-xs font-medium mike-border-thin text-[--mike-fg-soft] hover:text-[--mike-fg] transition">
                Cancelar
              </button>
              <button onClick={modalConfirm.onConfirm} className={`px-3 py-1.5 rounded-md text-xs font-bold text-white transition ${modalConfirm.tipo === 'deletar' ? 'bg-rose-700 hover:bg-rose-600' : 'bg-rose-500 hover:bg-rose-400'}`}>
                {modalConfirm.tipo === 'deletar' ? 'Sim, deletar permanentemente' : 'Sim, parar bot'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ACAO */}
      {modalAcao && (
        <div onClick={() => setModalAcao(null)} className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <div onClick={e => e.stopPropagation()} className="rounded-2xl p-6 max-w-md w-full" style={{
            backgroundColor: 'var(--mike-card)',
            border: '0.5px solid rgba(60, 85, 130, 0.6)',
            animation: 'mike-modal-fade 200ms ease-out',
          }}>
            <div className="flex items-start justify-between mb-4">
              <div className="min-w-0 flex-1">
                <div className="text-[10px] tracking-widest text-[--mike-fg-muted] uppercase mb-1">
                  {modalAcao.tipo === 'navegar' && 'Navegação'}
                  {modalAcao.tipo === 'historico' && 'Histórico do Bot'}
                  {modalAcao.tipo === 'editar' && 'Editar Bot'}
                  {modalAcao.tipo === 'agendar' && 'Agendamento'}
                  {modalAcao.tipo === 'alertas' && 'Alertas'}
                  {modalAcao.tipo === 'criar_bot' && 'Criar Novo Bot'}
                  {modalAcao.tipo === 'timezone' && 'Configurar Timezone'}
                </div>
                <div className="text-base font-bold text-[--mike-fg] truncate">
                  {modalAcao.tipo === 'navegar' && `Ir para: ${modalAcao.destino}`}
                  {modalAcao.bot && modalAcao.bot.nome}
                  {modalAcao.tipo === 'criar_bot' && 'Wizard de criação'}
                  {modalAcao.tipo === 'timezone' && 'America/Sao_Paulo (BRT, UTC−3)'}
                </div>
              </div>
              <button onClick={() => setModalAcao(null)} className="p-1 rounded hover:bg-[--mike-card-hover] text-[--mike-fg-muted] hover:text-[--mike-fg] transition flex-shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[--mike-fg-muted] leading-relaxed">
              {modalAcao.tipo === 'navegar' && 'Em produção, navegaria para a tela correspondente.'}
              {modalAcao.tipo === 'historico' && 'Em produção, abriria a tela de histórico completo do bot.'}
              {modalAcao.tipo === 'editar' && 'Em produção, abriria o wizard de edição do bot.'}
              {modalAcao.tipo === 'agendar' && 'Em produção, abriria modal com seletor de dias e horários.'}
              {modalAcao.tipo === 'alertas' && 'Em produção, abriria configuração de alertas.'}
              {modalAcao.tipo === 'criar_bot' && 'Em produção, abriria o wizard completo de criação de bot.'}
              {modalAcao.tipo === 'timezone' && 'Em produção, abriria seletor de timezone afetando agendamentos. Casas de aposta podem operar em fuso diferente do bot.'}
            </p>
            <div className="text-[10px] text-[--mike-fg-muted] mt-3 text-center">
              Pressione <kbd className="px-1.5 py-0.5 rounded bg-[--mike-bg-2] border border-[--mike-border] font-mono">Esc</kbd> ou clique fora pra fechar
            </div>
          </div>
        </div>
      )}
    </div>
  );
}