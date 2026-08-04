// src/shared/MikeDbPanel.jsx
// ---------------------------------------------------------------------------
// Aba "MikeDB" da seção 1 do backtest avulso.
//
// O QUE FAZ: em vez de o Santos puxar os ticks da VPS, consolidar na mão,
// rodar o backtest_csv e subir o parquet, ele escolhe casa/liga/período aqui
// e o SERVIDOR gera o arquivo — que entra no backtest pelo MESMO caminho do
// upload (mesmo upload_id, mesmo resumo), com opção de baixar o parquet.
//
// DUAS VIAS (o painel escolhe sozinho, e deixa trocar):
//   • histórico  -> recorta o parquet particionado dos coletores (segundos)
//   • betsapi    -> raspa a BetsAPI (bet365 sem coletor próprio; leva horas e
//                   exige o Chrome com CDP aberto — o painel avisa antes)
//
// O componente NÃO decide nada sobre o backtest: ao terminar, chama
// onGerado(resultado) e quem manda é a tela de cima.
// ---------------------------------------------------------------------------
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Database, Play, Download, RefreshCw, CheckCircle2, AlertTriangle, Terminal,
} from 'lucide-react';
import { ApiMikeDb } from '../lib/api.js';

const POLL_MS = 2000;
const STALL_MS = 15 * 60 * 1000;   // sem avanço nenhum: aí sim desiste
const TETO_MS = 8 * 60 * 60 * 1000; // raspagem de BetsAPI pode ser longa

// os nomes de pasta vêm sanitizados e com mojibake do coletor
// ("Liga_dos_CampeÃµes"): arruma só pra EXIBIR — o valor enviado é o cru.
const MOJIBAKE = [['Ã§', 'ç'], ['Ã£', 'ã'], ['Ãµ', 'õ'], ['Ã©', 'é'], ['Ã¡', 'á'],
                  ['Ã­', 'í'], ['Ã³', 'ó'], ['Ãº', 'ú'], ['Ã ', 'à'], ['Ã¢', 'â'],
                  ['Ãª', 'ê'], ['Ã´', 'ô'], ['Ã‡', 'Ç'], ['Ã‰', 'É'], ['Âº', 'º']];

function bonito(liga) {
  let s = String(liga || '');
  MOJIBAKE.forEach(([a, b]) => { s = s.split(a).join(b); });
  return s.replace(/_/g, ' ').trim();
}

const MERCADOS = [
  { valor: '', rotulo: 'Todos os mercados' },
  { valor: 'HANDICAP', rotulo: 'Handicap' },
  { valor: 'OVER_UNDER', rotulo: 'Over/Under' },
  { valor: 'MATCH_RESULT', rotulo: 'Money Line' },
];

