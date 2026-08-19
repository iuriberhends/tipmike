// ============================================================
// H2hSyncPanel.jsx — painel "Analisar H2H" do backtest avulso
// Salve em: src/shared/H2hSyncPanel.jsx
//
// Fluxo (a logica que o Santos definiu):
//   1. herda casa/esporte/periodo do avulso (props)
//   2. ANALISAR  -> mostra o buraco (pares que precisam, jogos so-tick)
//   3. SIMULAR   -> quantos jogos entrariam da TM, sem gravar
//   4. PREENCHER -> grava de verdade (dedup + limpeza de bkp_ no backend)
//   Barra de progresso ao vivo em cada fase (polling do GET /h2h-sync/{job}).
//
// Encaixa ANTES do backtest: completa o H2H do banco pra o backtest nao
// rodar com historico furado. Mesmo componente serve pro item de menu
// (basta renderizar sem `periodoLabel`, deixando os campos livres).
// ============================================================
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  DatabaseZap, RefreshCw, Search, Play, CheckCircle2, AlertTriangle,
  ChevronDown, ChevronUp,
} from 'lucide-react';
import { ApiH2hSync } from '../lib/api.js';

const POLL_MS = 1500;
const POLL_TIMEOUT_MS = 20 * 60 * 1000; // preenchimento grande (24x) demora

const card = {
  backgroundColor: 'rgba(30,41,59,0.35)',
  border: '1px solid rgba(60,85,130,0.25)',
};

