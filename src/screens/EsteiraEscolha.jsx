// ============================================================
// EsteiraEscolha.jsx — a tela de escolha: do garimpo pra esteira
//
// PORTE FIEL do prototipo_ranking.html aprovado: os mesmos 11 critérios
// com alto/baixo/tanto-faz + peso 1-5, os 5 perfis prontos, normalização
// min/max ignorando ≥900, nota = média ponderada, 60 visíveis, G–R fixo,
// barras coloridas, busca, corte de mínimo de apostas, ficha no clique,
// atalhos marcar 10/20/30. O que só o painel pode ter, por cima:
//   · dados do GET /esteira/varreduras/:id/selecao (id, nunca caminho)
//   · linhas que o motor NÃO reproduz ficam bloqueadas, com o motivo
//   · os 4 alertas céticos recalculados AO VIVO conforme a marcação
//   · o botão de verdade: POST /esteira/rodadas origem='varredura'
//
// VISUAL: mesmo dialeto das outras telas (themeVars locais, cardStyle,
// mike-border-thin). As variáveis --mike-* NÃO são globais — cada tela
// declara o themeVars no wrapper. NÃO REMOVER.
//
// 🔌 BACKEND:
//   GET  /varredura/jobs                          garimpos concluídos
//   GET  /esteira/varreduras/:id/selecao          pack colunar + itens + alertas
//   POST /esteira/varreduras/:id/selecao/alertas  alertas da marcação atual
//   GET  /esteira/arquivos                        parquets pro envio
//   POST /esteira/rodadas                         cria a rodada
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Home, ChevronRight, ListChecks, Radar, Play, X, RefreshCw, AlertCircle,
  AlertTriangle, CheckCircle2, ShieldQuestion, Search, SlidersHorizontal,
  Send,
} from 'lucide-react';
import MikeHeader from '../shared/MikeHeader.jsx';
import { api } from '../lib/api.js';
import { BASE_URL, getAccessToken } from '../lib/auth.js';

