import { ChildState, ParentAccount, Video, ViewingEvent } from '../models/types';
import { demoParent, hanaProfile, samiProfile, seedDailyUsage, seedHistory } from '../seed/demo';
import { seededVideos } from '../seed/videos';

export class MemoryStore {
  videos: Video[] = [...seededVideos];
  parents: ParentAccount[] = [{ ...demoParent }];
  children: Record<string, ChildState> = {
    child_001: {
      profile: structuredClone(samiProfile),
      favorites: ['video_002', 'video_009'],
      likes: ['video_001', 'video_006'],
      continueWatching: { video_009: 0.62, video_005: 0.4 },
      dailyUsage: seedDailyUsage(78),
      events: seedHistory('child_001'),
      downloadedVideoIds: [],
    },
    child_002: {
      profile: structuredClone(hanaProfile),
      favorites: ['video_010', 'video_003'],
      likes: ['video_002'],
      continueWatching: { video_010: 0.3 },
      dailyUsage: seedDailyUsage(41),
      events: seedHistory('child_002'),
      downloadedVideoIds: [],
    },
  };

  getChild(id: string): ChildState | undefined {
    return this.children[id];
  }

  ensureChild(id: string): ChildState {
    const existing = this.children[id];
    if (!existing) {
      throw new Error(`Child ${id} not found`);
    }
    return existing;
  }

  addEvent(event: ViewingEvent) {
    const child = this.ensureChild(event.childId);
    child.events.push(event);
  }
}

export const store = new MemoryStore();
