const logService = require('../services/logService');

const METODOS_LEITURA = ['GET', 'HEAD', 'OPTIONS'];
const CAMPOS_SENSIVEIS = new Set(['senha', 'senhaatual', 'novasenha', 'senhatemporaria', 'codigo', 'password']);

function corpoAuditavel(corpo) {
  if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) return corpo;
  return Object.fromEntries(
    Object.entries(corpo).map(([chave, valor]) => [chave, CAMPOS_SENSIVEIS.has(chave.toLowerCase()) ? '[REDACTED]' : valor])
  );
}

// Grava em logs_sistema toda requisicao que altera dados.
// Controllers podem enriquecer com res.locals.audit = { acao, antes, depois }.
function auditoria(req, res, next) {
  res.on('finish', () => {
    if (METODOS_LEITURA.includes(req.method)) return;
    const a = res.locals.audit || {};
    const cadastroAluno = req.path.startsWith('/auth/senha/aluno/cadastro/');
    logService.registrar({
      idUsuario: (req.user && req.user.id) || a.usuarioId,
      acao: a.acao || `${req.method} ${req.originalUrl.split('?')[0]}`,
      antes: a.antes,
      depois:
        a.depois !== undefined
          ? a.depois
          : { status_http: res.statusCode, corpo: cadastroAluno ? '[REDACTED]' : corpoAuditavel(req.body) },
      ip: req.ip,
    });
  });
  next();
}

module.exports = auditoria;
