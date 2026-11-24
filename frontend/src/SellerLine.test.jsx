import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';

// LEGAL comes from build-time env; the mock lets each test choose the values.
const legal = vi.hoisted(() => ({
  LEGAL: { sellerName: '', registryCode: '', vatNumber: '', address: '', email: 'support@kazoot.app' },
}));
vi.mock('./lib/legal', () => ({
  get LEGAL() {
    return legal.LEGAL;
  },
  get hasSellerIdentity() {
    return Boolean(legal.LEGAL.sellerName);
  },
}));

const { SellerLine } = await import('./components/SellerLine');

afterEach(cleanup);

function renderLine(props) {
  return render(
    <MemoryRouter>
      <SellerLine {...props} />
    </MemoryRouter>
  );
}

test('seller line renders the name and registry code from LEGAL, never the address or VAT number', () => {
  legal.LEGAL = { ...legal.LEGAL, sellerName: 'Example Seller OÜ', registryCode: '12345678', vatNumber: 'EE999999999', address: 'Example street 1, Tallinn' };
  const { container } = renderLine({ label: 'Sold by' });
  expect(container).toHaveTextContent('Sold by Example Seller OÜ, reg. code 12345678');
  expect(container.textContent).not.toContain('Example street');
  expect(container.textContent).not.toContain('EE999999999');
  expect(screen.queryByRole('link')).toBeNull();
});

test('footer variant links to the company details', () => {
  legal.LEGAL = { ...legal.LEGAL, sellerName: 'Example Seller OÜ', registryCode: '', address: 'Example street 1, Tallinn' };
  const { container } = renderLine({ label: 'Operated by', withLink: true });
  expect(container).toHaveTextContent('Operated by Example Seller OÜ · Company details');
  expect(container.textContent).not.toContain('reg. code');
  expect(container.textContent).not.toContain('Example street');
  expect(screen.getByRole('link', { name: 'Company details' })).toHaveAttribute('href', '/contact');
});

test('seller line renders nothing without a seller name', () => {
  legal.LEGAL = { ...legal.LEGAL, sellerName: '', registryCode: '12345678', address: 'Example street 1, Tallinn' };
  const { container } = renderLine({ label: 'Sold by', withLink: true });
  expect(container).toBeEmptyDOMElement();
});
