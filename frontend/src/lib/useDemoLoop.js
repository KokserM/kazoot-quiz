import { useEffect, useState } from 'react';

// Drives the home hero's device stage (brief 6.1, effect E3): a 16 s loop of one demo
// question, shared by the host screen and the phone so both show the same moment.
//
//   0–12 s  question; the timer runs 12 → 0 (passing "soon" at 10 and "urgent" at 5)
//   3 s     the phone taps B: "Sending…" for 300 ms, then "Locked in"; 8 of 9 answered
//   6 s     9 of 9 answered
//   12–16 s reveal; B is correct
//
// One 250 ms interval, only while `targetRef` is on screen and the tab is visible.
// Reduced motion, Lite mode or no IntersectionObserver: a still frame (timer at 13,
// phone locked on B), as the page showed before.

export const DEMO_LOOP_MS = 16000;
const QUESTION_MS = 12000;
const TICK_MS = 250;

export function prefersStillHero() {
  if (typeof window === 'undefined') return true;
  const reduced = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return reduced || document.documentElement.hasAttribute('data-lite') || !('IntersectionObserver' in window);
}

export function demoFrame(elapsedMs, loop = 0) {
  if (elapsedMs == null) {
    return { loop: 0, phase: 'question', remainingMs: 13000, answered: 7, phoneAnswer: 'locked', still: true };
  }
  const t = elapsedMs % DEMO_LOOP_MS;
  const phase = t < QUESTION_MS ? 'question' : 'reveal';
  const phoneAnswer = t < 3000 ? null : t < 3300 ? 'sending' : 'locked';
  const answered = t < 3000 ? 7 : t < 6000 ? 8 : 9;
  return { loop, phase, remainingMs: Math.max(0, QUESTION_MS - t), answered, phoneAnswer, still: false };
}

export function useDemoLoop(targetRef) {
  const [elapsed, setElapsed] = useState(null);
  useEffect(() => {
    const target = targetRef.current;
    if (!target || prefersStillHero()) return undefined;
    let id = 0;
    let inView = false;
    const tick = () => setElapsed((ms) => (ms == null ? 0 : ms + TICK_MS));
    const sync = () => {
      const run = inView && document.visibilityState !== 'hidden';
      if (run && !id) {
        setElapsed((ms) => (ms == null ? 0 : ms));
        id = window.setInterval(tick, TICK_MS);
      }
      if (!run && id) {
        window.clearInterval(id);
        id = 0;
      }
    };
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      sync();
    });
    observer.observe(target);
    document.addEventListener('visibilitychange', sync);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', sync);
      window.clearInterval(id);
    };
  }, [targetRef]);
  return demoFrame(elapsed, elapsed == null ? 0 : Math.floor(elapsed / DEMO_LOOP_MS));
}
