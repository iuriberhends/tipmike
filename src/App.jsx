// ============================================================
// App.jsx - Orquestrador principal do TipMike
//
// Roteia entre todas as telas. Estado: { tela, contexto }.
// Histórico fica em estado separado pq é modal sobreposto.
//
// Em produção: substituir por React Router (BrowserRouter + Routes)
// ou Next.js App Router. Hoje usa estado local pra simplicidade.
// ============================================================

import { useState, useEffect, useCallback } from 'react';

import Today from './screens/Today.jsx';
import Live from './screens/Live.jsx';
import Bots from './screens/Bots.jsx';
import PartidaIndividual from './screens/PartidaIndividual.jsx';
import CriarBot from './screens/CriarBot.jsx';
import Stats from './screens/Stats.jsx';
import { ModalHistorico } from './screens/Historico.jsx';

// Tela placeholder pra rotas que ainda não tem implementação
function TelaPlaceholder({ titulo, descricao, onVoltar }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8" style={{
      backgroundColor: '#0b0f1a',
      color: '#eaeef7',
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
      <button
        onClick={onVoltar}
        className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition"
        style={{
          backgroundColor: '#10b981',
          color: '#0b0f1a',
          boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
        }}
      >
        ← Voltar para o início
      </button>
    </div>
  );
}

export default function App() {
  // Tela atual + contexto opcional (botId, partidaId, etc)
  const [rota, setRota] = useState({ tela: 'today', contexto: null });

  // Modal histórico flutua sobre qualquer tela
  const [historicoBotId, setHistoricoBotId] = useState(null);

  // Função única de navegação - todas as telas recebem ela
  const navegar = useCallback((tela, contexto = null) => {
    // Histórico é modal, não muda rota
    if (tela === 'historico') {
      setHistoricoBotId(contexto?.botId || contexto);
      return;
    }
    setRota({ tela, contexto });
    // Scroll pro topo ao trocar de tela
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  // Atalho global: Alt+H volta pra home
  useEffect(() => {
    const handler = (e) => {
      if (e.altKey && e.key === 'h') {
        e.preventDefault();
        navegar('today');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navegar]);

  // Renderiza a tela ativa
  const telaAtual = (() => {
    switch (rota.tela) {
      case 'today':
        return (
          <Today
            onNavegar={navegar}
            onAbrirPartida={(p) => navegar('partida', p)}
          />
        );

      case 'live':
        return (
          <Live
            onNavegar={navegar}
            onAbrirPartida={(p) => navegar('partida', p)}
          />
        );

      case 'bots':
        return (
          <Bots
            onNavegar={navegar}
          />
        );

      case 'partida':
        return (
          <PartidaIndividual
            partida={rota.contexto}
            onNavegar={navegar}
          />
        );

      case 'criar_bot':
        return (
          <CriarBot
            botId={rota.contexto?.botId || null}
            onSalvar={(bot) => {
              // Volta pra lista de bots após salvar
              navegar('bots');
            }}
            onCancelar={() => navegar('bots')}
            onNavegar={navegar}
          />
        );

      // Telas planejadas (placeholders)
      case 'marketplace':
        return (
          <TelaPlaceholder
            titulo="Mercado de Bots"
            descricao="Loja para descobrir, comprar e vender estratégias de bots criadas pela comunidade."
            onVoltar={() => navegar('today')}
          />
        );

      case 'tables':
        return (
          <TelaPlaceholder
            titulo="Tabelas"
            descricao="Tabelas detalhadas de classificação, ROI por liga, ranking de jogadores e estatísticas históricas."
            onVoltar={() => navegar('today')}
          />
        );

      case 'stats':
        return (
          <Stats
            onNavegar={navegar}
          />
        );

      case 'extras':
        return (
          <TelaPlaceholder
            titulo="Extras"
            descricao="Configurações, integrações, calculadoras, calendário, perfil, suporte e ferramentas auxiliares."
            onVoltar={() => navegar('today')}
          />
        );

      default:
        return (
          <Today
            onNavegar={navegar}
            onAbrirPartida={(p) => navegar('partida', p)}
          />
        );
    }
  })();

  return (
    <>
      {telaAtual}

      {/* Modal de histórico - flutua sobre qualquer tela */}
      {historicoBotId && (
        <ModalHistorico
          botId={historicoBotId}
          aberto={true}
          onClose={() => setHistoricoBotId(null)}
        />
      )}
    </>
  );
}
