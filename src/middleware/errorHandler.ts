import { NextFunction, Request, Response } from 'express';
import multer from 'multer';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof multer.MulterError) {
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 422;
    res.status(status).json({ success: false, error: err.code === 'LIMIT_FILE_SIZE' ? 'Video file is too large' : err.message });
    return;
  }
  const message = err instanceof Error ? err.message : 'Unexpected error';
  const status = message.toLowerCase().includes('not found') ? 404 : message.toLowerCase().includes('upload an') ? 422 : 500;
  res.status(status).json({ success: false, error: message });
}
