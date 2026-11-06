const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const env = require('./env');
const Usuario = require('../models/usuarioModel');
const {
  emailAutorizadoParaCadastroEquipe,
  emailPermitidoParaPerfil,
  perfisPermitidos,
} = require('./equipePermitida');

const googleEnabled = Boolean(env.google.clientId && env.google.clientSecret);

if (googleEnabled) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: env.google.clientId,
        clientSecret: env.google.clientSecret,
        callbackURL: env.google.callbackUrl,
        state: true,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          let emailParaCadastro;
          let contaEncontrada = false;
          // Alunos existentes usam contas vinculadas; novos cadastros exigem um e-mail Google verificado.
          for (const e of (profile.emails || []).filter((x) => x.verified !== false)) {
            const usuario = await Usuario.buscarPorEmail(e.value);
            if (!usuario) {
              if (!emailParaCadastro && e.verified === true) emailParaCadastro = e.value;
              continue;
            }
            contaEncontrada = true;
            if (!usuario.ativo) continue;
            if (
              usuario.role === 'aluno' ||
              usuario.role === 'professor' ||
              emailPermitidoParaPerfil(e.value, usuario.role)
            ) {
              return done(null, usuario);
            }
          }
          if (!contaEncontrada && emailParaCadastro) {
            if (emailAutorizadoParaCadastroEquipe(emailParaCadastro)) return done(null, false);
            return done(null, {
              cadastroGoogleAluno: true,
              email: Usuario.normalizarEmail(emailParaCadastro),
              nome: String(profile.displayName || '').trim().slice(0, 150),
            });
          }
          return done(null, false);
        } catch (err) {
          return done(err);
        }
      }
    )
  );
}

module.exports = { passport, googleEnabled, emailPermitidoParaPerfil, perfisPermitidos };
