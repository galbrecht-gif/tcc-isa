import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Send, XCircle, Hourglass, CheckCircle2, Ban, Clock, Users } from 'lucide-react';
import api, { mensagemErro } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import useApi from '../components/useApi';
import SaidasTable from '../components/SaidasTable';
import EntradasTable from '../components/EntradasTable';
import StatCards from '../components/StatCards';
import { ConfirmModal } from '../components/Modal';

export default function AlunoSolicitacoes() {
  const toast = useToast();
  const { demoMode } = useAuth();
  const saidas = useApi('/saidas');
  const entradas = useApi('/entradas');
  const [cancelar, setCancelar] = useState(null);

  const lista = saidas.data || [];
  const emAndamento = lista.filter((s) => ['AGUARDANDO_RESPONSAVEL', 'AGUARDANDO_GESTOR', 'AGUARDANDO_PORTARIA'].includes(s.status)).length;
  const liberadas = lista.filter((s) => s.status === 'LIBERADO').length;
  const encerradas = lista.filter((s) => ['RECUSADO', 'CANCELADO'].includes(s.status)).length;
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

      <StatCards
        itens={[
          { icone: Hourglass, rotulo: 'Em andamento', valor: emAndamento, tom: 'amarelo' },
          { icone: CheckCircle2, rotulo: 'Saídas liberadas', valor: liberadas, tom: 'verde' },
          { icone: Ban, rotulo: 'Recusadas/canceladas', valor: encerradas, tom: 'vermelho' },
          { icone: Clock, rotulo: 'Entradas atrasadas', valor: (entradas.data || []).length, tom: 'azul' },
        ]}
      />

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
              {demoMode && s.status === 'AGUARDANDO_RESPONSAVEL' && (
                <Link className="btn btn-azul btn-pequeno" to={`/responsavel/validar?protocolo=${s.id}`} target="_blank">
                  <Users size={14} /> Simular responsável
                </Link>
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
