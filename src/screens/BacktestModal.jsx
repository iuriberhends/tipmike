// ============================================================
// BacktestModal.jsx — Modal completo de backtest
//
// Tem 3 estados:
//   1. CONFIG: usuário escolhe período, stake. Botão "Executar"
//   2. RODANDO: progress bar + mensagem do worker (polling 1s)
//   3. RESULTADO: 4 cards (ROI, WR, total, DD) + chart equity SVG
//
// Chart equity: SVG nativo (sem dep externa).
// ============================================================

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  X, Play, BarChart3, TrendingUp, TrendingDown, Activity,
  CheckCircle2, AlertCircle, RefreshCw, Calendar, DollarSign,
  ChevronDown, ChevronRight, Info,
} from 'lucide-react';
import { ApiBacktest } from '../lib/api';

// ============================================================
// HELPERS
// ============================================================

function formatarBRL(v) {
  if (v === null || v === undefined) return '—';
  const n = Number(v);
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarPct(v) {
  if (v === null || v === undefined) return '—';
  return `${(Number(v) * 100).toFixed(2)}%`;
}

function formatarDataHora(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return '—'; }
}

function dataAtras(dias) {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString().slice(0, 10);
}

function hoje() {
  return new Date().toISOString().slice(0, 10);
}

// ============================================================
// CARD METRICA
// ============================================================

