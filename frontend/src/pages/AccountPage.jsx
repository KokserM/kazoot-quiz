import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { createCheckoutSession, fetchBillingCatalog } from '../lib/api';
import { useAuth } from '../auth/AuthProvider';
import { AccountStatusBar, getDisplayName } from '../components/AccountStatusBar';
import { TrustFooter } from '../components/TrustFooter';
import { SUPPORT_EMAIL } from '../lib/support';
import {
  Banner,
  Button,
  ButtonRow,
  Card,
  CenteredContent,
  Cluster,
  Eyebrow,
  GlassPanel,
  Grid,
  HelperText,
  PageShell,
  PanelBody,
  PanelTitleHeader,
  SectionTitle,
  Stack,
  StatChip,
  Subtitle,
} from '../components/ui';

function Shell({ children }) {
  return (
    <PageShell>
      <CenteredContent>
        <AccountStatusBar />
        {children}
        <TrustFooter />
      </CenteredContent>
    </PageShell>
  );
}

const PLAN_DETAILS = {
  plus_monthly: {
    title: 'Plus monthly',
    badge: 'Regular hosting',
    family: 'Subscription',
    description: 'For weekly quiz nights and small groups that want a predictable monthly allowance.',
    cta: 'Subscribe to Plus',
  },
  pro_monthly: {
    title: 'Pro monthly',
    badge: 'Best subscription value',
    family: 'Subscription',
    description: 'For classrooms, teams, events, and hosts who run games more than once a week.',
    cta: 'Subscribe to Pro',
  },
  credits_20: {
    title: 'Pack 20',
    badge: 'No subscription',
    family: 'AI game pack',
    description: 'A simple one-time top-up when you want fresh games without monthly renewal.',
    cta: 'Buy Pack 20',
  },
  credits_60: {
    title: 'Pack 60',
    badge: 'Flexible pack',
    family: 'AI game pack',
    description: 'A flexible pack for busier months, parties, and occasional hosting streaks.',
    cta: 'Buy Pack 60',
  },
  credits_150: {
    title: 'Pack 150',
    badge: 'Best pack value',
    family: 'AI game pack',
    description: 'Best for bigger events, classrooms, and teams that want plenty of room to host.',
    cta: 'Buy Pack 150',
  },
};

export function formatPlanPrice({ amountCents, currency = 'EUR', interval = null }) {
  if (typeof amountCents !== 'number') {
    return 'Price shown in checkout';
  }

  const amount = new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
    maximumFractionDigits: amountCents % 100 === 0 ? 0 : 2,
  }).format(amountCents / 100);

  return interval === 'month' ? `${amount} / month` : `${amount} one-time`;
}

export function formatPricePerAiGame({ pricePerAiGameCents, currency = 'EUR' }) {
  if (typeof pricePerAiGameCents !== 'number') {
    return '';
  }

  const amount = new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(pricePerAiGameCents / 100);

  return `${amount} per AI game`;
}

export function getPlanCreditLine(plan) {
  return plan.mode === 'subscription'
    ? `${plan.credits} AI games each month`
    : `${plan.credits} AI games, valid 12 months`;
}

function getPlanDetails(plan) {
  return PLAN_DETAILS[plan.id] || {
    title: `${plan.credits} AI game plan`,
    badge: plan.mode === 'subscription' ? 'Subscription' : 'AI game pack',
    family: plan.mode === 'subscription' ? 'Subscription' : 'AI game pack',
    description: `${plan.credits} AI games ${plan.mode === 'subscription' ? 'for regular hosting.' : 'for flexible hosting.'}`,
    cta: 'Choose plan',
  };
}

