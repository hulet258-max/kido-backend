import { ChildProfile, Video, VideoCategory } from '../models/types';

export type SimulatedSlot =
  | 'morning'
  | 'school'
  | 'after_school'
  | 'evening'
  | 'bedtime'
  | 'real';

const SLOT_MINUTES: Record<Exclude<SimulatedSlot, 'real'>, number> = {
  morning: 7 * 60,
  school: 10 * 60,
  after_school: 16 * 60,
  evening: 19 * 60,
  bedtime: 21 * 60,
};

export function resolveMinutes(slot: SimulatedSlot | undefined, now = new Date()): number {
  if (!slot || slot === 'real') {
    return now.getHours() * 60 + now.getMinutes();
  }
  return SLOT_MINUTES[slot];
}

export function activeBlock(child: ChildProfile, minutes: number) {
  return child.schedule.find((block) => minutes >= block.startMinutes && minutes < block.endMinutes);
}

export function isKidoAvailable(child: ChildProfile, minutes: number): boolean {
  const block = activeBlock(child, minutes);
  if (!block) return true;
  return block.available;
}

export function allowedCategoriesAt(child: ChildProfile, minutes: number): VideoCategory[] | null {
  const block = activeBlock(child, minutes);
  if (!block) return null;
  if (!block.available) return [];
  if (block.allowedCategories.length === 0) return null;
  return block.allowedCategories;
}

export function videoAllowedBySchedule(child: ChildProfile, video: Video, minutes: number): boolean {
  if (!isKidoAvailable(child, minutes)) return false;
  const allowed = allowedCategoriesAt(child, minutes);
  if (!allowed) return true;
  return allowed.includes(video.category);
}

export function nextAvailableLabel(child: ChildProfile, minutes: number): string {
  const upcoming = [...child.schedule]
    .filter((b) => b.available && b.startMinutes > minutes)
    .sort((a, b) => a.startMinutes - b.startMinutes)[0];
  if (!upcoming) {
    const first = child.schedule.find((b) => b.available);
    if (!first) return 'tomorrow';
    const h = Math.floor(first.startMinutes / 60);
    const m = first.startMinutes % 60;
    return `${h}:${m.toString().padStart(2, '0')} AM tomorrow`;
  }
  const h = Math.floor(upcoming.startMinutes / 60);
  const m = upcoming.startMinutes % 60;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const display = ((h + 11) % 12) + 1;
  return `${display}:${m.toString().padStart(2, '0')} ${suffix}`;
}
