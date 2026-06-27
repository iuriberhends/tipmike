// src/screens/BacktestAvulso.jsx
// ABA STANDALONE de backtest: upload de parquet + filtros proprios (sem bot).
// Filtros: mercado/lado, WR do H2H (%), placar (cenario+diff), tempo (quartos),
// black/white list de nicks. Roda via POST /backtest/jobs-avulso e faz polling
// do job ate terminar, mostrando ROI/WR/PnL/Drawdown + RESSALVAS de qualidade.
//
// BLINDADO:
//  - validacao client-side antes de enviar (numeros, faixas, mercado)
//  - polling com timeout (nao roda pra sempre) e cleanup no unmount (sem leak)
//  - le os campos REAIS do job (roi/win_rate sao fracao 0-1; pnl; drawdown_max;
//    green/red/void_count; total_apostas; progresso_msg com as RESSALVAS)
//  - tudo com fallback (resultado parcial nunca quebra a tela)
//
// Depende de ApiBacktest.uploadTicks (existe) + ApiBacktest.createAvulso (novo,
// ver snippet no fim). Rota/menu: ver comentario no fim.

import { useState, useCallback, useRef, useEffect } from 'react';
import { ApiBacktest } from '../lib/api';

const CASAS = ['betano', 'superbet', 'bet365', 'estrelabet', 'meridianbet'];
const ESPORTES = [
  { v: 'fifa', label: 'E-Football (FIFA)' },
  { v: 'nba2k', label: 'E-Basketball (NBA2K)' },
];
const MERCADOS = [
  { v: 'over_under_ft', label: 'Over/Under FT (jogo todo)' },
  { v: 'over_under_ht', label: 'Over/Under HT (1o tempo)' },
];
const LADOS = [
  { v: 'ambos', label: 'Ambos' },
  { v: 'over', label: 'Over' },
  { v: 'under', label: 'Under' },
];
const CENARIOS = [
  { v: '', label: '(qualquer)' },
  { v: 'casa_vencendo', label: 'Casa vencendo' },
  { v: 'casa_perdendo', label: 'Casa perdendo' },
  { v: 'empate', label: 'Empate' },
];

const POLL_MS = 2000;
const POLL_TIMEOUT_MS = 10 * 60 * 1000; // 10min: se passar disso, para e avisa

