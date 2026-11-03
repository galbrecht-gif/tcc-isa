const db = require('../config/database');
const HttpError = require('../services/HttpError');

exports.listar = async (req, res) => {
  const query = db('turmas as t')
    .leftJoin('usuarios as p', 'p.id', 't.professor_id')
    .select('t.id', 't.nome', 't.curso', 't.professor_id', 'p.nome as professor_nome')
    .orderBy('t.curso')
    .orderBy('t.nome');
  if (req.user.role === 'professor') query.where('t.professor_id', req.user.id);

  const turmas = await query;
  const ids = turmas.map((turma) => turma.id);
  const contagens = ids.length
    ? await db('usuarios')
        .where({ role: 'aluno', ativo: true })
        .whereIn('turma_id', ids)
        .groupBy('turma_id')
        .select('turma_id')
        .count({ total: 'id' })
    : [];
  const alunosPorTurma = new Map(contagens.map((contagem) => [contagem.turma_id, Number(contagem.total)]));
  res.json(turmas.map((turma) => ({ ...turma, alunos_count: alunosPorTurma.get(turma.id) || 0 })));
};

exports.alunos = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) throw new HttpError(400, 'Turma invalida.');
  const turma = await db('turmas').where({ id }).first();
  if (!turma) throw new HttpError(404, 'Turma nao encontrada.');
  if (req.user.role === 'professor' && turma.professor_id !== req.user.id) {
    throw new HttpError(403, 'Acesso negado a esta turma.');
  }
  const alunos = await db('usuarios')
    .where({ role: 'aluno', ativo: true, turma_id: id })
    .select('id', 'nome')
    .orderBy('nome');
  res.json(alunos);
};

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

exports.definirProfessor = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) throw new HttpError(400, 'Turma invalida.');
  const turma = await db('turmas').where({ id }).first();
  if (!turma) throw new HttpError(404, 'Turma nao encontrada.');

  const valorProfessor = req.body?.professor_id;
  const professorId = valorProfessor === null || valorProfessor === '' ? null : Number(valorProfessor);
  if (professorId !== null) {
    if (!Number.isInteger(professorId) || professorId < 1) throw new HttpError(400, 'Professor invalido.');
    const professor = await db('usuarios').where({ id: professorId, role: 'professor', ativo: true }).first();
    if (!professor) throw new HttpError(400, 'Selecione um professor ativo.');
  }

  await db('turmas').where({ id }).update({ professor_id: professorId });
  const depois = { ...turma, professor_id: professorId };
  res.locals.audit = { acao: 'TURMA_PROFESSOR_ATUALIZADO', antes: { professor_id: turma.professor_id }, depois };
  res.json(depois);
};
