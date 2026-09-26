import React from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { PlanGrid, PricingExplainer } from '../components/Pricing';
import { Container, Eyebrow, LinkButton, Muted, Notice, PageMain, PageTitle, Row, Stack } from '../components/ui';
import { BRAND } from '../lib/brand';
import { LEGAL, hasSellerIdentity } from '../lib/legal';
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from '../lib/support';
import { useCatalog, useConfig } from '../lib/useConfig';

// Drafts written from how the service actually works (see LAUNCH.md).
// They have not been reviewed by a lawyer; the owner must complete seller
// details and have them checked before relying on them.

const Prose = styled.article`
  max-width: 44em;
  h2 {
    font-size: 1.35rem;
    margin: 32px 0 10px;
  }
  h3 {
    font-size: 1.1rem;
    margin: 20px 0 6px;
  }
  p,
  li {
    color: var(--ink-2);
  }
  p + p {
    margin-top: 10px;
  }
  ul {
    padding-left: 1.2em;
  }
  li + li {
    margin-top: 6px;
  }
  table {
    border-collapse: collapse;
    width: 100%;
    font-size: 0.95rem;
  }
  th,
  td {
    text-align: left;
    padding: 8px;
    border-bottom: 1px solid var(--line);
    vertical-align: top;
  }
`;

function Seller() {
  if (!hasSellerIdentity) {
    return (
      <Notice $tone="warning">
        Seller details (name, registry code and address) are being finalised. Until then, contact us at {SUPPORT_EMAIL}.
      </Notice>
    );
  }
  return (
    <p>
      {LEGAL.sellerName}
      {LEGAL.registryCode ? `, registry code ${LEGAL.registryCode}` : ''}
      {LEGAL.vatNumber ? `, VAT number ${LEGAL.vatNumber}` : ''}, {LEGAL.address}. Email: <a href={SUPPORT_MAILTO}>{SUPPORT_EMAIL}</a>.
    </p>
  );
}

function LegalShell({ title, children }) {
  return (
    <PageMain>
      <Container>
        <Stack $gap={12}>
          <Eyebrow>Last updated {LEGAL.lastUpdated}</Eyebrow>
          <PageTitle>{title}</PageTitle>
          <Prose>{children}</Prose>
        </Stack>
      </Container>
    </PageMain>
  );
}

