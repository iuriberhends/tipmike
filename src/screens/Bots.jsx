// ============================================================
// Bots.jsx — Tela de listagem de bots (v2: linha horizontal expandível)
//
// Layout NOVO:
// - Linha colapsada: estrela | logo esporte | estado | #ID | tendência | nome
//                    [...] CASA · MERCADO · "Bot ativado" · 🕐 ⬇ HISTÓRICO VER
// - Linha expandida (ao clicar VER):
//   - Mesmo header (mas botão vira MINIMIZAR)
//   - Centro: descrição + 5 cards (Tips/Lucro/Greens/Reds/ROI) com dados reais
//   - Direita: Stake · DESATIVAR · TREINAMENTO · STOP NÃO CONFIGURADO · EDITAR · DELETAR
//
// API:
// - ApiBots.list, get, delete, start, stop, clone (já existente)
// - ApiBots.stats(botId, modo='simulado') -> { tips, lucro, greens, reds, roi, wr }
// - ModalHistorico em Historico.jsx (separado)
// ============================================================

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  Search, Bell, Settings, ChevronDown, Home, Activity, Store, Bot, Table2, BarChart3, Plus,
  X, FilterX, Filter, Trash2, Edit2, Copy, Play, Pause, RefreshCw,
  AlertCircle, AlertTriangle, CheckCircle2, ChevronRight,
  Star, Share2, Clock, Download, History, Maximize2, Minimize2,
  TrendingUp, TrendingDown, DollarSign, Percent,
  Power,
  Folder, FolderPlus, FolderInput, CheckSquare, Square, Pencil,
} from 'lucide-react';
import MikeHeader from '../shared/MikeHeader.jsx';
import BacktestModal from './BacktestModal';
import { ModalHistorico } from './Historico';
import { ApiBots, ApiBotsOrg } from '../lib/api';

// ============================================================
// CONSTANTES
// ============================================================

const CASAS = {
  betano:     { id: 'betano',     label: 'BETANO',     color: '#10b981' },
  superbet:   { id: 'superbet',   label: 'SUPERBET',   color: '#10b981' },
  bet365:     { id: 'bet365',     label: 'BET365',     color: '#10b981' },
  estrelabet: { id: 'estrelabet', label: 'ESTRELABET', color: '#10b981' },
  novibet:    { id: 'novibet',    label: 'NOVIBET',    color: '#10b981' },
  vupi:       { id: 'vupi',       label: 'VUPI',       color: '#10b981' },
};

const ESPORTES = {
  fifa:    { id: 'fifa',    label: 'FIFA',    short: 'fifa',   logo: 'FIFA',  cor: '#dc2626' },
  nba2k:   { id: 'nba2k',   label: 'NBA2K',   short: 'nba2k',  logo: 'NBA2K', cor: '#dc2626' },
  ehockey: { id: 'ehockey', label: 'EHockey', short: 'hockey', logo: 'NHL',   cor: '#3b82f6' },
  etennis: { id: 'etennis', label: 'eTennis', short: 'tennis', logo: 'ATP',   cor: '#f59e0b' },
};

const MERCADOS_LABEL = {
  over_under_ft:        'Over/Under FT',
  over_under_ht:        'Over/Under 1T',
  asian_over_under_ft:  'Asiático FT',
  asian_over_under_ht:  'Asiático 1T',
  ah_ft:                'HC Asiático',
  ah_ht:                'HC Asiático 1T',
  eh_ft:                'HC Europeu',
  eh_ht:                'HC Europeu 1T',
  // v37: o mercado e' o TOTAL do time/jogador (Over OU Under)
  over_under_ft_player: 'Total Jogador',
  over_under_ht_player: 'Total Jog. 1T',
  ml_ft:                'Resultado Final',
  ml_ht:                'Resultado 1T',
  btts_ft:              'Ambos Marcam',
  btts_ht:              'Ambos Marcam 1T',
  double_ml_ft:         'Dupla Chance',
  next_goal:            'Próximo Gol',
  odd_even_ft:          'Par/Ímpar',
  odd_even_ht:          'Par/Ímpar 1T',
};

// v50: paleta dos grupos (mesmas cores do resto do sistema)
const CORES_GRUPO = ['#10b981', '#0891b2', '#3b82f6', '#8b5cf6', '#f59e0b', '#f43f5e', '#64748b'];

