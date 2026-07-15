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

  const estiloInput = {
    backgroundColor: 'rgba(20, 26, 40, 0.8)',
    border: '0.5px solid rgba(60, 85, 130, 0.4)',
    color: '#eaeef7',
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        backgroundColor: '#0b0f1a',
        color: '#eaeef7',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-8"
        style={{
          backgroundColor: 'rgba(20, 26, 40, 0.6)',
          border: '0.5px solid rgba(60, 85, 130, 0.4)',
        }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[--mike-accent] to-[--mike-accent-2] flex items-center justify-center shadow-md shadow-[--mike-accent]/30 mb-3">
            <span className="font-black text-[--mike-bg] leading-none" style={{ fontSize: 22 }}>M</span>
          </div>
          <h1
            className="text-xl font-black tracking-tight"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}
          >
            TIPMIKE
          </h1>
          <p className="text-xs text-slate-400 mt-1">Entre para acessar o painel</p>
        </div>

        {/* Campos */}
        <div className="flex flex-col gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">E-mail</label>
            <input
              type="email"
              autoComplete="username"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={aoTeclar}
              placeholder="voce@email.com"
              className="w-full px-3 py-2 rounded-md text-sm outline-none focus:ring-1 focus:ring-[--mike-accent]/60"
              style={estiloInput}
              disabled={enviando}
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Senha</label>
            <div className="relative">
              <input
                type={mostrarSenha ? 'text' : 'password'}
                autoComplete="current-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                onKeyDown={aoTeclar}
                placeholder="••••••••"
                className="w-full px-3 py-2 pr-9 rounded-md text-sm outline-none focus:ring-1 focus:ring-[--mike-accent]/60"
                style={estiloInput}
                disabled={enviando}
              />
              <button
                type="button"
                onClick={() => setMostrarSenha(!mostrarSenha)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition"
                title={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                tabIndex={-1}
              >
                {mostrarSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Erro */}
          {erro && (
            <div
              className="px-3 py-2 rounded-md text-xs font-semibold"
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                border: '0.5px solid rgba(239, 68, 68, 0.4)',
                color: '#fca5a5',
              }}
            >
              {erro}
            </div>
          )}

          {/* Entrar */}
          <button
            onClick={entrar}
            disabled={enviando}
            className="mt-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-bold transition disabled:opacity-60"
            style={{
              backgroundColor: '#10b981',
              color: '#0b0f1a',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
            }}
          >
            <LogIn className="w-4 h-4" />
            {enviando ? 'Entrando...' : 'Entrar'}
          </button>
        </div>

        <p className="text-[10px] text-slate-500 text-center mt-6">
          Acesso restrito. Contas são criadas pelo administrador.
        </p>
      </div>
    </div>
  );
}
