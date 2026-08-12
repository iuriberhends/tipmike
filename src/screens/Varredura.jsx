// ============================================================
// Varredura.jsx — o garimpo como tela do painel
//
// A API e' so' despachante: cria o job e responde. Quem roda e' o servico
// TipMikeVarredura, em processo separado e prioridade baixa — entao a tela
// nunca "trava esperando", ela acompanha.
//
// DECISOES DE UX (o porque, pra nao desfazer sem querer):
//  · O formulario nasce FECHADO. Na maior parte das visitas voce vem olhar
//    o que ja rodou, nao criar. Criar e' um clique a mais; consultar e' zero.
//  · Os 5 campos tecnicos ficam em "opcoes avancadas". Quem abre a tela pela
//    primeira vez so' precisa escolher a origem e o modo — o resto tem
//    default bom.
//  · O poll de 4s so' liga quando existe job ativo, e desliga sozinho. Tela
//    aberta a tarde inteira nao fica batendo no servidor a toa.
//  · Cada card ja mostra o que importa SEM abrir: configs achadas, duracao,
//    apostas e carimbo.
//
// Endpoints: /varredura/{origens,jobs,jobs/{id},jobs/{id}/confirmar,
//            jobs/{id}/cancelar,jobs/{id}/download}
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Radar, Plus, ChevronDown, Download, X, Play, AlertTriangle,
  CheckCircle2, Loader2, Clock, Database, Sliders, Info, Layers,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { BASE_URL, getAccessToken } from '../lib/auth.js';
import MikeHeader from '../shared/MikeHeader.jsx';

// ------------------------------------------------------------- constantes --
const STATUS = {
  pendente:   { rotulo: 'Na fila',    cor: '#94a3b8', Icone: Clock },
  planejando: { rotulo: 'Preparando', cor: '#38bdf8', Icone: Loader2, girando: true },
  planejado:  { rotulo: 'Aguardando', cor: '#fbbf24', Icone: AlertTriangle },
  rodando:    { rotulo: 'Garimpando', cor: '#22d3ee', Icone: Loader2, girando: true },
  concluido:  { rotulo: 'Pronto',     cor: '#10b981', Icone: CheckCircle2 },
  erro:       { rotulo: 'Erro',       cor: '#f87171', Icone: AlertTriangle },
  cancelado:  { rotulo: 'Cancelado',  cor: '#94a3b8', Icone: X },
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

// --------------------------------------------------------------- widgets ---
function Rotulo({ children, hint }) {
  return (
    <div className="flex items-center gap-1 mb-1.5">
      <span className="text-[10px] uppercase tracking-[0.08em] font-bold text-[--mike-fg-muted]">
        {children}
      </span>
      {hint && (
        <span className="group relative flex items-center">
          <Info className="w-3 h-3 text-[--mike-fg-muted] opacity-50" />
          <span className="pointer-events-none absolute left-4 -top-1 z-20 w-56 rounded-md px-2 py-1.5
                           text-[10px] leading-snug opacity-0 group-hover:opacity-100 transition"
                style={{ backgroundColor: '#0f1626', border: '0.5px solid rgba(60,85,130,.5)',
                         color: '#c8d3e8', boxShadow: '0 8px 24px rgba(0,0,0,.5)' }}>
            {hint}
          </span>
        </span>
      )}
    </div>
  );
}

const inputCls =
  'w-full rounded-lg px-3 py-2 text-[13px] bg-[rgba(11,15,26,.75)] text-[--mike-fg] ' +
  'border border-[rgba(60,85,130,.4)] outline-none transition focus:border-[--mike-accent]';

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

function Metrica({ icone: Ic, valor, label }) {
  if (valor === null || valor === undefined || valor === '') return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-[--mike-fg-soft]">
      {Ic && <Ic className="w-3 h-3 opacity-60" />}
      <span className="font-bold" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{valor}</span>
      {label && <span className="text-[--mike-fg-muted]">{label}</span>}
    </span>
  );
}

