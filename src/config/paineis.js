// ============================================================
// config/paineis.js — Lista ÚNICA dos painéis do TipMike
//
// É AQUI que se liga e desliga painel. Um painel com `ativo: false`:
//   - some do menu (computador e celular);
//   - deixa de ter rota: quem digitar o endereço cai no Início;
//   - `navegar('<id>')` também cai no Início.
//
// O código da tela continua no repositório. Para religar um painel
// quando ele ficar pronto, troque `ativo: false` por `ativo: true`
// na linha dele — menu e rota voltam juntos, sem mexer em mais nada.
//
// A ordem desta lista é a ordem do menu.
// ============================================================

import {
  Home, Activity, Store, Bot, Table2, BarChart3, Plus, FlaskConical, Users,
  Radar, ListChecks,
} from 'lucide-react';

export const PAINEIS = [
  { id: 'today',       rota: '/',               label: 'Início',          icon: Home,         ativo: true },
  { id: 'live',        rota: '/live',           label: 'Ao Vivo',         icon: Activity,     ativo: true },

  // Em desenvolvimento: fora do painel por enquanto (13/11/2026).
  {
    id: 'marketplace', rota: '/marketplace',    label: 'Mercado de Bots', icon: Store,        ativo: false,
    emDesenvolvimento: true,
    descricao: 'Loja para descobrir, comprar e vender estratégias de bots criadas pela comunidade.',
  },

  { id: 'bots',        rota: '/bots',           label: 'Bots',            icon: Bot,          ativo: true },

  // Em desenvolvimento: fora do painel por enquanto (13/11/2026).
  {
    id: 'tables',      rota: '/tables',         label: 'Tabelas',         icon: Table2,       ativo: false,
    emDesenvolvimento: true,
    descricao: 'Tabelas detalhadas de classificação, ROI por liga, ranking de jogadores e estatísticas históricas.',
  },

  // Fora do painel por enquanto (13/11/2026): as análises daqui abrem a tela de
  // Partida, que ainda mostra números simulados. Volta quando estiver 100%.
  { id: 'stats',       rota: '/stats',          label: 'Estatísticas',    icon: BarChart3,    ativo: false },
  { id: 'backtest',    rota: '/backtest',       label: 'Backtest',        icon: FlaskConical, ativo: true },
  { id: 'varredura',   rota: '/varredura',      label: 'Varredura',       icon: Radar,        ativo: true },
  { id: 'esteira',     rota: '/esteira',        label: 'Esteira',         icon: ListChecks,   ativo: true },

  // Em desenvolvimento: fora do painel por enquanto (13/11/2026).
  {
    id: 'extras',      rota: '/extras',         label: 'Extras',          icon: Plus,         ativo: false,
    emDesenvolvimento: true,
    descricao: 'Configurações, integrações, calculadoras, calendário, perfil, suporte e ferramentas auxiliares.',
  },

  { id: 'usuarios',    rota: '/admin/usuarios', label: 'Usuários',        icon: Users,        ativo: true, admin: true },

  // ── Telas que não são item de menu (menu: false) ───────────────────
  // Partida: abria ao clicar numa partida do Início ou do Ao Vivo. Ainda
  // monta os números por simulação (USE_MOCK_PARTIDA em PartidaIndividual.jsx),
  // sem consultar a API. Desligada (13/11/2026): as partidas deixam de ser
  // clicáveis. Religar aqui quando a tela usar dados reais.
  { id: 'partida',     rota: '/partida',        label: 'Partida',         icon: Activity,     ativo: false, menu: false },
];

const POR_ID = Object.fromEntries(PAINEIS.map((p) => [p.id, p]));

/** Dados de um painel pelo id (ou undefined). */
export function painel(id) {
  return POR_ID[id];
}

/** true se o painel existe e está ligado. */
export function painelAtivo(id) {
  return Boolean(POR_ID[id] && POR_ID[id].ativo);
}

/** Rota do painel; painel desligado ou desconhecido cai no Início. */
export function rotaDoPainel(id) {
  return painelAtivo(id) ? POR_ID[id].rota : '/';
}

/** Itens do menu para quem está logado (admin vê os itens de admin). */
export function paineisDoMenu(usuario) {
  const ehAdmin = usuario?.role === 'admin';
  return PAINEIS.filter((p) => p.ativo && p.menu !== false && (!p.admin || ehAdmin));
}
