// ============================================================
// shared/RequireAdmin.jsx — Guarda de rota: só admins passam.
// Usar DENTRO do <RequireAuth /> (sessão já validada aqui).
// Não-admin não vê a rota: volta pro início sem alarde.
// ============================================================

import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function RequireAdmin() {
  const { usuario, carregando } = useAuth();

  if (carregando) return null;
  if (!usuario || usuario.role !== 'admin') {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}
