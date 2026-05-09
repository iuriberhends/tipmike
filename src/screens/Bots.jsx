// ============================================================
// Bots.jsx — Tela de listagem de bots (API real)
//
// Conectado ao backend via ApiBots:
// - GET /bots (paginado, sem JSONB pesado)
// - GET /bots/:id (completo, na hora de editar — feito pelo CriarBot)
// - PATCH /bots/:id (mudanças de status, favorito etc.)
// - DELETE /bots/:id
// - POST /bots/:id/start (status='ativo')
// - POST /bots/:id/stop (status='pausado')
// - POST /bots/:id/clone
//
// Métricas reais virão na Entrega 4 (worker rodando + tabela apostas
// agregada). Por enquanto a tela mostra só os bots cadastrados, sem
// painéis de desempenho fake nem métricas mock.
// ============================================================

import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Search, Bell, Settings, ChevronDown, Home, Activity, Store, Bot, Table2, BarChart3, Plus,
  X, FilterX, Filter, Trash2, Edit2, Copy, Play, Pause, RefreshCw,
  AlertCircle, AlertTriangle, CheckCircle2, ChevronRight,
} from 'lucide-react';
import MikeHeader from '../shared/MikeHeader.jsx';
import BacktestModal from './BacktestModal';
import { ApiBots } from '../lib/api';

// ============================================================
// CONSTANTES — só o que existe no backend hoje
// ============================================================

const CASAS = {
  betano:     { id: 'betano',     label: 'Betano',     bg: 'bg-orange-500',  text: 'text-orange-50' },
  superbet:   { id: 'superbet',   label: 'Superbet',   bg: 'bg-red-500',     text: 'text-red-50' },
  bet365:     { id: 'bet365',     label: 'Bet365',     bg: 'bg-emerald-500', text: 'text-emerald-950' },
  estrelabet: { id: 'estrelabet', label: 'Estrelabet', bg: 'bg-yellow-500',  text: 'text-yellow-950' },
  novibet:    { id: 'novibet',    label: 'Novibet',    bg: 'bg-blue-500',    text: 'text-blue-50' },
  vupi:       { id: 'vupi',       label: 'Vupi',       bg: 'bg-purple-500',  text: 'text-purple-50' },
};

const ESPORTES = {
  fifa:    { id: 'fifa',    label: 'e-Soccer (Fifa)' },
  nba2k:   { id: 'nba2k',   label: 'e-Basket (NBA2K)' },
  ehockey: { id: 'ehockey', label: 'e-Hockey' },
  etennis: { id: 'etennis', label: 'e-Tênis' },
};

const STATUS_BOT = {
  ativo:   { id: 'ativo',   label: 'Ativo',   color: 'bg-emerald-500', pulse: true,  Icon: Play },
  pausado: { id: 'pausado', label: 'Pausado', color: 'bg-amber-500',   pulse: false, Icon: Pause },
  erro:    { id: 'erro',    label: 'Erro',    color: 'bg-rose-600',    pulse: true,  Icon: AlertTriangle },
};

function normaliza(s) {
  return (s || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function formatarData(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const hoje = new Date();
    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);
    const ehHoje = d.toDateString() === hoje.toDateString();
    const ehOntem = d.toDateString() === ontem.toDateString();
    const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    if (ehHoje) return `Hoje ${hora}`;
    if (ehOntem) return `Ontem ${hora}`;
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + hora;
  } catch {
    return '—';
  }
}

// ============================================================
// COMPONENTES BASE
// ============================================================

