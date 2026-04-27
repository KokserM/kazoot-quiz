import React from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from '../lib/support';
import { Card, Cluster, HelperText, Stack } from './ui';

const FooterCard = styled(Card)`
  margin-top: 22px;
  padding: 18px;
  background: rgba(9, 15, 30, 0.58);
`;

const FooterTitle = styled.div`
  color: ${({ theme }) => theme.colors.text};
  font-size: 0.95rem;
  font-weight: 800;
`;

const FooterLink = styled(Link)`
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: 0.9rem;
  font-weight: 700;
  text-decoration: none;

  &:hover {
    color: ${({ theme }) => theme.colors.text};
    text-decoration: underline;
  }
`;

const ContactLink = styled.a`
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: 0.9rem;
  font-weight: 700;
  text-decoration: none;

  &:hover {
    color: ${({ theme }) => theme.colors.text};
    text-decoration: underline;
  }
`;

export function TrustFooter() {
  return (
    <FooterCard initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <Stack gap="10px">
        <Cluster justify="space-between" align="flex-start">
          <div>
            <FooterTitle>Questions before buying?</FooterTitle>
            <HelperText style={{ marginTop: 6 }}>
              Payments are handled by Stripe, and your card details never touch Kazoot. For billing,
              credits, or failed quiz generation, contact {SUPPORT_EMAIL}.
            </HelperText>
          </div>
          <Cluster gap="10px" justify="flex-end">
            <ContactLink href={SUPPORT_MAILTO}>Contact</ContactLink>
            <FooterLink to="/privacy">Privacy</FooterLink>
            <FooterLink to="/terms">Terms</FooterLink>
            <FooterLink to="/refunds">Refunds</FooterLink>
          </Cluster>
        </Cluster>
        <HelperText>AI game credits are only used after a quiz is successfully created.</HelperText>
      </Stack>
    </FooterCard>
  );
}