function normaliza(s) {
  return (s || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function fmtNum(n, opts = {}) {
  const { sufixo = '', sinal = false, casas = 2 } = opts;
  if (n === null || n === undefined || isNaN(n)) return '—';
  const num = parseFloat(n);
  const fmt = num.toFixed(casas);
  return `${sinal && num >= 0 ? '+' : ''}${fmt}${sufixo}`;
}

// ============================================================
// CARD DE STAT (igual à foto: bordinha cinza, valor grande)
// ============================================================

function CardStat({ label, valor, negativo = false, loading = false }) {
  const bgValor = negativo ? '#fde2e7' : '#e2e8f0';
  const colorValor = negativo ? '#9f1239' : '#0f172a';
  const bgLabel = negativo ? '#fecdd3' : '#cbd5e1';
  const colorLabel = negativo ? '#881337' : '#334155';

  return (
    <div className="rounded-md overflow-hidden" style={{ minWidth: '74px' }}>
      <div className="text-center text-[10px] font-bold py-1 px-2"
           style={{ backgroundColor: bgLabel, color: colorLabel }}>
        {label}
      </div>
      <div className="text-center text-[14px] font-mono font-bold py-1.5 px-2"
           style={{ backgroundColor: bgValor, color: colorValor }}>
        {loading ? '...' : valor}
      </div>
    </div>
  );
}

// ============================================================
// LINHA EXPANDIDA - corpo que aparece quando clica em VER
// ============================================================

function CorpoExpandido({ bot, stats, statsLoading, onAcao, loadingAcao, isAtivo }) {
  const lucroNeg = stats && parseFloat(stats.lucro || 0) < 0;
  const roiNeg = stats && parseFloat(stats.roi || 0) < 0;

  return (
    <div className="px-4 py-4 flex items-stretch gap-4" style={{
      borderTop: '0.5px solid rgba(60, 85, 130, 0.4)',
      backgroundColor: 'rgba(20, 26, 40, 0.3)',
    }}>
      <div className="flex-1 min-w-0 flex flex-col items-center justify-center gap-3">
        <p className="text-[11px] italic text-[--mike-fg-muted] text-center max-w-2xl leading-relaxed">
          {bot.descricao && bot.descricao.trim()
            ? bot.descricao
            : 'Nenhuma descrição foi dada a esse bot. Edite o bot e adicione uma, se preferir.'}
        </p>

        <div className="flex items-stretch gap-1.5 flex-wrap justify-center">
          <CardStat label="Tips"   valor={stats ? stats.tips : '—'} loading={statsLoading} />
          <CardStat label="Lucro"  valor={stats ? fmtNum(stats.lucro, { sufixo: ' un.', sinal: true }) : '—'} negativo={lucroNeg} loading={statsLoading} />
          <CardStat label="Greens" valor={stats ? stats.greens : '—'} loading={statsLoading} />
          <CardStat label="Reds"   valor={stats ? stats.reds : '—'} loading={statsLoading} />
          <CardStat label="ROI"    valor={stats ? fmtNum(stats.roi, { sufixo: '%', sinal: true }) : '—'} negativo={roiNeg} loading={statsLoading} />
        </div>
      </div>

      <div className="flex-shrink-0 flex flex-col items-stretch gap-2 w-[160px]">
        <div className="rounded-md px-3 py-2 flex items-center justify-between" style={{
          backgroundColor: 'rgba(16, 185, 129, 0.08)',
          border: '0.5px solid rgba(16, 185, 129, 0.3)',
        }}>
          <div>
            <div className="text-[9px] uppercase tracking-wider text-[--mike-fg-muted]">Stake</div>
            <div className="text-[13px] font-mono font-bold text-[--mike-fg]">R$ 10</div>
          </div>
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
        </div>

        <button
          onClick={() => onAcao(isAtivo ? 'pausar' : 'ligar', bot.id)}
          disabled={loadingAcao}
          className="px-3 py-2 rounded-md text-[11px] font-bold uppercase tracking-wider transition disabled:opacity-50"
          style={{
            backgroundColor: isAtivo ? '#f59e0b' : '#10b981',
            color: '#0b0f1a',
          }}
        >
          {isAtivo ? 'Desativar' : 'Ativar'}
        </button>

        <button
          onClick={() => onAcao('treinamento', bot.id)}
          disabled={loadingAcao}
          className="px-3 py-2 rounded-md text-[11px] font-bold uppercase tracking-wider transition disabled:opacity-50"
          style={{
            backgroundColor: bot.em_treinamento ? '#3b82f6' : 'rgba(59, 130, 246, 0.15)',
            color: bot.em_treinamento ? '#fff' : '#60a5fa',
            border: bot.em_treinamento ? 'none' : '0.5px solid rgba(59, 130, 246, 0.4)',
          }}
          title={bot.em_treinamento
            ? 'Modo treinamento ATIVO - bot simula mas NAO envia Telegram. Clique pra desligar.'
            : 'Modo producao - bot envia tips no Telegram. Clique pra ligar treinamento.'}
        >
          {bot.em_treinamento ? '🎓 Treinando' : 'Treinamento'}
        </button>

        <button
          onClick={() => onAcao('backtest', bot.id)}
          disabled={loadingAcao}
          className="px-3 py-2 rounded-md text-[11px] font-bold uppercase tracking-wider transition disabled:opacity-50 flex items-center justify-center gap-1.5"
          style={{
            backgroundColor: 'rgba(6, 182, 212, 0.15)',
            border: '0.5px solid rgba(6, 182, 212, 0.4)',
            color: '#22d3ee',
          }}
          title="Rodar backtest deste bot (banco ou upload de arquivo)"
        >
          <BarChart3 className="w-3.5 h-3.5" />
          Backtest
        </button>

        <div className="flex items-center justify-between mt-auto pt-1">
          <button
            onClick={() => onAcao('editar', bot.id)}
            className="text-[11px] font-bold uppercase tracking-wider text-[--mike-fg-soft] hover:text-[--mike-accent] transition"
          >
            Editar
          </button>
          <button
            onClick={() => onAcao('deletar', bot.id)}
            disabled={loadingAcao}
            className="text-[11px] font-bold uppercase tracking-wider text-rose-400 hover:text-rose-300 transition disabled:opacity-50"
          >
            Deletar
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// LINHA DO BOT
// ============================================================

function LinhaBot({ bot, expandido, onToggleExpand, onAcao, loadingAcao, onAbrirHistorico, stats, statsLoading, onBaixarCsv, loadingCsv,
                    onToggleFav, favLoading, modoSelecao, selecionado, onToggleSel, grupo }) {
  const casa = CASAS[bot.casa] || { label: (bot.casa || '').toUpperCase(), color: '#64748b' };
  const esporte = ESPORTES[bot.esporte] || { label: (bot.esporte || '').toUpperCase(), cor: '#64748b' };
  const isAtivo = bot.status === 'ativo';
  const mercadoLabel = MERCADOS_LABEL[bot.mercado] || bot.mercado;

  const lucro = stats?.lucro;
  const tendUp = lucro !== undefined && parseFloat(lucro) >= 0;
  const TendIcon = tendUp ? TrendingUp : TrendingDown;
  const tendColor = lucro === undefined ? '#64748b' : (tendUp ? '#10b981' : '#f43f5e');

  const borderColor = isAtivo ? '#10b981' : 'rgba(60, 85, 130, 0.4)';

  return (
    <div className="rounded-md overflow-hidden transition" style={{
      backgroundColor: 'transparent',
      border: '0.5px solid rgba(60, 85, 130, 0.4)',
      borderLeft: `3px solid ${borderColor}`,
    }}>
      <div className="flex items-center gap-2 px-3 py-2.5 flex-wrap">
        {modoSelecao && (
          <button
            onClick={() => onToggleSel(bot.id)}
            className={`flex-shrink-0 transition ${selecionado ? 'text-[--mike-accent]' : 'text-[--mike-fg-muted] hover:text-[--mike-fg]'}`}
            title={selecionado ? 'Tirar da seleção' : 'Selecionar'}
          >
            {selecionado ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
          </button>
        )}

        <button
          onClick={() => onToggleFav(bot)}
          disabled={!!favLoading}
          className={`transition flex-shrink-0 disabled:opacity-50 ${bot.favorito ? 'text-amber-400' : 'text-[--mike-fg-muted] hover:text-amber-400'}`}
          title={bot.favorito ? 'Tirar dos favoritos' : 'Favoritar'}
        >
          <Star className="w-4 h-4" fill={bot.favorito ? 'currentColor' : 'none'} />
        </button>

        <div className="flex-shrink-0 w-12 h-8 rounded flex flex-col items-center justify-center text-white text-[10px] font-bold" style={{ backgroundColor: esporte.cor }}>
          {esporte.logo}
          {isAtivo && <span className="text-[7px] -mt-0.5 px-1 rounded-sm" style={{ backgroundColor: '#dc2626' }}>Live</span>}
        </div>

        <div className="px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 flex-shrink-0" style={{
          backgroundColor: isAtivo ? 'rgba(16, 185, 129, 0.15)' : 'rgba(60, 85, 130, 0.2)',
          color: isAtivo ? '#10b981' : '#94a3b8',
          border: `0.5px solid ${isAtivo ? 'rgba(16, 185, 129, 0.4)' : 'rgba(60, 85, 130, 0.5)'}`,
        }}>
          {isAtivo ? <Activity className="w-3 h-3" /> : <Power className="w-3 h-3" />}
          {isAtivo ? 'Apostando' : 'Automatizar'}
        </div>

        {bot.em_treinamento && (
          <div className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 flex-shrink-0" style={{
            backgroundColor: 'rgba(59, 130, 246, 0.15)',
            color: '#60a5fa',
            border: '0.5px solid rgba(59, 130, 246, 0.4)',
          }} title="Modo treinamento - bot simula mas NAO envia tips no Telegram">
            🎓 Treinando
          </div>
        )}

        <span className="text-[11px] text-[--mike-fg-muted] font-mono flex-shrink-0">
          {bot.id.toString().padStart(6, '0')}
        </span>

        <TendIcon className="w-4 h-4 flex-shrink-0" style={{ color: tendColor }} />

        <button
          onClick={onToggleExpand}
          className="text-[12px] font-bold text-[--mike-fg] truncate text-left hover:text-[--mike-accent] transition flex-1 min-w-[120px]"
          title="Expandir/Colapsar"
        >
          {bot.nome}
        </button>

        {grupo && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 flex-shrink-0" style={{
            color: grupo.cor || '#94a3b8',
            border: `0.5px solid ${grupo.cor || 'rgba(60, 85, 130, 0.5)'}`,
          }} title={`Grupo: ${grupo.nome}`}>
            <Folder className="w-3 h-3" /> {grupo.nome}
          </span>
        )}

        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold text-white flex-shrink-0" style={{ backgroundColor: '#10b981' }}>
          {casa.label}
        </span>

        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold text-white flex-shrink-0" style={{ backgroundColor: '#0891b2' }}>
          {mercadoLabel}
        </span>

        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0" style={{
          backgroundColor: 'rgba(60, 85, 130, 0.2)',
          color: '#94a3b8',
          border: '0.5px solid rgba(60, 85, 130, 0.5)',
        }}>
          {isAtivo ? 'Bot ativado' : 'Bot pausado'}
        </span>

        <button className="p-1 text-[--mike-fg-muted] hover:text-[--mike-accent] transition flex-shrink-0" title="Compartilhar (em breve)">
          <Share2 className="w-4 h-4" />
        </button>
        <button className="p-1 text-[--mike-fg-muted] hover:text-[--mike-accent] transition flex-shrink-0" title="Configurar horários (em breve)">
          <Clock className="w-4 h-4" />
        </button>
        <button
          onClick={() => onBaixarCsv(bot.id, bot.nome)}
          disabled={!!loadingCsv}
          className="p-1 text-[--mike-fg-muted] hover:text-[--mike-accent] transition flex-shrink-0 disabled:opacity-40 disabled:cursor-wait"
          title="Baixar CSV das apostas"
        >
          {loadingCsv ? <RefreshCw className="w-4 h-4 mike-spin" /> : <Download className="w-4 h-4" />}
        </button>

        <button
          onClick={() => onAbrirHistorico(bot.id)}
          className="text-[11px] font-bold uppercase tracking-wider text-[--mike-fg-soft] hover:text-[--mike-accent] transition flex-shrink-0 px-1"
        >
          Histórico
        </button>

        <button
          onClick={onToggleExpand}
          className="text-[11px] font-bold uppercase tracking-wider text-[--mike-fg-soft] hover:text-[--mike-accent] transition flex-shrink-0 px-1"
        >
          {expandido ? 'Minimizar' : 'Ver'}
        </button>
      </div>

      {expandido && (
        <CorpoExpandido
          bot={bot}
          stats={stats}
          statsLoading={statsLoading}
          onAcao={onAcao}
          loadingAcao={loadingAcao}
          isAtivo={isAtivo}
        />
      )}
    </div>
  );
}