function CardMetrica({ titulo, valor, sub, cor = 'cyan', Icon }) {
  const corMap = {
    cyan:    { bg: 'rgba(6,182,212,0.08)',  border: 'rgba(6,182,212,0.3)',  text: '#22d3ee' },
    emerald: { bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.3)', text: '#10b981' },
    rose:    { bg: 'rgba(244,63,94,0.08)',  border: 'rgba(244,63,94,0.3)',  text: '#f43f5e' },
    amber:   { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.3)', text: '#f59e0b' },
    slate:   { bg: 'rgba(60,85,130,0.12)',  border: 'rgba(60,85,130,0.3)',  text: '#94a3b8' },
  };
  const c = corMap[cor] || corMap.cyan;
  return (
    <div className="rounded-md p-3 flex items-start gap-3" style={{
      backgroundColor: c.bg,
      border: `0.5px solid ${c.border}`,
    }}>
      {Icon && (
        <div className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0" style={{
          backgroundColor: c.border,
        }}>
          <Icon className="w-4 h-4" style={{ color: c.text }} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-[--mike-fg-muted]">{titulo}</div>
        <div className="text-lg font-black mt-0.5" style={{ color: c.text }}>{valor}</div>
        {sub && <div className="text-[10px] text-[--mike-fg-muted] mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

// ============================================================
// CHART EQUITY — SVG puro, sem deps externas
// ============================================================

function ChartEquity({ pontos }) {
  const [hover, setHover] = useState(null);
  const svgRef = useRef(null);

  const dados = useMemo(() => {
    if (!pontos || pontos.length < 2) return null;
    const data = pontos.map((p, i) => ({
      n: p.n ?? i + 1,
      banca: Number(p.banca ?? 0),
    }));
    const min = Math.min(...data.map(d => d.banca));
    const max = Math.max(...data.map(d => d.banca));
    const banca0 = data[0].banca;
    return { data, min, max, banca0 };
  }, [pontos]);

  if (!dados) {
    return (
      <div className="flex items-center justify-center h-48 rounded-md text-[11px] text-[--mike-fg-muted]" style={{
        backgroundColor: 'rgba(60,85,130,0.08)',
        border: '0.5px dashed rgba(60,85,130,0.4)',
      }}>
        Sem dados de equity para plotar
      </div>
    );
  }

  const { data, min, max, banca0 } = dados;

  const W = 600;
  const H = 200;
  const PAD_L = 50;
  const PAD_R = 10;
  const PAD_T = 10;
  const PAD_B = 25;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  const rangeY = max - min;
  const yPad = rangeY * 0.1 || 1;
  const yMin = min - yPad;
  const yMax = max + yPad;

  const xScale = (n) => PAD_L + ((n - data[0].n) / Math.max(1, data[data.length - 1].n - data[0].n)) * innerW;
  const yScale = (banca) => PAD_T + (1 - (banca - yMin) / (yMax - yMin)) * innerH;

  const pathLine = data.map((d, i) =>
    (i === 0 ? 'M' : 'L') + xScale(d.n).toFixed(1) + ',' + yScale(d.banca).toFixed(1)
  ).join(' ');

  const yBaseline = yScale(banca0);
  const pathArea = pathLine
    + ` L ${xScale(data[data.length - 1].n).toFixed(1)},${yBaseline.toFixed(1)}`
    + ` L ${xScale(data[0].n).toFixed(1)},${yBaseline.toFixed(1)} Z`;

  const ehPositivo = data[data.length - 1].banca >= banca0;
  const corLinha = ehPositivo ? '#10b981' : '#f43f5e';

  const yLabels = [];
  for (let i = 0; i <= 4; i++) {
    const v = yMin + ((yMax - yMin) * i) / 4;
    yLabels.push({ y: yScale(v), valor: v });
  }

  const handleMouseMove = (e) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width) * W;
    if (x < PAD_L || x > W - PAD_R) {
      setHover(null);
      return;
    }
    let melhor = data[0];
    let menorDist = Infinity;
    for (const d of data) {
      const dist = Math.abs(xScale(d.n) - x);
      if (dist < menorDist) {
        menorDist = dist;
        melhor = d;
      }
    }
    setHover({
      n: melhor.n,
      banca: melhor.banca,
      x: xScale(melhor.n),
      y: yScale(melhor.banca),
    });
  };

  return (
    <div className="rounded-md p-3" style={{
      backgroundColor: 'rgba(0,0,0,0.25)',
      border: '0.5px solid rgba(60,85,130,0.4)',
    }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold text-[--mike-fg]">Curva de Equity</span>
        <span className="text-[9px] text-[--mike-fg-muted]">
          {data.length} apostas · min {formatarBRL(min)} · max {formatarBRL(max)}
        </span>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full select-none"
        style={{ height: H, display: 'block' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHover(null)}
      >
        {yLabels.map((lab, i) => (
          <g key={i}>
            <line x1={PAD_L} x2={W - PAD_R} y1={lab.y} y2={lab.y}
              stroke="rgba(60,85,130,0.25)" strokeWidth="0.5" strokeDasharray="2,2" />
            <text x={PAD_L - 6} y={lab.y + 3} fill="#6b7691" fontSize="9" textAnchor="end">
              {lab.valor >= 1000 ? `${(lab.valor/1000).toFixed(1)}k` : lab.valor.toFixed(0)}
            </text>
          </g>
        ))}

        <line x1={PAD_L} x2={W - PAD_R} y1={yBaseline} y2={yBaseline}
          stroke="#6b7691" strokeWidth="0.5" strokeDasharray="3,3" opacity="0.5" />

        <path d={pathArea} fill={corLinha} opacity="0.1" />

        <path d={pathLine} fill="none" stroke={corLinha} strokeWidth="1.5"
          strokeLinejoin="round" strokeLinecap="round" />

        {hover && (
          <g>
            <line x1={hover.x} x2={hover.x} y1={PAD_T} y2={H - PAD_B}
              stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" strokeDasharray="2,2" />
            <circle cx={hover.x} cy={hover.y} r="4" fill={corLinha}
              stroke="#0d1220" strokeWidth="2" />
            <g transform={`translate(${Math.min(W - 130, Math.max(PAD_L, hover.x + 8))}, ${Math.max(PAD_T + 4, hover.y - 30)})`}>
              <rect width="120" height="34" rx="4" fill="#0d1220"
                stroke="rgba(16,185,129,0.5)" strokeWidth="0.5" />
              <text x="6" y="14" fontSize="9" fill="#94a3b8">Aposta #{hover.n}</text>
              <text x="6" y="27" fontSize="11" fill={corLinha} fontWeight="bold">
                {formatarBRL(hover.banca)}
              </text>
            </g>
          </g>
        )}

        <text x={PAD_L} y={H - 8} fill="#6b7691" fontSize="9" textAnchor="start">
          #{data[0].n}
        </text>
        <text x={W - PAD_R} y={H - 8} fill="#6b7691" fontSize="9" textAnchor="end">
          #{data[data.length - 1].n}
        </text>
      </svg>
    </div>
  );
}

// ============================================================
// HISTORICO
// ============================================================

function HistoricoJobs({ botId, onSelecionar }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [aberto, setAberto] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await ApiBacktest.listByBot(botId, 10);
      setJobs(data || []);
    } catch (e) {
      console.error('Erro listando histórico:', e);
    } finally {
      setLoading(false);
    }
  }, [botId]);

  useEffect(() => {
    if (aberto) carregar();
  }, [aberto, carregar]);

  return (
    <div className="rounded-md" style={{ border: '0.5px solid rgba(60,85,130,0.4)' }}>
      <button
        onClick={() => setAberto(!aberto)}
        className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-semibold text-[--mike-fg-soft] hover:text-[--mike-fg] transition"
      >
        {aberto ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        Histórico de execuções deste bot
        {jobs.length > 0 && <span className="text-[--mike-fg-muted] font-normal">({jobs.length})</span>}
      </button>
      {aberto && (
        <div className="px-3 pb-3 pt-1">
          {loading && <div className="text-[10px] text-[--mike-fg-muted]">Carregando...</div>}
          {!loading && jobs.length === 0 && (
            <div className="text-[10px] text-[--mike-fg-muted]">Nenhum backtest anterior pra este bot.</div>
          )}
          {!loading && jobs.length > 0 && (
            <div className="space-y-1">
              {jobs.map(j => {
                const corStatus = j.status === 'concluido' ? '#10b981'
                  : j.status === 'erro' ? '#f43f5e'
                  : j.status === 'rodando' ? '#f59e0b' : '#6b7691';
                return (
                  <button
                    key={j.id}
                    onClick={() => j.status === 'concluido' && onSelecionar(j.id)}
                    disabled={j.status !== 'concluido'}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-[10px] transition hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed text-left"
                  >
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: corStatus }} />
                    <span className="text-[--mike-fg-muted] font-mono">#{j.id}</span>
                    <span className="text-[--mike-fg-soft]">{j.data_inicio} → {j.data_fim}</span>
                    {j.status === 'concluido' && (
                      <>
                        <span className="text-[--mike-fg-muted]">·</span>
                        <span className={j.roi >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          ROI {formatarPct(j.roi)}
                        </span>
                        <span className="text-[--mike-fg-muted]">·</span>
                        <span className="text-[--mike-fg-soft]">{j.total_apostas} aps</span>
                      </>
                    )}
                    {j.status === 'rodando' && <span className="text-amber-400">{j.progresso}%</span>}
                    {j.status === 'erro' && <span className="text-rose-400">erro</span>}
                    <div className="flex-1" />
                    <span className="text-[--mike-fg-muted] text-[9px] font-mono">{formatarDataHora(j.iniciado_em)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// MAIN MODAL
// ============================================================

export default function BacktestModal({ aberto, bot, onFechar }) {
  const [estado, setEstado] = useState('config');
  const [jobId, setJobId] = useState(null);
  const [job, setJob] = useState(null);
  const [erroMsg, setErroMsg] = useState(null);

  const [dataInicio, setDataInicio] = useState(dataAtras(30));
  const [dataFim, setDataFim] = useState(hoje());
  const [stakeModo, setStakeModo] = useState('fixo');
  const [stakeValor, setStakeValor] = useState(10);
  const [bancaInicial, setBancaInicial] = useState(1000);

  // v4: fonte dos ticks - 'banco' (periodo) ou 'arquivo' (upload parquet)
  const [fonte, setFonte] = useState('banco');
  const [arquivo, setArquivo] = useState(null);
  const [uploadId, setUploadId] = useState(null);
  const [resumoUpload, setResumoUpload] = useState(null);
  const [validacao, setValidacao] = useState(null);
  const [subindo, setSubindo] = useState(false);

  const pollRef = useRef(null);

  useEffect(() => {
    if (aberto) {
      setEstado('config');
      setJobId(null);
      setJob(null);
      setErroMsg(null);
      setFonte('banco');
      setArquivo(null);
      setUploadId(null);
      setResumoUpload(null);
      setValidacao(null);
      setSubindo(false);
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [aberto, bot?.id]);

  useEffect(() => {
    if (!jobId || estado !== 'rodando') return;

    const tick = async () => {
      try {
        const data = await ApiBacktest.get(jobId, false);
        setJob(data);
        if (data.status === 'concluido') {
          const completo = await ApiBacktest.get(jobId, true);
          setJob(completo);
          setEstado('resultado');
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
        } else if (data.status === 'erro') {
          setErroMsg(data.erro || 'Erro desconhecido');
          setEstado('erro');
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
        }
      } catch (e) {
        console.error('Erro polling:', e);
      }
    };

    tick();
    pollRef.current = setInterval(tick, 1000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [jobId, estado]);

  // v4: sobe o parquet, pega resumo + dispara validacao cruzada
  const subirArquivo = useCallback(async (file) => {
    if (!file) return;
    setSubindo(true);
    setErroMsg(null);
    setResumoUpload(null);
    setValidacao(null);
    setUploadId(null);
    try {
      const res = await ApiBacktest.uploadTicks(file);
      setUploadId(res.upload_id);
      setResumoUpload(res);
      // validacao cruzada (nao bloqueia - so informa)
      if (bot?.id) {
        try {
          const val = await ApiBacktest.validarCruzado({
            bot_id: bot.id,
            upload_id: res.upload_id,
          });
          setValidacao(val);
        } catch (e) {
          // validacao falhar nao impede rodar - so nao mostra o aviso
          console.warn('validacao cruzada falhou:', e.message);
        }
      }
    } catch (e) {
      setErroMsg(e.message);
    } finally {
      setSubindo(false);
    }
  }, [bot?.id]);

  const podeExecutar = useMemo(() => {
    if (stakeValor <= 0) return false;
    if (stakeModo === 'ratchet' && bancaInicial <= 0) return false;
    if (fonte === 'arquivo') {
      return !!uploadId && !subindo;
    }
    // fonte banco
    if (!dataInicio || !dataFim) return false;
    if (new Date(dataFim) < new Date(dataInicio)) return false;
    return true;
  }, [fonte, uploadId, subindo, dataInicio, dataFim, stakeValor, stakeModo, bancaInicial]);

  const executar = useCallback(async () => {
    if (!bot?.id || !podeExecutar) return;
    setErroMsg(null);
    try {
      let res;
      if (fonte === 'arquivo') {
        res = await ApiBacktest.createFromUpload({
          bot_id: bot.id,
          upload_id: uploadId,
          stake_modo: stakeModo,
          stake_valor: stakeValor,
          banca_inicial: bancaInicial,
        });
      } else {
        res = await ApiBacktest.create({
          bot_id: bot.id,
          data_inicio: dataInicio,
          data_fim: dataFim,
          stake_modo: stakeModo,
          stake_valor: stakeValor,
          banca_inicial: bancaInicial,
        });
      }
      setJobId(res.job_id);
      setEstado('rodando');
    } catch (e) {
      setErroMsg(e.message);
      setEstado('erro');
    }
  }, [bot?.id, podeExecutar, fonte, uploadId, dataInicio, dataFim, stakeModo, stakeValor, bancaInicial]);

  const verJobAnterior = useCallback(async (id) => {
    setJobId(id);
    setEstado('rodando');
    try {
      const completo = await ApiBacktest.get(id, true);
      setJob(completo);
      setEstado('resultado');
    } catch (e) {
      setErroMsg(e.message);
      setEstado('erro');
    }
  }, []);

  if (!aberto || !bot) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onFechar}
    >
      <div
        className="rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
        style={{
          backgroundColor: '#141a28',
          border: '0.5px solid rgba(60, 85, 130, 0.6)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
          animation: 'mike-modal-fade 200ms ease-out',
        }}
        onClick={e => e.stopPropagation()}
      >
        <style>{`
          @keyframes mike-modal-fade {
            from { opacity: 0; transform: translateY(8px) scale(0.97); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }
          @keyframes mike-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          .mike-spin { animation: mike-spin 0.8s linear infinite; }
          @keyframes mike-pulse-bar {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.6; }
          }
          .mike-pulse-bar { animation: mike-pulse-bar 1.2s ease-in-out infinite; }
        `}</style>

        <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '0.5px solid rgba(60,85,130,0.4)' }}>
          <div className="w-8 h-8 rounded-md bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-white truncate">Backtest · {bot.nome}</h2>
            <p className="text-[10px] text-[--mike-fg-muted] truncate">
              {bot.casa} · {bot.esporte} · {bot.mercado} · #{bot.id}
            </p>
          </div>
          <button onClick={onFechar} className="p-1.5 rounded text-[--mike-fg-muted] hover:text-white hover:bg-white/5 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">

          {estado === 'config' && (
            <div className="space-y-4">
              <div className="flex items-start gap-2 px-3 py-2 rounded-md text-[11px] leading-relaxed" style={{
                backgroundColor: 'rgba(245,158,11,0.06)',
                border: '0.5px solid rgba(245,158,11,0.3)',
                color: '#94a3b8',
              }}>
                <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-amber-400" />
                <span>
                  O backtest usa os <strong className="text-amber-400">ticks reais</strong> do MikeDB no período escolhido.
                  Filtros do bot são aplicados em ordem cronológica, simulando como o bot teria operado.
                </span>
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-[11px] font-bold text-[--mike-fg] mb-2">
                  <Activity className="w-3.5 h-3.5 text-cyan-400" />
                  Fonte dos ticks
                </label>
                <div className="flex items-center gap-2 mb-2">
                  <button
                    onClick={() => setFonte('banco')}
                    className={`flex-1 px-3 py-2 rounded-md text-[11px] font-semibold transition ${
                      fonte === 'banco' ? 'bg-cyan-500/15 text-cyan-300' : 'text-[--mike-fg-muted]'
                    }`}
                    style={{ border: '0.5px solid', borderColor: fonte === 'banco' ? 'rgba(6,182,212,0.5)' : 'rgba(60,85,130,0.4)' }}
                  >
                    Banco (período)
                  </button>
                  <button
                    onClick={() => setFonte('arquivo')}
                    className={`flex-1 px-3 py-2 rounded-md text-[11px] font-semibold transition ${
                      fonte === 'arquivo' ? 'bg-cyan-500/15 text-cyan-300' : 'text-[--mike-fg-muted]'
                    }`}
                    style={{ border: '0.5px solid', borderColor: fonte === 'arquivo' ? 'rgba(6,182,212,0.5)' : 'rgba(60,85,130,0.4)' }}
                  >
                    Arquivo (.parquet)
                  </button>
                </div>

                {fonte === 'arquivo' && (
                  <div className="mt-2">
                    <label className="block text-[10px] text-[--mike-fg-muted] mb-1">
                      Arquivo de ticks (.parquet do HD)
                    </label>
                    <input
                      type="file"
                      accept=".parquet"
                      onChange={e => {
                        const f = e.target.files?.[0] || null;
                        setArquivo(f);
                        if (f) subirArquivo(f);
                      }}
                      className="w-full px-3 py-2 rounded-md text-[11px] text-white bg-transparent outline-none file:mr-3 file:px-2 file:py-1 file:rounded file:border-0 file:text-[10px] file:bg-cyan-500/20 file:text-cyan-300"
                      style={{ border: '0.5px solid rgba(60,85,130,0.4)' }}
                    />

                    {subindo && (
                      <div className="flex items-center gap-2 mt-2 text-[10px] text-cyan-300">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        Subindo e validando arquivo...
                      </div>
                    )}

                    {resumoUpload && !subindo && (
                      <div
                        className="mt-2 p-2.5 rounded-md text-[10px]"
                        style={{ backgroundColor: 'rgba(6,182,212,0.06)', border: '0.5px solid rgba(6,182,212,0.25)' }}
                      >
                        <div className="flex items-center gap-1.5 text-cyan-300 font-semibold mb-1">
                          <CheckCircle2 className="w-3 h-3" />
                          {Number(resumoUpload.linhas).toLocaleString('pt-BR')} ticks lidos
                        </div>
                        <div className="text-[--mike-fg-muted] leading-relaxed">
                          {resumoUpload.ts_min && (
                            <div>Período: {formatarDataHora(resumoUpload.ts_min)} → {formatarDataHora(resumoUpload.ts_max)}</div>
                          )}
                          {resumoUpload.casas?.length > 0 && <div>Casas: {resumoUpload.casas.join(', ')}</div>}
                          {resumoUpload.ligas?.length > 0 && <div>Ligas: {resumoUpload.ligas.slice(0, 4).join(', ')}{resumoUpload.ligas.length > 4 ? '…' : ''}</div>}
                        </div>
                      </div>
                    )}

                    {validacao && !subindo && (
                      <div
                        className="mt-2 p-2.5 rounded-md text-[10px]"
                        style={{
                          backgroundColor: validacao.ok ? 'rgba(16,185,129,0.06)' : 'rgba(245,158,11,0.08)',
                          border: `0.5px solid ${validacao.ok ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.4)'}`,
                        }}
                      >
                        <div className={`flex items-center gap-1.5 font-semibold mb-1 ${validacao.ok ? 'text-emerald-300' : 'text-amber-300'}`}>
                          {validacao.ok ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                          {validacao.ok ? 'Validação cruzada OK' : 'Atenção: divergência com o banco'}
                        </div>
                        <div className="text-[--mike-fg-muted] leading-relaxed">
                          {validacao.amostrados > 0 && (
                            <div>{validacao.amostrados} jogos conferidos · {validacao.placar_divergente} placar divergente · {validacao.so_no_arquivo} só no arquivo</div>
                          )}
                          {validacao.erro && <div className="text-amber-300/90 mt-0.5">{validacao.erro}</div>}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {fonte === 'banco' && (
              <div>
                <label className="flex items-center gap-1.5 text-[11px] font-bold text-[--mike-fg] mb-2">
                  <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                  Período
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-[--mike-fg-muted] mb-1">Início</label>
                    <input
                      type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
                      max={dataFim}
                      className="w-full px-3 py-2 rounded-md text-xs text-white bg-transparent outline-none"
                      style={{ border: '0.5px solid rgba(60,85,130,0.4)' }}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[--mike-fg-muted] mb-1">Fim</label>
                    <input
                      type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
                      min={dataInicio} max={hoje()}
                      className="w-full px-3 py-2 rounded-md text-xs text-white bg-transparent outline-none"
                      style={{ border: '0.5px solid rgba(60,85,130,0.4)' }}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  {[7, 14, 30, 60, 90].map(d => (
                    <button
                      key={d}
                      onClick={() => { setDataInicio(dataAtras(d)); setDataFim(hoje()); }}
                      className="px-2 py-1 rounded text-[9px] font-semibold transition"
                      style={{
                        backgroundColor: 'rgba(6,182,212,0.08)',
                        border: '0.5px solid rgba(6,182,212,0.3)',
                        color: '#22d3ee',
                      }}
                    >
                      Últ. {d}d
                    </button>
                  ))}
                </div>
              </div>
              )}

              <div>
                <label className="flex items-center gap-1.5 text-[11px] font-bold text-[--mike-fg] mb-2">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                  Stake
                </label>
                <div className="flex items-center gap-2 mb-2">
                  <button
                    onClick={() => setStakeModo('fixo')}
                    className={`flex-1 px-3 py-2 rounded-md text-[11px] font-semibold transition ${
                      stakeModo === 'fixo' ? 'bg-emerald-500/15 text-emerald-300' : 'text-[--mike-fg-muted]'
                    }`}
                    style={{ border: '0.5px solid', borderColor: stakeModo === 'fixo' ? 'rgba(16,185,129,0.5)' : 'rgba(60,85,130,0.4)' }}
                  >
                    Fixo
                  </button>
                  <button
                    onClick={() => setStakeModo('ratchet')}
                    className={`flex-1 px-3 py-2 rounded-md text-[11px] font-semibold transition ${
                      stakeModo === 'ratchet' ? 'bg-emerald-500/15 text-emerald-300' : 'text-[--mike-fg-muted]'
                    }`}
                    style={{ border: '0.5px solid', borderColor: stakeModo === 'ratchet' ? 'rgba(16,185,129,0.5)' : 'rgba(60,85,130,0.4)' }}
                  >
                    Ratchet (% banca pico)
                  </button>
                </div>

                {stakeModo === 'fixo' ? (
                  <div>
                    <label className="block text-[10px] text-[--mike-fg-muted] mb-1">Valor por aposta (R$)</label>
                    <input
                      type="number" step="0.01" min="0.01"
                      value={stakeValor}
                      onChange={e => setStakeValor(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 rounded-md text-xs text-white bg-transparent outline-none"
                      style={{ border: '0.5px solid rgba(60,85,130,0.4)' }}
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-[--mike-fg-muted] mb-1">% da banca pico</label>
                      <input
                        type="number" step="0.1" min="0.1" max="100"
                        value={stakeValor}
                        onChange={e => setStakeValor(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 rounded-md text-xs text-white bg-transparent outline-none"
                        style={{ border: '0.5px solid rgba(60,85,130,0.4)' }}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[--mike-fg-muted] mb-1">Banca inicial (R$)</label>
                      <input
                        type="number" step="1" min="1"
                        value={bancaInicial}
                        onChange={e => setBancaInicial(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 rounded-md text-xs text-white bg-transparent outline-none"
                        style={{ border: '0.5px solid rgba(60,85,130,0.4)' }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {erroMsg && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-md text-[11px]" style={{
                  backgroundColor: 'rgba(244,63,94,0.1)',
                  border: '0.5px solid rgba(244,63,94,0.4)',
                  color: '#fda4af',
                }}>
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  {erroMsg}
                </div>
              )}

              <HistoricoJobs botId={bot.id} onSelecionar={verJobAnterior} />
            </div>
          )}

          {estado === 'rodando' && (
            <div className="py-8 space-y-4">
              <div className="text-center">
                <RefreshCw className="w-10 h-10 mx-auto text-cyan-400 mike-spin mb-3" />
                <h3 className="text-base font-bold text-white">Executando backtest...</h3>
                <p className="text-[11px] text-[--mike-fg-muted] mt-1">
                  Job #{jobId} · {job?.progresso_msg || 'Iniciando...'}
                </p>
              </div>

              <div className="rounded-md overflow-hidden mike-pulse-bar" style={{
                backgroundColor: 'rgba(60,85,130,0.2)',
                border: '0.5px solid rgba(60,85,130,0.4)',
                height: 8,
              }}>
                <div
                  className="h-full transition-all duration-500"
                  style={{
                    width: `${job?.progresso || 0}%`,
                    background: 'linear-gradient(90deg, #06b6d4, #10b981)',
                  }}
                />
              </div>

              <p className="text-center text-[10px] text-[--mike-fg-muted]">
                {job?.progresso || 0}% concluído
              </p>
            </div>
          )}

          {estado === 'resultado' && job && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">Concluído</span>
                <span className="text-[10px] text-[--mike-fg-muted] flex-1">
                  Job #{job.id} · {formatarDataHora(job.concluido_em)}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <CardMetrica
                  titulo="ROI" valor={formatarPct(job.roi)}
                  cor={(job.roi || 0) >= 0 ? 'emerald' : 'rose'}
                  Icon={(job.roi || 0) >= 0 ? TrendingUp : TrendingDown}
                />
                <CardMetrica
                  titulo="Win Rate" valor={formatarPct(job.win_rate)}
                  sub={`${job.green || 0}G · ${job.red || 0}R`}
                  cor="cyan" Icon={Activity}
                />
                <CardMetrica
                  titulo="Apostas" valor={job.total_apostas || 0}
                  sub={`${job.dias_verdes || 0}/${job.dias_total || 0} dias verdes`}
                  cor="slate" Icon={BarChart3}
                />
                <CardMetrica
                  titulo="Drawdown" valor={formatarBRL(job.drawdown_max)}
                  sub={`Streak red: ${job.max_streak_red || 0}`}
                  cor="amber" Icon={TrendingDown}
                />
              </div>

              <div className="rounded-md p-4 text-center" style={{
                backgroundColor: (job.pnl || 0) >= 0 ? 'rgba(16,185,129,0.06)' : 'rgba(244,63,94,0.06)',
                border: `0.5px solid ${(job.pnl || 0) >= 0 ? 'rgba(16,185,129,0.3)' : 'rgba(244,63,94,0.3)'}`,
              }}>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[--mike-fg-muted]">
                  Lucro/Prejuízo Total
                </div>
                <div className="text-2xl font-black mt-1" style={{
                  color: (job.pnl || 0) >= 0 ? '#10b981' : '#f43f5e',
                }}>
                  {(job.pnl || 0) >= 0 ? '+' : ''}{formatarBRL(job.pnl)}
                </div>
                <div className="text-[10px] text-[--mike-fg-muted] mt-1">
                  Stake {job.stake_modo === 'fixo'
                    ? `fixo ${formatarBRL(job.stake_valor)}`
                    : `ratchet ${job.stake_valor}% sobre banca pico (inicial ${formatarBRL(job.banca_inicial)})`}
                  {' · '}
                  {job.total_ticks_avaliados || 0} ticks avaliados
                </div>
              </div>

              <ChartEquity pontos={job.equity_curve} />

              {(job.total_apostas || 0) === 0 && (
                <div className="flex items-start gap-2 px-3 py-2 rounded-md text-[11px]" style={{
                  backgroundColor: 'rgba(245,158,11,0.08)',
                  border: '0.5px solid rgba(245,158,11,0.3)',
                  color: '#fcd34d',
                }}>
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold">Nenhuma aposta gerada no período.</p>
                    <p className="mt-0.5 opacity-80">
                      Os filtros do bot podem estar muito restritivos, ou os ticks no MikeDB do período
                      escolhido não cobrem este mercado/casa/esporte. Tente ampliar o período ou afrouxar filtros.
                    </p>
                  </div>
                </div>
              )}

              <HistoricoJobs botId={bot.id} onSelecionar={verJobAnterior} />
            </div>
          )}

          {estado === 'erro' && (
            <div className="py-8 text-center">
              <AlertCircle className="w-10 h-10 mx-auto text-rose-400 mb-3" />
              <h3 className="text-base font-bold text-white">Erro no backtest</h3>
              <p className="text-[11px] text-[--mike-fg-muted] mt-1 mb-4 max-w-md mx-auto">
                {erroMsg || job?.erro || 'Erro desconhecido'}
              </p>
              <button
                onClick={() => { setEstado('config'); setErroMsg(null); }}
                className="px-3 py-1.5 rounded-md text-[11px] font-semibold text-[--mike-fg-soft] hover:text-white transition"
                style={{ border: '0.5px solid rgba(60,85,130,0.4)' }}
              >
                Tentar novamente
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 px-4 py-3" style={{ borderTop: '0.5px solid rgba(60,85,130,0.4)' }}>
          {estado === 'config' && (
            <>
              <button
                onClick={onFechar}
                className="px-3 py-1.5 rounded-md text-[11px] font-medium text-[--mike-fg-soft] hover:text-white transition"
                style={{ border: '0.5px solid rgba(60,85,130,0.4)' }}
              >
                Cancelar
              </button>
              <div className="flex-1" />
              <button
                onClick={executar}
                disabled={!podeExecutar}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-md text-[11px] font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-900 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
              >
                <Play className="w-3.5 h-3.5" />
                Executar Backtest
              </button>
            </>
          )}
          {(estado === 'rodando' || estado === 'resultado' || estado === 'erro') && (
            <>
              {estado === 'resultado' && (
                <button
                  onClick={() => { setEstado('config'); setJobId(null); setJob(null); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold text-cyan-300 hover:bg-cyan-500/10 transition"
                  style={{ border: '0.5px solid rgba(6,182,212,0.4)' }}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Novo backtest
                </button>
              )}
              <div className="flex-1" />
              <button
                onClick={onFechar}
                className="px-4 py-1.5 rounded-md text-[11px] font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-900 transition"
              >
                Fechar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}