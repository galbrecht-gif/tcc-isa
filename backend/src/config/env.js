require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';

if (isProduction && (!process.env.JWT_SECRET || !process.env.SESSION_SECRET)) {
  throw new Error('JWT_SECRET e SESSION_SECRET sao obrigatorios em producao.');
}

if (isProduction) {
  const dbClient = process.env.DB_CLIENT || (process.env.DATABASE_URL ? 'pg' : 'better-sqlite3');
  const dbConfigurado =
    (dbClient === 'pg' && Boolean(process.env.DATABASE_URL)) ||
    (dbClient === 'mysql2' && Boolean(process.env.DB_HOST && process.env.DB_USER && process.env.DB_NAME));
  const obrigatorias = [
    ['FRONTEND_URL', process.env.FRONTEND_URL],
    ['DATABASE_URL (ou configuracao completa de MySQL)', dbConfigurado],
    ['GOOGLE_CLIENT_ID', process.env.GOOGLE_CLIENT_ID],
    ['GOOGLE_CLIENT_SECRET', process.env.GOOGLE_CLIENT_SECRET],
    ['GOOGLE_CALLBACK_URL', process.env.GOOGLE_CALLBACK_URL],
    ['SMTP_HOST', process.env.SMTP_HOST],
    ['SMTP_USER', process.env.SMTP_USER],
    ['SMTP_PASS', process.env.SMTP_PASS],
    ['SMTP_FROM', process.env.SMTP_FROM],
  ];
  const ausentes = obrigatorias.filter(([, valor]) => !valor).map(([nome]) => nome);
  if (ausentes.length) throw new Error(`Configuracoes obrigatorias ausentes em producao: ${ausentes.join(', ')}.`);
}

module.exports = {
  isProduction,
  port: Number(process.env.PORT || 3001),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET || 'dev-jwt-secret-nao-usar-em-producao',
  sessionSecret: process.env.SESSION_SECRET || 'dev-session-secret-nao-usar-em-producao',
  // Em producao o modo demo exige opt-in explicito (DEMO_PUBLICO=true), para hospedagem de demonstracao.
  demoMode: process.env.DEMO_MODE === 'true' && (!isProduction || process.env.DEMO_PUBLICO === 'true'),
  timezone: process.env.TZ_APP || 'America/Sao_Paulo',
  senaiEmailDomains: (process.env.SENAI_EMAIL_DOMAINS || 'sp.senai.br,dp.senai.br')
    .split(',')
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean),
  // Contas que podem entrar em qualquer perfil (gestor, professor, portaria, aluno), escolhido na tela de login.
  acessoTotalEmails: (process.env.ACESSO_TOTAL_EMAILS || 'g.albrecht@aluno.senai.br')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackUrl: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/api/auth/google/callback',
  },
  smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM || 'SENAI <no-reply@senai.local>',
  },
};
