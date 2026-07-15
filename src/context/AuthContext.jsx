// ============================================================
// context/AuthContext.jsx — Estado global de autenticação (Fase 2)
//
// - Restaura o usuário salvo no load e valida a sessão em /auth/me
//   (o api.js renova o access token sozinho se tiver expirado)
// - Escuta o evento global de logout forçado (sessão revogada/expirada)
// - Expõe { usuario, carregando, login, sair } via useAuth()
// ============================================================

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api.js';
import {
  EVENTO_LOGOUT,
  getAccessToken,
  getRefreshToken,
  getUsuarioSalvo,
  loginApi,
  logoutApi,
  salvarSessao,
} from '../lib/auth.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(() => getUsuarioSalvo());
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;

    (async () => {
      try {
        if (getAccessToken() || getRefreshToken()) {
          // Valida a sessão de verdade no servidor. Se o access venceu,
          // fetchComAuth tenta o refresh; se a sessão morreu, o evento
          // de logout abaixo zera o usuário.
          const eu = await api.get('/auth/me');
          if (ativo) {
            setUsuario(eu);
            salvarSessao({ usuario: eu });
          }
        }
      } catch (e) {
        // Rede fora: mantém o usuário salvo (não força re-login por
        // queda transitória). Qualquer 401/403 real derruba.
        const rede = String(e && e.message).includes('conexão');
        if (ativo && !rede) setUsuario(null);
      } finally {
        if (ativo) setCarregando(false);
      }
    })();

    const aoLogoutForcado = () => setUsuario(null);
    window.addEventListener(EVENTO_LOGOUT, aoLogoutForcado);
    return () => {
      ativo = false;
      window.removeEventListener(EVENTO_LOGOUT, aoLogoutForcado);
    };
  }, []);

  const login = useCallback(async (email, senha) => {
    const u = await loginApi(email, senha);
    setUsuario(u);
    return u;
  }, []);

  const sair = useCallback(async () => {
    try {
      await logoutApi();
    } finally {
      setUsuario(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ usuario, carregando, login, sair }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth precisa estar dentro de <AuthProvider>.');
  }
  return ctx;
}
