import { Request, Response } from 'express';
import { z } from 'zod';
import { childRepository } from '../repositories/childRepository';
import { fail, ok } from '../utils/http';
import { ChildProfile } from '../models/types';

const balanceSchema = z.object({
  preset: z.enum(['balanced', 'learning_focus', 'fun_day', 'calm_day', 'custom']),
  educational: z.number(),
  entertainment: z.number(),
  stories: z.number(),
  religious: z.number(),
});

export const childCreateSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  age: z.number().int().min(3).max(15),
  avatar: z.string().default('sami'),
  profileColor: z.string().default('#4FC3F7'),
  primaryLanguage: z.enum(['en', 'am', 'om', 'ti', 'so']).default('en'),
  learningLanguage: z.enum(['en', 'am', 'om', 'ti', 'so']).default('en'),
  languageMix: z.number().min(0).max(100).default(70),
  dailyLimitMinutes: z.number().default(90),
  sessionLimitMinutes: z.number().default(30),
  breakMinutes: z.number().default(15),
  allowedCategories: z.array(z.string()).default([]),
  blockedCategories: z.array(z.string()).default([]),
  preferredCategories: z.array(z.string()).default([]),
  contentBalance: balanceSchema.optional(),
  religiousContentEnabled: z.boolean().default(false),
  religiousPreference: z.enum(['christian', 'muslim', 'other', 'none']).default('none'),
  schedule: z.array(z.any()).optional(),
  interestScores: z.record(z.string(), z.number()).optional(),
  interestDeltas: z.record(z.string(), z.number()).optional(),
});

export const childController = {
  async get(req: Request, res: Response) {
    const child = await childRepository.get(req.params.id);
    if (!child) return fail(res, 'Child not found', 404);
    return ok(res, child);
  },
  async create(req: Request, res: Response) {
    const body = req.body as z.infer<typeof childCreateSchema>;
    const id = body.id ?? `child_${Date.now()}`;
    const profile: ChildProfile = {
      id,
      name: body.name,
      age: body.age,
      avatar: body.avatar,
      profileColor: body.profileColor,
      primaryLanguage: body.primaryLanguage,
      learningLanguage: body.learningLanguage,
      languageMix: body.languageMix,
      dailyLimitMinutes: body.dailyLimitMinutes,
      sessionLimitMinutes: body.sessionLimitMinutes,
      breakMinutes: body.breakMinutes,
      allowedCategories: body.allowedCategories as ChildProfile['allowedCategories'],
      blockedCategories: body.blockedCategories as ChildProfile['blockedCategories'],
      preferredCategories: body.preferredCategories as ChildProfile['preferredCategories'],
      contentBalance: body.contentBalance ?? {
        preset: 'balanced',
        educational: 50,
        entertainment: 25,
        stories: 15,
        religious: 10,
      },
      religiousContentEnabled: body.religiousContentEnabled,
      religiousPreference: body.religiousPreference,
      schedule: body.schedule ?? [],
      interestScores: body.interestScores ?? {},
      interestDeltas: body.interestDeltas ?? {},
    };
    return ok(res, await childRepository.create(profile), 201);
  },
  async update(req: Request, res: Response) {
    try {
      const profile = await childRepository.update(req.params.id, req.body);
      return ok(res, profile);
    } catch (err) {
      return fail(res, err instanceof Error ? err.message : 'Update failed', 404);
    }
  },
};
