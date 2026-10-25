const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const env = require('./config/env');
const { passport } = require('./config/passport');
const routes = require('./routes');
const auditoria = require('./middlewares/auditoria');
const { notFound, errorHandler } = require('./middlewares/errorHandler');

const app = express();

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: env.frontendUrl, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use(
  session({
    secret: env.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', secure: env.isProduction, maxAge: 10 * 60 * 1000 },
  })
);
app.use(passport.initialize());
app.use(auditoria);

app.use('/api', routes);

const dist = path.join(__dirname, '..', '..', 'frontend', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use(notFound);
app.use(errorHandler);

module.exports = app;

if (require.main === module) {
  app.listen(env.port, () => {
    console.log(`API SENAI em http://localhost:${env.port} (demo: ${env.demoMode})`);
  });
}