export default function MikeDbPanel({ onGerado }) {
  const [status, setStatus] = useState(null);
  const [catalogo, setCatalogo] = useState(null);
  const [carregando, setCarregando] = useState(true);

  const [casa, setCasa] = useState('');
  const [liga, setLiga] = useState('');
  const [mercado, setMercado] = useState('');
  const [jogador, setJogador] = useState('');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [via, setVia] = useState('auto');

  const [fase, setFase] = useState('idle');  // idle | gerando | pronto
  const [pct, setPct] = useState(0);
  const [etapa, setEtapa] = useState('');
  const [log, setLog] = useState([]);
  const [verLog, setVerLog] = useState(false);
  const [erro, setErro] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [baixando, setBaixando] = useState(false);

  const pollRef = useRef(null);
  const vivoRef = useRef(true);
  useEffect(() => () => { vivoRef.current = false; clearInterval(pollRef.current); }, []);

  // ---------------------------------------------------------------- carga --
  const carregar = useCallback(async (casaAlvo) => {
    setCarregando(true); setErro(null);
    try {
      const [st, cat] = await Promise.all([
        ApiMikeDb.status(),
        ApiMikeDb.catalogo(casaAlvo || undefined),
      ]);
      if (!vivoRef.current) return;
      setStatus(st);
      setCatalogo(cat);
      // período default = tudo que o histórico cobre (o usuário aperta)
      if (cat?.periodo && !de && !ate) { setDe(cat.periodo.de); setAte(cat.periodo.ate); }
    } catch (e) {
      setErro(String(e.message || e));
    } finally {
      if (vivoRef.current) setCarregando(false);
    }
  }, [de, ate]);

  useEffect(() => { carregar(''); /* eslint-disable-next-line */ }, []);

  const trocarCasa = async (nova) => {
    setCasa(nova); setLiga('');
    setVia('auto');
    await carregar(nova);
  };

  // bet365 tem as duas vias: histórico local (rápido) e BetsAPI (raspa agora)
  const casaEhBet365 = (casa || '').toLowerCase() === 'bet365';
  const temHistoricoLocal = !!(catalogo?.ligas?.length);
  const usandoBetsapi = via === 'betsapi' || (via === 'auto' && casaEhBet365);

  // ---------------------------------------------------------------- gerar --
  const seguir = useCallback((jobId) => {
    const inicio = Date.now();
    let ultimoAvanco = Date.now();
    let ultimoPct = -1;
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const parado = Date.now() - ultimoAvanco > STALL_MS;
      if (parado || Date.now() - inicio > TETO_MS) {
        clearInterval(pollRef.current);
        if (vivoRef.current) {
          setFase('idle');
          setErro(parado
            ? 'A geração ficou 15min sem avançar — pode ter morrido no servidor.'
            : 'Acompanhamento encerrado; o job pode seguir rodando no servidor.');
        }
        return;
      }
      try {
        const j = await ApiMikeDb.job(jobId);
        if (!vivoRef.current) return;
        if (j.progresso !== ultimoPct) { ultimoPct = j.progresso; ultimoAvanco = Date.now(); }
        setPct(j.progresso || 0);
        setEtapa(j.etapa || '');
        setLog(j.log || []);
        if (j.status === 'concluido') {
          clearInterval(pollRef.current);
          setResultado(j.resultado);
          setFase('pronto');
          onGerado?.(j.resultado);   // entrega pro backtest (mesmo upload_id)
        } else if (j.status === 'erro') {
          clearInterval(pollRef.current);
          setErro(j.erro || 'falhou');
          setFase('idle');
          setVerLog(true);           // erro: abre o log sozinho
        }
      } catch (e) {
        clearInterval(pollRef.current);
        if (vivoRef.current) { setErro(String(e.message || e)); setFase('idle'); }
      }
    }, POLL_MS);
  }, [onGerado]);

  const gerar = async () => {
    setErro(null); setResultado(null); setLog([]); setPct(0);
    setEtapa('enviando pedido...'); setFase('gerando');
    try {
      const { job_id } = await ApiMikeDb.gerar({
        casa: casa || undefined,
        liga: liga || undefined,
        mercado: mercado || undefined,
        jogador: jogador || undefined,
        de: de || undefined,
        ate: ate || undefined,
        via,
      });
      seguir(job_id);
    } catch (e) {
      setErro(String(e.message || e)); setFase('idle');
    }
  };

  const baixar = async () => {
    if (!resultado?.upload_id) return;
    setBaixando(true);
    try {
      await ApiMikeDb.download(resultado.upload_id, resultado.arquivo);
    } catch (e) {
      setErro(`falha ao baixar: ${e.message || e}`);
    } finally {
      setBaixando(false);
    }
  };

  // ----------------------------------------------------------------- UI ----
  const inputCls = 'w-full px-2 py-1.5 rounded-md text-[11px] bg-transparent mike-border-thin text-[--mike-fg] outline-none focus:border-cyan-500/60 transition';
  const labelCls = 'block text-[10px] font-semibold text-[--mike-fg-muted] mb-1';
  const gerando = fase === 'gerando';

  if (carregando && !catalogo) {
    return (
      <div className="flex items-center gap-2 text-[11px] text-[--mike-fg-muted] py-3">
        <RefreshCw className="w-3.5 h-3.5 mike-spin" /> lendo o catálogo do servidor...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* diagnóstico só aparece quando algo está fora do lugar */}
      {status && !status.hist_existe && (
        <div className="rounded-md p-2 text-[10px] flex items-start gap-1.5"
             style={{ backgroundColor: 'rgba(245,158,11,0.08)', border: '0.5px solid rgba(245,158,11,0.3)' }}>
          <AlertTriangle className="w-3 h-3 text-amber-400 mt-0.5 shrink-0" />
          <span className="text-amber-300">
            histórico não encontrado em <code>{status.hist_dir}</code> — rode o
            consolidar_parquet ou ajuste MIKEBACKTEST_HIST.
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div>
          <label className={labelCls}>Casa</label>
          <select className={inputCls} value={casa} disabled={gerando}
                  onChange={(e) => trocarCasa(e.target.value)}>
            <option value="">Todas</option>
            {(catalogo?.casas || []).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="col-span-2">
          <label className={labelCls}>
            Liga {catalogo?.ligas?.length ? `(${catalogo.ligas.length})` : ''}
          </label>
          {usandoBetsapi ? (
            <select className={inputCls} value={liga} disabled={gerando}
                    onChange={(e) => setLiga(e.target.value)}>
              <option value="">Escolha a liga da BetsAPI</option>
              {(status?.ligas_betsapi || []).map((l) => (
                <option key={l.valor} value={l.valor}>{l.rotulo}</option>
              ))}
            </select>
          ) : (
            <select className={inputCls} value={liga} disabled={gerando}
                    onChange={(e) => setLiga(e.target.value)}>
              <option value="">Todas as ligas</option>
              {(catalogo?.ligas || []).map((l) => (
                <option key={l.liga} value={l.liga}>
                  {bonito(l.liga)} · {l.dias}d
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className={labelCls}>Mercado</label>
          <select className={inputCls} value={mercado} disabled={gerando}
                  onChange={(e) => setMercado(e.target.value)}>
            {MERCADOS.map((m) => (
              <option key={m.valor} value={m.valor}>{m.rotulo}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls}>De</label>
          <input type="date" className={inputCls} value={de} disabled={gerando}
                 onChange={(e) => setDe(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Até</label>
          <input type="date" className={inputCls} value={ate} disabled={gerando}
                 onChange={(e) => setAte(e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className={labelCls}>Jogador (opcional)</label>
          <input className={inputCls} value={jogador} disabled={gerando}
                 placeholder="ex: CARNAGE"
                 onChange={(e) => setJogador(e.target.value.toUpperCase())} />
        </div>
      </div>

      {/* bet365 tem as duas vias — deixa escolher em vez de impor */}
      {casaEhBet365 && (
        <div className="rounded-md p-2 space-y-1.5"
             style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '0.5px solid rgba(255,255,255,0.07)' }}>
          <div className="text-[10px] font-semibold text-[--mike-fg-muted]">Origem dos ticks da bet365</div>
          <div className="flex flex-wrap gap-3 text-[10px]">
            <label className="flex items-center gap-1.5 cursor-pointer text-[--mike-fg-soft]">
              <input type="radio" name="via" checked={via !== 'betsapi'} disabled={gerando}
                     onChange={() => setVia('historico')} />
              Histórico local {temHistoricoLocal ? '(rápido)' : '(vazio)'}
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer text-[--mike-fg-soft]">
              <input type="radio" name="via" checked={via === 'betsapi'} disabled={gerando}
                     onChange={() => setVia('betsapi')} />
              Raspar a BetsAPI agora
            </label>
          </div>
          {via === 'betsapi' && (
            <div className="text-[10px] flex items-start gap-1.5"
                 style={{ color: status?.chrome_cdp_aberto ? '#34d399' : '#fbbf24' }}>
              {status?.chrome_cdp_aberto
                ? <><CheckCircle2 className="w-3 h-3 mt-0.5 shrink-0" /> Chrome do CDP aberto — pode raspar (leva horas em períodos longos).</>
                : <><AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" /> Chrome do CDP fechado: abra na VPS com --remote-debugging-port=9222, logado na BetsAPI, senão o job falha na largada.</>}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={gerar} disabled={gerando}
                className="flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-bold transition disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: gerando ? 'rgba(6,182,212,0.2)' : '#06b6d4', color: gerando ? '#6b7691' : '#0b0f1a' }}>
          {gerando ? <><RefreshCw className="w-3.5 h-3.5 mike-spin" /> Gerando...</>
                   : <><Play className="w-3.5 h-3.5" /> Gerar ticks</>}
        </button>

        {resultado?.upload_id && (
          <button onClick={baixar} disabled={baixando}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-md text-[11px] font-semibold mike-border-thin text-[--mike-fg-soft] hover:text-[--mike-fg] transition">
            {baixando ? <RefreshCw className="w-3.5 h-3.5 mike-spin" /> : <Download className="w-3.5 h-3.5" />}
            Baixar parquet
          </button>
        )}

        {(log.length > 0) && (
          <button onClick={() => setVerLog((v) => !v)}
                  className="flex items-center gap-1.5 px-2 py-2 rounded-md text-[10px] text-[--mike-fg-muted] hover:text-[--mike-fg] transition">
            <Terminal className="w-3 h-3" /> {verLog ? 'ocultar log' : 'ver log'}
          </button>
        )}
      </div>

      {gerando && (
        <div className="space-y-1">
          <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
            <div className="h-full transition-all duration-500"
                 style={{ width: `${pct}%`, backgroundColor: '#06b6d4' }} />
          </div>
          <div className="flex justify-between text-[10px] text-[--mike-fg-muted]">
            <span>{etapa}</span><span>{pct}%</span>
          </div>
        </div>
      )}

      {resultado && (
        <div className="rounded-md p-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px]"
             style={{ backgroundColor: 'rgba(16,185,129,0.06)', border: '0.5px solid rgba(16,185,129,0.25)' }}>
          <span className="flex items-center gap-1 text-emerald-400 font-bold">
            <CheckCircle2 className="w-3 h-3" /> {(resultado.linhas ?? 0).toLocaleString()} ticks
          </span>
          <span className="text-[--mike-fg-muted]">
            {resultado.ts_min?.slice(0, 10) || '?'} a {resultado.ts_max?.slice(0, 10) || '?'}
          </span>
          <span className="text-[--mike-fg-muted]">casas: {resultado.casas?.join(', ') || '-'}</span>
          <span className="text-[--mike-fg-muted]">esportes: {resultado.esportes?.join(', ') || '-'}</span>
          <span className="text-emerald-400/70">pronto pro backtest ↓</span>
        </div>
      )}

      {erro && (
        <div className="rounded-md p-2 text-[10px] text-red-300 flex items-start gap-1.5"
             style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '0.5px solid rgba(239,68,68,0.3)' }}>
          <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" /> <span>{erro}</span>
        </div>
      )}

      {verLog && log.length > 0 && (
        <pre className="rounded-md p-2 text-[9px] leading-relaxed overflow-auto max-h-52 mike-mono"
             style={{ backgroundColor: 'rgba(0,0,0,0.35)', border: '0.5px solid rgba(255,255,255,0.07)', color: '#8b93a7' }}>
          {log.join('\n')}
        </pre>
      )}
    </div>
  );
}