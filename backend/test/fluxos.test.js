const test = require('node:test');
const assert = require('node:assert');
const os = require('os');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');

const dbFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tcc-')), 'test.sqlite');
process.env.DB_FILENAME = dbFile;
process.env.DB_CLIENT = 'better-sqlite3';
process.env.DATABASE_URL = '';
process.env.DEMO_MODE = 'true';
process.env.NODE_ENV = 'test';

const db = require('../src/config/database');
const app = require('../src/server');
const seed = require('../database/seed');
const env = require('../src/config/env');
const { calcularIdade, localParaISO } = require('../src/services/dateService');
const { emailInstitucionalPermitido } = require('../src/config/passport');
const otpService = require('../src/services/otpService');
const criarGestorInicial = require('../scripts/criar-gestor-inicial');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const tz = require('dayjs/plugin/timezone');
dayjs.extend(utc);
dayjs.extend(tz);

let base;
let server;
const PNG = 'data:image/png;base64,iVBORw0KGgo=';

async function req(metodo, url, { cookie, body } = {}) {
  const res = await fetch(base + url, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.get('set-cookie');
  const texto = await res.text();
  return { status: res.status, json: texto ? JSON.parse(texto) : null, cookie: setCookie ? setCookie.split(';')[0] : null };
}

async function entrarDemo(role, nome) {
  let usuarioId;
  if (nome) {
    const lista = await req('GET', '/api/auth/demo/usuarios');
    usuarioId = lista.json.find((u) => u.nome.startsWith(nome)).id;
  }
  const r = await req('POST', '/api/auth/demo', { body: { role, usuario_id: usuarioId } });
  assert.strictEqual(r.status, 200);
  return r.cookie;
}

test.before(async () => {
  await db.migrate.latest();
  await seed(db);
  await new Promise((resolve) => {
    server = app.listen(0, () => resolve());
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  server.close();
  await db.destroy();
});

test('idade e calculada dinamicamente (Thaina vira maior em 12/11/2026)', () => {
  assert.strictEqual(calcularIdade('2008-11-12', '2026-11-11'), 17);
  assert.strictEqual(calcularIdade('2008-11-12', '2026-11-12'), 18);
});

test('horario local rejeita datas e horarios impossiveis sem normaliza-los', () => {
  for (const valor of ['2026-02-31T12:30', '2026-13-01T10:00', '2026-10-26T25:00', '2026-10-26T12:75', '2026-02-29T10:00']) {
    assert.strictEqual(localParaISO(valor), null, `${valor} deveria ser rejeitado`);
  }
  assert.ok(localParaISO('2024-02-29T10:00'));
});

test('login institucional aceita somente os dominios SENAI autorizados', () => {
  assert.strictEqual(emailInstitucionalPermitido('Pessoa@SP.SENAI.BR'), true);
  assert.strictEqual(emailInstitucionalPermitido('pessoa@dp.senai.br'), true);
  assert.strictEqual(emailInstitucionalPermitido('pessoa@senai.br'), false);
  assert.strictEqual(emailInstitucionalPermitido('pessoa@fake-sp.senai.br'), false);
  assert.strictEqual(emailInstitucionalPermitido('pessoa@gmail.com'), false);
});

test('cadastro de aluno pelo Google confirma o e-mail e exige os dados escolares', async () => {
  const token = jwt.sign(
    { tipo: 'cadastro_google_aluno', email: 'google.aluno@example.com', nome: 'Nome do Google' },
    env.jwtSecret,
    { expiresIn: '15m' }
  );
  const cookie = `cadastro_google=${token}`;
  const dadosGoogle = await req('GET', '/api/auth/google/cadastro-aluno', { cookie });
  assert.strictEqual(dadosGoogle.status, 200);
  assert.deepStrictEqual(dadosGoogle.json, { nome: 'Nome do Google', email: 'google.aluno@example.com' });

  const turmas = await req('GET', '/api/public/turmas');
  const dadosCadastro = {
    nome: 'Nome Confirmado',
    email: 'email-forjado@example.com',
    dataNascimento: '2000-01-01',
    turmaId: turmas.json[0].id,
  };
  const criado = await req('POST', '/api/auth/google/cadastro-aluno', {
    cookie,
    body: dadosCadastro,
  });
  assert.strictEqual(criado.status, 201);

  const usuario = await db('usuarios').where({ email: 'google.aluno@example.com' }).first();
  assert.strictEqual(usuario.nome, 'Nome Confirmado');
  assert.strictEqual(usuario.role, 'aluno');
  assert.strictEqual(Boolean(usuario.ativo), true);
  assert.strictEqual(usuario.senha_hash, null);
  assert.strictEqual(usuario.turma_id, turmas.json[0].id);
  assert.strictEqual((await req('POST', '/api/auth/google/cadastro-aluno', { cookie, body: dadosCadastro })).status, 409);
  assert.strictEqual((await req('GET', '/api/auth/google/cadastro-aluno')).status, 401);

  const tokenMenor = jwt.sign(
    { tipo: 'cadastro_google_aluno', email: 'google.menor@example.com', nome: 'Aluno Menor' },
    env.jwtSecret,
    { expiresIn: '15m' }
  );
  const cadastroMenor = await req('POST', '/api/auth/google/cadastro-aluno', {
    cookie: `cadastro_google=${tokenMenor}`,
    body: { nome: 'Aluno Menor', dataNascimento: '2010-01-01', turmaId: turmas.json[0].id },
  });
  assert.strictEqual(cadastroMenor.status, 400);
  assert.strictEqual(Boolean(await db('usuarios').where({ email: 'google.menor@example.com' }).first()), false);
});

test('codigo OTP tem validade de um minuto', () => {
  assert.strictEqual(otpService.VALIDADE_MS, 60 * 1000);
});

test('rotas exigem autenticacao e respeitam perfil', async () => {
  const health = await req('GET', '/api/health');
  assert.strictEqual(health.status, 200);
  assert.deepStrictEqual(health.json, { ok: true, database: 'connected' });
  assert.strictEqual((await req('GET', '/api/saidas')).status, 401);
  const aluno = await entrarDemo('aluno');
  assert.strictEqual((await req('GET', '/api/usuarios', { cookie: aluno })).status, 403);
  assert.strictEqual((await req('POST', '/api/auth/demo', { body: { role: 'responsavel' } })).status, 400);
});

test('fluxo saida antecipada - menor de idade (OTP, responsavel, gestor, professor, portaria)', async () => {
  const aluno = await entrarDemo('aluno', 'Thaina');
  const horario = dayjs().tz('America/Sao_Paulo').add(30, 'minute').format('YYYY-MM-DDTHH:mm');
  const criada = await req('POST', '/api/saidas', { cookie: aluno, body: { motivo: 'Consulta medica', horario_previsto: horario } });
  assert.strictEqual(criada.status, 201);
  assert.strictEqual(criada.json.status, 'AGUARDANDO_RESPONSAVEL');
  const id = criada.json.id;

  const emails = await req('GET', '/api/demo/emails');
  const codigo = /Codigo de verificacao: (\d{6})/.exec(emails.json[0].corpo)[1];
  assert.strictEqual(emails.json[0].destinatario, 'marisangela_batista@hotmail.com');
  const otp = await db('otps_saida').where({ saida_id: id }).first();
  assert.ok(new Date(otp.expira_em).getTime() - Date.now() <= 60 * 1000);
  assert.ok(new Date(otp.expira_em).getTime() - Date.now() > 59 * 1000);

  const errado = codigo === '000000' ? '111111' : '000000';
  assert.strictEqual((await req('POST', '/api/public/responsavel/decidir', { body: { protocolo: id, codigo: errado, decisao: 'AUTORIZO' } })).status, 400);
  const dec = await req('POST', '/api/public/responsavel/decidir', { body: { protocolo: id, codigo, decisao: 'IREI_BUSCAR' } });
  assert.strictEqual(dec.status, 200);
  const registro = await db('saidas_antecipadas').where({ id }).first();
  assert.strictEqual(registro.observacao_responsavel, null);
  assert.strictEqual((await req('POST', '/api/public/responsavel/decidir', { body: { protocolo: id, codigo, decisao: 'AUTORIZO' } })).status, 400);

  const gestor = await entrarDemo('gestor');
  assert.strictEqual((await req('POST', `/api/saidas/${id}/gestor`, { cookie: gestor, body: { decisao: 'RECUSADO' } })).status, 400);
  const aprov = await req('POST', `/api/saidas/${id}/gestor`, { cookie: gestor, body: { decisao: 'APROVADO' } });
  assert.strictEqual(aprov.json.status, 'AGUARDANDO_PORTARIA');

  const prof = await entrarDemo('professor');
  const ciente = await req('POST', `/api/saidas/${id}/ciente`, { cookie: prof });
  assert.strictEqual(ciente.json.professor_ciente, true);

  const portaria = await entrarDemo('portaria');
  const lib = await req('POST', `/api/saidas/${id}/liberar`, { cookie: portaria });
  assert.strictEqual(lib.json.status, 'LIBERADO');
  assert.ok(lib.json.horario_saida_real);
  assert.strictEqual(lib.json.responsavel_status, 'IRA_BUSCAR');
});

test('responsavel: observacao de autorizacao fica salva e aparece no fluxo interno', async () => {
  const aluno = await entrarDemo('aluno', 'Thaina');
  const horario = dayjs().tz('America/Sao_Paulo').add(30, 'minute').format('YYYY-MM-DDTHH:mm');
  const criada = await req('POST', '/api/saidas', { cookie: aluno, body: { motivo: 'Saída autorizada', horario_previsto: horario } });
  assert.strictEqual(criada.status, 201);

  const emails = await req('GET', '/api/demo/emails');
  const email = emails.json.find((m) => m.corpo.includes(`Protocolo: ${criada.json.id}\n`));
  const codigo = /Codigo de verificacao: (\d{6})/.exec(email.corpo)[1];
  const decisao = await req('POST', '/api/public/responsavel/decidir', {
    body: { protocolo: criada.json.id, codigo, decisao: 'AUTORIZO', observacao: 'Vai de ônibus com a tia.' },
  });
  assert.strictEqual(decisao.status, 200);

  const gestor = await entrarDemo('gestor');
  const saidas = await req('GET', '/api/saidas', { cookie: gestor });
  const saida = saidas.json.find((s) => s.id === criada.json.id);
  assert.strictEqual(saida.observacao_responsavel, 'Vai de ônibus com a tia.');
  assert.strictEqual((await req('POST', `/api/saidas/${criada.json.id}/cancelar`, { cookie: aluno })).status, 200);
});

test('responsavel: codigo expirado nao permite autorizar', async () => {
  const aluno = await entrarDemo('aluno', 'Thaina');
  const horario = dayjs().tz('America/Sao_Paulo').add(30, 'minute').format('YYYY-MM-DDTHH:mm');
  const criada = await req('POST', '/api/saidas', { cookie: aluno, body: { motivo: 'Saída autorizada', horario_previsto: horario } });
  assert.strictEqual(criada.status, 201);

  const emails = await req('GET', '/api/demo/emails');
  const email = emails.json.find((m) => m.corpo.includes(`Protocolo: ${criada.json.id}\n`));
  const codigo = /Codigo de verificacao: (\d{6})/.exec(email.corpo)[1];
  await db('otps_saida').where({ saida_id: criada.json.id }).update({ expira_em: new Date(Date.now() - 1).toISOString() });

  const decisao = await req('POST', '/api/public/responsavel/decidir', {
    body: { protocolo: criada.json.id, codigo, decisao: 'AUTORIZO' },
  });
  assert.strictEqual(decisao.status, 400);
  assert.strictEqual((await req('POST', `/api/saidas/${criada.json.id}/cancelar`, { cookie: aluno })).status, 200);
});

test('fluxo saida antecipada - maior de idade exige assinatura e pula responsavel', async () => {
  const aluna = await entrarDemo('aluno', 'Daniella');
  const horario = dayjs().tz('America/Sao_Paulo').add(30, 'minute').format('YYYY-MM-DDTHH:mm');
  assert.strictEqual((await req('POST', '/api/saidas', { cookie: aluna, body: { motivo: 'Compromisso', horario_previsto: horario } })).status, 400);
  const ok = await req('POST', '/api/saidas', { cookie: aluna, body: { motivo: 'Compromisso', horario_previsto: horario, assinatura: PNG } });
  assert.strictEqual(ok.status, 201);
  assert.strictEqual(ok.json.status, 'AGUARDANDO_GESTOR');
  assert.strictEqual(ok.json.responsavel_status, 'NAO_SE_APLICA');
});

test('entrada atrasada: log de horario alterado, sem notificar responsaveis e isolamento do aluno', async () => {
  const portaria = await entrarDemo('portaria');
  const alunos = await req('GET', '/api/alunos?busca=Julia', { cookie: portaria });
  assert.strictEqual(alunos.json.length, 1);
  const ajuste = dayjs().tz('America/Sao_Paulo').subtract(20, 'minute').format('YYYY-MM-DDTHH:mm');
  const r = await req('POST', '/api/entradas', { cookie: portaria, body: { aluno_id: alunos.json[0].id, motivo: 'Onibus atrasou', assinatura: PNG, horario_ajustado: ajuste } });
  assert.strictEqual(r.status, 201);
  assert.match(r.json.horario_alterado_log, /^Horário alterado pela portaria de .+ para .+$/);

  const notifResp = await db('notificacoes as n').join('usuarios as u', 'u.id', 'n.usuario_id').where('u.role', 'responsavel').count({ c: '*' }).first();
  assert.strictEqual(Number(notifResp.c), 0);

  const julia = await entrarDemo('aluno', 'Julia');
  const minhas = await req('GET', '/api/entradas', { cookie: julia });
  assert.strictEqual(minhas.json.length, 1);
  const daniella = await entrarDemo('aluno', 'Daniella');
  assert.strictEqual((await req('GET', '/api/entradas', { cookie: daniella })).json.length, 0);
});

test('demo: gestor restaura os dados e continua logado; outros perfis nao podem', async () => {
  const aluno = await entrarDemo('aluno');
  assert.strictEqual((await req('POST', '/api/demo/reset', { cookie: aluno })).status, 403);
  const gestor = await entrarDemo('gestor');
  const r = await req('POST', '/api/demo/reset', { cookie: gestor });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.json.home, '/gestor');
  const me = await req('GET', '/api/auth/me', { cookie: r.cookie });
  assert.strictEqual(me.status, 200);
  assert.strictEqual(me.json.usuario.role, 'gestor');
  assert.strictEqual((await req('GET', '/api/saidas', { cookie: r.cookie })).json.length, 0);
});

test('seed destrutivo e bloqueado em producao sem autorizacao explicita', async () => {
  const usuariosAntes = await db('usuarios').count({ total: '*' }).first();
  const nodeEnv = process.env.NODE_ENV;
  const allowSeed = process.env.ALLOW_DESTRUCTIVE_SEED;
  process.env.NODE_ENV = 'production';
  delete process.env.ALLOW_DESTRUCTIVE_SEED;
  try {
    await assert.rejects(seed(db), /Seed destrutivo bloqueado em producao/);
  } finally {
    process.env.NODE_ENV = nodeEnv;
    if (allowSeed === undefined) delete process.env.ALLOW_DESTRUCTIVE_SEED;
    else process.env.ALLOW_DESTRUCTIVE_SEED = allowSeed;
  }
  const usuariosDepois = await db('usuarios').count({ total: '*' }).first();
  assert.strictEqual(Number(usuariosDepois.total), Number(usuariosAntes.total));
});

test('gestor: CRUD de usuarios reflete imediatamente e auditoria e gravada', async () => {
  const gestor = await entrarDemo('gestor');
  const turma = (await req('GET', '/api/turmas', { cookie: gestor })).json[0];
  const novo = await req('POST', '/api/usuarios', {
    cookie: gestor,
    body: {
      nome: 'Aluno Teste',
      email: 'Teste@Aluno.com',
      role: 'aluno',
      data_nascimento: '2010-01-01',
      turma_id: turma.id,
      responsaveis: [
        { nome: 'Resp Teste', email: 'resp@teste.com' },
        { nome: 'Resp Teste Dois', email: 'resp2@teste.com' },
        { nome: 'Resp Teste Tres', email: 'resp3@teste.com' },
      ],
    },
  });
  assert.strictEqual(novo.status, 201);
  assert.strictEqual(novo.json.email, 'teste@aluno.com');
  assert.strictEqual(novo.json.responsaveis.length, 3);
  const excesso = await req('POST', '/api/usuarios', {
    cookie: gestor,
    body: {
      nome: 'Aluno Excesso',
      email: 'excesso@aluno.com',
      role: 'aluno',
      data_nascimento: '2010-01-01',
      turma_id: turma.id,
      responsaveis: [
        { nome: 'Resp Um', email: 'um@teste.com' },
        { nome: 'Resp Dois', email: 'dois@teste.com' },
        { nome: 'Resp Tres', email: 'tres@teste.com' },
        { nome: 'Resp Quatro', email: 'quatro@teste.com' },
      ],
    },
  });
  assert.strictEqual(excesso.status, 400);
  const des = await req('PATCH', `/api/usuarios/${novo.json.id}/ativo`, { cookie: gestor, body: { ativo: false } });
  assert.strictEqual(des.json.ativo, false);
  assert.strictEqual((await req('DELETE', `/api/usuarios/${novo.json.id}`, { cookie: gestor })).status, 204);
  const logs = await req('GET', '/api/logs', { cookie: gestor });
  assert.ok(logs.json.some((l) => l.acao === 'USUARIO_CRIADO'));
});

test('bootstrap cria o primeiro gestor institucional uma vez e recusa duplicacao', async () => {
  await db('usuarios').where({ role: 'gestor' }).del();
  const nomeAnterior = process.env.GESTOR_NOME;
  const emailAnterior = process.env.GESTOR_EMAIL;
  process.env.GESTOR_NOME = 'Gestor Inicial';
  process.env.GESTOR_EMAIL = 'gestor.inicial@sp.senai.br';
  try {
    const id = await criarGestorInicial();
    const gestor = await db('usuarios').where({ id }).first();
    assert.strictEqual(gestor.nome, 'Gestor Inicial');
    assert.strictEqual(gestor.email, 'gestor.inicial@sp.senai.br');
    assert.strictEqual(gestor.role, 'gestor');
    await assert.rejects(criarGestorInicial(), /Ja existe um gestor cadastrado/);
  } finally {
    if (nomeAnterior === undefined) delete process.env.GESTOR_NOME;
    else process.env.GESTOR_NOME = nomeAnterior;
    if (emailAnterior === undefined) delete process.env.GESTOR_EMAIL;
    else process.env.GESTOR_EMAIL = emailAnterior;
  }
});

test('conta de acesso total assume o perfil escolhido; as demais ficam na propria role', async () => {
  const { assinarToken } = require('../src/middlewares/auth');
  for (const email of ['g.albrecht@aluno.senai.br', 'leticia.m.cunha7@aluno.senai.br']) {
    const agora = new Date().toISOString();
    const [id] = await db('usuarios').insert({ nome: 'Total', email, role: 'aluno', ativo: true, criado_em: agora, atualizado_em: agora }).returning('id').then((r) => r.map((x) => x.id || x));
    const usuario = { id };
    for (const perfil of ['gestor', 'professor', 'portaria']) {
      const r = await req('GET', '/api/auth/me', { cookie: `token=${assinarToken(usuario, perfil)}` });
      assert.strictEqual(r.json.usuario.role, perfil);
    }
    await db('usuarios').where({ id }).del();
  }
  const normal = await db('usuarios').where({ role: 'professor' }).first();
  const r = await req('GET', '/api/auth/me', { cookie: `token=${assinarToken(normal, 'gestor')}` });
  assert.strictEqual(r.json.usuario.role, 'professor');
});

test('equipe: senha temporaria obriga a troca antes de acessar o sistema', async () => {
  const gestor = await entrarDemo('gestor');
  const senhaTemporaria = 'Temporaria-123';
  const email = `prof.senha.${Date.now()}@sp.senai.br`;
  const criado = await req('POST', '/api/usuarios', {
    cookie: gestor,
    body: { nome: 'Professor Senha', email, role: 'professor', ativo: true, senhaTemporaria, turma_ids: [] },
  });
  assert.strictEqual(criado.status, 201);
  assert.strictEqual(criado.json.deve_trocar_senha, true);
  assert.strictEqual(criado.json.senha_hash, undefined);

  const login = await req('POST', '/api/auth/senha/login', { body: { email, senha: senhaTemporaria } });
  assert.strictEqual(login.status, 200);
  assert.strictEqual(login.json.usuario.deve_trocar_senha, true);
  assert.strictEqual(login.json.usuario.senha_hash, undefined);
  assert.strictEqual((await req('GET', '/api/saidas', { cookie: login.cookie })).status, 403);
  assert.strictEqual((await req('GET', '/api/auth/me', { cookie: login.cookie })).json.usuario.deve_trocar_senha, true);

  const troca = await req('POST', '/api/auth/senha/alterar', {
    cookie: login.cookie,
    body: { senhaAtual: senhaTemporaria, novaSenha: 'Pessoal-456' },
  });
  assert.strictEqual(troca.status, 200);
  assert.strictEqual((await req('GET', '/api/auth/me', { cookie: login.cookie })).json.usuario.deve_trocar_senha, false);
  assert.strictEqual((await req('POST', '/api/auth/senha/login', { body: { email, senha: senhaTemporaria } })).status, 401);
  assert.strictEqual((await req('POST', '/api/auth/senha/login', { body: { email, senha: 'Pessoal-456' } })).status, 200);

  const logs = await db('logs_sistema').where({ acao: 'POST /api/auth/senha/login' }).orderBy('timestamp', 'desc');
  assert.ok(logs.every((log) => !String(log.dados_novos).includes(senhaTemporaria)));
});

test('aluno: código de uso único cria senha sem persistir o código em texto puro', async () => {
  const aluno = await db('usuarios').where({ role: 'aluno', ativo: true }).first();
  assert.ok(aluno);
  let corpoEnviado;
  const mailService = require('../src/services/mailService');
  const enviarOriginal = mailService.enviar;
  mailService.enviar = async (dados) => {
    corpoEnviado = dados.corpo;
    return 'TEST';
  };
  try {
    const solicitado = await req('POST', '/api/auth/senha/aluno/codigo', { body: { email: aluno.email } });
    assert.strictEqual(solicitado.status, 200);
    assert.match(solicitado.json.mensagem, /Se houver um cadastro ativo/);
    const codigo = /Seu código é: (\d{6})/.exec(corpoEnviado)[1];
    const registro = await db('codigos_senha_aluno').where({ usuario_id: aluno.id, usado: false }).first();
    assert.notStrictEqual(registro.codigo_hash, codigo);
    assert.strictEqual(
      await db('emails_log').where({ destinatario: aluno.email, assunto: 'Código para criar ou recuperar sua senha' }).count('* as total').first().then((r) => Number(r.total)),
      0
    );

    const errado = codigo === '000000' ? '000001' : '000000';
    assert.strictEqual(
      (await req('POST', '/api/auth/senha/aluno/definir', { body: { email: aluno.email, codigo: errado, senha: 'Senha-Aluno-789' } })).status,
      400
    );
    const definida = await req('POST', '/api/auth/senha/aluno/definir', {
      body: { email: aluno.email, codigo, senha: 'Senha-Aluno-789' },
    });
    assert.strictEqual(definida.status, 200);
    assert.strictEqual((await db('codigos_senha_aluno').where({ id: registro.id }).first()).usado, 1);
    assert.strictEqual((await req('POST', '/api/auth/senha/aluno/definir', {
      body: { email: aluno.email, codigo, senha: 'Outra-Senha-789' },
    })).status, 400);
    const login = await req('POST', '/api/auth/senha/login', { body: { email: aluno.email, senha: 'Senha-Aluno-789' } });
    assert.strictEqual(login.status, 200);
    assert.strictEqual(login.json.usuario.role, 'aluno');
    assert.strictEqual(login.json.usuario.senha_hash, undefined);
  } finally {
    mailService.enviar = enviarOriginal;
  }
});

test('cadastro público: aluno confirma qualquer e-mail e ativa a própria conta', async () => {
  const turma = (await req('GET', '/api/public/turmas')).json[0];
  assert.ok(turma);
  const email = `cadastro.${Date.now()}@gmail.com`;
  const nascimento = '2010-01-01';
  const responsavelEmail = `responsavel.${Date.now()}@outlook.com`;
  const body = {
    nome: 'Aluno de Cadastro',
    email,
    dataNascimento: nascimento,
    turmaId: turma.id,
    responsavelNome: 'Responsável de Cadastro',
    responsavelEmail,
  };
  let corpoEnviado;
  const mailService = require('../src/services/mailService');
  const enviarOriginal = mailService.enviar;
  let emailsEnviados = 0;
  mailService.enviar = async (dados) => {
    emailsEnviados += 1;
    corpoEnviado = dados.corpo;
    return 'TEST';
  };
  try {
    const solicitado = await req('POST', '/api/auth/senha/aluno/cadastro/codigo', { body });
    assert.strictEqual(solicitado.status, 200);
    assert.match(solicitado.json.mensagem, /Se o e-mail puder ser usado/);
    assert.strictEqual(await db('usuarios').where({ email }).first(), undefined);
    const pendente = await db('cadastros_aluno_pendentes').where({ email }).first();
    assert.ok(pendente);
    const codigo = /Seu código de confirmação é: (\d{6})/.exec(corpoEnviado)[1];
    assert.notStrictEqual(pendente.codigo_hash, codigo);

    const errado = codigo === '000000' ? '000001' : '000000';
    const respostaErrada = await req('POST', '/api/auth/senha/aluno/cadastro/confirmar', {
      body: { email, codigo: errado, senha: 'Aluno-Senha-123' },
    });
    assert.strictEqual(respostaErrada.status, 400);
    assert.strictEqual((await db('cadastros_aluno_pendentes').where({ email }).first()).tentativas, 1);

    const confirmado = await req('POST', '/api/auth/senha/aluno/cadastro/confirmar', {
      body: { email, codigo, senha: 'Aluno-Senha-123' },
    });
    assert.strictEqual(confirmado.status, 201);
    const aluno = await db('usuarios').where({ email }).first();
    assert.strictEqual(aluno.role, 'aluno');
    assert.strictEqual(aluno.ativo, 1);
    assert.strictEqual(aluno.data_nascimento, nascimento);
    assert.strictEqual(aluno.turma_id, turma.id);
    assert.strictEqual(aluno.deve_trocar_senha, 0);
    assert.strictEqual(await db('cadastros_aluno_pendentes').where({ email }).first(), undefined);

    const responsavel = await db('aluno_responsavel as ar')
      .join('usuarios as r', 'r.id', 'ar.responsavel_id')
      .where({ 'ar.aluno_id': aluno.id })
      .first('r.nome', 'r.email');
    assert.deepStrictEqual(responsavel, { nome: 'Responsável de Cadastro', email: responsavelEmail });
    assert.strictEqual((await req('POST', '/api/auth/senha/login', { body: { email, senha: 'Aluno-Senha-123' } })).status, 200);

    const duplicado = await req('POST', '/api/auth/senha/aluno/cadastro/codigo', { body });
    assert.strictEqual(duplicado.json.mensagem, solicitado.json.mensagem);
    assert.strictEqual(emailsEnviados, 1);
  } finally {
    mailService.enviar = enviarOriginal;
  }
});

test('turmas: somente gestor pode criar e novas turmas aparecem no cadastro público', async () => {
  const aluno = await entrarDemo('aluno');
  assert.strictEqual((await req('POST', '/api/turmas', { cookie: aluno, body: { nome: 'DEV 3', curso: 'Desenvolvimento' } })).status, 403);
  const gestor = await entrarDemo('gestor');
  const corpo = { nome: 'Turma Cadastro', curso: 'Curso Teste' };
  const criada = await req('POST', '/api/turmas', { cookie: gestor, body: corpo });
  assert.strictEqual(criada.status, 201);
  assert.strictEqual(criada.json.nome, corpo.nome);
  assert.strictEqual(criada.json.curso, corpo.curso);
  const publicas = await req('GET', '/api/public/turmas');
  assert.ok(publicas.json.some((turma) => turma.id === criada.json.id));
  assert.strictEqual((await req('POST', '/api/turmas', { cookie: gestor, body: corpo })).status, 409);
  assert.strictEqual((await req('POST', '/api/turmas', { cookie: gestor, body: { nome: '', curso: '' } })).status, 400);
});
