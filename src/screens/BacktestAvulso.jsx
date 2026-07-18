// ============================================================
// BacktestAvulso.jsx - Backtest standalone (sem bot)
//
// Sobe um parquet de ticks e testa filtros proprios (WR do H2H,
// placar, tempo/quartos, black/white list de nicks, mercado/lado)
// sem precisar de um bot. Roda via POST /backtest/jobs-avulso e faz
// polling do job ate concluir, mostrando ROI/PnL/WR/Drawdown + ressalvas.
//
// Segue o mesmo padrao visual das outras telas (MikeHeader, themeVars,
// cards rgba, lucide-react, fonte mono nos numeros).
//
// 🔌 BACKEND:
//   POST /backtest/upload-ticks  -> upload_id + resumo
//   POST /backtest/jobs-avulso   -> job_id (dispara worker)
//   GET  /backtest/jobs/:id      -> status + resultado (polling)
// ============================================================

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  Home, ChevronRight, FlaskConical, Upload, Filter, Play, RefreshCw,
  AlertCircle, AlertTriangle, Target, Percent, DollarSign, Hash, Trophy,
  TrendingDown, Layers, Ban, CheckCircle2, FileUp, Download,
} from 'lucide-react';
import MikeHeader from '../shared/MikeHeader.jsx';
import { ApiBacktest } from '../lib/api.js';

// ============================================================
// CONSTANTES
// ============================================================

const CASAS = [
  { value: 'betano', label: 'Betano' },
  { value: 'superbet', label: 'Superbet' },
  { value: 'bet365', label: 'Bet365' },
  { value: 'estrelabet', label: 'Estrelabet' },
  { value: 'meridianbet', label: 'Meridianbet' },
];
const ESPORTES = [
  { value: 'fifa', label: 'E-Football (FIFA)', icon: '⚽' },
  { value: 'nba2k', label: 'E-Basketball (NBA2K)', icon: '🏀' },
];
const MERCADOS = [
  { value: 'over_under_ft', label: 'Over/Under FT (jogo todo)' },
  { value: 'over_under_ht', label: 'Over/Under HT (1º tempo)' },
  { value: 'ah_ft', label: 'HC Asiático FT (handicap)' },
];
const LADOS = [
  { value: 'ambos', label: 'Ambos' },
  { value: 'over', label: 'Over' },
  { value: 'under', label: 'Under' },
];
// v11: base do filtro de histórico — confronto do par x individual de cada jogador
const BASES_HIST = [
  { value: 'match', label: 'Confronto (par)' },
  { value: 'individual', label: 'Individual (cada jogador)' },
];
// v11: alvo do individual no HANDICAP — 'zebra' (default) ou zebra+favorito
const INDIV_ALVOS = [
  { value: 'zebra', label: 'Só a zebra' },
  { value: 'ambos', label: 'Zebra + favorito' },
];
const CENARIOS = [
  { value: '', label: '(qualquer)' },
  { value: 'casa_vencendo', label: 'Casa vencendo' },
  { value: 'casa_perdendo', label: 'Casa perdendo' },
  { value: 'empate', label: 'Empate' },
];

// Filtros complementares (H2H) - mesmo formato do CriarBot / bot ao vivo.
const TIPOS_COMP = [
  { value: 'media',     label: 'Média H2H' },
  { value: 'gap_media', label: 'Gap de Médias' },
  { value: 'zscore',    label: 'Z-Score' },
  { value: 'gap_linha', label: 'Gap de Linhas' },
  { value: 'tendencia', label: 'Tendência' },
  { value: 'hc_wr',     label: 'WR de Cobertura (HC)' },
];
// Janela: mesmo dropdown do bot ao vivo (quantidade ou tempo).
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
];
// WR do H2H: janela no formato do bot ao vivo ("all"/"last_N"/"last_Nh"/"last_Nd").
// O backend do filtro hist ACEITA tempo (last_1h/last_1d/last_7d), igual a média/gap.
const JANELAS_WR = [
  { value: 'all',      label: 'Todas' },
  { value: 'last_1',   label: 'Últ. 1' },
  { value: 'last_5',   label: 'Últ. 5' },
  { value: 'last_10',  label: 'Últ. 10' },
  { value: 'last_15',  label: 'Últ. 15' },
  { value: 'last_20',  label: 'Últ. 20' },
  { value: 'last_30',  label: 'Últ. 30' },
  { value: 'last_50',  label: 'Últ. 50' },
  { value: 'last_100', label: 'Últ. 100' },
  { value: 'last_1h',  label: 'Últ. 1 hora' },
  { value: 'last_8h',  label: 'Últ. 8 horas' },
  { value: 'last_1d',  label: 'Últ. 24h' },
  { value: 'last_7d',  label: 'Últ. 7 dias' },
  { value: 'last_30d', label: 'Últ. 30 dias' },
];
const TIPO_COMP_LABEL = {
  media: 'Média', gap_media: 'Gap Méd', zscore: 'Z', gap_linha: 'Gap Linha', tendencia: 'Tend', hc_wr: 'Cob. HC',
};
// placeholder do Mín por tipo (mesmos exemplos do CriarBot)
function _phMinComp(tipo) {
  return tipo === 'gap_linha' ? 'Ex: 2'
    : tipo === 'gap_media' ? 'Ex: 7'
    : tipo === 'tendencia' ? 'Ex: 0'
    : tipo === 'zscore' ? 'Ex: 0.8'
    : tipo === 'hc_wr' ? 'Ex: 0.9'
    : 'Ex: 55';
}
function _phMaxComp(tipo) {
  return tipo === 'gap_linha' ? 'Ex: 8'
    : tipo === 'gap_media' ? 'Ex: 14'
    : tipo === 'zscore' ? 'Ex: 3'
    : tipo === 'hc_wr' ? 'Ex: 1'
    : 'Ex: 70';
}
// rótulo curto do chip
function _labelChipComp(f) {
  const t = TIPO_COMP_LABEL[f.tipo] || f.tipo;
  const semJanela = (f.tipo === 'gap_linha' || f.tipo === 'tendencia');
  const jl = JANELAS_COMP.find(j => String(j.value) === String(f.janela));
  const jstr = semJanela ? '' : ` · ${jl ? jl.label : f.janela}`;
  const parts = [];
  if (f.minAtivo && f.min !== '' && f.min != null) parts.push(`≥${f.min}`);
  if (f.maxAtivo && f.max !== '' && f.max != null) parts.push(`≤${f.max}`);
  const lim = parts.length ? ` · ${parts.join(' ')}` : ' · (sem limite)';
  return `${t}${jstr}${lim}`;
}

