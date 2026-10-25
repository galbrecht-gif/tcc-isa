import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import AuthCallback from './pages/AuthCallback';
import ResponsavelValidar from './pages/ResponsavelValidar';
import AlunoSolicitacoes from './pages/AlunoSolicitacoes';
import AlunoNova from './pages/AlunoNova';
import ProfessorPainel from './pages/ProfessorPainel';
import PortariaSaidas from './pages/PortariaSaidas';
import PortariaEntrada from './pages/PortariaEntrada';
import PortariaHistorico from './pages/PortariaHistorico';
import GestorSolicitacoes from './pages/GestorSolicitacoes';
import GestorEntradas from './pages/GestorEntradas';
import GestorUsuarios from './pages/GestorUsuarios';
import GestorLogs from './pages/GestorLogs';
import ResponsavelPainel from './pages/ResponsavelPainel';

function Raiz() {
  const { user, home, loading } = useAuth();
  if (loading) return <div className="carregando-tela">Carregando...</div>;
  return <Navigate to={user ? home : '/login'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Raiz />} />
      <Route path="/login" element={<Login />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/responsavel/validar" element={<ResponsavelValidar />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route element={<ProtectedRoute roles={['aluno']} />}>
            <Route path="/aluno" element={<AlunoSolicitacoes />} />
            <Route path="/aluno/nova" element={<AlunoNova />} />
          </Route>
          <Route element={<ProtectedRoute roles={['professor']} />}>
            <Route path="/professor" element={<ProfessorPainel />} />
          </Route>
          <Route element={<ProtectedRoute roles={['portaria']} />}>
            <Route path="/portaria" element={<PortariaSaidas />} />
            <Route path="/portaria/entrada" element={<PortariaEntrada />} />
            <Route path="/portaria/historico" element={<PortariaHistorico />} />
          </Route>
          <Route element={<ProtectedRoute roles={['gestor']} />}>
            <Route path="/gestor" element={<GestorSolicitacoes />} />
            <Route path="/gestor/entradas" element={<GestorEntradas />} />
            <Route path="/gestor/usuarios" element={<GestorUsuarios />} />
            <Route path="/gestor/logs" element={<GestorLogs />} />
          </Route>
          <Route element={<ProtectedRoute roles={['responsavel']} />}>
            <Route path="/responsavel" element={<ResponsavelPainel />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Raiz />} />
    </Routes>
  );
}
