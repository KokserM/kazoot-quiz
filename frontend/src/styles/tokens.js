// Colour tokens, taken from the logo: an ultraviolet K whose stroke runs from
// violet through magenta, on a near-black aubergine tile. Two themes share one set of names:
//  - STAGE: the default for the whole site, and always for the live game. The logo's
//    aubergine, so the answer tiles and the timer carry the energy.
//  - LIGHT: an opt-in for site pages (footer switch, remembered in localStorage under
//    `kazoot:theme`). Cool white, violet actions. Game screens stay on the stage.
// Brand colours (violet, magenta) are for actions and emphasis only; answer tiles
// have their own palette so a tile is never mistaken for a button or a selection.
// Every text pair used in the UI meets WCAG AA (tested in App.test.jsx and tokens.test.js).
// GlobalStyle turns these into CSS variables.

const ANSWERS = {
  // Bright fills with dark text (never white-on-mid-tone). Not red/green: those mean wrong/right.
  'answer-a': '#22D3EE',
  'answer-b': '#FF7AB6',
  'answer-c': '#FFC53D',
  'answer-d': '#8FB0FF',
  'answer-ink': '#140E22',
};

// Same mapping in both themes: the hero phone frame (always on a stage island), pedestals
// and confetti (tile colours), and the unavailable-button style (6.5:1 dark, 6.0:1 light).
const SHARED = {
  'device-body': '#0E0819',
  'device-edge': '#1D1430',
  'device-line': '#4A3D69',
  'podium-1': 'var(--answer-c)',
  'podium-2': 'var(--answer-d)',
  'podium-3': 'var(--answer-b)',
  'disabled-bg': 'var(--surface-sunk)',
  'disabled-ink': 'var(--ink-3)',
  'disabled-line': 'var(--line)',
};

export const LIGHT_COLORS = {
  paper: '#F8F7FC',
  surface: '#FFFFFF',
  'surface-sunk': '#F1EEF8',
  // Alternating page sections. Always recedes behind cards (surface) in both themes.
  band: '#F1EEF8',
  ink: '#140E22',
  'ink-2': '#3D3553',
  'ink-3': '#5E5673',
  line: '#E2DDEE',
  'line-strong': '#857C9C',

  // Primary actions: violet → magenta, the direction of the K's stroke.
  accent: '#7C3AED',
  'accent-hover': '#6D28D9',
  'accent-2': '#C026D3',
  'accent-2-hover': '#A21CAF',
  'accent-ink': '#FFFFFF',
  'accent-soft': '#F1EAFF',
  'accent-text': '#6D28D9',
  // Emphasis text (hero line): ends of the brand gradient, both readable on paper.
  'brand-a': '#7C3AED',
  'brand-b': '#D01F6E',

  success: '#15803D',
  'success-soft': '#DCFCE7',
  danger: '#BE123C',
  'danger-soft': '#FFE4E9',
  warning: '#92400E',
  'warning-soft': '#FEF3C7',

  focus: '#6D28D9',

  ...ANSWERS,
  'correct-ring': '#16A34A',

  // Spotlights. These alphas are maximums: they keep text on a glow at AA (brief 4.1).
  'glow-a': 'rgba(124, 58, 237, 0.10)',
  'glow-b': 'rgba(192, 38, 211, 0.08)',
  'glow-c': 'rgba(34, 211, 238, 0.06)',
  // Hairline on device frames and cards on the stage.
  ring: 'rgba(20, 14, 34, 0.12)',
  // Near-solid fill for the mobile dock, the phone header and the sheet handle area.
  scrim: 'rgba(248, 247, 252, 0.96)',
  ...SHARED,
};

export const STAGE_COLORS = {
  paper: '#100A1C',
  surface: '#1A1229',
  'surface-sunk': '#251B3A',
  band: '#150E23',
  ink: '#FAF7FF',
  'ink-2': '#D9D1EB',
  'ink-3': '#A99FC4',
  line: '#34294D',
  'line-strong': '#7A6FA3',

  accent: '#7C3AED',
  'accent-hover': '#6D28D9',
  'accent-2': '#C026D3',
  'accent-2-hover': '#A21CAF',
  'accent-ink': '#FFFFFF',
  'accent-soft': '#2C1F50',
  'accent-text': '#C9B8FF',
  'brand-a': '#B79CFF',
  'brand-b': '#FF7AB6',

  success: '#4ADE80',
  'success-soft': '#0F2A1C',
  danger: '#FDA4AF',
  'danger-soft': '#3A1426',
  warning: '#FCD34D',
  'warning-soft': '#2E2410',

  focus: '#F5F0FF',

  ...ANSWERS,
  'correct-ring': '#4ADE80',

  'glow-a': 'rgba(124, 58, 237, 0.30)',
  'glow-b': 'rgba(192, 38, 211, 0.24)',
  'glow-c': 'rgba(34, 211, 238, 0.10)',
  ring: 'rgba(201, 184, 255, 0.35)',
  scrim: 'rgba(16, 10, 28, 0.96)',
  ...SHARED,
};

// Kept for existing imports: the dark (default) theme is the stage palette.
export const DARK_COLORS = STAGE_COLORS;

