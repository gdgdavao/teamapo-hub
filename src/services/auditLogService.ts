import { httpsCallable } from 'firebase/functions';
import { Timestamp } from 'firebase/firestore';
import { functions } from '../config/firebase';
import { logger } from '../utils/logger';
import { escapeCSVCell, downloadCSV } from '../utils/csvExport';
import type { AuditLog, AuditLogFilterParams } from '../types';

export interface CreateAuditLogParams {
  category: AuditLog['category'];
  action: AuditLog['action'];
  target?: AuditLog['target'];
  details?: Record<string, any>;
  status?: 'success' | 'failure';
}

/**
 * Sanitizes nested details to prevent Firestore rejection from undefined values
 */
function sanitizeDetails(details?: Record<string, any>): Record<string, any> {
  if (!details) return {};
  const sanitized: Record<string, any> = {};
  for (const [key, val] of Object.entries(details)) {
    sanitized[key] = val === undefined ? null : val;
  }
  return sanitized;
}

export class AuditLogService {
  /**
   * Fetches audit logs from the secure Cloud Function endpoint.
   * Gated exclusively to the SuperUser tier on the server.
   */
  static async getAuditLogs(
    params: AuditLogFilterParams = {}
  ): Promise<{ logs: AuditLog[]; hasMore: boolean }> {
    try {
      const payload: Record<string, any> = {
        limit: params.limit ?? 100,
      };

      if (params.category && params.category !== 'all') {
        payload.category = params.category;
      }
      if (params.action && params.action !== 'all') {
        payload.action = params.action;
      }
      if (params.actorEmail) {
        payload.actorEmail = params.actorEmail.trim();
      }
      if (params.status && params.status !== 'all') {
        payload.status = params.status;
      }
      if (params.startAfterTimestamp) {
        payload.startAfterTimestamp = params.startAfterTimestamp;
      }

      let result: any;
      try {
        const getAuditLogsFn = httpsCallable<
          Record<string, any>,
          { success: boolean; logs: any[]; hasMore: boolean }
        >(functions, 'get_audit_logs');
        result = await getAuditLogsFn(payload);
      } catch (err: any) {
        if (err?.code === 'not-found' || err?.message?.includes('not found')) {
          const fallbackFn = httpsCallable<
            Record<string, any>,
            { success: boolean; logs: any[]; hasMore: boolean }
          >(functions, 'getAuditLogs');
          result = await fallbackFn(payload);
        } else {
          throw err;
        }
      }

      if (!result.data || !result.data.success) {
        throw new Error('Failed to retrieve audit logs from server');
      }

      const rawLogs = result.data.logs || [];
      const logs: AuditLog[] = rawLogs.map((log: any) => {
        let timestamp: Timestamp;
        if (log.timestamp && typeof log.timestamp === 'string') {
          const date = new Date(log.timestamp);
          timestamp = Timestamp.fromDate(isNaN(date.getTime()) ? new Date() : date);
        } else if (log.timestamp && typeof log.timestamp === 'object') {
          if ('seconds' in log.timestamp && 'nanoseconds' in log.timestamp) {
            timestamp = new Timestamp(log.timestamp.seconds, log.timestamp.nanoseconds);
          } else {
            timestamp = Timestamp.now();
          }
        } else {
          timestamp = Timestamp.now();
        }

        return {
          id: log.id,
          timestamp,
          category: log.category || 'system_security',
          action: log.action || 'system_config_changed',
          actor: log.actor || { uid: '', email: '', role: 'admin' },
          target: log.target || { type: 'system', id: '' },
          details: log.details || {},
          status: log.status || 'success',
          ipAddress: log.ipAddress || '',
          userAgent: log.userAgent || '',
        };
      });

      return {
        logs,
        hasMore: Boolean(result.data.hasMore),
      };
    } catch (error: any) {
      logger.error('Error fetching audit logs:', error);
      throw new Error(error?.message || 'Failed to fetch audit logs');
    }
  }

  /**
   * Records an administrative audit log entry through the backend callable.
   */
  static async recordAuditLog(
    params: CreateAuditLogParams
  ): Promise<{ success: boolean; logId?: string }> {
    try {
      const sanitizedPayload = {
        category: params.category,
        action: params.action,
        target: params.target
          ? {
              type: params.target.type,
              id: params.target.id ?? '',
              label: params.target.label ?? null,
            }
          : null,
        details: sanitizeDetails(params.details),
        status: params.status ?? 'success',
      };

      let result: any;
      try {
        const recordAuditLogFn = httpsCallable<
          typeof sanitizedPayload,
          { success: boolean; logId?: string }
        >(functions, 'record_audit_log');
        result = await recordAuditLogFn(sanitizedPayload);
      } catch (err: any) {
        if (err?.code === 'not-found' || err?.message?.includes('not found')) {
          const fallbackFn = httpsCallable<
            typeof sanitizedPayload,
            { success: boolean; logId?: string }
          >(functions, 'recordAuditLog');
          result = await fallbackFn(sanitizedPayload);
        } else {
          throw err;
        }
      }

      return {
        success: Boolean(result.data?.success),
        logId: result.data?.logId,
      };
    } catch (error: any) {
      logger.error('Error recording audit log:', error);
      return { success: false };
    }
  }

  /**
   * Generates and downloads a CSV export of the provided audit logs.
   */
  static exportToCSV(logs: AuditLog[], filenamePrefix: string = 'audit_logs'): void {
    const headers = [
      'Timestamp (UTC)',
      'Action',
      'Category',
      'Status',
      'Actor Name',
      'Actor Email',
      'Actor Role',
      'Target Type',
      'Target ID',
      'Target Label',
      'Details',
      'IP Address',
    ];

    const rows = logs.map((log) => {
      const dateStr = log.timestamp?.toDate
        ? log.timestamp.toDate().toISOString()
        : '';

      const detailsStr = log.details ? JSON.stringify(log.details) : '';

      return [
        escapeCSVCell(dateStr),
        escapeCSVCell(log.action),
        escapeCSVCell(log.category),
        escapeCSVCell(log.status),
        escapeCSVCell(log.actor?.name || ''),
        escapeCSVCell(log.actor?.email || ''),
        escapeCSVCell(log.actor?.role || ''),
        escapeCSVCell(log.target?.type || ''),
        escapeCSVCell(log.target?.id || ''),
        escapeCSVCell(log.target?.label || ''),
        escapeCSVCell(detailsStr),
        escapeCSVCell(log.ipAddress || ''),
      ].join(',');
    });

    const csvContent = [headers.map((h) => escapeCSVCell(h)).join(','), ...rows].join('\n');
    const timestampSuffix = new Date().toISOString().replace(/[:.]/g, '-');
    downloadCSV(csvContent, `${filenamePrefix}_${timestampSuffix}.csv`);
  }
}
