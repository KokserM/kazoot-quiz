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
    description: 'A predictable monthly credit refill for weekly quiz nights and small communities.',
    cta: 'Subscribe to Plus',
  },
  pro_monthly: {
    title: 'Pro monthly',
    badge: 'Best value',
    family: 'Subscription',
    description: 'More credits for frequent hosts, classrooms, teams, and bigger recurring events.',
    cta: 'Subscribe to Pro',
  },
  credits_100: {
    title: '100 credit pack',
    badge: 'One-time top-up',
    family: 'Credit pack',
    description: 'Add credits without a subscription. Good when you only need an occasional boost.',
    cta: 'Buy 100 credits',
  },
  credits_250: {
    title: '250 credit pack',
    badge: 'Flexible pack',
    family: 'Credit pack',
    description: 'A larger one-time top-up for busier periods without committing monthly.',
    cta: 'Buy 250 credits',
  },
};

function getPlanDetails(plan) {
  return PLAN_DETAILS[plan.id] || {
    title: `${plan.credits} credit plan`,
    badge: plan.mode === 'subscription' ? 'Subscription' : 'Credit pack',
    family: plan.mode === 'subscription' ? 'Subscription' : 'Credit pack',
    description: `${plan.credits} AI game credits ${plan.mode === 'subscription' ? 'included each billing cycle.' : 'added after payment.'}`,
    cta: 'Choose plan',
  };
}

export default function AccountPage() {
  const { accessToken, authError, isConfigured, refreshUsage, signIn, signOut: doSignOut, usage, user } = useAuth();
  const [plans, setPlans] = useState([]);
  const [error, setError] = useState('');
  const [isLoadingPlan, setIsLoadingPlan] = useState('');
  const freeRemainingToday = usage?.freeRemainingToday ?? 0;
  const paidCredits = usage?.credits ?? 0;
  const needsCredits = Boolean(user && usage && freeRemainingToday <= 0 && paidCredits <= 0);

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
            <Eyebrow>Account & AI credits</Eyebrow>
            <Subtitle style={{ marginTop: 12 }}>
              AI question generation is metered. You get 3 free AI games per day, then paid credits
              keep generation predictable.
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
            <SectionTitle>Sign in to track credits</SectionTitle>
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
                  {needsCredits ? 'Add credits to keep generating AI games.' : `Welcome back, ${getDisplayName(user)}.`}
                </SectionTitle>
                <Subtitle style={{ marginTop: 8 }}>
                  {needsCredits
                    ? 'Your free AI games are used for today and you have no paid credits. Subscribe or buy a pack before hosting the next AI-generated game.'
                    : 'Your free daily games are used first. Paid credits are only spent after the free allowance runs out.'}
                </Subtitle>
              </div>

              <Grid gap="12px" $mobileColumns="1fr" style={{ marginTop: 18 }}>
                <StatChip>{user.email}</StatChip>
                <StatChip>{freeRemainingToday} free AI games left today</StatChip>
                <StatChip>{paidCredits} paid credits</StatChip>
                <StatChip>Tier: {usage?.tier || 'free'}</StatChip>
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
                    <Stack gap="12px">
                      <Cluster justify="space-between" align="flex-start">
                        <Eyebrow>{details.badge}</Eyebrow>
                        <StatChip>{details.family}</StatChip>
                      </Cluster>
                      <SectionTitle style={{ fontSize: '1.2rem' }}>
                        {details.title}
                      </SectionTitle>
                      <Subtitle>{details.description}</Subtitle>
                      <HelperText>
                        {plan.credits} AI game credits {plan.mode === 'subscription' ? 'included each billing cycle.' : 'added after payment.'}
                      </HelperText>
                      <Button
                        type="button"
                        compact
                        disabled={!plan.configured || isLoadingPlan === plan.id}
                        onClick={() => handleCheckout(plan.id)}
                        whileTap={{ scale: 0.98 }}
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
