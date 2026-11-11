// ============================================================
// shared/MikeHeader.jsx
//
// Header compartilhado por todas as telas do TipMike.
// Antes estava duplicado em Live, Today, Bots, Stats,
// CriarBot e PartidaIndividual.
//
// Fase 2 (auth): chip do usuário agora vem do AuthContext
// (nome/role reais) + botão de sair.
//
// nov/2026 (países): seletor de país antes do sino. Trocar grava no
// localStorage (PaisContext) e o App remonta a tela com key={pais}, então
// os dados recarregam já com o X-Pais novo.
//
// USO:
//   import MikeHeader, { NAV_ITEMS } from '../shared/MikeHeader.jsx';
//   <MikeHeader telaAtiva="live" onNavegar={navegar} />
// ============================================================

import { useEffect, useRef, useState } from 'react';
import {
  Bell, Settings, LogOut, ChevronDown, Check,
  Home, Activity, Store, Bot, Table2, BarChart3, Plus, FlaskConical, Users,
  Radar, ListChecks,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { usePais } from '../context/PaisContext.jsx';
import { bandeiraDoPais } from '../lib/pais.js';

export const NAV_ITEMS = [
  { id: 'today',       label: 'Início',          icon: Home },
  { id: 'live',        label: 'Ao Vivo',         icon: Activity },
  { id: 'marketplace', label: 'Mercado de Bots', icon: Store },
  { id: 'bots',        label: 'Bots',            icon: Bot },
  { id: 'tables',      label: 'Tabelas',         icon: Table2 },
  { id: 'stats',       label: 'Estatísticas',    icon: BarChart3, novo: true },
  { id: 'backtest',    label: 'Backtest',        icon: FlaskConical, novo: true },
  { id: 'varredura',   label: 'Varredura',       icon: Radar, novo: true },
  { id: 'esteira',     label: 'Esteira',         icon: ListChecks, novo: true },
  { id: 'extras',      label: 'Extras',          icon: Plus },
  { id: 'usuarios',    label: 'Usuários',        icon: Users, admin: true },
];

// Seletor de país (bandeira + nome). Todos os usuários veem todos os países.
function SeletorPais() {
  const { pais, setPais, paises, infoPais } = usePais();
  const [aberto, setAberto] = useState(false);
  const caixaRef = useRef(null);

  useEffect(() => {
    if (!aberto) return undefined;
    const aoClicarFora = (e) => {
      if (caixaRef.current && !caixaRef.current.contains(e.target)) setAberto(false);
    };
    const aoTeclar = (e) => { if (e.key === 'Escape') setAberto(false); };
    document.addEventListener('mousedown', aoClicarFora);
    document.addEventListener('keydown', aoTeclar);
    return () => {
      document.removeEventListener('mousedown', aoClicarFora);
      document.removeEventListener('keydown', aoTeclar);
    };
  }, [aberto]);

  const escolher = (codigo) => {
    setAberto(false);
    if (codigo !== pais) setPais(codigo);
  };

  return (
    <div ref={caixaRef} className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold text-[--mike-fg-muted] hover:text-[--mike-fg] transition"
        style={{ border: '0.5px solid rgba(60, 85, 130, 0.4)' }}
        title={`País: ${infoPais.nome} (clique para trocar)`}
        aria-haspopup="listbox"
        aria-expanded={aberto}
      >
        <span className="text-sm leading-none">{infoPais.bandeira}</span>
        <span className="hidden sm:inline">{infoPais.nome}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${aberto ? 'rotate-180' : ''}`} />
      </button>
      {aberto && (
        <div
          role="listbox"
          className="absolute right-0 top-full mt-1 min-w-[150px] rounded-md py-1 z-40"
          style={{
            backgroundColor: '#0d1220',
            border: '0.5px solid rgba(60, 85, 130, 0.4)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          }}
        >
          {paises.map((p) => {
            const ativo = p.codigo === pais;
            return (
              <button
                key={p.codigo}
                type="button"
                role="option"
                aria-selected={ativo}
                onClick={() => escolher(p.codigo)}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition ${
                  ativo ? 'bg-[--mike-accent]/15 text-[--mike-accent] font-semibold' : 'text-[--mike-fg-soft] hover:bg-[--mike-card-hover]'
                }`}
              >
                <span className="text-sm leading-none">{bandeiraDoPais(p.codigo)}</span>
                <span className="flex-1">{p.nome || p.codigo}</span>
                {ativo && <Check className="w-3 h-3" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}


export default function MikeHeader({ telaAtiva, onNavegar }) {
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);
  const { usuario, sair } = useAuth();

  const nome = usuario?.nome || 'Usuário';
  const inicial = nome.trim().charAt(0).toUpperCase() || 'U';
  const papel = usuario?.role === 'admin' ? 'Administrador' : 'Usuário';

  // itens marcados como admin só aparecem pra admins
  const itensNav = NAV_ITEMS.filter((n) => !n.admin || usuario?.role === 'admin');

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
          {itensNav.map((n) => {
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

        <SeletorPais />

        <button className="text-[--mike-fg-muted] hover:text-[--mike-fg] transition">
          <Bell className="w-4 h-4" />
        </button>
        <button className="text-[--mike-fg-muted] hover:text-[--mike-fg] transition hidden sm:block">
          <Settings className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2 pl-3" style={{ borderLeft: '0.5px solid rgba(60, 85, 130, 0.4)' }}>
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[--mike-accent] to-[--mike-accent-2] flex items-center justify-center font-black text-[--mike-bg] text-xs">
            {inicial}
          </div>
          <div className="hidden lg:flex flex-col leading-tight">
            <span className="text-[11px] text-[--mike-fg] font-semibold">{nome}</span>
            <span className="text-[9px] text-[--mike-fg-muted]">{papel}</span>
          </div>
          <button
            onClick={() => sair()}
            className="ml-1 text-[--mike-fg-muted] hover:text-red-400 transition"
            title="Sair"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Drawer mobile */}
      {menuMobileAberto && (
        <div className="md:hidden border-t" style={{ borderColor: 'rgba(60,85,130,0.4)' }}>
          <nav className="px-4 py-2 grid grid-cols-2 gap-1">
            {itensNav.map((n) => {
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
