// ============================================================
// Stats.jsx - Tela de Estatísticas (por esporte)
//
// Hub de análise por esporte (NBA2K default). Replica e evolui
// a tela equivalente do TipManager, adicionando:
//   - 5 KPIs de overview do esporte
//   - 3 cards "próximos por liga" COM dados (WR previsto, sequência, hot)
//   - Tabs: Próximos / Últimos / Heatmap / Distribuições
//   - Mini-comparador H2H (jogador A vs B)
//   - Botão "Analisar" abre Partida Individual
//
// 🔌 BACKEND: ver lib/BACKEND.md
//   GET /stats/:esporte/overview     → { kpis, ligas, hot_jogadores }
//   GET /stats/:esporte/proximos     → [...]
//   GET /stats/:esporte/ultimos      → [...]
//   GET /stats/:esporte/heatmap      → matriz por dia/hora
//   GET /stats/:esporte/distribuicoes → histogramas
//   GET /stats/:esporte/jogadores    → lista pra dropdown comparador
// ============================================================

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Search, Bell, Settings, ChevronDown, Home, Activity, Store, Bot, Table2, BarChart3, Plus,
  ChevronRight, X, RefreshCw, AlertCircle, TrendingUp, TrendingDown, Flame,
  Trophy, Clock, Target, Hash, Percent, DollarSign, Users, Zap, ArrowUpDown,
  CheckCircle2, Calendar, BarChart, ChevronLeft,
} from 'lucide-react';
import MikeHeader from '../shared/MikeHeader.jsx';

// ============================================================
// 1. CONSTANTES
// ============================================================

const ESPORTES = [
  { id: 'nba2k',       label: 'NBA 2K',           icon: '🏀', cor: '#f97316' },
  { id: 'fifa',        label: 'Fifa (e-Soccer)',  icon: '⚽', cor: '#10b981' },
  { id: 'ehockey',     label: 'e-Hockey',         icon: '🏒', cor: '#06b6d4' },
  { id: 'enfl',        label: 'e-NFL',            icon: '🏈', cor: '#a855f7' },
  { id: 'tabletennis', label: 'Tênis de Mesa',    icon: '🏓', cor: '#eab308' },
  { id: 'tennis',      label: 'Tênis',            icon: '🎾', cor: '#84cc16' },
  { id: 'cs2',         label: 'Counter-Strike 2', icon: '🎮', cor: '#ef4444' },
  { id: 'futebol',     label: 'Futebol',          icon: '⚽', cor: '#3b82f6' },
];


// ============================================================
// 2. HELPERS DETERMINISTICOS (pra mocks estáveis)
// ============================================================

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h = (h ^ s.charCodeAt(i)) * 16777619; h = h >>> 0; }
  return h;
}

function seeded(seed) {
  let st = seed >>> 0;
  return () => { st = (st * 1664525 + 1013904223) >>> 0; return st / 0xffffffff; };
}

