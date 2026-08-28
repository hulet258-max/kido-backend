import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { applyInterestDelta, scoreForEvent } from '../src/services/interestService';

describe('interest scoring', () => {
  it('scores a completed video with high watch percent', () => {
    const score = scoreForEvent('video_completed', 95, 89);
    assert.equal(score, 1 + 2 + 3 + 4);
  });

  it('penalizes a skip within 3 seconds', () => {
    assert.equal(scoreForEvent('video_skipped', 5, 2), -3);
  });

  it('clamps interest scores between 0 and 100', () => {
    assert.equal(applyInterestDelta({ science: 98 }, 'science', 7).science, 100);
    assert.equal(applyInterestDelta({ science: 2 }, 'science', -8).science, 0);
  });
});
