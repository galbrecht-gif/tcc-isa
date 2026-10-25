const db = require('../config/database');

exports.listar = async (req, res) => {
  const itens = await db('notificacoes').where({ usuario_id: req.user.id }).orderBy('id', 'desc').limit(50);
  const naoLidas = itens.filter((n) => !n.lida).length;
  res.json({ naoLidas, itens: itens.map((n) => ({ ...n, lida: Boolean(n.lida) })) });
};

exports.marcarLida = async (req, res) => {
  await db('notificacoes').where({ id: Number(req.params.id), usuario_id: req.user.id }).update({ lida: true });
  res.json({ ok: true });
};

exports.marcarTodasLidas = async (req, res) => {
  await db('notificacoes').where({ usuario_id: req.user.id, lida: false }).update({ lida: true });
  res.json({ ok: true });
};
