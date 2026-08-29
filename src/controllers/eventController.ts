import { Request, Response } from 'express';
import { z } from 'zod';
import { childRepository } from '../repositories/childRepository';
import { videoRepository } from '../repositories/videoRepository';
import { applyInterestDelta, scoreForEvent } from '../services/interestService';
import { applyWatchMinutes } from '../services/reportService';
import { fail, ok } from '../utils/http';
import { ViewingEvent } from '../models/types';

export const eventSchema = z.object({
  childId: z.string(),
  videoId: z.string(),
  eventType: z.enum([
    'video_started',
    'video_paused',
    'video_completed',
    'video_skipped',
    'video_replayed',
    'video_liked',
    'video_disliked',
    'video_favorited',
  ]),
  watchDurationSeconds: z.number().min(0),
  percentageWatched: z.number().min(0).max(100),
  category: z.string().optional(),
  reaction: z.enum(['up', 'down', 'none']).optional(),
  timestamp: z.string().optional(),
});

export const eventController = {
  async create(req: Request, res: Response) {
    const body = req.body as z.infer<typeof eventSchema>;
    const child = await childRepository.get(body.childId);
    if (!child) return fail(res, 'Child not found', 404);
    const video = await videoRepository.byId(body.videoId);
    const event: ViewingEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      childId: body.childId,
      videoId: body.videoId,
      eventType: body.eventType,
      watchDurationSeconds: body.watchDurationSeconds,
      percentageWatched: body.percentageWatched,
      category: (body.category as ViewingEvent['category'] | undefined) ?? video?.category,
      language: video?.language,
      orientation: video?.orientation,
      reaction: body.reaction,
      timestamp: body.timestamp ?? new Date().toISOString(),
    };
    await childRepository.addEvent(event);
    child.events.push(event);

    if (video) {
      const delta = scoreForEvent(event.eventType, event.percentageWatched, event.watchDurationSeconds);
      child.profile.interestScores = applyInterestDelta(child.profile.interestScores, video.category, delta);
      child.profile.interestDeltas = {
        ...child.profile.interestDeltas,
        [video.category]: (child.profile.interestDeltas[video.category] ?? 0) + delta,
      };
      if (event.eventType === 'video_favorited' && !child.favorites.includes(video.id)) {
        child.favorites.push(video.id);
      }
      if (event.eventType === 'video_liked') {
        if (!child.likes.includes(video.id)) child.likes.push(video.id);
        child.dislikes = child.dislikes.filter((id) => id !== video.id);
      }
      if (event.eventType === 'video_disliked') {
        if (!child.dislikes.includes(video.id)) child.dislikes.push(video.id);
        child.likes = child.likes.filter((id) => id !== video.id);
      }
      if (event.watchDurationSeconds > 0) {
        applyWatchMinutes(child, event.watchDurationSeconds, video.category);
      }
      if (event.percentageWatched > 0 && event.percentageWatched < 100) {
        child.continueWatching[video.id] = event.percentageWatched / 100;
      }
      if (event.eventType === 'video_completed') {
        delete child.continueWatching[video.id];
      }
    }

    await childRepository.save(child);
    return ok(res, { event, interestScores: child.profile.interestScores }, 201);
  },
};
