import axios from 'axios';

const api = axios.create({ baseURL: '/api', withCredentials: true });

api.interceptors.response.use(
  (r) => r,
  (error) => {
    const url = error.config?.url || '';
    if (error.response?.status === 401 && !url.startsWith('/auth/')) {
      window.dispatchEvent(new Event('auth:expired'));
    }
    return Promise.reject(error);
  }
);

export const mensagemErro = (error) =>
  error.response?.data?.erro || (error.request ? 'Servidor indisponivel. Tente novamente.' : 'Erro inesperado.');

export default api;
