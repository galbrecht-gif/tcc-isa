const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const env = require('../config/env');
const { googleEnabled, acessoTotal } = require('../config/passport');
const Usuario = require('../models/usuarioModel');
const HttpError = require('../services/HttpError');
const logService = require('../services/logService');
const mailService = require('../services/mailService');
const { hashSenha, verificarSenha, validarSenha } = require('../services/passwordService');
const { calcularIdade, hojeSP } = require('../services/dateService');
const { PERFIS, assinarToken, opcoesCookie, COOKIE } = require('../middlewares/auth');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GOOGLE_CADASTRO_COOKIE = 'cadastro_google';
const GOOGLE_CADASTRO_TIPO = 'cadastro_google_aluno';
const HOME = {
  aluno: '/aluno',
  professor: '/professor',
  gestor: '/gestor',
  portaria: '/portaria',
  responsavel: '/responsavel',
};

async function validarDadosCadastroAluno(body, email = Usuario.normalizarEmail(body.email)) {
  const nome = String(body.nome || '').trim();
  const dataNascimento = String(body.dataNascimento || '');
  const nascimento = /^\d{4}-\d{2}-\d{2}$/.test(dataNascimento) ? new Date(`${dataNascimento}T00:00:00.000Z`) : null;
  const turmaId = Number(body.turmaId);
  const responsavelNome = String(body.responsavelNome || '').trim();
  const responsavelEmail = Usuario.normalizarEmail(body.responsavelEmail);
  if (nome.length < 3 || nome.length > 150) throw new HttpError(400, 'Informe seu nome completo.');
  if (email.length > 190 || !EMAIL_RE.test(email)) throw new HttpError(400, 'Informe um e-mail válido.');
  if (!nascimento || Number.isNaN(nascimento.getTime()) || nascimento.toISOString().slice(0, 10) !== dataNascimento) {
    throw new HttpError(400, 'Informe uma data de nascimento válida.');
  }
  if (dataNascimento > hojeSP()) throw new HttpError(400, 'A data de nascimento não pode estar no futuro.');
  if (!Number.isInteger(turmaId) || turmaId < 1 || !(await db('turmas').where({ id: turmaId }).first())) {
    throw new HttpError(400, 'Selecione uma turma válida.');
  }
  const menor = calcularIdade(dataNascimento) < 18;
  if (menor) {
    if (responsavelNome.length < 3 || responsavelNome.length > 150 || responsavelEmail.length > 190 || !EMAIL_RE.test(responsavelEmail)) {
      throw new HttpError(400, 'Para menores de 18 anos, informe nome e e-mail de um responsável.');
    }
    if (responsavelEmail === email) throw new HttpError(400, 'O e-mail do responsável deve ser diferente do e-mail do aluno.');
  }
  return { nome, email, dataNascimento, turmaId, menor, responsavelNome, responsavelEmail };
}

function lerCadastroGoogle(req) {
  try {
    const payload = jwt.verify(req.cookies[GOOGLE_CADASTRO_COOKIE], env.jwtSecret);
    if (
      payload.tipo !== GOOGLE_CADASTRO_TIPO ||
      typeof payload.email !== 'string' ||
      typeof payload.nome !== 'string'
    ) {
      throw new Error('Token de cadastro Google inválido.');
    }
    return payload;
  } catch {
    throw new HttpError(401, 'A confirmação do Google expirou. Inicie o cadastro novamente.');
  }
}

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

exports.entrarComSenha = async (req, res) => {
  const email = Usuario.normalizarEmail(req.body?.email);
  const senha = typeof req.body?.senha === 'string' ? req.body.senha : '';
  const usuario = await Usuario.buscarPorEmail(email);
  const senhaValida = await verificarSenha(senha, usuario?.senha_hash);
  if (!usuario || !usuario.ativo || !PERFIS.includes(usuario.role) || !usuario.senha_hash || !senhaValida) {
    throw new HttpError(401, 'E-mail ou senha incorretos.');
  }

  res.cookie(COOKIE, assinarToken(usuario), opcoesCookie());
  logService.registrar({ idUsuario: usuario.id, acao: 'LOGIN_SENHA', depois: { email: usuario.email }, ip: req.ip });
  res.json({ usuario: Usuario.publico(usuario), home: HOME[usuario.role] });
};

