import { logger } from '../config/logger.js';

export function notFound(_req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found', details: [] } });
}

export function errorHandler(error, _req, res, _next) {
  const status = Number.isInteger(error.status) ? error.status : 500;
  const code = typeof error.code === 'string' ? error.code : 'INTERNAL_ERROR';
  const message = status >= 500 ? 'An unexpected server error occurred' : error.message;
  if (status >= 500) logger.error({ err: error }, 'Request failed');
  res.status(status).json({ error: { code, message, details: error.details ?? [] } });
}
