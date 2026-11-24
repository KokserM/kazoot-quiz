import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { LinkButton } from '../ui';

// Home page only, phones and small tablets (≤ 760). A plain <div>, not a landmark: both
// links already exist in the header and its menu. Shown only while neither the hero's
// nor the finale's action row is on screen; hidden it is moved off screen, invisible
// and inert (not focusable, not announced).
const Dock = styled.div`
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: var(--z-dock);
  display: flex;
  gap: 10px;
  padding: 10px var(--gutter) max(10px, env(safe-area-inset-bottom));
  background: var(--scrim);
  border-top: 1px solid var(--line);
  box-shadow: var(--shadow-dock);
  transform: translateY(0);
  visibility: visible;
  transition: transform var(--dur-base) var(--ease-out), visibility 0s linear 0s;

  &[data-shown='false'] {
    transform: translateY(100%);
    visibility: hidden;
    /* visibility flips only once the slide-out has finished. */
    transition: transform var(--dur-base) var(--ease-out), visibility 0s linear var(--dur-base);
  }

  > a {
    min-height: 48px;
    padding: 0 12px;
    font-size: 1rem;
    border-radius: 12px;
  }
  > a:first-child { flex: 1; }
  > a:last-child { flex: 1.4; }

  @media (prefers-reduced-motion: reduce) {
    &, &[data-shown='false'] { transition: none; }
  }
  @media (min-width: 761px) {
    display: none;
  }
  @media print {
    display: none;
  }
`;

// watchRefs: refs to the action rows that make the dock redundant while visible.
export function MobileDock({ watchRefs }) {
  const [shown, setShown] = useState(false);

  // The footer reserves room for the dock while the home page is mounted (SiteChrome).
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.homeDock = 'true';
    return () => {
      delete root.dataset.homeDock;
    };
  }, []);

  useEffect(() => {
    const targets = watchRefs.map((ref) => ref.current).filter(Boolean);
    if (!targets.length) return undefined;
    if (!('IntersectionObserver' in window)) {
      setShown(true);
      return undefined;
    }
    const visible = new Map(targets.map((target) => [target, false]));
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) visible.set(entry.target, entry.isIntersecting);
      setShown(![...visible.values()].some(Boolean));
    });
    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
    // The refs are stable for the page's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Dock className="dock" data-shown={shown ? 'true' : 'false'} inert={shown ? undefined : true}>
      <LinkButton to="/join" variant="secondary" onStage>
        Join a game
      </LinkButton>
      <LinkButton to="/demo">Try a free demo</LinkButton>
    </Dock>
  );
}