exports.solicitarCodigoSenhaAluno = async (req, res) => {
  const email = Usuario.normalizarEmail(req.body?.email);
  const usuario = await Usuario.buscarPorEmail(email);
  if (usuario?.ativo && usuario.role === 'aluno') {
    const codigo = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    const codigoHash = crypto.createHash('sha256').update(codigo).digest('hex');
    const agora = new Date();
    await db.transaction(async (trx) => {
      await trx('codigos_senha_aluno').where({ usuario_id: usuario.id, usado: false }).update({ usado: true });
      await trx('codigos_senha_aluno').insert({
        usuario_id: usuario.id,
        codigo_hash: codigoHash,
        expira_em: new Date(agora.getTime() + 10 * 60 * 1000).toISOString(),
        usado: false,
        tentativas: 0,
        criado_em: agora.toISOString(),
      });
    });
    await mailService.enviar({
      para: usuario.email,
      assunto: 'Código para criar ou recuperar sua senha',
      corpo: `Seu código é: ${codigo}\nEle expira em 10 minutos e só pode ser usado uma vez.`,
      registrarLog: env.demoMode && !env.isProduction,
    });
  }
  res.json({ mensagem: 'Se houver um cadastro ativo de aluno com esse e-mail, enviaremos um código.' });
};

exports.solicitarCodigoCadastroAluno = async (req, res) => {
  const { nome, email, dataNascimento, turmaId, menor, responsavelNome, responsavelEmail } =
    await validarDadosCadastroAluno(req.body || {});

  const mensagem = 'Se o e-mail puder ser usado, enviaremos um código para confirmar o cadastro.';
  if (await Usuario.buscarPorEmail(email)) {
    res.json({ mensagem });
    return;
  }

  const codigo = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  const agora = new Date();
  const enviarCodigo = await db.transaction(async (trx) => {
    await trx('cadastros_aluno_pendentes').where('expira_em', '<=', agora.toISOString()).del();
    const pendente = await trx('cadastros_aluno_pendentes').where({ email }).first();
    if (pendente && agora.getTime() - new Date(pendente.criado_em).getTime() < 60 * 1000) return false;
    const cadastro = {
      nome,
      email,
      data_nascimento: dataNascimento,
      turma_id: turmaId,
      responsavel_nome: menor ? responsavelNome : null,
      responsavel_email: menor ? responsavelEmail : null,
      codigo_hash: crypto.createHash('sha256').update(codigo).digest('hex'),
      expira_em: new Date(agora.getTime() + 10 * 60 * 1000).toISOString(),
      tentativas: 0,
      criado_em: agora.toISOString(),
    };
    if (pendente) await trx('cadastros_aluno_pendentes').where({ id: pendente.id }).update(cadastro);
    else await trx('cadastros_aluno_pendentes').insert(cadastro);
    return true;
  });
  if (enviarCodigo) {
    await mailService.enviar({
      para: email,
      assunto: 'Confirme seu cadastro de aluno',
      corpo: `Seu código de confirmação é: ${codigo}\nEle expira em 10 minutos e só pode ser usado uma vez.`,
      registrarLog: env.demoMode && !env.isProduction,
    });
  }
  res.json({ mensagem });
};

exports.dadosCadastroGoogleAluno = (req, res) => {
  const cadastro = lerCadastroGoogle(req);
  res.json({ nome: cadastro.nome, email: cadastro.email });
};

