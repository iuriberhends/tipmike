// ============================================================
// tipmike_historico_v2.jsx
//
// Modal de Histórico do Bot - DARK THEME + arquitetura plug-and-play
// Single-file pra rodar em artifact React. Quando migrar pro projeto
// real, segue o mesmo padrão de quebrar em lib/data/hooks/screens.
//
// USO:
//   <ModalHistorico botId={5} aberto={true} onClose={() => ...} />
//
// 🔌 BACKEND: GET /bots/:id/historico?periodo=...
//             retorna { bot, resultadosDiarios, tips, totais }
// ============================================================

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  X, TrendingUp, DollarSign, Percent, Send,
  Download, Maximize2, Minimize2, Info, History,
  ChevronUp, ChevronDown, RefreshCw, AlertCircle,
} from 'lucide-react';

// ============================================================
// 1. CONSTANTES
// ============================================================

const PERIODOS = [
  { v: 'dia',   l: 'Hoje',         dias: 1 },
  { v: '3d',    l: 'Últ. 3 dias',  dias: 3 },
  { v: '7d',    l: 'Últ. 7 dias',  dias: 7 },
  { v: '15d',   l: 'Últ. 15 dias', dias: 15 },
  { v: '30d',   l: 'Últ. 30 dias', dias: 30 },
  { v: 'todas', l: 'Tudo',         dias: 90 },
];

const PLAYERS = [
  'Galaxy', 'Hyper', 'Scorch', 'Abyss', 'Tranquility', 'Hawk', 'Omen', 'Jd',
  'Immortal', 'Arachne', 'Ultimate', 'Legacy', 'Airforce', 'Cypher', 'Raptor',
  'Sonic', 'Specter', 'Pacifier', 'Vandal', 'Rend', 'Punisher', 'Phantom',
];

// Bots conhecidos (mesma lista do tipmike_bots_v2)
const MOCK_BOTS_INFO = {
  1: { id: 1, nome: 'Bot OFT Betano e-Soccer',         casa: 'Betano',     mercado: 'Over First Time',     liga: 'Battle / GT League' },
  2: { id: 2, nome: 'Bot Under HT Betano Adriatic',    casa: 'Betano',     mercado: 'Under Half Time',     liga: 'Adriatic NextGen' },
  3: { id: 3, nome: 'Bot Over FT Superbet Adriatic',   casa: 'Superbet',   mercado: 'Over Full Time',      liga: 'Adriatic League' },
  4: { id: 4, nome: 'Bot HC FT Live Arena Superbet',   casa: 'Superbet',   mercado: 'Handicap Full Time',  liga: 'FIFA TM Live Arena' },
  5: { id: 5, nome: 'Bot OHT Bet365 e-Soccer',         casa: 'Bet365',     mercado: 'Over Half Time',      liga: 'Multi-ligas' },
  6: { id: 6, nome: 'Bot ML Estrelabet Battle',        casa: 'Estrelabet', mercado: 'Money Line',          liga: 'Battle' },
  7: { id: 7, nome: 'Bot HC H2H Estrelabet Valhalla',  casa: 'Estrelabet', mercado: 'Handicap H2H',        liga: 'Valhalla' },
  8: { id: 8, nome: 'Bot O/U Novibet Multi-Liga',      casa: 'Novibet',    mercado: 'Over/Under',          liga: 'Multi-ligas' },
  9: { id: 9, nome: 'Bot OFT Vupi e-Basket',           casa: 'Vupi',       mercado: 'Over First Time',     liga: 'eBasket Battle' },
};

// ============================================================
// 2. HELPERS DETERMINISTICOS
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

function gerarDatas(diasAtras, hoje = new Date()) {
  const datas = [];
  for (let i = diasAtras - 1; i >= 0; i--) {
    const d = new Date(hoje);
    d.setDate(hoje.getDate() - i);
    datas.push({
      iso: d.toISOString().slice(0, 10),
      label: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
    });
  }
  return datas;
}

function gerarResultadosDiarios(botId, dias) {
  const r = seeded(hashStr(`historico-${botId}`));
  const datas = gerarDatas(dias);
  return datas.map((d, i) => {
    // Curva determinística baseada no ID + dia
    const baseGreens = 60 + Math.sin(i * 0.6 + botId) * 15 + (r() - 0.5) * 10;
    const baseReds = 32 + Math.cos(i * 0.4 + botId) * 8 + (r() - 0.5) * 6;
    const greens = Math.max(0, Math.round(baseGreens));
    const reds = Math.max(0, Math.round(baseReds));
    return {
      ...d,
      greens, meiosGreens: 0, meiosReds: 0, reds,
      devolvidas: 0, canceladas: 0,
      total: greens + reds,
      lucro: +(greens * 0.78 - reds * 1.0).toFixed(2),
    };
  });
}

