const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const env = require('../config/env');

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = env.timezone;

const agoraISO = () => new Date().toISOString();

const hojeSP = () => dayjs().tz(TZ).format('YYYY-MM-DD');

// Idade sempre calculada em tempo de execucao a partir da data de nascimento.
function calcularIdade(dataNascimento, referencia = hojeSP()) {
  const [by, bm, bd] = String(dataNascimento).slice(0, 10).split('-').map(Number);
  const [ry, rm, rd] = String(referencia).slice(0, 10).split('-').map(Number);
  let idade = ry - by;
  if (rm < bm || (rm === bm && rd < bd)) idade -= 1;
  return idade;
}

const ehMaiorDeIdade = (dataNascimento, referencia) => calcularIdade(dataNascimento, referencia) >= 18;

// Aceita "YYYY-MM-DDTHH:mm" (datetime-local) ou "HH:mm" (hoje) interpretados em America/Sao_Paulo.
function localParaISO(valor) {
  if (!valor || typeof valor !== 'string') return null;
  const texto = /^\d{2}:\d{2}$/.test(valor.trim()) ? `${hojeSP()}T${valor.trim()}` : valor.trim();
  if (!/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?$/.test(texto)) return null;
  const d = dayjs.tz(texto.replace(' ', 'T'), TZ);
  return d.isValid() ? d.toDate().toISOString() : null;
}

const formatarSP = (iso) => (iso ? dayjs(iso).tz(TZ).format('DD/MM/YYYY HH:mm') : '');

module.exports = { agoraISO, hojeSP, calcularIdade, ehMaiorDeIdade, localParaISO, formatarSP };
