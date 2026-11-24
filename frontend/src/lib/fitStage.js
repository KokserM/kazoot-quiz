import { useLayoutEffect, useRef, useState } from 'react';

// Measuring hooks for the game stage (brief 8.5, layer 3, and 8.6 / 8.8 / 8.9).
// Everything here measures, then writes once: CSS variables and data attributes on
// elements the caller owns, never React state per frame. Each hook re-runs on its
// container's resize (ResizeObserver, one requestAnimationFrame per burst) and once
// after web fonts have loaded.
//
// Markup contract:
//   [data-fit='question'] / [data-fit='answer']  text boxes with overflow: hidden and a
//                                                 bounded height (font size uses
//                                                 --fit-q / --fit-a, clamped in CSS)
//   [data-fit-box]                                any other box that must not overflow
// When text still does not fit at the floors, the container gets data-clamped='true',
// each overflowing text box gets data-clamped and a --lines variable (CSS line-clamps it).

const MIN_FACTOR = 0.35;

const hasRO = () => typeof ResizeObserver !== 'undefined';

function overflows(element) {
  return element.scrollHeight > element.clientHeight + 1 || element.scrollWidth > element.clientWidth + 1;
}

function overflowsY(element) {
  return element.scrollHeight > element.clientHeight + 1;
}

function lineHeightOf(element) {
  const style = getComputedStyle(element);
  const value = parseFloat(style.lineHeight);
  if (Number.isFinite(value)) return value;
  return parseFloat(style.fontSize) * 1.2;
}

function setLevel(container, level, maxLevel) {
  for (let step = 1; step <= maxLevel; step += 1) {
    if (step <= level) container.setAttribute(`data-s${step}`, '');
    else container.removeAttribute(`data-s${step}`);
  }
  container.setAttribute('data-squeeze', String(level));
}

// The fitting pass. Returns true when text had to be clamped.
// levels: number of squeeze levels the container's CSS defines (data-s1 … data-sN).
export function fitStage(container, { levels = 0, text = true } = {}) {
  if (!container) return false;
  const texts = text ? [...container.querySelectorAll('[data-fit]')] : [];
  const boxes = [...container.querySelectorAll('[data-fit-box]')];
  const set = (name, value) => container.style.setProperty(name, String(value));

  // Reset to the natural state.
  set('--fit-q', 1);
  set('--fit-a', 1);
  container.removeAttribute('data-clamped');
  for (const element of texts) {
    element.removeAttribute('data-clamped');
    element.style.removeProperty('--lines');
  }

  const layoutOver = () => overflowsY(container) || boxes.some(overflowsY);
  const over = () => layoutOver() || texts.some(overflowsY);

  // Layout squeezes first (hide recaps, smaller QR …), smallest change first, and only
  // for layout overflow (text that is too long for its box is the text fit's job).
  let level = 0;
  setLevel(container, 0, levels);
  while (layoutOver() && level < levels) {
    level += 1;
    setLevel(container, level, levels);
  }
  if (!texts.length) return false;

  // Long words: shrink until the longest word fits on a line (down to the floor), so a
  // word is broken mid-way only when it has to be. Measured with wrapping inside words
  // switched off; the result caps the factors below.
  const caps = { '--fit-q': 1, '--fit-a': 1 };
  for (const [name, kind] of [
    ['--fit-q', 'question'],
    ['--fit-a', 'answer'],
  ]) {
    const group = texts.filter((element) => element.dataset.fit === kind);
    if (!group.length) continue;
    for (const element of group) {
      element.style.overflowWrap = 'normal';
      element.style.hyphens = 'manual';
    }
    const wordsOver = () => group.some((element) => element.scrollWidth > element.clientWidth);
    if (wordsOver()) {
      let lo = MIN_FACTOR;
      let hi = 1;
      for (let step = 0; step < 6; step += 1) {
        const mid = (lo + hi) / 2;
        set(name, mid.toFixed(3));
        if (wordsOver()) hi = mid;
        else lo = mid;
      }
      caps[name] = lo;
      set(name, lo.toFixed(3));
    }
    for (const element of group) {
      element.style.removeProperty('overflow-wrap');
      element.style.removeProperty('hyphens');
    }
  }
  if (!over()) return false;

  // Largest factor in [lo, hi] for `name` that fits; leaves the variable at it.
  const search = (name, steps) => {
    let lo = MIN_FACTOR;
    let hi = caps[name];
    set(name, lo);
    if (over()) return false;
    for (let step = 0; step < steps; step += 1) {
      const mid = (lo + hi) / 2;
      set(name, mid.toFixed(3));
      if (over()) hi = mid;
      else lo = mid;
    }
    set(name, lo.toFixed(3));
    return true;
  };

  const hasQuestion = texts.some((element) => element.dataset.fit === 'question');
  // Answers first; then the question (its row is auto-height, so this frees space),
  // then give the answers back whatever the smaller question left.
  if (search('--fit-a', 6)) return false;
  if (hasQuestion && search('--fit-q', 6)) {
    search('--fit-a', 5);
    return false;
  }

  // Last resort: clamp each overflowing text box to the whole lines that fit …
  container.setAttribute('data-clamped', 'true');
  const linesOf = new Map();
  const clamp = (element, lines) => {
    linesOf.set(element, lines);
    element.setAttribute('data-clamped', '');
    element.style.setProperty('--lines', String(lines));
  };
  for (const element of texts) {
    if (!overflowsY(element)) continue;
    clamp(element, Math.max(1, Math.floor((element.clientHeight + 0.5) / lineHeightOf(element))));
  }
  // … and while the layout around them still overflows (auto-height rows), take one
  // more line from the tallest text, answers before the question.
  for (let guard = 0; guard < 40 && (overflowsY(container) || boxes.some(overflowsY)); guard += 1) {
    let pick = null;
    let most = 1;
    for (const element of texts) {
      const lines = linesOf.get(element) ?? Math.round(element.clientHeight / lineHeightOf(element));
      const weight = lines + (element.dataset.fit === 'answer' ? 0.5 : 0);
      if (lines > 1 && weight > most) {
        most = weight;
        pick = [element, lines];
      }
    }
    if (!pick) break;
    clamp(pick[0], pick[1] - 1);
  }
  return true;
}

