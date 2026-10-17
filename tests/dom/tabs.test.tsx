import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import Tabs, { type TabItem } from '@/components/UI/Tabs';

describe('Tabs primitive', () => {
  const dummyIcon = <svg data-testid="test-icon" className="h-5 w-5 shrink-0" />;

  const sampleItems: TabItem[] = [
    { id: 'overview', label: 'Overview', icon: dummyIcon },
    { id: 'certificates', label: 'Certificates', icon: dummyIcon, badge: '7' },
    { id: 'settings', label: 'Settings', icon: dummyIcon },
  ];

  it('renders tab buttons with 48px touch floor, px-sm padding, and shrink-0', () => {
    render(
      <Tabs
        label="Event tabs"
        items={sampleItems}
        activeId="overview"
        onChange={vi.fn()}
      />
    );

    const overviewTab = screen.getByRole('tab', { name: /overview/i });
    expect(overviewTab).toBeInTheDocument();
    expect(overviewTab).toHaveClass('min-h-control');
    expect(overviewTab).toHaveClass('px-sm');
    expect(overviewTab).toHaveClass('shrink-0');
    expect(overviewTab).toHaveAttribute('aria-selected', 'true');
    expect(overviewTab).toHaveAttribute('tabIndex', '0');

    const certTab = screen.getByRole('tab', { name: /certificates/i });
    expect(certTab).toHaveClass('px-sm');
    expect(certTab).toHaveClass('shrink-0');
    expect(certTab).toHaveAttribute('aria-selected', 'false');
    expect(certTab).toHaveAttribute('tabIndex', '-1');
  });

  it('wraps icons in an inline-flex container with cross-axis optical centering', () => {
    render(
      <Tabs
        label="Event tabs"
        items={sampleItems}
        activeId="overview"
        onChange={vi.fn()}
      />
    );

    const icon = screen.getAllByTestId('test-icon')[0];
    const iconWrapper = icon.parentElement;
    expect(iconWrapper).toBeInTheDocument();
    expect(iconWrapper).toHaveAttribute('aria-hidden', 'true');
    expect(iconWrapper).toHaveClass('inline-flex');
    expect(iconWrapper).toHaveClass('items-center');
    expect(iconWrapper).toHaveClass('justify-center');
    expect(iconWrapper).toHaveClass('shrink-0');
  });

  it('supports roving tabindex keyboard navigation across tabs', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <Tabs
        label="Event tabs"
        items={sampleItems}
        activeId="overview"
        onChange={onChange}
      />
    );

    const overviewTab = screen.getByRole('tab', { name: /overview/i });
    overviewTab.focus();

    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenCalledWith('certificates');

    await user.keyboard('{End}');
    expect(onChange).toHaveBeenCalledWith('settings');

    await user.keyboard('{Home}');
    expect(onChange).toHaveBeenCalledWith('overview');
  });

  it('supports fullWidth mode where tabs expand to fill container', () => {
    render(
      <Tabs
        label="Event tabs"
        items={sampleItems}
        activeId="overview"
        onChange={vi.fn()}
        fullWidth
      />
    );

    const overviewTab = screen.getByRole('tab', { name: /overview/i });
    expect(overviewTab).toHaveClass('flex-1');
    expect(overviewTab).toHaveClass('justify-center');
    expect(overviewTab).not.toHaveClass('shrink-0');

    const tablist = screen.getByRole('tablist');
    expect(tablist).toHaveClass('w-full');
  });
});
