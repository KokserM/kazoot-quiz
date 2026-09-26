import React from 'react';

// Small stroke icons that pair with text labels so state never relies on colour alone.
const PATHS = {
  check: 'M4.5 12.5l5 5 10-11',
  x: 'M6 6l12 12M18 6L6 18',
  lock: 'M7 11V8a5 5 0 0110 0v3M5.5 11h13v9h-13z',
  clock: 'M12 7v5l3 2M12 21a9 9 0 110-18 9 9 0 010 18z',
  info: 'M12 11v6M12 7.5v.5M12 21a9 9 0 110-18 9 9 0 010 18z',
  alert: 'M12 8v5M12 16.5v.5M10.3 4.3L2.6 18a2 2 0 001.7 3h15.4a2 2 0 001.7-3L13.7 4.3a2 2 0 00-3.4 0z',
  wifiOff: 'M3 3l18 18M8.5 16.5a5 5 0 017 0M5 12.9a10 10 0 015.1-2.8M19 12.9a10 10 0 00-2.4-1.7M12 20h.01',
  dash: 'M6 12h12',
  plus: 'M12 5v14M5 12h14',
  arrowRight: 'M5 12h14M13 6l6 6-6 6',
  users: 'M16 20v-1.5a4 4 0 00-4-4H6a4 4 0 00-4 4V20M9 11a4 4 0 100-8 4 4 0 000 8zM22 20v-1.5a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8',
  crown: 'M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z',
};

export function Icon({ name, size = '1em', strokeWidth = 2.4, title, style }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : 'true'}
      role={title ? 'img' : undefined}
      style={{ flex: '0 0 auto', display: 'inline-block', verticalAlign: '-0.14em', ...style }}
    >
      {title ? <title>{title}</title> : null}
      <path d={PATHS[name]} />
    </svg>
  );
}
