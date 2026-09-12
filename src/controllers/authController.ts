import { Request, Response } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { childRepository } from '../repositories/childRepository';
import { parentRepository } from '../repositories/parentRepository';
import { ChildProfile } from '../models/types';
import { fail, ok } from '../utils/http';

function digits(phone: string) {
  return phone.replace(/\D/g, '');
}

const childSchema = z.object({
  name: z.string().min(1),
  age: z.number().int().min(3).max(15),
  primaryLanguage: z.enum(['en', 'am', 'om', 'ti', 'so']).default('en'),
  learningLanguage: z.enum(['en', 'am', 'om', 'ti', 'so']).default('en'),
  preferredCategories: z.array(z.string()).default([]),
  blockedCategories: z.array(z.string()).default([]),
  dailyLimitMinutes: z.number().default(90),
  sessionLimitMinutes: z.number().default(20),
  breakMinutes: z.number().int().min(1).max(120).default(15),
  religiousContentEnabled: z.boolean().default(false),
  religiousPreference: z.enum(['christian', 'muslim', 'other', 'none']).default('none'),
});

export const signupSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(8),
  pin: z.string().regex(/^\d{4}$/),
  child: childSchema,
});

export const loginSchema = z.object({
  phone: z.string().min(8),
  pin: z.string().regex(/^\d{4}$/),
});

export async function sessionPayload(parentId: string) {
  const parent = await parentRepository.getById(parentId);
  if (!parent) return null;
  const children = await childRepository.listByParent(parent.id);
  return { parent, children };
}

export function profileFromSignup(body: z.infer<typeof signupSchema>['child']): ChildProfile {
  const preferred = body.preferredCategories.length ? body.preferredCategories : ['stories', 'animals', 'education'];
  return {
    id: `child_${randomUUID()}`,
    name: body.name,
    age: body.age,
    avatar: 'sami',
    profileColor: '#4FC3F7',
    primaryLanguage: body.primaryLanguage,
    learningLanguage: body.learningLanguage,
    languageMix: 70,
    dailyLimitMinutes: body.dailyLimitMinutes,
    sessionLimitMinutes: body.sessionLimitMinutes,
    breakMinutes: body.breakMinutes,
    allowedCategories: [
      'animals',
      'science',
      'education',
      'drawing',
      'stories',
      'sports',
      'ethiopia',
      'language',
      'music',
      'nature',
      'entertainment',
    ],
    blockedCategories: body.blockedCategories as ChildProfile['blockedCategories'],
    preferredCategories: preferred as ChildProfile['preferredCategories'],
    contentBalance: {
      preset: 'balanced',
      educational: 50,
      entertainment: 25,
      stories: 15,
      religious: 10,
    },
    religiousContentEnabled: body.religiousContentEnabled,
    religiousPreference: body.religiousPreference,
    schedule: [],
    interestScores: Object.fromEntries(preferred.map((c) => [c, 40])),
    interestDeltas: {},
  };
}

export const authController = {
  async signup(req: Request, res: Response) {
    return fail(res, 'Choose a subscription and complete payment to create your account', 402);
  },

  async login(req: Request, res: Response) {
    const body = req.body as z.infer<typeof loginSchema>;
    const phone = digits(body.phone);
    const parent = await parentRepository.findByPhone(phone);
    if (!parent || parent.pin !== body.pin) return fail(res, 'Phone or PIN is not right', 401);
    const session = await sessionPayload(parent.id);
    return ok(res, session);
  },
};
