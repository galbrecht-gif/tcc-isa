const db = require('../config/database');
const { agoraISO } = require('./dateService');

async function notificar(usuarioIds, { titulo, mensagem, link }) {
  const ids = [...new Set(usuarioIds.filter(Boolean))];
  if (!ids.length) return;
  const agora = agoraISO();
  await db('notificacoes').insert(
    ids.map((id) => ({ usuario_id: id, titulo, mensagem, link: link || null, lida: false, criado_em: agora }))
  );
}

async function idsPorRole(role) {
  const rows = await db('usuarios').where({ role, ativo: true }).select('id');
  return rows.map((r) => r.id);
}

async function idProfessorDaTurma(turmaId) {
  if (!turmaId) return [];
  const t = await db('turmas').where({ id: turmaId }).first();
  if (!t || !t.professor_id) return [];
  const p = await db('usuarios').where({ id: t.professor_id, ativo: true }).first();
  return p ? [p.id] : [];
}

module.exports = { notificar, idsPorRole, idProfessorDaTurma };
