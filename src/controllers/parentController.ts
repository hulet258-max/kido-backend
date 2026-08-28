import { Request, Response } from 'express';
import { childRepository } from '../repositories/childRepository';
import { parentRepository } from '../repositories/parentRepository';
import { videoRepository } from '../repositories/videoRepository';
import { rankRecommendations } from '../services/recommendationService';
import { resolveMinutes, SimulatedSlot } from '../services/scheduleService';
import { minutesToday, todayContent, weeklySummary } from '../services/reportService';
import { fail, ok } from '../utils/http';

export const parentController = {
  async recommendations(req: Request, res: Response) {
    const child = await childRepository.get(req.params.childId);
    if (!child) return fail(res, 'Child not found', 404);
    const slot = (req.query.time as SimulatedSlot | undefined) ?? 'real';
    const minutes = resolveMinutes(slot);
    const recent = child.events.slice(-8).map((e) => e.category ?? '').filter(Boolean);
    const ranked = rankRecommendations(await videoRepository.all(), child.profile, {
      minutesOfDay: minutes,
      recentCategories: recent,
    });
    return ok(res, ranked);
  },
  async reports(req: Request, res: Response) {
    const child = await childRepository.get(req.params.childId);
    if (!child) return fail(res, 'Child not found', 404);
    return ok(res, {
      todayMinutes: minutesToday(child),
      dailyLimit: child.profile.dailyLimitMinutes,
      todayContent: todayContent(child),
      week: weeklySummary(child),
    });
  },
  async interests(req: Request, res: Response) {
    const child = await childRepository.get(req.params.childId);
    if (!child) return fail(res, 'Child not found', 404);
    const ranked = Object.entries(child.profile.interestScores)
      .map(([category, score]) => ({
        category,
        score,
        delta: child.profile.interestDeltas[category] ?? 0,
      }))
      .sort((a, b) => b.score - a.score);
    return ok(res, {
      scores: ranked,
      disclaimer: 'Based on videos watched, completed, replayed and skipped.',
    });
  },
  async getPreferences(req: Request, res: Response) {
    const child = await childRepository.get(req.params.childId);
    if (!child) return fail(res, 'Child not found', 404);
    const { profile } = child;
    return ok(res, {
      allowedCategories: profile.allowedCategories,
      blockedCategories: profile.blockedCategories,
      preferredCategories: profile.preferredCategories,
      contentBalance: profile.contentBalance,
      religiousContentEnabled: profile.religiousContentEnabled,
      religiousPreference: profile.religiousPreference,
      primaryLanguage: profile.primaryLanguage,
      learningLanguage: profile.learningLanguage,
      languageMix: profile.languageMix,
      dailyLimitMinutes: profile.dailyLimitMinutes,
      sessionLimitMinutes: profile.sessionLimitMinutes,
      breakMinutes: profile.breakMinutes,
    });
  },
  async putPreferences(req: Request, res: Response) {
    try {
      const profile = await childRepository.update(req.params.childId, req.body);
      return ok(res, profile);
    } catch (err) {
      return fail(res, err instanceof Error ? err.message : 'Update failed', 404);
    }
  },
  async getSchedule(req: Request, res: Response) {
    const child = await childRepository.get(req.params.childId);
    if (!child) return fail(res, 'Child not found', 404);
    return ok(res, child.profile.schedule);
  },
  async putSchedule(req: Request, res: Response) {
    try {
      const profile = await childRepository.update(req.params.childId, { schedule: req.body });
      return ok(res, profile.schedule);
    } catch (err) {
      return fail(res, err instanceof Error ? err.message : 'Update failed', 404);
    }
  },
  async verifyPin(req: Request, res: Response) {
    const pin = String(req.body?.pin ?? '');
    const parent = await parentRepository.getDefault();
    if (!parent || pin !== parent.pin) return fail(res, 'Incorrect PIN', 401);
    return ok(res, { parentId: parent.id, name: parent.name });
  },
};
