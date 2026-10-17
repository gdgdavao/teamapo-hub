import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import React, { useState } from 'react';
import SegmentedControl, { type SegmentedControlOption } from '@/components/UI/SegmentedControl';

describe('SegmentedControl primitive', () => {
  type Range = '30d' | '90d' | 'all';

  const options: SegmentedControlOption<Range>[] = [
    { value: '30d', label: '30 days' },
    { value: '90d', label: '90 days' },
    { value: 'all', label: 'All time' },
  ];

  it('renders a radiogroup with 48px touch targets and accessible names', () => {
    render(
      <SegmentedControl
        label="Time range"
        options={options}
        value="30d"
        onChange={vi.fn()}
      />
    );

    const group = screen.getByRole('radiogroup', { name: 'Time range' });
    expect(group).toBeInTheDocument();

    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);

    for (const radio of radios) {
      expect(radio).toHaveClass('min-h-control');
      expect(radio).toHaveClass('px-control-x-sm');
    }
  });

  it('exposes a single tab stop with roving tabindex and aria-checked', () => {
    render(
      <SegmentedControl
        label="Time range"
        options={options}
        value="90d"
        onChange={vi.fn()}
      />
    );

    const option30d = screen.getByRole('radio', { name: '30 days' });
    const option90d = screen.getByRole('radio', { name: '90 days' });
    const optionAll = screen.getByRole('radio', { name: 'All time' });

    expect(option90d).toHaveAttribute('aria-checked', 'true');
    expect(option90d).toHaveAttribute('tabIndex', '0');

    expect(option30d).toHaveAttribute('aria-checked', 'false');
    expect(option30d).toHaveAttribute('tabIndex', '-1');

    expect(optionAll).toHaveAttribute('aria-checked', 'false');
    expect(optionAll).toHaveAttribute('tabIndex', '-1');
  });

  it('calls onChange with the clicked value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <SegmentedControl
        label="Time range"
        options={options}
        value="30d"
        onChange={onChange}
      />
    );

    await user.click(screen.getByRole('radio', { name: '90 days' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('90d');
  });

  it('supports roving tabindex keyboard navigation across options with wrapping', async () => {
    const user = userEvent.setup();

    function ControlledHarness() {
      const [val, setVal] = useState<Range>('30d');
      return (
        <SegmentedControl
          label="Time range"
          options={options}
          value={val}
          onChange={setVal}
        />
      );
    }

    render(<ControlledHarness />);

    const option30d = screen.getByRole('radio', { name: '30 days' });
    const option90d = screen.getByRole('radio', { name: '90 days' });
    const optionAll = screen.getByRole('radio', { name: 'All time' });

    // Focus the initial tab stop
    option30d.focus();
    expect(document.activeElement).toBe(option30d);

    // ArrowRight moves to next (90d)
    await user.keyboard('{ArrowRight}');
    expect(option90d).toHaveAttribute('aria-checked', 'true');
    expect(document.activeElement).toBe(option90d);

    // ArrowDown also moves to next (all)
    await user.keyboard('{ArrowDown}');
    expect(optionAll).toHaveAttribute('aria-checked', 'true');
    expect(document.activeElement).toBe(optionAll);

    // ArrowRight wraps around to first (30d)
    await user.keyboard('{ArrowRight}');
    expect(option30d).toHaveAttribute('aria-checked', 'true');
    expect(document.activeElement).toBe(option30d);

    // ArrowLeft wraps around to last (all)
    await user.keyboard('{ArrowLeft}');
    expect(optionAll).toHaveAttribute('aria-checked', 'true');
    expect(document.activeElement).toBe(optionAll);

    // ArrowUp moves to previous (90d)
    await user.keyboard('{ArrowUp}');
    expect(option90d).toHaveAttribute('aria-checked', 'true');
    expect(document.activeElement).toBe(option90d);

    // Home jumps to first (30d)
    await user.keyboard('{Home}');
    expect(option30d).toHaveAttribute('aria-checked', 'true');
    expect(document.activeElement).toBe(option30d);

    // End jumps to last (all)
    await user.keyboard('{End}');
    expect(optionAll).toHaveAttribute('aria-checked', 'true');
    expect(document.activeElement).toBe(optionAll);
  });
});
