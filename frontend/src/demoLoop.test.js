import { expect, test } from 'vitest';
import { DEMO_LOOP_MS, demoFrame } from './lib/useDemoLoop';

test('hero demo loop: still frame, question, lock-in and reveal', () => {
  expect(demoFrame(null)).toMatchObject({ phase: 'question', remainingMs: 13000, phoneAnswer: 'locked', still: true });
  expect(demoFrame(0)).toMatchObject({ phase: 'question', remainingMs: 12000, answered: 7, phoneAnswer: null });
  expect(demoFrame(3100)).toMatchObject({ answered: 8, phoneAnswer: 'sending' });
  expect(demoFrame(6000)).toMatchObject({ answered: 9, phoneAnswer: 'locked' });
  expect(demoFrame(12000)).toMatchObject({ phase: 'reveal', remainingMs: 0 });
  expect(demoFrame(DEMO_LOOP_MS + 500, 1)).toMatchObject({ loop: 1, phase: 'question', remainingMs: 11500 });
});
