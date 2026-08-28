import { ChildState, Video, ViewingEvent } from '../models/types';

function todayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function minutesToday(state: ChildState, now = new Date()): number {
  const key = todayKey(now);
  const row = state.dailyUsage.find((d) => d.date === key);
  return row?.minutes ?? 0;
}

export function weeklySummary(state: ChildState) {
  const total = state.dailyUsage.reduce((sum, d) => sum + d.minutes, 0);
  const average = state.dailyUsage.length === 0 ? 0 : Math.round(total / state.dailyUsage.length);
  const categoryMinutes: Record<string, number> = {};
  for (const day of state.dailyUsage) {
    for (const [cat, mins] of Object.entries(day.byCategory)) {
      categoryMinutes[cat] = (categoryMinutes[cat] ?? 0) + mins;
    }
  }
  const catTotal = Object.values(categoryMinutes).reduce((a, b) => a + b, 0) || 1;
  const distribution = Object.fromEntries(
    Object.entries(categoryMinutes).map(([k, v]) => [k, Math.round((v / catTotal) * 100)]),
  );
  const topInterest = Object.entries(state.profile.interestScores).sort((a, b) => b[1] - a[1])[0];
  const newInterest = Object.entries(state.profile.interestDeltas)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])[0];

  return {
    totalMinutes: total,
    averageMinutes: average,
    mostActiveWindow: '5:00–6:00 PM',
    topInterest: topInterest?.[0] ?? 'science',
    newInterest: newInterest?.[0] ?? 'drawing',
    distribution,
    daily: state.dailyUsage,
  };
}

export function todayContent(state: ChildState) {
  const key = todayKey();
  const row = state.dailyUsage.find((d) => d.date === key);
  return row?.byCategory ?? {};
}

export function applyWatchMinutes(state: ChildState, extraSeconds: number, category: string, now = new Date()) {
  const extra = extraSeconds / 60;
  const key = todayKey(now);
  const row = state.dailyUsage.find((d) => d.date === key);
  if (!row) {
    state.dailyUsage.push({
      date: key,
      minutes: extra,
      byCategory: { [category]: extra },
    });
    return;
  }
  row.minutes += extra;
  row.byCategory[category] = (row.byCategory[category] ?? 0) + extra;
}

export function eventsForVideo(events: ViewingEvent[], videoId: string) {
  return events.filter((e) => e.videoId === videoId);
}

export function videoMap(videos: Video[]): Record<string, Video> {
  return Object.fromEntries(videos.map((v) => [v.id, v]));
}
