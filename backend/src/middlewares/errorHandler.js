const HttpError = require('../services/HttpError');

function notFound(req, res, next) {
  next(new HttpError(404, 'Rota nao encontrada.'));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({
    erro: status >= 500 ? 'Erro interno do servidor.' : err.message,
    detalhes: err.detalhes,
  });
}

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { notFound, errorHandler, asyncHandler };
