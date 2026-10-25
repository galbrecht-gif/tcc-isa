import DataTable from './DataTable';
import StatusBadge from './StatusBadge';
import { fmtDataHora } from '../utils/format';

export default function EntradasTable({ entradas, mostrarAluno = true, acoes }) {
  const turmas = [...new Set(entradas.map((e) => e.turma_nome).filter(Boolean))];

  const columns = [
    ...(mostrarAluno ? [{ key: 'aluno_nome', label: 'Aluno' }, { key: 'turma_nome', label: 'Turma' }] : []),
    { key: 'horario_efetivo', label: 'Entrada', render: (e) => fmtDataHora(e.horario_efetivo) },
    { key: 'motivo', label: 'Motivo' },
    {
      key: 'horario_alterado_log',
      label: 'Observação',
      render: (e) => e.horario_alterado_log || '-',
    },
    { key: 'registrado_por_nome', label: 'Registrado por' },
    {
      key: 'professor_ciente',
      label: 'Professor',
      sortValue: (e) => (e.professor_ciente ? 1 : 0),
      render: (e) => <StatusBadge status={e.professor_ciente ? 'CIENTE' : 'AGUARDANDO_CIENCIA'} />,
    },
    ...(acoes ? [{ key: 'acoes', label: 'Ações', render: acoes }] : []),
  ];

  const filtros = mostrarAluno ? [{ key: 'turma_nome', label: 'Turma', opcoes: turmas.map((t) => ({ valor: t, rotulo: t })) }] : [];

  return <DataTable columns={columns} rows={entradas} filtros={filtros} dataKey="horario_efetivo" vazio="Nenhuma entrada atrasada registrada." />;
}
