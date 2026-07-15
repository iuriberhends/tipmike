// ============================================================
// shared/RequireAuth.jsx — Porteiro das rotas internas (Fase 2)
//
// Usado como layout route no App.jsx:
//   <Route element={<RequireAuth />}> ...rotas protegidas... </Route>
//
// - Enquanto a sessão está sendo validada: spinner (evita "piscar" o login)
// - Sem usuário: redireciona pro /login guardando a rota de origem
// - Com usuário: renderiza a rota filha via <Outlet />
// ============================================================

import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function RequireAuth() {
  const { usuario, carregando } = useAuth();
  const location = useLocation();

  if (carregando) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: '#0b0f1a' }}
      >
        <div
          className="w-8 h-8 rounded-full border-2 border-cyan-400 animate-spin"
          style={{ borderTopColor: 'transparent' }}
          aria-label="Carregando"
        />
      </div>
    );
  }

  if (!usuario) {
    return <Navigate to="/login" replace state={{ de: location.pathname }} />;
  }

  return <Outlet />;
}
