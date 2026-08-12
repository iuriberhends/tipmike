// ============================================================
// Varredura.jsx — o garimpo como tela do painel
//
// A API aqui e' so' despachante: cria o job e responde. Quem roda e' o
// servico TipMikeVarredura, em processo separado e com prioridade baixa —
// entao a tela nunca "trava esperando", ela acompanha.
//
// Endpoints (routers/varredura.py):
//   GET  /varredura/origens              backtests elegiveis
//   POST /varredura/jobs                 cria e enfileira
//   GET  /varredura/jobs                 lista
//   GET  /varredura/jobs/{id}            detalhe + contrato + resumo
//   POST /varredura/jobs/{id}/confirmar  libera job parado em 'planejado'
//   POST /varredura/jobs/{id}/cancelar
//   GET  /varredura/jobs/{id}/download?tipo=xlsx|tudo|holdout
//
// NAO importa nada novo do api.js de proposito: usa o `api` que ja e'
// exportado e faz o proprio download autenticado. Um arquivo novo, duas
// linhas no App.jsx, zero risco pro resto do painel.
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { BASE_URL, getAccessToken } from '../lib/auth.js';
import MikeHeader from '../shared/MikeHeader.jsx';

// ---------------------------------------------------------------- estilo ---
const COR = {
  bg: '#0b0f1a',
  card: 'rgba(20, 26, 40, 0.6)',
  borda: '0.5px solid rgba(60, 85, 130, 0.4)',
  fg: '#eaeef7',
};

const STATUS = {
  pendente:   { rotulo: 'na fila',     cor: '#94a3b8', bg: 'rgba(148,163,184,.15)' },
  planejando: { rotulo: 'preparando',  cor: '#38bdf8', bg: 'rgba(56,189,248,.15)' },
  planejado:  { rotulo: 'aguardando',  cor: '#fbbf24', bg: 'rgba(251,191,36,.15)' },
  rodando:    { rotulo: 'garimpando',  cor: '#22d3ee', bg: 'rgba(34,211,238,.15)' },
  concluido:  { rotulo: 'pronto',      cor: '#10b981', bg: 'rgba(16,185,129,.15)' },
  erro:       { rotulo: 'erro',        cor: '#f87171', bg: 'rgba(248,113,113,.15)' },
  cancelado:  { rotulo: 'cancelado',   cor: '#94a3b8', bg: 'rgba(148,163,184,.12)' },
};
const ATIVO = ['pendente', 'planejando', 'rodando'];

const fmt = (n) => (n === null || n === undefined || n === '' ? '—'
  : Number(n).toLocaleString('pt-BR'));

function quando(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit',
      hour: '2-digit', minute: '2-digit' });
  } catch { return String(iso); }
}

// download autenticado (link direto tomaria 401)
async function baixar(jobId, tipo) {
  const res = await fetch(
    `${BASE_URL}/varredura/jobs/${jobId}/download?tipo=${tipo}`,
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

// -------------------------------------------------------------- widgets ----
function Campo({ label, hint, children }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider font-bold mb-1"
           style={{ color: '#7c8db5' }}>{label}</div>
      {children}
      {hint && <div className="text-[10px] mt-1" style={{ color: '#5f708f' }}>{hint}</div>}
    </div>
  );
}

const estiloInput = {
  backgroundColor: 'rgba(11,15,26,.7)', border: COR.borda,
  color: COR.fg, borderRadius: 6, padding: '6px 8px', width: '100%',
  fontSize: 13, outline: 'none',
};

function Selo({ status }) {
  const s = STATUS[status] || STATUS.pendente;
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
          style={{ color: s.cor, backgroundColor: s.bg,
                   border: `0.5px solid ${s.cor}55` }}>
      {s.rotulo}
    </span>
  );
}

function Barra({ pct, status }) {
  const s = STATUS[status] || STATUS.pendente;
  return (
    <div className="w-full h-1.5 rounded-full overflow-hidden"
         style={{ backgroundColor: 'rgba(60,85,130,.25)' }}>
      <div className="h-full rounded-full transition-all duration-500"
           style={{ width: `${Math.max(2, pct || 0)}%`, backgroundColor: s.cor }} />
    </div>
  );
}