// rótulo do chip de filtro de WR (histórico)
function _labelChipHist(f) {
  const jl = JANELAS_WR.find(j => String(j.value) === String(f.janela));
  const jstr = jl ? jl.label : f.janela;
  const wr = (f.prob[1] >= 100) ? `≥${f.prob[0]}%` : `${f.prob[0]}-${f.prob[1]}%`;
  const mp = f.minPartidas ? ` · ${f.minPartidas}+ conf.` : '';
  // v11: marca chips de base individual (e o alvo, se zebra+favorito)
  const base = f.base === 'individual'
    ? (f.indivAlvo === 'ambos' ? ' · IND z+fav' : ' · IND') : '';
  return `${jstr} · ${wr}${mp}${base}`;
}

const POLL_MS = 2000;
const POLL_TIMEOUT_MS = 10 * 60 * 1000;


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

// helper: string de input -> numero ou null
function numOuNull(v) {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// ============================================================
// COMPONENTES BASE (mesmo estilo das outras telas)
// ============================================================

function Campo({ label, children, hint }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-[--mike-fg-soft] font-medium">{label}</span>
      {children}
      {hint && <span className="text-[9px] text-[--mike-fg-muted]">{hint}</span>}
    </label>
  );
}

function Select({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="mike-border-thin bg-transparent text-xs text-[--mike-fg] px-3 py-2 rounded-md outline-none cursor-pointer w-full"
      style={{ appearance: 'none', WebkitAppearance: 'none' }}
    >
      {options.map(o => (
        <option key={o.value} value={o.value} style={{ background: '#141a28' }}>
          {o.icon ? `${o.icon} ` : ''}{o.label}
        </option>
      ))}
    </select>
  );
}

function Input({ value, onChange, placeholder, type = 'text', min }) {
  return (
    <input
      type={type}
      min={min}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="mike-border-thin bg-transparent text-xs text-[--mike-fg] px-3 py-2 rounded-md outline-none w-full placeholder:text-[--mike-fg-muted]"
    />
  );
}

function SecaoTitulo({ icon: Icon, children }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="w-1 h-4 rounded-full bg-cyan-500" />
      <h2 className="text-sm font-bold text-[--mike-fg] flex items-center gap-1.5">
        {Icon && <Icon className="w-3.5 h-3.5 text-cyan-400" />}
        {children}
      </h2>
    </div>
  );
}

function StatCard({ icon: Icon, label, valor, cor = '#eaeef7' }) {
  return (
    <div className="rounded-lg p-3" style={{
      backgroundColor: 'rgba(20, 26, 40, 0.4)',
      border: '0.5px solid rgba(60, 85, 130, 0.4)',
    }}>
      <div className="flex items-center gap-1.5 mb-1.5">
        {Icon && <Icon className="w-3 h-3 flex-shrink-0" style={{ color: cor }} />}
        <span className="text-[9px] uppercase tracking-wider text-[--mike-fg-muted] font-bold truncate">{label}</span>
      </div>
      <div className="text-lg font-black font-mono leading-tight truncate" style={{ color: cor }}>{valor}</div>
    </div>
  );
}

// Barras por dia (estilo TM): green embaixo, red em cima, altura = apostas do dia.
function BarrasPorDia({ dias }) {
  if (!dias || dias.length === 0) return null;
  const maxN = Math.max(...dias.map(d => d.g + d.r + d.v), 1);
  return (
    <div>
      <div className="flex items-end gap-[3px] h-24">
        {dias.map((d, i) => {
          const tot = d.g + d.r + d.v;
          const hTot = Math.max(4, (tot / maxN) * 96);
          const hG = tot ? (d.g / tot) * hTot : 0;
          const hR = tot ? (d.r / tot) * hTot : 0;
          const hV = hTot - hG - hR;
          return (
            <div key={i} className="flex-1 flex flex-col justify-end min-w-0" title={`${d.data}: ${d.g}G ${d.r}R${d.v ? ` ${d.v}V` : ''} · PnL R$ ${d.pnl >= 0 ? '+' : ''}${d.pnl.toFixed(1)}`}>
              {hV > 0 && <div style={{ height: hV, backgroundColor: 'rgba(107,118,145,0.5)' }} />}
              <div style={{ height: hR, backgroundColor: '#f43f5e' }} />
              <div style={{ height: hG, backgroundColor: '#10b981', borderRadius: '2px 2px 0 0' }} />
            </div>
          );
        })}
      </div>
      <div className="flex gap-[3px] mt-1">
        {dias.map((d, i) => (
          <div key={i} className="flex-1 text-center text-[7px] text-[--mike-fg-muted] font-mono overflow-hidden">
            {d.data.slice(8, 10)}
          </div>
        ))}
      </div>
    </div>
  );
}