function MikeSelect({ value, onChange, options, placeholder = 'Selecione', width = 'w-full' }) {
  const [open, setOpen] = useState(false);
  const ref = useState(null);
  // ref via useState pra fechar fora — mais simples que useRef + listener
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
// LINHA DE BOT (substitui o "card expandido" antigo)
// Mostra só o que existe no backend; sem métricas fake
// ============================================================

function LinhaBot({ bot, onAcao, loadingAcao }) {
  const casa = CASAS[bot.casa] || { label: bot.casa, bg: 'bg-slate-600', text: 'text-white' };
  const esporte = ESPORTES[bot.esporte] || { label: bot.esporte };
  const status = STATUS_BOT[bot.status] || STATUS_BOT.pausado;
  const StatusIcon = status.Icon;
  const isAtivo = bot.status === 'ativo';

  return (
    <div className="rounded-md overflow-hidden transition hover:bg-white/[0.02]" style={{
      backgroundColor: 'transparent',
      border: '0.5px solid rgba(60, 85, 130, 0.4)',
    }}>
      <div className="flex items-stretch">
        <div className={`w-1 flex-shrink-0 ${status.color} ${status.pulse ? 'animate-pulse' : ''}`} />

        <div className="flex-1 min-w-0">
          {/* LINHA 1: tags + nome + status */}
          <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5 flex-wrap">
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold flex-shrink-0 ${casa.bg} ${casa.text}`}>
              {casa.label}
            </span>

            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 flex-shrink-0">
              {bot.mercado}
            </span>

            <span className="text-[10px] text-[--mike-fg-muted] flex-shrink-0">{esporte.label}</span>

            <button
              onClick={() => onAcao('editar', bot.id)}
              className="text-xs font-bold text-[--mike-fg] truncate text-left hover:text-[--mike-accent] transition uppercase flex-1 min-w-0"
              style={{ letterSpacing: '0.02em' }}
              title="Editar bot"
            >
              {bot.nome}
            </button>

            <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold flex-shrink-0 ${status.color} text-white`}>
              <StatusIcon className="w-2.5 h-2.5" />
              <span className="hidden sm:inline">{status.label}</span>
            </div>
          </div>

          {/* LINHA 2: meta info + ações */}
          <div className="flex items-center gap-3 px-3 pb-2.5 flex-wrap">
            <span className="text-[10px] text-[--mike-fg-muted] font-mono">
              #{bot.id.toString().padStart(4, '0')}
            </span>

            <span className="text-[10px] text-[--mike-fg-muted]">
              Atualizado: <span className="text-[--mike-fg-soft] font-mono">{formatarData(bot.atualizado_em)}</span>
            </span>

            <div className="flex-1 min-w-0" />

            {/* Ações */}
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <button
                onClick={() => onAcao(isAtivo ? 'pausar' : 'ligar', bot.id)}
                disabled={loadingAcao}
                className="p-1.5 rounded hover:bg-[--mike-accent]/15 text-[--mike-fg-muted] hover:text-[--mike-accent] transition disabled:opacity-50"
                title={isAtivo ? 'Pausar' : 'Ligar'}
              >
                {isAtivo ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => onAcao('backtest', bot.id)}
                className="p-1.5 rounded hover:bg-purple-500/15 text-[--mike-fg-muted] hover:text-purple-400 transition"
                title="Backtest"
              >
                <BarChart3 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onAcao('editar', bot.id)}
                className="p-1.5 rounded hover:bg-cyan-500/15 text-[--mike-fg-muted] hover:text-cyan-400 transition"
                title="Editar"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onAcao('clonar', bot.id)}
                disabled={loadingAcao}
                className="p-1.5 rounded hover:bg-[--mike-accent]/15 text-[--mike-fg-muted] hover:text-[--mike-accent] transition disabled:opacity-50"
                title="Clonar"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onAcao('deletar', bot.id)}
                disabled={loadingAcao}
                className="p-1.5 rounded hover:bg-rose-500/15 text-[--mike-fg-muted] hover:text-rose-400 transition disabled:opacity-50"
                title="Deletar"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// APP PRINCIPAL
// ============================================================

