import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);
const ICONES = { success: CheckCircle2, error: AlertCircle, info: Info };

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remover = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const mostrar = useCallback(
    (tipo, mensagem) => {
      const id = Date.now() + Math.random();
      setToasts((t) => [...t, { id, tipo, mensagem }]);
      setTimeout(() => remover(id), 5000);
    },
    [remover]
  );

  const api = useMemo(
    () => ({
      sucesso: (m) => mostrar('success', m),
      erro: (m) => mostrar('error', m),
      info: (m) => mostrar('info', m),
    }),
    [mostrar]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-area" role="status" aria-live="polite">
        {toasts.map((t) => {
          const Icone = ICONES[t.tipo];
          return (
            <div key={t.id} className={`toast toast-${t.tipo}`}>
              <Icone size={18} />
              <span>{t.mensagem}</span>
              <button className="icon-btn" onClick={() => remover(t.id)} aria-label="Fechar">
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
