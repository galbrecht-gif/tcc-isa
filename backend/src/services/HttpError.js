class HttpError extends Error {
  constructor(status, message, detalhes, expose = status < 500) {
    super(message);
    this.status = status;
    this.detalhes = detalhes;
    this.expose = expose;
  }
}

module.exports = HttpError;
