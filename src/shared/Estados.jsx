// ============================================================
// shared/Estados.jsx — Estados padrão de tela no visual do TipMike
//
//   <TelaCarregando />                   tela cheia, logo + anel girando
//   <Carregando texto="..." />           bloco menor, para dentro de um card
//   <EstadoVazio titulo descricao />     "não há nada aqui ainda"
//   <EstadoErro mensagem onTentar />     falha ao carregar, com "tentar de novo"
//   <ErroDeTela>...</ErroDeTela>         rede de segurança: se uma tela
//                                        quebrar, mostra o erro em vez de
//                                        deixar a página em branco
// ============================================================

import { Component } from 'react';
import { AlertTriangle, Inbox, RefreshCw, Home } from 'lucide-react';
import { LogoMarca } from './Logo.jsx';

export function TelaCarregando({ texto = 'Carregando' }) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-7"
      style={{ backgroundColor: 'var(--mike-bg)', color: 'var(--mike-fg)' }}
      role="status"
      aria-live="polite"
    >
      <span className="mike-loader">
        <LogoMarca altura={44} />
      </span>
      <span className="text-xs font-semibold tracking-wide" style={{ color: 'var(--mike-fg-muted)' }}>
        {texto}…
      </span>
    </div>
  );
}

export function Carregando({ texto = 'Carregando', className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-10 ${className}`} role="status" aria-live="polite">
      <span
        className="w-7 h-7 rounded-full"
        style={{
          border: '2px solid rgba(43, 205, 185, 0.16)',
          borderTopColor: 'var(--mike-accent)',
          animation: 'mike-girar 0.9s linear infinite',
        }}
      />
      <span className="text-xs" style={{ color: 'var(--mike-fg-muted)' }}>{texto}…</span>
    </div>
  );
}

export function EstadoVazio({ icone: Icone = Inbox, titulo = 'Nada por aqui ainda', descricao, acao, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center text-center gap-3 py-12 px-6 ${className}`}>
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center"
        style={{ backgroundColor: 'rgba(43, 205, 185, 0.08)', border: '0.5px solid rgba(43, 205, 185, 0.28)' }}
      >
        <Icone className="w-5 h-5" style={{ color: 'var(--mike-accent)' }} />
      </div>
      <div className="text-sm font-bold" style={{ color: 'var(--mike-fg)' }}>{titulo}</div>
      {descricao && (
        <p className="text-xs max-w-xs leading-relaxed" style={{ color: 'var(--mike-fg-muted)' }}>{descricao}</p>
      )}
      {acao}
    </div>
  );
}

export function EstadoErro({ titulo = 'Não deu para carregar', mensagem, onTentar, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center text-center gap-3 py-12 px-6 ${className}`} role="alert">
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center"
        style={{ backgroundColor: 'rgba(244, 63, 94, 0.1)', border: '0.5px solid rgba(244, 63, 94, 0.35)' }}
      >
        <AlertTriangle className="w-5 h-5" style={{ color: '#fb7185' }} />
      </div>
      <div className="text-sm font-bold" style={{ color: 'var(--mike-fg)' }}>{titulo}</div>
      {mensagem && (
        <p className="text-xs max-w-sm leading-relaxed break-words" style={{ color: 'var(--mike-fg-muted)' }}>{mensagem}</p>
      )}
      {onTentar && (
        <button type="button" onClick={onTentar} className="mike-btn-ghost mt-1">
          <RefreshCw className="w-3.5 h-3.5" />
          Tentar de novo
        </button>
      )}
    </div>
  );
}

/**
 * Rede de segurança das telas. Um erro de renderização em qualquer tela
 * cai aqui em vez de deixar a página em branco. `chave` (a rota atual)
 * limpa o erro quando o usuário navega para outro lugar.
 */
export class ErroDeTela extends Component {
  constructor(props) {
    super(props);
    this.state = { erro: null };
  }

  static getDerivedStateFromError(erro) {
    return { erro };
  }

  componentDidUpdate(anterior) {
    if (this.state.erro && anterior.chave !== this.props.chave) {
      this.setState({ erro: null });
    }
  }

  componentDidCatch(erro, info) {
    // fica no console para diagnóstico; a tela mostra só o resumo
    console.error('[TipMike] erro de tela:', erro, info?.componentStack);
  }

  render() {
    if (!this.state.erro) return this.props.children;
    const detalhe = String(this.state.erro?.message || this.state.erro || '');
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-5 p-6"
        style={{ backgroundColor: 'var(--mike-bg)', color: 'var(--mike-fg)' }}
      >
        <LogoMarca altura={40} />
        <div className="mike-surface w-full max-w-md">
          <EstadoErro
            titulo="Esta tela encontrou um erro"
            mensagem={detalhe ? `Detalhe técnico: ${detalhe}` : 'Tente recarregar. Se continuar, avise o administrador.'}
          />
          <div className="flex flex-wrap items-center justify-center gap-2 pb-6 -mt-4">
            <button type="button" className="mike-btn-primary" onClick={() => window.location.reload()}>
              <RefreshCw className="w-4 h-4" />
              Recarregar
            </button>
            <button
              type="button"
              className="mike-btn-ghost"
              onClick={() => { window.location.hash = '#/'; this.setState({ erro: null }); }}
            >
              <Home className="w-3.5 h-3.5" />
              Ir para o início
            </button>
          </div>
        </div>
      </div>
    );
  }
}
