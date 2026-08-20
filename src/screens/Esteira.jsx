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
  CheckCircle2, Clock, Hash, RotateCcw, Trash2, ShieldCheck, Settings2, Radar,
  Copy, ArrowUp, ArrowDown, Minus, Maximize2,
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

// ---- rotulo legivel a partir do snapshot._planilha (o codigo fica no hover)
function rotuloDoItem(it) {
  const p = it.snapshot && it.snapshot._planilha;
  if (!p) return it.nome;
  const lados = p.linha_min != null && Number(p.linha_min) < 0 ? 'FAV' :
                p.linha_max != null && Number(p.linha_max) > 0 ? 'ZEB' : '';
  const linha = (p.linha_min != null || p.linha_max != null)
    ? `L${p.linha_min ?? ''}${p.linha_max != null ? `–${p.linha_max}` : '+'}` : '';
  const chip = (p.chip_wr_min != null && Number(p.chip_wr_min) > 0)
    ? `${p.chip_janela || 'chip'}≥${Math.round(Number(p.chip_wr_min) * 100)}%` : '';
  const extras = [];
  if (p.atropelo_min != null) extras.push(`atr≥${p.atropelo_min}`);
  if (p.tot_env_max != null) extras.push(`env≤${p.tot_env_max}`);
  if (p.tot_env_min != null) extras.push(`env≥${p.tot_env_min}`);
  if (p.folga_min != null || p.folga_max != null)
    extras.push(`folga ${p.folga_min ?? ''}~${p.folga_max ?? ''}`);
  if (p.teto) extras.push(`teto ${fmtN(p.teto)}`);
  const r = [lados, linha, chip, ...extras].filter(Boolean).join(' ');
  return r || it.nome;
}

// o que a variacao mudou: o [sufixo] que o worker poe no nome
function sufixoVariacao(nome) {
  const m = /\[([^\]]+)\]\s*$/.exec(nome || '');
  return m ? m[1] : nome;
}

// ---- filtros do snapshot em portugues, pra ficha ----
const JANELAS_PT = { 'últ. 10': 'últimos 10 confrontos', 'últ. 20': 'últimos 20 confrontos',
                     'últ. 30': 'últimos 30 confrontos', 'todas': 'todos os confrontos',
                     'all': 'todos os confrontos', 'l10': 'últimos 10 confrontos',
                     'l20': 'últimos 20 confrontos', 'l30': 'últimos 30 confrontos' };
