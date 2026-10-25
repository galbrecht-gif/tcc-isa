import { useCallback, useEffect, useState } from 'react';
import { useToast } from '../context/ToastContext';
import api, { mensagemErro } from '../services/api';

// Carrega dados da API e expoe recarregar().
export default function useApi(url, params) {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const chave = JSON.stringify(params || {});

  const recarregar = useCallback(async () => {
    try {
      const { data: d } = await api.get(url, { params: JSON.parse(chave) });
      setData(d);
    } catch (e) {
      toast.erro(mensagemErro(e));
    } finally {
      setLoading(false);
    }
  }, [url, chave, toast]);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  return { data, loading, recarregar };
}