export default function App({ onNavegar: onNavegarExterno } = {}) {
  // Estado de listagem
  const [bots, setBots] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);

  // Filtros
  const [busca, setBusca] = useState('');
  const [filtroCasa, setFiltroCasa] = useState('todas');
  const [filtroEsporte, setFiltroEsporte] = useState('todas');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);

  // Paginação
  const [page, setPage] = useState(0);
  const LIMIT = 50;

  // Ações em andamento
  const [loadingAcao, setLoadingAcao] = useState({});

  // Toasts
  const [toasts, setToasts] = useState([]);
  const adicionarToast = useCallback((mensagem, tipo = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, mensagem, tipo }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  // Modal de confirmação (deletar)
  const [modalConfirm, setModalConfirm] = useState(null);

  // Modal de Backtest
  const [backtestBot, setBacktestBot] = useState(null);

  const handleNavegar = useCallback((telaId, ctx) => {
    if (onNavegarExterno) onNavegarExterno(telaId, ctx);
  }, [onNavegarExterno]);

  // Fetch dos bots — usa filtros server-side onde dá, e busca client-side por nome
  // (Backend tem `q` por nome ILIKE, mas pra simplicidade UX deixamos client-side
  //  já que a tabela é pequena. Se passar de algumas centenas, mover pra server.)
  const fetchBots = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const params = {
        limit: LIMIT,
        offset: page * LIMIT,
      };
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

  // Filtra por nome no client (busca instantânea sem ir no server)
  const botsFiltrados = useMemo(() => {
    if (!busca.trim()) return bots;
    const q = normaliza(busca);
    return bots.filter(b => normaliza(b.nome).includes(q));
  }, [bots, busca]);

  // Ações
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

  // Esc fecha modal
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

        @keyframes mike-modal-fade {
          from { opacity: 0; transform: translateY(8px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        @keyframes mike-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .mike-spin { animation: mike-spin 0.8s linear infinite; }
      `}</style>

      <MikeHeader telaAtiva="bots" onNavegar={handleNavegar} />

      <main className="max-w-screen-xl mx-auto px-4 lg:px-8 py-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-[--mike-fg-muted] mb-4">
          <Home className="w-3 h-3" />
          <span>Início</span>
          <ChevronRight className="w-3 h-3" />
          <span className="text-[--mike-fg] font-semibold">Bots</span>
        </div>

        {/* Header */}
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
            title="Recarregar"
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

        {/* Busca + filtros */}
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

        {/* Painel filtros */}
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
                  ...Object.values(STATUS_BOT).map(s => ({ value: s.id, label: s.label })),
                ]} />
              </div>
            </div>
          </div>
        )}

        {/* Erro */}
        {erro && (
          <div className="mb-4 rounded-md flex items-center gap-3 px-4 py-3" style={{
            backgroundColor: 'rgba(244, 63, 94, 0.1)',
            border: '0.5px solid rgba(244, 63, 94, 0.4)',
          }}>
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <p className="flex-1 text-xs text-rose-200">
              Erro ao carregar bots: {erro}
            </p>
            <button onClick={fetchBots} className="text-xs text-rose-200 underline hover:text-white">
              Tentar de novo
            </button>
          </div>
        )}

        {/* LISTA */}
        {loading && bots.length === 0 ? (
          <div className="flex items-center justify-center py-20 gap-2 text-[--mike-fg-muted] text-xs">
            <RefreshCw className="w-4 h-4 mike-spin" />
            Carregando bots...
          </div>
        ) : botsFiltrados.length > 0 ? (
          <div className="space-y-1.5">
            {botsFiltrados.map(bot => (
              <LinhaBot
                key={bot.id}
                bot={bot}
                onAcao={handleAcao}
                loadingAcao={!!loadingAcao[bot.id]}
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

        {/* Paginação */}
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

        {/* FAB */}
        <button
          onClick={() => handleNavegar('criar_bot')}
          className="fixed bottom-6 right-6 z-30 w-14 h-14 rounded-full bg-[--mike-accent] hover:bg-emerald-400 text-[--mike-bg] flex items-center justify-center shadow-2xl shadow-[--mike-accent]/40 hover:scale-110 transition-transform"
          title="Criar novo bot"
        >
          <Plus className="w-6 h-6" strokeWidth={3} />
        </button>
      </main>

      {/* MODAL BACKTEST */}
      {backtestBot && (
        <BacktestModal
          aberto={!!backtestBot}
          bot={backtestBot}
          onFechar={() => setBacktestBot(null)}
        />
      )}

      {/* TOASTS */}
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

      {/* MODAL CONFIRMAÇÃO */}
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
