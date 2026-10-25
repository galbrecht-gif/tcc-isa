const db = require('../config/database');
const { transporter, smtpConfigurado, from } = require('../config/mailer');
const { agoraISO } = require('./dateService');

// Sempre registra o e-mail no banco; envia via SMTP quando configurado, senao imprime no console (modo demo).
async function enviar({ para, assunto, corpo }) {
  let modo = 'DEMO';
  if (smtpConfigurado) {
    try {
      await transporter.sendMail({ from, to: para, subject: assunto, text: corpo });
      modo = 'SMTP';
    } catch (err) {
      console.error(`Falha SMTP para ${para}: ${err.message}. Usando fallback demo.`);
    }
  }
  if (modo === 'DEMO') {
    console.log(`\n[EMAIL DEMO] Para: ${para}\nAssunto: ${assunto}\n${corpo}\n`);
  }
  await db('emails_log').insert({ destinatario: para, assunto, corpo, modo, criado_em: agoraISO() });
  return modo;
}

module.exports = { enviar };