// Curva de equity (banca ao longo das apostas), SVG puro. Linha da banca
// inicial tracejada; area verde acima / rosa abaixo da inicial.
function CurvaEquity({ pontos, bancaInicial }) {
  if (!pontos || pontos.length < 2) return null;
  const W = 320, H = 72, PAD = 2;
  const vals = pontos.map(p => Number(p.banca));
  const vMin = Math.min(...vals, bancaInicial);
  const vMax = Math.max(...vals, bancaInicial);
  const range = (vMax - vMin) || 1;
  const x = (i) => PAD + (i / (pontos.length - 1)) * (W - 2 * PAD);
  const y = (v) => PAD + (1 - (v - vMin) / range) * (H - 2 * PAD);
  const pts = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const yBase = y(bancaInicial);
  const fim = vals[vals.length - 1];
  const cor = fim >= bancaInicial ? '#10b981' : '#f43f5e';
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      <line x1={PAD} y1={yBase} x2={W - PAD} y2={yBase} stroke="rgba(107,118,145,0.5)" strokeWidth="1" strokeDasharray="4 3" />
      <polyline points={pts} fill="none" stroke={cor} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

// Grupo visual de filtros: caixa recuada, barra colorida, titulo + descricao.
// Serve pra dar hierarquia real (cada grupo = uma categoria de filtro).
function Grupo({ icon: Icon, cor, titulo, desc, children }) {
  return (
    <div className="rounded-lg p-3.5" style={{
      backgroundColor: 'rgba(13,17,27,0.5)',
      border: '0.5px solid rgba(60,85,130,0.28)',
    }}>
      <div className="flex items-start gap-2.5 mb-3">
        <div className="w-[3px] self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: cor }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {Icon && <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: cor }} />}
            <h3 className="text-[13px] font-bold text-[--mike-fg]">{titulo}</h3>
          </div>
          {desc && <p className="text-[10px] text-[--mike-fg-muted] mt-1 leading-snug">{desc}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

// Sub-rotulo leve dentro de um Grupo (separa sub-blocos sem repetir o header).
function SubLabel({ children }) {
  return (
    <div className="text-[10px] uppercase tracking-wide text-[--mike-fg-soft] font-semibold mb-1.5">
      {children}
    </div>
  );
}

// Divisoria fina entre sub-blocos dentro de um Grupo.
function DivFina() {
  return <div className="h-px my-3.5" style={{ backgroundColor: 'rgba(60,85,130,0.18)' }} />;
}

// ============================================================
// TELA
// ============================================================

export default function BacktestAvulso({ onNavegar } = {}) {
  // upload
  const [arquivo, setArquivo] = useState(null);
  const [subindo, setSubindo] = useState(false);
  const [resumo, setResumo] = useState(null);
  const [uploadId, setUploadId] = useState(null);

  // filtros
  const [casa, setCasa] = useState('betano');
  const [esporte, setEsporte] = useState('fifa');
  const [mercado, setMercado] = useState('over_under_ft');
  const [lado, setLado] = useState('ambos');
  // filtros de historico (WR): lista de chips + campos do editor atual
  const [filtrosHist, setFiltrosHist] = useState([]);
  const [histJanela, setHistJanela] = useState('last_10');
  const [histWrMin, setHistWrMin] = useState('');
  const [histWrMax, setHistWrMax] = useState('');
  const [histMinPartidas, setHistMinPartidas] = useState('10');
  // v11: base do histórico (confronto x individual) + alvo do individual no HC
  const [histBase, setHistBase] = useState('match');
  const [histIndivAlvo, setHistIndivAlvo] = useState('zebra');

  const adicionarHist = useCallback(() => {
    if (histWrMin === '' || isNaN(Number(histWrMin))) {
      setErro('Informe o WR mínimo (%) do filtro.');
      return;
    }
    const mn = Number(histWrMin);
    const mx = histWrMax === '' ? 100 : Number(histWrMax);
    if (isNaN(mx) || mn < 0 || mx > 100 || mn > mx) {
      setErro('WR inválido — use 0 a 100, com mín ≤ máx.');
      return;
    }
    setErro(null);
    setFiltrosHist(prev => [...prev, {
      janela: histJanela,
      prob: [mn, mx],
      minPartidas: Math.max(0, Math.trunc(Number(histMinPartidas) || 0)),
      base: histBase,
      ...(histBase === 'individual' ? { indivAlvo: histIndivAlvo } : {}),
    }]);
    setHistWrMin(''); setHistWrMax('');
  }, [histJanela, histWrMin, histWrMax, histMinPartidas, histBase, histIndivAlvo]);

  const removerHist = useCallback((idx) => {
    setFiltrosHist(prev => prev.filter((_, i) => i !== idx));
  }, []);
  const [cenario, setCenario] = useState('');
  const [difPlacar, setDifPlacar] = useState('');
  const [quartos, setQuartos] = useState({ q1: true, q2: true, q3: true, q4: true });
  const [linhaMin, setLinhaMin] = useState('');
  const [linhaMax, setLinhaMax] = useState('');
  // v11.2: faixa de odd (antes o avulso nao tinha filtro de odd)
  const [oddMin, setOddMin] = useState('');
  const [oddMax, setOddMax] = useState('');
  const [blacklist, setBlacklist] = useState('');
  const [whitelist, setWhitelist] = useState('');
  const [stakeValor, setStakeValor] = useState('10');
  const [bancaInicial, setBancaInicial] = useState('1000');

  // filtros complementares (H2H): lista de chips + campos do editor atual
  const [filtrosComp, setFiltrosComp] = useState([]);
  const [compTipo, setCompTipo] = useState('gap_media');
  const [compJanela, setCompJanela] = useState('20');
  const [compMinAtivo, setCompMinAtivo] = useState(true);
  const [compMin, setCompMin] = useState('');
  const [compMaxAtivo, setCompMaxAtivo] = useState(false);
  const [compMax, setCompMax] = useState('');

  const adicionarComp = useCallback(() => {
    // exige um limite ativo (senao o filtro nao faz nada)
    if (!compMinAtivo && !compMaxAtivo) {
      setErro('Ative Mín ou Máx no filtro complementar (senão ele não filtra nada).');
      return;
    }
    if (compMinAtivo && (compMin === '' || isNaN(Number(compMin)))) {
      setErro('Mín do filtro complementar precisa de um número.');
      return;
    }
    if (compMaxAtivo && (compMax === '' || isNaN(Number(compMax)))) {
      setErro('Máx do filtro complementar precisa de um número.');
      return;
    }
    setErro(null);
    setFiltrosComp(prev => [...prev, {
      tipo: compTipo,
      janela: compJanela,
      minAtivo: compMinAtivo, min: compMinAtivo ? compMin : '',
      maxAtivo: compMaxAtivo, max: compMaxAtivo ? compMax : '',
    }]);
    setCompMin(''); setCompMax(''); setCompMaxAtivo(false);
  }, [compTipo, compJanela, compMinAtivo, compMin, compMaxAtivo, compMax]);

  const removerComp = useCallback((idx) => {
    setFiltrosComp(prev => prev.filter((_, i) => i !== idx));
  }, []);

  // execucao
  const [rodando, setRodando] = useState(false);
  const [erro, setErro] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [jobId, setJobId] = useState(null);
  const [baixando, setBaixando] = useState(false);
  const pollRef = useRef(null);
  const pollInicioRef = useRef(null);
  const montadoRef = useRef(true);

  const ehBasket = esporte === 'nba2k';

  useEffect(() => {
    montadoRef.current = true;
    return () => {
      montadoRef.current = false;
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, []);

  const limparPoll = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  const handleUpload = useCallback(async () => {
    if (!arquivo) return;
    if (!arquivo.name?.toLowerCase().endsWith('.parquet')) {
      setErro('Selecione um arquivo .parquet'); return;
    }
    setSubindo(true); setErro(null); setResumo(null); setUploadId(null); setResultado(null);
    try {
      const res = await ApiBacktest.uploadTicks(arquivo);
      if (!montadoRef.current) return;
      if (!res?.upload_id) { setErro('Upload não retornou um id válido.'); return; }
      setUploadId(res.upload_id);
      setResumo(res);
      // auto-seleciona a casa do arquivo (normaliza case, so se for opcao valida)
      if (res.casas?.length === 1) {
        const c = String(res.casas[0]).toLowerCase().trim();
        if (CASAS.some(o => o.value === c)) setCasa(c);
      }
      if (res.linhas === 0) setErro('Aviso: o arquivo não tem ticks após leitura.');
    } catch (e) {
      if (montadoRef.current) setErro(e?.message || 'Falha no upload');
    } finally {
      if (montadoRef.current) setSubindo(false);
    }
  }, [arquivo]);

  const validarFiltros = useCallback(() => {
    if (!uploadId) return 'Suba um arquivo primeiro.';
    if (!mercado) return 'Escolha um mercado.';
    const lmin = numOuNull(linhaMin), lmax = numOuNull(linhaMax);
    if (lmin != null && lmax != null && lmin > lmax) return 'Linha mín não pode ser maior que a máx.';
    const omin = numOuNull(oddMin), omax = numOuNull(oddMax);
    if (omin != null && omax != null && omin > omax) return 'Odd mín não pode ser maior que a máx.';
    if ((omin != null && omin <= 1) || (omax != null && omax <= 1)) return 'Odd deve ser maior que 1.';
    const stake = numOuNull(stakeValor);
    if (stake == null || stake <= 0) return 'Stake deve ser maior que zero.';
    const banca = numOuNull(bancaInicial);
    if (banca == null || banca <= 0) return 'Banca inicial deve ser maior que zero.';
    if (ehBasket && !Object.values(quartos).some(Boolean)) return 'Selecione ao menos um quarto.';
    return null;
  }, [uploadId, mercado, linhaMin, linhaMax, oddMin, oddMax, stakeValor, bancaInicial, ehBasket, quartos]);

  const handleRodar = useCallback(async () => {
    const msgErro = validarFiltros();
    if (msgErro) { setErro(msgErro); return; }
    setRodando(true); setErro(null); setResultado(null); setJobId(null);

    const nicks = (txt) => txt.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
    const quartosAtivos = ehBasket
      ? Object.entries(quartos).filter(([, v]) => v).map(([k]) => k)
      : null;

    const body = {
      upload_id: uploadId,
      mercado, lado, casa, esporte,
      filtros_hist: filtrosHist,
      cenario: cenario || null,
      diferenca_placar: numOuNull(difPlacar),
      quartos: quartosAtivos,
      linha_min: numOuNull(linhaMin),
      linha_max: numOuNull(linhaMax),
      odd_min: numOuNull(oddMin),
      odd_max: numOuNull(oddMax),
      blacklist: nicks(blacklist),
      whitelist: nicks(whitelist),
      stake_modo: 'fixo',
      stake_valor: numOuNull(stakeValor) ?? 10,
      banca_inicial: numOuNull(bancaInicial) ?? 1000,
      filtros_comp: filtrosComp,
    };

    try {
      const res = await ApiBacktest.createAvulso(body);
      if (!montadoRef.current) return;
      const jobId = res?.job_id;
      if (!jobId) { setRodando(false); setErro('Job não foi criado.'); return; }
      setJobId(jobId);

      pollInicioRef.current = Date.now();
      pollRef.current = setInterval(async () => {
        if (Date.now() - pollInicioRef.current > POLL_TIMEOUT_MS) {
          limparPoll();
          if (montadoRef.current) { setRodando(false); setErro('Backtest demorou demais (timeout).'); }
          return;
        }
        try {
          const job = await ApiBacktest.get(jobId, true);
          if (!montadoRef.current) { limparPoll(); return; }
          const st = (job?.status || '').toLowerCase();
          if (st === 'concluido' || st === 'concluído') {
            limparPoll(); setRodando(false); setResultado(job || {});
          } else if (st === 'erro') {
            limparPoll(); setRodando(false);
            setErro(job?.erro || job?.progresso_msg || 'Job falhou.');
          }
        } catch (e) {
          limparPoll();
          if (montadoRef.current) { setRodando(false); setErro(e?.message || 'Erro consultando job.'); }
        }
      }, POLL_MS);
    } catch (e) {
      if (montadoRef.current) { setRodando(false); setErro(e?.message || 'Falha ao criar job.'); }
    }
  }, [validarFiltros, uploadId, mercado, lado, casa, esporte, filtrosHist,
      cenario, difPlacar, quartos, ehBasket, linhaMin, linhaMax, oddMin, oddMax,
      blacklist, whitelist, stakeValor, bancaInicial, filtrosComp]);

  // helpers de resultado (campos REAIS do job: roi/win_rate sao fracao 0-1)
  const num = (v) => (v == null || Number.isNaN(Number(v)) ? null : Number(v));
  const pct = (frac) => { const n = num(frac); return n == null ? '-' : `${(n * 100).toFixed(2)}%`; };
  const u = (v, d = 2) => { const n = num(v); return n == null ? '-' : n.toFixed(d); };

  const baixarPlanilha = useCallback(async () => {
    const id = jobId || (resultado && resultado.id);
    if (!id) return;
    setBaixando(true); setErro(null);
    try {
      await ApiBacktest.baixarPlanilha(id);
    } catch (e) {
      if (montadoRef.current) setErro(e?.message || 'Falha ao baixar a planilha.');
    } finally {
      if (montadoRef.current) setBaixando(false);
    }
  }, [jobId, resultado]);

  const r = resultado || {};
  const roiN = num(r.roi);
  const pnlN = num(r.pnl);
  const ddN = num(r.drawdown_max);
  // JOB42: unidades vem do backend (migration 016). Fallback pra jobs antigos
  // deriva de pnl/stake - so corrige a ESCALA (o drawdown antigo em si vinha
  // superestimado pelo calculo max-min; reroda o backtest pra ter o DD certo).
  const stakeN = num(r.stake_valor);
  const pnlU = num(r.pnl_unidades) ?? (pnlN != null && stakeN ? pnlN / stakeN : null);
  const ddU = num(r.drawdown_unidades) ?? (ddN != null && stakeN ? ddN / stakeN : null);

  // dados derivados pro painel rico: por-dia (green/red/void + pnl) e odd media,
  // computados do apostas_detalhe (ja vem no polling com incluir_detalhe=true).
  const { porDia, oddMedia } = useMemo(() => {
    const det = Array.isArray(r.apostas_detalhe) ? r.apostas_detalhe : [];
    if (!det.length) return { porDia: [], oddMedia: null };
    const dias = {};
    let somaOdd = 0, nOdd = 0;
    for (const a of det) {
      const dia = String(a.ts || '').slice(0, 10);
      if (!dias[dia]) dias[dia] = { data: dia, g: 0, r: 0, v: 0, pnl: 0 };
      if (a.resultado === 'green') dias[dia].g += 1;
      else if (a.resultado === 'red') dias[dia].r += 1;
      else dias[dia].v += 1;
      dias[dia].pnl += Number(a.pnl) || 0;
      const o = Number(a.odd);
      if (Number.isFinite(o) && o > 1) { somaOdd += o; nOdd += 1; }
    }
    return {
      porDia: Object.values(dias).sort((a, b) => a.data.localeCompare(b.data)),
      oddMedia: nOdd ? somaOdd / nOdd : null,
    };
  }, [r.apostas_detalhe]);

  const ressalvas = (() => {
    const msg = r.progresso_msg || '';
    const i = msg.indexOf('RESSALVAS:');
    return i >= 0 ? msg.slice(i + 'RESSALVAS:'.length).trim() : '';
  })();
  const semApostas = resultado && (num(r.total_apostas) ?? 0) === 0;

  const cardStyle = {
    backgroundColor: 'rgba(20, 26, 40, 0.4)',
    border: '0.5px solid rgba(60, 85, 130, 0.4)',
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
        @keyframes mike-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .mike-spin { animation: mike-spin 0.8s linear infinite; }
      `}</style>

      <MikeHeader telaAtiva="backtest" onNavegar={onNavegar} />

      <main className="max-w-screen-xl mx-auto px-4 lg:px-8 py-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-[--mike-fg-muted] mb-4">
          <button onClick={() => onNavegar?.('today')} className="hover:text-[--mike-fg]">
            <Home className="w-3 h-3" />
          </button>
          <ChevronRight className="w-3 h-3" />
          <span className="text-[--mike-fg] font-semibold flex items-center gap-1">
            <FlaskConical className="w-3 h-3" />
            Backtest
          </span>
        </div>

        {/* Titulo */}
        <div className="mb-5">
          <h1 className="text-xl font-black text-[--mike-fg] flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-cyan-400" />
            Backtest avulso
          </h1>
          <p className="text-[11px] text-[--mike-fg-muted] mt-0.5">
            Suba um parquet de ticks e teste filtros sem precisar de um bot.
          </p>
        </div>

        {/* GRID: coluna esquerda (config) + direita (resultado) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">

          {/* ESQUERDA: upload + filtros (2 colunas) */}
          <div className="lg:col-span-2 space-y-4">

            {/* UPLOAD */}
            <section className="rounded-lg p-4" style={cardStyle}>
              <SecaoTitulo icon={Upload}>1. Arquivo de ticks (.parquet)</SecaoTitulo>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 px-3 py-2 rounded-md text-xs font-semibold cursor-pointer mike-border-thin text-[--mike-fg-soft] hover:text-[--mike-fg] transition">
                  <FileUp className="w-3.5 h-3.5" />
                  {arquivo ? arquivo.name : 'Escolher arquivo'}
                  <input type="file" accept=".parquet" className="hidden"
                    onChange={(e) => { setArquivo(e.target.files?.[0] || null); setResumo(null); setUploadId(null); setResultado(null); setErro(null); }}
                  />
                </label>
                <button
                  onClick={handleUpload}
                  disabled={!arquivo || subindo}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-bold transition disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ backgroundColor: (!arquivo || subindo) ? 'rgba(16,185,129,0.2)' : '#10b981', color: (!arquivo || subindo) ? '#6b7691' : '#0b0f1a' }}
                >
                  {subindo ? <><RefreshCw className="w-3.5 h-3.5 mike-spin" /> Subindo...</> : <><Upload className="w-3.5 h-3.5" /> Subir</>}
                </button>
              </div>
              {resumo && (
                <div className="mt-3 rounded-md p-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px]" style={{ backgroundColor: 'rgba(16,185,129,0.06)', border: '0.5px solid rgba(16,185,129,0.25)' }}>
                  <span className="flex items-center gap-1 text-emerald-400 font-bold">
                    <CheckCircle2 className="w-3 h-3" /> {(resumo.linhas ?? 0).toLocaleString()} ticks
                  </span>
                  <span className="text-[--mike-fg-muted]">{resumo.ts_min?.slice(0, 10) || '?'} a {resumo.ts_max?.slice(0, 10) || '?'}</span>
                  <span className="text-[--mike-fg-muted]">casas: {resumo.casas?.join(', ') || '-'}</span>
                  <span className="text-[--mike-fg-muted]">esportes: {resumo.esportes?.join(', ') || '-'}</span>
                </div>
              )}
              {/* aviso: casa selecionada nao bate com a casa do arquivo -> daria zero */}
              {(() => {
                const casaArq = resumo?.casas?.length === 1 ? String(resumo.casas[0]).toLowerCase().trim() : null;
                if (!casaArq || casaArq === casa) return null;
                const label = CASAS.find(o => o.value === casaArq)?.label || casaArq;
                return (
                  <div className="mt-2 rounded-md p-2.5 flex items-start gap-2 text-[11px]" style={{ backgroundColor: 'rgba(251,191,36,0.08)', border: '0.5px solid rgba(251,191,36,0.35)' }}>
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <span className="text-amber-300">O arquivo é de <b>{label}</b>, mas a Casa selecionada é outra. Nenhum tick vai casar — o backtest daria zero.</span>
                      <button onClick={() => setCasa(casaArq)} className="ml-2 underline text-amber-200 hover:text-amber-100 font-semibold">Trocar para {label}</button>
                    </div>
                  </div>
                );
              })()}
            </section>

            {/* FILTROS */}
            <section className="rounded-lg p-4" style={cardStyle}>
              <SecaoTitulo icon={Filter}>2. Filtros</SecaoTitulo>

              <p className="text-[11px] text-[--mike-fg-muted] mb-3 -mt-1">Combine os grupos abaixo — deixe vazio o que não quiser usar.</p>

              <div className="space-y-3">

                {/* GRUPO 1: Aposta */}
                <Grupo icon={Trophy} cor="#22d3ee" titulo="Aposta" desc="Onde, o quê e qual lado — e a faixa de linha.">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Campo label="Casa"><Select value={casa} onChange={setCasa} options={CASAS} /></Campo>
                    <Campo label="Esporte"><Select value={esporte} onChange={setEsporte} options={ESPORTES} /></Campo>
                    <Campo label="Mercado"><Select value={mercado} onChange={setMercado} options={MERCADOS} /></Campo>
                    <Campo label="Lado"><Select value={lado} onChange={setLado} options={LADOS} /></Campo>
                  </div>
                  <DivFina />
                  <SubLabel>Faixa de linha (opcional)</SubLabel>
                  <div className="grid grid-cols-2 gap-3">
                    <Campo label="Linha mín."><Input type="number" value={linhaMin} onChange={setLinhaMin} placeholder="ex: 0.5" /></Campo>
                    <Campo label="Linha máx."><Input type="number" value={linhaMax} onChange={setLinhaMax} placeholder="ex: 8.5" /></Campo>
                  </div>
                  <DivFina />
                  <SubLabel>Faixa de odd (opcional)</SubLabel>
                  <div className="grid grid-cols-2 gap-3">
                    <Campo label="Odd mín."><Input type="number" value={oddMin} onChange={setOddMin} placeholder="ex: 1.6" /></Campo>
                    <Campo label="Odd máx."><Input type="number" value={oddMax} onChange={setOddMax} placeholder="ex: 2.2" /></Campo>
                  </div>
                </Grupo>

                {/* GRUPO 2: Confronto direto (H2H) */}
                <Grupo icon={Percent} cor="#fbbf24" titulo="Confronto direto (H2H)" desc="Filtra pelo histórico do par (confronto) ou pelo individual de cada jogador.">
                  <SubLabel>Win rate — adicione vários (escadinha)</SubLabel>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-2">
                    <Campo label="Janela"><Select value={histJanela} onChange={setHistJanela} options={JANELAS_WR} /></Campo>
                    <Campo label="WR mín. (%)"><Input type="number" min="0" max="100" value={histWrMin} onChange={setHistWrMin} placeholder="ex: 80" /></Campo>
                    <Campo label="WR máx. (%)"><Input type="number" min="0" max="100" value={histWrMax} onChange={setHistWrMax} placeholder="100" /></Campo>
                    <Campo label="Mín. confrontos"><Input type="number" min="0" value={histMinPartidas} onChange={setHistMinPartidas} placeholder="ex: 10" /></Campo>
                    <Campo label="Base"><Select value={histBase} onChange={setHistBase} options={BASES_HIST} /></Campo>
                    {histBase === 'individual' && ['ah_ft', 'ah_ht', 'eh_ft'].includes(mercado) && (
                      <Campo label="Alvo (HC)"><Select value={histIndivAlvo} onChange={setHistIndivAlvo} options={INDIV_ALVOS} /></Campo>
                    )}
                  </div>
                  <button
                    onClick={adicionarHist}
                    className="px-3 py-1.5 rounded-md text-[11px] font-bold mike-border-thin text-[--mike-accent] hover:bg-[--mike-accent]/10 transition"
                  >
                    + Adicionar filtro de WR
                  </button>
                  {filtrosHist.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2.5">
                      {filtrosHist.map((f, i) => (
                        <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-mono bg-amber-400/10 text-amber-300 mike-border-thin">
                          <span>{_labelChipHist(f)}</span>
                          <button onClick={() => removerHist(i)} className="hover:text-red-400 font-bold leading-none">×</button>
                        </div>
                      ))}
                    </div>
                  )}
                  <DivFina />
                  <SubLabel>Média · Gap · Z-Score · Tendência</SubLabel>
                  <div className="grid grid-cols-2 gap-3 mb-2">
                    <Campo label="Tipo"><Select value={compTipo} onChange={setCompTipo} options={TIPOS_COMP} /></Campo>
                    {compTipo !== 'gap_linha' && compTipo !== 'tendencia'
                      ? <Campo label="Janela"><Select value={compJanela} onChange={setCompJanela} options={JANELAS_COMP} /></Campo>
                      : <div />}
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-2">
                    <Campo label="Mín">
                      <div className="flex items-center gap-2">
                        <input type="checkbox" checked={compMinAtivo} onChange={(e) => setCompMinAtivo(e.target.checked)} className="accent-emerald-500 cursor-pointer" />
                        <Input type="number" value={compMin} onChange={setCompMin} placeholder={_phMinComp(compTipo)} />
                      </div>
                    </Campo>
                    {compTipo !== 'tendencia'
                      ? (
                        <Campo label="Máx">
                          <div className="flex items-center gap-2">
                            <input type="checkbox" checked={compMaxAtivo} onChange={(e) => setCompMaxAtivo(e.target.checked)} className="accent-emerald-500 cursor-pointer" />
                            <Input type="number" value={compMax} onChange={setCompMax} placeholder={_phMaxComp(compTipo)} />
                          </div>
                        </Campo>
                      ) : <div />}
                  </div>
                  <button
                    onClick={adicionarComp}
                    className="px-3 py-1.5 rounded-md text-[11px] font-bold mike-border-thin text-[--mike-accent] hover:bg-[--mike-accent]/10 transition"
                  >
                    + Adicionar filtro
                  </button>
                  {filtrosComp.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2.5">
                      {filtrosComp.map((f, i) => (
                        <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-mono bg-[--mike-accent]/10 text-[--mike-accent] mike-border-thin">
                          <span>{_labelChipComp(f)}</span>
                          <button onClick={() => removerComp(i)} className="hover:text-red-400 font-bold leading-none">×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </Grupo>

                {/* GRUPO 3: Situação da partida */}
                <Grupo icon={Target} cor="#a78bfa" titulo="Situação da partida" desc="Condições no momento da entrada da aposta.">
                  <SubLabel>Placar</SubLabel>
                  <div className="grid grid-cols-2 gap-3">
                    <Campo label="Cenário"><Select value={cenario} onChange={setCenario} options={CENARIOS} /></Campo>
                    <Campo label="Diferença de placar (mín.)"><Input type="number" min="0" value={difPlacar} onChange={setDifPlacar} placeholder="ex: 2" /></Campo>
                  </div>
                  {ehBasket && (
                    <>
                      <DivFina />
                      <SubLabel>Quartos (basquete)</SubLabel>
                      <div className="flex items-center gap-2">
                        {['q1', 'q2', 'q3', 'q4'].map(q => {
                          const ativo = !!quartos[q];
                          return (
                            <button
                              key={q}
                              onClick={() => setQuartos({ ...quartos, [q]: !ativo })}
                              className={`px-3 py-1.5 rounded-md text-[11px] font-bold font-mono transition ${ativo ? 'bg-[--mike-accent]/15 text-[--mike-accent]' : 'mike-border-thin text-[--mike-fg-muted] hover:text-[--mike-fg]'}`}
                            >
                              {q.toUpperCase()}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </Grupo>

                {/* GRUPO 4: Listas de nicks */}
                <Grupo icon={Ban} cor="#fb7185" titulo="Listas de nicks" desc="Bloqueia ou permite jogadores específicos (vírgula ou linha).">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Campo label="Blacklist (bloqueia em qualquer posição)">
                      <textarea value={blacklist} onChange={(e) => setBlacklist(e.target.value)} rows={3} placeholder="Roma, Leyla, Ellen"
                        className="mike-border-thin bg-transparent text-xs text-[--mike-fg] px-3 py-2 rounded-md outline-none w-full resize-y placeholder:text-[--mike-fg-muted]" />
                    </Campo>
                    <Campo label="Whitelist (só estes; vazio = todos)">
                      <textarea value={whitelist} onChange={(e) => setWhitelist(e.target.value)} rows={3} placeholder="(vazio = todos)"
                        className="mike-border-thin bg-transparent text-xs text-[--mike-fg] px-3 py-2 rounded-md outline-none w-full resize-y placeholder:text-[--mike-fg-muted]" />
                    </Campo>
                  </div>
                </Grupo>

              </div>

            </section>

            {/* STAKE + RODAR */}
            <section className="rounded-lg p-4" style={cardStyle}>
              <SecaoTitulo icon={DollarSign}>3. Stake e execução</SecaoTitulo>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <Campo label="Stake (R$)"><Input type="number" min="0" value={stakeValor} onChange={setStakeValor} /></Campo>
                <Campo label="Banca inicial (R$)"><Input type="number" min="0" value={bancaInicial} onChange={setBancaInicial} /></Campo>
              </div>
              <button
                onClick={handleRodar}
                disabled={!uploadId || rodando}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-bold transition disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: (!uploadId || rodando) ? 'rgba(16,185,129,0.2)' : '#10b981', color: (!uploadId || rodando) ? '#6b7691' : '#0b0f1a', boxShadow: (!uploadId || rodando) ? 'none' : '0 4px 12px rgba(16,185,129,0.3)' }}
              >
                {rodando ? <><RefreshCw className="w-4 h-4 mike-spin" /> Rodando backtest...</> : <><Play className="w-4 h-4" /> Rodar backtest</>}
              </button>
            </section>
          </div>

          {/* DIREITA: resultado (sticky) */}
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-16 space-y-4">

              {erro && (
                <div className="rounded-lg p-3 flex items-start gap-2" style={{ backgroundColor: 'rgba(244,63,94,0.08)', border: '0.5px solid rgba(244,63,94,0.35)' }}>
                  <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                  <span className="text-xs text-rose-300">{erro}</span>
                </div>
              )}

              <section className="rounded-lg p-4" style={cardStyle}>
                <SecaoTitulo icon={Trophy}>Resultado</SecaoTitulo>

                {!resultado && !rodando && (
                  <div className="text-center py-10 text-[--mike-fg-muted] text-xs">
                    Configure os filtros e rode o backtest pra ver o resultado aqui.
                  </div>
                )}

                {rodando && (
                  <div className="flex items-center justify-center py-10 gap-2 text-[--mike-fg-muted] text-xs">
                    <RefreshCw className="w-4 h-4 mike-spin" /> Processando...
                  </div>
                )}

                {resultado && semApostas && (
                  <div className="rounded-md p-3 flex items-start gap-2" style={{ backgroundColor: 'rgba(251,191,36,0.08)', border: '0.5px solid rgba(251,191,36,0.3)' }}>
                    <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    <span className="text-xs text-amber-300">Nenhuma aposta gerada. Afrouxe os filtros ou confira se casa/esporte/mercado batem com os ticks.</span>
                  </div>
                )}

                {resultado && !semApostas && (
                  <>
                    {/* HERO (estilo TM): Apostas · Odd média · Lucro · ROI */}
                    <div className="grid grid-cols-2 gap-2">
                      <StatCard icon={Hash} label="Apostas" valor={num(r.total_apostas) ?? '-'} cor="#0891b2" />
                      <StatCard icon={Percent} label="Odd média" valor={oddMedia ? oddMedia.toFixed(2) : '-'} cor="#eaeef7" />
                      <StatCard icon={DollarSign} label="Lucro" valor={pnlU != null ? `${u(pnlU)}u` : u(r.pnl)} cor={pnlN == null ? '#eaeef7' : (pnlN >= 0 ? '#10b981' : '#f43f5e')} />
                      <StatCard icon={Target} label="ROI" valor={pct(r.roi)} cor={roiN == null ? '#eaeef7' : (roiN >= 0 ? '#10b981' : '#f43f5e')} />
                    </div>
                    {pnlU != null && (
                      <div className="text-[9px] text-[--mike-fg-muted] mt-1.5 text-center font-mono">
                        em R$: lucro {u(r.pnl)} · drawdown {u(r.drawdown_max)} · stake {u(r.stake_valor)}
                      </div>
                    )}

                    {/* risco: WR · Drawdown · Streak (linha compacta) */}
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      {[
                        ['WR', pct(r.win_rate), '#fbbf24'],
                        ['Drawdown', ddU != null ? `${u(ddU)}u` : u(r.drawdown_max), ddN ? '#f43f5e' : '#eaeef7'],
                        ['Streak red', num(r.max_streak_red) ?? '-', '#f43f5e'],
                      ].map(([lbl, val, cor]) => (
                        <div key={lbl} className="rounded-md p-2 text-center mike-border-thin">
                          <div className="text-[8px] uppercase tracking-wider text-[--mike-fg-muted] font-bold">{lbl}</div>
                          <div className="text-xs font-black font-mono" style={{ color: cor }}>{val}</div>
                        </div>
                      ))}
                    </div>

                    {/* resultados por dia (barras estilo TM) */}
                    {porDia.length > 1 && (
                      <div className="mt-3 rounded-lg p-3" style={{ backgroundColor: 'rgba(13,17,27,0.5)', border: '0.5px solid rgba(60,85,130,0.28)' }}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] uppercase tracking-wider text-[--mike-fg-muted] font-bold">Resultados por dia</span>
                          <span className="text-[9px] font-mono text-[--mike-fg-muted]">
                            <span className="text-emerald-400">■</span> green · <span className="text-rose-400">■</span> red
                          </span>
                        </div>
                        <BarrasPorDia dias={porDia} />
                        <div className="text-[9px] text-[--mike-fg-muted] mt-1.5 text-center font-mono">
                          Dias verdes: {num(r.dias_verdes) ?? '-'}/{num(r.dias_total) ?? '-'} · passe o mouse nas barras
                        </div>
                      </div>
                    )}

                    {/* evolução da banca (equity) */}
                    {Array.isArray(r.equity_curve) && r.equity_curve.length > 1 && (
                      <div className="mt-2 rounded-lg p-3" style={{ backgroundColor: 'rgba(13,17,27,0.5)', border: '0.5px solid rgba(60,85,130,0.28)' }}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] uppercase tracking-wider text-[--mike-fg-muted] font-bold">Evolução da banca</span>
                          <span className="text-[9px] font-mono text-[--mike-fg-muted]">banca final: {u(num(r.equity_curve[r.equity_curve.length - 1]?.banca))}</span>
                        </div>
                        <CurvaEquity pontos={r.equity_curve} bancaInicial={numOuNull(bancaInicial) ?? 1000} />
                      </div>
                    )}

                    {/* green/red/void */}
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      <div className="rounded-md p-2 text-center" style={{ backgroundColor: 'rgba(16,185,129,0.08)', border: '0.5px solid rgba(16,185,129,0.25)' }}>
                        <div className="text-[9px] uppercase tracking-wider text-emerald-400 font-bold">Green</div>
                        <div className="text-sm font-black font-mono text-emerald-400">{num(r.green) ?? '-'}</div>
                      </div>
                      <div className="rounded-md p-2 text-center" style={{ backgroundColor: 'rgba(244,63,94,0.08)', border: '0.5px solid rgba(244,63,94,0.25)' }}>
                        <div className="text-[9px] uppercase tracking-wider text-rose-400 font-bold">Red</div>
                        <div className="text-sm font-black font-mono text-rose-400">{num(r.red) ?? '-'}</div>
                      </div>
                      <div className="rounded-md p-2 text-center" style={{ backgroundColor: 'rgba(60,85,130,0.1)', border: '0.5px solid rgba(60,85,130,0.3)' }}>
                        <div className="text-[9px] uppercase tracking-wider text-[--mike-fg-muted] font-bold">Void</div>
                        <div className="text-sm font-black font-mono text-[--mike-fg-soft]">{num(r.void_count) ?? '-'}</div>
                      </div>
                    </div>

                    {/* baixar planilha das apostas (mesmo formato do bot ao vivo) */}
                    <button
                      onClick={baixarPlanilha}
                      disabled={baixando}
                      className="w-full mt-3 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-[12px] font-bold mike-border-thin text-[--mike-accent] hover:bg-[--mike-accent]/10 transition disabled:opacity-50"
                    >
                      <Download className="w-3.5 h-3.5" />
                      {baixando ? 'Gerando planilha...' : 'Baixar planilha das apostas'}
                    </button>
                    <div className="text-[9px] text-[--mike-fg-muted] mt-1 text-center">
                      Mesmo formato do export do bot — pra comparar backtest vs ao vivo.
                    </div>

                    {ressalvas && (
                      <div className="mt-3 rounded-md p-2.5 flex items-start gap-2" style={{ backgroundColor: 'rgba(251,191,36,0.08)', border: '0.5px solid rgba(251,191,36,0.3)' }}>
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                        <span className="text-[11px] text-amber-300">{ressalvas}</span>
                      </div>
                    )}
                  </>
                )}
              </section>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}