exports.confirmarCadastroGoogleAluno = async (req, res) => {
  const cadastroGoogle = lerCadastroGoogle(req);
  const dados = await validarDadosCadastroAluno(req.body || {}, cadastroGoogle.email);
  if (await Usuario.buscarPorEmail(dados.email)) {
    res.clearCookie(GOOGLE_CADASTRO_COOKIE, { httpOnly: true, sameSite: 'lax', secure: env.isProduction });
    throw new HttpError(409, 'Já existe uma conta com este e-mail. Entre pelo login.');
  }
  const id = await db.transaction((trx) =>
    Usuario.criarEmTransacao(trx, {
      nome: dados.nome,
      email: dados.email,
      role: 'aluno',
      ativo: true,
      data_nascimento: dados.dataNascimento,
      turma_id: dados.turmaId,
      responsaveis: dados.menor ? [{ nome: dados.responsavelNome, email: dados.responsavelEmail }] : [],
    })
  );
  const usuario = await Usuario.buscarPorEmail(dados.email);
  res.clearCookie(GOOGLE_CADASTRO_COOKIE, { httpOnly: true, sameSite: 'lax', secure: env.isProduction });
  res.cookie(COOKIE, assinarToken(usuario), opcoesCookie());
  logService.registrar({ idUsuario: id, acao: 'CADASTRO_ALUNO_GOOGLE', depois: { email: dados.email }, ip: req.ip });
  res.status(201).json({ mensagem: 'Cadastro concluído.' });
};

exports.confirmarCadastroAluno = async (req, res) => {
  const email = Usuario.normalizarEmail(req.body?.email);
  const codigo = String(req.body?.codigo || '');
  if (!EMAIL_RE.test(email) || !/^\d{6}$/.test(codigo)) throw new HttpError(400, 'Código inválido ou expirado.');
  try {
    validarSenha(req.body?.senha);
  } catch (err) {
    throw new HttpError(err.status, err.message);
  }
  const senhaHash = await hashSenha(req.body.senha);
  const codigoHash = crypto.createHash('sha256').update(codigo).digest('hex');
  const resultado = await db.transaction(async (trx) => {
    const pendente = await trx('cadastros_aluno_pendentes').where({ email }).forUpdate().first();
    if (!pendente || pendente.tentativas >= 5 || new Date(pendente.expira_em).getTime() <= Date.now()) return null;
    const confere = crypto.timingSafeEqual(Buffer.from(pendente.codigo_hash, 'hex'), Buffer.from(codigoHash, 'hex'));
    if (!confere) {
      await trx('cadastros_aluno_pendentes').where({ id: pendente.id }).increment('tentativas', 1);
      return null;
    }
    if (await trx('usuarios').where({ email }).first()) {
      await trx('cadastros_aluno_pendentes').where({ id: pendente.id }).del();
      return null;
    }
    const id = await Usuario.criarEmTransacao(trx, {
      nome: pendente.nome,
      email: pendente.email,
      role: 'aluno',
      ativo: true,
      senhaHash,
      data_nascimento: pendente.data_nascimento,
      turma_id: pendente.turma_id,
      responsaveis: pendente.responsavel_email
        ? [{ nome: pendente.responsavel_nome, email: pendente.responsavel_email }]
        : [],
    });
    await trx('cadastros_aluno_pendentes').where({ id: pendente.id }).del();
    return id;
  });
  if (!resultado) throw new HttpError(400, 'Código inválido ou expirado.');
  logService.registrar({ idUsuario: resultado, acao: 'CADASTRO_ALUNO_CONFIRMADO', ip: req.ip });
  res.status(201).json({ mensagem: 'Cadastro confirmado. Agora você pode entrar com e-mail e senha.' });
};

