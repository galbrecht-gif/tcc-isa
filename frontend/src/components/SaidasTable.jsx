import DataTable from './DataTable';
import StatusBadge from './StatusBadge';
import { fmtDataHora, ROTULOS } from '../utils/format';

const STATUS = ['AGUARDANDO_RESPONSAVEL', 'AGUARDANDO_GESTOR', 'AGUARDANDO_PORTARIA', 'LIBERADO', 'RECUSADO', 'CANCELADO'];

// Status consolidado do professor: ciente apenas apos a aprovacao do gestor.
export const statusProfessor = (s) => (s.professor_ciente ? 'CIENTE' : s.gestor_status === 'APROVADO' ? 'AGUARDANDO_CIENCIA' : 'PENDENTE');

export default function SaidasTable({ saidas, mostrarAluno = true, consolidado = false, acoes }) {
  const turmas = [...new Map(saidas.filter((s) => s.turma_nome).map((s) => [s.turma_nome, s.turma_nome])).keys()];

  const columns = [
    { key: 'id', label: 'Protocolo' },
    ...(mostrarAluno ? [{ key: 'aluno_nome', label: 'Aluno' }, { key: 'turma_nome', label: 'Turma' }] : []),
    { key: 'criado_em', label: 'Solicitada em', render: (s) => fmtDataHora(s.criado_em) },
    { key: 'horario_previsto', label: 'Saída prevista', render: (s) => fmtDataHora(s.horario_previsto) },
    { key: 'motivo', label: 'Motivo' },
    consolidado
      ? {
          key: 'status_consolidado',
          label: 'Situação',
          texto: (s) => `${ROTULOS[s.responsavel_status]} ${ROTULOS[s.gestor_status]}`,
          sortValue: (s) => s.gestor_status,
          render: (s) => (
            <div className="badges-col">
              {s.fluxo_menor ? <StatusBadge status={s.responsavel_status} prefixo="Responsável" /> : <span className="badge badge-cinza">Maior de idade</span>}
              <StatusBadge status={s.gestor_status} prefixo="Gestor" />
              <StatusBadge status={statusProfessor(s)} prefixo="Professor" />
            </div>
          ),
        }
      : { key: 'status', label: 'Status', render: (s) => <StatusBadge status={s.status} /> },
    { key: 'horario_saida_real', label: 'Saída real', render: (s) => fmtDataHora(s.horario_saida_real) },
    ...(acoes ? [{ key: 'acoes', label: 'Ações', render: acoes }] : []),
  ];

  const filtros = [{ key: 'status', label: 'Status', opcoes: STATUS.map((v) => ({ valor: v, rotulo: ROTULOS[v] })) }];
  if (mostrarAluno) filtros.push({ key: 'turma_nome', label: 'Turma', opcoes: turmas.map((t) => ({ valor: t, rotulo: t })) });

  return <DataTable columns={columns} rows={saidas} filtros={filtros} dataKey="criado_em" vazio="Nenhuma solicitação de saída." />;
}
