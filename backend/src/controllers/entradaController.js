const db = require('../config/database');
const Entrada = require('../models/entradaModel');
const Usuario = require('../models/usuarioModel');
const notif = require('../services/notificacaoService');
const HttpError = require('../services/HttpError');
const { agoraISO, localParaISO, formatarSP } = require('../services/dateService');

exports.listar = async (req, res) => {
  const { turma_id: turmaId, de, ate } = req.query;
  res.json(await Entrada.listar(req.user, { turmaId, de, ate }));
};

exports.obter = async (req, res) => {
  const entrada = await Entrada.buscar(req.user, Number(req.params.id));
  if (!entrada) throw new HttpError(404, 'Registro nao encontrado.');
  res.json({ ...entrada, assinatura: (await Entrada.assinatura(entrada.id)).assinatura });
};

exports.criar = async (req, res) => {
  const { aluno_id: alunoId, motivo, assinatura, horario_ajustado: ajuste } = req.body || {};
  const motivoTxt = String(motivo || '').trim();
  if (motivoTxt.length < 3 || motivoTxt.length > 500) throw new HttpError(400, 'Informe o motivo (3 a 500 caracteres).');
  if (!assinatura || typeof assinatura !== 'string' || !assinatura.startsWith('data:image/')) {
    throw new HttpError(400, 'A assinatura digital do aluno e obrigatoria.');
  }
  const aluno = await Usuario.buscarPorId(Number(alunoId));
  if (!aluno || aluno.role !== 'aluno' || !aluno.ativo) throw new HttpError(404, 'Aluno nao encontrado.');

  // Horario real sempre capturado no servidor (timestamp UTC, exibido em America/Sao_Paulo).
  const registro = agoraISO();
  let efetivo = registro;
  let logHorario = null;
  if (ajuste) {
    const ajustado = localParaISO(ajuste);
    if (!ajustado) throw new HttpError(400, 'Horario ajustado invalido.');
    if (new Date(ajustado).getTime() > Date.now() + 60 * 1000) throw new HttpError(400, 'O horario ajustado nao pode ser futuro.');
    if (new Date(ajustado).getTime() < Date.now() - 24 * 60 * 60 * 1000) throw new HttpError(400, 'O horario ajustado nao pode ser anterior a 24 horas.');
    if (ajustado.slice(0, 16) !== registro.slice(0, 16)) {
      efetivo = ajustado;
      logHorario = `Horário alterado pela portaria de ${formatarSP(registro)} para ${formatarSP(ajustado)}`;
    }
  }

  const [ins] = await db('entradas_atrasadas').insert({
    aluno_id: aluno.id,
    registrado_por: req.user.id,
    motivo: motivoTxt,
    horario_registro: registro,
    horario_efetivo: efetivo,
    horario_alterado_log: logHorario,
    assinatura,
    professor_ciente: false,
    criado_em: registro,
  });
  const id = typeof ins === 'object' ? ins.id : ins;

  const destinatarios = [...(await notif.idsPorRole('gestor')), ...(await notif.idProfessorDaTurma(aluno.turma_id))];
  await notif.notificar(destinatarios, {
    titulo: 'Entrada atrasada registrada',
    mensagem: `${aluno.nome} - entrada as ${formatarSP(efetivo)}. Motivo: ${motivoTxt}`,
    link: '/professor',
  });

  res.locals.audit = {
    acao: logHorario ? 'ENTRADA_REGISTRADA_HORARIO_ALTERADO' : 'ENTRADA_REGISTRADA',
    depois: { id, aluno_id: aluno.id, motivo: motivoTxt, horario_efetivo: efetivo, observacao: logHorario },
  };
  res.status(201).json(await Entrada.buscar(req.user, id));
};

exports.ciente = async (req, res) => {
  const entrada = await Entrada.buscar(req.user, Number(req.params.id));
  if (!entrada) throw new HttpError(404, 'Registro nao encontrado.');
  await db('entradas_atrasadas').where({ id: entrada.id }).update({ professor_ciente: true, professor_ciente_em: agoraISO() });
  res.locals.audit = { acao: 'ENTRADA_PROFESSOR_CIENTE', depois: { id: entrada.id } };
  res.json(await Entrada.buscar(req.user, entrada.id));
};