// ============================================================
// SELECT
// ============================================================

function MikeSelect({ value, onChange, options, placeholder = 'Selecione', width = 'w-full' }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (!e.target.closest('[data-mike-select]')) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const selected = options.find(o => o.value === value);

  return (
    <div data-mike-select className={`relative ${width}`}>
      <button
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition mike-border-thin bg-transparent text-[--mike-fg] hover:text-[--mike-fg] ${open ? 'border-[--mike-accent]' : ''}`}
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <ChevronDown className={`w-3 h-3 flex-shrink-0 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 rounded-md overflow-hidden z-30 max-h-64 overflow-y-auto" style={{
          backgroundColor: 'var(--mike-card)',
          border: '0.5px solid rgba(60, 85, 130, 0.6)',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
        }}>
          {options.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full text-left px-3 py-1.5 text-xs transition ${
                opt.value === value
                  ? 'bg-[--mike-accent]/10 text-[--mike-accent]'
                  : 'text-[--mike-fg-soft] hover:bg-[--mike-card-hover] hover:text-[--mike-fg]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// APP PRINCIPAL
// ============================================================

// ============================================================
// v50 — BARRA DE VISÕES: Todos · Favoritos · Sem grupo · grupos · + Novo
// ============================================================
function ChipVisao({ ativo, onClick, children, cor, title }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition flex-shrink-0 ${
        ativo ? 'text-[--mike-bg]' : 'mike-border-thin text-[--mike-fg-soft] hover:text-[--mike-fg]'
      }`}
      style={ativo ? { backgroundColor: cor || 'var(--mike-accent)', border: `0.5px solid ${cor || 'var(--mike-accent)'}` } : {}}
    >
      {children}
    </button>
  );
}

function BarraVisoes({ visao, onVisao, org, modoSelecao, onSelecao, onNovoGrupo, onRenomear, onExcluir }) {
  const totalFav = org.favoritos.length;
  const grupoAtivo = typeof visao === 'number' ? org.grupos.find(g => g.id === visao) : null;
  const n = (v) => <span className="opacity-70 font-mono text-[10px]">{v}</span>;
  return (
    <div className="mb-3">
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <ChipVisao ativo={visao === 'todos'} onClick={() => onVisao('todos')}>Todos</ChipVisao>
        <ChipVisao ativo={visao === 'favoritos'} onClick={() => onVisao('favoritos')} cor="#f59e0b">
          <Star className="w-3 h-3" fill={visao === 'favoritos' ? 'currentColor' : 'none'} /> Favoritos {n(totalFav)}
        </ChipVisao>
        <ChipVisao ativo={visao === 'sem'} onClick={() => onVisao('sem')} cor="#64748b">
          Sem grupo {n(org.sem_grupo)}
        </ChipVisao>
        {org.grupos.map(g => (
          <ChipVisao key={g.id} ativo={visao === g.id} onClick={() => onVisao(g.id)} cor={g.cor || '#0891b2'} title={`Grupo ${g.nome}`}>
            <Folder className="w-3 h-3" /> {g.nome} {n(g.total)}
          </ChipVisao>
        ))}
        <button
          onClick={onNovoGrupo}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold text-[--mike-accent] hover:bg-[--mike-accent]/10 transition flex-shrink-0"
          style={{ border: '0.5px dashed rgba(16, 185, 129, 0.5)' }}
          title="Criar um grupo"
        >
          <FolderPlus className="w-3 h-3" /> Novo grupo
        </button>
        <div className="flex-1" />
        <button
          onClick={onSelecao}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-semibold transition flex-shrink-0 ${
            modoSelecao ? 'bg-[--mike-accent]/15 text-[--mike-accent]' : 'mike-border-thin text-[--mike-fg-soft] hover:text-[--mike-fg]'
          }`}
          style={modoSelecao ? { border: '0.5px solid rgba(16, 185, 129, 0.5)' } : {}}
          title="Marcar vários bots pra mover de grupo"
        >
          <CheckSquare className="w-3.5 h-3.5" /> {modoSelecao ? 'Selecionando' : 'Selecionar'}
        </button>
      </div>
      {grupoAtivo && (
        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-[--mike-fg-muted]">
          <span>Grupo <span className="text-[--mike-fg] font-semibold">{grupoAtivo.nome}</span></span>
          <button onClick={() => onRenomear(grupoAtivo)} className="flex items-center gap-1 hover:text-[--mike-fg] transition">
            <Pencil className="w-3 h-3" /> Renomear
          </button>
          <button onClick={() => onExcluir(grupoAtivo)} className="flex items-center gap-1 hover:text-rose-300 transition">
            <Trash2 className="w-3 h-3" /> Excluir grupo
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// v50 — BARRA DE AÇÃO DA SELEÇÃO (fixa embaixo)
// ============================================================
function BarraSelecao({ qtd, grupos, visao, ocupado, menuAberto, onMenu, onMover, onNovoGrupo, onTodos, onLimpar, onCancelar }) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-3 py-2 rounded-xl shadow-2xl flex-wrap justify-center max-w-[95vw]" style={{
      backgroundColor: 'var(--mike-card)',
      border: '0.5px solid rgba(16, 185, 129, 0.5)',
    }}>
      <span className="text-xs text-[--mike-fg] font-semibold px-1">
        {qtd} selecionado{qtd === 1 ? '' : 's'}
      </span>
      <div className="relative">
        <button
          onClick={onMenu}
          disabled={qtd === 0 || ocupado}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-[--mike-accent] text-[--mike-bg] hover:bg-emerald-400 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {ocupado ? <RefreshCw className="w-3.5 h-3.5 mike-spin" /> : <FolderInput className="w-3.5 h-3.5" />}
          Mover para <ChevronDown className="w-3 h-3" />
        </button>
        {menuAberto && (
          <div className="absolute bottom-full mb-2 left-0 min-w-[200px] max-h-72 overflow-y-auto rounded-md py-1 shadow-2xl" style={{
            backgroundColor: 'var(--mike-card-2)',
            border: '0.5px solid rgba(60, 85, 130, 0.6)',
          }}>
            {grupos.map(g => (
              <button
                key={g.id}
                onClick={() => onMover(g.id)}
                disabled={visao === g.id}
                className="w-full text-left px-3 py-1.5 text-xs text-[--mike-fg-soft] hover:bg-[--mike-card-hover] hover:text-[--mike-fg] flex items-center gap-2 disabled:opacity-40"
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: g.cor || '#0891b2' }} />
                <span className="truncate">{g.nome}</span>
              </button>
            ))}
            {grupos.length > 0 && <div className="my-1" style={{ borderTop: '0.5px solid rgba(60, 85, 130, 0.4)' }} />}
            <button
              onClick={onNovoGrupo}
              className="w-full text-left px-3 py-1.5 text-xs text-[--mike-accent] hover:bg-[--mike-card-hover] flex items-center gap-2"
            >
              <FolderPlus className="w-3.5 h-3.5" /> Novo grupo…
            </button>
            <button
              onClick={() => onMover(null)}
              className="w-full text-left px-3 py-1.5 text-xs text-[--mike-fg-muted] hover:bg-[--mike-card-hover] hover:text-[--mike-fg] flex items-center gap-2"
            >
              <X className="w-3.5 h-3.5" /> Tirar do grupo
            </button>
          </div>
        )}
      </div>
      <button onClick={onTodos} className="px-2 py-1.5 text-[11px] text-[--mike-fg-soft] hover:text-[--mike-fg] transition">
        Marcar a página
      </button>
      <button onClick={onLimpar} disabled={qtd === 0} className="px-2 py-1.5 text-[11px] text-[--mike-fg-soft] hover:text-[--mike-fg] transition disabled:opacity-40">
        Limpar
      </button>
      <button onClick={onCancelar} className="p-1.5 text-[--mike-fg-muted] hover:text-[--mike-fg] transition" title="Sair da seleção (Esc)">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// ============================================================
