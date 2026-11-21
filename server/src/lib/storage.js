// Private storage for verification documents. Files live in config.uploadDir under random names, are never served
// statically, and are only ever read through an authorised route (see lib/credentialFile.js streamCredential).
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { randomName } from './codes.js';

const NAME_RE = /^[0-9a-f]{32}\.(pdf|jpg|png)$/;

/** Writes the buffer under a random name (never derived from user input) and returns that name. */
export async function saveCredentialFile(buffer, ext) {
  await fs.mkdir(config.uploadDir, { recursive: true, mode: 0o700 });
  const name = `${randomName(16)}.${ext}`;
  await fs.writeFile(path.join(config.uploadDir, name), buffer, { mode: 0o600, flag: 'wx' });
  return name;
}

/** Absolute path for a stored name, or null if the name is not one we generated (blocks path traversal). */
export function storedPath(name) {
  if (typeof name !== 'string' || !NAME_RE.test(name)) return null;
  return path.join(config.uploadDir, name);
}

export async function deleteStored(name) {
  const file = storedPath(name);
  if (file) await fs.unlink(file).catch(() => {});
}
