import React, { type ReactNode } from 'react';

export interface DataTableColumn<T> {
  key: string;
  header: ReactNode;
  /** Cell renderer. Receives the row. */
  cell: (row: T) => ReactNode;
  /** Right-align numeric or money columns. */
  align?: 'left' | 'right';
  /**
   * Cap the column and truncate long text.
   *
   * This is the fix for the audit's worst overflow finding: 59
   * `whitespace-nowrap` cells wrapping user-supplied names and emails with no
   * `max-w` and no `truncate`, against only 21 uses of `truncate` in the whole
   * codebase. Long attendee names were forcing entire tables to scroll
   * sideways on a phone.
   */
  truncate?: boolean;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  /** Marks the row as selected. Used by the bulk-action toolbars. */
  isSelected?: (row: T) => boolean;
  empty?: ReactNode;
  caption: string;
  className?: string;
}

const align = { left: 'text-left', right: 'text-right' } as const;

/**
 * One table, one header treatment.
 *
 * The audit found 9 tables whose header and cell classes were byte-identical
 * duplicates, plus a 10th themed in amber. Every one of them hand-rolled
 * `bg-gray-50 px-6 py-3 text-sm uppercase tracking-wider text-gray-500` for the
 * header. This is that string, written once.
 *
 * `overflow-x-auto` on the wrapper is deliberate: a data table on a 375px
 * phone should scroll sideways rather than reflow into unreadable stacked
 * cards. The scroll is the affordance, and `min-w-0` on the cells stops
 * user-supplied text from forcing the container wider than the viewport.
 */
function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  isSelected,
  empty,
  caption,
  className = '',
}: DataTableProps<T>) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full min-w-full border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="bg-surface-container-low">
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={`whitespace-nowrap px-md py-xs text-xs font-medium uppercase tracking-wide text-on-surface-variant ${align[c.align ?? 'left']}`}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="p-lg">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const selected = isSelected?.(row) ?? false;
              return (
                <tr
                  key={rowKey(row)}
                  aria-selected={isSelected ? selected : undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`transition-colors duration-short2 ease-emphasized-standard ${
                    onRowClick ? 'cursor-pointer hover:bg-surface-container-low' : ''
                  } ${selected ? 'bg-primary-container/40' : 'bg-surface'}`}
                >
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={`min-w-0 px-md py-xs align-middle text-on-surface ${align[c.align ?? 'left']} ${
                        c.truncate ? 'max-w-[16rem] truncate' : ''
                      }`}
                    >
                      {c.cell(row)}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

export default DataTable;