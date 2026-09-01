import { ChildState, ParentAccount, Video, ViewingEvent } from '../models/types';

export class MemoryStore {
  videos: Video[] = [];
  parents: ParentAccount[] = [];
  children: Record<string, ChildState> = {};

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
