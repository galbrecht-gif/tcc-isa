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
process.env.SMTP_HOST = '';
process.env.DEMO_MODE = 'true';
process.env.NODE_ENV = 'test';

const db = require('../src/config/database');
const app = require('../src/server');
const seed = require('../database/seed');
const env = require('../src/config/env');
const { calcularIdade, localParaISO } = require('../src/services/dateService');
const { emailPermitidoParaPerfil, perfisPermitidos } = require('../src/config/equipePermitida');
const otpService = require('../src/services/otpService');
const criarGestorInicial = require('../scripts/criar-gestor-inicial');
const definirSenhaEquipe = require('../scripts/definir-senha-equipe');
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

test('perfis de equipe aceitam somente e-mails explicitamente autorizados', () => {
  assert.deepStrictEqual(perfisPermitidos(' LMENEZES@SP.SENAI.BR '), ['gestor', 'portaria']);
  assert.strictEqual(emailPermitidoParaPerfil('edilson.ferreira@sp.senai.br', 'professor'), true);
  assert.strictEqual(emailPermitidoParaPerfil('edilson.ferreira@sp.senai.br', 'gestor'), false);
  assert.strictEqual(emailPermitidoParaPerfil('pessoa@sp.senai.br', 'gestor'), false);
  assert.strictEqual(emailPermitidoParaPerfil('pessoa@gmail.com', 'professor'), false);
  for (const email of [
    'g.albrecht@aluno.senai.br',
    'isabelly.d.rosa@aluno.senai.br',
    'leticia.m.cunha7@aluno.senai.br',
  ]) {
    assert.deepStrictEqual(perfisPermitidos(email), ['aluno', 'professor', 'gestor', 'portaria']);
  }
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
  const senhaAnterior = process.env.GESTOR_SENHA_TEMPORARIA;
  process.env.GESTOR_NOME = 'Gestor Inicial';
  process.env.GESTOR_EMAIL = 'lmenezes@sp.senai.br';
  process.env.GESTOR_SENHA_TEMPORARIA = 'Temporaria-123';
  try {
    const id = await criarGestorInicial();
    const gestor = await db('usuarios').where({ id }).first();
    assert.strictEqual(gestor.nome, 'Gestor Inicial');
    assert.strictEqual(gestor.email, 'lmenezes@sp.senai.br');
    assert.strictEqual(gestor.role, 'gestor');
    assert.strictEqual(Boolean(gestor.deve_trocar_senha), true);
    await assert.rejects(criarGestorInicial(), /Ja existe um gestor cadastrado/);
    const login = await req('POST', '/api/auth/senha/login', {
      body: { email: gestor.email, senha: 'Temporaria-123' },
    });
    assert.strictEqual(login.status, 200);
    assert.strictEqual((await req('POST', '/api/auth/senha/alterar', {
      cookie: login.cookie,
      body: { senhaAtual: 'Temporaria-123', novaSenha: 'Senha-Gestor-456' },
    })).status, 200);
  } finally {
    if (nomeAnterior === undefined) delete process.env.GESTOR_NOME;
    else process.env.GESTOR_NOME = nomeAnterior;
    if (emailAnterior === undefined) delete process.env.GESTOR_EMAIL;
    else process.env.GESTOR_EMAIL = emailAnterior;
    if (senhaAnterior === undefined) delete process.env.GESTOR_SENHA_TEMPORARIA;
    else process.env.GESTOR_SENHA_TEMPORARIA = senhaAnterior;
  }
});

test('gestor autorizado pode escolher Gestor ou Portaria, mas nao outro perfil', async () => {
  const gestor = await db('usuarios').where({ email: 'lmenezes@sp.senai.br', role: 'gestor' }).first();
  const senha = 'Senha-Gestor-456';
  const portaria = await req('POST', '/api/auth/senha/login', {
    body: { email: gestor.email, senha, perfil: 'portaria' },
  });
  assert.strictEqual(portaria.status, 200);
  assert.strictEqual(portaria.json.usuario.role, 'portaria');
  assert.strictEqual((await req('GET', '/api/auth/me', { cookie: portaria.cookie })).json.usuario.role, 'portaria');
  const invalido = await req('POST', '/api/auth/senha/login', {
    body: { email: gestor.email, senha, perfil: 'professor' },
  });
  assert.strictEqual(invalido.status, 401);
});