export default function AccountPage() {
  const {
    accessToken,
    authError,
    isAuthLoading,
    isConfigured,
    refreshUsage,
    signIn,
    signOut: doSignOut,
    usage,
    user,
  } = useAuth();
  const [plans, setPlans] = useState([]);
  const [error, setError] = useState('');
  const [isLoadingPlan, setIsLoadingPlan] = useState('');
  const freeRemainingThisMonth = usage?.freeRemainingThisMonth ?? usage?.freeRemainingToday ?? 0;
  const paidCredits = usage?.credits ?? 0;
  const needsCredits = Boolean(user && usage && freeRemainingThisMonth <= 0 && paidCredits <= 0);
  const subscriptionPlans = plans.filter((plan) => plan.mode === 'subscription');
  const packPlans = plans.filter((plan) => plan.mode !== 'subscription');

  useEffect(() => {
    fetchBillingCatalog()
      .then((payload) => setPlans(payload.plans || []))
      .catch(() => setPlans([]));
  }, []);

  async function handleCheckout(planId) {
    setError('');
    setIsLoadingPlan(planId);
    try {
      const checkout = await createCheckoutSession(planId, accessToken);
      window.location.href = checkout.url;
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsLoadingPlan('');
    }
  }

  return (
    <Shell>
      <GlassPanel initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
        <PanelTitleHeader>
          <SectionTitle>Choose how often you host</SectionTitle>
        </PanelTitleHeader>
        <PanelBody>
        <Card initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ marginBottom: 18 }}>
            <Eyebrow>Account and AI games left</Eyebrow>
            <Subtitle style={{ marginTop: 12 }}>
              Start each month with 3 free AI games. Subscribe if you host regularly, or buy a pack
              when you only need a top-up. Subscription AI games roll over for one extra month.
            </Subtitle>
          <ButtonRow style={{ marginTop: 18 }}>
            <Button as={Link} to="/create" variant="ghost" compact>
              Back to create
            </Button>
          </ButtonRow>
        </Card>

        {error ? <Banner $tone="danger">{error}</Banner> : null}
        {authError ? <Banner $tone="danger">{authError}</Banner> : null}

        {isAuthLoading ? (
          <Card initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <SectionTitle>Checking your sign-in</SectionTitle>
            <Subtitle style={{ marginTop: 8 }}>
              Hold on while Kazoot confirms your Google account and AI games left.
            </Subtitle>
          </Card>
        ) : !user ? (
          <Card initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <SectionTitle>Sign in to see your AI games left</SectionTitle>
            <Subtitle style={{ marginTop: 8 }}>
              Sign in when you want fresh AI-generated questions. Demo games still work without an account.
            </Subtitle>
            <ButtonRow style={{ marginTop: 18 }}>
              <Button type="button" disabled={!isConfigured} onClick={signIn} whileTap={{ scale: 0.98 }}>
                Continue with Google
              </Button>
            </ButtonRow>
          </Card>
        ) : (
          <>
            <Card initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ background: needsCredits ? 'rgba(245, 158, 11, 0.14)' : undefined }}>
              <Eyebrow>{needsCredits ? 'Action needed' : 'Ready to host'}</Eyebrow>
              <div style={{ marginTop: 14 }}>
                <SectionTitle>
                  {needsCredits ? 'Choose a plan or pack to keep hosting fresh games.' : `Ready to host, ${getDisplayName(user)}.`}
                </SectionTitle>
                <Subtitle style={{ marginTop: 8 }}>
                  {needsCredits
                    ? 'Your free games for this month are used. Pick a subscription for regular hosting or a pack for occasional games.'
                    : 'Your free monthly games are used first. Paid AI games stay available until you need them.'}
                </Subtitle>
              </div>

              <Grid
                gap="12px"
                columns="repeat(auto-fit, minmax(min(100%, 220px), 1fr))"
                $mobileColumns="1fr"
                style={{ marginTop: 18 }}
              >
                <StatChip style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{user.email}</StatChip>
                <StatChip style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                  {freeRemainingThisMonth} free AI games left this month
                </StatChip>
                <StatChip style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{paidCredits} paid AI games left</StatChip>
                <StatChip style={{ minWidth: 0, overflowWrap: 'anywhere' }}>Tier: {usage?.tier || 'free'}</StatChip>
              </Grid>

              <ButtonRow style={{ marginTop: 18 }}>
                <Button type="button" variant="secondary" compact onClick={refreshUsage} whileTap={{ scale: 0.98 }}>
                  Refresh usage
                </Button>
                <Button as={Link} to="/create" compact>
                  Host a game
                </Button>
                <Button type="button" variant="ghost" compact onClick={doSignOut} whileTap={{ scale: 0.98 }}>
                  Sign out
                </Button>
              </ButtonRow>
            </Card>

            {[
              ['Monthly plans', subscriptionPlans],
              ['One-time packs', packPlans],
            ].map(([groupTitle, groupPlans]) => (
              groupPlans.length ? (
                <Stack key={groupTitle} gap="12px" style={{ marginTop: 24 }}>
                  <SectionTitle style={{ fontSize: '1.35rem' }}>{groupTitle}</SectionTitle>
                  <Grid gap="16px" columns="repeat(auto-fit, minmax(240px, 1fr))" $mobileColumns="1fr">
                    {groupPlans.map((plan) => {
                      const details = getPlanDetails(plan);
                      const isSubscription = plan.mode === 'subscription';
                      const pricePerAiGame = formatPricePerAiGame(plan);

                      return (
                        <Card
                          key={plan.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          style={{ background: isSubscription ? 'rgba(124, 58, 237, 0.16)' : undefined }}
                        >
                          <Stack gap="12px" style={{ height: '100%' }}>
                            <Cluster justify="space-between" align="flex-start">
                              <Eyebrow>{details.badge}</Eyebrow>
                              <StatChip>{details.family}</StatChip>
                            </Cluster>
                            <SectionTitle style={{ fontSize: '1.2rem' }}>
                              {details.title}
                            </SectionTitle>
                            <div style={{ fontSize: '1.65rem', fontWeight: 900, letterSpacing: '-0.04em' }}>
                              {formatPlanPrice(plan)}
                            </div>
                            <StatChip style={{ width: 'fit-content' }}>{getPlanCreditLine(plan)}</StatChip>
                            <Subtitle>{details.description}</Subtitle>
                            <HelperText>
                              {isSubscription
                                ? 'Unused subscription games roll over for one extra month.'
                                : 'Packs are one-time purchases and last 12 months.'}
                            </HelperText>
                            {pricePerAiGame ? <HelperText>{pricePerAiGame}</HelperText> : null}
                            <HelperText>Secure checkout by Stripe.</HelperText>
                            <Button
                              type="button"
                              compact
                              disabled={!plan.configured || isLoadingPlan === plan.id}
                              onClick={() => handleCheckout(plan.id)}
                              whileTap={{ scale: 0.98 }}
                              style={{ alignSelf: 'center', marginTop: 'auto' }}
                            >
                              {isLoadingPlan === plan.id ? 'Opening checkout...' : plan.configured ? details.cta : 'Coming soon'}
                            </Button>
                          </Stack>
                        </Card>
                      );
                    })}
                  </Grid>
                </Stack>
              ) : null
            ))}
            <Card initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ marginTop: 18 }}>
              <Stack gap="12px">
                <Eyebrow>Safe checkout, fair credits</Eyebrow>
                <SectionTitle style={{ fontSize: '1.2rem' }}>Buy AI games with clear rules.</SectionTitle>
                <Subtitle>
                  Checkout opens through Stripe. Free monthly games are used first, paid games stay on your
                  account until used or expired, and failed generations do not spend a credit.
                </Subtitle>
                <Grid gap="12px" columns="repeat(auto-fit, minmax(200px, 1fr))" $mobileColumns="1fr">
                  <StatChip>Card details handled by Stripe</StatChip>
                  <StatChip>Failed generations do not spend credits</StatChip>
                  <StatChip>Support: {SUPPORT_EMAIL}</StatChip>
                </Grid>
                <HelperText>We aim to reply to support requests within 2 business days.</HelperText>
              </Stack>
            </Card>
          </>
        )}
        </PanelBody>
      </GlassPanel>
    </Shell>
  );
}
