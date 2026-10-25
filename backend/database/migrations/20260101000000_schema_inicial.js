exports.up = async function up(knex) {
  await knex.schema.createTable('usuarios', (t) => {
    t.increments('id');
    t.string('nome', 150).notNullable();
    t.string('email', 190).notNullable().unique();
    t.string('role', 20).notNullable();
    t.boolean('ativo').notNullable().defaultTo(true);
    t.string('data_nascimento', 10).nullable();
    t.integer('turma_id').unsigned().nullable();
    t.string('criado_em', 30).notNullable();
    t.string('atualizado_em', 30).notNullable();
  });

  await knex.schema.createTable('turmas', (t) => {
    t.increments('id');
    t.string('nome', 100).notNullable();
    t.string('curso', 150).notNullable();
    t.integer('professor_id').unsigned().nullable().references('id').inTable('usuarios').onDelete('SET NULL');
  });

  await knex.schema.createTable('aluno_responsavel', (t) => {
    t.integer('aluno_id').unsigned().notNullable().references('id').inTable('usuarios').onDelete('CASCADE');
    t.integer('responsavel_id').unsigned().notNullable().references('id').inTable('usuarios').onDelete('CASCADE');
    t.primary(['aluno_id', 'responsavel_id']);
  });

  await knex.schema.createTable('entradas_atrasadas', (t) => {
    t.increments('id');
    t.integer('aluno_id').unsigned().notNullable().references('id').inTable('usuarios');
    t.integer('registrado_por').unsigned().notNullable().references('id').inTable('usuarios');
    t.text('motivo').notNullable();
    t.string('horario_registro', 30).notNullable();
    t.string('horario_efetivo', 30).notNullable();
    t.string('horario_alterado_log', 300).nullable();
    t.text('assinatura').notNullable();
    t.boolean('professor_ciente').notNullable().defaultTo(false);
    t.string('professor_ciente_em', 30).nullable();
    t.string('criado_em', 30).notNullable();
  });

  await knex.schema.createTable('saidas_antecipadas', (t) => {
    t.increments('id');
    t.integer('aluno_id').unsigned().notNullable().references('id').inTable('usuarios');
    t.text('motivo').notNullable();
    t.string('horario_previsto', 30).notNullable();
    t.boolean('fluxo_menor').notNullable();
    t.string('status', 30).notNullable();
    t.string('responsavel_status', 30).notNullable();
    t.string('responsavel_decisao_em', 30).nullable();
    t.string('gestor_status', 30).notNullable().defaultTo('PENDENTE');
    t.integer('gestor_id').unsigned().nullable().references('id').inTable('usuarios');
    t.text('gestor_justificativa').nullable();
    t.string('gestor_decisao_em', 30).nullable();
    t.boolean('professor_ciente').notNullable().defaultTo(false);
    t.string('professor_ciente_em', 30).nullable();
    t.text('assinatura').nullable();
    t.integer('portaria_id').unsigned().nullable().references('id').inTable('usuarios');
    t.string('horario_saida_real', 30).nullable();
    t.string('criado_em', 30).notNullable();
    t.string('atualizado_em', 30).notNullable();
  });

  await knex.schema.createTable('otps_saida', (t) => {
    t.increments('id');
    t.integer('saida_id').unsigned().notNullable().references('id').inTable('saidas_antecipadas').onDelete('CASCADE');
    t.string('codigo_hash', 64).notNullable();
    t.string('expira_em', 30).notNullable();
    t.boolean('usado').notNullable().defaultTo(false);
    t.integer('tentativas').notNullable().defaultTo(0);
    t.string('criado_em', 30).notNullable();
  });

  await knex.schema.createTable('notificacoes', (t) => {
    t.increments('id');
    t.integer('usuario_id').unsigned().notNullable().references('id').inTable('usuarios').onDelete('CASCADE');
    t.string('titulo', 150).notNullable();
    t.text('mensagem').notNullable();
    t.string('link', 200).nullable();
    t.boolean('lida').notNullable().defaultTo(false);
    t.string('criado_em', 30).notNullable();
  });

  await knex.schema.createTable('emails_log', (t) => {
    t.increments('id');
    t.string('destinatario', 190).notNullable();
    t.string('assunto', 200).notNullable();
    t.text('corpo').notNullable();
    t.string('modo', 10).notNullable();
    t.string('criado_em', 30).notNullable();
  });

  await knex.schema.createTable('logs_sistema', (t) => {
    t.increments('id');
    t.integer('id_usuario').unsigned().nullable();
    t.string('acao', 200).notNullable();
    t.text('dados_anteriores').nullable();
    t.text('dados_novos').nullable();
    t.string('ip', 64).nullable();
    t.string('timestamp', 30).notNullable();
  });
};

exports.down = async function down(knex) {
  const tabelas = [
    'logs_sistema',
    'emails_log',
    'notificacoes',
    'otps_saida',
    'saidas_antecipadas',
    'entradas_atrasadas',
    'aluno_responsavel',
    'turmas',
    'usuarios',
  ];
  for (const t of tabelas) {
    await knex.schema.dropTableIfExists(t);
  }
};
