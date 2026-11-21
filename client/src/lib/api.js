// Thin fetch wrapper for the REST API. Cookies carry the session (httpOnly), so nothing sensitive is stored in JS.
//   api.get(path, { query, signal }) · api.post(path, body, opts) · api.put · api.patch · api.delete(path, opts)
// `body` may be a plain object (sent as JSON) or FormData (multipart). Failures throw ApiError { status, code, message, fields }.
export class ApiError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

let unauthorizedHandler = null;
/** Registers a callback run when a signed-in session turns out to be invalid (HTTP 401 outside /auth). */
export function onUnauthorized(fn) { unauthorizedHandler = fn; }

export function buildUrl(path, query) {
  const qs = new URLSearchParams();
  Object.entries(query ?? {}).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '' || v === false) return;
    qs.append(k, String(v));
  });
  const s = qs.toString();
  return `/api${path}${s ? `?${s}` : ''}`;
}

async function request(method, path, { body, query, signal } = {}) {
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  const init = { method, credentials: 'include', signal, headers: { Accept: 'application/json' } };
  if (body !== undefined) {
    if (isForm) init.body = body;
    else { init.body = JSON.stringify(body); init.headers['Content-Type'] = 'application/json'; }
  }
  let res;
  try {
    res = await fetch(buildUrl(path, query), init);
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    throw new ApiError(0, 'network', 'We could not reach the server. Check your connection and try again.');
  }
  const isJson = (res.headers.get('content-type') || '').includes('application/json');
  const data = isJson ? await res.json().catch(() => null) : null;
  if (!res.ok) {
    const e = data?.error;
    if (res.status === 401 && !path.startsWith('/auth/')) unauthorizedHandler?.();
    throw new ApiError(res.status, e?.code ?? 'error', e?.message ?? 'Something went wrong. Please try again.', e?.fields);
  }
  return data;
}

export const api = {
  get: (path, opts) => request('GET', path, opts),
  post: (path, body, opts) => request('POST', path, { ...opts, body: body ?? {} }),
  put: (path, body, opts) => request('PUT', path, { ...opts, body: body ?? {} }),
  patch: (path, body, opts) => request('PATCH', path, { ...opts, body: body ?? {} }),
  delete: (path, opts) => request('DELETE', path, opts),
};

export function errorMessage(err) {
  return err?.message || 'Something went wrong. Please try again.';
}
