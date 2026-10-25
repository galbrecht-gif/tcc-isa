const db = require('../config/database');
const { aplicarEscopo } = require('./escopo');

const COLUNAS = [
  'e.id',
  'e.aluno_id',
  'e.motivo',
  'e.horario_registro',
  'e.horario_efetivo',
  'e.horario_alterado_log',
  'e.professor_ciente',
  'e.professor_ciente_em',
  'e.criado_em',
  'a.nome as aluno_nome',
  'a.turma_id',
  't.nome as turma_nome',
  't.curso as curso',
  'p.nome as registrado_por_nome',
];

function base() {
  return db('entradas_atrasadas as e')
    .join('usuarios as a', 'a.id', 'e.aluno_id')
    .join('usuarios as p', 'p.id', 'e.registrado_por')
    .leftJoin('turmas as t', 't.id', 'a.turma_id')
    .select(COLUNAS);
}

const normalizar = (r) => r && { ...r, professor_ciente: Boolean(r.professor_ciente) };

// Responsaveis nao participam deste fluxo: nunca enxergam entradas atrasadas.
async function listar(user, { turmaId, de, ate } = {}) {
  if (user.role === 'responsavel') return [];
  const q = aplicarEscopo(base(), user, 'e');
  if (turmaId) q.where('a.turma_id', turmaId);
  if (de) q.where('e.criado_em', '>=', de);
  if (ate) q.where('e.criado_em', '<=', ate);
  return (await q.orderBy('e.id', 'desc').limit(500)).map(normalizar);
}

async function buscar(user, id) {
  if (user.role === 'responsavel') return null;
  return normalizar(await aplicarEscopo(base(), user, 'e').where('e.id', id).first());
}

const assinatura = (id) => db('entradas_atrasadas').where({ id }).select('assinatura').first();

module.exports = { listar, buscar, assinatura };
