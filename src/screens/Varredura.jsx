// ============================================================
// Varredura.jsx — o garimpo como tela do painel
//
// VISUAL: copiado do BacktestAvulso.jsx, valor por valor — mesmos themeVars,
// mesmo cardStyle, mesmo Grupo aninhado, mesma SecaoTitulo (barra cyan-500 +
// icone cyan-400), mesmos Campo/Input/Select com .mike-border-thin e fundo
// TRANSPARENTE, mesmo grid 3 colunas com o Resultado sticky a direita.
// Duas telas que fazem coisas parecidas devem se parecer.
//
// ATENCAO: as variaveis --mike-* NAO sao globais — cada tela declara o
// themeVars no wrapper. Sem isso ate o MikeHeader renderiza sem cor (aba
// ativa sem destaque, logo sem gradiente). NAO REMOVER.
//
// A API e' so' despachante: cria o job e responde. Quem roda e' o servico
// TipMikeVarredura, em processo separado e prioridade baixa.
//
// 🔌 BACKEND:
//   GET  /varredura/origens              backtests elegiveis
//   POST /varredura/jobs                 cria e enfileira
//   GET  /varredura/jobs                 lista
//   GET  /varredura/jobs/:id             detalhe + contrato + resumo
//   POST /varredura/jobs/:id/confirmar   libera job parado em 'planejado'
//   POST /varredura/jobs/:id/cancelar
//   GET  /varredura/jobs/:id/download?tipo=xlsx|tudo|holdout
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Home, ChevronRight, Radar, Database, Filter, Layers, Trophy, Play,
  Download, X, RefreshCw, AlertCircle, AlertTriangle, CheckCircle2,
  Clock, Hash, Target, Percent,
} from 'lucide-react';
import MikeHeader from '../shared/MikeHeader.jsx';
import { api } from '../lib/api.js';
import { BASE_URL, getAccessToken } from '../lib/auth.js';

// ============================================================
// CONSTANTES
// ============================================================

const MODOS = [
  { value: 'grosso',   label: 'Grosso',   desc: 'sonda, minutos' },
  { value: 'completo', label: 'Completo', desc: 'o do dia a dia' },
  { value: 'total',    label: 'Total',    desc: 'exaustivo, horas' },
];

const STATUS = {
  pendente:   { rotulo: 'Na fila',    cor: '#6b7691' },
  planejando: { rotulo: 'Preparando', cor: '#0891b2', girando: true },
  planejado:  { rotulo: 'Aguardando', cor: '#fbbf24' },
  rodando:    { rotulo: 'Garimpando', cor: '#22d3ee', girando: true },
  concluido:  { rotulo: 'Pronto',     cor: '#10b981' },
  erro:       { rotulo: 'Erro',       cor: '#f43f5e' },
  cancelado:  { rotulo: 'Cancelado',  cor: '#6b7691' },
};
const ATIVO = ['pendente', 'planejando', 'rodando'];

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

const duracao = (seg) => {
  if (!seg) return null;
  const m = Math.floor(seg / 60);
  return m >= 1 ? `${m}min ${seg % 60}s` : `${seg}s`;
};

