import { randomUUID } from 'crypto';
import { Request, Response } from 'express';
import { z } from 'zod';
import { Activity, VideoCategory } from '../models/types';
import { activityRepository } from '../repositories/activityRepository';
import { fail, ok } from '../utils/http';

const categories = [
  'animals', 'science', 'education', 'drawing', 'stories', 'sports',
  'ethiopia', 'language', 'music', 'religious', 'nature', 'entertainment',
] as const satisfies readonly VideoCategory[];

export const activitySchema = z.object({
  category: z.enum(categories),
  minAge: z.number().int().min(3).max(15),
  maxAge: z.number().int().min(3).max(15),
  type: z.enum(['quiz', 'order', 'match']),
  prompt: z.string().trim().min(2).max(500),
  options: z.array(z.string().trim().min(1)).max(8).optional(),
  correctAnswer: z.string().trim().min(1).optional(),
  items: z.array(z.string().trim().min(1)).max(10).optional(),
  correctOrder: z.array(z.string().trim().min(1)).max(10).optional(),
  pairs: z.record(z.string().trim().min(1)).optional(),
  successFeedback: z.string().trim().min(1).max(300),
  retryFeedback: z.string().trim().min(1).max(300),
}).superRefine((activity, context) => {
  if (activity.minAge > activity.maxAge) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Minimum age cannot exceed maximum age', path: ['minAge'] });
  }
  if (activity.type === 'quiz' && (!activity.options?.length || !activity.correctAnswer || !activity.options.includes(activity.correctAnswer))) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Quiz answer must be one of its options', path: ['correctAnswer'] });
  }
  if (activity.type === 'order' && (!activity.items?.length || activity.items.length !== activity.correctOrder?.length)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Ordering items and solution must have the same length', path: ['correctOrder'] });
  }
  if (activity.type === 'match' && !Object.keys(activity.pairs ?? {}).length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Matching games need at least one pair', path: ['pairs'] });
  }
});

function activityFrom(body: z.infer<typeof activitySchema>, id: string): Activity {
  return {
    id,
    category: body.category,
    minAge: body.minAge,
    maxAge: body.maxAge,
    type: body.type,
    prompt: body.prompt,
    options: body.options,
    correctAnswer: body.correctAnswer,
    items: body.items,
    correctOrder: body.correctOrder,
    pairs: body.pairs,
    successFeedback: body.successFeedback,
    retryFeedback: body.retryFeedback,
  };
}

export const activityController = {
  async list(req: Request, res: Response) {
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const ageValue = typeof req.query.age === 'string' ? Number(req.query.age) : undefined;
    const age = ageValue != null && Number.isFinite(ageValue) ? ageValue : undefined;
    return ok(res, await activityRepository.all({ category, age }));
  },

  async create(req: Request, res: Response) {
    const parsed = activitySchema.safeParse(req.body);
    if (!parsed.success) return fail(res, 'Activity is invalid', 422, parsed.error.flatten());
    const activity = activityFrom(parsed.data, `activity_${randomUUID()}`);
    return ok(res, await activityRepository.save(activity), 201);
  },

  async update(req: Request, res: Response) {
    if (!(await activityRepository.byId(req.params.id))) return fail(res, 'Activity not found', 404);
    const parsed = activitySchema.safeParse(req.body);
    if (!parsed.success) return fail(res, 'Activity is invalid', 422, parsed.error.flatten());
    return ok(res, await activityRepository.save(activityFrom(parsed.data, req.params.id)));
  },

  async remove(req: Request, res: Response) {
    if (!(await activityRepository.delete(req.params.id))) return fail(res, 'Activity not found', 404);
    return ok(res, { id: req.params.id });
  },
};
