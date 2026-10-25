const db = require('../config/database');
const { agoraISO, calcularIdade } = require('../services/dateService');

const ROLES = ['aluno', 'professor', 'gestor', 'portaria', 'responsavel'];

const COLUNAS = ['id', 'nome', 'email', 'role', 'ativo', 'data_nascimento', 'turma_id', 'criado_em'];

const normalizarEmail = (email) => String(email || '').trim().toLowerCase();

function publico(u) {
  if (!u) return null;
  const out = { ...u, ativo: Boolean(u.ativo) };
  if (u.role === 'aluno' && u.data_nascimento) {
    out.idade = calcularIdade(u.data_nascimento);
    out.maior_idade = out.idade >= 18;
  }
  return out;
}

const buscarPorEmail = (email) => db('usuarios').whereRaw('lower(email) = ?', [normalizarEmail(email)]).first();
const buscarPorId = (id, trx = db) => trx('usuarios').where({ id }).first();

async function listar({ role, busca, ativo, turmaId } = {}) {
  const q = db('usuarios as u')
    .leftJoin('turmas as t', 't.id', 'u.turma_id')
    .select(COLUNAS.map((c) => `u.${c}`), 't.nome as turma_nome')
    .orderBy('u.nome');
  if (role) q.where('u.role', role);
  if (turmaId) q.where('u.turma_id', turmaId);
  if (ativo === 'true' || ativo === 'false') q.where('u.ativo', ativo === 'true');
  if (busca) q.where((b) => b.whereLike('u.nome', `%${busca}%`).orWhereLike('u.email', `%${busca}%`));
  const rows = await q;
  const ids = rows.map((r) => r.id);

  const vinculos = ids.length
    ? await db('aluno_responsavel as ar')
        .join('usuarios as r', 'r.id', 'ar.responsavel_id')
        .whereIn('ar.aluno_id', ids)
        .select('ar.aluno_id', 'r.id', 'r.nome', 'r.email')
    : [];
  const turmasProf = await db('turmas').whereIn('professor_id', ids.length ? ids : [0]).select('id', 'professor_id');

  return rows.map((r) => ({
    ...publico(r),
    responsaveis: vinculos.filter((v) => v.aluno_id === r.id).map(({ id, nome, email }) => ({ id, nome, email })),
    turma_ids: turmasProf.filter((t) => t.professor_id === r.id).map((t) => t.id),
  }));
}

async function detalhar(id) {
  const lista = await listar({});
  const u = lista.find((x) => x.id === Number(id));
  if (!u) return null;
  if (u.role === 'responsavel') {
    u.dependentes = await db('aluno_responsavel as ar')
      .join('usuarios as a', 'a.id', 'ar.aluno_id')
      .where('ar.responsavel_id', id)
      .select('a.id', 'a.nome');
  }
  return u;
}

async function sincronizarResponsaveis(trx, alunoId, responsaveis = []) {
  const agora = agoraISO();
  const idsFinais = [];
  for (const r of responsaveis) {
    const email = normalizarEmail(r.email);
    let existente = await trx('usuarios').whereRaw('lower(email) = ?', [email]).first();
    if (existente && existente.role !== 'responsavel') {
      const err = new Error(`O e-mail ${email} ja pertence a um usuario com outro perfil.`);
      err.status = 409;
      throw err;
    }
    if (!existente) {
      const [id] = await trx('usuarios').insert({
        nome: r.nome.trim(),
        email,
        role: 'responsavel',
        ativo: true,
        criado_em: agora,
        atualizado_em: agora,
      });
      existente = { id: typeof id === 'object' ? id.id : id };
    } else if (r.nome && r.nome.trim() !== existente.nome) {
      await trx('usuarios').where({ id: existente.id }).update({ nome: r.nome.trim(), atualizado_em: agora });
    }
    idsFinais.push(existente.id);
  }
  await trx('aluno_responsavel').where({ aluno_id: alunoId }).whereNotIn('responsavel_id', idsFinais.length ? idsFinais : [0]).del();
  for (const rid of idsFinais) {
    const ja = await trx('aluno_responsavel').where({ aluno_id: alunoId, responsavel_id: rid }).first();
    if (!ja) await trx('aluno_responsavel').insert({ aluno_id: alunoId, responsavel_id: rid });
  }
}

async function sincronizarTurmasProfessor(trx, professorId, turmaIds = []) {
  await trx('turmas').where({ professor_id: professorId }).whereNotIn('id', turmaIds.length ? turmaIds : [0]).update({ professor_id: null });
  if (turmaIds.length) await trx('turmas').whereIn('id', turmaIds).update({ professor_id: professorId });
}

async function criar(dados) {
  return db.transaction(async (trx) => {
    const agora = agoraISO();
    const [ins] = await trx('usuarios').insert({
      nome: dados.nome,
      email: dados.email,
      role: dados.role,
      ativo: dados.ativo !== false,
      data_nascimento: dados.role === 'aluno' ? dados.data_nascimento : null,
      turma_id: dados.role === 'aluno' ? dados.turma_id : null,
      criado_em: agora,
      atualizado_em: agora,
    });
    const id = typeof ins === 'object' ? ins.id : ins;
    if (dados.role === 'aluno') await sincronizarResponsaveis(trx, id, dados.responsaveis);
    if (dados.role === 'professor') await sincronizarTurmasProfessor(trx, id, dados.turma_ids);
    return id;
  });
}

async function atualizar(id, dados) {
  return db.transaction(async (trx) => {
    const patch = { atualizado_em: agoraISO() };
    ['nome', 'email', 'role', 'ativo'].forEach((c) => {
      if (dados[c] !== undefined) patch[c] = dados[c];
    });
    patch.data_nascimento = dados.role === 'aluno' ? dados.data_nascimento : null;
    patch.turma_id = dados.role === 'aluno' ? dados.turma_id : null;
    await trx('usuarios').where({ id }).update(patch);
    if (dados.role === 'aluno') await sincronizarResponsaveis(trx, id, dados.responsaveis || []);
    else await trx('aluno_responsavel').where({ aluno_id: id }).del();
    if (dados.role === 'professor') await sincronizarTurmasProfessor(trx, id, dados.turma_ids || []);
    else await trx('turmas').where({ professor_id: id }).update({ professor_id: null });
  });
}

const definirAtivo = (id, ativo) => db('usuarios').where({ id }).update({ ativo, atualizado_em: agoraISO() });

module.exports = {
  ROLES,
  normalizarEmail,
  publico,
  buscarPorEmail,
  buscarPorId,
  listar,
  detalhar,
  criar,
  atualizar,
  definirAtivo,
};
