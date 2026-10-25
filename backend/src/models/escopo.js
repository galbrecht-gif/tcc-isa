const db = require('../config/database');

// Aplica o isolamento de dados por perfil (LGPD) sobre uma query que ja faz join com
// usuarios (alias "a") e usa o alias da tabela de registros informado em "t".
function aplicarEscopo(query, user, t, { portariaStatus } = {}) {
  switch (user.role) {
    case 'aluno':
      return query.where(`${t}.aluno_id`, user.id);
    case 'responsavel':
      return query.whereIn(
        `${t}.aluno_id`,
        db('aluno_responsavel').where({ responsavel_id: user.id }).select('aluno_id')
      );
    case 'professor':
      return query.whereIn('a.turma_id', db('turmas').where({ professor_id: user.id }).select('id'));
    case 'portaria':
      return portariaStatus ? query.whereIn(`${t}.status`, portariaStatus) : query;
    case 'gestor':
      return query;
    default:
      return query.whereRaw('1 = 0');
  }
}

module.exports = { aplicarEscopo };
