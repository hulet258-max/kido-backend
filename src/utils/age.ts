import { AgeGroup } from '../models/types';

export function ageGroupFor(age: number): AgeGroup {
  if (age <= 5) return '3-5';
  if (age <= 8) return '6-8';
  if (age <= 12) return '9-12';
  return '13-15';
}

export function minutesOfDay(date = new Date()): number {
  return date.getHours() * 60 + date.getMinutes();
}