function Botao({ tipo = 'ghost', icone: Ic, children, ...props }) {
  const cores = {
    primario: { backgroundColor: 'var(--mike-accent)', color: 'var(--mike-bg)' },
    alerta:   { backgroundColor: '#fbbf24', color: '#0b0f1a' },
    perigo:   { backgroundColor: 'rgba(248,113,113,.15)', color: '#fca5a5',
                border: '0.5px solid rgba(248,113,113,.35)' },
    ghost:    { backgroundColor: 'rgba(60,85,130,.22)', color: '#a9b6d0',
                border: '0.5px solid rgba(60,85,130,.35)' },
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

// ============================================================ componente ===
export default function Varredura({ onNavegar }) {
  const [origens, setOrigens] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [aberto, setAberto] = useState(null);
  const [detalhe, setDetalhe] = useState({});
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [formAberto, setFormAberto] = useState(false);
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

  const carregarJobs = useCallback(async () => {
    try {
      const l = await api.get('/varredura/jobs', { limite: 30 });
      setJobs(l || []);
      return l || [];
    } catch (e) { setErro(e.message); return []; }
  }, []);

  const abrirDetalhe = useCallback(async (id, silencioso = false) => {
    if (!silencioso && aberto === id) { setAberto(null); return; }
    setAberto(id);
    try {
      const d = await api.get(`/varredura/jobs/${id}`);
      setDetalhe((prev) => ({ ...prev, [id]: d }));
    } catch (e) { if (!silencioso) setErro(e.message); }
  }, [aberto]);

  useEffect(() => {
    (async () => {
      try { setOrigens((await api.get('/varredura/origens', { limite: 80 })) || []); }
      catch (e) { setErro(e.message); }
      await carregarJobs();
      setCarregando(false);
    })();
  }, [carregarJobs]);

  // poll condicional: liga com job ativo, desliga sozinho quando acaba
  useEffect(() => {
    if (timer.current) { clearInterval(timer.current); timer.current = null; }
    if (ativos > 0) {
      timer.current = setInterval(async () => {
        const l = await carregarJobs();
        if (aberto && l.some((j) => j.id === aberto)) abrirDetalhe(aberto, true);
      }, 4000);
    }
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [ativos, aberto, carregarJobs, abrirDetalhe]);

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
      setFormAberto(false);
      await carregarJobs();
    } catch (e) { setErro(e.message); }
    finally { setCriando(false); }
  }

  async function acao(id, qual) {
    setErro(null);
    try {
      await api.post(`/varredura/jobs/${id}/${qual}`, {});
      await carregarJobs();
      abrirDetalhe(id, true);
    } catch (e) { setErro(e.message); }
  }

  async function download(id, tipo) {
    setErro(null);
    try { await baixar(id, tipo); } catch (e) { setErro(e.message); }
  }

  // ------------------------------------------------------------- render ---
  return (
    <div className="min-h-screen bg-[--mike-bg] text-[--mike-fg]">
      <MikeHeader telaAtiva="varredura" onNavegar={onNavegar} />

      <div className="max-w-screen-xl mx-auto px-4 lg:px-8 py-6">

        {/* ------------------------------------------------------ hero -- */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                 style={{ background: 'linear-gradient(135deg, var(--mike-accent), var(--mike-accent-2))' }}>
              <Radar className="w-5 h-5" style={{ color: 'var(--mike-bg)' }} />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight">Varredura</h1>
              <p className="text-[11px] text-[--mike-fg-muted] mt-0.5 max-w-2xl leading-relaxed">
                Combina os filtros do mínimo ao máximo em cima de um backtest já rodado
                e devolve cada combinação como um bot pronto — com holdout e carimbo.
              </p>
            </div>
          </div>
          <Botao tipo="primario" icone={formAberto ? X : Plus}
                 onClick={() => setFormAberto((v) => !v)}>
            {formAberto ? 'Fechar' : 'Nova varredura'}
          </Botao>
        </div>

        {/* --------------------------------------------------- avisos --- */}
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

        {/* ------------------------------------------------ formulario -- */}
        {formAberto && (
          <div className="rounded-2xl p-5 mb-6"
               style={{ backgroundColor: 'rgba(20,26,40,.6)',
                        border: '0.5px solid rgba(60,85,130,.4)',
                        boxShadow: '0 12px 40px rgba(0,0,0,.35)' }}>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-4">
              <div className="lg:col-span-3">
                <Rotulo hint="O garimpo lê as apostas deste job. Prefira um escancarado: job já filtrado só deixa procurar dentro da estratégia dele.">
                  Backtest de origem
                </Rotulo>
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
                  <div className="text-[10px] text-[--mike-fg-muted] mt-1.5">
                    Nenhum backtest elegível (precisa estar concluído e ter 500+ apostas).
                  </div>
                )}
              </div>

              <div className="lg:col-span-2">
                <Rotulo hint="Grosso é sonda; completo é o do dia a dia; total varre tudo e pode levar horas — nesse caso o job para e pede confirmação antes.">
                  Modo
                </Rotulo>
                <div className="grid grid-cols-3 gap-1.5">
                  {MODOS.map((m) => {
                    const on = form.modo === m.id;
                    return (
                      <button key={m.id} onClick={() => setForm({ ...form, modo: m.id })}
                        className="rounded-lg px-2 py-2 text-left transition"
                        style={{
                          backgroundColor: on ? 'rgba(34,211,238,.12)' : 'rgba(11,15,26,.6)',
                          border: `0.5px solid ${on ? 'var(--mike-accent)' : 'rgba(60,85,130,.35)'}`,
                        }}>
                        <div className="text-[11px] font-bold"
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
              </div>
            </div>

            {origemSel && !origemSel.escancarado && (
              <div className="mb-4 flex items-start gap-2 px-3 py-2.5 rounded-lg text-[11px] leading-relaxed"
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

            <button onClick={() => setAvancado((v) => !v)}
                    className="flex items-center gap-1.5 text-[11px] font-bold text-[--mike-fg-muted]
                               hover:text-[--mike-fg-soft] transition mb-3">
              <Sliders className="w-3.5 h-3.5" />
              Opções avançadas
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${avancado ? 'rotate-180' : ''}`} />
            </button>

            {avancado && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4 pb-4"
                   style={{ borderBottom: '0.5px solid rgba(60,85,130,.25)' }}>
                <div>
                  <Rotulo hint="Config com pouca aposta não serve pra operar — cortar cedo também acelera muito a busca.">Mín. apostas</Rotulo>
                  <input type="number" className={inputCls} value={form.min_apostas}
                         onChange={(e) => setForm({ ...form, min_apostas: e.target.value })} />
                </div>
                <div>
                  <Rotulo hint="Quantas configurações guardar por ranking.">Guardar</Rotulo>
                  <input type="number" className={inputCls} value={form.guardar}
                         onChange={(e) => setForm({ ...form, guardar: e.target.value })} />
                </div>
                <div>
                  <Rotulo hint="Em total de pontos quem decide é o TETO de linha. Nesse mercado, suba para 14.">Tetos de linha</Rotulo>
                  <input type="number" className={inputCls} value={form.nlmax} placeholder="ex: 14"
                         onChange={(e) => setForm({ ...form, nlmax: e.target.value })} />
                </div>
                <div>
                  <Rotulo hint="O passe de duas janelas cresce ao quadrado. Menos janelas = muito mais rápido.">Janelas</Rotulo>
                  <input className={inputCls} value={form.janelas} placeholder="todas"
                         onChange={(e) => setForm({ ...form, janelas: e.target.value })} />
                </div>
                <div>
                  <Rotulo hint="A busca só enxerga até esta data; o resto vira holdout e é medido no fim. Vazio = separa 30% do fim sozinho.">Corte do holdout</Rotulo>
                  <input type="date" className={inputCls} value={form.data_corte}
                         onChange={(e) => setForm({ ...form, data_corte: e.target.value })} />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-4">
              <p className="text-[10px] text-[--mike-fg-muted] leading-relaxed max-w-xl">
                A busca só enxerga o treino; o resto vira holdout e é medido no fim.
                No encerramento o resultado passa pelo carimbo — se a liquidação não
                fechar, o job vai para erro em vez de mostrar número furado.
              </p>
              <Botao tipo="primario" icone={criando ? Loader2 : Play}
                     onClick={criar} disabled={criando}>
                {criando ? 'Criando…' : 'Garimpar'}
              </Botao>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- lista --- */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] uppercase tracking-[0.08em] font-bold text-[--mike-fg-muted]">
            Varreduras
          </span>
          {ativos > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[--mike-accent]">
              <Loader2 className="w-3 h-3 animate-spin" />
              {ativos} em andamento
            </span>
          )}
        </div>

        {carregando && (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-xl h-16 animate-pulse"
                   style={{ backgroundColor: 'rgba(20,26,40,.4)' }} />
            ))}
          </div>
        )}

        {!carregando && jobs.length === 0 && (
          <div className="rounded-2xl py-12 px-6 text-center"
               style={{ backgroundColor: 'rgba(20,26,40,.4)',
                        border: '0.5px dashed rgba(60,85,130,.4)' }}>
            <Radar className="w-8 h-8 mx-auto mb-3 text-[--mike-fg-muted] opacity-40" />
            <div className="text-sm font-bold mb-1">Nenhuma varredura ainda</div>
            <p className="text-[11px] text-[--mike-fg-muted] max-w-sm mx-auto leading-relaxed">
              Escolha um backtest escancarado e deixe a máquina combinar os filtros.
              Ela roda em segundo plano — pode fechar a aba.
            </p>
          </div>
        )}

        <div className="space-y-2">
          {jobs.map((j) => {
            const d = detalhe[j.id];
            const c = (d && d.contrato) || {};
            const r = (d && d.resumo) || {};
            const g = r.gate || {};
            const expandido = aberto === j.id;
            const s = STATUS[j.status] || STATUS.pendente;
            return (
              <div key={j.id} className="rounded-xl overflow-hidden transition"
                   style={{ backgroundColor: 'rgba(20,26,40,.6)',
                            border: `0.5px solid ${expandido ? 'rgba(60,85,130,.7)' : 'rgba(60,85,130,.35)'}` }}>

                <div className="p-3.5 cursor-pointer transition hover:bg-[rgba(60,85,130,.08)]"
                     onClick={() => abrirDetalhe(j.id)}>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-black shrink-0 w-8"
                          style={{ fontFamily: 'JetBrains Mono, monospace', color: s.cor }}>
                      #{j.id}
                    </span>
                    <span className="text-[13px] font-bold flex-1 truncate">{j.nome}</span>
                    <Pill status={j.status} />
                    <span className="text-[10px] text-[--mike-fg-muted] w-16 text-right shrink-0">
                      {tempoRelativo(j.criado_em)}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-[--mike-fg-muted] transition-transform shrink-0 ${expandido ? 'rotate-180' : ''}`} />
                  </div>

                  {ATIVO.includes(j.status) && (
                    <div className="mt-2.5 pl-11">
                      <div className="w-full h-1 rounded-full overflow-hidden"
                           style={{ backgroundColor: 'rgba(60,85,130,.25)' }}>
                        <div className="h-full rounded-full transition-all duration-700"
                             style={{ width: `${Math.max(3, j.progresso || 0)}%`,
                                      background: `linear-gradient(90deg, ${s.cor}88, ${s.cor})` }} />
                      </div>
                      <div className="text-[10px] text-[--mike-fg-muted] mt-1.5">
                        {j.progresso_msg || 'iniciando…'}
                      </div>
                    </div>
                  )}

                  {j.status === 'concluido' && d && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 pl-11">
                      <Metrica icone={Layers} valor={num(r.linhas_saida)} label="configs" />
                      <Metrica icone={Clock} valor={duracao(r.segundos)} label="" />
                      <Metrica icone={Database} valor={num(c.apostas)} label="apostas" />
                      {g.t2_pct && <Metrica icone={CheckCircle2} valor={`${g.t2_pct}%`} label="carimbo" />}
                    </div>
                  )}

                  {j.status === 'erro' && j.erro && (
                    <div className="text-[11px] mt-2 pl-11 leading-relaxed" style={{ color: '#fca5a5' }}>
                      {j.erro}
                    </div>
                  )}
                </div>

                {expandido && (
                  <div className="px-3.5 pb-3.5" style={{ borderTop: '0.5px solid rgba(60,85,130,.25)' }}>
                    {!d && (
                      <div className="flex items-center gap-2 py-3 text-[11px] text-[--mike-fg-muted]">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> carregando…
                      </div>
                    )}
                    {d && (
                      <>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3 mt-3 mb-4">
                          {[
                            ['origem', `#${d.job_backtest_id}`],
                            ['período', c.periodo],
                            ['treino até', c.treino_ate],
                            ['holdout', c.holdout],
                            ['apostas', num(c.apostas)],
                            ['jogos', num(c.jogos)],
                            ['baseline', c.baseline],
                            ['configs achadas', num(r.linhas_saida)],
                            ['combinações', num(c.total_estimado)],
                            ['janelas', c.janelas],
                            ['eixos', c.complementares],
                            ['duração', duracao(r.segundos)],
                          ].filter((par) => par[1]).map((par) => (
                            <div key={par[0]} className="min-w-0">
                              <div className="text-[9px] uppercase tracking-wider text-[--mike-fg-muted] mb-0.5">
                                {par[0]}
                              </div>
                              <div className="text-[11px] text-[--mike-fg-soft] truncate" title={String(par[1])}>
                                {String(par[1])}
                              </div>
                            </div>
                          ))}
                        </div>

                        {g.t1 && (
                          <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg text-[11px]"
                               style={{ backgroundColor: 'rgba(11,15,26,.55)',
                                        border: '0.5px solid rgba(60,85,130,.3)',
                                        color: g.passou === false ? '#fca5a5' : '#a9b6d0' }}>
                            {g.passou === false
                              ? <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                              : <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: '#10b981' }} />}
                            <span>
                              <b>Carimbo</b> · liquidação {g.t1} · leitura {g.t2_pct}%
                              {g.passou === false && ' — reprovado, os números não são confiáveis'}
                            </span>
                          </div>
                        )}

                        {d.status === 'planejado' && (
                          <div className="flex items-start gap-2 mb-4 px-3 py-2.5 rounded-lg text-[11px] leading-relaxed"
                               style={{ backgroundColor: 'rgba(251,191,36,.1)',
                                        border: '0.5px solid rgba(251,191,36,.35)', color: '#fcd34d' }}>
                            <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" />
                            <span>{d.progresso_msg || 'Estimativa alta — confirme para rodar.'}</span>
                          </div>
                        )}

                        <div className="flex flex-wrap gap-2">
                          {d.status === 'planejado' && (
                            <Botao tipo="alerta" icone={Play} onClick={() => acao(j.id, 'confirmar')}>
                              Confirmar e rodar
                            </Botao>
                          )}
                          {ATIVO.includes(d.status) && (
                            <Botao tipo="perigo" icone={X} onClick={() => acao(j.id, 'cancelar')}>
                              Cancelar
                            </Botao>
                          )}
                          {d.tem_saida && (
                            <>
                              <Botao tipo="primario" icone={Download} onClick={() => download(j.id, 'xlsx')}>
                                Rankings (.xlsx)
                              </Botao>
                              <Botao icone={Download} onClick={() => download(j.id, 'tudo')}>
                                Tudo (.csv)
                              </Botao>
                            </>
                          )}
                          {d.tem_holdout && (
                            <Botao icone={Download} onClick={() => download(j.id, 'holdout')}>
                              Holdout
                            </Botao>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}