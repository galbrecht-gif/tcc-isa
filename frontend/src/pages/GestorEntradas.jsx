import useApi from '../components/useApi';
import EntradasTable from '../components/EntradasTable';

export default function GestorEntradas() {
  const entradas = useApi('/entradas');
  return (
    <>
      <div className="pagina-topo">
        <h1>Entradas atrasadas</h1>
      </div>
      <section className="cartao">
        <EntradasTable entradas={entradas.data || []} />
      </section>
    </>
  );
}
