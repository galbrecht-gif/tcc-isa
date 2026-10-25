const test = require('node:test');
const assert = require('node:assert');
const os = require('os');
const path = require('path');
const fs = require('fs');

const dbFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tcc-')), 'test.sqlite');
process.env.DB_FILENAME = dbFile;
process.env.DEMO_MODE = 'true';
process.env.NODE_ENV = 'test';

const db = require('../src/config/database');
const app = require('../src/server');
const seed = require('../database/seed');
const { calcularIdade } = require('../src/services/dateService');
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

test('rotas exigem autenticacao e respeitam perfil', async () => {
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

  const errado = codigo === '000000' ? '111111' : '000000';
  assert.strictEqual((await req('POST', '/api/public/responsavel/decidir', { body: { protocolo: id, codigo: errado, decisao: 'AUTORIZO' } })).status, 400);
  const dec = await req('POST', '/api/public/responsavel/decidir', { body: { protocolo: id, codigo, decisao: 'IREI_BUSCAR' } });
  assert.strictEqual(dec.status, 200);
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

test('gestor: CRUD de usuarios reflete imediatamente e auditoria e gravada', async () => {
  const gestor = await entrarDemo('gestor');
  const turma = (await req('GET', '/api/turmas', { cookie: gestor })).json[0];
  const novo = await req('POST', '/api/usuarios', {
    cookie: gestor,
    body: { nome: 'Aluno Teste', email: 'Teste@Aluno.com', role: 'aluno', data_nascimento: '2010-01-01', turma_id: turma.id, responsaveis: [{ nome: 'Resp Teste', email: 'resp@teste.com' }] },
  });
  assert.strictEqual(novo.status, 201);
  assert.strictEqual(novo.json.email, 'teste@aluno.com');
  assert.strictEqual(novo.json.responsaveis.length, 1);
  const des = await req('PATCH', `/api/usuarios/${novo.json.id}/ativo`, { cookie: gestor, body: { ativo: false } });
  assert.strictEqual(des.json.ativo, false);
  assert.strictEqual((await req('DELETE', `/api/usuarios/${novo.json.id}`, { cookie: gestor })).status, 204);
  const logs = await req('GET', '/api/logs', { cookie: gestor });
  assert.ok(logs.json.some((l) => l.acao === 'USUARIO_CRIADO'));
});
