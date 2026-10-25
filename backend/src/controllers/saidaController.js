const db = require('../config/database');
const env = require('../config/env');
const Saida = require('../models/saidaModel');
const Usuario = require('../models/usuarioModel');
const otpService = require('../services/otpService');
const mailService = require('../services/mailService');
const notif = require('../services/notificacaoService');
const HttpError = require('../services/HttpError');
const { agoraISO, localParaISO, calcularIdade, formatarSP } = require('../services/dateService');

const ABERTOS = ['AGUARDANDO_RESPONSAVEL', 'AGUARDANDO_GESTOR', 'AGUARDANDO_PORTARIA'];

async function enviarOtpAosResponsaveis(saida, aluno, codigo) {
  const responsaveis = await db('aluno_responsavel as ar')
    .join('usuarios as r', 'r.id', 'ar.responsavel_id')
    .where('ar.aluno_id', aluno.id)
    .where('r.ativo', true)
    .select('r.nome', 'r.email');
  for (const r of responsaveis) {
    await mailService.enviar({
      para: r.email,
      assunto: `Autorizacao de saida antecipada - ${aluno.nome}`,
      corpo:
        `Ola, ${r.nome}.\n\n${aluno.nome} solicitou saida antecipada em ${formatarSP(saida.horario_previsto)}.\n` +
        `Motivo: ${saida.motivo}\n\nProtocolo: ${saida.id}\nCodigo de verificacao: ${codigo} (valido por 15 minutos, uso unico)\n\n` +
        `Acesse: ${env.frontendUrl}/responsavel/validar?protocolo=${saida.id}\n`,
    });
  }
  return responsaveis.length;
}

exports.listar = async (req, res) => {
  const { status, turma_id: turmaId, de, ate } = req.query;
  res.json(await Saida.listar(req.user, { status, turmaId, de, ate }));
};

exports.obter = async (req, res) => {
  const saida = await Saida.buscar(req.user, Number(req.params.id));
  if (!saida) throw new HttpError(404, 'Solicitacao nao encontrada.');
  const ass = saida.tem_assinatura ? (await Saida.assinatura(saida.id)).assinatura : null;
  res.json({ ...saida, assinatura: req.user.role === 'responsavel' ? null : ass });
};

exports.criar = async (req, res) => {
  const aluno = req.user;
  const { motivo, horario_previsto: horario, assinatura } = req.body || {};
  const motivoTxt = String(motivo || '').trim();
  if (motivoTxt.length < 5 || motivoTxt.length > 500) throw new HttpError(400, 'Informe o motivo (5 a 500 caracteres).');
  const previsto = localParaISO(horario);
  if (!previsto) throw new HttpError(400, 'Horario de saida invalido.');
  if (new Date(previsto).getTime() < Date.now() - 10 * 60 * 1000) throw new HttpError(400, 'O horario de saida nao pode estar no passado.');
  if (!aluno.data_nascimento) throw new HttpError(422, 'Aluno sem data de nascimento cadastrada.');

  const aberta = await db('saidas_antecipadas').where({ aluno_id: aluno.id }).whereIn('status', ABERTOS).first();
  if (aberta) throw new HttpError(409, 'Ja existe uma solicitacao em andamento.');

  const menor = calcularIdade(aluno.data_nascimento) < 18;
  if (menor) {
    const n = await db('aluno_responsavel as ar').join('usuarios as r', 'r.id', 'ar.responsavel_id').where({ 'ar.aluno_id': aluno.id, 'r.ativo': true }).count({ c: '*' }).first();
    if (!Number(n.c)) throw new HttpError(422, 'Aluno menor de idade sem responsavel ativo vinculado. Procure a gestao.');
  } else if (!assinatura || typeof assinatura !== 'string' || !assinatura.startsWith('data:image/')) {
    throw new HttpError(400, 'A assinatura digital e obrigatoria para maiores de 18 anos.');
  }

  const agora = agoraISO();
  const { id, codigo } = await db.transaction(async (trx) => {
    const [ins] = await trx('saidas_antecipadas').insert({
      aluno_id: aluno.id,
      motivo: motivoTxt,
      horario_previsto: previsto,
      fluxo_menor: menor,
      status: menor ? 'AGUARDANDO_RESPONSAVEL' : 'AGUARDANDO_GESTOR',
      responsavel_status: menor ? 'PENDENTE' : 'NAO_SE_APLICA',
      gestor_status: 'PENDENTE',
      assinatura: menor ? null : assinatura,
      criado_em: agora,
      atualizado_em: agora,
    });
    const novoId = typeof ins === 'object' ? ins.id : ins;
    const cod = menor ? await otpService.gerar(novoId, trx) : null;
    return { id: novoId, codigo: cod };
  });

  const saida = await Saida.buscarBruto(id);
  if (menor) {
    await enviarOtpAosResponsaveis(saida, aluno, codigo);
  } else {
    await notif.notificar(await notif.idsPorRole('gestor'), {
      titulo: 'Nova solicitacao de saida antecipada',
      mensagem: `${aluno.nome} solicitou saida antecipada.`,
      link: '/gestor',
    });
  }
  res.locals.audit = { acao: 'SAIDA_CRIADA', depois: { id, fluxo_menor: menor, motivo: motivoTxt } };
  res.status(201).json(await Saida.buscar(req.user, id));
};

