const db = require('../config/database');
const HttpError = require('../services/HttpError');

exports.criar = async (req, res) => {
  const nome = String(req.body?.nome || '').trim();
  const curso = String(req.body?.curso || '').trim();
  if (nome.length < 2 || nome.length > 100) throw new HttpError(400, 'Informe o nome da turma (2 a 100 caracteres).');
  if (curso.length < 2 || curso.length > 150) throw new HttpError(400, 'Informe o nome do curso (2 a 150 caracteres).');

  const existente = await db('turmas')
    .whereRaw('lower(nome) = ?', [nome.toLowerCase()])
    .whereRaw('lower(curso) = ?', [curso.toLowerCase()])
    .first();
  if (existente) throw new HttpError(409, 'Já existe uma turma com esse nome e curso.');

  const [inserida] = await db('turmas').insert({ nome, curso }).returning('id');
  const id = typeof inserida === 'object' ? inserida.id : inserida;
  const turma = { id, nome, curso };
  res.locals.audit = { acao: 'TURMA_CRIADA', depois: turma };
  res.status(201).json(turma);
};
