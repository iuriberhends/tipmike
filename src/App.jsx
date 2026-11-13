// ============================================================
// App.jsx - Orquestrador principal do TipMike
//
// Fase 2 (auth): AuthProvider envolve tudo; /login é pública e o
// resto das telas fica atrás do <RequireAuth /> (layout route).
//
// nov/2026: os painéis vêm de config/paineis.js. Painel desligado lá
// (ativo: false) não tem rota nem aparece no menu — hoje estão assim
// Mercado de Bots, Tabelas e Extras (em desenvolvimento), Estatísticas e
// a tela de Partida (que ainda mostra números simulados).
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import {
  HashRouter, Routes, Route, Navigate, useNavigate, useLocation,
} from 'react-router-dom';
import { Construction, ArrowLeft } from 'lucide-react';

import Today from './screens/Today.jsx';
import Live from './screens/Live.jsx';
import Bots from './screens/Bots.jsx';
import PartidaIndividual from './screens/PartidaIndividual.jsx';
import CriarBot from './screens/CriarBot.jsx';
import Stats from './screens/Stats.jsx';
import BacktestAvulso from './screens/BacktestAvulso.jsx';
import Varredura from './screens/Varredura.jsx';
import Esteira from './screens/Esteira.jsx';
import EsteiraEscolha from './screens/EsteiraEscolha.jsx';
import { ModalHistorico } from './screens/Historico.jsx';

import Login from './screens/Login.jsx';
import Registro from './screens/Registro.jsx';
import AdminUsuarios from './screens/AdminUsuarios.jsx';
import RequireAuth from './shared/RequireAuth.jsx';
import RequireAdmin from './shared/RequireAdmin.jsx';
import MikeHeader from './shared/MikeHeader.jsx';
import { ErroDeTela } from './shared/Estados.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { PaisProvider, usePais } from './context/PaisContext.jsx';
import { PAINEIS, painelAtivo, rotaDoPainel } from './config/paineis.js';

// Tela provisória de um painel que ainda não tem conteúdo. Só é usada se
// alguém ligar em config/paineis.js um painel marcado `emDesenvolvimento`.
function TelaPlaceholder({ id, titulo, descricao, onNavegar }) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--mike-bg)', color: 'var(--mike-fg)', fontFamily: 'var(--mike-font)' }}>
      <MikeHeader telaAtiva={id} onNavegar={onNavegar} />
      <main className="max-w-screen-xl mx-auto px-4 lg:px-8 py-16 flex flex-col items-center text-center gap-4 mike-entrar">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ backgroundColor: 'rgba(43, 205, 185, 0.08)', border: '0.5px solid rgba(43, 205, 185, 0.3)' }}
        >
          <Construction className="w-7 h-7" style={{ color: 'var(--mike-accent)' }} />
        </div>
        <h1 className="text-2xl font-bold m-0">{titulo}</h1>
        <p className="text-sm max-w-md m-0" style={{ color: 'var(--mike-fg-muted)' }}>{descricao}</p>
        <span
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold"
          style={{ backgroundColor: 'rgba(251, 191, 36, 0.12)', border: '0.5px solid rgba(251, 191, 36, 0.4)', color: '#fbbf24' }}
        >
          Em desenvolvimento
        </span>
        <button type="button" onClick={() => onNavegar('today')} className="mike-btn-primary mt-2">
          <ArrowLeft className="w-4 h-4" />
          Voltar para o início
        </button>
      </main>
    </div>
  );
}

