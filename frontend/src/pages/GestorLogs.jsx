import DataTable from '../components/DataTable';
import useApi from '../components/useApi';
import { fmtDataHora } from '../utils/format';

const resumo = (txt) => {
  if (!txt) return '-';
  return txt.length > 140 ? `${txt.slice(0, 140)}...` : txt;
};

export default function GestorLogs() {
  const logs = useApi('/logs', { limite: 300 });

  const columns = [
    { key: 'timestamp', label: 'Data/Hora', render: (l) => fmtDataHora(l.timestamp) },
    { key: 'usuario_nome', label: 'Usuário', render: (l) => l.usuario_nome || 'Sistema/público' },
    { key: 'acao', label: 'Ação' },
    { key: 'dados_anteriores', label: 'Dados anteriores', render: (l) => <code className="codigo">{resumo(l.dados_anteriores)}</code> },
    { key: 'dados_novos', label: 'Dados novos', render: (l) => <code className="codigo">{resumo(l.dados_novos)}</code> },
    { key: 'ip', label: 'IP' },
  ];

  return (
    <>
      <div className="pagina-topo">
        <h1>Auditoria</h1>
      </div>
      <section className="cartao">
        <DataTable columns={columns} rows={logs.data || []} dataKey="timestamp" vazio="Nenhum log registrado." />
      </section>
    </>
  );
}