test('contas autorizadas para acesso completo podem entrar pelos atalhos de cada perfil', async () => {
  const turma = (await req('GET', '/api/public/turmas')).json[0];
  const emails = [
    'g.albrecht@aluno.senai.br',
    'isabelly.d.rosa@aluno.senai.br',
    'leticia.m.cunha7@aluno.senai.br',
  ];
  const senha = 'Acesso-Completo-123';
  const usuariosNovos = [];
  const usuariosExistentes = [];
  try {
    for (const [indice, email] of emails.entries()) {
      const senhaHash = await require('../src/services/passwordService').hashSenha(senha);
      const existente = await db('usuarios').where({ email }).first();
      if (existente) {
        usuariosExistentes.push(existente);
        await db('usuarios').where({ id: existente.id }).update({
          role: 'aluno',
          ativo: true,
          senha_hash: senhaHash,
          deve_trocar_senha: false,
        });
      } else {
        const id = await require('../src/models/usuarioModel').criar({
          nome: 'Conta de acesso completo',
          email,
          role: 'aluno',
          ativo: true,
          senhaHash,
          data_nascimento: '2000-01-01',
          turma_id: turma.id,
          responsaveis: [],
        });
        usuariosNovos.push(id);
      }

      const perfilAtalho = ['gestor', 'professor', 'portaria'][indice];
      let loginJson;
      let loginCookie;
      await require('../src/controllers/authController').entrarComSenha(
        { body: { email, senha, perfil: perfilAtalho }, ip: '127.0.0.1' },
        {
          cookie: (nome, valor) => { if (nome === 'token') loginCookie = valor; },
          json: (dados) => { loginJson = dados; },
        }
      );
      assert.strictEqual(loginJson.usuario.role, perfilAtalho);
      assert.strictEqual((await req('GET', '/api/auth/me', { cookie: `token=${loginCookie}` })).json.usuario.role, perfilAtalho);

      const { assinarToken } = require('../src/middlewares/auth');
      for (const perfil of ['aluno', 'gestor', 'professor', 'portaria']) {
        const token = assinarToken({ id: loginJson.usuario.id }, perfil);
        const me = await req('GET', '/api/auth/me', { cookie: `token=${token}` });
        assert.strictEqual(me.status, 200, `${email} deve poder usar o atalho ${perfil}`);
        assert.strictEqual(me.json.usuario.role, perfil);
      }

      let googleCookie;
      let googleRedirect;
      require('../src/controllers/authController').googleCallback(
        { cookies: { perfil_login: perfilAtalho }, user: { id: loginJson.usuario.id, email, role: 'aluno' }, ip: '127.0.0.1' },
        {
          clearCookie: () => {},
          cookie: (nome, valor) => { if (nome === 'token') googleCookie = valor; },
          redirect: (destino) => { googleRedirect = destino; },
        }
      );
      assert.strictEqual(googleRedirect.endsWith('/auth/callback'), true);
      assert.strictEqual((await req('GET', '/api/auth/me', { cookie: `token=${googleCookie}` })).json.usuario.role, perfilAtalho);
    }

  } finally {
    if (usuariosNovos.length) await db('usuarios').whereIn('id', usuariosNovos).del();
    for (const usuario of usuariosExistentes) {
      const { id, ...dados } = usuario;
      await db('usuarios').where({ id }).update(dados);
    }
  }
});