function gerarTips(botId, qtd = 60) {
  const r = seeded(hashStr(`tips-${botId}`));
  const tips = [];
  let h = new Date();
  for (let i = 0; i < qtd; i++) {
    const a = PLAYERS[Math.floor(r() * PLAYERS.length)];
    let b;
    do { b = PLAYERS[Math.floor(r() * PLAYERS.length)]; } while (b === a);
    const escolhido = r() > 0.5 ? a : b;
    const linha = (r() * 8 + 6).toFixed(1);
    const isGreen = r() > 0.34;
    const odd = +(1.7 + r() * 0.4).toFixed(2);
    const unidades = isGreen ? +(odd - 1).toFixed(2) : -1;
    tips.push({
      dataHora: `${String(h.getDate()).padStart(2,'0')}/${String(h.getMonth()+1).padStart(2,'0')} ${String(h.getHours()).padStart(2,'0')}:${String(h.getMinutes()).padStart(2,'0')}`,
      confronto: `${a} x ${b}`,
      selecao: `${escolhido} (${linha})`,
      odd,
      unidades,
      status: isGreen ? 'green' : 'red',
    });
    h = new Date(h.getTime() - (r() * 90 + 20) * 60000);
  }
  return tips;
}

// ============================================================
// 3. MOCK API + HOOK
// ============================================================