export function PrivacyPage() {
  return (
    <LegalShell title="Privacy">
      <p>This explains what {BRAND.name} collects, why, who else handles it, and your rights. The short version: players give a nickname only; hosts who create quizzes sign in with Google; we don’t sell data, show ads, or use tracking cookies.</p>

      <h2>Who is responsible</h2>
      <Seller />

      <h2>What we collect and why</h2>
      <table>
        <thead>
          <tr>
            <th scope="col">Data</th>
            <th scope="col">Why</th>
            <th scope="col">Legal basis</th>
            <th scope="col">Kept for</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Player nickname, answers and scores</td>
            <td>To run the game</td>
            <td>Contract / legitimate interest</td>
            <td>In server memory only; deleted when the room closes (usually within an hour)</td>
          </tr>
          <tr>
            <td>Google account email, name and profile picture (hosts who sign in)</td>
            <td>Your account, AI game balance and purchases</td>
            <td>Contract</td>
            <td>Until you delete your account</td>
          </tr>
          <tr>
            <td>Quiz topics you enter, with date, language, token usage and an IP address</td>
            <td>Charging AI games correctly, preventing abuse, cost limits</td>
            <td>Contract / legitimate interest</td>
            <td>12 months; the link to your account is removed if you delete it</td>
          </tr>
          <tr>
            <td>Purchase records (plan, amount, Stripe IDs)</td>
            <td>Delivering what you bought, refunds, accounting</td>
            <td>Contract / legal obligation</td>
            <td>7 years (Estonian Accounting Act)</td>
          </tr>
          <tr>
            <td>Technical logs (errors, timings; no quiz content or emails)</td>
            <td>Keeping the service working</td>
            <td>Legitimate interest</td>
            <td>Up to 30 days in our hosting provider’s logs</td>
          </tr>
          <tr>
            <td>Anonymous usage counts (e.g. “demo started”)</td>
            <td>Understanding which features are used</td>
            <td>Legitimate interest</td>
            <td>Contain no identifiers</td>
          </tr>
        </tbody>
      </table>

      <h2>Your browser</h2>
      <p>
        We store a few items in your browser’s local storage: your seat in a game (so you can reconnect), your preferred quiz settings, and your sign-in
        session. We don’t use advertising or tracking cookies, so there is no cookie banner.
      </p>

      <h2>Who processes data for us</h2>
      <ul>
        <li>
          <strong>Railway</strong> — hosting of the app and game server.
        </li>
        <li>
          <strong>Supabase</strong> — database and sign-in.
        </li>
        <li>
          <strong>Google</strong> — sign-in with your Google account.
        </li>
        <li>
          <strong>OpenAI</strong> — writes questions from the quiz topic you enter. Only the topic, language and difficulty are sent; never your name or
          email.
        </li>
        <li>
          <strong>Stripe</strong> — payments. Card details go directly to Stripe; we never see them.
        </li>
      </ul>
      <p>
        Some of these providers process data outside the EU/EEA, including in the United States. Such transfers rely on the EU–US Data Privacy
        Framework or standard contractual clauses offered by each provider.
      </p>

      <h2>Children</h2>
      <p>
        Players only enter a nickname and don’t need an account. Please don’t use real full names for children. Accounts for creating quizzes are for
        adults (18+). Teachers are responsible for how they use {BRAND.name} with their class.
      </p>

      <h2>Please don’t enter personal information as a topic</h2>
      <p>Quiz topics are sent to our AI provider. Don’t use names of private people or other personal details as a topic.</p>

      <h2>Your rights</h2>
      <p>
        You can access, correct, export or delete your data, object to processing, and complain to the Estonian Data Protection Inspectorate
        (Andmekaitse Inspektsioon, aki.ee). Delete your account yourself on the <Link to="/account">account page</Link>, or email{' '}
        <a href={SUPPORT_MAILTO}>{SUPPORT_EMAIL}</a> for anything else. We reply within one month.
      </p>
    </LegalShell>
  );
}

export function TermsPage() {
  return (
    <LegalShell title="Terms of service">
      <h2>1. Who we are</h2>
      <Seller />

      <h2>2. The service</h2>
      <p>
        {BRAND.name} lets a host run a live multiple-choice quiz that players join from their own devices. Hosts who sign in can have quizzes written by
        AI on a topic they choose. The free demo uses fixed, hand-written quizzes.
      </p>

      <h2>3. Accounts</h2>
      <p>You must be 18 or older to create an account. Keep your Google account secure; you are responsible for use of your {BRAND.name} account.</p>

      <h2>4. AI-written questions</h2>
      <p>
        Questions are generated automatically and checked by software, not by a person. They can contain mistakes. Don’t rely on them for decisions,
        grading with consequences, or anything where accuracy is essential — use review mode to check them first. We may decline topics that are not
        suitable for a general audience.
      </p>

      <h2>5. AI games, packs and subscriptions</h2>
      <ul>
        <li>One AI game is one quiz created on a topic you choose. Playing and joining games is free.</li>
        <li>Signed-in hosts get a number of free AI games each calendar month (shown on the pricing page). Unused free games don’t carry over.</li>
        <li>Packs are one-time purchases. Their AI games can be used for 12 months from purchase.</li>
        <li>
          Subscriptions renew every month until cancelled and add their AI games after each successful payment. Unused subscription games can be used
          until the end of the following billing month.
        </li>
        <li>Free games are used first, then purchased games that expire soonest.</li>
        <li>If creating a quiz fails, the AI game is returned automatically.</li>
        <li>Prices are shown before you pay and include any VAT that applies. Payments are processed by Stripe.</li>
      </ul>

      <h2>6. Cancellation and withdrawal</h2>
      <p>
        See <Link to="/refunds">Refunds &amp; cancellation</Link>. You can cancel a subscription at any time; it ends at the end of the month you’ve paid
        for.
      </p>

      <h2>7. Acceptable use</h2>
      <p>
        Don’t use {BRAND.name} to create hateful, sexual, harassing or illegal content, to harass players, to interfere with the service, or to resell
        it. Don’t use offensive player names. We may close rooms or suspend accounts that break these rules; unused paid AI games are refunded
        proportionally unless the account was used for fraud.
      </p>

      <h2>8. Availability</h2>
      <p>
        We work to keep {BRAND.name} running but can’t guarantee it is uninterrupted. Live games are held in memory; a server restart (for example an
        update) ends games in progress. If a problem on our side prevents a game you paid an AI game for, contact us and we’ll return it.
      </p>

      <h2>9. Liability</h2>
      <p>
        Nothing in these terms limits rights you have as a consumer under law. Otherwise, our liability is limited to the amount you paid us in the 12
        months before the claim.
      </p>

      <h2>10. Changes and law</h2>
      <p>
        We’ll tell account holders by email at least 30 days before changes that affect paid plans. These terms are governed by Estonian law; as a
        consumer you can also rely on the laws and courts of your country of residence. The EU Online Dispute Resolution platform is no longer
        available; contact us first and we’ll try to resolve any problem.
      </p>
    </LegalShell>
  );
}

