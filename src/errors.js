function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

module.exports = { asyncRoute, httpError };
