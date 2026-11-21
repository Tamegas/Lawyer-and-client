import multer from 'multer';
import { config } from '../config.js';

// One file per request, held in memory only long enough to check its magic bytes and write it to private storage.
export const uploadOne = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadBytes, files: 1, fields: 12, fieldSize: 10_000 },
}).single('file');
