// ============================================================
// Varredura.jsx — o garimpo como tela do painel
//
// LAYOUT: espelha o BacktestAvulso de proposito — breadcrumb, titulo com
// icone inline, secoes NUMERADAS com a barrinha de destaque, e a coluna da
// direita com o painel "Resultado". Duas telas que fazem coisas parecidas
// devem se parecer; o usuario nao deveria reaprender a navegar.
//
// A API e' so' despachante: cria o job e responde. Quem roda e' o servico
// TipMikeVarredura, em processo separado e prioridade baixa — a tela nunca
// "trava esperando", ela acompanha.
//
// DECISOES DE UX:
//  · Selecionar uma varredura na lista joga o detalhe no painel da direita
//    (em vez de acordeao) — mesmo gesto do backtest, e da' pra comparar
//    a lista inteira sem perder o que estava lendo.
//  · Os 5 campos tecnicos ficam em "opcoes avancadas": quem chega precisa
//    escolher duas coisas — origem e modo. O resto tem default bom.
//  · O poll de 4s so' liga quando existe job ativo e desliga sozinho.
//
// Endpoints: /varredura/{origens,jobs,jobs/{id},jobs/{id}/confirmar,
//            jobs/{id}/cancelar,jobs/{id}/download}
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Home, ChevronRight, ChevronDown, Radar, Database, Sliders, Layers,
  Trophy, Play, Download, X, Clock, Loader2, CheckCircle2, AlertTriangle,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { BASE_URL, getAccessToken } from '../lib/auth.js';
import MikeHeader from '../shared/MikeHeader.jsx';

// ------------------------------------------------------------- constantes --
// cores tiradas do tema (accent #10b981 / accent-2 #0891b2 / fg-muted #6b7691)
// mais amber e red so' onde o significado exige
const STATUS = {
  pendente:   { rotulo: 'Na fila',    cor: '#6b7691', Icone: Clock },
  planejando: { rotulo: 'Preparando', cor: '#0891b2', Icone: Loader2, girando: true },
  planejado:  { rotulo: 'Aguardando', cor: '#f59e0b', Icone: AlertTriangle },
  rodando:    { rotulo: 'Garimpando', cor: '#0891b2', Icone: Loader2, girando: true },
  concluido:  { rotulo: 'Pronto',     cor: '#10b981', Icone: CheckCircle2 },
  erro:       { rotulo: 'Erro',       cor: '#ef4444', Icone: AlertTriangle },
  cancelado:  { rotulo: 'Cancelado',  cor: '#6b7691', Icone: X },
};
const ATIVO = ['pendente', 'planejando', 'rodando'];

const MODOS = [
  { id: 'grosso',   titulo: 'Grosso',   desc: 'sonda, minutos' },
  { id: 'completo', titulo: 'Completo', desc: 'o do dia a dia' },
  { id: 'total',    titulo: 'Total',    desc: 'exaustivo, horas' },
];

// --------------------------------------------------------------- helpers ---
const num = (n) => (n === null || n === undefined || n === '' ? null
  : Number(n).toLocaleString('pt-BR'));

