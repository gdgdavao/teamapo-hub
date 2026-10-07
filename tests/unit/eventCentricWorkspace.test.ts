import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Event-centric workspace navigation and routes', () => {
  const appPath = join(process.cwd(), 'src/App.tsx');
  const appSource = readFileSync(appPath, 'utf8');

  const navbarPath = join(process.cwd(), 'src/components/shared/DashboardNavbar.tsx');
  const navbarSource = readFileSync(navbarPath, 'utf8');

  const workspacePath = join(process.cwd(), 'src/pages/admin/EventWorkspacePage.tsx');
  const workspaceSource = readFileSync(workspacePath, 'utf8');

  const legacyRedirectPath = join(process.cwd(), 'src/pages/admin/LegacyRedirect.tsx');
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
    expect(navbarSource).toContain("name: 'Dashboard'");
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
      'payments',
      'emails',
      'certificates',
      'feedback',
      'settings',
    ];

    expectedTabs.forEach((tab) => {
      expect(workspaceSource).toContain(`'${tab}'`);
    });
  });

  it('LegacyRedirect extracts eventId and redirects or warns user', () => {
    expect(legacyRedirectSource).toContain("searchParams.get('eventId')");
    expect(legacyRedirectSource).toContain('Navigate');
    expect(legacyRedirectSource).toContain('toast(');
    expect(legacyRedirectSource).toContain("to={`/events/${eventId}/${targetTab}`}");
    expect(legacyRedirectSource).toContain('to="/events"');
  });

  it('verifies /events page displays static status badges and no edit buttons or status dropdowns', () => {
    const manageEventsPath = join(process.cwd(), 'src/pages/admin/AdminManageEventsPage.tsx');
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

  it('verifies event settings in AdminCreateEventPage supports both event status and registration status', () => {
    const createEventPath = join(process.cwd(), 'src/pages/admin/AdminCreateEventPage.tsx');
    const createEventSource = readFileSync(createEventPath, 'utf8');

    // Form data and UI includes status
    expect(createEventSource).toContain("status?: EventStatus");
    expect(createEventSource).toContain("id=\"eventStatus\"");
    expect(createEventSource).toContain("id=\"registrationStatus\"");
    expect(createEventSource).toContain("EventService.updateEventStatus");
  });

  it('verifies EventWorkspacePage top action links to dedicated editor and settings tab renders EventSettingsTab', () => {
    expect(workspaceSource).toContain("to={`/events/edit/${eventId}`}");
    expect(workspaceSource).toContain('Edit Event');
    expect(workspaceSource).toContain('<EventSettingsTab');
    expect(workspaceSource).not.toContain('<CreateEventPage embedded={true}');

    const settingsTabPath = join(process.cwd(), 'src/components/admin/EventSettingsTab.tsx');
    const settingsTabSource = readFileSync(settingsTabPath, 'utf8');

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
    const createEventPath = join(process.cwd(), 'src/pages/admin/AdminCreateEventPage.tsx');
    const createEventSource = readFileSync(createEventPath, 'utf8');

    // Layout wrapping with the single DashboardShell and DashboardNavbar.
    // AdminLayout/OrganizerLayout were identical one-line re-exports of it.
    expect(createEventSource).toContain('<DashboardShell');
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
    const analyticsPath = join(process.cwd(), 'src/pages/admin/AdminAnalyticsPage.tsx');
    const analyticsSource = readFileSync(analyticsPath, 'utf8');
    expect(analyticsSource).not.toContain('{/* Key Metrics */}');
    expect(analyticsSource).not.toContain('<h2 className="text-xl font-semibold text-gray-900">Event Health Overview</h2>');
    expect(analyticsSource).toContain('Event Health & Performance');
    expect(analyticsSource).toContain('Live attendee velocity, capacity utilization, and revenue performance.');

    // 2. Attendees tab (AdminAttendeesPage)
    const attendeesPath = join(process.cwd(), 'src/pages/admin/AdminAttendeesPage.tsx');
    const attendeesSource = readFileSync(attendeesPath, 'utf8');
    expect(attendeesSource).not.toContain('lg:grid-cols-6');
    expect(attendeesSource).toContain('aria-label="Filter attendees by status"');
    expect(attendeesSource).toContain('statusCounts[opt.value]');

    // 3. Check-In tab (AdminCheckInPage)
    const checkInPath = join(process.cwd(), 'src/pages/admin/AdminCheckInPage.tsx');
    const checkInSource = readFileSync(checkInPath, 'utf8');
    expect(checkInSource).not.toContain('{/* Quick Stats */}');
    expect(checkInSource).toContain('Scan attendee QR badges or search below to check attendees in.');
    expect(checkInSource).toContain('checkedIn.length');

    // 4. Payments tab (AdminPaymentVerificationPage)
    const paymentsPath = join(process.cwd(), 'src/pages/admin/AdminPaymentVerificationPage.tsx');
    const paymentsSource = readFileSync(paymentsPath, 'utf8');
    expect(paymentsSource).not.toContain('{/* Stats */}');
    expect(paymentsSource).not.toContain('md:grid-cols-4 gap-4 mb-8');
    expect(paymentsSource).toContain('Verified Revenue:');

    // 5. Emails tab (AdminEmailManagementPage)
    const emailsPath = join(process.cwd(), 'src/pages/admin/AdminEmailManagementPage.tsx');
    const emailsSource = readFileSync(emailsPath, 'utf8');
    expect(emailsSource).not.toContain('md:grid-cols-5 gap-6 mb-8');
    expect(emailsSource).toContain('Delivery Health:');
  });
});
