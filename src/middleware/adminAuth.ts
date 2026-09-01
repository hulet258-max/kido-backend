import { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';
import { fail } from '../utils/http';

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const key = req.header('x-admin-key');
  if (!key || key !== env.adminApiKey) {
    return fail(res, 'Admin access denied', 401);
  }
  next();
}
