import { mkdirSync } from 'fs';
import os from 'os';
import path from 'path';
import multer from 'multer';
import { env } from '../config/env';

const uploadDir = path.join(os.tmpdir(), 'kido-uploads');
mkdirSync(uploadDir, { recursive: true });

const supportedMimeTypes = new Set(['video/mp4', 'video/quicktime', 'video/x-m4v']);

export const videoUpload = multer({
  dest: uploadDir,
  limits: { fileSize: env.maxUploadMb * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!supportedMimeTypes.has(file.mimetype)) {
      callback(new Error('Upload an MP4, MOV, or M4V video'));
      return;
    }
    callback(null, true);
  },
});
