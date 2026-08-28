import { EventType } from '../models/types';

export function scoreForEvent(eventType: EventType, percentageWatched: number, watchDurationSeconds: number): number {
  let score = 0;
  if (eventType === 'video_started') score += 1;
  if (percentageWatched > 25) score += 1;
  if (percentageWatched > 50) score += 2;
  if (percentageWatched > 80) score += 3;
  if (eventType === 'video_completed') score += 4;
  if (eventType === 'video_liked') score += 3;
  if (eventType === 'video_favorited') score += 4;
  if (eventType === 'video_replayed') score += 4;
  if (eventType === 'video_skipped' && watchDurationSeconds <= 3) score -= 3;
  else if (eventType === 'video_skipped' && percentageWatched < 20) score -= 2;
  return score;
}

export function applyInterestDelta(
  scores: Record<string, number>,
  category: string,
  delta: number,
): Record<string, number> {
  const next = { ...scores };
  const current = next[category] ?? 0;
  next[category] = Math.max(0, Math.min(100, current + delta));
  return next;
}
