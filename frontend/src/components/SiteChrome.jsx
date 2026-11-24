import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { useAuth } from '../auth/AuthProvider';
import { BRAND } from '../lib/brand';
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from '../lib/support';
import { useTheme } from '../lib/theme';
import { Icon } from './Icon';
import { SellerLine } from './SellerLine';
import { Button, Container, LinkButton, SegmentedControl } from './ui';

// On site pages the header stays in view. On phones and touch devices it is a solid
// bar (a blurred sticky bar repaints on every scroll frame on low-end phones); only
// wide, hover-capable screens get the translucent, blurred version. Below dialogs
// (top layer) and toasts. Game screens get a plain, static bar.
const Header = styled.header`
  position: relative;
  border-bottom: 1px solid var(--line);
  background: var(--paper);

  &[data-sticky='true'] {
    position: sticky;
    top: 0;
    z-index: var(--z-header);
    background: var(--scrim);
    border-bottom-color: color-mix(in srgb, var(--line) 80%, transparent);
    transition: box-shadow 200ms ease, border-color 200ms ease;

    @media (min-width: 761px) and (hover: hover) {
      @supports ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
        background: color-mix(in srgb, var(--paper) 78%, transparent);
        -webkit-backdrop-filter: saturate(1.6) blur(14px);
        backdrop-filter: saturate(1.6) blur(14px);
      }
    }
  }
  &[data-scrolled='true'] {
    border-bottom-color: var(--line);
    box-shadow: 0 8px 24px -18px rgba(0, 0, 0, 0.6);
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
  min-height: 44px;
  color: var(--ink);
  text-decoration: none;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.25rem;
  letter-spacing: -0.02em;
  flex: 0 0 auto;
  &:hover { color: var(--ink); }

  /* Logo tile: a 1 px ring and a soft halo so the dark tile separates from the dark page (E9). */
  .logo-tile {
    display: inline-flex;
    width: 32px;
    height: 32px;
    border-radius: 30%;
    box-shadow: var(--glow-logo);
    flex: 0 0 auto;
  }
  .logo-tile img { width: 32px; height: 32px; border-radius: 30%; }
`;

const Nav = styled.nav`
  display: flex;
  align-items: center;
  gap: 2px;
  min-width: 0;

  a.nav-link {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 0 12px;
    border-radius: 10px;
    color: var(--ink-2);
    text-decoration: none;
    font-weight: 700;
    font-size: 0.95rem;
    white-space: nowrap;
    &:hover { color: var(--ink); background: var(--surface-sunk); }
    &.active { color: var(--ink); box-shadow: inset 0 -2px 0 var(--accent); border-radius: 10px 10px 4px 4px; }
  }

  .menu-button {
    min-width: 44px;
    width: 44px;
    padding: 0;
  }

  @media (min-width: 761px) {
    .show-mobile { display: none; }
  }
  @media (max-width: 760px) {
    .hide-mobile, a.nav-link.hide-mobile { display: none; }
    a.nav-link { padding: 0 10px; }
  }
`;

// Phone menu: a disclosure under the header (not a modal: no focus trap, page scrolls).
const MenuPanel = styled.div`
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: var(--z-menu);
  background: var(--surface);
  border-bottom: 1px solid var(--line);
  box-shadow: 0 24px 40px -24px rgba(0, 0, 0, 0.8);
  padding: 8px var(--gutter) 16px;

  &[hidden] { display: none; }
  @media (min-width: 761px) {
    display: none;
  }
  @media (prefers-reduced-motion: no-preference) {
    animation: menu-in var(--dur-fast) var(--ease-out);
  }

  ul { list-style: none; margin: 0; padding: 0; }
  li + li { border-top: 1px solid var(--line); }
  a {
    display: flex;
    align-items: center;
    min-height: 52px;
    color: var(--ink);
    font-weight: 700;
    font-size: 1.05rem;
    text-decoration: none;
  }
  a:hover { color: var(--accent-text); }
  .menu-sign-in { margin-top: 12px; }
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

// Opens on press; closes on a second press, Escape (focus back to the button), a press
// outside the header, choosing a row, and route changes. Focus moves to the first row on open.
function useDisclosure(headerRef, buttonRef, panelRef) {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.hash]);

  useEffect(() => {
    if (!open) return undefined;
    panelRef.current?.querySelector('a, button')?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onPointerDown = (event) => {
      if (headerRef.current && !headerRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open, headerRef, buttonRef, panelRef]);

  return [open, setOpen];
}

export function SiteHeader({ minimal = false }) {
  const { user, isAuthLoading, isConfigured, signIn } = useAuth();
  const headerRef = useRef(null);
  const menuButtonRef = useRef(null);
  const menuRef = useRef(null);
  const [menuOpen, setMenuOpen] = useDisclosure(headerRef, menuButtonRef, menuRef);
  useScrolledFlag(headerRef, !minimal);
  const closeMenu = () => setMenuOpen(false);

  return (
    <Header ref={headerRef} data-sticky={minimal ? 'false' : 'true'}>
      <HeaderInner>
        <Brand to="/" aria-label={`${BRAND.name} home`}>
          <span className="logo-tile">
            <img src="/favicon-192.png" alt="" width="32" height="32" />
          </span>
          {BRAND.name}
        </Brand>
        {minimal ? null : (
          <Nav aria-label="Main">
            <a className="nav-link hide-mobile" href="/#how-it-works">How it works</a>
            <a className="nav-link hide-mobile" href="/#pricing">Pricing</a>
            <NavLink className="nav-link" to="/join">Join a game</NavLink>
            {user ? (
              <NavLink className="nav-link hide-mobile" to="/account">Account</NavLink>
            ) : isConfigured ? (
              <Button variant="secondary" size="sm" className="hide-mobile" onClick={signIn} disabled={isAuthLoading}>
                Sign in
              </Button>
            ) : null}
            <Button
              ref={menuButtonRef}
              variant="ghost"
              size="sm"
              className="menu-button show-mobile"
              aria-label="Menu"
              aria-expanded={menuOpen}
              aria-controls="site-menu"
              onClick={() => setMenuOpen((value) => !value)}
            >
              <Icon name={menuOpen ? 'x' : 'menu'} size="1.4em" strokeWidth={2.2} />
            </Button>
            <MenuPanel id="site-menu" ref={menuRef} hidden={!menuOpen}>
              <ul>
                <li><a href="/#how-it-works" onClick={closeMenu}>How it works</a></li>
                <li><a href="/#pricing" onClick={closeMenu}>Pricing</a></li>
                <li><Link to="/demo" onClick={closeMenu}>Try a free demo</Link></li>
                <li><Link to="/create" onClick={closeMenu}>Create a quiz</Link></li>
                {user ? <li><Link to="/account" onClick={closeMenu}>Account</Link></li> : null}
              </ul>
              {!user && isConfigured ? (
                <Button
                  variant="secondary"
                  block
                  className="menu-sign-in"
                  onClick={() => {
                    closeMenu();
                    signIn();
                  }}
                  disabled={isAuthLoading}
                >
                  Sign in
                </Button>
              ) : null}
            </MenuPanel>
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

  /* The home page's mobile dock (it sets <html data-home-dock="true">) must never
     cover the last footer row. */
  @media (max-width: 760px) {
    :root[data-home-dock='true'] & { padding-bottom: calc(40px + var(--dock-h)); }
  }
`;

