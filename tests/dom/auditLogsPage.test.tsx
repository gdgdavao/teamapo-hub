import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AbilityProvider } from '@casl/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { defineAbilityFor } from '@/auth/ability';
import AuditLogsPage from '@/pages/audit/AuditLogsPage';
import { AuditLogService } from '@/services/auditLogService';
import { Timestamp } from 'firebase/firestore';
import type { AuditLog } from '@/types';

vi.mock('@/config/firebase', () => ({
  auth: { currentUser: null },
  db: {},
  storage: {},
  functions: {},
}));

vi.mock('@/services/auditLogService', () => ({
  AuditLogService: {
    getAuditLogs: vi.fn(),
    recordAuditLog: vi.fn(),
    exportToCSV: vi.fn(),
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    currentUser: { uid: 'superadmin', email: 'super@gdgdavao.org', displayName: 'Super Admin' },
    userProfile: { uid: 'superadmin', email: 'super@gdgdavao.org', role: 'admin', isActive: true },
    loading: false,
    logout: vi.fn(),
  }),
}));

const SUPER_ABILITY = defineAbilityFor({
  uid: 'superadmin',
  role: 'admin',
  isActive: true,
  isSuperUser: true,
});

const mockLogs: AuditLog[] = [
  {
    id: 'log-1',
    timestamp: Timestamp.fromDate(new Date('2026-10-13T01:00:00.000Z')),
    category: 'user_management',
    action: 'user_deleted',
    actor: { uid: 'superadmin', email: 'super@gdgdavao.org', name: 'Super Admin', role: 'admin' },
    target: { type: 'user', id: 'user-99', label: 'Old Organizer' },
    details: { reason: 'Account cleanup', authAccountRemoved: true },
    status: 'success',
    ipAddress: '127.0.0.1',
    userAgent: 'Mozilla/5.0 Test',
  },
  {
    id: 'log-2',
    timestamp: Timestamp.fromDate(new Date('2026-10-13T02:00:00.000Z')),
    category: 'event_operations',
    action: 'event_published',
    actor: { uid: 'org-1', email: 'organizer@gdgdavao.org', name: 'Lead Organizer', role: 'organizer' },
    target: { type: 'event', id: 'event-42', label: 'GDG DevFest 2026' },
    details: { eventTitle: 'GDG DevFest 2026' },
    status: 'success',
  },
];

describe('AuditLogsPage DOM Component Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(AuditLogService.getAuditLogs).mockResolvedValue({
      logs: mockLogs,
      hasMore: false,
    });
  });

  const renderPage = () => {
    return render(
      <MemoryRouter initialEntries={['/audit-logs']}>
        <AbilityProvider value={SUPER_ABILITY}>
          <AuditLogsPage />
        </AbilityProvider>
      </MemoryRouter>
    );
  };

  it('renders the header, badge, and metrics strip', async () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Audit Logs' })).toBeDefined();
    expect(screen.getByText('Platform Audit Trail')).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText('User Deleted')).toBeDefined();
      expect(screen.getByText('Event Published')).toBeDefined();
    });

    expect(screen.getByText('Old Organizer')).toBeDefined();
    expect(screen.getByText('GDG DevFest 2026')).toBeDefined();
  });

  it('filters table rows when search input changes', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('User Deleted')).toBeDefined();
    });

    const searchInput = screen.getByPlaceholderText('Search actor, action, target...');
    fireEvent.change(searchInput, { target: { value: 'DevFest' } });

    await waitFor(() => {
      expect(screen.queryByText('User Deleted')).toBeNull();
      expect(screen.getByText('Event Published')).toBeDefined();
    });
  });

  it('invokes exportToCSV when Export CSV button is clicked', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Export CSV')).toBeDefined();
    });

    const exportBtn = screen.getByText('Export CSV');
    fireEvent.click(exportBtn);

    expect(AuditLogService.exportToCSV).toHaveBeenCalledTimes(1);
    expect(vi.mocked(AuditLogService.exportToCSV).mock.calls[0][0]).toHaveLength(2);
  });

  it('opens and closes inspect modal when clicking Inspect button', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText('Inspect')).toHaveLength(2);
    });

    const inspectButtons = screen.getAllByText('Inspect');
    fireEvent.click(inspectButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Audit Event Inspection')).toBeDefined();
      expect(screen.getByText('Actor Information')).toBeDefined();
      expect(screen.getByText('Operation Payload & Details')).toBeDefined();
      expect(screen.getByText(/Account cleanup/)).toBeDefined();
    });

    const closeBtn = screen.getByText('Close');
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByText('Audit Event Inspection')).toBeNull();
    });
  });
});
