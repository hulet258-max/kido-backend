import {
  ChildProfile,
  ParentAccount,
  ScheduleBlock,
  VideoCategory,
  ViewingEvent,
} from '../models/types';

const defaultSchedule = (): ScheduleBlock[] => [
  {
    id: 'morning',
    name: 'Morning',
    startMinutes: 6 * 60,
    endMinutes: 8 * 60,
    allowedCategories: ['education', 'stories', 'religious'],
    available: true,
  },
  {
    id: 'school',
    name: 'School Hours',
    startMinutes: 8 * 60,
    endMinutes: 15 * 60,
    allowedCategories: [],
    available: false,
  },
  {
    id: 'after_school',
    name: 'After School',
    startMinutes: 15 * 60,
    endMinutes: 18 * 60,
    allowedCategories: ['education', 'entertainment', 'sports', 'science', 'animals'],
    available: true,
  },
  {
    id: 'evening',
    name: 'Evening',
    startMinutes: 18 * 60,
    endMinutes: 20 * 60,
    allowedCategories: ['stories', 'drawing', 'religious', 'music'],
    available: true,
  },
  {
    id: 'bedtime',
    name: 'Bedtime',
    startMinutes: 20 * 60,
    endMinutes: 24 * 60,
    allowedCategories: [],
    available: false,
  },
];

const allCategories: VideoCategory[] = [
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
];

export const demoParent: ParentAccount = {
  id: 'parent_001',
  name: 'Demo Parent',
  pin: '1234',
  childIds: ['child_001', 'child_002'],
};

export const samiProfile: ChildProfile = {
  id: 'child_001',
  name: 'Sami',
  age: 8,
  avatar: 'sami',
  profileColor: '#4FC3F7',
  primaryLanguage: 'am',
  learningLanguage: 'en',
  languageMix: 70,
  dailyLimitMinutes: 90,
  sessionLimitMinutes: 30,
  breakMinutes: 15,
  allowedCategories: allCategories,
  blockedCategories: [],
  preferredCategories: ['science', 'animals', 'education'],
  contentBalance: {
    preset: 'balanced',
    educational: 50,
    entertainment: 25,
    stories: 15,
    religious: 10,
  },
  religiousContentEnabled: false,
  religiousPreference: 'none',
  schedule: defaultSchedule(),
  interestScores: {
    animals: 86,
    science: 72,
    sports: 54,
    drawing: 41,
    stories: 34,
    music: 17,
    education: 48,
    ethiopia: 29,
    language: 22,
    nature: 38,
  },
  interestDeltas: {
    science: 18,
    drawing: 11,
    music: -6,
    animals: 4,
    stories: 2,
  },
};

export const hanaProfile: ChildProfile = {
  id: 'child_002',
  name: 'Hana',
  age: 6,
  avatar: 'hana',
  profileColor: '#FFB74D',
  primaryLanguage: 'am',
  learningLanguage: 'en',
  languageMix: 60,
  dailyLimitMinutes: 60,
  sessionLimitMinutes: 20,
  breakMinutes: 10,
  allowedCategories: allCategories,
  blockedCategories: ['sports'],
  preferredCategories: ['stories', 'drawing', 'animals'],
  contentBalance: {
    preset: 'learning_focus',
    educational: 60,
    entertainment: 15,
    stories: 20,
    religious: 5,
  },
  religiousContentEnabled: false,
  religiousPreference: 'none',
  schedule: defaultSchedule(),
  interestScores: {
    stories: 78,
    drawing: 64,
    animals: 70,
    science: 28,
    music: 40,
    education: 52,
    ethiopia: 33,
    language: 36,
    nature: 25,
    sports: 8,
  },
  interestDeltas: {
    stories: 12,
    drawing: 9,
    animals: 5,
    sports: -3,
  },
};

function dayOffset(daysAgo: number, hour: number, minute = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

export function seedHistory(childId: string): ViewingEvent[] {
  const events: ViewingEvent[] = [];
  const catalog: Array<{
    videoId: string;
    category: VideoCategory;
    duration: number;
    type: ViewingEvent['eventType'];
    percent: number;
  }> = [
    { videoId: 'video_002', category: 'animals', duration: 420, type: 'video_completed', percent: 100 },
    { videoId: 'video_009', category: 'science', duration: 14, type: 'video_completed', percent: 100 },
    { videoId: 'video_003', category: 'drawing', duration: 40, type: 'video_completed', percent: 100 },
    { videoId: 'video_005', category: 'stories', duration: 200, type: 'video_paused', percent: 40 },
    { videoId: 'video_006', category: 'science', duration: 15, type: 'video_completed', percent: 100 },
    { videoId: 'video_001', category: 'science', duration: 12, type: 'video_liked', percent: 90 },
    { videoId: 'video_008', category: 'drawing', duration: 15, type: 'video_completed', percent: 100 },
    { videoId: 'video_004', category: 'education', duration: 6, type: 'video_skipped', percent: 12 },
  ];

  for (let day = 6; day >= 0; day -= 1) {
    catalog.forEach((item, index) => {
      events.push({
        id: `${childId}_hist_${day}_${index}`,
        childId,
        videoId: item.videoId,
        eventType: item.type,
        watchDurationSeconds: item.duration,
        percentageWatched: item.percent,
        category: item.category,
        language: 'en',
        orientation: 'horizontal',
        timestamp: dayOffset(day, 16 + (index % 3), index * 4),
      });
    });
  }
  return events;
}

export function seedDailyUsage(todayMinutes: number) {
  return Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const isToday = i === 6;
    const minutes = isToday ? todayMinutes : 42 + ((i * 11) % 28);
    return {
      date: d.toISOString().slice(0, 10),
      minutes,
      byCategory: {
        education: Math.round(minutes * 0.34),
        entertainment: Math.round(minutes * 0.19),
        science: Math.round(minutes * 0.16),
        stories: Math.round(minutes * 0.12),
        animals: Math.round(minutes * 0.11),
        religious: Math.round(minutes * 0.08),
      },
    };
  });
}