function tempoRelativo(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
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

async function baixar(jobId, tipo) {
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

// As variaveis --mike-* NAO sao globais: cada tela as declara no wrapper
// (mesmo objeto do Today/Backtest). Sem isto o proprio MikeHeader renderiza
// sem cor — aba ativa sem destaque, logo sem gradiente. NAO REMOVER.
const TEMA = {
  '--mike-bg': '#0b0f1a', '--mike-bg-2': '#070a13', '--mike-card': '#141a28',
  '--mike-card-2': '#1a2030', '--mike-card-hover': '#1d2434',
  '--mike-border': '#222a3d', '--mike-fg': '#eaeef7', '--mike-fg-soft': '#a8b3c9',
  '--mike-fg-muted': '#6b7691', '--mike-accent': '#10b981',
  '--mike-accent-2': '#0891b2',
};
const ACCENT = '#10b981';        // igual ao --mike-accent, pra interpolar hex

// --------------------------------------------------------------- widgets ---

function Secao({ numero, icone: Ic, titulo, desc, children, aninhada }) {
  return (
    <div className={aninhada
        ? 'rounded-lg p-3.5 bg-[--mike-card-2] border border-[--mike-border]'
        : 'rounded-2xl p-4 bg-[--mike-card] border border-[--mike-border]'}>
      <div className="flex items-center gap-2">
        <span className="w-[3px] h-4 rounded-full shrink-0"
              style={{ backgroundColor: 'var(--mike-accent)' }} />
        {Ic && <Ic className="w-4 h-4 shrink-0" style={{ color: 'var(--mike-accent)' }} />}
        <h2 className={aninhada ? 'text-[13px] font-bold' : 'text-[15px] font-bold'}>
          {numero ? `${numero}. ` : ''}{titulo}
        </h2>
      </div>
      {desc && (
        <p className="text-[11px] text-[--mike-fg-muted] mt-1 mb-3 pl-[13px] leading-relaxed">
          {desc}
        </p>
      )}
      <div className={desc ? '' : 'mt-3'}>{children}</div>
    </div>
  );
}

function Campo({ label, hint, children }) {
  return (
    <div>
      <div className="text-[11px] text-[--mike-fg-soft] mb-1.5">{label}</div>
      {children}
      {hint && (
        <div className="text-[10px] text-[--mike-fg-muted] mt-1 leading-snug">{hint}</div>
      )}
    </div>
  );
}

// mesmo desenho dos inputs do Backtest: fundo card-2, borda do tema, foco no accent
const inputCls =
  'w-full rounded-lg px-3 py-2 text-[13px] bg-[--mike-card-2] text-[--mike-fg] ' +
  'border border-[--mike-border] outline-none transition focus:border-[--mike-accent]';

const subTitulo = 'text-[10px] uppercase tracking-[0.08em] text-[--mike-fg-muted] font-bold';

function Pill({ status }) {
  const s = STATUS[status] || STATUS.pendente;
  const { Icone } = s;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold shrink-0"
          style={{ color: s.cor, backgroundColor: `${s.cor}1f`,
                   border: `0.5px solid ${s.cor}55` }}>
      <Icone className={`w-3 h-3 ${s.girando ? 'animate-spin' : ''}`} />
      {s.rotulo}
    </span>
  );
}

function Botao({ tipo = 'ghost', icone: Ic, children, ...props }) {
  const cores = {
    primario: { backgroundColor: 'var(--mike-accent)', color: 'var(--mike-bg)' },
    alerta:   { backgroundColor: '#f59e0b', color: 'var(--mike-bg)' },
    perigo:   { backgroundColor: 'rgba(239,68,68,.15)', color: '#fca5a5',
                border: '1px solid rgba(239,68,68,.35)' },
    ghost:    { backgroundColor: 'var(--mike-card-2)', color: 'var(--mike-fg-soft)',
                border: '1px solid var(--mike-border)' },
  };
  return (
    <button {...props}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold
                 transition hover:brightness-110 active:scale-95 disabled:opacity-50
                 disabled:cursor-default"
      style={cores[tipo]}>
      {Ic && <Ic className="w-3.5 h-3.5" />}
      {children}
    </button>
  );
}

function Dado({ k, v }) {
  if (v === null || v === undefined || v === '') return null;
  return (
    <div className="min-w-0">
      <div className="text-[9px] uppercase tracking-wider text-[--mike-fg-muted] mb-0.5">{k}</div>
      <div className="text-[11px] text-[--mike-fg-soft] break-words">{String(v)}</div>
    </div>
  );
}

// ============================================================ componente ===
export default function Varredura({ onNavegar }) {
  const [origens, setOrigens] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [selecionado, setSelecionado] = useState(null);
  const [detalhe, setDetalhe] = useState({});
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [avancado, setAvancado] = useState(false);
  const [criando, setCriando] = useState(false);
  const [form, setForm] = useState({
    job_backtest_id: '', modo: 'completo', janelas: '',
    min_apostas: 250, guardar: 8000, nlmax: '', data_corte: '',
  });
  const timer = useRef(null);

  const origemSel = useMemo(
    () => origens.find((o) => String(o.job_id) === String(form.job_backtest_id)),
    [origens, form.job_backtest_id]);
  const ativos = useMemo(
    () => jobs.filter((j) => ATIVO.includes(j.status)).length, [jobs]);
  const d = selecionado ? detalhe[selecionado] : null;

  const carregarJobs = useCallback(async () => {
    try {
      const l = await api.get('/varredura/jobs', { limite: 30 });
      setJobs(l || []);
      return l || [];
    } catch (e) { setErro(e.message); return []; }
  }, []);

  const carregarDetalhe = useCallback(async (id, silencioso = false) => {
    try {
      const r = await api.get(`/varredura/jobs/${id}`);
      setDetalhe((prev) => ({ ...prev, [id]: r }));
    } catch (e) { if (!silencioso) setErro(e.message); }
  }, []);

  useEffect(() => {
    (async () => {
      try { setOrigens((await api.get('/varredura/origens', { limite: 80 })) || []); }
      catch (e) { setErro(e.message); }
      const l = await carregarJobs();
      if (l.length) { setSelecionado(l[0].id); carregarDetalhe(l[0].id, true); }
      setCarregando(false);
    })();
  }, [carregarJobs, carregarDetalhe]);

  // poll condicional: liga com job ativo, desliga sozinho quando acaba
  useEffect(() => {
    if (timer.current) { clearInterval(timer.current); timer.current = null; }
    if (ativos > 0) {
      timer.current = setInterval(async () => {
        const l = await carregarJobs();
        if (selecionado && l.some((j) => j.id === selecionado)) {
          carregarDetalhe(selecionado, true);
        }
      }, 4000);
    }
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [ativos, selecionado, carregarJobs, carregarDetalhe]);

  function selecionar(id) {
    setSelecionado(id);
    if (!detalhe[id]) carregarDetalhe(id);
  }

  async function criar() {
    setErro(null); setAviso(null);
    if (!form.job_backtest_id) { setErro('Escolha o backtest de origem.'); return; }
    setCriando(true);
    try {
      const r = await api.post('/varredura/jobs', {
        job_backtest_id: Number(form.job_backtest_id),
        modo: form.modo,
        min_apostas: form.min_apostas ? Number(form.min_apostas) : null,
        guardar: form.guardar ? Number(form.guardar) : null,
        nlmax: form.nlmax ? Number(form.nlmax) : null,
        janelas: form.janelas.trim() || null,
        data_corte: form.data_corte || null,
      });
      setAviso(r.na_frente > 0
        ? `Varredura #${r.id} criada — ${r.na_frente} na frente na fila.`
        : `Varredura #${r.id} criada e entrando na fila.`);
      const l = await carregarJobs();
      if (l.length) { setSelecionado(l[0].id); carregarDetalhe(l[0].id, true); }
    } catch (e) { setErro(e.message); }
    finally { setCriando(false); }
  }

  async function acao(id, qual) {
    setErro(null);
    try {
      await api.post(`/varredura/jobs/${id}/${qual}`, {});
      await carregarJobs();
      carregarDetalhe(id, true);
    } catch (e) { setErro(e.message); }
  }

  async function download(id, tipo) {
    setErro(null);
    try { await baixar(id, tipo); } catch (e) { setErro(e.message); }
  }

  // ------------------------------------------------------------- render ---
  return (
    <div className="min-h-screen"
         style={{ ...TEMA, backgroundColor: 'var(--mike-bg)', color: 'var(--mike-fg)',
                  fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <MikeHeader telaAtiva="varredura" onNavegar={onNavegar} />

      <div className="max-w-screen-xl mx-auto px-4 lg:px-8 py-5">

        {/* -------------------------------------------------- breadcrumb */}
        <nav className="flex items-center gap-1.5 text-[11px] text-[--mike-fg-muted] mb-3">
          <button onClick={() => onNavegar?.('today')} className="hover:text-[--mike-fg] transition">
            <Home className="w-3.5 h-3.5" />
          </button>
          <ChevronRight className="w-3 h-3 opacity-50" />
          <span className="flex items-center gap-1.5 text-[--mike-fg-soft]">
            <Radar className="w-3.5 h-3.5" /> Varredura
          </span>
        </nav>

        {/* ------------------------------------------------------ titulo */}
        <div className="flex items-center gap-2.5 mb-1">
          <Radar className="w-6 h-6" style={{ color: 'var(--mike-accent)' }} />
          <h1 className="text-[26px] font-black tracking-tight leading-none">Varredura</h1>
        </div>
        <p className="text-[12px] text-[--mike-fg-muted] mb-5">
          Combina os filtros do mínimo ao máximo em cima de um backtest já rodado e
          devolve cada combinação como um bot pronto — com holdout e carimbo.
        </p>

        {/* ------------------------------------------------------ avisos */}
        {erro && (
          <div className="mb-3 flex items-start gap-2 px-3 py-2.5 rounded-lg text-[11px]"
               style={{ backgroundColor: 'rgba(248,113,113,.1)',
                        border: '0.5px solid rgba(248,113,113,.35)', color: '#fca5a5' }}>
            <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" />
            <span className="flex-1">{erro}</span>
            <button onClick={() => setErro(null)} className="opacity-60 hover:opacity-100">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        {aviso && (
          <div className="mb-3 flex items-start gap-2 px-3 py-2.5 rounded-lg text-[11px]"
               style={{ backgroundColor: 'rgba(16,185,129,.1)',
                        border: '0.5px solid rgba(16,185,129,.35)', color: '#6ee7b7' }}>
            <CheckCircle2 className="w-3.5 h-3.5 mt-px shrink-0" />
            <span className="flex-1">{aviso}</span>
            <button onClick={() => setAviso(null)} className="opacity-60 hover:opacity-100">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ============================ duas colunas ==================== */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* ------------------------------------------ coluna esquerda */}
          <div className="lg:col-span-2 space-y-4">

            <Secao numero="1" icone={Database} titulo="Origem"
                   desc="O garimpo lê as apostas de um backtest já concluído — nada de upload.">
              <select className={inputCls} value={form.job_backtest_id}
                      onChange={(e) => setForm({ ...form, job_backtest_id: e.target.value })}>
                <option value="">Escolha o job de origem…</option>
                {origens.map((o) => (
                  <option key={o.job_id} value={o.job_id}>
                    #{o.job_id} · {o.mercado || 'mercado?'} · {num(o.apostas)} apostas
                    {o.escancarado ? ' · escancarado' : ' · filtrado'}
                  </option>
                ))}
              </select>
              {origens.length === 0 && !carregando && (
                <div className="text-[10px] text-[--mike-fg-muted] mt-2">
                  Nenhum backtest elegível — precisa estar concluído e ter 500+ apostas.
                </div>
              )}
              {origemSel && !origemSel.escancarado && (
                <div className="mt-3 flex items-start gap-2 px-3 py-2.5 rounded-lg text-[11px] leading-relaxed"
                     style={{ backgroundColor: 'rgba(251,191,36,.1)',
                              border: '0.5px solid rgba(251,191,36,.35)', color: '#fcd34d' }}>
                  <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" />
                  <span>
                    Esse backtest já tem filtro. A busca vai procurar <b>dentro</b> da
                    estratégia dele e nunca fora — para garimpar de verdade, use um job
                    escancarado (sem chip, sem linha, sem teto).
                  </span>
                </div>
              )}
            </Secao>

            <Secao numero="2" icone={Sliders} titulo="Escopo da busca"
                   desc="Quanto do espaço de combinações vale a pena varrer — e quanto tempo isso custa.">
              <div className={subTitulo + ' mb-2'}>Modo</div>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {MODOS.map((m) => {
                  const on = form.modo === m.id;
                  return (
                    <button key={m.id} onClick={() => setForm({ ...form, modo: m.id })}
                      className="rounded-lg px-3 py-2.5 text-left transition"
                      style={{
                        backgroundColor: on ? 'rgba(16,185,129,.12)' : 'var(--mike-card-2)',
                        border: `1px solid ${on ? ACCENT : 'var(--mike-border)'}`,
                      }}>
                      <div className="text-[12px] font-bold"
                           style={{ color: on ? 'var(--mike-accent)' : 'var(--mike-fg-soft)' }}>
                        {m.titulo}
                      </div>
                      <div className="text-[9px] text-[--mike-fg-muted] leading-tight mt-0.5">
                        {m.desc}
                      </div>
                    </button>
                  );
                })}
              </div>

              <button onClick={() => setAvancado((v) => !v)}
                      className="flex items-center gap-1.5 text-[11px] font-bold text-[--mike-fg-muted]
                                 hover:text-[--mike-fg-soft] transition mb-3">
                <Sliders className="w-3.5 h-3.5" />
                Opções avançadas
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${avancado ? 'rotate-180' : ''}`} />
              </button>

              {avancado && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                  <Campo label="Mín. apostas" hint="config com pouca aposta não opera, e cortar cedo acelera a busca">
                    <input type="number" className={inputCls} value={form.min_apostas}
                           onChange={(e) => setForm({ ...form, min_apostas: e.target.value })} />
                  </Campo>
                  <Campo label="Guardar" hint="quantas configurações por ranking">
                    <input type="number" className={inputCls} value={form.guardar}
                           onChange={(e) => setForm({ ...form, guardar: e.target.value })} />
                  </Campo>
                  <Campo label="Tetos de linha" hint="em total de pontos quem decide é o teto — nesse mercado, 14">
                    <input type="number" className={inputCls} value={form.nlmax} placeholder="ex: 14"
                           onChange={(e) => setForm({ ...form, nlmax: e.target.value })} />
                  </Campo>
                  <Campo label="Janelas" hint="vazio = todas; menos janelas deixa muito mais rápido">
                    <input className={inputCls} value={form.janelas} placeholder="ult.10,ult.30,todas"
                           onChange={(e) => setForm({ ...form, janelas: e.target.value })} />
                  </Campo>
                  <Campo label="Corte do holdout" hint="vazio = separa 30% do fim sozinho">
                    <input type="date" className={inputCls} value={form.data_corte}
                           onChange={(e) => setForm({ ...form, data_corte: e.target.value })} />
                  </Campo>
                </div>
              )}

              <div className="flex items-center justify-between gap-4 pt-3"
                   style={{ borderTop: '1px solid var(--mike-border)' }}>
                <p className="text-[10px] text-[--mike-fg-muted] leading-relaxed flex-1">
                  A busca só enxerga o treino; o resto vira <b>holdout</b> e é medido no fim.
                  No encerramento o resultado passa pelo <b>carimbo</b> — se a liquidação não
                  fechar, o job vai para erro em vez de mostrar número furado.
                </p>
                <Botao tipo="primario" icone={criando ? Loader2 : Play}
                       onClick={criar} disabled={criando}>
                  {criando ? 'Criando…' : 'Garimpar'}
                </Botao>
              </div>
            </Secao>

            <Secao icone={Layers} titulo="Varreduras"
                   desc={ativos > 0 ? `${ativos} em andamento — a lista se atualiza sozinha.`
                                    : 'Clique numa varredura para ver o resultado ao lado.'}>
              {carregando && (
                <div className="space-y-2">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="rounded-lg h-12 animate-pulse"
                         style={{ backgroundColor: 'var(--mike-card-2)' }} />
                  ))}
                </div>
              )}

              {!carregando && jobs.length === 0 && (
                <div className="py-8 text-center">
                  <Radar className="w-7 h-7 mx-auto mb-2 text-[--mike-fg-muted] opacity-40" />
                  <div className="text-[12px] font-bold mb-1">Nenhuma varredura ainda</div>
                  <p className="text-[11px] text-[--mike-fg-muted] max-w-xs mx-auto leading-relaxed">
                    Escolha a origem acima e clique em Garimpar. Ela roda em segundo
                    plano — pode fechar a aba.
                  </p>
                </div>
              )}

              <div className="space-y-1.5">
                {jobs.map((j) => {
                  const s = STATUS[j.status] || STATUS.pendente;
                  const on = selecionado === j.id;
                  const dj = detalhe[j.id];
                  const rj = (dj && dj.resumo) || {};
                  return (
                    <button key={j.id} onClick={() => selecionar(j.id)}
                      className="w-full text-left rounded-lg px-3 py-2.5 transition"
                      style={{
                        backgroundColor: on ? 'rgba(16,185,129,.10)' : 'var(--mike-card-2)',
                        border: `1px solid ${on ? ACCENT : 'var(--mike-border)'}`,
                      }}>
                      <div className="flex items-center gap-2.5">
                        <span className="text-[11px] font-black shrink-0 w-7"
                              style={{ fontFamily: 'JetBrains Mono, monospace', color: s.cor }}>
                          #{j.id}
                        </span>
                        <span className="text-[12px] font-bold flex-1 truncate">{j.nome}</span>
                        {j.status === 'concluido' && rj.linhas_saida && (
                          <span className="text-[10px] text-[--mike-fg-muted] hidden sm:inline"
                                style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                            {num(rj.linhas_saida)} configs
                          </span>
                        )}
                        <Pill status={j.status} />
                        <span className="text-[10px] text-[--mike-fg-muted] w-14 text-right shrink-0">
                          {tempoRelativo(j.criado_em)}
                        </span>
                      </div>
                      {ATIVO.includes(j.status) && (
                        <div className="mt-2 pl-[38px]">
                          <div className="w-full h-1 rounded-full overflow-hidden"
                               style={{ backgroundColor: 'var(--mike-border)' }}>
                            <div className="h-full rounded-full transition-all duration-700"
                                 style={{ width: `${Math.max(3, j.progresso || 0)}%`,
                                          background: `linear-gradient(90deg, ${s.cor}88, ${s.cor})` }} />
                          </div>
                          <div className="text-[10px] text-[--mike-fg-muted] mt-1">
                            {j.progresso_msg || 'iniciando…'}
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </Secao>
          </div>

          {/* ------------------------------------------- coluna direita */}
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-20">
              <Secao icone={Trophy} titulo="Resultado">
                {!d && (
                  <p className="text-[12px] text-[--mike-fg-muted] text-center py-10 leading-relaxed">
                    Escolha uma varredura na lista pra ver o resultado aqui.
                  </p>
                )}

                {d && (
                  <>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[12px] font-black"
                            style={{ fontFamily: 'JetBrains Mono, monospace' }}>#{d.id}</span>
                      <span className="text-[12px] font-bold flex-1 truncate">{d.nome}</span>
                      <Pill status={d.status} />
                    </div>

                    {d.status === 'erro' && d.erro && (
                      <div className="mb-3 px-3 py-2.5 rounded-lg text-[11px] leading-relaxed"
                           style={{ backgroundColor: 'rgba(248,113,113,.1)',
                                    border: '0.5px solid rgba(248,113,113,.35)', color: '#fca5a5' }}>
                        {d.erro}
                      </div>
                    )}

                    {d.status === 'planejado' && (
                      <div className="mb-3 px-3 py-2.5 rounded-lg text-[11px] leading-relaxed"
                           style={{ backgroundColor: 'rgba(251,191,36,.1)',
                                    border: '0.5px solid rgba(251,191,36,.35)', color: '#fcd34d' }}>
                        {d.progresso_msg || 'Estimativa alta — confirme para rodar.'}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 mb-3">
                      <Dado k="origem" v={`#${d.job_backtest_id}`} />
                      <Dado k="configs achadas" v={num((d.resumo || {}).linhas_saida)} />
                      <Dado k="período" v={(d.contrato || {}).periodo} />
                      <Dado k="duração" v={duracao((d.resumo || {}).segundos)} />
                      <Dado k="treino até" v={(d.contrato || {}).treino_ate} />
                      <Dado k="holdout" v={(d.contrato || {}).holdout} />
                      <Dado k="apostas" v={num((d.contrato || {}).apostas)} />
                      <Dado k="jogos" v={num((d.contrato || {}).jogos)} />
                      <Dado k="baseline" v={(d.contrato || {}).baseline} />
                      <Dado k="combinações" v={num((d.contrato || {}).total_estimado)} />
                    </div>

                    <div className="mb-3">
                      <Dado k="janelas" v={(d.contrato || {}).janelas} />
                    </div>
                    <div className="mb-3">
                      <Dado k="eixos" v={(d.contrato || {}).complementares} />
                    </div>

                    {((d.resumo || {}).gate || {}).t1 && (
                      <div className="flex items-start gap-2 mb-3 px-3 py-2 rounded-lg text-[11px] leading-relaxed"
                           style={{ backgroundColor: 'var(--mike-card-2)',
                                    border: '1px solid var(--mike-border)',
                                    color: d.resumo.gate.passou === false ? '#fca5a5' : '#a9b6d0' }}>
                        {d.resumo.gate.passou === false
                          ? <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" />
                          : <CheckCircle2 className="w-3.5 h-3.5 mt-px shrink-0" style={{ color: '#10b981' }} />}
                        <span>
                          <b>Carimbo</b> · liquidação {d.resumo.gate.t1} · leitura {d.resumo.gate.t2_pct}%
                          {d.resumo.gate.passou === false && ' — reprovado, os números não são confiáveis'}
                        </span>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 pt-3"
                         style={{ borderTop: '1px solid var(--mike-border)' }}>
                      {d.status === 'planejado' && (
                        <Botao tipo="alerta" icone={Play} onClick={() => acao(d.id, 'confirmar')}>
                          Confirmar e rodar
                        </Botao>
                      )}
                      {ATIVO.includes(d.status) && (
                        <Botao tipo="perigo" icone={X} onClick={() => acao(d.id, 'cancelar')}>
                          Cancelar
                        </Botao>
                      )}
                      {d.tem_saida && (
                        <>
                          <Botao tipo="primario" icone={Download} onClick={() => download(d.id, 'xlsx')}>
                            Rankings
                          </Botao>
                          <Botao icone={Download} onClick={() => download(d.id, 'tudo')}>
                            Tudo (.csv)
                          </Botao>
                        </>
                      )}
                      {d.tem_holdout && (
                        <Botao icone={Download} onClick={() => download(d.id, 'holdout')}>
                          Holdout
                        </Botao>
                      )}
                    </div>
                  </>
                )}
              </Secao>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}