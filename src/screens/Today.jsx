import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Search, Bell, Settings, ChevronDown, Home, Activity, Store, Bot, Table2, BarChart3, Plus,
  Clock, ExternalLink, X, FilterX, RefreshCw, Radio
} from 'lucide-react';
import MikeHeader from '../shared/MikeHeader.jsx';

// ============================================================
// API CLIENT + HOOKS (plug-and-play)
//
// Single-file: arquitetura embutida pra rodar em artifact.
// Em produção, separar em lib/data/hooks/screens.
//
// 🔌 BACKEND: ver lib/BACKEND.md no projeto principal.
//   GET /partidas/hoje?esporte=&busca=
//   GET /partidas/top-jogadores?esporte=&busca=
//   GET /partidas/por-data?busca=
// ============================================================

const USE_MOCK = true;
const MOCK_LATENCY = { min: 60, max: 200 };

function simularLatencia() {
  const ms = MOCK_LATENCY.min + Math.random() * (MOCK_LATENCY.max - MOCK_LATENCY.min);
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizaBusca(s) {
  return (s || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// ============================================================
// MAPA DE TEAM_ID -> usado pra montar URL de logo
// Extraido direto do TipManager (89 times)
// Logos servidas por: https://media.api-sports.io/football/teams/{id}.png
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
  'Sevilla': 536, 'Ajax': 194, 'Cira': null, 'Aston Villa': 66, 'Fenerbahce': 645,
  'RB Salzburg': 571,
};

const LOGO_URL = (nome) => {
  const id = TEAM_IDS[nome];
  if (id) return `https://media.api-sports.io/football/teams/${id}.png`;
  return null;
};

// Componente de logo com fallback (inicial em circulo)
function TeamLogo({ nome, size = 28 }) {
  const url = LOGO_URL(nome);
  const [erro, setErro] = useState(false);

  if (!url || erro) {
    // Fallback: circulo com inicial
    const inicial = (nome || '?').charAt(0).toUpperCase();
    const cores = ['from-blue-500 to-blue-700', 'from-red-500 to-red-700',
                   'from-emerald-500 to-emerald-700', 'from-amber-500 to-amber-700',
                   'from-purple-500 to-purple-700', 'from-rose-500 to-rose-700'];
    const corIdx = (nome || '').charCodeAt(0) % cores.length;
    return (
      <div
        className={`rounded-full bg-gradient-to-br ${cores[corIdx]} flex items-center justify-center font-black text-white text-xs flex-shrink-0`}
        style={{ width: size, height: size, fontSize: size * 0.45 }}
      >
        {inicial}
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={nome}
      onError={() => setErro(true)}
      className="object-contain flex-shrink-0"
      style={{ width: size, height: size }}
    />
  );
}

// ============================================================
// MOCK DATA
// ============================================================
const MOCK_ANTERIORES = [
  { id: 1, esporte: 'e-Soccer', liga: 'ECF (Volta)', data: '02/05/2026', hora: '15:44',
    jogadorA: 'Andrew (ECF Volta)', timeA: 'RB Leipzig', placarA: 2,
    jogadorB: 'Yerema (ECF Volta)', timeB: 'Bayern munchen', placarB: 1 },
  { id: 2, esporte: 'e-Soccer', liga: 'ECF (Volta)', data: '02/05/2026', hora: '15:44',
    jogadorA: 'Fantazer (ECF Volta)', timeA: 'Eint. Frankfurt', placarA: 1,
    jogadorB: 'Gula14 (ECF Volta)', timeB: 'Bayer Leverkusen', placarB: 1 },
  { id: 3, esporte: 'e-Soccer', liga: 'Battle', data: '02/05/2026', hora: '15:43',
    jogadorA: 'Klvu17', timeA: 'Chelsea', placarA: 3,
    jogadorB: 'Cofi111', timeB: 'Man. City', placarB: 3 },
  { id: 4, esporte: 'e-Soccer', liga: 'Battle', data: '02/05/2026', hora: '15:42',
    jogadorA: 'Hristian05', timeA: 'Roma', placarA: 4,
    jogadorB: 'Duka', timeB: 'Porto', placarB: 2 },
  { id: 5, esporte: 'e-Soccer', liga: 'Battle', data: '02/05/2026', hora: '15:40',
    jogadorA: 'Maggett0', timeA: 'Fenerbahce', placarA: 1,
    jogadorB: 'Ganger_29', timeB: 'Aston Villa', placarB: 0 },
  { id: 6, esporte: 'e-Soccer', liga: 'Battle', data: '02/05/2026', hora: '15:38',
    jogadorA: 'Sena', timeA: 'Inter', placarA: 2,
    jogadorB: 'Cira', timeB: 'Tottenham', placarB: 3 },
  { id: 7, esporte: 'e-Basket', liga: 'Battle (NBA2K)', data: '02/05/2026', hora: '15:35',
    jogadorA: 'Pakapaka', timeA: 'Liverpool', placarA: 87,
    jogadorB: 'Dzojo', timeB: 'Chelsea', placarB: 92 },
  { id: 8, esporte: 'Table Tennis', liga: 'Setka Cup (Ucrânia)', data: '02/05/2026', hora: '15:33',
    jogadorA: 'Eduard P.', timeA: '', placarA: 3,
    jogadorB: 'Dmytro P.', timeB: '', placarB: 1 },
  { id: 9, esporte: 'e-Soccer', liga: 'ECF (Volta)', data: '02/05/2026', hora: '15:30',
    jogadorA: 'Koss', timeA: 'Bor. Dortmund', placarA: 2,
    jogadorB: 'Yerema', timeB: 'Bayern munchen', placarB: 2 },
  { id: 10, esporte: 'e-Soccer', liga: 'Battle', data: '02/05/2026', hora: '15:28',
    jogadorA: 'Llulle', timeA: 'Liverpool', placarA: 3,
    jogadorB: 'Klvu17', timeB: 'Chelsea', placarB: 1 },
  { id: 11, esporte: 'e-Soccer', liga: 'Adriatic League', data: '02/05/2026', hora: '15:25',
    jogadorA: 'Snow', timeA: 'Real Madrid', placarA: 4,
    jogadorB: 'Alexis', timeB: 'Barcelona', placarB: 2 },
  { id: 12, esporte: 'e-Soccer', liga: 'Battle 2x6', data: '02/05/2026', hora: '15:22',
    jogadorA: 'Cevu', timeA: 'Juventus', placarA: 5,
    jogadorB: 'Malverz', timeB: 'Man. City', placarB: 3 },
  { id: 13, esporte: 'e-Hockey', liga: 'NHL Live', data: '02/05/2026', hora: '15:20',
    jogadorA: 'IceMaster', timeA: 'Boston', placarA: 4,
    jogadorB: 'Frostbite', timeB: 'Toronto', placarB: 2 },
  { id: 14, esporte: 'e-NFL', liga: 'Madden Cup', data: '02/05/2026', hora: '15:15',
    jogadorA: 'GridIron', timeA: 'Patriots', placarA: 28,
    jogadorB: 'TouchDown', timeB: 'Chiefs', placarB: 21 },
  { id: 15, esporte: 'Futebol', liga: 'SERIE A', data: '02/05/2026', hora: '14:00',
    jogadorA: 'Atalanta', timeA: '', placarA: 2,
    jogadorB: 'Genoa', timeB: '', placarB: 0 },
  { id: 16, esporte: 'Tênis', liga: 'ATP Roma', data: '02/05/2026', hora: '13:30',
    jogadorA: 'Alcaraz', timeA: '', placarA: 2,
    jogadorB: 'Sinner', timeB: '', placarB: 1 },
];

const MOCK_PROXIMAS = [
  { id: 20, esporte: 'Table Tennis', liga: 'Setka Cup (Ucrânia)', data: '02/05/2026', hora: '15:50',
    jogadorA: 'Eduard Populovskyi', timeA: '', jogadorB: 'Dmytro Patalakha', timeB: '', aoVivo: true },
  { id: 21, esporte: 'e-Soccer', liga: 'Battle', data: '02/05/2026', hora: '15:52',
    jogadorA: 'Ganger_29', timeA: 'Aston Villa', jogadorB: 'Hristian05', timeB: 'Roma', aoVivo: true },
  { id: 22, esporte: 'e-Soccer', liga: 'Battle', data: '02/05/2026', hora: '15:52',
    jogadorA: 'Duka', timeA: 'Porto', jogadorB: 'Maggett0', timeB: 'Fenerbahce', aoVivo: true },
  { id: 23, esporte: 'e-Soccer', liga: 'ECF (Volta)', data: '02/05/2026', hora: '15:53',
    jogadorA: 'Yerema (ECF Volta)', timeA: 'Bayern munchen', jogadorB: 'Fantazer (ECF Volta)', timeB: 'Eint. Frankfurt' },
  { id: 24, esporte: 'e-Soccer', liga: 'Battle', data: '02/05/2026', hora: '15:55',
    jogadorA: 'Kavviro', timeA: 'Germany', jogadorB: 'Snow', timeB: 'Argentina' },
  { id: 25, esporte: 'e-Soccer', liga: 'Battle', data: '02/05/2026', hora: '15:55',
    jogadorA: 'Nekishka', timeA: 'England', jogadorB: 'Tohi4', timeB: 'France' },
  { id: 26, esporte: 'e-Basket', liga: 'Battle (NBA2K)', data: '02/05/2026', hora: '15:55',
    jogadorA: 'Kotkata', timeA: 'Real Madrid', jogadorB: 'Margotostek', timeB: 'Hapoel tel aviv' },
  { id: 27, esporte: 'e-Soccer', liga: 'Battle', data: '02/05/2026', hora: '15:56',
    jogadorA: 'Llulle', timeA: 'Liverpool', jogadorB: 'Klvu17', timeB: 'Chelsea' },
  { id: 28, esporte: 'e-Soccer', liga: 'H2H GG League', data: '02/05/2026', hora: '15:58',
    jogadorA: 'Inferno', timeA: 'Real Madrid', jogadorB: 'Bolt', timeB: 'PSG' },
  { id: 29, esporte: 'e-Basket', liga: 'H2H GG League', data: '02/05/2026', hora: '16:00',
    jogadorA: 'Pacificr', timeA: 'BOS Celtics', jogadorB: 'Outlaw', timeB: 'GS Warriors' },
  { id: 30, esporte: 'e-Soccer', liga: 'Adriatic League', data: '02/05/2026', hora: '16:02',
    jogadorA: 'Spiderman', timeA: 'Real Madrid', jogadorB: 'Odin', timeB: 'Barcelona' },
  { id: 31, esporte: 'e-Soccer', liga: 'Battle', data: '02/05/2026', hora: '16:05',
    jogadorA: 'Sena', timeA: 'Arsenal', jogadorB: 'Cofi111', timeB: 'Man. City' },
  { id: 32, esporte: 'e-Hockey', liga: 'NHL Live', data: '02/05/2026', hora: '16:10',
    jogadorA: 'Blizzard', timeA: 'Rangers', jogadorB: 'Glacier', timeB: 'Penguins' },
  { id: 33, esporte: 'e-NFL', liga: 'Madden Cup', data: '02/05/2026', hora: '16:15',
    jogadorA: 'Quarterback', timeA: 'Cowboys', jogadorB: 'Linebacker', timeB: 'Eagles' },
  { id: 34, esporte: 'Futebol', liga: 'LA LIGA', data: '02/05/2026', hora: '16:00',
    jogadorA: 'Barcelona', timeA: '', jogadorB: 'Real Madrid', timeB: '' },
  { id: 35, esporte: 'Tênis', liga: 'ATP Roma', data: '02/05/2026', hora: '16:30',
    jogadorA: 'Djokovic', timeA: '', jogadorB: 'Medvedev', timeB: '' },
  { id: 36, esporte: 'CS2', liga: 'BLAST Premier', data: '02/05/2026', hora: '17:00',
    jogadorA: 'NAVI', timeA: '', jogadorB: 'FaZe', timeB: '' },
];

// Cores de pill por esporte
const ESPORTE_CORES = {
  'e-Soccer':      { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30',
                     activeBg: 'bg-emerald-500',  activeText: 'text-white', activeBorder: 'border-emerald-500',  activeShadow: 'shadow-emerald-500/40' },
  'e-Basket':      { bg: 'bg-orange-500/15',  text: 'text-orange-400',  border: 'border-orange-500/30',
                     activeBg: 'bg-orange-500',   activeText: 'text-white', activeBorder: 'border-orange-500',   activeShadow: 'shadow-orange-500/40' },
  'Table Tennis':  { bg: 'bg-amber-500/15',   text: 'text-amber-400',   border: 'border-amber-500/30',
                     activeBg: 'bg-amber-500',    activeText: 'text-white', activeBorder: 'border-amber-500',    activeShadow: 'shadow-amber-500/40' },
  'e-Hockey':      { bg: 'bg-cyan-500/15',    text: 'text-cyan-400',    border: 'border-cyan-500/30',
                     activeBg: 'bg-cyan-500',     activeText: 'text-white', activeBorder: 'border-cyan-500',     activeShadow: 'shadow-cyan-500/40' },
  'e-NFL':         { bg: 'bg-purple-500/15',  text: 'text-purple-400',  border: 'border-purple-500/30',
                     activeBg: 'bg-purple-500',   activeText: 'text-white', activeBorder: 'border-purple-500',   activeShadow: 'shadow-purple-500/40' },
  'Tênis':         { bg: 'bg-yellow-500/15',  text: 'text-yellow-400',  border: 'border-yellow-500/30',
                     activeBg: 'bg-yellow-500',   activeText: 'text-slate-900', activeBorder: 'border-yellow-500', activeShadow: 'shadow-yellow-500/40' },
  'CS2':           { bg: 'bg-rose-500/15',    text: 'text-rose-400',    border: 'border-rose-500/30',
                     activeBg: 'bg-rose-500',     activeText: 'text-white', activeBorder: 'border-rose-500',     activeShadow: 'shadow-rose-500/40' },
  'Futebol':       { bg: 'bg-blue-500/15',    text: 'text-blue-400',    border: 'border-blue-500/30',
                     activeBg: 'bg-blue-500',     activeText: 'text-white', activeBorder: 'border-blue-500',     activeShadow: 'shadow-blue-500/40' },
};

const MOCK_POR_DATA = [
  {
    data: '02/05/2026',
    jogos: [
      { home: 'Atalanta',         away: 'Genoa',          hora: '02/05 15:45', liga: 'SERIE A',     md: 'MD 35' },
      { home: 'Osasuna',          away: 'Barcelona',      hora: '02/05 16:00', liga: 'LA LIGA',     md: 'MD 34' },
      { home: 'Botafogo',         away: 'Remo',           hora: '02/05 16:00', liga: 'SERIE A',     md: 'MD 14' },
      { home: 'NEC Nijmegen',     away: 'Telstar',        hora: '02/05 16:00', liga: 'EREDIVISIE',  md: 'MD 32' },
      { home: 'Nice',             away: 'Lens',           hora: '02/05 16:05', liga: 'LIGUE 1',     md: 'MD 32' },
      { home: 'FC Porto',         away: 'Alverca',        hora: '02/05 16:30', liga: 'PRIMEIRA LIGA', md: 'MD 32' },
      { home: 'Palmeiras',        away: 'Santos',         hora: '02/05 18:30', liga: 'SERIE A',     md: 'MD 14' },
      { home: 'Fluminense',       away: 'Coritiba',       hora: '02/05 18:30', liga: 'SERIE A',     md: 'MD 14' },
      { home: 'RB Bragantino',    away: 'Gremio',         hora: '02/05 20:30', liga: 'SERIE A',     md: 'MD 14' },
      { home: 'Cruzeiro',         away: 'Atletico-MG',    hora: '02/05 21:00', liga: 'SERIE A',     md: 'MD 14' },
    ]
  },
  {
    data: '03/05/2026',
    jogos: [
      { home: 'Heerenveen',       away: 'Twente',         hora: '03/05 07:15', liga: 'EREDIVISIE',  md: 'MD 32' },
      { home: 'Bologna',          away: 'Cagliari',       hora: '03/05 07:30', liga: 'SERIE A',     md: 'MD 35' },
      { home: 'Celta Vigo',       away: 'Elche',          hora: '03/05 09:00', liga: 'LA LIGA',     md: 'MD 34' },
      { home: 'Waalwijk',         away: 'Feyenoord',      hora: '03/05 09:30', liga: 'EREDIVISIE',  md: 'MD 32' },
      { home: 'Heracles',         away: 'Almere City FC', hora: '03/05 09:30', liga: 'EREDIVISIE',  md: 'MD 32' },
      { home: 'Crystal Palace',   away: 'Wolves',         hora: '03/05 11:00', liga: 'PREMIER LEAGUE', md: 'MD 35' },
      { home: 'Lazio',            away: 'Parma',          hora: '03/05 11:00', liga: 'SERIE A',     md: 'MD 35' },
      { home: 'Ajax',             away: 'Heerenveen',     hora: '03/05 12:30', liga: 'EREDIVISIE',  md: 'MD 32' },
      { home: 'Atletico Madrid',  away: 'Real Madrid',    hora: '03/05 13:30', liga: 'LA LIGA',     md: 'MD 34' },
      { home: 'Inter',            away: 'AC Milan',       hora: '03/05 15:45', liga: 'SERIE A',     md: 'MD 35' },
      { home: 'Liverpool',        away: 'Tottenham',      hora: '03/05 16:00', liga: 'PREMIER LEAGUE', md: 'MD 35' },
      { home: 'Marseille',        away: 'Strasbourg',     hora: '03/05 16:00', liga: 'LIGUE 1',     md: 'MD 32' },
    ]
  },
  {
    data: '04/05/2026',
    jogos: [
      { home: 'Cremonese', away: 'Lazio',           hora: '04/05 09:30', liga: 'SERIE A',         md: 'MD 35' },
      { home: 'AS Roma',  away: 'Fiorentina',       hora: '04/05 09:45', liga: 'SERIE A',         md: 'MD 35' },
      { home: 'Sevilla',  away: 'Real Sociedad',    hora: '04/05 10:00', liga: 'LA LIGA',         md: 'MD 34' },
      { home: 'Chelsea',  away: 'Nottingham Forest', hora: '04/05 11:00', liga: 'PREMIER LEAGUE', md: 'MD 35' },
    ]
  },
];

const MOCK_TOP_JOGADORES = [
  { nome: 'Spiderman', esporte: 'e-Soccer',     liga: 'Adriatic League', wr: 100 },
  { nome: 'Peconi',    esporte: 'e-Soccer',     liga: 'Battle',          wr: 89  },
  { nome: 'Pacificr',  esporte: 'e-Basket',     liga: 'H2H GG League',   wr: 100 },
  { nome: 'Outlaw',    esporte: 'e-Basket',     liga: 'H2H GG League',   wr: 100 },
  { nome: 'IceMaster', esporte: 'e-Hockey',     liga: 'NHL Live',        wr: 92  },
  { nome: 'GridIron',  esporte: 'e-NFL',        liga: 'Madden Cup',      wr: 87  },
  { nome: 'Eduard P.', esporte: 'Table Tennis', liga: 'Setka Cup',       wr: 76  },
];

const ESPORTES_FILTROS = [
  { id: 'e-Soccer', label: 'e-Soccer' },
  { id: 'e-Basket', label: 'e-Basket' },
  { id: 'e-Hockey', label: 'e-Hockey' },
  { id: 'Table Tennis', label: 'Tênis de Mesa' },
  { id: 'CS2', label: 'Counter-Strike 2' },
  { id: 'Tênis', label: 'Tênis' },
  { id: 'e-NFL', label: 'e-NFL' },
  { id: 'Futebol', label: 'Futebol' },
];


const PRINCIPAIS_LIGAS = [
  'ECF (Volta)', 'TT Cup (Ucrânia)', 'Battle', 'Adriatic League', 'GT League',
  'Liga Pro (Esp. Tcheca)', 'H2H GG League', 'Live Arena', 'Setka Cup (Ucrânia)', 'Battle (NBA2K)'
];

// ============================================================
// MOCK RESPONSES + API + HOOKS
// ============================================================

const mockResponses = {
  // 🔌 BACKEND: GET /partidas/hoje?esporte=&busca=
  '/partidas/hoje': (params) => {
    const { esporte, busca } = params;

    const filtraPartidas = (lista) => {
      let res = [...lista];
      if (esporte) res = res.filter(p => p.esporte === esporte);
      if (busca) {
        const t = normalizaBusca(busca);
        res = res.filter(p => {
          const campos = [p.jogadorA, p.jogadorB, p.timeA, p.timeB, p.liga, p.esporte];
          return campos.some(c => normalizaBusca(c).includes(t));
        });
      }
      return res;
    };

    return {
      anteriores: filtraPartidas(MOCK_ANTERIORES),
      proximas: filtraPartidas(MOCK_PROXIMAS),
    };
  },

  // 🔌 BACKEND: GET /partidas/top-jogadores?esporte=&busca=
  '/partidas/top-jogadores': (params) => {
    const { esporte, busca } = params;
    let jogadores = [...MOCK_TOP_JOGADORES];
    if (esporte) jogadores = jogadores.filter(j => j.esporte === esporte);
    if (busca) {
      const t = normalizaBusca(busca);
      jogadores = jogadores.filter(j =>
        [j.nome, j.liga, j.esporte].some(c => normalizaBusca(c).includes(t))
      );
    }
    return { jogadores };
  },

  // 🔌 BACKEND: GET /partidas/por-data?busca=  (apenas futebol real, multi-dias)
  '/partidas/por-data': (params) => {
    const { esporte, busca } = params;
    // Some quando filtro de esporte ativo
    if (esporte) return { dias: [] };
    if (!busca) return { dias: MOCK_POR_DATA };
    const t = normalizaBusca(busca);
    const dias = MOCK_POR_DATA
      .map(dia => ({
        ...dia,
        jogos: dia.jogos.filter(j =>
          [j.home, j.away, j.liga, j.md].some(c => normalizaBusca(c).includes(t))
        ),
      }))
      .filter(dia => dia.jogos.length > 0);
    return { dias };
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

// Hook genérico
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

// Hooks específicos do Today
function usePartidasHoje(filtros) {
  const { data, loading, error, refetch } = useApiQuery('/partidas/hoje', filtros);
  return {
    anteriores: data?.anteriores || [],
    proximas: data?.proximas || [],
    loading, error, refetch,
  };
}

function useTopJogadores(filtros) {
  const { data, loading, error, refetch } = useApiQuery('/partidas/top-jogadores', filtros);
  return { jogadores: data?.jogadores || [], loading, error, refetch };
}

function usePartidasPorData(filtros) {
  const { data, loading, error, refetch } = useApiQuery('/partidas/por-data', filtros);
  return { dias: data?.dias || [], loading, error, refetch };
}

// ============================================================
// COMPONENTES
// ============================================================
function PillEsporte({ esporte }) {
  const c = ESPORTE_CORES[esporte] || ESPORTE_CORES['e-Soccer'];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border ${c.bg} ${c.text} ${c.border}`}>
      {esporte}
    </span>
  );
}

function BotaoH2H({ tipo = 'h2h', onClick }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      className="flex items-center gap-1 px-2 py-1 rounded-md bg-[--mike-card-2] border border-[--mike-border] hover:border-[--mike-accent] hover:bg-[--mike-accent]/5 text-[10px] font-semibold text-[--mike-fg-soft] hover:text-[--mike-accent] transition"
    >
      {tipo === 'h2h' ? 'H2H' : 'H2H + Time'}
      <ExternalLink className="w-2.5 h-2.5" />
    </button>
  );
}

// CARD DE PARTIDA NO PAINEL (anteriores/próximas) com LOGOS
function CardPartidaPainel({ p, tipo, onAbrirPartida, onAbrirH2H, onAbrirH2HTime }) {
  const isAnt = tipo === 'anterior';
  // "Ao vivo agora": jogos das proximas que comecaram nos ultimos 2-15 minutos
  // (mock visual - na real viria do backend com flag explicita)
  const aoVivoAgora = !isAnt && p.aoVivo;

  return (
    <div
      onClick={() => onAbrirPartida?.(p)}
      className="px-4 py-3 hover:bg-[--mike-card-hover] transition cursor-pointer border-b border-[--mike-border]/40 last:border-b-0 relative"
    >
      {/* Indicador AO VIVO (canto sup esq) */}
      {aoVivoAgora && (
        <div className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-500/15 border border-red-500/40">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 mike-pulse-live" />
          <span className="text-[9px] font-bold text-red-400 tracking-wider">AO VIVO</span>
        </div>
      )}

      {/* Linha 1 */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className={`flex flex-col gap-0.5 min-w-0 ${aoVivoAgora ? 'pl-20' : ''}`}>
          <PillEsporte esporte={p.esporte} />
          <span className="text-[10px] text-[--mike-fg-muted] truncate">{p.liga}</span>
        </div>
        <div className="text-[11px] font-mono text-[--mike-fg-soft] whitespace-nowrap">
          {p.data}, <span className="text-[--mike-fg]">{p.hora}</span>
        </div>
        <div className="flex items-center gap-1">
          <BotaoH2H tipo="h2h" onClick={() => onAbrirH2H?.(p)} />
          <BotaoH2H tipo="time" onClick={() => onAbrirH2HTime?.(p)} />
        </div>
      </div>

      {/* Linha 2: layouts diferentes pra anteriores vs próximas */}
      {isAnt ? (
        // ANTERIORES: time A esquerda | placar centro | time B direita (extremos)
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {p.timeA && <TeamLogo nome={p.timeA} size={32} />}
            <div className="min-w-0 leading-tight">
              <div className="text-[13px] font-bold text-[--mike-fg] truncate">{p.jogadorA}</div>
              {p.timeA && <div className="text-[10px] text-[--mike-fg-muted] truncate">{p.timeA}</div>}
            </div>
          </div>

          <div className="flex items-center justify-center gap-1.5 min-w-[64px] px-3 py-1.5 rounded-md bg-gradient-to-r from-emerald-500/20 to-emerald-500/10 border border-emerald-500/40 font-mono text-base font-black shadow-lg shadow-emerald-500/10">
            <span className={
              p.placarA > p.placarB ? 'text-emerald-300'
              : p.placarA < p.placarB ? 'text-red-400'
              : 'text-[--mike-fg]'
            }>{p.placarA}</span>
            <span className="text-[--mike-fg-muted]">:</span>
            <span className={
              p.placarB > p.placarA ? 'text-emerald-300'
              : p.placarB < p.placarA ? 'text-red-400'
              : 'text-[--mike-fg]'
            }>{p.placarB}</span>
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
        // PRÓXIMAS: tudo centralizado com bolinha VS no meio
        <div className="flex items-center justify-center gap-4">
          {/* TIME A (alinhado à direita, encostando na bolinha) */}
          <div className="flex items-center gap-2 justify-end min-w-0 flex-1 max-w-[40%]">
            <div className="text-right min-w-0 leading-tight">
              <div className="text-[13px] font-bold text-[--mike-fg] truncate">{p.jogadorA}</div>
              {p.timeA && <div className="text-[10px] text-[--mike-fg-muted] truncate">{p.timeA}</div>}
            </div>
          </div>

          {/* Bolinha VS circular */}
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-slate-700/80 to-slate-800/80 border border-slate-600/60 shadow-inner flex-shrink-0">
            <span className="font-serif italic font-bold text-[10px] text-slate-300 tracking-wider">vs</span>
          </div>

          {/* TIME B (alinhado à esquerda, encostando na bolinha) */}
          <div className="flex items-center gap-2 min-w-0 flex-1 max-w-[40%]">
            <div className="min-w-0 leading-tight">
              <div className="text-[13px] font-bold text-[--mike-fg] truncate">{p.jogadorB}</div>
              {p.timeB && <div className="text-[10px] text-[--mike-fg-muted] truncate">{p.timeB}</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PainelPartidas({ titulo, partidas, tipo, esporteAtivo, onAbrirPartida, onAbrirH2H, onAbrirH2HTime }) {
  return (
    <div className="rounded-2xl bg-[--mike-card] border border-[--mike-border] overflow-hidden shadow-2xl shadow-black/40 flex flex-col" style={{ maxHeight: '600px' }}>
      {/* Header fixo com contador */}
      <div className="px-5 py-3.5 bg-gradient-to-r from-[--mike-accent] via-[--mike-accent]/80 to-[--mike-accent-2] flex items-center justify-between gap-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-[--mike-bg]" />
          <h2 className="text-sm font-bold text-[--mike-bg]">{titulo}</h2>
        </div>
        <span className="text-[10px] font-mono font-bold text-[--mike-bg]/80 px-2 py-0.5 rounded bg-[--mike-bg]/15">
          {partidas.length} {partidas.length === 1 ? 'jogo' : 'jogos'}
        </span>
      </div>

      {/* Lista com scroll interno OU mensagem de vazio */}
      {partidas.length > 0 ? (
        <div className="overflow-y-auto flex-1 mike-scroll">
          {partidas.map((p) => (
            <CardPartidaPainel
              key={p.id}
              p={p}
              tipo={tipo}
              onAbrirPartida={onAbrirPartida}
              onAbrirH2H={onAbrirH2H}
              onAbrirH2HTime={onAbrirH2HTime}
            />
          ))}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center py-12 px-6 text-center gap-2">
          <FilterX className="w-8 h-8 text-[--mike-fg-muted] opacity-50" />
          <p className="text-xs text-[--mike-fg-muted]">
            Nenhum jogo de <span className="text-[--mike-fg] font-semibold">{esporteAtivo}</span> {tipo === 'anterior' ? 'recente' : 'agendado'}
          </p>
        </div>
      )}
    </div>
  );
}

// CARD DE PARTIDA NA LISTA POR DATA - tudo centralizado, borda fina
function CardPartidaCompacto({ jogo, onAbrir }) {
  return (
    <div
      onClick={() => onAbrir?.(jogo)}
      className="rounded-lg border bg-[--mike-card]/60 hover:bg-[--mike-card] hover:border-[--mike-accent]/40 px-4 py-2.5 cursor-pointer transition"
      style={{ borderWidth: '0.5px', borderColor: 'rgba(34, 42, 61, 0.6)' }}
    >
      <div className="flex items-center justify-center gap-4">
        {/* HOME — alinhado à direita, encostando no centro */}
        <div className="flex items-center gap-2 justify-end min-w-0 flex-1 max-w-[35%]">
          <span className="text-sm font-semibold text-[--mike-fg] truncate">{jogo.home}</span>
          <TeamLogo nome={jogo.home} size={22} />
        </div>

        {/* CENTRO: hora + liga·MD - mais escuro */}
        <div className="flex flex-col items-center leading-tight flex-shrink-0">
          <span className="text-[11px] font-mono text-[--mike-fg-muted] whitespace-nowrap">
            {jogo.hora}
          </span>
          <span className="text-[9px] font-bold tracking-widest whitespace-nowrap mt-0.5" style={{ color: '#4a5470' }}>
            {jogo.liga} · {jogo.md}
          </span>
        </div>

        {/* AWAY — alinhado à esquerda, encostando no centro */}
        <div className="flex items-center gap-2 min-w-0 flex-1 max-w-[35%]">
          <TeamLogo nome={jogo.away} size={22} />
          <span className="text-sm font-semibold text-[--mike-fg] truncate">{jogo.away}</span>
        </div>
      </div>
    </div>
  );
}

// HEADER

function SkeletonLinhaPartida() {
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-md" style={{ borderBottom: '0.5px solid rgba(60,85,130,0.2)' }}>
      <div className="mike-skeleton h-2 w-20 rounded" />
      <div className="flex-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <div className="mike-skeleton h-3 w-24 rounded" />
          <div className="mike-skeleton w-6 h-6 rounded-full" />
        </div>
        <div className="mike-skeleton h-5 w-12 rounded-md" />
        <div className="flex items-center gap-1.5">
          <div className="mike-skeleton w-6 h-6 rounded-full" />
          <div className="mike-skeleton h-3 w-24 rounded" />
        </div>
      </div>
      <div className="flex gap-1">
        <div className="mike-skeleton h-5 w-9 rounded" />
        <div className="mike-skeleton h-5 w-14 rounded" />
      </div>
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
        {[1,2,3,4,5,6].map((i) => <SkeletonLinhaPartida key={i} />)}
      </div>
    </div>
  );
}

function SkeletonCardData() {
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-md" style={{ border: '0.5px solid rgba(34,42,61,0.6)' }}>
      <div className="mike-skeleton w-7 h-7 rounded-full flex-shrink-0" />
      <div className="mike-skeleton h-3 flex-1 rounded" />
      <div className="mike-skeleton h-3 w-20 rounded" />
      <div className="mike-skeleton h-3 flex-1 rounded" />
      <div className="mike-skeleton w-7 h-7 rounded-full flex-shrink-0" />
    </div>
  );
}

export default function App({ onNavegar, onAbrirPartida }) {
  const [esporteAtivo, setEsporteAtivo] = useState(null);
  const [busca, setBusca] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(0);
  const [telaAtiva, setTelaAtiva] = useState('today');
  const [modalAcao, setModalAcao] = useState(null);

  // Filtros memoizados
  const filtros = useMemo(() => ({ esporte: esporteAtivo, busca }), [esporteAtivo, busca]);

  // Hooks de dados (substituem useState + useMemo manual)
  const { anteriores: anterioresFiltradas, proximas: proximasFiltradas, loading: loadingPartidas, refetch: refetchPartidas } = usePartidasHoje(filtros);
  const { jogadores: topJogadoresFiltrados, refetch: refetchTop } = useTopJogadores(filtros);
  const { dias: porDataFiltrada, refetch: refetchPorData } = usePartidasPorData(filtros);

  const loading = loadingPartidas;

  // Handlers de navegacao/abertura - com fallback se prop nao foi passada
  const handleNavegar = (telaId) => {
    setTelaAtiva(telaId);
    if (onNavegar) {
      onNavegar(telaId);
    } else {
      setModalAcao({ tipo: 'navegar', destino: telaId });
    }
  };

  const handleAbrirPartida = (partida) => {
    if (onAbrirPartida) {
      onAbrirPartida(partida);
    } else {
      setModalAcao({ tipo: 'partida', partida });
    }
  };

  const handleAbrirH2H = (partida) => {
    setModalAcao({ tipo: 'h2h', partida });
  };

  const handleAbrirH2HTime = (partida) => {
    setModalAcao({ tipo: 'h2h_time', partida });
  };

  // Refresh manual ou automatico
  const fazerRefresh = useCallback(() => {
    setRefreshing(true);
    Promise.all([refetchPartidas(), refetchTop(), refetchPorData()])
      .finally(() => {
        setRefreshing(false);
        setUltimaAtualizacao(0);
      });
  }, [refetchPartidas, refetchTop, refetchPorData]);

  // Auto-refresh contador (a cada segundo, incrementa; reseta a cada 15s)
  useEffect(() => {
    if (loading) return;
    const id = setInterval(() => {
      setUltimaAtualizacao((s) => {
        if (s + 1 >= 15) {
          fazerRefresh();
          return 0;
        }
        return s + 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [loading, fazerRefresh]);

  // Stats agregados pro hero (refletem filtros aplicados)
  const stats = useMemo(() => {
    const aoVivoCount = proximasFiltradas.filter(p => p.aoVivo).length;
    const proximasCount = proximasFiltradas.length - aoVivoCount;
    const recentesCount = anterioresFiltradas.length;
    return { aoVivo: aoVivoCount, proximas: proximasCount, recentes: recentesCount };
  }, [proximasFiltradas, anterioresFiltradas]);

  // Estado vazio unificado
  const totalmenteVazio = !loading
    && anterioresFiltradas.length === 0
    && proximasFiltradas.length === 0
    && topJogadoresFiltrados.length === 0
    && (esporteAtivo || porDataFiltrada.length === 0);

  const themeVars = {
    '--mike-bg': '#0b0f1a',
    '--mike-bg-2': '#070a13',
    '--mike-card': '#141a28',
    '--mike-card-2': '#1a2030',
    '--mike-card-hover': '#1d2434',
    '--mike-border': '#222a3d',
    '--mike-fg': '#eaeef7',
    '--mike-fg-soft': '#a8b3c9',
    '--mike-fg-muted': '#6b7691',
    '--mike-accent': '#10b981',
    '--mike-accent-2': '#0891b2',
  };

  return (
    <div className="min-h-screen" style={{
      ...themeVars,
      backgroundColor: 'var(--mike-bg)',
      color: 'var(--mike-fg)',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      {/* CSS de scrollbar customizada */}
      <style>{`
        .mike-scroll::-webkit-scrollbar {
          width: 8px;
        }
        .mike-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .mike-scroll::-webkit-scrollbar-thumb {
          background: rgba(16, 185, 129, 0.3);
          border-radius: 4px;
          border: 2px solid transparent;
          background-clip: padding-box;
        }
        .mike-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(16, 185, 129, 0.6);
          background-clip: padding-box;
          border: 2px solid transparent;
        }
        .mike-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(16, 185, 129, 0.3) transparent;
        }
        .scrollbar-none::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-none {
          scrollbar-width: none;
        }

        /* SKELETON SHIMMER */
        @keyframes mike-shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .mike-skeleton {
          background: linear-gradient(
            90deg,
            rgba(60, 85, 130, 0.1) 0%,
            rgba(60, 85, 130, 0.25) 50%,
            rgba(60, 85, 130, 0.1) 100%
          );
          background-size: 200% 100%;
          animation: mike-shimmer 1.5s infinite linear;
          border-radius: 4px;
        }

        /* REFRESH PULSE - bolinha que pisca a cada atualização */
        @keyframes mike-refresh-pulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        .mike-refresh-dot {
          animation: mike-refresh-pulse 1s ease-in-out infinite;
        }

        /* AO VIVO - pulso vermelho */
        @keyframes mike-live-pulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
          50% { opacity: 0.8; box-shadow: 0 0 0 5px rgba(239, 68, 68, 0); }
        }
        .mike-pulse-live {
          animation: mike-live-pulse 1.4s ease-out infinite;
        }

        /* SPIN - pra botao de refresh */
        @keyframes mike-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .mike-spin {
          animation: mike-spin 0.8s linear infinite;
        }

        /* MODAL FADE */
        @keyframes mike-modal-fade {
          from { opacity: 0; transform: translateY(8px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      <MikeHeader telaAtiva={telaAtiva} onNavegar={handleNavegar} />

      <main className="max-w-screen-xl mx-auto px-4 lg:px-8 py-10">
        {/* HERO */}
        <div className="flex flex-col items-center gap-4 mb-8">
          {/* Stats cards no topo (substituiu o quadradinho inutil) */}
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
                <Clock className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] text-[--mike-fg-muted] uppercase tracking-wider truncate">Próximas</div>
                <div className="text-xl font-black text-[--mike-fg] leading-tight">{stats.proximas}</div>
              </div>
            </div>
            <div className="rounded-xl bg-[--mike-card] border border-[--mike-border] px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center flex-shrink-0">
                <Activity className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] text-[--mike-fg-muted] uppercase tracking-wider truncate">Recentes</div>
                <div className="text-xl font-black text-[--mike-fg] leading-tight">{stats.recentes}</div>
              </div>
            </div>
          </div>

          <h1 className="text-2xl md:text-3xl font-black text-center text-[--mike-fg] max-w-md mt-2">
            Acompanhe todas as partidas do dia
          </h1>

          {/* Busca + botao refresh */}
          <div className="w-full max-w-md flex gap-2">
            <div className="flex-1 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[--mike-card] border border-[--mike-border] shadow-sm focus-within:border-[--mike-accent] transition">
              <Search className="w-4 h-4 text-[--mike-fg-muted] flex-shrink-0" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Busque jogadores, times, esportes ou ligas"
                className="flex-1 bg-transparent outline-none text-sm placeholder:text-[--mike-fg-muted]"
              />
              {busca && (
                <button
                  onClick={() => setBusca('')}
                  className="p-0.5 rounded hover:bg-[--mike-card-hover] text-[--mike-fg-muted] hover:text-[--mike-fg] transition"
                  title="Limpar busca"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <button
              onClick={fazerRefresh}
              disabled={refreshing || loading}
              className="px-3 rounded-lg bg-[--mike-card] border border-[--mike-border] hover:bg-[--mike-card-hover] hover:border-[--mike-accent] text-[--mike-fg-muted] hover:text-[--mike-accent] transition disabled:opacity-50 disabled:cursor-not-allowed"
              title={refreshing ? 'Atualizando...' : `Atualizar (auto em ${15 - ultimaAtualizacao}s)`}
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'mike-spin' : ''}`} />
            </button>
          </div>

          <div className="w-full overflow-x-auto pb-2 scrollbar-none">
            <div className="flex justify-start md:justify-center items-center gap-2.5 min-w-min">
              {ESPORTES_FILTROS.map((e) => {
                const cores = ESPORTE_CORES[e.id] || ESPORTE_CORES['e-Soccer'];
                const ativo = esporteAtivo === e.id;
                return (
                  <button
                    key={e.id}
                    onClick={() => setEsporteAtivo(ativo ? null : e.id)}
                    className={`px-3.5 py-1 rounded-full text-xs font-semibold border transition whitespace-nowrap ${
                      ativo
                        ? `${cores.activeBg} ${cores.activeText} ${cores.activeBorder} shadow-lg ${cores.activeShadow}`
                        : 'bg-[--mike-card] text-[--mike-fg-muted] border-[--mike-border] hover:bg-[--mike-card-hover] hover:text-[--mike-fg]'
                    }`}
                  >
                    {e.label}
                  </button>
                );
              })}
              {(esporteAtivo || busca) && (
                <button
                  onClick={() => { setEsporteAtivo(null); setBusca(''); }}
                  className="ml-1 px-3 py-1 rounded-full text-xs font-medium border border-[--mike-border] text-[--mike-fg-muted] hover:text-[--mike-fg] hover:border-[--mike-accent]/40 transition flex items-center gap-1.5 whitespace-nowrap"
                >
                  <FilterX className="w-3 h-3" />
                  Limpar filtros
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ESTADO VAZIO UNIFICADO - quando filtros zeram tudo */}
        {totalmenteVazio && (
          <div className="rounded-2xl bg-[--mike-card] border border-[--mike-border] p-12 text-center mb-10">
            <FilterX className="w-12 h-12 text-[--mike-fg-muted] opacity-40 mx-auto mb-3" />
            <p className="text-sm text-[--mike-fg] font-semibold mb-1">Nenhum resultado encontrado</p>
            <p className="text-xs text-[--mike-fg-muted] mb-4">
              {busca && esporteAtivo ? (
                <>Sua busca por <span className="text-[--mike-fg] font-semibold">"{busca}"</span> em <span className="text-[--mike-fg] font-semibold">{esporteAtivo}</span> não retornou nada.</>
              ) : busca ? (
                <>Sua busca por <span className="text-[--mike-fg] font-semibold">"{busca}"</span> não retornou nada.</>
              ) : (
                <>Nenhum jogo de <span className="text-[--mike-fg] font-semibold">{esporteAtivo}</span> hoje.</>
              )}
            </p>
            <button
              onClick={() => { setEsporteAtivo(null); setBusca(''); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-[--mike-accent]/10 border border-[--mike-accent]/40 text-[--mike-accent] hover:bg-[--mike-accent]/15 transition"
            >
              <FilterX className="w-3 h-3" />
              Limpar filtros
            </button>
          </div>
        )}

        {/* GRID PAINEIS - some quando vazio total */}
        {!totalmenteVazio && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-10">
          {loading ? (
            <>
              <SkeletonPainel />
              <SkeletonPainel />
            </>
          ) : (
            <>
              <PainelPartidas
                titulo="Partidas anteriores"
                partidas={anterioresFiltradas}
                tipo="anterior"
                esporteAtivo={esporteAtivo}
                onAbrirPartida={handleAbrirPartida}
                onAbrirH2H={handleAbrirH2H}
                onAbrirH2HTime={handleAbrirH2HTime}
              />
              <PainelPartidas
                titulo="Próximas partidas"
                partidas={proximasFiltradas}
                tipo="proxima"
                esporteAtivo={esporteAtivo}
                onAbrirPartida={handleAbrirPartida}
                onAbrirH2H={handleAbrirH2H}
                onAbrirH2HTime={handleAbrirH2HTime}
              />
            </>
          )}
        </div>
        )}

        {/* LISTA POR DATA - some quando filtro de esporte ativo */}
        {loading ? (
          <div className="space-y-3 mb-12">
            <div className="mike-skeleton h-5 w-32 rounded mb-3" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {[1,2,3,4,5,6].map((i) => <SkeletonCardData key={i} />)}
            </div>
          </div>
        ) : !esporteAtivo && porDataFiltrada.length > 0 && (
          <div className="space-y-6 mb-12">
            {porDataFiltrada.map((dia) => (
              <section key={dia.data}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-5 rounded-full bg-[--mike-accent]" />
                  <h2 className="text-base font-bold text-[--mike-fg]">{dia.data}</h2>
                  <span className="text-xs text-[--mike-fg-muted]">({dia.jogos.length})</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {dia.jogos.map((j, i) => (
                    <CardPartidaCompacto key={i} jogo={j} onAbrir={handleAbrirPartida} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* MELHORES JOGADORES */}
        <section className="mb-12">
          <div className="text-center mb-2">
            <h2 className="text-base font-bold text-[--mike-fg]">
              Melhores Jogadores do Dia
              {esporteAtivo && (
                <span className="ml-2 text-xs font-normal text-[--mike-fg-muted]">· {esporteAtivo}</span>
              )}
            </h2>
            <p className="text-[10px] text-[--mike-fg-muted] mt-0.5 flex items-center justify-center gap-1.5">
              <span className="mike-refresh-dot inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
              {refreshing ? 'Atualizando...' : `Próxima atualização em ${15 - ultimaAtualizacao}s`}
            </p>
          </div>
          <div className="flex justify-center flex-wrap gap-3 mt-4">
            {topJogadoresFiltrados.length > 0 ? (
              topJogadoresFiltrados.map((j, i) => (
                <div key={i} className="rounded-lg border border-[--mike-border] bg-[--mike-card] px-4 py-2.5 min-w-[150px] hover:border-[--mike-accent]/40 transition cursor-pointer">
                  <div className="flex flex-col items-center gap-1.5">
                    <PillEsporte esporte={j.esporte} />
                    <div className="text-sm font-bold text-[--mike-fg]">{j.nome}</div>
                    <div className="text-[10px] text-[--mike-fg-muted]">{j.liga}</div>
                    <div className="flex items-center gap-2 mt-1 pt-2 border-t border-[--mike-border] w-full justify-center">
                      <span className="text-[9px] text-[--mike-fg-muted] uppercase tracking-wider">Win</span>
                      <span className="text-xs font-black font-mono text-emerald-400">{j.wr}%</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center gap-2 py-6 text-[--mike-fg-muted]">
                <FilterX className="w-6 h-6 opacity-50" />
                <p className="text-xs">Nenhum jogador de <span className="text-[--mike-fg] font-semibold">{esporteAtivo}</span> em destaque</p>
              </div>
            )}
          </div>
        </section>

        <section className="text-center max-w-2xl mx-auto mb-8">
          <p className="text-xs text-[--mike-fg-muted] leading-relaxed mb-4">
            No TipMike você encontra todas as partidas do dia em um só lugar. Acompanhe resultados de hoje
            e próximos jogos de e-Soccer, e-Basket, e-Hockey, e-NFL, Tênis de Mesa, Counter-Strike 2 e Tênis.
          </p>

          <div className="mb-4">
            <h3 className="text-xs font-bold text-[--mike-fg] mb-2">Principais Torneios e Ligas</h3>
            <div className="flex flex-wrap justify-center gap-1.5">
              {PRINCIPAIS_LIGAS.map((liga) => (
                <span key={liga} className="px-2.5 py-0.5 rounded-md bg-[--mike-card] border border-[--mike-border] text-[10px] text-[--mike-fg-soft] hover:border-[--mike-accent]/40 transition cursor-pointer">
                  {liga}
                </span>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold text-[--mike-fg] mb-1">Estatísticas em Tempo Real</h3>
            <p className="text-[10px] text-[--mike-fg-muted] leading-relaxed">
              Acesse dados atualizados de partidas, histórico de confrontos diretos (H2H), estatísticas de
              jogadores e times. Todas as informações são atualizadas automaticamente para garantir precisão.
            </p>
          </div>
        </section>
      </main>

      <footer className="mt-8" style={{ borderTop: '0.5px solid rgba(60, 85, 130, 0.4)' }}>
        <div className="max-w-screen-xl mx-auto px-4 lg:px-8 py-8">
          {/* Header do footer com logo + descrição */}
          <div className="flex flex-col items-center gap-2 mb-8">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-gradient-to-br from-[--mike-accent] to-[--mike-accent-2] flex items-center justify-center text-sm font-black text-[--mike-bg] shadow-md shadow-[--mike-accent]/30">M</div>
              <span className="font-black text-[--mike-fg] tracking-tight" style={{ fontFamily: 'JetBrains Mono, monospace' }}>TIPMIKE</span>
            </div>
            <p className="text-[11px] text-[--mike-fg-muted] text-center max-w-md leading-relaxed">
              O TipMike é uma plataforma avançada de análise esportiva que oferece estatísticas detalhadas, análises em tempo real e insights profundos para apostadores e entusiastas do esporte.
            </p>
          </div>

          {/* 5 colunas de links */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6 mb-6">
            {/* Ferramentas */}
            <div>
              <h4 className="text-xs font-bold text-[--mike-fg] mb-3 flex items-center gap-1.5">
                <Activity className="w-3 h-3 text-[--mike-accent]" />
                Ferramentas
              </h4>
              <ul className="space-y-2">
                <li><span className="text-[11px] text-[--mike-fg-soft] hover:text-[--mike-accent] transition cursor-pointer">Partidas de hoje</span></li>
                <li><span className="text-[11px] text-[--mike-fg-soft] hover:text-[--mike-accent] transition cursor-pointer">Ao Vivo</span></li>
                <li><span className="text-[11px] text-[--mike-fg-soft] hover:text-[--mike-accent] transition cursor-pointer">Mercado de Bots</span></li>
                <li><span className="text-[11px] text-[--mike-fg-soft] hover:text-[--mike-accent] transition cursor-pointer">Bots</span></li>
              </ul>
            </div>

            {/* Estatísticas */}
            <div>
              <h4 className="text-xs font-bold text-[--mike-fg] mb-3 flex items-center gap-1.5">
                <BarChart3 className="w-3 h-3 text-[--mike-accent]" />
                Estatísticas
              </h4>
              <ul className="space-y-2">
                <li><span className="text-[11px] text-[--mike-fg-soft] hover:text-[--mike-accent] transition cursor-pointer">e-Soccer</span></li>
                <li><span className="text-[11px] text-[--mike-fg-soft] hover:text-[--mike-accent] transition cursor-pointer">e-Basket</span></li>
                <li><span className="text-[11px] text-[--mike-fg-soft] hover:text-[--mike-accent] transition cursor-pointer">e-Hockey</span></li>
                <li><span className="text-[11px] text-[--mike-fg-soft] hover:text-[--mike-accent] transition cursor-pointer">e-NFL</span></li>
                <li><span className="text-[11px] text-[--mike-fg-soft] hover:text-[--mike-accent] transition cursor-pointer">Tênis de Mesa</span></li>
                <li><span className="text-[11px] text-[--mike-fg-soft] hover:text-[--mike-accent] transition cursor-pointer">Counter-Strike 2</span></li>
                <li><span className="text-[11px] text-[--mike-fg-soft] hover:text-[--mike-accent] transition cursor-pointer">Tênis</span></li>
              </ul>
            </div>

            {/* Tabelas */}
            <div>
              <h4 className="text-xs font-bold text-[--mike-fg] mb-3 flex items-center gap-1.5">
                <Table2 className="w-3 h-3 text-[--mike-accent]" />
                Tabelas
              </h4>
              <ul className="space-y-2">
                <li><span className="text-[11px] text-[--mike-fg-soft] hover:text-[--mike-accent] transition cursor-pointer">e-Soccer</span></li>
                <li><span className="text-[11px] text-[--mike-fg-soft] hover:text-[--mike-accent] transition cursor-pointer">e-Basket</span></li>
                <li><span className="text-[11px] text-[--mike-fg-soft] hover:text-[--mike-accent] transition cursor-pointer">e-Hockey</span></li>
                <li><span className="text-[11px] text-[--mike-fg-soft] hover:text-[--mike-accent] transition cursor-pointer">e-NFL</span></li>
                <li><span className="text-[11px] text-[--mike-fg-soft] hover:text-[--mike-accent] transition cursor-pointer">Tênis de Mesa</span></li>
              </ul>
            </div>

            {/* Extras */}
            <div>
              <h4 className="text-xs font-bold text-[--mike-fg] mb-3 flex items-center gap-1.5">
                <Plus className="w-3 h-3 text-[--mike-accent]" />
                Extras
              </h4>
              <ul className="space-y-2">
                <li><span className="text-[11px] text-[--mike-fg-soft] hover:text-[--mike-accent] transition cursor-pointer">Ver Planos</span></li>
                <li><span className="text-[11px] text-[--mike-fg-soft] hover:text-[--mike-accent] transition cursor-pointer">Blog</span></li>
                <li><span className="text-[11px] text-[--mike-fg-soft] hover:text-[--mike-accent] transition cursor-pointer">Políticas e Termos</span></li>
                <li><span className="text-[11px] text-[--mike-fg-soft] hover:text-[--mike-accent] transition cursor-pointer">Status</span></li>
              </ul>
            </div>

            {/* Contato */}
            <div>
              <h4 className="text-xs font-bold text-[--mike-fg] mb-3 flex items-center gap-1.5">
                <Bell className="w-3 h-3 text-[--mike-accent]" />
                Contato
              </h4>
              <ul className="space-y-2">
                <li className="flex items-center gap-1.5">
                  <span className="text-[11px] text-[--mike-fg-soft] hover:text-[--mike-accent] transition cursor-pointer">FAQ</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <ExternalLink className="w-2.5 h-2.5 text-[--mike-fg-muted]" />
                  <span className="text-[11px] text-[--mike-fg-soft] hover:text-[--mike-accent] transition cursor-pointer break-all">contato@tipmike.net</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <ExternalLink className="w-2.5 h-2.5 text-[--mike-fg-muted]" />
                  <span className="text-[11px] text-[--mike-fg-soft] hover:text-[--mike-accent] transition cursor-pointer">Instagram</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Linha de copyright */}
          <div className="text-center text-[10px] text-[--mike-fg-muted] pt-6" style={{ borderTop: '0.5px solid rgba(60, 85, 130, 0.4)' }}>
            © 2026 TipMike. Todos os direitos reservados.
          </div>
        </div>
      </footer>

      {/* MODAL DE ACAO - mock pra mostrar onde callbacks levariam
          🔌 BACKEND/INTEGRACAO: substituir por roteamento real */}
      {modalAcao && (
        <div
          onClick={() => setModalAcao(null)}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="rounded-2xl bg-[--mike-card] border border-[--mike-border] p-6 max-w-md w-full"
            style={{ animation: 'mike-modal-fade 200ms ease-out' }}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-[10px] tracking-widest text-[--mike-fg-muted] uppercase mb-1">
                  {modalAcao.tipo === 'navegar' && 'Navegação'}
                  {modalAcao.tipo === 'partida' && 'Abrir Partida'}
                  {modalAcao.tipo === 'h2h' && 'H2H'}
                  {modalAcao.tipo === 'h2h_time' && 'H2H + Time'}
                </div>
                <div className="text-base font-bold text-[--mike-fg]">
                  {modalAcao.tipo === 'navegar' && `Ir para: ${modalAcao.destino}`}
                  {modalAcao.tipo === 'partida' && (modalAcao.partida.jogadorA
                    ? `${modalAcao.partida.jogadorA} vs ${modalAcao.partida.jogadorB}`
                    : `${modalAcao.partida.home} vs ${modalAcao.partida.away}`)}
                  {modalAcao.tipo === 'h2h' && `${modalAcao.partida.jogadorA} vs ${modalAcao.partida.jogadorB}`}
                  {modalAcao.tipo === 'h2h_time' && `${modalAcao.partida.timeA || '?'} vs ${modalAcao.partida.timeB || '?'}`}
                </div>
              </div>
              <button
                onClick={() => setModalAcao(null)}
                className="p-1 rounded hover:bg-[--mike-card-hover] text-[--mike-fg-muted] hover:text-[--mike-fg] transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[--mike-fg-muted] leading-relaxed">
              {modalAcao.tipo === 'navegar' && 'Em produção, esta ação navegaria para a tela correspondente.'}
              {modalAcao.tipo === 'partida' && 'Em produção, abriria a tela individual da partida com 18 seções de análise (Over/Under, HC Asiático, Médias, Histórico, etc).'}
              {(modalAcao.tipo === 'h2h' || modalAcao.tipo === 'h2h_time') && 'Em produção, abriria modal com histórico de confrontos diretos entre os jogadores/times.'}
            </p>
            <div className="mt-4 px-3 py-2 rounded-md bg-[--mike-bg-2] border border-[--mike-border]">
              <div className="text-[10px] text-[--mike-fg-muted] mb-1">Dados disponíveis:</div>
              <pre className="text-[10px] text-[--mike-fg-soft] font-mono overflow-x-auto">
                {JSON.stringify(modalAcao, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
