import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import styled from 'styled-components';
import { useAuth } from '../auth/AuthProvider';
import { PlanButton, PlanGrid, PricingExplainer, describePlan } from '../components/Pricing';
import { Badge, Button, Card, Container, Divider, ErrorNotice, Eyebrow, LinkButton, Muted, Notice, PageMain, PageTitle, Row, SectionTitle, Spinner, Stack } from '../components/ui';
import { track } from '../lib/analytics';
import { createCheckoutSession, createPortalSession, deleteAccount } from '../lib/api';
import { useCatalog, useConfig } from '../lib/useConfig';

export function formatDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value));
}

export function describeSubscription(subscription) {
  if (!subscription) return null;
  const name = subscription.planId === 'pro_monthly' ? 'Pro' : subscription.planId === 'plus_monthly' ? 'Plus' : 'Subscription';
  const date = formatDate(subscription.currentPeriodEnd);
  switch (subscription.status) {
    case 'active':
    case 'trialing':
      return subscription.cancelAtPeriodEnd
        ? { name, tone: 'warning', text: `Cancelled — ends on ${date}. You won’t be charged again.` }
        : { name, tone: 'success', text: `Active — renews on ${date}.` };
    case 'past_due':
    case 'unpaid':
      return { name, tone: 'danger', text: 'Your last payment failed. Update your card in “Manage billing” to keep your monthly AI games.' };
    case 'canceled':
      return { name, tone: null, text: 'Cancelled.' };
    default:
      return { name, tone: null, text: `Status: ${subscription.status}.` };
  }
}

const GrantTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.95rem;
  th,
  td {
    text-align: left;
    padding: 8px 6px;
    border-bottom: 1px solid var(--line);
  }
  th {
    color: var(--ink-3);
    font-weight: 700;
  }
  td:last-child,
  th:last-child {
    text-align: right;
  }