// ============================================================ componente ===
export default function Varredura({ onNavegar }) {
  const [origens, setOrigens] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [aberto, setAberto] = useState(null);       // id do job expandido
  const [detalhe, setDetalhe] = useState({});       // id -> detalhe completo
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [criando, setCriando] = useState(false);
  const [form, setForm] = useState({
    job_backtest_id: '', modo: 'completo', janelas: '',
    min_apostas: 250, guardar: 8000, nlmax: '', data_corte: '',
  });
  const timer = useRef(null);

  const origemSel = useMemo(
    () => origens.find((o) => String(o.job_id) === String(form.job_backtest_id)),
    [origens, form.job_backtest_id]);

  const carregarJobs = useCallback(async () => {
    try {
      const l = await api.get('/varredura/jobs', { limite: 30 });
      setJobs(l || []);
      return l || [];
    } catch (e) { setErro(e.message); return []; }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setOrigens(await api.get('/varredura/origens', { limite: 80 }) || []);
      } catch (e) { setErro(e.message); }
      await carregarJobs();
    })();
  }, [carregarJobs]);

  // poll enquanto houver job em andamento — para sozinho quando nao ha
  useEffect(() => {
    const temAtivo = jobs.some((j) => ATIVO.includes(j.status));
    if (timer.current) { clearInterval(timer.current); timer.current = null; }
    if (temAtivo) {
      timer.current = setInterval(async () => {
        const l = await carregarJobs();
        if (aberto && l.some((j) => j.id === aberto)) abrirDetalhe(aberto, true);
      }, 4000);
    }
    return () => { if (timer.current) clearInterval(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs, aberto, carregarJobs]);

  async function abrirDetalhe(id, silencioso = false) {
    if (!silencioso && aberto === id) { setAberto(null); return; }
    setAberto(id);
    try {
      const d = await api.get(`/varredura/jobs/${id}`);
      setDetalhe((prev) => ({ ...prev, [id]: d }));
    } catch (e) { if (!silencioso) setErro(e.message); }
  }

  async function criar() {
    setErro(null); setAviso(null);
    if (!form.job_backtest_id) { setErro('Escolha o backtest de origem.'); return; }
    setCriando(true);
    try {
      const body = {
        job_backtest_id: Number(form.job_backtest_id),
        modo: form.modo,
        min_apostas: form.min_apostas ? Number(form.min_apostas) : null,
        guardar: form.guardar ? Number(form.guardar) : null,
        nlmax: form.nlmax ? Number(form.nlmax) : null,
        janelas: form.janelas.trim() || null,
        data_corte: form.data_corte || null,
      };
      const r = await api.post('/varredura/jobs', body);
      setAviso(r.na_frente > 0
        ? `Varredura ${r.id} criada — ${r.na_frente} na frente na fila.`
        : `Varredura ${r.id} criada e já entrando na fila.`);
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
    <div className="min-h-screen"
         style={{ backgroundColor: COR.bg, color: COR.fg,
                  fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <MikeHeader telaAtiva="varredura" onNavegar={onNavegar} />
      <div className="max-w-6xl mx-auto p-4 md:p-6">

        <div className="mb-5">
          <h1 className="text-xl font-bold">Varredura</h1>
          <p className="text-xs mt-0.5" style={{ color: '#7c8db5' }}>
            Combina todos os filtros do mínimo ao máximo em cima de um backtest
            já rodado e devolve cada combinação como um bot pronto.
          </p>
        </div>

        {erro && (
          <div className="mb-3 px-3 py-2 rounded-md text-xs"
               style={{ backgroundColor: 'rgba(248,113,113,.12)',
                        border: '0.5px solid rgba(248,113,113,.4)', color: '#fca5a5' }}>
            {erro}
          </div>
        )}
        {aviso && (
          <div className="mb-3 px-3 py-2 rounded-md text-xs"
               style={{ backgroundColor: 'rgba(16,185,129,.12)',
                        border: '0.5px solid rgba(16,185,129,.4)', color: '#6ee7b7' }}>
            {aviso}
          </div>
        )}

        {/* ---------------------------------------------------- nova ---- */}
        <div className="rounded-xl p-4 mb-5"
             style={{ backgroundColor: COR.card, border: COR.borda }}>
          <div className="text-[11px] uppercase tracking-wider font-bold mb-3"
               style={{ color: '#7c8db5' }}>Nova varredura</div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            <div className="md:col-span-2">
              <Campo label="Backtest de origem"
                     hint="O garimpo lê as apostas deste job. Prefira um ESCANCARADO — job já filtrado só deixa procurar dentro da estratégia dele.">
                <select style={estiloInput} value={form.job_backtest_id}
                        onChange={(e) => setForm({ ...form, job_backtest_id: e.target.value })}>
                  <option value="">— escolha —</option>
                  {origens.map((o) => (
                    <option key={o.job_id} value={o.job_id}>
                      #{o.job_id} · {o.mercado || 'mercado?'} · {fmt(o.apostas)} apostas
                      {o.escancarado ? ' · escancarado' : ' · FILTRADO'}
                    </option>
                  ))}
                </select>
              </Campo>
            </div>
            <Campo label="Modo"
                   hint="grosso ≈ sonda · completo ≈ dia a dia · total pode levar horas">
              <select style={estiloInput} value={form.modo}
                      onChange={(e) => setForm({ ...form, modo: e.target.value })}>
                <option value="grosso">grosso (rápido)</option>
                <option value="completo">completo</option>
                <option value="total">total (exaustivo)</option>
              </select>
            </Campo>
          </div>

          {origemSel && !origemSel.escancarado && (
            <div className="mb-3 px-3 py-2 rounded-md text-[11px]"
                 style={{ backgroundColor: 'rgba(251,191,36,.12)',
                          border: '0.5px solid rgba(251,191,36,.4)', color: '#fcd34d' }}>
              Esse backtest já tem filtro. A busca vai procurar <b>dentro</b> da
              estratégia dele e nunca fora — para garimpar de verdade, use um job
              escancarado (sem chip, sem linha, sem teto).
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Campo label="Mín. apostas" hint="corta cedo o que é pouco pra operar">
              <input type="number" style={estiloInput} value={form.min_apostas}
                     onChange={(e) => setForm({ ...form, min_apostas: e.target.value })} />
            </Campo>
            <Campo label="Guardar" hint="quantas por ranking">
              <input type="number" style={estiloInput} value={form.guardar}
                     onChange={(e) => setForm({ ...form, guardar: e.target.value })} />
            </Campo>
            <Campo label="Tetos de linha" hint="em total de pontos, é o teto que decide">
              <input type="number" style={estiloInput} value={form.nlmax}
                     placeholder="ex: 14"
                     onChange={(e) => setForm({ ...form, nlmax: e.target.value })} />
            </Campo>
            <Campo label="Janelas" hint="vazio = todas do arquivo">
              <input style={estiloInput} value={form.janelas}
                     placeholder="ult.10,ult.30,todas"
                     onChange={(e) => setForm({ ...form, janelas: e.target.value })} />
            </Campo>
            <Campo label="Corte do holdout" hint="vazio = separa 30% do fim sozinho">
              <input type="date" style={estiloInput} value={form.data_corte}
                     onChange={(e) => setForm({ ...form, data_corte: e.target.value })} />
            </Campo>
          </div>

          <div className="flex items-center justify-between mt-4">
            <div className="text-[10px]" style={{ color: '#5f708f' }}>
              A busca só enxerga o treino; o resto vira holdout e é medido no fim.
              Se a estimativa for muito alta, o job para e pede confirmação.
            </div>
            <button onClick={criar} disabled={criando}
                    className="px-4 py-2 rounded-md text-sm font-bold transition"
                    style={{ backgroundColor: criando ? '#334155' : '#10b981',
                             color: criando ? '#94a3b8' : '#0b0f1a',
                             cursor: criando ? 'default' : 'pointer' }}>
              {criando ? 'criando...' : 'Garimpar'}
            </button>
          </div>
        </div>

        {/* ---------------------------------------------------- lista ---- */}
        <div className="text-[11px] uppercase tracking-wider font-bold mb-2"
             style={{ color: '#7c8db5' }}>Varreduras</div>

        {jobs.length === 0 && (
          <div className="rounded-xl p-6 text-center text-xs"
               style={{ backgroundColor: COR.card, border: COR.borda, color: '#7c8db5' }}>
            Nenhuma varredura ainda.
          </div>
        )}

        <div className="space-y-2">
          {jobs.map((j) => {
            const d = detalhe[j.id];
            const c = (d && d.contrato) || {};
            const r = (d && d.resumo) || {};
            const g = r.gate || {};
            return (
              <div key={j.id} className="rounded-xl overflow-hidden"
                   style={{ backgroundColor: COR.card, border: COR.borda }}>
                <div className="p-3 cursor-pointer" onClick={() => abrirDetalhe(j.id)}>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold" style={{ color: '#7c8db5' }}>#{j.id}</span>
                    <span className="text-sm font-bold flex-1 truncate">{j.nome}</span>
                    <Selo status={j.status} />
                    <span className="text-[10px]" style={{ color: '#5f708f' }}>
                      {quando(j.criado_em)}
                    </span>
                  </div>
                  {ATIVO.includes(j.status) && (
                    <div className="mt-2">
                      <Barra pct={j.progresso} status={j.status} />
                      <div className="text-[10px] mt-1" style={{ color: '#7c8db5' }}>
                        {j.progresso_msg || 'iniciando...'}
                      </div>
                    </div>
                  )}
                  {j.status === 'erro' && j.erro && (
                    <div className="text-[11px] mt-2" style={{ color: '#fca5a5' }}>{j.erro}</div>
                  )}
                </div>

                {aberto === j.id && (
                  <div className="px-3 pb-3 pt-1"
                       style={{ borderTop: '0.5px solid rgba(60,85,130,.25)' }}>
                    {!d && <div className="text-xs py-2" style={{ color: '#7c8db5' }}>carregando...</div>}
                    {d && (
                      <>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2 mb-3">
                          {[
                            ['origem', `#${d.job_backtest_id}`],
                            ['período', c.periodo],
                            ['treino até', c.treino_ate],
                            ['holdout', c.holdout],
                            ['apostas', fmt(c.apostas)],
                            ['jogos', fmt(c.jogos)],
                            ['baseline', c.baseline],
                            ['configs achadas', fmt(r.linhas_saida)],
                            ['combinações estimadas', fmt(c.total_estimado)],
                            ['janelas', c.janelas],
                            ['eixos', c.complementares],
                            ['tempo', r.segundos ? `${r.segundos}s` : null],
                          ].filter(([, v]) => v).map(([k, v]) => (
                            <div key={k}>
                              <div className="text-[9px] uppercase tracking-wider"
                                   style={{ color: '#5f708f' }}>{k}</div>
                              <div className="text-[11px] truncate" title={String(v)}>{String(v)}</div>
                            </div>
                          ))}
                        </div>

                        {g.t1 && (
                          <div className="text-[11px] mb-3 px-2 py-1.5 rounded"
                               style={{ backgroundColor: 'rgba(11,15,26,.5)', color: '#a9b6d0' }}>
                            <b>carimbo</b> · T1 liquidação {g.t1} · T2 leitura {g.t2_pct}%
                            {g.passou === false && ' — reprovado'}
                          </div>
                        )}

                        {d.status === 'planejado' && (
                          <div className="mb-3 px-3 py-2 rounded-md text-[11px]"
                               style={{ backgroundColor: 'rgba(251,191,36,.12)',
                                        border: '0.5px solid rgba(251,191,36,.4)',
                                        color: '#fcd34d' }}>
                            {d.progresso_msg || 'estimativa alta — confirme para rodar.'}
                          </div>
                        )}

                        <div className="flex flex-wrap gap-2">
                          {d.status === 'planejado' && (
                            <button onClick={() => acao(j.id, 'confirmar')}
                                    className="px-3 py-1.5 rounded-md text-xs font-bold"
                                    style={{ backgroundColor: '#fbbf24', color: '#0b0f1a' }}>
                              Confirmar e rodar
                            </button>
                          )}
                          {ATIVO.includes(d.status) && (
                            <button onClick={() => acao(j.id, 'cancelar')}
                                    className="px-3 py-1.5 rounded-md text-xs font-bold"
                                    style={{ backgroundColor: 'rgba(248,113,113,.2)', color: '#fca5a5' }}>
                              Cancelar
                            </button>
                          )}
                          {d.tem_saida && (
                            <>
                              <button onClick={() => download(j.id, 'xlsx')}
                                      className="px-3 py-1.5 rounded-md text-xs font-bold"
                                      style={{ backgroundColor: 'rgba(34,211,238,.18)', color: '#67e8f9' }}>
                                Baixar rankings (.xlsx)
                              </button>
                              <button onClick={() => download(j.id, 'tudo')}
                                      className="px-3 py-1.5 rounded-md text-xs font-bold"
                                      style={{ backgroundColor: 'rgba(60,85,130,.3)', color: '#a9b6d0' }}>
                                Baixar tudo (.csv)
                              </button>
                            </>
                          )}
                          {d.tem_holdout && (
                            <button onClick={() => download(j.id, 'holdout')}
                                    className="px-3 py-1.5 rounded-md text-xs font-bold"
                                    style={{ backgroundColor: 'rgba(16,185,129,.18)', color: '#6ee7b7' }}>
                              Baixar holdout
                            </button>
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
