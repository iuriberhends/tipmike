// ============================================================
// shared/PaletaComandos.jsx — Busca rápida (Ctrl+K / ⌘K)
//
// Uma caixa no meio da tela para ir a qualquer painel ou disparar uma
// ação digitando: "bots", "backtest", "peru", "sair"...
//
//   ↑ ↓   escolhe        Enter   executa        Esc   fecha
//
// Quem monta os itens é o MikeHeader (painéis ligados + ações), então
// painel desligado em config/paineis.js não aparece aqui também.
// ============================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, CornerDownLeft } from 'lucide-react';
import Bandeira from './Bandeira.jsx';

function normalizar(s) {
  return (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export default function PaletaComandos({ aberta, onFechar, itens }) {
  const [texto, setTexto] = useState('');
  const [indice, setIndice] = useState(0);
  const campoRef = useRef(null);
  const listaRef = useRef(null);

  const filtrados = useMemo(() => {
    const t = normalizar(texto).trim();
    if (!t) return itens;
    return itens.filter((i) => normalizar(`${i.label} ${i.grupo} ${i.palavras || ''}`).includes(t));
  }, [itens, texto]);

  // abre limpa, com o campo em foco; a página atrás não rola
  useEffect(() => {
    if (!aberta) return undefined;
    setTexto('');
    setIndice(0);
    const overflowAntes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => campoRef.current?.focus(), 20);
    return () => {
      clearTimeout(t);
      document.body.style.overflow = overflowAntes;
    };
  }, [aberta]);

  useEffect(() => { setIndice(0); }, [texto]);

  // mantém o item escolhido à vista
  useEffect(() => {
    const el = listaRef.current?.querySelector(`[data-indice="${indice}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [indice]);

  if (!aberta) return null;

  const executar = (item) => {
    if (!item) return;
    onFechar();
    item.acao();
  };

  const aoTeclar = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); onFechar(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setIndice((i) => (filtrados.length ? (i + 1) % filtrados.length : 0)); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setIndice((i) => (filtrados.length ? (i - 1 + filtrados.length) % filtrados.length : 0)); return; }
    if (e.key === 'Enter') { e.preventDefault(); executar(filtrados[indice]); }
  };

  let grupoAnterior = null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center px-3 pt-[12vh] sm:pt-[16vh]"
      style={{ backgroundColor: 'rgba(2, 5, 7, 0.72)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onFechar(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Busca rápida"
    >
      <div
        className="w-full max-w-lg rounded-2xl overflow-hidden mike-entrar"
        style={{
          backgroundColor: 'var(--mike-card)',
          border: '0.5px solid rgba(43, 205, 185, 0.35)',
          boxShadow: '0 30px 80px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(43, 205, 185, 0.06), 0 0 60px rgba(43, 205, 185, 0.08)',
          fontFamily: 'var(--mike-font)',
        }}
      >
        <div className="flex items-center gap-3 px-4 h-14" style={{ borderBottom: '0.5px solid var(--mike-linha)' }}>
          <Search className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--mike-accent)' }} />
          <input
            ref={campoRef}
            autoFocus
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={aoTeclar}
            placeholder="Para onde você quer ir?"
            className="flex-1 min-w-0 bg-transparent outline-none text-[15px] placeholder:text-[--mike-fg-muted]"
            style={{ color: 'var(--mike-fg)' }}
            aria-label="Buscar painel ou ação"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="mike-kbd hidden sm:inline-flex">Esc</kbd>
        </div>

        <div ref={listaRef} className="max-h-[52vh] overflow-y-auto py-2" role="listbox">
          {filtrados.length === 0 && (
            <div className="px-4 py-8 text-center text-xs" style={{ color: 'var(--mike-fg-muted)' }}>
              Nada encontrado para “{texto}”.
            </div>
          )}
          {filtrados.map((item, i) => {
            const Icone = item.icon;
            const escolhido = i === indice;
            const mostraGrupo = item.grupo !== grupoAnterior;
            grupoAnterior = item.grupo;
            return (
              <div key={item.id}>
                {mostraGrupo && (
                  <div className="px-4 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--mike-fg-muted)' }}>
                    {item.grupo}
                  </div>
                )}
                <button
                  type="button"
                  role="option"
                  aria-selected={escolhido}
                  data-indice={i}
                  onMouseMove={() => { if (!escolhido) setIndice(i); }}
                  onClick={() => executar(item)}
                  className="w-full flex items-center gap-3 px-3 mx-1 h-11 rounded-xl text-sm text-left transition-colors"
                  style={{
                    width: 'calc(100% - 0.5rem)',
                    color: escolhido ? 'var(--mike-fg)' : 'var(--mike-fg-soft)',
                    backgroundColor: escolhido ? 'rgba(43, 205, 185, 0.12)' : 'transparent',
                    boxShadow: escolhido ? 'inset 0 0 0 0.5px rgba(43, 205, 185, 0.4)' : 'none',
                  }}
                >
                  <span
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{
                      backgroundColor: escolhido ? 'rgba(43, 205, 185, 0.18)' : 'var(--mike-card-2)',
                      color: escolhido ? 'var(--mike-menta)' : 'var(--mike-fg-muted)',
                    }}
                  >
                    {Icone ? <Icone className="w-3.5 h-3.5" /> : <Bandeira codigo={item.bandeira} altura={12} />}
                  </span>
                  <span className="flex-1 min-w-0 truncate font-medium">{item.label}</span>
                  {item.atual && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ color: 'var(--mike-accent)', backgroundColor: 'rgba(43, 205, 185, 0.1)' }}>
                      você está aqui
                    </span>
                  )}
                  {escolhido && <CornerDownLeft className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--mike-fg-muted)' }} />}
                </button>
              </div>
            );
          })}
        </div>

        <div
          className="hidden sm:flex items-center gap-4 px-4 h-9 text-[10px]"
          style={{ borderTop: '0.5px solid var(--mike-linha)', color: 'var(--mike-fg-muted)', backgroundColor: 'rgba(4, 8, 11, 0.5)' }}
        >
          <span className="flex items-center gap-1.5"><kbd className="mike-kbd">↑</kbd><kbd className="mike-kbd">↓</kbd> escolher</span>
          <span className="flex items-center gap-1.5"><kbd className="mike-kbd">Enter</kbd> abrir</span>
          <span className="flex-1" />
          <span className="flex items-center gap-1.5"><kbd className="mike-kbd">Ctrl</kbd><kbd className="mike-kbd">K</kbd> busca rápida</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
