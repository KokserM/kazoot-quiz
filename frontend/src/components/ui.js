import styled, { css } from 'styled-components';
import { motion } from 'framer-motion';

export const PageShell = styled.div`
  min-height: 100vh;
  padding: ${({ $dense = false }) => ($dense ? '14px 14px 20px' : '32px 20px 56px')};

  @media (max-width: 768px) {
    padding: ${({ $dense = false }) => ($dense ? '8px 8px 14px' : '16px 12px 28px')};
  }
`;

export const CenteredContent = styled.div`
  width: min(1160px, 100%);
  margin: 0 auto;
`;

export const GlassPanel = styled(motion.section)`
  position: relative;
  overflow: hidden;
  background: ${({ theme }) => theme.gradients.card};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.lg};
  box-shadow: ${({ theme }) => theme.shadows.glow};
  backdrop-filter: blur(18px);

  &::before {
    content: '';
    position: absolute;
    inset: 0 0 auto 0;
    height: 160px;
    background: ${({ theme }) => theme.gradients.accent};
    opacity: 0.45;
    pointer-events: none;
  }
`;

export const HeroCard = styled(GlassPanel)`
  padding: 40px;
  background:
    radial-gradient(circle at top right, rgba(56, 189, 248, 0.16), transparent 28%),
    ${({ theme }) => theme.gradients.cardHighlight};

  @media (max-width: 768px) {
    padding: 24px;
  }
`;

export const HeaderRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;

  @media (max-width: 768px) {
    flex-direction: column;
    margin-bottom: 18px;
  }
`;

export const Eyebrow = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 15px;
  border-radius: ${({ theme }) => theme.radii.pill};
  border: 1px solid rgba(139, 92, 246, 0.32);
  background: rgba(124, 58, 237, 0.14);
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: 0.84rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
`;

export const Title = styled.h1`
  margin: 0 0 12px;
  font-size: clamp(2.3rem, 5vw, 4.6rem);
  letter-spacing: -0.04em;
  line-height: 0.95;
`;

export const SectionTitle = styled.h2`
  margin: 0;
  font-size: clamp(1.6rem, 3vw, 2.2rem);
  letter-spacing: -0.03em;
`;

export const Subtitle = styled.p`
  margin: 0;
  max-width: 720px;
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: 1.06rem;
  line-height: 1.65;

  @media (max-width: 768px) {
    font-size: 0.98rem;
    line-height: 1.55;
  }
`;

export const Grid = styled.div`
  display: grid;
  gap: ${({ gap = '16px' }) => gap};
  grid-template-columns: ${({ columns = 'repeat(auto-fit, minmax(220px, 1fr))' }) => columns};

  @media (max-width: 768px) {
    grid-template-columns: ${({ $mobileColumns = '1fr' }) => $mobileColumns};
  }
`;

const buttonVariants = {
  primary: css`
    background: ${({ theme }) => theme.gradients.primary};
    color: white;
    border: none;
    box-shadow: 0 14px 28px rgba(79, 70, 229, 0.28);
  `,
  secondary: css`
    background: rgba(148, 163, 184, 0.08);
    color: ${({ theme }) => theme.colors.text};
    border: 1px solid ${({ theme }) => theme.colors.border};
  `,
  ghost: css`
    background: transparent;
    color: ${({ theme }) => theme.colors.textMuted};
    border: 1px dashed ${({ theme }) => theme.colors.border};
  `,
  danger: css`
    background: rgba(239, 68, 68, 0.14);
    color: #fecaca;
    border: 1px solid rgba(239, 68, 68, 0.35);
  `,
};

export const ButtonRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;

  @media (max-width: 768px) {
    width: 100%;
  }
`;

export const Button = styled(motion.button)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: fit-content;
  max-width: 100%;
  padding: ${({ compact = false }) => (compact ? '12px 16px' : '14px 20px')};
  border-radius: ${({ theme }) => theme.radii.pill};
  position: relative;
  overflow: hidden;
  font-weight: 700;
  line-height: 1.2;
  text-align: center;
  text-decoration: none;
  cursor: pointer;
  box-shadow: ${({ theme, variant = 'primary' }) =>
    variant === 'primary' ? theme.shadows.button : 'none'};
  transition: transform 0.16s ease, opacity 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease,
    filter 0.2s ease;
  ${({ variant = 'primary' }) => buttonVariants[variant] || buttonVariants.primary};

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    filter: brightness(1.03);
  }

  @media (max-width: 768px) {
    width: 100%;
  }

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
    transform: none;
  }
`;

