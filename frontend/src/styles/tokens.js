// Colour tokens. Two themes share one set of names:
//  - LIGHT: the site (landing, setup, pricing, account). Cool, crisp, calm.
//  - STAGE: the live game (lobby, questions, results) and dark-mode users.
//    Midnight navy so vivid answer tiles and the timer carry the energy.
// Every text pair used in the UI meets WCAG AA (tested in App.test.jsx).
// GlobalStyle turns these into CSS variables.

export const LIGHT_COLORS = {
  paper: '#F6F8FC',
  surface: '#FFFFFF',
  'surface-sunk': '#EDF1F8',
  ink: '#0B1020',
  'ink-2': '#334062',
  'ink-3': '#56617C',
  line: '#DBE2EE',
  'line-strong': '#7D88A1',

  accent: '#2563EB',
  'accent-hover': '#1D4ED8',
  'accent-ink': '#FFFFFF',
  'accent-soft': '#E3EBFF',
  'accent-text': '#1D4ED8',

  success: '#166534',
  'success-soft': '#DCFCE7',
  danger: '#B91C1C',
  'danger-soft': '#FEE2E2',
  warning: '#92400E',
  'warning-soft': '#FEF3C7',

  focus: '#2563EB',

  // Answer tiles use navy text on bright fills (never white-on-mid-tone).
  'answer-a': '#22D3EE',
  'answer-b': '#F472B6',
  'answer-c': '#FBBF24',
  'answer-d': '#A5B4FC',
  'answer-ink': '#0B1020',
  'correct-ring': '#16A34A',
};

export const STAGE_COLORS = {
  paper: '#0B1020',
  surface: '#141C30',
  'surface-sunk': '#1B2440',
  ink: '#F8FAFC',
  'ink-2': '#CBD5E1',
  'ink-3': '#94A3B8',
  line: '#25304D',
  'line-strong': '#5B6785',

  accent: '#2563EB',
  'accent-hover': '#3366F0',
  'accent-ink': '#FFFFFF',
  'accent-soft': '#1C2B57',
  'accent-text': '#A5B4FC',

  success: '#4ADE80',
  'success-soft': '#10261C',
  danger: '#FCA5A5',
  'danger-soft': '#2A1520',
  warning: '#FCD34D',
  'warning-soft': '#2A220C',

  focus: '#F8FAFC',

  'answer-a': '#22D3EE',
  'answer-b': '#F472B6',
  'answer-c': '#FBBF24',
  'answer-d': '#A5B4FC',
  'answer-ink': '#0B1020',
  'correct-ring': '#4ADE80',
};

// Kept for existing imports: dark mode uses the stage palette.
export const DARK_COLORS = STAGE_COLORS;

export function toCssVariables(colors) {
  return Object.entries(colors)
    .map(([name, value]) => `--${name}: ${value};`)
    .join('\n');
}
