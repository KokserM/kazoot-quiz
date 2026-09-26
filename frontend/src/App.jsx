import React, { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import { NotFoundPage, SiteFooter, SiteHeader } from './components/SiteChrome';
import { Container, PageMain, Spinner } from './components/ui';
import HomePage from './pages/HomePage';
import { GameProvider } from './providers/GameProvider';
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

// Keeps the document title meaningful and moves focus to the top on navigation,
// so screen-reader and keyboard users land at the start of the new page.
function RouteEffects() {
  const location = useLocation();
  useEffect(() => {
    const base = `/${location.pathname.split('/')[1] || ''}`;
    document.title = TITLES[base] || (base === '/session' ? 'Game · Kazoot' : 'Kazoot');
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
  const inGame = location.pathname.startsWith('/session/');
  return (
    <>
      <a href="#main-start" className="visually-hidden" style={{ position: 'absolute' }}>
        Skip to content
      </a>
      <SiteHeader minimal={inGame} />
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
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
      {inGame ? null : <SiteFooter />}
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