function Barra({ pct, msg }) {
  return (
    <div className="mt-2">
      <div className="h-1.5 rounded-full overflow-hidden"
           style={{ backgroundColor: 'rgba(60,85,130,0.25)' }}>
        <div className="h-full transition-all duration-500"
             style={{ width: `${Math.max(2, pct || 0)}%`, backgroundColor: '#38bdf8' }} />
      </div>
      <div className="text-[10px] text-[--mike-fg-muted] font-mono truncate mt-1">
        {msg || 'iniciando...'}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// v3 (19/ago) — O VEREDITO EM PORTUGUES.
// A tela dizia "cobertos pelo hist" e "so na perna dos ticks": nome de
// coluna, nao pergunta. E nao respondia o que interessa — da' pra confiar
// nesse dado? Agora quem decide o texto e a cor e o BACKEND (campo
// `diagnostico`); aqui so' desenha. Assim painel, log e relatorio nunca
// divergem.
// ---------------------------------------------------------------
const SELO = {
  confiavel:    { cor: '#10b981', fundo: 'rgba(16,185,129,0.10)', borda: 'rgba(16,185,129,0.35)',
                  icone: CheckCircle2, titulo: 'DADO CONFIÁVEL' },
  atencao:      { cor: '#fbbf24', fundo: 'rgba(251,191,36,0.10)', borda: 'rgba(251,191,36,0.35)',
                  icone: AlertTriangle, titulo: 'ATENÇÃO' },
  nao_use:      { cor: '#f87171', fundo: 'rgba(248,113,113,0.10)', borda: 'rgba(248,113,113,0.35)',
                  icone: AlertTriangle, titulo: 'NÃO USE ESTES NÚMEROS' },
  indisponivel: { cor: '#6b7691', fundo: 'rgba(107,118,145,0.10)', borda: 'rgba(107,118,145,0.30)',
                  icone: AlertTriangle, titulo: 'NÃO CONSEGUI CONFERIR' },
};

function Veredito({ d }) {
  if (!d) return null;
  const s = SELO[d.veredito] || SELO.indisponivel;
  const Icone = s.icone;
  return (
    <div className="rounded-lg p-3 mb-3"
         style={{ backgroundColor: s.fundo, border: `1px solid ${s.borda}` }}>
      <div className="flex items-center gap-2">
        <Icone className="w-4 h-4 shrink-0" style={{ color: s.cor }} />
        <span className="text-[13px] font-bold" style={{ color: s.cor }}>{s.titulo}</span>
        <span className="text-[11px] text-[--mike-fg-soft]">— {d.resumo}</span>
      </div>

      {d.checagens?.length > 0 && (
        <div className="mt-2.5 space-y-1.5">
          {d.checagens.map((c, i) => (
            <div key={i}>
              <div className="flex items-baseline gap-2 text-[11px]">
                <span className="flex-1 text-[--mike-fg-soft]">{c.pergunta}</span>
                <span className="font-mono font-bold"
                      style={{ color: c.ok ? '#10b981' : '#fbbf24' }}>{c.valor}</span>
                <span style={{ color: c.ok ? '#10b981' : '#fbbf24' }}>{c.ok ? '✓' : '⚠'}</span>
              </div>
              {c.detalhe && (
                <div className="text-[10px] text-[--mike-fg-muted] pl-1">{c.detalhe}</div>
              )}
              {c.o_que_fazer && (
                <div className="text-[10px] mt-0.5 pl-1" style={{ color: '#fbbf24' }}>
                  <b>O que fazer:</b> {c.o_que_fazer}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {d.erro && (
        <div className="text-[10px] text-[--mike-fg-muted] mt-2 font-mono">{d.erro}</div>
      )}
    </div>
  );
}

function Fontes({ d }) {
  if (!d?.fontes?.length) return null;
  return (
    <div className="mb-3">
      <div className="text-[10px] uppercase tracking-wider text-[--mike-fg-muted] font-bold mb-1">
        De onde vem o histórico
      </div>
      {d.fontes.map((f, i) => (
        <div key={i} className="flex items-baseline gap-2 text-[11px]">
          <span className="flex-1 text-[--mike-fg-soft]">{f.nome}</span>
          <span className="font-mono">{(f.jogos || 0).toLocaleString('pt-BR')} jogos</span>
          <span className="text-[--mike-fg-muted] w-20 text-right">
            {f.ate ? `até ${f.ate.split('-').reverse().slice(0, 2).join('/')}` : '—'}
          </span>
        </div>
      ))}
      {d.sobreposicao > 0 && (
        <div className="text-[10px] text-[--mike-fg-muted] mt-1">
          As duas viram os mesmos {d.sobreposicao.toLocaleString('pt-BR')} jogos — é com essa
          sobreposição que dá pra conferir uma contra a outra.
        </div>
      )}
    </div>
  );
}

function Filtros({ d }) {
  if (!d?.filtros?.length) return null;
  return (
    <div className="mb-3">
      <div className="text-[10px] uppercase tracking-wider text-[--mike-fg-muted] font-bold mb-1">
        O que cada filtro consegue usar
      </div>
      {d.filtros.map((f, i) => (
        <div key={i} className="flex items-baseline gap-2 text-[11px]">
          <span className="flex-1 text-[--mike-fg-soft]">{f.nome}</span>
          <span className="font-mono" style={{ color: f.ok ? '#10b981' : '#fbbf24' }}>
            {f.pct}% dos jogos
          </span>
        </div>
      ))}
    </div>
  );
}

export default function H2hSyncPanel({
  casa, esporte, liga = null, dias = 3,
  dataInicio = null, dataFim = null, periodoLabel = null,
  uploadId = null,
}) {
  const [aberto, setAberto] = useState(false);
  const [fase, setFase] = useState('idle');      // idle|analisando|analisado|preenchendo|feito
  const [erro, setErro] = useState(null);
  const [pct, setPct] = useState(0);
  const [msg, setMsg] = useState('');
  const [relatorio, setRelatorio] = useState(null);   // da analise
  const [resultado, setResultado] = useState(null);   // do preenchimento
  const [analiseJobId, setAnaliseJobId] = useState(null);
  const [verPares, setVerPares] = useState(false);
  const [limitePares, setLimitePares] = useState(60);

  const pollRef = useRef(null);
  const inicioRef = useRef(0);
  const montadoRef = useRef(true);
  useEffect(() => () => { montadoRef.current = false; clearInterval(pollRef.current); }, []);

  // job em andamento sobrevive a navegacao/refresh (o servidor segue rodando;
  // o painel retoma o acompanhamento ao voltar) — mesmo padrao do backtest.
  const LS_KEY = 'h2h_sync_job_ativo';
  const salvarJobAtivo = (id, tipo) => { try { localStorage.setItem(LS_KEY, JSON.stringify({ id, tipo })); } catch {} };
  const limparJobAtivo = () => { try { localStorage.removeItem(LS_KEY); } catch {} };
  useEffect(() => {
    let salvo = null;
    try { salvo = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch {}
    if (!salvo?.id) return;
    setAberto(true);
    const ehAnalise = salvo.tipo === 'analise';
    setFase(ehAnalise ? 'analisando' : 'preenchendo');
    setMsg('retomando acompanhamento...');
    if (ehAnalise) setAnaliseJobId(salvo.id);
    seguirJob(salvo.id,
      (j) => { setPct(j.progresso); setMsg(j.etapa); },
      (j) => {
        if (ehAnalise) { setRelatorio(j.relatorio); setFase('analisado'); }
        else { setResultado({ ...j.relatorio, dry_run: !!j.relatorio?.dry_run }); setFase('feito'); }
        limparJobAtivo();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const limparPoll = () => { clearInterval(pollRef.current); pollRef.current = null; };

  // segue um job ate concluir; onDone recebe o relatorio final
  const seguirJob = useCallback((jobId, onProgresso, onDone) => {
    inicioRef.current = Date.now();
    pollRef.current = setInterval(async () => {
      if (Date.now() - inicioRef.current > POLL_TIMEOUT_MS) {
        limparPoll();
        if (montadoRef.current) { setErro('tempo esgotado.'); setFase('idle'); }
        return;
      }
      try {
        const j = await ApiH2hSync.get(jobId);
        if (!montadoRef.current) return;
        onProgresso?.(j);
        if (j.status === 'concluido') { limparPoll(); onDone?.(j); }
        else if (j.status === 'erro') { limparPoll(); setErro(j.erro || 'erro no job'); setFase('idle'); }
      } catch (e) {
        limparPoll();
        if (montadoRef.current) { setErro(String(e.message || e)); setFase('idle'); }
      }
    }, POLL_MS);
  }, []);

  const corpoBase = () => ({
    // com uploadId, a analise le os pares DO ARQUIVO (ticks de fonte
    // externa nunca passaram pela tabela do banco)
    upload_id: uploadId || undefined,
    casa, esporte, liga,
    dias: Number(dias) || 3,
    data_inicio: dataInicio || undefined,
    data_fim: dataFim || undefined,
  });

  const analisar = useCallback(async (manterResultado = false) => {
    setErro(null); setRelatorio(null);
    if (!manterResultado) setResultado(null);
    setFase('analisando'); setPct(0); setMsg('lendo ticks...');
    try {
      const { job_id } = await ApiH2hSync.analisar(corpoBase());
      setAnaliseJobId(job_id);
      salvarJobAtivo(job_id, 'analise');
      seguirJob(job_id,
        (j) => { setPct(j.progresso); setMsg(j.etapa); },
        (j) => { setRelatorio(j.relatorio); setFase('analisado'); limparJobAtivo(); });
    } catch (e) { setErro(String(e.message || e)); setFase('idle'); limparJobAtivo(); }
  }, [casa, esporte, liga, dias, dataInicio, dataFim, uploadId, seguirJob]);

  const rodarPreenchimento = useCallback((dryRun) => {
    if (!analiseJobId) return;
    setErro(null); setResultado(null);
    setFase('preenchendo'); setPct(0);
    setMsg(dryRun ? 'simulando (nao grava)...' : 'preenchendo...');
    ApiH2hSync.preencher(analiseJobId, { limite_pares: Number(limitePares) || 60, dry_run: dryRun })
      .then(({ job_id }) => {
        salvarJobAtivo(job_id, 'preenchimento');
        seguirJob(job_id,
          (j) => { setPct(j.progresso); setMsg(j.etapa); },
          (j) => {
            setResultado({ ...j.relatorio, dry_run: dryRun });
            setFase('feito'); limparJobAtivo();
            // preencheu de verdade -> o relatorio da analise ficou velho;
            // re-analisa sozinho (mantendo o resultado visivel) pra tela
            // nunca mostrar dois numeros se contradizendo.
            if (!dryRun) setTimeout(() => analisar(true), 800);
          });
      })
      .catch((e) => { setErro(String(e.message || e)); setFase('analisado'); limparJobAtivo(); });
  }, [analiseJobId, limitePares, seguirJob]);

  const ocupado = fase === 'analisando' || fase === 'preenchendo';
  const paresPrecisam = relatorio?.pares_precisam ?? 0;

  return (
    <section className="rounded-lg p-4" style={card}>
      <button onClick={() => setAberto(v => !v)}
              className="w-full flex items-center justify-between gap-2 text-left">
        <span className="flex items-center gap-2 text-sm font-bold text-[--mike-fg]">
          <DatabaseZap className="w-4 h-4 text-sky-400" />
          Analisar H2H {periodoLabel ? <span className="text-[--mike-fg-muted] font-normal">· {periodoLabel}</span> : null}
        </span>
        {aberto ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {aberto && (
        <div className="mt-3">
          <p className="text-[11px] text-[--mike-fg-muted] mb-3 leading-relaxed">
            Confere se o H2H do banco cobre os pares dos ticks deste período e completa
            pela TipManager o que falta. Rode <b>antes</b> do backtest pra ele não usar
            histórico furado. Fonte: <b>{casa}</b> · <b>{esporte}</b>
            {liga ? <> · {liga}</> : null}.
          </p>

          {/* ANALISAR */}
          <button onClick={analisar} disabled={ocupado}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition disabled:opacity-40"
            style={{ backgroundColor: ocupado ? 'rgba(56,189,248,0.2)' : 'rgba(56,189,248,0.15)',
                     color: ocupado ? '#6b7691' : '#38bdf8', border: '1px solid rgba(56,189,248,0.4)' }}>
            {fase === 'analisando'
              ? <><RefreshCw className="w-4 h-4 mike-spin" /> Analisando...</>
              : <><Search className="w-4 h-4" /> Analisar</>}
          </button>

          {fase === 'analisando' && <Barra pct={pct} msg={msg} />}

          {/* RELATORIO DA ANALISE */}
          {relatorio && fase !== 'analisando' && (
            <div className="mt-3 rounded-md p-3 text-xs" style={{ backgroundColor: 'rgba(15,23,42,0.5)' }}>
              {/* v3: o veredito primeiro — a resposta antes dos numeros. */}
              <Veredito d={relatorio.diagnostico} />
              <Fontes d={relatorio.diagnostico} />
              <Filtros d={relatorio.diagnostico} />

              <div className="text-[10px] uppercase tracking-wider text-[--mike-fg-muted] font-bold mb-1">
                Jogos que a TipManager ainda não confirmou
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono">
                <span className="text-[--mike-fg-muted]">confrontos no período</span>
                <span className="text-right">{relatorio.pares_total}</span>
                <span className="text-[--mike-fg-muted]">confirmados pela TipManager</span>
                <span className="text-right text-emerald-400">{relatorio.cobertos_hist_total}</span>
                <span className="text-[--mike-fg-muted]">só o nosso coletor viu</span>
                <span className="text-right text-amber-300">{relatorio.so_tick_total}</span>
              </div>

              {paresPrecisam === 0 ? (
                <div className="mt-2 flex items-center gap-2 text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" /> A TipManager já confirmou todos os confrontos deste período.
                </div>
              ) : (
                <>
                  {relatorio.pares?.length > 0 && (
                    <button onClick={() => setVerPares(v => !v)}
                            className="mt-2 text-[11px] text-sky-400 hover:text-sky-300 underline">
                      {verPares ? 'ocultar' : 'ver'} quais confrontos
                    </button>
                  )}
                  {verPares && (
                    <div className="mt-2 max-h-48 overflow-y-auto font-mono text-[10px] space-y-0.5">
                      {relatorio.pares.map((p, i) => (
                        <div key={i} className="flex justify-between gap-2 text-[--mike-fg-muted]">
                          <span className="truncate">{p.jogador_a} × {p.jogador_b}</span>
                          <span className="shrink-0">só-tick {p.so_tick} · hist {p.jogos_hist}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* controles de preenchimento */}
                  <div className="mt-3 flex items-center gap-2">
                    <label className="text-[10px] text-[--mike-fg-muted]">máx pares/lote</label>
                    <input type="number" min="1" max="500" value={limitePares}
                           onChange={e => setLimitePares(e.target.value)}
                           className="w-16 px-2 py-1 rounded bg-black/30 border border-[rgba(60,85,130,0.4)] text-xs font-mono" />
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button onClick={() => rodarPreenchimento(true)} disabled={ocupado}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-bold transition disabled:opacity-40"
                      style={{ backgroundColor: 'rgba(148,163,184,0.15)', color: '#cbd5e1', border: '1px solid rgba(148,163,184,0.3)' }}>
                      <Search className="w-3.5 h-3.5" /> Simular
                    </button>
                    <button onClick={() => rodarPreenchimento(false)} disabled={ocupado}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-bold transition disabled:opacity-40"
                      style={{ backgroundColor: ocupado ? 'rgba(56,189,248,0.2)' : '#38bdf8',
                               color: ocupado ? '#6b7691' : '#0b0f1a' }}>
                      <Play className="w-3.5 h-3.5" /> Preencher
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {fase === 'preenchendo' && <Barra pct={pct} msg={msg} />}

          {/* RESULTADO DO PREENCHIMENTO */}
          {resultado && fase === 'feito' && (
            <div className="mt-3 rounded-md p-3 text-xs" style={{ backgroundColor: 'rgba(15,23,42,0.5)' }}>
              <div className="flex items-center gap-2 mb-2 font-bold"
                   style={{ color: resultado.dry_run ? '#cbd5e1' : '#34d399' }}>
                <CheckCircle2 className="w-4 h-4" />
                {resultado.dry_run
                  ? `Simulação: ${resultado.jogos_que_entrariam ?? 0} jogos entrariam`
                  : `${resultado.jogos_inseridos ?? 0} jogos inseridos`}
                {!resultado.dry_run && resultado.backups_removidos > 0
                  ? <span className="text-[--mike-fg-muted] font-normal">· {resultado.backups_removidos} backup(s) removido(s)</span>
                  : null}
              </div>
              {resultado.detalhe?.length > 0 && (
                <div className="max-h-48 overflow-y-auto font-mono text-[10px] space-y-0.5">
                  {resultado.detalhe.map((d, i) => (
                    <div key={i} className="flex justify-between gap-2 text-[--mike-fg-muted]">
                      <span className="truncate">{d.par}</span>
                      <span className="shrink-0">
                        {resultado.dry_run ? (d.entrariam ?? 0) + ' entrariam' : (d.inseridos ?? 0) + ' ins'}
                        {d.obs && d.obs !== 'ok' ? ` · ${d.obs}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {!resultado.dry_run && paresPrecisam > (Number(limitePares) || 60) && (
                <p className="mt-2 text-[10px] text-amber-300/80">
                  Ainda faltam pares. Clique <b>Analisar</b> de novo pra atualizar e rodar o próximo lote.
                </p>
              )}
            </div>
          )}

          {erro && (
            <div className="mt-3 flex items-start gap-2 text-xs text-red-400">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> <span>{erro}</span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}