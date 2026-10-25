import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { LogIn, ShieldCheck, GraduationCap, UserRound, Briefcase, DoorOpen, Users } from 'lucide-react';
import api, { mensagemErro } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const ERROS = {
  nao_autorizado: 'Este e-mail Google não está cadastrado ou a conta está desativada.',
  google_indisponivel: 'Login Google não configurado neste ambiente.',
};

export default function Login() {
  const { user, home, loading, loginDemo } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const [config, setConfig] = useState(null);
  const [demoUsuarios, setDemoUsuarios] = useState([]);
  const [alunoId, setAlunoId] = useState('');

  useEffect(() => {
    api.get('/auth/config').then(async ({ data }) => {
      setConfig(data);
      if (data.demoMode) {
        const { data: lista } = await api.get('/auth/demo/usuarios');
        setDemoUsuarios(lista);
        setAlunoId(String(lista.find((u) => u.role === 'aluno')?.id || ''));
      }
    });
  }, []);

  useEffect(() => {
    const erro = params.get('erro');
    if (erro) toast.erro(ERROS[erro] || 'Falha na autenticação.');
  }, [params, toast]);

  if (!loading && user) return <Navigate to={home} replace />;

  const entrar = async (role, id) => {
    try {
      navigate(await loginDemo(role, id));
    } catch (e) {
      toast.erro(mensagemErro(e));
    }
  };

  const alunos = demoUsuarios.filter((u) => u.role === 'aluno');

  return (
    <div className="login-tela">
      <div className="login-lado">
        <ShieldCheck size={56} />
        <h1>Controle de Frequência</h1>
        <p>Entrada atrasada e saída antecipada com autorização digital.</p>
      </div>
      <div className="login-caixa">
        <h2>Acesso ao sistema</h2>
        <p className="texto-suave">Entre com a conta Google cadastrada pela instituição. O perfil é definido pelo sistema.</p>
        <a className="btn btn-primario btn-grande" href="/api/auth/google">
          <LogIn size={18} /> Entrar com Google
        </a>
        <Link className="link-btn centro" to="/responsavel/validar">
          Sou responsável e recebi um código
        </Link>

        {config?.demoMode && (
          <div className="demo-bloco">
            <h3>Modo demonstração</h3>
            <div className="demo-botoes">
              <div className="demo-aluno">
                <button className="btn btn-secundario" onClick={() => entrar('aluno', alunoId)} disabled={!alunoId}>
                  <GraduationCap size={16} /> Entrar como Aluno
                </button>
                <select value={alunoId} onChange={(e) => setAlunoId(e.target.value)} aria-label="Aluno da demonstração">
                  {alunos.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nome} ({a.maior_idade ? 'maior' : 'menor'} de idade)
                    </option>
                  ))}
                </select>
              </div>
              <button className="btn btn-secundario" onClick={() => entrar('professor')}>
                <Briefcase size={16} /> Entrar como Professor
              </button>
              <button className="btn btn-secundario" onClick={() => entrar('gestor')}>
                <UserRound size={16} /> Entrar como Gestor
              </button>
              <button className="btn btn-secundario" onClick={() => entrar('portaria')}>
                <DoorOpen size={16} /> Entrar como Portaria
              </button>
              <Link className="btn btn-secundario" to="/responsavel/validar">
                <Users size={16} /> Acesso Responsável (Simulação)
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