`;

const GRANT_LABELS = { pack: 'Pack', subscription: 'Subscription', manual: 'Added by support' };

// A plan chosen on a public pricing card (/account?buy=<id>). Kept in sessionStorage
// because the Google sign-in round trip returns to /account without the query string.
const BUY_INTENT_KEY = 'kazoot:buy-intent';

function readBuyIntent() {
  try {
    return sessionStorage.getItem(BUY_INTENT_KEY);
  } catch {
    return null;
  }
}

function writeBuyIntent(planId) {
  try {
    if (planId) sessionStorage.setItem(BUY_INTENT_KEY, planId);
    else sessionStorage.removeItem(BUY_INTENT_KEY);
  } catch {
    // Storage unavailable: the plan is still on the URL for this visit.
  }
}

const ACTIVE_SUBSCRIPTION_STATES = ['active', 'trialing', 'past_due', 'unpaid', 'incomplete'];

function ConsentDialog({ plan, onCancel, onConfirm, busy }) {
  const [agreed, setAgreed] = useState(false);
  const dialogRef = useRef(null);
  useEffect(() => {
    dialogRef.current?.showModal?.();
  }, []);
  return (
    <dialog
      ref={dialogRef}
      onCancel={onCancel}
      aria-labelledby="consent-title"
      style={{ border: '1px solid var(--line)', borderRadius: 22, padding: 0, maxWidth: 520, width: 'calc(100% - 32px)', background: 'var(--surface)', color: 'var(--ink)' }}
    >
      <Stack $gap={14} style={{ padding: 24 }}>
        <h2 id="consent-title" style={{ fontSize: '1.4rem' }}>
          Before you pay
        </h2>
        <Muted>
          {plan.mode === 'subscription'
            ? `${plan.name}: ${plan.credits} AI games every month. Renews monthly until you cancel in “Manage billing”.`
            : `${plan.name}: ${plan.credits} AI games, usable for ${plan.validityMonths || 12} months. One-time payment.`}
        </Muted>
        <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
          <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} style={{ marginTop: 5, width: 20, height: 20 }} />
          <span>
            I want my AI games added to my account straight away, and I understand that once they are added I lose my 14-day right to withdraw from
            this purchase. (<Link to="/refunds">Refunds &amp; cancellation</Link>)
          </span>
        </label>
        <Row>
          <Button onClick={onConfirm} disabled={!agreed || busy} busy={busy}>
            Continue to secure payment
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </Row>
      </Stack>
    </dialog>
  );
}

export default function AccountPage() {
  const { user, isAuthLoading, isConfigured, signIn, signOut, usage, refreshUsage, accessToken, authError } = useAuth();
  const { config } = useConfig();
  const { plans } = useCatalog();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [pendingPlan, setPendingPlan] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [deleteStep, setDeleteStep] = useState(0);
  const checkoutState = params.get('checkout');
  const buyParam = params.get('buy');
  const [intendedPlanId] = useState(() => buyParam || readBuyIntent());
  const intendedPlan = plans?.find((plan) => plan.id === intendedPlanId && plan.configured) || null;

  useEffect(() => {
    if (buyParam) writeBuyIntent(buyParam);
  }, [buyParam]);

  // Signed in with a plan chosen on the pricing page: open the same consent step as the
  // buttons below. Checkout itself still only starts from that dialog.
  const handledIntent = useRef(false);
  useEffect(() => {
    if (handledIntent.current || !user || !plans || !usage || !intendedPlanId) return;
    handledIntent.current = true;
    writeBuyIntent(null);
    if (buyParam) {
      const next = new URLSearchParams(params);
      next.delete('buy');
      setParams(next, { replace: true });
    }
    if (!intendedPlan) return;
    if (intendedPlan.mode === 'subscription' && ACTIVE_SUBSCRIPTION_STATES.includes(usage.subscription?.status)) {
      setError('You already have a subscription. You can change or cancel it in “Manage billing”.');
      return;
    }
    setPendingPlan(intendedPlan);
  }, [user, plans, usage, intendedPlanId, intendedPlan, buyParam, params, setParams]);

  // After Stripe redirects back, credits arrive via webhook: poll briefly.
  useEffect(() => {
    if (checkoutState !== 'success' || !accessToken) return undefined;
    let attempts = 0;
    const id = setInterval(() => {
      attempts += 1;
      refreshUsage().catch(() => {});
      if (attempts >= 6) clearInterval(id);
    }, 5000);
    return () => clearInterval(id);
  }, [checkoutState, accessToken, refreshUsage]);

  const buy = async () => {
    const plan = pendingPlan;
    setBusy(plan.id);
    setError('');
    try {
      track('checkout_started', { plan: plan.id });
      const { url } = await createCheckoutSession(plan.id, accessToken);
      window.location.assign(url);
    } catch (requestError) {
      setError(requestError.message);
      setBusy('');
      setPendingPlan(null);
    }
  };

  const openPortal = async () => {
    setBusy('portal');
    setError('');
    try {
      const { url } = await createPortalSession(accessToken);
      window.location.assign(url);
    } catch (requestError) {
      setError(requestError.message);
      setBusy('');
    }
  };

  const removeAccount = async () => {
    setBusy('delete');
    setError('');
    try {
      await deleteAccount(accessToken);
      await signOut();
      navigate('/', { replace: true });
    } catch (requestError) {
      setError(requestError.message);
      setBusy('');
    }
  };

  if (isAuthLoading) {
    return (
      <PageMain>
        <Container $narrow>
          <p role="status">
            <Spinner aria-hidden="true" /> Loading your account…
          </p>
        </Container>
      </PageMain>
    );
  }

  if (!user) {
    return (
      <PageMain>
        <Container $narrow>
          <Stack $gap={16}>
            <PageTitle>{intendedPlan ? `Sign in to buy ${intendedPlan.name}` : 'Your account'}</PageTitle>
            <Muted>
              {intendedPlan
                ? `${describePlan(intendedPlan).price} for ${describePlan(intendedPlan).headline}. Sign in with Google, then confirm the details and pay securely with Stripe.`
                : 'Sign in to see your AI games and purchases. Players never need an account.'}
            </Muted>
            <ErrorNotice error={authError} />
            <Row>
              <Button onClick={signIn} disabled={!isConfigured}>
                Continue with Google
              </Button>
              <LinkButton to="/pricing" variant="secondary">
                See pricing
              </LinkButton>
            </Row>
          </Stack>
        </Container>
      </PageMain>
    );
  }

  const subscription = describeSubscription(usage?.subscription);
  const hasActiveSubscription = ACTIVE_SUBSCRIPTION_STATES.includes(usage?.subscription?.status);

  return (
    <PageMain>
      <Container>
        <Stack $gap={24}>
          <Row $justify="space-between">
            <Stack $gap={4}>
              <PageTitle>Your account</PageTitle>
              <Muted>Signed in as {user.email}</Muted>
            </Stack>
            <Row>
              <LinkButton to="/create">Create a quiz</LinkButton>
              <Button variant="ghost" onClick={signOut}>
                Sign out
              </Button>
            </Row>
          </Row>

          {checkoutState === 'success' ? (
            <Notice $tone="success">
              <span>Payment received. Your AI games appear here as soon as Stripe confirms it — usually within a minute.</span>
              <Button size="sm" variant="secondary" onClick={() => setParams({})}>
                Dismiss
              </Button>
            </Notice>
          ) : null}
          {checkoutState === 'cancelled' ? <Notice $tone="info">Checkout cancelled. You haven’t been charged.</Notice> : null}
          <ErrorNotice error={error} />

          <Card>
            <Stack $gap={16}>
              <Eyebrow>AI games left</Eyebrow>
              {!usage ? (
                <p role="status">
                  <Spinner aria-hidden="true" /> Loading…
                </p>
              ) : (
                <>
                  <Row $gap={28} $align="flex-end">
                    <div>
                      <p style={{ fontFamily: 'var(--font-display)', fontSize: '2.6rem', fontWeight: 700, lineHeight: 1 }}>{usage.aiGamesLeft}</p>
                      <Muted $small>in total</Muted>
                    </div>
                    <Muted>
                      {usage.freeRemainingThisMonth} of {usage.freeLimitMonthly} free this month (resets {formatDate(usage.freeResetsAt)})
                      <br />
                      {usage.credits} purchased
                    </Muted>
                  </Row>
                  {usage.grants.length ? (
                    <GrantTable>
                      <caption className="visually-hidden">Purchased AI games, spent in this order</caption>
                      <thead>
                        <tr>
                          <th scope="col">From</th>
                          <th scope="col">Added</th>
                          <th scope="col">Use by</th>
                          <th scope="col">Left</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usage.grants.map((grant) => (
                          <tr key={grant.id}>
                            <td>{GRANT_LABELS[grant.type] || grant.type}</td>
                            <td>{formatDate(grant.createdAt)}</td>
                            <td>{grant.expiresAt ? formatDate(grant.expiresAt) : 'No expiry'}</td>
                            <td>
                              {grant.remainingCredits} of {grant.originalCredits}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </GrantTable>
                  ) : null}
                  <Muted $small>Free games are used first, then purchased games that expire soonest.</Muted>
                </>
              )}
            </Stack>
          </Card>

          <Card>
            <Stack $gap={12}>
              <Eyebrow>Billing</Eyebrow>
              {subscription ? (
                <Row>
                  <Badge $tone={subscription.tone || undefined}>{subscription.name}</Badge>
                  <span>{subscription.text}</span>
                </Row>
              ) : (
                <Muted>No subscription. You only pay when you buy a pack.</Muted>
              )}
              <Row>
                <Button variant="secondary" onClick={openPortal} busy={busy === 'portal'} disabled={Boolean(busy)}>
                  Manage billing and invoices
                </Button>
              </Row>
              <Muted $small>Opens Stripe’s secure billing page, where you can cancel, update your card and download invoices.</Muted>
            </Stack>
          </Card>

          <Stack $gap={14} id="plans">
            <SectionTitle>Get more AI games</SectionTitle>
            <PricingExplainer />
            {plans ? (
              <PlanGrid
                plans={plans.filter((plan) => !(hasActiveSubscription && plan.mode === 'subscription'))}
                config={config}
                includeFree={false}
                renderAction={(plan) => <PlanButton plan={plan} busy={busy === plan.id} disabled={Boolean(busy)} onBuy={setPendingPlan} />}
              />
            ) : (
              <p role="status">
                <Spinner aria-hidden="true" /> Loading plans…
              </p>
            )}
            {config?.billingTestMode ? <Notice $tone="warning">Test mode: no real payments are taken.</Notice> : null}
          </Stack>

          {usage?.recentGenerations?.length ? (
            <Card>
              <Stack $gap={10}>
                <Eyebrow>Recent quizzes</Eyebrow>
                <GrantTable>
                  <thead>
                    <tr>
                      <th scope="col">Topic</th>
                      <th scope="col">Date</th>
                      <th scope="col">Charged</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usage.recentGenerations.map((generation) => (
                      <tr key={generation.id}>
                        <td>{generation.topic}</td>
                        <td>{formatDate(generation.created_at)}</td>
                        <td>
                          {['failed', 'refunded'].includes(generation.status)
                            ? 'Failed — not charged'
                            : generation.status === 'reserved'
                              ? 'In progress'
                              : generation.charge_mode === 'paid_credit'
                                ? '1 purchased game'
                                : '1 free game'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </GrantTable>
              </Stack>
            </Card>
          ) : null}

          <Divider />
          <Stack $gap={10}>
            <SectionTitle as="h2" style={{ fontSize: '1.2rem' }}>
              Delete account
            </SectionTitle>
            <Muted $small>
              Deletes your account and any unused AI games. Payment records are kept as required for accounting. Cancel any subscription first.
            </Muted>
            {deleteStep === 0 ? (
              <div>
                <Button variant="danger" size="sm" onClick={() => setDeleteStep(1)}>
                  Delete my account
                </Button>
              </div>
            ) : (
              <Row>
                <Button variant="danger" size="sm" onClick={removeAccount} busy={busy === 'delete'} disabled={Boolean(busy)}>
                  Yes, delete permanently
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setDeleteStep(0)}>
                  Keep my account
                </Button>
              </Row>
            )}
          </Stack>
        </Stack>
      </Container>
      {pendingPlan ? <ConsentDialog plan={pendingPlan} busy={busy === pendingPlan.id} onCancel={() => setPendingPlan(null)} onConfirm={buy} /> : null}
    </PageMain>
  );
}
