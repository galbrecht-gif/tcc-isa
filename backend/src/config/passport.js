const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const env = require('./env');
const Usuario = require('../models/usuarioModel');

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
          const email = (profile.emails || []).find((e) => e.verified !== false);
          if (!email) return done(null, false);
          const usuario = await Usuario.buscarPorEmail(email.value);
          if (!usuario || !usuario.ativo) return done(null, false);
          return done(null, usuario);
        } catch (err) {
          return done(err);
        }
      }
    )
  );
}

module.exports = { passport, googleEnabled };
