import { useState } from 'react';
import { LogOut, Hourglass, CheckCircle2, Clock } from 'lucide-react';
import api, { mensagemErro } from '../services/api';
import { useToast } from '../context/ToastContext';
import useApi from '../components/useApi';
import SaidasTable from '../components/SaidasTable';
import StatCards from '../components/StatCards';
import { ConfirmModal } from '../components/Modal';
import { ehHoje } from '../utils/format';

export default function PortariaSaidas() {
  const toast = useToast();
  const saidas = useApi('/saidas');
  const entradas = useApi('/entradas');
  const [alvo, setAlvo] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const lista = saidas.data || [];
  const aguardando = lista.filter((s) => s.status === 'AGUARDANDO_PORTARIA').length;
  const liberadasHoje = lista.filter((s) => s.status === 'LIBERADO' && ehHoje(s.horario_saida_real)).length;
  const entradasHoje = (entradas.data || []).filter((e) => ehHoje(e.horario_efetivo)).length;
  const liberar = async () => {
    setEnviando(true);
    try {
      await api.post(`/saidas/${alvo.id}/liberar`);
      toast.sucesso(`${alvo.aluno_nome} liberado(a). Horário de saída registrado.`);
      saidas.recarregar();
    } catch (e) {
      toast.erro(mensagemErro(e));
    } finally {
      setEnviando(false);
      setAlvo(null);
    }
  };

  return (
    <>
      <div className="pagina-topo">
        <h1>Liberar saídas</h1>
      </div>
      <StatCards
        itens={[
          { icone: Hourglass, rotulo: 'Aguardando liberação', valor: aguardando, tom: 'vermelho' },
          { icone: CheckCircle2, rotulo: 'Liberadas hoje', valor: liberadasHoje, tom: 'verde' },
          { icone: Clock, rotulo: 'Entradas registradas hoje', valor: entradasHoje, tom: 'azul' },
        ]}
      />
      <section className="cartao">
        <SaidasTable
          saidas={saidas.data || []}
          consolidado
          acoes={(s) =>
            s.status === 'AGUARDANDO_PORTARIA' ? (
              <button className="btn btn-primario btn-pequeno" onClick={() => setAlvo(s)}>
                <LogOut size={14} /> Liberar Aluno
              </button>
            ) : null
          }
        />
      </section>
      {alvo && (
        <ConfirmModal
          titulo="Liberar aluno"
          mensagem={`Confirmar a saída de ${alvo.aluno_nome}? O horário real será registrado agora.`}
          confirmar="Liberar Aluno"
          carregando={enviando}
          onConfirm={liberar}
          onClose={() => setAlvo(null)}
        />
      )}
    </>
  );
}
