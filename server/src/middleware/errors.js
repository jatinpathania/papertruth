export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (message, details) => new HttpError(400, message, details);
export const notFound = (message = 'Not found') => new HttpError(404, message);
export const conflict = (message) => new HttpError(409, message);

export const asyncRoute = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

export function notFoundHandler(req, res) {
  res.status(404).json({ error: `No route for ${req.method} ${req.originalUrl}` });
}

export function errorHandler(error, req, res, next) {
  let status = error.status || 500;
  let message = error.message || 'Unexpected server error';
  let details = error.details;

  if (error.name === 'ValidationError') {
    status = 400;
    message = 'Validation failed';
    details = Object.fromEntries(Object.entries(error.errors || {}).map(([k, v]) => [k, v.message]));
  } else if (error.name === 'CastError') {
    status = 400;
    message = `Invalid ${error.path}: ${error.value}`;
  } else if (error.code === 11000) {
    status = 409;
    message = 'That record already exists';
    details = error.keyValue;
  }

  if (status >= 500) console.error('[error]', error);
  res.status(status).json({ error: message, ...(details ? { details } : {}) });
}
