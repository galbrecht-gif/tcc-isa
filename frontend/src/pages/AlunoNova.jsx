import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Info, Send } from 'lucide-react';
import api, { mensagemErro } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import SignaturePad from '../components/SignaturePad';
import { agoraInputLocal } from '../utils/format';

export default function AlunoNova() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [motivo, setMotivo] = useState('');
  const [horario, setHorario] = useState(agoraInputLocal(15));
  const [assinatura, setAssinatura] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const maior = user.maior_idade;

  const enviar = async (e) => {
    e.preventDefault();
    if (maior && !assinatura) {
      toast.erro('Confirme sua assinatura digital antes de enviar.');
      return;
    }
    setEnviando(true);
    try {
      await api.post('/saidas', { motivo, horario_previsto: horario, assinatura: maior ? assinatura : undefined });
      toast.sucesso(maior ? 'Solicitação enviada ao gestor.' : 'Solicitação criada. Um código foi enviado ao responsável.');
      navigate('/aluno');
    } catch (err) {
      toast.erro(mensagemErro(err));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <div className="pagina-topo">
        <h1>Nova saída antecipada</h1>
      </div>
      <form className="cartao form" onSubmit={enviar}>
        <div className="aviso">
          <Info size={18} />
          <span>
            {maior
              ? 'Você é maior de 18 anos: a solicitação segue direto para o gestor, mediante sua assinatura digital.'
              : 'Você é menor de 18 anos: um código de 6 dígitos será enviado ao seu responsável, que deverá autorizar a saída.'}
          </span>
        </div>
        <label>
          Motivo
          <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} maxLength={500} required minLength={5} />
        </label>
        <label>
          Horário de saída
          <input type="datetime-local" value={horario} onChange={(e) => setHorario(e.target.value)} required />
        </label>
        {maior && (
          <div>
            <span className="rotulo">Assinatura digital</span>
            <SignaturePad onChange={setAssinatura} />
          </div>
        )}
        <div className="form-acoes">
          <button className="btn btn-primario" disabled={enviando}>
            <Send size={16} /> Enviar solicitação
          </button>
        </div>
      </form>
    </>
  );
}
