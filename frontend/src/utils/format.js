const TZ = 'America/Sao_Paulo';

export const fmtDataHora = (iso) =>
  iso
    ? new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso))
    : '-';

export const fmtHora = (d) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, timeStyle: 'short' }).format(d);

export const paraYMD = (iso) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(iso));

// Valor para <input type="datetime-local"> no fuso America/Sao_Paulo.
export function agoraInputLocal(offsetMinutos = 0) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(Date.now() + offsetMinutos * 60000));
  const p = Object.fromEntries(partes.map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

export const ROTULOS = {
  AGUARDANDO_RESPONSAVEL: 'Aguardando responsável',
  AGUARDANDO_GESTOR: 'Aguardando gestor',
  AGUARDANDO_PORTARIA: 'Aguardando portaria',
  LIBERADO: 'Liberado',
  RECUSADO: 'Recusado',
  CANCELADO: 'Cancelado',
  PENDENTE: 'Pendente',
  AUTORIZADO: 'Autorizado',
  IRA_BUSCAR: 'Irá buscar',
  NAO_AUTORIZADO: 'Não autorizado',
  NAO_SE_APLICA: 'Não se aplica',
  APROVADO: 'Aprovado',
  CIENTE: 'Ciente',
  AGUARDANDO_CIENCIA: 'Aguardando ciência',
};

export const ROLES = {
  aluno: 'Aluno',
  professor: 'Professor',
  gestor: 'Gestor',
  portaria: 'Portaria',
  responsavel: 'Responsável',
};