// converte string de input num numero, ou null se vazio/invalido
function numOuNull(v) {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export default function BacktestAvulso() {
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
  const [wrMin, setWrMin] = useState('');
  const [wrJanela, setWrJanela] = useState('0');
  const [wrMinPartidas, setWrMinPartidas] = useState('10');
  const [cenario, setCenario] = useState('');
  const [difPlacar, setDifPlacar] = useState('');
  const [quartos, setQuartos] = useState({ q1: true, q2: true, q3: true, q4: true });
  const [linhaMin, setLinhaMin] = useState('');
  const [linhaMax, setLinhaMax] = useState('');
  const [blacklist, setBlacklist] = useState('');
  const [whitelist, setWhitelist] = useState('');
  const [stakeValor, setStakeValor] = useState('10');
  const [bancaInicial, setBancaInicial] = useState('1000');

  // execucao
  const [rodando, setRodando] = useState(false);
  const [erro, setErro] = useState(null);
  const [resultado, setResultado] = useState(null);
  const pollRef = useRef(null);
  const pollInicioRef = useRef(null);
  const montadoRef = useRef(true);

  const ehBasket = esporte === 'nba2k';

  // cleanup geral no unmount: para o polling e marca desmontado
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
    // valida extensao no cliente (o backend tambem valida)
    if (!arquivo.name?.toLowerCase().endsWith('.parquet')) {
      setErro('Selecione um arquivo .parquet'); return;
    }
    setSubindo(true); setErro(null); setResumo(null); setUploadId(null); setResultado(null);
    try {
      const res = await ApiBacktest.uploadTicks(arquivo);
      if (!montadoRef.current) return;
      if (!res?.upload_id) {
        setErro('Upload nao retornou um id valido.'); return;
      }
      setUploadId(res.upload_id);
      setResumo(res);
      if (res.casas?.length === 1) setCasa(res.casas[0]);
      if (res.linhas === 0) setErro('Aviso: o arquivo nao tem ticks apos leitura.');
    } catch (e) {
      if (montadoRef.current) setErro(e?.message || 'Falha no upload');
    } finally {
      if (montadoRef.current) setSubindo(false);
    }
  }, [arquivo]);

  // validacao client-side dos filtros antes de enviar
  const validarFiltros = useCallback(() => {
    if (!uploadId) return 'Suba um arquivo primeiro.';
    if (!mercado) return 'Escolha um mercado.';
    const wr = numOuNull(wrMin);
    if (wr != null && (wr < 0 || wr > 100)) return 'WR minimo deve estar entre 0 e 100.';
    const lmin = numOuNull(linhaMin), lmax = numOuNull(linhaMax);
    if (lmin != null && lmax != null && lmin > lmax) return 'Linha min nao pode ser maior que a max.';
    const stake = numOuNull(stakeValor);
    if (stake == null || stake <= 0) return 'Stake deve ser maior que zero.';
    const banca = numOuNull(bancaInicial);
    if (banca == null || banca <= 0) return 'Banca inicial deve ser maior que zero.';
    if (ehBasket) {
      const algumQuarto = Object.values(quartos).some(Boolean);
      if (!algumQuarto) return 'Selecione ao menos um quarto.';
    }
    return null;
  }, [uploadId, mercado, wrMin, linhaMin, linhaMax, stakeValor, bancaInicial, ehBasket, quartos]);

  const handleRodar = useCallback(async () => {
    const msgErro = validarFiltros();
    if (msgErro) { setErro(msgErro); return; }
    setRodando(true); setErro(null); setResultado(null);

    const nicks = (txt) => txt.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
    const quartosAtivos = ehBasket
      ? Object.entries(quartos).filter(([, v]) => v).map(([k]) => k)
      : null;

    const body = {
      upload_id: uploadId,
      mercado, lado, casa, esporte,
      wr_min: numOuNull(wrMin),
      wr_janela: Math.max(0, Math.trunc(numOuNull(wrJanela) ?? 0)),
      wr_min_partidas: Math.max(0, Math.trunc(numOuNull(wrMinPartidas) ?? 10)),
      cenario: cenario || null,
      diferenca_placar: numOuNull(difPlacar),
      quartos: quartosAtivos,
      linha_min: numOuNull(linhaMin),
      linha_max: numOuNull(linhaMax),
      blacklist: nicks(blacklist),
      whitelist: nicks(whitelist),
      stake_modo: 'fixo',
      stake_valor: numOuNull(stakeValor) ?? 10,
      banca_inicial: numOuNull(bancaInicial) ?? 1000,
    };

    try {
      const res = await ApiBacktest.createAvulso(body);
      if (!montadoRef.current) return;
      const jobId = res?.job_id;
      if (!jobId) { setRodando(false); setErro('Job nao foi criado.'); return; }

      pollInicioRef.current = Date.now();
      pollRef.current = setInterval(async () => {
        // timeout de seguranca
        if (Date.now() - pollInicioRef.current > POLL_TIMEOUT_MS) {
          limparPoll();
          if (montadoRef.current) {
            setRodando(false);
            setErro('Backtest demorou demais (timeout). Veja o job no banco.');
          }
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
          // senao (pendente/rodando): continua o polling
        } catch (e) {
          limparPoll();
          if (montadoRef.current) { setRodando(false); setErro(e?.message || 'Erro consultando job.'); }
        }
      }, POLL_MS);
    } catch (e) {
      if (montadoRef.current) { setRodando(false); setErro(e?.message || 'Falha ao criar job.'); }
    }
  }, [validarFiltros, uploadId, mercado, lado, casa, esporte, wrMin, wrJanela,
      wrMinPartidas, cenario, difPlacar, quartos, ehBasket, linhaMin, linhaMax,
      blacklist, whitelist, stakeValor, bancaInicial]);

  // --- helpers de formatacao de resultado (campos REAIS do job) ---
  // roi e win_rate vem como FRACAO (0.21 = 21%). pnl/drawdown_max em unidades.
  const num = (v) => (v == null || Number.isNaN(Number(v)) ? null : Number(v));
  const pct = (frac) => { const n = num(frac); return n == null ? '-' : `${(n * 100).toFixed(2)}%`; };
  const u = (v, d = 2) => { const n = num(v); return n == null ? '-' : n.toFixed(d); };

  const r = resultado || {};
  const roiN = num(r.roi);
  const pnlN = num(r.pnl);
  const ddN = num(r.drawdown_max);
  // RESSALVAS: progresso_msg tem "RESSALVAS: ..." quando ha avisos de qualidade
  const ressalvas = (() => {
    const msg = r.progresso_msg || '';
    const i = msg.indexOf('RESSALVAS:');
    return i >= 0 ? msg.slice(i + 'RESSALVAS:'.length).trim() : '';
  })();
  const semApostas = resultado && (num(r.total_apostas) ?? 0) === 0;

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto', color: '#e5e7eb' }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Backtest avulso</h1>
      <p style={{ color: '#9ca3af', marginBottom: 20, fontSize: 14 }}>
        Suba um parquet de ticks e teste filtros sem precisar de um bot.
      </p>

      {/* UPLOAD */}
      <section style={card}>
        <h3 style={h3}>1. Arquivo de ticks (.parquet)</h3>
        <input type="file" accept=".parquet"
          onChange={(e) => { setArquivo(e.target.files?.[0] || null); setResumo(null); setUploadId(null); setResultado(null); setErro(null); }}
          style={{ marginBottom: 10 }} />
        <button onClick={handleUpload} disabled={!arquivo || subindo} style={btn(!arquivo || subindo)}>
          {subindo ? 'Subindo...' : 'Subir arquivo'}
        </button>
        {resumo && (
          <div style={{ marginTop: 12, fontSize: 13, color: '#9ca3af' }}>
            <div>{(resumo.linhas ?? 0).toLocaleString()} ticks · {resumo.ts_min?.slice(0, 10) || '?'} a {resumo.ts_max?.slice(0, 10) || '?'}</div>
            <div>casas: {resumo.casas?.join(', ') || '-'} · esportes: {resumo.esportes?.join(', ') || '-'}</div>
            {resumo.ligas?.length > 0 && (
              <div>ligas: {resumo.ligas.slice(0, 8).join(', ')}{resumo.ligas.length > 8 ? '...' : ''}</div>
            )}
          </div>
        )}
      </section>

      {/* FILTROS */}
      <section style={card}>
        <h3 style={h3}>2. Filtros</h3>
        <div style={grid}>
          <Campo label="Casa">
            <select value={casa} onChange={(e) => setCasa(e.target.value)} style={inp}>
              {CASAS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Campo>
          <Campo label="Esporte">
            <select value={esporte} onChange={(e) => setEsporte(e.target.value)} style={inp}>
              {ESPORTES.map(s => <option key={s.v} value={s.v}>{s.label}</option>)}
            </select>
          </Campo>
          <Campo label="Mercado">
            <select value={mercado} onChange={(e) => setMercado(e.target.value)} style={inp}>
              {MERCADOS.map(m => <option key={m.v} value={m.v}>{m.label}</option>)}
            </select>
          </Campo>
          <Campo label="Lado">
            <select value={lado} onChange={(e) => setLado(e.target.value)} style={inp}>
              {LADOS.map(l => <option key={l.v} value={l.v}>{l.label}</option>)}
            </select>
          </Campo>
        </div>

        <h4 style={h4}>Porcentagem (WR do H2H)</h4>
        <div style={grid}>
          <Campo label="WR minimo (%)">
            <input type="number" min="0" max="100" value={wrMin} onChange={(e) => setWrMin(e.target.value)}
              placeholder="ex: 30" style={inp} />
          </Campo>
          <Campo label="Janela (0 = todas)">
            <input type="number" min="0" value={wrJanela} onChange={(e) => setWrJanela(e.target.value)}
              placeholder="0, 5, 10..." style={inp} />
          </Campo>
          <Campo label="Min. confrontos">
            <input type="number" min="0" value={wrMinPartidas} onChange={(e) => setWrMinPartidas(e.target.value)}
              style={inp} />
          </Campo>
        </div>

        <h4 style={h4}>Placar</h4>
        <div style={grid}>
          <Campo label="Cenario">
            <select value={cenario} onChange={(e) => setCenario(e.target.value)} style={inp}>
              {CENARIOS.map(c => <option key={c.v} value={c.v}>{c.label}</option>)}
            </select>
          </Campo>
          <Campo label="Diferenca de placar (min.)">
            <input type="number" min="0" value={difPlacar} onChange={(e) => setDifPlacar(e.target.value)}
              placeholder="ex: 2" style={inp} />
          </Campo>
        </div>

        {ehBasket && (
          <>
            <h4 style={h4}>Tempo (quartos)</h4>
            <div style={{ display: 'flex', gap: 16 }}>
              {['q1', 'q2', 'q3', 'q4'].map(q => (
                <label key={q} style={{ fontSize: 14, cursor: 'pointer' }}>
                  <input type="checkbox" checked={!!quartos[q]}
                    onChange={(e) => setQuartos({ ...quartos, [q]: e.target.checked })}
                    style={{ marginRight: 6 }} />
                  {q.toUpperCase()}
                </label>
              ))}
            </div>
          </>
        )}

        <h4 style={h4}>Linha (faixa)</h4>
        <div style={grid}>
          <Campo label="Linha min.">
            <input type="number" value={linhaMin} onChange={(e) => setLinhaMin(e.target.value)} style={inp} />
          </Campo>
          <Campo label="Linha max.">
            <input type="number" value={linhaMax} onChange={(e) => setLinhaMax(e.target.value)} style={inp} />
          </Campo>
        </div>

        <h4 style={h4}>Listas de nicks (separa por virgula ou linha)</h4>
        <div style={grid}>
          <Campo label="Blacklist (bloqueia o nick em qualquer posicao)">
            <textarea value={blacklist} onChange={(e) => setBlacklist(e.target.value)}
              placeholder="Roma, Leyla, Ellen" rows={3} style={{ ...inp, resize: 'vertical' }} />
          </Campo>
          <Campo label="Whitelist (so permite estes nicks; vazio = todos)">
            <textarea value={whitelist} onChange={(e) => setWhitelist(e.target.value)}
              placeholder="(vazio = todos)" rows={3} style={{ ...inp, resize: 'vertical' }} />
          </Campo>
        </div>
      </section>

      {/* STAKE + RODAR */}
      <section style={card}>
        <h3 style={h3}>3. Stake e execucao</h3>
        <div style={grid}>
          <Campo label="Stake (R$)">
            <input type="number" min="0" value={stakeValor} onChange={(e) => setStakeValor(e.target.value)} style={inp} />
          </Campo>
          <Campo label="Banca inicial (R$)">
            <input type="number" min="0" value={bancaInicial} onChange={(e) => setBancaInicial(e.target.value)} style={inp} />
          </Campo>
        </div>
        <button onClick={handleRodar} disabled={!uploadId || rodando} style={btn(!uploadId || rodando, true)}>
          {rodando ? 'Rodando backtest...' : 'Rodar backtest'}
        </button>
      </section>

      {erro && (
        <div style={{ ...card, borderColor: '#7f1d1d', background: '#1f1414', color: '#fca5a5' }}>{erro}</div>
      )}

      {/* RESULTADO */}
      {resultado && (
        <section style={card}>
          <h3 style={h3}>Resultado</h3>
          {semApostas ? (
            <div style={{ color: '#fbbf24', fontSize: 14 }}>
              Nenhuma aposta gerada com esses filtros. Afrouxe os filtros ou confira
              se a casa/esporte/mercado batem com os ticks do arquivo.
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
                <Stat label="ROI" valor={pct(r.roi)} cor={roiN == null ? null : (roiN >= 0 ? '#34d399' : '#f87171')} />
                <Stat label="PnL (u)" valor={u(r.pnl)} cor={pnlN == null ? null : (pnlN >= 0 ? '#34d399' : '#f87171')} />
                <Stat label="WR" valor={pct(r.win_rate)} />
                <Stat label="Apostas" valor={num(r.total_apostas) ?? '-'} />
                <Stat label="Drawdown" valor={u(r.drawdown_max)} cor={ddN ? '#f87171' : null} />
                <Stat label="Green" valor={num(r.green) ?? '-'} cor="#34d399" />
                <Stat label="Red" valor={num(r.red) ?? '-'} cor="#f87171" />
                <Stat label="Void" valor={num(r.void_count) ?? '-'} />
              </div>
              <div style={{ marginTop: 10, fontSize: 13, color: '#9ca3af' }}>
                Streak red max: {num(r.max_streak_red) ?? '-'} ·
                {' '}Dias verdes: {num(r.dias_verdes) ?? '-'}/{num(r.dias_total) ?? '-'}
              </div>
              {ressalvas && (
                <div style={{ marginTop: 12, padding: 10, borderRadius: 8, background: '#27200a', color: '#fbbf24', fontSize: 13 }}>
                  ⚠️ Ressalvas: {ressalvas}
                </div>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}

// ---- subcomponentes + estilos inline (sem dependencia externa) ----
function Campo({ label, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
      <span style={{ color: '#9ca3af' }}>{label}</span>
      {children}
    </label>
  );
}
function Stat({ label, valor, cor }) {
  return (
    <div style={{ background: '#111827', borderRadius: 8, padding: 12, textAlign: 'center' }}>
      <div style={{ fontSize: 12, color: '#9ca3af' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 600, color: cor || '#e5e7eb' }}>{valor}</div>
    </div>
  );
}
const card = { background: '#1f2937', border: '1px solid #374151', borderRadius: 10, padding: 16, marginBottom: 16 };
const h3 = { fontSize: 16, marginBottom: 12, marginTop: 0 };
const h4 = { fontSize: 14, margin: '16px 0 8px', color: '#d1d5db' };
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 };
const inp = { background: '#111827', border: '1px solid #374151', borderRadius: 6, padding: '8px 10px', color: '#e5e7eb', fontSize: 14, width: '100%', boxSizing: 'border-box' };
const btn = (disabled, primary) => ({
  background: disabled ? '#374151' : (primary ? '#0891b2' : '#4b5563'),
  color: '#fff', border: 'none', borderRadius: 6, padding: '10px 18px',
  fontSize: 14, cursor: disabled ? 'not-allowed' : 'pointer', fontWeight: 500,
});

/* ============================================================
   ADICIONAR NA api.js, dentro de ApiBacktest:

     createAvulso: (body) => api.post('/backtest/jobs-avulso', body),

   ADICIONAR NO MENU/ROTAS (onde ficam as outras telas), ex:
     import BacktestAvulso from './screens/BacktestAvulso';
     // rota: <Route path="/backtest-avulso" element={<BacktestAvulso />} />
     // menu: { path: '/backtest-avulso', label: 'Backtest avulso' }
   ============================================================ */