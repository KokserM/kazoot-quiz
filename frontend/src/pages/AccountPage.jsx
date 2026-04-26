import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { createCheckoutSession, fetchBillingCatalog } from '../lib/api';
import { useAuth } from '../auth/AuthProvider';
import { AccountStatusBar, getDisplayName } from '../components/AccountStatusBar';
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
      </CenteredContent>
    </PageShell>
  );
}

const PLAN_DETAILS = {
  plus_monthly: {
    title: 'Plus monthly',
    badge: 'Best for regular hosts',
    family: 'Subscription',
    description: '20 AI games every month for weekly quiz nights and small communities.',
    cta: 'Subscribe to Plus',
  },
  pro_monthly: {
    title: 'Pro monthly',
    badge: 'Best value',
    family: 'Subscription',
    description: '75 AI games every month for frequent hosts, classrooms, teams, and recurring events.',
    cta: 'Subscribe to Pro',
  },
  credits_20: {
    title: 'Pack 20',
    badge: 'One-time top-up',
    family: 'AI game pack',
    description: '20 AI games without a subscription. Good when you only need an occasional boost.',
    cta: 'Buy Pack 20',
  },
  credits_60: {
    title: 'Pack 60',
    badge: 'Flexible pack',
    family: 'AI game pack',
    description: '60 AI games for busier months without committing to a subscription.',
    cta: 'Buy Pack 60',
  },
  credits_150: {
    title: 'Pack 150',
    badge: 'Best pack value',
    family: 'AI game pack',
    description: '150 AI games for events, classrooms, and busy seasons. Packs last 12 months.',
    cta: 'Buy Pack 150',
  },
};

function getPlanDetails(plan) {
  return PLAN_DETAILS[plan.id] || {
    title: `${plan.credits} AI game plan`,
    badge: plan.mode === 'subscription' ? 'Subscription' : 'AI game pack',
    family: plan.mode === 'subscription' ? 'Subscription' : 'AI game pack',
    description: `${plan.credits} AI games ${plan.mode === 'subscription' ? 'included each month.' : 'added after payment.'}`,
    cta: 'Choose plan',
  };
}

export default function AccountPage() {
  const { accessToken, authError, isConfigured, refreshUsage, signIn, signOut: doSignOut, usage, user } = useAuth();
  const [plans, setPlans] = useState([]);
  const [error, setError] = useState('');
  const [isLoadingPlan, setIsLoadingPlan] = useState('');
  const freeRemainingThisMonth = usage?.freeRemainingThisMonth ?? usage?.freeRemainingToday ?? 0;
  const paidCredits = usage?.credits ?? 0;
  const needsCredits = Boolean(user && usage && freeRemainingThisMonth <= 0 && paidCredits <= 0);

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
          <SectionTitle>Control GPT-5.4 spend</SectionTitle>
        </PanelTitleHeader>
        <PanelBody>
        <Card initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ marginBottom: 18 }}>
            <Eyebrow>Account & AI games</Eyebrow>
            <Subtitle style={{ marginTop: 12 }}>
              AI question generation is metered. You get 3 free AI games per month, then paid AI games
              keep generation predictable. Subscription AI games roll over for one extra month. Packs last 12 months.
            </Subtitle>
          <ButtonRow style={{ marginTop: 18 }}>
            <Button as={Link} to="/create" variant="ghost" compact>
              Back to create
            </Button>
          </ButtonRow>
        </Card>

        {error ? <Banner $tone="danger">{error}</Banner> : null}
        {authError ? <Banner $tone="danger">{authError}</Banner> : null}

        {!user ? (
          <Card initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <SectionTitle>Sign in to track AI games left</SectionTitle>
            <Subtitle style={{ marginTop: 8 }}>
              Google login is required for GPT-5.4 generation and billing. Demo games can still run without it.
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
                  {needsCredits ? 'Add AI games to keep generating.' : `Welcome back, ${getDisplayName(user)}.`}
                </SectionTitle>
                <Subtitle style={{ marginTop: 8 }}>
                  {needsCredits
                    ? 'Your free AI games are used for this month and you have no paid AI games left. Subscribe or buy a pack before hosting the next AI-generated game.'
                    : 'Your free monthly games are used first. Paid AI games are only spent after the free allowance runs out.'}
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

            <Grid gap="16px" columns="repeat(auto-fit, minmax(240px, 1fr))" $mobileColumns="1fr" style={{ marginTop: 24 }}>
              {plans.map((plan) => {
                const details = getPlanDetails(plan);
                const isSubscription = plan.mode === 'subscription';

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
                      <Subtitle>{details.description}</Subtitle>
                      <HelperText>
                        {plan.credits} AI games {plan.mode === 'subscription' ? 'included each month. Unused games roll over for one extra month.' : 'added after payment and valid for 12 months.'}
                      </HelperText>
                      <Button
                        type="button"
                        compact
                        disabled={!plan.configured || isLoadingPlan === plan.id}
                        onClick={() => handleCheckout(plan.id)}
                        whileTap={{ scale: 0.98 }}
                        style={{ alignSelf: 'center', marginTop: 'auto' }}
                      >
                        {isLoadingPlan === plan.id ? 'Opening checkout...' : plan.configured ? details.cta : 'Not configured'}
                      </Button>
                    </Stack>
                  </Card>
                );
              })}
            </Grid>
          </>
        )}
        </PanelBody>
      </GlassPanel>
    </Shell>
  );
}
