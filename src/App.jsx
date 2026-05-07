// ============================================================
// App.jsx - Orquestrador principal do TipMike
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import {
  HashRouter, Routes, Route, useNavigate, useLocation,
} from 'react-router-dom';

import Today from './screens/Today.jsx';
import Live from './screens/Live.jsx';
import Bots from './screens/Bots.jsx';
import PartidaIndividual from './screens/PartidaIndividual.jsx';
import CriarBot from './screens/CriarBot.jsx';
import Stats from './screens/Stats.jsx';
import { ModalHistorico } from './screens/Historico.jsx';

function TelaPlaceholder({ titulo, descricao }) {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8" style={{
      backgroundColor: '#0b0f1a', color: '#eaeef7',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div className="text-center max-w-md">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center" style={{
          backgroundColor: 'rgba(20, 26, 40, 0.6)',
          border: '0.5px solid rgba(60, 85, 130, 0.4)',
        }}>
          <svg className="w-8 h-8 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
          </svg>
        </div>
        <h1 className="text-2xl font-bold mb-2">{titulo}</h1>
        <p className="text-sm text-slate-400 mb-6">{descricao}</p>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold" style={{
          backgroundColor: 'rgba(251, 191, 36, 0.15)',
          border: '0.5px solid rgba(251, 191, 36, 0.4)',
          color: '#fbbf24',
        }}>
          🚧 Em desenvolvimento
        </div>
      </div>
      <button onClick={() => navigate('/')} className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition"
        style={{ backgroundColor: '#10b981', color: '#0b0f1a', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)' }}>
        ← Voltar para o início
      </button>
    </div>
  );
}

function AppRoutes() {
  const navigate = useNavigate();
  const location = useLocation();
  const [historicoBotId, setHistoricoBotId] = useState(null);

  // Normaliza partida — converte snake_case (API) para camelCase (PartidaIndividual)
  const normalizarPartida = useCallback((p) => {
    if (!p) return p;
    const sportMap = {
      'E-Football':   'e-Soccer',
      'E-Basketball': 'e-Basket',
      'E-Hockey':     'e-Hockey',
    };
    return {
      ...p,
      jogadorA: p.jogadorA  || p.jogador_a  || '',
      jogadorB: p.jogadorB  || p.jogador_b  || '',
      esporte:  p.esporte   || sportMap[p.sport] || p.sport || 'e-Soccer',
      liga:     p.liga      || '',
      timeA:    p.timeA     || p.time_a     || '',
      timeB:    p.timeB     || p.time_b     || '',
      placarA:  p.placarA   ?? p.score_home ?? null,
      placarB:  p.placarB   ?? p.score_away ?? null,
    };
  }, []);

  const navegar = useCallback((tela, contexto = null) => {
    if (tela === 'historico') {
      setHistoricoBotId(contexto?.botId || contexto);
      return;
    }
    const paths = {
      today:      '/',
      live:       '/live',
      bots:       '/bots',
      stats:      '/stats',
      marketplace:'/marketplace',
      tables:     '/tables',
      extras:     '/extras',
    };
    if (tela === 'partida') {
      navigate('/partida', { state: normalizarPartida(contexto) });
      return;
    }
    if (tela === 'criar_bot') {
      navigate('/criar-bot', { state: contexto });
      return;
    }
    navigate(paths[tela] ?? '/');
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [navigate, normalizarPartida]);

  useEffect(() => {
    const handler = (e) => {
      if (e.altKey && e.key === 'h') { e.preventDefault(); navigate('/'); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate]);

  return (
    <>
      <Routes>
        <Route path="/" element={<Today onNavegar={navegar} onAbrirPartida={(p) => navegar('partida', p)} />} />
        <Route path="/live" element={<Live onNavegar={navegar} onAbrirPartida={(p) => navegar('partida', p)} />} />
        <Route path="/bots" element={<Bots onNavegar={navegar} />} />
        <Route path="/partida" element={<PartidaIndividual partida={location.state} onNavegar={navegar} />} />
        <Route path="/criar-bot" element={<CriarBot botId={location.state?.botId || null} onSalvar={() => navigate('/bots')} onCancelar={() => navigate('/bots')} onNavegar={navegar} />} />
        <Route path="/stats" element={<Stats onNavegar={navegar} />} />
        <Route path="/marketplace" element={<TelaPlaceholder titulo="Mercado de Bots" descricao="Loja para descobrir, comprar e vender estratégias de bots criadas pela comunidade." />} />
        <Route path="/tables" element={<TelaPlaceholder titulo="Tabelas" descricao="Tabelas detalhadas de classificação, ROI por liga, ranking de jogadores e estatísticas históricas." />} />
        <Route path="/extras" element={<TelaPlaceholder titulo="Extras" descricao="Configurações, integrações, calculadoras, calendário, perfil, suporte e ferramentas auxiliares." />} />
        <Route path="*" element={<Today onNavegar={navegar} onAbrirPartida={(p) => navegar('partida', p)} />} />
      </Routes>

      {historicoBotId && (
        <ModalHistorico botId={historicoBotId} aberto={true} onClose={() => setHistoricoBotId(null)} />
      )}
    </>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AppRoutes />
    </HashRouter>
  );
}
