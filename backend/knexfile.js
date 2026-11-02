require('dotenv').config();
const path = require('path');

const client = process.env.DB_CLIENT || (process.env.DATABASE_URL ? 'pg' : 'better-sqlite3');
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction && client === 'better-sqlite3') {
  throw new Error('Em producao, configure um banco persistente via DATABASE_URL ou DB_CLIENT=mysql2.');
}

const connection = (() => {
  if (client === 'pg') {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL e obrigatorio quando DB_CLIENT=pg.');
    return {
      connectionString: process.env.DATABASE_URL,
      ...(process.env.DB_SSL === 'true' ? { ssl: { rejectUnauthorized: false } } : {}),
    };
  }
  if (client === 'mysql2') {
    return {
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    };
  }
  if (client === 'better-sqlite3') {
    return { filename: process.env.DB_FILENAME || path.join(__dirname, 'database', 'dev.sqlite') };
  }
  throw new Error(`DB_CLIENT nao suportado: ${client}. Use pg, mysql2 ou better-sqlite3.`);
})();

module.exports = {
  client,
  connection,
  useNullAsDefault: true,
  migrations: { directory: path.join(__dirname, 'database', 'migrations') },
  pool:
    client === 'better-sqlite3'
      ? {
          afterCreate: (conn, done) => {
            conn.pragma('foreign_keys = ON');
            done();
          },
        }
      : undefined,
};
