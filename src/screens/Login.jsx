// ============================================================
// screens/Login.jsx — Tela de login do TipMike (Fase 2)
//
// - Mensagens de erro vêm direto da API (genéricas por design:
//   "E-mail ou senha inválidos." / rate limit 429)
// - Enter envia; botão de mostrar/ocultar senha
// - Já logado? Redireciona pra rota de origem (ou "/")
// ============================================================

import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import AuthLayout, { CampoRotulo, CaixaErro } from '../shared/AuthLayout.jsx';

export default function Login() {
  const { usuario, carregando, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  const destino = location.state?.de || '/';

  if (!carregando && usuario) {
    return <Navigate to={destino} replace />;
  }

  const entrar = async () => {
    if (enviando) return;
    setErro('');
    if (!email.trim() || !senha) {
      setErro('Preencha e-mail e senha.');
      return;
    }
    setEnviando(true);
    try {
      await login(email.trim(), senha);
      navigate(destino, { replace: true });
    } catch (e) {
      setErro((e && e.message) || 'Falha no login.');
    } finally {
      setEnviando(false);
    }
  };

  const aoTeclar = (e) => {
    if (e.key === 'Enter') entrar();
  };

  return (
    <AuthLayout
      titulo="Entrar"
      subtitulo="Entre para acessar o painel"
      rodape={(
        <>
          <p className="text-[11px] m-0" style={{ color: 'var(--mike-fg-muted)' }}>
            Acesso restrito. Contas são criadas por convite do administrador.
          </p>
          <button
            type="button"
            onClick={() => navigate('/registro')}
            className="text-xs font-semibold mt-2 px-2 py-1.5 rounded-md transition hover:brightness-125"
            style={{ color: 'var(--mike-accent)' }}
            disabled={enviando}
          >
            Tem um código de convite? Criar conta →
          </button>
        </>
      )}
    >
      <div className="flex flex-col gap-3.5">
        <div>
          <CampoRotulo htmlFor="login-email">E-mail</CampoRotulo>
          <input
            id="login-email"
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={aoTeclar}
            placeholder="voce@email.com"
            className="mike-input"
            disabled={enviando}
          />
        </div>

        <div>
          <CampoRotulo htmlFor="login-senha">Senha</CampoRotulo>
          <div className="relative">
            <input
              id="login-senha"
              type={mostrarSenha ? 'text' : 'password'}
              autoComplete="current-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              onKeyDown={aoTeclar}
              placeholder="••••••••"
              className="mike-input"
              style={{ paddingRight: '2.75rem' }}
              disabled={enviando}
            />
            <button
              type="button"
              onClick={() => setMostrarSenha(!mostrarSenha)}
              className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-200 transition"
              title={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
              aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
              tabIndex={-1}
            >
              {mostrarSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <CaixaErro>{erro}</CaixaErro>

        <button type="button" onClick={entrar} disabled={enviando} className="mike-btn-primary w-full mt-1">
          <LogIn className="w-4 h-4" />
          {enviando ? 'Entrando...' : 'Entrar'}
        </button>
      </div>
    </AuthLayout>
  );
}
