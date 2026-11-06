exports.up = async function up(knex) {
  const client = knex.client.config.client;
  if (!['pg', 'postgres', 'mysql', 'mysql2'].includes(client)) return;
  if (!(await knex.schema.hasColumn('usuarios', 'senha_hash'))) return;

  await knex.schema.alterTable('usuarios', (t) => {
    t.string('senha_hash', 255).nullable().alter();
  });
};

exports.down = async function down() {
  // Keep the wider column to avoid truncating existing password hashes.
};
