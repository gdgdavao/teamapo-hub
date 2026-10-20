/**
 * The primitive layer barrel.
 *
 * Two check-in modals used to be re-exported from here even though they live with
 * the tab that owns them. That made `components/UI` reachable from a page folder
 * and vice versa, which is the coupling this barrel exists to avoid: a primitive
 * must not import from a screen, and the barrel is the only sanctioned path in.
 *
 * Previously this file exported 7 of the 13 components, omitting Button, Card,
 * Badge, Input and Modal - so every consumer deep-imported those by path. That
 * is how `min-w-[44px]` and `rounded-md` and `shadow-sm` ended up scattered
 * across 203 buttons: when a component has two import paths, it drifts.
 *
 * Import primitives from here, never by file path.
 */
export { default as Button } from './Button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button';

export { default as Card, CardSubtle } from './Card';
export type { CardProps, CardElevation, CardPadding } from './Card';

export { default as Badge } from './Badge';
export type { BadgeProps, BadgeTone } from './Badge';

export { default as Field } from './Field';
export type { FieldProps } from './Field';

export { default as Input } from './Input';
export type { InputProps } from './Input';

export { default as Select } from './Select';
export type { SelectProps, SelectOption } from './Select';

export { default as Textarea } from './Textarea';
export type { TextareaProps } from './Textarea';

export { default as Modal } from './Modal';
export type { ModalProps } from './Modal';

export { default as ConfirmationModal } from './ConfirmationModal';

export { default as LoadingSpinner } from './LoadingSpinner';
export { default as ProgressBar } from './ProgressBar';
export { default as SimpleBarChart } from './SimpleBarChart';
export { default as Skeleton, SkeletonText, SkeletonList } from './Skeleton';

export { default as Tabs, TabPanel } from './Tabs';
export type { TabsProps, TabItem } from './Tabs';

export { default as SegmentedControl } from './SegmentedControl';
export type {
  SegmentedControlProps,
  SegmentedControlOption,
} from './SegmentedControl';

export { default as DataTable } from './DataTable';
export type { DataTableProps, DataTableColumn } from './DataTable';

export { default as EmptyState } from './EmptyState';
export type { EmptyStateProps } from './EmptyState';

export { default as AppToaster } from './AppToaster';
export { default as toast } from './toast';
export * from './toast';

export { default as LeafletMap } from './LeafletMap';
export type { LeafletMapProps } from './LeafletMap';
