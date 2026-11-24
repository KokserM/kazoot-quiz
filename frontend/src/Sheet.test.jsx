import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { Sheet } from './components/Sheet';

afterEach(cleanup);

function Harness({ phase, onClose }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Full standings
      </button>
      <Sheet
        open={open}
        title="Full standings"
        closeOnChange={phase}
        onClose={() => {
          onClose();
          setOpen(false);
        }}
      >
        <p>All the rows</p>
      </Sheet>
    </>
  );
}

test('sheet opens as a labelled dialog and closes with its Close button', () => {
  const onClose = vi.fn();
  render(<Harness phase="results" onClose={onClose} />);
  expect(screen.queryByText('All the rows')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Full standings' }));
  const dialog = screen.getByRole('dialog', { name: 'Full standings' });
  expect(dialog).toHaveAttribute('open');
  expect(screen.getByText('All the rows')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('All the rows')).toBeNull();
});

test('sheet closes itself when the parent phase changes', () => {
  const onClose = vi.fn();
  const { rerender } = render(<Harness phase="results" onClose={onClose} />);
  fireEvent.click(screen.getByRole('button', { name: 'Full standings' }));
  rerender(<Harness phase="question" onClose={onClose} />);
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('All the rows')).toBeNull();
});