exports.definirSenhaAluno = async (req, res) => {
  const email = Usuario.normalizarEmail(req.body?.email);
  const codigo = String(req.body?.codigo || '');
  if (!/^\d{6}$/.test(codigo)) throw new HttpError(400, 'Código inválido ou expirado.');
  try {
    validarSenha(req.body?.senha);
  } catch (err) {
    throw new HttpError(err.status, err.message);
  }
  const usuario = await Usuario.buscarPorEmail(email);
  if (!usuario || !usuario.ativo || usuario.role !== 'aluno') throw new HttpError(400, 'Código inválido ou expirado.');

  const senhaHash = await hashSenha(req.body.senha);
  const codigoHash = crypto.createHash('sha256').update(codigo).digest('hex');
  const sucesso = await db.transaction(async (trx) => {
    const registro = await trx('codigos_senha_aluno')
      .where({ usuario_id: usuario.id, usado: false })
      .orderBy('id', 'desc')
      .first();
    if (!registro || registro.tentativas >= 5 || new Date(registro.expira_em).getTime() <= Date.now()) return false;
    const confere = crypto.timingSafeEqual(Buffer.from(registro.codigo_hash, 'hex'), Buffer.from(codigoHash, 'hex'));
    if (!confere) {
      await trx('codigos_senha_aluno').where({ id: registro.id }).increment('tentativas', 1);
      return false;
    }
    const consumido = await trx('codigos_senha_aluno').where({ id: registro.id, usado: false }).update({ usado: true });
    if (consumido !== 1) return false;
    const atualizados = await trx('usuarios')
      .where({ id: usuario.id, ativo: true, role: 'aluno' })
      .update({ senha_hash: senhaHash, deve_trocar_senha: false, atualizado_em: new Date().toISOString() });
    return atualizados === 1;
  });
  if (!sucesso) throw new HttpError(400, 'Código inválido ou expirado.');
  logService.registrar({ idUsuario: usuario.id, acao: 'SENHA_ALUNO_DEFINIDA', ip: req.ip });
  res.json({ mensagem: 'Senha criada. Agora você pode entrar com e-mail e senha.' });
};

exports.alterarSenha = async (req, res) => {
  const senhaAtual = typeof req.body?.senhaAtual === 'string' ? req.body.senhaAtual : '';
  if (!req.user.senha_hash || !(await verificarSenha(senhaAtual, req.user.senha_hash))) {
    throw new HttpError(400, 'Senha atual incorreta.');
  }
  try {
    validarSenha(req.body?.novaSenha);
  } catch (err) {
    throw new HttpError(err.status, err.message);
  }
  await Usuario.definirSenha(req.user.id, await hashSenha(req.body.novaSenha));
  logService.registrar({ idUsuario: req.user.id, acao: 'SENHA_TEMPORARIA_TROCADA', ip: req.ip });
  res.json({ mensagem: 'Senha alterada com sucesso.' });
};

// O perfil escolhido na tela de login precisa ser o cadastrado em "usuarios",
// exceto contas de acesso total, que entram no perfil escolhido.
exports.googleCallback = (req, res) => {
  const perfil = req.cookies.perfil_login;
  res.clearCookie('perfil_login');
  if (!PERFIS.includes(perfil)) return res.redirect(`${env.frontendUrl}/login?erro=perfil_invalido`);
  if (req.user.cadastroGoogleAluno) {
    if (perfil !== 'aluno') return res.redirect(`${env.frontendUrl}/login?erro=nao_autorizado`);
    const token = jwt.sign(
      { tipo: GOOGLE_CADASTRO_TIPO, email: req.user.email, nome: req.user.nome },
      env.jwtSecret,
      { expiresIn: '15m' }
    );
    res.cookie(GOOGLE_CADASTRO_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.isProduction,
      maxAge: 15 * 60 * 1000,
    });
    return res.redirect(`${env.frontendUrl}/cadastro-aluno?google=1`);
  }
  const total = acessoTotal(req.user.email);
  if (!total && req.user.role !== perfil) return res.redirect(`${env.frontendUrl}/login?erro=perfil_incorreto`);
  res.cookie(COOKIE, assinarToken(req.user, total ? perfil : undefined), opcoesCookie());
  logService.registrar({ idUsuario: req.user.id, acao: 'LOGIN_GOOGLE', depois: { email: req.user.email, perfil }, ip: req.ip });
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

// Somente em modo demo: recria os dados de exemplo e mantem o gestor logado.
exports.demoReset = async (req, res) => {
  if (!env.demoMode) throw new HttpError(404, 'Modo demo desativado.');
  const db = require('../config/database');
  await require('../../database/seed')(db);
  const [gestor] = await Usuario.listar({ role: 'gestor', ativo: 'true' });
  res.cookie(COOKIE, assinarToken(gestor), opcoesCookie());
  res.locals.audit = { acao: 'DEMO_RESET', usuarioId: gestor.id, depois: { ok: true } };
  res.json({ usuario: gestor, home: HOME.gestor });
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
