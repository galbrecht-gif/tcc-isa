const jwt = require('jsonwebtoken');
const env = require('../config/env');
const Usuario = require('../models/usuarioModel');
const HttpError = require('../services/HttpError');
const { asyncHandler } = require('./errorHandler');

const COOKIE = 'token';

const PERFIS = ['aluno', 'professor', 'gestor', 'portaria'];

// "perfil" so e honrado para contas de acesso total (ACESSO_TOTAL_EMAILS).
function assinarToken(usuario, perfil) {
  const payload = { sub: usuario.id };
  if (PERFIS.includes(perfil)) payload.perfil = perfil;
  return jwt.sign(payload, env.jwtSecret, { expiresIn: '8h' });
}

function opcoesCookie() {
  return { httpOnly: true, sameSite: 'lax', secure: env.isProduction, maxAge: 8 * 60 * 60 * 1000 };
}

// Valida o JWT e recarrega o usuario do banco a cada requisicao,
// assim alteracoes de perfil/e-mail/ativo valem imediatamente.
const autenticar = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization;
  const token = req.cookies[COOKIE] || (header && header.startsWith('Bearer ') ? header.slice(7) : null);
  if (!token) throw new HttpError(401, 'Nao autenticado.');
  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch {
    throw new HttpError(401, 'Sessao invalida ou expirada.');
  }
  const usuario = await Usuario.buscarPorId(payload.sub);
  if (!usuario || !usuario.ativo) throw new HttpError(401, 'Conta inexistente ou desativada.');
  if (
    usuario.deve_trocar_senha &&
    !(req.method === 'GET' && req.path === '/auth/me') &&
    !(req.method === 'POST' && req.path === '/auth/senha/alterar')
  ) {
    throw new HttpError(403, 'Troque sua senha temporaria antes de continuar.');
  }
  const total = env.acessoTotalEmails.includes(String(usuario.email).toLowerCase());
  req.user = total && PERFIS.includes(payload.perfil) ? { ...usuario, role: payload.perfil } : usuario;
  next();
});

const exigirRole =
  (...roles) =>
  (req, res, next) =>
    roles.includes(req.user.role) ? next() : next(new HttpError(403, 'Acesso negado para este perfil.'));

module.exports = { PERFIS, autenticar, exigirRole, assinarToken, opcoesCookie, COOKIE };
