// ============================================================
// shared/RequireAuth.jsx — Porteiro das rotas internas (Fase 2)
//
// Usado como layout route no App.jsx:
//   <Route element={<RequireAuth />}> ...rotas protegidas... </Route>
//
// - Enquanto a sessão está sendo validada: tela de carregando com a
//   logo (evita "piscar" o login)
// - Sem usuário: redireciona pro /login guardando a rota de origem
// - Com usuário: renderiza a rota filha via <Outlet />
// ============================================================

import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { TelaCarregando } from './Estados.jsx';

export default function RequireAuth() {
  const { usuario, carregando } = useAuth();
  const location = useLocation();

  if (carregando) {
    return <TelaCarregando texto="Abrindo o painel" />;
  }

  if (!usuario) {
    return <Navigate to="/login" replace state={{ de: location.pathname }} />;
  }

  return <Outlet />;
}
