import { createGlobalStyle } from 'styled-components';
import {
  EFFECT_SHADOWS,
  LIGHT_COLORS,
  LIGHT_SHADOWS,
  MOTION,
  SPACE,
  STAGE_COLORS,
  STAGE_SHADOWS,
  TYPE,
  Z,
  toCssVariables,
} from './tokens';
// The width-axis file (weight 200–800, font-stretch 75–100 %), so headings can use font-stretch.
import '@fontsource-variable/bricolage-grotesque/wdth.css';
import '@fontsource/atkinson-hyperlegible/400.css';
import '@fontsource/atkinson-hyperlegible/700.css';

// Global styles and CSS variables. Values live in ./tokens.js.
//
// Theme: <html data-theme="dark|light">, set before first paint by public/theme-init.js
// (and by lib/theme.js when the footer switch changes). Dark (the stage palette) is the
// default for everyone; light is an opt-in. Game screens (data-stage) and stage islands
// (data-stage-scope) always use the stage palette.
export const GlobalStyle = createGlobalStyle`
  :root {
    ${toCssVariables(STAGE_COLORS)}
    ${toCssVariables(STAGE_SHADOWS)}
    ${toCssVariables(EFFECT_SHADOWS)}
    ${toCssVariables(TYPE)}
    ${toCssVariables(SPACE)}
    ${toCssVariables(MOTION)}
    ${toCssVariables(Z)}
    --font-display: 'Bricolage Grotesque Variable', 'Segoe UI', system-ui, sans-serif;
    --font-body: 'Atkinson Hyperlegible', 'Segoe UI', system-ui, sans-serif;
    --brand-gradient: linear-gradient(115deg, var(--accent) 0%, var(--accent-2) 100%);
    --brand-gradient-hover: linear-gradient(115deg, var(--accent-hover) 0%, var(--accent-2-hover) 100%);
    /* Input fill inside a --surface card: a well on dark, plain surface on light. */
    --field-well: var(--paper);
    /* Grain (E2) strength; 0 turns it off (light, Lite, more contrast, forced colours). */
    --grain-opacity: 0.05;
    color-scheme: dark;

    @media (max-width: 560px) {
      --header-h: 56px;
      --shadow-device: var(--shadow-device-phone);
    }
  }

  :root[data-theme='light'] {
    ${toCssVariables(LIGHT_COLORS)}
    ${toCssVariables(LIGHT_SHADOWS)}
    --field-well: var(--surface);
    --grain-opacity: 0;
    color-scheme: light;
  }

  /* Live game screens and stage islands (hero device stage, finale) always use the stage theme. */
  :root[data-stage='true'], [data-stage-scope] {
    ${toCssVariables(STAGE_COLORS)}
    ${toCssVariables(STAGE_SHADOWS)}
    --shadow: 0 0 0 1px rgba(255, 255, 255, 0.03);
    --field-well: var(--paper);
    color-scheme: dark;
  }

  /* Lite (set by theme-init.js on low-memory / few-core devices): no grain. */
  :root[data-lite] { --grain-opacity: 0; }

  @media (prefers-contrast: more) {
    :root, :root[data-theme='light'], :root[data-stage='true'], [data-stage-scope] {
      --line: var(--line-strong);
      --glow-a: transparent;
      --glow-b: transparent;
      --glow-c: transparent;
      --grain-opacity: 0;
    }
  }
  @media (forced-colors: active) {
    :root { --grain-opacity: 0; }
  }

  /* Print: always the light palette, no backgrounds, no site chrome. */
  @media print {
    :root, :root[data-theme], :root[data-stage='true'], [data-stage-scope] {
      ${toCssVariables(LIGHT_COLORS)}
      ${toCssVariables(LIGHT_SHADOWS)}
      --glow-a: transparent;
      --glow-b: transparent;
      --glow-c: transparent;
      --grain-opacity: 0;
      --field-well: var(--surface);
      color-scheme: light;
    }
    body { background: #fff; }
    body > #root > header, body > #root > footer, .dock, [data-print='hide'] { display: none !important; }
    [data-reveal] { opacity: 1 !important; transform: none !important; }
  }

  *, *::before, *::after { box-sizing: border-box; }

  /* Anchor targets and focused elements land below the sticky header. */
  html {
    -webkit-text-size-adjust: 100%;
    scroll-padding-top: calc(var(--header-h) + 16px);
  }
  @media (prefers-reduced-motion: no-preference) {
    html { scroll-behavior: smooth; }
  }

  /* While the game shell is mounted the document itself never scrolls (brief 8.1). */
  html[data-game-shell='true'], html[data-game-shell='true'] body {
    height: 100%;
    overflow: hidden;
    overscroll-behavior: none;
  }

  body {
    margin: 0;
    min-height: 100vh;
    background: var(--paper);
    color: var(--ink);
    font-family: var(--font-body);
    font-size: var(--type-body);
    line-height: 1.55;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }

  #root { min-height: 100vh; display: flex; flex-direction: column; }

  h1, h2, h3, h4 {
    font-family: var(--font-display);
    line-height: 1.08;
    letter-spacing: -0.02em;
    margin: 0;
    font-weight: 700;
    text-wrap: balance;
  }

  p { margin: 0; text-wrap: pretty; }

  a { color: var(--accent-text); text-underline-offset: 0.18em; }
  a:hover { color: var(--ink); }

  button, input, select, textarea { font: inherit; color: inherit; }
  input[type='radio'], input[type='checkbox'] { accent-color: var(--accent); }

  :focus-visible {
    outline: 3px solid var(--focus);
    outline-offset: 2px;
    border-radius: 6px;
  }

  /* Headings focused programmatically on screen changes (for screen readers). */
  [tabindex='-1']:focus { outline: none; }

  ::selection { background: var(--accent-soft); color: var(--ink); }

  dialog::backdrop {
    background: rgba(16, 10, 28, 0.6);
    backdrop-filter: blur(2px);
  }
  /* No blur on touch devices: it repaints on every frame on low-end phones. */
  @media (pointer: coarse) {
    dialog::backdrop { backdrop-filter: none; }
  }

  img, svg { display: block; max-width: 100%; }

  .visually-hidden {
    position: absolute !important;
    width: 1px; height: 1px; padding: 0; margin: -1px;
    overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
  }

  /* ---------------------------------------------------------------- motion
     Shared keyframes (brief section 10). Use them by name, e.g.
     animation: settle var(--dur-slow) var(--ease-out) backwards; */
  @keyframes settle { from { opacity: 0; transform: translateY(12px) scale(0.97); } }
  @keyframes pop { from { opacity: 0; transform: scale(var(--pop-from, 0.9)); } }
  @keyframes bump { 50% { transform: scale(var(--bump-to, 1.03)); } }
  @keyframes rise { from { transform: scaleY(0); } }
  @keyframes fade-in { from { opacity: 0; } }
  @keyframes pulse-dot { 0%, 100% { opacity: 0.35; } 50% { opacity: 1; } }
  @keyframes fall {
    from { transform: translate3d(0, -12%, 0) rotate(0); opacity: 1; }
    85% { opacity: 1; }
    to { transform: translate3d(var(--dx, 0), 105cqh, 0) rotate(var(--r, 360deg)); opacity: 0; }
  }
  @keyframes sweep { from { transform: translateX(-130%); } to { transform: translateX(130%); } }
  @keyframes sheen { from { background-position: 130% 0; } to { background-position: -30% 0; } }
  @keyframes sheet-up { from { transform: translateY(100%); } }
  @keyframes sheet-in { from { opacity: 0; transform: scale(0.98); } }
  @keyframes menu-in { from { opacity: 0; transform: translateY(-8px); } }

  /* Scroll-reveal (E7): lib/useReveal sets data-in. The hiding rule only exists when the
     visitor has no motion preference, so with reduced motion content is visible at once. */
  @media (prefers-reduced-motion: no-preference) {
    [data-reveal] { opacity: 0; transform: translateY(16px); }
    [data-reveal][data-in] {
      opacity: 1;
      transform: none;
      transition: opacity var(--dur-slow) var(--ease-out), transform var(--dur-slow) var(--ease-out);
      transition-delay: calc(var(--i, 0) * var(--stagger));
    }
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }
`;
