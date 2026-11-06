exports.up = async function up(knex) {
  const client = knex.client.config.client;
  if (!['pg', 'postgres', 'mysql', 'mysql2'].includes(client)) return;

  const colunas = ['criado_em', 'atualizado_em'];
  for (const coluna of colunas) {
    if (!(await knex.schema.hasColumn('usuarios', coluna))) continue;
    await knex.schema.alterTable('usuarios', (t) => {
      t.string(coluna, 30).notNullable().alter();
    });
  }
};

exports.down = async function down() {
  // Keep the wider columns to avoid truncating timestamps written after this migration.
};
