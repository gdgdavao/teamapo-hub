import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  httpsCallableMock,
} = vi.hoisted(() => ({
  httpsCallableMock: vi.fn(),
}));

vi.mock('firebase/functions', () => ({
  httpsCallable: httpsCallableMock,
}));

vi.mock('../../src/config/firebase', () => ({
  functions: {},
  db: {},
}));

vi.mock('../../src/utils/logger', () => ({
  logger: {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

import { AuditLogService } from '../../src/services/auditLogService';

describe('AuditLogService Resilience & Sanitization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('falls back to camelCase recordAuditLog if record_audit_log returns not-found', async () => {
    const snakeCaseCall = vi.fn().mockRejectedValue({ code: 'not-found', message: 'Function not found' });
    const camelCaseCall = vi.fn().mockResolvedValue({ data: { success: true, logId: 'camel-log-1' } });

    httpsCallableMock.mockImplementation((_fns, name) => {
      if (name === 'record_audit_log') return snakeCaseCall;
      if (name === 'recordAuditLog') return camelCaseCall;
      return vi.fn();
    });

    const result = await AuditLogService.recordAuditLog({
      category: 'event_operations',
      action: 'event_created',
      target: { type: 'event', id: 'evt-1', label: 'DevFest' },
      details: { title: 'DevFest', extra: undefined },
    });

    expect(result.success).toBe(true);
    expect(result.logId).toBe('camel-log-1');
    expect(camelCaseCall).toHaveBeenCalledWith(expect.objectContaining({
      category: 'event_operations',
      action: 'event_created',
      details: { title: 'DevFest', extra: null },
    }));
  });

  it('falls back to camelCase getAuditLogs if get_audit_logs returns not-found', async () => {
    const snakeCaseCall = vi.fn().mockRejectedValue({ code: 'not-found', message: 'Function not found' });
    const camelCaseCall = vi.fn().mockResolvedValue({
      data: {
        success: true,
        logs: [
          {
            id: 'log-100',
            timestamp: '2026-10-17T00:00:00.000Z',
            category: 'financial',
            action: 'payment_approved',
          },
        ],
        hasMore: false,
      },
    });

    httpsCallableMock.mockImplementation((_fns, name) => {
      if (name === 'get_audit_logs') return snakeCaseCall;
      if (name === 'getAuditLogs') return camelCaseCall;
      return vi.fn();
    });

    const result = await AuditLogService.getAuditLogs({ limit: 10 });
    expect(result.logs).toHaveLength(1);
    expect(result.logs[0].id).toBe('log-100');
    expect(camelCaseCall).toHaveBeenCalled();
  });

  it('sanitizes undefined fields in details to null to uphold zero undefined invariant', async () => {
    const mockCall = vi.fn().mockResolvedValue({ data: { success: true, logId: 'log-clean' } });
    httpsCallableMock.mockReturnValue(mockCall);

    await AuditLogService.recordAuditLog({
      category: 'user_management',
      action: 'user_updated',
      details: {
        displayName: 'Test User',
        undefinedField: undefined,
        nullableField: null,
      },
    });

    expect(mockCall).toHaveBeenCalledWith(expect.objectContaining({
      details: {
        displayName: 'Test User',
        undefinedField: null,
        nullableField: null,
      },
    }));
  });
});
