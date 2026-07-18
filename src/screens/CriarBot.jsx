import { useState, useEffect, useRef } from 'react';
import {
  Bell, Settings, ChevronDown, Home, Activity, Store, Bot, Table2, BarChart3, Plus,
  X, Check, AlertCircle, CheckCircle2,
  Info, ChevronRight, Save, Trash2, Copy, Clipboard, ArrowLeft, Edit2,
  Code, RotateCcw, HelpCircle
} from 'lucide-react';
import MikeHeader from '../shared/MikeHeader.jsx';
import MercadoFiltros from './MercadoFiltros';
import { ApiTorneios, ApiBots } from '../lib/api';

// ============================================================
// CONSTANTES (opcoes dos dropdowns)
// ============================================================
const ESPORTES = [
  { value: 'fifa',    label: 'e-Soccer (Fifa)' },
  { value: 'nba2k',  label: 'e-Basket (NBA2K)' },
  { value: 'ehockey', label: 'e-Hockey' },
  { value: 'etennis', label: 'e-Tênis' },
];

const CASAS_APOSTAS = [
  { value: 'betano',     label: 'BETANO' },
  { value: 'superbet',   label: 'SUPERBET' },
  { value: 'bet365',     label: 'BET365' },
  { value: 'estrelabet', label: 'ESTRELABET' },
  { value: 'novibet',    label: 'NOVIBET' },
  { value: 'vupi',       label: 'VUPI' },
];

const TORNEIOS_POR_ESPORTE = {
  fifa: [
    'Battle',
    'GT League',
    'ECF (Volta)',
    'H2H League',
    'Live Arena',
    'Valhalla',
    'Valkyrie',
    'FC 26 Rivals',
  ],
  nba2k:   ['H2H GG League', 'Adriatic NextGen', 'Battle (NBA2K)', 'Live NBA'],
  ehockey: ['NHL eSports', 'IIHF eSports', 'KHL eSports'],
  etennis: ['ATP eSports', 'WTA eSports', 'Grand Slam eSports', 'Masters eSports'],
};

// MERCADOS POR ESPORTE - cada esporte tem mercados diferentes
const MERCADOS_POR_ESPORTE = {
  // e-Soccer H2H (tipo 1) — Battle, GT League, ECF Volta, H2H GG League, Live Arena
  // Keys exatas do TipManager (chunk 7943 + __NEXT_DATA__)
  fifa: [
    { value: 'over_under_ft',        label: 'Over/Under - Gols FT' },
    { value: 'over_under_ht',        label: 'Over/Under - Gols HT' },
    { value: 'asian_over_under_ft',  label: 'Over/Under Asiático FT' },
    { value: 'asian_over_under_ht',  label: 'Over/Under Asiático HT' },
    { value: 'ah_ft',                label: 'HC Asiático FT' },
    { value: 'ah_ht',                label: 'HC Asiático HT' },
    { value: 'eh_ft',                label: 'HC Europeu FT' },
    { value: 'over_under_ft_player', label: 'Jogador - Gols FT' },
    { value: 'over_under_ht_player', label: 'Jogador - Gols HT' },
  ],
  // e-Basket / NBA2K (tipo 2) — Adriatic NextGen, Battle NBA2K, H2H GG League
  nba2k: [
    { value: 'ml_ft',              label: 'Resultado Final' },
    { value: 'ml_ht',              label: 'Resultado Final - 1˚T' },
    { value: 'over_under_ft',      label: 'Partida - Pontos' },
    { value: 'over_under_ht',      label: 'Total de Pontos - 1˚T' },
    { value: 'over_under_ft_player', label: 'Total de Pontos - Jogador' },
    { value: 'ah_ft',              label: 'Handicap Asiático' },
    { value: 'ah_ht',              label: 'Handicap Asiático - 1˚T' },
  ],

  ehockey: [
    { value: 'ml_ft',         label: 'Resultado Final' },
    { value: 'ah_ft',         label: 'HC Asiático' },
    { value: 'over_under_ft', label: 'Over/Under (Gols)' },
    { value: 'btts_ft',       label: 'Ambos Marcam' },
  ],
  etennis: [
    { value: 'ml_ft',          label: 'Vencedor da Partida' },
    { value: 'ah_ft',          label: 'HC Asiático (Games)' },
    { value: 'over_under_ft',  label: 'Total de Games' },
    { value: 'ml_ht',          label: 'Vencedor do Set' },
  ],
};
// CAPACIDADES POR ESPORTE - controla o que mostrar/esconder




const CAPACIDADES = {
  fifa: {
    label: 'Fifa',
    // Filtros ao vivo (esquerda + direita)
    filtrosLive: {
      tempo: { min: 0, max: 90, sufixo: '90+', label: 'Tempo' },
      ataques: { min: 0, max: 50, sufixo: '50+', label: 'Ataques' },
      chutes: { min: 0, max: 50, sufixo: '50+', label: 'Chutes' },
      cantos: { min: 0, max: 25, sufixo: '25+', label: 'Cantos' },
      cartVermelhos: { min: 0, max: 25, sufixo: '25+', label: 'Cart. Vermelhos' },
      placares: { tipo: 'text', label: 'Placares' },
      ataquesPerigosos: { min: 0, max: 50, sufixo: '50+', label: 'Ataques Perigosos' },
      chutesGol: { min: 0, max: 50, sufixo: '50+', label: 'Chutes no gol' },
      cartAmarelos: { min: 0, max: 25, sufixo: '25+', label: 'Cart. Amarelos' },
    },
    // Cenarios disponiveis (todos)
    cenariosFull: true,
    // Quartos (so basquete)
    temQuartos: false,
  },
  nba2k: {
    label: 'Nba2K',
    // So tempo + quartos, sem ataques/chutes/cantos/cartoes
    filtrosLive: {
      tempo: { min: 0, max: 48, sufixo: '48+', label: 'Tempo (min)' },
      placares: { tipo: 'text', label: 'Placares' },
    },
    cenariosFull: true,
    temQuartos: true, // checkboxes Q1/Q2/Q3/Q4
  },
  ehockey: {
    label: 'e-Hockey',
    filtrosLive: {
      tempo: { min: 0, max: 60, sufixo: '60+', label: 'Tempo (min)' },
      placares: { tipo: 'text', label: 'Placares' },
    },
    cenariosFull: true,
    temQuartos: false,
  },
  etennis: {
    label: 'e-Tênis',
    filtrosLive: {
      placares: { tipo: 'text', label: 'Placar (Games)' },
    },
    cenariosFull: false,
    temQuartos: false,
  },
};

// Cenarios completos (e-Soccer/Fifa/Nba2K)
const CENARIOS_FULL = [
  { value: 'casa_vencendo', label: 'Casa vencendo' },
  { value: 'casa_perdendo', label: 'Casa perdendo' },
  { value: 'empate', label: 'Empate' },
  { value: 'casa_ou_empate', label: 'Casa ou Empate' },
  { value: 'visitante_ou_empate', label: 'Visitante ou Empate' },
  { value: 'casa_ou_visitante', label: 'Casa ou Visitante' },
  { value: 'alvo_vencendo', label: 'Alvo da tip vencendo' },
  { value: 'oponente_vencendo', label: 'Oponente vencendo' },
  { value: 'alvo_ou_empate', label: 'Alvo da tip ou Empate' },
  { value: 'oponente_ou_empate', label: 'Oponente ou Empate' },
  { value: 'alvo_ou_oponente', label: 'Alvo da tip ou Oponente' },
  { value: 'favorito_vencendo', label: 'Favorito vencendo' },
  { value: 'favorito_perdendo', label: 'Favorito perdendo' },
  { value: 'favorito_ou_empate', label: 'Favorito ou Empate' },
  { value: 'azarao_ou_empate', label: 'Azarão ou Empate' },
];

// Cenarios reduzidos (tenis, tt, cs2 - sem empate)
const CENARIOS_REDUZIDO = [
  { value: 'alvo_vencendo', label: 'Alvo da tip vencendo' },
  { value: 'oponente_vencendo', label: 'Oponente vencendo' },
  { value: 'favorito_vencendo', label: 'Favorito vencendo' },
  { value: 'favorito_perdendo', label: 'Favorito perdendo' },
];

const EXTRAS_OPCOES = [
  { value: 'home',      label: 'Casa' },
  { value: 'away',      label: 'Visitante' },
  { value: 'draw',      label: 'Empate' },
  { value: 'moneyline', label: 'Favorito' },
  { value: 'underdog',  label: 'Azarão' },
  { value: 'target',    label: 'Alvo da tip' },
  { value: 'opponent',  label: 'Oponente' },
  { value: 'no_goal',   label: 'Sem gol' },
];


const VERSOES_GAME = [
  { value: 'all', label: 'Todas' },
  { value: 'nova', label: 'Nova' },
];

// Janelas reais do TipManager (array m[] do chunk 7943)
const JANELAS_PARTIDAS = [
  { value: 'all',                  label: 'Todas' },
  { value: 'last_1',               label: 'Última' },
  { value: 'last_2',               label: 'Últ. 2' },
  { value: 'last_3',               label: 'Últ. 3' },
  { value: 'last_4',               label: 'Últ. 4' },
  { value: 'last_5',               label: 'Últ. 5' },
  { value: 'last_10',              label: 'Últ. 10' },
  { value: 'last_15',              label: 'Últ. 15' },
  { value: 'last_20',              label: 'Últ. 20' },
  { value: 'last_25',              label: 'Últ. 25' },
  { value: 'last_30',              label: 'Últ. 30' },
  { value: 'last_40',              label: 'Últ. 40' },
  { value: 'last_50',              label: 'Últ. 50' },
  { value: 'last_100',             label: 'Últ. 100' },
  { value: 'current_championship', label: 'Campeonato atual' },
  { value: 'last_1h',              label: 'Últ. 1 hora' },
  { value: 'last_8h',              label: 'Últ. 8 horas' },
  { value: 'last_1d',              label: 'Últ. 24h' },
  { value: 'last_7d',              label: 'Últ. 7 dias' },
  { value: 'last_30d',             label: 'Últ. 30 dias' },
  { value: 'last_60d',             label: 'Últ. 60 dias' },
  { value: 'last_90d',             label: 'Últ. 90 dias' },
  { value: 'same_day',             label: 'Mesmo dia' },
];

// Janelas pros filtros COMPLEMENTARES (media, gap_media).
// Os VALORES aqui sao o que o backend entende direto, sem prefixo 'last_':
//   quantidade -> numero (10) | tempo -> token ('8h', '7d').
// (filtros comp nao passam pela normalizacao 'last_' do backend, vao direto)
// Nao inclui current_championship/same_day (nao suportados pelo H2H).
const JANELAS_COMP = [
  { value: 0,     label: 'Todas' },
  { value: 5,     label: 'Últ. 5' },
  { value: 10,    label: 'Últ. 10' },
  { value: 15,    label: 'Últ. 15' },
  { value: 20,    label: 'Últ. 20' },
  { value: 30,    label: 'Últ. 30' },
  { value: 50,    label: 'Últ. 50' },
  { value: 100,   label: 'Últ. 100' },
  { value: '1h',  label: 'Últ. 1 hora' },
  { value: '8h',  label: 'Últ. 8 horas' },
  { value: '24h', label: 'Últ. 24h' },
  { value: '7d',  label: 'Últ. 7 dias' },
  { value: '30d', label: 'Últ. 30 dias' },
  { value: '60d', label: 'Últ. 60 dias' },
  { value: '90d', label: 'Últ. 90 dias' },
];

// Rotulo amigavel da janela comp (pra exibicao no tooltip).
// numero -> "últ. N jogos" | tempo -> "últ. 7d"
function _labelJanelaComp(j) {
  if (j === 0 || j === '0') return 'todas';
  if (typeof j === 'string' && /^\d+[hd]$/i.test(j.trim())) return `últ. ${j}`;
  return `últ. ${j} jogos`;
}

const TIPOS_HISTORICO = [
  { value: 'all', label: 'Todas' },
  { value: 'specific_teams', label: 'Times Específicos' },
  { value: 'same_grade', label: 'Mesma grade' },
];

const BASES_DADOS = [
  { value: 'match', label: 'Histórico de confronto' },
  { value: 'individual', label: 'Histórico individual' },
];

// v11: alvo do filtro INDIVIDUAL no handicap — quem precisa passar no WR.
// 'zebra' (default) = só o lado apostado; 'ambos' = zebra E favorito.
// Ignorado no over/under (lá a regra AND dos dois jogadores é fixa).
const INDIV_ALVOS = [
  { value: 'zebra', label: 'Só a zebra' },
  { value: 'ambos', label: 'Zebra + favorito' },
];


// ============================================================
// COMPONENTES BASE
// ============================================================

function MikeSelect({ value, onChange, options, placeholder = '', disabled = false }) {
  const [aberto, setAberto] = useState(false);
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  const dropRef = useRef(null);

  const fechar = () => {
    setAberto(false);
    document.body.classList.remove('mike-no-scroll');
  };

  const abrirDropdown = () => {
    if (disabled) return;
    if (aberto) { fechar(); return; }
    const rect = btnRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    if (spaceBelow < 268) {
      setPos({ top: 'auto', bottom: window.innerHeight - rect.top + 4, left: rect.left, width: rect.width });
    } else {
      setPos({ top: rect.bottom + 4, bottom: 'auto', left: rect.left, width: rect.width });
    }
    setAberto(true);
    document.body.classList.add('mike-no-scroll');
  };

  useEffect(() => {
    if (!aberto) return;
    const handler = (e) => {
      if (btnRef.current?.contains(e.target)) return;
      if (dropRef.current?.contains(e.target)) return;
      fechar();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [aberto]);

  useEffect(() => () => document.body.classList.remove('mike-no-scroll'), []);

  const opcaoSelecionada = options.find((o) => o.value === value);

  return (
    <div className="relative w-full">
      <button
        ref={btnRef}
        onClick={abrirDropdown}
        disabled={disabled}
        className={`mike-border-thin w-full flex items-center justify-between px-3 py-2 rounded-md bg-transparent text-xs transition gap-2 ${
          disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:border-[--mike-accent]/40'
        }`}
      >
        <span className={opcaoSelecionada ? 'text-[--mike-fg] truncate' : 'text-[--mike-fg-muted] truncate'}>
          {opcaoSelecionada ? opcaoSelecionada.label : (placeholder || ' ')}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-[--mike-fg-muted] flex-shrink-0 transition-transform ${aberto ? 'rotate-180' : ''}`} />
      </button>
      {aberto && pos && (
        <div
          ref={dropRef}
          className="mike-mercados-scroll mike-dropdown-in fixed z-[9999] rounded-md overflow-y-auto"
          style={{
            top: pos.top,
            bottom: pos.bottom,
            left: pos.left,
            width: pos.width,
            backgroundColor: '#0d1220',
            border: '0.5px solid rgba(60, 85, 130, 0.4)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
            maxHeight: '260px',
          }}
        >
          {options.map((o) => {
            const ativo = o.value === value;
            return (
              <button
                key={o.value}
                onClick={() => { onChange(o.value); fechar(); }}
                className="mike-option w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors"
                data-ativo={ativo ? 'true' : 'false'}
              >
                <span className="truncate">{o.label}</span>
                {ativo && <Check className="w-3 h-3 flex-shrink-0 ml-2" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}


function Switch({ ativo, onChange, disabled = false }) {
  return (
    <button
      onClick={() => !disabled && onChange(!ativo)}
      disabled={disabled}
      className={`relative w-9 h-5 rounded-full flex-shrink-0 ${
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
      }`}
      style={{
        backgroundColor: ativo ? '#10b981' : '#4a5470',
        transition: 'background-color 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: ativo ? '0 0 12px rgba(16, 185, 129, 0.4)' : 'none',
      }}
    >
      <div
        className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm"
        style={{
          left: ativo ? '18px' : '2px',
          transition: 'left 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease',
          boxShadow: ativo ? '0 2px 6px rgba(16, 185, 129, 0.5), 0 1px 2px rgba(0,0,0,0.2)' : '0 1px 2px rgba(0,0,0,0.2)',
        }}
      />
    </button>
  );
}

// Pill com label - cinza quando inativo, verde quando ativo
function PillLabel({ texto, ativo, info }) {
  const [hoverInfo, setHoverInfo] = useState(false);
  return (
    <div
      className="relative inline-flex items-center gap-1 px-3 py-1.5 rounded text-[11px] font-bold"
      style={{
        backgroundColor: ativo ? '#10b981' : '#4a5470',
        color: ativo ? '#ffffff' : 'rgba(255,255,255,0.85)',
        transition: 'background-color 0.3s cubic-bezier(0.4, 0, 0.2, 1), color 0.3s ease, box-shadow 0.3s ease',
        boxShadow: ativo ? '0 2px 8px rgba(16, 185, 129, 0.25)' : 'none',
      }}
    >
      {texto}
      {info && (
        <span
          className="opacity-70 cursor-help relative"
          onMouseEnter={() => setHoverInfo(true)}
          onMouseLeave={() => setHoverInfo(false)}
        >
          <Info className="w-3 h-3" />
          {hoverInfo && (
            <div
              className="mike-tooltip-in absolute z-50 left-1/2 bottom-full mb-2 -translate-x-1/2 rounded-md px-3 py-2 text-left shadow-2xl"
              style={{
                backgroundColor: '#0d1220',
                border: '0.5px solid rgba(16, 185, 129, 0.5)',
                width: '220px',
                whiteSpace: 'normal',
              }}
            >
              <p className="text-[10px] text-[--mike-fg-soft] leading-relaxed normal-case font-normal">
                {info}
              </p>
              <div
                className="absolute left-1/2 -translate-x-1/2 w-0 h-0"
                style={{
                  top: '100%',
                  borderLeft: '5px solid transparent',
                  borderRight: '5px solid transparent',
                  borderTop: '5px solid #0d1220',
                }}
              />
            </div>
          )}
        </span>
      )}
    </div>
  );
}

// Range slider duplo (2 thumbs) com tooltip no hover/drag
function RangeSlider({ min, max, step = 0.5, value, onChange, sufixoMin = '', sufixoMax = '', disabled = false }) {
  const [vMin, vMax] = value;
  const [hover, setHover] = useState(false);
  const [arrastandoMin, setArrastandoMin] = useState(false);
  const [arrastandoMax, setArrastandoMax] = useState(false);
  const mostrarTooltips = hover || arrastandoMin || arrastandoMax;

  const handleMin = (e) => {
    const novo = parseFloat(e.target.value);
    if (novo <= vMax) onChange([novo, vMax]);
  };
  const handleMax = (e) => {
    const novo = parseFloat(e.target.value);
    if (novo >= vMin) onChange([vMin, novo]);
  };

  const pctMin = ((vMin - min) / (max - min)) * 100;
  const pctMax = ((vMax - min) / (max - min)) * 100;

  return (
    <div className={`flex items-center gap-3 w-full mike-transition-all ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
      <input
        type="number"
        value={vMin}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!isNaN(v)) onChange([v, vMax]);
        }}
        className="mike-border-thin w-14 px-2 py-1 rounded text-xs text-center bg-transparent text-[--mike-fg] outline-none mike-no-spin"
      />
      <div
        className="relative flex-1 h-6 flex items-center"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        <div className="absolute inset-x-0 h-1 rounded-full bg-[#3a4258]" />
        <div
          className="absolute h-1 rounded-full"
          style={{ left: `${pctMin}%`, right: `${100 - pctMax}%`, backgroundColor: '#10b981' }}
        />
        {/* Tooltip flutuante MIN */}
        {mostrarTooltips && (
          <div
            className="mike-slider-tooltip-in absolute pointer-events-none"
            style={{ left: `${pctMin}%`, top: '-22px', transform: 'translateX(-50%)' }}
          >
            <div
              className="px-1.5 py-0.5 rounded text-[10px] font-bold font-mono text-white shadow-md whitespace-nowrap relative"
              style={{ backgroundColor: '#374151' }}
            >
              {vMin}
              <div
                className="absolute left-1/2 -translate-x-1/2 w-0 h-0"
                style={{
                  top: '100%',
                  borderLeft: '4px solid transparent',
                  borderRight: '4px solid transparent',
                  borderTop: '4px solid #374151',
                }}
              />
            </div>
          </div>
        )}
        {/* Tooltip flutuante MAX */}
        {mostrarTooltips && (
          <div
            className="mike-slider-tooltip-in absolute pointer-events-none"
            style={{ left: `${pctMax}%`, top: '-22px', transform: 'translateX(-50%)' }}
          >
            <div
              className="px-1.5 py-0.5 rounded text-[10px] font-bold font-mono text-white shadow-md whitespace-nowrap relative"
              style={{ backgroundColor: '#374151' }}
            >
              {vMax}
              <div
                className="absolute left-1/2 -translate-x-1/2 w-0 h-0"
                style={{
                  top: '100%',
                  borderLeft: '4px solid transparent',
                  borderRight: '4px solid transparent',
                  borderTop: '4px solid #374151',
                }}
              />
            </div>
          </div>
        )}
        <input
          type="range" min={min} max={max} step={step} value={vMin} onChange={handleMin}
          onMouseDown={() => setArrastandoMin(true)}
          onMouseUp={() => setArrastandoMin(false)}
          onTouchStart={() => setArrastandoMin(true)}
          onTouchEnd={() => setArrastandoMin(false)}
          className="mike-range-thumb absolute inset-x-0 w-full pointer-events-auto"
        />
        <input
          type="range" min={min} max={max} step={step} value={vMax} onChange={handleMax}
          onMouseDown={() => setArrastandoMax(true)}
          onMouseUp={() => setArrastandoMax(false)}
          onTouchStart={() => setArrastandoMax(true)}
          onTouchEnd={() => setArrastandoMax(false)}
          className="mike-range-thumb absolute inset-x-0 w-full pointer-events-auto"
        />
      </div>
      <input
        type="number"
        value={vMax}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!isNaN(v)) onChange([vMin, v]);
        }}
        className="mike-border-thin w-14 px-2 py-1 rounded text-xs text-center bg-transparent text-[--mike-fg] outline-none mike-no-spin"
      />
    </div>
  );
}

