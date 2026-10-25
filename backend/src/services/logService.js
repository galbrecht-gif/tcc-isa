const db = require('../config/database');
const { agoraISO } = require('./dateService');

const CAMPOS_SENSIVEIS = ['assinatura', 'codigo', 'token'];

function limpar(obj) {
  if (obj === undefined || obj === null) return null;
  const copia = JSON.parse(JSON.stringify(obj));
  const percorrer = (o) => {
    if (!o || typeof o !== 'object') return;
    for (const k of Object.keys(o)) {
      if (CAMPOS_SENSIVEIS.includes(k)) o[k] = '[omitido]';
      else percorrer(o[k]);
    }
  };
  percorrer(copia);
  return JSON.stringify(copia);
}

async function registrar({ idUsuario, acao, antes, depois, ip }) {
  try {
    await db('logs_sistema').insert({
      id_usuario: idUsuario || null,
      acao,
      dados_anteriores: limpar(antes),
      dados_novos: limpar(depois),
      ip: ip || null,
      timestamp: agoraISO(),
    });
  } catch (err) {
    console.error('Falha ao gravar log de auditoria:', err.message);
  }
}

module.exports = { registrar };
