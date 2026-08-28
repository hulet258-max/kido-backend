import { NextFunction, Request, Response } from 'express';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  const message = err instanceof Error ? err.message : 'Unexpected error';
  const status = message.toLowerCase().includes('not found') ? 404 : 500;
  res.status(status).json({ success: false, error: message });
}