// Shadows that differ per theme.
export const STAGE_SHADOWS = {
  shadow: '0 1px 2px rgba(0, 0, 0, 0.4)',
  'shadow-raised': '0 0 0 1px rgba(201, 184, 255, 0.12), 0 24px 44px -20px rgba(0, 0, 0, 0.8)',
  'shadow-action': '0 1px 0 rgba(255, 255, 255, 0.22) inset, 0 14px 34px -12px rgba(192, 38, 211, 0.9)',
  'shadow-action-hover': '0 1px 0 rgba(255, 255, 255, 0.22) inset, 0 16px 36px -12px rgba(192, 38, 211, 1)',
  // Header logo tile: 1 px ring (4.28:1 on --paper) and a soft violet halo.
  'glow-logo': '0 0 0 1px var(--line-strong), 0 0 18px -4px rgba(124, 58, 237, 0.6)',
};

export const LIGHT_SHADOWS = {
  shadow: '0 1px 2px rgba(20, 14, 34, 0.05), 0 8px 24px -12px rgba(20, 14, 34, 0.14)',
  'shadow-raised': '0 2px 4px rgba(20, 14, 34, 0.06), 0 22px 40px -18px rgba(76, 29, 149, 0.35)',
  'shadow-action': '0 1px 0 rgba(255, 255, 255, 0.22) inset, 0 10px 22px -12px rgba(124, 58, 237, 0.85)',
  'shadow-action-hover': '0 1px 0 rgba(255, 255, 255, 0.22) inset, 0 14px 26px -12px rgba(124, 58, 237, 0.95)',
  'glow-logo': 'none',
};

// Static only: nothing with a blur above 24 px is animated or scroll-linked.
// --shadow-device switches to the phone value at <= 560 px (GlobalStyle).
export const EFFECT_SHADOWS = {
  'shadow-device': '0 0 0 1px rgba(201, 184, 255, 0.10), 0 60px 120px -40px rgba(124, 58, 237, 0.75), 0 30px 60px -30px rgba(0, 0, 0, 0.9)',
  'shadow-device-phone': '0 0 0 1px rgba(201, 184, 255, 0.10), 0 30px 60px -30px rgba(0, 0, 0, 0.9)',
  'shadow-phone': '0 40px 70px -24px rgba(0, 0, 0, 0.95), 0 0 0 6px var(--device-edge)',
  'shadow-dock': '0 -12px 32px -16px rgba(0, 0, 0, 0.8)',
};

// Type scale (font sizes). The complete text styles (weight, width, leading, tracking)
// are the `textStyle` helpers in components/ui.jsx.
export const TYPE = {
  'type-hero': 'clamp(2.7rem, 7.4vw, 5.4rem)',
  'type-display': 'clamp(2rem, 6vw, 4.2rem)',
  'type-h2': 'clamp(1.7rem, 4vw, 2.75rem)',
  'type-page': 'clamp(1.9rem, 4.5vw, 2.8rem)',
  'type-h3': '1.5rem',
  'type-h3-group': '1.3rem',
  'type-h4': '1.1rem',
  'type-price': 'clamp(2rem, 3.2vw, 2.4rem)',
  'type-lead': 'clamp(1.1rem, 1.8vw, 1.25rem)',
  'type-body': '1.0625rem',
  'type-small': '0.92rem',
  'type-caption': '0.875rem',
  'type-eyebrow': '0.8rem',
};

export const SPACE = {
  'space-1': '4px',
  'space-2': '8px',
  'space-3': '12px',
  'space-4': '16px',
  'space-5': '20px',
  'space-6': '24px',
  'space-8': '32px',
  'space-10': '40px',
  'space-12': '48px',
  'space-16': '64px',
  'space-24': '96px',
  'section-y': 'clamp(48px, 8vw, 104px)',
  gutter: 'clamp(16px, 4vw, 32px)',
  max: '1120px',
  'max-stage': '980px',
  'max-prose': '760px',
  'max-narrow': '680px',
  'header-h': '64px',
  'dock-h': 'calc(68px + env(safe-area-inset-bottom))',
  'radius-sm': '8px',
  radius: '12px',
  'radius-md': '16px',
  'radius-lg': '18px',
  'radius-xl': '24px',
};

export const MOTION = {
  'dur-press': '90ms',
  'dur-fast': '160ms',
  'dur-base': '240ms',
  'dur-slow': '420ms',
  'dur-hero': '780ms',
  'dur-sheen': '900ms',
  'dur-sweep': '1600ms',
  'dur-confetti': '2400ms',
  'dur-count': '600ms',
  stagger: '60ms',
  'ease-out': 'cubic-bezier(0.2, 0.8, 0.2, 1)',
  'ease-spring': 'cubic-bezier(0.34, 1.45, 0.5, 1)',
  'ease-in-out': 'cubic-bezier(0.65, 0, 0.35, 1)',
};

export const Z = {
  'z-raised': '10',
  'z-dock': '30',
  'z-header': '40',
  'z-menu': '45',
  'z-toast': '50',
  'z-confetti': '60',
};

// <meta name="theme-color"> per theme (kept in sync with public/theme-init.js and manifest.json).
export const THEME_COLOR = { dark: STAGE_COLORS.paper, light: LIGHT_COLORS.paper };

export function toCssVariables(colors) {
  return Object.entries(colors)
    .map(([name, value]) => `--${name}: ${value};`)
    .join('\n');
}
