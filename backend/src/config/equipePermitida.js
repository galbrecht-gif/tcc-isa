const emailsGestor = [
  'lmenezes@sp.senai.br',
  'lucineide.melo@sp.senai.br',
  'rosângela.garcia@dp.senai.br',
  'marcelo.fazan@sp.senai.br',
  'luiscarvalho@sp.senai.br',
  'gguimarães@sp.senai.br',
];

const emailsProfessor = [
  'edilson.ferreira@sp.senai.br',
  'marcos.rnunes@sp.senai.br',
];

const emailsAcessoCompleto = [
  'g.albrecht@aluno.senai.br',
  'isabelly.d.rosa@aluno.senai.br',
  'leticia.m.cunha7@aluno.senai.br',
];

const emailsPorPerfil = {
  gestor: emailsGestor,
  professor: emailsProfessor,
  portaria: emailsGestor,
};

function perfisPermitidos(email) {
  const normalizado = String(email || '').trim().toLowerCase();
  if (emailsAcessoCompleto.includes(normalizado)) return ['aluno', 'professor', 'gestor', 'portaria'];
  return Object.entries(emailsPorPerfil)
    .filter(([, emails]) => emails.includes(normalizado))
    .map(([perfil]) => perfil);
}

function emailPermitidoParaPerfil(email, perfil) {
  return perfisPermitidos(email).includes(perfil);
}

function emailAutorizadoParaCadastroEquipe(email) {
  const normalizado = String(email || '').trim().toLowerCase();
  return Object.values(emailsPorPerfil).some((emails) => emails.includes(normalizado));
}

module.exports = {
  emailAutorizadoParaCadastroEquipe,
  emailPermitidoParaPerfil,
  emailsPorPerfil,
  perfisPermitidos,
};
