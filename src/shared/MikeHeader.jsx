// ============================================================
// shared/MikeHeader.jsx
//
// Header compartilhado por todas as telas do TipMike.
// Antes estava duplicado em Live, Today, Bots, Stats,
// CriarBot e PartidaIndividual.
//
// USO:
//   import MikeHeader, { NAV_ITEMS } from '../shared/MikeHeader.jsx';
//   <MikeHeader telaAtiva="live" onNavegar={navegar} />
// ============================================================

import { useState } from 'react';
import {
  Bell, Settings,
  Home, Activity, Store, Bot, Table2, BarChart3, Plus, FlaskConical,
} from 'lucide-react';

export const NAV_ITEMS = [
  { id: 'today',       label: 'Início',          icon: Home },
  { id: 'live',        label: 'Ao Vivo',         icon: Activity },
  { id: 'marketplace', label: 'Mercado de Bots', icon: Store },
  { id: 'bots',        label: 'Bots',            icon: Bot },
  { id: 'tables',      label: 'Tabelas',         icon: Table2 },
  { id: 'stats',       label: 'Estatísticas',    icon: BarChart3, novo: true },
  { id: 'backtest',    label: 'Backtest',        icon: FlaskConical, novo: true },
  { id: 'extras',      label: 'Extras',          icon: Plus },
];


export default function MikeHeader({ telaAtiva, onNavegar }) {
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);

  return (
    <header className="sticky top-0 z-30 backdrop-blur-md" style={{
      backgroundColor: 'rgba(11, 15, 26, 0.8)',
      borderBottom: '0.5px solid rgba(60, 85, 130, 0.4)',
    }}>
      <div className="max-w-screen-xl mx-auto px-4 lg:px-8 h-14 flex items-center gap-4">
        {/* Hamburger (mobile) */}
        <button
          onClick={() => setMenuMobileAberto(!menuMobileAberto)}
          className="md:hidden p-1 rounded text-[--mike-fg-muted] hover:text-[--mike-fg] transition"
          title="Menu"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {menuMobileAberto ? <path d="M6 18L18 6M6 6l12 12" /> : <path d="M3 12h18M3 6h18M3 18h18" />}
          </svg>
        </button>

        <button
          onClick={() => { onNavegar?.('today'); setMenuMobileAberto(false); }}
          className="flex items-center gap-2 hover:opacity-90 transition"
          title="Início"
        >
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-[--mike-accent] to-[--mike-accent-2] flex items-center justify-center shadow-md shadow-[--mike-accent]/30">
            <span className="font-black text-[--mike-bg] text-base leading-none">M</span>
          </div>
          <span className="font-black text-[--mike-fg] tracking-tight text-base" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            TIPMIKE
          </span>
        </button>

        <div className="hidden md:flex items-center gap-1 ml-4">
          {NAV_ITEMS.map((n) => {
            const Icone = n.icon;
            const ativa = telaAtiva === n.id;
            return (
              <button
                key={n.id}
                onClick={() => onNavegar?.(n.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition relative ${
                  ativa ? 'text-[--mike-accent]' : 'text-[--mike-fg-muted] hover:text-[--mike-fg]'
                }`}
              >
                <Icone className="w-3.5 h-3.5" />
                {n.label}
                {n.novo && (
                  <span className="absolute -top-1 -right-1 px-1 rounded-sm bg-amber-500 text-amber-950 text-[7px] font-black">NOVO</span>
                )}
                {ativa && <div className="absolute -bottom-2 left-2 right-2 h-0.5 bg-[--mike-accent] rounded-full" />}
              </button>
            );
          })}
        </div>

        <div className="flex-1" />

        <button className="text-[--mike-fg-muted] hover:text-[--mike-fg] transition">
          <Bell className="w-4 h-4" />
        </button>
        <button className="text-[--mike-fg-muted] hover:text-[--mike-fg] transition hidden sm:block">
          <Settings className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2 pl-3" style={{ borderLeft: '0.5px solid rgba(60, 85, 130, 0.4)' }}>
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[--mike-accent] to-[--mike-accent-2] flex items-center justify-center font-black text-[--mike-bg] text-xs">S</div>
          <div className="hidden lg:flex flex-col leading-tight">
            <span className="text-[11px] text-[--mike-fg] font-semibold">Santos</span>
            <span className="text-[9px] text-[--mike-fg-muted]">BOT (eSports)</span>
          </div>
        </div>
      </div>

      {/* Drawer mobile */}
      {menuMobileAberto && (
        <div className="md:hidden border-t" style={{ borderColor: 'rgba(60,85,130,0.4)' }}>
          <nav className="px-4 py-2 grid grid-cols-2 gap-1">
            {NAV_ITEMS.map((n) => {
              const Icone = n.icon;
              const ativa = telaAtiva === n.id;
              return (
                <button
                  key={n.id}
                  onClick={() => { onNavegar?.(n.id); setMenuMobileAberto(false); }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-semibold transition ${
                    ativa ? 'bg-[--mike-accent]/15 text-[--mike-accent]' : 'text-[--mike-fg-soft] hover:bg-[--mike-card-hover]'
                  }`}
                >
                  <Icone className="w-3.5 h-3.5" />
                  {n.label}
                  {n.novo && <span className="px-1 rounded-sm bg-amber-500 text-amber-950 text-[7px] font-black ml-auto">NOVO</span>}
                </button>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
}