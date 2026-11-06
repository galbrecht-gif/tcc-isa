const db = require('../config/database');
const { transporter, smtpConfigurado, from } = require('../config/mailer');
const env = require('../config/env');
const HttpError = require('./HttpError');
const { agoraISO } = require('./dateService');

// Registra e-mails operacionais; códigos de autenticação podem ser enviados sem persistir o conteúdo.
async function enviar({ para, assunto, corpo, registrarLog = true, exigirEntrega = false }) {
  let modo = 'DEMO';
  const erroEntrega = () => new HttpError(
    503,
    'O serviço de e-mail está indisponível. Verifique a configuração SMTP e tente novamente.',
    undefined,
    true
  );
  if (smtpConfigurado) {
    try {
      await transporter.sendMail({ from, to: para, subject: assunto, text: corpo });
      modo = 'SMTP';
    } catch (err) {
      if (exigirEntrega || env.isProduction) {
        console.error(`Falha SMTP para ${para}: ${err.message}`);
        if (exigirEntrega) throw erroEntrega();
        throw err;
      }
      console.error(`Falha SMTP para ${para}: ${err.message}. Usando fallback demo.`);
    }
  } else if (exigirEntrega) {
    throw erroEntrega();
  } else if (env.isProduction) {
    throw new Error('SMTP nao configurado: nao e possivel enviar e-mails em producao.');
  }
  if (modo === 'DEMO') {
    console.log(`\n[EMAIL DEMO] Para: ${para}\nAssunto: ${assunto}\n${corpo}\n`);
  }
  if (registrarLog) {
    await db('emails_log').insert({ destinatario: para, assunto, corpo, modo, criado_em: agoraISO() });
  }
  return modo;
}

module.exports = { enviar };
