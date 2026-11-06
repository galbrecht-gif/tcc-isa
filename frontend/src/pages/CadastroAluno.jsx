import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import api, { mensagemErro } from '../services/api';
import Marca from '../components/Marca';

function menorDeIdade(dataNascimento) {
  if (!dataNascimento) return false;
  const [ano, mes, dia] = dataNascimento.split('-').map(Number);
  const hojePartes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const hoje = Object.fromEntries(hojePartes.map(({ type, value }) => [type, value]));
  let idade = Number(hoje.year) - ano;
  if (Number(hoje.month) < mes || (Number(hoje.month) === mes && Number(hoje.day) < dia)) idade -= 1;
  return idade < 18;
}

export default function CadastroAluno() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const googleCadastro = params.get('google') === '1';
  const [turmas, setTurmas] = useState([]);
  const [dados, setDados] = useState({
    nome: '',
    email: '',
    dataNascimento: '',
    turmaId: '',
    responsavelNome: '',
    responsavelEmail: '',
  });
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [concluido, setConcluido] = useState(false);
  const [erroTurmas, setErroTurmas] = useState(false);
  const [carregandoGoogle, setCarregandoGoogle] = useState(googleCadastro);
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    api.get('/public/turmas')
      .then(({ data }) => {
        setTurmas(data);
        setErroTurmas(false);
      })
      .catch((err) => {
        setErroTurmas(true);
        setErro(mensagemErro(err));
      });
  }, []);

  useEffect(() => {
    if (!googleCadastro) return;
    api.get('/auth/google/cadastro-aluno')
      .then(({ data }) => {
        setDados((atual) => ({ ...atual, nome: data.nome, email: data.email }));
      })
      .catch((err) => setErro(mensagemErro(err)))
      .finally(() => setCarregandoGoogle(false));
  }, [googleCadastro]);

  const atualizar = (campo, valor) => setDados((atual) => ({ ...atual, [campo]: valor }));

  const criarConta = async (e) => {
    e.preventDefault();
    setErro('');
    setMensagem('');
    if (senha !== confirmacao) {
      setErro('As senhas não conferem.');
      return;
    }
    setEnviando(true);
    try {
      const { data } = await api.post('/auth/senha/aluno/cadastro', { ...dados, senha });
      setMensagem(data.mensagem);
      setConcluido(true);
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setEnviando(false);
    }
  };

  const concluirCadastroGoogle = async (e) => {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      await api.post('/auth/google/cadastro-aluno', dados);
      navigate('/auth/callback', { replace: true });
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
        <Link className="link-btn" to="/login" aria-label="Voltar para o login">
          <ArrowLeft size={18} aria-hidden="true" /> Voltar ao login
        </Link>
        <div className="publico-marca">
          <Marca subtitulo="Cadastro de aluno" />
        </div>
        <h1>{concluido ? 'Conta criada' : googleCadastro ? 'Finalize seu cadastro de aluno' : 'Crie sua conta de aluno'}</h1>
        {googleCadastro && (
          <p className="texto-suave">Confirme seus dados para concluir a criação da conta. Seu e-mail já foi confirmado pelo Google.</p>
        )}
        {erro && <div className="alerta-erro" role="alert"><strong>{erro}</strong></div>}
        {mensagem && <p className="texto-ok" role="status">{mensagem}</p>}

        {carregandoGoogle && <p className="texto-suave" role="status">Validando sua conta Google...</p>}

        {!concluido && !carregandoGoogle && (
          <form className="form" onSubmit={googleCadastro ? concluirCadastroGoogle : criarConta}>
            <label>
              Nome completo
              <input autoComplete="name" minLength={3} maxLength={150} value={dados.nome} onChange={(e) => atualizar('nome', e.target.value)} required />
            </label>
            <label>
              E-mail
              <input type="email" autoComplete="email" maxLength={190} value={dados.email} onChange={(e) => atualizar('email', e.target.value)} required readOnly={googleCadastro} />
            </label>
            <label>
              Data de nascimento
              <input type="date" value={dados.dataNascimento} onChange={(e) => atualizar('dataNascimento', e.target.value)} required />
            </label>
            {dados.dataNascimento && (
              <p className="texto-suave" role="status">
                {menor
                  ? 'Identificação automática: menor de 18 anos. É necessário cadastrar um responsável.'
                  : 'Identificação automática: maior de idade. Não é necessário cadastrar um responsável.'}
              </p>
            )}
            <label>
              Turma
              <select value={dados.turmaId} onChange={(e) => atualizar('turmaId', e.target.value)} required disabled={!turmas.length}>
                <option value="">Selecione sua turma</option>
                {turmas.map((turma) => (
                  <option key={turma.id} value={turma.id}>{turma.nome} - {turma.curso}</option>
                ))}
              </select>
              {!turmas.length && (
                <small className="texto-suave">
                  {erroTurmas
                    ? 'Não foi possível carregar as turmas. Atualize a página ou tente novamente mais tarde.'
                    : 'Nenhuma turma cadastrada no momento. Peça à gestão para cadastrar uma turma.'}
                </small>
              )}
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
            {!googleCadastro && (
              <>
                <label>
                  Crie sua senha
                  <input type="password" autoComplete="new-password" minLength={8} maxLength={128} value={senha} onChange={(e) => setSenha(e.target.value)} required />
                </label>
                <label>
                  Confirme sua senha
                  <input type="password" autoComplete="new-password" minLength={8} maxLength={128} value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} required />
                </label>
              </>
            )}
            <button className="btn btn-primario btn-grande" disabled={enviando || !turmas.length}>
              {enviando
                ? 'Criando conta...'
                : (googleCadastro ? 'Concluir cadastro com Google' : 'Criar conta de aluno')}
            </button>
          </form>
        )}

        {concluido && <Link className="btn btn-primario btn-grande" to="/login">Ir para o login</Link>}
        {!concluido && <Link className="link-btn centro" to="/login">Voltar para o login</Link>}
      </section>
    </main>
  );
}