async function baixarArquivo(jobId, tipo) {
  const res = await fetch(`${BASE_URL}/varredura/jobs/${jobId}/download?tipo=${tipo}`,
    { headers: { Authorization: `Bearer ${getAccessToken()}` } });
  if (!res.ok) {
    const j = await res.json().catch(() => null);
    throw new Error((j && j.detail) || `HTTP ${res.status}`);
  }
  let nome = `varredura_${jobId}_${tipo}`;
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

// Grupo visual: caixa recuada, barra colorida, titulo + descricao.
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

function SubLabel({ children }) {
  return (
    <div className="text-[10px] uppercase tracking-wide text-[--mike-fg-soft] font-semibold mb-1.5">
      {children}
    </div>
  );
}

function DivFina() {
  return <div className="h-px my-3.5" style={{ backgroundColor: 'rgba(60,85,130,0.18)' }} />;
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

function Linha({ k, v }) {
  if (v === null || v === undefined || v === '') return null;
  return (
    <div className="min-w-0">
      <div className="text-[9px] uppercase tracking-wider text-[--mike-fg-muted] font-bold">{k}</div>
      <div className="text-[11px] text-[--mike-fg-soft] break-words">{String(v)}</div>
    </div>
  );
}

// ============================================================
// TELA
// ============================================================

export default function Varredura({ onNavegar } = {}) {
  const [origens, setOrigens] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [selecionado, setSelecionado] = useState(null);
  const [detalhe, setDetalhe] = useState({});
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [criando, setCriando] = useState(false);

  const [origem, setOrigem] = useState('');
  const [modo, setModo] = useState('completo');
  const [minApostas, setMinApostas] = useState('250');
  const [guardar, setGuardar] = useState('8000');
  const [nlmax, setNlmax] = useState('');
  const [janelas, setJanelas] = useState('');
  const [dataCorte, setDataCorte] = useState('');

  const pollRef = useRef(null);
  const montadoRef = useRef(true);

  const origemSel = useMemo(
    () => origens.find((o) => String(o.job_id) === String(origem)), [origens, origem]);
  const ativos = useMemo(
    () => jobs.filter((j) => ATIVO.includes(j.status)).length, [jobs]);
  const d = selecionado ? detalhe[selecionado] : null;
  const c = (d && d.contrato) || {};
  const res = (d && d.resumo) || {};
  const gate = res.gate || {};

  useEffect(() => {
    montadoRef.current = true;
    return () => {
      montadoRef.current = false;
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, []);

  const carregarJobs = useCallback(async () => {
    try {
      const l = await api.get('/varredura/jobs', { limite: 30 });
      if (montadoRef.current) setJobs(l || []);
      return l || [];
    } catch (e) {
      if (montadoRef.current) setErro(e?.message || 'Falha ao listar varreduras.');
      return [];
    }
  }, []);

  const carregarDetalhe = useCallback(async (id, silencioso = false) => {
    try {
      const r = await api.get(`/varredura/jobs/${id}`);
      if (montadoRef.current) setDetalhe((p) => ({ ...p, [id]: r }));
    } catch (e) {
      if (!silencioso && montadoRef.current) setErro(e?.message || 'Falha ao abrir a varredura.');
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const o = await api.get('/varredura/origens', { limite: 80 });
        if (montadoRef.current) setOrigens(o || []);
      } catch (e) {
        if (montadoRef.current) setErro(e?.message || 'Falha ao listar as origens.');
      }
      const l = await carregarJobs();
      if (montadoRef.current && l.length) {
        setSelecionado(l[0].id);
        carregarDetalhe(l[0].id, true);
      }
      if (montadoRef.current) setCarregando(false);
    })();
  }, [carregarJobs, carregarDetalhe]);

  // polling condicional: so' enquanto houver job ativo — para sozinho depois
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

  const handleGarimpar = useCallback(async () => {
    if (!origem) { setErro('Escolha o backtest de origem.'); return; }
    setCriando(true); setErro(null); setAviso(null);
    try {
      const r = await api.post('/varredura/jobs', {
        job_backtest_id: Number(origem),
        modo,
        min_apostas: numOuNull(minApostas),
        guardar: numOuNull(guardar),
        nlmax: numOuNull(nlmax),
        janelas: janelas.trim() || null,
        data_corte: dataCorte || null,
      });
      if (!montadoRef.current) return;
      setAviso(r.na_frente > 0
        ? `Varredura #${r.id} criada — ${r.na_frente} na frente na fila.`
        : `Varredura #${r.id} criada e entrando na fila.`);
      const l = await carregarJobs();
      if (l.length) { setSelecionado(l[0].id); carregarDetalhe(l[0].id, true); }
    } catch (e) {
      if (montadoRef.current) setErro(e?.message || 'Falha ao criar a varredura.');
    } finally {
      if (montadoRef.current) setCriando(false);
    }
  }, [origem, modo, minApostas, guardar, nlmax, janelas, dataCorte,
      carregarJobs, carregarDetalhe]);

  const handleAcao = useCallback(async (id, qual) => {
    setErro(null);
    try {
      await api.post(`/varredura/jobs/${id}/${qual}`, {});
      await carregarJobs();
      carregarDetalhe(id, true);
    } catch (e) { setErro(e?.message || 'Falha na ação.'); }
  }, [carregarJobs, carregarDetalhe]);

  const handleDownload = useCallback(async (id, tipo) => {
    setErro(null);
    try { await baixarArquivo(id, tipo); }
    catch (e) { setErro(e?.message || 'Falha ao baixar.'); }
  }, []);

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

      <MikeHeader telaAtiva="varredura" onNavegar={onNavegar} />

      <main className="max-w-screen-xl mx-auto px-4 lg:px-8 py-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-[--mike-fg-muted] mb-4">
          <button onClick={() => onNavegar?.('today')} className="hover:text-[--mike-fg]">
            <Home className="w-3 h-3" />
          </button>
          <ChevronRight className="w-3 h-3" />
          <span className="text-[--mike-fg] font-semibold flex items-center gap-1">
            <Radar className="w-3 h-3" />
            Varredura
          </span>
        </div>

        {/* Titulo */}
        <div className="mb-5">
          <h1 className="text-xl font-black text-[--mike-fg] flex items-center gap-2">
            <Radar className="w-5 h-5 text-cyan-400" />
            Varredura
          </h1>
          <p className="text-[11px] text-[--mike-fg-muted] mt-0.5">
            Combina os filtros do mínimo ao máximo em cima de um backtest já rodado —
            com holdout e carimbo.
          </p>
        </div>

        {/* GRID: coluna esquerda (config + lista) + direita (resultado) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">

          {/* ESQUERDA */}
          <div className="lg:col-span-2 space-y-4">

            {/* 1. ORIGEM */}
            <section className="rounded-lg p-4" style={cardStyle}>
              <SecaoTitulo icon={Database}>1. Origem</SecaoTitulo>
              <p className="text-[11px] text-[--mike-fg-muted] mb-3 -mt-1">
                O garimpo lê as apostas de um backtest já concluído — nada de upload.
              </p>

              <Campo label="Backtest de origem"
                     hint="Prefira um escancarado: job já filtrado só deixa procurar dentro da estratégia dele.">
                <Select value={origem} onChange={setOrigem} options={[
                  { value: '', label: 'Escolha o job de origem…' },
                  ...origens.map((o) => ({
                    value: String(o.job_id),
                    label: `#${o.job_id} · ${o.mercado || 'mercado?'} · ${fmt(o.apostas)} apostas${o.escancarado ? ' · escancarado' : ' · filtrado'}`,
                  })),
                ]} />
              </Campo>

              {origens.length === 0 && !carregando && (
                <div className="mt-2 text-[10px] text-[--mike-fg-muted]">
                  Nenhum backtest elegível — precisa estar concluído e ter 500+ apostas.
                </div>
              )}

              {origemSel && !origemSel.escancarado && (
                <div className="mt-2 rounded-md p-2.5 flex items-start gap-2 text-[11px]"
                     style={{ backgroundColor: 'rgba(251,191,36,0.08)', border: '0.5px solid rgba(251,191,36,0.35)' }}>
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <span className="text-amber-300">
                    Esse backtest já tem filtro. A busca vai procurar <b>dentro</b> da
                    estratégia dele e nunca fora — para garimpar de verdade, use um job
                    escancarado (sem chip, sem linha, sem teto).
                  </span>
                </div>
              )}
            </section>

            {/* 2. ESCOPO */}
            <section className="rounded-lg p-4" style={cardStyle}>
              <SecaoTitulo icon={Filter}>2. Escopo da busca</SecaoTitulo>
              <p className="text-[11px] text-[--mike-fg-muted] mb-3 -mt-1">
                Quanto do espaço de combinações vale a pena varrer — e quanto tempo isso custa.
              </p>

              <div className="space-y-3">
                <Grupo icon={Target} cor="#22d3ee" titulo="Profundidade"
                       desc="Grosso é sonda; completo é o do dia a dia; total varre tudo — se a estimativa for alta, o job para e pede confirmação.">
                  <div className="flex items-center gap-1">
                    {MODOS.map((m) => (
                      <button key={m.value} onClick={() => setModo(m.value)}
                        className="px-3 py-1.5 rounded-md text-[11px] font-bold transition"
                        style={modo === m.value
                          ? { backgroundColor: 'rgba(6,182,212,0.15)', color: '#22d3ee', border: '0.5px solid rgba(6,182,212,0.4)' }
                          : { color: 'var(--mike-fg-muted)', border: '0.5px solid rgba(255,255,255,0.07)' }}>
                        {m.label}
                      </button>
                    ))}
                    <span className="text-[10px] text-[--mike-fg-muted] ml-2">
                      {MODOS.find((m) => m.value === modo)?.desc}
                    </span>
                  </div>

                  <DivFina />
                  <SubLabel>Poda (opcional)</SubLabel>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <Campo label="Mín. apostas" hint="config com pouca aposta não opera">
                      <Input type="number" min="1" value={minApostas} onChange={setMinApostas} placeholder="250" />
                    </Campo>
                    <Campo label="Guardar" hint="quantas por ranking">
                      <Input type="number" min="100" value={guardar} onChange={setGuardar} placeholder="8000" />
                    </Campo>
                    <Campo label="Tetos de linha" hint="em total de pontos, é o teto que decide">
                      <Input type="number" min="1" value={nlmax} onChange={setNlmax} placeholder="ex: 14" />
                    </Campo>
                  </div>

                  <DivFina />
                  <SubLabel>Janelas de chip (opcional)</SubLabel>
                  <Campo label="Janelas" hint="vazio = todas do arquivo. O passe de duas janelas cresce ao quadrado — menos janelas deixa bem mais rápido.">
                    <Input value={janelas} onChange={setJanelas} placeholder="ult.10,ult.30,todas" />
                  </Campo>
                </Grupo>

                <Grupo icon={Percent} cor="#fbbf24" titulo="Holdout (pré-compromisso)"
                       desc="A busca só enxerga o treino; o resto é medido no fim, nos dias que ela nunca viu.">
                  <Campo label="Corte do holdout"
                         hint="Vazio = separa 30% do fim sozinho. A busca não enxerga nada a partir desta data.">
                    <Input type="date" value={dataCorte} onChange={setDataCorte} />
                  </Campo>
                </Grupo>
              </div>

              <button
                onClick={handleGarimpar}
                disabled={!origem || criando}
                className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-bold transition disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: (!origem || criando) ? 'rgba(16,185,129,0.2)' : '#10b981',
                         color: (!origem || criando) ? '#6b7691' : '#0b0f1a',
                         boxShadow: (!origem || criando) ? 'none' : '0 4px 12px rgba(16,185,129,0.3)' }}
              >
                {criando ? <><RefreshCw className="w-4 h-4 mike-spin" /> Criando...</>
                         : <><Play className="w-4 h-4" /> Garimpar</>}
              </button>
              <div className="text-[9px] text-[--mike-fg-muted] mt-1.5 text-center">
                Roda em segundo plano, fora da API — pode fechar a página.
              </div>
            </section>

            {/* LISTA */}
            <section className="rounded-lg p-4" style={cardStyle}>
              <SecaoTitulo icon={Layers}>Varreduras</SecaoTitulo>
              <p className="text-[11px] text-[--mike-fg-muted] mb-3 -mt-1">
                {ativos > 0
                  ? `${ativos} em andamento — a lista se atualiza sozinha.`
                  : 'Clique numa varredura para ver o resultado ao lado.'}
              </p>

              {carregando && (
                <div className="flex items-center justify-center py-8 gap-2 text-[--mike-fg-muted] text-xs">
                  <RefreshCw className="w-4 h-4 mike-spin" /> Carregando...
                </div>
              )}

              {!carregando && jobs.length === 0 && (
                <div className="text-center py-8 text-[--mike-fg-muted] text-xs">
                  Nenhuma varredura ainda. Escolha a origem acima e clique em Garimpar.
                </div>
              )}

              <div className="space-y-1.5">
                {jobs.map((j) => {
                  const s = STATUS[j.status] || STATUS.pendente;
                  const on = selecionado === j.id;
                  const rj = (detalhe[j.id] || {}).resumo || {};
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
                        {j.status === 'concluido' && rj.linhas_saida && (
                          <span className="text-[10px] font-mono text-[--mike-fg-muted] hidden sm:inline">
                            {fmt(rj.linhas_saida)} configs
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
                                 style={{ width: `${Math.max(2, j.progresso || 0)}%`, backgroundColor: '#10b981' }} />
                          </div>
                          <div className="flex items-center justify-between gap-2 mt-1">
                            <span className="text-[10px] text-[--mike-fg-muted] font-mono truncate">
                              {j.progresso_msg || 'iniciando...'}
                            </span>
                            <span className="text-[10px] font-mono text-emerald-400 flex-shrink-0">
                              {j.progresso}%
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

          {/* DIREITA: resultado (sticky) */}
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
                <SecaoTitulo icon={Trophy}>Resultado</SecaoTitulo>

                {!d && (
                  <div className="text-center py-10 text-[--mike-fg-muted] text-xs">
                    Escolha uma varredura na lista pra ver o resultado aqui.
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

                    {d.status === 'planejado' && (
                      <div className="mb-3 rounded-md p-2.5 flex items-start gap-2"
                           style={{ backgroundColor: 'rgba(251,191,36,0.08)', border: '0.5px solid rgba(251,191,36,0.3)' }}>
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                        <span className="text-[11px] text-amber-300">
                          {d.progresso_msg || 'Estimativa alta — confirme para rodar.'}
                        </span>
                      </div>
                    )}

                    {d.status === 'concluido' && (
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <StatCard icon={Hash} label="Configs" valor={fmt(res.linhas_saida) ?? '-'} cor="#0891b2" />
                        <StatCard icon={Clock} label="Duração" valor={duracao(res.segundos) || '-'} cor="#eaeef7" />
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
                      <Linha k="origem" v={`#${d.job_backtest_id}`} />
                      <Linha k="período" v={c.periodo} />
                      <Linha k="treino até" v={c.treino_ate} />
                      <Linha k="holdout" v={c.holdout} />
                      <Linha k="apostas" v={fmt(c.apostas)} />
                      <Linha k="jogos" v={fmt(c.jogos)} />
                      <Linha k="combinações" v={fmt(c.total_estimado)} />
                      <Linha k="baseline" v={c.baseline} />
                    </div>

                    {(c.janelas || c.complementares) && (
                      <div className="mt-2.5 space-y-2.5">
                        <Linha k="janelas" v={c.janelas} />
                        <Linha k="eixos" v={c.complementares} />
                      </div>
                    )}

                    {gate.t1 && (
                      <div className="mt-3 rounded-md p-2.5 flex items-start gap-2"
                           style={gate.passou === false
                             ? { backgroundColor: 'rgba(244,63,94,0.08)', border: '0.5px solid rgba(244,63,94,0.3)' }
                             : { backgroundColor: 'rgba(16,185,129,0.06)', border: '0.5px solid rgba(16,185,129,0.25)' }}>
                        {gate.passou === false
                          ? <AlertTriangle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0 mt-0.5" />
                          : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />}
                        <span className={`text-[11px] ${gate.passou === false ? 'text-rose-300' : 'text-[--mike-fg-soft]'}`}>
                          <b>Carimbo</b> · liquidação {gate.t1} · leitura {gate.t2_pct}%
                          {gate.passou === false && ' — reprovado, os números não são confiáveis'}
                        </span>
                      </div>
                    )}

                    <div className="mt-3 space-y-2">
                      {d.status === 'planejado' && (
                        <button onClick={() => handleAcao(d.id, 'confirmar')}
                          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-[12px] font-bold transition"
                          style={{ backgroundColor: '#fbbf24', color: '#0b0f1a' }}>
                          <Play className="w-3.5 h-3.5" /> Confirmar e rodar
                        </button>
                      )}
                      {ATIVO.includes(d.status) && (
                        <button onClick={() => handleAcao(d.id, 'cancelar')}
                          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-semibold transition"
                          style={{ border: '0.5px solid rgba(239,68,68,0.4)', color: '#fca5a5' }}>
                          <X className="w-3.5 h-3.5" /> Cancelar varredura
                        </button>
                      )}
                      {d.tem_saida && (
                        <>
                          <button onClick={() => handleDownload(d.id, 'xlsx')}
                            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-[12px] font-bold mike-border-thin text-[--mike-accent] hover:bg-[--mike-accent]/10 transition">
                            <Download className="w-3.5 h-3.5" /> Baixar rankings (.xlsx)
                          </button>
                          <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => handleDownload(d.id, 'tudo')}
                              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-[11px] font-bold mike-border-thin text-[--mike-fg-soft] hover:text-[--mike-fg] transition">
                              <Download className="w-3 h-3" /> Tudo (.csv)
                            </button>
                            <button onClick={() => handleDownload(d.id, 'holdout')}
                              disabled={!d.tem_holdout}
                              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-[11px] font-bold mike-border-thin text-[--mike-fg-soft] hover:text-[--mike-fg] transition disabled:opacity-40">
                              <Download className="w-3 h-3" /> Holdout
                            </button>
                          </div>
                          <div className="text-[9px] text-[--mike-fg-muted] text-center">
                            O <b>tudo</b> é a fonte da verdade; o <b>holdout</b> mede as mesmas
                            configs nos dias que a busca não viu.
                          </div>
                        </>
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