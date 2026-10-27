import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Menu,
  LogOut,
  ClipboardList,
  PlusCircle,
  DoorOpen,
  History,
  UserCog,
  ScrollText,
  LayoutDashboard,
  LogIn,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { mensagemErro } from '../services/api';
import { ROLES } from '../utils/format';
import NotificationBell from './NotificationBell';
import Marca from './Marca';
import { ConfirmModal } from './Modal';

const NAV = {
  aluno: [
    { to: '/aluno', label: 'Minhas solicitações', icon: ClipboardList, end: true },
    { to: '/aluno/nova', label: 'Nova saída antecipada', icon: PlusCircle },
  ],
  professor: [{ to: '/professor', label: 'Painel da turma', icon: LayoutDashboard, end: true }],
  portaria: [
    { to: '/portaria', label: 'Liberar saídas', icon: DoorOpen, end: true },
    { to: '/portaria/entrada', label: 'Registrar entrada', icon: LogIn },
    { to: '/portaria/historico', label: 'Histórico de entradas', icon: History },
  ],
  gestor: [
    { to: '/gestor', label: 'Solicitações de saída', icon: ClipboardList, end: true },
    { to: '/gestor/entradas', label: 'Entradas atrasadas', icon: History },
    { to: '/gestor/usuarios', label: 'Gerenciar Usuários', icon: UserCog },
    { to: '/gestor/logs', label: 'Auditoria', icon: ScrollText },
  ],
  responsavel: [{ to: '/responsavel', label: 'Solicitações dos dependentes', icon: ClipboardList, end: true }],
};

export default function Layout() {
  const { user, logout, demoMode, demoUsuarios, loginDemo, resetarDemo } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [aberta, setAberta] = useState(true);
  const [mobile, setMobile] = useState(false);
  const [confirmarReset, setConfirmarReset] = useState(false);
  const [resetando, setResetando] = useState(false);

  const sair = async () => {
    await logout();
    navigate('/login');
  };

  const trocarPerfil = async (e) => {
    const alvo = demoUsuarios.find((u) => String(u.id) === e.target.value);
    if (!alvo || alvo.id === user.id) return;
    try {
      navigate(await loginDemo(alvo.role, alvo.id));
    } catch (err) {
      toast.erro(mensagemErro(err));
    }
  };

  const restaurar = async () => {
    setResetando(true);
    try {
      navigate(await resetarDemo());
      toast.sucesso('Dados de demonstração restaurados.');
    } catch (err) {
      toast.erro(mensagemErro(err));
    } finally {
      setResetando(false);
      setConfirmarReset(false);
    }
  };

  const perfisDemo = ['gestor', 'professor', 'portaria', 'aluno'].map((role) => ({
    role,
    usuarios: demoUsuarios.filter((u) => u.role === role),
  }));

  return (
    <div className={`app ${aberta ? '' : 'sidebar-recolhida'} ${mobile ? 'sidebar-mobile-aberta' : ''}`}>
      <aside className="sidebar">
        <Marca claro subtitulo="Controle de Frequência" />
        <nav>
          {NAV[user.role].map(({ to, label, icon: Icone, end }) => (
            <NavLink key={to} to={to} end={end} className="nav-item" title={label} onClick={() => setMobile(false)}>
              <Icone size={20} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <button className="nav-item nav-sair" onClick={sair} title="Sair">
          <LogOut size={20} />
          <span>Sair</span>
        </button>
      </aside>
      {mobile && <div className="sidebar-fundo" onClick={() => setMobile(false)} />}
      <div className="conteudo">
        <header className="topo">
          <button
            className="icon-btn"
            onClick={() => (window.innerWidth < 900 ? setMobile((m) => !m) : setAberta((a) => !a))}
            aria-label="Alternar menu"
          >
            <Menu size={22} />
          </button>
          <div className="topo-direita">
            {demoMode && (
              <div className="demo-topo">
                <Sparkles size={16} />
                <select value={user.id} onChange={trocarPerfil} aria-label="Trocar perfil (demonstração)">
                  {!demoUsuarios.some((u) => u.id === user.id) && (
                    <option value={user.id} hidden>
                      {user.nome}
                    </option>
                  )}
                  {perfisDemo.map(({ role, usuarios }) =>
                    usuarios.length ? (
                      <optgroup key={role} label={ROLES[role]}>
                        {usuarios.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.nome}
                          </option>
                        ))}
                      </optgroup>
                    ) : null
                  )}
                </select>
                {user.role === 'gestor' && (
                  <button className="icon-btn" title="Restaurar dados de demonstração" onClick={() => setConfirmarReset(true)}>
                    <RotateCcw size={18} />
                  </button>
                )}
              </div>
            )}
            <NotificationBell />
            <div className="usuario-info">
              <strong>{user.nome}</strong>
              <small>{ROLES[user.role]}</small>
            </div>
          </div>
        </header>
        <main className="pagina">
          <Outlet />
        </main>
      </div>
      {confirmarReset && (
        <ConfirmModal
          titulo="Restaurar dados de demonstração"
          mensagem="Todas as solicitações, entradas, notificações e alterações de usuários serão apagadas e os dados de exemplo serão recriados."
          confirmar="Restaurar"
          perigo
          carregando={resetando}
          onConfirm={restaurar}
          onClose={() => setConfirmarReset(false)}
        />
      )}
    </div>
  );
}
