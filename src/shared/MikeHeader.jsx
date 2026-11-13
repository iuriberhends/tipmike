// ============================================================
// shared/MikeHeader.jsx
//
// Cabeçalho compartilhado por todas as telas do TipMike.
//
// Fase 2 (auth): chip do usuário vem do AuthContext (nome/role reais)
// + botão de sair.
//
// nov/2026 (países): seletor de país. Trocar grava no localStorage
// (PaisContext) e o App remonta a tela com key={pais}, então os dados
// recarregam já com o X-Pais novo.
//
// nov/2026 (visual novo):
//   - logo nova; menu montado a partir de config/paineis.js (só painel
//     ligado aparece);
//   - marcador da tela atual desliza de um item para o outro (é a faixa
//     tracejada da estrada da logo);
//   - busca rápida: Ctrl+K (ou ⌘K) abre a PaletaComandos;
//   - menu do usuário no avatar; no celular, menu em tela cheia com
//     alvos de toque grandes;
//   - sino e engrenagem saíram: não faziam nada.
//
// USO:
//   import MikeHeader from '../shared/MikeHeader.jsx';
//   <MikeHeader telaAtiva="live" onNavegar={navegar} />
// ============================================================

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { LogOut, ChevronDown, Check, Menu, X, Search, Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { usePais } from '../context/PaisContext.jsx';
import Bandeira from './Bandeira.jsx';
import { PAINEIS, paineisDoMenu, painelAtivo } from '../config/paineis.js';
import { LogoMarca, Wordmark } from './Logo.jsx';
import PaletaComandos from './PaletaComandos.jsx';

// Compatibilidade: quem importava NAV_ITEMS recebe só os painéis ligados.
export const NAV_ITEMS = PAINEIS.filter((p) => p.ativo && p.menu !== false);

const LINHA = '0.5px solid var(--mike-linha)';

// Cada tela monta o próprio cabeçalho. Guardar aqui a última posição do
// marcador faz ele DESLIZAR do item anterior para o novo ao trocar de tela.
let ultimoMarcador = null;

function useFecharFora(aberto, fechar) {
  const ref = useRef(null);
  useEffect(() => {
    if (!aberto) return undefined;
    const aoClicarFora = (e) => { if (ref.current && !ref.current.contains(e.target)) fechar(); };
    const aoTeclar = (e) => { if (e.key === 'Escape') fechar(); };
    document.addEventListener('mousedown', aoClicarFora);
    document.addEventListener('keydown', aoTeclar);
    return () => {
      document.removeEventListener('mousedown', aoClicarFora);
      document.removeEventListener('keydown', aoTeclar);
    };
  }, [aberto, fechar]);
  return ref;
}

const ESTILO_SUSPENSO = {
  backgroundColor: 'var(--mike-card)',
  border: LINHA,
  boxShadow: '0 16px 40px rgba(0,0,0,0.6)',
};

// Seletor de país (bandeira + nome). Todos os usuários veem todos os países.
function SeletorPais() {
  const { pais, setPais, paises, infoPais } = usePais();
  const [aberto, setAberto] = useState(false);
  const fechar = useCallback(() => setAberto(false), []);
  const caixaRef = useFecharFora(aberto, fechar);

  const escolher = (codigo) => {
    setAberto(false);
    if (codigo !== pais) setPais(codigo);
  };

  return (
    <div ref={caixaRef} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-semibold text-[--mike-fg-soft] hover:text-[--mike-fg] hover:bg-[--mike-card-hover] transition"
        style={{ border: LINHA }}
        title={`País: ${infoPais.nome} (clique para trocar)`}
        aria-haspopup="listbox"
        aria-expanded={aberto}
      >
        <Bandeira codigo={pais} altura={14} />
        <span className="hidden sm:inline">{infoPais.nome}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${aberto ? 'rotate-180' : ''}`} />
      </button>
      {aberto && (
        <div role="listbox" className="absolute right-0 top-full mt-2 min-w-[176px] rounded-xl p-1 z-40 mike-entrar" style={ESTILO_SUSPENSO}>
          {paises.map((p) => {
            const ativo = p.codigo === pais;
            return (
              <button
                key={p.codigo}
                type="button"
                role="option"
                aria-selected={ativo}
                onClick={() => escolher(p.codigo)}
                className={`w-full flex items-center gap-2 px-2.5 h-9 rounded-lg text-xs text-left transition ${
                  ativo ? 'bg-mike-accent/15 text-[--mike-accent] font-semibold' : 'text-[--mike-fg-soft] hover:bg-[--mike-card-hover]'
                }`}
              >
                <Bandeira codigo={p.codigo} altura={14} />
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

function Avatar({ inicial, tamanho = 28 }) {
  return (
    <div
      className="rounded-full flex items-center justify-center font-black flex-shrink-0"
      style={{
        width: tamanho,
        height: tamanho,
        fontSize: Math.round(tamanho * 0.42),
        color: 'var(--mike-sobre-accent)',
        background: 'linear-gradient(145deg, var(--mike-menta), var(--mike-accent) 55%, var(--mike-accent-2))',
        boxShadow: '0 0 0 1px rgba(143, 241, 226, 0.25)',
      }}
    >
      {inicial}
    </div>
  );
}

// Avatar + menu do usuário (computador).
function MenuUsuario({ nome, papel, email, inicial, onSair }) {
  const [aberto, setAberto] = useState(false);
  const fechar = useCallback(() => setAberto(false), []);
  const caixaRef = useFecharFora(aberto, fechar);

  return (
    <div ref={caixaRef} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex items-center gap-2 h-9 pl-1 pr-1.5 rounded-full hover:bg-[--mike-card-hover] transition"
        title={nome}
        aria-haspopup="menu"
        aria-expanded={aberto}
      >
        <Avatar inicial={inicial} />
        <span className="hidden 2xl:flex flex-col items-start leading-tight max-w-[140px]">
          <span className="text-[11px] text-[--mike-fg] font-semibold truncate max-w-full">{nome}</span>
          <span className="text-[9px] text-[--mike-fg-muted]">{papel}</span>
        </span>
        <ChevronDown className={`w-3 h-3 text-[--mike-fg-muted] transition-transform ${aberto ? 'rotate-180' : ''}`} />
      </button>
      {aberto && (
        <div role="menu" className="absolute right-0 top-full mt-2 w-60 rounded-xl p-1 z-40 mike-entrar" style={ESTILO_SUSPENSO}>
          <div className="flex items-center gap-3 px-2.5 py-2.5">
            <Avatar inicial={inicial} tamanho={36} />
            <div className="min-w-0 leading-tight">
              <div className="text-sm text-[--mike-fg] font-semibold truncate">{nome}</div>
              <div className="text-[11px] text-[--mike-fg-muted] truncate">{email || papel}</div>
            </div>
          </div>
          <div className="h-px mx-1 my-1" style={{ backgroundColor: 'var(--mike-linha)' }} />
          <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[--mike-fg-muted]">{papel}</div>
          <button
            type="button"
            role="menuitem"
            onClick={() => { setAberto(false); onSair(); }}
            className="w-full flex items-center gap-2 px-2.5 h-9 rounded-lg text-xs font-semibold text-rose-300 hover:bg-rose-500/10 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sair da conta
          </button>
        </div>
      )}
    </div>
  );
}

export default function MikeHeader({ telaAtiva, onNavegar }) {
  const [menuAberto, setMenuAberto] = useState(false);
  const [paletaAberta, setPaletaAberta] = useState(false);
  const { usuario, sair } = useAuth();
  const { pais, setPais, paises } = usePais();

  const nome = usuario?.nome || 'Usuário';
  const inicial = nome.trim().charAt(0).toUpperCase() || 'U';
  const papel = usuario?.role === 'admin' ? 'Administrador' : 'Usuário';

  // só painéis ligados; itens de admin só para admin
  const itensNav = useMemo(() => paineisDoMenu(usuario), [usuario]);

  const ir = useCallback((id, contexto) => {
    setMenuAberto(false);
    onNavegar?.(id, contexto);
  }, [onNavegar]);

  // ── marcador deslizante da tela atual ──────────────────────────
  const navRef = useRef(null);
  const [marcador, setMarcador] = useState(ultimoMarcador);

  const medirMarcador = useCallback(() => {
    const nav = navRef.current;
    if (!nav) return;
    const alvo = nav.querySelector(`[data-painel="${telaAtiva}"]`);
    if (!alvo) {
      setMarcador((m) => (m ? { ...m, visivel: false } : m));
      return;
    }
    const novo = { left: alvo.offsetLeft + 10, width: Math.max(0, alvo.offsetWidth - 20), visivel: true };
    ultimoMarcador = novo;
    setMarcador(novo);
  }, [telaAtiva]);

  useLayoutEffect(() => {
    // um quadro de espera: o marcador nasce na posição antiga e desliza para a nova
    const quadro = requestAnimationFrame(medirMarcador);
    return () => cancelAnimationFrame(quadro);
  }, [medirMarcador, itensNav]);

  useEffect(() => {
    window.addEventListener('resize', medirMarcador);
    // a largura dos itens muda quando a fonte termina de carregar
    document.fonts?.ready?.then(medirMarcador).catch(() => {});
    return () => window.removeEventListener('resize', medirMarcador);
  }, [medirMarcador]);

  // ── busca rápida (Ctrl+K / ⌘K) ─────────────────────────────────
  useEffect(() => {
    const aoTeclar = (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setMenuAberto(false);
        setPaletaAberta((v) => !v);
      }
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, []);

  const comandos = useMemo(() => {
    const lista = itensNav.map((n) => ({
      id: `painel:${n.id}`,
      grupo: 'Painéis',
      label: n.label,
      icon: n.icon,
      atual: n.id === telaAtiva,
      acao: () => ir(n.id),
    }));
    if (painelAtivo('bots')) {
      lista.push({ id: 'acao:criar-bot', grupo: 'Ações', label: 'Criar um bot novo', palavras: 'novo adicionar estrategia', icon: Plus, acao: () => ir('criar_bot') });
    }
    paises.filter((p) => p.codigo !== pais).forEach((p) => {
      lista.push({
        id: `pais:${p.codigo}`,
        grupo: 'Ações',
        label: `Trocar para ${p.nome || p.codigo}`,
        palavras: `pais country ${p.codigo}`,
        bandeira: p.codigo,
        acao: () => setPais(p.codigo),
      });
    });
    lista.push({ id: 'acao:sair', grupo: 'Ações', label: 'Sair da conta', palavras: 'logout deslogar', icon: LogOut, acao: () => sair() });
    return lista;
  }, [itensNav, telaAtiva, ir, paises, pais, setPais, sair]);

  // ── menu de celular: Esc fecha e a página atrás não rola ───────
  useEffect(() => {
    if (!menuAberto) return undefined;
    const aoTeclar = (e) => { if (e.key === 'Escape') setMenuAberto(false); };
    document.addEventListener('keydown', aoTeclar);
    const overflowAntes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      document.body.style.overflow = overflowAntes;
    };
  }, [menuAberto]);

  return (
    <header
      className="sticky top-0 z-30"
      style={{
        backgroundColor: 'rgba(6, 11, 15, 0.86)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
      }}
    >
      <div className="max-w-screen-xl mx-auto px-4 lg:px-8 h-14 flex items-center gap-2.5 lg:gap-3">
        <button
          type="button"
          onClick={() => ir('today')}
          className="mike-logo-botao flex items-center gap-2 flex-shrink-0"
          title="Início"
          aria-label="TipMike — ir para o início"
        >
          <LogoMarca altura={30} />
          <Wordmark tamanho={15} />
        </button>

        {/* Menu (computador) */}
        <nav
          ref={navRef}
          className="hidden lg:flex relative items-stretch h-14 ml-2 min-w-0 overflow-x-auto scrollbar-none"
          aria-label="Painéis"
        >
          {itensNav.map((n) => {
            const Icone = n.icon;
            const ativa = telaAtiva === n.id;
            return (
              <button
                key={n.id}
                type="button"
                data-painel={n.id}
                onClick={() => ir(n.id)}
                aria-current={ativa ? 'page' : undefined}
                className={`mike-nav-item flex items-center gap-1.5 px-2.5 text-xs font-semibold whitespace-nowrap ${ativa ? 'mike-nav-item-ativa' : ''}`}
              >
                <Icone className="w-3.5 h-3.5 hidden xl:block" />
                {n.label}
              </button>
            );
          })}
          {/* marcador da tela atual: a faixa tracejada da estrada da logo */}
          {marcador && (
            <span
              aria-hidden
              className="mike-nav-marcador"
              style={{ left: marcador.left, width: marcador.width, opacity: marcador.visivel ? 1 : 0 }}
            />
          )}
        </nav>

        <div className="flex-1" />

        {/* Busca rápida */}
        <button
          type="button"
          onClick={() => { setMenuAberto(false); setPaletaAberta(true); }}
          className="flex items-center gap-2 h-8 px-2 2xl:pl-2.5 2xl:pr-1.5 rounded-lg text-xs text-[--mike-fg-muted] hover:text-[--mike-fg] hover:bg-[--mike-card-hover] transition flex-shrink-0"
          style={{ border: LINHA }}
          title="Busca rápida (Ctrl+K)"
          aria-label="Abrir busca rápida"
        >
          <Search className="w-3.5 h-3.5" />
          <span className="hidden 2xl:inline">Buscar</span>
          <span className="hidden 2xl:flex items-center gap-0.5 ml-2"><kbd className="mike-kbd">Ctrl</kbd><kbd className="mike-kbd">K</kbd></span>
        </button>

        <SeletorPais />

        {/* Usuário (computador) */}
        <div className="hidden lg:block">
          <MenuUsuario nome={nome} papel={papel} email={usuario?.email} inicial={inicial} onSair={sair} />
        </div>

        {/* Botão do menu (celular e tablet) */}
        <button
          type="button"
          onClick={() => setMenuAberto((v) => !v)}
          className="lg:hidden w-10 h-10 -mr-2 flex items-center justify-center rounded-lg text-[--mike-fg-soft] hover:text-[--mike-fg] hover:bg-[--mike-card-hover] transition flex-shrink-0"
          title={menuAberto ? 'Fechar menu' : 'Menu'}
          aria-label={menuAberto ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={menuAberto}
        >
          {menuAberto ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* linha de base do cabeçalho: acende no meio, como o brilho do domo */}
      <div className="h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(43, 205, 185, 0.45) 50%, transparent)' }} />

      {/* Menu de celular e tablet */}
      {menuAberto && (
        <div className="lg:hidden absolute left-0 right-0 top-full" style={{ height: 'calc(100dvh - 3.5rem)' }}>
          <button
            type="button"
            aria-label="Fechar menu"
            tabIndex={-1}
            onClick={() => setMenuAberto(false)}
            className="absolute inset-0 w-full h-full cursor-default"
            style={{ backgroundColor: 'rgba(2, 5, 7, 0.72)' }}
          />
          <div
            className="relative max-h-full overflow-y-auto mike-entrar"
            style={{ backgroundColor: 'var(--mike-bg)', borderBottom: LINHA, boxShadow: '0 24px 48px rgba(0,0,0,0.6)' }}
          >
            <nav className="px-3 pt-3 pb-2 grid grid-cols-1 sm:grid-cols-2 gap-1" aria-label="Painéis">
              {itensNav.map((n, i) => {
                const Icone = n.icon;
                const ativa = telaAtiva === n.id;
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => ir(n.id)}
                    aria-current={ativa ? 'page' : undefined}
                    className={`mike-entrar flex items-center gap-3 px-3 h-12 rounded-xl text-sm font-semibold text-left transition ${
                      ativa ? 'bg-mike-accent/10 text-[--mike-menta]' : 'text-[--mike-fg-soft] hover:bg-[--mike-card-hover] active:bg-[--mike-card-hover]'
                    }`}
                    style={{
                      animationDelay: `${i * 28}ms`,
                      boxShadow: ativa ? 'inset 0 0 0 0.5px rgba(43, 205, 185, 0.4)' : undefined,
                    }}
                  >
                    <span
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: ativa ? 'rgba(43, 205, 185, 0.16)' : 'var(--mike-card)', border: LINHA }}
                    >
                      <Icone className="w-4 h-4" />
                    </span>
                    <span className="flex-1">{n.label}</span>
                    {ativa && <span className="mike-ponto-vivo" />}
                  </button>
                );
              })}
            </nav>

            <div className="mx-3 mb-3 mt-1 px-3 py-3 rounded-xl flex items-center gap-3" style={{ backgroundColor: 'var(--mike-card)', border: LINHA }}>
              <Avatar inicial={inicial} tamanho={36} />
              <div className="flex-1 min-w-0 leading-tight">
                <div className="text-sm text-[--mike-fg] font-semibold truncate">{nome}</div>
                <div className="text-[11px] text-[--mike-fg-muted]">{papel}</div>
              </div>
              <button
                type="button"
                onClick={() => { setMenuAberto(false); sair(); }}
                className="flex items-center gap-1.5 h-10 px-3 rounded-lg text-xs font-bold text-rose-300 hover:bg-rose-500/10 transition"
                style={{ border: '0.5px solid rgba(244, 63, 94, 0.35)' }}
              >
                <LogOut className="w-4 h-4" />
                Sair
              </button>
            </div>
          </div>
        </div>
      )}

      <PaletaComandos aberta={paletaAberta} onFechar={() => setPaletaAberta(false)} itens={comandos} />
    </header>
  );
}
