// Colour tokens, taken from the logo: an ultraviolet K whose stroke runs from
// violet through magenta, on a near-black aubergine tile. Two themes share one set of names:
//  - LIGHT: the site (landing, setup, pricing, account). Cool white, violet actions.
//  - STAGE: the live game (lobby, questions, results) and dark-mode users.
//    The logo's aubergine, so the answer tiles and the timer carry the energy.
// Brand colours (violet, magenta) are for actions and emphasis only; answer tiles
// have their own palette so a tile is never mistaken for a button or a selection.
// Every text pair used in the UI meets WCAG AA (tested in App.test.jsx).
// GlobalStyle turns these into CSS variables.

const ANSWERS = {
  // Bright fills with dark text (never white-on-mid-tone). Not red/green: those mean wrong/right.
  'answer-a': '#22D3EE',
  'answer-b': '#FF7AB6',
  'answer-c': '#FFC53D',
  'answer-d': '#8FB0FF',
  'answer-ink': '#140E22',
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
};

// Kept for existing imports: dark mode uses the stage palette.
export const DARK_COLORS = STAGE_COLORS;

export function toCssVariables(colors) {
  return Object.entries(colors)
    .map(([name, value]) => `--${name}: ${value};`)
    .join('\n');
}
