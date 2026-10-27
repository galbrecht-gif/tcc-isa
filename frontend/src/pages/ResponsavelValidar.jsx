import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Car, XCircle, Mail } from 'lucide-react';
import api, { mensagemErro } from '../services/api';
import Marca from '../components/Marca';
import { useToast } from '../context/ToastContext';
import { ConfirmModal } from '../components/Modal';
import { fmtDataHora } from '../utils/format';

const DECISOES = {
  AUTORIZO: { rotulo: 'Autorizo', icone: CheckCircle2, classe: 'btn-primario', msg: 'Você autoriza a saída antecipada do aluno?' },
  IREI_BUSCAR: { rotulo: 'Irei Buscar', icone: Car, classe: 'btn-azul', msg: 'Você informa que irá buscar o aluno?' },
  NAO_AUTORIZO: { rotulo: 'Não Autorizo', icone: XCircle, classe: 'btn-perigo', msg: 'Você NÃO autoriza a saída antecipada do aluno?' },
};

export default function ResponsavelValidar() {
  const toast = useToast();
  const [params] = useSearchParams();
  const [protocolo, setProtocolo] = useState(params.get('protocolo') || '');
  const [codigo, setCodigo] = useState('');
  const [solicitacao, setSolicitacao] = useState(null);
  const [confirmar, setConfirmar] = useState(null);
  const [concluido, setConcluido] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [emailsDemo, setEmailsDemo] = useState([]);

  useEffect(() => {
    api
      .get('/demo/emails')
      .then(({ data }) => {
        setEmailsDemo(data);
        const alvo = params.get('protocolo');
        const email = alvo && data.find((m) => new RegExp(`Protocolo: ${alvo}\\b`).test(m.corpo));
        const cod = email && /Codigo de verificacao: (\d{6})/.exec(email.corpo)?.[1];
        if (cod) setCodigo(cod);
      })
      .catch(() => setEmailsDemo([]));
    // preenchimento automatico apenas na abertura da tela
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const consultar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    try {
      const { data } = await api.post('/public/responsavel/consultar', { protocolo: Number(protocolo), codigo });
      setSolicitacao(data);
    } catch (err) {
      toast.erro(mensagemErro(err));
    } finally {
      setEnviando(false);
    }
  };

  const decidir = async () => {
    setEnviando(true);
    try {
      await api.post('/public/responsavel/decidir', { protocolo: Number(protocolo), codigo, decisao: confirmar });
      setConcluido(confirmar);
      setConfirmar(null);
    } catch (err) {
      toast.erro(mensagemErro(err));
      setConfirmar(null);
    } finally {
      setEnviando(false);
    }
  };

  const usarEmail = (email) => {
    setProtocolo(/Protocolo: (\d+)/.exec(email.corpo)?.[1] || '');
    setCodigo(/Codigo de verificacao: (\d{6})/.exec(email.corpo)?.[1] || '');
  };

  return (
    <div className="publico-tela">
      <div className="publico-caixa">
        <div className="publico-marca">
          <Marca subtitulo="Autorização do responsável" />
        </div>

        {concluido ? (
          <div className="centro">
            <CheckCircle2 size={48} className="texto-ok" />
            <h2>Resposta registrada</h2>
            <p>Sua decisão ({DECISOES[concluido].rotulo}) foi enviada. Este código não pode ser reutilizado.</p>
            <Link className="btn btn-secundario" to="/login">
              Voltar ao início
            </Link>
          </div>
        ) : !solicitacao ? (
          <form onSubmit={consultar} className="form">
            <p className="texto-suave">Informe o protocolo e o código de 6 dígitos recebidos por e-mail (válido por 15 minutos).</p>
            <label>
              Protocolo
              <input type="number" value={protocolo} onChange={(e) => setProtocolo(e.target.value)} required />
            </label>
            <label>
              Código de verificação
              <input value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" maxLength={6} required />
            </label>
            <button className="btn btn-primario" disabled={enviando || codigo.length !== 6 || !protocolo}>
              Validar código
            </button>
          </form>
        ) : (
          <div>
            <h2>Saída antecipada solicitada</h2>
            <dl className="detalhes">
              <dt>Aluno</dt>
              <dd>{solicitacao.aluno_nome}</dd>
              <dt>Saída prevista</dt>
              <dd>{fmtDataHora(solicitacao.horario_previsto)}</dd>
              <dt>Motivo</dt>
              <dd>{solicitacao.motivo}</dd>
            </dl>
            <div className="acoes-decisao">
              {Object.entries(DECISOES).map(([chave, d]) => (
                <button key={chave} className={`btn ${d.classe}`} onClick={() => setConfirmar(chave)}>
                  <d.icone size={18} /> {d.rotulo}
                </button>
              ))}
            </div>
          </div>
        )}

        {emailsDemo.length > 0 && !concluido && (
          <div className="demo-bloco">
            <h3>
              <Mail size={16} /> Modo demonstração: e-mails enviados
            </h3>
            <ul className="lista-demo">
              {emailsDemo.map((m) => (
                <li key={m.id}>
                  <span>
                    {m.destinatario} - {m.assunto.replace('Autorizacao de saida antecipada - ', '')}
                  </span>
                  <button type="button" className="link-btn" onClick={() => usarEmail(m)}>
                    Usar código
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {confirmar && (
        <ConfirmModal
          titulo="Confirmar decisão"
          mensagem={DECISOES[confirmar].msg}
          confirmar={DECISOES[confirmar].rotulo}
          perigo={confirmar === 'NAO_AUTORIZO'}
          carregando={enviando}
          onConfirm={decidir}
          onClose={() => setConfirmar(null)}
        />
      )}
    </div>
  );
}
