// ============================================================
// shared/AuthLayout.jsx — Moldura das telas públicas (login e cadastro)
//
// Computador: duas colunas. À esquerda, a cena da marca — a estrada da
// logo desenhada em SVG, com a faixa central andando e o ponto de luz
// subindo até o pico; a cena acompanha o ponteiro do mouse. À direita,
// o formulário.
//
// Celular: uma coluna só — logo, nome e formulário.
// ============================================================

import { useRef } from 'react';
import { Activity, Bot, FlaskConical, Radar } from 'lucide-react';
import { LogoHeroi, LogoMarca, Wordmark } from './Logo.jsx';

export function CampoRotulo({ children, htmlFor }) {
  return (
    <label htmlFor={htmlFor} className="block text-[11px] font-semibold mb-1.5" style={{ color: 'var(--mike-fg-soft)' }}>
      {children}
    </label>
  );
}

export function CaixaErro({ children }) {
  if (!children) return null;
  return (
    <div
      role="alert"
      className="mike-tremer px-3 py-2.5 rounded-lg text-xs font-semibold"
      style={{
        backgroundColor: 'rgba(244, 63, 94, 0.1)',
        border: '0.5px solid rgba(244, 63, 94, 0.4)',
        color: '#fda4af',
      }}
    >
      {children}
    </div>
  );
}

// O traçado da estrada: o zigue-zague em "M" da logo, com as curvas arredondadas.
const ESTRADA = 'M -40 268 L 126 102 Q 150 78 174 102 L 266 194 Q 290 218 314 194 L 428 80 Q 452 56 476 80 L 690 294';
// As duas montanhas por baixo da estrada.
const MONTANHAS = 'M -40 300 L 150 110 L 290 250 L 452 88 L 690 326 L 690 360 L -40 360 Z';

function EstradaAnimada() {
  return (
    <svg viewBox="0 0 640 340" className="w-full h-auto block" aria-hidden focusable="false" style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="mike-montanha" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2bcdb9" stopOpacity="0.34" />
          <stop offset="0.7" stopColor="#0d847a" stopOpacity="0.08" />
          <stop offset="1" stopColor="#0d847a" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="mike-asfalto" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0a322f" />
          <stop offset="1" stopColor="#04181a" />
        </linearGradient>
        <filter id="mike-brilho" x="-200%" y="-200%" width="500%" height="500%">
          <feGaussianBlur stdDeviation="5" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="mike-nevoa" x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
        <path id="mike-trilho" d={ESTRADA} />
      </defs>

      <path d={MONTANHAS} fill="url(#mike-montanha)" className="mike-cena-fundo" />

      <g className="mike-cena-estrada">
        {/* névoa de luz em volta da estrada */}
        <use href="#mike-trilho" fill="none" stroke="#2bcdb9" strokeWidth="64" strokeLinecap="round" strokeLinejoin="round" opacity="0.22" filter="url(#mike-nevoa)" />
        {/* contorno menta, asfalto e faixa central */}
        <use href="#mike-trilho" fill="none" stroke="#dffdf7" strokeWidth="56" strokeLinejoin="round" />
        <use href="#mike-trilho" fill="none" stroke="url(#mike-asfalto)" strokeWidth="48" strokeLinejoin="round" />
        <use href="#mike-trilho" fill="none" stroke="#eafffb" strokeWidth="3.5" strokeDasharray="16 13" className="mike-faixa" />

        {/* o pico marcado, como na logo */}
        <circle cx="452" cy="68" r="5" fill="#fff" filter="url(#mike-brilho)" className="mike-pico" />

        {/* o ponto de luz percorrendo a estrada */}
        <g filter="url(#mike-brilho)">
          <circle r="6.5" fill="#fff">
            <animateMotion dur="9s" repeatCount="indefinite" rotate="auto" keyPoints="0;1" keyTimes="0;1" calcMode="linear">
              <mpath href="#mike-trilho" />
            </animateMotion>
          </circle>
        </g>
      </g>
    </svg>
  );
}

const DESTAQUES = [
  { icone: Activity, titulo: 'Ao vivo', texto: 'partidas e odds em tempo real' },
  { icone: Bot, titulo: 'Bots', texto: 'estratégias rodando sozinhas' },
  { icone: FlaskConical, titulo: 'Backtest', texto: 'teste antes de arriscar' },
  { icone: Radar, titulo: 'Varredura', texto: 'ache o que dá resultado' },
];

