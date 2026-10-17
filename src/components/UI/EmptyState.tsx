import React, { type ReactNode } from 'react';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  /** The next action. An empty state without one is a dead end. */
  action?: ReactNode;
  /** Tightens vertical rhythm when nested inside a table cell or a card. */
  compact?: boolean;
}

/**
 * An empty state that teaches, rather than reporting absence.
 *
 * The audit found the same block copy-pasted verbatim in both the card and the
 * table view of AdminAttendeesPage, and a bare "No registrations found" with no
 * next step in four other places. `compact` exists because half the duplications
 * were the same component rendered at two different densities.
 */
const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  compact = false,
}) => (
  <div
    className={`flex flex-col items-center justify-center text-center ${
      compact ? 'gap-sm py-lg' : 'gap-md py-xl'
    }`}
  >
    {icon && (
      <div
        className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-container text-on-surface-variant"
        aria-hidden="true"
      >
        {icon}
      </div>
    )}
    <div className="space-y-3xs">
      <p className="font-medium text-on-surface">{title}</p>
      {description && (
        <p className="mx-auto max-w-[45ch] text-sm text-on-surface-variant">
          {description}
        </p>
      )}
    </div>
    {action}
  </div>
);

export default EmptyState;