function normaliza(s) {
  return (s || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Componente que destaca um termo dentro de um texto (case-insensitive)
function HighlightText({ texto, termo, className = '' }) {
  if (!termo || !texto) return <span className={className}>{texto}</span>;
  const tNorm = normaliza(termo);
  const sNorm = normaliza(texto);
  const idx = sNorm.indexOf(tNorm);
  if (idx === -1) return <span className={className}>{texto}</span>;
  const antes = texto.substring(0, idx);
  const meio = texto.substring(idx, idx + termo.length);
  const depois = texto.substring(idx + termo.length);
  return (
    <span className={className}>
      {antes}
      <mark style={{ background: 'rgba(251,191,36,0.35)', color: '#fbbf24', padding: '0 1px', borderRadius: '2px', fontWeight: 'bold' }}>{meio}</mark>
      {depois}
    </span>
  );
}

// ============================================================
// 3. MOCKS POR ESPORTE
// ============================================================

// Cada esporte tem suas ligas e jogadores específicos
// Mapa: ID interno do Stats → esporte do PartidaIndividual
const ESPORTE_PARA_PARTIDA = {
  nba2k:       'e-Basket',
  fifa:        'e-Soccer',
  ehockey:     'e-Hockey',
  enfl:        'e-NFL',
  tabletennis: 'Table Tennis',
  tennis:      'Tênis',
  cs2:         'CS2',
  futebol:     'Futebol',
};

const DADOS_POR_ESPORTE = {
  nba2k: {
    ligas: ['H2H GG League', 'Adriatic - NextGen', 'Battle'],
    jogadores: [
      { nome: 'Sting',       time: 'DAL Mavericks' },
      { nome: 'Trinity',     time: 'CHA Hornets' },
      { nome: 'Berlin',      time: 'LA Lakers' },
      { nome: 'Sevilla',     time: 'DEN Nuggets' },
      { nome: 'Kotkata',     time: 'Real Madrid' },
      { nome: 'Margotostek', time: 'Hapoel tel aviv' },
      { nome: 'Radiant',     time: 'DAL Mavericks' },
      { nome: 'Blizzard',    time: 'DEN Nuggets' },
      { nome: 'J4m',         time: 'OKC Thunder' },
      { nome: 'H1lex13',     time: 'HOU Rockets' },
      { nome: 'Maaas1k',     time: 'WAS Wizards' },
      { nome: 'Dema21',      time: 'SAC Kings' },
      { nome: 'Marine',      time: 'ORL Magic' },
      { nome: 'Saint jr',    time: 'DAL Mavericks' },
      { nome: 'Taapz',       time: 'CLE Cavaliers' },
      { nome: 'Huncho',      time: 'PHX Suns' },
      { nome: 'Dagger',      time: 'MIL Bucks' },
      { nome: 'Commander',   time: 'PHX Suns' },
      { nome: 'Valencia',    time: 'MIL Bucks' },
      { nome: 'Sakaido',     time: 'CLE Cavaliers' },
      { nome: 'Bangkok',     time: 'MIA Heat' },
      { nome: 'Spooky',      time: 'CLE Cavaliers' },
      { nome: 'Airmayo',     time: 'Olympiakos' },
      { nome: 'Iksvel',      time: 'Fenerbahce' },
      { nome: 'Koko',        time: 'Dubai' },
      { nome: 'Mumbai',      time: 'IND Pacers' },
    ],
  },
  fifa: {
    ligas: ['Battle', 'GT League', 'ECF (Volta)', 'Adriatic League'],
    jogadores: [
      { nome: 'Sena',       time: 'Real Madrid' },
      { nome: 'Cofi111',    time: 'Barcelona' },
      { nome: 'Inferno',    time: 'Manchester City' },
      { nome: 'Bolt',       time: 'Liverpool' },
      { nome: 'Klvu17',     time: 'Bayern München' },
      { nome: 'Yerema',     time: 'Bor. Dortmund' },
      { nome: 'Hristian05', time: 'Roma' },
      { nome: 'Duka',       time: 'Porto' },
      { nome: 'Fantazer',   time: 'Eint. Frankfurt' },
      { nome: 'Llulle',     time: 'Liverpool' },
      { nome: 'Maggett0',   time: 'Fenerbahce' },
      { nome: 'Ganger_29',  time: 'Aston Villa' },
    ],
  },
  ehockey: {
    ligas: ['NHL eSports', 'IIHF eSports', 'KHL eSports'],
    jogadores: [
      { nome: 'IceMaster', time: 'Boston Bruins' },
      { nome: 'Frostbite', time: 'Toronto' },
      { nome: 'Blizzard',  time: 'Rangers' },
      { nome: 'Glacier',   time: 'Penguins' },
    ],
  },
  enfl: {
    ligas: ['Madden NFL eLeague', 'NFL Battle', 'eMadden Cup'],
    jogadores: [
      { nome: 'GridIron',    time: 'Patriots' },
      { nome: 'TouchDown',   time: 'Chiefs' },
      { nome: 'Quarterback', time: 'Cowboys' },
      { nome: 'Linebacker',  time: 'Eagles' },
    ],
  },
  tabletennis: {
    ligas: ['Setka Cup (Ucrânia)', 'TT Cup', 'Liga Pro'],
    jogadores: [
      { nome: 'Eduard Populovskyi', time: '' },
      { nome: 'Dmytro Patalakha',   time: '' },
      { nome: 'Eduard P.',          time: '' },
      { nome: 'Dmytro P.',          time: '' },
    ],
  },
  tennis: {
    ligas: ['ATP Roma', 'WTA Madrid', 'Roland Garros'],
    jogadores: [
      { nome: 'Alcaraz',  time: '' },
      { nome: 'Sinner',   time: '' },
      { nome: 'Djokovic', time: '' },
      { nome: 'Medvedev', time: '' },
    ],
  },
  cs2: {
    ligas: ['BLAST Premier', 'IEM', 'ESL Pro League'],
    jogadores: [
      { nome: 'NAVI',         time: '' },
      { nome: 'FaZe',         time: '' },
      { nome: 'Vitality',     time: '' },
      { nome: 'G2 Esports',   time: '' },
    ],
  },
  futebol: {
    ligas: ['Premier League', 'La Liga', 'Serie A', 'Bundesliga'],
    jogadores: [
      { nome: 'Atalanta',  time: '' },
      { nome: 'Genoa',     time: '' },
      { nome: 'Barcelona', time: '' },
      { nome: 'Real Madrid', time: '' },
    ],
  },
};

// Gera próximos jogos pra um esporte (deterministico)
function gerarProximosJogos(esporteId, qtd = 50) {
  const esporte = DADOS_POR_ESPORTE[esporteId];
  if (!esporte) return [];
  const r = seeded(hashStr(`prox-${esporteId}`));
  const jogos = [];
  let h = new Date();
  h.setMinutes(h.getMinutes() + 15);

  for (let i = 0; i < qtd; i++) {
    const a = esporte.jogadores[Math.floor(r() * esporte.jogadores.length)];
    let b;
    do { b = esporte.jogadores[Math.floor(r() * esporte.jogadores.length)]; } while (b.nome === a.nome);
    const liga = esporte.ligas[Math.floor(r() * esporte.ligas.length)];
    const wrPrev = Math.round(45 + r() * 35); // 45-80%
    const sequencia = Math.floor((r() - 0.5) * 10); // -5 a +5
    const isHot = r() > 0.85;

    jogos.push({
      id: `prox-${esporteId}-${i}`,
      data: `${String(h.getDate()).padStart(2,'0')}/${String(h.getMonth()+1).padStart(2,'0')} ${String(h.getHours()).padStart(2,'0')}:${String(h.getMinutes()).padStart(2,'0')}`,
      jogadorA: a.nome,
      timeA: a.time,
      jogadorB: b.nome,
      timeB: b.time,
      liga,
      wrPrev,
      sequencia,
      isHot,
    });
    h.setMinutes(h.getMinutes() + Math.floor(r() * 5 + 1));
  }
  return jogos;
}

// Gera últimos jogos (com placar)
function gerarUltimosJogos(esporteId, qtd = 50) {
  const esporte = DADOS_POR_ESPORTE[esporteId];
  if (!esporte) return [];
  const r = seeded(hashStr(`ult-${esporteId}`));
  const jogos = [];
  let h = new Date();
  h.setMinutes(h.getMinutes() - 15);

  for (let i = 0; i < qtd; i++) {
    const a = esporte.jogadores[Math.floor(r() * esporte.jogadores.length)];
    let b;
    do { b = esporte.jogadores[Math.floor(r() * esporte.jogadores.length)]; } while (b.nome === a.nome);
    const liga = esporte.ligas[Math.floor(r() * esporte.ligas.length)];

    // Placar varia por esporte
    let placarA, placarB;
    if (esporteId === 'nba2k' || esporteId === 'enfl') {
      placarA = Math.round(40 + r() * 50);
      placarB = Math.round(40 + r() * 50);
    } else if (esporteId === 'fifa' || esporteId === 'futebol') {
      placarA = Math.floor(r() * 5);
      placarB = Math.floor(r() * 5);
    } else if (esporteId === 'tabletennis' || esporteId === 'tennis') {
      placarA = Math.floor(r() * 4);
      placarB = Math.floor(r() * 4);
    } else if (esporteId === 'ehockey') {
      placarA = Math.floor(r() * 7);
      placarB = Math.floor(r() * 7);
    } else if (esporteId === 'cs2') {
      placarA = Math.floor(r() * 3);
      placarB = Math.floor(r() * 3);
    } else {
      placarA = 0; placarB = 0;
    }

    jogos.push({
      id: `ult-${esporteId}-${i}`,
      data: `${String(h.getDate()).padStart(2,'0')}/${String(h.getMonth()+1).padStart(2,'0')} ${String(h.getHours()).padStart(2,'0')}:${String(h.getMinutes()).padStart(2,'0')}`,
      jogadorA: a.nome,
      timeA: a.time,
      jogadorB: b.nome,
      timeB: b.time,
      liga,
      placarA,
      placarB,
    });
    h.setMinutes(h.getMinutes() - Math.floor(r() * 5 + 1));
  }
  return jogos;
}

// Gera KPIs do esporte
// Mini-preview de um jogador (pra Comparador H2H)
function gerarPreviewJogador(esporteId, nomeJogador) {
  if (!nomeJogador) return null;
  const r = seeded(hashStr(`prev-${esporteId}-${nomeJogador}`));
  const wr10 = Math.round(40 + r() * 50);
  const wr30 = Math.round(40 + r() * 45);
  const sequencia = Math.floor((r() - 0.4) * 12);
  const lucro24h = +((r() - 0.3) * 80).toFixed(1);
  const partidas = Math.round(20 + r() * 80);
  const oddMedia = +(1.5 + r() * 1.5).toFixed(2);
  // Stream de últimos 5 resultados (W/L)
  const ultimos5 = Array.from({ length: 5 }, () => r() > 0.45 ? 'W' : 'L');
  return { wr10, wr30, sequencia, lucro24h, partidas, oddMedia, ultimos5 };
}

// Gera KPIs do esporte
function gerarKPIs(esporteId) {
  const esporte = DADOS_POR_ESPORTE[esporteId];
  if (!esporte) return null;
  const r = seeded(hashStr(`kpi-${esporteId}`));
  const jogosHoje = Math.round(150 + r() * 200);
  const wrMedio = +(60 + r() * 15).toFixed(1);
  const lucro24h = +(150 + r() * 400).toFixed(2);
  const ligaQuente = esporte.ligas[Math.floor(r() * esporte.ligas.length)];
  const jogadorHot = esporte.jogadores[Math.floor(r() * esporte.jogadores.length)].nome;
  return { jogosHoje, wrMedio, lucro24h, ligaQuente, jogadorHot };
}

// Gera "próximos por liga" — destaque do topo
function gerarProximosPorLiga(esporteId) {
  const esporte = DADOS_POR_ESPORTE[esporteId];
  if (!esporte) return [];
  // Pega ligas únicas dos próximos jogos
  const todosProximos = gerarProximosJogos(esporteId, 50);
  const ligasUsadas = new Set();
  const cards = [];
  for (const jogo of todosProximos) {
    if (cards.length >= 3) break;
    if (ligasUsadas.has(jogo.liga)) continue;
    ligasUsadas.add(jogo.liga);
    // Calcular tempo restante até o jogo (aproximado: extrai HH:mm da data)
    const matchHora = (jogo.data || '').match(/(\d{2}):(\d{2})$/);
    const tempoExibir = matchHora ? `${matchHora[1]}:${matchHora[2]}` : '--:--';
    cards.push({
      id: jogo.id,
      liga: jogo.liga,
      tempo: tempoExibir,
      jogadorA: jogo.jogadorA,
      timeA: jogo.timeA,
      jogadorB: jogo.jogadorB,
      timeB: jogo.timeB,
      wrPrev: jogo.wrPrev,
      sequencia: jogo.sequencia,
      isHot: jogo.isHot || cards.length === 0, // primeiro sempre hot
    });
  }
  return cards;
}

// Heatmap: 7 dias × 24 horas, valores 0-100 (intensidade de jogos/atividade)
function gerarHeatmap(esporteId) {
  const r = seeded(hashStr(`heat-${esporteId}`));
  const dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const matriz = dias.map((dia, d) => {
    const horas = [];
    for (let h = 0; h < 24; h++) {
      // Volume de jogos (atividade)
      let qtd = Math.round(2 + r() * 8);
      if (h >= 14 && h <= 22) qtd += 5;
      if (d === 0 || d === 6) qtd += 2;
      qtd = Math.min(20, qtd);

      // WR varia por horário: madrugada pior (cansado), tarde melhor
      let wr = 50 + r() * 20;
      if (h >= 2 && h <= 6) wr -= 15;
      if (h >= 14 && h <= 18) wr += 10;
      wr = Math.min(95, Math.max(20, Math.round(wr)));

      // ROI: correlacionado com WR
      const roi = +(((wr - 52) * 0.8 + (r() - 0.5) * 10)).toFixed(1);

      horas.push({ qtd, wr, roi });
    }
    return { dia, horas };
  });
  return matriz;
}

// Distribuições: WR e ROI (histogramas)
function gerarDistribuicoes(esporteId) {
  const r = seeded(hashStr(`dist-${esporteId}`));
  // WR distribution: bins de 10% (0-10, 10-20, ... 90-100)
  const binsWR = [];
  for (let i = 0; i < 10; i++) {
    // Curva normal centrada em 60-70%
    const peso = Math.max(0, 100 - Math.abs(i - 6.5) * 20 + r() * 30);
    binsWR.push({ bin: `${i*10}-${(i+1)*10}%`, qtd: Math.round(peso) });
  }
  // ROI: bins de 10u (-50 a +50)
  const binsROI = [];
  for (let i = -5; i <= 5; i++) {
    const peso = Math.max(0, 80 - Math.abs(i - 1) * 15 + r() * 25);
    binsROI.push({ bin: `${i*10 >= 0 ? '+' : ''}${i*10}u`, qtd: Math.round(peso) });
  }
  return { wr: binsWR, roi: binsROI };
}

// ============================================================
// 4. API CLIENT + HOOKS (plug-and-play)
// ============================================================

const USE_MOCK = true;
const MOCK_LATENCY = { min: 80, max: 200 };

function simularLatencia() {
  const ms = MOCK_LATENCY.min + Math.random() * (MOCK_LATENCY.max - MOCK_LATENCY.min);
  return new Promise(resolve => setTimeout(resolve, ms));
}

const mockResponses = {
  // 🔌 BACKEND: GET /stats/:esporte/overview
  '/stats/overview': ({ esporte }) => {
    const kpis = gerarKPIs(esporte);
    const ligas = gerarProximosPorLiga(esporte);
    return { kpis, ligas };
  },

  // 🔌 BACKEND: GET /stats/:esporte/proximos?busca=&liga=
  '/stats/proximos': ({ esporte, busca, liga, page = 1, pageSize = 10 }) => {
    let jogos = gerarProximosJogos(esporte, 50);
    if (liga && liga !== 'todas') jogos = jogos.filter(j => j.liga === liga);
    if (busca) {
      const t = normaliza(busca);
      jogos = jogos.filter(j =>
        [j.jogadorA, j.jogadorB, j.timeA, j.timeB, j.liga].some(c => normaliza(c).includes(t))
      );
    }
    const total = jogos.length;
    const start = (page - 1) * pageSize;
    return { jogos: jogos.slice(start, start + pageSize), total };
  },

  // 🔌 BACKEND: GET /stats/:esporte/ultimos?busca=&liga=
  '/stats/ultimos': ({ esporte, busca, liga, page = 1, pageSize = 10 }) => {
    let jogos = gerarUltimosJogos(esporte, 50);
    if (liga && liga !== 'todas') jogos = jogos.filter(j => j.liga === liga);
    if (busca) {
      const t = normaliza(busca);
      jogos = jogos.filter(j =>
        [j.jogadorA, j.jogadorB, j.timeA, j.timeB, j.liga].some(c => normaliza(c).includes(t))
      );
    }
    const total = jogos.length;
    const start = (page - 1) * pageSize;
    return { jogos: jogos.slice(start, start + pageSize), total };
  },

  // 🔌 BACKEND: GET /stats/:esporte/heatmap
  '/stats/heatmap': ({ esporte }) => {
    return { matriz: gerarHeatmap(esporte) };
  },

  // 🔌 BACKEND: GET /stats/:esporte/distribuicoes
  '/stats/distribuicoes': ({ esporte }) => {
    return gerarDistribuicoes(esporte);
  },

  // 🔌 BACKEND: GET /stats/:esporte/jogadores
  '/stats/jogadores': ({ esporte, busca }) => {
    const dados = DADOS_POR_ESPORTE[esporte];
    if (!dados) return { jogadores: [] };
    let lista = dados.jogadores;
    if (busca) {
      const t = normaliza(busca);
      lista = lista.filter(j => normaliza(j.nome).includes(t) || normaliza(j.time).includes(t));
    }
    return { jogadores: lista };
  },

  // 🔌 BACKEND: GET /stats/:esporte/torneios
  '/stats/torneios': ({ esporte }) => {
    const dados = DADOS_POR_ESPORTE[esporte];
    return { torneios: dados ? dados.ligas : [] };
  },

  // 🔌 BACKEND: GET /stats/:esporte/preview-jogador?nome=
  '/stats/preview-jogador': ({ esporte, nome }) => {
    return { preview: gerarPreviewJogador(esporte, nome) };
  },
};

async function apiGet(endpoint, params) {
  if (USE_MOCK) {
    await simularLatencia();
    const handler = mockResponses[endpoint];
    if (!handler) throw new Error(`[MOCK] Endpoint não implementado: GET ${endpoint}`);
    return handler(params || {});
  }
  const qs = new URLSearchParams(Object.entries(params || {}).filter(([_, v]) => v !== null && v !== undefined && v !== '')).toString();
  const res = await fetch(`${endpoint}${qs ? '?' + qs : ''}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

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

// Hooks específicos
function useStatsOverview(esporte) {
  return useApiQuery('/stats/overview', { esporte });
}

function useStatsProximos(filtros) {
  const { data, loading, error, refetch } = useApiQuery('/stats/proximos', filtros);
  return { jogos: data?.jogos || [], total: data?.total || 0, loading, error, refetch };
}

function useStatsUltimos(filtros) {
  const { data, loading, error, refetch } = useApiQuery('/stats/ultimos', filtros);
  return { jogos: data?.jogos || [], total: data?.total || 0, loading, error, refetch };
}

function useStatsHeatmap(esporte) {
  return useApiQuery('/stats/heatmap', { esporte });
}

function useStatsDistribuicoes(esporte) {
  return useApiQuery('/stats/distribuicoes', { esporte });
}

function useStatsJogadores(filtros) {
  const { data, loading, error } = useApiQuery('/stats/jogadores', filtros);
  return { jogadores: data?.jogadores || [], loading, error };
}

function useStatsTorneios(esporte) {
  const { data, loading } = useApiQuery('/stats/torneios', { esporte });
  return { torneios: data?.torneios || [], loading };
}

function useStatsPreviewJogador(esporte, nome) {
  const { data, loading } = useApiQuery('/stats/preview-jogador', { esporte, nome });
  return { preview: data?.preview || null, loading };
}

// ============================================================
// 5. COMPONENTES BASE
// ============================================================

function MikeSelect({ value, onChange, options, placeholder = 'Selecione', width = 'w-full', searchable = false }) {
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setBusca('');
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const selected = options.find(o => o.value === value);
  const filtradas = searchable && busca
    ? options.filter(o => normaliza(o.label).includes(normaliza(busca)))
    : options;

  return (
    <div ref={ref} className={`relative ${width}`}>
      <button
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md text-xs font-medium transition mike-border-thin bg-transparent text-[--mike-fg] hover:text-[--mike-fg] ${open ? 'border-[--mike-accent]' : ''}`}
      >
        <span className="truncate flex items-center gap-2">
          {selected?.icon && <span>{selected.icon}</span>}
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className={`w-3 h-3 flex-shrink-0 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 rounded-md z-30" style={{
          backgroundColor: 'var(--mike-card)',
          border: '0.5px solid rgba(60, 85, 130, 0.6)',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
          maxHeight: '360px',
          overflowY: 'auto',
          overflowX: 'hidden',
          scrollbarWidth: 'thin',
        }}>
          {searchable && (
            <div className="sticky top-0 p-2" style={{ backgroundColor: 'var(--mike-card)', borderBottom: '0.5px solid rgba(60,85,130,0.4)' }}>
              <div className="flex items-center gap-2 px-2 py-1 rounded mike-border-thin">
                <Search className="w-3 h-3 text-[--mike-fg-muted]" />
                <input
                  autoFocus
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar..."
                  className="flex-1 bg-transparent text-xs text-[--mike-fg] outline-none placeholder:text-[--mike-fg-muted]"
                />
              </div>
            </div>
          )}
          {filtradas.length === 0 ? (
            <div className="px-3 py-3 text-xs text-[--mike-fg-muted] text-center">Nenhum resultado</div>
          ) : filtradas.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); setBusca(''); }}
              className={`w-full text-left px-3 py-2 text-xs transition flex items-center gap-2 ${
                opt.value === value
                  ? 'bg-[--mike-accent]/10 text-[--mike-accent]'
                  : 'text-[--mike-fg-soft] hover:bg-[--mike-card-hover] hover:text-[--mike-fg]'
              }`}
            >
              {opt.icon && <span>{opt.icon}</span>}
              <span className="flex-1 truncate">{opt.label}</span>
              {opt.sublabel && <span className="text-[10px] text-[--mike-fg-muted]">{opt.sublabel}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


function CardKPI({ icon: Icon, label, valor, sublabel, cor = 'text-[--mike-accent]', loading }) {
  return (
    <div className="rounded-lg p-3 min-w-0 transition hover:bg-[--mike-card-2]/40" style={{
      backgroundColor: 'rgba(20, 26, 40, 0.4)',
      border: '0.5px solid rgba(60, 85, 130, 0.4)',
    }}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className={`w-3 h-3 flex-shrink-0 ${cor}`} />
        <span className="text-[9px] uppercase tracking-wider text-[--mike-fg-muted] font-bold truncate">{label}</span>
      </div>
      {loading ? (
        <div className="h-6 rounded animate-pulse" style={{ background: 'rgba(60,85,130,0.2)' }} />
      ) : (
        <>
          <div className={`text-lg font-black font-mono leading-tight truncate ${cor}`}>{valor}</div>
          {sublabel && <div className="text-[10px] text-[--mike-fg-muted] mt-0.5 truncate">{sublabel}</div>}
        </>
      )}
    </div>
  );
}

// ============================================================
// 7. CARD "PRÓXIMO POR LIGA" (3 destaques superiores)
// ============================================================
function CardProximoLiga({ jogo, onAnalisar }) {
  return (
    <div className="rounded-lg p-2.5 transition hover:bg-[--mike-card-2]/60 cursor-pointer relative" style={{
      backgroundColor: 'rgba(20, 26, 40, 0.5)',
      border: '0.5px solid rgba(60, 85, 130, 0.4)',
    }} onClick={onAnalisar}>
      {/* Linha 1: horário + liga */}
      <div className="flex items-center gap-2 mb-1.5">
        <Clock className="w-2.5 h-2.5 text-[--mike-fg-muted] flex-shrink-0" />
        <span className="text-[10px] text-[--mike-fg-muted] font-mono flex-shrink-0">{jogo.tempo}</span>
        <div className="flex-1" />
        <span className="text-[10px] text-emerald-400 font-bold truncate min-w-0">{jogo.liga}</span>
      </div>

      {/* Linha 2: jogadores */}
      <div className="flex items-center gap-1.5 text-xs mb-1.5">
        <div className="flex-1 min-w-0">
          <div className="font-bold text-[--mike-fg] truncate text-[12px] leading-tight">{jogo.jogadorA}</div>
          {jogo.timeA && <div className="text-[9px] text-[--mike-fg-muted] truncate">{jogo.timeA}</div>}
        </div>
        <span className="text-[--mike-fg-muted] text-[9px] font-bold flex-shrink-0 px-0.5">vs</span>
        <div className="flex-1 min-w-0 text-right">
          <div className="font-bold text-[--mike-fg] truncate text-[12px] leading-tight">{jogo.jogadorB}</div>
          {jogo.timeB && <div className="text-[9px] text-[--mike-fg-muted] truncate">{jogo.timeB}</div>}
        </div>
      </div>

      {/* Linha 3: indicadores (WR, sequência, HOT) */}
      {(jogo.wrPrev || jogo.sequencia !== 0 || jogo.isHot) && (
        <div className="flex items-center justify-center gap-2 pt-1.5" style={{ borderTop: '0.5px solid rgba(60,85,130,0.2)' }}>
          {jogo.wrPrev && (
            <span className="flex items-center gap-0.5 text-[9px] font-bold text-amber-400 font-mono" title={`WR previsto: ${jogo.wrPrev}%`}>
              <Target className="w-2.5 h-2.5" />
              {jogo.wrPrev}%
            </span>
          )}
          {jogo.sequencia !== undefined && jogo.sequencia !== 0 && (
            <span className={`flex items-center gap-0.5 text-[9px] font-bold font-mono ${jogo.sequencia > 0 ? 'text-emerald-400' : 'text-rose-400'}`} title={`Sequência: ${jogo.sequencia > 0 ? '+' : ''}${jogo.sequencia}`}>
              {jogo.sequencia > 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
              {jogo.sequencia > 0 ? '+' : ''}{jogo.sequencia}
            </span>
          )}
          {jogo.isHot && (
            <span className="flex items-center gap-0.5 px-1 py-0 rounded text-[8px] font-bold text-rose-50" style={{
              background: 'linear-gradient(135deg, #f43f5e, #ec4899)',
            }}>
              <Flame className="w-2.5 h-2.5" />
              HOT
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// 8. LINHA DE JOGO (lista densa)
// ============================================================
function LinhaProximoJogo({ jogo, onAnalisar, busca = '' }) {
  return (
    <div
      onClick={onAnalisar}
      className="group grid grid-cols-12 gap-2 items-center px-3 py-2 rounded transition hover:bg-[--mike-card-2]/40 cursor-pointer mike-row-hover"
      style={{ borderBottom: '0.5px solid rgba(60,85,130,0.15)' }}
    >
      <div className="col-span-3 sm:col-span-2 text-[10px] text-[--mike-fg-muted] font-mono truncate">
        {jogo.data}
      </div>
      <div className="col-span-9 sm:col-span-7 flex items-center gap-2 text-xs min-w-0">
        <div className="flex-1 min-w-0 text-right">
          <HighlightText texto={jogo.jogadorA} termo={busca} className="font-bold text-[--mike-fg]" />
          {jogo.timeA && <span className="text-[--mike-fg-muted] ml-1 text-[10px]"><HighlightText texto={jogo.timeA} termo={busca} /></span>}
        </div>
        <span className="text-[--mike-fg-muted] font-bold flex-shrink-0">×</span>
        <div className="flex-1 min-w-0 text-left">
          <HighlightText texto={jogo.jogadorB} termo={busca} className="font-bold text-[--mike-fg]" />
          {jogo.timeB && <span className="text-[--mike-fg-muted] ml-1 text-[10px]"><HighlightText texto={jogo.timeB} termo={busca} /></span>}
        </div>
      </div>
      <div className="hidden sm:flex col-span-2 items-center justify-end gap-2 text-[10px]">
        {jogo.wrPrev && (
          <span className="text-amber-400 font-mono font-bold">{jogo.wrPrev}%</span>
        )}
        {jogo.sequencia !== undefined && jogo.sequencia !== 0 && (
          <span className={`font-mono font-bold ${jogo.sequencia > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {jogo.sequencia > 0 ? '+' : ''}{jogo.sequencia}
          </span>
        )}
        {jogo.isHot && <Flame className="w-3 h-3 text-rose-400" />}
      </div>
      <div className="col-span-12 sm:col-span-1 flex items-center justify-end">
        <div className="opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all"><ChevronRight className="w-4 h-4 text-[--mike-accent]" /></div>
      </div>
    </div>
  );
}

function LinhaUltimoJogo({ jogo, onAnalisar, busca = '' }) {
  return (
    <div
      onClick={onAnalisar}
      className="group grid grid-cols-12 gap-2 items-center px-3 py-2 rounded transition hover:bg-[--mike-card-2]/40 cursor-pointer mike-row-hover"
      style={{ borderBottom: '0.5px solid rgba(60,85,130,0.15)' }}
    >
      <div className="col-span-3 sm:col-span-2 text-[10px] text-[--mike-fg-muted] font-mono truncate">
        {jogo.data}
      </div>
      <div className="col-span-9 sm:col-span-9 flex items-center gap-2 text-xs min-w-0">
        <div className="flex-1 min-w-0 text-right">
          <HighlightText texto={jogo.jogadorA} termo={busca} className="font-bold text-[--mike-fg]" />
          {jogo.timeA && <span className="text-[--mike-fg-muted] ml-1 text-[10px]"><HighlightText texto={jogo.timeA} termo={busca} /></span>}
        </div>
        <span className="px-2 py-0.5 rounded font-mono font-bold text-[11px]" style={{
          background: jogo.placarA > jogo.placarB ? 'rgba(16,185,129,0.15)' : 'rgba(244,63,94,0.15)',
          color: jogo.placarA > jogo.placarB ? '#10b981' : '#f43f5e',
        }}>
          {jogo.placarA}
        </span>
        <span className="text-[--mike-fg-muted] font-bold flex-shrink-0 text-[10px]">:</span>
        <span className="px-2 py-0.5 rounded font-mono font-bold text-[11px]" style={{
          background: jogo.placarB > jogo.placarA ? 'rgba(16,185,129,0.15)' : 'rgba(244,63,94,0.15)',
          color: jogo.placarB > jogo.placarA ? '#10b981' : '#f43f5e',
        }}>
          {jogo.placarB}
        </span>
        <div className="flex-1 min-w-0 text-left">
          <HighlightText texto={jogo.jogadorB} termo={busca} className="font-bold text-[--mike-fg]" />
          {jogo.timeB && <span className="text-[--mike-fg-muted] ml-1 text-[10px]"><HighlightText texto={jogo.timeB} termo={busca} /></span>}
        </div>
      </div>
      <div className="col-span-12 sm:col-span-1 flex items-center justify-end">
        <div className="opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all"><ChevronRight className="w-4 h-4 text-[--mike-accent]" /></div>
      </div>
    </div>
  );
}

// ============================================================
// 9. HEATMAP (7d × 24h) - com toggle métrica
// ============================================================
function Heatmap({ matriz, onCriarBot }) {
  const [metrica, setMetrica] = useState('wr'); // 'wr' | 'roi' | 'qtd'
  if (!matriz) return null;
  const horas = Array.from({ length: 24 }, (_, h) => h);

  // Helpers de extração
  const getValor = (cell) => {
    if (metrica === 'wr') return cell.wr;
    if (metrica === 'roi') return cell.roi;
    return cell.qtd;
  };

  // Cores por métrica
  const corCelula = (cell) => {
    if (metrica === 'wr') {
      const v = cell.wr;
      if (v < 40) return 'rgba(244,63,94,0.45)';
      if (v < 50) return 'rgba(244,63,94,0.20)';
      if (v < 55) return 'rgba(60,85,130,0.15)';
      if (v < 65) return 'rgba(16,185,129,0.30)';
      if (v < 75) return 'rgba(16,185,129,0.55)';
      return 'rgba(16,185,129,0.90)';
    }
    if (metrica === 'roi') {
      const v = cell.roi;
      if (v < -10) return 'rgba(244,63,94,0.60)';
      if (v < -3) return 'rgba(244,63,94,0.30)';
      if (v < 3) return 'rgba(60,85,130,0.15)';
      if (v < 10) return 'rgba(16,185,129,0.40)';
      if (v < 20) return 'rgba(16,185,129,0.65)';
      return 'rgba(16,185,129,0.95)';
    }
    // qtd
    const v = cell.qtd;
    if (v < 3) return 'rgba(60,85,130,0.10)';
    if (v < 6) return 'rgba(251,191,36,0.20)';
    if (v < 10) return 'rgba(251,191,36,0.40)';
    if (v < 15) return 'rgba(251,191,36,0.70)';
    return 'rgba(251,191,36,0.95)';
  };

  const formatar = (cell) => {
    if (metrica === 'wr') return `${cell.wr}%`;
    if (metrica === 'roi') return `${cell.roi > 0 ? '+' : ''}${cell.roi}u`;
    return `${cell.qtd}j`;
  };

  const labels = {
    wr: { titulo: 'Win Rate', sub: 'verde = alto WR · vermelho = baixo' },
    roi: { titulo: 'ROI', sub: 'verde = lucro · vermelho = prejuízo' },
    qtd: { titulo: 'Volume de jogos', sub: 'amarelo = mais jogos disponíveis' },
  };

  return (
    <div>
      {/* Toggle de métrica */}
      <div className="flex items-center gap-1 mb-3">
        {[
          { id: 'wr', label: 'WR%', icon: Percent },
          { id: 'roi', label: 'ROI', icon: DollarSign },
          { id: 'qtd', label: 'Volume', icon: Hash },
        ].map(m => {
          const Icon = m.icon;
          const ativo = metrica === m.id;
          return (
            <button
              key={m.id}
              onClick={() => setMetrica(m.id)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-bold transition ${
                ativo
                  ? 'bg-[--mike-accent]/15 text-[--mike-accent]'
                  : 'mike-border-thin text-[--mike-fg-muted] hover:text-[--mike-fg]'
              }`}
            >
              <Icon className="w-3 h-3" />
              {m.label}
            </button>
          );
        })}
        <span className="ml-2 text-[10px] text-[--mike-fg-muted]">{labels[metrica].sub}</span>
      </div>

      <div className="overflow-x-auto">
        <div style={{ minWidth: '700px' }}>
          <div className="grid gap-0.5 mb-1" style={{ gridTemplateColumns: '40px repeat(24, 1fr)' }}>
            <div></div>
            {horas.map(h => (
              <div key={h} className="text-[8px] text-center text-[--mike-fg-muted] font-mono">
                {h % 3 === 0 ? `${h}h` : ''}
              </div>
            ))}
          </div>
          {matriz.map((linha, di) => {
            // Hoje atual
            const agora = new Date();
            const diaAtual = agora.getDay(); // 0=Dom
            const horaAtual = agora.getHours();
            return (
              <div key={linha.dia} className="grid gap-0.5 mb-0.5" style={{ gridTemplateColumns: '40px repeat(24, 1fr)' }}>
                <div className={`text-[10px] font-bold flex items-center ${di === diaAtual ? 'text-[--mike-accent]' : 'text-[--mike-fg-muted]'}`}>
                  {linha.dia}
                  {di === diaAtual && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                </div>
                {linha.horas.map((cell, h) => {
                  const isAgora = di === diaAtual && h === horaAtual;
                  return (
                    <div
                      key={h}
                      className="aspect-square rounded-sm transition hover:scale-125 cursor-pointer relative group"
                      style={{
                        background: corCelula(cell),
                        outline: isAgora ? '1.5px solid #fbbf24' : 'none',
                        outlineOffset: isAgora ? '1px' : '0',
                        zIndex: isAgora ? 2 : 1,
                      }}
                      title={`${linha.dia} ${h}h${isAgora ? ' (agora)' : ''}\nWR: ${cell.wr}% · ROI: ${cell.roi > 0 ? '+' : ''}${cell.roi}u · ${cell.qtd} jogos`}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Insights gerados a partir do heatmap */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        {(() => {
          // Calcular best/worst hora
          const todasCelulas = matriz.flatMap((d, di) =>
            d.horas.map((c, hi) => ({ ...c, dia: d.dia, hora: hi, di, hi }))
          );
          const sortedWR = [...todasCelulas].sort((a, b) => b.wr - a.wr);
          const sortedROI = [...todasCelulas].sort((a, b) => b.roi - a.roi);
          const melhorWR = sortedWR[0];
          const piorWR = sortedWR[sortedWR.length - 1];
          const melhorROI = sortedROI[0];
          return (
            <>
              <div className="rounded-md p-2.5 flex flex-col" style={{ backgroundColor: 'rgba(16,185,129,0.08)', border: '0.5px solid rgba(16,185,129,0.3)' }}>
                <div className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider mb-1">🏆 Melhor WR</div>
                <div className="text-[--mike-fg] font-bold text-xs">{melhorWR.dia} {melhorWR.hora}h</div>
                <div className="text-emerald-400 font-mono font-bold text-sm mt-0.5">{melhorWR.wr}%</div>
                {onCriarBot && (
                  <button
                    onClick={() => onCriarBot({ dia: melhorWR.dia, hora: melhorWR.hora, motivo: 'melhor_wr' })}
                    className="mt-1.5 text-[9px] text-emerald-400 hover:underline font-bold flex items-center gap-1"
                    title="Criar bot agendado pra esse horário"
                  >
                    <Plus className="w-2.5 h-2.5" /> Criar bot
                  </button>
                )}
              </div>
              <div className="rounded-md p-2.5 flex flex-col" style={{ backgroundColor: 'rgba(16,185,129,0.08)', border: '0.5px solid rgba(16,185,129,0.3)' }}>
                <div className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider mb-1">💰 Melhor ROI</div>
                <div className="text-[--mike-fg] font-bold text-xs">{melhorROI.dia} {melhorROI.hora}h</div>
                <div className="text-emerald-400 font-mono font-bold text-sm mt-0.5">+{melhorROI.roi}u</div>
                {onCriarBot && (
                  <button
                    onClick={() => onCriarBot({ dia: melhorROI.dia, hora: melhorROI.hora, motivo: 'melhor_roi' })}
                    className="mt-1.5 text-[9px] text-emerald-400 hover:underline font-bold flex items-center gap-1"
                    title="Criar bot agendado pra esse horário"
                  >
                    <Plus className="w-2.5 h-2.5" /> Criar bot
                  </button>
                )}
              </div>
              <div className="rounded-md p-2.5" style={{ backgroundColor: 'rgba(244,63,94,0.08)', border: '0.5px solid rgba(244,63,94,0.3)' }}>
                <div className="text-[9px] text-rose-400 font-bold uppercase tracking-wider mb-1">⚠️ Evitar</div>
                <div className="text-[--mike-fg] font-bold text-xs">{piorWR.dia} {piorWR.hora}h</div>
                <div className="text-rose-400 font-mono font-bold text-sm mt-0.5">{piorWR.wr}%</div>
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );
}

// ============================================================
// 10. DISTRIBUIÇÕES (histogramas)
// ============================================================
function Histograma({ data, titulo, cor = '#10b981', sufixo = '' }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map(d => d.qtd));

  return (
    <div>
      <h4 className="text-[11px] uppercase tracking-wider text-[--mike-fg-muted] font-bold mb-3">{titulo}</h4>
      <div className="flex items-end gap-1 h-32 mb-2">
        {data.map((d, i) => {
          const altura = max > 0 ? (d.qtd / max) * 100 : 0;
          return (
            <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1 group cursor-pointer">
              <span className="text-[8px] text-[--mike-fg-muted] font-mono opacity-0 group-hover:opacity-100 transition">{d.qtd}</span>
              <div
                className="w-full rounded-t transition hover:opacity-80"
                style={{
                  height: `${altura}%`,
                  background: `linear-gradient(180deg, ${cor}, ${cor}80)`,
                  minHeight: d.qtd > 0 ? '2px' : '0',
                }}
                title={`${d.bin}: ${d.qtd}`}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-1">
        {data.map((d, i) => (
          <div key={i} className="flex-1 text-[8px] text-center text-[--mike-fg-muted] font-mono truncate">
            {d.bin}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// 10.5. PREVIEW MINI DE JOGADOR (pra Comparador H2H)
// ============================================================
function PreviewMiniJogador({ nome, preview, loading, lado = 'A', onVerPerfil }) {
  if (!nome) return null;
  if (loading) {
    return (
      <div className="rounded p-2" style={{ backgroundColor: 'rgba(60,85,130,0.10)' }}>
        <div className="h-3 w-16 rounded animate-pulse mb-1.5" style={{ background: 'rgba(60,85,130,0.3)' }} />
        <div className="h-2 w-full rounded animate-pulse" style={{ background: 'rgba(60,85,130,0.2)' }} />
      </div>
    );
  }
  if (!preview) return null;

  const corLado = lado === 'A' ? '#10b981' : '#0891b2';

  return (
    <div className="rounded p-2 space-y-1.5" style={{
      backgroundColor: 'rgba(20, 26, 40, 0.4)',
      border: `0.5px solid ${corLado}40`,
    }}>
      {/* Linha: WR10 + sequência */}
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-baseline gap-1">
          <span className="text-[8px] uppercase tracking-wider text-[--mike-fg-muted] font-bold">WR10</span>
          <span className="text-[11px] font-mono font-bold" style={{ color: preview.wr10 >= 60 ? '#10b981' : preview.wr10 >= 50 ? '#fbbf24' : '#f43f5e' }}>
            {preview.wr10}%
          </span>
        </div>
        {preview.sequencia !== 0 && (
          <span className={`text-[10px] font-mono font-bold ${preview.sequencia > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {preview.sequencia > 0 ? '+' : ''}{preview.sequencia}
          </span>
        )}
      </div>

      {/* Últimos 5: W/L visual */}
      <div className="flex items-center gap-0.5">
        {preview.ultimos5.map((r, i) => (
          <div
            key={i}
            className="flex-1 h-1.5 rounded-sm"
            style={{ background: r === 'W' ? '#10b981' : '#f43f5e' }}
            title={r === 'W' ? 'Vitória' : 'Derrota'}
          />
        ))}
      </div>

      {/* Lucro 24h + partidas */}
      <div className="flex items-center justify-between text-[9px]">
        <span className="text-[--mike-fg-muted]">{preview.partidas} jogos</span>
        <span className={`font-mono font-bold ${preview.lucro24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
          {preview.lucro24h >= 0 ? '+' : ''}{preview.lucro24h}u 24h
        </span>
      </div>

      {/* Link ver perfil completo */}
      {onVerPerfil && (
        <button
          onClick={(e) => { e.stopPropagation(); onVerPerfil(nome); }}
          className="w-full text-[9px] font-bold flex items-center justify-center gap-1 pt-1 transition hover:underline"
          style={{ color: corLado, borderTop: `0.5px solid ${corLado}30` }}
        >
          Ver perfil completo
          <ChevronRight className="w-2.5 h-2.5" />
        </button>
      )}
    </div>
  );
}

// ============================================================
// 11. APP
// ============================================================
export default function App({ onNavegar: onNavegarExterno } = {}) {
  // Estado principal
  // Estados com persistência em localStorage (last esporte/tab visitada)
  const [esporteAtivo, setEsporteAtivo] = useState(() => {
    if (typeof window === 'undefined') return 'nba2k';
    try { return localStorage.getItem('tipmike:stats:esporte') || 'nba2k'; } catch { return 'nba2k'; }
  });
  const [tabAtiva, setTabAtiva] = useState(() => {
    if (typeof window === 'undefined') return 'proximos';
    try { return localStorage.getItem('tipmike:stats:tab') || 'proximos'; } catch { return 'proximos'; }
  });
  const [busca, setBusca] = useState('');
  const [ligaFiltro, setLigaFiltro] = useState('todas');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [ordenacao, setOrdenacao] = useState('horario'); // 'horario' | 'wr_desc' | 'wr_asc' | 'liga' | 'sequencia'
  const [telaAtiva, setTelaAtiva] = useState('stats');
  const [modalAcao, setModalAcao] = useState(null);

  // Comparador H2H
  const [jogadorA, setJogadorA] = useState('');
  const [jogadorB, setJogadorB] = useState('');

  // Reset filtros e seletor quando muda esporte + scroll pro topo + persiste
  useEffect(() => {
    setLigaFiltro('todas');
    setPage(1);
    setBusca('');
    setJogadorA('');
    setJogadorB('');
    // Persiste última escolha
    if (typeof window !== 'undefined') {
      try { localStorage.setItem('tipmike:stats:esporte', esporteAtivo); } catch {}
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [esporteAtivo]);

  // Persiste tab ativa
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try { localStorage.setItem('tipmike:stats:tab', tabAtiva); } catch {}
    }
  }, [tabAtiva]);

  // Reset paginação quando muda tab/filtros
  useEffect(() => {
    setPage(1);
  }, [tabAtiva, busca, ligaFiltro]);

  // Hooks de dados
  const { data: overview, loading: loadingOverview } = useStatsOverview(esporteAtivo);
  const { torneios } = useStatsTorneios(esporteAtivo);
  const { jogadores } = useStatsJogadores({ esporte: esporteAtivo });
  const { preview: previewA, loading: loadingPreviewA } = useStatsPreviewJogador(esporteAtivo, jogadorA);
  const { preview: previewB, loading: loadingPreviewB } = useStatsPreviewJogador(esporteAtivo, jogadorB);

  const filtrosLista = useMemo(() => ({
    esporte: esporteAtivo,
    busca,
    liga: ligaFiltro,
    page,
    pageSize,
  }), [esporteAtivo, busca, ligaFiltro, page]);

  const { jogos: proximos, total: totalProximos, loading: loadingProximos } = useStatsProximos(filtrosLista);
  const { jogos: ultimos, total: totalUltimos, loading: loadingUltimos } = useStatsUltimos(filtrosLista);
  const { data: heatmap, loading: loadingHeatmap } = useStatsHeatmap(esporteAtivo);
  const { data: distribuicoes, loading: loadingDist } = useStatsDistribuicoes(esporteAtivo);

  // Navegação
  const handleNavegar = (telaId, ctx) => {
    setTelaAtiva(telaId);
    if (onNavegarExterno) {
      onNavegarExterno(telaId, ctx);
    } else {
      setModalAcao({ tipo: 'navegar', destino: telaId });
    }
  };

  const handleAnalisar = (jogo) => {
    const contexto = {
      id: jogo.id,
      jogadorA: jogo.jogadorA,
      jogadorB: jogo.jogadorB,
      esporte: esporteAtivo,
      torneio: jogo.liga || (ligaFiltro !== 'todas' ? ligaFiltro : null),
    };
    if (onNavegarExterno) {
      onNavegarExterno('partida', contexto);
    } else {
      setModalAcao({ tipo: 'analisar', jogo, contexto });
    }
  };

  const handleAnalisarH2H = () => {
    if (!jogadorA) {
      setModalAcao({ tipo: 'erro', mensagem: 'Selecione pelo menos o Jogador 1' });
      return;
    }
    if (jogadorB && jogadorA === jogadorB) {
      setModalAcao({ tipo: 'erro', mensagem: 'Jogador 1 e Jogador 2 não podem ser iguais' });
      return;
    }
    const contexto = {
      jogadorA,
      jogadorB,
      esporte: esporteAtivo,
      torneio: ligaFiltro !== 'todas' ? ligaFiltro : null,
    };
    if (onNavegarExterno) {
      onNavegarExterno('partida', contexto);
    } else {
      setModalAcao({ tipo: 'analisar_h2h', ...contexto });
    }
  };

  // Dados do tab ativo
  const jogosBase = tabAtiva === 'proximos' ? proximos : ultimos;
  const totalAtivo = tabAtiva === 'proximos' ? totalProximos : totalUltimos;
  const loadingAtivo = tabAtiva === 'proximos' ? loadingProximos : loadingUltimos;
  const totalPaginas = Math.ceil(totalAtivo / pageSize);

  // Ordenação client-side
  const jogosAtivos = useMemo(() => {
    const lista = [...jogosBase];
    switch (ordenacao) {
      case 'wr_desc':
        return lista.sort((a, b) => (b.wrPrev || 0) - (a.wrPrev || 0));
      case 'wr_asc':
        return lista.sort((a, b) => (a.wrPrev || 0) - (b.wrPrev || 0));
      case 'liga':
        return lista.sort((a, b) => (a.liga || '').localeCompare(b.liga || ''));
      case 'sequencia':
        return lista.sort((a, b) => Math.abs(b.sequencia || 0) - Math.abs(a.sequencia || 0));
      case 'horario':
      default:
        return lista; // ordem original (horário)
    }
  }, [jogosBase, ordenacao]);

  const esporteAtual = ESPORTES.find(e => e.id === esporteAtivo) || ESPORTES[0];

  // Esc fecha modais
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape' && modalAcao) setModalAcao(null);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [modalAcao]);

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

  return (
    <div className="min-h-screen pb-12" style={{
      ...themeVars,
      backgroundColor: 'var(--mike-bg)',
      color: 'var(--mike-fg)',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <style>{`
        .mike-border-thin { border: 0.5px solid rgba(60, 85, 130, 0.4) !important; }
        .mike-border-thin:hover { border-color: rgba(80, 110, 170, 0.7) !important; }
        .mike-border-thin:focus { border-color: rgba(16, 185, 129, 0.7) !important; outline: none; }

        .mike-row-hover { transition: background-color 140ms ease; }

        @keyframes mike-modal-fade {
          from { opacity: 0; transform: translateY(8px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes mike-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes mike-loading-slide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(350%); }
        }
        .mike-spin { animation: mike-spin 0.8s linear infinite; }
      `}</style>

      <MikeHeader telaAtiva={telaAtiva} onNavegar={handleNavegar} />

      <main className="max-w-screen-xl mx-auto px-4 lg:px-8 py-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-[--mike-fg-muted] mb-4">
          <button onClick={() => handleNavegar('today')} className="hover:text-[--mike-fg]">
            <Home className="w-3 h-3" />
          </button>
          <ChevronRight className="w-3 h-3" />
          <span className="text-[--mike-fg] font-semibold flex items-center gap-1">
            <BarChart3 className="w-3 h-3" />
            Estatísticas
          </span>
          <ChevronRight className="w-3 h-3" />
          <span className="font-semibold" style={{ color: esporteAtual.cor }}>
            {esporteAtual.icon} {esporteAtual.label}
          </span>
        </div>

        {/* Header da tela com seletor de esporte */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-black text-[--mike-fg] flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-cyan-400" />
              Hub de Estatísticas
            </h1>
            <p className="text-[11px] text-[--mike-fg-muted] mt-0.5">
              Análise estatística por esporte. Encontre oportunidades antes de criar bot ou apostar.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-[--mike-fg-muted] font-bold">Esporte:</span>
            <MikeSelect
              value={esporteAtivo}
              onChange={setEsporteAtivo}
              options={ESPORTES.map(e => ({ value: e.id, label: e.label, icon: e.icon }))}
              width="w-56"
            />
          </div>
        </div>

        {/* Layout: sidebar esquerda + conteúdo direito */}
        <div className="flex flex-row gap-3 items-start" style={{ width: '100%' }}>

          {/* COLUNA ESQUERDA — Sidebar Comparador (largura fixa) */}
          <aside style={{ width: '220px', flexShrink: 0, position: 'sticky', top: '4rem', alignSelf: 'flex-start' }}>
            <div className="rounded-lg" style={{
              backgroundColor: 'rgba(20, 26, 40, 0.5)',
              border: '0.5px solid rgba(60, 85, 130, 0.4)',
            }}>
              {/* Header destacado */}
              <div className="flex items-center gap-2 px-3 py-2.5" style={{
                backgroundColor: 'rgba(40, 50, 75, 0.6)',
                borderBottom: '0.5px solid rgba(60, 85, 130, 0.4)',
                borderTopLeftRadius: '0.5rem',
                borderTopRightRadius: '0.5rem',
              }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-base flex-shrink-0" style={{
                  backgroundColor: 'rgba(20, 26, 40, 0.8)',
                  border: '0.5px solid rgba(60, 85, 130, 0.4)',
                }}>
                  {esporteAtual.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[9px] uppercase tracking-wider text-[--mike-fg-muted] font-bold leading-tight">Esportes</div>
                  <div className="text-sm font-bold text-[--mike-fg] truncate leading-tight">{esporteAtual.label}</div>
                </div>
              </div>

              {/* Corpo */}
              <div className="p-3 space-y-2.5">
                <div>
                  <label className="block text-[11px] text-[--mike-fg-soft] mb-1 font-medium">Torneios</label>
                  <MikeSelect
                    value={ligaFiltro}
                    onChange={setLigaFiltro}
                    placeholder="Selecione um torneio"
                    options={[
                      { value: 'todas', label: 'Todos os torneios' },
                      ...torneios.map(t => ({ value: t, label: t })),
                    ]}
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[--mike-fg-soft] mb-1 font-medium">Jogador 1</label>
                  <MikeSelect
                    value={jogadorA}
                    onChange={setJogadorA}
                    placeholder="Selecione um jogador"
                    options={[
                      { value: '', label: '— nenhum —' },
                      ...jogadores.map(j => ({ value: j.nome, label: j.nome, sublabel: j.time })),
                    ]}
                    searchable
                  />
                  {jogadorA && (
                    <div className="mt-1.5">
                      <PreviewMiniJogador
                        nome={jogadorA}
                        preview={previewA}
                        loading={loadingPreviewA}
                        lado="A"
                        onVerPerfil={(nome) => {
                          if (onNavegarExterno) onNavegarExterno('partida', { jogadorA: nome, esporte: ESPORTE_PARA_PARTIDA[esporteAtivo] || 'e-Basket' });
                          else setModalAcao({ tipo: 'analisar_h2h', jogadorA: nome });
                        }}
                      />
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-[11px] text-[--mike-fg-soft] mb-1 font-medium">Jogador 2</label>
                  <MikeSelect
                    value={jogadorB}
                    onChange={setJogadorB}
                    placeholder="Selecione um jogador"
                    options={[
                      { value: '', label: '— nenhum (modo solo) —' },
                      ...jogadores.filter(j => j.nome !== jogadorA).map(j => ({ value: j.nome, label: j.nome, sublabel: j.time })),
                    ]}
                    searchable
                  />
                  {jogadorB && (
                    <div className="mt-1.5">
                      <PreviewMiniJogador
                        nome={jogadorB}
                        preview={previewB}
                        loading={loadingPreviewB}
                        lado="B"
                        onVerPerfil={(nome) => {
                          if (onNavegarExterno) onNavegarExterno('partida', { jogadorA: nome, esporte: ESPORTE_PARA_PARTIDA[esporteAtivo] || 'e-Basket' });
                          else setModalAcao({ tipo: 'analisar_h2h', jogadorA: nome });
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Indicador de favorito quando ambos selecionados */}
                {jogadorA && jogadorB && previewA && previewB && (
                  <div className="rounded p-2 text-center" style={{
                    backgroundColor: 'rgba(251, 191, 36, 0.08)',
                    border: '0.5px solid rgba(251, 191, 36, 0.3)',
                  }}>
                    <div className="text-[8px] uppercase tracking-wider text-amber-400 font-bold mb-0.5">
                      💡 Insight rápido
                    </div>
                    <div className="text-[10px] text-[--mike-fg]">
                      {previewA.wr10 > previewB.wr10 ? (
                        <><strong className="text-emerald-400">{jogadorA}</strong> melhor forma (+{previewA.wr10 - previewB.wr10}% WR)</>
                      ) : previewB.wr10 > previewA.wr10 ? (
                        <><strong className="text-cyan-400">{jogadorB}</strong> melhor forma (+{previewB.wr10 - previewA.wr10}% WR)</>
                      ) : (
                        <span className="text-[--mike-fg-muted]">Forma equilibrada</span>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 mt-2">
                  <button
                    onClick={handleAnalisarH2H}
                    disabled={!jogadorA}
                    title={!jogadorA ? 'Selecione pelo menos o Jogador 1 pra analisar' : `Analisar ${jogadorA}${jogadorB ? ` × ${jogadorB}` : ' (modo solo)'}`}
                    className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-md text-sm font-bold transition disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                      backgroundColor: jogadorA ? '#10b981' : 'rgba(16,185,129,0.2)',
                      color: jogadorA ? '#0b0f1a' : '#6b7691',
                      boxShadow: jogadorA ? '0 4px 12px rgba(16,185,129,0.3)' : 'none',
                    }}
                  >
                    Analisar
                    <BarChart className="w-3.5 h-3.5" />
                  </button>

                  {(jogadorA || jogadorB) && (
                    <button
                      onClick={() => { setJogadorA(''); setJogadorB(''); }}
                      title="Limpar jogadores"
                      className="px-2.5 rounded-md mike-border-thin text-[--mike-fg-muted] hover:text-rose-400 transition"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </aside>

          {/* COLUNA DIREITA — todo o conteúdo */}
          <div className="space-y-5 relative" style={{ flex: 1, minWidth: 0 }}>

            {/* Loading bar global (aparece quando algum hook tá carregando) */}
            {(loadingOverview || loadingProximos || loadingUltimos || loadingHeatmap || loadingDist) && (
              <div className="absolute top-0 left-0 right-0 h-0.5 overflow-hidden rounded-full" style={{ background: 'rgba(60,85,130,0.2)', zIndex: 5 }}>
                <div className="h-full bg-gradient-to-r from-transparent via-cyan-400 to-transparent" style={{
                  animation: 'mike-loading-slide 1.2s ease-in-out infinite',
                  width: '40%',
                }} />
              </div>
            )}

            {/* Stats bar compacta */}
            <div className="rounded-lg p-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5" style={{
              backgroundColor: 'rgba(20, 26, 40, 0.4)',
              border: '0.5px solid rgba(60, 85, 130, 0.4)',
            }}>
              {loadingOverview ? (
                <div className="h-4 w-full rounded animate-pulse" style={{ background: 'rgba(60,85,130,0.2)' }} />
              ) : overview?.kpis && (
                <>
                  <div className="flex items-center gap-1.5">
                    <Hash className="w-3 h-3 text-cyan-400" />
                    <span className="text-[10px] text-[--mike-fg-muted]">Hoje:</span>
                    <span className="text-xs font-bold text-cyan-400 font-mono">{overview.kpis.jogosHoje}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Percent className="w-3 h-3 text-amber-400" />
                    <span className="text-[10px] text-[--mike-fg-muted]">WR médio:</span>
                    <span className="text-xs font-bold text-amber-400 font-mono">{overview.kpis.wrMedio}%</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <DollarSign className="w-3 h-3 text-emerald-400" />
                    <span className="text-[10px] text-[--mike-fg-muted]">Lucro 24h:</span>
                    <span className="text-xs font-bold text-emerald-400 font-mono">+{overview.kpis.lucro24h.toFixed(0)}u</span>
                  </div>
                  <div className="flex items-center gap-1.5 ml-auto">
                    <Flame className="w-3 h-3 text-rose-400" />
                    <span className="text-[10px] text-[--mike-fg-muted]">Hot:</span>
                    <span className="text-xs font-bold text-rose-400">{overview.kpis.jogadorHot}</span>
                    <span className="text-[10px] text-[--mike-fg-muted] mx-1">·</span>
                    <Trophy className="w-3 h-3 text-purple-400" />
                    <span className="text-xs font-bold text-purple-400 truncate" style={{ maxWidth: '120px' }}>{overview.kpis.ligaQuente}</span>
                  </div>
                </>
              )}
            </div>

            {/* Próximos jogos por liga */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-4 rounded-full bg-cyan-500" />
                <h2 className="text-sm font-bold text-[--mike-fg]">Próximos jogos por liga</h2>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {loadingOverview ? (
                  <>
                    <div className="rounded-lg p-3 h-28 animate-pulse" style={{ background: 'rgba(20,26,40,0.4)', border: '0.5px solid rgba(60,85,130,0.2)' }} />
                    <div className="rounded-lg p-3 h-28 animate-pulse" style={{ background: 'rgba(20,26,40,0.4)', border: '0.5px solid rgba(60,85,130,0.2)' }} />
                    <div className="rounded-lg p-3 h-28 animate-pulse" style={{ background: 'rgba(20,26,40,0.4)', border: '0.5px solid rgba(60,85,130,0.2)' }} />
                  </>
                ) : overview?.ligas?.map(jogo => (
                  <CardProximoLiga key={jogo.id} jogo={jogo} onAnalisar={() => handleAnalisar(jogo)} />
                ))}
              </div>
            </section>

            {/* Tabs + lista */}
            <section>
              {/* Tabs */}
              <div className="flex items-center gap-1 mb-3 flex-wrap" style={{ borderBottom: '0.5px solid rgba(60,85,130,0.4)' }}>
                {[
                  { id: 'proximos', label: 'Próximos', icon: Calendar, count: totalProximos },
                  { id: 'ultimos', label: 'Últimos', icon: Clock, count: totalUltimos },
                  { id: 'heatmap', label: 'Heatmap', icon: BarChart },
                  { id: 'distribuicoes', label: 'Distribuições', icon: BarChart3 },
                ].map(tab => {
                  const Icon = tab.icon;
                  const ativa = tabAtiva === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setTabAtiva(tab.id)}
                      className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition relative whitespace-nowrap ${ativa ? 'text-[--mike-accent] bg-[--mike-accent]/[0.06]' : 'text-[--mike-fg-muted] hover:text-[--mike-fg] hover:bg-[--mike-card-2]/30'}`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {tab.label}
                      {tab.count !== undefined && (
                        <span className="text-[9px] px-1.5 py-0 rounded-full font-mono" style={{
                          background: ativa ? 'rgba(16,185,129,0.15)' : 'rgba(60,85,130,0.2)',
                          color: ativa ? '#10b981' : '#6b7691',
                        }}>
                          {tab.count}
                        </span>
                      )}
                      {tab.hint && (
                        <span className="text-[8px] font-mono uppercase tracking-wider" style={{ color: ativa ? '#10b981' : '#6b7691', opacity: 0.7 }}>
                          {tab.hint}
                        </span>
                      )}
                      {ativa && <div className="absolute -bottom-[0.5px] left-0 right-0 h-0.5 bg-[--mike-accent]" />}
                    </button>
                  );
                })}
              </div>

              {/* Filtros (só pra próximos/últimos) */}
              {(tabAtiva === 'proximos' || tabAtiva === 'ultimos') && (
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  {/* Busca */}
                  <div className="mike-border-thin flex-1 min-w-[180px] flex items-center gap-2 px-3 py-1.5 rounded-md bg-transparent">
                    <Search className="w-3.5 h-3.5 text-[--mike-fg-muted]" />
                    <input
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      placeholder="Buscar jogador, time..."
                      className="flex-1 bg-transparent text-xs text-[--mike-fg] outline-none placeholder:text-[--mike-fg-muted]"
                    />
                    {busca && (
                      <button onClick={() => setBusca('')} className="text-[--mike-fg-muted] hover:text-[--mike-fg]" title="Limpar busca">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Chip de torneio ativo (vem da sidebar) */}
                  {ligaFiltro !== 'todas' && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[10px] font-bold" style={{
                      backgroundColor: 'rgba(16, 185, 129, 0.12)',
                      border: '0.5px solid rgba(16, 185, 129, 0.4)',
                      color: '#10b981',
                    }}>
                      <Trophy className="w-3 h-3" />
                      <span>Torneio: {ligaFiltro}</span>
                      <button
                        onClick={() => setLigaFiltro('todas')}
                        className="ml-1 hover:text-rose-400 transition"
                        title="Remover filtro de torneio"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  {/* Limpar tudo (só aparece se algo ativo) */}
                  {(busca || ligaFiltro !== 'todas') && (
                    <button
                      onClick={() => { setBusca(''); setLigaFiltro('todas'); setPage(1); }}
                      className="px-2.5 py-1.5 rounded-md text-[10px] font-bold text-rose-400 hover:bg-rose-500/10 transition mike-border-thin"
                      style={{ borderColor: 'rgba(244,63,94,0.3)' }}
                      title="Remover todos os filtros"
                    >
                      Limpar filtros
                    </button>
                  )}

                  {/* Ordenação */}
                  <div className="flex items-center gap-1 ml-auto">
                    <ArrowUpDown className="w-3 h-3 text-[--mike-fg-muted]" />
                    <select
                      value={ordenacao}
                      onChange={(e) => setOrdenacao(e.target.value)}
                      className="bg-transparent text-[10px] font-mono text-[--mike-fg-soft] outline-none cursor-pointer mike-border-thin px-1 py-0.5 rounded"
                      style={{ appearance: 'none', WebkitAppearance: 'none' }}
                    >
                      <option value="horario" style={{ background: '#141a28' }}>Horário</option>
                      <option value="wr_desc" style={{ background: '#141a28' }}>WR ↓</option>
                      <option value="wr_asc" style={{ background: '#141a28' }}>WR ↑</option>
                      <option value="liga" style={{ background: '#141a28' }}>Liga A-Z</option>
                      <option value="sequencia" style={{ background: '#141a28' }}>Sequência</option>
                    </select>
                  </div>

                  {/* Page size */}
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] text-[--mike-fg-muted] uppercase tracking-wider font-bold">por pág:</span>
                    {[10, 20, 50].map(n => (
                      <button
                        key={n}
                        onClick={() => { setPageSize(n); setPage(1); }}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition ${
                          pageSize === n
                            ? 'bg-[--mike-accent]/15 text-[--mike-accent]'
                            : 'text-[--mike-fg-muted] hover:text-[--mike-fg]'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Conteúdo do tab */}
              <div className="rounded-lg p-3" style={{
                backgroundColor: 'rgba(20, 26, 40, 0.3)',
                border: '0.5px solid rgba(60, 85, 130, 0.4)',
                minHeight: '200px',
              }}>
                {(tabAtiva === 'proximos' || tabAtiva === 'ultimos') && (
                  <>
                    {loadingAtivo ? (
                      <div className="flex items-center justify-center py-16 gap-2 text-[--mike-fg-muted] text-xs">
                        <RefreshCw className="w-4 h-4 mike-spin" />
                        Carregando...
                      </div>
                    ) : jogosAtivos.length === 0 ? (
                      <div className="text-center py-16">
                        <div className="text-[--mike-fg-muted] text-xs mb-2">Nenhum jogo encontrado</div>
                        {(busca || ligaFiltro !== 'todas') && (
                          <button
                            onClick={() => { setBusca(''); setLigaFiltro('todas'); }}
                            className="text-[10px] text-[--mike-accent] hover:underline"
                          >
                            Limpar filtros
                          </button>
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="space-y-0">
                          {jogosAtivos.map(jogo =>
                            tabAtiva === 'proximos' ? (
                              <LinhaProximoJogo key={jogo.id} jogo={jogo} busca={busca} onAnalisar={() => handleAnalisar(jogo)} />
                            ) : (
                              <LinhaUltimoJogo key={jogo.id} jogo={jogo} busca={busca} onAnalisar={() => handleAnalisar(jogo)} />
                            )
                          )}
                        </div>

                        {totalPaginas > 1 && (
                          <div className="flex items-center justify-between mt-4 pt-3 px-2" style={{ borderTop: '0.5px solid rgba(60,85,130,0.2)' }}>
                            <span className="text-[10px] text-[--mike-fg-muted] font-mono">
                              {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalAtivo)} de {totalAtivo}
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => setPage(Math.max(1, page - 1))}
                                disabled={page === 1}
                                className="p-1.5 rounded mike-border-thin hover:bg-[--mike-card-hover] disabled:opacity-30 disabled:cursor-not-allowed transition"
                              >
                                <ChevronLeft className="w-3 h-3" />
                              </button>
                              <span className="px-2 text-[10px] text-[--mike-fg-muted] font-mono">{page}/{totalPaginas}</span>
                              <button
                                onClick={() => setPage(Math.min(totalPaginas, page + 1))}
                                disabled={page === totalPaginas}
                                className="p-1.5 rounded mike-border-thin hover:bg-[--mike-card-hover] disabled:opacity-30 disabled:cursor-not-allowed transition"
                              >
                                <ChevronRight className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}

                {tabAtiva === 'heatmap' && (
                  <>
                    <div className="mb-3">
                      <h3 className="text-sm font-bold text-[--mike-fg] mb-1">Performance por dia × hora</h3>
                      <p className="text-[10px] text-[--mike-fg-muted]">
                        Quando bots performam melhor em {esporteAtual.label}. Use pra programar agendamento.
                      </p>
                    </div>
                    {loadingHeatmap ? (
                      <div className="flex items-center justify-center py-16 gap-2 text-[--mike-fg-muted] text-xs">
                        <RefreshCw className="w-4 h-4 mike-spin" />
                        Carregando heatmap...
                      </div>
                    ) : (
                      <Heatmap
                        matriz={heatmap?.matriz}
                        onCriarBot={(ctx) => {
                          if (onNavegarExterno) {
                            onNavegarExterno('criar_bot', { esporte: esporteAtivo, agendamento: ctx });
                          } else {
                            setModalAcao({ tipo: 'criar_bot_horario', ...ctx });
                          }
                        }}
                      />
                    )}
                  </>
                )}

                {tabAtiva === 'distribuicoes' && (
                  <>
                    <div className="mb-4">
                      <h3 className="text-sm font-bold text-[--mike-fg] mb-1">Distribuições estatísticas</h3>
                      <p className="text-[10px] text-[--mike-fg-muted]">
                        Frequência de Win Rate e ROI dos bots ativos em {esporteAtual.label}.
                      </p>
                    </div>
                    {loadingDist ? (
                      <div className="flex items-center justify-center py-16 gap-2 text-[--mike-fg-muted] text-xs">
                        <RefreshCw className="w-4 h-4 mike-spin" />
                        Carregando...
                      </div>
                    ) : (
                      <div className="space-y-6 pt-2">
                        <Histograma data={distribuicoes?.wr} titulo="Distribuição de Win Rate" cor="#fbbf24" />
                        <Histograma data={distribuicoes?.roi} titulo="Distribuição de ROI" cor="#10b981" />
                      </div>
                    )}
                  </>
                )}
              </div>
            </section>

          </div>
          {/* fim coluna direita */}

        </div>
        {/* fim grid sidebar+conteúdo */}

      </main>

      {/* MODAL ACAO (mock pra demo standalone) */}
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
                  {modalAcao.tipo === 'analisar' && 'Análise individual'}
                  {modalAcao.tipo === 'analisar_h2h' && 'Análise H2H'}
                  {modalAcao.tipo === 'erro' && 'Atenção'}
                </div>
                <div className="text-base font-bold text-[--mike-fg] truncate">
                  {modalAcao.tipo === 'navegar' && `Ir para: ${modalAcao.destino}`}
                  {modalAcao.tipo === 'analisar' && `${modalAcao.jogo?.jogadorA} × ${modalAcao.jogo?.jogadorB}`}
                  {modalAcao.tipo === 'analisar_h2h' && `${modalAcao.jogadorA}${modalAcao.jogadorB ? ` × ${modalAcao.jogadorB}` : ' (solo)'}`}
                  {modalAcao.tipo === 'erro' && modalAcao.mensagem}
                </div>
              </div>
              <button onClick={() => setModalAcao(null)} className="p-1 rounded hover:bg-[--mike-card-hover] text-[--mike-fg-muted] hover:text-[--mike-fg] transition">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[--mike-fg-muted] leading-relaxed">
              {modalAcao.tipo === 'navegar' && 'Em produção, navegaria pra tela correspondente.'}
              {(modalAcao.tipo === 'analisar' || modalAcao.tipo === 'analisar_h2h') && 'Em produção, abriria a tela "Partida Individual" com análise completa: matchup summary, OU/HC, distribuições, histórico H2H, etc.'}
              {modalAcao.tipo === 'erro' && 'Verifique e tente novamente.'}
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