async function enviarParquet(file) {
  // o MESMO endpoint do backtest avulso (500 MB, valida e resume)
  const fd = new FormData();
  fd.append('arquivo', file, file.name);
  const res = await fetch(`${BASE_URL}/backtest/upload-ticks`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getAccessToken()}` },
    body: fd,
  });
  const j = await res.json().catch(() => null);
  if (!res.ok) throw new Error((j && j.detail) || `HTTP ${res.status}`);
  return j;   // {upload_id, arquivo, ...}
}

// ============================================================
// CONSTANTES — copiadas do protótipo, valor por valor
// ============================================================

const CRITERIOS = [
  { k: 'u_dia',    n: 'Unidades por dia',         dir: 'hi', ex: 'quanto rende por dia' },
  { k: 'WR',       n: 'Taxa de acerto',           dir: 'hi', ex: '% de apostas certas' },
  { k: 'ROI',      n: 'Retorno (ROI)',            dir: 'hi', ex: '% de lucro sobre o apostado' },
  { k: 'premio',   n: 'Vantagem sobre o mercado', dir: 'hi', ex: 'quanto rende ACIMA do que o mercado paga' },
  { k: 'DD',       n: 'Queda máxima',             dir: 'lo', ex: 'o maior tombo da banca, em unidades' },
  { k: 'ldd',      n: 'Lucro por queda',          dir: 'hi', ex: 'cada unidade arriscada rendeu quanto' },
  { k: 'seq_neg',  n: 'Dias ruins seguidos',      dir: 'lo', ex: 'a maior sequência de dias no vermelho' },
  { k: 'pior_dia', n: 'Pior dia',                 dir: 'hi', ex: 'quanto perdeu no pior dia' },
  { k: 'ap_dia',   n: 'Apostas por dia',          dir: 'hi', ex: 'o giro da estratégia' },
  { k: 'conc3',    n: 'Concentração',             dir: 'lo', ex: 'quanto do lucro vem de só 3 jogadores' },
  { k: 'ap',       n: 'Total de apostas',         dir: 'hi', ex: 'tamanho da amostra — pouca aposta, pouca certeza' },
];
// aparece só quando o garimpo tem holdout cruzado
const CRIT_HOLDOUT = { k: 'ROI_ho', n: 'Retorno fora da amostra', dir: 'hi',
                       ex: 'o ROI nos dias que a busca nunca viu' };

const PERFIS = {
  'Sono tranquilo':  { seq_neg: ['lo', 3], DD: ['lo', 3], pior_dia: ['hi', 2], u_dia: ['hi', 1] },
  'Sniper':          { WR: ['hi', 3], ROI: ['hi', 2], DD: ['lo', 2], ldd: ['hi', 2] },
  'Volume':          { u_dia: ['hi', 3], ap_dia: ['hi', 2], WR: ['hi', 1] },
  'Só o que é real': { premio: ['hi', 3], conc3: ['lo', 3], ap: ['hi', 2], seq_neg: ['lo', 1] },
  'Equilíbrio':      { u_dia: ['hi', 2], WR: ['hi', 2], DD: ['lo', 2], seq_neg: ['lo', 2], ap: ['hi', 1] },
};

const VIS_PASSO = 60;          // quantas linhas por página de tabela
const DEBOUNCE_ALERTAS_MS = 700;

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

const COR = { ok: '#10b981', cy: '#22d3ee', warn: '#fbbf24', bad: '#f87171' };

function numOuNull(v) {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
const fmtInt = (n) => (n == null ? '–' : Number(n).toLocaleString('pt-BR'));

// ============================================================
// COMPONENTES BASE (mesmo estilo das outras telas)
// ============================================================

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

function Input({ value, onChange, placeholder, type = 'text', min, step }) {
  return (
    <input
      type={type} min={min} step={step} value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="mike-border-thin bg-transparent text-xs text-[--mike-fg] px-3 py-2 rounded-md outline-none w-full placeholder:text-[--mike-fg-muted]"
    />
  );
}

// ============================================================
// TELA
// ============================================================

export default function EsteiraEscolha({ onNavegar } = {}) {
  // ---- escolha do garimpo ----
  const [garimpos, setGarimpos] = useState([]);
  const [vid, setVid] = useState('');
  const [sel, setSel] = useState(null);           // resposta do GET selecao
  const [carregandoSel, setCarregandoSel] = useState(false);
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);

  // ---- o ranking (estado do protótipo) ----
  const [estado, setEstado] = useState(() => {
    const e = {};
    CRITERIOS.forEach(c => { e[c.k] = { dir: 'off', peso: 2 }; });
    e[CRIT_HOLDOUT.k] = { dir: 'off', peso: 2 };
    return e;
  });
  const [perfilAtivo, setPerfilAtivo] = useState(null);
  const [minAp, setMinAp] = useState('150');
  const [busca, setBusca] = useState('');
  const [marcadas, setMarcadas] = useState(() => new Set());
  const [visN, setVisN] = useState(VIS_PASSO);
  const [fichaR, setFichaR] = useState(null);

  // ---- alertas ao vivo ----
  const [alertas, setAlertas] = useState(null);   // {checks, veredito, resumo, de}
  const debounceRef = useRef(null);

  // ---- envio ----
  const [arquivos, setArquivos] = useState({ parquets: [], uploads: [] });
  const [enviandoPq, setEnviandoPq] = useState(false);
  const pqRef = useRef(null);
  const [variar, setVariar] = useState(false);
  const [nomeRodada, setNomeRodada] = useState('');
  const [fonteArquivo, setFonteArquivo] = useState('');
  const [dias, setDias] = useState('');
  const [enviando, setEnviando] = useState(false);

  const montadoRef = useRef(true);
  useEffect(() => {
    montadoRef.current = true;
    return () => { montadoRef.current = false; };
  }, []);

  // garimpos concluídos + parquets, uma vez
  useEffect(() => {
    (async () => {
      try {
        const l = await api.get('/varredura/jobs', { limite: 50 });
        if (montadoRef.current) {
          setGarimpos((l || []).filter(j => j.status === 'concluido' && j.tem_saida));
        }
      } catch (e) {
        if (montadoRef.current) setErro(e?.message || 'Falha ao listar os garimpos.');
      }
      try {
        const a = await api.get('/esteira/arquivos');
        if (montadoRef.current) setArquivos(a || { parquets: [], uploads: [] });
      } catch { /* o envio avisa se faltar */ }
    })();
  }, []);

  // carregar a seleção do garimpo escolhido
  const carregarSelecao = useCallback(async (id) => {
    setCarregandoSel(true); setErro(null); setSel(null);
    setMarcadas(new Set()); setAlertas(null); setVisN(VIS_PASSO); setFichaR(null);
    try {
      const r = await api.get(`/esteira/varreduras/${id}/selecao`);
      if (!montadoRef.current) return;
      setSel(r);
      setAlertas({ ...r.alertas, de: `do top-${r.alertas.top} por ${r.alertas.criterio}` });
      setNomeRodada(`escolha do garimpo ${id}`);
    } catch (e) {
      if (montadoRef.current) setErro(e?.message || 'Falha ao carregar o garimpo.');
    } finally {
      if (montadoRef.current) setCarregandoSel(false);
    }
  }, []);

  useEffect(() => { if (vid) carregarSelecao(vid); }, [vid, carregarSelecao]);

  // ---- índices de coluna do pack (C do protótipo) ----
  const pk = sel && sel.pack;
  const C = useMemo(() => {
    const m = {};
    if (pk) pk.cols.forEach((c, i) => { m[c] = i; });
    return m;
  }, [pk]);

  const criterios = useMemo(() => (
    sel && sel.holdout_cruzado > 0 ? [...CRITERIOS, CRIT_HOLDOUT] : CRITERIOS
  ), [sel]);

  // min/max UMA vez por pack, ignorando ≥900 — igual ao protótipo
  const MM = useMemo(() => {
    const mm = {};
    if (!pk) return mm;
    for (const c of [...CRITERIOS, CRIT_HOLDOUT]) {
      const i = C[c.k];
      if (i == null) continue;
      let a = 1e18, b = -1e18;
      for (let r = 0; r < pk.rows.length; r++) {
        const v = pk.rows[r][i];
        if (v == null || v >= 900) continue;
        if (v < a) a = v;
        if (v > b) b = v;
      }
      mm[c.k] = [a, b];
    }
    return mm;
  }, [pk, C]);

  const norm = useCallback((k, v) => {
    if (v == null || v >= 900) return 0;
    const mm = MM[k];
    if (!mm) return 0;
    const [a, b] = mm;
    if (b === a) return 0.5;
    const x = (v - a) / (b - a);
    return estado[k] && estado[k].dir === 'lo' ? 1 - x : x;
  }, [MM, estado]);

  const corDe = useCallback((k, v) => {
    const n = norm(k, v);
    return n > 0.66 ? COR.ok : n > 0.33 ? COR.cy : COR.warn;
  }, [norm]);

  // ---- a passada única: filtra + pontua + ordena (o pintar do protótipo) ----
  const ativos = useMemo(
    () => criterios.filter(c => estado[c.k] && estado[c.k].dir !== 'off'),
    [criterios, estado]);

  const lista = useMemo(() => {
    if (!pk) return [];
    const out = [];
    const iAp = C.ap, iD = C.desc, iN = C.nome, iE = C.extra;
    const q = busca.toLowerCase().trim();
    const mAp = Number(minAp) || 0;
    for (let r = 0; r < pk.rows.length; r++) {
      const row = pk.rows[r];
      if ((row[iAp] || 0) < mAp) continue;
      if (q) {
        const alvo = `${row[iD] || ''} ${row[iN] || ''} ${row[iE] || ''}`.toLowerCase();
        if (!alvo.includes(q)) continue;
      }
      let s = 0, p = 0;
      for (const c of ativos) {
        const e = estado[c.k];
        s += norm(c.k, row[C[c.k]]) * e.peso;
        p += e.peso;
      }
      out.push([p ? (s / p) * 100 : 0, r]);
    }
    out.sort((a, b) => b[0] - a[0]);
    return out;
  }, [pk, C, ativos, estado, norm, busca, minAp]);

  // ---- interações do protótipo ----
  const setDir = useCallback((k, d) => {
    setEstado(prev => ({ ...prev, [k]: { ...prev[k], dir: prev[k].dir === d ? 'off' : d } }));
    setPerfilAtivo(null);
  }, []);
  const setPeso = useCallback((k, v) => {
    setEstado(prev => ({ ...prev, [k]: { ...prev[k], peso: Number(v) } }));
  }, []);
  const usarPerfil = useCallback((p) => {
    setEstado(() => {
      const e = {};
      [...CRITERIOS, CRIT_HOLDOUT].forEach(c => { e[c.k] = { dir: 'off', peso: 2 }; });
      Object.entries(PERFIS[p]).forEach(([k, [d, w]]) => { e[k] = { dir: d, peso: w }; });
      return e;
    });
    setPerfilAtivo(p);
  }, []);

  const irrep = (sel && sel.irreproduziveis) || {};
  const bloqueada = useCallback((r) => irrep[String(r)] != null, [irrep]);

  const marcar = useCallback((r, on) => {
    setMarcadas(prev => {
      const s = new Set(prev);
      if (on) s.add(r); else s.delete(r);
      return s;
    });
  }, []);

  const marcarTop = useCallback((n) => {
    if (!n) { setMarcadas(new Set()); return; }
    const s = new Set();
    for (const [, r] of lista) {
      if (bloqueada(r)) continue;      // o motor não reproduz — pula
      s.add(r);
      if (s.size >= n) break;
    }
    setMarcadas(s);
  }, [lista, bloqueada]);

  // ---- alertas ao vivo (debounce) ----
  useEffect(() => {
    if (!sel || !vid) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (marcadas.size === 0) {
      setAlertas(sel.alertas
        ? { ...sel.alertas, de: `do top-${sel.alertas.top} por ${sel.alertas.criterio}` }
        : null);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await api.post(`/esteira/varreduras/${vid}/selecao/alertas`,
                                 { indices: [...marcadas] });
        if (montadoRef.current) {
          setAlertas({ ...r, de: `das suas ${marcadas.size} marcadas` });
        }
      } catch { /* alerta indisponível não trava a escolha */ }
    }, DEBOUNCE_ALERTAS_MS);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [marcadas, sel, vid]);

  // ---- o envio: marcadas -> itens[] -> POST /esteira/rodadas ----
  const handleEnviar = useCallback(async () => {
    if (marcadas.size === 0) { setErro('Marque ao menos uma estratégia.'); return; }
    if (!fonteArquivo || fonteArquivo === '__sep') {
      setErro('Escolha o parquet de ticks pra rodada.'); return;
    }
    setEnviando(true); setErro(null); setAviso(null);
    try {
      const ip = sel.itens_pack;
      const itens = [];
      for (const r of marcadas) {
        const row = ip.rows[r];
        if (!row) continue;            // bloqueada não deveria estar marcada
        const d = {};
        ip.cols.forEach((c, i) => { if (row[i] != null) d[c] = row[i]; });
        if (variar) d.variar = 1;      // liga as vizinhas + hill-climb no worker
        itens.push(d);
      }
      const body = {
        nome: nomeRodada.trim() || `escolha do garimpo ${vid}`,
        origem: 'varredura',
        origem_ref: String(vid),
        itens,
      };
      if (String(fonteArquivo).includes('uploads_backtest')) {
        body.upload_id = fonteArquivo;
      } else {
        body.fonte_arquivo = fonteArquivo;
        const nd = numOuNull(dias);
        if (nd) body.dias = nd;
      }
      const r = await api.post('/esteira/rodadas', body);
      if (!montadoRef.current) return;
      setAviso(`Rodada #${r.id} criada com ${itens.length} estratégias — `
               + (r.na_frente > 0 ? `${r.na_frente} na frente na fila.` : 'entrando na fila.'));
    } catch (e) {
      if (montadoRef.current) setErro(e?.message || 'Falha ao criar a rodada.');
    } finally {
      if (montadoRef.current) setEnviando(false);
    }
  }, [marcadas, sel, vid, nomeRodada, fonteArquivo, dias, variar]);

  // ---- render ----
  const vis = lista.slice(0, visN);
  const nIrrepVis = useMemo(
    () => lista.reduce((n, [, r]) => n + (bloqueada(r) ? 1 : 0), 0),
    [lista, bloqueada]);
  const fichaD = fichaR != null && pk ? pk.rows[fichaR] : null;

  const corVeredito = alertas && (
    alertas.veredito === 'confiavel' ? COR.ok
      : alertas.veredito === 'atencao' ? COR.warn : COR.bad);
  const rotVeredito = alertas && (
    alertas.veredito === 'confiavel' ? 'CONFIÁVEL'
      : alertas.veredito === 'atencao' ? 'ATENÇÃO' : 'NÃO USE');

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
        .esc-seg button { border: 0; background: transparent; color: var(--mike-fg-muted);
          font-size: 9.5px; padding: 3px 7px; border-radius: 4px; cursor: pointer; font-weight: 700; }
        .esc-seg button.on    { background: rgba(6,182,212,.2);  color: #22d3ee; }
        .esc-seg button.on.hi { background: rgba(16,185,129,.2); color: #10b981; }
        .esc-seg button.on.lo { background: rgba(251,191,36,.2); color: #fbbf24; }
        .esc-bar { position: relative; display: block; min-width: 64px; height: 15px;
          background: rgba(0,0,0,.3); border-radius: 4px; overflow: hidden; }
        .esc-bar i { position: absolute; inset: 0 auto 0 0; border-radius: 4px; opacity: .28; }
        .esc-bar b { position: absolute; inset: 0; display: flex; align-items: center;
          justify-content: flex-end; padding-right: 5px; font-size: 10px; font-weight: 800; }
        .esc-row:hover { background: rgba(28, 35, 54, .6); cursor: pointer; }
      `}</style>

      <MikeHeader telaAtiva="esteira" onNavegar={onNavegar} />

      <main className="max-w-screen-2xl mx-auto px-4 lg:px-8 py-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-[--mike-fg-muted] mb-4">
          <button onClick={() => onNavegar?.('today')} className="hover:text-[--mike-fg]">
            <Home className="w-3 h-3" />
          </button>
          <ChevronRight className="w-3 h-3" />
          <button onClick={() => onNavegar?.('esteira')} className="hover:text-[--mike-fg] flex items-center gap-1">
            <ListChecks className="w-3 h-3" /> Esteira
          </button>
          <ChevronRight className="w-3 h-3" />
          <span className="text-[--mike-fg] font-semibold">Escolher do garimpo</span>
        </div>

        {/* Título + escolha do garimpo */}
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[260px]">
            <h1 className="text-xl font-black text-[--mike-fg] flex items-center gap-2">
              <Radar className="w-5 h-5 text-cyan-400" />
              Escolher estratégias para testar
            </h1>
            <p className="text-[11px] text-[--mike-fg-muted] mt-0.5">
              {sel
                ? `Garimpo #${sel.varredura.id} · ${fmtInt(sel.total)} estratégias · você decide o que importa`
                : 'Escolha um garimpo concluído — a lista carrega inteira e o ranking é seu.'}
            </p>
          </div>
          <div className="w-full sm:w-[340px]">
            <Select value={vid} onChange={setVid} options={[
              { value: '', label: 'Escolha o garimpo…' },
              ...garimpos.map(g => ({
                value: String(g.id),
                label: `#${g.id} · ${g.nome}${g.tem_holdout ? ' · com holdout' : ''}`,
              })),
            ]} />
          </div>
        </div>

        {erro && (
          <div className="rounded-lg p-3 flex items-start gap-2 mb-3"
               style={{ backgroundColor: 'rgba(244,63,94,0.08)', border: '0.5px solid rgba(244,63,94,0.35)' }}>
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
            <span className="text-xs text-rose-300 flex-1">{erro}</span>
            <button onClick={() => setErro(null)} className="text-rose-400/60 hover:text-rose-300">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        {aviso && (
          <div className="rounded-lg p-3 flex items-start gap-2 mb-3"
               style={{ backgroundColor: 'rgba(16,185,129,0.08)', border: '0.5px solid rgba(16,185,129,0.3)' }}>
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <span className="text-xs text-emerald-300 flex-1">{aviso}</span>
            <button onClick={() => onNavegar?.('esteira')}
              className="text-[11px] font-bold text-emerald-300 underline underline-offset-2 flex-shrink-0">
              ver na Esteira
            </button>
            <button onClick={() => setAviso(null)} className="text-emerald-400/60 hover:text-emerald-300">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {carregandoSel && (
          <div className="flex items-center justify-center py-16 gap-2 text-[--mike-fg-muted] text-xs">
            <RefreshCw className="w-4 h-4 mike-spin" />
            Carregando o garimpo inteiro (são milhares de configs — uns segundos)...
          </div>
        )}

        {!sel && !carregandoSel && (
          <div className="text-center py-16 text-[--mike-fg-muted] text-xs">
            Nenhum garimpo carregado ainda.
          </div>
        )}

        {sel && !carregandoSel && (
          <div className="grid grid-cols-1 lg:grid-cols-[290px_1fr] gap-4 items-start">

            {/* ===================== ESQUERDA: critérios ===================== */}
            <div className="space-y-4">
              <section className="rounded-lg p-4" style={cardStyle}>
                <SecaoTitulo icon={SlidersHorizontal}>Comece por um perfil</SecaoTitulo>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {Object.keys(PERFIS).map(p => (
                    <button key={p} onClick={() => usarPerfil(p)}
                      className="px-2.5 py-1.5 rounded-md text-[10.5px] font-semibold transition"
                      style={p === perfilAtivo
                        ? { border: '0.5px solid rgba(6,182,212,0.6)', color: '#22d3ee', backgroundColor: 'rgba(6,182,212,0.08)' }
                        : { border: '0.5px solid rgba(60,85,130,0.28)', color: 'var(--mike-fg-soft)', backgroundColor: 'rgba(13,17,27,0.5)' }}>
                      {p}
                    </button>
                  ))}
                </div>
                <label className="flex items-center gap-2 text-[11px] text-[--mike-fg-soft]">
                  mínimo de apostas
                  <span className="w-24">
                    <Input type="number" step="50" value={minAp} onChange={setMinAp} />
                  </span>
                </label>

                <div className="mt-4 mb-1">
                  <SecaoTitulo>Ou ajuste você mesmo</SecaoTitulo>
                </div>
                <p className="text-[10px] text-[--mike-fg-muted] mb-2 -mt-2 leading-snug">
                  Para cada coisa: quer <b>alto</b>, <b>baixo</b> ou <b>tanto faz</b> — e o quanto pesa.
                </p>

                <div className="space-y-1.5">
                  {criterios.map(c => {
                    const e = estado[c.k];
                    return (
                      <div key={c.k} className="rounded-md p-2"
                           style={{ backgroundColor: 'rgba(13,17,27,0.5)', border: '0.5px solid rgba(60,85,130,0.25)' }}>
                        <div className="flex items-center gap-2">
                          <span className="flex-1 text-[11px] font-semibold text-[--mike-fg]">{c.n}</span>
                          <span className="esc-seg flex gap-0.5 rounded-md p-0.5" style={{ background: 'rgba(0,0,0,.3)' }}>
                            <button className={e.dir === 'hi' ? 'on hi' : ''} onClick={() => setDir(c.k, 'hi')}>alto</button>
                            <button className={e.dir === 'lo' ? 'on lo' : ''} onClick={() => setDir(c.k, 'lo')}>baixo</button>
                            <button className={e.dir === 'off' ? 'on' : ''} onClick={() => setDir(c.k, 'off')}>tanto faz</button>
                          </span>
                        </div>
                        {e.dir !== 'off' && (
                          <div className="flex items-center gap-2 mt-1.5">
                            <input type="range" min="1" max="5" value={e.peso}
                                   onChange={(ev) => setPeso(c.k, ev.target.value)}
                                   className="flex-1 h-[3px]" style={{ accentColor: '#22d3ee' }} />
                            <span className="text-[9.5px] text-[--mike-fg-muted] w-11 text-right">
                              {['pouco', '', 'médio', '', 'muito'][e.peso - 1] || `peso ${e.peso}`}
                            </span>
                          </div>
                        )}
                        <div className="text-[9.5px] text-[--mike-fg-muted] mt-1 leading-snug">{c.ex}</div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>

            {/* ===================== DIREITA: alertas + tabela + envio ===================== */}
            <div className="space-y-4 min-w-0">

              {/* alertas céticos */}
              {alertas && (
                <section className="rounded-lg p-3.5" style={cardStyle}>
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldQuestion className="w-4 h-4 flex-shrink-0" style={{ color: corVeredito }} />
                    <span className="text-[12px] font-black" style={{ color: corVeredito }}>{rotVeredito}</span>
                    <span className="text-[11px] text-[--mike-fg-soft] flex-1 truncate">
                      {alertas.resumo} <span className="text-[--mike-fg-muted]">({alertas.de})</span>
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {(alertas.checks || []).map((c, i) => (
                      <div key={i} className="rounded-md px-2.5 py-1.5 flex items-start gap-2"
                           title={(c.detalhe || '') + (c.o_que_fazer ? `\n\nFAZER: ${c.o_que_fazer}` : '')}
                           style={{ backgroundColor: c.ok ? 'rgba(16,185,129,0.05)' : 'rgba(244,63,94,0.06)',
                                    border: `0.5px solid ${c.ok ? 'rgba(16,185,129,0.25)' : 'rgba(244,63,94,0.3)'}` }}>
                        {c.ok
                          ? <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0 mt-0.5" />
                          : <AlertTriangle className="w-3 h-3 text-rose-400 flex-shrink-0 mt-0.5" />}
                        <span className="text-[10.5px] text-[--mike-fg-soft] min-w-0">
                          {c.pergunta} <b style={{ color: c.ok ? COR.ok : COR.bad }}>{c.valor}</b>
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* tabela */}
              <section className="rounded-lg p-4" style={cardStyle}>
                <div className="flex flex-wrap items-center gap-2.5 mb-2">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="w-3.5 h-3.5 text-[--mike-fg-muted] absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input value={busca} onChange={(e) => setBusca(e.target.value)}
                      placeholder="filtrar por config (ex: atr, tot_env, L1.5)"
                      className="mike-border-thin bg-transparent text-xs text-[--mike-fg] pl-8 pr-3 py-2 rounded-md outline-none w-full placeholder:text-[--mike-fg-muted]" />
                  </div>
                  <span className="text-[11px] text-[--mike-fg-muted]">
                    {fmtInt(lista.length)} de {fmtInt(sel.total)} atendem os cortes
                    {nIrrepVis > 0 && <> · <span className="text-amber-400/90">{fmtInt(nIrrepVis)} bloqueadas</span></>}
                  </span>
                </div>

                <div className="text-[10.5px] text-[--mike-fg-muted] mb-2">
                  {ativos.length === 0
                    ? 'Escolha ao menos uma coisa que importa — ou clique num perfil.'
                    : <>Ordenado por <b className="text-[--mike-fg-soft]">
                        {ativos.map(c => `${c.n.toLowerCase()} ${estado[c.k].dir === 'hi' ? 'alto' : 'baixo'}`).join(', ')}
                      </b>. Mostrando {Math.min(visN, lista.length)} de {fmtInt(lista.length)}. Clique na linha pra ver a ficha.</>}
                </div>

                <div className="rounded-md overflow-auto max-h-[62vh]"
                     style={{ border: '0.5px solid rgba(60,85,130,0.28)' }}>
                  <table className="w-full text-[10.5px] font-mono" style={{ borderCollapse: 'collapse' }}>
                    <thead className="sticky top-0 z-10" style={{ backgroundColor: '#111726' }}>
                      <tr className="text-[9px] uppercase tracking-wider text-[--mike-fg-muted]">
                        <th className="px-2 py-1.5" />
                        <th className="text-left px-1 py-1.5 font-bold">#</th>
                        <th className="text-left px-2 py-1.5 font-bold">Estratégia</th>
                        <th className="text-right px-2 py-1.5 font-bold">Nota</th>
                        <th className="text-right px-2 py-1.5 font-bold">G–R</th>
                        {ativos.map(c => (
                          <th key={c.k} className="text-right px-2 py-1.5 font-bold whitespace-nowrap">{c.n}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {vis.map(([sc, r], i) => {
                        const d = pk.rows[r];
                        const blq = bloqueada(r);
                        const on = marcadas.has(r);
                        return (
                          <tr key={r} className="esc-row"
                              onClick={() => setFichaR(r)}
                              style={{
                                borderTop: '0.5px solid rgba(60,85,130,0.18)',
                                backgroundColor: on ? 'rgba(16,185,129,0.07)'
                                  : i < 5 ? 'rgba(6,182,212,0.04)' : 'transparent',
                                opacity: blq ? 0.45 : 1,
                              }}>
                            <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                              <input type="checkbox" checked={on} disabled={blq}
                                title={blq ? irrep[String(r)] : ''}
                                onChange={(e) => marcar(r, e.target.checked)}
                                style={{ accentColor: '#10b981', cursor: blq ? 'not-allowed' : 'pointer' }} />
                            </td>
                            <td className="px-1 py-1.5 text-left font-black text-[--mike-fg-muted]">{i + 1}</td>
                            <td className="px-2 py-1.5 text-left whitespace-nowrap">
                              <span className="text-[8.5px] font-black px-1 py-0.5 rounded mr-1.5"
                                    style={d[C.lado]
                                      ? { color: '#22d3ee', backgroundColor: 'rgba(6,182,212,0.12)' }
                                      : { color: '#a78bfa', backgroundColor: 'rgba(167,139,250,0.12)' }}>
                                {d[C.lado] ? 'FAV' : 'ZEB'}
                              </span>
                              <span className="text-[--mike-fg]">
                                {d[C.desc] || d[C.nome] || d[C.extra] || '?'}
                                {d[C.teto] ? <span className="text-[--mike-fg-muted]"> · teto {d[C.teto]}</span> : null}
                              </span>
                              {blq && <AlertTriangle className="w-2.5 h-2.5 text-amber-400 inline ml-1.5" title={irrep[String(r)]} />}
                            </td>
                            <td className="px-2 py-1.5 text-right font-black text-[--mike-fg]">{sc.toFixed(0)}</td>
                            <td className="px-2 py-1.5 text-right whitespace-nowrap">
                              <b style={{ color: COR.ok }}>{d[C.G]}</b>
                              <span className="text-[--mike-fg-muted]">–</span>
                              <b style={{ color: COR.bad }}>{d[C.R]}</b>
                            </td>
                            {ativos.map(c => {
                              const v = d[C[c.k]];
                              const p = Math.round(norm(c.k, v) * 100);
                              const t = (v == null || v >= 900) ? '—'
                                : Math.abs(v) >= 100 ? Number(v).toFixed(0) : Number(v).toFixed(1);
                              return (
                                <td key={c.k} className="px-2 py-1">
                                  <span className="esc-bar">
                                    <i style={{ width: `${p}%`, background: corDe(c.k, v) }} />
                                    <b style={{ color: 'var(--mike-fg)' }}>{t}</b>
                                  </span>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {lista.length > visN && (
                  <button onClick={() => setVisN(v => v + 200)}
                    className="mt-2 text-[11px] font-semibold text-[--mike-fg-soft] hover:text-[--mike-fg] mike-border-thin rounded-md px-3 py-1.5 transition">
                    mostrar mais 200 (de {fmtInt(lista.length)})
                  </button>
                )}

                {/* atalhos + contagem */}
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <span className="text-[11px] text-[--mike-fg-soft] font-semibold">
                    {marcadas.size} marcadas
                    {marcadas.size > 0 && pk && (() => {
                      let fav = 0;
                      marcadas.forEach((r) => { if (pk.rows[r] && pk.rows[r][C.lado]) fav += 1; });
                      return <span className="text-[--mike-fg-muted] font-normal">
                        {' '}({fav} fav · {marcadas.size - fav} zeb)
                      </span>;
                    })()}
                    {' '}· ~{Math.round(marcadas.size * (variar ? 6 : 1) * 1.2)} min
                  </span>
                  <span className="flex-1" />
                  <span className="text-[10.5px] text-[--mike-fg-muted]">marcar as primeiras:</span>
                  {[10, 20, 30, 50].map(n => (
                    <button key={n} onClick={() => marcarTop(n)}
                      className="mike-border-thin rounded-md px-2.5 py-1 text-[11px] font-bold text-[--mike-fg-soft] hover:text-[--mike-fg] transition">
                      {n}
                    </button>
                  ))}
                  <button onClick={() => marcarTop(0)}
                    className="mike-border-thin rounded-md px-2.5 py-1 text-[11px] font-bold text-[--mike-fg-muted] hover:text-rose-300 transition">
                    limpar
                  </button>
                </div>
              </section>

              {/* envio */}
              <section className="rounded-lg p-4" style={cardStyle}>
                <SecaoTitulo icon={Send}>Mandar pra esteira</SecaoTitulo>
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_110px] gap-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] text-[--mike-fg-soft] font-medium">Nome da rodada</span>
                    <Input value={nomeRodada} onChange={setNomeRodada} placeholder={`escolha do garimpo ${vid}`} />
                  </label>
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] text-[--mike-fg-soft] font-medium">Parquet de ticks</span>
                    <Select value={fonteArquivo} onChange={setFonteArquivo} options={[
                      { value: '', label: 'Escolha o parquet…' },
                      ...(arquivos.parquets || []).map(p => ({
                        value: p.nome, label: `${p.nome} · ${p.mb} MB`,
                      })),
                      ...((arquivos.uploads || []).length ? [
                        { value: '__sep', label: '— gerados no servidor (backtest / MikeDB / enviados) —' },
                      ] : []),
                      ...(arquivos.uploads || []).map(p => ({
                        value: p.upload_id, label: `☁ ${p.nome} · ${p.mb} MB`,
                      })),
                    ]} />
                    <div>
                      <input ref={pqRef} type="file" accept=".parquet" className="hidden"
                        onChange={async (e) => {
                          const f = e.target.files && e.target.files[0];
                          e.target.value = '';
                          if (!f) return;
                          setEnviandoPq(true); setErro(null);
                          try {
                            const r = await enviarParquet(f);
                            const a2 = await api.get('/esteira/arquivos');
                            if (montadoRef.current) {
                              setArquivos(a2 || { parquets: [], uploads: [] });
                              setFonteArquivo(r.upload_id);
                              setAviso(`Parquet ${r.arquivo} enviado e já selecionado.`);
                            }
                          } catch (err) {
                            if (montadoRef.current) setErro(err?.message || 'Falha no envio do parquet.');
                          } finally {
                            if (montadoRef.current) setEnviandoPq(false);
                          }
                        }} />
                      <button onClick={() => pqRef.current && pqRef.current.click()}
                        disabled={enviandoPq}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-semibold mike-border-thin text-[--mike-fg-soft] hover:text-[--mike-fg] transition disabled:opacity-50">
                        {enviandoPq
                          ? <><RefreshCw className="w-3 h-3 mike-spin" /> Enviando (pode demorar)...</>
                          : <>Enviar parquet do PC</>}
                      </button>
                    </div>
                  </div>
                  {!String(fonteArquivo).includes('uploads_backtest') ? (
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] text-[--mike-fg-soft] font-medium">Últimos N dias</span>
                      <Input type="number" min="1" value={dias} onChange={setDias} placeholder="tudo" />
                    </label>
                  ) : (
                    <div className="text-[10px] text-[--mike-fg-muted] self-end pb-2">
                      Enviado entra inteiro.
                    </div>
                  )}
                </div>

                <label className="mt-3 flex items-start gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={variar}
                         onChange={(e) => setVariar(e.target.checked)}
                         style={{ accentColor: '#22d3ee', marginTop: 2 }} />
                  <span className="text-[11px] text-[--mike-fg-soft] leading-snug">
                    <b>Testar variações das marcadas</b> — cada uma ganha vizinhas
                    de largada (chip ±5, linha ±1 passo, teto ±2, folga ±1) e, se
                    uma vizinha render mais que a mãe, o hill-climb anda mais um
                    passo sozinho na mesma direção.
                    <span className="text-[--mike-fg-muted]"> Rodada fica ~3-9×
                    maior; a sentinela e o cache da base seguem valendo.</span>
                  </span>
                </label>
                <button onClick={handleEnviar}
                  disabled={enviando || marcadas.size === 0 || !fonteArquivo}
                  className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-bold transition disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ backgroundColor: (enviando || marcadas.size === 0 || !fonteArquivo) ? 'rgba(16,185,129,0.2)' : '#10b981',
                           color: (enviando || marcadas.size === 0 || !fonteArquivo) ? '#6b7691' : '#0b0f1a',
                           boxShadow: (enviando || marcadas.size === 0 || !fonteArquivo) ? 'none' : '0 4px 12px rgba(16,185,129,0.3)' }}>
                  {enviando ? <><RefreshCw className="w-4 h-4 mike-spin" /> Criando rodada...</>
                            : <><Play className="w-4 h-4" /> Testar as {marcadas.size || ''} marcadas
                                {variar ? ' + variações' : ''} na esteira</>}
                </button>
                <div className="text-[9px] text-[--mike-fg-muted] mt-1.5 text-center">
                  Cada marcada vira um backtest no motor real — com sentinela e variações.
                  A rodada aparece na aba Esteira.
                </div>
              </section>
            </div>
          </div>
        )}
      </main>

      {/* ficha da estratégia */}
      {fichaD && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
             style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
             onClick={() => setFichaR(null)}>
          <div className="rounded-lg p-4 w-full max-w-sm"
               style={{ backgroundColor: '#141a28', border: '0.5px solid rgba(60,85,130,0.5)' }}
               onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-[13px] font-black text-[--mike-fg] flex-1">
                {fichaD[C.lado] ? 'FAVORITO' : 'ZEBRA'} · {fichaD[C.desc] || fichaD[C.nome] || '?'}
                {fichaD[C.teto] ? ` · teto ${fichaD[C.teto]}` : ''}
              </h3>
              <button onClick={() => setFichaR(null)} className="text-[--mike-fg-muted] hover:text-[--mike-fg]">
                <X className="w-4 h-4" />
              </button>
            </div>
            {bloqueada(fichaR) && (
              <div className="mb-2.5 rounded-md p-2 text-[10.5px] text-amber-300"
                   style={{ backgroundColor: 'rgba(251,191,36,0.08)', border: '0.5px solid rgba(251,191,36,0.3)' }}>
                {irrep[String(fichaR)]}
              </div>
            )}
            <div className="space-y-1 text-[11px]">
              {[
                ['greens – reds', <><b style={{ color: COR.ok }}>{fichaD[C.G]}</b> – <b style={{ color: COR.bad }}>{fichaD[C.R]}</b></>],
                ['apostas', fmtInt(fichaD[C.ap])],
                ['taxa de acerto', fichaD[C.WR] != null ? `${fichaD[C.WR]}%` : '—'],
                ['unidades', fichaD[C.u]],
                ['retorno (ROI)', fichaD[C.ROI] != null ? `${fichaD[C.ROI]}%` : '—'],
                ['vantagem sobre o mercado', fichaD[C.premio] != null ? `${Number(fichaD[C.premio]).toFixed(1)} pontos` : '—'],
                ['fora da amostra (holdout)', fichaD[C.ROI_ho] != null ? `${fichaD[C.ROI_ho]}% em ${fmtInt(fichaD[C.ap_ho])} ap` : '—'],
                ['por dia', `${fichaD[C.ap_dia] ?? '—'} apostas · ${fichaD[C.u_dia] ?? '—'}u`],
                ['queda máxima', fichaD[C.DD] != null ? `${fichaD[C.DD]}u` : '—'],
                ['lucro por queda', fichaD[C.ldd] ?? '—'],
                ['dias', `${fichaD[C.dias_pos] ?? '—'} bons / ${fichaD[C.dias_neg] ?? '—'} ruins`],
                ['dias ruins seguidos', fichaD[C.seq_neg] ?? '—'],
                ['pior dia', fichaD[C.pior_dia] != null ? `${fichaD[C.pior_dia]}u` : '—'],
                ['1ª metade → 2ª', `${fichaD[C.m1] ?? '—'}% → ${fichaD[C.m2] ?? '—'}%`],
                ['concentração (top 3)', (fichaD[C.conc3] == null || fichaD[C.conc3] >= 200) ? '—' : `${fichaD[C.conc3]}%`],
                ['jogadores envolvidos', fichaD[C.n_alvos] ?? '—'],
                ['corte extra', fichaD[C.extra] || 'nenhum'],
              ].map(([a, b], i) => (
                <div key={i} className="flex items-center justify-between gap-3 py-0.5"
                     style={{ borderBottom: '0.5px solid rgba(60,85,130,0.15)' }}>
                  <span className="text-[--mike-fg-muted]">{a}</span>
                  <span className="text-[--mike-fg] font-semibold text-right">{b}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
