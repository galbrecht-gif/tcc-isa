require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';

if (isProduction && (!process.env.JWT_SECRET || !process.env.SESSION_SECRET)) {
  throw new Error('JWT_SECRET e SESSION_SECRET sao obrigatorios em producao.');
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
