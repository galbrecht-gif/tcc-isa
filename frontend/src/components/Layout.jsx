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
  ShieldCheck,
  LogIn,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ROLES } from '../utils/format';
import NotificationBell from './NotificationBell';

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
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [aberta, setAberta] = useState(true);
  const [mobile, setMobile] = useState(false);

  const sair = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className={`app ${aberta ? '' : 'sidebar-recolhida'} ${mobile ? 'sidebar-mobile-aberta' : ''}`}>
      <aside className="sidebar">
        <div className="sidebar-marca">
          <ShieldCheck size={26} />
          <span>SENAI</span>
        </div>
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
    </div>
  );
}
