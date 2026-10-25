import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import api from '../services/api';
import { fmtDataHora } from '../utils/format';

export default function NotificationBell() {
  const [dados, setDados] = useState({ naoLidas: 0, itens: [] });
  const [aberto, setAberto] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  const carregar = async () => {
    try {
      const { data } = await api.get('/notificacoes');
      setDados(data);
    } catch {
      /* sessao expirada e tratada pelo interceptor */
    }
  };

  useEffect(() => {
    carregar();
    const t = setInterval(carregar, 20000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const fora = (e) => ref.current && !ref.current.contains(e.target) && setAberto(false);
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, []);

  const abrir = async (n) => {
    if (!n.lida) await api.patch(`/notificacoes/${n.id}/ler`);
    setAberto(false);
    carregar();
    if (n.link) navigate(n.link);
  };

  const lerTodas = async () => {
    await api.patch('/notificacoes/ler-todas');
    carregar();
  };

  return (
    <div className="sino" ref={ref}>
      <button className="icon-btn" onClick={() => setAberto((a) => !a)} aria-label="Notificações">
        <Bell size={20} />
        {dados.naoLidas > 0 && <span className="sino-badge">{dados.naoLidas > 99 ? '99+' : dados.naoLidas}</span>}
      </button>
      {aberto && (
        <div className="sino-painel">
          <div className="sino-topo">
            <strong>Notificações</strong>
            <button className="link-btn" onClick={lerTodas} disabled={!dados.naoLidas}>
              <CheckCheck size={14} /> Marcar todas como lidas
            </button>
          </div>
          {dados.itens.length === 0 && <p className="sino-vazio">Nenhuma notificação.</p>}
          {dados.itens.map((n) => (
            <button key={n.id} className={`sino-item ${n.lida ? '' : 'nao-lida'}`} onClick={() => abrir(n)}>
              <strong>{n.titulo}</strong>
              <span>{n.mensagem}</span>
              <small>{fmtDataHora(n.criado_em)}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
