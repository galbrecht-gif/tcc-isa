exports.up = async function up(knex) {
  const alteracoes = [];
  if (!(await knex.schema.hasColumn('usuarios', 'senha_hash'))) alteracoes.push('senha_hash');
  if (!(await knex.schema.hasColumn('usuarios', 'deve_trocar_senha'))) alteracoes.push('deve_trocar_senha');
  if (alteracoes.length) {
    await knex.schema.alterTable('usuarios', (t) => {
      if (alteracoes.includes('senha_hash')) t.string('senha_hash', 255).nullable();
      if (alteracoes.includes('deve_trocar_senha')) t.boolean('deve_trocar_senha').notNullable().defaultTo(false);
    });
  }

  if (!(await knex.schema.hasTable('codigos_senha_aluno'))) {
    await knex.schema.createTable('codigos_senha_aluno', (t) => {
      t.increments('id');
      t.integer('usuario_id').unsigned().notNullable().references('id').inTable('usuarios').onDelete('CASCADE');
      t.string('codigo_hash', 64).notNullable();
      t.string('expira_em', 30).notNullable();
      t.boolean('usado').notNullable().defaultTo(false);
      t.integer('tentativas').notNullable().defaultTo(0);
      t.string('criado_em', 30).notNullable();
      t.index(['usuario_id', 'usado'], 'codigos_senha_aluno_usuario_usado_idx');
    });
  }

  if (!(await knex.schema.hasTable('cadastros_aluno_pendentes'))) {
    await knex.schema.createTable('cadastros_aluno_pendentes', (t) => {
      t.increments('id');
      t.string('nome', 150).notNullable();
      t.string('email', 190).notNullable().unique();
      t.string('data_nascimento', 10).notNullable();
      t.integer('turma_id').unsigned().notNullable().references('id').inTable('turmas').onDelete('CASCADE');
      t.string('responsavel_nome', 150).nullable();
      t.string('responsavel_email', 190).nullable();
      t.string('codigo_hash', 64).notNullable();
      t.string('expira_em', 30).notNullable();
      t.integer('tentativas').notNullable().defaultTo(0);
      t.string('criado_em', 30).notNullable();
      t.index('criado_em', 'cadastros_aluno_pendentes_criado_em_idx');
    });
  }
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('cadastros_aluno_pendentes');
  await knex.schema.dropTableIfExists('codigos_senha_aluno');
  const remover = [];
  if (await knex.schema.hasColumn('usuarios', 'deve_trocar_senha')) remover.push('deve_trocar_senha');
  if (await knex.schema.hasColumn('usuarios', 'senha_hash')) remover.push('senha_hash');
  if (remover.length) {
    await knex.schema.alterTable('usuarios', (t) => {
      remover.forEach((coluna) => t.dropColumn(coluna));
    });
  }
};
