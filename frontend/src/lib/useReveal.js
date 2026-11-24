import { useEffect } from 'react';

// Scroll-reveal (effect E7). Every element with a `data-reveal` attribute inside
// `containerRef` gets `data-in` once it scrolls into view; GlobalStyle animates
// opacity/transform between the two (only without a reduced-motion preference, so
// content is never hidden for those visitors). One shared observer, each element once.
// Without IntersectionObserver everything is shown immediately.
// Keep it to the home page and to at most ~12 elements (brief 10.2).
export function useReveal(containerRef) {
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return undefined;
    const targets = Array.from(root.querySelectorAll('[data-reveal]:not([data-in])'));
    if (!targets.length) return undefined;
    const show = (element) => element.setAttribute('data-in', '');
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      targets.forEach(show);
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          show(entry.target);
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -10% 0px' }
    );
    targets.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [containerRef]);
}