// Slider simples (1 thumb) com sufixo + tooltip flutuante (so no hover/drag)
function SingleSlider({ min, max, step = 1, value, onChange, sufixoMin = null, sufixoMax = null, disabled = false }) {
  const [hover, setHover] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const pct = ((value - min) / (max - min)) * 100;
  const mostrarTooltip = hover || arrastando;
  return (
    <div className={`flex items-center gap-3 w-full mike-transition-all ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
      <span className="text-[10px] text-[--mike-fg-muted] font-mono w-8 text-right">
        {sufixoMin !== null ? sufixoMin : min}
      </span>
      <div
        className="relative flex-1 h-6 flex items-center"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        {/* Track */}
        <div className="absolute inset-x-0 h-1 rounded-full bg-[#3a4258]" />
        {/* Range ativo */}
        <div className="absolute h-1 rounded-full" style={{ width: `${pct}%`, backgroundColor: '#10b981' }} />
        {/* Tooltip flutuante - so quando hover ou arrastando */}
        {mostrarTooltip && (
          <div
            className="mike-slider-tooltip-in absolute pointer-events-none"
            style={{
              left: `${pct}%`,
              top: '-22px',
              transform: 'translateX(-50%)',
            }}
          >
            <div
              className="px-1.5 py-0.5 rounded text-[10px] font-bold font-mono text-white shadow-md whitespace-nowrap relative"
              style={{ backgroundColor: '#374151' }}
            >
              {value}
              <div
                className="absolute left-1/2 -translate-x-1/2 w-0 h-0"
                style={{
                  top: '100%',
                  borderLeft: '4px solid transparent',
                  borderRight: '4px solid transparent',
                  borderTop: '4px solid #374151',
                }}
              />
            </div>
          </div>
        )}
        {/* Input range */}
        <input
          type="range"
          min={min} max={max} step={step} value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          onMouseDown={() => setArrastando(true)}
          onMouseUp={() => setArrastando(false)}
          onTouchStart={() => setArrastando(true)}
          onTouchEnd={() => setArrastando(false)}
          className="mike-range-thumb absolute inset-x-0 w-full"
        />
      </div>
      <span className="text-[10px] text-[--mike-fg-muted] font-mono w-12">
        {sufixoMax !== null ? sufixoMax : max}
      </span>
    </div>
  );
}

// Linha de filtro com toggle + pill + conteúdo
function LinhaFiltro({ ativo, onToggle, label, info, children, comToggle = true, comAcoes = false, onCopiar, onColar, labelLargura = 'w-44' }) {
  // Quando nao tem toggle, o filtro esta sempre ativo (verde permanente)
  const pillAtivo = comToggle ? ativo : true;
  return (
    <div className="flex items-center gap-2 mb-1.5">
      {/* Toggle (bolinha) */}
      {comToggle ? (
        <Switch ativo={ativo} onChange={onToggle} />
      ) : (
        <div className="w-9 flex-shrink-0" />
      )}

      {/* Pill com label */}
      <div className={`${labelLargura} flex-shrink-0`}>
        <PillLabel texto={label} ativo={pillAtivo} info={info} />
      </div>

      {/* Conteúdo */}
      <div className={`flex-1 min-w-0 mike-transition-all ${comToggle && !ativo ? 'opacity-40 pointer-events-none' : ''}`}>
        {children}
      </div>

      {/* Ações copiar/colar */}
      {comAcoes && (
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={onCopiar} className="p-1 text-[--mike-fg-muted] hover:text-[--mike-accent] transition" title="Copiar">
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button onClick={onColar} className="p-1 text-[--mike-fg-muted] hover:text-[--mike-accent] transition" title="Colar">
            <Clipboard className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

// Header

function SecaoForm({ titulo, descricao, children }) {
  return (
    <section className="mb-6 pb-6" style={{ borderBottom: '0.5px solid rgba(60, 85, 130, 0.2)' }}>
      <div className="text-center mb-4">
        <h2 className="text-base font-bold text-[--mike-fg] mb-1">{titulo}</h2>
        {descricao && <p className="text-[11px] text-[--mike-fg-muted] max-w-3xl mx-auto leading-relaxed">{descricao}</p>}
      </div>
      <div>{children}</div>
    </section>
  );
}

// Collapse - container que abre/fecha suavemente medindo a altura real
function Collapse({ aberto, children }) {
  const ref = useRef(null);
  const [altura, setAltura] = useState(0);
  const [renderizar, setRenderizar] = useState(aberto);

  useEffect(() => {
    if (aberto) {
      setRenderizar(true);
      // Espera o DOM montar pra medir
      requestAnimationFrame(() => {
        if (ref.current) {
          const h = ref.current.scrollHeight;
          setAltura(h);
        }
      });
    } else {
      // Captura altura atual antes de colapsar
      if (ref.current) {
        const h = ref.current.scrollHeight;
        setAltura(h);
        // Forca reflow pra browser registrar altura, depois anima pra 0
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setAltura(0));
        });
      } else {
        setAltura(0);
      }
    }
  }, [aberto]);

  // Recalcula quando o conteudo interno muda de tamanho (ResizeObserver)
  useEffect(() => {
    if (!aberto || !ref.current) return;
    const obs = new ResizeObserver(() => {
      if (ref.current && aberto) {
        setAltura(ref.current.scrollHeight);
      }
    });
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [aberto, renderizar]);

  // Apos animar pra 0, desmonta o conteudo
  const handleTransitionEnd = (e) => {
    if (e.propertyName !== 'height') return;
    if (!aberto) setRenderizar(false);
  };

  if (!renderizar && !aberto) return null;

  return (
    <div
      className="mike-collapse-wrapper"
      style={{
        height: aberto ? `${altura}px` : '0px',
        opacity: aberto ? 1 : 0,
      }}
      onTransitionEnd={handleTransitionEnd}
    >
      <div ref={ref}>{children}</div>
    </div>
  );
}

// MultiTagInput (torneios, players, times)
function MultiTagInput({ valores, onChange, opcoes, placeholder = '' }) {
  const [aberto, setAberto] = useState(false);
  const [filtro, setFiltro] = useState('');
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setAberto(false);
    };
    if (aberto) {
      document.addEventListener('mousedown', handler);
      return () => document.removeEventListener('mousedown', handler);
    }
  }, [aberto]);

  const remover = (v) => onChange(valores.filter((x) => x !== v));
  const adicionar = (v) => {
    if (!valores.includes(v)) onChange([...valores, v]);
    setFiltro('');
  };

  const opcoesFiltradas = opcoes.filter((o) =>
    !valores.includes(o) && o.toLowerCase().includes(filtro.toLowerCase())
  );

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div
        onClick={() => setAberto(true)}
        className="mike-border-thin w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-transparent cursor-text min-h-[34px] flex-wrap"
      >
        {valores.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-[--mike-accent]/15 text-[--mike-accent] border border-[--mike-accent]/30">
            {v}
            <button onClick={(e) => { e.stopPropagation(); remover(v); }} className="hover:text-rose-400 transition">
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={filtro}
          onChange={(e) => { setFiltro(e.target.value); setAberto(true); }}
          placeholder={valores.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[100px] bg-transparent text-xs text-[--mike-fg] placeholder:text-[--mike-fg-muted] outline-none"
        />
      </div>
      {aberto && opcoesFiltradas.length > 0 && (
        <div className="mike-mercados-scroll mike-dropdown-in absolute z-40 left-0 right-0 mt-1 rounded-md overflow-y-auto"
          style={{
            backgroundColor: '#0d1220',
            border: '0.5px solid rgba(60, 85, 130, 0.4)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
            maxHeight: '220px',
          }}
        >
          {opcoesFiltradas.map((o) => (
            <button key={o} onClick={() => adicionar(o)}
              className="w-full px-3 py-2 text-xs text-left text-[--mike-fg-soft] hover:bg-[--mike-card-2]/50 hover:text-[--mike-fg] transition">
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Radio group horizontal (Todas / ≤30% / ≥70%)
function RadioGroup({ value, onChange, options, disabled = false }) {
  return (
    <div className={`flex items-center gap-4 mike-transition-all ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
      {options.map((o) => (
        <label key={o.value} className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="radio"
            checked={value === o.value}
            onChange={() => onChange(o.value)}
            className="mike-radio"
          />
          <span className="text-xs text-[--mike-fg-soft]">{o.label}</span>
        </label>
      ))}
    </div>
  );
}

// ChipFiltro - chip removivel com tooltip de detalhes
function ChipFiltro({ index, detalhes, onRemover, hover, onHoverChange }) {
  const isHover = hover === index;
  return (
    <div
      className="mike-chip-in relative inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold transition cursor-pointer"
      style={{
        backgroundColor: 'rgba(60, 85, 130, 0.25)',
        border: '0.5px solid rgba(60, 85, 130, 0.5)',
        color: '#b8c0d4',
      }}
      onMouseEnter={() => onHoverChange(index)}
      onMouseLeave={() => onHoverChange(null)}
    >
      <Edit2 className="w-2.5 h-2.5" />
      <span>Filter {index + 1}</span>
      <button
        onClick={(e) => { e.stopPropagation(); onRemover(); }}
        className="hover:text-rose-400 transition flex items-center"
      >
        <X className="w-3 h-3" />
      </button>

      {isHover && (
        <div
          className="mike-tooltip-in absolute z-50 left-0 top-full mt-2 rounded-lg p-3 text-left whitespace-nowrap shadow-2xl"
          style={{
            backgroundColor: '#0d1220',
            border: '0.5px solid rgba(16, 185, 129, 0.5)',
            minWidth: '240px',
          }}
        >
          <div className="text-[10px] font-bold text-[--mike-accent] mb-1.5 uppercase tracking-wider">
            Detalhes Filter {index + 1}
          </div>
          <div className="space-y-1 text-[10px]">
            {detalhes.map((d, i) => (
              <div key={i} className="flex justify-between gap-3">
                <span className="text-[--mike-fg-muted]">{d.label}:</span>
                <span className="text-[--mike-fg] font-semibold">{d.valor}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// LinhaCampoHist - linha de campo dentro das caixas de historico (pill + conteudo, sem toggle)
function LinhaCampoHist({ label, children }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-32 flex-shrink-0">
        <PillLabel texto={label} ativo={true} />
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

// BlocoFiltrosHistorico - componente reutilizavel para a caixa cinza
// Usado em "Filtros de historico" (dentro de Mercados) e "Filtros complementares"
function BlocoFiltrosHistorico({
  titulo,
  campos,           // array de { tipo, label, value, onChange, options? }
  filtrosAdicionados,
  onAdicionar,
  onRemover,
  hover,
  onHoverChange,
  detalhesParaTooltip,  // funcao (filtro, idx) => array de { label, valor }
  limiteFiltros = null, // null = sem limite
  onAddBlocked,         // callback quando atinge o limite
  semBackground = false,
}) {
  return (
    <div
      className={semBackground ? '' : 'mt-6 rounded-lg p-4'}
      style={semBackground ? {} : {
        backgroundColor: 'rgba(60, 85, 130, 0.08)',
        border: '0.5px solid rgba(60, 85, 130, 0.4)',
      }}
    >
      {titulo && <h3 className="text-xs font-bold text-[--mike-fg] mb-2">{titulo}</h3>}

      {/* CHIPS de filtros adicionados */}
      {filtrosAdicionados.length > 0 && (
        <div className="mb-4">
          <p className="text-[10px] text-[--mike-fg-muted] mb-1.5">
            Filtros ativos (clique ou passe o mouse para ver os detalhes)
          </p>
          <div className="flex flex-wrap gap-1.5">
            {filtrosAdicionados.map((f, idx) => (
              <ChipFiltro
                key={idx}
                index={idx}
                detalhes={detalhesParaTooltip(f, idx)}
                onRemover={() => onRemover(idx)}
                hover={hover}
                onHoverChange={onHoverChange}
              />
            ))}
          </div>
        </div>
      )}

      {/* CAMPOS */}
      <div className="space-y-2">
        {campos.map((c, i) => (
          <LinhaCampoHist key={i} label={c.label}>
            {c.tipo === 'select' && (
              <MikeSelect value={c.value} onChange={c.onChange} options={c.options} />
            )}
            {c.tipo === 'slider' && (
              <SingleSlider
                min={c.min} max={c.max} step={c.step || 1}
                value={c.value} onChange={c.onChange}
                sufixoMin={c.value} sufixoMax={c.sufixoMax || c.max}
              />
            )}
            {c.tipo === 'range' && (
              <RangeSlider
                min={c.min} max={c.max} step={c.step || 1}
                value={c.value} onChange={c.onChange}
              />
            )}
            {c.tipo === 'toggle_input' && (
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 cursor-pointer flex-shrink-0">
                  <input type="checkbox" className="mike-checkbox" checked={!!c.ativo} onChange={(e) => c.onToggle(e.target.checked)} />
                  <span className="text-[10px] text-[--mike-fg-soft]">Ativar</span>
                </label>
                <input type="number" placeholder={c.placeholder || ''}
                  value={c.value ?? ''}
                  disabled={!c.ativo}
                  onChange={(e) => c.onChange(e.target.value === '' ? null : parseFloat(e.target.value))}
                  className="mike-border-thin w-24 px-2 py-1.5 rounded text-xs text-center bg-transparent text-[--mike-fg] outline-none mike-no-spin"
                  style={{ opacity: c.ativo ? 1 : 0.4 }} />
                {!c.ativo && <span className="text-[10px]" style={{ color: '#10b981' }}>auto</span>}
              </div>
            )}
          </LinhaCampoHist>
        ))}
      </div>

      {/* BOTAO ADICIONAR */}
      <div className="flex justify-end mt-3">
        <button
          onClick={() => {
            if (limiteFiltros && filtrosAdicionados.length >= limiteFiltros) {
              if (onAddBlocked) onAddBlocked();
              return;
            }
            onAdicionar();
          }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-md text-[11px] font-bold uppercase tracking-wider text-white shadow-md transition-transform duration-200 hover:scale-105 active:scale-95"
          style={{
            backgroundColor: '#10b981',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)',
          }}
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={3} />
          Adicionar Filtros
        </button>
      </div>
    </div>
  );
}

// ============================================================
// FILTRAR PARTIDAS — caixa verde (apenas) ou rosa (ignorar)
// ============================================================

// Helper: formatar uma combinação adicionada como string legível
// Ex: "Abyssal (H2H GG League)(Aston Villa) x (Arsenal)Apollo (H2H GG League)"
function formatarCombinacao(c) {
  const torneio = c.torneio || '';
  const lado1 = [];
  const lado2 = [];
  // Cada jogador leva o torneio entre parênteses logo após o nome
  if (c.j1) lado1.push(torneio ? `${c.j1} (${torneio})` : c.j1);
  if (c.t1) lado1.push(`(${c.t1})`);
  if (c.j2) lado2.push(torneio ? `${c.j2} (${torneio})` : c.j2);
  if (c.t2) lado2.push(`(${c.t2})`);

  const l1 = lado1.join('');
  const l2 = lado2.join('');

  if (l1 && l2) return `${l1} x ${l2}`;
  if (l1) return l1;
  if (l2) return l2;
  return '(vazio)';
}

function CaixaFiltrarPartidas({ cor, titulo, ativo, onToggle, jogadores, times, carregando, estado, onChange, torneioNome }) {
  const isVerde = cor === 'verde';
  const corPrimaria = isVerde ? '#10b981' : '#f43f5e';
  const corBg = ativo
    ? (isVerde ? 'rgba(16, 185, 129, 0.08)' : 'rgba(244, 63, 94, 0.08)')
    : 'transparent';
  const corBorda = ativo
    ? (isVerde ? 'rgba(16, 185, 129, 0.5)' : 'rgba(244, 63, 94, 0.5)')
    : (isVerde ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)');

  const opcoesJogadores = jogadores.map(j => ({ value: j, label: j }));
  const opcoesTimes = times.map(t => ({ value: t, label: t }));
  const setField = (field, value) => onChange({ ...estado, [field]: value });

  // Função: adicionar combinação atual à lista de adicionadas
  const adicionarCombinacao = () => {
    // Pelo menos 1 campo precisa estar preenchido + ativo
    const j1Valido = estado.j1Ativo && estado.j1;
    const j2Valido = estado.j2Ativo && estado.j2;
    const t1Valido = estado.t1Ativo && estado.t1;
    const t2Valido = estado.t2Ativo && estado.t2;
    if (!j1Valido && !j2Valido && !t1Valido && !t2Valido) return;

    const nova = {
      j1: j1Valido ? estado.j1 : '',
      j2: j2Valido ? estado.j2 : '',
      t1: t1Valido ? estado.t1 : '',
      t2: t2Valido ? estado.t2 : '',
      fixarJ1Casa: estado.fixarJ1Casa,
      fixarJ2Visit: estado.fixarJ2Visit,
      direcao: estado.direcao,
      torneio: torneioNome || '',
    };

    // Resetar campos do form, mantendo a lista
    onChange({
      ...estado,
      j1: '', j2: '', t1: '', t2: '',
      j1Ativo: false, j2Ativo: false, t1Ativo: false, t2Ativo: false,
      fixarJ1Casa: false, fixarJ2Visit: false,
      direcao: 'todas',
      adicionadas: [...(estado.adicionadas || []), nova],
    });
  };

  const removerAdicionada = (idx) => {
    onChange({
      ...estado,
      adicionadas: (estado.adicionadas || []).filter((_, i) => i !== idx),
    });
  };

  const limparTodasAdicionadas = () => {
    onChange({ ...estado, adicionadas: [] });
  };

  // Pelo menos 1 ativo + valor pra habilitar botão
  const podeAdicionar = (estado.j1Ativo && estado.j1) || (estado.j2Ativo && estado.j2)
                    || (estado.t1Ativo && estado.t1) || (estado.t2Ativo && estado.t2);

  const adicionadas = estado.adicionadas || [];

  return (
    <div className="rounded-lg p-4 space-y-3" style={{ backgroundColor: corBg, border: `0.5px solid ${corBorda}` }}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold" style={{ color: corPrimaria }}>{titulo}</span>
        <Switch ativo={ativo} onChange={onToggle} />
      </div>
      <Collapse aberto={ativo}>
        <div className="pt-3 space-y-3">
          <p className="text-[10px] leading-relaxed" style={{ color: '#6b7691' }}>
            Você pode adicionar um jogador ou um time sozinho, além de todas as combinações possíveis.
          </p>

          {carregando && (
            <div className="flex items-center gap-2 text-[10px]" style={{ color: '#6b7691' }}>
              <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3"/>
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
              </svg>
              Carregando participantes...
            </div>
          )}

          {/* Jogador 1 */}
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 flex-shrink-0 cursor-pointer">
              <input type="checkbox" className="mike-checkbox" checked={estado.j1Ativo} onChange={(e) => setField('j1Ativo', e.target.checked)} />
              <span className="text-[10px] font-bold px-2 py-1 rounded text-white" style={{ backgroundColor: corPrimaria, minWidth: 64, textAlign: 'center' }}>Jogador 1</span>
            </label>
            <div className={`flex-1 mike-transition-all ${!estado.j1Ativo ? 'opacity-40 pointer-events-none' : ''}`}>
              <MikeSelect value={estado.j1} onChange={(v) => setField('j1', v)} options={[{ value: '', label: 'Selecione...' }, ...opcoesJogadores]} disabled={!estado.j1Ativo} />
            </div>
            <button onClick={() => setField('j1', '')} className="p-1 text-[--mike-fg-muted] hover:text-rose-400 transition flex-shrink-0" title="Limpar"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>

          {/* Jogador 2 */}
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 flex-shrink-0 cursor-pointer">
              <input type="checkbox" className="mike-checkbox" checked={estado.j2Ativo} onChange={(e) => setField('j2Ativo', e.target.checked)} />
              <span className="text-[10px] font-bold px-2 py-1 rounded text-white" style={{ backgroundColor: corPrimaria, minWidth: 64, textAlign: 'center' }}>Jogador 2</span>
            </label>
            <div className={`flex-1 mike-transition-all ${!estado.j2Ativo ? 'opacity-40 pointer-events-none' : ''}`}>
              <MikeSelect value={estado.j2} onChange={(v) => setField('j2', v)} options={[{ value: '', label: 'Selecione...' }, ...opcoesJogadores]} disabled={!estado.j2Ativo} />
            </div>
            <button onClick={() => setField('j2', '')} className="p-1 text-[--mike-fg-muted] hover:text-rose-400 transition flex-shrink-0" title="Limpar"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>

          {/* Time 1 */}
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 flex-shrink-0 cursor-pointer">
              <input type="checkbox" className="mike-checkbox" checked={estado.t1Ativo} onChange={(e) => setField('t1Ativo', e.target.checked)} />
              <span className="text-[10px] font-bold px-2 py-1 rounded text-white" style={{ backgroundColor: corPrimaria, minWidth: 64, textAlign: 'center' }}>Time 1</span>
            </label>
            <div className={`flex-1 mike-transition-all ${!estado.t1Ativo ? 'opacity-40 pointer-events-none' : ''}`}>
              <MikeSelect value={estado.t1} onChange={(v) => setField('t1', v)} options={[{ value: '', label: 'Selecione...' }, ...opcoesTimes]} disabled={!estado.t1Ativo} />
            </div>
            <button onClick={() => setField('t1', '')} className="p-1 text-[--mike-fg-muted] hover:text-rose-400 transition flex-shrink-0" title="Limpar"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>

          {/* Time 2 */}
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 flex-shrink-0 cursor-pointer">
              <input type="checkbox" className="mike-checkbox" checked={estado.t2Ativo} onChange={(e) => setField('t2Ativo', e.target.checked)} />
              <span className="text-[10px] font-bold px-2 py-1 rounded text-white" style={{ backgroundColor: corPrimaria, minWidth: 64, textAlign: 'center' }}>Time 2</span>
            </label>
            <div className={`flex-1 mike-transition-all ${!estado.t2Ativo ? 'opacity-40 pointer-events-none' : ''}`}>
              <MikeSelect value={estado.t2} onChange={(v) => setField('t2', v)} options={[{ value: '', label: 'Selecione...' }, ...opcoesTimes]} disabled={!estado.t2Ativo} />
            </div>
            <button onClick={() => setField('t2', '')} className="p-1 text-[--mike-fg-muted] hover:text-rose-400 transition flex-shrink-0" title="Limpar"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>

          {/* Fixar como casa/visitante */}
          <div className="space-y-1.5 pt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="mike-checkbox" checked={estado.fixarJ1Casa} onChange={(e) => setField('fixarJ1Casa', e.target.checked)} />
              <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ backgroundColor: isVerde ? 'rgba(16,185,129,0.15)' : 'rgba(244,63,94,0.15)', color: corPrimaria, border: `0.5px solid ${corPrimaria}40` }}>Fixar Jogador 1/Time 1 como casa</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="mike-checkbox" checked={estado.fixarJ2Visit} onChange={(e) => setField('fixarJ2Visit', e.target.checked)} />
              <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ backgroundColor: isVerde ? 'rgba(16,185,129,0.15)' : 'rgba(244,63,94,0.15)', color: corPrimaria, border: `0.5px solid ${corPrimaria}40` }}>Fixar Jogador 2/Time 2 como visitante</span>
            </label>
          </div>

          {/* Radio Todas / Somente a favor da 1a posição / Somente a favor da 2a posição */}
          <div className="space-y-1 pt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" className="mike-radio" checked={estado.direcao === 'todas'} onChange={() => setField('direcao', 'todas')} />
              <span className="text-xs text-[--mike-fg-soft]">Todas</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" className="mike-radio" checked={estado.direcao === 'somente_1a'} onChange={() => setField('direcao', 'somente_1a')} />
              <span className="text-xs text-[--mike-fg-soft]">Somente a favor da 1ª posição</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" className="mike-radio" checked={estado.direcao === 'somente_2a'} onChange={() => setField('direcao', 'somente_2a')} />
              <span className="text-xs text-[--mike-fg-soft]">Somente a favor da 2ª posição</span>
            </label>
          </div>

          {/* Botões */}
          <div className="flex items-center justify-between pt-1">
            <button
              onClick={() => onChange({ ...estado, j1: '', j2: '', t1: '', t2: '', j1Ativo: false, j2Ativo: false, t1Ativo: false, t2Ativo: false, fixarJ1Casa: false, fixarJ2Visit: false, direcao: 'todas' })}
              className="text-[10px] font-bold transition hover:opacity-80"
              style={{ color: corPrimaria }}
            >
              LIMPAR CAMPOS
            </button>
            <button
              onClick={adicionarCombinacao}
              disabled={!podeAdicionar}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-bold text-white transition hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
              style={{ backgroundColor: corPrimaria, boxShadow: podeAdicionar ? `0 4px 12px ${corPrimaria}40` : 'none' }}
            >
              <Plus className="w-3 h-3" strokeWidth={3} />
              ADICIONAR
            </button>
          </div>

          {/* Lista de Adicionadas */}
          {adicionadas.length > 0 && (
            <div className="rounded-md p-3 mt-3" style={{
              backgroundColor: 'rgba(255,255,255,0.04)',
              border: '0.5px solid rgba(255,255,255,0.08)',
            }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-[--mike-fg]">
                  Adicionadas ({adicionadas.length})
                </span>
                <button
                  onClick={limparTodasAdicionadas}
                  className="text-[9px] font-bold uppercase transition hover:opacity-80"
                  style={{ color: corPrimaria }}
                >
                  LIMPAR LISTA
                </button>
              </div>
              <div className="space-y-1">
                {adicionadas.map((c, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 group rounded px-2 py-1 transition hover:bg-white/5"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] text-[--mike-fg] leading-relaxed break-words">
                        {formatarCombinacao(c)}
                      </div>
                      {(c.fixarJ1Casa || c.fixarJ2Visit || c.direcao !== 'todas') && (
                        <div className="text-[9px] text-[--mike-fg-muted] mt-0.5">
                          {c.fixarJ1Casa && <span className="mr-2">📌 1ª como casa</span>}
                          {c.fixarJ2Visit && <span className="mr-2">📌 2ª como visitante</span>}
                          {c.direcao === 'somente_1a' && <span>→ só a favor da 1ª</span>}
                          {c.direcao === 'somente_2a' && <span>→ só a favor da 2ª</span>}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => removerAdicionada(idx)}
                      className="p-1 text-[--mike-fg-muted] hover:text-rose-400 transition flex-shrink-0 opacity-50 group-hover:opacity-100"
                      title="Remover"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Collapse>
    </div>
  );
}

// ============================================================
// API CLIENT + HOOKS (plug-and-play)
//
// 🔌 BACKEND: ver lib/BACKEND.md no projeto principal.
//   GET  /bots/:id  → busca bot pra editar
//   POST /bots      → cria bot
//   PATCH /bots/:id → edita bot
//
// Quando trocar pra HTTP real, basta mudar USE_MOCK = false.
// ============================================================

// ============================================================
// CaixaBlacklistJogador - lista simples de nicks (filtros 6 e 7 do HC)
// Espelha o visual do CaixaFiltrarPartidas, mas so uma lista de jogadores.
// estado = { adicionados: ['AMSTERDAM', ...] }
// ============================================================
function CaixaBlacklistJogador({ cor, titulo, descricao, ativo, onToggle, jogadores, carregando, estado, onChange }) {
  const isVerde = cor === 'verde';
  const corPrimaria = isVerde ? '#10b981' : '#f43f5e';
  const corBg = ativo
    ? (isVerde ? 'rgba(16, 185, 129, 0.08)' : 'rgba(244, 63, 94, 0.08)')
    : 'transparent';
  const corBorda = ativo
    ? (isVerde ? 'rgba(16, 185, 129, 0.5)' : 'rgba(244, 63, 94, 0.5)')
    : (isVerde ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)');

  const [sel, setSel] = useState('');
  const adicionados = estado.adicionados || [];
  const opcoesJogadores = jogadores
    .filter(j => !adicionados.includes(j))
    .map(j => ({ value: j, label: j }));

  const adicionar = () => {
    const v = (sel || '').trim();
    if (!v) return;
    if (adicionados.includes(v)) { setSel(''); return; }
    onChange({ ...estado, adicionados: [...adicionados, v] });
    setSel('');
  };
  const remover = (nick) => {
    onChange({ ...estado, adicionados: adicionados.filter(n => n !== nick) });
  };
  const limparTodos = () => onChange({ ...estado, adicionados: [] });

  return (
    <div className="rounded-lg p-4 space-y-3" style={{ backgroundColor: corBg, border: `0.5px solid ${corBorda}` }}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold" style={{ color: corPrimaria }}>{titulo}</span>
        <Switch ativo={ativo} onChange={onToggle} />
      </div>
      <Collapse aberto={ativo}>
        <div className="pt-3 space-y-3">
          {descricao && (
            <p className="text-[10px] leading-relaxed" style={{ color: '#6b7691' }}>{descricao}</p>
          )}

          {carregando && (
            <div className="flex items-center gap-2 text-[10px]" style={{ color: '#6b7691' }}>
              <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3"/>
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
              </svg>
              Carregando participantes...
            </div>
          )}

          <div className="flex items-center gap-2">
            <div className="flex-1">
              <MikeSelect value={sel} onChange={setSel} options={[{ value: '', label: 'Selecione um jogador...' }, ...opcoesJogadores]} />
            </div>
            <button
              onClick={adicionar}
              disabled={!sel}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-bold text-white transition hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
              style={{ backgroundColor: corPrimaria, boxShadow: sel ? `0 4px 12px ${corPrimaria}40` : 'none' }}
            >
              <Plus className="w-3 h-3" strokeWidth={3} />
              ADICIONAR
            </button>
          </div>

          {adicionados.length > 0 && (
            <div className="rounded-md p-3 mt-2" style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-[--mike-fg]">Adicionados ({adicionados.length})</span>
                <button onClick={limparTodos} className="text-[10px] font-bold transition hover:opacity-80" style={{ color: corPrimaria }}>LIMPAR</button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {adicionados.map((nick) => (
                  <span key={nick} className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold"
                    style={{ backgroundColor: isVerde ? 'rgba(16,185,129,0.15)' : 'rgba(244,63,94,0.15)', color: corPrimaria, border: `0.5px solid ${corPrimaria}40` }}>
                    {nick}
                    <button onClick={() => remover(nick)} className="hover:opacity-70" title="Remover">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </Collapse>
    </div>
  );
}

// ============================================================
// MAPEAMENTO formState ↔ payload do banco
// ============================================================
//
// O backend tem colunas dedicadas pros campos importantes (queryable via SQL)
// e uma coluna `filtros` JSONB que guarda o resto do formState pra reidratação
// fiel quando o usuário abrir o bot pra editar.
// ============================================================

function formStateToPayload(s) {
  // Campos diretos
  const payload = {
    nome: (s.nome || '').trim(),
    descricao: s.descricao || null,
    casa: s.casa,
    esporte: s.esporte,
    mercado: s.mercado,
  };

  // Torneios (whitelist) - EXPANDE pais em grades reais
  // O bot_executor faz match exato com tick.liga, entao precisa salvar as grades reais
  // nao o nome do pai (que eh apenas pra UI).
  if (s.torneioAtivo && Array.isArray(s.torneios) && s.torneios.length > 0) {
    // Se tem gradesAtivo + gradesSelecionadas (whitelist), usa as grades selecionadas
    if (s.gradesAtivo && s.gradesModo === 'whitelist'
        && Array.isArray(s.gradesSelecionadas) && s.gradesSelecionadas.length > 0) {
      payload.torneios = s.gradesSelecionadas;
    } else if (Array.isArray(s.torneiosReais) && s.torneiosReais.length > 0) {
      // Senao, expande cada pai em TODAS as suas grades reais
      const gradesExpandidas = [];
      for (const paiSelecionado of s.torneios) {
        const paiObj = s.torneiosReais.find(
          t => t.nome_pai === paiSelecionado || t.nome_pai_real === paiSelecionado
        );
        if (paiObj && paiObj.grades) {
          gradesExpandidas.push(...paiObj.grades.map(g => g.nome));
        } else {
          // Pai nao encontrado em torneiosReais (fallback hardcoded) - salva como veio
          gradesExpandidas.push(paiSelecionado);
        }
      }
      payload.torneios = gradesExpandidas;
    } else {
      // Sem torneiosReais (fallback) - salva nomes pai como veio
      payload.torneios = s.torneios;
    }
  }

  // Grades como blacklist → torneios_excluir
  if (s.gradesAtivo && s.gradesModo === 'blacklist'
      && Array.isArray(s.gradesSelecionadas) && s.gradesSelecionadas.length > 0) {
    payload.torneios_excluir = s.gradesSelecionadas;
  }

  // Linhas - so envia se o toggle 'linhaAtivo' estiver ON (ou ausente = legado)
  const linhaAtivoFlag = s.linhaAtivo === undefined ? true : !!s.linhaAtivo;
  if (linhaAtivoFlag) {
    if (s.linhaMin !== null && s.linhaMin !== undefined) payload.linha_min = s.linhaMin;
    if (s.linhaMax !== null && s.linhaMax !== undefined) payload.linha_max = s.linhaMax;
  }

  // Odds
  if (s.limitarOddsAtivo && Array.isArray(s.limitarOdds) && s.limitarOdds.length === 2) {
    payload.odd_min = s.limitarOdds[0];
    payload.odd_max = s.limitarOdds[1];
  }

  // Pares (combinações da seção Filtrar Partidas)
  const adicionadasApenas = s.apenasEspecificasEstado?.adicionadas || [];
  if (s.apenasEspecificasAtivo && adicionadasApenas.length > 0) {
    payload.whitelist_pares = adicionadasApenas;
  }
  const adicionadasIgnorar = s.ignorarEspecificasEstado?.adicionadas || [];
  if (s.ignorarEspecificasAtivo && adicionadasIgnorar.length > 0) {
    payload.blacklist_pares = adicionadasIgnorar;
  }

  // Blacklist de jogador (filtros 6 e 7 do HC): listas de nicks no filtros JSONB.
  // O bot_executor le filtros.blacklist_zebra / filtros.blacklist_favorito.
  const blZebra = s.blacklistZebraEstado?.adicionados || [];
  if (s.blacklistZebraAtivo && blZebra.length > 0) {
    payload.filtros_blacklist_zebra = blZebra;
  }
  const blFav = s.blacklistFavoritoEstado?.adicionados || [];
  if (s.blacklistFavoritoAtivo && blFav.length > 0) {
    payload.filtros_blacklist_favorito = blFav;
  }

  // Cenário da partida
  if (s.cenarioPartidaAtivo && s.cenarioPartida) {
    payload.whitelist_cenarios = [s.cenarioPartida];
  }

  // Max tips por jogo
  if (!s.evitarLinhasSeq && s.maxTipsPorJogo && s.maxTipsPorJogo !== 'ilimitado') {
    const n = parseInt(s.maxTipsPorJogo, 10);
    if (!isNaN(n)) payload.max_apostas_partida = n;
  }

  // Mapeia inner (UI: ['Over','Under']) -> lados (backend canonico: ['over','under'])
  // Backend usa minusculo, sem acentos. Bot_executor le filtros.lados pra filtrar
  // pelo lado da selecao do tick (over/under/sim/nao/casa/empate/fora/par/impar).
  const MAPA_INNER_LADO = {
    'Over': 'over', 'Under': 'under',
    'Sim': 'sim', 'Não': 'nao', 'Nao': 'nao',
    'Casa': 'casa', 'Empate': 'empate', 'Fora': 'fora',
    'Par': 'par', 'Ímpar': 'impar', 'Impar': 'impar',
  };

  // Lados (filtro de seleção) - só envia se o toggle 'selecaoAtivo' estiver ON
  const selecaoAtivoFlag = s.selecaoAtivo === undefined ? true : !!s.selecaoAtivo;
  const innerArr = Array.isArray(s.inner) ? s.inner : (s.inner ? [s.inner] : []);
  const lados = selecaoAtivoFlag
    ? innerArr
        .map(op => MAPA_INNER_LADO[op] || (typeof op === 'string' ? op.toLowerCase() : null))
        .filter(Boolean)
    : [];  // toggle OFF: lista vazia = bot aceita qualquer lado

  // filtros JSONB: backup de TODO o formState pra reidratação fiel ao editar
  // (permite recuperar fixarJ1Casa, gradesModo, filtros hist, comp, live, etc)
  payload.filtros = { ...s, lados };  // adiciona 'lados' (canonico) no JSONB
  // Filtros 6 e 7 do HC: grava as listas de nicks direto no JSONB que o
  // bot_executor le (filtros.blacklist_zebra / filtros.blacklist_favorito).
  if (payload.filtros_blacklist_zebra) {
    payload.filtros.blacklist_zebra = payload.filtros_blacklist_zebra;
    delete payload.filtros_blacklist_zebra;
  } else {
    delete payload.filtros.blacklist_zebra;
  }
  if (payload.filtros_blacklist_favorito) {
    payload.filtros.blacklist_favorito = payload.filtros_blacklist_favorito;
    delete payload.filtros_blacklist_favorito;
  } else {
    delete payload.filtros.blacklist_favorito;
  }

  return payload;
}

function botRowToFormState(row) {
  // Converte row do banco de volta pro formState (modo edição)
  // Estratégia: pega `filtros` JSONB que tem o formState completo;
  // sobrepoe com campos das colunas dedicadas (mais autoritativos).
  const base = (row.filtros && typeof row.filtros === 'object') ? { ...row.filtros } : {};

  // Campos dedicados sobrescrevem
  base.nome = row.nome ?? base.nome ?? '';
  base.descricao = row.descricao ?? base.descricao ?? '';
  base.casa = row.casa ?? base.casa;
  base.esporte = row.esporte ?? base.esporte;
  base.mercado = row.mercado ?? base.mercado;
  if (row.torneios && row.torneios.length > 0) {
    base.torneios = row.torneios;
    base.torneioAtivo = true;
  }
  if (row.linha_min !== null && row.linha_min !== undefined) base.linhaMin = row.linha_min;
  if (row.linha_max !== null && row.linha_max !== undefined) base.linhaMax = row.linha_max;
  if (row.odd_min !== null && row.odd_max !== null) {
    base.limitarOddsAtivo = true;
    base.limitarOdds = [row.odd_min, row.odd_max];
  }
  return base;
}

// ============================================================
// API CLIENT (real, sem mock) — usa ApiBots do lib/api.js
// ============================================================

async function apiGet(endpoint) {
  // /bots/:id → ApiBots.get(id)
  const m = endpoint.match(/^\/bots\/(\d+)$/);
  if (m) return ApiBots.get(parseInt(m[1], 10));
  throw new Error(`apiGet: endpoint não suportado: ${endpoint}`);
}

async function apiMutate(method, endpoint, body) {
  // POST /bots → criar
  if (method === 'POST' && endpoint === '/bots') {
    const payload = formStateToPayload(body);
    return ApiBots.create(payload);
  }
  // PATCH /bots/:id → editar
  const m = endpoint.match(/^\/bots\/(\d+)$/);
  if (m && (method === 'PATCH' || method === 'PUT')) {
    const id = parseInt(m[1], 10);
    const payload = formStateToPayload(body);
    return ApiBots.update(id, payload);
  }
  throw new Error(`apiMutate: endpoint não suportado: ${method} ${endpoint}`);
}

// Hook: busca bot pra editar
function useBotPorId(id) {
  const [state, setState] = useState({ data: null, loading: !!id, error: null });
  useEffect(() => {
    if (!id) { setState({ data: null, loading: false, error: null }); return; }
    setState({ data: null, loading: true, error: null });
    ApiBots.get(id)
      .then(row => {
        const formData = botRowToFormState(row);
        formData.id = row.id;
        setState({ data: formData, loading: false, error: null });
      })
      .catch(error => setState({ data: null, loading: false, error }));
  }, [id]);
  return state;
}

// Hook: cria/edita bot
function useBotSalvar({ onSuccess, onError } = {}) {
  const [state, setState] = useState({ loading: false, error: null });
  const salvar = async (config, idEdicao) => {
    setState({ loading: true, error: null });
    try {
      const payload = formStateToPayload(config);
      const data = idEdicao
        ? await ApiBots.update(idEdicao, payload)
        : await ApiBots.create(payload);
      setState({ loading: false, error: null });
      onSuccess?.(data);
      return data;
    } catch (error) {
      setState({ loading: false, error });
      onError?.(error);
      throw error;
    }
  };
  return { salvar, loading: state.loading, error: state.error };
}

// ============================================================
// APP - TELA DE CRIAR BOT
// ============================================================
export default function App({ botId: botIdProp = null, onSalvar, onCancelar, onNavegar }) {
  // Modo edicao detectado pela prop botId
  const [botId, setBotId] = useState(botIdProp);
  const modoEdicao = !!botId;

  // Busca bot pra editar (só quando botId existe)
  const { data: botInicial, loading: loadingBot } = useBotPorId(botId);

  // Hook de salvar
  const { salvar, loading: salvando } = useBotSalvar({
    onSuccess: (bot) => {
      adicionarToast(modoEdicao ? `Bot "${bot.nome}" editado` : `Bot "${bot.nome}" criado`, 'success');
      // Notifica callback externo (app pai navega de volta pra lista)
      if (onSalvar) {
        setTimeout(() => onSalvar(bot), 800);
      }
    },
    onError: (err) => {
      adicionarToast(`Erro: ${err.message}`, 'error');
    },
  });

  // Telas auxiliares
  const [telaAtiva, setTelaAtiva] = useState('bots');
  const handleNavegar = (telaId) => {
    if (onNavegar) onNavegar(telaId);
    else setTelaAtiva(telaId);
  };

  const handleCancelar = () => {
    if (onCancelar) onCancelar();
    else adicionarToast('Cancelado (sem callback de cancelar)', 'warn');
  };


  // SECAO 1
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');

  // SECAO 2
  const [esporte, setEsporte] = useState('fifa');
  const [casa, setCasa] = useState('betano');

  // SECAO 3 — Torneio + Grade (variações específicas dentro do torneio)
  const [torneioAtivo, setTorneioAtivo] = useState(false);
  const [torneios, setTorneios] = useState([]);
  // Torneios REAIS buscados do banco (via /torneios/disponiveis)
  const [torneiosReais, setTorneiosReais] = useState([]);  // [{nome, ticks}]
  const [torneiosCarregando, setTorneiosCarregando] = useState(false);
  const [gradesAtivo, setGradesAtivo] = useState(false);
  const [gradesSelecionadas, setGradesSelecionadas] = useState([]); // grades específicas escolhidas
  const [gradesDisponiveis, setGradesDisponiveis] = useState([]);   // todas as grades vindas da API
  const [gradesCarregando, setGradesCarregando] = useState(false);
  const [gradesModo, setGradesModo] = useState('whitelist'); // 'whitelist' = só estas | 'blacklist' = ignorar estas

  // SECAO 4 - MERCADOS
  const [mercado, setMercado] = useState('over_under_ft');
  const [inner, setInner] = useState([]);  // array vazio = nenhum lado marcado = bot aceita ambos
  const [selecaoAtivo, setSelecaoAtivo] = useState(true);  // toggle do filtro SELEÇÃO
  const [linhaMin, setLinhaMin] = useState(null);
  const [linhaMax, setLinhaMax] = useState(null);
  const [linhaAtivo, setLinhaAtivo] = useState(true);  // toggle do filtro LINHA

  const [limitarOddsAtivo, setLimitarOddsAtivo] = useState(false);
  const [limitarOdds, setLimitarOdds] = useState([1, 10]);

  const [proporcaoAtivo, setProporcaoAtivo] = useState(false);
  const [proporcao, setProporcao] = useState([0, 10]);

  const [tipoProporcaoAtivo, setTipoProporcaoAtivo] = useState(true);
  const [tipoProporcao, setTipoProporcao] = useState('>');

  const [limitePlacarAtivo, setLimitePlacarAtivo] = useState(false);
  const [limitePlacar, setLimitePlacar] = useState('');

  const [extrasAtivo, setExtrasAtivo] = useState(false);
  const [extras, setExtras] = useState({ casa: false, visitante: false, empate: false, favorito: false, azarao: false });

  const [filtroMediasAtivo, setFiltroMediasAtivo] = useState(false);
  const [filtroMedias, setFiltroMedias] = useState('');

  const [filtroMediasContraAtivo, setFiltroMediasContraAtivo] = useState(false);
  const [filtroMediasContra, setFiltroMediasContra] = useState('');

  // Alvo da tip
  const [alvoMesmaGradeAtivo, setAlvoMesmaGradeAtivo] = useState(false);
  const [alvoMesmaGradeWR, setAlvoMesmaGradeWR] = useState('all');
  const [alvoUlt8Ativo, setAlvoUlt8Ativo] = useState(false);
  const [alvoUlt8WR, setAlvoUlt8WR] = useState('all');

  // Oponente
  const [oponMesmaGradeAtivo, setOponMesmaGradeAtivo] = useState(false);
  const [oponMesmaGradeWR, setOponMesmaGradeWR] = useState('all');
  const [oponUlt8Ativo, setOponUlt8Ativo] = useState(false);
  const [oponUlt8WR, setOponUlt8WR] = useState('all');

  // FILTROS DE HISTORICO (caixa cinza)
  const [histVersao, setHistVersao] = useState('all');
  const [histJanela, setHistJanela] = useState('all');
  const [histTipo, setHistTipo] = useState('all');
  const [histBase, setHistBase] = useState('match');
  const [histIndivAlvo, setHistIndivAlvo] = useState('zebra'); // v11: alvo do individual no HC
  const [histMinPartidas, setHistMinPartidas] = useState(1);
  const [histProb, setHistProb] = useState([0, 100]);
  const [filtrosHistAdicionados, setFiltrosHistAdicionados] = useState([]);
  const [filtroHistHover, setFiltroHistHover] = useState(null);

  // FILTROS COMPLEMENTARES — padrão chip igual BlocoFiltrosHistorico
  const [filtrosComplementaresAtivo, setFiltrosComplementaresAtivo] = useState(false);
  const [compTipo, setCompTipo] = useState('media');
  const [compJanela, setCompJanela] = useState(10);
  const [compMinAtivo, setCompMinAtivo] = useState(false);
  const [compMin, setCompMin] = useState(null);
  const [compMaxAtivo, setCompMaxAtivo] = useState(false);
  const [compMax, setCompMax] = useState(null);
  const [filtrosCompAdicionados, setFiltrosCompAdicionados] = useState([]);
  const [filtroCompHover, setFiltroCompHover] = useState(null);

  // CENARIOS
  const [cenarioPartidaAtivo, setCenarioPartidaAtivo] = useState(false);
  const [cenarioPartida, setCenarioPartida] = useState('');

  const [casaFavoritoAtivo, setCasaFavoritoAtivo] = useState(false);
  const [casaFavorito, setCasaFavorito] = useState('sim');

  const [existeFavoritoAtivo, setExisteFavoritoAtivo] = useState(false);
  const [existeFavorito, setExisteFavorito] = useState('sim');

  const [alvoFavoritoAtivo, setAlvoFavoritoAtivo] = useState(false);
  const [alvoFavorito, setAlvoFavorito] = useState('sim');

  const [diferencaPlacarAtivo, setDiferencaPlacarAtivo] = useState(false);
  const [diferencaPlacar, setDiferencaPlacar] = useState(0);

  // FILTROS AO VIVO
  const [subfCasaFora, setSubfCasaFora] = useState(false);
  const [subfFavAzarao, setSubfFavAzarao] = useState(false);
  const [subfAlvoOpon, setSubfAlvoOpon] = useState(false);
  const [quartosAtivos, setQuartosAtivos] = useState({ q1: true, q2: true, q3: true, q4: false });

  const [tempoAtivo, setTempoAtivo] = useState(false);
  const [tempo, setTempo] = useState(0);
  const [ataquesAtivo, setAtaquesAtivo] = useState(false);
  const [ataques, setAtaques] = useState(0);
  const [chutesAtivo, setChutesAtivo] = useState(false);
  const [chutes, setChutes] = useState(0);
  const [cantosAtivo, setCantosAtivo] = useState(false);
  const [cantos, setCantos] = useState(0);

  const [placaresAtivo, setPlacaresAtivo] = useState(false);
  const [placares, setPlacares] = useState('');
  const [ataquesPerigososAtivo, setAtaquesPerigososAtivo] = useState(false);
  const [ataquesPerigosos, setAtaquesPerigosos] = useState(0);
  const [chutesGolAtivo, setChutesGolAtivo] = useState(false);
  const [chutesGol, setChutesGol] = useState(0);
  const [cartAmarelosAtivo, setCartAmarelosAtivo] = useState(false);
  const [cartAmarelos, setCartAmarelos] = useState(0);
  const [cartVermelhosAtivo, setCartVermelhosAtivo] = useState(false);
  const [cartVermelhos, setCartVermelhos] = useState(0);

  // FILTRAR PARTIDAS
  const ESTADO_FP_INICIAL = { j1: '', j2: '', t1: '', t2: '', j1Ativo: false, j2Ativo: false, t1Ativo: false, t2Ativo: false, fixarJ1Casa: false, fixarJ2Visit: false, direcao: 'todas', adicionadas: [] };
  const [apenasEspecificasAtivo, setApenasEspecificasAtivo] = useState(false);
  const [apenasEspecificasEstado, setApenasEspecificasEstado] = useState(ESTADO_FP_INICIAL);
  const [ignorarEspecificasAtivo, setIgnorarEspecificasAtivo] = useState(false);
  const [ignorarEspecificasEstado, setIgnorarEspecificasEstado] = useState(ESTADO_FP_INICIAL);
  // BLACKLIST DE JOGADOR (filtros 6 e 7 do HC): listas simples de nicks
  const ESTADO_BLJ_INICIAL = { adicionados: [] };
  const [blacklistZebraAtivo, setBlacklistZebraAtivo] = useState(false);
  const [blacklistZebraEstado, setBlacklistZebraEstado] = useState(ESTADO_BLJ_INICIAL);
  const [blacklistFavoritoAtivo, setBlacklistFavoritoAtivo] = useState(false);
  const [blacklistFavoritoEstado, setBlacklistFavoritoEstado] = useState(ESTADO_BLJ_INICIAL);
  // Participantes do torneio (jogadores e times) — vem da API
  const [participantes, setParticipantes] = useState({ jogadores: [], times: [], carregando: false });

  // EVITAR LINHAS SEQ
  const [evitarLinhasSeq, setEvitarLinhasSeq] = useState(true);
  // MAX TIPS POR JOGO
  const [maxTipsPorJogo, setMaxTipsPorJogo] = useState('ilimitado');

  // Toasts
  const [toasts, setToasts] = useState([]);
  const adicionarToast = (mensagem, tipo = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, mensagem, tipo }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  };

  // 0) Quando casa OU esporte mudam → busca torneios PAI agrupados do banco
  // Cada item: {nome_pai, nome_pai_real, ticks_total, grades: [{nome, ticks}]}
  // O dropdown de torneio mostra so os nomes pai. A lista de grades vem ja agrupada.
  useEffect(() => {
    if (!casa || !esporte) {
      setTorneiosReais([]);
      return;
    }
    setTorneiosCarregando(true);
    ApiTorneios.disponiveis(casa, esporte)
      .then(data => {
        setTorneiosReais(data.torneios || []);
        setTorneiosCarregando(false);
      })
      .catch(err => {
        console.warn('Erro buscando torneios reais:', err);
        setTorneiosReais([]);
        setTorneiosCarregando(false);
      });
  }, [casa, esporte]);

  // 1) Quando torneio (pai) eh selecionado → pega as grades do pai escolhido
  // As grades JA vieram no /disponiveis, nao precisa chamar /grades de novo
  useEffect(() => {
    if (!torneioAtivo || torneios.length === 0) {
      setGradesDisponiveis([]);
      setGradesSelecionadas([]);
      return;
    }
    // Para cada pai selecionado, agrega as grades dele de torneiosReais
    const todasGrades = [];
    for (const paiSelecionado of torneios) {
      const paiObj = torneiosReais.find(
        t => t.nome_pai === paiSelecionado || t.nome_pai_real === paiSelecionado
      );
      if (paiObj && paiObj.grades) {
        todasGrades.push(...paiObj.grades);
      }
    }
    setGradesDisponiveis(todasGrades);
  }, [torneios, torneioAtivo, torneiosReais]);

  // 2) Quando torneio OU grades mudam → busca participantes
  // Como o usuario seleciona um PAI, precisamos passar as GRADES reais pro endpoint
  // /participantes (que aceita lista de grades exatas)
  useEffect(() => {
    if (!torneioAtivo || torneios.length === 0) {
      setParticipantes({ jogadores: [], times: [], carregando: false });
      return;
    }

    // Resolve as grades reais a partir do pai selecionado
    const gradesReaisDoPai = [];
    for (const paiSelecionado of torneios) {
      const paiObj = torneiosReais.find(
        t => t.nome_pai === paiSelecionado || t.nome_pai_real === paiSelecionado
      );
      if (paiObj && paiObj.grades) {
        gradesReaisDoPai.push(...paiObj.grades.map(g => g.nome));
      }
    }

    // Se o usuario filtrou por grades especificas, usa elas; senao usa todas do pai
    const gradesParaConsulta = (gradesAtivo && gradesSelecionadas.length > 0)
      ? gradesSelecionadas
      : gradesReaisDoPai;

    if (gradesParaConsulta.length === 0) {
      setParticipantes({ jogadores: [], times: [], carregando: false });
      return;
    }

    setParticipantes(prev => ({ ...prev, carregando: true }));

    // Usa a primeira grade como torneio_id no path (endpoint exige), passa todas como filtro
    const torneioId = gradesParaConsulta[0];
    const options = {
      bookmaker: casa,
      esporte,
      grades: gradesParaConsulta,
      gradesModo: (gradesAtivo && gradesSelecionadas.length > 0) ? gradesModo : 'whitelist',
    };

    ApiTorneios.participantes(torneioId, options)
      .then(data => {
        setParticipantes({
          jogadores: data.jogadores || [],
          times: data.times || [],
          carregando: false,
        });
      })
      .catch(() => {
        setParticipantes({ jogadores: [], times: [], carregando: false });
      });
  }, [torneios, torneioAtivo, gradesAtivo, gradesSelecionadas, gradesModo, torneiosReais, casa, esporte]);

  // ============================================================
  // PERSISTENCIA LOCAL + AUTO-SAVE (defensivo)
  // ============================================================
  const STORAGE_KEY = 'tipmike:bot:draft';
  const [draftCarregado, setDraftCarregado] = useState(false);
  const [autosaveAtivo, setAutosaveAtivo] = useState(false);
  const [ultimoSalvamento, setUltimoSalvamento] = useState(null);
  const [temAlteracoesNaoSalvas, setTemAlteracoesNaoSalvas] = useState(false);
  const [previewAberto, setPreviewAberto] = useState(false);
  const [confirmarReset, setConfirmarReset] = useState(false);
  const primeiraRender = useRef(true);

  // Coleta todo o form em um objeto
  // torneiosReais incluso pra formStateToPayload expandir pai em grades reais
  const formState = {
    nome, descricao, esporte, casa, torneioAtivo, torneios, torneiosReais, gradesAtivo, gradesSelecionadas, gradesModo,
    mercado, inner, selecaoAtivo, linhaMin, linhaMax, linhaAtivo, limitarOddsAtivo, limitarOdds, proporcaoAtivo, proporcao,
    tipoProporcaoAtivo, tipoProporcao, limitePlacarAtivo, limitePlacar,
    extrasAtivo, extras, filtroMediasAtivo, filtroMedias,
    filtroMediasContraAtivo, filtroMediasContra,
    alvoMesmaGradeAtivo, alvoMesmaGradeWR, alvoUlt8Ativo, alvoUlt8WR,
    oponMesmaGradeAtivo, oponMesmaGradeWR, oponUlt8Ativo, oponUlt8WR,
    histVersao, histJanela, histTipo, histBase, histIndivAlvo, histMinPartidas, histProb,
    filtrosHistAdicionados,
    filtrosComplementaresAtivo, filtrosCompAdicionados,
    cenarioPartidaAtivo, cenarioPartida,
    casaFavoritoAtivo, casaFavorito, existeFavoritoAtivo, existeFavorito,
    alvoFavoritoAtivo, alvoFavorito, diferencaPlacarAtivo, diferencaPlacar,
    subfCasaFora, subfFavAzarao, subfAlvoOpon, quartosAtivos,
    tempoAtivo, tempo, ataquesAtivo, ataques, chutesAtivo, chutes,
    cantosAtivo, cantos, cartVermelhosAtivo, cartVermelhos,
    placaresAtivo, placares, ataquesPerigososAtivo, ataquesPerigosos,
    chutesGolAtivo, chutesGol, cartAmarelosAtivo, cartAmarelos,
    apenasEspecificasAtivo, apenasEspecificasEstado,
    ignorarEspecificasAtivo, ignorarEspecificasEstado,
    blacklistZebraAtivo, blacklistZebraEstado,
    blacklistFavoritoAtivo, blacklistFavoritoEstado,
    evitarLinhasSeq, maxTipsPorJogo,
  };

  // Aplica state salvo: chama todos os setters
  const aplicarFormSalvo = (s) => {
    if (!s || typeof s !== 'object') return;
    if (s.nome !== undefined) setNome(s.nome);
    if (s.descricao !== undefined) setDescricao(s.descricao);
    if (s.esporte !== undefined) setEsporte(s.esporte);
    if (s.casa !== undefined) setCasa(s.casa);
    if (s.torneioAtivo !== undefined) setTorneioAtivo(s.torneioAtivo);
    if (s.torneios !== undefined) setTorneios(s.torneios);
    if (s.gradesAtivo !== undefined) setGradesAtivo(s.gradesAtivo);
    if (s.gradesSelecionadas !== undefined) setGradesSelecionadas(s.gradesSelecionadas);
    if (s.gradesModo !== undefined) setGradesModo(s.gradesModo);
    if (s.mercado !== undefined) setMercado(s.mercado);
    if (s.inner !== undefined) setInner(s.inner);
    if (s.selecaoAtivo !== undefined) setSelecaoAtivo(s.selecaoAtivo);
    if (s.linhaMin !== undefined) setLinhaMin(s.linhaMin);
    if (s.linhaMax !== undefined) setLinhaMax(s.linhaMax);
    if (s.linhaAtivo !== undefined) setLinhaAtivo(s.linhaAtivo);
    if (s.limitarOddsAtivo !== undefined) setLimitarOddsAtivo(s.limitarOddsAtivo);
    if (s.limitarOdds !== undefined) setLimitarOdds(s.limitarOdds);
    if (s.proporcaoAtivo !== undefined) setProporcaoAtivo(s.proporcaoAtivo);
    if (s.proporcao !== undefined) setProporcao(s.proporcao);
    if (s.tipoProporcaoAtivo !== undefined) setTipoProporcaoAtivo(s.tipoProporcaoAtivo);
    if (s.tipoProporcao !== undefined) setTipoProporcao(s.tipoProporcao);
    if (s.limitePlacarAtivo !== undefined) setLimitePlacarAtivo(s.limitePlacarAtivo);
    if (s.limitePlacar !== undefined) setLimitePlacar(s.limitePlacar);
    if (s.extrasAtivo !== undefined) setExtrasAtivo(s.extrasAtivo);
    if (s.extras !== undefined) setExtras(s.extras);
    if (s.filtroMediasAtivo !== undefined) setFiltroMediasAtivo(s.filtroMediasAtivo);
    if (s.filtroMedias !== undefined) setFiltroMedias(s.filtroMedias);
    if (s.filtroMediasContraAtivo !== undefined) setFiltroMediasContraAtivo(s.filtroMediasContraAtivo);
    if (s.filtroMediasContra !== undefined) setFiltroMediasContra(s.filtroMediasContra);
    if (s.alvoMesmaGradeAtivo !== undefined) setAlvoMesmaGradeAtivo(s.alvoMesmaGradeAtivo);
    if (s.alvoMesmaGradeWR !== undefined) setAlvoMesmaGradeWR(s.alvoMesmaGradeWR);
    if (s.alvoUlt8Ativo !== undefined) setAlvoUlt8Ativo(s.alvoUlt8Ativo);
    if (s.alvoUlt8WR !== undefined) setAlvoUlt8WR(s.alvoUlt8WR);
    if (s.oponMesmaGradeAtivo !== undefined) setOponMesmaGradeAtivo(s.oponMesmaGradeAtivo);
    if (s.oponMesmaGradeWR !== undefined) setOponMesmaGradeWR(s.oponMesmaGradeWR);
    if (s.oponUlt8Ativo !== undefined) setOponUlt8Ativo(s.oponUlt8Ativo);
    if (s.oponUlt8WR !== undefined) setOponUlt8WR(s.oponUlt8WR);
    if (s.histVersao !== undefined) setHistVersao(s.histVersao);
    if (s.histJanela !== undefined) setHistJanela(s.histJanela);
    if (s.histTipo !== undefined) setHistTipo(s.histTipo);
    if (s.histBase !== undefined) setHistBase(s.histBase);
    if (s.histIndivAlvo !== undefined) setHistIndivAlvo(s.histIndivAlvo);
    if (s.histMinPartidas !== undefined) setHistMinPartidas(s.histMinPartidas);
    if (s.histProb !== undefined) setHistProb(s.histProb);
    if (s.filtrosHistAdicionados !== undefined) setFiltrosHistAdicionados(s.filtrosHistAdicionados);
    if (s.filtrosComplementaresAtivo !== undefined) setFiltrosComplementaresAtivo(s.filtrosComplementaresAtivo);
    if (s.filtrosCompAdicionados !== undefined) setFiltrosCompAdicionados(s.filtrosCompAdicionados);
    if (s.cenarioPartidaAtivo !== undefined) setCenarioPartidaAtivo(s.cenarioPartidaAtivo);
    if (s.cenarioPartida !== undefined) setCenarioPartida(s.cenarioPartida);
    if (s.casaFavoritoAtivo !== undefined) setCasaFavoritoAtivo(s.casaFavoritoAtivo);
    if (s.casaFavorito !== undefined) setCasaFavorito(s.casaFavorito);
    if (s.existeFavoritoAtivo !== undefined) setExisteFavoritoAtivo(s.existeFavoritoAtivo);
    if (s.existeFavorito !== undefined) setExisteFavorito(s.existeFavorito);
    if (s.alvoFavoritoAtivo !== undefined) setAlvoFavoritoAtivo(s.alvoFavoritoAtivo);
    if (s.alvoFavorito !== undefined) setAlvoFavorito(s.alvoFavorito);
    if (s.diferencaPlacarAtivo !== undefined) setDiferencaPlacarAtivo(s.diferencaPlacarAtivo);
    if (s.diferencaPlacar !== undefined) setDiferencaPlacar(s.diferencaPlacar);
    if (s.subfCasaFora !== undefined) setSubfCasaFora(s.subfCasaFora);
    if (s.subfFavAzarao !== undefined) setSubfFavAzarao(s.subfFavAzarao);
    if (s.subfAlvoOpon !== undefined) setSubfAlvoOpon(s.subfAlvoOpon);
    if (s.quartosAtivos !== undefined) setQuartosAtivos(s.quartosAtivos);
    if (s.tempoAtivo !== undefined) setTempoAtivo(s.tempoAtivo);
    if (s.tempo !== undefined) setTempo(s.tempo);
    if (s.ataquesAtivo !== undefined) setAtaquesAtivo(s.ataquesAtivo);
    if (s.ataques !== undefined) setAtaques(s.ataques);
    if (s.chutesAtivo !== undefined) setChutesAtivo(s.chutesAtivo);
    if (s.chutes !== undefined) setChutes(s.chutes);
    if (s.cantosAtivo !== undefined) setCantosAtivo(s.cantosAtivo);
    if (s.cantos !== undefined) setCantos(s.cantos);
    if (s.cartVermelhosAtivo !== undefined) setCartVermelhosAtivo(s.cartVermelhosAtivo);
    if (s.cartVermelhos !== undefined) setCartVermelhos(s.cartVermelhos);
    if (s.placaresAtivo !== undefined) setPlacaresAtivo(s.placaresAtivo);
    if (s.placares !== undefined) setPlacares(s.placares);
    if (s.ataquesPerigososAtivo !== undefined) setAtaquesPerigososAtivo(s.ataquesPerigososAtivo);
    if (s.ataquesPerigosos !== undefined) setAtaquesPerigosos(s.ataquesPerigosos);
    if (s.chutesGolAtivo !== undefined) setChutesGolAtivo(s.chutesGolAtivo);
    if (s.chutesGol !== undefined) setChutesGol(s.chutesGol);
    if (s.cartAmarelosAtivo !== undefined) setCartAmarelosAtivo(s.cartAmarelosAtivo);
    if (s.cartAmarelos !== undefined) setCartAmarelos(s.cartAmarelos);
    if (s.apenasEspecificasAtivo !== undefined) setApenasEspecificasAtivo(s.apenasEspecificasAtivo);
    if (s.apenasEspecificasEstado !== undefined) setApenasEspecificasEstado(s.apenasEspecificasEstado);
    if (s.ignorarEspecificasAtivo !== undefined) setIgnorarEspecificasAtivo(s.ignorarEspecificasAtivo);
    if (s.ignorarEspecificasEstado !== undefined) setIgnorarEspecificasEstado(s.ignorarEspecificasEstado);
    if (s.blacklistZebraAtivo !== undefined) setBlacklistZebraAtivo(s.blacklistZebraAtivo);
    if (s.blacklistZebraEstado !== undefined) setBlacklistZebraEstado(s.blacklistZebraEstado);
    if (s.blacklistFavoritoAtivo !== undefined) setBlacklistFavoritoAtivo(s.blacklistFavoritoAtivo);
    if (s.blacklistFavoritoEstado !== undefined) setBlacklistFavoritoEstado(s.blacklistFavoritoEstado);
    if (s.evitarLinhasSeq !== undefined) setEvitarLinhasSeq(s.evitarLinhasSeq);
    if (s.maxTipsPorJogo !== undefined) setMaxTipsPorJogo(s.maxTipsPorJogo);
  };

  // Reseta tudo pros defaults
  const resetarFormulario = () => {
    setNome(''); setDescricao('');
    setEsporte('fifa'); setCasa('bet365');
    setTorneioAtivo(false); setTorneios([]);
    setGradesAtivo(false); setGradesSelecionadas([]); setGradesModo('whitelist');
    setMercado('over_under_ft');
    setInner([]);                              // reset pra nenhum marcado
    setSelecaoAtivo(true); setLinhaAtivo(true); // toggles ativos por default
    setLinhaMin(null); setLinhaMax(null);
    setLimitarOddsAtivo(false); setLimitarOdds([1, 10]);
    setProporcaoAtivo(false); setProporcao([0, 10]);
    setTipoProporcaoAtivo(true); setTipoProporcao('>');
    setLimitePlacarAtivo(false); setLimitePlacar('');
    setExtrasAtivo(false); setExtras({ casa: false, visitante: false, empate: false, favorito: false, azarao: false });
    setFiltroMediasAtivo(false); setFiltroMedias('');
    setFiltroMediasContraAtivo(false); setFiltroMediasContra('');
    setAlvoMesmaGradeAtivo(false); setAlvoMesmaGradeWR('all');
    setAlvoUlt8Ativo(false); setAlvoUlt8WR('all');
    setOponMesmaGradeAtivo(false); setOponMesmaGradeWR('all');
    setOponUlt8Ativo(false); setOponUlt8WR('all');
    setHistVersao('all'); setHistJanela('all'); setHistTipo('all');
    setHistBase('match'); setHistIndivAlvo('zebra'); setHistMinPartidas(1); setHistProb([0, 100]);
    setFiltrosHistAdicionados([]);
    setFiltrosComplementaresAtivo(false);
    setCompTipo('media'); setCompJanela(10);
    setCompMinAtivo(false); setCompMin(null); setCompMaxAtivo(false); setCompMax(null);
    setFiltrosCompAdicionados([]);
    setCenarioPartidaAtivo(false); setCenarioPartida('');
    setCasaFavoritoAtivo(false); setCasaFavorito('sim');
    setExisteFavoritoAtivo(false); setExisteFavorito('sim');
    setAlvoFavoritoAtivo(false); setAlvoFavorito('sim');
    setDiferencaPlacarAtivo(false); setDiferencaPlacar(0);
    setSubfCasaFora(false); setSubfFavAzarao(false); setSubfAlvoOpon(false);
    setQuartosAtivos({ q1: true, q2: true, q3: true, q4: false });
    setTempoAtivo(false); setTempo(0);
    setAtaquesAtivo(false); setAtaques(0);
    setChutesAtivo(false); setChutes(0);
    setCantosAtivo(false); setCantos(0);
    setCartVermelhosAtivo(false); setCartVermelhos(0);
    setPlacaresAtivo(false); setPlacares('');
    setAtaquesPerigososAtivo(false); setAtaquesPerigosos(0);
    setChutesGolAtivo(false); setChutesGol(0);
    setCartAmarelosAtivo(false); setCartAmarelos(0);
    setApenasEspecificasAtivo(false); setApenasEspecificasEstado(ESTADO_FP_INICIAL);
    setIgnorarEspecificasAtivo(false); setIgnorarEspecificasEstado(ESTADO_FP_INICIAL);
    setBlacklistZebraAtivo(false); setBlacklistZebraEstado(ESTADO_BLJ_INICIAL);
    setBlacklistFavoritoAtivo(false); setBlacklistFavoritoEstado(ESTADO_BLJ_INICIAL);
    setEvitarLinhasSeq(true);
    setMaxTipsPorJogo('ilimitado');
  };

  // ON MOUNT: carrega draft do storage
  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        if (typeof window !== 'undefined' && window.storage) {
          const r = await window.storage.get(STORAGE_KEY);
          if (r && r.value && !cancelado) {
            const saved = typeof r.value === 'string' ? JSON.parse(r.value) : r.value;
            aplicarFormSalvo(saved);
            setUltimoSalvamento(saved._savedAt || null);
            setTimeout(() => {
              if (!cancelado) adicionarToast('Rascunho recuperado', 'info');
            }, 500);
          }
        }
      } catch (e) {
        // sem draft salvo
      } finally {
        if (!cancelado) setDraftCarregado(true);
      }
    })();
    return () => { cancelado = true; };
  }, []); // eslint-disable-line

  // AUTO-SAVE com debounce: salva 3s depois da ultima mudanca
  // Usa um hash simples ao inves de JSON.stringify completo nos deps
  const formStateKey = JSON.stringify(formState);
  useEffect(() => {
    if (!draftCarregado) return; // espera carregar primeiro
    if (primeiraRender.current) {
      primeiraRender.current = false;
      return; // primeira render apos carregar nao precisa salvar
    }
    setTemAlteracoesNaoSalvas(true);
    const timer = setTimeout(async () => {
      try {
        if (typeof window !== 'undefined' && window.storage) {
          setAutosaveAtivo(true);
          const stamp = new Date().toISOString();
          const payload = { ...formState, _savedAt: stamp };
          await window.storage.set(STORAGE_KEY, JSON.stringify(payload));
          setUltimoSalvamento(stamp);
          setTemAlteracoesNaoSalvas(false);
          setTimeout(() => setAutosaveAtivo(false), 400);
        }
      } catch (e) {
        setAutosaveAtivo(false);
        console.warn('Auto-save falhou:', e);
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [formStateKey, draftCarregado]); // eslint-disable-line

  // Atalho Ctrl+S = salvar manual / Esc = fecha modais ou cancela form
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        salvarBot();
      }
      if (e.key === 'Escape') {
        if (previewAberto) setPreviewAberto(false);
        else if (confirmarReset) setConfirmarReset(false);
        // Esc fora de modais cancela form (com confirmação se houver alterações)
        else if (temAlteracoesNaoSalvas) {
          if (window.confirm('Há alterações não salvas. Tem certeza que quer cancelar?')) {
            handleCancelar();
          }
        } else {
          handleCancelar();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [nome, torneioAtivo, torneios, previewAberto, confirmarReset, temAlteracoesNaoSalvas]); // eslint-disable-line

  // Salvar manual (chamado pelo botao + Ctrl+S)
  const salvarBot = async () => {
    if (!nome.trim()) {
      adicionarToast('Dê um nome para o bot', 'error');
      return;
    }
    if (nome.trim().length < 4) {
      adicionarToast('Nome deve ter ao menos 4 caracteres', 'error');
      return;
    }
    if (torneioAtivo && torneios.length === 0) {
      adicionarToast('Selecione pelo menos 1 torneio ou desative o filtro', 'error');
      return;
    }
    // 🔌 BACKEND: salvar via API (em vez de só toast)
    try {
      await salvar(formState, botId);
      // Sucesso: toast já mostrado pelo onSuccess do hook
    } catch (e) {
      // Erro: toast já mostrado pelo onError
    }
  };

  // Pré-preenche form quando vem bot pra editar
  useEffect(() => {
    if (botInicial && modoEdicao) {
      aplicarFormSalvo(botInicial);
      adicionarToast(`Editando "${botInicial.nome}"`, 'info');
    }
  // eslint-disable-next-line
  }, [botInicial?.id]);

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

  // Lista de torneios PAI disponiveis pro dropdown:
  // - Se tem torneios reais do banco (API), usa nome_pai (Battle, GT, EAL etc) - SEM grades
  // - Senao, fallback pros hardcoded (caso API falhe ou casa sem volume)
  const torneiosDisp = (torneiosReais.length > 0)
    ? torneiosReais.map(t => t.nome_pai)
    : (TORNEIOS_POR_ESPORTE[esporte] || []);
  const mercadosDisp = MERCADOS_POR_ESPORTE[esporte] || [];
  const capacidades = CAPACIDADES[esporte] || CAPACIDADES.fifa;
  const cenariosDisp = capacidades.cenariosFull ? CENARIOS_FULL : CENARIOS_REDUZIDO;
  const filtrosLiveDisp = capacidades.filtrosLive;

  // Quando troca de esporte: reseta mercado, cenario, torneios e mercado complementar
  useEffect(() => {
    // Mercado: se nao existe no novo esporte, vai pro primeiro
    if (mercadosDisp.length > 0 && !mercadosDisp.find((m) => m.value === mercado)) {
      setMercado(mercadosDisp[0].value);
    }
    // Cenario: se nao existe no novo esporte, limpa
    if (cenarioPartida && !cenariosDisp.find((c) => c.value === cenarioPartida)) {
      setCenarioPartida('');
    }
    // Torneios selecionados: filtra so os que existem no novo esporte
    if (torneios.length > 0) {
      const validos = torneios.filter((t) => torneiosDisp.includes(t));
      if (validos.length !== torneios.length) {
        setTorneios(validos);
      }
    }

  }, [esporte]); // eslint-disable-line

  const radioWR = [
    { value: 'all', label: 'Todas' },
    { value: 'lte30', label: '≤30%' },
    { value: 'gte70', label: '≥70%' },
  ];

  return (
    <div className="min-h-screen pb-24" style={{
      ...themeVars,
      backgroundColor: 'var(--mike-bg)',
      color: 'var(--mike-fg)',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <style>{`
        .mike-mercados-scroll::-webkit-scrollbar { width: 6px; }
        .mike-mercados-scroll::-webkit-scrollbar-track { background: rgba(80, 110, 170, 0.05); border-radius: 10px; }
        .mike-mercados-scroll::-webkit-scrollbar-thumb { background: rgba(80, 110, 170, 0.5); border-radius: 10px; }
        .mike-mercados-scroll::-webkit-scrollbar-thumb:hover { background: rgba(80, 110, 170, 0.9); }
        .mike-mercados-scroll { scrollbar-width: thin; scrollbar-color: rgba(80, 110, 170, 0.5) rgba(80, 110, 170, 0.05); }

        /* Opcoes do MikeSelect: hover verde igual ao ativo */
        .mike-option { color: #b8c0d4; background-color: transparent; }
        .mike-option[data-ativo="true"] { background-color: #10b981; color: #ffffff; font-weight: 600; }
        .mike-option:hover { background-color: #10b981; color: #ffffff; }

        .mike-border-thin { border: 0.5px solid rgba(60, 85, 130, 0.4) !important; }
        .mike-border-thin:hover { border-color: rgba(80, 110, 170, 0.7) !important; }

        .mike-no-spin::-webkit-outer-spin-button,
        .mike-no-spin::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        .mike-no-spin { -moz-appearance: textfield; }

        .mike-range-thumb {
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
          height: 24px;
          pointer-events: none;
        }
        .mike-range-thumb::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #10b981;
          cursor: pointer;
          pointer-events: auto;
          border: 2px solid #0b0f1a;
          box-shadow: 0 0 0 1px rgba(16, 185, 129, 0.6);
        }
        .mike-range-thumb::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #10b981;
          cursor: pointer;
          pointer-events: auto;
          border: 2px solid #0b0f1a;
          box-shadow: 0 0 0 1px rgba(16, 185, 129, 0.6);
        }

        .mike-checkbox {
          appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 3px;
          border: 1px solid rgba(80, 110, 170, 0.6);
          background: transparent;
          cursor: pointer;
          position: relative;
          transition: all 0.15s;
          flex-shrink: 0;
        }
        .mike-checkbox:hover { border-color: rgba(16, 185, 129, 0.6); }
        .mike-checkbox:checked { background: #10b981; border-color: #10b981; }
        .mike-checkbox:checked::after {
          content: '';
          position: absolute;
          left: 4px;
          top: 1px;
          width: 4px;
          height: 8px;
          border: solid #0b0f1a;
          border-width: 0 2px 2px 0;
          transform: rotate(45deg);
        }

        .mike-radio {
          appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          border: 1.5px solid rgba(80, 110, 170, 0.6);
          background: transparent;
          cursor: pointer;
          position: relative;
          transition: all 0.15s;
          flex-shrink: 0;
        }
        .mike-radio:hover { border-color: rgba(16, 185, 129, 0.6); }
        .mike-radio:checked { border-color: #10b981; }
        .mike-radio:checked::after {
          content: '';
          position: absolute;
          left: 2px;
          top: 2px;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #10b981;
        }

        @keyframes mike-toast-in { 0% { transform: translateY(-20px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }
        .mike-toast-in { animation: mike-toast-in 0.3s ease-out; }

        /* DROPDOWN - escorre de cima pra baixo */
        .mike-no-scroll { overflow: hidden !important; }

        @keyframes mike-dropdown-in {
          0% { opacity: 0; transform: translateY(-6px) scaleY(0.96); }
          100% { opacity: 1; transform: translateY(0) scaleY(1); }
        }
        .mike-dropdown-in {
          animation: mike-dropdown-in 0.22s cubic-bezier(0.22, 1, 0.36, 1);
          transform-origin: top center;
        }

        /* CHIP - aparece tipo bolha (sem overshoot exagerado) */
        @keyframes mike-chip-in {
          0% { opacity: 0; transform: scale(0.85); }
          100% { opacity: 1; transform: scale(1); }
        }
        .mike-chip-in {
          animation: mike-chip-in 0.22s cubic-bezier(0.22, 1, 0.36, 1);
        }

        /* TOOLTIP - fade in suave */
        @keyframes mike-tooltip-in {
          0% { opacity: 0; transform: translateY(-4px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .mike-tooltip-in { animation: mike-tooltip-in 0.18s ease-out; }

        /* SLIDER TOOLTIP (em cima do thumb) */
        @keyframes mike-slider-tooltip-in {
          0% { opacity: 0; transform: translateX(-50%) translateY(4px); }
          100% { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        .mike-slider-tooltip-in { animation: mike-slider-tooltip-in 0.16s ease-out; }

        /* SECAO FORM - aparece de baixo */
        @keyframes mike-section-in {
          0% { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .mike-section-in { animation: mike-section-in 0.4s ease-out backwards; }

        /* TRANSICAO de opacidade pra elementos disabled */
        .mike-transition-all {
          transition: opacity 0.3s ease-out;
        }

        /* COLLAPSE DOWN - usa height transition (medida via JS, nao max-height fake) */
        .mike-collapse-wrapper {
          overflow: hidden;
          transition: height 0.45s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.35s ease-out;
        }
        .mike-collapse-content {
          /* sem padding-top aqui, vai dentro */
        }
      `}</style>

      <MikeHeader telaAtiva={telaAtiva} onNavegar={handleNavegar} />

      <main className="max-w-screen-md mx-auto px-4 py-6">
        {/* Loading state quando carrega bot pra editar */}
        {loadingBot && (
          <div className="rounded-lg p-12 text-center mb-4" style={{
            backgroundColor: 'rgba(20, 26, 40, 0.6)',
            border: '0.5px solid rgba(60, 85, 130, 0.4)',
          }}>
            <svg className="w-8 h-8 mx-auto mb-3 animate-spin text-[--mike-accent]" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3"/>
              <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
            </svg>
            <p className="text-sm text-[--mike-fg-soft]">Carregando bot #{botId}...</p>
          </div>
        )}

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-[--mike-fg-muted] mb-4">
          <button onClick={() => handleNavegar('today')} className="hover:text-[--mike-fg]">
            <Home className="w-3 h-3" />
          </button>
          <ChevronRight className="w-3 h-3" />
          <button onClick={() => handleNavegar('bots')} className="hover:text-[--mike-fg]">Bots</button>
          <ChevronRight className="w-3 h-3" />
          <span className="text-[--mike-fg] font-semibold">{modoEdicao ? `Editar Bot #${botId}` : 'Novo Bot'}</span>
        </div>

        <div className="flex items-center gap-3 mb-2">
          <button
            onClick={handleCancelar}
            className="p-2 rounded-md mike-border-thin hover:bg-[--mike-card-2] text-[--mike-fg-muted] hover:text-[--mike-fg] transition"
            title="Voltar"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-xl font-black text-[--mike-fg] flex-1">
            {modoEdicao ? 'Editar Bot' : 'Criar Novo Bot'}
          </h1>
          {/* Resumo de filtros ativos */}
          <div className="flex items-center gap-2 text-[10px]">
            {(() => {
              const filtrosAtivos = [
                limitarOddsAtivo, proporcaoAtivo, limitePlacarAtivo, extrasAtivo,
                filtroMediasAtivo, filtroMediasContraAtivo,
                alvoMesmaGradeAtivo, alvoUlt8Ativo, oponMesmaGradeAtivo, oponUlt8Ativo,
                cenarioPartidaAtivo, casaFavoritoAtivo, existeFavoritoAtivo, alvoFavoritoAtivo, diferencaPlacarAtivo,
                tempoAtivo, ataquesAtivo, chutesAtivo, cantosAtivo, cartVermelhosAtivo,
                placaresAtivo, ataquesPerigososAtivo, chutesGolAtivo, cartAmarelosAtivo,
                torneioAtivo, filtrosComplementaresAtivo,
              ].filter(Boolean).length;
              const totalFilters = filtrosHistAdicionados.length;
              return (
                <>
                  <div className="flex items-center gap-1 px-2 py-1 rounded font-mono font-bold" style={{
                    backgroundColor: filtrosAtivos > 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(60, 85, 130, 0.15)',
                    color: filtrosAtivos > 0 ? '#10b981' : '#6b7691',
                    border: `0.5px solid ${filtrosAtivos > 0 ? 'rgba(16, 185, 129, 0.4)' : 'rgba(60, 85, 130, 0.4)'}`,
                  }}>
                    {filtrosAtivos} {filtrosAtivos === 1 ? 'filtro' : 'filtros'}
                  </div>

                </>
              );
            })()}
          </div>
        </div>

        {/* Barra de status: auto-save + acoes secundarias + atalhos */}
        <div className="flex items-center gap-2 mb-6 text-[10px] flex-wrap">
          {/* Indicador de auto-save */}
          <div className="flex items-center gap-1.5 text-[--mike-fg-muted]">
            {autosaveAtivo ? (
              <>
                <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span>Salvando rascunho...</span>
              </>
            ) : temAlteracoesNaoSalvas ? (
              <>
                <div className="w-2 h-2 rounded-full bg-amber-400" />
                <span>Alterações não salvas (auto-save em 3s)</span>
              </>
            ) : ultimoSalvamento ? (
              <>
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>
                  Rascunho salvo às {new Date(ultimoSalvamento).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 rounded-full bg-[#4a5470]" />
                <span>Auto-save ativado</span>
              </>
            )}
          </div>

          <div className="flex-1" />

          {/* Atalhos */}
          <div className="hidden md:flex items-center gap-2 text-[--mike-fg-muted]">
            <kbd className="px-1.5 py-0.5 rounded font-mono font-semibold" style={{
              backgroundColor: 'rgba(60,85,130,0.2)',
              border: '0.5px solid rgba(60,85,130,0.4)',
              color: '#b8c0d4',
            }}>Ctrl+S</kbd>
            <span>salvar</span>
            <kbd className="px-1.5 py-0.5 rounded font-mono font-semibold ml-2" style={{
              backgroundColor: 'rgba(60,85,130,0.2)',
              border: '0.5px solid rgba(60,85,130,0.4)',
              color: '#b8c0d4',
            }}>Esc</kbd>
            <span>cancelar</span>
          </div>

          {/* Botao preview JSON */}
          <button
            onClick={() => setPreviewAberto(true)}
            className="mike-border-thin flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-semibold bg-transparent text-[--mike-fg-soft] hover:text-cyan-400 hover:border-cyan-500/40 transition"
            title="Ver JSON do bot"
          >
            <Code className="w-3 h-3" />
            Preview JSON
          </button>

          {/* Botao resetar tudo */}
          <button
            onClick={() => setConfirmarReset(true)}
            className="mike-border-thin flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-semibold bg-transparent text-[--mike-fg-soft] hover:text-rose-400 hover:border-rose-500/40 transition"
            title="Limpar todos os filtros"
          >
            <RotateCcw className="w-3 h-3" />
            Resetar tudo
          </button>
        </div>

        {/* SECAO 1: NOME */}
        <SecaoForm titulo="Criando um novo BOT" descricao="Escolha um nome e uma descrição para identificar o seu bot mais facilmente.">
          <div className="space-y-2">
            <div className="relative">
              <input
                type="text" value={nome} onChange={(e) => setNome(e.target.value)}
                placeholder="Nome do bot *"
                className={`w-full px-3 py-2.5 rounded-md bg-transparent text-sm text-[--mike-fg] placeholder:text-[--mike-fg-muted] outline-none transition ${
                  nome.trim().length === 0 ? 'border border-rose-500/40' :
                  nome.trim().length < 4 ? 'border border-amber-500/40' :
                  'mike-border-thin'
                }`}
              />
              <span className="absolute top-2.5 right-3 text-[10px] text-rose-400 font-bold">*</span>
            </div>
            {nome.trim().length > 0 && nome.trim().length < 4 && (
              <p className="text-[10px] text-amber-400 ml-1">
                Nome precisa de pelo menos 4 caracteres ({nome.trim().length}/4)
              </p>
            )}
            <textarea
              value={descricao} onChange={(e) => setDescricao(e.target.value)}
              placeholder="Coloque uma descrição para o seu bot (opcional). Exemplo: Aposte no mercado vencedor sempre que a equipe tiver mais que 5 cantos no primeiro tempo"
              rows={3}
              className="mike-border-thin w-full px-3 py-2.5 rounded-md bg-transparent text-xs text-[--mike-fg] placeholder:text-[--mike-fg-muted] outline-none resize-none leading-relaxed"
            />
          </div>
        </SecaoForm>

        {/* SECAO 2: CASA E ESPORTE */}
        <SecaoForm titulo="Casa e Esporte" descricao="Escolha o esporte e a casa de apostas que o seu bot vai observar.">
          <div className="space-y-1.5">
            <LinhaFiltro label="Esporte" comToggle={false}>
              <MikeSelect value={esporte} onChange={setEsporte} options={ESPORTES} />
            </LinhaFiltro>
            <LinhaFiltro label="Casa de Apostas" comToggle={false}>
              <MikeSelect value={casa} onChange={setCasa} options={CASAS_APOSTAS} />
            </LinhaFiltro>
          </div>
        </SecaoForm>

        {/* SECAO 3: TORNEIO + GRADE */}
        <SecaoForm titulo="Torneio e Grade" descricao="Escolha o torneio e, opcionalmente, grades específicas (variações). Sem grade selecionada, agrega todas as variações.">
          <LinhaFiltro
            ativo={torneioAtivo} onToggle={setTorneioAtivo} label="Torneio"
            info={torneiosCarregando ? "Buscando torneios disponiveis na casa..." :
                  torneiosReais.length > 0 ? `${torneiosReais.length} torneio(s) pai com ${torneiosReais.reduce((s,t) => s + (t.grades?.length || 0), 0)} grade(s) total nos ultimos 7 dias` :
                  "Sem dados recentes da casa - usando lista padrao"}
            comAcoes
            onCopiar={() => { navigator.clipboard?.writeText(torneios.join(', ')); adicionarToast('Torneios copiados', 'success'); }}
            onColar={async () => { try { const t = await navigator.clipboard?.readText(); if (t) setTorneios(t.split(',').map((x) => x.trim()).filter(Boolean)); } catch {} }}
          >
            {torneiosCarregando ? (
              <div className="flex items-center gap-2 text-[10px] text-[--mike-fg-muted] py-2">
                <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3"/>
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                </svg>
                Carregando torneios reais de {casa}/{esporte}...
              </div>
            ) : (
              <MultiTagInput
                valores={torneios}
                onChange={setTorneios}
                opcoes={torneiosDisp}
                placeholder={torneiosReais.length > 0
                  ? `${torneiosReais.length} torneio(s) pai - selecione um`
                  : "Selecione um torneio"}
              />
            )}
          </LinhaFiltro>

          {/* Linha de Grade — só aparece se torneio ativo + tem ao menos 1 torneio selecionado */}
          {torneioAtivo && torneios.length > 0 && (
            <LinhaFiltro
              ativo={gradesAtivo}
              onToggle={(v) => { setGradesAtivo(v); if (!v) setGradesSelecionadas([]); }}
              label="Grade"
              info="Filtrar variações específicas do torneio (ex: Battle - La Liga, Battle - Bundesliga). Sem nada selecionado, mostra todas."
            >
              {gradesCarregando ? (
                <div className="flex items-center gap-2 text-[10px] text-[--mike-fg-muted]">
                  <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3"/>
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                  </svg>
                  Carregando grades...
                </div>
              ) : gradesDisponiveis.length === 0 ? (
                <div className="text-[10px] text-[--mike-fg-muted]">
                  Nenhuma grade encontrada nos últimos 14 dias.
                </div>
              ) : (
                <MultiTagInput
                  valores={gradesSelecionadas}
                  onChange={setGradesSelecionadas}
                  opcoes={gradesDisponiveis.map(g => g.nome)}
                  placeholder={`${gradesDisponiveis.length} grade(s) disponíveis — deixe vazio para todas`}
                />
              )}
            </LinhaFiltro>
          )}

          {/* Checkboxes de modo whitelist/blacklist — só aparecem quando tem grades selecionadas */}
          {torneioAtivo && torneios.length > 0 && gradesAtivo && gradesSelecionadas.length > 0 && (
            <div className="flex items-center gap-6 ml-[212px] mt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="mike-checkbox"
                  checked={gradesModo === 'whitelist'}
                  onChange={() => setGradesModo('whitelist')}
                />
                <span className="text-xs text-[--mike-fg-soft]">Enviar somente para estas grades</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="mike-checkbox"
                  checked={gradesModo === 'blacklist'}
                  onChange={() => setGradesModo('blacklist')}
                />
                <span className="text-xs text-[--mike-fg-soft]">Ignorar estas grades</span>
              </label>
            </div>
          )}
        </SecaoForm>

        {/* SECAO 4: MERCADOS */}
        <SecaoForm titulo="Mercados" descricao="Escolha um mercado caso queira que o bot envie alertas somente quando o mercado estiver aberto e dentro dos filtros.">
          <div className="space-y-1.5">
            <LinhaFiltro label="Mercado" comToggle={false}>
              <MikeSelect value={mercado} onChange={setMercado} options={mercadosDisp} />
            </LinhaFiltro>

            <MercadoFiltros
              mercado={mercado}
              esporte={esporte}
              inner={inner}
              onInnerChange={setInner}
              selecaoAtivo={selecaoAtivo}
              onSelecaoAtivoChange={setSelecaoAtivo}
              linhaMin={linhaMin}
              linhaMax={linhaMax}
              onLinhaChange={(min, max) => { setLinhaMin(min); setLinhaMax(max); }}
              linhaAtivo={linhaAtivo}
              onLinhaAtivoChange={setLinhaAtivo}
            />

            {/* LIMITAR ODDS - filtro de odds min/max */}
            <LinhaFiltro
              label="Limitar Odds"
              info="Bot só apita tip se a odd estiver entre os valores definidos"
              ativo={limitarOddsAtivo}
              onToggle={setLimitarOddsAtivo}
            >
              <RangeSlider
                min={1}
                max={10}
                step={0.05}
                value={limitarOdds}
                onChange={setLimitarOdds}
                disabled={!limitarOddsAtivo}
              />
            </LinhaFiltro>
          </div>

          {/* CAIXA DOS FILTROS DE HISTORICO */}
          <BlocoFiltrosHistorico
            titulo="Filtros de histórico"
            campos={[
              { tipo: 'select', label: 'Versão do game', value: histVersao, onChange: setHistVersao, options: VERSOES_GAME },
              { tipo: 'select', label: 'Janela de partidas', value: histJanela, onChange: setHistJanela, options: JANELAS_PARTIDAS },
              { tipo: 'select', label: 'Tipo de histórico', value: histTipo, onChange: setHistTipo, options: TIPOS_HISTORICO },
              { tipo: 'select', label: 'Base de dados', value: histBase, onChange: setHistBase, options: BASES_DADOS },
              // v11: alvo do individual — só faz sentido em handicap e com base individual
              ...(histBase === 'individual' && ['ah_ft', 'ah_ht', 'eh_ft'].includes(mercado)
                ? [{ tipo: 'select', label: 'Alvo (handicap)', value: histIndivAlvo, onChange: setHistIndivAlvo, options: INDIV_ALVOS }]
                : []),
              { tipo: 'slider', label: 'Mínimo de partidas', value: histMinPartidas, onChange: setHistMinPartidas, min: 1, max: 50, sufixoMax: '50+' },
              { tipo: 'range', label: 'Probabilidade', value: histProb, onChange: setHistProb, min: 0, max: 100 },
            ]}
            filtrosAdicionados={filtrosHistAdicionados}
            onAdicionar={() => {
              setFiltrosHistAdicionados([...filtrosHistAdicionados, {
                versao: histVersao, janela: histJanela, tipo: histTipo,
                base: histBase, minPartidas: histMinPartidas, prob: [...histProb],
                ...(histBase === 'individual' ? { indivAlvo: histIndivAlvo } : {}),
              }]);
              adicionarToast(`Filter ${filtrosHistAdicionados.length + 1} adicionado`, 'success');
            }}
            onRemover={(idx) => {
              setFiltrosHistAdicionados(filtrosHistAdicionados.filter((_, i) => i !== idx));
              adicionarToast(`Filter ${idx + 1} removido`, 'warn');
            }}
            hover={filtroHistHover}
            onHoverChange={setFiltroHistHover}
            detalhesParaTooltip={(f) => [
              { label: 'Versão do game', valor: VERSOES_GAME.find((v) => v.value === f.versao)?.label },
              { label: 'Janela de partidas', valor: JANELAS_PARTIDAS.find((v) => v.value === f.janela)?.label },
              { label: 'Tipo de histórico', valor: TIPOS_HISTORICO.find((v) => v.value === f.tipo)?.label },
              { label: 'Base de dados', valor: BASES_DADOS.find((v) => v.value === f.base)?.label },
              ...(f.base === 'individual'
                ? [{ label: 'Alvo (HC)', valor: INDIV_ALVOS.find((v) => v.value === (f.indivAlvo || 'zebra'))?.label }]
                : []),
              { label: 'Mín. partidas', valor: f.minPartidas },
              { label: 'Probabilidade', valor: `${f.prob[0]}% - ${f.prob[1]}%` },
            ]}
          />
        </SecaoForm>

        {/* FILTROS COMPLEMENTARES */}
        <SecaoForm titulo="Filtros complementares" descricao="Adicione filtros de Média H2H, Gap de Médias, Z-Score, Gap de Linhas e Tendência. O Z-Score mede a quantos desvios-padrão a média está do lado favorável da linha (over: (média−linha)/desvio; under inverte) — quanto maior, mais consistente/seguro o par. Cada filtro adicionado vira um chip removível.">
          <BlocoFiltrosHistorico
            campos={[
              {
                tipo: 'select', label: 'Tipo',
                value: compTipo, onChange: setCompTipo,
                options: [
                  { value: 'media',     label: 'Média H2H' },
                  { value: 'gap_media', label: 'Gap de Médias' },
                  { value: 'zscore',    label: 'Z-Score' },
                  { value: 'gap_linha', label: 'Gap de Linhas' },
                  { value: 'tendencia', label: 'Tendência' },
                ],
              },
              ...(compTipo !== 'gap_linha' && compTipo !== 'tendencia' ? [{
                tipo: 'select', label: 'Janela',
                value: compJanela, onChange: setCompJanela,
                options: JANELAS_COMP,
              }] : []),
              {
                tipo: 'toggle_input', label: 'Mín',
                ativo: compMinAtivo, onToggle: setCompMinAtivo,
                value: compMin, onChange: setCompMin,
                placeholder: compTipo === 'gap_linha' ? 'Ex: 2' : compTipo === 'gap_media' ? 'Ex: 7' : compTipo === 'tendencia' ? 'Ex: 0' : compTipo === 'zscore' ? 'Ex: 0.8' : 'Ex: 55',
              },
              ...(compTipo !== 'tendencia' ? [{
                tipo: 'toggle_input', label: 'Máx',
                ativo: compMaxAtivo, onToggle: setCompMaxAtivo,
                value: compMax, onChange: setCompMax,
                placeholder: compTipo === 'gap_linha' ? 'Ex: 8' : compTipo === 'gap_media' ? 'Ex: 14' : compTipo === 'zscore' ? 'Ex: 3' : 'Ex: 70',
              }] : []),
            ]}
            filtrosAdicionados={filtrosCompAdicionados}
            onAdicionar={() => {
              setFiltrosCompAdicionados([...filtrosCompAdicionados, {
                tipo: compTipo, janela: compJanela,
                minAtivo: compMinAtivo, min: compMin,
                maxAtivo: compMaxAtivo, max: compMax,
              }]);
              adicionarToast('Filtro complementar adicionado', 'success');
            }}
            onRemover={(idx) => {
              setFiltrosCompAdicionados(filtrosCompAdicionados.filter((_, i) => i !== idx));
              adicionarToast('Filtro complementar removido', 'warn');
            }}
            hover={filtroCompHover}
            onHoverChange={setFiltroCompHover}
            detalhesParaTooltip={(f) => {
              const tipoLabel = { media: 'Média H2H', gap_media: 'Gap de Médias', zscore: 'Z-Score', gap_linha: 'Gap de Linhas', tendencia: 'Tendência' }[f.tipo] || f.tipo;
              const d = [{ label: 'Tipo', valor: tipoLabel }];
              if (f.tipo !== 'gap_linha' && f.tipo !== 'tendencia') d.push({ label: 'Janela', valor: _labelJanelaComp(f.janela) });
              d.push({ label: 'Mín', valor: f.minAtivo ? f.min : f.tipo === 'gap_media' ? 'auto (gap > 0)' : f.tipo === 'media' ? 'auto (linha ≤ média)' : '—' });
              if (f.tipo !== 'tendencia') d.push({ label: 'Máx', valor: f.maxAtivo ? f.max : '—' });
              return d;
            }}
          />
        </SecaoForm>

        {/* CENARIOS */}
        <SecaoForm titulo="Cenários" descricao="Escolha o favorito (menor odd no início do jogo), quem vai jogar em casa ou outras combinações. Deixe tudo desativado para mandar qualquer tipo de partida.">
          <div className="space-y-1.5">
            <LinhaFiltro label="Cenário da partida" info="Estado atual do jogo (placar/quem está vencendo) que dispara a tip" ativo={cenarioPartidaAtivo} onToggle={setCenarioPartidaAtivo}>
              <MikeSelect value={cenarioPartida} onChange={setCenarioPartida} options={[{ value: '', label: 'Selecione' }, ...cenariosDisp]} />
            </LinhaFiltro>

            {/* "Casa e favorito" so faz sentido em esportes com casa/visitante */}
            {capacidades.cenariosFull && (
              <LinhaFiltro label="Casa é favorito" info="Time da casa tem a menor odd no início (mais favorito)" ativo={casaFavoritoAtivo} onToggle={setCasaFavoritoAtivo}>
                <RadioGroup value={casaFavorito} onChange={setCasaFavorito} options={[{ value: 'sim', label: 'Sim' }, { value: 'nao', label: 'Não' }]} disabled={!casaFavoritoAtivo} />
              </LinhaFiltro>
            )}

            <LinhaFiltro label="Existe favorito" info="Existe diferença de odds entre as seleções" ativo={existeFavoritoAtivo} onToggle={setExisteFavoritoAtivo}>
              <RadioGroup value={existeFavorito} onChange={setExisteFavorito} options={[{ value: 'sim', label: 'Sim' }, { value: 'nao', label: 'Não' }]} disabled={!existeFavoritoAtivo} />
            </LinhaFiltro>

            <LinhaFiltro label="Alvo da tip é favorito" info="O time/jogador apostado é o favorito (menor odd inicial)" ativo={alvoFavoritoAtivo} onToggle={setAlvoFavoritoAtivo}>
              <RadioGroup value={alvoFavorito} onChange={setAlvoFavorito} options={[{ value: 'sim', label: 'Sim' }, { value: 'nao', label: 'Não' }]} disabled={!alvoFavoritoAtivo} />
            </LinhaFiltro>

            {/* "Diferenca de placar" so em esportes com placar comum (soccer/fifa/nba2k) */}
            {capacidades.cenariosFull && (
              <LinhaFiltro label="Diferença de Placar" info="Diferença máxima entre os placares" ativo={diferencaPlacarAtivo} onToggle={setDiferencaPlacarAtivo}>
                <SingleSlider min={0} max={50} step={1} value={diferencaPlacar} onChange={setDiferencaPlacar} sufixoMin={0} sufixoMax="50+" disabled={!diferencaPlacarAtivo} />
              </LinhaFiltro>
            )}
          </div>
        </SecaoForm>

        {/* FILTROS AO VIVO */}
        <SecaoForm titulo="Filtros ao vivo" descricao="Informe os stats da partida atual que o bot deve esperar">
          {/* Ativar subfiltro - so quando capacidades.cenariosFull (esportes com casa/fora etc) */}
          {capacidades.cenariosFull && (
            <div className="text-center mb-3">
              <p className="text-[10px] font-bold text-[--mike-fg-soft] mb-1.5">Ativar subfiltro</p>
              <div className="flex items-center justify-center gap-5">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" className="mike-checkbox" checked={subfCasaFora} onChange={(e) => setSubfCasaFora(e.target.checked)} />
                  <span className="text-xs text-[--mike-fg-soft]">Casa/Fora</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" className="mike-checkbox" checked={subfFavAzarao} onChange={(e) => setSubfFavAzarao(e.target.checked)} />
                  <span className="text-xs text-[--mike-fg-soft]">Favorito/Azarão</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" className="mike-checkbox" checked={subfAlvoOpon} onChange={(e) => setSubfAlvoOpon(e.target.checked)} />
                  <span className="text-xs text-[--mike-fg-soft]">Alvo da Tip/Oponente</span>
                </label>
              </div>
            </div>
          )}

          {/* Quartos (so basquete) */}
          {capacidades.temQuartos && (
            <div className="text-center mb-3">
              <p className="text-[10px] font-bold text-[--mike-fg-soft] mb-1.5">Aplicar nos quartos</p>
              <div className="flex items-center justify-center gap-4 flex-wrap">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" className="mike-checkbox" checked={quartosAtivos.q1} onChange={(e) => setQuartosAtivos({ ...quartosAtivos, q1: e.target.checked })} />
                  <span className="text-xs text-[--mike-fg-soft]">1° Quarto</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" className="mike-checkbox" checked={quartosAtivos.q2} onChange={(e) => setQuartosAtivos({ ...quartosAtivos, q2: e.target.checked })} />
                  <span className="text-xs text-[--mike-fg-soft]">2° Quarto</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" className="mike-checkbox" checked={quartosAtivos.q3} onChange={(e) => setQuartosAtivos({ ...quartosAtivos, q3: e.target.checked })} />
                  <span className="text-xs text-[--mike-fg-soft]">3° Quarto</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" className="mike-checkbox" checked={quartosAtivos.q4} onChange={(e) => setQuartosAtivos({ ...quartosAtivos, q4: e.target.checked })} />
                  <span className="text-xs text-[--mike-fg-soft]">4° Quarto</span>
                </label>
              </div>
            </div>
          )}

          {/* Grid 2 colunas - filtros dinamicos por esporte */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5">
            {/* Coluna esquerda: tempo + ataques + chutes + cantos + cart vermelhos */}
            <div className="space-y-1.5">
              {filtrosLiveDisp.tempo && (
                <LinhaFiltro label={filtrosLiveDisp.tempo.label} ativo={tempoAtivo} onToggle={setTempoAtivo} labelLargura="w-32">
                  <SingleSlider min={filtrosLiveDisp.tempo.min} max={filtrosLiveDisp.tempo.max} value={tempo} onChange={setTempo} sufixoMin={0} sufixoMax={filtrosLiveDisp.tempo.sufixo} disabled={!tempoAtivo} />
                </LinhaFiltro>
              )}
              {filtrosLiveDisp.ataques && (
                <LinhaFiltro label={filtrosLiveDisp.ataques.label} ativo={ataquesAtivo} onToggle={setAtaquesAtivo} labelLargura="w-32">
                  <SingleSlider min={filtrosLiveDisp.ataques.min} max={filtrosLiveDisp.ataques.max} value={ataques} onChange={setAtaques} sufixoMin={0} sufixoMax={filtrosLiveDisp.ataques.sufixo} disabled={!ataquesAtivo} />
                </LinhaFiltro>
              )}
              {filtrosLiveDisp.chutes && (
                <LinhaFiltro label={filtrosLiveDisp.chutes.label} ativo={chutesAtivo} onToggle={setChutesAtivo} labelLargura="w-32">
                  <SingleSlider min={filtrosLiveDisp.chutes.min} max={filtrosLiveDisp.chutes.max} value={chutes} onChange={setChutes} sufixoMin={0} sufixoMax={filtrosLiveDisp.chutes.sufixo} disabled={!chutesAtivo} />
                </LinhaFiltro>
              )}
              {filtrosLiveDisp.cantos && (
                <LinhaFiltro label={filtrosLiveDisp.cantos.label} ativo={cantosAtivo} onToggle={setCantosAtivo} labelLargura="w-32">
                  <SingleSlider min={filtrosLiveDisp.cantos.min} max={filtrosLiveDisp.cantos.max} value={cantos} onChange={setCantos} sufixoMin={0} sufixoMax={filtrosLiveDisp.cantos.sufixo} disabled={!cantosAtivo} />
                </LinhaFiltro>
              )}
              {filtrosLiveDisp.cartVermelhos && (
                <LinhaFiltro label={filtrosLiveDisp.cartVermelhos.label} ativo={cartVermelhosAtivo} onToggle={setCartVermelhosAtivo} labelLargura="w-32">
                  <SingleSlider min={filtrosLiveDisp.cartVermelhos.min} max={filtrosLiveDisp.cartVermelhos.max} value={cartVermelhos} onChange={setCartVermelhos} sufixoMin={0} sufixoMax={filtrosLiveDisp.cartVermelhos.sufixo} disabled={!cartVermelhosAtivo} />
                </LinhaFiltro>
              )}
            </div>

            {/* Coluna direita: placares + ataques perigosos + chutes no gol + cart amarelos */}
            <div className="space-y-1.5">
              {filtrosLiveDisp.placares && (
                <LinhaFiltro label={filtrosLiveDisp.placares.label} ativo={placaresAtivo} onToggle={setPlacaresAtivo} labelLargura="w-32">
                  <input
                    type="text" value={placares} onChange={(e) => setPlacares(e.target.value)}
                    placeholder="Ex: 0-0, 1-0"
                    disabled={!placaresAtivo}
                    className="mike-border-thin w-full px-3 py-2 rounded-md bg-transparent text-xs text-[--mike-fg] outline-none"
                  />
                </LinhaFiltro>
              )}
              {filtrosLiveDisp.ataquesPerigosos && (
                <LinhaFiltro label={filtrosLiveDisp.ataquesPerigosos.label} ativo={ataquesPerigososAtivo} onToggle={setAtaquesPerigososAtivo} labelLargura="w-32">
                  <SingleSlider min={filtrosLiveDisp.ataquesPerigosos.min} max={filtrosLiveDisp.ataquesPerigosos.max} value={ataquesPerigosos} onChange={setAtaquesPerigosos} sufixoMin={0} sufixoMax={filtrosLiveDisp.ataquesPerigosos.sufixo} disabled={!ataquesPerigososAtivo} />
                </LinhaFiltro>
              )}
              {filtrosLiveDisp.chutesGol && (
                <LinhaFiltro label={filtrosLiveDisp.chutesGol.label} ativo={chutesGolAtivo} onToggle={setChutesGolAtivo} labelLargura="w-32">
                  <SingleSlider min={filtrosLiveDisp.chutesGol.min} max={filtrosLiveDisp.chutesGol.max} value={chutesGol} onChange={setChutesGol} sufixoMin={0} sufixoMax={filtrosLiveDisp.chutesGol.sufixo} disabled={!chutesGolAtivo} />
                </LinhaFiltro>
              )}
              {filtrosLiveDisp.cartAmarelos && (
                <LinhaFiltro label={filtrosLiveDisp.cartAmarelos.label} ativo={cartAmarelosAtivo} onToggle={setCartAmarelosAtivo} labelLargura="w-32">
                  <SingleSlider min={filtrosLiveDisp.cartAmarelos.min} max={filtrosLiveDisp.cartAmarelos.max} value={cartAmarelos} onChange={setCartAmarelos} sufixoMin={0} sufixoMax={filtrosLiveDisp.cartAmarelos.sufixo} disabled={!cartAmarelosAtivo} />
                </LinhaFiltro>
              )}
            </div>
          </div>
        </SecaoForm>

        {/* FILTRAR PARTIDAS */}
        <SecaoForm titulo="Filtrar Partidas" descricao="Adicione ou remova partidas específicas do seu filtro">
          {!torneioAtivo || torneios.length === 0 ? (
            <div className="text-center py-4 text-[11px]" style={{ color: '#6b7691' }}>
              Selecione um torneio na seção "Torneio e Grade" para habilitar os filtros de partidas.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <CaixaFiltrarPartidas
                cor="verde" titulo="Apenas partidas específicas"
                ativo={apenasEspecificasAtivo} onToggle={setApenasEspecificasAtivo}
                jogadores={participantes.jogadores} times={participantes.times} carregando={participantes.carregando}
                estado={apenasEspecificasEstado} onChange={setApenasEspecificasEstado}
                torneioNome={torneios[0] || ''}
              />
              <CaixaFiltrarPartidas
                cor="rosa" titulo="Ignorar partidas específicas"
                ativo={ignorarEspecificasAtivo} onToggle={setIgnorarEspecificasAtivo}
                jogadores={participantes.jogadores} times={participantes.times} carregando={participantes.carregando}
                estado={ignorarEspecificasEstado} onChange={setIgnorarEspecificasEstado}
                torneioNome={torneios[0] || ''}
              />
              <CaixaBlacklistJogador
                cor="rosa" titulo="Blacklist de zebra (nunca apostar nestes no +)"
                descricao="No Handicap, o bot aposta na zebra (lado +). Estes jogadores nunca serão apostados como zebra, mesmo que passem no cover%."
                ativo={blacklistZebraAtivo} onToggle={setBlacklistZebraAtivo}
                jogadores={participantes.jogadores} carregando={participantes.carregando}
                estado={blacklistZebraEstado} onChange={setBlacklistZebraEstado}
              />
              <CaixaBlacklistJogador
                cor="rosa" titulo="Blacklist de favorito (pular quando o adversário for)"
                descricao="Pula a aposta quando o FAVORITO (o adversário da zebra, lado −) for um destes jogadores."
                ativo={blacklistFavoritoAtivo} onToggle={setBlacklistFavoritoAtivo}
                jogadores={participantes.jogadores} carregando={participantes.carregando}
                estado={blacklistFavoritoEstado} onChange={setBlacklistFavoritoEstado}
              />
            </div>
          )}
        </SecaoForm>

        {/* EVITAR LINHAS SEQ + MAX TIPS POR JOGO */}
        <div className="rounded-lg p-4 mb-6 space-y-3" style={{ backgroundColor: 'rgba(60,85,130,0.06)', border: '0.5px solid rgba(60,85,130,0.3)' }}>
          {/* Evitar linhas sequenciais */}
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="mike-checkbox" checked={evitarLinhasSeq} onChange={(e) => setEvitarLinhasSeq(e.target.checked)} />
            <span className="text-xs text-[--mike-fg-soft]">Evitar linhas em sequência para o mesmo mercado durante uma partida.</span>
          </label>

          {/* Max tips por jogo — só aparece quando evitarLinhasSeq está DESMARCADO */}
          {!evitarLinhasSeq && (
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs text-[--mike-fg-soft]">Aceito receber</span>
              <div className="w-32">
                <MikeSelect
                  value={maxTipsPorJogo}
                  onChange={setMaxTipsPorJogo}
                  options={[
                    { value: 'ilimitado', label: 'ilimitadas' },
                    { value: '2',  label: 'até 2' },
                    { value: '3',  label: 'até 3' },
                    { value: '4',  label: 'até 4' },
                    { value: '5',  label: 'até 5' },
                    { value: '6',  label: 'até 6' },
                    { value: '7',  label: 'até 7' },
                    { value: '8',  label: 'até 8' },
                    { value: '9',  label: 'até 9' },
                    { value: '10', label: 'até 10' },
                  ]}
                />
              </div>
              <span className="text-xs text-[--mike-fg-soft]">tips para o mesmo jogo</span>
            </div>
          )}
        </div>

        {/* AÇÕES */}
        <div className="sticky bottom-0 -mx-4 px-4 py-4 backdrop-blur-md flex items-center gap-2" style={{
          backgroundColor: 'rgba(11, 15, 26, 0.92)',
          borderTop: '0.5px solid rgba(60, 85, 130, 0.4)',
        }}>
          {modoEdicao && (
            <button
              onClick={async () => {
                if (window.confirm(`Tem certeza que quer deletar "${nome}"? Esta ação é irreversível.`)) {
                  try {
                    await ApiBots.delete(botId);
                    adicionarToast(`Bot "${nome}" deletado`, 'error');
                    if (onSalvar) setTimeout(() => onSalvar(null), 800);
                  } catch (e) {
                    adicionarToast(`Erro ao deletar: ${e.message}`, 'error');
                  }
                }
              }}
              disabled={salvando}
              className="mike-border-thin flex items-center gap-1.5 px-3 py-2 rounded-md bg-transparent text-xs text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/50 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Deletar
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={handleCancelar}
            disabled={salvando}
            className="mike-border-thin flex items-center gap-1.5 px-4 py-2 rounded-md bg-transparent text-xs font-semibold text-[--mike-fg-soft] hover:text-[--mike-fg] transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancelar
          </button>
          <button
            onClick={salvarBot}
            disabled={salvando}
            className="flex items-center gap-1.5 px-6 py-2 rounded-md bg-[--mike-accent] hover:bg-emerald-400 text-[--mike-bg] text-xs font-bold transition-transform duration-200 hover:scale-105 active:scale-95 shadow-md shadow-[--mike-accent]/30 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {salvando ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3"/>
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                </svg>
                {modoEdicao ? 'SALVANDO...' : 'CRIANDO...'}
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                {modoEdicao ? 'SALVAR ALTERAÇÕES' : 'CRIAR BOT'}
              </>
            )}
          </button>
        </div>
      </main>

      {/* MODAL PREVIEW JSON */}
      {previewAberto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 mike-tooltip-in"
          style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={() => setPreviewAberto(false)}
        >
          <div
            className="mike-dropdown-in w-full max-w-3xl max-h-[80vh] flex flex-col rounded-lg overflow-hidden"
            style={{
              backgroundColor: '#0d1220',
              border: '0.5px solid rgba(60, 85, 130, 0.6)',
              boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '0.5px solid rgba(60,85,130,0.4)' }}>
              <Code className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-[--mike-fg] flex-1">Preview do Bot</h3>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(JSON.stringify(formState, null, 2));
                  adicionarToast('JSON copiado', 'success');
                }}
                className="mike-border-thin flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold text-[--mike-fg-soft] hover:text-[--mike-accent] transition"
              >
                <Copy className="w-3 h-3" /> Copiar JSON
              </button>
              <button onClick={() => setPreviewAberto(false)} className="text-[--mike-fg-muted] hover:text-[--mike-fg] transition">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-auto mike-mercados-scroll p-4 space-y-4">
              {/* RESUMO HUMANO */}
              <div className="rounded-md p-3" style={{ backgroundColor: 'rgba(16, 185, 129, 0.05)', border: '0.5px solid rgba(16, 185, 129, 0.3)' }}>
                <div className="flex items-center gap-1.5 mb-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">O que esse bot vai fazer</span>
                </div>
                <div className="text-[12px] text-[--mike-fg-soft] leading-relaxed space-y-1">
                  {(() => {
                    const partes = [];
                    const esporteLabel = (ESPORTES.find(e => e.value === esporte) || {}).label || esporte;
                    const casaLabel = (CASAS_APOSTAS.find(c => c.value === casa) || {}).label || casa;
                    const mercadoLabel = (mercadosDisp.find(m => m.value === mercado) || {}).label || mercado;

                    partes.push(<p key="base"><strong className="text-[--mike-fg]">Bot "{nome || '(sem nome)'}"</strong> opera em <strong className="text-cyan-400">{esporteLabel}</strong> na <strong className="text-cyan-400">{casaLabel}</strong>, mercado <strong className="text-cyan-400">{mercadoLabel}</strong>.</p>);

                    if (torneioAtivo && torneios.length > 0) {
                      partes.push(<p key="torn">→ Apenas torneios: <span className="text-amber-400">{torneios.join(', ')}</span></p>);
                    } else if (!torneioAtivo) {
                      partes.push(<p key="torn">→ Todos os torneios disponíveis</p>);
                    }

                    if (limitarOddsAtivo) {
                      partes.push(<p key="odds">→ Apenas odds entre <span className="text-emerald-400 font-mono">{limitarOdds[0].toFixed(2)}</span> e <span className="text-emerald-400 font-mono">{limitarOdds[1].toFixed(2)}</span></p>);
                    }

                    if (cenarioPartidaAtivo && cenarioPartida) {
                      const cenLabel = (cenariosDisp.find(c => c.value === cenarioPartida) || {}).label || cenarioPartida;
                      partes.push(<p key="cen">→ Cenário da partida: <span className="text-amber-400">{cenLabel}</span></p>);
                    }

                    if (alvoMesmaGradeAtivo || alvoUlt8Ativo || oponMesmaGradeAtivo || oponUlt8Ativo) {
                      partes.push(<p key="wr">→ Filtros de WR ativos no alvo/oponente</p>);
                    }

                    if (filtrosHistAdicionados.length > 0) {
                      partes.push(<p key="fh">→ {filtrosHistAdicionados.length} filtro(s) de histórico aplicado(s)</p>);
                    }

                    if (filtrosCompAdicionados && filtrosCompAdicionados.length > 0) {
                      partes.push(<p key="fc">→ {filtrosCompAdicionados.length} filtro(s) complementar(es)</p>);
                    }

                    const filtrosLiveAtivos = [
                      tempoAtivo && 'tempo', ataquesAtivo && 'ataques', chutesAtivo && 'chutes',
                      cantosAtivo && 'cantos', placaresAtivo && 'placares específicos',
                      cartAmarelosAtivo && 'cart. amarelos', cartVermelhosAtivo && 'cart. vermelhos',
                    ].filter(Boolean);
                    if (filtrosLiveAtivos.length > 0) {
                      partes.push(<p key="live">→ Filtros ao vivo: <span className="text-amber-400">{filtrosLiveAtivos.join(', ')}</span></p>);
                    }

                    if (capacidades.temQuartos) {
                      const qAtivos = Object.entries(quartosAtivos).filter(([_, v]) => v).map(([k]) => k.toUpperCase());
                      if (qAtivos.length > 0 && qAtivos.length < 4) {
                        partes.push(<p key="qt">→ Quartos: <span className="text-amber-400">{qAtivos.join(', ')}</span></p>);
                      }
                    }

                    return partes;
                  })()}
                </div>
              </div>

              {/* JSON BRUTO */}
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Code className="w-3.5 h-3.5 text-[--mike-fg-muted]" />
                  <span className="text-[10px] font-bold text-[--mike-fg-muted] uppercase tracking-wider">JSON técnico (vai pra API)</span>
                </div>
                <pre className="text-[11px] text-[--mike-fg-soft] font-mono leading-relaxed whitespace-pre-wrap break-all p-3 rounded" style={{ backgroundColor: 'rgba(0,0,0,0.3)', border: '0.5px solid rgba(60,85,130,0.3)' }}>
{JSON.stringify(formState, null, 2)}
                </pre>
              </div>
            </div>
            <div className="px-4 py-2 text-[10px] text-[--mike-fg-muted] flex items-center justify-between" style={{ borderTop: '0.5px solid rgba(60,85,130,0.4)' }}>
              <span>{Object.keys(formState).length} campos</span>
              <span>Pressione ESC ou clique fora para fechar</span>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMAR RESET */}
      {confirmarReset && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 mike-tooltip-in"
          style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={() => setConfirmarReset(false)}
        >
          <div
            className="mike-dropdown-in w-full max-w-sm rounded-lg overflow-hidden"
            style={{
              backgroundColor: '#0d1220',
              border: '0.5px solid rgba(244, 63, 94, 0.5)',
              boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(244,63,94,0.15)' }}>
                  <AlertCircle className="w-5 h-5 text-rose-400" />
                </div>
                <h3 className="text-base font-bold text-[--mike-fg]">Resetar tudo?</h3>
              </div>
              <p className="text-xs text-[--mike-fg-soft] leading-relaxed mb-4">
                Isso vai limpar <strong className="text-[--mike-fg]">todos os campos</strong> e voltar aos valores padrão. O rascunho salvo também será apagado. Esta ação não pode ser desfeita.
              </p>
              <div className="flex items-center gap-2 justify-end">
                <button
                  onClick={() => setConfirmarReset(false)}
                  className="mike-border-thin px-3 py-2 rounded-md text-xs font-semibold text-[--mike-fg-soft] hover:text-[--mike-fg] transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={async () => {
                    resetarFormulario();
                    try {
                      if (window.storage) await window.storage.delete(STORAGE_KEY);
                    } catch {}
                    setUltimoSalvamento(null);
                    setTemAlteracoesNaoSalvas(false);
                    setConfirmarReset(false);
                    adicionarToast('Formulário resetado', 'warn');
                  }}
                  className="px-4 py-2 rounded-md text-xs font-bold text-white bg-rose-500 hover:bg-rose-400 transition shadow-md shadow-rose-500/30"
                >
                  Sim, resetar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TOASTS */}
      <div className="fixed top-20 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => {
          const corMap = {
            success: { bg: 'bg-emerald-500/95', icon: <CheckCircle2 className="w-4 h-4" /> },
            warn:    { bg: 'bg-amber-500/95',   icon: <AlertCircle className="w-4 h-4" /> },
            error:   { bg: 'bg-rose-500/95',    icon: <X className="w-4 h-4" /> },
            info:    { bg: 'bg-cyan-500/95',    icon: <Bell className="w-4 h-4" /> },
          };
          const cor = corMap[t.tipo] || corMap.info;
          return (
            <div key={t.id} className={`${cor.bg} mike-toast-in pointer-events-auto rounded-lg px-3 py-2 shadow-2xl backdrop-blur-md min-w-[240px] flex items-center gap-2 text-black`}>
              {cor.icon}
              <span className="text-xs font-bold flex-1">{t.mensagem}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}