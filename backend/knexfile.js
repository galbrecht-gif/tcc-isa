require('dotenv').config();
const path = require('path');

const client = process.env.DB_CLIENT || 'better-sqlite3';

const connection =
  client === 'mysql2'
    ? {
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
      }
    : {
        filename: process.env.DB_FILENAME || path.join(__dirname, 'database', 'dev.sqlite'),
      };

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
