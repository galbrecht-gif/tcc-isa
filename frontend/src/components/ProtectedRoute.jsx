import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ roles, passwordChangeOnly = false, children }) {
  const { user, home, loading } = useAuth();
  if (loading) return <div className="carregando-tela">Carregando...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.deve_trocar_senha && !passwordChangeOnly) return <Navigate to="/alterar-senha" replace />;
  if (passwordChangeOnly && !user.deve_trocar_senha) return <Navigate to={home} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={home} replace />;
  return children || <Outlet />;
}
