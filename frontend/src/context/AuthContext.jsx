import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [home, setHome] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me');
      setUser(data.usuario);
      setHome(data.home);
      return data.usuario;
    } catch {
      setUser(null);
      setHome(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const expirou = () => {
      setUser(null);
      setHome(null);
    };
    window.addEventListener('auth:expired', expirou);
    return () => window.removeEventListener('auth:expired', expirou);
  }, [refresh]);

  const loginDemo = useCallback(async (role, usuarioId) => {
    const { data } = await api.post('/auth/demo', { role, usuario_id: usuarioId });
    setUser(data.usuario);
    setHome(data.home);
    return data.home;
  }, []);

  const logout = useCallback(async () => {
    await api.post('/auth/logout');
    setUser(null);
    setHome(null);
  }, []);

  const value = useMemo(() => ({ user, home, loading, refresh, loginDemo, logout }), [user, home, loading, refresh, loginDemo, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
