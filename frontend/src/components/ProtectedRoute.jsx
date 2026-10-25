import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ roles }) {
  const { user, home, loading } = useAuth();
  if (loading) return <div className="carregando-tela">Carregando...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={home} replace />;
  return <Outlet />;
}
