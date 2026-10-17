import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import Select from '@/components/UI/Select';

describe('Select primitive DOM tests', () => {
  const sampleOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'published', label: 'Published' },
    { value: 'draft', label: 'Draft' },
  ];

  it('renders native select with custom styling and accessible options', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <Select
        aria-label="Filter status"
        options={sampleOptions}
        onChange={onChange}
        defaultValue="all"
      />
    );

    const select = screen.getByRole('combobox', { name: 'Filter status' });
    expect(select).toBeInTheDocument();
    // Default size is 48px touch target floor
    expect(select).toHaveClass('min-h-control');
    // Normalized cross-browser appearance
    expect(select).toHaveClass('appearance-none');

    await user.selectOptions(select, 'published');
    expect(onChange).toHaveBeenCalled();
  });

  it('supports compact size for dense toolbars', () => {
    render(
      <Select
        aria-label="Sort by"
        size="sm"
        options={[
          { value: 'date', label: 'Date' },
          { value: 'name', label: 'Name' },
        ]}
      />
    );

    const select = screen.getByRole('combobox', { name: 'Sort by' });
    expect(select).toHaveClass('min-h-control-sm');
    expect(select).toHaveClass('h-control-sm');
  });

  it('renders children options when passed instead of options prop', () => {
    render(
      <Select aria-label="Event category" defaultValue="tech">
        <option value="tech">Technology</option>
        <option value="design">Design</option>
      </Select>
    );

    const select = screen.getByRole('combobox', { name: 'Event category' });
    expect(select).toHaveValue('tech');
    expect(screen.getByRole('option', { name: 'Technology' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Design' })).toBeInTheDocument();
  });

  it('associates with Field label when label prop is provided', () => {
    render(
      <Select
        label="Event Status"
        hint="Select the public lifecycle stage"
        options={sampleOptions}
      />
    );

    const select = screen.getByLabelText(/Event Status/i);
    expect(select).toBeInTheDocument();
    expect(screen.getByText('Select the public lifecycle stage')).toBeInTheDocument();
  });

  it('applies width and layout classes to the wrapper so chevron remains aligned with select', () => {
    const { container } = render(
      <Select
        aria-label="Filter"
        className="w-full sm:w-48 sm:flex-none"
        options={sampleOptions}
      />
    );

    const wrapper = container.querySelector('.relative.group');
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toHaveClass('w-full');
    expect(wrapper).toHaveClass('sm:w-48');
    expect(wrapper).toHaveClass('sm:flex-none');

    const select = screen.getByRole('combobox', { name: 'Filter' });
    expect(select).toHaveClass('w-full');
  });
});
