import os from 'node:os';
import multer from 'multer';
import { config } from '../config.js';

export const upload = multer({
  dest: os.tmpdir(),
  limits: {
    files: config.maxFilesPerPost,
    fileSize: config.maxUploadBytes,
    fields: 30,
    fieldSize: 2 * 1024 * 1024
  }
});
