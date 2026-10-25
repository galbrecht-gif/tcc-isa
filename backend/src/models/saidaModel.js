const db = require('../config/database');
const { aplicarEscopo } = require('./escopo');

const COLUNAS = [
  's.id',
  's.aluno_id',
  's.motivo',
  's.horario_previsto',
  's.fluxo_menor',
  's.status',
  's.responsavel_status',
  's.responsavel_decisao_em',
  's.gestor_status',
  's.gestor_justificativa',
  's.gestor_decisao_em',
  's.professor_ciente',
  's.professor_ciente_em',
  's.horario_saida_real',
  's.criado_em',
  's.atualizado_em',
  'a.nome as aluno_nome',
  'a.turma_id',
  't.nome as turma_nome',
  't.curso as curso',
];

function base() {
  return db('saidas_antecipadas as s')
    .join('usuarios as a', 'a.id', 's.aluno_id')
    .leftJoin('turmas as t', 't.id', 'a.turma_id')
    .select(COLUNAS, db.raw('(s.assinatura IS NOT NULL) as tem_assinatura'));
}

const normalizar = (r) =>
  r && {
    ...r,
    fluxo_menor: Boolean(r.fluxo_menor),
    professor_ciente: Boolean(r.professor_ciente),
    tem_assinatura: Boolean(r.tem_assinatura),
  };

async function listar(user, { status, turmaId, de, ate } = {}) {
  const q = aplicarEscopo(base(), user, 's', { portariaStatus: ['AGUARDANDO_PORTARIA', 'LIBERADO'] });
  if (status) q.where('s.status', status);
  if (turmaId) q.where('a.turma_id', turmaId);
  if (de) q.where('s.criado_em', '>=', de);
  if (ate) q.where('s.criado_em', '<=', ate);
  const rows = await q.orderBy('s.id', 'desc').limit(500);
  return rows.map(normalizar);
}

async function buscar(user, id) {
  const q = aplicarEscopo(base(), user, 's', { portariaStatus: ['AGUARDANDO_PORTARIA', 'LIBERADO'] }).where('s.id', id);
  return normalizar(await q.first());
}

const buscarBruto = (id, trx = db) => trx('saidas_antecipadas').where({ id }).first();

const assinatura = (id) => db('saidas_antecipadas').where({ id }).select('assinatura').first();

module.exports = { listar, buscar, buscarBruto, assinatura };
