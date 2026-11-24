import React from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { LEGAL, hasSellerIdentity } from '../lib/legal';

// Who operates Kazoot / takes the payment, from the build-time LEGAL values.
// Reads only the seller name and registry code: never the address or VAT number.
// Renders nothing without a seller identity, so parents must not add separators
// around it (use gap on a flex/grid parent).
const Line = styled.p`
  font-size: var(--type-caption);
  line-height: 1.4;
  color: var(--ink-3);

  .name {
    color: var(--ink-2);
    font-weight: 700;
    white-space: nowrap;
  }
  .reg {
    color: var(--ink-2);
    white-space: nowrap;
  }
  a {
    color: var(--ink-2);
    font-weight: 700;
  }
  a:hover { color: var(--ink); }
  &[data-with-link] a {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
  }
`;

// label: "Sold by" (purchase contexts) or "Operated by" (footer).
// withLink: adds " · Company details" linking to /contact (footer).
// as: element override when the line sits inside a <p> or a list (e.g. as="span" / "li").
export function SellerLine({ label, withLink = false, as, className }) {
  if (!hasSellerIdentity) return null;
  return (
    <Line as={as} className={className} data-with-link={withLink ? '' : undefined}>
      <span className="label">{label}</span> <span className="name">{LEGAL.sellerName}</span>
      {LEGAL.registryCode ? <span className="reg">, reg. code {LEGAL.registryCode}</span> : null}
      {withLink ? (
        <>
          {' · '}
          <Link to="/contact">Company details</Link>
        </>
      ) : null}
    </Line>
  );
}
