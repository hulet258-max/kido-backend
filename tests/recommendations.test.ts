import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { filterForChild, rankRecommendations } from '../src/services/recommendationService';
import { samiProfile } from '../src/seed/demo';
import { seededVideos } from '../src/seed/videos';
import { isKidoAvailable } from '../src/services/scheduleService';

describe('age and content filtering', () => {
  it('never returns videos outside the child age range', () => {
    const child = structuredClone(samiProfile);
    const filtered = filterForChild(seededVideos, child, 16 * 60);
    assert.ok(filtered.every((v) => child.age >= v.minAge && child.age <= v.maxAge));
  });

  it('hides blocked categories', () => {
    const child = structuredClone(samiProfile);
    child.blockedCategories = ['sports'];
    const filtered = filterForChild(seededVideos, child, 16 * 60);
    assert.ok(filtered.every((v) => v.category !== 'sports'));
  });

  it('hides religious content when disabled', () => {
    const child = structuredClone(samiProfile);
    child.religiousContentEnabled = false;
    const filtered = filterForChild(seededVideos, child, 19 * 60);
    assert.ok(filtered.every((v) => !v.isReligious));
  });

  it('ranks science higher after a science interest bump', () => {
    const child = structuredClone(samiProfile);
    child.interestScores.science = 99;
    child.blockedCategories = [];
    const ranked = rankRecommendations(seededVideos, child, { minutesOfDay: 16 * 60, recentCategories: [] });
    assert.ok(ranked.length > 0);
    const scienceIndex = ranked.findIndex((v) => v.category === 'science');
    const musicIndex = ranked.findIndex((v) => v.category === 'music');
    if (scienceIndex >= 0 && musicIndex >= 0) {
      assert.ok(scienceIndex < musicIndex);
    }
  });

  it('school hours make KIDO unavailable', () => {
    assert.equal(isKidoAvailable(samiProfile, 10 * 60), false);
    assert.equal(isKidoAvailable(samiProfile, 16 * 60), true);
  });
});
