import React from 'react';
import { SUPPORT_EMAIL } from '../lib/support';
import { PolicyLayout } from './PolicyLayout';

export default function RefundPolicyPage() {
  return (
    <PolicyLayout
      title="Refund Policy"
      summary={`Kazoot should feel fair. If something goes wrong with billing or credit use, contact ${SUPPORT_EMAIL} and we will review it in good faith.`}
      sections={[
        {
          title: 'Failed AI generation',
          body: 'If an AI game is not successfully created, you should not be charged a credit. If a credit is incorrectly deducted, we will restore it.',
        },
        {
          title: 'Duplicate or accidental purchases',
          body: 'We refund duplicate charges or obvious accidental purchases when the credits have not been used.',
        },
        {
          title: 'Subscriptions',
          body: 'You can cancel future renewals. Refund requests for a recent subscription charge can be reviewed if the monthly credits have not been substantially used.',
        },
        {
          title: 'Credit packs',
          body: 'One-time packs can be refunded when requested soon after purchase and the purchased credits have not been used. Used credits are generally not refundable.',
        },
        {
          title: 'Abuse exception',
          body: 'Refunds can be denied for fraud, abuse, chargeback abuse, or violations of the Terms of Service.',
        },
        {
          title: 'How to request',
          body: `Email ${SUPPORT_EMAIL} with the account email, payment date, plan or pack, and what happened. We aim to reply within 2 business days.`,
        },
      ]}
    />
  );
}
