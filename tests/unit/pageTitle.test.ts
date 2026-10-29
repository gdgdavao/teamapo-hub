import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolvePageTitle } from '../../src/hooks/usePageTitle';

const ROOT = process.cwd();

function read(...segments: string[]): string {
  return readFileSync(join(ROOT, ...segments), 'utf8');
}

describe('Page Title Resolution & Route Coverage', () => {
  it('resolves contextual titles with title and contextTitle', () => {
    expect(resolvePageTitle('/events/evt-1/responses', {
      title: 'Responses',
      contextTitle: 'DevFest Davao 2026',
    })).toBe('Responses · DevFest Davao 2026 | TeamApo Hub');

    expect(resolvePageTitle('/events/edit/evt-1', {
      title: 'Edit Event',
      contextTitle: 'Cloud Study Jam',
    })).toBe('Edit Event · Cloud Study Jam | TeamApo Hub');

    expect(resolvePageTitle('/ticket', {
      title: 'Your Ticket',
      contextTitle: 'GDG I/O Extended',
    })).toBe('Your Ticket · GDG I/O Extended | TeamApo Hub');
  });

  it('resolves route-based titles when only pathname or contextTitle is provided', () => {
    expect(resolvePageTitle('/')).toBe('Home | TeamApo Hub');
    expect(resolvePageTitle('/events')).toBe('Events | TeamApo Hub');
    expect(resolvePageTitle('/events/create')).toBe('Create Event | TeamApo Hub');
    expect(resolvePageTitle('/events/evt-1/kiosk')).toBe('Check-In Kiosk | TeamApo Hub');
    expect(resolvePageTitle('/events/evt-1/responses', { contextTitle: 'DevFest' })).toBe(
      'Event Responses · DevFest | TeamApo Hub'
    );
    expect(resolvePageTitle('/users')).toBe('User Management | TeamApo Hub');
    expect(resolvePageTitle('/audit-logs')).toBe('Audit Logs | TeamApo Hub');
    expect(resolvePageTitle('/forbidden')).toBe('Access Restricted | TeamApo Hub');
    expect(resolvePageTitle('/__/auth/action')).toBe('Account Security | TeamApo Hub');
  });

  it('ensures every route Page component invokes usePageTitle', () => {
    const pagePaths = [
      ['src', 'pages', 'audit', 'AuditLogsPage.tsx'],
      ['src', 'pages', 'auth', 'AuthActionPage.tsx'],
      ['src', 'pages', 'auth', 'ForgotPasswordPage.tsx'],
      ['src', 'pages', 'auth', 'LoginPage.tsx'],
      ['src', 'pages', 'errors', 'ForbiddenPage.tsx'],
      ['src', 'pages', 'errors', 'NotFoundPage.tsx'],
      ['src', 'pages', 'events', 'EventEditorPage.tsx'],
      ['src', 'pages', 'events', 'EventListPage.tsx'],
      ['src', 'pages', 'events', 'kiosk', 'EventKioskPage.tsx'],
      ['src', 'pages', 'events', 'workspace', 'EventWorkspacePage.tsx'],
      ['src', 'pages', 'feedback', 'FeedbackPage.tsx'],
      ['src', 'pages', 'home', 'platform', 'PlatformHome.tsx'],
      ['src', 'pages', 'home', 'scoped', 'ScopedHome.tsx'],
      ['src', 'pages', 'legal', 'LegalPage.tsx'],
      ['src', 'pages', 'payment', 'PaymentPage.tsx'],
      ['src', 'pages', 'registration', 'RegistrationPage.tsx'],
      ['src', 'pages', 'ticket', 'TicketPage.tsx'],
      ['src', 'pages', 'users', 'UsersPage.tsx'],
      ['src', 'pages', 'verification', 'CertificateVerificationPage.tsx'],
    ];

    for (const segments of pagePaths) {
      const source = read(...segments);
      expect(source, `${segments.join('/')} is missing usePageTitle`).toContain('usePageTitle');
    }
  });
});
