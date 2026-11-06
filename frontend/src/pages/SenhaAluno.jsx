import { useState } from 'react';
import { Link } from 'react-router-dom';
import api, { mensagemErro } from '../services/api';
import Marca from '../components/Marca';

export default function SenhaAluno() {
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [codigoEnviado, setCodigoEnviado] = useState(false);
  const [concluido, setConcluido] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  const solicitarCodigo = async (e) => {
    e?.preventDefault();
    setErro('');
    setMensagem('');
    setEnviando(true);
    try {
      const { data } = await api.post('/auth/senha/aluno/codigo', { email });
      setMensagem(data.mensagem);
      setCodigo('');
      setCodigoEnviado(true);
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setEnviando(false);
    }
  };

  const definirSenha = async (e) => {
    e.preventDefault();
    setErro('');
    if (senha !== confirmacao) {
      setErro('As senhas não conferem.');
      return;
    }
    setEnviando(true);
    try {
      const { data } = await api.post('/auth/senha/aluno/definir', { email, codigo, senha });
      setMensagem(data.mensagem);
      setConcluido(true);
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <main className="publico-tela">
      <section className="publico-caixa">
        <div className="publico-marca">
          <Marca subtitulo="Acesso do aluno" />
        </div>
        <h1>{concluido ? 'Senha criada' : 'Criar ou recuperar senha'}</h1>
        <p className="texto-suave">Esta recuperação é exclusiva para alunos e exige um código enviado ao e-mail cadastrado. Gestores, professores e portaria devem pedir ao gestor uma nova senha temporária.</p>
        {erro && <div className="alerta-erro" role="alert"><strong>{erro}</strong></div>}
        {mensagem && <p className="texto-ok" role="status">{mensagem}</p>}

        {!concluido && !codigoEnviado && (
          <form className="form" onSubmit={solicitarCodigo}>
            <label>
              E-mail cadastrado
              <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <button className="btn btn-primario btn-grande" disabled={enviando}>
              {enviando ? 'Enviando...' : 'Enviar código'}
            </button>
          </form>
        )}

        {!concluido && codigoEnviado && (
          <form className="form" onSubmit={definirSenha}>
            <p className="texto-suave">Se o e-mail estiver cadastrado como aluno ativo, você receberá um código válido por 10 minutos.</p>
            <label>
              Código recebido por e-mail
              <input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={codigo} onChange={(e) => setCodigo(e.target.value)} required />
            </label>
            <label>
              Nova senha
              <input type="password" autoComplete="new-password" minLength={8} maxLength={128} value={senha} onChange={(e) => setSenha(e.target.value)} required />
            </label>
            <label>
              Confirme a nova senha
              <input type="password" autoComplete="new-password" minLength={8} maxLength={128} value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} required />
            </label>
            <button className="btn btn-primario btn-grande" disabled={enviando}>
              {enviando ? 'Salvando...' : 'Criar senha'}
            </button>
            <button className="btn btn-secundario btn-grande" type="button" onClick={() => solicitarCodigo()} disabled={enviando}>
              {enviando ? 'Enviando...' : 'Reenviar código'}
            </button>
          </form>
        )}
        <Link className="link-btn centro" to="/login">Voltar para o login</Link>
      </section>
    </main>
  );
}