export const Card = styled(motion.article)`
  position: relative;
  padding: 22px;
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => theme.colors.surfaceMuted};
  border: 1px solid ${({ theme }) => theme.colors.border};
  box-shadow: ${({ theme }) => theme.shadows.card};
  backdrop-filter: blur(14px);
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;

  &:hover {
    border-color: ${({ theme }) => theme.colors.borderStrong};
    box-shadow: ${({ theme }) => theme.shadows.raised};
  }

  @media (max-width: 768px) {
    padding: 16px;
  }
`;

export const Label = styled.label`
  display: block;
  margin-bottom: 8px;
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: 0.95rem;
  font-weight: 600;
`;

export const Input = styled.input`
  width: 100%;
  padding: 14px 16px;
  border-radius: ${({ theme }) => theme.radii.sm};
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: rgba(11, 18, 35, 0.96);
  color: ${({ theme }) => theme.colors.text};
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);

  &:focus {
    outline: none;
    border-color: rgba(139, 92, 246, 0.8);
    box-shadow: 0 0 0 4px rgba(139, 92, 246, 0.18);
  }
`;

export const Select = styled.select`
  width: 100%;
  padding: 14px 16px;
  border-radius: ${({ theme }) => theme.radii.sm};
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: rgba(11, 18, 35, 0.96);
  color: ${({ theme }) => theme.colors.text};
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);

  &:focus {
    outline: none;
    border-color: rgba(139, 92, 246, 0.8);
    box-shadow: 0 0 0 4px rgba(139, 92, 246, 0.18);
  }
`;

export const HelperText = styled.p`
  margin: 8px 0 0;
  color: ${({ theme }) => theme.colors.textSoft};
  font-size: 0.92rem;
  line-height: 1.5;
`;

export const StatChip = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: ${({ theme }) => theme.radii.pill};
  background: rgba(56, 189, 248, 0.12);
  border: 1px solid rgba(56, 189, 248, 0.24);
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: 0.94rem;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
`;

export const Pill = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: ${({ theme }) => theme.radii.pill};
  background: ${({ $tone, theme }) => {
    if ($tone === 'danger') return 'rgba(239, 68, 68, 0.12)';
    if ($tone === 'success') return 'rgba(34, 197, 94, 0.14)';
    if ($tone === 'warning') return 'rgba(245, 158, 11, 0.14)';
    return 'rgba(148, 163, 184, 0.12)';
  }};
  border: 1px solid ${({ $tone }) => {
    if ($tone === 'danger') return 'rgba(239, 68, 68, 0.3)';
    if ($tone === 'success') return 'rgba(34, 197, 94, 0.28)';
    if ($tone === 'warning') return 'rgba(245, 158, 11, 0.28)';
    return 'rgba(148, 163, 184, 0.18)';
  }};
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: 0.9rem;
`;

export const Banner = styled(motion.div)`
  padding: 14px 16px;
  border-radius: ${({ theme }) => theme.radii.sm};
  margin-bottom: 16px;
  border: 1px solid
    ${({ $tone }) => {
      if ($tone === 'danger') return 'rgba(239, 68, 68, 0.36)';
      if ($tone === 'success') return 'rgba(34, 197, 94, 0.3)';
      return 'rgba(56, 189, 248, 0.26)';
    }};
  background: ${({ $tone }) => {
    if ($tone === 'danger') return 'rgba(127, 29, 29, 0.3)';
    if ($tone === 'success') return 'rgba(20, 83, 45, 0.28)';
    return 'rgba(14, 116, 144, 0.22)';
  }};
  color: ${({ theme }) => theme.colors.text};
  backdrop-filter: blur(12px);
`;

export const EmptyState = styled(Card)`
  text-align: center;
  padding: 32px;
`;
