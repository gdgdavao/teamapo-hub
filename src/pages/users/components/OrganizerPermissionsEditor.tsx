import React, { useId, useMemo } from 'react';
import {
  OrganizerPermissions,
  ORGANIZER_PERMISSION_PRESETS,
  OrganizerPresetKey,
  DEFAULT_ORGANIZER_PERMISSIONS,
} from '../../../types';
import {
  CalendarDaysIcon,
  UserGroupIcon,
  QrCodeIcon,
  AcademicCapIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

interface OrganizerPermissionsEditorProps {
  value: OrganizerPermissions;
  onChange: (permissions: OrganizerPermissions) => void;
  disabled?: boolean;
}

export const OrganizerPermissionsEditor: React.FC<OrganizerPermissionsEditorProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const baseId = useId();

  // Normalize current permissions with defaults
  const normalized: Required<OrganizerPermissions> = useMemo(() => ({
    events: {
      canCreate: value?.events?.canCreate ?? DEFAULT_ORGANIZER_PERMISSIONS.events?.canCreate ?? true,
      canUpdate: value?.events?.canUpdate ?? DEFAULT_ORGANIZER_PERMISSIONS.events?.canUpdate ?? true,
      canDelete: value?.events?.canDelete ?? DEFAULT_ORGANIZER_PERMISSIONS.events?.canDelete ?? true,
    },
    attendees: {
      canRead: value?.attendees?.canRead ?? DEFAULT_ORGANIZER_PERMISSIONS.attendees?.canRead ?? true,
      canUpdate: value?.attendees?.canUpdate ?? DEFAULT_ORGANIZER_PERMISSIONS.attendees?.canUpdate ?? true,
      canDelete: value?.attendees?.canDelete ?? DEFAULT_ORGANIZER_PERMISSIONS.attendees?.canDelete ?? true,
      canExport: value?.attendees?.canExport ?? DEFAULT_ORGANIZER_PERMISSIONS.attendees?.canExport ?? true,
    },
    checkin: {
      canCheckIn: value?.checkin?.canCheckIn ?? DEFAULT_ORGANIZER_PERMISSIONS.checkin?.canCheckIn ?? true,
    },
    payments: {
      canVerify: value?.payments?.canVerify ?? DEFAULT_ORGANIZER_PERMISSIONS.payments?.canVerify ?? true,
    },
    certificates: {
      canManage: value?.certificates?.canManage ?? DEFAULT_ORGANIZER_PERMISSIONS.certificates?.canManage ?? true,
    },
    feedback: {
      canRead: value?.feedback?.canRead ?? DEFAULT_ORGANIZER_PERMISSIONS.feedback?.canRead ?? true,
    },
  }), [value]);

  // Determine active preset
  const activePreset: OrganizerPresetKey = useMemo(() => {
    const isMatch = (target: OrganizerPermissions) => {
      return (
        normalized.events.canCreate === (target.events?.canCreate ?? true) &&
        normalized.events.canUpdate === (target.events?.canUpdate ?? true) &&
        normalized.events.canDelete === (target.events?.canDelete ?? false) &&
        normalized.attendees.canRead === (target.attendees?.canRead ?? true) &&
        normalized.attendees.canUpdate === (target.attendees?.canUpdate ?? true) &&
        normalized.attendees.canDelete === (target.attendees?.canDelete ?? true) &&
        normalized.attendees.canExport === (target.attendees?.canExport ?? true) &&
        normalized.checkin.canCheckIn === (target.checkin?.canCheckIn ?? true) &&
        normalized.payments.canVerify === (target.payments?.canVerify ?? true) &&
        normalized.certificates.canManage === (target.certificates?.canManage ?? true) &&
        normalized.feedback.canRead === (target.feedback?.canRead ?? true)
      );
    };

    if (isMatch(ORGANIZER_PERMISSION_PRESETS.full.permissions)) return 'full';
    if (isMatch(ORGANIZER_PERMISSION_PRESETS.staff.permissions)) return 'staff';
    if (isMatch(ORGANIZER_PERMISSION_PRESETS.certificates.permissions)) return 'certificates';
    if (isMatch(ORGANIZER_PERMISSION_PRESETS.readonly.permissions)) return 'readonly';
    return 'custom';
  }, [normalized]);

  const handleApplyPreset = (presetKey: Exclude<OrganizerPresetKey, 'custom'>) => {
    const preset = ORGANIZER_PERMISSION_PRESETS[presetKey];
    if (preset) {
      onChange(preset.permissions);
    }
  };

  const updateDomain = <K extends keyof OrganizerPermissions>(
    domain: K,
    key: keyof NonNullable<OrganizerPermissions[K]>,
    val: boolean
  ) => {
    onChange({
      ...normalized,
      [domain]: {
        ...(normalized[domain] as any),
        [key]: val,
      },
    });
  };

  return (
    <div className="space-y-4 rounded-xl border border-outline-variant bg-surface-container-low/40 p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-outline-variant pb-3">
        <div className="flex items-center gap-2">
          <SparklesIcon className="h-5 w-5 text-primary" aria-hidden="true" />
          <span className="text-sm font-semibold text-on-surface">Organizer Permissions (Hybrid ABPAC)</span>
        </div>
        <span className="text-xs text-on-surface-variant font-medium">
          Preset: <span className="font-semibold text-primary capitalize">{activePreset}</span>
        </span>
      </div>

      {/* Preset Buttons */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2">
          Quick Presets
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(['full', 'staff', 'certificates', 'readonly'] as const).map((key) => {
            const preset = ORGANIZER_PERMISSION_PRESETS[key];
            const isSelected = activePreset === key;
            return (
              <button
                key={key}
                type="button"
                disabled={disabled}
                onClick={() => handleApplyPreset(key)}
                className={`flex flex-col items-start p-2.5 rounded-lg border text-left transition-colors duration-fast focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  isSelected
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-outline-variant bg-surface hover:bg-surface-container-low text-on-surface'
                }`}
              >
                <span className="text-xs font-semibold">{preset.label}</span>
                <span className="text-[10px] text-on-surface-variant line-clamp-1 mt-0.5">
                  {key === 'full' ? 'Full operations' : key === 'staff' ? 'Check-in only' : key === 'certificates' ? 'Certificates' : 'View only'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Domain Checkboxes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
        {/* Events Domain */}
        <div className="rounded-lg border border-outline-variant bg-surface p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-on-surface">
            <CalendarDaysIcon className="h-4 w-4 text-primary" aria-hidden="true" />
            <span>Events Management</span>
          </div>
          <div className="space-y-1.5 pl-6 text-xs">
            <label htmlFor={`${baseId}-events-create`} className="flex items-center gap-2 cursor-pointer min-h-[32px]">
              <input
                id={`${baseId}-events-create`}
                type="checkbox"
                checked={normalized.events.canCreate}
                disabled={disabled}
                onChange={(e) => updateDomain('events', 'canCreate', e.target.checked)}
                className="rounded border-outline text-primary focus:ring-primary h-4 w-4"
              />
              <span className="text-on-surface">Create new events</span>
            </label>
            <label htmlFor={`${baseId}-events-update`} className="flex items-center gap-2 cursor-pointer min-h-[32px]">
              <input
                id={`${baseId}-events-update`}
                type="checkbox"
                checked={normalized.events.canUpdate}
                disabled={disabled}
                onChange={(e) => updateDomain('events', 'canUpdate', e.target.checked)}
                className="rounded border-outline text-primary focus:ring-primary h-4 w-4"
              />
              <span className="text-on-surface">Edit details, forms & tickets</span>
            </label>
            <label htmlFor={`${baseId}-events-delete`} className="flex items-center gap-2 cursor-pointer min-h-[32px]">
              <input
                id={`${baseId}-events-delete`}
                type="checkbox"
                checked={normalized.events.canDelete}
                disabled={disabled}
                onChange={(e) => updateDomain('events', 'canDelete', e.target.checked)}
                className="rounded border-outline text-error focus:ring-error h-4 w-4"
              />
              <span className="text-on-surface font-medium text-error">Delete owned events</span>
            </label>
          </div>
        </div>

        {/* Attendees Domain */}
        <div className="rounded-lg border border-outline-variant bg-surface p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-on-surface">
            <UserGroupIcon className="h-4 w-4 text-primary" aria-hidden="true" />
            <span>Attendees & Registrations</span>
          </div>
          <div className="space-y-1.5 pl-6 text-xs">
            <label htmlFor={`${baseId}-att-read`} className="flex items-center gap-2 cursor-pointer min-h-[32px]">
              <input
                id={`${baseId}-att-read`}
                type="checkbox"
                checked={normalized.attendees.canRead}
                disabled={disabled}
                onChange={(e) => updateDomain('attendees', 'canRead', e.target.checked)}
                className="rounded border-outline text-primary focus:ring-primary h-4 w-4"
              />
              <span className="text-on-surface">View attendee registrations</span>
            </label>
            <label htmlFor={`${baseId}-att-update`} className="flex items-center gap-2 cursor-pointer min-h-[32px]">
              <input
                id={`${baseId}-att-update`}
                type="checkbox"
                checked={normalized.attendees.canUpdate}
                disabled={disabled}
                onChange={(e) => updateDomain('attendees', 'canUpdate', e.target.checked)}
                className="rounded border-outline text-primary focus:ring-primary h-4 w-4"
              />
              <span className="text-on-surface">Walk-in registration & edits</span>
            </label>
            <label htmlFor={`${baseId}-att-delete`} className="flex items-center gap-2 cursor-pointer min-h-[32px]">
              <input
                id={`${baseId}-att-delete`}
                type="checkbox"
                checked={normalized.attendees.canDelete}
                disabled={disabled}
                onChange={(e) => updateDomain('attendees', 'canDelete', e.target.checked)}
                className="rounded border-outline text-error focus:ring-error h-4 w-4"
              />
              <span className="text-on-surface font-medium text-error">Cancel / delete registration</span>
            </label>
            <label htmlFor={`${baseId}-att-export`} className="flex items-center gap-2 cursor-pointer min-h-[32px]">
              <input
                id={`${baseId}-att-export`}
                type="checkbox"
                checked={normalized.attendees.canExport}
                disabled={disabled}
                onChange={(e) => updateDomain('attendees', 'canExport', e.target.checked)}
                className="rounded border-outline text-primary focus:ring-primary h-4 w-4"
              />
              <span className="text-on-surface">Export CSV spreadsheet (PII)</span>
            </label>
          </div>
        </div>

        {/* Check-In & Payments Domain */}
        <div className="rounded-lg border border-outline-variant bg-surface p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-on-surface">
            <QrCodeIcon className="h-4 w-4 text-primary" aria-hidden="true" />
            <span>Onsite Check-In & Payments</span>
          </div>
          <div className="space-y-1.5 pl-6 text-xs">
            <label htmlFor={`${baseId}-checkin`} className="flex items-center gap-2 cursor-pointer min-h-[32px]">
              <input
                id={`${baseId}-checkin`}
                type="checkbox"
                checked={normalized.checkin.canCheckIn}
                disabled={disabled}
                onChange={(e) => updateDomain('checkin', 'canCheckIn', e.target.checked)}
                className="rounded border-outline text-primary focus:ring-primary h-4 w-4"
              />
              <span className="text-on-surface">QR scanner & manual check-in</span>
            </label>
            <label htmlFor={`${baseId}-pay-verify`} className="flex items-center gap-2 cursor-pointer min-h-[32px]">
              <input
                id={`${baseId}-pay-verify`}
                type="checkbox"
                checked={normalized.payments.canVerify}
                disabled={disabled}
                onChange={(e) => updateDomain('payments', 'canVerify', e.target.checked)}
                className="rounded border-outline text-primary focus:ring-primary h-4 w-4"
              />
              <span className="text-on-surface">Verify & reject payment proofs</span>
            </label>
          </div>
        </div>

        {/* Certificates & Feedback Domain */}
        <div className="rounded-lg border border-outline-variant bg-surface p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-on-surface">
            <AcademicCapIcon className="h-4 w-4 text-primary" aria-hidden="true" />
            <span>Certificates & Feedback</span>
          </div>
          <div className="space-y-1.5 pl-6 text-xs">
            <label htmlFor={`${baseId}-cert-manage`} className="flex items-center gap-2 cursor-pointer min-h-[32px]">
              <input
                id={`${baseId}-cert-manage`}
                type="checkbox"
                checked={normalized.certificates.canManage}
                disabled={disabled}
                onChange={(e) => updateDomain('certificates', 'canManage', e.target.checked)}
                className="rounded border-outline text-primary focus:ring-primary h-4 w-4"
              />
              <span className="text-on-surface">Design & issue certificates</span>
            </label>
            <label htmlFor={`${baseId}-fb-read`} className="flex items-center gap-2 cursor-pointer min-h-[32px]">
              <input
                id={`${baseId}-fb-read`}
                type="checkbox"
                checked={normalized.feedback.canRead}
                disabled={disabled}
                onChange={(e) => updateDomain('feedback', 'canRead', e.target.checked)}
                className="rounded border-outline text-primary focus:ring-primary h-4 w-4"
              />
              <span className="text-on-surface">View attendee survey feedback</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrganizerPermissionsEditor;
