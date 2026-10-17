import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { AuditLogService } from '../../src/services/auditLogService';
import type { AuditLog } from '../../src/types';

// Mock firebase/functions
vi.mock('firebase/functions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/functions')>();
  return {
    ...actual,
    httpsCallable: vi.fn(),
  };
});

// Mock logger
vi.mock('../../src/utils/logger', () => ({
  logger: {
    log: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock csvExport downloadCSV
vi.mock('../../src/utils/csvExport', async () => {
  const actual = await vi.importActual<typeof import('../../src/utils/csvExport')>(
    '../../src/utils/csvExport'
  );
  return {
    ...actual,
    downloadCSV: vi.fn(),
  };
});

import { httpsCallable } from 'firebase/functions';
import { downloadCSV } from '../../src/utils/csvExport';

describe('AuditLogService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAuditLogs', () => {
    it('fetches and maps audit logs properly with ISO timestamp strings', async () => {
      const mockCallable = vi.fn().mockResolvedValue({
        data: {
          success: true,
          logs: [
            {
              id: 'log-1',
              timestamp: '2026-10-13T01:00:00.000Z',
              category: 'user_management',
              action: 'user_deleted',
              actor: { uid: 'admin-1', email: 'admin@gdgdavao.org', role: 'admin' },
              target: { type: 'user', id: 'user-2', label: 'Jane Doe' },
              details: { deletedEmail: 'jane@example.com' },
              status: 'success',
              ipAddress: '127.0.0.1',
              userAgent: 'Vitest/Test',
            },
          ],
          hasMore: false,
        },
      });

      vi.mocked(httpsCallable).mockReturnValue(mockCallable);

      const result = await AuditLogService.getAuditLogs({
        category: 'user_management',
        limit: 50,
      });

      expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'get_audit_logs');
      expect(mockCallable).toHaveBeenCalledWith({
        category: 'user_management',
        limit: 50,
      });

      expect(result.logs).toHaveLength(1);
      expect(result.logs[0].id).toBe('log-1');
      expect(result.logs[0].action).toBe('user_deleted');
      expect(result.logs[0].timestamp).toBeInstanceOf(Timestamp);
      expect(result.hasMore).toBe(false);
    });

    it('filters out "all" placeholder parameter from backend query payload', async () => {
      const mockCallable = vi.fn().mockResolvedValue({
        data: {
          success: true,
          logs: [],
          hasMore: false,
        },
      });

      vi.mocked(httpsCallable).mockReturnValue(mockCallable);

      await AuditLogService.getAuditLogs({
        category: 'all',
        action: 'all',
        status: 'all',
        actorEmail: 'test@example.com',
      });

      expect(mockCallable).toHaveBeenCalledWith({
        limit: 100,
        actorEmail: 'test@example.com',
      });
    });

    it('throws descriptive error on failure', async () => {
      const mockCallable = vi.fn().mockRejectedValue(new Error('Permission denied'));
      vi.mocked(httpsCallable).mockReturnValue(mockCallable);

      await expect(AuditLogService.getAuditLogs()).rejects.toThrow('Permission denied');
    });
  });

  describe('recordAuditLog', () => {
    it('invokes recordAuditLog backend callable successfully', async () => {
      const mockCallable = vi.fn().mockResolvedValue({
        data: {
          success: true,
          logId: 'new-log-123',
        },
      });

      vi.mocked(httpsCallable).mockReturnValue(mockCallable);

      const result = await AuditLogService.recordAuditLog({
        category: 'system_security',
        action: 'system_config_changed',
        details: { key: 'maintenance_mode', value: true },
      });

      expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'record_audit_log');
      expect(result.success).toBe(true);
      expect(result.logId).toBe('new-log-123');
    });

    it('handles failure gracefully without throwing', async () => {
      const mockCallable = vi.fn().mockRejectedValue(new Error('Network error'));
      vi.mocked(httpsCallable).mockReturnValue(mockCallable);

      const result = await AuditLogService.recordAuditLog({
        category: 'system_security',
        action: 'system_config_changed',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('exportToCSV', () => {
    it('formats audit records into well-formed CSV and triggers download', () => {
      const sampleLogs: AuditLog[] = [
        {
          id: 'log-1',
          timestamp: Timestamp.fromDate(new Date('2026-10-13T01:00:00.000Z')),
          category: 'user_management',
          action: 'user_deleted',
          actor: { uid: 'admin-1', email: 'admin@gdgdavao.org', name: 'Super Admin', role: 'admin' },
          target: { type: 'user', id: 'user-2', label: 'Jane Doe' },
          details: { reason: 'Deactivated' },
          status: 'success',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
        },
      ];

      AuditLogService.exportToCSV(sampleLogs, 'test_export');

      expect(downloadCSV).toHaveBeenCalledTimes(1);
      const [csvContent, filename] = vi.mocked(downloadCSV).mock.calls[0];

      expect(filename).toContain('test_export_');
      expect(csvContent).toContain('"Timestamp (UTC)"');
      expect(csvContent).toContain('"user_deleted"');
      expect(csvContent).toContain('"user_management"');
      expect(csvContent).toContain('"Super Admin"');
      expect(csvContent).toContain('"admin@gdgdavao.org"');
      expect(csvContent).toContain('"Jane Doe"');
    });
  });
});
