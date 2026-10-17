import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ClipboardDocumentIcon,
  CheckIcon,
  ArrowTopRightOnSquareIcon,
  TrashIcon,
  UserCircleIcon,
  CalendarDaysIcon,
  FingerPrintIcon,
  ShieldExclamationIcon,
  AdjustmentsHorizontalIcon,
  ArrowDownTrayIcon,
  PencilSquareIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { Event, EventStatus } from '../../../../types';
import { EventService } from '../../../../services/eventService';
import { RegistrationService } from '../../../../services/registrationService';
import { useAuth } from '../../../../contexts/AuthContext';
import { logger } from '../../../../utils/logger';
import { generateAttendeesCSV, downloadCSV } from '../../../../utils/csvExport';
import { EmailService } from '../../../../services/emailService';
import { useAbility } from '@casl/react';
import { asEvent } from '../../../../auth/ability';
import { formatDate as formatUtilDate } from '../../../../utils/dateUtils';
import { ConfirmationModal } from '../../../../components/UI';
import { Button } from '../../../../components/UI';
import { Select } from '../../../../components/UI';

interface EventSettingsTabProps {
  event: Event;
  onEventUpdated: (updatedEvent: Event) => void;
}

interface DeleteModalState {
  isOpen: boolean;
  isLoading: boolean;
  message: string;
  confirmText: string;
  isForceDelete: boolean;
}