// What a fit depends on: the container's box and the content sizes of the boxes it fits.
function snapshot(element) {
  let value = `${element.clientWidth}x${element.clientHeight}:${element.scrollWidth}x${element.scrollHeight}`;
  for (const child of element.querySelectorAll('[data-fit], [data-fit-box]')) value += `|${child.scrollHeight}/${child.clientHeight}`;
  return value;
}

// Runs `run` when `deps` change, and again whenever the container or the boxes it fits
// change size for any other reason (resize, rotation, browser bars, the connection
// banner, web fonts arriving). rAF-throttled; changes caused by the fit's own writes are
// ignored by comparing a snapshot taken right after each run.
function useRefit(ref, run, deps) {
  const runRef = useRef(run);
  const lastRef = useRef('');
  runRef.current = () => {
    run();
    if (ref.current) lastRef.current = snapshot(ref.current);
  };

  useLayoutEffect(() => {
    runRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    let frame = 0;
    let active = true;
    const check = () => {
      if (!active || !element.isConnected) return;
      if (snapshot(element) !== lastRef.current) runRef.current();
      observeParts();
    };
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        check();
      });
    };
    const observer = hasRO() ? new ResizeObserver(schedule) : null;
    const observed = new Set();
    function observeParts() {
      if (!observer) return;
      for (const part of [element, ...element.children, ...element.querySelectorAll('[data-fit], [data-fit-box]')]) {
        if (!observed.has(part)) {
          observed.add(part);
          observer.observe(part);
        }
      }
    }
    observeParts();
    // Web fonts change text metrics, often without changing any box size.
    document.fonts?.ready?.then(schedule);
    document.fonts?.addEventListener?.('loadingdone', schedule);
    const timers = [250, 1000, 2500].map((delay) => setTimeout(schedule, delay));
    return () => {
      active = false;
      observer?.disconnect();
      document.fonts?.removeEventListener?.('loadingdone', schedule);
      timers.forEach(clearTimeout);
      cancelAnimationFrame(frame);
    };
  }, [ref]);
}

// Fits question and answer text (and optional squeeze levels) inside `ref`.
// Returns whether anything is clamped (shows the "Full text" button).
export function useFitStage(ref, deps, { levels = 0, text = true } = {}) {
  const [clamped, setClamped] = useState(false);
  useRefit(
    ref,
    () => {
      const result = fitStage(ref.current, { levels, text });
      setClamped((current) => (current === result ? current : result));
    },
    deps
  );
  return clamped;
}

// How many uniform rows fit in `ref` (a box whose height does not depend on its
// content: flex: 1 1 0; min-height: …; overflow: hidden). The row height is taken
// from `probeRef` (an invisible sample row with the real styles); the gap from the
// list's row-gap. Capped at `max`.
export function useRowsThatFit(ref, probeRef, { max = 10, deps = [] } = {}) {
  const [rows, setRows] = useState(max);
  useRefit(
    ref,
    () => {
      const box = ref.current;
      const probe = probeRef.current;
      if (!box || !probe) return;
      const height = box.clientHeight;
      const rowHeight = probe.offsetHeight;
      if (!rowHeight) return;
      const list = probe.parentElement;
      const gap = parseFloat(getComputedStyle(list).rowGap) || 0;
      const count = Math.max(0, Math.min(max, Math.floor((height + gap + 0.5) / (rowHeight + gap))));
      setRows((current) => (current === count ? current : count));
    },
    [max, ...deps]
  );
  return rows;
}

// Shows as many children of the wrapping list `ref` as fit in whole rows and hides the
// rest (display: none), ending with the `moreRef` chip "+{n}" when anything is hidden.
// Children with [data-more] are ignored as items. Returns the number hidden.
export function useItemsThatFit(ref, moreRef, deps = []) {
  const [hidden, setHidden] = useState(0);
  useRefit(
    ref,
    () => {
      const list = ref.current;
      if (!list) return;
      const more = moreRef?.current || null;
      const items = [...list.children].filter((child) => !child.hasAttribute('data-more') && child !== more);
      for (const item of items) item.style.display = '';
      if (more) more.style.display = 'none';
      const style = getComputedStyle(list);
      const limit = list.clientHeight - (parseFloat(style.paddingBottom) || 0) + 0.5;
      const right = list.clientWidth - (parseFloat(style.paddingRight) || 0) + 0.5;
      const fits = (element) => element.offsetTop + element.offsetHeight <= limit && element.offsetLeft + element.offsetWidth <= right;
      // Offsets are relative to the list (it is position: relative).
      let count = 0;
      while (count < items.length && fits(items[count])) count += 1;
      if (count < items.length) {
        for (let index = count; index < items.length; index += 1) items[index].style.display = 'none';
        if (more) {
          more.style.display = '';
          const label = () => {
            more.textContent = `+${items.length - count}`;
          };
          label();
          while (count > 0 && !fits(more)) {
            count -= 1;
            items[count].style.display = 'none';
            label();
          }
          if (!fits(more)) more.style.display = 'none';
        }
      }
      const result = items.length - count;
      setHidden((current) => (current === result ? current : result));
    },
    deps
  );
  return hidden;
}

export { overflows };
