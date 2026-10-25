const db = require('../config/database');
const Usuario = require('../models/usuarioModel');
const HttpError = require('../services/HttpError');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;

async function validar(body, idAtual) {
  const nome = String(body.nome || '').trim();
  const email = Usuario.normalizarEmail(body.email);
  const role = body.role;
  if (nome.length < 3 || nome.length > 150) throw new HttpError(400, 'Nome invalido.');
  if (!EMAIL_RE.test(email)) throw new HttpError(400, 'E-mail invalido.');
  if (!Usuario.ROLES.includes(role)) throw new HttpError(400, 'Perfil invalido.');

  const dup = await Usuario.buscarPorEmail(email);
  if (dup && dup.id !== idAtual) throw new HttpError(409, 'Ja existe um usuario com este e-mail.');

  const dados = { nome, email, role, ativo: body.ativo !== false };
  if (role === 'aluno') {
    if (!DATA_RE.test(body.data_nascimento || '') || Number.isNaN(Date.parse(body.data_nascimento))) {
      throw new HttpError(400, 'Data de nascimento invalida.');
    }
    if (body.data_nascimento > new Date().toISOString().slice(0, 10)) throw new HttpError(400, 'Data de nascimento no futuro.');
    const turma = await db('turmas').where({ id: Number(body.turma_id) }).first();
    if (!turma) throw new HttpError(400, 'Turma invalida.');
    dados.data_nascimento = body.data_nascimento;
    dados.turma_id = turma.id;
    const resp = Array.isArray(body.responsaveis) ? body.responsaveis : [];
    const emails = new Set();
    dados.responsaveis = resp.map((r) => {
      const e = Usuario.normalizarEmail(r.email);
      if (!EMAIL_RE.test(e) || String(r.nome || '').trim().length < 3) throw new HttpError(400, 'Responsavel com nome ou e-mail invalido.');
      if (e === email) throw new HttpError(400, 'O responsavel nao pode ter o mesmo e-mail do aluno.');
      if (emails.has(e)) throw new HttpError(400, 'Responsavel duplicado.');
      emails.add(e);
      return { nome: r.nome, email: e };
    });
  }
  if (role === 'professor') {
    const ids = (Array.isArray(body.turma_ids) ? body.turma_ids : []).map(Number).filter(Number.isInteger);
    dados.turma_ids = ids;
  }
  return dados;
}

exports.listar = async (req, res) => {
  const { role, busca, ativo, turma_id: turmaId } = req.query;
  res.json(await Usuario.listar({ role, busca, ativo, turmaId }));
};

exports.obter = async (req, res) => {
  const u = await Usuario.detalhar(Number(req.params.id));
  if (!u) throw new HttpError(404, 'Usuario nao encontrado.');
  res.json(u);
};

exports.criar = async (req, res) => {
  const dados = await validar(req.body || {});
  const id = await Usuario.criar(dados);
  const novo = await Usuario.detalhar(id);
  res.locals.audit = { acao: 'USUARIO_CRIADO', depois: novo };
  res.status(201).json(novo);
};

exports.atualizar = async (req, res) => {
  const id = Number(req.params.id);
  const antes = await Usuario.detalhar(id);
  if (!antes) throw new HttpError(404, 'Usuario nao encontrado.');
  const dados = await validar(req.body || {}, id);
  if (id === req.user.id && (dados.role !== 'gestor' || !dados.ativo)) {
    throw new HttpError(400, 'Voce nao pode alterar seu proprio perfil ou desativar a propria conta.');
  }
  await Usuario.atualizar(id, dados);
  const depois = await Usuario.detalhar(id);
  res.locals.audit = { acao: 'USUARIO_ATUALIZADO', antes, depois };
  res.json(depois);
};

exports.definirAtivo = async (req, res) => {
  const id = Number(req.params.id);
  const antes = await Usuario.detalhar(id);
  if (!antes) throw new HttpError(404, 'Usuario nao encontrado.');
  if (typeof req.body.ativo !== 'boolean') throw new HttpError(400, 'Campo "ativo" invalido.');
  if (id === req.user.id) throw new HttpError(400, 'Voce nao pode desativar a propria conta.');
  await Usuario.definirAtivo(id, req.body.ativo);
  const depois = await Usuario.detalhar(id);
  res.locals.audit = { acao: req.body.ativo ? 'USUARIO_ATIVADO' : 'USUARIO_DESATIVADO', antes: { ativo: antes.ativo }, depois: { ativo: depois.ativo } };
  res.json(depois);
};

exports.remover = async (req, res) => {
  const id = Number(req.params.id);
  const antes = await Usuario.detalhar(id);
  if (!antes) throw new HttpError(404, 'Usuario nao encontrado.');
  if (id === req.user.id) throw new HttpError(400, 'Voce nao pode excluir a propria conta.');
  const usado = await db('saidas_antecipadas').where({ aluno_id: id }).orWhere({ gestor_id: id }).orWhere({ portaria_id: id }).first();
  const usadoEntrada = await db('entradas_atrasadas').where({ aluno_id: id }).orWhere({ registrado_por: id }).first();
  if (usado || usadoEntrada) {
    throw new HttpError(409, 'Usuario possui historico de registros e nao pode ser excluido. Desative a conta.');
  }
  await db('usuarios').where({ id }).del();
  res.locals.audit = { acao: 'USUARIO_EXCLUIDO', antes, depois: null };
  res.status(204).end();
};