const janelaPt = (j) => JANELAS_PT[String(j ?? '').toLowerCase()] || j || 'janela';
// numeros da planilha vem como float ("2.0") — inteiro mostra sem casa
const fmtN = (v) => {
  const x = Number(v);
  return Number.isFinite(x) ? (Number.isInteger(x) ? String(x) : String(x)) : String(v);
};
const semCorte = (mn, mx) => (mn == null || Number(mn) <= 0) && mx == null;
function filtrosEmPortugues(pl) {
  if (!pl) return [];
  const L = [];
  const pct = (v) => `${Math.round(Number(v) * 100)}%`;
  if (!semCorte(pl.chip_wr_min, pl.chip_wr_max)) {
    let t = `${janelaPt(pl.chip_janela)} `;
    if (pl.chip_wr_min != null && Number(pl.chip_wr_min) > 0) t += `≥ ${pct(pl.chip_wr_min)}`;
    if (pl.chip_wr_max != null) t += `${Number(pl.chip_wr_min) > 0 ? ' e ' : ''}≤ ${pct(pl.chip_wr_max)}`;
    if (pl.chip_conf != null) t += `, mínimo ${fmtN(pl.chip_conf)} confrontos`;
    if (pl.chip_conf_max != null) t += `, máximo ${fmtN(pl.chip_conf_max)}`;
    L.push(['Chip de winrate', t]);
  } else if (pl.chip_conf != null) {
    L.push(['Chip de winrate', `sem corte de % — mínimo ${fmtN(pl.chip_conf)} confrontos`]);
  }
  if (!semCorte(pl.chip2_wr_min, pl.chip2_wr_max)) {
    let t = `${janelaPt(pl.chip2_janela)} `;
    if (pl.chip2_wr_min != null && Number(pl.chip2_wr_min) > 0) t += `≥ ${pct(pl.chip2_wr_min)}`;
    if (pl.chip2_wr_max != null) t += `${Number(pl.chip2_wr_min) > 0 ? ' e ' : ''}≤ ${pct(pl.chip2_wr_max)}`;
    L.push(['2º chip', t]);
  }
  if (pl.linha_min != null || pl.linha_max != null) {
    const fav = pl.linha_min != null && Number(pl.linha_min) < 0;
    L.push(['Linha', `de ${pl.linha_min ?? '—'} a ${pl.linha_max ?? '—'}`
                     + (fav ? ' (favorito)' : Number(pl.linha_min) > 0 ? ' (zebra)' : '')]);
  }
  if (pl.odd_min != null || pl.odd_max != null)
    L.push(['Odd', `de ${pl.odd_min ?? '—'} a ${pl.odd_max ?? '—'}`]);
  if (pl.atropelo_min != null || pl.atropelo_max != null)
    L.push(['Filtro de goleada', `${pl.atropelo_min != null ? `a partir de ${pl.atropelo_min}%` : ''}`
      + `${pl.atropelo_max != null ? `${pl.atropelo_min != null ? ' até ' : 'até '}${pl.atropelo_max}%` : ''}`]);
  if (pl.tot_env_min != null || pl.tot_env_max != null)
    L.push(['Soma do placar', `${pl.tot_env_min != null ? `a partir de ${pl.tot_env_min}` : ''}`
      + `${pl.tot_env_max != null ? `${pl.tot_env_min != null ? ' até ' : 'até '}${pl.tot_env_max} pontos` : ''}`]);
  if (pl.folga_min != null || pl.folga_max != null)
    L.push(['Folga da linha', `de ${pl.folga_min ?? '—'} a ${pl.folga_max ?? '—'}`]);
  if (pl.teto) L.push(['Máx. por jogo', `${fmtN(pl.teto)} aposta${Number(pl.teto) > 1 ? 's' : ''}`]);
  if (pl.evitar_linhas_seq != null)
    L.push(['Linhas em sequência', Number(pl.evitar_linhas_seq) ? 'evita' : 'não evita']);
  if (pl.mercado) L.push(['Mercado', String(pl.mercado)]);
  return L;
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

function agruparPlacar(itens) {
  // sentinela e controle saem da tabela (sao regua, nao estrategia);
  // variacoes aninham sob a mae; maes por ROI desc, zeradas no fim
  const regua = itens.filter((x) => x.papel === 'sentinela' || x.papel === 'controle');
  const maes = itens.filter((x) => x.papel !== 'sentinela' && x.papel !== 'controle'
                                   && x.papel !== 'variacao');
  const vars_ = itens.filter((x) => x.papel === 'variacao');
  const roi = (x) => {
    const r = x.metricas && Number(x.metricas.ROI);
    return Number.isFinite(r) ? r : -Infinity;
  };
  maes.sort((a, b) => (roi(b) - roi(a)) || (a.ordem - b.ordem));
  const porPai = {};
  vars_.forEach((v) => {
    (porPai[v.pai_item_id] = porPai[v.pai_item_id] || []).push(v);
  });
  Object.values(porPai).forEach((l) => l.sort((a, b) => roi(b) - roi(a)));
  const orfas = vars_.filter((v) => !maes.some((m) => m.id === v.pai_item_id));
  return { regua, grupos: maes.map((m) => ({ mae: m, variacoes: porPai[m.id] || [] })), orfas };
}

function CelRoi({ m, baseline }) {
  const roiN = m && Number(m.ROI);
  const cor = !Number.isFinite(roiN) ? 'var(--mike-fg-muted)'
    : roiN > 0 ? '#10b981' : roiN < 0 ? '#f43f5e' : 'var(--mike-fg-soft)';
  const premio = (Number.isFinite(roiN) && baseline && baseline.ROI != null)
    ? roiN - Number(baseline.ROI) : null;
  return (
    <td className="px-2 py-1.5 text-right font-bold" style={{ color: cor }}
        title={premio != null ? `${premio > 0 ? '+' : ''}${premio.toFixed(1)} pts sobre o mercado` : ''}>
      {Number.isFinite(roiN) ? fmt1(roiN) : '–'}
    </td>
  );
}

function LinhaItem({ it, mae, baseline, onFicha, completo = false }) {
  const m = it.metricas || {};
  const emErro = it.status === 'erro';
  const rodando = it.status === 'rodando' || it.status === 'pendente';
  const zerada = !emErro && Number(m.apostas || 0) === 0 && it.status === 'concluido';
  const ehVar = it.papel === 'variacao';
  // a seta da variacao: melhorou/igualou/piorou vs a mae
  let seta = null;
  if (ehVar && mae && mae.metricas && Number.isFinite(Number(m.ROI))
      && Number.isFinite(Number(mae.metricas.ROI))) {
    const d = Number(m.ROI) - Number(mae.metricas.ROI);
    seta = Math.abs(d) < 0.5 ? 'igual' : d > 0 ? 'sobe' : 'desce';
  }
  const r3 = m.roi_3d, r7 = m.roi_7d;
  const cor37 = (v) => (v == null ? 'var(--mike-fg-muted)'
    : v > 0 ? '#10b981' : v < 0 ? '#f87171' : 'var(--mike-fg-soft)');
  return (
    <tr onClick={() => onFicha && onFicha(it)}
        title={emErro ? (it.erro || 'erro') : it.nome}
        style={{
          borderTop: '0.5px solid rgba(60,85,130,0.18)',
          backgroundColor: 'transparent',
          opacity: zerada ? 0.45 : 1,
          cursor: 'pointer',
        }}>
      <td className="px-2 py-1.5 text-left max-w-0 w-full">
        <div className="flex items-center gap-1.5 min-w-0"
             style={{ paddingLeft: ehVar ? 16 : 0 }}>
          {ehVar && (
            <span className="text-[9px] font-black flex-shrink-0 text-[--mike-fg-muted]">
              ↳ {sufixoVariacao(it.nome)}
            </span>
          )}
          {!ehVar && (
            <span className="truncate text-[--mike-fg]">{rotuloDoItem(it)}</span>
          )}
          {seta === 'sobe' && <ArrowUp className="w-2.5 h-2.5 text-emerald-400 flex-shrink-0" title="melhorou vs a mãe" />}
          {seta === 'desce' && <ArrowDown className="w-2.5 h-2.5 text-rose-400 flex-shrink-0" title="piorou vs a mãe" />}
          {seta === 'igual' && <Minus className="w-2.5 h-2.5 text-[--mike-fg-muted] flex-shrink-0" title="igual à mãe" />}
          {emErro && <AlertTriangle className="w-2.5 h-2.5 text-rose-400 flex-shrink-0" />}
          {rodando && <RefreshCw className="w-2.5 h-2.5 text-cyan-400 mike-spin flex-shrink-0" />}
        </div>
      </td>
      <td className="px-2 py-1.5 text-right text-[--mike-fg-soft]">{fmt(m.apostas) ?? '–'}</td>
      <td className="px-2 py-1.5 text-right font-bold whitespace-nowrap">
        {m.greens != null
          ? <><span style={{ color: '#10b981' }}>{m.greens}</span>
              <span className="text-[--mike-fg-muted]">–</span>
              <span style={{ color: '#f87171' }}>{m.reds}</span></>
          : (m['G-R'] || '–')}
      </td>
      <td className="px-2 py-1.5 text-right text-[--mike-fg-soft]">{m.WR != null ? fmt1(m.WR) : '–'}</td>
      <td className="px-2 py-1.5 text-right font-bold"
          style={{ color: m.unidades == null ? 'var(--mike-fg-muted)'
            : Number(m.unidades) > 0 ? '#10b981'
            : Number(m.unidades) < 0 ? '#f43f5e' : 'var(--mike-fg-soft)' }}>
        {m.unidades != null ? fmt1(m.unidades) : '–'}
      </td>
      <CelRoi m={m} baseline={baseline} />
      {completo && (
        <td className="px-2 py-1.5 text-right text-[--mike-fg-soft]">{m.u_dia != null ? fmt1(m.u_dia) : '–'}</td>
      )}
      <td className="px-2 py-1.5 text-right text-[--mike-fg-soft]">{m.DD != null ? fmt1(m.DD) : '–'}</td>
      {completo && (
        <td className="px-2 py-1.5 text-right whitespace-nowrap"
            title={`G–R: ${m.GR_3d || '–'} (3d) · ${m.GR_7d || '–'} (7d)`}>
          <span style={{ color: cor37(r3) }}>{r3 != null ? fmt1(r3) : '–'}</span>
          <span className="text-[--mike-fg-muted]"> / </span>
          <span style={{ color: cor37(r7) }}>{r7 != null ? fmt1(r7) : '–'}</span>
        </td>
      )}
    </tr>
  );
}

function Placar({ itens, baseline, onFicha, completo = false }) {
  if (!itens || itens.length === 0) {
    return (
      <div className="text-center py-6 text-[--mike-fg-muted] text-xs">
        Sem itens ainda — eles aparecem quando o worker monta a rodada.
      </div>
    );
  }
  const { grupos, orfas } = agruparPlacar(itens);
  return (
    <div className="rounded-md overflow-hidden" style={{ border: '0.5px solid rgba(60,85,130,0.28)' }}>
      <div className={completo ? 'max-h-[70vh] overflow-y-auto' : 'max-h-[420px] overflow-y-auto'}>
        <table className="w-full text-[10.5px] font-mono">
          <thead className="sticky top-0 z-10" style={{ backgroundColor: '#111726' }}>
            <tr className="text-[9px] uppercase tracking-wider text-[--mike-fg-muted]">
              <th className="text-left  px-2 py-1.5 font-bold">Estratégia</th>
              <th className="text-right px-2 py-1.5 font-bold">Ap</th>
              <th className="text-right px-2 py-1.5 font-bold whitespace-nowrap">G–R</th>
              <th className="text-right px-2 py-1.5 font-bold">WR</th>
              <th className="text-right px-2 py-1.5 font-bold" title="unidades — o lucro total">u</th>
              <th className="text-right px-2 py-1.5 font-bold">ROI</th>
              {completo && (
                <th className="text-right px-2 py-1.5 font-bold whitespace-nowrap" title="unidades por dia">u/dia</th>
              )}
              <th className="text-right px-2 py-1.5 font-bold">DD</th>
              {completo && (
                <th className="text-right px-2 py-1.5 font-bold whitespace-nowrap" title="ROI dos últimos 3 e 7 dias">3d/7d</th>
              )}
            </tr>
          </thead>
          <tbody>
            {grupos.map(({ mae, variacoes }) => (
              [<LinhaItem key={mae.id} it={mae} baseline={baseline} onFicha={onFicha} completo={completo} />,
               ...variacoes.map((v) => (
                 <LinhaItem key={v.id} it={v} mae={mae} baseline={baseline} onFicha={onFicha} completo={completo} />
               ))]
            ))}
            {orfas.map((v) => (
              <LinhaItem key={v.id} it={v} baseline={baseline} onFicha={onFicha} completo={completo} />
            ))}
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
  const [fichaItem, setFichaItem] = useState(null);
  const [placarCheio, setPlacarCheio] = useState(false);

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
        <div className="mb-5 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[240px]">
            <h1 className="text-xl font-black text-[--mike-fg] flex items-center gap-2">
              <ListChecks className="w-5 h-5 text-cyan-400" />
              Esteira
            </h1>
            <p className="text-[11px] text-[--mike-fg-muted] mt-0.5">
              Roda a planilha de estratégias no motor real — com sentinela,
              variações e o placar de cada uma.
            </p>
          </div>
          <button onClick={() => onNavegar?.('esteira_escolha')}
            className="flex items-center gap-2 px-3.5 py-2 rounded-md text-[12px] font-bold transition"
            style={{ border: '0.5px solid rgba(6,182,212,0.5)', color: '#22d3ee',
                     backgroundColor: 'rgba(6,182,212,0.08)' }}>
            <Radar className="w-3.5 h-3.5" /> Escolher do garimpo
          </button>
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
              <button onClick={() => onNavegar?.('escolher')}
                className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-[11px] font-bold mike-border-thin text-cyan-300 hover:bg-cyan-500/10 transition">
                <ListChecks className="w-3.5 h-3.5" />
                Ou escolher direto de um garimpo (com alertas céticos)
              </button>
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
                <div className="flex items-center justify-between">
                  <SecaoTitulo icon={Trophy}>Placar</SecaoTitulo>
                  {d && its.length > 0 && (
                    <button onClick={() => setPlacarCheio(true)}
                      title="abrir o placar completo (todas as colunas)"
                      className="mb-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[10.5px] font-bold mike-border-thin text-[--mike-fg-soft] hover:text-[--mike-fg] transition">
                      <Maximize2 className="w-3 h-3" /> expandir
                    </button>
                  )}
                </div>

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
                              <> · mercado inteiro: {fmt(d.baseline.apostas)} ap,
                                ROI {fmt1(d.baseline.ROI)}% — é isso que as
                                estratégias precisam bater</>
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
                    <Placar itens={its} baseline={d.baseline}
                            onFicha={(it) => setFichaItem(it)} />
                    <div className="text-[9px] text-[--mike-fg-muted] mt-1.5">
                      Ordenado por ROI, variações aninhadas na mãe, zeradas no
                      fim. Clique na linha pra ficha; em <b>expandir</b>, todas
                      as colunas (u/dia, 3d/7d). O hover do ROI mostra a
                      vantagem sobre o mercado.
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

      {/* placar completo em tela cheia */}
      {placarCheio && d && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 lg:p-8"
             style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
             onClick={() => setPlacarCheio(false)}>
          <div className="rounded-lg p-4 w-full max-w-6xl max-h-[92vh] overflow-hidden flex flex-col"
               style={{ backgroundColor: '#0f1420', border: '0.5px solid rgba(60,85,130,0.5)' }}
               onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="w-4 h-4 text-cyan-400" />
              <span className="text-[13px] font-black text-[--mike-fg] flex-1 truncate">
                Placar — #{d.id} {d.nome}
              </span>
              <button onClick={() => setPlacarCheio(false)}
                      className="text-[--mike-fg-muted] hover:text-[--mike-fg]">
                <X className="w-4 h-4" />
              </button>
            </div>
            {d.sentinela_ok != null && d.baseline && d.baseline.ROI != null && (
              <div className="mb-2 text-[11px] text-[--mike-fg-soft]">
                <ShieldCheck className="w-3.5 h-3.5 inline mr-1"
                             style={{ color: d.sentinela_ok ? '#10b981' : '#f43f5e' }} />
                Mercado inteiro: {fmt(d.baseline.apostas)} ap · ROI {fmt1(d.baseline.ROI)}%
                — é isso que as estratégias precisam bater.
              </div>
            )}
            <div className="flex-1 min-h-0 overflow-auto">
              <Placar itens={its} baseline={d.baseline} completo
                      onFicha={(it) => setFichaItem(it)} />
            </div>
            <div className="text-[9px] text-[--mike-fg-muted] mt-2">
              u/dia e 3d/7d só existem em rodadas rodadas com o worker novo —
              nas antigas aparecem como "–". Clique na linha pra ficha.
            </div>
          </div>
        </div>
      )}

      {/* ficha do item: metricas completas + filtros em portugues */}
      {fichaItem && (() => {
        const it = fichaItem;
        const m = it.metricas || {};
        const pl = it.snapshot && it.snapshot._planilha;
        const filtros = filtrosEmPortugues(pl);
        const premio = (m.ROI != null && d && d.baseline && d.baseline.ROI != null)
          ? Number(m.ROI) - Number(d.baseline.ROI) : null;
        const Lin = ({ a, b, hint }) => (
          <div className="flex items-center justify-between gap-3 py-0.5"
               title={hint || ''}
               style={{ borderBottom: '0.5px solid rgba(60,85,130,0.15)' }}>
            <span className="text-[--mike-fg-muted]">{a}</span>
            <span className="text-[--mike-fg] font-semibold text-right">{b}</span>
          </div>
        );
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
               style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
               onClick={() => setFichaItem(null)}>
            <div className="rounded-lg p-4 w-full max-w-md max-h-[85vh] overflow-y-auto"
                 style={{ backgroundColor: '#141a28', border: '0.5px solid rgba(60,85,130,0.5)' }}
                 onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start gap-2 mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-[13px] font-black text-[--mike-fg]">
                    {rotuloDoItem(it)}
                  </h3>
                  <div className="text-[10px] text-[--mike-fg-muted] font-mono truncate">
                    {it.nome}{it.papel !== 'estrategia' ? ` · ${it.papel}` : ''}
                  </div>
                </div>
                <button onClick={() => setFichaItem(null)}
                        className="text-[--mike-fg-muted] hover:text-[--mike-fg] flex-shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {it.erro && (
                <div className="mb-2.5 rounded-md p-2 text-[10.5px] text-rose-300"
                     style={{ backgroundColor: 'rgba(244,63,94,0.08)', border: '0.5px solid rgba(244,63,94,0.3)' }}>
                  {it.erro}
                </div>
              )}

              <div className="space-y-1 text-[11px] mb-3">
                <Lin a="greens – reds" b={<span>
                  <b style={{ color: '#10b981' }}>{m.greens ?? '—'}</b>
                  <span className="text-[--mike-fg-muted]"> – </span>
                  <b style={{ color: '#f87171' }}>{m.reds ?? '—'}</b></span>} />
                <Lin a="apostas · taxa de acerto" b={`${fmt(m.apostas) ?? '—'} · ${m.WR ?? '—'}%`} />
                <Lin a="unidades · retorno (ROI)" b={`${m.unidades ?? '—'}u · ${m.ROI ?? '—'}%`} />
                {premio != null && (
                  <Lin a="vantagem sobre o mercado"
                       b={`${premio > 0 ? '+' : ''}${premio.toFixed(1)} pontos`}
                       hint="ROI da estratégia menos o ROI do mercado inteiro (a sentinela)" />
                )}
                <Lin a="por dia" b={`${m.ap_dia ?? '—'} apostas · ${m.u_dia ?? '—'}u`} />
                <Lin a="dias" b={`${m.dias_pos ?? '—'} bons / ${m.dias_neg ?? '—'} ruins de ${m.dias ?? '—'}`} />
                <Lin a="dias ruins seguidos" b={m.seq_neg ?? '—'}
                     hint="a maior sequência de dias no vermelho" />
                <Lin a="pior dia" b={m.pior_dia != null ? `${m.pior_dia}u` : '—'} />
                <Lin a="queda máxima · lucro por queda" b={`${m.DD ?? '—'}u · ${m.lucro_dd ?? '—'}`}
                     hint="o maior tombo da banca; e quanto cada unidade arriscada rendeu" />
                <Lin a="1ª metade → 2ª" b={`${m.roi_m1 ?? '—'}% → ${m.roi_m2 ?? '—'}%`}
                     hint="estabilidade dentro do próprio período" />
                <Lin a="últimos 3 dias" b={`${m.GR_3d || '—'} · ROI ${m.roi_3d ?? '—'}%`} />
                <Lin a="últimos 7 dias" b={`${m.GR_7d || '—'} · ROI ${m.roi_7d ?? '—'}%`} />
                <Lin a="quanto esfriou no fim" b={m.queda_ponta != null ? `${m.queda_ponta} pts` : '—'}
                     hint="ROI recente menos o da 2ª metade — negativo forte = morrendo" />
                <Lin a="treino → cego" b={m.roi_cego != null
                       ? `${m.roi_treino ?? '—'}% → ${m.roi_cego}% (${m.ap_cego} ap)` : '—'}
                     hint="os últimos ~30% das apostas, que a leitura do resto nunca viu" />
                <Lin a="força do sinal (z)" b={m.z_jogo ?? '—'}
                     hint="lucro médio por jogo dividido pela variação — acima de 2 é sinal firme" />
                <Lin a="concentração (top 3 duplas)" b={m.top3_par_pct != null ? `${m.top3_par_pct}%` : '—'}
                     hint="quanto do lucro vem de só 3 confrontos" />
                <Lin a="jogos · período" b={`${m.jogos ?? '—'} · ${m.de ?? ''} a ${m.ate ?? ''}`} />
                <Lin a="ainda está de pé?" b={m.vivo === 1 ? 'sim' : m.vivo === 0 ? 'não' : '—'}
                     hint="a régua do worker: janelas recentes sem prejuízo" />
              </div>

              {filtros.length > 0 && (
                <>
                  <div className="text-[10px] uppercase tracking-wider font-bold text-[--mike-fg-muted] mb-1.5">
                    Filtros desta estratégia
                  </div>
                  <div className="space-y-1 text-[11px] mb-3">
                    {filtros.map(([a2, b2], i2) => <Lin key={i2} a={a2} b={b2} />)}
                  </div>
                </>
              )}

              <div className="flex items-center gap-2">
                {it.backtest_job_id && (
                  <button
                    onClick={() => {
                      navigator.clipboard && navigator.clipboard.writeText(String(it.backtest_job_id));
                      setAviso(`id do backtest ${it.backtest_job_id} copiado.`);
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-semibold mike-border-thin text-[--mike-fg-soft] hover:text-[--mike-fg] transition">
                    <Copy className="w-3 h-3" /> backtest #{it.backtest_job_id}
                  </button>
                )}
                <span className="flex-1" />
                {it.snapshot && (
                  <details className="text-[10px] text-[--mike-fg-muted]">
                    <summary className="cursor-pointer hover:text-[--mike-fg-soft]">ver o JSON cru</summary>
                    <pre className="mt-2 p-2 rounded-md max-w-[360px] max-h-48 overflow-auto text-[9px]"
                         style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}>
                      {JSON.stringify(it.snapshot, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
