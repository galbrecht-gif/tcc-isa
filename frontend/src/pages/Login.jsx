import { Navigate, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useState } from 'react';
import { GraduationCap, UserRound, Briefcase, DoorOpen, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Marca from '../components/Marca';
import { mensagemErro } from '../services/api';

const ERROS = {
  nao_autorizado: 'Conta não autorizada. Os perfis de equipe exigem um e-mail autorizado e ativo.',
  perfil_incorreto: 'Esta conta não tem acesso ao perfil escolhido.',
  perfil_invalido: 'Escolha um perfil para entrar.',
  google_indisponivel: 'Login Google não configurado neste ambiente.',
};

const PERFIS = [
  { role: 'aluno', rotulo: 'Aluno', desc: 'Solicita saídas e acompanha entradas', icone: GraduationCap },
  { role: 'gestor', rotulo: 'Gestor', desc: 'Aprova saídas e gerencia usuários', icone: UserRound },
  { role: 'professor', rotulo: 'Professor', desc: 'Acompanha a turma e dá ciência', icone: Briefcase },
  { role: 'portaria', rotulo: 'Portaria', desc: 'Registra entradas e libera saídas', icone: DoorOpen },
];

export default function Login() {
  const { user, home, loading, config, loginComSenha } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erroSenha, setErroSenha] = useState('');
  const [enviando, setEnviando] = useState(false);

  if (!loading && user) return <Navigate to={user.deve_trocar_senha ? '/alterar-senha' : home} replace />;

  const erro = ERROS[params.get('erro')] || (params.get('erro') ? 'Falha na autenticação.' : null);
  const entrar = async (e) => {
    e.preventDefault();
    setErroSenha('');
    setEnviando(true);
    try {
      const resultado = await loginComSenha(email, senha);
      navigate(resultado.usuario.deve_trocar_senha ? '/alterar-senha' : resultado.home, { replace: true });
    } catch (err) {
      setErroSenha(mensagemErro(err));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="login-tela">
      <header className="login-identidade">
        <Marca subtitulo="Controle de Frequência" />
      </header>
      <main className="login-caixa">
        <div className="login-conteudo">
          <header className="login-cabecalho">
            <span className="login-etiqueta">Área de acesso</span>
            <h2>Acesso ao sistema</h2>
            <p className="texto-suave">Entre com o e-mail e a senha associados à sua conta.</p>
          </header>

          {(erro || erroSenha) && (
            <div className="alerta-erro" role="alert">
              <AlertTriangle size={18} />
              <div>
                <strong>{erroSenha || erro}</strong>
              </div>
            </div>
          )}

          <section className="login-secao">
            <form className="form login-form" onSubmit={entrar}>
              <label>
                E-mail
                <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </label>
              <label>
                Senha
                <input type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
              </label>
              <button className="btn btn-primario btn-grande" disabled={enviando}>
                {enviando ? 'Entrando...' : 'Entrar'}
              </button>
            </form>
            <div className="login-links">
              <Link className="link-btn" to="/cadastro-aluno">Criar conta de aluno</Link>
              <Link className="link-btn" to="/senha-aluno">Definir ou recuperar senha</Link>
            </div>
          </section>

          <section className="login-secao login-google" aria-labelledby="login-google-titulo">
            <div className="login-secao-cabecalho">
              <h3 id="login-google-titulo">Entrar com Google</h3>
              <p className="texto-suave">Selecione o perfil para entrar com sua conta Google autorizada.</p>
            </div>
            <div className="demo-perfis">
              {PERFIS.map(({ role, rotulo, desc, icone: Icone }) => (
                <a key={role} className="perfil-card" href={`/api/auth/google?perfil=${role}`}>
                  <Icone size={20} aria-hidden="true" />
                  <span className="perfil-card-texto">
                    <strong>{rotulo}</strong>
                    <span>{desc}</span>
                  </span>
                </a>
              ))}
            </div>
            {config.googleEnabled === false && <small className="login-google-aviso">Login Google não configurado neste ambiente.</small>}
          </section>

          <div className="login-responsavel">
            <DoorOpen size={18} aria-hidden="true" />
            <span>Recebeu um código de responsável?</span>
            <Link to="/responsavel/validar">Validar código</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
