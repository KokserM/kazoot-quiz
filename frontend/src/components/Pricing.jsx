import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import styled, { css } from 'styled-components';
import { usePointerTilt } from '../lib/motion';
import { Icon } from './Icon';
import { Button, LinkButton, Muted } from './ui';

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

// Terms every plan in a group shares are shown once, above the group; anything
// plan-specific stays on the card.
function splitTerms(plans) {
  const lists = plans.map((plan) => describePlan(plan).terms);
  const shared = lists[0]?.filter((term) => lists.every((list) => list.includes(term))) || [];
  return { shared, own: lists.map((list) => list.filter((term) => !shared.includes(term))) };
}

// ------------------------------------------------------------------ layout

const Offers = styled.div`
  display: grid;
  gap: clamp(28px, 4vw, 40px);
`;

// Side by side on wide screens. The groups share row tracks (subgrid), so both rows of
// cards start at the same height however long each group's terms are.
const Groups = styled.div`
  display: grid;
  gap: 14px 24px;
  grid-template-columns: ${({ $split }) => ($split ? 'minmax(0, 3fr) minmax(0, 2fr)' : 'minmax(0, 1fr)')};
  grid-template-rows: auto auto;
  @media (max-width: 1100px) {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: none;
    row-gap: clamp(28px, 4vw, 40px);
  }
`;

const Group = styled.section`
  display: grid;
  grid-row: span 2;
  grid-template-rows: subgrid;
  gap: 14px;
  min-width: 0;
  @media (max-width: 1100px) {
    grid-row: auto;
    grid-template-rows: auto 1fr;
  }
`;

const GroupHead = styled.header`
  display: grid;
  align-content: start;
  gap: 4px;
  h3 {
    font-size: 1.3rem;
  }
  p {
    color: var(--ink-2);
    font-size: 0.95rem;
  }
`;

const Cards = styled.div`
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(${({ $count }) => $count}, minmax(0, 1fr));
  @media (max-width: 1100px) {
    grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  }
`;

// ------------------------------------------------------------------- cards

// Lift, a shallow pointer tilt (fine pointers only) and a stronger border/shadow.
// Keyboard focus inside the card gets the same raised state without the tilt.
const CardBox = styled.article`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
  padding: 22px 20px 20px;
  border-radius: var(--radius-lg);
  background: var(--surface);
  border: 1px solid var(--line);
  box-shadow: var(--shadow);
  transform: perspective(900px) translateY(var(--lift, 0px)) rotateX(var(--tilt-x, 0deg)) rotateY(var(--tilt-y, 0deg));
  transition: transform 320ms var(--ease-out), box-shadow 220ms ease, border-color 220ms ease;

  &[data-tilt='on'] {
    transition: transform 80ms linear, box-shadow 220ms ease, border-color 220ms ease;
  }

  ${({ $recurring }) =>
    $recurring &&
    css`
      /* Recurring plans carry a brand edge so "monthly" reads before the small print. */
      &::before {
        content: '';
        position: absolute;
        inset: -1px -1px auto;
        height: 4px;
        border-radius: var(--radius-lg) var(--radius-lg) 0 0;
        background: var(--brand-gradient);
      }
    `}

  @media (hover: hover) {
    &:hover {
      --lift: -4px;
      border-color: color-mix(in srgb, var(--accent) 50%, var(--line));
      box-shadow: var(--shadow-raised);
    }
    &:hover .plan-cta:not(:disabled):not([aria-disabled='true']) {
      background: var(--accent) var(--brand-gradient);
      color: var(--accent-ink);
      border-color: transparent;
    }
  }
  &:focus-within {
    --lift: -4px;
    border-color: var(--accent);
    box-shadow: var(--shadow-raised);
  }
  @media (prefers-reduced-motion: reduce) {
    &:hover,
    &:focus-within {
      --lift: 0px;
    }
  }

  /* Phones: compact rows (name and games left, price right, button below). */
  @media (max-width: 560px) {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 6px 16px;
    padding: 18px;
    .plan-head { grid-area: 1 / 1; }
    .plan-price { grid-area: 1 / 2 / span 2 / 3; justify-self: end; flex-direction: column; align-items: flex-end; gap: 2px; }
    .plan-amount { grid-area: 2 / 1; border-top: 0; padding-top: 0; }
    .plan-terms, .plan-action { grid-column: 1 / -1; }
    .plan-action { padding-top: 8px; }
  }
`;

const CardHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  h4 {
    font-size: 1.1rem;
    letter-spacing: -0.01em;
  }
`;

const Price = styled.p`
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-family: var(--font-display);
  font-size: clamp(2rem, 3.2vw, 2.4rem);
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
  small {
    font-family: var(--font-body);
    font-size: 0.95rem;
    font-weight: 700;
    letter-spacing: 0;
    color: var(--ink-3);
  }
`;

const Amount = styled.div`
  display: grid;
  gap: 2px;
  padding-top: 12px;
  border-top: 1px solid var(--line);
  strong {
    font-size: 1.05rem;
  }
  span {
    color: var(--ink-3);
    font-size: 0.92rem;
  }
`;

const Terms = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 6px;
  color: var(--ink-2);
  font-size: 0.95rem;
  li {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 8px;
    align-items: start;
  }
  svg {
    margin-top: 0.25em;
    color: var(--accent-text);
  }
`;

const CardAction = styled.div`
  margin-top: auto;
  padding-top: 4px;
`;

function TermList({ terms }) {
  if (!terms.length) return null;
  return (
    <Terms className="plan-terms">
      {terms.map((term) => (
        <li key={term}>
          <Icon name="check" size="0.9em" />
          <span>{term}</span>
        </li>
      ))}
    </Terms>
  );
}

export function PlanCard({ plan, action, terms = describePlan(plan).terms }) {
  const ref = useRef(null);
  usePointerTilt(ref, { max: 3, smoothing: 0.25 });
  const recurring = plan.mode === 'subscription';
  return (
    <CardBox ref={ref} $recurring={recurring} aria-labelledby={`plan-${plan.id}`}>
      <CardHead className="plan-head">
        <h4 id={`plan-${plan.id}`}>{plan.name}</h4>
      </CardHead>
      <Price className="plan-price">
        {formatMoney(plan.amountCents, plan.currency)}
        {recurring ? <small>/ month</small> : null}
      </Price>
      <Amount className="plan-amount">
        <strong>{recurring ? `${plan.credits} AI games every month` : `${plan.credits} AI games`}</strong>
        <span>{formatMoney(plan.pricePerAiGameCents, plan.currency)} per game</span>
      </Amount>
      <TermList terms={terms} />
      {action ? <CardAction className="plan-action">{action}</CardAction> : null}
    </CardBox>
  );
}

// ---------------------------------------------------------------- free band

const FreeBand = styled.section`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 16px clamp(20px, 4vw, 40px);
  padding: clamp(18px, 3vw, 24px) clamp(18px, 3vw, 28px);
  border-radius: var(--radius-lg);
  background: var(--surface-sunk);
  border: 1px solid var(--line);
  @media (max-width: 760px) {
    grid-template-columns: minmax(0, 1fr);
  }

  .free-price {
    display: grid;
    gap: 2px;
  }
  .free-price h3 {
    font-size: 1.1rem;
    letter-spacing: -0.01em;
  }
  .free-actions {
    display: grid;
    gap: 8px;
    justify-items: center;
    font-size: 0.92rem;
    @media (max-width: 760px) {
      justify-items: start;
    }
  }
`;

const FreeTerms = styled(Terms)`
  grid-template-columns: repeat(2, minmax(0, 1fr));
  @media (max-width: 560px) {
    grid-template-columns: minmax(0, 1fr);
  }
  gap: 6px 20px;
  strong {
    color: var(--ink);
  }
`;

