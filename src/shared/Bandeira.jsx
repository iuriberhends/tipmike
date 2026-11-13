// ============================================================
// shared/Bandeira.jsx — Bandeira do país, desenhada em SVG
//
// Por que não o emoji: o Windows não tem desenho para emoji de
// bandeira e mostra as letras do código ("BR", "PE") no lugar. Aqui a
// bandeira é desenhada, então aparece igual em qualquer aparelho.
//
//   <Bandeira codigo="BR" />            altura padrão de 14px
//   <Bandeira codigo="PE" altura={18} />
//
// País novo no cadastro: acrescente o desenho em DESENHOS (a tela é
// 28 x 20). Enquanto não tiver desenho, cai no emoji — que aparece
// certo em celular e Mac, e como letras no Windows.
// ============================================================

import { bandeiraDoPais } from '../lib/pais.js';

// faixas verticais iguais
const vertical = (...cores) => cores.map((c, i) => (
  <rect key={i} x={(28 / cores.length) * i} y="0" width={28 / cores.length + 0.05} height="20" fill={c} />
));
// faixas horizontais com alturas proporcionais: [cor, peso]
const horizontal = (...faixas) => {
  const total = faixas.reduce((s, [, p]) => s + p, 0);
  let y = 0;
  return faixas.map(([cor, peso], i) => {
    const h = (20 * peso) / total;
    const el = <rect key={i} x="0" y={y} width="28" height={h + 0.05} fill={cor} />;
    y += h;
    return el;
  });
};

const DESENHOS = {
  BR: (
    <>
      <rect width="28" height="20" fill="#009b3a" />
      <path d="M14 2.5 25.4 10 14 17.5 2.6 10Z" fill="#fedf00" />
      <circle cx="14" cy="10" r="4.7" fill="#002776" />
      <path d="M9.5 9.2c2.9-.9 6.7-.1 9 2.2" fill="none" stroke="#fff" strokeWidth=".95" />
    </>
  ),
  PE: vertical('#d91023', '#ffffff', '#d91023'),
  AR: (
    <>
      {horizontal(['#74acdf', 1], ['#ffffff', 1], ['#74acdf', 1])}
      <circle cx="14" cy="10" r="1.9" fill="#f6b40e" />
    </>
  ),
  CL: (
    <>
      {horizontal(['#ffffff', 1], ['#d52b1e', 1])}
      <rect width="9.4" height="10" fill="#0039a6" />
      <path d="M4.7 2.6 5.5 5h2.5L6 6.5l.8 2.4-2.1-1.5-2.1 1.5.8-2.4-2-1.5h2.5z" fill="#fff" />
    </>
  ),
  CO: horizontal(['#fcd116', 2], ['#003893', 1], ['#ce1126', 1]),
  EC: (
    <>
      {horizontal(['#ffdd00', 2], ['#034ea2', 1], ['#ed1c24', 1])}
      <circle cx="14" cy="10" r="2.2" fill="#8a6d3b" />
    </>
  ),
  MX: (
    <>
      {vertical('#006847', '#ffffff', '#ce1126')}
      <circle cx="14" cy="10" r="2" fill="#8a6d3b" />
    </>
  ),
  UY: (
    <>
      <rect width="28" height="20" fill="#fff" />
      {[2.2, 6.7, 11.1, 15.6].map((y) => <rect key={y} x="0" y={y} width="28" height="2.2" fill="#0038a8" />)}
      <rect width="11" height="11.1" fill="#fff" />
      <circle cx="5.5" cy="5.5" r="2.6" fill="#fcd116" />
    </>
  ),
  PY: (
    <>
      {horizontal(['#d52b1e', 1], ['#ffffff', 1], ['#0038a8', 1])}
      <circle cx="14" cy="10" r="1.7" fill="none" stroke="#3a7d44" strokeWidth=".7" />
    </>
  ),
  BO: horizontal(['#d52b1e', 1], ['#f9e300', 1], ['#007934', 1]),
  VE: horizontal(['#ffcc00', 1], ['#00247d', 1], ['#cf142b', 1]),
  PT: (
    <>
      <rect width="28" height="20" fill="#ff0000" />
      <rect width="11.2" height="20" fill="#006600" />
      <circle cx="11.2" cy="10" r="3.2" fill="#ffe000" />
    </>
  ),
  ES: horizontal(['#aa151b', 1], ['#f1bf00', 2], ['#aa151b', 1]),
  US: (
    <>
      <rect width="28" height="20" fill="#fff" />
      {[0, 3.08, 6.15, 9.23, 12.3, 15.4, 18.46].map((y) => <rect key={y} x="0" y={y} width="28" height="1.54" fill="#b22234" />)}
      <rect width="12" height="10.8" fill="#3c3b6e" />
    </>
  ),
};

export default function Bandeira({ codigo, altura = 14, className = '' }) {
  const cod = (codigo || '').toUpperCase();
  const desenho = DESENHOS[cod];
  const largura = Math.round(altura * 1.4);

  if (!desenho) {
    return (
      <span className={`leading-none flex-shrink-0 ${className}`} style={{ fontSize: altura }} aria-hidden>
        {bandeiraDoPais(cod)}
      </span>
    );
  }

  const idRecorte = `mike-bandeira-${cod}`;
  return (
    <svg
      viewBox="0 0 28 20"
      width={largura}
      height={altura}
      className={`flex-shrink-0 ${className}`}
      style={{ borderRadius: Math.max(2, altura * 0.2), boxShadow: '0 0 0 0.5px rgba(255, 255, 255, 0.22)' }}
      aria-hidden
      focusable="false"
    >
      <defs>
        <clipPath id={idRecorte}><rect width="28" height="20" rx="2.6" /></clipPath>
      </defs>
      <g clipPath={`url(#${idRecorte})`}>{desenho}</g>
    </svg>
  );
}
