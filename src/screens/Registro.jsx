// ============================================================
// screens/Registro.jsx — Criar conta com código de convite (Fase 5)
//
// - Rota pública (/registro), mas o backend só aceita com um
//   convite válido gerado pelo admin (uso único, com validade)
// - Sucesso: faz login automático e entra no painel
// - Mensagens de erro vêm da API (genéricas por design)
// ============================================================

import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Ticket, UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { registroApi } from '../lib/auth.js';

export default function Registro() {
  const { usuario, carregando, login } = useAuth();
  const navigate = useNavigate();

  const [convite, setConvite] = useState('');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirma, setConfirma] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  if (!carregando && usuario) {
    return <Navigate to="/" replace />;
  }

  const criar = async () => {
    if (enviando) return;
    setErro('');
    if (!convite.trim()) { setErro('Informe o código de convite.'); return; }
    if (!nome.trim() || !email.trim() || !senha) {
      setErro('Preencha todos os campos.');
      return;
    }
    if (senha !== confirma) { setErro('As senhas não conferem.'); return; }

    setEnviando(true);
    try {
      await registroApi({
        nome: nome.trim(),
        email: email.trim(),
        senha,
        convite: convite.trim(),
      });
      // conta criada: entra direto (se o login falhar, cai no /login sem drama)
      try {
        await login(email.trim(), senha);
        navigate('/', { replace: true });
      } catch {
        navigate('/login', { replace: true });
      }
    } catch (e) {
      setErro((e && e.message) || 'Falha no cadastro.');
    } finally {
      setEnviando(false);
    }
  };

  const aoTeclar = (e) => {
    if (e.key === 'Enter') criar();
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
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center mb-3"
            style={{
              background: 'linear-gradient(135deg, var(--mike-accent, #22d3ee), var(--mike-accent-2, #10b981))',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
            }}
          >
            <span className="font-black leading-none" style={{ fontSize: 22, color: 'var(--mike-bg, #0b0f1a)' }}>M</span>
          </div>
          <h1
            className="text-xl font-black tracking-tight"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}
          >
            TIPMIKE
          </h1>
          <p className="text-xs text-slate-400 mt-1">Crie sua conta com um convite</p>
        </div>

        <div className="flex flex-col gap-3">
          {/* Convite */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Código de convite</label>
            <div className="relative">
              <Ticket className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                autoFocus
                value={convite}
                onChange={(e) => setConvite(e.target.value)}
                onKeyDown={aoTeclar}
                placeholder="TM-..."
                className="w-full pl-8 pr-3 py-2 rounded-md text-sm outline-none focus:ring-1 focus:ring-[--mike-accent]/60"
                style={{ ...estiloInput, fontFamily: 'JetBrains Mono, monospace' }}
                disabled={enviando}
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Nome</label>
            <input
              type="text"
              autoComplete="name"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              onKeyDown={aoTeclar}
              placeholder="Seu nome"
              className="w-full px-3 py-2 rounded-md text-sm outline-none focus:ring-1 focus:ring-[--mike-accent]/60"
              style={estiloInput}
              disabled={enviando}
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">E-mail</label>
            <input
              type="email"
              autoComplete="username"
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
                autoComplete="new-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                onKeyDown={aoTeclar}
                placeholder="Mín. 10 caracteres, letras e números"
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

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Confirmar senha</label>
            <input
              type={mostrarSenha ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirma}
              onChange={(e) => setConfirma(e.target.value)}
              onKeyDown={aoTeclar}
              placeholder="••••••••"
              className="w-full px-3 py-2 rounded-md text-sm outline-none focus:ring-1 focus:ring-[--mike-accent]/60"
              style={estiloInput}
              disabled={enviando}
            />
          </div>

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

          <button
            onClick={criar}
            disabled={enviando}
            className="mt-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-bold transition disabled:opacity-60"
            style={{
              backgroundColor: '#10b981',
              color: '#0b0f1a',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
            }}
          >
            <UserPlus className="w-4 h-4" />
            {enviando ? 'Criando conta...' : 'Criar conta'}
          </button>
        </div>

        <button
          type="button"
          onClick={() => navigate('/login')}
          className="w-full text-center text-xs font-semibold mt-6 transition"
          style={{ color: 'var(--mike-accent, #22d3ee)' }}
          disabled={enviando}
        >
          ← Já tem conta? Entrar
        </button>
      </div>
    </div>
  );
}