export function FreePlanCard({ freeAiGamesPerMonth = 3, maxPlayers = 150 }) {
  return (
    <FreeBand aria-labelledby="plan-free">
      <div className="free-price">
        <h3 id="plan-free">Free</h3>
        <Price>€0</Price>
      </div>
      <FreeTerms>
        <li>
          <Icon name="check" size="0.9em" />
          <span>
            <strong>{freeAiGamesPerMonth} AI games a month</strong> with a Google account
          </span>
        </li>
        <li>
          <Icon name="check" size="0.9em" />
          <span>Demo quizzes any time, no account</span>
        </li>
        <li>
          <Icon name="check" size="0.9em" />
          <span>Players never pay or sign up</span>
        </li>
        <li>
          <Icon name="check" size="0.9em" />
          <span>Up to {maxPlayers} players per game</span>
        </li>
      </FreeTerms>
      <div className="free-actions">
        <LinkButton to="/create" variant="tonal">
          Start free
        </LinkButton>
        <Link to="/demo">or try the demo, no account</Link>
      </div>
    </FreeBand>
  );
}

// ----------------------------------------------------------------- actions

function planLabel(plan) {
  return plan.mode === 'subscription' ? `Subscribe to ${plan.name}` : `Buy ${plan.name}`;
}

// On the account page: opens the consent step, then Stripe Checkout.
export function PlanButton({ plan, busy, onBuy, disabled }) {
  return (
    <Button className="plan-cta" block variant="tonal" busy={busy} disabled={disabled || busy || !plan.configured} onClick={() => onBuy(plan)}>
      {!plan.configured ? 'Not available yet' : planLabel(plan)}
    </Button>
  );
}

// On public pages: goes to the account page, which handles sign-in, the consent step
// and checkout. Nothing is bought without those steps.
export function PlanLink({ plan }) {
  if (!plan.configured) {
    return (
      <Button className="plan-cta" block variant="tonal" disabled>
        Not available yet
      </Button>
    );
  }
  return (
    <LinkButton className="plan-cta" block variant="tonal" to={`/account?buy=${encodeURIComponent(plan.id)}`}>
      {planLabel(plan)}
    </LinkButton>
  );
}

function PlanGroup({ title, lead, plans, renderAction }) {
  const { shared, own } = splitTerms(plans);
  return (
    <Group aria-label={title}>
      <GroupHead>
        <h3>{title}</h3>
        <p>{[lead, ...shared].filter(Boolean).join(' · ')}</p>
      </GroupHead>
      <Cards $count={plans.length}>
        {plans.map((plan, index) => (
          <PlanCard key={plan.id} plan={plan} terms={own[index]} action={renderAction(plan)} />
        ))}
      </Cards>
    </Group>
  );
}

export function PlanGrid({ plans, config, renderAction = (plan) => <PlanLink plan={plan} />, includeFree = true }) {
  const packs = plans.filter((plan) => plan.mode !== 'subscription');
  const subscriptions = plans.filter((plan) => plan.mode === 'subscription');
  return (
    <Offers>
      {includeFree ? <FreePlanCard freeAiGamesPerMonth={config?.freeAiGamesPerMonth} maxPlayers={config?.maxPlayersPerRoom} /> : null}
      {packs.length || subscriptions.length ? (
        <Groups $split={packs.length > 0 && subscriptions.length > 0 && packs.length + subscriptions.length <= 5}>
          {packs.length ? <PlanGroup title="Game packs" lead="Pay once" plans={packs} renderAction={renderAction} /> : null}
          {subscriptions.length ? (
            <PlanGroup title="Monthly plans" lead="For regular hosts" plans={subscriptions} renderAction={renderAction} />
          ) : null}
        </Groups>
      ) : null}
    </Offers>
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
