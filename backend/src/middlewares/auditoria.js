const logService = require('../services/logService');

const METODOS_LEITURA = ['GET', 'HEAD', 'OPTIONS'];

// Grava em logs_sistema toda requisicao que altera dados.
// Controllers podem enriquecer com res.locals.audit = { acao, antes, depois }.
function auditoria(req, res, next) {
  res.on('finish', () => {
    if (METODOS_LEITURA.includes(req.method)) return;
    const a = res.locals.audit || {};
    logService.registrar({
      idUsuario: (req.user && req.user.id) || a.usuarioId,
      acao: a.acao || `${req.method} ${req.originalUrl.split('?')[0]}`,
      antes: a.antes,
      depois: a.depois !== undefined ? a.depois : { status_http: res.statusCode, corpo: req.body },
      ip: req.ip,
    });
  });
  next();
}

module.exports = auditoria;
