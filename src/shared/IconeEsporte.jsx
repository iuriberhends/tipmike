// ============================================================
// shared/IconeEsporte.jsx — a bola de cada esporte, desenhada em SVG
//
// Um só lugar para o "rosto" do esporte: bola de futebol, bola de
// basquete, taco e disco de hóquei, bola de tênis. Usado nas listas de
// partidas (Início, Ao Vivo), nos filtros de esporte e na lista de bots.
//
// O esporte chega em dialetos diferentes conforme a tela — 'E-Football'
// (eventos), 'fifa' (bots e backtest), 'e-Soccer' (rótulo) — e
// `tipoDoEsporte` entende todos. Esporte desconhecido vira um controle
// de videogame, para nunca ficar um buraco na linha.
// ============================================================

import { useId } from 'react';
import { Gamepad2 } from 'lucide-react';

/** 'futebol' | 'basquete' | 'hoquei' | 'tenis' | null */
export function tipoDoEsporte(esporte) {
  const s = String(esporte || '').toLowerCase();
  if (/basket|basquete|nba/.test(s)) return 'basquete';
  if (/hock|hoquei|hóquei|nhl/.test(s)) return 'hoquei';
  if (/tenn?is|tênis|atp/.test(s)) return 'tenis';
  if (/foot|socc|fifa|fut/.test(s)) return 'futebol';
  return null;
}

const NOME = { futebol: 'Futebol', basquete: 'Basquete', hoquei: 'Hóquei', tenis: 'Tênis' };

// ── geometria da bola de futebol (caixa 24×24, centro 12,12, raio 10) ──
const R = 10;
const ponto = (raio, graus) => {
  const a = ((graus - 90) * Math.PI) / 180;
  return `${(12 + raio * Math.cos(a)).toFixed(2)} ${(12 + raio * Math.sin(a)).toFixed(2)}`;
};
const GOMOS = [0, 72, 144, 216, 288];
// pentágono do centro
const PENTAGONO = `M${GOMOS.map((g) => ponto(3.7, g)).join('L')}Z`;
// pentágonos da borda: nascem na ponta de cada costura e somem atrás da bola
const BORDA = GOMOS.map((g) => (
  `M${ponto(6.7, g)}L${ponto(8.5, g + 20)}L${ponto(R, g + 17)}`
  + `A${R} ${R} 0 0 0 ${ponto(R, g - 17)}L${ponto(8.5, g - 20)}Z`
)).join('');
// costuras: do pentágono do centro até a borda, e fechando cada gomo branco
const COSTURAS = GOMOS.map((g) => (
  `M${ponto(3.7, g)}L${ponto(6.7, g)}M${ponto(8.5, g + 20)}L${ponto(8.5, g + 52)}`
)).join('');

function Futebol({ id }) {
  return (
    <>
      <defs>
        <radialGradient id={id} cx="38%" cy="30%" r="80%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.7" stopColor="#dfe9ea" />
          <stop offset="1" stopColor="#9fb4b6" />
        </radialGradient>
      </defs>
      <circle cx="12" cy="12" r={R} fill={`url(#${id})`} />
      <path d={PENTAGONO + BORDA} fill="#0e2328" />
      <path d={COSTURAS} fill="none" stroke="#0e2328" strokeWidth="1" strokeLinecap="round" />
      <circle cx="12" cy="12" r={R} fill="none" stroke="#0e2328" strokeOpacity="0.55" strokeWidth="0.9" />
    </>
  );
}

function Basquete({ id }) {
  return (
    <>
      <defs>
        <radialGradient id={id} cx="36%" cy="28%" r="85%">
          <stop offset="0" stopColor="#ffb866" />
          <stop offset="0.6" stopColor="#f47f1f" />
          <stop offset="1" stopColor="#c2500a" />
        </radialGradient>
      </defs>
      <circle cx="12" cy="12" r={R} fill={`url(#${id})`} />
      <path
        d="M12 2V22M2 12H22M5.3 4.6C9.4 8.5 9.4 15.5 5.3 19.4M18.7 4.6C14.6 8.5 14.6 15.5 18.7 19.4"
        fill="none" stroke="#3a1704" strokeWidth="1.15" strokeLinecap="round"
      />
      <circle cx="12" cy="12" r={R} fill="none" stroke="#3a1704" strokeOpacity="0.7" strokeWidth="0.9" />
    </>
  );
}

function Hoquei() {
  return (
    <>
      <path
        d="M16.6 3.2L10.4 16.4Q9.7 17.9 8 17.9H4.2"
        fill="none" stroke="#7dd3fc" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"
      />
      <path d="M13.6 18.1v1.7a3.9 1.9 0 0 0 7.8 0v-1.7z" fill="#56707a" />
      <ellipse cx="17.5" cy="18.1" rx="3.9" ry="1.9" fill="#c4dbe1" />
    </>
  );
}

function Tenis({ id }) {
  return (
    <>
      <defs>
        <radialGradient id={id} cx="36%" cy="28%" r="85%">
          <stop offset="0" stopColor="#eeff7a" />
          <stop offset="0.65" stopColor="#c6e12c" />
          <stop offset="1" stopColor="#8fa716" />
        </radialGradient>
      </defs>
      <circle cx="12" cy="12" r={R} fill={`url(#${id})`} />
      <path
        d="M5.3 4.6C9.4 8.5 9.4 15.5 5.3 19.4M18.7 4.6C14.6 8.5 14.6 15.5 18.7 19.4"
        fill="none" stroke="#ffffff" strokeWidth="1.3" strokeLinecap="round"
      />
      <circle cx="12" cy="12" r={R} fill="none" stroke="#4d5c0a" strokeOpacity="0.6" strokeWidth="0.9" />
    </>
  );
}

const DESENHO = { futebol: Futebol, basquete: Basquete, hoquei: Hoquei, tenis: Tenis };

/**
 * Ícone do esporte.
 *   esporte  — em qualquer dialeto ('E-Football', 'fifa', 'e-Basket', 'nba2k'…)
 *   tamanho  — lado em px (padrão 16)
 *   quicando — true faz a bola dar um pulo (usado quando o placar muda)
 */
export default function IconeEsporte({ esporte, tamanho = 16, quicando = false, className = '' }) {
  // useId devolve ":r1:"; sem os dois-pontos vira um id seguro para url(#…)
  const id = `bola${useId().replace(/:/g, '')}`;
  const tipo = tipoDoEsporte(esporte);
  // o taco de hóquei e o controle não rolam no hover; só as bolas
  const redonda = tipo && tipo !== 'hoquei';
  const classes = `flex-shrink-0 ${redonda ? 'mike-bola-gira' : ''} ${quicando ? 'mike-bola-quicando' : ''} ${className}`;

  if (!tipo) {
    return <Gamepad2 aria-hidden="true" className={classes} style={{ width: tamanho, height: tamanho, opacity: 0.7 }} />;
  }
  const Desenho = DESENHO[tipo];
  return (
    <svg
      width={tamanho} height={tamanho} viewBox="0 0 24 24"
      role="img" aria-label={NOME[tipo]} className={classes}
    >
      <Desenho id={id} />
    </svg>
  );
}