export const EventSettingsTab: React.FC<EventSettingsTabProps> = ({
  event,
  onEventUpdated,
}) => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const ability = useAbility();

  const canDelete = ability.can('delete', asEvent(event));
  const canExport = ability.can('export', 'Registration');
  const isFrozen = (event.status === 'completed' || event.status === 'cancelled') && !ability.can('read', 'all');

  // Status form state
  const [status, setStatus] = useState<EventStatus>(event.status || 'draft');
  const [registrationStatus, setRegistrationStatus] = useState<'open' | 'closed' | 'walk-in-only'>(
    event.registrationStatus || 'closed'
  );
  const [savingStatus, setSavingStatus] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingEmails, setIsExportingEmails] = useState(false);

  // Danger Zone delete modal state
  const [deleteModal, setDeleteModal] = useState<DeleteModalState>({
    isOpen: false,
    isLoading: false,
    message: `Are you sure you want to delete "${event.title}"? This action cannot be undone and will permanently remove the event and all associated records.`,
    confirmText: 'Delete Event',
    isForceDelete: false,
  });

  const isDirty = status !== event.status || registrationStatus !== (event.registrationStatus || 'closed');

  const handleSaveStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isDirty || savingStatus) return;

    try {
      setSavingStatus(true);
      if (status !== event.status) {
        await EventService.updateEventStatus(event.id, status);
      }
      if (registrationStatus !== event.registrationStatus) {
        await EventService.updateRegistrationStatus(event.id, registrationStatus);
      }

      const updated: Event = {
        ...event,
        status,
        isPublished: status === 'published',
        registrationStatus,
      };

      onEventUpdated(updated);
      toast.success('Event status updated successfully');
    } catch (error) {
      logger.error('[EventSettingsTab] Failed to update event status:', error);
      toast.error('Failed to update event status. Please try again.');
    } finally {
      setSavingStatus(false);
    }
  };

  const handleCopyLink = async () => {
    const publicUrl = `${window.location.origin}/e/${event.slug || event.id}`;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopiedLink(true);
      toast.success('Registration link copied to clipboard.');
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      toast.error('Failed to copy registration link. Please try again.');
    }
  };

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(event.id);
      setCopiedId(true);
      toast.success('Event ID copied to clipboard.');
      setTimeout(() => setCopiedId(false), 2000);
    } catch {
      toast.error('Failed to copy Event ID. Please try again.');
    }
  };

  const handleExportData = async () => {
    try {
      setIsExporting(true);
      const registrations = await RegistrationService.getEventRegistrations(event.id);
      if (!registrations || registrations.length === 0) {
        toast('No registrations found for this event.');
        return;
      }

      const csv = generateAttendeesCSV(
        registrations,
        event.registrationForm?.map((f) => ({ id: f.id, label: f.label })),
        event.ticketTypes?.map((tt) => ({ id: tt.id, name: tt.name }))
      );

      const safeTitle = (event.slug || event.title || 'event')
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '_');
      downloadCSV(csv, `${safeTitle}_attendees_export.csv`);
      toast.success('Attendee data exported successfully.');
    } catch (error) {
      logger.error('[EventSettingsTab] Failed to export attendee data:', error);
      toast.error('Failed to export attendee data. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportEmailLog = async () => {
    try {
      setIsExportingEmails(true);
      const emails = await EmailService.getEventEmailLog(event.id);
      if (emails.length === 0) {
        toast('No sent emails recorded for this event.');
        return;
      }
      const safeTitle = (event.slug || event.title || 'event')
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '_');
      downloadCSV(
        EmailService.exportEmailLogs(emails),
        `${safeTitle}_email_log.csv`
      );
      toast.success('Email log exported successfully.');
    } catch (error) {
      logger.error('[EventSettingsTab] Failed to export email log:', error);
      toast.error('Failed to export email log. Please try again.');
    } finally {
      setIsExportingEmails(false);
    }
  };

  const openDeleteModal = () => {
    setDeleteModal({
      isOpen: true,
      isLoading: false,
      message: `Are you sure you want to delete "${event.title}"? This action cannot be undone and will permanently remove the event and all associated records.`,
      confirmText: 'Delete Event',
      isForceDelete: false,
    });
  };

  const closeDeleteModal = () => {
    setDeleteModal((prev) => ({
      ...prev,
      isOpen: false,
      isLoading: false,
    }));
  };

  const handleDeleteEvent = async () => {
    setDeleteModal((prev) => ({ ...prev, isLoading: true }));

    try {
      if (currentUser) {
        try {
          await currentUser.getIdToken(true);
        } catch (tokenErr) {
          logger.error('[EventSettingsTab] Token refresh failed:', tokenErr);
          toast.error('Session expired. Please sign in again.');
          setDeleteModal((prev) => ({ ...prev, isLoading: false }));
          return;
        }
      }

      await EventService.deleteEvent(event.id, deleteModal.isForceDelete);
      toast.success('Event deleted successfully');
      closeDeleteModal();
      navigate('/events');
    } catch (error: any) {
      logger.error('[EventSettingsTab] Delete event failed:', error);

      if (!deleteModal.isForceDelete && error.message && error.message.includes('registrations')) {
        if (!ability.can('read', 'all')) {
          toast.error('This event has attendee registrations. Only platform administrators can force delete events with registered attendees.');
          setDeleteModal((prev) => ({ ...prev, isLoading: false, isOpen: false }));
          return;
        }
        setDeleteModal({
          isOpen: true,
          isLoading: false,
          message: `"${event.title}" has attendee registrations. Deleting it will permanently erase all registrations, payments, and check-in logs. Are you sure you want to force delete this event?`,
          confirmText: 'Delete Anyway',
          isForceDelete: true,
        });
      } else {
        toast.error('Failed to delete event. Please try again.');
        setDeleteModal((prev) => ({ ...prev, isLoading: false }));
      }
    }
  };

  const formatDate = (dateVal?: any) => {
    return formatUtilDate(dateVal, 'N/A', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const publicUrl = `${window.location.origin}/e/${event.slug || event.id}`;

  return (
    <div className="space-y-6">
      {/* 0. Event Configuration & Editor */}
      <div className="rounded-xl border border-outline-variant bg-white p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="space-y-1 max-w-2xl">
            <div className="flex items-center gap-2">
              <PencilSquareIcon className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-on-surface">Event Configuration</h2>
            </div>
            <p className="text-sm text-on-surface-variant">
              Manage core event details including schedule, venue, ticket tiers, speakers, and custom registration fields.
            </p>
          </div>
          <Link
            to={`/events/edit/${event.id}`}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition-[background-color,transform] duration-fast hover:bg-primary-hover active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 self-start sm:self-auto flex-shrink-0"
          >
            <PencilSquareIcon className="h-4 w-4" />
            <span>Edit Event</span>
          </Link>
        </div>

        {/* Quick Configuration Highlights */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-5 border-t border-outline-variant">
          <div className="p-3 rounded-lg bg-surface-container-low border border-outline-variant">
            <span className="text-xs text-on-surface-variant block">Format</span>
            <span className="text-sm font-semibold text-on-surface capitalize">
              {event.venue?.type || 'In-Person'}
            </span>
          </div>
          <div className="p-3 rounded-lg bg-surface-container-low border border-outline-variant">
            <span className="text-xs text-on-surface-variant block">Category</span>
            <span className="text-sm font-semibold text-on-surface capitalize">
              {event.category || 'General'}
            </span>
          </div>
          <div className="p-3 rounded-lg bg-surface-container-low border border-outline-variant">
            <span className="text-xs text-on-surface-variant block">Ticket Tiers</span>
            <span className="text-sm font-semibold text-on-surface">
              {event.ticketTypes?.length || 0} configured
            </span>
          </div>
          <div className="p-3 rounded-lg bg-surface-container-low border border-outline-variant">
            <span className="text-xs text-on-surface-variant block">Custom Fields</span>
            <span className="text-sm font-semibold text-on-surface">
              {event.registrationForm?.length || 0} questions
            </span>
          </div>
        </div>
      </div>

      {/* 1. Lifecycle & Registration Status */}
      <div className="rounded-xl border border-outline-variant bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <AdjustmentsHorizontalIcon className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-on-surface">Event Status & Registration</h2>
        </div>
        <p className="text-sm text-on-surface-variant mb-6">
          Manage the public lifecycle state and registration availability for this event.
        </p>

        {isFrozen && (
          <div className="mb-6 rounded-lg bg-surface-container-low border border-outline-variant p-3.5 text-xs text-on-surface-variant flex items-center gap-2.5">
            <ShieldExclamationIcon className="h-5 w-5 text-warning shrink-0" aria-hidden="true" />
            <span>This event is marked as <strong>{event.status}</strong>. In accordance with data integrity policies, completed and cancelled events are frozen against changes.</span>
          </div>
        )}

        <form onSubmit={handleSaveStatus} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="settingsEventStatus" className="block text-sm font-medium text-on-surface-variant mb-1.5">
                Event Status
              </label>
              <Select
                id="settingsEventStatus"
                value={status}
                onChange={(e) => setStatus(e.target.value as EventStatus)}
                size="md"
                disabled={isFrozen}
              >
                <option value="draft">Draft — Hidden from public</option>
                <option value="published">Published — Live for public browsing</option>
                <option value="ongoing">Ongoing — Event is currently underway</option>
                <option value="completed">Completed — Event concluded</option>
                <option value="cancelled">Cancelled — Event called off</option>
              </Select>
              <p className="mt-1.5 text-xs text-on-surface-variant">
                {status === 'draft' && 'Draft events are visible only to event organizers and administrators.'}
                {status === 'published' && 'Published events are accessible publicly and can receive registrations.'}
                {status === 'ongoing' && 'Ongoing events indicate activities are live right now.'}
                {status === 'completed' && 'Completed events allow attendee certificate delivery and feedback collection.'}
                {status === 'cancelled' && 'Cancelled events alert attendees that the event will not occur.'}
              </p>
            </div>

            <div>
              <label htmlFor="settingsRegistrationStatus" className="block text-sm font-medium text-on-surface-variant mb-1.5">
                Registration Status
              </label>
              <Select
                id="settingsRegistrationStatus"
                value={registrationStatus}
                onChange={(e) => setRegistrationStatus(e.target.value as 'open' | 'closed' | 'walk-in-only')}
                size="md"
                disabled={isFrozen}
              >
                <option value="open">Open — Accepting registrations</option>
                <option value="closed">Closed — Registration closed</option>
                <option value="walk-in-only">Walk-In Only — On-site walk-ins only</option>
              </Select>
              <p className="mt-1.5 text-xs text-on-surface-variant">
                {registrationStatus === 'open' && 'Public registration form is active and accepting submissions.'}
                {registrationStatus === 'closed' && 'New registrations are locked; event details remain visible.'}
                {registrationStatus === 'walk-in-only' && 'Online registration is paused; on-site walk-ins can be registered by organizers.'}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end pt-4 border-t border-outline-variant">
            <Button
              type="submit"
              variant="filled"
              disabled={!isDirty || savingStatus || isFrozen}
              loading={savingStatus}
              className="px-control-x"
            >
              Save Status Changes
            </Button>
          </div>
        </form>
      </div>

      {/* 2. Public Link & Access */}
      <div className="rounded-xl border border-outline-variant bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-on-surface mb-2">Public Registration URL</h2>
        <p className="text-sm text-on-surface-variant mb-4">
          Share this link with attendees to register or view public event details.
        </p>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex-1 bg-surface-container-low border border-outline-variant rounded-lg px-3.5 py-2.5 text-sm text-on-surface-variant font-mono truncate select-all">
            {publicUrl}
          </div>
          <button
            type="button"
            onClick={handleCopyLink}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg border border-outline-variant bg-white px-4 py-2 text-sm font-medium text-on-surface-variant transition-[background-color,border-color] duration-fast hover:bg-surface-container-low hover:border-outline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {copiedLink ? (
              <CheckIcon className="h-4 w-4 text-success" />
            ) : (
              <ClipboardDocumentIcon className="h-4 w-4 text-on-surface-variant" />
            )}
            <span>{copiedLink ? 'Copied' : 'Copy Link'}</span>
          </button>
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg border border-outline-variant bg-white px-4 py-2 text-sm font-medium text-on-surface-variant transition-[background-color,border-color] duration-fast hover:bg-surface-container-low hover:border-outline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ArrowTopRightOnSquareIcon className="h-4 w-4 text-on-surface-variant" />
            <span>Open Link</span>
          </a>
        </div>
      </div>

      {/* 3. Event Ownership & Metadata */}
      <div className="rounded-xl border border-outline-variant bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-on-surface mb-4">Event Ownership & Metadata</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="p-3.5 rounded-lg bg-surface-container-low border border-outline-variant">
            <div className="flex items-center gap-2 text-xs font-medium text-on-surface-variant mb-1">
              <UserCircleIcon className="h-4 w-4 text-outline-variant" />
              <span>Organizer</span>
            </div>
            <div className="text-sm font-semibold text-on-surface truncate">
              {event.organizer?.name || 'Unknown Organizer'}
            </div>
            <div className="text-xs text-on-surface-variant truncate mt-0.5">
              {event.organizer?.email || 'No email provided'}
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-surface-container-low border border-outline-variant">
            <div className="flex items-center gap-2 text-xs font-medium text-on-surface-variant mb-1">
              <CalendarDaysIcon className="h-4 w-4 text-outline-variant" />
              <span>Created & Updated</span>
            </div>
            <div className="text-xs text-on-surface">
              <span className="text-on-surface-variant">Created:</span> {formatDate(event.createdAt)}
            </div>
            <div className="text-xs text-on-surface mt-1">
              <span className="text-on-surface-variant">Updated:</span> {formatDate(event.updatedAt)}
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-surface-container-low border border-outline-variant">
            <div className="flex items-center gap-2 text-xs font-medium text-on-surface-variant mb-1">
              <FingerPrintIcon className="h-4 w-4 text-outline-variant" />
              <span>Event Document ID</span>
            </div>
            <div className="flex items-center justify-between gap-2 mt-0.5">
              <span className="text-xs font-mono text-on-surface truncate select-all">{event.id}</span>
              <button
                type="button"
                onClick={handleCopyId}
                className="text-xs text-primary hover:text-primary-hover font-medium flex-shrink-0"
              >
                {copiedId ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Data & Export */}
      <div className="rounded-xl border border-outline-variant bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <ArrowDownTrayIcon className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-on-surface">Data & Export</h2>
        </div>
        <p className="text-sm text-on-surface-variant mb-6">
          Download attendee registration records, contact details, ticket tiers, and payment statuses for this event as a CSV spreadsheet. The email log exports every message sent for this event, with its send outcome.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outlined"
            onClick={handleExportData}
            loading={isExporting}
            disabled={!canExport || isExporting}
            title={!canExport ? 'Export permission required' : undefined}
            className="inline-flex min-h-[44px] items-center gap-2"
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            <span>Export Attendees (CSV)</span>
          </Button>
          <Button
            type="button"
            variant="outlined"
            onClick={handleExportEmailLog}
            loading={isExportingEmails}
            disabled={!canExport || isExportingEmails}
            title={!canExport ? 'Export permission required' : undefined}
            className="inline-flex min-h-[44px] items-center gap-2"
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            <span>Export Email Log (CSV)</span>
          </Button>
        </div>
      </div>

      {/* 5. Danger Zone */}
      <div className="rounded-xl border border-outline-variant bg-error-container/40 p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-error-container text-error flex-shrink-0">
            <ShieldExclamationIcon className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-on-error-container">Danger Zone</h2>
            <p className="text-sm text-error mt-1">
              Permanently delete this event and all associated attendee registrations, check-in records, and payments. This action cannot be undone.
            </p>
            {canDelete ? (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={openDeleteModal}
                  className="inline-flex min-h-[48px] items-center gap-2 rounded-lg bg-error px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-error-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
                >
                  <TrashIcon className="h-4 w-4" />
                  Delete Event
                </button>
              </div>
            ) : (
              <p className="mt-3 text-xs font-medium text-on-error-container/80">
                You do not have permission to delete this event. Contact an administrator if removal is required.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteModal.isOpen}
        onClose={closeDeleteModal}
        onConfirm={handleDeleteEvent}
        title={deleteModal.isForceDelete ? 'Force Delete Event' : 'Delete Event'}
        message={deleteModal.message}
        confirmText={deleteModal.confirmText}
        cancelText="Cancel"
        type="danger"
        isLoading={deleteModal.isLoading}
      />
    </div>
  );
};

export default EventSettingsTab;