function AppRoutes() {
  const navigate = useNavigate();
  const location = useLocation();
  const [historicoBotId, setHistoricoBotId] = useState(null);
  // Troca de pais: key={pais} nas rotas remonta a tela aberta, e todos os
  // useEffect de carga rodam de novo com o X-Pais novo (sem mexer tela a tela).
  const { pais } = usePais();

  // modal de historico e' de um bot do pais anterior: fecha na troca
  useEffect(() => { setHistoricoBotId(null); }, [pais]);

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
    if (tela === 'partida') {
      // tela de Partida desligada: o clique não leva a lugar nenhum
      if (painelAtivo('partida')) navigate('/partida', { state: normalizarPartida(contexto) });
      return;
    }
    if (tela === 'criar_bot' && painelAtivo('bots')) {
      navigate('/criar-bot', { state: contexto });
      return;
    }
    // sub-rotas da Esteira (não são itens de menu)
    const subRotas = {
      esteira_escolha: painelAtivo('esteira') ? '/esteira/escolha' : '/',
      escolher:        painelAtivo('esteira') ? '/escolher' : '/',
    };
    // painel desligado ou desconhecido cai no Início
    navigate(subRotas[tela] ?? rotaDoPainel(tela));
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [navigate, normalizarPartida]);

  useEffect(() => {
    const handler = (e) => {
      if (e.altKey && e.key === 'h') { e.preventDefault(); navigate('/'); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate]);

  // Com a tela de Partida desligada, Início e Ao Vivo recebem undefined e
  // deixam de mostrar as partidas como clicáveis.
  const abrirPartida = painelAtivo('partida') ? (p) => navegar('partida', p) : undefined;

  return (
    <ErroDeTela chave={location.pathname}>
      <Routes key={pais}>
        {/* Públicas */}
        <Route path="/login" element={<Login />} />
        <Route path="/registro" element={<Registro />} />

        {/* Protegidas (Fase 2): tudo abaixo exige sessão válida */}
        <Route element={<RequireAuth />}>
          <Route path="/" element={<Today onNavegar={navegar} onAbrirPartida={abrirPartida} />} />
          {painelAtivo('partida') && (
            <Route path="/partida" element={<PartidaIndividual partida={location.state} onNavegar={navegar} />} />
          )}

          {painelAtivo('live') && (
            <Route path="/live" element={<Live onNavegar={navegar} onAbrirPartida={abrirPartida} />} />
          )}
          {painelAtivo('bots') && (
            <>
              <Route path="/bots" element={<Bots onNavegar={navegar} />} />
              <Route path="/criar-bot" element={<CriarBot botId={location.state?.botId || null} onSalvar={() => navigate('/bots')} onCancelar={() => navigate('/bots')} onNavegar={navegar} />} />
            </>
          )}
          {painelAtivo('stats') && <Route path="/stats" element={<Stats onNavegar={navegar} />} />}
          {painelAtivo('backtest') && <Route path="/backtest" element={<BacktestAvulso onNavegar={navegar} />} />}
          {painelAtivo('varredura') && <Route path="/varredura" element={<Varredura onNavegar={navegar} />} />}
          {painelAtivo('esteira') && (
            <>
              <Route path="/esteira" element={<Esteira onNavegar={navegar} />} />
              <Route path="/esteira/escolha" element={<EsteiraEscolha onNavegar={navegar} />} />
              <Route path="/escolher" element={<EsteiraEscolha onNavegar={navegar} />} />
            </>
          )}

          {/* Painéis ainda sem conteúdo: só ganham rota se forem ligados em config/paineis.js */}
          {PAINEIS.filter((p) => p.emDesenvolvimento && p.ativo).map((p) => (
            <Route
              key={p.id}
              path={p.rota}
              element={<TelaPlaceholder id={p.id} titulo={p.label} descricao={p.descricao} onNavegar={navegar} />}
            />
          ))}

          {/* Só admin (Fase 5) */}
          {painelAtivo('usuarios') && (
            <Route element={<RequireAdmin />}>
              <Route path="/admin/usuarios" element={<AdminUsuarios onNavegar={navegar} />} />
            </Route>
          )}

          {/* Endereço desconhecido ou de painel desligado: Início */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>

      {historicoBotId && (
        <ModalHistorico botId={historicoBotId} aberto={true} onClose={() => setHistoricoBotId(null)} />
      )}
    </ErroDeTela>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <PaisProvider>
          <AppRoutes />
        </PaisProvider>
      </AuthProvider>
    </HashRouter>
  );
}
