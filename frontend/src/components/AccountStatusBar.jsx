import React from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { useAuth } from '../auth/AuthProvider';
import { Button, Pill } from './ui';

const Bar = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: ${({ $dense = false }) => ($dense ? '10px' : '18px')};
  padding: ${({ $dense = false }) => ($dense ? '10px 12px' : '12px 14px')};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.lg};
  background: rgba(9, 15, 30, 0.72);
  box-shadow: ${({ theme }) => theme.shadows.card};
  backdrop-filter: blur(18px);

  @media (max-width: 768px) {
    align-items: stretch;
    flex-direction: column;
    border-radius: ${({ theme }) => theme.radii.md};
  }
`;

const BrandLink = styled(Link)`
  color: ${({ theme }) => theme.colors.text};
  font-size: 1rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  text-decoration: none;
`;

const AccountCluster = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;

  @media (max-width: 768px) {
    justify-content: flex-start;
  }
`;

const UserPill = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: 10px;
  max-width: 280px;
  padding: 7px 12px 7px 7px;
  border: 1px solid ${({ theme }) => theme.colors.borderStrong};
  border-radius: ${({ theme }) => theme.radii.pill};
  background: rgba(148, 163, 184, 0.09);
  color: ${({ theme }) => theme.colors.textMuted};
  text-decoration: none;
`;

const Avatar = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  overflow: hidden;
  border-radius: 50%;
  background: ${({ theme }) => theme.gradients.primary};
  color: white;
  font-size: 0.78rem;
  font-weight: 800;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.08);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

const UserText = styled.span`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const BenefitText = styled.span`
  color: ${({ theme }) => theme.colors.textSoft};
  font-size: 0.9rem;

  @media (max-width: 768px) {
    display: none;
  }
`;

export function getDisplayName(user) {
  return user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || 'Account';
}

export function getInitials(user) {
  const displayName = getDisplayName(user);
  const parts = displayName.split(/[\s@.]+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'K';
}

export function getUsageSummaryLabel(usage) {
  if (!usage) {
    return 'Loading credits...';
  }

  return `${usage.freeRemainingToday ?? 0} free today · ${usage.credits ?? 0} credits`;
}

export function AccountStatusBar({ dense = false }) {
  const { isConfigured, signIn, signOut, usage, user } = useAuth();
  const avatarUrl = user?.user_metadata?.avatar_url;

  return (
    <Bar $dense={dense}>
      <BrandLink to="/">Kazoot</BrandLink>

      <AccountCluster>
        {user ? (
          <>
            <Pill $tone={(usage?.freeRemainingToday ?? 0) > 0 || (usage?.credits ?? 0) > 0 ? 'success' : 'warning'}>
              {getUsageSummaryLabel(usage)}
            </Pill>
            <UserPill to="/account" aria-label="Open account and billing">
              <Avatar aria-hidden="true">
                {avatarUrl ? <img src={avatarUrl} alt="" /> : getInitials(user)}
              </Avatar>
              <UserText>{getDisplayName(user)}</UserText>
            </UserPill>
            <Button as={Link} to="/account" variant="secondary" compact>
              Upgrade
            </Button>
            <Button type="button" variant="ghost" compact onClick={signOut}>
              Sign out
            </Button>
          </>
        ) : (
          <>
            <BenefitText>3 free AI games per day for hosts</BenefitText>
            <Button type="button" variant="secondary" compact disabled={!isConfigured} onClick={signIn}>
              Sign in for AI games
            </Button>
          </>
        )}
      </AccountCluster>
    </Bar>
  );
}
