import { createGlobalStyle } from 'styled-components';
import { LIGHT_COLORS, STAGE_COLORS, toCssVariables } from './tokens';
import '@fontsource-variable/bricolage-grotesque';
import '@fontsource/atkinson-hyperlegible/400.css';
import '@fontsource/atkinson-hyperlegible/700.css';

// Global styles and CSS variables. Colours live in ./tokens.js.
export const GlobalStyle = createGlobalStyle`
  :root {
    ${toCssVariables(LIGHT_COLORS)}
    --font-display: 'Bricolage Grotesque Variable', 'Segoe UI', system-ui, sans-serif;
    --font-body: 'Atkinson Hyperlegible', 'Segoe UI', system-ui, sans-serif;
    --shadow: 0 1px 2px rgba(20, 14, 34, 0.05), 0 8px 24px -12px rgba(20, 14, 34, 0.14);
    --shadow-raised: 0 2px 4px rgba(20, 14, 34, 0.06), 0 22px 40px -18px rgba(76, 29, 149, 0.35);
    --shadow-action: 0 1px 0 rgba(255, 255, 255, 0.22) inset, 0 10px 22px -12px rgba(124, 58, 237, 0.85);
    --brand-gradient: linear-gradient(115deg, var(--accent) 0%, var(--accent-2) 100%);
    --brand-gradient-hover: linear-gradient(115deg, var(--accent-hover) 0%, var(--accent-2-hover) 100%);
    --radius: 12px;
    --radius-lg: 18px;
    --gutter: clamp(16px, 4vw, 32px);
    --max: 1120px;
    --header-h: 64px;
    --ease-out: cubic-bezier(0.2, 0.8, 0.2, 1);
    --ease-spring: cubic-bezier(0.34, 1.45, 0.5, 1);
    color-scheme: light;

    @media (max-width: 560px) { --header-h: 56px; }
  }

  /* Live game screens (and the landing preview) always use the stage theme. */
  :root[data-stage='true'], [data-stage-scope] {
    ${toCssVariables(STAGE_COLORS)}
    --shadow: 0 0 0 1px rgba(255, 255, 255, 0.03);
    --shadow-raised: 0 0 0 1px rgba(201, 184, 255, 0.12), 0 24px 44px -20px rgba(0, 0, 0, 0.8);
    color-scheme: dark;
  }

  @media (prefers-color-scheme: dark) {
    :root {
      ${toCssVariables(STAGE_COLORS)}
      --shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
      --shadow-raised: 0 0 0 1px rgba(201, 184, 255, 0.12), 0 24px 44px -20px rgba(0, 0, 0, 0.8);
      color-scheme: dark;
    }
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

  body {
    margin: 0;
    min-height: 100vh;
    background: var(--paper);
    color: var(--ink);
    font-family: var(--font-body);
    font-size: 1.0625rem;
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

  img, svg { display: block; max-width: 100%; }

  .visually-hidden {
    position: absolute !important;
    width: 1px; height: 1px; padding: 0; margin: -1px;
    overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
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
