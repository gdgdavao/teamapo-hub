import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import Button from '@/components/UI/Button';

// Proves the jsdom project is actually wired: DOM present, jest-dom matchers
// loaded, cleanup running, and the shared Button primitive reachable through
// the `@` alias. If this file ever needs deleting, the harness is broken.
describe('dom test project', () => {
  it('renders into a real document and cleans up between tests', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(<Button onClick={onClick}>Check in attendee</Button>);

    const button = screen.getByRole('button', { name: 'Check in attendee' });
    expect(button).toBeInTheDocument();
    // Material's own 40dp default, overridden to our documented floor.
    expect(button).toHaveClass('min-h-control');

    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not leak the previous render into this one', () => {
    expect(screen.queryByRole('button', { name: 'Check in attendee' })).toBeNull();
  });

  it('renders as a react-router Link anchor when href is provided', () => {
    render(
      <MemoryRouter>
        <Button href="/events" variant="tonal">
          Browse events
        </Button>
      </MemoryRouter>
    );

    const link = screen.getByRole('link', { name: 'Browse events' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/events');
    expect(link).toHaveClass('min-h-control');
    expect(link).toHaveClass('bg-secondary-container');
  });

  it('renders disabled button with proper affordances and does not fire clicks', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(<Button disabled onClick={onClick}>Disabled action</Button>);

    const button = screen.getByRole('button', { name: 'Disabled action' });
    expect(button).toBeDisabled();
    expect(button).toHaveClass('disabled:cursor-not-allowed');
    expect(button).toHaveClass('disabled:opacity-38');
    expect(button).toHaveClass('select-none');

    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});