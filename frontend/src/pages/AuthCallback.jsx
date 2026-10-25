import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AuthCallback() {
  const { refresh } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    refresh().then((u) => navigate(u ? '/' : '/login?erro=nao_autorizado', { replace: true }));
  }, [refresh, navigate]);

  return <div className="carregando-tela">Autenticando...</div>;
}
