const db = require('../config/database');
const otpService = require('../services/otpService');
const notif = require('../services/notificacaoService');
const HttpError = require('../services/HttpError');
const env = require('../config/env');
const { agoraISO } = require('../services/dateService');

const MSG_INVALIDO = 'Codigo invalido ou expirado.';
const DECISOES = { AUTORIZO: 'AUTORIZADO', IREI_BUSCAR: 'IRA_BUSCAR', NAO_AUTORIZO: 'NAO_AUTORIZADO' };

async function carregarSolicitacao(id) {
  return db('saidas_antecipadas as s')
    .join('usuarios as a', 'a.id', 's.aluno_id')
    .where('s.id', id)
    .select('s.id', 's.motivo', 's.horario_previsto', 's.status', 'a.nome as aluno_nome', 'a.id as aluno_id', 'a.turma_id')
    .first();
}

exports.consultar = async (req, res) => {
  const id = Number(req.body.protocolo);
  const s = Number.isInteger(id) ? await carregarSolicitacao(id) : null;
  if (!s || s.status !== 'AGUARDANDO_RESPONSAVEL') throw new HttpError(400, MSG_INVALIDO);
  if (!(await otpService.validar(id, req.body.codigo))) throw new HttpError(400, MSG_INVALIDO);
  res.json({ protocolo: s.id, aluno_nome: s.aluno_nome, motivo: s.motivo, horario_previsto: s.horario_previsto });
};

exports.decidir = async (req, res) => {
  const id = Number(req.body.protocolo);
  const decisao = DECISOES[req.body.decisao];
  if (!decisao) throw new HttpError(400, 'Decisao invalida.');
  const s = Number.isInteger(id) ? await carregarSolicitacao(id) : null;
  if (!s || s.status !== 'AGUARDANDO_RESPONSAVEL') throw new HttpError(400, MSG_INVALIDO);
  const otp = await otpService.validar(id, req.body.codigo);
  if (!otp) throw new HttpError(400, MSG_INVALIDO);

  const agora = agoraISO();
  const recusado = decisao === 'NAO_AUTORIZADO';
  const ok = await db.transaction(async (trx) => {
    if (!(await otpService.consumir(otp.id, trx))) return false;
    const n = await trx('saidas_antecipadas').where({ id, status: 'AGUARDANDO_RESPONSAVEL' }).update({
      responsavel_status: decisao,
      responsavel_decisao_em: agora,
      status: recusado ? 'RECUSADO' : 'AGUARDANDO_GESTOR',
      atualizado_em: agora,
    });
    return n === 1;
  });
  if (!ok) throw new HttpError(400, MSG_INVALIDO);

  const rotulo = { AUTORIZADO: 'autorizou', IRA_BUSCAR: 'informou que ira buscar', NAO_AUTORIZADO: 'nao autorizou' }[decisao];
  await notif.notificar([s.aluno_id], {
    titulo: 'Resposta do responsavel',
    mensagem: `O responsavel ${rotulo} sua saida antecipada.`,
    link: '/aluno',
  });
  if (!recusado) {
    await notif.notificar(await notif.idsPorRole('gestor'), {
      titulo: 'Saida antecipada aguardando aprovacao',
      mensagem: `${s.aluno_nome}: responsavel ${rotulo}.`,
      link: '/gestor',
    });
  }
  res.locals.audit = { acao: `SAIDA_RESPONSAVEL_${decisao}`, usuarioId: null, antes: { status: s.status }, depois: { protocolo: id, decisao } };
  res.json({ ok: true, decisao });
};

// Somente em modo demo (nunca em producao): lista e-mails recentes com codigos para simular o responsavel.
exports.emailsDemo = async (req, res) => {
  if (!env.demoMode) throw new HttpError(404, 'Modo demo desativado.');
  const rows = await db('emails_log').where('assunto', 'like', 'Autorizacao de saida%').orderBy('id', 'desc').limit(10);
  res.json(rows);
};
