import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Send, XCircle } from 'lucide-react';
import api, { mensagemErro } from '../services/api';
import { useToast } from '../context/ToastContext';
import useApi from '../components/useApi';
import SaidasTable from '../components/SaidasTable';
import EntradasTable from '../components/EntradasTable';
import { ConfirmModal } from '../components/Modal';

export default function AlunoSolicitacoes() {
  const toast = useToast();
  const saidas = useApi('/saidas');
  const entradas = useApi('/entradas');
  const [cancelar, setCancelar] = useState(null);

  const reenviar = async (s) => {
    try {
      await api.post(`/saidas/${s.id}/reenviar-otp`);
      toast.sucesso('Novo código enviado ao responsável.');
    } catch (e) {
      toast.erro(mensagemErro(e));
    }
  };

  const confirmarCancelar = async () => {
    try {
      await api.post(`/saidas/${cancelar.id}/cancelar`);
      toast.sucesso('Solicitação cancelada.');
      saidas.recarregar();
    } catch (e) {
      toast.erro(mensagemErro(e));
    }
    setCancelar(null);
  };

  return (
    <>
      <div className="pagina-topo">
        <h1>Minhas solicitações</h1>
        <Link to="/aluno/nova" className="btn btn-primario">
          <Plus size={16} /> Nova saída antecipada
        </Link>
      </div>

      <section className="cartao">
        <h2>Saídas antecipadas</h2>
        <SaidasTable
          saidas={saidas.data || []}
          mostrarAluno={false}
          acoes={(s) => (
            <div className="acoes">
              {s.status === 'AGUARDANDO_RESPONSAVEL' && (
                <button className="btn btn-secundario btn-pequeno" onClick={() => reenviar(s)}>
                  <Send size={14} /> Reenviar código
                </button>
              )}
              {['AGUARDANDO_RESPONSAVEL', 'AGUARDANDO_GESTOR'].includes(s.status) && (
                <button className="btn btn-perigo-outline btn-pequeno" onClick={() => setCancelar(s)}>
                  <XCircle size={14} /> Cancelar
                </button>
              )}
            </div>
          )}
        />
      </section>

      <section className="cartao">
        <h2>Entradas atrasadas registradas</h2>
        <EntradasTable entradas={entradas.data || []} mostrarAluno={false} />
      </section>

      {cancelar && (
        <ConfirmModal
          titulo="Cancelar solicitação"
          mensagem={`Deseja cancelar a solicitação #${cancelar.id}?`}
          confirmar="Cancelar solicitação"
          perigo
          onConfirm={confirmarCancelar}
          onClose={() => setCancelar(null)}
        />
      )}
    </>
  );
}
