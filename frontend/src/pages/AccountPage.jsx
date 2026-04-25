import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { createCheckoutSession, fetchBillingCatalog } from '../lib/api';
import { useAuth } from '../auth/AuthProvider';
import {
  Banner,
  Button,
  ButtonRow,
  Card,
  CenteredContent,
  Eyebrow,
  GlassPanel,
  Grid,
  HeaderRow,
  HelperText,
  PageShell,
  SectionTitle,
  StatChip,
  Subtitle,
} from '../components/ui';

function Shell({ children }) {
  return (
    <PageShell>
      <CenteredContent>{children}</CenteredContent>
    </PageShell>
  );
}

export default function AccountPage() {
  const { accessToken, authError, isConfigured, refreshUsage, signIn, signOut: doSignOut, usage, user } = useAuth();
  const [plans, setPlans] = useState([]);
  const [error, setError] = useState('');
  const [isLoadingPlan, setIsLoadingPlan] = useState('');

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
      <GlassPanel initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} style={{ padding: 32 }}>
        <HeaderRow>
          <div>
            <Eyebrow>Account & AI credits</Eyebrow>
            <div style={{ marginTop: 16 }}>
              <SectionTitle>Control GPT-5.4 spend</SectionTitle>
              <Subtitle>
                AI question generation is metered. You get 3 free AI games per day, then paid credits
                keep generation predictable.
              </Subtitle>
            </div>
          </div>
          <Button as={Link} to="/create" variant="ghost" compact>
            Back to create
          </Button>
        </HeaderRow>

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
            <Grid gap="12px" $mobileColumns="1fr">
              <StatChip>{user.email}</StatChip>
              <StatChip>{usage?.freeRemainingToday ?? 0} free AI games left today</StatChip>
              <StatChip>{usage?.credits ?? 0} paid credits</StatChip>
              <StatChip>Tier: {usage?.tier || 'free'}</StatChip>
            </Grid>

            <ButtonRow style={{ marginTop: 18 }}>
              <Button type="button" variant="secondary" compact onClick={refreshUsage} whileTap={{ scale: 0.98 }}>
                Refresh usage
              </Button>
              <Button type="button" variant="ghost" compact onClick={doSignOut} whileTap={{ scale: 0.98 }}>
                Sign out
              </Button>
            </ButtonRow>

            <Grid gap="16px" $mobileColumns="1fr" style={{ marginTop: 24 }}>
              {plans.map((plan) => (
                <Card key={plan.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <SectionTitle style={{ fontSize: '1.2rem' }}>
                    {plan.id === 'plus_monthly'
                      ? 'Plus monthly'
                      : plan.id === 'pro_monthly'
                        ? 'Pro monthly'
                        : `${plan.credits} credit pack`}
                  </SectionTitle>
                  <HelperText>
                    {plan.credits} AI game credits {plan.mode === 'subscription' ? 'included each billing cycle.' : 'added after payment.'}
                  </HelperText>
                  <ButtonRow style={{ marginTop: 14 }}>
                    <Button
                      type="button"
                      compact
                      disabled={!plan.configured || isLoadingPlan === plan.id}
                      onClick={() => handleCheckout(plan.id)}
                      whileTap={{ scale: 0.98 }}
                    >
                      {isLoadingPlan === plan.id ? 'Opening checkout...' : plan.configured ? 'Choose plan' : 'Not configured'}
                    </Button>
                  </ButtonRow>
                </Card>
              ))}
            </Grid>
          </>
        )}
      </GlassPanel>
    </Shell>
  );
}