const FooterGrid = styled(Container)`
  display: grid;
  gap: 20px 32px;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
  grid-template-areas: 'info nav' 'info theme';
  align-items: start;
  @media (max-width: 700px) {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas: 'info' 'nav' 'theme';
  }

  .footer-info { grid-area: info; display: flex; flex-direction: column; gap: 4px; }
  .footer-info .mail { display: inline-flex; align-items: center; min-height: 44px; }

  nav {
    grid-area: nav;
    display: flex;
    flex-wrap: wrap;
    gap: 0 4px;
    justify-content: flex-end;
    align-content: flex-start;
  }
  nav a { display: inline-flex; align-items: center; min-height: 44px; padding: 0 6px; }
  @media (max-width: 700px) {
    nav { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 16px; margin: 0 -6px; }
  }

  .footer-theme { grid-area: theme; justify-self: end; }
  @media (max-width: 700px) { .footer-theme { justify-self: start; } }
  .footer-theme legend { font-size: var(--type-caption) !important; color: var(--ink-3); }
  .footer-theme .segments { width: max-content; grid-template-columns: repeat(2, minmax(72px, auto)); }
  .footer-theme .segment { min-height: 44px; min-width: 72px; padding: 6px 14px; }

  a { color: var(--ink-2); font-weight: 700; }
  a:hover { color: var(--ink); }
`;

// Footer switch: dark (default) or light. Instant, no transition.
function ThemeSwitch() {
  const [theme, setTheme] = useTheme();
  return (
    <SegmentedControl
      legend="Theme"
      name="site-theme"
      value={theme}
      onChange={setTheme}
      options={[
        { value: 'dark', label: 'Dark' },
        { value: 'light', label: 'Light' },
      ]}
    />
  );
}

export function SiteFooter() {
  return (
    <Footer>
      <FooterGrid>
        <div className="footer-info">
          <p>
            <strong>{BRAND.name}</strong> — live quizzes for friends, classes and teams.
          </p>
          <p>
            Questions or problems?{' '}
            <a className="mail" href={SUPPORT_MAILTO}>
              {SUPPORT_EMAIL}
            </a>
          </p>
          <SellerLine label="Operated by" withLink />
        </div>
        <nav aria-label="Legal">
          <Link to="/pricing">Pricing</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/privacy">Privacy</Link>
          <Link to="/refunds">Refunds &amp; cancellation</Link>
          <Link to="/contact">Contact</Link>
        </nav>
        <div className="footer-theme">
          <ThemeSwitch />
        </div>
      </FooterGrid>
    </Footer>
  );
}

const ToastBox = styled.div`
  position: fixed;
  left: 50%;
  bottom: max(16px, env(safe-area-inset-bottom));
  transform: translateX(-50%);
  z-index: var(--z-toast);
  max-width: min(92vw, 460px);
  padding: 12px 18px;
  border-radius: 12px;
  background: var(--ink);
  color: var(--paper);
  font-weight: 700;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
  text-align: center;

  /* Inside the game shell toasts sit under the top bar, so they never cover the dock. */
  &[data-placement='top'] {
    top: calc(env(safe-area-inset-top) + clamp(36px, 6.5cqh, 76px) + 12px);
    bottom: auto;
  }
`;

// Always rendered so screen readers announce changes.
// placement: 'bottom' (default, site pages) | 'top' (inside the game shell).
export function Toast({ toast, placement = 'bottom' }) {
  return (
    <div aria-live="polite" aria-atomic="true">
      {toast ? (
        <ToastBox key={toast.id} data-placement={placement}>
          {toast.message}
        </ToastBox>
      ) : null}
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