// v50 — MODAL DO GRUPO: criar / renomear / excluir
// ============================================================
function ModalGrupo({ modal, ocupado, onFechar, onSalvar }) {
  const [nome, setNome] = useState(modal.grupo?.nome || '');
  const [cor, setCor] = useState(modal.grupo?.cor || CORES_GRUPO[0]);
  const excluir = modal.modo === 'excluir';
  const titulo = excluir ? 'Excluir grupo?' : modal.modo === 'renomear' ? 'Editar grupo' : 'Novo grupo';
  return (
    <div onClick={onFechar} className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
      <div onClick={e => e.stopPropagation()} className="rounded-2xl p-6 max-w-sm w-full" style={{
        backgroundColor: 'var(--mike-card)',
        border: '0.5px solid rgba(60, 85, 130, 0.6)',
        animation: 'mike-modal-fade 200ms ease-out',
      }}>
        <div className="flex items-start gap-3 mb-4">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${excluir ? 'bg-rose-800/30 border border-rose-700/50' : 'bg-[--mike-accent]/15 border border-[--mike-accent]/40'}`}>
            {excluir ? <Trash2 className="w-5 h-5 text-rose-300" /> : <Folder className="w-5 h-5 text-[--mike-accent]" />}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-[--mike-fg] mb-1">{titulo}</h3>
            {excluir ? (
              <p className="text-xs text-[--mike-fg-muted] leading-relaxed">
                O grupo <span className="text-[--mike-fg] font-semibold">"{modal.grupo?.nome}"</span> será excluído.
                Os bots <span className="text-[--mike-fg] font-semibold">não</span> são apagados: voltam pra "Sem grupo".
              </p>
            ) : modal.moverIds?.length ? (
              <p className="text-xs text-[--mike-fg-muted]">{modal.moverIds.length} bot(s) selecionado(s) vão direto pra ele.</p>
            ) : null}
          </div>
        </div>

        {!excluir && (
          <div className="space-y-3 mb-5">
            <input
              autoFocus
              value={nome}
              maxLength={60}
              onChange={e => setNome(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !ocupado) onSalvar(nome, cor); }}
              placeholder="Nome do grupo (ex.: CLA Under)"
              className="mike-border-thin w-full px-3 py-2 rounded-md bg-transparent text-sm text-[--mike-fg] placeholder:text-[--mike-fg-muted] outline-none"
            />
            <div className="flex items-center gap-2">
              {CORES_GRUPO.map(c => (
                <button
                  key={c}
                  onClick={() => setCor(c)}
                  className="w-6 h-6 rounded-full transition flex items-center justify-center"
                  style={{ backgroundColor: c, outline: cor === c ? '2px solid var(--mike-fg)' : 'none', outlineOffset: '2px' }}
                  title={c}
                >
                  {cor === c && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 justify-end">
          <button onClick={onFechar} className="px-3 py-1.5 rounded-md text-xs font-medium mike-border-thin text-[--mike-fg-soft] hover:text-[--mike-fg] transition">
            Cancelar
          </button>
          <button
            onClick={() => onSalvar(nome, cor)}
            disabled={ocupado || (!excluir && !nome.trim())}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 ${
              excluir ? 'text-white bg-rose-700 hover:bg-rose-600' : 'text-[--mike-bg] bg-[--mike-accent] hover:bg-emerald-400'
            }`}
          >
            {ocupado && <RefreshCw className="w-3.5 h-3.5 mike-spin" />}
            {excluir ? 'Excluir grupo' : modal.modo === 'renomear' ? 'Salvar' : 'Criar grupo'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App({ onNavegar: onNavegarExterno } = {}) {
  const [bots, setBots] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);

  const [busca, setBusca] = useState('');
  const [filtroCasa, setFiltroCasa] = useState('todas');
  const [filtroEsporte, setFiltroEsporte] = useState('todas');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  // v2 (11/ago): admin escolhe entre TODOS os bots e SÓ OS DELE. Pro usuário
  // comum o seletor nem aparece — o backend já devolve só os dele, e a
  // permissão continua vindo de lá (o parâmetro não dá acesso a nada).
  const [escopo, setEscopo] = useState('todos');
  const [ehAdmin, setEhAdmin] = useState(false);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);

  const [page, setPage] = useState(0);
  const LIMIT = 50;

  const [loadingAcao, setLoadingAcao] = useState({});
  const [loadingCsv, setLoadingCsv] = useState({});
  const [toasts, setToasts] = useState([]);
  const adicionarToast = useCallback((mensagem, tipo = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, mensagem, tipo }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  const [modalConfirm, setModalConfirm] = useState(null);
  const [backtestBot, setBacktestBot] = useState(null);
  const [historicoBotId, setHistoricoBotId] = useState(null);

  // v50: organização por usuário (favoritos + grupos)
  const [org, setOrg] = useState({ grupos: [], favoritos: [], sem_grupo: 0 });
  const [orgIndisponivel, setOrgIndisponivel] = useState(false);
  const [visao, setVisao] = useState('todos');          // 'todos' | 'favoritos' | 'sem' | id do grupo
  const [modoSelecao, setModoSelecao] = useState(false);
  const [selecionados, setSelecionados] = useState(() => new Set());
  const [menuMover, setMenuMover] = useState(false);
  const [modalGrupo, setModalGrupo] = useState(null);   // { modo: 'criar'|'renomear'|'excluir', grupo?, moverIds? }
  const [favLoading, setFavLoading] = useState({});
  const [orgOcupado, setOrgOcupado] = useState(false);

  const [expandidos, setExpandidos] = useState({});
  const [statsPorBot, setStatsPorBot] = useState({});
  const [statsLoadingBot, setStatsLoadingBot] = useState({});

  const handleNavegar = useCallback((telaId, ctx) => {
    if (onNavegarExterno) onNavegarExterno(telaId, ctx);
  }, [onNavegarExterno]);

  // v50: só a resposta do pedido MAIS RECENTE entra na tela (trocar de aba
  // rápido não deixa uma resposta velha sobrescrever a lista nova)
  const seqFetch = useRef(0);

  const fetchBots = useCallback(async () => {
    const meu = ++seqFetch.current;
    setLoading(true);
    setErro(null);
    try {
      const params = { limit: LIMIT, offset: page * LIMIT };
      if (filtroCasa !== 'todas') params.casa = filtroCasa;
      if (filtroEsporte !== 'todas') params.esporte = filtroEsporte;
      if (filtroStatus !== 'todos') params.status = filtroStatus;
      params.escopo = escopo;
      if (visao === 'favoritos') params.favoritos = true;
      else if (visao === 'sem') params.grupo = 'sem';
      else if (typeof visao === 'number') params.grupo = String(visao);

      const data = await ApiBots.list(params);
      if (meu !== seqFetch.current) return;
      setBots(data.items || []);
      setTotal(data.total || 0);
      setEhAdmin(Boolean(data.admin));
    } catch (e) {
      if (meu !== seqFetch.current) return;
      setErro(e.message);
      setBots([]);
      setTotal(0);
    } finally {
      if (meu === seqFetch.current) setLoading(false);
    }
  }, [page, filtroCasa, filtroEsporte, filtroStatus, escopo, visao]);

  useEffect(() => { fetchBots(); }, [fetchBots]);

  // ============================================================
  // v50 — FAVORITOS E GRUPOS
  // ============================================================
  const fetchOrg = useCallback(async () => {
    try {
      const data = await ApiBotsOrg.get();
      setOrg({
        grupos: Array.isArray(data?.grupos) ? data.grupos : [],
        favoritos: Array.isArray(data?.favoritos) ? data.favoritos : [],
        sem_grupo: Number(data?.sem_grupo) || 0,
      });
      setOrgIndisponivel(false);
    } catch (e) {
      // backend sem a v50 / migration não aplicada: a tela segue funcionando sem grupos
      console.error('Erro carregando favoritos/grupos', e);
      setOrgIndisponivel(true);
    }
  }, []);

  // contagens acompanham a lista (bot apagado/criado/movido)
  useEffect(() => { fetchOrg(); }, [fetchOrg, bots]);

  // grupo apagado enquanto estava aberto -> volta pra "Todos"
  useEffect(() => {
    if (typeof visao === 'number' && !org.grupos.some(g => g.id === visao)) {
      setVisao('todos');
      setPage(0);
    }
  }, [org.grupos, visao]);

  const grupoPorId = useMemo(() => {
    const m = {};
    for (const g of org.grupos) m[g.id] = g;
    return m;
  }, [org.grupos]);

  const trocarVisao = useCallback((v) => {
    setVisao(v);
    setPage(0);
    setMenuMover(false);
  }, []);

  const toggleFavorito = useCallback(async (bot) => {
    if (!bot || favLoading[bot.id]) return;
    const novo = !bot.favorito;
    setFavLoading(prev => ({ ...prev, [bot.id]: true }));
    setBots(prev => prev.map(b => (b.id === bot.id ? { ...b, favorito: novo } : b)));   // otimista
    try {
      await ApiBotsOrg.favoritar(bot.id, novo);
      fetchBots();   // favoritos sobem pro topo
    } catch (e) {
      setBots(prev => prev.map(b => (b.id === bot.id ? { ...b, favorito: !novo } : b)));
      adicionarToast(`Erro ao favoritar: ${e.message}`, 'error');
    } finally {
      setFavLoading(prev => { const n = { ...prev }; delete n[bot.id]; return n; });
    }
  }, [favLoading, fetchBots, adicionarToast]);

  const toggleSel = useCallback((botId) => {
    setSelecionados(prev => {
      const n = new Set(prev);
      if (n.has(botId)) n.delete(botId); else n.add(botId);
      return n;
    });
  }, []);

  const sairSelecao = useCallback(() => {
    setModoSelecao(false);
    setSelecionados(new Set());
    setMenuMover(false);
  }, []);

  const moverPara = useCallback(async (grupoId, ids) => {
    const lista = Array.from(ids || selecionados);
    if (lista.length === 0) return;
    setOrgOcupado(true);
    try {
      const r = await ApiBotsOrg.mover(lista, grupoId);
      const destino = grupoId == null ? 'sem grupo' : `"${grupoPorId[grupoId]?.nome || 'grupo'}"`;
      adicionarToast(`${r.movidos} bot(s) ${grupoId == null ? 'tirado(s) do grupo' : `movido(s) para ${destino}`}`, 'success');
      if (r.ignorados > 0) adicionarToast(`${r.ignorados} bot(s) ignorado(s) (sem acesso)`, 'warn');
      sairSelecao();
      fetchBots();
    } catch (e) {
      adicionarToast(`Erro ao mover: ${e.message}`, 'error');
    } finally {
      setOrgOcupado(false);
    }
  }, [selecionados, grupoPorId, adicionarToast, sairSelecao, fetchBots]);

  const salvarGrupo = useCallback(async (nome, cor) => {
    if (!modalGrupo) return;
    const limpo = (nome || '').trim();
    if (modalGrupo.modo !== 'excluir' && !limpo) {
      adicionarToast('Dê um nome ao grupo', 'warn');
      return;
    }
    setOrgOcupado(true);
    let trocouVisao = false;   // se a aba muda, o próprio efeito recarrega a lista
    try {
      if (modalGrupo.modo === 'criar') {
        const g = await ApiBotsOrg.criarGrupo(limpo, cor);
        adicionarToast(`Grupo "${g.nome}" criado`, 'success');
        if (modalGrupo.moverIds && modalGrupo.moverIds.length) {
          const r = await ApiBotsOrg.mover(modalGrupo.moverIds, g.id);
          adicionarToast(`${r.movidos} bot(s) movido(s) para "${g.nome}"`, 'success');
          sairSelecao();
        }
      } else if (modalGrupo.modo === 'renomear') {
        await ApiBotsOrg.editarGrupo(modalGrupo.grupo.id, { nome: limpo, cor: cor || null });
        adicionarToast('Grupo atualizado', 'success');
      } else if (modalGrupo.modo === 'excluir') {
        await ApiBotsOrg.excluirGrupo(modalGrupo.grupo.id);
        adicionarToast(`Grupo "${modalGrupo.grupo.nome}" excluído — os bots voltaram pra "Sem grupo"`, 'info');
        if (visao === modalGrupo.grupo.id) { setVisao('todos'); setPage(0); trocouVisao = true; }
      }
      setModalGrupo(null);
      await fetchOrg();
      if (!trocouVisao) fetchBots();
    } catch (e) {
      adicionarToast(`Erro: ${e.message}`, 'error');
    } finally {
      setOrgOcupado(false);
    }
  }, [modalGrupo, visao, adicionarToast, sairSelecao, fetchOrg, fetchBots]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key !== 'Escape') return;
      if (modalGrupo) setModalGrupo(null);
      else if (menuMover) setMenuMover(false);
      else if (modoSelecao) sairSelecao();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [modalGrupo, menuMover, modoSelecao, sairSelecao]);

  const botsFiltrados = useMemo(() => {
    if (!busca.trim()) return bots;
    const q = normaliza(busca);
    return bots.filter(b => normaliza(b.nome).includes(q));
  }, [bots, busca]);

  const carregarStats = useCallback(async (botId) => {
    if (statsPorBot[botId]) return;
    setStatsLoadingBot(prev => ({ ...prev, [botId]: true }));
    try {
      const stats = await ApiBots.stats(botId, 'simulado');
      setStatsPorBot(prev => ({ ...prev, [botId]: stats }));
    } catch (e) {
      console.error('Erro carregando stats do bot', botId, e);
      setStatsPorBot(prev => ({ ...prev, [botId]: { tips: 0, greens: 0, reds: 0, lucro: 0, roi: 0, wr: 0 } }));
    } finally {
      setStatsLoadingBot(prev => ({ ...prev, [botId]: false }));
    }
  }, [statsPorBot]);

  const toggleExpand = useCallback((botId) => {
    setExpandidos(prev => {
      const novo = { ...prev };
      if (novo[botId]) {
        delete novo[botId];
      } else {
        novo[botId] = true;
        carregarStats(botId);
      }
      return novo;
    });
  }, [carregarStats]);

  const handleAcao = useCallback(async (acao, botId) => {
    const bot = bots.find(b => b.id === botId);
    if (!bot) return;

    if (acao === 'editar') {
      handleNavegar('criar_bot', { botId });
      return;
    }
    if (acao === 'backtest') {
      setBacktestBot(bot);
      return;
    }
    if (acao === 'deletar') {
      setModalConfirm({
        tipo: 'deletar',
        bot,
        onConfirm: async () => {
          setLoadingAcao(prev => ({ ...prev, [botId]: true }));
          try {
            await ApiBots.delete(botId);
            adicionarToast(`Bot "${bot.nome}" deletado`, 'error');
            fetchBots();
          } catch (e) {
            adicionarToast(`Erro ao deletar: ${e.message}`, 'error');
          } finally {
            setLoadingAcao(prev => { const n = { ...prev }; delete n[botId]; return n; });
            setModalConfirm(null);
          }
        },
      });
      return;
    }

    if (acao === 'treinamento') {
      setLoadingAcao(prev => ({ ...prev, [botId]: true }));
      try {
        const novoEstado = !bot.em_treinamento;
        await ApiBots.treinamento(botId, novoEstado);
        adicionarToast(
          novoEstado
            ? `Bot "${bot.nome}" em treinamento (sem Telegram)`
            : `Bot "${bot.nome}" voltou pra produção (com Telegram)`,
          novoEstado ? 'warn' : 'success'
        );
        fetchBots();
      } catch (e) {
        adicionarToast(`Erro: ${e.message}`, 'error');
      } finally {
        setLoadingAcao(prev => { const n = { ...prev }; delete n[botId]; return n; });
      }
      return;
    }

    setLoadingAcao(prev => ({ ...prev, [botId]: true }));
    try {
      if (acao === 'ligar') {
        await ApiBots.start(botId);
        adicionarToast(`Bot "${bot.nome}" ativado`, 'success');
      } else if (acao === 'pausar') {
        await ApiBots.stop(botId);
        adicionarToast(`Bot "${bot.nome}" pausado`, 'warn');
      } else if (acao === 'clonar') {
        const novo = await ApiBots.clone(botId);
        adicionarToast(`Bot clonado: "${novo.nome}"`, 'success');
      }
      fetchBots();
    } catch (e) {
      adicionarToast(`Erro: ${e.message}`, 'error');
    } finally {
      setLoadingAcao(prev => { const n = { ...prev }; delete n[botId]; return n; });
    }
  }, [bots, adicionarToast, fetchBots, handleNavegar]);

  const handleBaixarCsv = useCallback(async (botId, botNome) => {
    setLoadingCsv(prev => ({ ...prev, [botId]: true }));
    try {
      const slug = (botNome || 'bot')
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
      const fallback = `bot_${botId}_${slug || 'apostas'}.csv`;
      const filename = await ApiBots.downloadCsv(botId, {}, fallback);
      adicionarToast(`CSV baixado: ${filename}`, 'success');
    } catch (e) {
      adicionarToast(`Erro ao baixar CSV: ${e.message}`, 'error');
    } finally {
      setLoadingCsv(prev => { const n = { ...prev }; delete n[botId]; return n; });
    }
  }, [adicionarToast]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        if (modalConfirm) setModalConfirm(null);
        else if (filtrosAbertos) setFiltrosAbertos(false);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [modalConfirm, filtrosAbertos]);

  const algumFiltroAtivo = filtroCasa !== 'todas' || filtroEsporte !== 'todas' || filtroStatus !== 'todos' || escopo !== 'todos' || busca;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

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

  return (
    <div className="min-h-screen" style={{
      ...themeVars,
      backgroundColor: 'var(--mike-bg)',
      color: 'var(--mike-fg)',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <style>{`
        .mike-border-thin { border: 0.5px solid rgba(60, 85, 130, 0.4) !important; }
        .mike-border-thin:hover { border-color: rgba(80, 110, 170, 0.7) !important; }
        .mike-border-thin:focus { border-color: rgba(16, 185, 129, 0.7) !important; outline: none; }
        @keyframes mike-toast-in { 0% { transform: translateX(120%); opacity: 0; } 100% { transform: translateX(0); opacity: 1; } }
        .mike-toast-in { animation: mike-toast-in 0.3s ease-out; }
        @keyframes mike-modal-fade { from { opacity: 0; transform: translateY(8px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes mike-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .mike-spin { animation: mike-spin 0.8s linear infinite; }
      `}</style>

      <MikeHeader telaAtiva="bots" onNavegar={handleNavegar} />

      <main className="max-w-screen-xl mx-auto px-4 lg:px-8 py-6">
        <div className="flex items-center gap-2 text-xs text-[--mike-fg-muted] mb-4">
          <Home className="w-3 h-3" />
          <span>Início</span>
          <ChevronRight className="w-3 h-3" />
          <span className="text-[--mike-fg] font-semibold">Bots</span>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-5">
          <div>
            <h1 className="text-xl font-black text-[--mike-fg] flex items-center gap-2">
              <Bot className="w-5 h-5 text-cyan-400" />
              Meus Bots
            </h1>
            <p className="text-[11px] text-[--mike-fg-muted] mt-0.5">
              Total: <span className="text-[--mike-fg] font-semibold">{total}</span>
              {algumFiltroAtivo && botsFiltrados.length !== total && (
                <span> · Mostrando: <span className="text-[--mike-fg] font-semibold">{botsFiltrados.length}</span></span>
              )}
            </p>
          </div>

          <div className="flex-1" />

          <button
            onClick={() => fetchBots()}
            disabled={loading}
            className="mike-border-thin flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-transparent text-xs font-semibold text-[--mike-fg-soft] hover:text-[--mike-fg] transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'mike-spin' : ''}`} />
            <span className="hidden sm:inline">Recarregar</span>
          </button>

          <button
            onClick={() => handleNavegar('criar_bot')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[--mike-accent] hover:bg-emerald-400 text-[--mike-bg] text-xs font-bold transition shadow-md shadow-[--mike-accent]/30"
          >
            <Plus className="w-3.5 h-3.5" /> Novo Bot
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="mike-border-thin flex-1 min-w-[200px] flex items-center gap-2 px-3 py-1.5 rounded-md bg-transparent transition">
            <Search className="w-3.5 h-3.5 text-[--mike-fg-muted]" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome..."
              className="flex-1 bg-transparent text-xs text-[--mike-fg] placeholder:text-[--mike-fg-muted] outline-none"
            />
            {busca && (
              <button onClick={() => setBusca('')} className="text-[--mike-fg-muted] hover:text-[--mike-fg]">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <button
            onClick={() => setFiltrosAbertos(!filtrosAbertos)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
              filtrosAbertos
                ? 'bg-[--mike-accent]/15 text-[--mike-accent]'
                : algumFiltroAtivo
                  ? 'mike-border-thin bg-transparent text-[--mike-fg]'
                  : 'mike-border-thin bg-transparent text-[--mike-fg-soft] hover:text-[--mike-fg]'
            }`}
            style={filtrosAbertos ? { border: '0.5px solid rgba(16, 185, 129, 0.5)' } : {}}
          >
            <Filter className="w-3.5 h-3.5" />
            Filtros
            {algumFiltroAtivo && (
              <span className="ml-0.5 px-1.5 py-0 rounded-full bg-[--mike-accent] text-[--mike-bg] text-[9px] font-black">
                {[filtroCasa !== 'todas', filtroEsporte !== 'todas', filtroStatus !== 'todos', escopo !== 'todos', busca].filter(Boolean).length}
              </span>
            )}
          </button>
        </div>

        {!orgIndisponivel && (
          <BarraVisoes
            visao={visao}
            onVisao={trocarVisao}
            org={org}
            modoSelecao={modoSelecao}
            onSelecao={() => (modoSelecao ? sairSelecao() : setModoSelecao(true))}
            onNovoGrupo={() => setModalGrupo({ modo: 'criar' })}
            onRenomear={(g) => setModalGrupo({ modo: 'renomear', grupo: g })}
            onExcluir={(g) => setModalGrupo({ modo: 'excluir', grupo: g })}
          />
        )}

        {filtrosAbertos && (
          <div className="mb-4 rounded-lg p-3" style={{ backgroundColor: 'transparent', border: '0.5px solid rgba(60, 85, 130, 0.4)' }}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] text-[--mike-fg-muted] mb-1">Casa</label>
                <MikeSelect value={filtroCasa} onChange={(v) => { setFiltroCasa(v); setPage(0); }} options={[
                  { value: 'todas', label: 'Todas' },
                  ...Object.values(CASAS).map(c => ({ value: c.id, label: c.label })),
                ]} />
              </div>
              <div>
                <label className="block text-[10px] text-[--mike-fg-muted] mb-1">Esporte</label>
                <MikeSelect value={filtroEsporte} onChange={(v) => { setFiltroEsporte(v); setPage(0); }} options={[
                  { value: 'todas', label: 'Todos' },
                  ...Object.values(ESPORTES).map(e => ({ value: e.id, label: e.label })),
                ]} />
              </div>
              <div>
                <label className="block text-[10px] text-[--mike-fg-muted] mb-1">Status</label>
                <MikeSelect value={filtroStatus} onChange={(v) => { setFiltroStatus(v); setPage(0); }} options={[
                  { value: 'todos', label: 'Todos' },
                  { value: 'ativo', label: 'Ativo' },
                  { value: 'pausado', label: 'Pausado' },
                ]} />
              </div>
              {ehAdmin && (
                <div>
                  <label className="block text-[10px] text-[--mike-fg-muted] mb-1">Dono</label>
                  <MikeSelect value={escopo} onChange={(v) => { setEscopo(v); setPage(0); }} options={[
                    { value: 'todos', label: 'Todos os bots' },
                    { value: 'meus', label: 'Somente os meus' },
                  ]} />
                </div>
              )}
            </div>
          </div>
        )}

        {erro && (
          <div className="mb-4 rounded-md flex items-center gap-3 px-4 py-3" style={{
            backgroundColor: 'rgba(244, 63, 94, 0.1)',
            border: '0.5px solid rgba(244, 63, 94, 0.4)',
          }}>
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <p className="flex-1 text-xs text-rose-200">Erro ao carregar bots: {erro}</p>
            <button onClick={fetchBots} className="text-xs text-rose-200 underline hover:text-white">Tentar de novo</button>
          </div>
        )}

        {loading && bots.length === 0 ? (
          <div className="flex items-center justify-center py-20 gap-2 text-[--mike-fg-muted] text-xs">
            <RefreshCw className="w-4 h-4 mike-spin" />
            Carregando bots...
          </div>
        ) : botsFiltrados.length > 0 ? (
          <div className="space-y-2">
            {botsFiltrados.map(bot => (
              <LinhaBot
                key={bot.id}
                bot={bot}
                expandido={!!expandidos[bot.id]}
                onToggleExpand={() => toggleExpand(bot.id)}
                onAcao={handleAcao}
                loadingAcao={!!loadingAcao[bot.id]}
                onAbrirHistorico={(id) => setHistoricoBotId(id)}
                stats={statsPorBot[bot.id]}
                statsLoading={!!statsLoadingBot[bot.id]}
                onBaixarCsv={handleBaixarCsv}
                loadingCsv={!!loadingCsv[bot.id]}
                onToggleFav={toggleFavorito}
                favLoading={!!favLoading[bot.id]}
                modoSelecao={modoSelecao}
                selecionado={selecionados.has(bot.id)}
                onToggleSel={toggleSel}
                grupo={(bot.grupo_id != null && visao !== bot.grupo_id) ? grupoPorId[bot.grupo_id] : null}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl py-12 px-6 text-center" style={{
            backgroundColor: 'transparent',
            border: '0.5px solid rgba(60, 85, 130, 0.4)',
          }}>
            <Bot className="w-12 h-12 text-[--mike-fg-muted] opacity-40 mx-auto mb-3" />
            <p className="text-sm text-[--mike-fg] font-semibold mb-1">
              {visao === 'favoritos' ? 'Nenhum favorito ainda'
                : typeof visao === 'number' ? 'Grupo vazio'
                : 'Nenhum bot encontrado'}
            </p>
            <p className="text-xs text-[--mike-fg-muted] mb-4">
              {visao === 'favoritos' && !algumFiltroAtivo
                ? 'Clique na estrela de um bot pra ele aparecer aqui.'
                : typeof visao === 'number' && !algumFiltroAtivo
                ? 'Use "Selecionar" na aba Todos, marque os bots e mova pra este grupo.'
                : algumFiltroAtivo
                ? 'Os filtros aplicados não retornaram nenhum bot.'
                : 'Crie seu primeiro bot pra começar a operar automaticamente.'}
            </p>
            {algumFiltroAtivo ? (
              <button
                onClick={() => {
                  setFiltroCasa('todas');
                  setFiltroEsporte('todas');
                  setFiltroStatus('todos');
                  setEscopo('todos');
                  setBusca('');
                  adicionarToast('Filtros limpos', 'info');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-[--mike-accent]/10 border border-[--mike-accent]/40 text-[--mike-accent] hover:bg-[--mike-accent]/15 transition"
              >
                <FilterX className="w-3 h-3" /> Limpar filtros
              </button>
            ) : (
              <button
                onClick={() => handleNavegar('criar_bot')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-[--mike-accent] text-[--mike-bg] hover:bg-emerald-400 transition shadow-md"
              >
                <Plus className="w-3 h-3" /> Criar primeiro bot
              </button>
            )}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0 || loading}
              className="mike-border-thin px-3 py-1.5 rounded-md text-xs font-semibold text-[--mike-fg-soft] hover:text-[--mike-fg] transition disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Anterior
            </button>
            <span className="text-xs text-[--mike-fg-muted]">
              Página {page + 1} de {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1 || loading}
              className="mike-border-thin px-3 py-1.5 rounded-md text-xs font-semibold text-[--mike-fg-soft] hover:text-[--mike-fg] transition disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Próxima
            </button>
          </div>
        )}

        <button
          onClick={() => handleNavegar('criar_bot')}
          className="fixed bottom-6 right-6 z-30 w-14 h-14 rounded-full bg-[--mike-accent] hover:bg-emerald-400 text-[--mike-bg] flex items-center justify-center shadow-2xl shadow-[--mike-accent]/40 hover:scale-110 transition-transform"
          title="Criar novo bot"
        >
          <Plus className="w-6 h-6" strokeWidth={3} />
        </button>
      </main>

      {backtestBot && (
        <BacktestModal aberto={!!backtestBot} bot={backtestBot} onFechar={() => setBacktestBot(null)} />
      )}

      {historicoBotId && (
        <ModalHistorico botId={historicoBotId} aberto={!!historicoBotId} onClose={() => setHistoricoBotId(null)} />
      )}

      {modoSelecao && (
        <BarraSelecao
          qtd={selecionados.size}
          grupos={org.grupos}
          visao={visao}
          ocupado={orgOcupado}
          menuAberto={menuMover}
          onMenu={() => setMenuMover(v => !v)}
          onMover={(gid) => { setMenuMover(false); moverPara(gid); }}
          onNovoGrupo={() => { setMenuMover(false); setModalGrupo({ modo: 'criar', moverIds: Array.from(selecionados) }); }}
          onTodos={() => setSelecionados(new Set(botsFiltrados.map(b => b.id)))}
          onLimpar={() => setSelecionados(new Set())}
          onCancelar={sairSelecao}
        />
      )}

      {modalGrupo && (
        <ModalGrupo
          modal={modalGrupo}
          ocupado={orgOcupado}
          onFechar={() => setModalGrupo(null)}
          onSalvar={salvarGrupo}
        />
      )}

      <div className="fixed bottom-4 left-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => {
          const corMap = {
            success: { bg: 'bg-emerald-500/95', icon: <CheckCircle2 className="w-4 h-4" /> },
            warn:    { bg: 'bg-amber-500/95',   icon: <AlertCircle className="w-4 h-4" /> },
            error:   { bg: 'bg-rose-500/95',    icon: <AlertTriangle className="w-4 h-4" /> },
            info:    { bg: 'bg-cyan-500/95',    icon: <AlertCircle className="w-4 h-4" /> },
          };
          const cor = corMap[t.tipo] || corMap.info;
          return (
            <div key={t.id} className={`mike-toast-in pointer-events-auto rounded-md ${cor.bg} text-white px-3 py-2 text-xs font-semibold flex items-center gap-2 shadow-lg max-w-sm`}>
              {cor.icon}
              {t.mensagem}
            </div>
          );
        })}
      </div>

      {modalConfirm && (
        <div onClick={() => setModalConfirm(null)} className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <div onClick={e => e.stopPropagation()} className="rounded-2xl p-6 max-w-sm w-full" style={{
            backgroundColor: 'var(--mike-card)',
            border: '0.5px solid rgba(60, 85, 130, 0.6)',
            animation: 'mike-modal-fade 200ms ease-out',
          }}>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-rose-800/30 border border-rose-700/50">
                <Trash2 className="w-5 h-5 text-rose-300" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold text-[--mike-fg] mb-1">Deletar bot?</h3>
                <p className="text-xs text-[--mike-fg-muted] leading-relaxed">
                  Tem certeza que quer <span className="text-rose-300 font-bold">deletar permanentemente</span> o bot <span className="text-[--mike-fg] font-semibold">"{modalConfirm.bot.nome}"</span>? Apostas e backtests vinculados também serão removidos. Esta ação não pode ser desfeita.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 justify-end">
              <button onClick={() => setModalConfirm(null)} className="px-3 py-1.5 rounded-md text-xs font-medium mike-border-thin text-[--mike-fg-soft] hover:text-[--mike-fg] transition">
                Cancelar
              </button>
              <button onClick={modalConfirm.onConfirm} className="px-3 py-1.5 rounded-md text-xs font-bold text-white bg-rose-700 hover:bg-rose-600 transition">
                Sim, deletar permanentemente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}