test('equipe: senha temporaria obriga a troca antes de acessar o sistema', async () => {
  const gestor = await entrarDemo('gestor');
  const senhaTemporaria = 'Temporaria-123';
  const email = 'edilson.ferreira@sp.senai.br';
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

test('gestor pode cadastrar professor com novo e-mail e primeiro login exige senha pessoal', async () => {
  const gestor = await entrarDemo('gestor');
  const email = `professor.novo.${Date.now()}@exemplo.com`;
  const senhaTemporaria = 'Senai@123';
  const criado = await req('POST', '/api/usuarios', {
    cookie: gestor,
    body: { nome: 'Professor Novo', email, role: 'professor', ativo: true, senhaTemporaria, turma_ids: [] },
  });
  assert.strictEqual(criado.status, 201);
  assert.strictEqual(criado.json.role, 'professor');
  assert.strictEqual(criado.json.deve_trocar_senha, true);

  const login = await req('POST', '/api/auth/senha/login', { body: { email, senha: senhaTemporaria } });
  assert.strictEqual(login.status, 200);
  assert.strictEqual(login.json.usuario.role, 'professor');
  assert.strictEqual(login.json.usuario.deve_trocar_senha, true);
  assert.strictEqual((await req('GET', '/api/turmas', { cookie: login.cookie })).status, 403);

  const troca = await req('POST', '/api/auth/senha/alterar', {
    cookie: login.cookie,
    body: { senhaAtual: senhaTemporaria, novaSenha: 'Professor-Pessoal-456' },
  });
  assert.strictEqual(troca.status, 200);
  assert.strictEqual((await req('GET', '/api/auth/me', { cookie: login.cookie })).json.usuario.deve_trocar_senha, false);
  assert.strictEqual((await req('POST', '/api/auth/senha/login', {
    body: { email, senha: 'Professor-Pessoal-456' },
  })).json.usuario.role, 'professor');
  assert.strictEqual((await req('POST', '/api/auth/senha/login', {
    body: { email, senha: 'Professor-Pessoal-456', perfil: 'gestor' },
  })).status, 401);
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

test('cadastro público: cria aluno com senha sem depender de confirmação por e-mail', async () => {
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
    senha: 'Aluno-Senha-123',
  };
  const criado = await req('POST', '/api/auth/senha/aluno/cadastro', { body });
  assert.strictEqual(criado.status, 201);
  assert.match(criado.json.mensagem, /Conta criada/);
  const aluno = await db('usuarios').where({ email }).first();
  assert.strictEqual(aluno.role, 'aluno');
  assert.strictEqual(aluno.ativo, 1);
  assert.ok(aluno.senha_hash);
  assert.notStrictEqual(aluno.senha_hash, body.senha);
  assert.strictEqual(aluno.data_nascimento, nascimento);
  assert.strictEqual(aluno.turma_id, turma.id);
  assert.strictEqual(aluno.deve_trocar_senha, 0);
  assert.strictEqual(await db('cadastros_aluno_pendentes').where({ email }).first(), undefined);
  assert.strictEqual(await db('emails_log').where({ destinatario: email }).first(), undefined);

  const responsavel = await db('aluno_responsavel as ar')
    .join('usuarios as r', 'r.id', 'ar.responsavel_id')
    .where({ 'ar.aluno_id': aluno.id })
    .first('r.nome', 'r.email');
  assert.deepStrictEqual(responsavel, { nome: 'Responsável de Cadastro', email: responsavelEmail });
  assert.strictEqual((await req('POST', '/api/auth/senha/login', { body: { email, senha: body.senha } })).status, 200);

  const duplicado = await req('POST', '/api/auth/senha/aluno/cadastro', { body });
  assert.strictEqual(duplicado.status, 409);

  const senhaInvalidaEmail = `cadastro.invalido.${Date.now()}@gmail.com`;
  const senhaInvalida = await req('POST', '/api/auth/senha/aluno/cadastro', {
    body: { ...body, email: senhaInvalidaEmail, senha: 'curta' },
  });
  assert.strictEqual(senhaInvalida.status, 400);
  assert.strictEqual(await db('usuarios').where({ email: senhaInvalidaEmail }).first(), undefined);
});

test('recuperação de senha: falha SMTP não deixa código ativo', async () => {
  const aluno = await db('usuarios').where({ role: 'aluno', ativo: true }).first();
  const redefinicao = await req('POST', '/api/auth/senha/aluno/codigo', { body: { email: aluno.email } });
  assert.strictEqual(redefinicao.status, 503);
  assert.strictEqual(await db('codigos_senha_aluno').where({ usuario_id: aluno.id, usado: false }).first(), undefined);
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

test('cursos: gestor acompanha inscritos e professor ve somente as turmas vinculadas', async () => {
  const gestor = await entrarDemo('gestor');
  const professor = await entrarDemo('professor');
  const professorLogado = await req('GET', '/api/auth/me', { cookie: professor });
  const Usuario = require('../src/models/usuarioModel');
  const outroProfessorId = await Usuario.criar({
    nome: 'Professor sem turma',
    email: `professor.sem.turma.${Date.now()}@sp.senai.br`,
    role: 'professor',
    ativo: true,
    turma_ids: [],
  });
  const outroProfessor = { id: outroProfessorId };
  const tokenOutroProfessor = require('../src/middlewares/auth').assinarToken({ id: outroProfessor.id });
  const nomeTurma = `Turma Cursos ${Date.now()}`;
  const criada = await req('POST', '/api/turmas', { cookie: gestor, body: { nome: nomeTurma, curso: 'Curso com Inscritos' } });
  assert.strictEqual(criada.status, 201);

  const semProfessor = await req('PATCH', `/api/turmas/${criada.json.id}/professor`, {
    cookie: professor,
    body: { professor_id: professorLogado.json.usuario.id },
  });
  assert.strictEqual(semProfessor.status, 403);

  const vinculada = await req('PATCH', `/api/turmas/${criada.json.id}/professor`, {
    cookie: gestor,
    body: { professor_id: professorLogado.json.usuario.id },
  });
  assert.strictEqual(vinculada.status, 200);

  const alunoId = await require('../src/models/usuarioModel').criar({
    nome: 'Aluno da Turma Registrado',
    email: `aluno.curso.${Date.now()}@gmail.com`,
    role: 'aluno',
    ativo: true,
    data_nascimento: '2005-01-01',
    turma_id: criada.json.id,
    responsaveis: [],
  });
  try {
    const cursosGestor = await req('GET', '/api/turmas', { cookie: gestor });
    const turmaGestor = cursosGestor.json.find((turma) => turma.id === criada.json.id);
    assert.strictEqual(turmaGestor.professor_id, professorLogado.json.usuario.id);
    assert.strictEqual(turmaGestor.professor_nome, professorLogado.json.usuario.nome);
    assert.strictEqual(turmaGestor.alunos_count, 1);

    const cursosProfessor = await req('GET', '/api/turmas', { cookie: professor });
    assert.ok(cursosProfessor.json.some((turma) => turma.id === criada.json.id));
    const alunos = await req('GET', `/api/turmas/${criada.json.id}/alunos`, { cookie: professor });
    assert.deepStrictEqual(alunos.json.map((aluno) => aluno.nome), ['Aluno da Turma Registrado']);
    assert.strictEqual((await req('GET', `/api/turmas/${criada.json.id}/alunos`, { cookie: `token=${tokenOutroProfessor}` })).status, 403);
  } finally {
    await db('usuarios').where({ id: alunoId }).del();
    await db('usuarios').where({ id: outroProfessorId }).del();
  }
});

test('senha temporaria padrao atualiza somente contas de equipe autorizadas e exige troca', async () => {
  const emailNaoAutorizado = `nao.autorizado.${Date.now()}@sp.senai.br`;
  const [idNaoAutorizado] = await db('usuarios').insert({
    nome: 'Professor não autorizado',
    email: emailNaoAutorizado,
    role: 'professor',
    ativo: true,
    criado_em: new Date().toISOString(),
    atualizado_em: new Date().toISOString(),
  }).returning('id').then((rows) => rows.map((row) => row.id || row));

  try {
    const resultado = await definirSenhaEquipe('Senai@123');
    assert.ok(resultado.atualizados > 0);
    assert.ok(resultado.criadas > 0);

    const gestores = await db('usuarios').whereIn('email', [
      'lmenezes@sp.senai.br',
      'lucineide.melo@sp.senai.br',
      'rosângela.garcia@dp.senai.br',
      'marcelo.fazan@sp.senai.br',
      'luiscarvalho@sp.senai.br',
      'gguimarães@sp.senai.br',
    ]);
    assert.strictEqual(gestores.length, 6);
    assert.ok(gestores.every((usuario) => usuario.role === 'gestor' && usuario.deve_trocar_senha && usuario.senha_hash));

    const professores = await db('usuarios').whereIn('email', ['edilson.ferreira@sp.senai.br', 'marcos.rnunes@sp.senai.br']);
    assert.strictEqual(professores.length, 2);
    for (const professor of professores) {
      assert.strictEqual(professor.role, 'professor');
      assert.strictEqual(Boolean(professor.deve_trocar_senha), true);
      assert.ok(professor.senha_hash);
    }

    const gestor = await db('usuarios').where({ email: 'lmenezes@sp.senai.br', role: 'gestor' }).first();
    assert.strictEqual(Boolean(gestor.deve_trocar_senha), true);
    const login = await req('POST', '/api/auth/senha/login', {
      body: { email: gestor.email, senha: 'Senai@123' },
    });
    assert.strictEqual(login.status, 200);
    assert.strictEqual(login.json.usuario.deve_trocar_senha, true);
    assert.strictEqual((await req('GET', '/api/turmas', { cookie: login.cookie })).status, 403);
    const troca = await req('POST', '/api/auth/senha/alterar', {
      cookie: login.cookie,
      body: { senhaAtual: 'Senai@123', novaSenha: 'Senha-Gestor-789' },
    });
    assert.strictEqual(troca.status, 200);
    assert.strictEqual((await req('POST', '/api/auth/senha/login', {
      body: { email: gestor.email, senha: 'Senai@123' },
    })).status, 401);

    const naoAutorizado = await db('usuarios').where({ id: idNaoAutorizado }).first();
    assert.strictEqual(naoAutorizado.senha_hash, null);
    assert.strictEqual(Boolean(naoAutorizado.deve_trocar_senha), false);

  } finally {
    await db('usuarios').where({ id: idNaoAutorizado }).del();
  }
});
