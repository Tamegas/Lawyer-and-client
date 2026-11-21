import crypto from 'node:crypto';

/** Unguessable lowercase-hex name, e.g. for stored upload file names (never derived from user input). */
export const randomName = (bytes = 16) => crypto.randomBytes(bytes).toString('hex');
