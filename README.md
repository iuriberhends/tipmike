# 🤖 TipMike

> Sistema de gerenciamento de bots de apostas esportivas — clone aprimorado do TipManager.net focado em e-sports.

[![Vite](https://img.shields.io/badge/Vite-5.3-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Tailwind](https://img.shields.io/badge/Tailwind-3.4-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

---

## 📋 Sobre

TipMike é um painel completo pra operar bots de apostas esportivas em **e-sports** (NBA 2K, FIFA, NHL, eHockey, etc.). Foi construído como evolução do TipManager.net, com foco em:

- **Análise estatística profunda** (heatmaps WR/ROI, distribuições, H2H)
- **Gestão de múltiplos bots** em paralelo (Superbet, Betano, Bet365, Estrelabet, Vupi, Novibet)
- **Live tracking** de partidas com odds em tempo real
- **Integração nativa com MikeDB** (PostgreSQL) e TipManager API

> ⚠️ **Status**: Frontend completo e funcional usando mocks determinísticos. Backend (FastAPI + MikeDB) em planejamento — toggle `USE_MOCK = true` em `lib/apiClient.js`.

---

## ✨ Telas implementadas

| Tela | Status | Descrição |
|------|--------|-----------|
| **Início (Today)** | ✅ | Dashboard diário: jogos, bots ativos, KPIs do dia |
| **Ao Vivo (Live)** | ✅ | Partidas em andamento + bots rodando + logs |
| **Mercado de Bots** | 🚧 | Marketplace pra clonar estratégias de outros operadores |
| **Bots** | ✅ | Lista de bots com filtros, métricas multi-período |
| **Tabelas** | 🚧 | Standings dos torneios |
| **Estatísticas** | ✅ | Hub completo: heatmap, distribuições, H2H, comparador |
| **Extras** | 🚧 | Ferramentas auxiliares (calculadora, conversor) |
| **Criar Bot** | ✅ | Form multi-seção pra configurar nova estratégia |
| **Partida Individual** | ✅ | Análise detalhada de jogo com H2H, odds, contexto |
| **Histórico** | ✅ | Modal sobreposto com histórico do bot |

---

## 🚀 Quick Start

### Pré-requisitos

- Node.js 18+
- npm, yarn ou pnpm

### Instalação

```bash
# Clonar repositório
git clone https://github.com/SEU_USUARIO/tipmike.git
cd tipmike

# Instalar dependências
npm install

# Rodar em modo dev
npm run dev

# Abrir no navegador
# http://localhost:5173
```

### Build pra produção

```bash
npm run build
npm run preview
```

---

## 🏗️ Arquitetura

### Stack

- **React 18** + Hooks
- **Vite 5** (bundler ultra-rápido)
- **Tailwind CSS 3.4** (utility-first)
- **Lucide React** (ícones)
- Sem TypeScript (por simplicidade — pode migrar depois)
- Sem React Router (orquestração via state local — pronto pra migrar)

### Estrutura de pastas

```
tipmike/
├── src/
│   ├── App.jsx                 # Orquestrador principal (state-based router)
│   ├── main.jsx                # Entry point
│   ├── index.css               # CSS global + variáveis Tailwind
│   └── screens/
│       ├── Today.jsx           # Dashboard diário
│       ├── Live.jsx            # Partidas + bots ao vivo
│       ├── Bots.jsx            # Lista de bots
│       ├── Stats.jsx           # Hub estatístico
│       ├── CriarBot.jsx        # Form criar/editar bot
│       ├── PartidaIndividual.jsx  # Análise de jogo
│       └── Historico.jsx       # Modal histórico
├── public/
├── index.html
├── package.json
├── tailwind.config.js
├── vite.config.js
└── postcss.config.js
```

### Padrão de cada tela

Cada `screens/*.jsx` é **autossuficiente**:

- Mocks determinísticos (`hashStr` + `seeded LCG` → mesmo input = mesmo output)
- Hooks `useApiQuery` / `useApiMutation` (API React Query-like)
- Toggle `USE_MOCK = true` (trocar pra `false` quando backend existir)
- Endpoints documentados em comentários (`// 🔌 BACKEND: GET /endpoint`)

Exemplo de hook:

```js
function useStatsOverview(esporte) {
  const { data, loading, error } = useApiQuery('/stats/overview', { esporte });
  return { data, loading, error };
}
```

---

## 🔌 Backend planejado

### Endpoints essenciais

```
GET    /bots                        # Lista
POST   /bots                        # Criar
PUT    /bots/:id                    # Editar
DELETE /bots/:id                    # Deletar
POST   /bots/:id/start              # Iniciar processo
POST   /bots/:id/stop               # Parar processo

GET    /stats/overview              # KPIs + ligas do esporte
GET    /stats/proximos              # Próximos jogos (paginado)
GET    /stats/ultimos               # Últimos resultados
GET    /stats/heatmap               # Matriz 7d×24h (WR/ROI/qtd)
GET    /stats/distribuicoes         # Histogramas WR + ROI
GET    /stats/jogadores             # Lista pra autocomplete
GET    /stats/torneios              # Ligas do esporte
GET    /stats/preview-jogador       # Stats rápidas de 1 jogador

GET    /partidas/:id                # Detalhe de partida
GET    /h2h?jogadorA=&jogadorB=     # Confrontos diretos
```

### Stack sugerido

- **FastAPI** (Python) — fácil integrar com bots existentes em Python
- **PostgreSQL** (MikeDB já existe: tabela `ticks`, `h2h_matches`)
- **WebSocket** pra dados live (collectors Bet365 WS, Betano CDP, etc.)
- **Subprocess manager** pra rodar `bot_vupi_battle.py`, `supermae.py`, etc.
- **JWT** ou **Supabase Auth** pra multi-usuário

---

## 🎨 Design System

### Variáveis CSS principais

```css
--mike-bg: #0b0f1a              /* fundo escuro */
--mike-card: #141a28            /* card padrão */
--mike-card-2: #1c2438          /* card hover/ativo */
--mike-fg: #eaeef7              /* texto principal */
--mike-fg-soft: #b6c2d9         /* texto secundário */
--mike-fg-muted: #6b7691        /* texto muted */
--mike-accent: #10b981          /* verde principal */
```

### Convenções

- Bordas finas: `0.5px solid rgba(60, 85, 130, 0.4)` (classe `.mike-border-thin`)
- Esportes têm cor própria (NBA 2K = laranja, FIFA = verde, etc.)
- Casas de aposta com identidade visual (Superbet vermelho, Betano laranja, etc.)
- Datas em formato curto: `dd/MM HH:mm`
- Números monetários com `font-mono` + sinal (`+`/`-`)

---

## 📊 Funcionalidades destaque

### 🎯 Heatmap inteligente (Stats)
- 7 dias × 24 horas
- Toggle entre **WR%**, **ROI** e **Volume**
- Indicador visual de "agora" (outline amarelo + dot pulse)
- Insights gerados: melhor WR, melhor ROI, horário a evitar
- **Botão "Criar bot"** direto a partir do insight

### 🔍 Comparador H2H (Stats)
- Selecionar 2 jogadores e ver mini-preview lado a lado
- WR últimas 10, sequência atual, lucro 24h, stream W/L
- Insight rápido: "Jogador X melhor forma (+15% WR)"
- Validação: bloqueia jogador 1 == jogador 2

### 💾 Persistência local
- localStorage mantém último esporte e tab abertos
- Recarregar página não perde contexto
- Filtros resetam ao trocar esporte (UX intencional)

### 🤖 CriarBot multi-estratégia
- Suporta 8 estratégias: OFT, OHT, HC FT, Under HT, Over FT, ML, HC H2H, OU
- Sliders de range pra filtros (Diff, Linha, WR mínimo, etc.)
- Multi-tag pra blacklist de jogadores
- Modo edição de bot existente

---

## 🛠️ Próximos passos

### MVP funcional (~2 semanas)

- [ ] Subir API FastAPI envolvendo MikeDB
- [ ] Implementar 10 endpoints essenciais
- [ ] Trocar `USE_MOCK = false`
- [ ] WebSocket pra dados live
- [ ] Process manager dos bots (subprocess + status)
- [ ] Auth básico (JWT ou Supabase)

### Telas faltando

- [ ] Marketplace de Bots (clonar estratégias)
- [ ] Tabelas (standings)
- [ ] Extras (calculadora de stake, conversor de odds)

### Melhorias UX

- [ ] React Router (deep-link `/stats/nba2k?jogador=Sting`)
- [ ] Atalhos de teclado (1/2/3/4 troca tabs, Esc fecha modal)
- [ ] Tema light (hoje só dark)
- [ ] PWA (instalar como app)
- [ ] Notificações push quando bot fecha green/red

---

## 🤝 Contribuindo

Esse é um projeto pessoal pra operação de bots em produção. Se quiser sugerir melhorias, abre uma **Issue** ou **PR**.

### Convenções de código

- 2 espaços de indentação
- Comentários em português (BR)
- Nomes de função em **camelCase**
- Componentes em **PascalCase**
- Constantes em **SCREAMING_SNAKE_CASE**

---

## 📄 Licença

MIT — uso pessoal/comercial liberado, sem garantias.

---

## 🙏 Créditos

- Inspirado no [TipManager.net](https://tipmanager.net)
- Construído com [Claude](https://claude.ai) (Anthropic)
- Ícones: [Lucide](https://lucide.dev)
"# tipmike" 
