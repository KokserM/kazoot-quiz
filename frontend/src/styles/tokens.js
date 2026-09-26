// Colour tokens. Every text pair used in the UI meets WCAG AA; this is
// checked by a unit test (App.test.jsx). GlobalStyle turns these into CSS variables.
export const LIGHT_COLORS = {
  'paper': '#F6F2EA',
  'surface': '#FFFFFF',
  'surface-sunk': '#EEE8DC',
  'ink': '#1C1A17',
  'ink-2': '#4B463F',
  'ink-3': '#6A645A',
  'line': '#DCD4C6',
  'line-strong': '#8C8475',
  'accent': '#5B2BB5',
  'accent-ink': '#FFFFFF',
  'accent-hover': '#4A2196',
  'accent-soft': '#ECE4FB',
  'coral': '#C2410C',
  'success': '#166534',
  'success-soft': '#E3F1E6',
  'danger': '#B42318',
  'danger-soft': '#FBE7E4',
  'warning': '#8A5300',
  'warning-soft': '#FBEFD9',
  'answer-a': '#0F766E',
  'answer-b': '#9D174D',
  'answer-c': '#9A5B0B',
  'answer-d': '#334155',
  'focus': '#1D4ED8'
};

export const DARK_COLORS = {
  'paper': '#16140F',
  'surface': '#211E18',
  'surface-sunk': '#2A2620',
  'ink': '#F2EDE4',
  'ink-2': '#D2CABD',
  'ink-3': '#A79F92',
  'line': '#3A352D',
  'line-strong': '#7D7568',
  'accent': '#B79CF5',
  'accent-ink': '#16140F',
  'accent-hover': '#CDB8FA',
  'accent-soft': '#2E2544',
  'coral': '#F08A5D',
  'success': '#7FD19A',
  'success-soft': '#1E3325',
  'danger': '#F59A8F',
  'danger-soft': '#3A1F1B',
  'warning': '#F1C271',
  'warning-soft': '#3A2D16',
  'focus': '#93B4FF'
};

export function toCssVariables(colors) {
  return Object.entries(colors)
    .map(([name, value]) => `--${name}: ${value};`)
    .join('\n');
}
