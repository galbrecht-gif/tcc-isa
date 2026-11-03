import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { mensagemErro } from '../services/api';
import Marca from '../components/Marca';

function menorDeIdade(dataNascimento) {
  if (!dataNascimento) return false;
  const [ano, mes, dia] = dataNascimento.split('-').map(Number);
  const hoje = new Date();
  let idade = hoje.getFullYear() - ano;
  if (hoje.getMonth() + 1 < mes || (hoje.getMonth() + 1 === mes && hoje.getDate() < dia)) idade -= 1;
  return idade < 18;
}

export default function CadastroAluno() {
  const [turmas, setTurmas] = useState([]);
  const [dados, setDados] = useState({
    nome: '',
    email: '',
    dataNascimento: '',
    turmaId: '',
    responsavelNome: '',
    responsavelEmail: '',
  });
  const [codigo, setCodigo] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [codigoEnviado, setCodigoEnviado] = useState(false);
  const [concluido, setConcluido] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    api.get('/public/turmas')
      .then(({ data }) => setTurmas(data))
      .catch((err) => setErro(mensagemErro(err)));
  }, []);

  const atualizar = (campo, valor) => setDados((atual) => ({ ...atual, [campo]: valor }));

  const solicitarCodigo = async (e) => {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      const { data } = await api.post('/auth/senha/aluno/cadastro/codigo', dados);
      setMensagem(`${data.mensagem} Confira também a caixa de spam. Se já tiver cadastro, use a opção de recuperar senha.`);
      setCodigoEnviado(true);
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setEnviando(false);
    }
  };

  const confirmarCadastro = async (e) => {
    e.preventDefault();
    setErro('');
    if (senha !== confirmacao) {
      setErro('As senhas não conferem.');
      return;
    }
    setEnviando(true);
    try {
      const { data } = await api.post('/auth/senha/aluno/cadastro/confirmar', {
        email: dados.email,
        codigo,
        senha,
      });
      setMensagem(data.mensagem);
      setConcluido(true);
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setEnviando(false);
    }
  };

  const menor = menorDeIdade(dados.dataNascimento);

  return (
    <main className="publico-tela">
      <section className="publico-caixa">
        <div className="publico-marca">
          <Marca subtitulo="Cadastro de aluno" />
        </div>
        <h1>{concluido ? 'Cadastro confirmado' : 'Crie sua conta de aluno'}</h1>
        <p className="texto-suave">
          Use qualquer e-mail válido que você consiga acessar. A conta será ativada depois da confirmação do endereço.
        </p>
        {erro && <div className="alerta-erro" role="alert"><strong>{erro}</strong></div>}
        {mensagem && <p className="texto-ok" role="status">{mensagem}</p>}

        {!codigoEnviado && !concluido && (
          <form className="form" onSubmit={solicitarCodigo}>
            <label>
              Nome completo
              <input autoComplete="name" minLength={3} maxLength={150} value={dados.nome} onChange={(e) => atualizar('nome', e.target.value)} required />
            </label>
            <label>
              E-mail
              <input type="email" autoComplete="email" maxLength={190} value={dados.email} onChange={(e) => atualizar('email', e.target.value)} required />
            </label>
            <label>
              Data de nascimento
              <input type="date" value={dados.dataNascimento} onChange={(e) => atualizar('dataNascimento', e.target.value)} required />
            </label>
            <label>
              Turma
              <select value={dados.turmaId} onChange={(e) => atualizar('turmaId', e.target.value)} required disabled={!turmas.length}>
                <option value="">Selecione sua turma</option>
                {turmas.map((turma) => (
                  <option key={turma.id} value={turma.id}>{turma.nome} - {turma.curso}</option>
                ))}
              </select>
              {!turmas.length && <small className="texto-suave">Não foi possível carregar as turmas. Atualize a página ou tente novamente mais tarde.</small>}
            </label>
            {menor && (
              <>
                <label>
                  Nome do responsável
                  <input autoComplete="name" minLength={3} maxLength={150} value={dados.responsavelNome} onChange={(e) => atualizar('responsavelNome', e.target.value)} required />
                </label>
                <label>
                  E-mail do responsável
                  <input type="email" autoComplete="email" maxLength={190} value={dados.responsavelEmail} onChange={(e) => atualizar('responsavelEmail', e.target.value)} required />
                </label>
                <small className="texto-suave">Como você tem menos de 18 anos, o responsável será vinculado para autorizar solicitações de saída.</small>
              </>
            )}
            <button className="btn btn-primario btn-grande" disabled={enviando || !turmas.length}>
              {enviando ? 'Enviando código...' : 'Continuar e confirmar e-mail'}
            </button>
          </form>
        )}

        {codigoEnviado && !concluido && (
          <form className="form" onSubmit={confirmarCadastro}>
            <label>
              Código enviado para {dados.email}
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                required
              />
            </label>
            <label>
              Crie sua senha
              <input type="password" autoComplete="new-password" minLength={8} maxLength={128} value={senha} onChange={(e) => setSenha(e.target.value)} required />
            </label>
            <label>
              Confirme sua senha
              <input type="password" autoComplete="new-password" minLength={8} maxLength={128} value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} required />
            </label>
            <button className="btn btn-primario btn-grande" disabled={enviando}>
              {enviando ? 'Confirmando...' : 'Confirmar cadastro'}
            </button>
          </form>
        )}

        {concluido && <Link className="btn btn-primario btn-grande" to="/login">Ir para o login</Link>}
        {!concluido && <Link className="link-btn centro" to="/login">Voltar para o login</Link>}
      </section>
    </main>
  );
}
