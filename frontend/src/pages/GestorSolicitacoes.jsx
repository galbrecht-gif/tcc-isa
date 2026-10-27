import { useState } from 'react';
import { Check, X, Hourglass, CheckCircle2, Mail, Clock } from 'lucide-react';
import api, { mensagemErro } from '../services/api';
import { useToast } from '../context/ToastContext';
import useApi from '../components/useApi';
import SaidasTable from '../components/SaidasTable';
import StatCards from '../components/StatCards';
import Modal from '../components/Modal';
import { ehHoje } from '../utils/format';

export default function GestorSolicitacoes() {
  const toast = useToast();
  const saidas = useApi('/saidas');
  const entradas = useApi('/entradas');
  const [alvo, setAlvo] = useState(null);
  const [recusa, setRecusa] = useState(false);
  const [justificativa, setJustificativa] = useState('');
  const [enviando, setEnviando] = useState(false);

  const lista = saidas.data || [];
  const aguardando = lista.filter((s) => s.status === 'AGUARDANDO_GESTOR').length;
  const comResponsavel = lista.filter((s) => s.status === 'AGUARDANDO_RESPONSAVEL').length;
  const liberadasHoje = lista.filter((s) => s.status === 'LIBERADO' && ehHoje(s.horario_saida_real)).length;
  const entradasHoje = (entradas.data || []).filter((e) => ehHoje(e.horario_efetivo)).length;
  const abrir = (s, ehRecusa) => {
    setAlvo(s);
    setRecusa(ehRecusa);
    setJustificativa('');
  };

  const enviar = async () => {
    if (recusa && justificativa.trim().length < 3) {
      toast.erro('Informe a justificativa da recusa.');
      return;
    }
    setEnviando(true);
    try {
      await api.post(`/saidas/${alvo.id}/gestor`, { decisao: recusa ? 'RECUSADO' : 'APROVADO', justificativa });
      toast.sucesso(recusa ? 'Solicitação recusada.' : 'Solicitação aprovada. Portaria e professor notificados.');
      setAlvo(null);
      saidas.recarregar();
    } catch (e) {
      toast.erro(mensagemErro(e));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <div className="pagina-topo">
        <h1>Solicitações de saída antecipada</h1>
      </div>
      <StatCards
        itens={[
          { icone: Hourglass, rotulo: 'Aguardando sua decisão', valor: aguardando, tom: 'vermelho' },
          { icone: Mail, rotulo: 'Aguardando responsável', valor: comResponsavel, tom: 'amarelo' },
          { icone: CheckCircle2, rotulo: 'Saídas liberadas hoje', valor: liberadasHoje, tom: 'verde' },
          { icone: Clock, rotulo: 'Entradas atrasadas hoje', valor: entradasHoje, tom: 'azul' },
        ]}
      />
      <section className="cartao">
        <SaidasTable
          saidas={saidas.data || []}
          consolidado
          acoes={(s) =>
            s.status === 'AGUARDANDO_GESTOR' ? (
              <div className="acoes">
                <button className="btn btn-primario btn-pequeno" onClick={() => abrir(s, false)}>
                  <Check size={14} /> Aprovar
                </button>
                <button className="btn btn-perigo-outline btn-pequeno" onClick={() => abrir(s, true)}>
                  <X size={14} /> Recusar
                </button>
              </div>
            ) : s.gestor_justificativa ? (
              <small>Justificativa: {s.gestor_justificativa}</small>
            ) : null
          }
        />
      </section>

      {alvo && (
        <Modal
          titulo={recusa ? 'Recusar solicitação' : 'Aprovar solicitação'}
          onClose={() => setAlvo(null)}
          rodape={
            <>
              <button className="btn btn-secundario" onClick={() => setAlvo(null)} disabled={enviando}>
                Cancelar
              </button>
              <button className={`btn ${recusa ? 'btn-perigo' : 'btn-primario'}`} onClick={enviar} disabled={enviando}>
                {recusa ? 'Recusar' : 'Aprovar'}
              </button>
            </>
          }
        >
          <p>
            <strong>{alvo.aluno_nome}</strong> - {alvo.motivo}
          </p>
          <label className="form">
            {recusa ? 'Justificativa (obrigatória)' : 'Observação (opcional)'}
            <textarea rows={3} value={justificativa} onChange={(e) => setJustificativa(e.target.value)} maxLength={500} />
          </label>
        </Modal>
      )}
    </>
  );
}
