const db = require('../config/database');
const Usuario = require('../models/usuarioModel');
const { aplicarEscopo } = require('../models/escopo');

// Pesquisa de alunos (por nome, curso ou turma) para portaria, gestor e professor (somente suas turmas).
exports.buscar = async (req, res) => {
  const { busca, curso, turma_id: turmaId } = req.query;
  const q = db('usuarios as a')
    .leftJoin('turmas as t', 't.id', 'a.turma_id')
    .where({ 'a.role': 'aluno', 'a.ativo': true })
    .select('a.id', 'a.nome', 'a.data_nascimento', 'a.turma_id', 't.nome as turma_nome', 't.curso')
    .orderBy('a.nome')
    .limit(100);
  if (req.user.role === 'professor') aplicarEscopo(q, req.user, 'a');
  if (busca) q.whereLike('a.nome', `%${busca}%`);
  if (curso) q.whereLike('t.curso', `%${curso}%`);
  if (turmaId) q.where('a.turma_id', Number(turmaId));
  const rows = await q;
  res.json(rows.map((r) => ({ ...Usuario.publico({ ...r, role: 'aluno' }), data_nascimento: undefined })));
};

exports.turmas = async (req, res) => {
  res.json(await db('turmas').select('id', 'nome', 'curso').orderBy('nome'));
};
