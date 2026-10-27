/**
 * Utility functions for exporting tabular data and attendee records to CSV.
 * Pure functions with zero direct Firebase dependency.
 */

const FORMULA_TRIGGER_PATTERN = /^[\t\r\n ]*[=+\-@]|^[\t\r]/;

export const escapeCSVCell = (value: string | number | boolean | null | undefined): string => {
  const normalized = value === null || value === undefined ? '' : String(value);
  const formulaSafe =
    typeof value === 'number'
      ? normalized
      : FORMULA_TRIGGER_PATTERN.test(normalized)
        ? `'${normalized}`
        : normalized;
  const sanitized = formulaSafe.replace(/"/g, '""');
  return `"${sanitized}"`;
};

export const humanizeLabel = (value: string): string => {
  if (!value) return 'Field';
  const spaced = value
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
  if (!spaced) return 'Field';
  return spaced
    .split(' ')
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : ''))
    .join(' ')
    .trim();
};

export const formatFormResponseValue = (value: unknown): string => {
  if (value === null || value === undefined) return '';

  if (Array.isArray(value)) {
    if (!value.length) return '';
    return value
      .map((item) => formatFormResponseValue(item))
      .filter(Boolean)
      .join('; ');
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value);
    if (!entries.length) return '';
    return entries
      .map(([key, entryValue]) => {
        const formatted = formatFormResponseValue(entryValue);
        return formatted ? `${humanizeLabel(key)}: ${formatted}` : '';
      })
      .filter(Boolean)
      .join('; ');
  }

  return String(value);
};

export interface ExportableAttendeeRegistration {
  id: string;
  userDetails?: {
    name?: string;
    email?: string;
    phoneNumber?: string;
    organization?: string;
  };
  ticketTypeId?: string;
  quantity?: number;
  totalAmount?: number;
  paymentStatus?: string;
  attendanceStatus?: string;
  registrationStatus?: string;
  registrationDate?: any;
  customResponses?: Record<string, any>;
}

export function generateAttendeesCSV(
  registrations: ExportableAttendeeRegistration[],
  formFields?: Array<{ id: string; label: string }>,
  ticketTypes?: Array<{ id: string; name: string }>
): string {
  const formFieldMap = new Map<string, string>();
  if (formFields) {
    formFields.forEach((f) => formFieldMap.set(f.id, f.label || humanizeLabel(f.id)));
  }

  // Also collect any remaining custom response keys
  registrations.forEach((reg) => {
    if (reg.customResponses) {
      Object.keys(reg.customResponses).forEach((key) => {
        if (!formFieldMap.has(key)) {
          formFieldMap.set(key, humanizeLabel(key));
        }
      });
    }
  });

  const formFieldEntries = Array.from(formFieldMap.entries()).sort((a, b) => a[1].localeCompare(b[1]));

  const headers = [
    'Registration ID',
    'Attendee Name',
    'Email',
    'Phone',
    'Organization',
    'Ticket Type',
    'Quantity',
    'Total Amount (PHP)',
    'Payment Status',
    'Attendance Status',
    'Registration Date',
    ...formFieldEntries.map(([, label]) => label),
  ];

  const ticketTypeMap = new Map<string, string>();
  if (ticketTypes) {
    ticketTypes.forEach((tt) => ticketTypeMap.set(tt.id, tt.name));
  }

  const rows = registrations.map((reg) => {
    const ticketName = reg.ticketTypeId
      ? ticketTypeMap.get(reg.ticketTypeId) || reg.ticketTypeId
      : 'General Admission';

    const regDateStr = reg.registrationDate?.toDate
      ? reg.registrationDate.toDate().toISOString()
      : typeof reg.registrationDate === 'string'
      ? reg.registrationDate
      : '';

    const row = [
      escapeCSVCell(reg.id),
      escapeCSVCell(reg.userDetails?.name || ''),
      escapeCSVCell(reg.userDetails?.email || ''),
      escapeCSVCell(reg.userDetails?.phoneNumber || ''),
      escapeCSVCell(reg.userDetails?.organization || ''),
      escapeCSVCell(ticketName),
      escapeCSVCell(reg.quantity ?? 1),
      escapeCSVCell(reg.totalAmount ?? 0),
      escapeCSVCell(reg.paymentStatus || 'pending'),
      escapeCSVCell(reg.attendanceStatus || 'pending'),
      escapeCSVCell(regDateStr),
      ...formFieldEntries.map(([fieldId]) => {
        const val = reg.customResponses?.[fieldId];
        return escapeCSVCell(formatFormResponseValue(val));
      }),
    ];
    return row.join(',');
  });

  return [headers.map((h) => escapeCSVCell(h)).join(','), ...rows].join('\n');
}

export function downloadCSV(csvContent: string, filename: string): void {
  const bomContent = csvContent.startsWith('\uFEFF') ? csvContent : `\uFEFF${csvContent}`;
  const blob = new Blob([bomContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Defer revoking the Blob URL so WebKit (Safari) and Firefox can initiate the download asynchronously
  setTimeout(() => URL.revokeObjectURL(url), 100);
}
