import { useEffect } from 'react';

// Pointer-driven perspective for decorative depth (pricing cards, the hero logo).
// Writes --tilt-x / --tilt-y (degrees) as CSS variables, and data-tilt='on' while steered, on the
// target, inside requestAnimationFrame: no React state, so no re-renders per pointer move.
// Only on devices with a fine, hovering pointer and without a reduced-motion preference;
// touch users get the static presentation.

const TILT_QUERY = '(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)';

export function canTilt() {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(TILT_QUERY).matches;
}

// targetRef: element that receives the variables. areaRef (optional): element whose
// pointer movement drives it (defaults to the target). max: degrees at the edges.
// smoothing: 0–1, fraction of the remaining distance covered per frame (1 = instant).
export function usePointerTilt(targetRef, { areaRef, max = 4, smoothing = 1 } = {}) {
  useEffect(() => {
    const target = targetRef.current;
    const area = areaRef?.current || target;
    if (!target || !area || typeof window.matchMedia !== 'function') return undefined;

    const query = window.matchMedia(TILT_QUERY);
    let frame = 0;
    let goal = { x: 0, y: 0 };
    let current = { x: 0, y: 0 };
    let bounds = null;

    const write = () => {
      target.style.setProperty('--tilt-x', `${current.x.toFixed(2)}deg`);
      target.style.setProperty('--tilt-y', `${current.y.toFixed(2)}deg`);
      // Unitless -1…1 copies, for offsets such as a shadow that moves against the tilt.
      target.style.setProperty('--tilt-u', (current.y / max).toFixed(3));
      target.style.setProperty('--tilt-v', (-current.x / max).toFixed(3));
    };

    const step = () => {
      frame = 0;
      current = {
        x: current.x + (goal.x - current.x) * smoothing,
        y: current.y + (goal.y - current.y) * smoothing,
      };
      if (Math.abs(goal.x - current.x) < 0.02 && Math.abs(goal.y - current.y) < 0.02) {
        current = goal;
      } else {
        frame = requestAnimationFrame(step);
      }
      write();
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(step);
    };

    const onEnter = () => {
      bounds = area.getBoundingClientRect();
      target.setAttribute('data-tilt', 'on');
    };
    const onMove = (event) => {
      if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
      if (!bounds) bounds = area.getBoundingClientRect();
      const px = (event.clientX - bounds.left) / bounds.width - 0.5;
      const py = (event.clientY - bounds.top) / bounds.height - 0.5;
      // Pointer right -> turn right (rotateY +); pointer down -> top tips away (rotateX -).
      goal = { x: -py * 2 * max, y: px * 2 * max };
      schedule();
    };
    const onLeave = () => {
      bounds = null;
      goal = { x: 0, y: 0 };
      target.removeAttribute('data-tilt');
      schedule();
    };
    // Layout may change while the pointer is inside (scroll, resize).
    const invalidate = () => {
      bounds = null;
    };

    const attach = () => {
      area.addEventListener('pointerenter', onEnter);
      area.addEventListener('pointermove', onMove);
      area.addEventListener('pointerleave', onLeave);
      window.addEventListener('scroll', invalidate, { passive: true });
      window.addEventListener('resize', invalidate);
    };
    const detach = () => {
      area.removeEventListener('pointerenter', onEnter);
      area.removeEventListener('pointermove', onMove);
      area.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('scroll', invalidate);
      window.removeEventListener('resize', invalidate);
      cancelAnimationFrame(frame);
      frame = 0;
      goal = current = { x: 0, y: 0 };
      write();
      target.removeAttribute('data-tilt');
    };

    // Follow changes (e.g. the user turns on reduced motion, or plugs in a mouse).
    let attached = false;
    const sync = () => {
      if (query.matches && !attached) {
        attach();
        attached = true;
      } else if (!query.matches && attached) {
        detach();
        attached = false;
      }
    };
    sync();
    query.addEventListener?.('change', sync);

    return () => {
      query.removeEventListener?.('change', sync);
      if (attached) detach();
    };
  }, [targetRef, areaRef, max, smoothing]);
}
