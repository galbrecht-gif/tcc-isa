const express = require('express');
const rateLimit = require('express-rate-limit');
const { passport, googleEnabled } = require('../config/passport');
const env = require('../config/env');
const { asyncHandler } = require('../middlewares/errorHandler');
const { PERFIS, autenticar, exigirRole } = require('../middlewares/auth');
const db = require('../config/database');

const wrap = (obj) => Object.fromEntries(Object.entries(obj).map(([k, fn]) => [k, asyncHandler(fn)]));

const auth = wrap(require('../controllers/authController'));
const saidas = wrap(require('../controllers/saidaController'));
const entradas = wrap(require('../controllers/entradaController'));
const usuarios = wrap(require('../controllers/usuarioController'));
const alunos = wrap(require('../controllers/alunoController'));
const turmas = wrap(require('../controllers/turmaController'));
const notificacoes = wrap(require('../controllers/notificacaoController'));
const logs = wrap(require('../controllers/logController'));
const publico = wrap(require('../controllers/publicController'));

const router = express.Router();

const limiteOtp = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: 'Muitas tentativas. Aguarde alguns minutos.' },
});
const limiteLogin = rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: true, legacyHeaders: false });
const limiteSenhaLogin = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });
const limiteSenhaAluno = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false });
const limiteCadastroAluno = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false });

router.get(
  '/health',
  asyncHandler(async (req, res) => {
    await db.raw('select 1');
    res.json({ ok: true, database: 'connected' });
  })
);

// Autenticacao
router.get('/auth/config', auth.config);
router.post('/auth/demo', limiteLogin, auth.demoLogin);
router.get('/auth/demo/usuarios', auth.demoUsuarios);
router.post('/auth/logout', auth.logout);
router.post('/auth/senha/login', limiteSenhaLogin, auth.entrarComSenha);
router.post('/auth/senha/aluno/codigo', limiteSenhaAluno, auth.solicitarCodigoSenhaAluno);
router.post('/auth/senha/aluno/definir', limiteSenhaAluno, auth.definirSenhaAluno);
router.post('/auth/senha/aluno/cadastro/codigo', limiteCadastroAluno, auth.solicitarCodigoCadastroAluno);
router.post('/auth/senha/aluno/cadastro/confirmar', limiteCadastroAluno, auth.confirmarCadastroAluno);
router.get('/auth/google/cadastro-aluno', auth.dadosCadastroGoogleAluno);
router.post('/auth/google/cadastro-aluno', limiteCadastroAluno, auth.confirmarCadastroGoogleAluno);
router.get('/auth/me', autenticar, auth.me);
if (googleEnabled) {
  router.get(
    '/auth/google',
    limiteLogin,
    (req, res, next) => {
      const perfil = String(req.query.perfil || '');
      if (!PERFIS.includes(perfil)) return res.redirect(`${env.frontendUrl}/login?erro=perfil_invalido`);
      res.cookie('perfil_login', perfil, { httpOnly: true, sameSite: 'lax', secure: env.isProduction, maxAge: 10 * 60 * 1000 });
      next();
    },
    passport.authenticate('google', { scope: ['profile', 'email'], session: false })
  );
  router.get(
    '/auth/google/callback',
    limiteLogin,
    passport.authenticate('google', { session: false, failureRedirect: `${env.frontendUrl}/login?erro=nao_autorizado` }),
    auth.googleCallback
  );
} else {
  router.get('/auth/google', (req, res) => res.redirect(`${env.frontendUrl}/login?erro=google_indisponivel`));
}

// Rotas publicas do responsavel (validadas por OTP)
router.post('/public/responsavel/consultar', limiteOtp, publico.consultar);
router.post('/public/responsavel/decidir', limiteOtp, publico.decidir);
router.get('/public/turmas', asyncHandler(alunos.turmasPublicas));
router.get('/demo/emails', publico.emailsDemo);

// Rotas protegidas
router.use(autenticar);

router.post('/auth/senha/alterar', auth.alterarSenha);

router.get('/notificacoes', notificacoes.listar);
router.patch('/notificacoes/ler-todas', notificacoes.marcarTodasLidas);
router.patch('/notificacoes/:id/ler', notificacoes.marcarLida);

router.get('/turmas', exigirRole('gestor', 'portaria', 'professor'), turmas.listar);
router.get('/turmas/:id/alunos', exigirRole('gestor', 'professor'), turmas.alunos);
router.post('/turmas', exigirRole('gestor'), turmas.criar);
router.patch('/turmas/:id/professor', exigirRole('gestor'), turmas.definirProfessor);
router.get('/alunos', exigirRole('gestor', 'portaria', 'professor'), alunos.buscar);

router.get('/saidas', saidas.listar);
router.post('/saidas', exigirRole('aluno'), saidas.criar);
router.get('/saidas/:id', saidas.obter);
router.post('/saidas/:id/reenviar-otp', exigirRole('aluno'), saidas.reenviarOtp);
router.post('/saidas/:id/cancelar', exigirRole('aluno'), saidas.cancelar);
router.post('/saidas/:id/gestor', exigirRole('gestor'), saidas.decisaoGestor);
router.post('/saidas/:id/ciente', exigirRole('professor'), saidas.ciente);
router.post('/saidas/:id/liberar', exigirRole('portaria'), saidas.liberar);

router.get('/entradas', exigirRole('aluno', 'professor', 'portaria', 'gestor'), entradas.listar);
router.post('/entradas', exigirRole('portaria'), entradas.criar);
router.get('/entradas/:id', exigirRole('aluno', 'professor', 'portaria', 'gestor'), entradas.obter);
router.post('/entradas/:id/ciente', exigirRole('professor'), entradas.ciente);

router.get('/usuarios', exigirRole('gestor'), usuarios.listar);
router.post('/usuarios', exigirRole('gestor'), usuarios.criar);
router.get('/usuarios/:id', exigirRole('gestor'), usuarios.obter);
router.put('/usuarios/:id', exigirRole('gestor'), usuarios.atualizar);
router.patch('/usuarios/:id/ativo', exigirRole('gestor'), usuarios.definirAtivo);
router.delete('/usuarios/:id', exigirRole('gestor'), usuarios.remover);

router.get('/logs', exigirRole('gestor'), logs.listar);

router.post('/demo/reset', exigirRole('gestor'), auth.demoReset);

module.exports = router;
