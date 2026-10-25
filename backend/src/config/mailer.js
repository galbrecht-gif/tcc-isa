const nodemailer = require('nodemailer');
const env = require('./env');

const smtpConfigurado = Boolean(env.smtp.host);

const transporter = smtpConfigurado
  ? nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.secure,
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
    })
  : null;

module.exports = { transporter, smtpConfigurado, from: env.smtp.from };
