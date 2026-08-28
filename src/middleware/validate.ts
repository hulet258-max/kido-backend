import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';
import { fail } from '../utils/http';

export function validate(schema: ZodSchema, source: 'body' | 'params' | 'query' = 'body') {
  return (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req[source]);
    if (!parsed.success) {
      return fail(res, 'Validation failed', 422, parsed.error.flatten());
    }
    if (source === 'body') req.body = parsed.data;
    next();
  };
}
