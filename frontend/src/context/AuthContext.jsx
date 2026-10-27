import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [home, setHome] = useState(null);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState({ demoMode: false, googleEnabled: false });
  const [demoUsuarios, setDemoUsuarios] = useState([]);

  useEffect(() => {
    api
      .get('/auth/config')
      .then(async ({ data }) => {
        setConfig(data);
        if (data.demoMode) setDemoUsuarios((await api.get('/auth/demo/usuarios')).data);
      })
      .catch(() => {});
  }, []);

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

  const resetarDemo = useCallback(async () => {
    const { data } = await api.post('/demo/reset');
    const lista = await api.get('/auth/demo/usuarios');
    setDemoUsuarios(lista.data);
    setUser(data.usuario);
    setHome(data.home);
    return data.home;
  }, []);

  const value = useMemo(
    () => ({ user, home, loading, config, demoMode: config.demoMode, demoUsuarios, refresh, loginDemo, resetarDemo, logout }),
    [user, home, loading, config, demoUsuarios, refresh, loginDemo, resetarDemo, logout]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
