const db = require('../config/database');

exports.listar = async (req, res) => {
  const limite = Math.min(Number(req.query.limite) || 200, 500);
  const rows = await db('logs_sistema as l')
    .leftJoin('usuarios as u', 'u.id', 'l.id_usuario')
    .select('l.*', 'u.nome as usuario_nome')
    .orderBy('l.id', 'desc')
    .limit(limite);
  res.json(rows);
};
