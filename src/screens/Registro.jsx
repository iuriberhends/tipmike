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
import AuthLayout, { CampoRotulo, CaixaErro } from '../shared/AuthLayout.jsx';

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

  return (
    <AuthLayout
      titulo="Criar conta"
      subtitulo="Crie sua conta com um convite"
      rodape={(
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="text-xs font-semibold px-2 py-1.5 rounded-md transition hover:brightness-125"
          style={{ color: 'var(--mike-accent)' }}
          disabled={enviando}
        >
          ← Já tem conta? Entrar
        </button>
      )}
    >
      <div className="flex flex-col gap-3.5">
        <div>
          <CampoRotulo htmlFor="reg-convite">Código de convite</CampoRotulo>
          <div className="relative">
            <Ticket className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              id="reg-convite"
              type="text"
              autoFocus
              autoCapitalize="characters"
              autoComplete="off"
              value={convite}
              onChange={(e) => setConvite(e.target.value)}
              onKeyDown={aoTeclar}
              placeholder="TM-..."
              className="mike-input font-mono"
              style={{ paddingLeft: '2.25rem' }}
              disabled={enviando}
            />
          </div>
        </div>

        <div>
          <CampoRotulo htmlFor="reg-nome">Nome</CampoRotulo>
          <input
            id="reg-nome"
            type="text"
            autoComplete="name"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={aoTeclar}
            placeholder="Seu nome"
            className="mike-input"
            disabled={enviando}
          />
        </div>

        <div>
          <CampoRotulo htmlFor="reg-email">E-mail</CampoRotulo>
          <input
            id="reg-email"
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={aoTeclar}
            placeholder="voce@email.com"
            className="mike-input"
            disabled={enviando}
          />
        </div>

        <div>
          <CampoRotulo htmlFor="reg-senha">Senha</CampoRotulo>
          <div className="relative">
            <input
              id="reg-senha"
              type={mostrarSenha ? 'text' : 'password'}
              autoComplete="new-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              onKeyDown={aoTeclar}
              placeholder="Mín. 10 caracteres, letras e números"
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

        <div>
          <CampoRotulo htmlFor="reg-confirma">Confirmar senha</CampoRotulo>
          <input
            id="reg-confirma"
            type={mostrarSenha ? 'text' : 'password'}
            autoComplete="new-password"
            value={confirma}
            onChange={(e) => setConfirma(e.target.value)}
            onKeyDown={aoTeclar}
            placeholder="••••••••"
            className="mike-input"
            disabled={enviando}
          />
        </div>

        <CaixaErro>{erro}</CaixaErro>

        <button type="button" onClick={criar} disabled={enviando} className="mike-btn-primary w-full mt-1">
          <UserPlus className="w-4 h-4" />
          {enviando ? 'Criando conta...' : 'Criar conta'}
        </button>
      </div>
    </AuthLayout>
  );
}
