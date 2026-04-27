import React from 'react';
import { SUPPORT_EMAIL } from '../lib/support';
import { PolicyLayout } from './PolicyLayout';

export default function PrivacyPage() {
  return (
    <PolicyLayout
      title="Privacy Policy"
      summary="Kazoot collects only the information needed to run your account, create and host games, process payments, prevent abuse, and improve reliability. We do not sell your personal information."
      sections={[
        {
          title: 'What we collect',
          body: `We may collect your account email and profile details from Google sign-in, quiz and game activity needed to operate rooms and credits, payment status from Stripe, basic technical logs, and support messages you send to ${SUPPORT_EMAIL}.`,
        },
        {
          title: 'Payments',
          body: 'Card details are processed by Stripe. Kazoot receives payment status, plan, invoice, and customer identifiers from Stripe, but not full card numbers.',
        },
        {
          title: 'AI-generated content',
          body: 'Quiz topics and generated questions may be processed by our AI provider to create the game. Do not enter sensitive personal information as a quiz topic.',
        },
        {
          title: 'How we use data',
          body: 'We use data to operate games, manage credits and subscriptions, provide support, prevent fraud and abuse, and maintain service reliability.',
        },
        {
          title: 'Local preferences',
          body: 'Kazoot may store local preferences, such as game timer, reveal timing, and language, in your browser so setup is faster next time. For signed-in users, these local preferences are stored under an account-specific browser key. These preferences stay on your device and are not used for advertising.',
        },
        {
          title: 'Sharing',
          body: 'We share data only with service providers needed to run Kazoot, such as hosting, authentication, database, Stripe payments, and AI generation providers.',
        },
        {
          title: 'Contact',
          body: `For privacy questions or account data requests, contact ${SUPPORT_EMAIL}.`,
        },
      ]}
    />
  );
}
