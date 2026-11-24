import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';

// Placeholder seller values chosen by each test (the real ones come from build-time env).
const legal = vi.hoisted(() => ({
  LEGAL: { sellerName: 'Example Seller OÜ', registryCode: '12345678', vatNumber: 'EE000', address: 'Somewhere 1', email: 'support@kazoot.app' },
}));
vi.mock('./lib/legal', () => ({
  get LEGAL() {
    return legal.LEGAL;
  },
  get hasSellerIdentity() {
    return Boolean(legal.LEGAL.sellerName);
  },
}));

const { PlanGrid, PricingExplainer, PREFERRED_PLAN, PAYMENT_MARKS } = await import('./components/Pricing');

const plan = (id, name, mode, credits, amountCents) => ({
  id,
  name,
  mode,
  credits,
  amountCents,
  currency: 'EUR',
  validityMonths: mode === 'payment' ? 12 : null,
  pricePerAiGameCents: Math.round(amountCents / credits),
  configured: true,
});
const PLANS = [
  plan('credits_20', 'Pack 20', 'payment', 20, 500),
  plan('credits_60', 'Pack 60', 'payment', 60, 1200),
  plan('credits_150', 'Pack 150', 'payment', 150, 2500),
  plan('plus_monthly', 'Plus', 'subscription', 30, 500),
  plan('pro_monthly', 'Pro', 'subscription', 90, 1200),
];

afterEach(cleanup);

function renderGrid(props = {}) {
  return render(
    <MemoryRouter>
      <PlanGrid plans={PLANS} config={{ freeAiGamesPerMonth: 3, maxPlayersPerRoom: 150 }} {...props} />
    </MemoryRouter>
  );
}

const cardOf = (name) => screen.getByRole('heading', { name }).closest('article');

test('one switch shows game packs or monthly plans, never both', () => {
  renderGrid();
  const packs = screen.getByRole('radio', { name: /Game packs/ });
  expect(packs).toBeChecked();
  expect(screen.getByRole('group', { name: 'Pricing' })).toBeInTheDocument();
  expect(screen.getAllByRole('link', { name: /^Buy / })).toHaveLength(3);
  expect(screen.queryByRole('link', { name: /^Subscribe/ })).toBeNull();
  // The group's shared terms sit under the switch once, not on every card.
  expect(screen.getByText('One-time payment, no subscription · Use them within 12 months')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('radio', { name: /Monthly plans/ }));
  expect(screen.getAllByRole('link', { name: /^Subscribe to/ })).toHaveLength(2);
  expect(screen.queryByRole('link', { name: /^Buy / })).toBeNull();
});

test('one preferred card per group, by border and a primary button only, no label', () => {
  expect(PREFERRED_PLAN).toEqual({ payment: 'credits_60', subscription: 'plus_monthly' });
  renderGrid();
  expect(cardOf('Pack 60')).toHaveAttribute('data-preferred');
  expect(cardOf('Pack 20')).not.toHaveAttribute('data-preferred');
  expect(document.querySelectorAll('[data-preferred]')).toHaveLength(1);
  expect(document.body.textContent.toLowerCase()).not.toMatch(/popular|best value/);
  fireEvent.click(screen.getByRole('radio', { name: /Monthly plans/ }));
  expect(cardOf('Plus')).toHaveAttribute('data-preferred');
});

test('every card shows its per-game price', () => {
  renderGrid();
  expect(within(cardOf('Pack 60')).getByText('€0.20 per game')).toBeInTheDocument();
  expect(within(cardOf('Pack 150')).getByText('€0.17 per game')).toBeInTheDocument();
});

test('a ?buy deep link to a subscription starts on monthly plans', () => {
  renderGrid({ initialPlanId: 'pro_monthly', includeFree: false });
  expect(screen.getByRole('radio', { name: /Monthly plans/ })).toBeChecked();
  expect(screen.getByRole('link', { name: 'Subscribe to Pro' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Free' })).toBeNull();
});

test('with one group there is no switch, only its heading', () => {
  render(
    <MemoryRouter>
      <PlanGrid plans={PLANS.filter((item) => item.mode === 'payment')} includeFree={false} />
    </MemoryRouter>
  );
  expect(screen.queryByRole('radio')).toBeNull();
  expect(screen.getByRole('heading', { name: 'Game packs' })).toBeInTheDocument();
});

test('the pay line under the cards names Stripe, VAT and the seller, never the address', () => {
  expect(PAYMENT_MARKS).toEqual([]);
  const { container } = renderGrid();
  const payLine = container.querySelector('.pay-line');
  expect(payLine).toHaveTextContent('Payments are handled by Stripe.');
  expect(payLine).toHaveTextContent('Prices include any VAT that applies.');
  expect(payLine).toHaveTextContent('Sold by Example Seller OÜ, reg. code 12345678');
  expect(payLine.textContent).not.toContain('Somewhere 1');
  expect(payLine.textContent).not.toContain('EE000');
});

test('without a seller identity the pay line has no seller row', () => {
  const saved = legal.LEGAL;
  legal.LEGAL = { ...saved, sellerName: '', registryCode: '' };
  const { container } = renderGrid();
  const payLine = container.querySelector('.pay-line');
  expect(payLine).not.toHaveTextContent('Sold by');
  expect(payLine.children).toHaveLength(2);
  legal.LEGAL = saved;
});

test('the explainer keeps what an AI game is; payment sentences moved to the pay line', () => {
  render(<PricingExplainer />);
  const text = document.body.textContent;
  expect(text).toContain('One AI game = one 10-question quiz on a topic you choose.');
  expect(text).not.toContain('Stripe');
});
