import styled, { css, keyframes } from 'styled-components';
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
  isolation: isolate;
  background: ${({ theme }) => theme.gradients.card};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.lg};
  box-shadow: ${({ theme }) => theme.shadows.glow};
  backdrop-filter: blur(18px);
  color: ${({ theme }) => theme.colors.text};

  &::before {
    content: '';
    position: absolute;
    inset: 0 0 auto 0;
    height: var(--panel-decor-height, 0);
    z-index: 0;
    background: linear-gradient(
      135deg,
      rgba(56, 189, 248, 0.28) 0%,
      rgba(124, 58, 237, 0.24) 58%,
      rgba(124, 58, 237, 0.08) 82%,
      transparent 100%
    );
    opacity: 0.52;
    pointer-events: none;
  }

  & > * {
    position: relative;
    z-index: 1;
  }
`;

export const PanelBody = styled.div`
  padding: ${({ $compact = false }) => ($compact ? '28px' : '32px')};
  background: linear-gradient(180deg, rgba(8, 13, 27, 0.88), rgba(8, 13, 27, 0.96));

  @media (max-width: 768px) {
    padding: ${({ $compact = false }) => ($compact ? '18px' : '22px')};
  }
`;

export const PanelTitleHeader = styled.header`
  padding: ${({ $hero = false }) => ($hero ? '42px 40px 36px' : '32px 32px 30px')};
  background:
    radial-gradient(circle at top right, rgba(56, 189, 248, 0.16), transparent 32%),
    linear-gradient(
      135deg,
      rgba(56, 189, 248, 0.22) 0%,
      rgba(124, 58, 237, 0.22) 56%,
      rgba(15, 23, 42, 0.12) 100%
    );
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};

  h1,
  h2 {
    margin: 0;
    max-width: ${({ $hero = false }) => ($hero ? '980px' : '820px')};
    line-height: ${({ $hero = false }) => ($hero ? 0.98 : 1.05)};
  }

  @media (max-width: 768px) {
    padding: ${({ $hero = false }) => ($hero ? '28px 22px 24px' : '24px 22px 22px')};
  }
`;

export const PanelHeader = styled.header`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: 18px;
  margin-bottom: ${({ $compact = false }) => ($compact ? '22px' : '28px')};

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

export const HeaderCopy = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-width: ${({ $narrow = false }) => ($narrow ? '760px' : '880px')};
`;

export const HeaderActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;

  @media (max-width: 768px) {
    justify-content: flex-start;
  }
`;

export const HeroCard = styled(GlassPanel)`
  background:
    radial-gradient(circle at top right, rgba(56, 189, 248, 0.16), transparent 28%),
    ${({ theme }) => theme.gradients.cardHighlight};
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
  width: fit-content;
  max-width: 100%;
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

export const Stack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ gap = '16px' }) => gap};
`;

export const Cluster = styled.div`
  display: flex;
  align-items: ${({ align = 'center' }) => align};
  justify-content: ${({ justify = 'flex-start' }) => justify};
  gap: ${({ gap = '12px' }) => gap};
  flex-wrap: wrap;

  @media (max-width: 768px) {
    align-items: stretch;
    width: 100%;
  }
`;

export const FormGrid = styled(Grid)`
  align-items: start;
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

export const Button = styled(motion.button).withConfig({
  shouldForwardProp: (prop) => !['compact', 'variant'].includes(prop),
})`
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

const spin = keyframes`
  to {
    transform: rotate(360deg);
  }
`;

export const Spinner = styled.span.withConfig({
  shouldForwardProp: (prop) => !['$size'].includes(prop),
})`
  display: inline-flex;
  width: ${({ $size = 18 }) => `${$size}px`};
  height: ${({ $size = 18 }) => `${$size}px`};
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  opacity: 0.86;
  animation: ${spin} 0.72s linear infinite;
  flex: 0 0 auto;
`;

export const AnswerButton = styled(Button)`
  display: flex;
  width: 100%;
  min-width: 0;
  justify-content: flex-start;
  align-items: center;
  gap: 12px;
  min-height: 84px;
  padding: 16px;
  border-radius: ${({ theme }) => theme.radii.md};
  text-align: left;
  white-space: normal;
  word-break: break-word;

  @media (max-width: 768px) {
    min-height: 68px;
  }
`;

export const AnswerLetter = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 30px;
  height: 30px;
  border-radius: ${({ theme }) => theme.radii.pill};
  background: rgba(255, 255, 255, 0.16);
  font-weight: 900;
`;

export const AnswerText = styled.span`
  display: block;
  flex: 1;
  min-width: 0;
  align-self: center;
  line-height: 1.35;
  overflow-wrap: anywhere;
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

export const ChoiceCard = styled(Card).withConfig({
  shouldForwardProp: (prop) => !['$featured'].includes(prop),
})`
  min-height: 100%;
  background: ${({ $featured, theme }) => ($featured ? theme.gradients.success : theme.colors.surfaceMuted)};
  border-color: ${({ $featured }) => ($featured ? 'rgba(34, 197, 94, 0.28)' : 'rgba(148, 163, 184, 0.16)')};

  ${Stack} {
    height: 100%;
  }

  ${Button} {
    margin-top: auto;
  }

  @media (max-width: 768px) {
    min-height: auto;
  }
`;

export const ResultOptionCard = styled(Card)`
  padding: 18px;
  overflow-wrap: anywhere;
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
