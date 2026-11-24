import React, { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import { NotFoundPage, SiteFooter, SiteHeader } from './components/SiteChrome';
import { Container, PageMain, Spinner } from './components/ui';
import HomePage from './pages/HomePage';
import { GameProvider } from './providers/GameProvider';
import { useGameShellMounted } from './lib/useGameShell';
import { GlobalStyle } from './styles/GlobalStyle';

const DemoPage = lazy(() => import('./pages/DemoPage'));
const CreatePage = lazy(() => import('./pages/CreatePage'));
const JoinPage = lazy(() => import('./pages/JoinPage'));
const SessionPage = lazy(() => import('./pages/SessionPage'));
const AccountPage = lazy(() => import('./pages/AccountPage'));
const legal = () => import('./pages/LegalPages');
const PrivacyPage = lazy(() => legal().then((module) => ({ default: module.PrivacyPage })));
const TermsPage = lazy(() => legal().then((module) => ({ default: module.TermsPage })));
const RefundsPage = lazy(() => legal().then((module) => ({ default: module.RefundsPage })));
const ContactPage = lazy(() => legal().then((module) => ({ default: module.ContactPage })));
const PricingPage = lazy(() => legal().then((module) => ({ default: module.PricingPage })));
// Dev-only game-stage gallery (brief 12, A2); not part of production builds.
const DevStagePage = import.meta.env.DEV ? lazy(() => import('./pages/DevStagePage')) : null;

const TITLES = {
  '/': 'Kazoot — live quizzes where the host plays too',
  '/demo': 'Free demo · Kazoot',
  '/create': 'Create a quiz · Kazoot',
  '/join': 'Join a game · Kazoot',
  '/account': 'Your account · Kazoot',
  '/pricing': 'Pricing · Kazoot',
  '/privacy': 'Privacy · Kazoot',
  '/terms': 'Terms · Kazoot',
  '/refunds': 'Refunds & cancellation · Kazoot',
  '/contact': 'Contact · Kazoot',
};

const CANONICAL_ORIGIN = 'https://www.kazoot.app';

// Public pages point search engines and link previews at www.kazoot.app + the page's
// path (invite links /join/CODE collapse to /join). Game rooms and unknown paths get none.
function syncCanonical(base) {
  let link = document.querySelector('link[rel="canonical"]');
  if (!TITLES[base]) {
    link?.remove();
    return;
  }
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', `${CANONICAL_ORIGIN}${base}`);
}

// Keeps the document title meaningful and moves focus to the top on navigation,
// so screen-reader and keyboard users land at the start of the new page.
function RouteEffects() {
  const location = useLocation();
  useEffect(() => {
    const base = `/${location.pathname.split('/')[1] || ''}`;
    document.title = TITLES[base] || (base === '/session' ? 'Game · Kazoot' : 'Kazoot');
    syncCanonical(base);
    if (!location.hash) {
      window.scrollTo(0, 0);
      document.getElementById('main-start')?.focus({ preventScroll: true });
    }
  }, [location.pathname, location.hash]);
  return null;
}

function Loading() {
  return (
    <PageMain>
      <Container>
        <p role="status">
          <Spinner aria-hidden="true" /> Loading…
        </p>
      </Container>
    </PageMain>
  );
}

function Layout() {
  const location = useLocation();
  const inGame = location.pathname.startsWith('/session/') || (import.meta.env.DEV && location.pathname.startsWith('/dev/stage'));
  // While the game shell is on screen there is no site header or footer (brief 8.1).
  const shellMounted = useGameShellMounted();
  useEffect(() => {
    document.documentElement.dataset.stage = inGame ? 'true' : 'false';
  }, [inGame]);
  return (
    <>
      <a href="#main-start" className="visually-hidden" style={{ position: 'absolute' }}>
        Skip to content
      </a>
      {shellMounted ? null : <SiteHeader minimal={inGame} />}
      <div id="main-start" tabIndex={-1} style={{ outline: 'none' }} />
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/demo" element={<DemoPage />} />
          <Route path="/create" element={<CreatePage />} />
          <Route path="/join" element={<JoinPage />} />
          <Route path="/join/:code" element={<JoinPage />} />
          <Route path="/session/:sessionId" element={<SessionPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/refunds" element={<RefundsPage />} />
          <Route path="/contact" element={<ContactPage />} />
          {DevStagePage ? <Route path="/dev/stage" element={<DevStagePage />} /> : null}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
      {inGame || shellMounted ? null : <SiteFooter />}
    </>
  );
}

export default function App() {
  return (
    <>
      <GlobalStyle />
      <AuthProvider>
        <GameProvider>
          <BrowserRouter>
            <RouteEffects />
            <Layout />
          </BrowserRouter>
        </GameProvider>
      </AuthProvider>
    </>
  );
}
