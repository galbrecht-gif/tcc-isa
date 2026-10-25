const knex = require('knex');
const knexfile = require('../knexfile');

const agora = () => new Date().toISOString();

const ALUNOS = [
  { nome: 'Letícia Marques da Cunha', nasc: '2008-06-06', email: 'leticia.cunha@aluno.senai.br', resp: ['Fatima Marques', 'fatima18marques@gmail.com'] },
  { nome: 'Isabelly dos Santos Rosa', nasc: '2008-04-16', email: 'isabelly.rosa@aluno.senai.br', resp: ['Paulo de Jesus Rosa', 'pjrosa@gmail.com'] },
  { nome: 'Thaina Isis Batista Xavier', nasc: '2008-11-12', email: 'thaina.xavier@aluno.senai.br', resp: ['Marisangela Xavier', 'marisangela_batista@hotmail.com'] },
  { nome: 'Daniella Perez Cunha', nasc: '2008-10-20', email: 'daniella.cunha@aluno.senai.br', resp: ['Sandra Perez Cunha', 'sandraperezcunha@gmail.com'] },
  { nome: 'Julia Sobrinho Santos', nasc: '2008-03-06', email: 'julia.santos@aluno.senai.br', resp: ['André Luiz Santos', 'andreluiz242@gmail.com'] },
];

async function seed(db) {
  const tabelas = ['logs_sistema', 'emails_log', 'notificacoes', 'otps_saida', 'saidas_antecipadas', 'entradas_atrasadas', 'aluno_responsavel', 'turmas', 'usuarios'];
  for (const t of tabelas) await db(t).del();

  const novo = async (dados) => {
    const [r] = await db('usuarios').insert({ ativo: true, criado_em: agora(), atualizado_em: agora(), ...dados });
    return typeof r === 'object' ? r.id : r;
  };

  await novo({ nome: 'Luciano Menezes de Jesus', email: 'daniellap.cunha@gmail.com', role: 'gestor' });
  const professorId = await novo({ nome: 'Marcos Nunes', email: 'isabelly.d.rosa@aluno.senai.br', role: 'professor' });
  await novo({ nome: 'Funcionário Portaria', email: 'leticiamarque13@gmail.com', role: 'portaria' });

  const [t] = await db('turmas').insert({ nome: 'DEV 2', curso: 'Desenvolvimento de Sistemas', professor_id: professorId });
  const turmaId = typeof t === 'object' ? t.id : t;

  for (const a of ALUNOS) {
    const alunoId = await novo({ nome: a.nome, email: a.email, role: 'aluno', data_nascimento: a.nasc, turma_id: turmaId });
    const respId = await novo({ nome: a.resp[0], email: a.resp[1], role: 'responsavel' });
    await db('aluno_responsavel').insert({ aluno_id: alunoId, responsavel_id: respId });
  }
}

module.exports = seed;

if (require.main === module) {
  const db = knex(knexfile);
  seed(db)
    .then(() => console.log('Seed concluido: 1 gestor, 1 professor, 1 portaria, 5 alunos e 5 responsaveis.'))
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => db.destroy());
}
