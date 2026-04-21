import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import App from './App';

test('renders Kazoot marketing headline', () => {
  render(<App />);
  expect(
    screen.getByText(/Kazoot brings reliable multiplayer quiz nights back to life/i)
  ).toBeInTheDocument();
});
