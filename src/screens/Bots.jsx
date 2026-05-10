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

import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Search, Bell, Settings, ChevronDown, Home, Activity, Store, Bot, Table2, BarChart3, Plus,
  X, FilterX, Filter, Trash2, Edit2, Copy, Play, Pause, RefreshCw,
  AlertCircle, AlertTriangle, CheckCircle2, ChevronRight,
  Star, Share2, Clock, Download, History, Maximize2, Minimize2,
  TrendingUp, TrendingDown, DollarSign, Percent,
  Power,
} from 'lucide-react';
import MikeHeader from '../shared/MikeHeader.jsx';
import BacktestModal from './BacktestModal';
import { ModalHistorico } from './Historico';
import { ApiBots } from '../lib/api';

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
  over_under_ft_player: 'Over Jogador',
  over_under_ht_player: 'Over Jog. 1T',
  ml_ft:                'Resultado Final',
  ml_ht:                'Resultado 1T',
  btts_ft:              'Ambos Marcam',
  btts_ht:              'Ambos Marcam 1T',
  double_ml_ft:         'Dupla Chance',
  next_goal:            'Próximo Gol',
  odd_even_ft:          'Par/Ímpar',
  odd_even_ht:          'Par/Ímpar 1T',
};

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
          disabled
          className="px-3 py-2 rounded-md text-[11px] font-bold uppercase tracking-wider transition opacity-40 cursor-not-allowed"
          style={{ backgroundColor: '#3b82f6', color: '#fff' }}
          title="Em breve"
        >
          Treinamento
        </button>

        <button
          disabled
          className="px-3 py-2 rounded-md text-[10px] font-bold uppercase tracking-wider transition opacity-40 cursor-not-allowed text-center leading-tight"
          style={{
            backgroundColor: 'transparent',
            border: '0.5px solid rgba(60, 85, 130, 0.5)',
            color: 'rgb(148, 163, 184)',
          }}
          title="Em breve"
        >
          Stop não<br />configurado
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

function LinhaBot({ bot, expandido, onToggleExpand, onAcao, loadingAcao, onAbrirHistorico, stats, statsLoading }) {
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
        <button
          className="text-[--mike-fg-muted] hover:text-amber-400 transition flex-shrink-0"
          title="Favoritar (em breve)"
        >
          <Star className="w-4 h-4" />
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
        <button className="p-1 text-[--mike-fg-muted] hover:text-[--mike-accent] transition flex-shrink-0" title="Baixar planilha (em breve)">
          <Download className="w-4 h-4" />
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

export default function App({ onNavegar: onNavegarExterno } = {}) {
  const [bots, setBots] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);

  const [busca, setBusca] = useState('');
  const [filtroCasa, setFiltroCasa] = useState('todas');
  const [filtroEsporte, setFiltroEsporte] = useState('todas');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);

  const [page, setPage] = useState(0);
  const LIMIT = 50;

  const [loadingAcao, setLoadingAcao] = useState({});
  const [toasts, setToasts] = useState([]);
  const adicionarToast = useCallback((mensagem, tipo = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, mensagem, tipo }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  const [modalConfirm, setModalConfirm] = useState(null);
  const [backtestBot, setBacktestBot] = useState(null);
  const [historicoBotId, setHistoricoBotId] = useState(null);

  const [expandidos, setExpandidos] = useState({});
  const [statsPorBot, setStatsPorBot] = useState({});
  const [statsLoadingBot, setStatsLoadingBot] = useState({});

  const handleNavegar = useCallback((telaId, ctx) => {
    if (onNavegarExterno) onNavegarExterno(telaId, ctx);
  }, [onNavegarExterno]);

  const fetchBots = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const params = { limit: LIMIT, offset: page * LIMIT };
      if (filtroCasa !== 'todas') params.casa = filtroCasa;
      if (filtroEsporte !== 'todas') params.esporte = filtroEsporte;
      if (filtroStatus !== 'todos') params.status = filtroStatus;

      const data = await ApiBots.list(params);
      setBots(data.items || []);
      setTotal(data.total || 0);
    } catch (e) {
      setErro(e.message);
      setBots([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, filtroCasa, filtroEsporte, filtroStatus]);

  useEffect(() => { fetchBots(); }, [fetchBots]);

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

  const algumFiltroAtivo = filtroCasa !== 'todas' || filtroEsporte !== 'todas' || filtroStatus !== 'todos' || busca;
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
                {[filtroCasa !== 'todas', filtroEsporte !== 'todas', filtroStatus !== 'todos', busca].filter(Boolean).length}
              </span>
            )}
          </button>
        </div>

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
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl py-12 px-6 text-center" style={{
            backgroundColor: 'transparent',
            border: '0.5px solid rgba(60, 85, 130, 0.4)',
          }}>
            <Bot className="w-12 h-12 text-[--mike-fg-muted] opacity-40 mx-auto mb-3" />
            <p className="text-sm text-[--mike-fg] font-semibold mb-1">Nenhum bot encontrado</p>
            <p className="text-xs text-[--mike-fg-muted] mb-4">
              {algumFiltroAtivo
                ? 'Os filtros aplicados não retornaram nenhum bot.'
                : 'Crie seu primeiro bot pra começar a operar automaticamente.'}
            </p>
            {algumFiltroAtivo ? (
              <button
                onClick={() => {
                  setFiltroCasa('todas');
                  setFiltroEsporte('todas');
                  setFiltroStatus('todos');
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
