import React, { useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import styled, { css } from 'styled-components';
import { usePointerTilt } from '../lib/motion';
import { Icon } from './Icon';
import { SellerLine } from './SellerLine';
import { Button, LinkButton, Muted, SegmentedControl, textStyle } from './ui';

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

// One preferred card per group: visual emphasis only (gradient border, raised shadow,
// primary button), never a "popular" label. Pack 60 is the middle pack and the first step
// down in per-game price; Plus is the entry subscription. The owner can change these.
export const PREFERRED_PLAN = { payment: 'credits_60', subscription: 'plus_monthly' };

// Card-brand and wallet marks shown after the Stripe sentence in the pay line, as
// { name, icon } (icon: a 24 px-high monochrome SVG element in currentColor).
// Left empty until the owner confirms which methods are enabled in Stripe.
export const PAYMENT_MARKS = [];

// The free plan's ticks, also listed on the signed-out account page.
export const freeAiGamesLabel = (count) => `${count} AI games a month`;
export const FREE_AI_GAMES_SUFFIX = 'with a Google account';
export const FREE_DEMO_TICK = 'Demo quizzes any time, no account';
export const FREE_PLAYERS_TICK = 'Players never pay or sign up';

const GROUPS = {
  payment: { title: 'Game packs', lead: 'Pay once' },
  subscription: { title: 'Monthly plans', lead: 'For regular hosts' },
};

function groupOf(plan) {
  return plan.mode === 'subscription' ? 'subscription' : 'payment';
}

function preferredPlanId(plans, group) {
  if (!plans.length) return null;
  if (plans.some((plan) => plan.id === PREFERRED_PLAN[group])) return PREFERRED_PLAN[group];
  return group === 'subscription' ? plans[0].id : plans[Math.floor((plans.length - 1) / 2)].id;
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
  gap: clamp(22px, 4vw, 36px);
  min-width: 0;
`;

const GroupBlock = styled.section`
  display: grid;
  gap: 14px;
  min-width: 0;
`;

const SwitchWrap = styled.div`
  display: grid;
  gap: 10px;
  justify-items: center;
  text-align: center;
  fieldset { width: min(100%, 440px); }
  .segment { min-height: 56px; }
  .shared {
    color: var(--ink-2);
    font-size: 0.95rem;
    max-width: 44em;
  }
  @media (max-width: 560px) {
    justify-items: stretch;
    text-align: left;
    fieldset { width: 100%; }
  }
`;

const GroupHead = styled.header`
  display: grid;
  gap: 4px;
  h3 { ${textStyle.h3Group} }
  p {
    color: var(--ink-2);
    font-size: 0.95rem;
  }
`;

const Cards = styled.div`
  display: grid;
  grid-template-columns: repeat(var(--count, 3), minmax(0, 340px));
  justify-content: center;
  gap: 14px;
  @media (max-width: 560px) {
    grid-template-columns: minmax(0, 1fr);
    gap: 10px;
  }
`;

// ------------------------------------------------------------------- cards

// Lift, a shallow pointer tilt (fine pointers only) and a stronger border/shadow.
// Keyboard focus inside the card gets the same raised state without the tilt.
const CardBox = styled.article`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  padding: 22px clamp(14px, 2vw, 20px) 20px;
  border-radius: var(--radius-lg);
  background: var(--surface);
  border: 1px solid var(--line);
  box-shadow: var(--shadow);
  transform: perspective(900px) translateY(var(--lift, 0px)) rotateX(var(--tilt-x, 0deg)) rotateY(var(--tilt-y, 0deg));
  transition: transform 320ms var(--ease-out), box-shadow 220ms ease, border-color 220ms ease;
  /* Plan buttons may wrap in narrow cards (three cards at tablet widths). */
  .plan-action > * {
    white-space: normal;
    text-align: center;
  }

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

  ${({ $preferred }) =>
    $preferred
      ? css`
          border: 1.5px solid transparent;
          background: linear-gradient(var(--surface), var(--surface)) padding-box, var(--brand-gradient) border-box;
          box-shadow: var(--shadow-raised);
        `
      : css`
          @media (hover: hover) {
            &:hover { border-color: color-mix(in srgb, var(--accent) 50%, var(--line)); }
          }
          &:focus-within { border-color: var(--accent); }
        `}

  @media (hover: hover) {
    &:hover {
      --lift: -4px;
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
    box-shadow: var(--shadow-raised);
  }
  @media (prefers-reduced-motion: reduce) {
    &:hover,
    &:focus-within {
      --lift: 0px;
    }
  }

  /* Phones: compact rows. Name and price on top; games, per-game price and the button below. */
  @media (max-width: 560px) {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 6px 16px;
    padding: 14px 16px;
    .plan-name { grid-area: 1 / 1; }
    .plan-price { grid-area: 1 / 2; justify-self: end; font-size: 1.75rem; }
    .plan-amount { grid-area: 2 / 1; flex-direction: row; flex-wrap: wrap; align-items: center; gap: 6px 8px; }
    .plan-amount strong { font-size: 0.95rem; }
    .plan-action { grid-area: 2 / 2; margin-top: 0; }
    .plan-action > * {
      width: auto;
      min-height: 44px;
      padding: 0 14px;
      font-size: 0.92rem;
      border-radius: 10px;
      white-space: nowrap;
    }
    .plan-terms { grid-column: 1 / -1; font-size: 0.88rem; }
  }
`;

const Name = styled.h4`
  ${textStyle.h4}
`;

const Price = styled.p`
  display: flex;
  align-items: baseline;
  gap: 6px;
  ${textStyle.price}
  small {
    font-family: var(--font-body);
    font-size: 0.95rem;
    font-weight: 700;
    letter-spacing: 0;
    color: var(--ink-3);
  }
`;

const Amount = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  min-width: 0;
  strong {
    font-size: 1.05rem;
    color: var(--ink);
  }
`;

// The per-game price, promoted: in --ink (not grey), display numerals.
const PerGame = styled.span`
  display: inline-flex;
  align-self: flex-start;
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  background: var(--surface-sunk);
  color: var(--ink);
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 0.95rem;
  line-height: 1.3;
  font-variant-numeric: tabular-nums;
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

export function PlanCard({ plan, action, terms = describePlan(plan).terms, preferred = false }) {
  const ref = useRef(null);
  usePointerTilt(ref, { max: 3, smoothing: 0.25 });
  const recurring = plan.mode === 'subscription';
  return (
    <CardBox ref={ref} $recurring={recurring} $preferred={preferred} data-preferred={preferred ? '' : undefined} aria-labelledby={`plan-${plan.id}`}>
      <Name id={`plan-${plan.id}`} className="plan-name">
        {plan.name}
      </Name>
      <Price className="plan-price">
        {formatMoney(plan.amountCents, plan.currency)}
        {recurring ? <small>/ month</small> : null}
      </Price>
      <Amount className="plan-amount">
        <strong>{recurring ? `${plan.credits} AI games every month` : `${plan.credits} AI games`}</strong>
        <PerGame>{formatMoney(plan.pricePerAiGameCents, plan.currency)} per game</PerGame>
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
  gap: 18px 32px;
  padding: 22px 26px;
  border-radius: 20px;
  background: linear-gradient(115deg, rgba(124, 58, 237, 0.28), rgba(192, 38, 211, 0.18));
  border: 1px solid rgba(183, 156, 255, 0.35);
  :root[data-theme='light'] & {
    background: var(--accent-soft);
    border-color: color-mix(in srgb, var(--accent) 35%, transparent);
  }

  .free-price {
    display: grid;
    gap: 2px;
  }
  .free-price h3 { ${textStyle.h4} }
  .free-actions {
    display: grid;
    justify-items: center;
    font-size: 0.92rem;
  }
  .free-demo-link {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
  }

  @media (max-width: 700px) {
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
    padding: 18px;
    .free-price {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 12px;
    }
    .free-actions {
      justify-items: start;
      margin-top: 4px;
    }
    .free-actions > :first-child { width: 100%; }
  }
`;

const FreeTerms = styled(Terms)`
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px 20px;
  @media (max-width: 700px) {
    grid-template-columns: minmax(0, 1fr);
    gap: 4px;
  }
  strong {
    color: var(--ink);
  }
  svg {
    color: var(--brand-a);
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
            <strong>{freeAiGamesLabel(freeAiGamesPerMonth)}</strong> {FREE_AI_GAMES_SUFFIX}
          </span>
        </li>
        <li>
          <Icon name="check" size="0.9em" />
          <span>{FREE_DEMO_TICK}</span>
        </li>
        <li>
          <Icon name="check" size="0.9em" />
          <span>{FREE_PLAYERS_TICK}</span>
        </li>
        <li>
          <Icon name="check" size="0.9em" />
          <span>Up to {maxPlayers} players per game</span>
        </li>
      </FreeTerms>
      <div className="free-actions">
        <LinkButton to="/create" variant="secondary" onStage>
          Start free
        </LinkButton>
        <Link to="/demo" className="free-demo-link">
          or try the demo, no account
        </Link>
      </div>
    </FreeBand>
  );
}

// ----------------------------------------------------------------- pay line

const PayRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 4px 18px;
  ${textStyle.caption}
  color: var(--ink-3);
  text-align: center;
  > p { font-size: inherit; }
  .stripe svg { color: var(--ink-3); margin-right: 6px; }
  .marks { display: inline-flex; gap: 8px; align-items: center; color: var(--ink-3); }
  .marks svg { height: 24px; width: auto; }
  @media (max-width: 560px) {
    flex-direction: column;
    align-items: flex-start;
    text-align: left;
  }
`;

// Who takes the money and how, right under the buy buttons. The seller line renders
// nothing without a seller identity; the gap keeps no empty row or separator behind.
export function PayLine() {
  return (
    <PayRow className="pay-line">
      <p className="stripe">
        <Icon name="lock" />
        Payments are handled by Stripe.
      </p>
      {PAYMENT_MARKS.length ? (
        <span className="marks">
          {PAYMENT_MARKS.map(({ name, icon }) => (
            <span key={name} role="img" aria-label={name}>
              {icon}
            </span>
          ))}
        </span>
      ) : null}
      <p>Prices include any VAT that applies.</p>
      <SellerLine label="Sold by" />
    </PayRow>
  );
}

// ----------------------------------------------------------------- actions

function planLabel(plan) {
  return plan.mode === 'subscription' ? `Subscribe to ${plan.name}` : `Buy ${plan.name}`;
}

// On the account page: opens the consent step, then Stripe Checkout.
export function PlanButton({ plan, busy, onBuy, disabled, preferred = false }) {
  return (
    <Button
      className="plan-cta"
      block
      variant={preferred ? 'primary' : 'tonal'}
      busy={busy}
      disabled={disabled || busy || !plan.configured}
      onClick={() => onBuy(plan)}
    >
      {!plan.configured ? 'Not available yet' : planLabel(plan)}
    </Button>
  );
}

// On public pages: goes to the account page, which handles sign-in, the consent step
// and checkout. Nothing is bought without those steps.
export function PlanLink({ plan, preferred = false }) {
  if (!plan.configured) {
    return (
      <Button className="plan-cta" block variant="tonal" disabled>
        Not available yet
      </Button>
    );
  }
  return (
    <LinkButton className="plan-cta" block variant={preferred ? 'primary' : 'tonal'} to={`/account?buy=${encodeURIComponent(plan.id)}`}>
      {planLabel(plan)}
    </LinkButton>
  );
}

// Free band, then one switch (packs / monthly) when both groups exist, the selected
// group's cards only (the other group is not rendered), and the pay line.
// renderAction(plan, { preferred }) returns the card's button.
// initialPlanId: start on that plan's group (e.g. /account?buy=plus_monthly).
export function PlanGrid({ plans, config, renderAction = (plan, { preferred }) => <PlanLink plan={plan} preferred={preferred} />, includeFree = true, initialPlanId }) {
  const switchName = useId();
  const byGroup = {
    payment: plans.filter((plan) => groupOf(plan) === 'payment'),
    subscription: plans.filter((plan) => groupOf(plan) === 'subscription'),
  };
  const both = byGroup.payment.length > 0 && byGroup.subscription.length > 0;
  const [choice, setChoice] = useState(() => {
    const initial = plans.find((plan) => plan.id === initialPlanId);
    return initial ? groupOf(initial) : 'payment';
  });
  const group = both ? choice : byGroup.payment.length ? 'payment' : 'subscription';
  const visible = byGroup[group];
  const { shared, own } = splitTerms(visible);
  const preferredId = preferredPlanId(visible, group);

  return (
    <Offers>
      {includeFree ? <FreePlanCard freeAiGamesPerMonth={config?.freeAiGamesPerMonth} maxPlayers={config?.maxPlayersPerRoom} /> : null}
      {visible.length ? (
        <GroupBlock aria-label={GROUPS[group].title}>
          {both ? (
            <SwitchWrap>
              <SegmentedControl
                legend="Pricing"
                hideLegend
                name={`pricing-${switchName}`}
                value={group}
                onChange={setChoice}
                options={[
                  { value: 'payment', label: GROUPS.payment.title, hint: GROUPS.payment.lead },
                  { value: 'subscription', label: GROUPS.subscription.title, hint: GROUPS.subscription.lead },
                ]}
              />
              {shared.length ? <p className="shared">{shared.join(' · ')}</p> : null}
            </SwitchWrap>
          ) : (
            <GroupHead>
              <h3>{GROUPS[group].title}</h3>
              <p>{[GROUPS[group].lead, ...shared].join(' · ')}</p>
            </GroupHead>
          )}
          <Cards style={{ '--count': visible.length }}>
            {visible.map((plan, index) => {
              const preferred = plan.id === preferredId;
              return <PlanCard key={plan.id} plan={plan} terms={own[index]} preferred={preferred} action={renderAction(plan, { preferred })} />;
            })}
          </Cards>
          <PayLine />
        </GroupBlock>
      ) : null}
    </Offers>
  );
}

// The pay line carries the Stripe and VAT sentences; this keeps what an AI game is.
export function PricingExplainer() {
  return (
    <Muted $small>
      One AI game = one 10-question quiz on a topic you choose. Playing, joining and demo quizzes are always free. If creating a quiz fails, the AI game
      is given back.
    </Muted>
  );
}
