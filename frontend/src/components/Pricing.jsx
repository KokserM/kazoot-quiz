import React from 'react';
import styled from 'styled-components';
import { Badge, Button, Card, Eyebrow, Muted, Stack } from './ui';

export function formatMoney(amountCents, currency = 'EUR') {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency,
    minimumFractionDigits: amountCents % 100 === 0 ? 0 : 2,
  }).format(amountCents / 100);
}

export function describePlan(plan) {
  if (plan.mode === 'subscription') {
    return {
      price: `${formatMoney(plan.amountCents, plan.currency)} / month`,
      headline: `${plan.credits} AI games every month`,
      terms: [
        'Renews monthly until you cancel',
        'Unused games carry over for one extra month',
        'Cancel any time in “Manage billing”',
      ],
    };
  }
  return {
    price: formatMoney(plan.amountCents, plan.currency),
    headline: `${plan.credits} AI games`,
    terms: ['One-time payment, no subscription', `Use them within ${plan.validityMonths || 12} months`],
  };
}

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
  gap: 14px;
`;

const Price = styled.p`
  font-family: var(--font-display);
  font-size: 2rem;
  font-weight: 700;
  line-height: 1;
`;

const Terms = styled.ul`
  margin: 0;
  padding-left: 1.1em;
  color: var(--ink-2);
  font-size: 0.95rem;
  li + li {
    margin-top: 4px;
  }
`;

export function FreePlanCard({ freeAiGamesPerMonth = 3, maxPlayers = 150 }) {
  return (
    <Card>
      <Stack $gap={12}>
        <Eyebrow>Free</Eyebrow>
        <Price>€0</Price>
        <Muted>
          <strong>{freeAiGamesPerMonth} AI games a month</strong> with a Google account
        </Muted>
        <Terms>
          <li>Demo quizzes any time, no account</li>
          <li>Players never pay or sign up</li>
          <li>Up to {maxPlayers} players per game</li>
        </Terms>
      </Stack>
    </Card>
  );
}

export function PlanCard({ plan, action }) {
  const details = describePlan(plan);
  return (
    <Card>
      <Stack $gap={12} style={{ height: '100%' }}>
        <Stack $gap={6} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Eyebrow>{plan.name}</Eyebrow>
          {plan.mode === 'subscription' ? <Badge>Monthly</Badge> : <Badge>One-time</Badge>}
        </Stack>
        <Price>{details.price}</Price>
        <Muted>
          <strong>{details.headline}</strong> · {formatMoney(plan.pricePerAiGameCents, plan.currency)} each
        </Muted>
        <Terms>
          {details.terms.map((term) => (
            <li key={term}>{term}</li>
          ))}
        </Terms>
        {action ? <div style={{ marginTop: 'auto' }}>{action}</div> : null}
      </Stack>
    </Card>
  );
}

export function PlanGrid({ plans, config, renderAction, includeFree = true }) {
  const packs = plans.filter((plan) => plan.mode !== 'subscription');
  const subscriptions = plans.filter((plan) => plan.mode === 'subscription');
  return (
    <Stack $gap={16}>
      <Grid>
        {includeFree ? <FreePlanCard freeAiGamesPerMonth={config?.freeAiGamesPerMonth} maxPlayers={config?.maxPlayersPerRoom} /> : null}
        {packs.map((plan) => (
          <PlanCard key={plan.id} plan={plan} action={renderAction?.(plan)} />
        ))}
      </Grid>
      {subscriptions.length ? (
        <>
          <Muted>For regular hosts:</Muted>
          <Grid>
            {subscriptions.map((plan) => (
              <PlanCard key={plan.id} plan={plan} action={renderAction?.(plan)} />
            ))}
          </Grid>
        </>
      ) : null}
    </Stack>
  );
}

export function PricingExplainer() {
  return (
    <Muted $small>
      One AI game = one 10-question quiz on a topic you choose. Playing, joining and demo quizzes are always free. If creating a quiz fails, the AI game
      is given back. Prices include any VAT that applies. Payments are handled by Stripe.
    </Muted>
  );
}

export function PlanButton({ plan, busy, onBuy, disabled }) {
  return (
    <Button block variant={plan.mode === 'subscription' ? 'secondary' : 'primary'} busy={busy} disabled={disabled || busy || !plan.configured} onClick={() => onBuy(plan)}>
      {!plan.configured ? 'Not available yet' : plan.mode === 'subscription' ? `Subscribe to ${plan.name}` : `Buy ${plan.name}`}
    </Button>
  );
}