exports.reenviarOtp = async (req, res) => {
  const saida = await Saida.buscarBruto(Number(req.params.id));
  if (!saida || saida.aluno_id !== req.user.id) throw new HttpError(404, 'Solicitacao nao encontrada.');
  if (saida.status !== 'AGUARDANDO_RESPONSAVEL') throw new HttpError(409, 'A solicitacao nao aguarda o responsavel.');
  const codigo = await otpService.gerar(saida.id);
  await enviarOtpAosResponsaveis(saida, req.user, codigo);
  res.locals.audit = { acao: 'SAIDA_OTP_REENVIADO', depois: { id: saida.id } };
  res.json({ ok: true });
};

exports.cancelar = async (req, res) => {
  const saida = await Saida.buscarBruto(Number(req.params.id));
  if (!saida || saida.aluno_id !== req.user.id) throw new HttpError(404, 'Solicitacao nao encontrada.');
  if (!['AGUARDANDO_RESPONSAVEL', 'AGUARDANDO_GESTOR'].includes(saida.status)) throw new HttpError(409, 'Solicitacao nao pode mais ser cancelada.');
  await db('saidas_antecipadas').where({ id: saida.id }).update({ status: 'CANCELADO', atualizado_em: agoraISO() });
  await db('otps_saida').where({ saida_id: saida.id }).update({ usado: true });
  res.locals.audit = { acao: 'SAIDA_CANCELADA', antes: { status: saida.status }, depois: { status: 'CANCELADO' } };
  res.json(await Saida.buscar(req.user, saida.id));
};

exports.decisaoGestor = async (req, res) => {
  const { decisao, justificativa } = req.body || {};
  if (!['APROVADO', 'RECUSADO'].includes(decisao)) throw new HttpError(400, 'Decisao invalida.');
  const just = String(justificativa || '').trim();
  if (decisao === 'RECUSADO' && just.length < 3) throw new HttpError(400, 'Justificativa obrigatoria para recusa.');

  const saida = await Saida.buscarBruto(Number(req.params.id));
  if (!saida) throw new HttpError(404, 'Solicitacao nao encontrada.');
  const agora = agoraISO();
  const n = await db('saidas_antecipadas')
    .where({ id: saida.id, status: 'AGUARDANDO_GESTOR' })
    .update({
      gestor_status: decisao,
      gestor_id: req.user.id,
      gestor_justificativa: just || null,
      gestor_decisao_em: agora,
      status: decisao === 'APROVADO' ? 'AGUARDANDO_PORTARIA' : 'RECUSADO',
      atualizado_em: agora,
    });
  if (!n) throw new HttpError(409, 'Solicitacao nao esta aguardando o gestor.');

  const aluno = await Usuario.buscarPorId(saida.aluno_id);
  if (decisao === 'APROVADO') {
    const prof = await notif.idProfessorDaTurma(aluno.turma_id);
    await notif.notificar(prof, {
      titulo: 'Saida antecipada aprovada - ciencia',
      mensagem: `${aluno.nome} teve a saida antecipada aprovada pela gestao. Confirme a ciencia.`,
      link: '/professor',
    });
    await notif.notificar(await notif.idsPorRole('portaria'), {
      titulo: 'Saida aguardando liberacao',
      mensagem: `${aluno.nome} aguarda liberacao na portaria.`,
      link: '/portaria',
    });
  }
  await notif.notificar([aluno.id], {
    titulo: decisao === 'APROVADO' ? 'Saida aprovada pela gestao' : 'Saida recusada pela gestao',
    mensagem: decisao === 'APROVADO' ? 'Aguarde a liberacao na portaria.' : `Justificativa: ${just}`,
    link: '/aluno',
  });
  res.locals.audit = { acao: `SAIDA_GESTOR_${decisao}`, antes: { status: saida.status }, depois: { id: saida.id, decisao, justificativa: just } };
  res.json(await Saida.buscar(req.user, saida.id));
};

exports.ciente = async (req, res) => {
  const saida = await Saida.buscar(req.user, Number(req.params.id));
  if (!saida) throw new HttpError(404, 'Solicitacao nao encontrada.');
  if (saida.gestor_status !== 'APROVADO') throw new HttpError(409, 'A ciencia so e possivel apos a aprovacao do gestor.');
  await db('saidas_antecipadas').where({ id: saida.id }).update({ professor_ciente: true, professor_ciente_em: agoraISO(), atualizado_em: agoraISO() });
  res.locals.audit = { acao: 'SAIDA_PROFESSOR_CIENTE', depois: { id: saida.id } };
  res.json(await Saida.buscar(req.user, saida.id));
};

exports.liberar = async (req, res) => {
  const saida = await Saida.buscarBruto(Number(req.params.id));
  if (!saida) throw new HttpError(404, 'Solicitacao nao encontrada.');
  const agora = agoraISO();
  const n = await db('saidas_antecipadas')
    .where({ id: saida.id, status: 'AGUARDANDO_PORTARIA' })
    .update({ status: 'LIBERADO', portaria_id: req.user.id, horario_saida_real: agora, atualizado_em: agora });
  if (!n) throw new HttpError(409, 'Solicitacao nao esta aguardando a portaria.');
  await notif.notificar([saida.aluno_id], { titulo: 'Saida liberada', mensagem: 'Sua saida foi liberada pela portaria.', link: '/aluno' });
  res.locals.audit = { acao: 'SAIDA_LIBERADA', antes: { status: saida.status }, depois: { id: saida.id, horario_saida_real: agora } };
  res.json(await Saida.buscar(req.user, saida.id));
};
