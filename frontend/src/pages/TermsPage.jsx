import React from 'react';
import { PolicyLayout } from './PolicyLayout';

export default function TermsPage() {
  return (
    <PolicyLayout
      title="Terms of Service"
      summary="Kazoot is a quiz hosting tool for creating and playing live games. By using Kazoot, you agree to use it responsibly and to follow the credit, subscription, and content rules below."
      sections={[
        {
          title: 'Accounts',
          body: 'You are responsible for keeping your Google account secure and for activity under your account.',
        },
        {
          title: 'Acceptable use',
          body: 'Do not use Kazoot for illegal content, harassment, abuse, attempts to disrupt the service, reverse engineering, payment fraud, or misuse of AI generation.',
        },
        {
          title: 'AI content',
          body: 'Generated questions can contain mistakes. Kazoot is intended for casual quiz hosting, not as an authoritative source for education, professional decisions, legal, medical, financial, or other high-stakes use.',
        },
        {
          title: 'Credits and subscriptions',
          body: 'Free monthly AI games are used first. Subscriptions grant the listed monthly AI games, unused subscription games roll over for one extra month, and one-time packs expire after 12 months.',
        },
        {
          title: 'Availability',
          body: 'Kazoot aims to be reliable, but live multiplayer and AI generation can be affected by third-party services and network conditions.',
        },
        {
          title: 'Changes',
          body: 'Policies and pricing may change, but material changes that affect paid users should be communicated clearly.',
        },
      ]}
    />
  );
}
