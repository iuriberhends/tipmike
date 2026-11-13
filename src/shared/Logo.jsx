// ============================================================
// shared/Logo.jsx — A marca do TipMike em um lugar só
//
//   <LogoMarca altura={30} />        só o domo (cabeçalho, carregando)
//   <Wordmark tamanho={15} />        "TIPMIKE" — TIP branco, MIKE menta
//   <Logo />                         domo + nome, lado a lado
//   <LogoHeroi tamanho={176} />      domo com o brilho em volta (login)
//
// As imagens saem da logo original (assets/logo-*.webp); o nome é
// texto de verdade, na letra larga da marca.
// ============================================================

import marca from '../assets/logo-mark.webp';
import heroi from '../assets/logo-hero.webp';

// proporção largura/altura do recorte do domo
const PROPORCAO = 0.921;

export function LogoMarca({ altura = 30, className = '', alt = '' }) {
  return (
    <img
      src={marca}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      width={Math.round(altura * PROPORCAO)}
      height={altura}
      draggable={false}
      className={`select-none flex-shrink-0 ${className}`}
      style={{ height: altura, width: 'auto' }}
    />
  );
}

export function Wordmark({ tamanho = 15, className = '' }) {
  return (
    <span className={`mike-wordmark ${className}`} style={{ fontSize: tamanho }} aria-label="TipMike">
      TIP<span>MIKE</span>
    </span>
  );
}

export function LogoHeroi({ tamanho = 176, className = '' }) {
  return (
    <img
      src={heroi}
      alt="TipMike"
      width={tamanho}
      height={tamanho}
      draggable={false}
      className={`select-none ${className}`}
      style={{ width: tamanho, height: tamanho }}
    />
  );
}

export default function Logo({ altura = 30, tamanhoNome = 15, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMarca altura={altura} />
      <Wordmark tamanho={tamanhoNome} />
    </span>
  );
}
