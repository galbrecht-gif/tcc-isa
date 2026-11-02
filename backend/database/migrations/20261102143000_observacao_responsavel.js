exports.up = async function up(knex) {
  if (!(await knex.schema.hasColumn('saidas_antecipadas', 'observacao_responsavel'))) {
    await knex.schema.alterTable('saidas_antecipadas', (t) => {
      t.text('observacao_responsavel').nullable();
    });
  }
};

exports.down = async function down(knex) {
  if (await knex.schema.hasColumn('saidas_antecipadas', 'observacao_responsavel')) {
    await knex.schema.alterTable('saidas_antecipadas', (t) => {
      t.dropColumn('observacao_responsavel');
    });
  }
};
