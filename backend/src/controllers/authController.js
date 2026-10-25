const env = require('../config/env');
const { googleEnabled } = require('../config/passport');
const Usuario = require('../models/usuarioModel');
const HttpError = require('../services/HttpError');
const logService = require('../services/logService');
const { assinarToken, opcoesCookie, COOKIE } = require('../middlewares/auth');

const HOME = {
  aluno: '/aluno',
  professor: '/professor',
  gestor: '/gestor',
  portaria: '/portaria',
  responsavel: '/responsavel',
};

exports.config = (req, res) => {
  res.json({ demoMode: env.demoMode, googleEnabled });
};

exports.me = (req, res) => {
  res.json({ usuario: Usuario.publico(req.user), home: HOME[req.user.role] });
};

exports.logout = (req, res) => {
  res.clearCookie(COOKIE, { ...opcoesCookie(), maxAge: undefined });
  res.json({ ok: true });
};

// Redireciona estritamente conforme a role cadastrada em "usuarios".
exports.googleCallback = (req, res) => {
  res.cookie(COOKIE, assinarToken(req.user), opcoesCookie());
  logService.registrar({ idUsuario: req.user.id, acao: 'LOGIN_GOOGLE', depois: { email: req.user.email }, ip: req.ip });
  res.redirect(`${env.frontendUrl}/auth/callback`);
};

exports.demoUsuarios = async (req, res) => {
  if (!env.demoMode) throw new HttpError(404, 'Modo demo desativado.');
  const lista = await Usuario.listar({ ativo: 'true' });
  res.json(
    lista
      .filter((u) => ['aluno', 'professor', 'gestor', 'portaria'].includes(u.role))
      .map((u) => ({ id: u.id, nome: u.nome, role: u.role, maior_idade: u.maior_idade }))
  );
};

// Atalhos de desenvolvimento: usam um usuario real do banco; nunca existem em producao.
exports.demoLogin = async (req, res) => {
  if (!env.demoMode) throw new HttpError(404, 'Modo demo desativado.');
  const { role, usuario_id: usuarioId } = req.body || {};
  if (!['aluno', 'professor', 'gestor', 'portaria'].includes(role)) throw new HttpError(400, 'Perfil de demonstracao invalido.');
  const lista = await Usuario.listar({ role, ativo: 'true' });
  const usuario = usuarioId ? lista.find((u) => u.id === Number(usuarioId)) : lista[0];
  if (!usuario) throw new HttpError(404, 'Nenhum usuario ativo para este perfil.');
  res.cookie(COOKIE, assinarToken(usuario), opcoesCookie());
  res.locals.audit = { acao: 'LOGIN_DEMO', usuarioId: usuario.id, depois: { role } };
  res.json({ usuario, home: HOME[usuario.role] });
};
