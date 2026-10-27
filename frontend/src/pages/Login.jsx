import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { LogIn, GraduationCap, UserRound, Briefcase, DoorOpen, Users, AlertTriangle, Sparkles, ShieldCheck, Clock, Smartphone } from 'lucide-react';
import { mensagemErro } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Marca from '../components/Marca';

const ERROS = {
  nao_autorizado: 'Este e-mail Google não está cadastrado ou a conta está desativada.',
  google_indisponivel: 'Login Google não configurado neste ambiente.',
};

const PERFIS = [
  { role: 'gestor', rotulo: 'Gestor', desc: 'Aprova saídas e gerencia usuários', icone: UserRound },
  { role: 'professor', rotulo: 'Professor', desc: 'Acompanha a turma e dá ciência', icone: Briefcase },
  { role: 'portaria', rotulo: 'Portaria', desc: 'Registra entradas e libera saídas', icone: DoorOpen },
];

export default function Login() {
  const { user, home, loading, loginDemo, demoMode, demoUsuarios, config } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const [alunoEscolhido, setAlunoEscolhido] = useState('');

  if (!loading && user) return <Navigate to={home} replace />;

  const alunos = (demoUsuarios || []).filter((u) => u.role === 'aluno');
  const alunoId = alunoEscolhido || String(alunos[0]?.id || '');
  const erro = ERROS[params.get('erro')] || (params.get('erro') ? 'Falha na autenticação.' : null);

  const entrar = async (role, id) => {
    try {
      navigate(await loginDemo(role, id));
    } catch (e) {
      toast.erro(mensagemErro(e));
    }
  };

  return (
    <div className="login-tela">
      <div className="login-lado">
        <Marca claro subtitulo="Controle de Frequência" />
        <div className="login-hero">
          <h1>Entrada atrasada e saída antecipada, sem papel.</h1>
          <p>Autorização digital com validação do responsável, aprovação da gestão e liberação na portaria, tudo registrado em tempo real.</p>
          <ul className="login-beneficios">
            <li>
              <ShieldCheck size={20} /> Código de uso único para o responsável
            </li>
            <li>
              <Clock size={20} /> Horários registrados em Brasília, com auditoria
            </li>
            <li>
              <Smartphone size={20} /> Funciona no computador e no celular
            </li>
          </ul>
        </div>
        <small className="login-rodape">SENAI · Sistema de Controle Digital</small>
      </div>

      <div className="login-caixa">
        <div className="login-conteudo">
          <h2>Acesso ao sistema</h2>
          <p className="texto-suave">Entre com a conta Google cadastrada pela instituição. O perfil é definido pelo sistema.</p>

          {erro && (
            <div className="alerta-erro" role="alert">
              <AlertTriangle size={18} />
              <div>
                <strong>{erro}</strong>
                {demoMode && <span>Para testar agora, use o modo demonstração abaixo.</span>}
              </div>
            </div>
          )}

          <a className="btn btn-primario btn-grande" href="/api/auth/google">
            <LogIn size={18} /> Entrar com Google
          </a>
          {config.googleEnabled === false && <small className="texto-suave">Google OAuth não configurado neste ambiente.</small>}
          <Link className="link-btn centro" to="/responsavel/validar">
            Sou responsável e recebi um código
          </Link>

          {demoMode && (
            <div className="demo-bloco">
              <div className="demo-titulo">
                <Sparkles size={16} /> <h3>Modo demonstração</h3>
              </div>
              <p className="texto-suave">Entre direto com um perfil. Você pode trocar de perfil a qualquer momento pelo topo do sistema.</p>

              <div className="demo-aluno">
                <label htmlFor="demo-aluno-sel">
                  <GraduationCap size={16} /> Aluno
                </label>
                <select id="demo-aluno-sel" value={alunoId} onChange={(e) => setAlunoEscolhido(e.target.value)}>
                  {alunos.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nome} ({a.maior_idade ? 'maior' : 'menor'} de idade)
                    </option>
                  ))}
                </select>
                <button className="btn btn-secundario" onClick={() => entrar('aluno', alunoId)} disabled={!alunoId}>
                  Entrar
                </button>
              </div>

              <div className="demo-perfis">
                {PERFIS.map(({ role, rotulo, desc, icone: Icone }) => (
                  <button key={role} className="perfil-card" onClick={() => entrar(role)}>
                    <Icone size={22} />
                    <strong>{rotulo}</strong>
                    <span>{desc}</span>
                  </button>
                ))}
                <Link className="perfil-card" to="/responsavel/validar">
                  <Users size={22} />
                  <strong>Responsável</strong>
                  <span>Valida o código recebido por e-mail</span>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
