import { config } from '../config.js';

/** Every error response has this shape: { error: { code, message, fields? } } */
export class HttpError extends Error {
  constructor(status, message, code = 'error', fields = undefined) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export const notFound = (message = 'Not found.') => new HttpError(404, message, 'not_found');
export const forbidden = (message = 'You do not have access to this.') => new HttpError(403, message, 'forbidden');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Route params that are not UUIDs are simply "not found" (never a 500 from the database). */
export function uuidParam(value) {
  if (typeof value === 'string' && UUID_RE.test(value)) return value.toLowerCase();
  throw notFound();
}

/** Validate `data` with a zod schema; on failure throw a 400 with a per-field message map. */
export function parse(schema, data) {
  const result = schema.safeParse(data ?? {});
  if (result.success) return result.data;
  const fields = {};
  for (const issue of result.error.issues) {
    const key = issue.path.length ? issue.path.join('.') : '_form';
    if (!(key in fields)) fields[key] = issue.message;
  }
  throw new HttpError(400, 'Please check the highlighted fields.', 'validation_error', fields);
}

export function notFoundHandler(req, res) {
  res.status(404).json({ error: { code: 'not_found', message: 'Not found.' } });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  if (err instanceof HttpError) {
    const body = { code: err.code, message: err.message };
    if (err.fields) body.fields = err.fields;
    return res.status(err.status).json({ error: body });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'invalid_json', message: 'The request body is not valid JSON.' } });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: { code: 'too_large', message: 'The request is too large.' } });
  }
  if (err?.name === 'MulterError') {
    const tooBig = err.code === 'LIMIT_FILE_SIZE';
    return res.status(tooBig ? 413 : 400).json({
      error: { code: tooBig ? 'file_too_large' : 'upload_error', message: tooBig ? 'That file is too large.' : 'The upload could not be processed.' },
    });
  }
  // Unknown failure: log details on the server, tell the client nothing about internals.
  if (!config.isTest) console.error('[error]', req.method, req.originalUrl, err);
  return res.status(500).json({ error: { code: 'server_error', message: 'Something went wrong on our side. Please try again.' } });
}
