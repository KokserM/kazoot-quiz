import { createGlobalStyle } from 'styled-components';

export const GlobalStyle = createGlobalStyle`
  * {
    box-sizing: border-box;
  }

  html {
    color-scheme: dark;
  }

  html,
  body,
  #root {
    min-height: 100%;
  }

  body {
    margin: 0;
    font-family: Inter, "Segoe UI", Roboto, sans-serif;
    background: ${({ theme }) => theme.gradients.hero};
    color: ${({ theme }) => theme.colors.text};
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  a {
    color: inherit;
    text-decoration: none;
  }

  button,
  input,
  select {
    font: inherit;
  }

  ::selection {
    background: rgba(139, 92, 246, 0.35);
  }

  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      scroll-behavior: auto !important;
      transition-duration: 0.01ms !important;
    }
  }
`;
