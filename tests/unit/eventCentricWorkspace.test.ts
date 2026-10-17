import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

describe('Event-centric workspace navigation and routes', () => {
  const appPath = join(process.cwd(), 'src/App.tsx');
  const appSource = readFileSync(appPath, 'utf8');

  const navbarPath = join(process.cwd(), 'src/layout/AppNavbar.tsx');
  const navbarSource = readFileSync(navbarPath, 'utf8');

  const workspacePath = join(process.cwd(), 'src/pages/events/workspace/EventWorkspacePage.tsx');
  const workspaceSource = readFileSync(workspacePath, 'utf8');

  const legacyRedirectPath = join(process.cwd(), 'src/pages/events/workspace/LegacyRedirect.tsx');
  const legacyRedirectSource = readFileSync(legacyRedirectPath, 'utf8');

  it('declares event-centric hub routes in App.tsx', () => {
    expect(appSource).toContain('path="/events/:eventId"');
    expect(appSource).toContain('path="/events/:eventId/:tab"');
  });

  it('routes all legacy paths through LegacyRedirect in App.tsx', () => {
    const legacyPaths = [
      '/attendees',
      '/check-in',
      '/payments',
      '/emails',
      '/certificates',
      '/analytics',
    ];

    legacyPaths.forEach((path) => {
      expect(appSource).toContain(`path="${path}"`);
    });

    expect(appSource).toContain('<LegacyRedirect');
  });

  it('streamlines dashboard navbar to only event-centric root links', () => {
    // Should contain Dashboard, Events, and conditionally Users
    expect(navbarSource).toContain("name: 'Home'");
    expect(navbarSource).toContain("name: 'Events'");
    expect(navbarSource).toContain("name: 'Users'");

    // Must NOT contain general standalone links in the navbar item array
    const withoutComments = navbarSource
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '');

    expect(withoutComments).not.toMatch(/name:\s*'Attendees'/);
    expect(withoutComments).not.toMatch(/name:\s*'Check-In'/);
    expect(withoutComments).not.toMatch(/name:\s*'Payments'/);
    expect(withoutComments).not.toMatch(/name:\s*'Emails'/);
    expect(withoutComments).not.toMatch(/name:\s*'Certificates'/);
    expect(withoutComments).not.toMatch(/name:\s*'Analytics'/);
  });

  it('defines all required lifecycle tabs in EventWorkspacePage', () => {
    const expectedTabs = [
      'overview',
      'attendees',
      'check-in',
      'promo-codes',
      'certificates',
      'feedback',
      'settings',
    ];

    expectedTabs.forEach((tab) => {
      expect(workspaceSource).toContain(`'${tab}'`);
    });

    // Payments and Emails were retired; their slugs must still resolve rather
    // than fall through the TABS check and render Overview.
    expect(workspaceSource).toContain('REMOVED_TAB_REDIRECTS');
    expect(workspaceSource).toContain("payments: 'attendees'");
    expect(workspaceSource).toContain("emails: 'attendees'");
  });

  it('LegacyRedirect extracts eventId and redirects or warns user', () => {
    expect(legacyRedirectSource).toContain("searchParams.get('eventId')");
    expect(legacyRedirectSource).toContain('Navigate');
    expect(legacyRedirectSource).toContain('toast(');
    expect(legacyRedirectSource).toContain("to={`/events/${eventId}/${targetTab}`}");
    expect(legacyRedirectSource).toContain('to="/events"');
  });

  it('verifies /events page displays static status badges and no edit buttons or status dropdowns', () => {
    const manageEventsPath = join(process.cwd(), 'src/pages/events/EventListPage.tsx');
    const manageEventsSource = readFileSync(manageEventsPath, 'utf8');

    // No status cards at the top
    expect(manageEventsSource).not.toContain('statsData');
    expect(manageEventsSource).not.toContain('Total Events');
    expect(manageEventsSource).not.toContain('Total Attendees');

    // No edit button links on cards/table
    expect(manageEventsSource).not.toContain("to={`/events/edit/${event.id}`}");
    expect(manageEventsSource).not.toContain('title="Edit Event"');

    // No status dropdowns or handlers
    expect(manageEventsSource).not.toContain('handleStatusChange');
    expect(manageEventsSource).not.toContain('handleRegistrationStatusChange');
    expect(manageEventsSource).not.toContain('<select\n                        value={event.status}');

    // Status displayed as text badge pill
    expect(manageEventsSource).toContain('getStatusColor(event.status)');
    expect(manageEventsSource).toContain('<span className="capitalize">{event.status}</span>');

    // No organizer info block or column
    expect(manageEventsSource).not.toContain('event.organizer.name');
    expect(manageEventsSource).not.toContain('event.organizer.email');
    expect(manageEventsSource).not.toContain('<th>Organizer</th>');

    // No delete button or delete modal
    expect(manageEventsSource).not.toContain('TrashIcon');
    expect(manageEventsSource).not.toContain('openDeleteModal');
    expect(manageEventsSource).not.toContain('handleDeleteEvent');
    expect(manageEventsSource).not.toContain('<ConfirmationModal');
  });

  it('verifies event settings in EventEditorPage supports registration status and workflow-driven event status', () => {
    const createEventPath = join(process.cwd(), 'src/pages/events/EventEditorPage.tsx');
    const createEventSource = readFileSync(createEventPath, 'utf8');

    // Form data includes status
    expect(createEventSource).toContain("status?: EventStatus");
    // Redundant contradictory eventStatus dropdown in Basic Info was removed
    expect(createEventSource).not.toContain("id=\"eventStatus\"");
    expect(createEventSource).toContain("id=\"registrationStatus\"");
  });

  it('verifies Edit Event action is in SettingsTab and settings tab renders EventSettingsTab', () => {
    // Top actions no longer contain Edit Event (moved to Settings tab)
    expect(workspaceSource).not.toContain("to={`/events/edit/${eventId}`}");
    expect(workspaceSource).not.toContain('>Edit Event</');
    expect(workspaceSource).toContain('<SettingsTab');
    // The editor is a sibling route now, not something the workspace renders.
    expect(workspaceSource).not.toContain('<EventEditorPage');

    const settingsTabPath = join(process.cwd(), 'src/pages/events/workspace/tabs/SettingsTab.tsx');
    const settingsTabSource = readFileSync(settingsTabPath, 'utf8');

    // Dedicated Edit Event action in Settings
    expect(settingsTabSource).toContain("to={`/events/edit/${event.id}`}");
    expect(settingsTabSource).toContain('Edit Event');

    // Status management
    expect(settingsTabSource).toContain('id="settingsEventStatus"');
    expect(settingsTabSource).toContain('id="settingsRegistrationStatus"');
    expect(settingsTabSource).toContain('EventService.updateEventStatus');
    expect(settingsTabSource).toContain('EventService.updateRegistrationStatus');

    // Danger Zone and delete
    expect(settingsTabSource).toContain('Danger Zone');
    expect(settingsTabSource).toContain('EventService.deleteEvent');
    expect(settingsTabSource).toContain('<ConfirmationModal');
  });

  it('verifies seamless back and cancel navigation between edit event and event workspace', () => {
    const createEventPath = join(process.cwd(), 'src/pages/events/EventEditorPage.tsx');
    const createEventSource = readFileSync(createEventPath, 'utf8');

    // Layout wrapping with the single AppShell and AppNavbar.
    // AdminLayout/OrganizerLayout were identical one-line re-exports of it.
    expect(createEventSource).toContain('<AppShell');
    expect(createEventSource).toContain("aria-label=\"Breadcrumb\"");

    // Top action buttons for edit event
    expect(createEventSource).toContain('Back to Event Details');
    expect(createEventSource).toContain('Back to Events');
    expect(createEventSource).toContain('to={`/events/${targetEventId}`}');
    expect(createEventSource).toContain('to="/events"');

    // Breadcrumb navigation links
    expect(createEventSource).toContain('to={`/events/${targetEventId}`}');
    expect(createEventSource).toContain('to="/events"');

    // Submit redirection to event workspace
    expect(createEventSource).toContain('navigate(`/events/${resolvedEventId}`)');

    // EventWorkspacePage back navigation
    expect(workspaceSource).toContain('title="Back to All Events"');
    expect(workspaceSource).toContain('Back to Events');
    expect(workspaceSource).toContain('to="/events"');
  });

  it('verifies removal of status card grids and seamless metric integration across all workspace tabs', () => {
    // 1. Overview tab (AdminAnalyticsPage)
    const analyticsPath = join(process.cwd(), 'src/pages/events/workspace/tabs/OverviewTab.tsx');
    const analyticsSource = readFileSync(analyticsPath, 'utf8');
    expect(analyticsSource).not.toContain('{/* Key Metrics */}');
    expect(analyticsSource).not.toContain('<h2 className="text-xl font-semibold text-gray-900">Event Health Overview</h2>');
    expect(analyticsSource).toContain('Event Health & Performance');
    expect(analyticsSource).toContain('Live attendee velocity, capacity utilization, and revenue performance.');
    expect(analyticsSource).toContain('aria-label="Event Details"');
    expect(analyticsSource).toContain('Ticket Pricing');
    expect(analyticsSource).toContain('Featured Speakers');
    expect(analyticsSource).not.toContain('<span>Public Page</span>');

    // 2. Attendees tab (AdminAttendeesPage)
    const attendeesPath = join(process.cwd(), 'src/pages/events/workspace/tabs/AttendeesTab.tsx');
    const attendeesSource = readFileSync(attendeesPath, 'utf8');
    expect(attendeesSource).not.toContain('lg:grid-cols-6');
    expect(attendeesSource).toContain('aria-label="Filter attendees by status"');
    expect(attendeesSource).toContain('statusCounts[opt.value]');

    // 3. Check-In tab (AdminCheckInPage)
    const checkInPath = join(process.cwd(), 'src/pages/events/workspace/tabs/CheckInTab.tsx');
    const checkInSource = readFileSync(checkInPath, 'utf8');
    expect(checkInSource).not.toContain('{/* Quick Stats */}');
    expect(checkInSource).toContain('Scan attendee QR badges or search below to check attendees in.');
    expect(checkInSource).toContain('checkedIn.length');

    // 4. Payment verification and revenue now live in the Attendees tab, since the
    // Payments tab was retired. An unresolved payment proof has no DisplayStatus
    // (resolveDisplayStatus returns 'approved' once the registration itself is
    // approved), so it needs its own orthogonal filter to be findable at all.
    const attendeesPaymentSource = readFileSync(attendeesPath, 'utf8');
    expect(attendeesPaymentSource).toContain('Verified Revenue:');
    expect(attendeesPaymentSource).toContain('Awaiting verification');
    expect(attendeesPaymentSource).toContain('awaitingVerificationOnly');
    expect(attendeesPaymentSource).toContain("r.paymentStatus === 'paid'");

    expect(attendeesPaymentSource).toContain(
      'verifyPaymentProof(proofId, action, verifierUid, verifierName)'
    );

    // The attendee's note on a payment proof belongs to them, not to the
    // verifier. verifyPaymentProof used to overwrite it with `notes || ''` on
    // every call, destroying whatever PaymentPage's "Additional Notes" held.
    const paymentServiceSource = readFileSync(
      join(process.cwd(), 'src/services/paymentService.ts'),
      'utf8'
    );
    const verifyProof = paymentServiceSource.slice(
      paymentServiceSource.indexOf('static async verifyPaymentProof'),
      paymentServiceSource.indexOf('static async getPaymentProofById')
    );
    expect(verifyProof).not.toContain('notes');

    // 5. Email history is per-attendee in the details modal; the event-wide
    // log is a CSV export in Settings. Both read activity_logs, which requires
    // constraining eventId: that is the field firestore.rules branches on, and
    // a query that leaves it unconstrained is rejected outright.
    const modalSource = readFileSync(
      join(process.cwd(), 'src/pages/events/workspace/tabs/RegistrationDetailsModal.tsx'),
      'utf8'
    );
    expect(modalSource).toContain('EmailService.getAttendeeEmails');
    expect(modalSource).toContain('EmailService.resendEmail');

    // Accept/Reject/Delete replace four status-gated buttons. The old gating
    // made a pending registration approve-or-delete only: "Reject Registration"
    // required status !== 'pending' while "Approve Registration & Payment"
    // required status === 'pending', so the two could never both be offered.
    expect(modalSource).toContain('handleAccept');
    expect(modalSource).toContain('handleReject');
    expect(modalSource).not.toContain('Approve Registration');
    expect(modalSource).not.toContain('Approve Payment');
    expect(modalSource).not.toContain('Reject Payment');
    expect(modalSource).not.toContain('Reject Registration');
    expect(modalSource).not.toContain('Verification notes');

    // Payment state is derived once and rendered twice, so the hero pill and the
    // Payment Verification card can no longer disagree.
    expect(modalSource).toContain('derivePaymentView');
    expect(modalSource).not.toContain('getPaymentBadgeTone');

    const emailServiceSource = readFileSync(
      join(process.cwd(), 'src/services/emailService.ts'),
      'utf8'
    );
    const attendeeEmails = emailServiceSource.slice(
      emailServiceSource.indexOf('static async getAttendeeEmails')
    );
    expect(attendeeEmails).toContain("where('eventId', '==', eventId)");
    expect(attendeeEmails).toContain("where('userEmail', '==', userEmail)");

    const settingsSource = readFileSync(
      join(process.cwd(), 'src/pages/events/workspace/tabs/SettingsTab.tsx'),
      'utf8'
    );
    expect(settingsSource).toContain('EmailService.getEventEmailLog');
    expect(settingsSource).toContain('Export Email Log (CSV)');

    // The retired tabs must not linger in the tree.
    expect(existsSync(join(process.cwd(), 'src/pages/events/workspace/tabs/PaymentsTab.tsx'))).toBe(false);
    expect(existsSync(join(process.cwd(), 'src/pages/events/workspace/tabs/EmailsTab.tsx'))).toBe(false);
  });

  it('verifies single back button and clean breadcrumb in EventWorkspacePage', () => {
    // Top actions button preserved
    expect(workspaceSource).toContain('title="Back to All Events"');
    expect(workspaceSource).toContain('Back to Events');

    // Breadcrumb strip uses semantic nav without duplicate square icon back button
    expect(workspaceSource).toContain('<nav aria-label="Breadcrumb"');
    expect(workspaceSource).not.toContain('aria-label="Back to All Events"');
  });

  it('verifies workspace top navigation includes Preview Page and excludes Copy Link and Public Page', () => {
    // Top actions button includes Preview Page pointing to /preview
    expect(workspaceSource).toContain('to={`/events/${eventId}/preview`}');
    expect(workspaceSource).toContain('Preview Page');
    expect(workspaceSource).toContain('title="Preview Event Registration Page"');

    // Redundant Copy Link and Public Page are removed from header actions
    expect(workspaceSource).not.toContain('title="Copy Public Registration Link"');
    expect(workspaceSource).not.toContain('handleCopyRegistrationLink');
    expect(workspaceSource).not.toContain('title="Open Public Event Registration Page"');
    expect(workspaceSource).not.toContain('Public Page');
  });

  it('verifies AttendeesTab search/filter toolbar layout and clean counts', () => {
    const attendeesPath = join(process.cwd(), 'src/pages/events/workspace/tabs/AttendeesTab.tsx');
    const attendeesSource = readFileSync(attendeesPath, 'utf8');

    // Event selector removed from attendees tab
    expect(attendeesSource).not.toContain('setEventFilter');
    expect(attendeesSource).not.toContain('<option value="all">All Events</option>');
    expect(attendeesSource).not.toContain('📅 {currentEvent.title}');

    // Repetitive verbose seat and attendee count strings removed
    expect(attendeesSource).not.toContain('Seats: {filteredStats.totals.seats}');
    expect(attendeesSource).not.toContain('Showing {filteredStats.totals.registrations} of {overallStats.registrations} attendees');

    // Integrated status buttons and toolbar controls present
    expect(attendeesSource).toContain('aria-label="Filter attendees by status"');
    expect(attendeesSource).toContain('STATUS_FILTER_OPTIONS.map');
    expect(attendeesSource).toContain('aria-label="Search attendees"');
    expect(attendeesSource).toContain('aria-label="Filter by ticket type"');
    expect(attendeesSource).toContain('aria-label="Filter by price range"');
    expect(attendeesSource).toContain('aria-label="Filter by registration type"');
    // Export button moved from AttendeesTab to SettingsTab
    expect(attendeesSource).not.toContain('Export Data');
    expect(attendeesSource).not.toContain('exportToCSV');
  });

  it('verifies CertificatesTab hides All Events selectors when eventId is provided', () => {
    const certPath = join(process.cwd(), 'src/pages/events/workspace/tabs/CertificatesTab.tsx');
    const certSource = readFileSync(certPath, 'utf8');

    // Event selector is guarded so it does not show inside event workspace
    expect(certSource).toContain('{!eventId && (');
    expect(certSource).toContain('aria-label="Filter templates by event"');
    expect(certSource).toContain('aria-label="Filter issued certificates by event"');
  });

  it('verifies SettingsTab includes Data & Export section with CSV export', () => {
    const settingsPath = join(process.cwd(), 'src/pages/events/workspace/tabs/SettingsTab.tsx');
    const settingsSource = readFileSync(settingsPath, 'utf8');

    expect(settingsSource).toContain('Data & Export');
    expect(settingsSource).toContain('Export Attendees (CSV)');
    expect(settingsSource).toContain('handleExportData');
    expect(settingsSource).toContain('generateAttendeesCSV');
  });

  it('verifies RegistrationPage displays explicit preview banners in preview mode', () => {
    const registrationPath = join(process.cwd(), 'src/pages/registration/RegistrationPage.tsx');
    const registrationSource = readFileSync(registrationPath, 'utf8');

    // Sticky preview header and in-page callout banner explicitly declare preview status
    expect(registrationSource).toContain('This is a preview page only');
    expect(registrationSource).toContain('aria-label="Preview mode banner"');
    expect(registrationSource).toContain('Preview Mode');
    expect(registrationSource).toContain('All registrations, ticket selections, and form submissions in preview mode are simulated');
  });
});

