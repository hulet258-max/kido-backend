import { ChildProfile, Video } from '../models/types';
import { ageGroupFor } from '../utils/age';
import { videoAllowedBySchedule } from './scheduleService';

export interface RecommendOptions {
  minutesOfDay: number;
  recentCategories?: string[];
}

function ageFits(video: Video, age: number): boolean {
  return age >= video.minAge && age <= video.maxAge;
}

function educationalBucket(video: Video): 'educational' | 'entertainment' | 'stories' | 'religious' {
  if (video.isReligious) return 'religious';
  if (video.category === 'stories') return 'stories';
  if (video.isEducational) return 'educational';
  return 'entertainment';
}

export function filterForChild(videos: Video[], child: ChildProfile, minutesOfDay: number): Video[] {
  return videos.filter((video) => {
    if (!ageFits(video, child.age)) return false;
    if (child.blockedCategories.includes(video.category)) return false;
    if (!child.allowedCategories.includes(video.category) && video.category !== 'religious') {
      return false;
    }
    if (video.isReligious) {
      if (!child.religiousContentEnabled) return false;
      if (
        video.religiousPreference &&
        child.religiousPreference !== 'none' &&
        video.religiousPreference !== child.religiousPreference &&
        child.religiousPreference !== 'other'
      ) {
        return false;
      }
    }
    if (!videoAllowedBySchedule(child, video, minutesOfDay)) return false;
    return true;
  });
}

export function scoreVideo(
  video: Video,
  child: ChildProfile,
  options: RecommendOptions,
): number {
  const interest = child.interestScores[video.category] ?? 10;
  const preferred = child.preferredCategories.includes(video.category) ? 12 : 0;

  const ageCenter = (video.minAge + video.maxAge) / 2;
  const ageFit = Math.max(0, 15 - Math.abs(child.age - ageCenter) * 3);

  const hour = Math.floor(options.minutesOfDay / 60);
  let timeBonus = 0;
  if (hour < 8 && (video.category === 'education' || video.category === 'stories')) timeBonus += 8;
  if (hour >= 18 && (video.category === 'stories' || video.category === 'music')) timeBonus += 8;
  if (hour >= 15 && hour < 18 && video.category === 'sports') timeBonus += 6;

  const bucket = educationalBucket(video);
  const weight = child.contentBalance[bucket] ?? 20;
  const eduWeight = weight * 0.25;

  let language = 0;
  if (video.language === child.primaryLanguage) language += 10;
  if (video.language === child.learningLanguage) language += Math.round((100 - child.languageMix) / 10);

  const recent = options.recentCategories ?? [];
  const lastThree = recent.slice(-3);
  const diversityPenalty = lastThree.filter((c) => c === video.category).length * 8;

  return interest + preferred + ageFit + timeBonus + eduWeight + language - diversityPenalty;
}

export function rankRecommendations(
  videos: Video[],
  child: ChildProfile,
  options: RecommendOptions,
): Video[] {
  const eligible = filterForChild(videos, child, options.minutesOfDay);
  return [...eligible].sort((a, b) => scoreVideo(b, child, options) - scoreVideo(a, child, options));
}

export { ageGroupFor };