const MOCK_LATENCY = { min: 80, max: 250 };
function simularLatencia() {
  const ms = MOCK_LATENCY.min + Math.random() * (MOCK_LATENCY.max - MOCK_LATENCY.min);
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Cache deterministico (mesma seed = mesmo resultado, calc 1x)
const cacheResultados = {};
const cacheTips = {};

const mockResponses = {
  // 🔌 BACKEND: GET /bots/:id/historico?periodo=...
  '/bots/:id/historico': ({ id, periodo = '30d' }) => {
    const bot = MOCK_BOTS_INFO[id];
    if (!bot) throw new Error(`Bot ${id} não encontrado`);

    const dias = (PERIODOS.find(p => p.v === periodo) || PERIODOS[4]).dias;
    const cacheKey = `${id}-${dias}`;

    if (!cacheResultados[cacheKey]) {
      cacheResultados[cacheKey] = gerarResultadosDiarios(id, dias);
    }
    if (!cacheTips[id]) {
      cacheTips[id] = gerarTips(id, 60);
    }

    const resultadosDiarios = cacheResultados[cacheKey];
    const tips = cacheTips[id];

    // Cálculo dos totais
    const totais = {
      greens: resultadosDiarios.reduce((s, r) => s + r.greens, 0),
      reds: resultadosDiarios.reduce((s, r) => s + r.reds, 0),
      meiosGreens: 0, meiosReds: 0, devolvidas: 0, canceladas: 0,
    };
    totais.total = totais.greens + totais.reds;
    totais.lucro = +resultadosDiarios.reduce((s, r) => s + r.lucro, 0).toFixed(2);
    totais.roi = totais.total > 0 ? +((totais.lucro / totais.total) * 100).toFixed(2) : 0;
    totais.oddMedia = 1.82;
    totais.wr = totais.total > 0 ? +((totais.greens / totais.total) * 100).toFixed(1) : 0;

    return { bot, resultadosDiarios, tips, totais, dias };
  },
};

async function apiGet(endpoint, params) {
  await simularLatencia();
  // Resolve :id wildcard
  let handler = mockResponses[endpoint];
  if (!handler) {
    const matchKey = Object.keys(mockResponses).find(k => {
      const pattern = k.replace(/:[a-z]+/g, '[^/]+');
      const re = new RegExp('^' + pattern + '$');
      return re.test(endpoint);
    });
    if (matchKey) {
      handler = mockResponses[matchKey];
      const idMatch = endpoint.match(/\/(\d+)/);
      if (idMatch) params = { id: Number(idMatch[1]), ...params };
    }
  }
  if (!handler) throw new Error(`[MOCK] Endpoint não implementado: GET ${endpoint}`);
  return handler(params || {});
}

function useApiQuery(endpoint, params, opts = {}) {
  const { enabled = true } = opts;
  const [state, setState] = useState({ data: null, loading: enabled, error: null });
  const lastReqRef = useRef(0);
  const paramsKey = JSON.stringify(params);

  const fetchData = useCallback(async () => {
    if (!enabled) return;
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
  }, [endpoint, paramsKey, enabled]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return { data: state.data, loading: state.loading, error: state.error, refetch: fetchData };
}

// Hook público: pra outras telas usarem
function useBotHistorico(botId, periodo) {
  const { data, loading, error, refetch } = useApiQuery(
    `/bots/${botId}/historico`,
    { periodo },
    { enabled: !!botId },
  );
  return {
    bot: data?.bot,
    resultadosDiarios: data?.resultadosDiarios || [],
    tips: data?.tips || [],
    totais: data?.totais,
    dias: data?.dias || 0,
    loading, error, refetch,
  };
}

// ============================================================
// 4. GRAFICO BARRAS EMPILHADAS (DARK)
// ============================================================
function GraficoBarras({ data }) {
  const [hoverIdx, setHoverIdx] = useState(null);
  const width = 700, height = 280;
  const paddingL = 32, paddingR = 12, paddingT = 50, paddingB = 48;
  const innerW = width - paddingL - paddingR;
  const innerH = height - paddingT - paddingB;

  const maxTotal = Math.max(...data.map((d) => d.total), 60);
  const yMax = Math.ceil(maxTotal / 15) * 15;
  const stepX = innerW / data.length;
  const barW = stepX * 0.7;
  const yTicks = [0, yMax * 0.25, yMax * 0.5, yMax * 0.75, yMax].map((v) => Math.round(v));

  // Cores DARK — fundo escuro requer cores um pouco mais saturadas
  const cores = {
    devolvidas:  { fill: '#64748b', label: 'Devolvidas' },
    canceladas:  { fill: '#334155', label: 'Canceladas' },
    reds:        { fill: '#f43f5e', label: 'Reds' },
    meiosReds:   { fill: '#fb923c', label: '1/2 Reds' },
    meiosGreens: { fill: '#86efac', label: '1/2 Greens' },
    greens:      { fill: '#10b981', label: 'Greens' },
  };
  const ordem = ['devolvidas','canceladas','reds','meiosReds','meiosGreens','greens'];

  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
        <g>
          {ordem.map((cat, i) => {
            const c = cores[cat];
            const offsetX = paddingL + i * (innerW / ordem.length) + 10;
            return (
              <g key={cat}>
                <rect x={offsetX} y={14} width="9" height="9" fill={c.fill} rx="1" />
                <text x={offsetX + 14} y={22} fontSize="10" fill="#94a3b8" fontFamily="system-ui">{c.label}</text>
              </g>
            );
          })}
        </g>

        {yTicks.map((tick) => {
          const y = paddingT + innerH - (tick / yMax) * innerH;
          return (
            <g key={tick}>
              <line x1={paddingL} y1={y} x2={width - paddingR} y2={y} stroke="#1e293b" strokeWidth="0.7" />
              <text x={paddingL - 6} y={y + 3} textAnchor="end" fontSize="10" fill="#64748b" fontFamily="system-ui">{tick}</text>
            </g>
          );
        })}

        <line x1={paddingL} y1={paddingT + innerH} x2={width - paddingR} y2={paddingT + innerH} stroke="#334155" strokeWidth="0.7" />

        {data.map((d, i) => {
          const xCenter = paddingL + i * stepX + stepX / 2;
          const x = xCenter - barW / 2;
          const yBase = paddingT + innerH;
          const isHover = hoverIdx === i;

          const segmentos = [
            { cat: 'greens', valor: d.greens },
            { cat: 'meiosGreens', valor: d.meiosGreens },
            { cat: 'meiosReds', valor: d.meiosReds },
            { cat: 'reds', valor: d.reds },
            { cat: 'canceladas', valor: d.canceladas },
            { cat: 'devolvidas', valor: d.devolvidas },
          ].filter((s) => s.valor > 0);

          let acumY = yBase;

          return (
            <g key={i}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
              style={{ cursor: 'pointer' }}
            >
              {segmentos.map((s, j) => {
                const h = (s.valor / yMax) * innerH;
                acumY -= h;
                return <rect key={j} x={x} y={acumY} width={barW} height={h} fill={cores[s.cat].fill} opacity={isHover ? 1 : 0.85} rx={j === 0 ? 1 : 0} />;
              })}

              {(data.length <= 30 ? i % 2 === 0 : i % 5 === 0) && (
                <text
                  x={xCenter}
                  y={paddingT + innerH + 16}
                  textAnchor="end"
                  fontSize="10"
                  fill={isHover ? '#10b981' : '#94a3b8'}
                  fontFamily="system-ui"
                  transform={`rotate(-45 ${xCenter} ${paddingT + innerH + 16})`}
                >
                  {d.label}
                </text>
              )}
              <rect x={x - stepX*0.15} y={paddingT} width={stepX} height={innerH} fill="transparent" />
            </g>
          );
        })}
      </svg>

      {hoverIdx !== null && (() => {
        const d = data[hoverIdx];
        const xCenter = paddingL + hoverIdx * stepX + stepX / 2;
        const xPercent = (xCenter / width) * 100;
        return (
          <div className="absolute pointer-events-none mike-tooltip-in" style={{ left: `${xPercent}%`, top: '8px', transform: 'translateX(-50%)', zIndex: 10 }}>
            <div className="rounded-md px-3 py-2 shadow-2xl whitespace-nowrap" style={{ backgroundColor: '#0b0f1a', border: '0.5px solid rgba(16, 185, 129, 0.5)', minWidth: '160px' }}>
              <div className="text-[10px] font-bold text-emerald-400 mb-1.5 uppercase tracking-wider">{d.label}</div>
              <div className="space-y-0.5 text-[10px]">
                <div className="flex justify-between gap-4"><span className="flex items-center gap-1 text-emerald-400"><span className="w-2 h-2 rounded-sm" style={{ background: cores.greens.fill }}/> Greens</span><span className="font-mono font-bold text-emerald-400">{d.greens}</span></div>
                <div className="flex justify-between gap-4"><span className="flex items-center gap-1 text-rose-400"><span className="w-2 h-2 rounded-sm" style={{ background: cores.reds.fill }}/> Reds</span><span className="font-mono font-bold text-rose-400">{d.reds}</span></div>
                <div className="flex justify-between gap-4 pt-1 mt-1" style={{ borderTop: '0.5px solid rgba(255,255,255,0.1)' }}><span className="text-slate-400">Total</span><span className="font-mono font-bold text-white">{d.total}</span></div>
                <div className="flex justify-between gap-4"><span className="text-slate-400">Lucro</span><span className={`font-mono font-bold ${d.lucro >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{d.lucro >= 0 ? '+' : ''}{d.lucro.toFixed(1)}u</span></div>
                <div className="flex justify-between gap-4"><span className="text-slate-400">WR</span><span className="font-mono font-bold text-amber-400">{d.total > 0 ? ((d.greens / d.total) * 100).toFixed(1) : 0}%</span></div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ============================================================
// 5. GRAFICO LINHA (DARK)
// ============================================================
function GraficoLinha({ data, campo, sufixo = '', cor = '#10b981' }) {
  const [hoverIdx, setHoverIdx] = useState(null);
  const width = 540, height = 280;
  const paddingL = 38, paddingR = 12, paddingT = 18, paddingB = 50;
  const innerW = width - paddingL - paddingR;
  const innerH = height - paddingT - paddingB;

  const valores = data.map((d) => d[campo]);
  const min = Math.min(...valores, 0);
  const max = Math.max(...valores, 1);
  const yRange = max - min;
  const yPadding = yRange * 0.08;
  const yMin = Math.floor((min - yPadding) / 3) * 3;
  const yMax = Math.ceil((max + yPadding) / 3) * 3;

  const yTicks = [];
  for (let i = 0; i <= 5; i++) yTicks.push(yMin + (yMax - yMin) * (i / 5));

  const pontos = data.map((d, i) => {
    const x = paddingL + (i / Math.max(1, data.length - 1)) * innerW;
    const y = paddingT + innerH - ((d[campo] - yMin) / Math.max(0.0001, yMax - yMin)) * innerH;
    return { x, y, valor: d[campo], data: d };
  });

  const pathLine = pontos.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
  const pathArea = `${pathLine} L ${pontos[pontos.length - 1].x.toFixed(2)} ${(paddingT + innerH).toFixed(2)} L ${pontos[0].x.toFixed(2)} ${(paddingT + innerH).toFixed(2)} Z`;

  const svgRef = useRef(null);
  const handleMove = (e) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const xRatio = (e.clientX - rect.left) / rect.width;
    const xSvg = xRatio * width;
    if (xSvg < paddingL || xSvg > width - paddingR) { setHoverIdx(null); return; }
    const idx = Math.round(((xSvg - paddingL) / innerW) * (data.length - 1));
    setHoverIdx(Math.max(0, Math.min(data.length - 1, idx)));
  };

  return (
    <div className="relative w-full">
      <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet" onMouseMove={handleMove} onMouseLeave={() => setHoverIdx(null)}>
        <defs>
          <linearGradient id={`grad-${campo}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={cor} stopOpacity="0.4" />
            <stop offset="100%" stopColor={cor} stopOpacity="0.05" />
          </linearGradient>
        </defs>

        {yTicks.map((tick, i) => {
          const y = paddingT + innerH - ((tick - yMin) / Math.max(0.0001, yMax - yMin)) * innerH;
          return (
            <g key={i}>
              <line x1={paddingL} y1={y} x2={width - paddingR} y2={y} stroke="#1e293b" strokeWidth="0.7" />
              <text x={paddingL - 6} y={y + 3} textAnchor="end" fontSize="10" fill="#64748b" fontFamily="system-ui">
                {sufixo === '%' ? `${tick.toFixed(0)}%` : tick.toFixed(0)}
              </text>
            </g>
          );
        })}

        {data.map((d, i) => {
          if (i % 3 !== 0 && i !== data.length - 1) return null;
          const x = paddingL + (i / Math.max(1, data.length - 1)) * innerW;
          return (
            <text key={i} x={x} y={paddingT + innerH + 14} textAnchor="end" fontSize="10" fill="#94a3b8" fontFamily="system-ui" transform={`rotate(-45 ${x} ${paddingT + innerH + 14})`}>
              {d.label}
            </text>
          );
        })}

        {yMin < 0 && yMax > 0 && (() => {
          const yZero = paddingT + innerH - ((0 - yMin) / Math.max(0.0001, yMax - yMin)) * innerH;
          return <line x1={paddingL} y1={yZero} x2={width - paddingR} y2={yZero} stroke="#f43f5e" strokeWidth="0.7" strokeDasharray="3 3" opacity="0.5" />;
        })()}

        <path d={pathArea} fill={`url(#grad-${campo})`} />
        <path d={pathLine} fill="none" stroke={cor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {hoverIdx !== null && (
          <>
            <line x1={pontos[hoverIdx].x} x2={pontos[hoverIdx].x} y1={paddingT} y2={paddingT + innerH} stroke={cor} strokeWidth="0.7" strokeDasharray="3 3" opacity="0.5" />
            <circle cx={pontos[hoverIdx].x} cy={pontos[hoverIdx].y} r="6" fill={cor} opacity="0.25" />
            <circle cx={pontos[hoverIdx].x} cy={pontos[hoverIdx].y} r="3.5" fill={cor} stroke="#0b0f1a" strokeWidth="2" />
          </>
        )}
      </svg>

      {hoverIdx !== null && (() => {
        const p = pontos[hoverIdx];
        const xPercent = (p.x / width) * 100;
        return (
          <div className="absolute pointer-events-none mike-tooltip-in" style={{ left: `${xPercent}%`, top: '8px', transform: 'translateX(-50%)' }}>
            <div className="rounded-md px-3 py-2 shadow-2xl whitespace-nowrap" style={{ backgroundColor: '#0b0f1a', border: `0.5px solid ${cor}80`, minWidth: '120px' }}>
              <div className="text-[10px] font-bold mb-1 uppercase tracking-wider" style={{ color: cor }}>{p.data.label}</div>
              <div className="text-[12px] font-mono font-bold" style={{ color: cor }}>
                {sufixo === '%' ? `${p.valor.toFixed(2)}%` : `${p.valor >= 0 ? '+' : ''}${p.valor.toFixed(2)}u`}
              </div>
              <div className="text-[9px] text-slate-400 font-mono mt-0.5">{p.data.greens}G / {p.data.reds}R</div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ============================================================
// 6. CARD METRICA (DARK)
// ============================================================
function CardMetrica({ icone: Icone, iconeColor, label, valor }) {
  return (
    <div className="rounded-md p-3.5 flex-1 min-w-[140px]" style={{
      backgroundColor: 'rgba(20, 26, 40, 0.6)',
      border: '0.5px solid rgba(60, 85, 130, 0.4)',
    }}>
      <div className="flex items-center gap-2 mb-1.5">
        <Icone className="w-3.5 h-3.5" style={{ color: iconeColor }} />
        <span className="text-[11px] text-slate-400 uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-[20px] font-mono font-bold text-white leading-tight">{valor}</div>
    </div>
  );
}

// ============================================================
// 7. LISTA DADOS GERAIS (DARK)
// ============================================================
function ListaDadosGerais({ totais }) {
  const items = [
    { label: 'Greens',     valor: totais.greens,      bg: '#10b981', text: '#0b0f1a' },
    { label: '1/2 Greens', valor: totais.meiosGreens, bg: '#86efac', text: '#0b0f1a' },
    { label: '1/2 Reds',   valor: totais.meiosReds,   bg: '#fb923c', text: '#0b0f1a' },
    { label: 'Reds',       valor: totais.reds,        bg: '#f43f5e', text: '#fff' },
    { label: 'Devolvidas', valor: totais.devolvidas,  bg: '#64748b', text: '#fff' },
    { label: 'Canceladas', valor: totais.canceladas,  bg: '#334155', text: '#fff' },
  ];
  const wrPct = totais.total > 0 ? (totais.greens / totais.total) * 100 : 0;

  return (
    <div className="flex flex-col gap-2.5 h-full">
      <div className="space-y-1.5 flex-1">
        {items.map((it) => (
          <div key={it.label} className="flex items-center gap-2.5">
            <div className="w-12 h-7 rounded-full flex items-center justify-center text-[12px] font-bold font-mono" style={{ backgroundColor: it.bg, color: it.text }}>
              {it.valor}
            </div>
            <span className="text-[12px] text-slate-300">{it.label}</span>
          </div>
        ))}
      </div>

      <div className="rounded overflow-hidden flex h-7" style={{ border: '0.5px solid rgba(60, 85, 130, 0.4)' }}>
        <div className="flex items-center justify-center text-[11px] font-bold text-white" style={{ backgroundColor: '#10b981', width: `${Math.max(8, wrPct)}%` }} title={`Win Rate: ${wrPct.toFixed(1)}%`}>
          {wrPct.toFixed(1)}%
        </div>
        <div className="flex items-center justify-center text-[11px] font-bold text-white" style={{ backgroundColor: '#f43f5e', width: `${Math.max(8, 100 - wrPct)}%` }} title={`Loss Rate: ${(100 - wrPct).toFixed(1)}%`}>
          {(100 - wrPct).toFixed(1)}%
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 8. TIP CARD (DARK)
// ============================================================
function TipCard({ tip }) {
  const isGreen = tip.status === 'green';
  return (
    <div className="rounded-md flex items-center overflow-hidden mike-tip-in" style={{
      backgroundColor: 'rgba(20, 26, 40, 0.4)',
      border: '0.5px solid rgba(60, 85, 130, 0.3)',
    }}>
      <div className="self-stretch flex-shrink-0" style={{ width: '4px', backgroundColor: isGreen ? '#10b981' : '#f43f5e' }} />
      <div className="px-3 py-2.5 text-[11px] text-slate-400 font-mono w-[100px] flex-shrink-0">{tip.dataHora}</div>
      <div className="flex-1 px-3 py-2.5 min-w-0">
        <div className="text-[12px] font-bold text-white truncate">{tip.confronto}</div>
      </div>
      <div className="px-3 py-2.5 text-[12px] text-slate-300 w-[140px] flex-shrink-0 text-center truncate">{tip.selecao}</div>
      <div className="px-3 py-2.5 text-[10px] text-slate-400 font-mono w-[60px] flex-shrink-0 text-center hidden sm:block">@{tip.odd}</div>
      <div className="px-3 py-2.5 w-[100px] flex-shrink-0 flex flex-col items-center gap-0.5">
        <div className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase text-white tracking-wide" style={{ backgroundColor: isGreen ? '#10b981' : '#f43f5e' }}>
          {isGreen ? 'Green' : 'Red'}
        </div>
        <div className={`flex items-center gap-0.5 text-[10px] font-mono font-bold ${isGreen ? 'text-emerald-400' : 'text-rose-400'}`}>
          {isGreen ? <ChevronUp className="w-3 h-3" strokeWidth={3} /> : <ChevronDown className="w-3 h-3" strokeWidth={3} />}
          {isGreen ? '+' : ''}{tip.unidades.toFixed(2)}u
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 9. MODAL HISTORICO (componente principal exportado)
// ============================================================
export function ModalHistorico({ botId, aberto = true, onClose = () => {} }) {
  const [periodoSelecionado, setPeriodoSelecionado] = useState('30d');
  const [fullscreen, setFullscreen] = useState(false);

  const { bot, resultadosDiarios, tips, totais, dias, loading, error } = useBotHistorico(botId, periodoSelecionado);

  // Acumulado pra gráfico de linha
  const acumulado = useMemo(() => {
    let lucroAcum = 0, stakeAcum = 0;
    return resultadosDiarios.map((r) => {
      lucroAcum += r.lucro;
      stakeAcum += r.total;
      return { ...r, lucroAcum, stakeAcum, roiAcum: stakeAcum > 0 ? (lucroAcum / stakeAcum) * 100 : 0 };
    });
  }, [resultadosDiarios]);

  // Esc + lock scroll
  useEffect(() => {
    if (!aberto) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [aberto, onClose]);

  const baixarPlanilha = () => {
    if (!bot || !totais) return;
    const linhas = [
      'TipMike - Historico do Bot #' + bot.id,
      'Bot,' + bot.nome,
      'Mercado,' + bot.mercado,
      'Periodo,' + dias + ' dias',
      '',
      'RESULTADOS DIARIOS',
      'Data,Greens,Reds,Total,Lucro',
      ...resultadosDiarios.map((r) => `${r.iso},${r.greens},${r.reds},${r.total},${r.lucro.toFixed(2)}`),
      '',
      'TOTAIS',
      `Total,${totais.total}`,
      `Greens,${totais.greens}`,
      `Reds,${totais.reds}`,
      `Lucro,${totais.lucro.toFixed(2)}`,
      `ROI,${totais.roi.toFixed(2)}%`,
      `WR,${totais.wr.toFixed(1)}%`,
      '',
      'TIPS ENVIADAS',
      'Data/Hora,Confronto,Selecao,Odd,Status,Unidades',
      ...tips.map((t) => `${t.dataHora},"${t.confronto}","${t.selecao}",${t.odd},${t.status},${t.unidades.toFixed(2)}`),
    ].join('\n');
    const blob = new Blob([linhas], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tipmike_bot_${bot.id}_${dias}d.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-50 mike-modal-fade" style={{ backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <style>{`
        @keyframes mike-modal-fade { 0% { opacity: 0; } 100% { opacity: 1; } }
        .mike-modal-fade { animation: mike-modal-fade 0.2s ease-out; }
        @keyframes mike-modal-slide { 0% { opacity: 0; transform: translateY(20px) scale(0.98); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
        .mike-modal-slide { animation: mike-modal-slide 0.3s cubic-bezier(0.22, 1, 0.36, 1); }
        @keyframes mike-tooltip-in { 0% { opacity: 0; transform: translateX(-50%) translateY(-4px); } 100% { opacity: 1; transform: translateX(-50%) translateY(0); } }
        .mike-tooltip-in { animation: mike-tooltip-in 0.18s ease-out; }
        @keyframes mike-tip-in { 0% { opacity: 0; transform: translateY(6px); } 100% { opacity: 1; transform: translateY(0); } }
        .mike-tip-in { animation: mike-tip-in 0.3s ease-out backwards; }
        @keyframes mike-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .mike-spin { animation: mike-spin 0.8s linear infinite; }
        .mike-scroll-dark::-webkit-scrollbar { width: 8px; height: 8px; }
        .mike-scroll-dark::-webkit-scrollbar-track { background: #0b0f1a; border-radius: 10px; }
        .mike-scroll-dark::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
        .mike-scroll-dark::-webkit-scrollbar-thumb:hover { background: #475569; }
        .mike-scroll-dark { scrollbar-width: thin; scrollbar-color: #334155 #0b0f1a; }
      `}</style>

      <div
        className={`absolute mike-modal-slide overflow-hidden flex flex-col shadow-2xl ${fullscreen ? 'inset-0 rounded-none' : 'inset-4 md:inset-8 lg:inset-x-12 lg:inset-y-6 rounded-xl'}`}
        style={{
          backgroundColor: '#0b0f1a',
          border: '0.5px solid rgba(60, 85, 130, 0.5)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          color: '#eaeef7',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-1 overflow-y-auto mike-scroll-dark">
          <div className="px-6 lg:px-8 py-5">

            {/* TOPO: Botões */}
            <div className="flex items-start justify-between gap-4 mb-3">
              <button
                onClick={baixarPlanilha}
                disabled={loading || !bot}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded text-[12px] font-semibold uppercase tracking-wider text-slate-300 hover:bg-slate-800/50 hover:text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ border: '0.5px solid rgba(60, 85, 130, 0.5)' }}
              >
                <Download className="w-3.5 h-3.5" />
                Baixar planilha
              </button>

              <div className="flex items-center gap-1">
                <button onClick={() => setFullscreen(!fullscreen)} className="p-2 rounded text-slate-500 hover:text-white hover:bg-slate-800/50 transition" title={fullscreen ? 'Sair de tela cheia' : 'Tela cheia'}>
                  {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
                <button onClick={onClose} className="p-2 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition" title="Fechar (ESC)">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Loading state */}
            {loading && (
              <div className="flex items-center justify-center py-32 gap-3 text-slate-400">
                <RefreshCw className="w-5 h-5 mike-spin" />
                <span className="text-sm">Carregando histórico...</span>
              </div>
            )}

            {/* Error state */}
            {error && !loading && (
              <div className="rounded-md p-6 text-center" style={{ backgroundColor: 'rgba(244, 63, 94, 0.1)', border: '0.5px solid rgba(244, 63, 94, 0.4)' }}>
                <AlertCircle className="w-8 h-8 text-rose-400 mx-auto mb-2" />
                <p className="text-sm text-rose-300 font-semibold mb-1">Erro ao carregar histórico</p>
                <p className="text-xs text-slate-400">{error.message}</p>
              </div>
            )}

            {/* Conteúdo */}
            {!loading && !error && bot && totais && (
              <>
                <div className="text-[11px] text-slate-500 mb-1 font-mono">id: #{bot.id.toString().padStart(6, '0')}</div>

                <h1 className="text-[24px] lg:text-[28px] font-bold text-white leading-tight tracking-tight mb-2">
                  {bot.nome}
                </h1>

                <div className="flex items-center gap-2 mb-5 flex-wrap">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-[12px] font-medium text-white" style={{ backgroundColor: '#0891b2' }}>
                    {bot.mercado}
                  </span>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-[12px] font-medium text-white" style={{ backgroundColor: '#334155' }}>
                    {bot.casa}
                  </span>
                  <span className="text-[12px] text-slate-400">{bot.liga}</span>
                </div>

                <div className="mb-5">
                  <h2 className="text-[14px] font-bold text-white mb-2">Análise</h2>
                  <div className="flex items-center gap-1 flex-wrap">
                    {PERIODOS.map((p) => (
                      <button
                        key={p.v}
                        onClick={() => setPeriodoSelecionado(p.v)}
                        className={`px-3 py-1.5 rounded text-[12px] font-medium transition ${
                          periodoSelecionado === p.v
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/40'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent'
                        }`}
                      >
                        {p.l}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 flex-wrap mb-4">
                  <CardMetrica icone={Send} iconeColor="#0891b2" label="Tips enviadas" valor={totais.total.toLocaleString('pt-BR')} />
                  <CardMetrica icone={Percent} iconeColor="#fb923c" label="Odd média" valor={totais.oddMedia.toFixed(2)} />
                  <CardMetrica icone={DollarSign} iconeColor="#10b981" label="Lucro" valor={
                    <span className={totais.lucro >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                      {totais.lucro >= 0 ? '+' : ''}{totais.lucro.toFixed(2)}u
                    </span>
                  } />
                  <CardMetrica icone={TrendingUp} iconeColor="#10b981" label="ROI" valor={
                    <span className={totais.roi >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                      {totais.roi >= 0 ? '+' : ''}{totais.roi.toFixed(1)}%
                    </span>
                  } />
                </div>

                <div className="flex items-center gap-2 px-3.5 py-2.5 rounded mb-5 text-[12px]" style={{
                  backgroundColor: 'rgba(8, 145, 178, 0.1)',
                  border: '0.5px solid rgba(8, 145, 178, 0.4)',
                  color: '#67e8f9',
                }}>
                  <Info className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Todos os gráficos usam os dados dos últimos {dias} dias</span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4 mb-5">
                  <div className="rounded-md p-4" style={{ backgroundColor: 'rgba(20, 26, 40, 0.4)', border: '0.5px solid rgba(60, 85, 130, 0.4)' }}>
                    <h3 className="text-[14px] font-bold text-white mb-2">Resultados por dia</h3>
                    <GraficoBarras data={resultadosDiarios} />
                  </div>

                  <div className="rounded-md p-4 flex flex-col" style={{ backgroundColor: 'rgba(20, 26, 40, 0.4)', border: '0.5px solid rgba(60, 85, 130, 0.4)' }}>
                    <h3 className="text-[14px] font-bold text-white mb-3">Dados gerais</h3>
                    <ListaDadosGerais totais={totais} />
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                  <div className="rounded-md p-4" style={{ backgroundColor: 'rgba(20, 26, 40, 0.4)', border: '0.5px solid rgba(60, 85, 130, 0.4)' }}>
                    <h3 className="text-[14px] font-bold text-white mb-2">ROI Acumulado</h3>
                    <GraficoLinha data={acumulado} campo="roiAcum" sufixo="%" cor="#10b981" />
                  </div>

                  <div className="rounded-md p-4" style={{ backgroundColor: 'rgba(20, 26, 40, 0.4)', border: '0.5px solid rgba(60, 85, 130, 0.4)' }}>
                    <h3 className="text-[14px] font-bold text-white mb-2">Lucro Acumulado</h3>
                    <GraficoLinha data={acumulado} campo="lucroAcum" sufixo="u" cor="#0891b2" />
                  </div>
                </div>

                <div className="mb-3">
                  <h3 className="text-[12px] font-medium text-slate-400 mb-2.5 uppercase tracking-wider">Últimas tips enviadas ({tips.length})</h3>
                  <div className="space-y-1.5">
                    {tips.slice(0, 30).map((tip, i) => (
                      <div key={i} style={{ animationDelay: `${i * 0.025}s` }}>
                        <TipCard tip={tip} />
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 10. APP DEMO (rota standalone pra testar no artifact)
// ============================================================
export default function App() {
  const [aberto, setAberto] = useState(false);
  const [botId, setBotId] = useState(1);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-8" style={{ backgroundColor: '#0b0f1a', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div className="text-center">
        <div className="flex items-center gap-2 justify-center mb-3">
          <div className="w-10 h-10 rounded-md bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <span className="font-black text-slate-950 text-xl leading-none">M</span>
          </div>
          <h1 className="text-2xl font-black text-white" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            TIPMIKE
          </h1>
        </div>
        <p className="text-sm text-slate-400">Modal de Histórico do Bot · Demo</p>
      </div>

      <div className="rounded-lg p-4" style={{ backgroundColor: 'rgba(20, 26, 40, 0.6)', border: '0.5px solid rgba(60, 85, 130, 0.4)' }}>
        <label className="block text-[10px] uppercase tracking-wider text-slate-400 mb-2 font-bold">Selecione um bot</label>
        <select
          value={botId}
          onChange={(e) => setBotId(Number(e.target.value))}
          className="bg-slate-800 text-white text-sm rounded-md px-3 py-2 border border-slate-600 focus:border-emerald-500 outline-none w-full min-w-[300px]"
        >
          {Object.values(MOCK_BOTS_INFO).map(b => (
            <option key={b.id} value={b.id}>#{b.id} · {b.nome}</option>
          ))}
        </select>
      </div>

      <button
        onClick={() => setAberto(true)}
        className="flex items-center gap-2 px-6 py-3 rounded-md text-sm font-bold text-slate-950 transition-transform duration-200 hover:scale-105 active:scale-95"
        style={{ backgroundColor: '#10b981', boxShadow: '0 6px 20px rgba(16, 185, 129, 0.4)' }}
      >
        <History className="w-4 h-4" strokeWidth={2.5} />
        Ver Histórico do Bot
      </button>

      <p className="text-[10px] text-slate-500 max-w-md text-center">
        ESC ou clique fora pra fechar. Clique no ícone de tela cheia pra expandir.
      </p>

      <ModalHistorico botId={botId} aberto={aberto} onClose={() => setAberto(false)} />
    </div>
  );
}
