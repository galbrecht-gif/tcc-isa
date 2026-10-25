import { ROTULOS } from '../utils/format';

const COR = {
  LIBERADO: 'verde',
  APROVADO: 'verde',
  AUTORIZADO: 'verde',
  CIENTE: 'verde',
  AGUARDANDO_RESPONSAVEL: 'amarelo',
  AGUARDANDO_GESTOR: 'amarelo',
  AGUARDANDO_PORTARIA: 'amarelo',
  AGUARDANDO_CIENCIA: 'amarelo',
  PENDENTE: 'amarelo',
  RECUSADO: 'vermelho',
  NAO_AUTORIZADO: 'vermelho',
  CANCELADO: 'vermelho',
  IRA_BUSCAR: 'azul',
  NAO_SE_APLICA: 'cinza',
};

export default function StatusBadge({ status, prefixo }) {
  if (!status) return null;
  return (
    <span className={`badge badge-${COR[status] || 'cinza'}`}>
      {prefixo ? `${prefixo}: ` : ''}
      {ROTULOS[status] || status}
    </span>
  );
}
