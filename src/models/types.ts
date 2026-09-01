export type VideoCategory =
  | 'animals'
  | 'science'
  | 'education'
  | 'drawing'
  | 'stories'
  | 'sports'
  | 'ethiopia'
  | 'language'
  | 'music'
  | 'religious'
  | 'nature'
  | 'entertainment';

export type VideoOrientation = 'vertical' | 'horizontal';

export type ContentBalancePreset =
  | 'balanced'
  | 'learning_focus'
  | 'fun_day'
  | 'calm_day'
  | 'custom';

export type ReligiousPreference = 'christian' | 'muslim' | 'other' | 'none';

export type LanguageCode = 'en' | 'am' | 'om' | 'ti' | 'so';

export type EventType =
  | 'video_started'
  | 'video_paused'
  | 'video_completed'
  | 'video_skipped'
  | 'video_replayed'
  | 'video_liked'
  | 'video_disliked'
  | 'video_favorited'
  | 'video_unfavorited'
  | 'activity_presented'
  | 'activity_completed'
  | 'activity_skipped';

export type ActivityType = 'quiz' | 'order' | 'match';

export interface Activity {
  id: string;
  category: VideoCategory;
  minAge: number;
  maxAge: number;
  type: ActivityType;
  prompt: string;
  options?: string[];
  correctAnswer?: string;
  items?: string[];
  correctOrder?: string[];
  pairs?: Record<string, string>;
  successFeedback: string;
  retryFeedback: string;
}

export type AgeGroup = '3-5' | '6-8' | '9-12' | '13-15';

export interface Video {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  thumbnailUrl: string;
  fallbackVideoUrl?: string;
  category: VideoCategory;
  language: LanguageCode;
  minAge: number;
  maxAge: number;
  durationSeconds: number;
  orientation: VideoOrientation;
  isShort: boolean;
  isEducational: boolean;
  isReligious: boolean;
  religiousPreference?: ReligiousPreference;
  creator: string;
  tags: string[];
}

export interface ScheduleBlock {
  id: string;
  name: string;
  startMinutes: number;
  endMinutes: number;
  allowedCategories: VideoCategory[];
  available: boolean;
}

export interface ContentBalance {
  preset: ContentBalancePreset;
  educational: number;
  entertainment: number;
  stories: number;
  religious: number;
}

export interface ChildProfile {
  id: string;
  name: string;
  age: number;
  avatar: string;
  profileColor: string;
  primaryLanguage: LanguageCode;
  learningLanguage: LanguageCode;
  languageMix: number;
  dailyLimitMinutes: number;
  sessionLimitMinutes: number;
  breakMinutes: number;
  allowedCategories: VideoCategory[];
  blockedCategories: VideoCategory[];
  preferredCategories: VideoCategory[];
  contentBalance: ContentBalance;
  religiousContentEnabled: boolean;
  religiousPreference: ReligiousPreference;
  schedule: ScheduleBlock[];
  interestScores: Record<string, number>;
  interestDeltas: Record<string, number>;
}

export interface ParentAccount {
  id: string;
  name: string;
  pin: string;
  phone: string;
  childIds: string[];
}

export interface ViewingEvent {
  id: string;
  childId: string;
  videoId: string;
  eventType: EventType;
  watchDurationSeconds: number;
  percentageWatched: number;
  category?: VideoCategory;
  language?: LanguageCode;
  orientation?: VideoOrientation;
  reaction?: 'up' | 'down' | 'none';
  activityId?: string;
  activityType?: ActivityType;
  timestamp: string;
}

export interface DailyUsage {
  date: string;
  minutes: number;
  byCategory: Record<string, number>;
}

export interface ChildState {
  profile: ChildProfile;
  favorites: string[];
  likes: string[];
  dislikes: string[];
  continueWatching: Record<string, number>;
  dailyUsage: DailyUsage[];
  events: ViewingEvent[];
  downloadedVideoIds: string[];
}
