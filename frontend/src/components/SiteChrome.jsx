import React, { useEffect, useRef } from 'react';
import { Link, NavLink } from 'react-router-dom';
import styled from 'styled-components';
import { useAuth } from '../auth/AuthProvider';
import { BRAND } from '../lib/brand';
import { LEGAL, hasSellerIdentity } from '../lib/legal';
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from '../lib/support';
import { Button, Container, LinkButton } from './ui';

// On site pages the header stays in view: translucent over content, opaque where
// backdrop blur isn't supported. Below dialogs (top layer) and toasts (z 50).
// Game screens get a plain, static bar so the question has the whole screen.
const Header = styled.header`
  border-bottom: 1px solid var(--line);
  background: var(--paper);

  &[data-sticky='true'] {
    position: sticky;
    top: 0;
    z-index: 40;
    border-bottom-color: color-mix(in srgb, var(--line) 80%, transparent);
    transition: box-shadow 200ms ease, border-color 200ms ease;

    @supports ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
      background: color-mix(in srgb, var(--paper) 78%, transparent);
      -webkit-backdrop-filter: saturate(1.6) blur(14px);
      backdrop-filter: saturate(1.6) blur(14px);
    }
  }
  &[data-scrolled='true'] {
    border-bottom-color: var(--line);
    box-shadow: 0 8px 24px -18px rgba(20, 14, 34, 0.45);
  }
  @media (prefers-reduced-transparency: reduce) {
    &[data-sticky='true'] {
      background: var(--paper);
      -webkit-backdrop-filter: none;
      backdrop-filter: none;
    }
  }
`;

const HeaderInner = styled(Container)`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: var(--header-h);
`;

const Brand = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: var(--ink);
  text-decoration: none;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.25rem;
  letter-spacing: -0.02em;
  flex: 0 0 auto;
  &:hover { color: var(--ink); }
  img { width: 32px; height: 32px; border-radius: 9px; }
`;

const Nav = styled.nav`
  display: flex;
  align-items: center;
  gap: 2px;
  min-width: 0;

  a.nav-link {
    padding: 8px 12px;
    border-radius: 10px;
    color: var(--ink-2);
    text-decoration: none;
    font-weight: 700;
    font-size: 0.95rem;
    white-space: nowrap;
    &:hover { color: var(--ink); background: var(--surface-sunk); }
    &.active { color: var(--ink); box-shadow: inset 0 -2px 0 var(--accent); border-radius: 10px 10px 4px 4px; }
  }

  @media (max-width: 760px) {
    .hide-mobile { display: none; }
  }
  @media (max-width: 400px) {
    a.nav-link { padding: 8px; }
  }
`;

// A 1px sentinel at the top of the page: when it scrolls away, the header gets its shadow.
// One observer instead of a scroll listener, and no React re-render.
function useScrolledFlag(headerRef, enabled) {
  useEffect(() => {
    const header = headerRef.current;
    if (!enabled || !header || !('IntersectionObserver' in window)) return undefined;
    const sentinel = document.createElement('div');
    sentinel.setAttribute('aria-hidden', 'true');
    sentinel.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:1px;pointer-events:none;';
    document.body.prepend(sentinel);
    const observer = new IntersectionObserver(([entry]) => {
      header.setAttribute('data-scrolled', entry.isIntersecting ? 'false' : 'true');
    });
    observer.observe(sentinel);
    return () => {
      observer.disconnect();
      sentinel.remove();
      header.removeAttribute('data-scrolled');
    };
  }, [headerRef, enabled]);
}

export function SiteHeader({ minimal = false }) {
  const { user, isAuthLoading, isConfigured, signIn } = useAuth();
  const headerRef = useRef(null);
  useScrolledFlag(headerRef, !minimal);
  return (
    <Header ref={headerRef} data-sticky={minimal ? 'false' : 'true'}>
      <HeaderInner>
        <Brand to="/" aria-label={`${BRAND.name} home`}>
          <img src="/favicon-192.png" alt="" width="32" height="32" />
          {BRAND.name}
        </Brand>
        {minimal ? null : (
          <Nav aria-label="Main">
            <a className="nav-link hide-mobile" href="/#how-it-works">How it works</a>
            <a className="nav-link hide-mobile" href="/#pricing">Pricing</a>
            <NavLink className="nav-link" to="/join">Join a game</NavLink>
            {user ? (
              <NavLink className="nav-link" to="/account">Account</NavLink>
            ) : isConfigured ? (
              <Button variant="secondary" size="sm" onClick={signIn} disabled={isAuthLoading}>
                Sign in
              </Button>
            ) : null}
          </Nav>
        )}
      </HeaderInner>
    </Header>
  );
}

const Footer = styled.footer`
  border-top: 1px solid var(--line);
  padding: 32px 0 40px;
  color: var(--ink-2);
  font-size: 0.95rem;
`;

const FooterGrid = styled(Container)`
  display: grid;
  gap: 20px;
  grid-template-columns: 1.4fr 1fr;
  @media (max-width: 700px) { grid-template-columns: 1fr; }

  nav { display: flex; flex-wrap: wrap; gap: 8px 18px; justify-content: flex-end; align-content: flex-start; }
  @media (max-width: 700px) { nav { justify-content: flex-start; } }
  a { color: var(--ink-2); font-weight: 700; }
  a:hover { color: var(--ink); }
`;

export function SiteFooter() {
  return (
    <Footer>
      <FooterGrid>
        <div>
          <p>
            <strong>{BRAND.name}</strong> — live quizzes for friends, classes and teams.
          </p>
          <p>
            Questions or problems? <a href={SUPPORT_MAILTO}>{SUPPORT_EMAIL}</a>
          </p>
          {hasSellerIdentity ? (
            <p>
              {LEGAL.sellerName}
              {LEGAL.registryCode ? `, reg. code ${LEGAL.registryCode}` : ''} · {LEGAL.address}
            </p>
          ) : null}
        </div>
        <nav aria-label="Legal">
          <Link to="/pricing">Pricing</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/privacy">Privacy</Link>
          <Link to="/refunds">Refunds &amp; cancellation</Link>
          <Link to="/contact">Contact</Link>
        </nav>
      </FooterGrid>
    </Footer>
  );
}

const ToastBox = styled.div`
  position: fixed;
  left: 50%;
  bottom: max(16px, env(safe-area-inset-bottom));
  transform: translateX(-50%);
  z-index: 50;
  max-width: min(92vw, 460px);
  padding: 12px 18px;
  border-radius: 12px;
  background: var(--ink);
  color: var(--paper);
  font-weight: 700;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
  text-align: center;
`;

// Always rendered so screen readers announce changes.
export function Toast({ toast }) {
  return (
    <div aria-live="polite" aria-atomic="true">
      {toast ? <ToastBox key={toast.id}>{toast.message}</ToastBox> : null}
    </div>
  );
}

export function NotFoundPage() {
  return (
    <Container $narrow style={{ padding: '64px var(--gutter)' }}>
      <h1 style={{ fontSize: '2rem' }}>Page not found</h1>
      <p style={{ margin: '12px 0 24px', color: 'var(--ink-2)' }}>That link doesn’t lead anywhere. If you were joining a game, check the room code.</p>
      <LinkButton to="/">Go to the home page</LinkButton>
    </Container>
  );
}