export default function AuthLayout({ titulo, subtitulo, children, rodape }) {
  const cenaRef = useRef(null);

  // A cena acompanha o ponteiro: grava a posição (-1..1) em variáveis CSS,
  // sem re-renderizar nada.
  const aoMover = (e) => {
    const el = cenaRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 2 - 1;
    const y = ((e.clientY - r.top) / r.height) * 2 - 1;
    el.style.setProperty('--px', Math.max(-1, Math.min(1, x)).toFixed(3));
    el.style.setProperty('--py', Math.max(-1, Math.min(1, y)).toFixed(3));
  };
  const aoSair = () => {
    const el = cenaRef.current;
    if (!el) return;
    el.style.setProperty('--px', '0');
    el.style.setProperty('--py', '0');
  };

  return (
    <div
      ref={cenaRef}
      onMouseMove={aoMover}
      onMouseLeave={aoSair}
      className="mike-cena min-h-screen relative overflow-hidden flex items-center justify-center px-4 py-8 lg:px-10"
      style={{ backgroundColor: 'var(--mike-bg)', color: 'var(--mike-fg)', fontFamily: 'var(--mike-font)' }}
    >
      {/* brilho do domo, grande, atrás de tudo — segue o ponteiro bem de leve */}
      <div aria-hidden className="mike-cena-luz pointer-events-none absolute" />

      <div className="relative w-full max-w-6xl grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-10 xl:gap-16 items-center">
        {/* ── Cena da marca (só no computador) ─────────────────── */}
        <div className="hidden lg:block min-w-0">
          <div className="flex items-center gap-3 mb-9 mike-entrar">
            <span className="mike-cena-logo inline-flex">
              <LogoMarca altura={58} />
            </span>
            <Wordmark tamanho={30} />
          </div>

          <p className="mike-titulo-cena m-0 mike-entrar" style={{ animationDelay: '60ms' }}>
            Dados ao vivo, bots e backtest <span>na mesma estrada.</span>
          </p>
          <p className="text-sm mt-4 max-w-md leading-relaxed mike-entrar" style={{ color: 'var(--mike-fg-soft)', animationDelay: '120ms' }}>
            Acompanhe as partidas, monte suas estratégias e confira o resultado antes de colocar dinheiro nelas.
          </p>

          <div className="grid grid-cols-2 gap-2.5 mt-7 max-w-lg">
            {DESTAQUES.map((d, i) => {
              const Icone = d.icone;
              return (
                <div key={d.titulo} className="mike-destaque mike-entrar" style={{ animationDelay: `${180 + i * 60}ms` }}>
                  <span className="mike-destaque-icone"><Icone className="w-4 h-4" /></span>
                  <span className="min-w-0 leading-tight">
                    <span className="block text-[13px] font-bold" style={{ color: 'var(--mike-fg)' }}>{d.titulo}</span>
                    <span className="block text-[11px] truncate" style={{ color: 'var(--mike-fg-muted)' }}>{d.texto}</span>
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-6 -mb-10 -ml-10 mike-entrar" style={{ animationDelay: '320ms' }}>
            <EstradaAnimada />
          </div>
        </div>

        {/* ── Formulário ───────────────────────────────────────── */}
        <div className="relative w-full max-w-sm mx-auto lg:mx-0 lg:justify-self-end mike-entrar" style={{ animationDelay: '80ms' }}>
          {/* celular: logo grande e nome em cima do formulário */}
          <div className="lg:hidden flex flex-col items-center text-center">
            <LogoHeroi tamanho={164} className="-mb-3" />
            <Wordmark tamanho={26} />
            {subtitulo && (
              <p className="text-xs mt-2.5 mb-6" style={{ color: 'var(--mike-fg-muted)' }}>{subtitulo}</p>
            )}
          </div>

          <div className="mike-surface mike-cartao-auth p-5 sm:p-7">
            <div className="hidden lg:block mb-6">
              <h1 className="text-xl font-bold m-0">{titulo}</h1>
              {subtitulo && <p className="text-xs mt-1.5 mb-0" style={{ color: 'var(--mike-fg-muted)' }}>{subtitulo}</p>}
            </div>
            {children}
          </div>

          {rodape && <div className="mt-5 text-center">{rodape}</div>}
        </div>
      </div>
    </div>
  );
}
