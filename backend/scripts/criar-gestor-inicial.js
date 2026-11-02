const db = require('../src/config/database');
const env = require('../src/config/env');
const Usuario = require('../src/models/usuarioModel');
const { emailInstitucionalPermitido, acessoTotal } = require('../src/config/passport');
const { agoraISO } = require('../src/services/dateService');

async function criarGestorInicial() {
  const nome = String(process.env.GESTOR_NOME || '').trim();
  const email = Usuario.normalizarEmail(process.env.GESTOR_EMAIL);
  if (nome.length < 3 || nome.length > 150) throw new Error('Defina GESTOR_NOME com um nome entre 3 e 150 caracteres.');
  if (!emailInstitucionalPermitido(email) && !acessoTotal(email)) {
    throw new Error(`GESTOR_EMAIL deve pertencer a um dos dominios permitidos: ${env.senaiEmailDomains.join(', ')}.`);
  }

  return db.transaction(async (trx) => {
    if (await trx('usuarios').where({ role: 'gestor' }).first()) {
      throw new Error('Ja existe um gestor cadastrado. Crie novos gestores pelo painel administrativo.');
    }
    if (await trx('usuarios').whereRaw('lower(email) = ?', [email]).first()) {
      throw new Error('Esse e-mail ja esta cadastrado com outro perfil.');
    }

    const agora = agoraISO();
    const [result] = await trx('usuarios')
      .insert({
        nome,
        email,
        role: 'gestor',
        ativo: true,
        criado_em: agora,
        atualizado_em: agora,
      })
      .returning('id');
    return typeof result === 'object' ? result.id : result;
  });
}

module.exports = criarGestorInicial;

if (require.main === module) {
  criarGestorInicial()
    .then((id) => console.log(`Gestor inicial cadastrado (id ${id}). Entre com o Google usando esse e-mail institucional.`))
    .catch((err) => {
      console.error(`Nao foi possivel cadastrar o gestor inicial: ${err.message}`);
      process.exitCode = 1;
    })
    .finally(() => db.destroy());
}
