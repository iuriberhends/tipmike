// ============================================================
// Esteira.jsx — a esteira de estratégias como tela do painel
//
// VISUAL: copiado do Varredura.jsx, valor por valor — mesmos themeVars,
// mesmo cardStyle, mesmos Campo/Input/Select com .mike-border-thin, mesma
// SecaoTitulo, mesmo grid 3 colunas com o Resultado sticky à direita.
// Duas telas que fazem coisas parecidas devem se parecer.
//
// ATENCAO: as variáveis --mike-* NÃO são globais — cada tela declara o
// themeVars no wrapper. Sem isso até o MikeHeader renderiza sem cor.
//
// A API é só despachante: cria a rodada 'pendente' e responde. Quem roda é
// o serviço TipMikeEsteira (fila própria: 2 slots, piso de RAM, teto global
// de pesados). A retomada PULA itens concluídos — re-subir é barato.
//
// 🔌 BACKEND:
//   GET    /esteira/arquivos               planilhas + parquets da raiz
//   POST   /esteira/rodadas                cria e enfileira
//   GET    /esteira/rodadas                lista (contagens reais da view)
//   GET    /esteira/rodadas/:id            detalhe + baseline + alertas
//   GET    /esteira/rodadas/:id/itens      o placar (métricas por item)
//   POST   /esteira/rodadas/:id/cancelar
//   POST   /esteira/rodadas/:id/retomar    itens em erro voltam pra fila
//   GET    /esteira/rodadas/:id/planilha   xlsx PLACAR/VARIACOES/CARTEIRA
//   DELETE /esteira/rodadas/:id            só em status final
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Home, ChevronRight, ListChecks, FileSpreadsheet, Database, Layers,
  Trophy, Play, Download, X, RefreshCw, AlertCircle, AlertTriangle,
  CheckCircle2, Clock, Hash, RotateCcw, Trash2, ShieldCheck, Settings2,
} from 'lucide-react';
import MikeHeader from '../shared/MikeHeader.jsx';
import { api } from '../lib/api.js';
import { BASE_URL, getAccessToken } from '../lib/auth.js';

// ============================================================
// CONSTANTES
// ============================================================

const STATUS = {
  pendente:   { rotulo: 'Na fila',    cor: '#6b7691' },
  preparando: { rotulo: 'Preparando', cor: '#0891b2', girando: true },
  rodando:    { rotulo: 'Rodando',    cor: '#22d3ee', girando: true },
  concluido:  { rotulo: 'Pronto',     cor: '#10b981' },
  erro:       { rotulo: 'Erro',       cor: '#f43f5e' },
  cancelado:  { rotulo: 'Cancelado',  cor: '#6b7691' },
};
const ATIVO = ['pendente', 'preparando', 'rodando'];
const FINAL = ['concluido', 'erro', 'cancelado'];

const PAPEL = {
  sentinela:  { rotulo: 'sentinela', cor: '#22d3ee' },
  controle:   { rotulo: 'controle',  cor: '#a78bfa' },
  estrategia: { rotulo: '',          cor: '#eaeef7' },
  variacao:   { rotulo: '↳',         cor: '#6b7691' },
};

const POLL_MS = 4000;

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

const cardStyle = {
  backgroundColor: 'rgba(20, 26, 40, 0.4)',
  border: '0.5px solid rgba(60, 85, 130, 0.4)',
};

function numOuNull(v) {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
const fmt = (n) => (n === null || n === undefined || n === ''
  ? null : Number(n).toLocaleString('pt-BR'));
const fmt1 = (n) => (n === null || n === undefined || n === '' || Number.isNaN(Number(n))
  ? '–' : Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 1 }));

