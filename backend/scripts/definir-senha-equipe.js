const db = require('../src/config/database');
const { emailPermitidoParaPerfil, emailsPorPerfil } = require('../src/config/equipePermitida');
const { agoraISO } = require('../src/services/dateService');
const { hashSenha, validarSenha } = require('../src/services/passwordService');

async function definirSenhaEquipe(senhaTemporaria = process.env.EQUIPE_SENHA_TEMPORARIA) {
  validarSenha(senhaTemporaria);
  const contasEsperadas = new Map();
  for (const [role, emails] of Object.entries(emailsPorPerfil)) {
    for (const email of emails) {
      if (!contasEsperadas.has(email)) contasEsperadas.set(email, role);
    }
  }
  const usuarios = await db('usuarios').whereIn('email', [...contasEsperadas.keys()]);
  const usuariosPorEmail = new Map(usuarios.map((usuario) => [usuario.email.trim().toLowerCase(), usuario]));
  const atualizacao = agoraISO();

  let criadas = 0;
  await db.transaction(async (trx) => {
    for (const [email, role] of contasEsperadas) {
      const existente = usuariosPorEmail.get(email);
      const senhaHash = await hashSenha(senhaTemporaria);
      if (existente) {
        if (!emailPermitidoParaPerfil(email, role)) continue;
        await trx('usuarios').where({ id: existente.id }).update({
          role,
          senha_hash: senhaHash,
          deve_trocar_senha: true,
          atualizado_em: atualizacao,
        });
        continue;
      }

      const nome = email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\p{L}/gu, (letra) => letra.toLocaleUpperCase('pt-BR'));
      await trx('usuarios').insert({
        nome,
        email,
        role,
        ativo: true,
        senha_hash: senhaHash,
        deve_trocar_senha: true,
        criado_em: atualizacao,
        atualizado_em: atualizacao,
      });
      criadas += 1;
    }
  });

  return { criadas, atualizados: contasEsperadas.size - criadas };
}

module.exports = definirSenhaEquipe;

if (require.main === module) {
  definirSenhaEquipe()
    .then(({ criadas, atualizados }) => {
      console.log(`${criadas} conta(s) criada(s) e ${atualizados} atualizada(s) com a senha temporaria.`);
      console.log('A troca da senha sera obrigatoria no proximo acesso.');
    })
    .catch((err) => {
      console.error(`Nao foi possivel definir a senha temporaria da equipe: ${err.message}`);
      process.exitCode = 1;
    })
    .finally(() => db.destroy());
}
