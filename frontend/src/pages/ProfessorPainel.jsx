import { Check } from 'lucide-react';
import api, { mensagemErro } from '../services/api';
import { useToast } from '../context/ToastContext';
import useApi from '../components/useApi';
import SaidasTable from '../components/SaidasTable';
import EntradasTable from '../components/EntradasTable';

export default function ProfessorPainel() {
  const toast = useToast();
  const saidas = useApi('/saidas');
  const entradas = useApi('/entradas');

  const ciente = async (tipo, id, recarregar) => {
    try {
      await api.post(`/${tipo}/${id}/ciente`);
      toast.sucesso('Ciência registrada.');
      recarregar();
    } catch (e) {
      toast.erro(mensagemErro(e));
    }
  };

  return (
    <>
      <div className="pagina-topo">
        <h1>Painel da turma</h1>
      </div>
      <section className="cartao">
        <h2>Saídas antecipadas</h2>
        <SaidasTable
          saidas={saidas.data || []}
          consolidado
          acoes={(s) =>
            s.gestor_status === 'APROVADO' && !s.professor_ciente ? (
              <button className="btn btn-primario btn-pequeno" onClick={() => ciente('saidas', s.id, saidas.recarregar)}>
                <Check size={14} /> Ciente
              </button>
            ) : null
          }
        />
      </section>
      <section className="cartao">
        <h2>Entradas atrasadas</h2>
        <EntradasTable
          entradas={entradas.data || []}
          acoes={(e) =>
            !e.professor_ciente ? (
              <button className="btn btn-primario btn-pequeno" onClick={() => ciente('entradas', e.id, entradas.recarregar)}>
                <Check size={14} /> Ciente
              </button>
            ) : null
          }
        />
      </section>
    </>
  );
}
