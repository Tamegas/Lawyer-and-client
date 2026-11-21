import fs from 'node:fs';
import { notFound } from '../middleware/errors.js';
import { storedPath } from './storage.js';

// The file type is decided by the file's own first bytes, never by the browser-supplied MIME type or file name.
export const ALLOWED_TYPES = [
  { mime: 'application/pdf', ext: 'pdf', label: 'PDF' },
  { mime: 'image/jpeg', ext: 'jpg', label: 'JPEG' },
  { mime: 'image/png', ext: 'png', label: 'PNG' },
];
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function sniffFileType(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 8) return null;
  if (buf.subarray(0, 5).toString('latin1') === '%PDF-') return ALLOWED_TYPES[0];
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return ALLOWED_TYPES[1];
  if (buf.subarray(0, 8).equals(PNG_MAGIC)) return ALLOWED_TYPES[2];
  return null;
}

/** A harmless download name: letters, digits, dot, dash, underscore, space; always ends with the real extension. */
export function safeDownloadName(original, ext) {
  const base = String(original ?? 'document').replace(/\.[A-Za-z0-9]{1,5}$/, '').replace(/[^A-Za-z0-9._ -]/g, '_').trim().slice(0, 80) || 'document';
  return `${base}.${ext}`;
}

/** Streams a credential row's private file as a download. Callers MUST have authorised the request first. */
export function streamCredential(res, row) {
  const file = storedPath(row.stored_filename);
  if (!file || !fs.existsSync(file)) throw notFound('The file is no longer available.');
  const ext = row.stored_filename.split('.').pop();
  res.set({
    'Content-Type': row.mime_type || 'application/octet-stream',
    'Content-Disposition': `attachment; filename="${safeDownloadName(row.original_filename, ext)}"`,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  if (row.size_bytes) res.set('Content-Length', String(row.size_bytes));
  fs.createReadStream(file).on('error', () => res.destroy()).pipe(res);
}
