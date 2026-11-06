const db = require('../src/config/database');
const Usuario = require('../src/models/usuarioModel');
const { emailPermitidoParaPerfil } = require('../src/config/equipePermitida');
const { agoraISO } = require('../src/services/dateService');
const { hashSenha, validarSenha } = require('../src/services/passwordService');

async function criarGestorInicial() {
  const nome = String(process.env.GESTOR_NOME || '').trim();
  const email = Usuario.normalizarEmail(process.env.GESTOR_EMAIL);
  if (nome.length < 3 || nome.length > 150) throw new Error('Defina GESTOR_NOME com um nome entre 3 e 150 caracteres.');
  if (!emailPermitidoParaPerfil(email, 'gestor')) throw new Error('GESTOR_EMAIL não está autorizado para o perfil Gestor.');
  const senhaTemporaria = String(process.env.GESTOR_SENHA_TEMPORARIA || '');
  validarSenha(senhaTemporaria);
  const senhaHash = await hashSenha(senhaTemporaria);

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
        senha_hash: senhaHash,
        deve_trocar_senha: true,
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
    .then((id) => console.log(`Gestor inicial cadastrado (id ${id}). Entre com a senha temporaria e troque-a no primeiro acesso.`))
    .catch((err) => {
      console.error(`Nao foi possivel cadastrar o gestor inicial: ${err.message}`);
      process.exitCode = 1;
    })
    .finally(() => db.destroy());
}
