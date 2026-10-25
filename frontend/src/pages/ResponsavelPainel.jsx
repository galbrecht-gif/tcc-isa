import { Link } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import useApi from '../components/useApi';
import SaidasTable from '../components/SaidasTable';

export default function ResponsavelPainel() {
  const saidas = useApi('/saidas');
  return (
    <>
      <div className="pagina-topo">
        <h1>Solicitações dos dependentes</h1>
        <Link to="/responsavel/validar" className="btn btn-primario">
          <KeyRound size={16} /> Validar código recebido
        </Link>
      </div>
      <section className="cartao">
        <SaidasTable saidas={saidas.data || []} consolidado />
      </section>
    </>
  );
}