export function RefundsPage() {
  return (
    <LegalShell title="Refunds and cancellation">
      <h2>Cancelling a subscription</h2>
      <p>
        Cancel any time on your <Link to="/account">account page</Link> under “Manage billing”. You keep the AI games you already have, and you won’t be
        charged again.
      </p>

      <h2>Your 14-day right of withdrawal</h2>
      <p>
        EU consumers normally have 14 days to withdraw from an online purchase. For AI games, which are digital content supplied immediately, you ask
        us before paying to add them straight away and confirm that you then lose this right once they are added (EU Consumer Rights Directive,
        Article 16(m)). This confirmation is also shown on your receipt.
      </p>
      <p>
        We still refund on request, within 14 days of purchase, any pack or subscription payment whose AI games you haven’t used. Email{' '}
        <a href={SUPPORT_MAILTO}>{SUPPORT_EMAIL}</a> with your account email and the purchase date.
      </p>

      <h2>When things go wrong</h2>
      <ul>
        <li>If creating a quiz fails, the AI game is returned automatically — check your account page.</li>
        <li>If you were charged twice, or a game was lost because of a problem on our side, we refund or return the AI games.</li>
        <li>After a refund, the unused AI games from that purchase are removed from your account.</li>
      </ul>
      <p>We aim to answer within 2 business days.</p>
    </LegalShell>
  );
}

export function ContactPage() {
  return (
    <LegalShell title="Contact">
      <p>
        Email <a href={SUPPORT_MAILTO}>{SUPPORT_EMAIL}</a> for help with games, billing, refunds, privacy requests, or to report a question that’s
        wrong. We aim to reply within 2 business days.
      </p>
      <h2>Company details</h2>
      <Seller />
    </LegalShell>
  );
}

export function PricingPage() {
  const { config } = useConfig();
  const { plans } = useCatalog();
  return (
    <PageMain>
      <Container>
        <Stack $gap={22}>
          <Stack $gap={10}>
            <PageTitle>Pricing</PageTitle>
            <Muted>Start free. Players never pay. Buy AI games only if you host often.</Muted>
          </Stack>
          {plans ? <PlanGrid plans={plans} config={config} /> : <Muted role="status">Loading prices…</Muted>}
          <PricingExplainer />
          <Row>
            <LinkButton to="/demo">Try a free demo</LinkButton>
            <LinkButton to="/account#plans" variant="secondary">
              Buy AI games
            </LinkButton>
          </Row>
        </Stack>
      </Container>
    </PageMain>
  );
}
