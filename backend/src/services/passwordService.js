const crypto = require('crypto');
const { promisify } = require('util');

const scrypt = promisify(crypto.scrypt);
const TAMANHO_HASH = 64;
const HASH_FICTICIO = `scrypt$${'00'.repeat(16)}$${'00'.repeat(TAMANHO_HASH)}`;

function validarSenha(senha) {
  if (typeof senha !== 'string' || senha.length < 8 || senha.length > 128) {
    const err = new Error('A senha deve ter entre 8 e 128 caracteres.');
    err.status = 400;
    throw err;
  }
}

async function hashSenha(senha) {
  validarSenha(senha);
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = await scrypt(senha, salt, TAMANHO_HASH);
  return `scrypt$${salt}$${derived.toString('hex')}`;
}

async function verificarSenha(senha, encoded = HASH_FICTICIO) {
  const [, salt, hashHex] = String(encoded || HASH_FICTICIO).split('$');
  const saltValido = /^[a-f0-9]{32}$/i.test(salt || '');
  const hashValido = /^[a-f0-9]{128}$/i.test(hashHex || '');
  const esperado = hashValido ? Buffer.from(hashHex, 'hex') : Buffer.alloc(TAMANHO_HASH);
  const derivado = await scrypt(String(senha || ''), saltValido ? salt : '00'.repeat(16), TAMANHO_HASH);
  return crypto.timingSafeEqual(derivado, esperado) && Boolean(encoded) && saltValido && hashValido;
}

module.exports = { hashSenha, verificarSenha, validarSenha };
