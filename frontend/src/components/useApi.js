import { useCallback, useEffect, useState } from 'react';
import { useToast } from '../context/ToastContext';
import api, { mensagemErro } from '../services/api';

const INTERVALO_PADRAO = 10000;

// Carrega dados da API, expoe recarregar() e atualiza em segundo plano
// para que mudancas feitas por outros perfis aparecam sem recarregar a pagina.
export default function useApi(url, params, { intervalo = INTERVALO_PADRAO } = {}) {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const chave = JSON.stringify(params || {});

  const carregar = useCallback(
    async (silencioso) => {
      try {
        const { data: d } = await api.get(url, { params: JSON.parse(chave) });
        setData(d);
      } catch (e) {
        if (!silencioso) toast.erro(mensagemErro(e));
      } finally {
        setLoading(false);
      }
    },
    [url, chave, toast]
  );

  const recarregar = useCallback(() => carregar(false), [carregar]);

  useEffect(() => {
    carregar(false);
    if (!intervalo) return undefined;
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') carregar(true);
    }, intervalo);
    return () => clearInterval(t);
  }, [carregar, intervalo]);

  return { data, loading, recarregar };
}
