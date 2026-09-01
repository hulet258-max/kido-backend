import { Activity, VideoCategory } from '../models/types';

const categories: VideoCategory[] = [
  'animals', 'science', 'education', 'drawing', 'stories', 'sports',
  'ethiopia', 'language', 'music', 'nature', 'entertainment',
];

export const seededActivities: Activity[] = categories.flatMap((category) => [
  {
    id: `${category}_quiz`, category, minAge: 3, maxAge: 15, type: 'quiz',
    prompt: `Which word belongs with ${category}?`,
    options: [category, 'bedtime', 'weather'], correctAnswer: category,
    successFeedback: 'You found it!', retryFeedback: 'Almost! Try again.',
  },
  {
    id: `${category}_order`, category, minAge: 5, maxAge: 15, type: 'order',
    prompt: 'Put these steps in order.', items: ['Finish', 'Start', 'Keep going'],
    correctOrder: ['Start', 'Keep going', 'Finish'],
    successFeedback: 'Perfect order!', retryFeedback: 'Almost! Try again.',
  },
  {
    id: `${category}_match`, category, minAge: 6, maxAge: 15, type: 'match',
    prompt: 'Match each idea with its partner.', pairs: { One: '1', Two: '2', Three: '3' },
    successFeedback: 'Every pair matches!', retryFeedback: 'Almost! Try again.',
  },
]);
