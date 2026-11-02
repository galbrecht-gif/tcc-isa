import { Navigate, useSearchParams, Link } from 'react-router-dom';
import { GraduationCap, UserRound, Briefcase, DoorOpen, AlertTriangle, ShieldCheck, Clock, Smartphone } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Marca from '../components/Marca';

const ERROS = {
  nao_autorizado: 'Conta não autorizada. Alunos podem usar qualquer conta Google cadastrada; os demais perfis precisam do e-mail SENAI (@sp.senai.br ou @dp.senai.br) cadastrado e ativo.',
  perfil_incorreto: 'Esta conta não tem acesso ao perfil escolhido. Escolha o perfil correto.',
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
  const { user, home, loading, config } = useAuth();
  const [params] = useSearchParams();

  if (!loading && user) return <Navigate to={home} replace />;

  const erro = ERROS[params.get('erro')] || (params.get('erro') ? 'Falha na autenticação.' : null);

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
          <p className="texto-suave">Escolha como você vai entrar e continue com sua conta Google.</p>

          {erro && (
            <div className="alerta-erro" role="alert">
              <AlertTriangle size={18} />
              <div>
                <strong>{erro}</strong>
              </div>
            </div>
          )}

          <div className="demo-perfis">
            {PERFIS.map(({ role, rotulo, desc, icone: Icone }) => (
              <a key={role} className="perfil-card" href={`/api/auth/google?perfil=${role}`}>
                <Icone size={22} />
                <strong>Entrar como {rotulo}</strong>
                <span>{desc}</span>
              </a>
            ))}
          </div>
          {config.googleEnabled === false && <small className="texto-suave">Google OAuth não configurado neste ambiente.</small>}
          <Link className="link-btn centro" to="/responsavel/validar">
            Sou responsável e recebi um código
          </Link>
        </div>
      </div>
    </div>
  );
}
