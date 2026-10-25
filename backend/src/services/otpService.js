const crypto = require('crypto');
const db = require('../config/database');
const { agoraISO } = require('./dateService');

const VALIDADE_MS = 15 * 60 * 1000;
const MAX_TENTATIVAS = 5;

const hash = (codigo) => crypto.createHash('sha256').update(String(codigo)).digest('hex');

// Gera um OTP numerico de 6 digitos e invalida os anteriores da mesma solicitacao.
async function gerar(saidaId, trx = db) {
  const codigo = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  await trx('otps_saida').where({ saida_id: saidaId, usado: false }).update({ usado: true });
  await trx('otps_saida').insert({
    saida_id: saidaId,
    codigo_hash: hash(codigo),
    expira_em: new Date(Date.now() + VALIDADE_MS).toISOString(),
    usado: false,
    tentativas: 0,
    criado_em: agoraISO(),
  });
  return codigo;
}

// Valida o codigo sem consumi-lo. Retorna o registro do OTP ou null.
async function validar(saidaId, codigo, trx = db) {
  const otp = await trx('otps_saida').where({ saida_id: saidaId, usado: false }).orderBy('id', 'desc').first();
  if (!otp) return null;
  if (new Date(otp.expira_em).getTime() < Date.now() || otp.tentativas >= MAX_TENTATIVAS) return null;
  const informado = Buffer.from(hash(String(codigo || '')));
  const esperado = Buffer.from(otp.codigo_hash);
  if (!crypto.timingSafeEqual(informado, esperado)) {
    await trx('otps_saida').where({ id: otp.id }).increment('tentativas', 1);
    return null;
  }
  return otp;
}

// Uso unico: retorna true somente para a primeira chamada.
async function consumir(otpId, trx = db) {
  const n = await trx('otps_saida').where({ id: otpId, usado: false }).update({ usado: true });
  return n === 1;
}

module.exports = { gerar, validar, consumir, VALIDADE_MS };
