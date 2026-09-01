import assert from 'node:assert/strict';
import test from 'node:test';
import { seededActivities } from '../src/seed/activities';
import { activitySchema } from '../src/controllers/activityController';

test('activity catalog covers all three interactive types', () => {
  const science = seededActivities.filter((activity) => activity.category === 'science');
  assert.deepEqual(new Set(science.map((activity) => activity.type)), new Set(['quiz', 'order', 'match']));
});

test('activity records have valid age ranges and solutions', () => {
  for (const activity of seededActivities) {
    assert.ok(activity.minAge <= activity.maxAge);
    if (activity.type === 'quiz') assert.ok(activity.options?.includes(activity.correctAnswer ?? ''));
    if (activity.type === 'order') assert.equal(activity.items?.length, activity.correctOrder?.length);
    if (activity.type === 'match') assert.ok(Object.keys(activity.pairs ?? {}).length > 0);
  }
});

test('admin activity validation rejects answers outside quiz options', () => {
  const result = activitySchema.safeParse({
    category: 'science', minAge: 6, maxAge: 10, type: 'quiz',
    prompt: 'Which one is a planet?', options: ['Earth', 'Moon'], correctAnswer: 'Mars',
    successFeedback: 'Correct!', retryFeedback: 'Try again.',
  });
  assert.equal(result.success, false);
});

test('admin activity validation accepts a complete matching game', () => {
  const result = activitySchema.safeParse({
    category: 'language', minAge: 5, maxAge: 12, type: 'match',
    prompt: 'Match the words', pairs: { cat: 'ድመት', dog: 'ውሻ' },
    successFeedback: 'Correct!', retryFeedback: 'Try again.',
  });
  assert.equal(result.success, true);
});