function tempoRelativo(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'agora';
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)}h`;
  if (s < 172800) return 'ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function duracaoEntre(ini, fim) {
  if (!ini || !fim) return null;
  const s = Math.floor((new Date(fim) - new Date(ini)) / 1000);
  if (!Number.isFinite(s) || s < 0) return null;
  const m = Math.floor(s / 60);
  return m >= 1 ? `${m}min ${s % 60}s` : `${s}s`;
}

// alertas da rodada podem vir como lista de strings, lista de objetos ou
// dict — a tela não pode quebrar por formato
function alertasLinhas(a) {
  if (!a) return [];
  try {
    if (Array.isArray(a)) {
      return a.map((x) => (typeof x === 'string'
        ? x : (x && (x.msg || x.texto || x.alerta)) || JSON.stringify(x)));
    }
    if (typeof a === 'object') {
      return Object.entries(a).map(([k, v]) => `${k}: ${
        typeof v === 'string' ? v : JSON.stringify(v)}`);
    }
    return [String(a)];
  } catch { return []; }
}

async function baixarPlanilhaRodada(jobId) {
  const res = await fetch(`${BASE_URL}/esteira/rodadas/${jobId}/planilha`,
    { headers: { Authorization: `Bearer ${getAccessToken()}` } });
  if (!res.ok) {
    const j = await res.json().catch(() => null);
    throw new Error((j && j.detail) || `HTTP ${res.status}`);
  }
  let nome = `esteira_${jobId}.xlsx`;
  const cd = res.headers.get('Content-Disposition');
  const m = cd && cd.match(/filename="?([^";\n]+)"?/i);
  if (m) nome = m[1].trim();
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nome;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => window.URL.revokeObjectURL(url), 1000);
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
          {o.label}
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

function StatCard({ icon: Icon, label, valor, cor = '#eaeef7' }) {
  return (
    <div className="rounded-lg p-3" style={cardStyle}>
      <div className="flex items-center gap-1.5 mb-1.5">
        {Icon && <Icon className="w-3 h-3 flex-shrink-0" style={{ color: cor }} />}
        <span className="text-[9px] uppercase tracking-wider text-[--mike-fg-muted] font-bold truncate">{label}</span>
      </div>
      <div className="text-lg font-black font-mono leading-tight truncate" style={{ color: cor }}>{valor}</div>
    </div>
  );
}

function Selo({ status }) {
  const s = STATUS[status] || STATUS.pendente;
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold flex-shrink-0"
          style={{ color: s.cor, backgroundColor: `${s.cor}1a`,
                   border: `0.5px solid ${s.cor}55` }}>
      {s.girando
        ? <RefreshCw className="w-2.5 h-2.5 mike-spin" />
        : <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.cor }} />}
      {s.rotulo}
    </span>
  );
}

// ============================================================
// PLACAR — a tabela de itens. G–R sempre visível, do lado do resto.
// ============================================================

function ordenarPlacar(itens) {
  const peso = (x) => {
    if (x.papel === 'sentinela') return -2;            // sentinela no topo
    if (x.papel === 'controle') return -1;
    return 0;
  };
  const roi = (x) => {
    const r = x.metricas && Number(x.metricas.ROI);
    return Number.isFinite(r) ? r : -Infinity;         // zeradas/erro no fim
  };
  return [...itens].sort((a, b) =>
    (peso(a) - peso(b)) || (roi(b) - roi(a)) || (a.ordem - b.ordem));
}

function Placar({ itens }) {
  if (!itens || itens.length === 0) {
    return (
      <div className="text-center py-6 text-[--mike-fg-muted] text-xs">
        Sem itens ainda — eles aparecem quando o worker monta a rodada.
      </div>
    );
  }
  const linhas = ordenarPlacar(itens);
  return (
    <div className="rounded-md overflow-hidden" style={{ border: '0.5px solid rgba(60,85,130,0.28)' }}>
      <div className="max-h-[420px] overflow-y-auto">
        <table className="w-full text-[10.5px] font-mono">
          <thead className="sticky top-0" style={{ backgroundColor: '#111726' }}>
            <tr className="text-[9px] uppercase tracking-wider text-[--mike-fg-muted]">
              <th className="text-left  px-2 py-1.5 font-bold">Estratégia</th>
              <th className="text-right px-2 py-1.5 font-bold">Ap</th>
              <th className="text-right px-2 py-1.5 font-bold">G–R</th>
              <th className="text-right px-2 py-1.5 font-bold">WR</th>
              <th className="text-right px-2 py-1.5 font-bold">ROI</th>
              <th className="text-right px-2 py-1.5 font-bold">DD</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((it) => {
              const m = it.metricas || {};
              const p = PAPEL[it.papel] || PAPEL.estrategia;
              const emErro = it.status === 'erro';
              const rodando = it.status === 'rodando' || it.status === 'pendente';
              const zerada = !emErro && Number(m.apostas || 0) === 0
                             && it.status === 'concluido';
              const roiN = Number(m.ROI);
              const corRoi = !Number.isFinite(roiN) ? 'var(--mike-fg-muted)'
                : roiN > 0 ? '#10b981' : roiN < 0 ? '#f43f5e' : 'var(--mike-fg-soft)';
              return (
                <tr key={it.id}
                    title={emErro ? (it.erro || 'erro') : (it.nome + (m.roi_3d != null ? ` · roi_3d ${fmt1(m.roi_3d)}%` : ''))}
                    style={{
                      borderTop: '0.5px solid rgba(60,85,130,0.18)',
                      backgroundColor: it.papel === 'sentinela'
                        ? 'rgba(6,182,212,0.07)' : 'transparent',
                      opacity: zerada ? 0.45 : 1,
                    }}>
                  <td className="px-2 py-1.5 text-left max-w-0 w-full">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {it.papel !== 'estrategia' && (
                        <span className="text-[8.5px] font-black flex-shrink-0"
                              style={{ color: p.cor }}>
                          {p.rotulo || it.papel}
                        </span>
                      )}
                      <span className="truncate"
                            style={{ color: emErro ? '#f43f5e'
                              : it.papel === 'variacao' ? 'var(--mike-fg-soft)'
                              : 'var(--mike-fg)' }}>
                        {it.nome}
                      </span>
                      {emErro && <AlertTriangle className="w-2.5 h-2.5 text-rose-400 flex-shrink-0" />}
                      {rodando && <RefreshCw className="w-2.5 h-2.5 text-cyan-400 mike-spin flex-shrink-0" />}
                    </div>
                  </td>
                  <td className="px-2 py-1.5 text-right text-[--mike-fg-soft]">{fmt(m.apostas) ?? '–'}</td>
                  <td className="px-2 py-1.5 text-right font-bold text-[--mike-fg]">{m['G-R'] || '–'}</td>
                  <td className="px-2 py-1.5 text-right text-[--mike-fg-soft]">{m.WR != null ? `${fmt1(m.WR)}` : '–'}</td>
                  <td className="px-2 py-1.5 text-right font-bold" style={{ color: corRoi }}>
                    {Number.isFinite(roiN) ? fmt1(roiN) : '–'}
                  </td>
                  <td className="px-2 py-1.5 text-right text-[--mike-fg-soft]">{m.DD != null ? fmt1(m.DD) : '–'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// TELA
// ============================================================

export default function Esteira({ onNavegar } = {}) {
  const [arquivos, setArquivos] = useState({ planilhas: [], parquets: [] });
  const [jobs, setJobs] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [selecionado, setSelecionado] = useState(null);
  const [detalhe, setDetalhe] = useState({});
  const [itensDe, setItensDe] = useState({});
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [criando, setCriando] = useState(false);

  // formulário
  const [nome, setNome] = useState('');
  const [planilha, setPlanilha] = useState('');
  const [fonteTipo, setFonteTipo] = useState('arquivo');   // arquivo | banco
  const [fonteArquivo, setFonteArquivo] = useState('');
  const [dias, setDias] = useState('');
  const [casa, setCasa] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [maxZerados, setMaxZerados] = useState('');
  const [timeoutMin, setTimeoutMin] = useState('');

  const pollRef = useRef(null);
  const montadoRef = useRef(true);

  const ativos = useMemo(
    () => jobs.filter((j) => ATIVO.includes(j.status)).length, [jobs]);
  const d = selecionado ? detalhe[selecionado] : null;
  const its = selecionado ? (itensDe[selecionado] || []) : [];
  const alertas = useMemo(() => alertasLinhas(d && d.alertas), [d]);

  useEffect(() => {
    montadoRef.current = true;
    return () => {
      montadoRef.current = false;
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, []);

  const carregarJobs = useCallback(async () => {
    try {
      const l = await api.get('/esteira/rodadas', { limite: 30 });
      if (montadoRef.current) setJobs(l || []);
      return l || [];
    } catch (e) {
      if (montadoRef.current) setErro(e?.message || 'Falha ao listar rodadas.');
      return [];
    }
  }, []);

  const carregarDetalhe = useCallback(async (id, silencioso = false) => {
    try {
      const [r, li] = await Promise.all([
        api.get(`/esteira/rodadas/${id}`),
        api.get(`/esteira/rodadas/${id}/itens`),
      ]);
      if (montadoRef.current) {
        setDetalhe((p) => ({ ...p, [id]: r }));
        setItensDe((p) => ({ ...p, [id]: li || [] }));
      }
    } catch (e) {
      if (!silencioso && montadoRef.current) setErro(e?.message || 'Falha ao abrir a rodada.');
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const a = await api.get('/esteira/arquivos');
        if (montadoRef.current) setArquivos(a || { planilhas: [], parquets: [] });
      } catch (e) {
        if (montadoRef.current) setErro(e?.message || 'Falha ao listar arquivos da raiz.');
      }
      const l = await carregarJobs();
      if (montadoRef.current && l.length) {
        setSelecionado(l[0].id);
        carregarDetalhe(l[0].id, true);
      }
      if (montadoRef.current) setCarregando(false);
    })();
  }, [carregarJobs, carregarDetalhe]);

  // polling condicional: só enquanto houver rodada ativa — para sozinho
  useEffect(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (ativos > 0) {
      pollRef.current = setInterval(async () => {
        const l = await carregarJobs();
        if (selecionado && l.some((j) => j.id === selecionado)) {
          carregarDetalhe(selecionado, true);
        }
      }, POLL_MS);
    }
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [ativos, selecionado, carregarJobs, carregarDetalhe]);

  const selecionar = useCallback((id) => {
    setSelecionado(id);
    if (!detalhe[id]) carregarDetalhe(id);
  }, [detalhe, carregarDetalhe]);

  const handleRodar = useCallback(async () => {
    if (!planilha) { setErro('Escolha a planilha de estratégias.'); return; }
    if (fonteTipo === 'arquivo' && !fonteArquivo) {
      setErro('Escolha o parquet de ticks.'); return;
    }
    if (fonteTipo === 'banco' && !(casa && dataInicio && dataFim)) {
      setErro('Fonte banco exige casa, data início e data fim.'); return;
    }
    setCriando(true); setErro(null); setAviso(null);
    try {
      const body = {
        nome: nome.trim() || null,
        origem: 'planilha',
        origem_ref: planilha,
        planilha,
      };
      if (fonteTipo === 'arquivo') {
        body.fonte_arquivo = fonteArquivo;
        const nd = numOuNull(dias);
        if (nd) body.dias = nd;
      } else {
        body.fonte = 'banco';
        body.casa = casa.trim();
        body.data_inicio = dataInicio;
        body.data_fim = dataFim;
      }
      const mz = numOuNull(maxZerados);
      if (mz !== null) body.max_zerados = mz;         // 0 desliga a trava
      const tm = numOuNull(timeoutMin);
      if (tm) body.timeout_min = tm;

      const r = await api.post('/esteira/rodadas', body);
      if (!montadoRef.current) return;
      setAviso(r.na_frente > 0
        ? `Rodada #${r.id} criada — ${r.na_frente} na frente na fila.`
        : `Rodada #${r.id} criada e entrando na fila.`);
      const l = await carregarJobs();
      if (l.length) { setSelecionado(l[0].id); carregarDetalhe(l[0].id, true); }
    } catch (e) {
      if (montadoRef.current) setErro(e?.message || 'Falha ao criar a rodada.');
    } finally {
      if (montadoRef.current) setCriando(false);
    }
  }, [nome, planilha, fonteTipo, fonteArquivo, dias, casa, dataInicio, dataFim,
      maxZerados, timeoutMin, carregarJobs, carregarDetalhe]);

  const handleAcao = useCallback(async (id, qual) => {
    setErro(null);
    try {
      await api.post(`/esteira/rodadas/${id}/${qual}`, {});
      await carregarJobs();
      carregarDetalhe(id, true);
    } catch (e) { setErro(e?.message || 'Falha na ação.'); }
  }, [carregarJobs, carregarDetalhe]);

  const handleExcluir = useCallback(async (id) => {
    if (!window.confirm(`Excluir a rodada #${id}? Itens e planilha vão junto; `
                        + 'os backtests ficam.')) return;
    setErro(null);
    try {
      await api.delete(`/esteira/rodadas/${id}`);
      setSelecionado(null);
      await carregarJobs();
    } catch (e) { setErro(e?.message || 'Falha ao excluir.'); }
  }, [carregarJobs]);

  const handleDownload = useCallback(async (id) => {
    setErro(null);
    try { await baixarPlanilhaRodada(id); }
    catch (e) { setErro(e?.message || 'Falha ao baixar.'); }
  }, []);

  const podeRetomar = d && FINAL.includes(d.status)
    && (d.status !== 'concluido' || (d.itens_erro || 0) > 0);

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

      <MikeHeader telaAtiva="esteira" onNavegar={onNavegar} />

      <main className="max-w-screen-xl mx-auto px-4 lg:px-8 py-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-[--mike-fg-muted] mb-4">
          <button onClick={() => onNavegar?.('today')} className="hover:text-[--mike-fg]">
            <Home className="w-3 h-3" />
          </button>
          <ChevronRight className="w-3 h-3" />
          <span className="text-[--mike-fg] font-semibold flex items-center gap-1">
            <ListChecks className="w-3 h-3" />
            Esteira
          </span>
        </div>

        {/* Título */}
        <div className="mb-5">
          <h1 className="text-xl font-black text-[--mike-fg] flex items-center gap-2">
            <ListChecks className="w-5 h-5 text-cyan-400" />
            Esteira
          </h1>
          <p className="text-[11px] text-[--mike-fg-muted] mt-0.5">
            Roda a planilha de estratégias no motor real — com sentinela,
            variações e o placar de cada uma.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">

          {/* ESQUERDA */}
          <div className="lg:col-span-2 space-y-4">

            {/* 1. ESTRATÉGIAS */}
            <section className="rounded-lg p-4" style={cardStyle}>
              <SecaoTitulo icon={FileSpreadsheet}>1. Estratégias</SecaoTitulo>
              <p className="text-[11px] text-[--mike-fg-muted] mb-3 -mt-1">
                A planilha na raiz do servidor (formato estrategias.xlsx).
                A sentinela entra sozinha; <b>variar=1</b> gera as variações.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Campo label="Planilha de estratégias">
                  <Select value={planilha} onChange={setPlanilha} options={[
                    { value: '', label: 'Escolha a planilha…' },
                    ...arquivos.planilhas.map((p) => ({
                      value: p.nome, label: `${p.nome} · ${p.mb} MB`,
                    })),
                  ]} />
                </Campo>
                <Campo label="Nome da rodada (opcional)">
                  <Input value={nome} onChange={setNome} placeholder="ex: battle 15d, chips novos" />
                </Campo>
              </div>
              {arquivos.planilhas.length === 0 && !carregando && (
                <div className="mt-2 text-[10px] text-[--mike-fg-muted]">
                  Nenhum .xlsx na raiz do tipmike_api — suba a planilha lá primeiro.
                </div>
              )}
            </section>

            {/* 2. FONTE DOS TICKS */}
            <section className="rounded-lg p-4" style={cardStyle}>
              <SecaoTitulo icon={Database}>2. Fonte dos ticks</SecaoTitulo>

              <div className="flex items-center gap-1 mb-3">
                {[{ v: 'arquivo', l: 'Arquivo do servidor' },
                  { v: 'banco', l: 'Banco (casa + período)' }].map((t) => (
                  <button key={t.v} onClick={() => setFonteTipo(t.v)}
                    className="px-3 py-1.5 rounded-md text-[11px] font-bold transition"
                    style={fonteTipo === t.v
                      ? { backgroundColor: 'rgba(6,182,212,0.15)', color: '#22d3ee', border: '0.5px solid rgba(6,182,212,0.4)' }
                      : { color: 'var(--mike-fg-muted)', border: '0.5px solid rgba(255,255,255,0.07)' }}>
                    {t.l}
                  </button>
                ))}
              </div>

              {fonteTipo === 'arquivo' ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <Campo label="Parquet de ticks"
                           hint="A base é preparada 1x e reaproveitada por hash — repetir a rodada não paga o preparo de novo.">
                      <Select value={fonteArquivo} onChange={setFonteArquivo} options={[
                        { value: '', label: 'Escolha o parquet…' },
                        ...arquivos.parquets.map((p) => ({
                          value: p.nome, label: `${p.nome} · ${p.mb} MB`,
                        })),
                      ]} />
                    </Campo>
                  </div>
                  <Campo label="Últimos N dias" hint="vazio = o arquivo inteiro">
                    <Input type="number" min="1" value={dias} onChange={setDias} placeholder="tudo" />
                  </Campo>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Campo label="Casa">
                    <Input value={casa} onChange={setCasa} placeholder="ex: superbet" />
                  </Campo>
                  <Campo label="Data início">
                    <Input type="date" value={dataInicio} onChange={setDataInicio} />
                  </Campo>
                  <Campo label="Data fim">
                    <Input type="date" value={dataFim} onChange={setDataFim} />
                  </Campo>
                </div>
              )}

              <div className="mt-3">
                <Grupo icon={Settings2} cor="#fbbf24" titulo="Opções"
                       desc="A trava de zerados para a rodada quando estratégias seguidas dão 0 aposta — zerado é config×arquivo (faixa que não existe), não defeito da base.">
                  <div className="grid grid-cols-2 gap-3">
                    <Campo label="Trava de zerados" hint="vazio = 3 seguidas · 0 desliga">
                      <Input type="number" min="0" value={maxZerados} onChange={setMaxZerados} placeholder="3" />
                    </Campo>
                    <Campo label="Timeout por item (min)" hint="vazio = 45">
                      <Input type="number" min="1" value={timeoutMin} onChange={setTimeoutMin} placeholder="45" />
                    </Campo>
                  </div>
                </Grupo>
              </div>

              <button
                onClick={handleRodar}
                disabled={!planilha || criando}
                className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-bold transition disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: (!planilha || criando) ? 'rgba(16,185,129,0.2)' : '#10b981',
                         color: (!planilha || criando) ? '#6b7691' : '#0b0f1a',
                         boxShadow: (!planilha || criando) ? 'none' : '0 4px 12px rgba(16,185,129,0.3)' }}
              >
                {criando ? <><RefreshCw className="w-4 h-4 mike-spin" /> Criando...</>
                         : <><Play className="w-4 h-4" /> Rodar esteira</>}
              </button>
              <div className="text-[9px] text-[--mike-fg-muted] mt-1.5 text-center">
                Roda na fila própria (2 slots, piso de RAM) — pode fechar a página.
                A retomada pula o que já concluiu.
              </div>
            </section>

            {/* LISTA */}
            <section className="rounded-lg p-4" style={cardStyle}>
              <SecaoTitulo icon={Layers}>Rodadas</SecaoTitulo>
              <p className="text-[11px] text-[--mike-fg-muted] mb-3 -mt-1">
                {ativos > 0
                  ? `${ativos} em andamento — a lista se atualiza sozinha.`
                  : 'Clique numa rodada para ver o placar ao lado.'}
              </p>

              {carregando && (
                <div className="flex items-center justify-center py-8 gap-2 text-[--mike-fg-muted] text-xs">
                  <RefreshCw className="w-4 h-4 mike-spin" /> Carregando...
                </div>
              )}

              {!carregando && jobs.length === 0 && (
                <div className="text-center py-8 text-[--mike-fg-muted] text-xs">
                  Nenhuma rodada ainda. Escolha a planilha e a fonte acima.
                </div>
              )}

              <div className="space-y-1.5">
                {jobs.map((j) => {
                  const s = STATUS[j.status] || STATUS.pendente;
                  const on = selecionado === j.id;
                  const tot = j.itens_total_real || j.total_itens || 0;
                  const ok = j.itens_concluidos_real ?? j.itens_prontos ?? 0;
                  const pct = tot > 0 ? Math.round((ok / tot) * 100) : 0;
                  return (
                    <button key={j.id} onClick={() => selecionar(j.id)}
                      className="w-full text-left rounded-md px-3 py-2.5 transition"
                      style={on
                        ? { backgroundColor: 'rgba(6,182,212,0.10)', border: '0.5px solid rgba(6,182,212,0.4)' }
                        : { backgroundColor: 'rgba(13,17,27,0.5)', border: '0.5px solid rgba(60,85,130,0.28)' }}>
                      <div className="flex items-center gap-2.5">
                        <span className="text-[11px] font-black font-mono flex-shrink-0 w-7"
                              style={{ color: s.cor }}>#{j.id}</span>
                        <span className="text-[12px] font-bold text-[--mike-fg] flex-1 truncate">{j.nome}</span>
                        {j.suspeita && (
                          <span title="o H2H mudou durante a rodada — números não comparáveis com re-run"
                                className="text-[9px] font-black px-1.5 py-0.5 rounded flex-shrink-0"
                                style={{ color: '#fbbf24', backgroundColor: 'rgba(251,191,36,0.12)',
                                         border: '0.5px solid rgba(251,191,36,0.4)' }}>
                            suspeita
                          </span>
                        )}
                        {tot > 0 && (
                          <span className="text-[10px] font-mono text-[--mike-fg-muted] hidden sm:inline">
                            {ok}/{tot}
                          </span>
                        )}
                        <Selo status={j.status} />
                        <span className="text-[10px] text-[--mike-fg-muted] w-14 text-right flex-shrink-0">
                          {tempoRelativo(j.criado_em)}
                        </span>
                      </div>
                      {ATIVO.includes(j.status) && (
                        <div className="mt-2 pl-[38px]">
                          <div className="h-1.5 rounded-full overflow-hidden"
                               style={{ backgroundColor: 'rgba(60,85,130,0.25)' }}>
                            <div className="h-full transition-all duration-500"
                                 style={{ width: `${Math.max(2, pct)}%`, backgroundColor: '#10b981' }} />
                          </div>
                          <div className="flex items-center justify-between gap-2 mt-1">
                            <span className="text-[10px] text-[--mike-fg-muted] font-mono truncate">
                              {j.progresso_msg || 'na fila...'}
                            </span>
                            <span className="text-[10px] font-mono text-emerald-400 flex-shrink-0">
                              {ok}/{tot || '?'}
                            </span>
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          </div>

          {/* DIREITA: placar (sticky) */}
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-16 space-y-4">

              {erro && (
                <div className="rounded-lg p-3 flex items-start gap-2"
                     style={{ backgroundColor: 'rgba(244,63,94,0.08)', border: '0.5px solid rgba(244,63,94,0.35)' }}>
                  <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                  <span className="text-xs text-rose-300 flex-1">{erro}</span>
                  <button onClick={() => setErro(null)} className="text-rose-400/60 hover:text-rose-300">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {aviso && (
                <div className="rounded-lg p-3 flex items-start gap-2"
                     style={{ backgroundColor: 'rgba(16,185,129,0.08)', border: '0.5px solid rgba(16,185,129,0.3)' }}>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span className="text-xs text-emerald-300 flex-1">{aviso}</span>
                  <button onClick={() => setAviso(null)} className="text-emerald-400/60 hover:text-emerald-300">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <section className="rounded-lg p-4" style={cardStyle}>
                <SecaoTitulo icon={Trophy}>Placar</SecaoTitulo>

                {!d && (
                  <div className="text-center py-10 text-[--mike-fg-muted] text-xs">
                    Escolha uma rodada na lista pra ver o placar aqui.
                  </div>
                )}

                {d && (
                  <>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[12px] font-black font-mono text-[--mike-fg]">#{d.id}</span>
                      <span className="text-[12px] font-bold text-[--mike-fg] flex-1 truncate">{d.nome}</span>
                      <Selo status={d.status} />
                    </div>

                    {d.status === 'erro' && d.erro && (
                      <div className="mb-3 rounded-md p-2.5 flex items-start gap-2"
                           style={{ backgroundColor: 'rgba(244,63,94,0.08)', border: '0.5px solid rgba(244,63,94,0.3)' }}>
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0 mt-0.5" />
                        <span className="text-[11px] text-rose-300">{d.erro}</span>
                      </div>
                    )}

                    {ATIVO.includes(d.status) && d.progresso_msg && (
                      <div className="mb-3 text-[11px] font-mono text-[--mike-fg-muted]">
                        {d.progresso_msg}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <StatCard icon={Hash} label="Itens"
                                valor={`${d.itens_concluidos_real ?? 0}/${d.itens_total_real ?? 0}`}
                                cor="#0891b2" />
                      <StatCard icon={Clock} label="Duração"
                                valor={duracaoEntre(d.iniciado_em, d.finalizado_em) || '–'} />
                    </div>

                    {/* sentinela + suspeita */}
                    <div className="space-y-2 mb-3">
                      {d.sentinela_ok != null && (
                        <div className="rounded-md p-2.5 flex items-start gap-2"
                             style={d.sentinela_ok
                               ? { backgroundColor: 'rgba(16,185,129,0.06)', border: '0.5px solid rgba(16,185,129,0.25)' }
                               : { backgroundColor: 'rgba(244,63,94,0.08)', border: '0.5px solid rgba(244,63,94,0.3)' }}>
                          <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0 mt-0.5"
                                       style={{ color: d.sentinela_ok ? '#10b981' : '#f43f5e' }} />
                          <span className="text-[11px] text-[--mike-fg-soft]">
                            <b>Sentinela</b>{' '}
                            {d.sentinela_ok ? 'passou' : 'reprovou'}
                            {d.baseline && d.baseline.ROI != null && (
                              <> · baseline do mercado {fmt(d.baseline.apostas)} ap,
                                ROI {fmt1(d.baseline.ROI)}%</>
                            )}
                          </span>
                        </div>
                      )}
                      {d.suspeita && (
                        <div className="rounded-md p-2.5 flex items-start gap-2"
                             style={{ backgroundColor: 'rgba(251,191,36,0.08)', border: '0.5px solid rgba(251,191,36,0.3)' }}>
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                          <span className="text-[11px] text-amber-300">
                            <b>Suspeita</b> · {d.suspeita_motivo || 'o H2H mudou durante a rodada'}
                          </span>
                        </div>
                      )}
                      {alertas.map((a, i) => (
                        <div key={i} className="rounded-md p-2 flex items-start gap-2"
                             style={{ backgroundColor: 'rgba(251,191,36,0.05)', border: '0.5px solid rgba(251,191,36,0.2)' }}>
                          <AlertTriangle className="w-3 h-3 text-amber-400/80 flex-shrink-0 mt-0.5" />
                          <span className="text-[10px] text-[--mike-fg-soft]">{a}</span>
                        </div>
                      ))}
                    </div>

                    {/* O PLACAR — G–R sempre visível */}
                    <Placar itens={its} />
                    <div className="text-[9px] text-[--mike-fg-muted] mt-1.5">
                      Ordenado por ROI; sentinela e controle no topo, zeradas
                      apagadas no fim. Passe o mouse pra ver o roi_3d.
                    </div>

                    <div className="mt-3 space-y-2">
                      {ATIVO.includes(d.status) && (
                        <button onClick={() => handleAcao(d.id, 'cancelar')}
                          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-semibold transition"
                          style={{ border: '0.5px solid rgba(239,68,68,0.4)', color: '#fca5a5' }}>
                          <X className="w-3.5 h-3.5" /> Cancelar rodada
                        </button>
                      )}
                      {podeRetomar && (
                        <button onClick={() => handleAcao(d.id, 'retomar')}
                          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-[12px] font-bold transition"
                          style={{ backgroundColor: '#fbbf24', color: '#0b0f1a' }}>
                          <RotateCcw className="w-3.5 h-3.5" /> Retomar
                          {(d.itens_erro || 0) > 0 && ` (${d.itens_erro} em erro)`}
                        </button>
                      )}
                      {d.tem_planilha && (
                        <button onClick={() => handleDownload(d.id)}
                          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-[12px] font-bold mike-border-thin text-[--mike-accent] hover:bg-[--mike-accent]/10 transition">
                          <Download className="w-3.5 h-3.5" /> Baixar placar (.xlsx)
                        </button>
                      )}
                      {FINAL.includes(d.status) && (
                        <button onClick={() => handleExcluir(d.id)}
                          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-[11px] font-semibold mike-border-thin text-[--mike-fg-muted] hover:text-rose-300 transition">
                          <Trash2 className="w-3 h-3" /> Excluir rodada
                        </button>
                      )}
                    </div>
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
