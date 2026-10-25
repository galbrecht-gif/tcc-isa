import useApi from '../components/useApi';
import EntradasTable from '../components/EntradasTable';

export default function PortariaHistorico() {
  const entradas = useApi('/entradas');
  return (
    <>
      <div className="pagina-topo">
        <h1>Histórico de entradas</h1>
      </div>
      <section className="cartao">
        <EntradasTable entradas={entradas.data || []} />
      </section>
    </>
  );
}
