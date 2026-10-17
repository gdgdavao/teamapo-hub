import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ShieldCheckIcon,
  ArrowPathIcon,
  ArrowDownTrayIcon,
  MagnifyingGlassIcon,
  EyeIcon,
  ClipboardDocumentCheckIcon,
  UserIcon,
  CalendarDaysIcon,
  CurrencyDollarIcon,
  ComputerDesktopIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import AppShell from '../../layout/AppShell';
import {
  Button,
  Input,
  Select,
  Badge,
  Modal,
  EmptyState,
  LoadingSpinner,
  type BadgeTone
} from '../../components/UI';
import { AuditLogService } from '../../services/auditLogService';
import type {
  AuditLog,
  AuditLogCategory,
  AuditLogAction,
} from '../../types';
import { logger } from '../../utils/logger';

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'All Categories' },
  { value: 'user_management', label: 'User Management' },
  { value: 'event_operations', label: 'Event Operations' },
  { value: 'financial', label: 'Financial' },
  { value: 'system_security', label: 'Security & System' },
  { value: 'communications', label: 'Communications' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'success', label: 'Success Only' },
  { value: 'failure', label: 'Failure Only' },
];

const DATE_RANGE_OPTIONS = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
];

const formatActionName = (action: string): string => {
  return action
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const getCategoryBadgeTone = (category: AuditLogCategory): BadgeTone => {
  switch (category) {
    case 'user_management':
      return 'info';
    case 'event_operations':
      return 'neutral';
    case 'financial':
      return 'success';
    case 'system_security':
      return 'warning';
    case 'communications':
      return 'neutral';
    default:
      return 'neutral';
  }
};

const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('all');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [copiedPayload, setCopiedPayload] = useState(false);

  const fetchLogs = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const result = await AuditLogService.getAuditLogs({
        limit: 200,
      });

      setLogs(result.logs);
      if (isRefresh) {
        toast.success('Audit logs refreshed');
      }
    } catch (error: any) {
      logger.error('Failed to load audit logs:', error);
      toast.error('Unable to fetch audit logs. Please verify connection and try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const filteredLogs = useMemo(() => {
    const searchLower = searchTerm.trim().toLowerCase();
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now.getTime() - 30 * 24 * 60 * 60 * 1000;

    return logs.filter((log) => {
      // Category filter
      if (categoryFilter !== 'all' && log.category !== categoryFilter) {
        return false;
      }

      // Status filter
      if (statusFilter !== 'all' && log.status !== statusFilter) {
        return false;
      }

      // Date range filter
      if (log.timestamp) {
        const logMillis = log.timestamp.toMillis ? log.timestamp.toMillis() : 0;
        if (dateRange === 'today' && logMillis < startOfToday) {
          return false;
        }
        if (dateRange === '7d' && logMillis < sevenDaysAgo) {
          return false;
        }
        if (dateRange === '30d' && logMillis < thirtyDaysAgo) {
          return false;
        }
      }

      // Search term filter
      if (searchLower) {
        const actorName = log.actor?.name?.toLowerCase() || '';
        const actorEmail = log.actor?.email?.toLowerCase() || '';
        const actionStr = log.action?.toLowerCase() || '';
        const targetLabel = log.target?.label?.toLowerCase() || '';
        const targetId = log.target?.id?.toLowerCase() || '';
        const detailsStr = log.details ? JSON.stringify(log.details).toLowerCase() : '';

        const matches =
          actorName.includes(searchLower) ||
          actorEmail.includes(searchLower) ||
          actionStr.includes(searchLower) ||
          targetLabel.includes(searchLower) ||
          targetId.includes(searchLower) ||
          detailsStr.includes(searchLower);

        if (!matches) return false;
      }

      return true;
    });
  }, [logs, categoryFilter, statusFilter, dateRange, searchTerm]);

  // Metric counts
  const stats = useMemo(() => {
    let userOps = 0;
    let eventOps = 0;
    let financialOps = 0;
    let securityOps = 0;

    logs.forEach((log) => {
      if (log.category === 'user_management') userOps++;
      else if (log.category === 'event_operations') eventOps++;
      else if (log.category === 'financial') financialOps++;
      else if (log.category === 'system_security') securityOps++;
    });

    return {
      total: logs.length,
      userOps,
      eventOps,
      financialOps,
      securityOps,
    };
  }, [logs]);

  const handleExport = () => {
    if (filteredLogs.length === 0) {
      toast('No audit records available to export.');
      return;
    }
    AuditLogService.exportToCSV(filteredLogs, 'audit_logs');
    toast.success(`Exported ${filteredLogs.length} audit records to CSV`);
  };

  const handleCopyDetails = (details: Record<string, any> | undefined) => {
    if (!details) return;
    const jsonStr = JSON.stringify(details, null, 2);
    navigator.clipboard.writeText(jsonStr);
    setCopiedPayload(true);
    toast.success('Event details copied to clipboard');
    setTimeout(() => setCopiedPayload(false), 2000);
  };

  const formatTimestamp = (log: AuditLog): { local: string; utc: string } => {
    if (!log.timestamp?.toDate) {
      return { local: 'N/A', utc: 'N/A' };
    }
    const date = log.timestamp.toDate();
    return {
      local: date.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      utc: date.toISOString(),
    };
  };

  return (
    <AppShell
      title="Audit Logs"
      subtitle="Immutable security and operational event trail. Accessible strictly by administrators."
      fullWidth={true}
      actions={
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <Badge tone="info">Platform Audit Trail</Badge>
          <Button
            variant="outlined"
            size="sm"
            onClick={() => fetchLogs(true)}
            loading={refreshing}
            aria-label="Refresh audit logs"
          >
            <ArrowPathIcon className="h-4 w-4 mr-1.5" aria-hidden="true" />
            Refresh
          </Button>
          <Button
            variant="tonal"
            size="sm"
            onClick={handleExport}
            disabled={filteredLogs.length === 0}
            aria-label="Export audit logs as CSV"
          >
            <ArrowDownTrayIcon className="h-4 w-4 mr-1.5" aria-hidden="true" />
            Export CSV
          </Button>
        </div>
      }
    >
      <div className="space-y-4 pb-12">
        {/* Metric Ribbon (Single Hairline Instrument) */}
        <div
          role="region"
          aria-label="Audit summary metrics"
          className="grid grid-cols-2 md:grid-cols-4 bg-surface-container-lowest border border-outline-variant rounded-xl divide-y md:divide-y-0 divide-x-0 md:divide-x divide-outline-variant overflow-hidden"
        >
          <div className="p-3 sm:px-5 sm:py-3.5 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-surface-container-high flex items-center justify-center text-on-surface flex-shrink-0">
              <ShieldCheckIcon className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-on-surface-variant truncate">Total Events</p>
              <p className="text-xl font-bold tabular-nums text-on-surface">{stats.total}</p>
            </div>
          </div>

          <div className="p-3 sm:px-5 sm:py-3.5 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary-container flex items-center justify-center text-on-primary-container flex-shrink-0">
              <UserIcon className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-on-surface-variant truncate">User Lifecycle</p>
              <p className="text-xl font-bold tabular-nums text-on-surface">{stats.userOps}</p>
            </div>
          </div>

          <div className="p-3 sm:px-5 sm:py-3.5 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-secondary-container flex items-center justify-center text-on-secondary-container flex-shrink-0">
              <CalendarDaysIcon className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-on-surface-variant truncate">Event Operations</p>
              <p className="text-xl font-bold tabular-nums text-on-surface">{stats.eventOps}</p>
            </div>
          </div>

          <div className="p-3 sm:px-5 sm:py-3.5 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-success-container flex items-center justify-center text-on-success-container flex-shrink-0">
              <CurrencyDollarIcon className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-on-surface-variant truncate">Financial & Security</p>
              <p className="text-xl font-bold tabular-nums text-on-surface">
                {stats.financialOps + stats.securityOps}
              </p>
            </div>
          </div>
        </div>

        {/* Table Container with Integrated Toolbar */}
        <div className="bg-surface rounded-xl border border-outline-variant overflow-hidden shadow-sm flex flex-col">
          {/* Flush Integrated Toolbar */}
          <div className="p-3 sm:p-4 bg-surface border-b border-outline-variant">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              {/* Search + Record counter */}
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-full max-w-md">
                  <Input
                    placeholder="Search actor, action, target..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    aria-label="Filter audit logs by keyword"
                  />
                </div>
                <span className="hidden sm:inline-flex text-xs font-medium text-on-surface-variant whitespace-nowrap">
                  Showing {filteredLogs.length} of {logs.length}
                </span>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
                <div className="w-36 sm:w-40 flex-shrink-0">
                  <Select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    options={CATEGORY_OPTIONS}
                    aria-label="Filter by category"
                  />
                </div>
                <div className="w-32 sm:w-36 flex-shrink-0">
                  <Select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    options={STATUS_OPTIONS}
                    aria-label="Filter by status"
                  />
                </div>
                <div className="w-36 sm:w-40 flex-shrink-0">
                  <Select
                    value={dateRange}
                    onChange={(e) => setDateRange(e.target.value)}
                    options={DATE_RANGE_OPTIONS}
                    aria-label="Filter by date range"
                  />
                </div>
                {(searchTerm || categoryFilter !== 'all' || statusFilter !== 'all' || dateRange !== 'all') && (
                  <Button
                    variant="text"
                    size="sm"
                    onClick={() => {
                      setSearchTerm('');
                      setCategoryFilter('all');
                      setStatusFilter('all');
                      setDateRange('all');
                    }}
                    className="text-xs whitespace-nowrap"
                  >
                    Reset
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Table Area with Sticky Header */}
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-3">
              <LoadingSpinner size="lg" />
              <p className="text-sm text-on-surface-variant">Loading audit trail...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-16">
              <EmptyState
                icon={<ShieldCheckIcon className="h-6 w-6" aria-hidden="true" />}
                title="No audit logs found"
                description={
                  searchTerm || categoryFilter !== 'all' || statusFilter !== 'all' || dateRange !== 'all'
                    ? 'No events match your current filter criteria. Try clearing or relaxing filters.'
                    : 'No administrative activities have been logged yet.'
                }
                action={
                  searchTerm || categoryFilter !== 'all' || statusFilter !== 'all' || dateRange !== 'all' ? (
                    <Button
                      variant="outlined"
                      onClick={() => {
                        setSearchTerm('');
                        setCategoryFilter('all');
                        setStatusFilter('all');
                        setDateRange('all');
                      }}
                    >
                      Clear Filters
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto min-h-[400px]">
              <table className="min-w-full divide-y divide-outline-variant" aria-label="Audit Log Records">
                <thead className="bg-surface-container-low sticky top-0 z-10 border-b border-outline-variant shadow-xs">
                  <tr>
                    <th
                      scope="col"
                      className="px-4 py-2.5 text-left text-xs font-semibold text-on-surface-variant uppercase tracking-wider whitespace-nowrap"
                    >
                      Timestamp
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-2.5 text-left text-xs font-semibold text-on-surface-variant uppercase tracking-wider whitespace-nowrap"
                    >
                      Action & Category
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-2.5 text-left text-xs font-semibold text-on-surface-variant uppercase tracking-wider whitespace-nowrap"
                    >
                      Actor
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-2.5 text-left text-xs font-semibold text-on-surface-variant uppercase tracking-wider whitespace-nowrap"
                    >
                      Target
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-2.5 text-left text-xs font-semibold text-on-surface-variant uppercase tracking-wider whitespace-nowrap"
                    >
                      Status
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-2.5 text-right text-xs font-semibold text-on-surface-variant uppercase tracking-wider whitespace-nowrap"
                    >
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-surface divide-y divide-outline-variant text-sm">
                  {filteredLogs.map((log) => {
                    const times = formatTimestamp(log);
                    return (
                      <tr
                        key={log.id}
                        className="hover:bg-surface-container-low transition-colors duration-fast ease-quart"
                      >
                        <td className="px-4 py-2.5 sm:py-3 whitespace-nowrap text-on-surface-variant font-mono text-xs tabular-nums">
                          <span title={`UTC: ${times.utc}`}>{times.local}</span>
                        </td>
                        <td className="px-4 py-2.5 sm:py-3 whitespace-nowrap">
                          <div className="flex flex-col gap-0.5 items-start">
                            <span className="font-semibold text-on-surface">
                              {formatActionName(log.action)}
                            </span>
                            <Badge tone={getCategoryBadgeTone(log.category)} className="text-[10px] px-2 py-0.5">
                              {log.category.replace('_', ' ')}
                            </Badge>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 sm:py-3 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="font-medium text-on-surface">
                              {log.actor?.name || log.actor?.email || 'Unknown'}
                            </span>
                            {log.actor?.email && log.actor?.name && (
                              <span className="text-xs text-on-surface-variant">
                                {log.actor.email}
                              </span>
                            )}
                            <span className="text-[10px] font-mono text-on-surface-variant/80 uppercase">
                              {log.actor?.role}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 sm:py-3 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="font-medium text-on-surface">
                              {log.target?.label || log.target?.id || '—'}
                            </span>
                            <span className="text-xs text-on-surface-variant">
                              Type: {log.target?.type || 'system'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 sm:py-3 whitespace-nowrap">
                          <Badge tone={log.status === 'success' ? 'success' : 'danger'}>
                            {log.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5 sm:py-3 whitespace-nowrap text-right">
                          <Button
                            variant="outlined"
                            size="sm"
                            onClick={() => setSelectedLog(log)}
                            aria-label={`Inspect event details for ${log.action}`}
                            className="text-xs py-1 px-2.5"
                          >
                            <EyeIcon className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
                            Inspect
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Detail Inspection Modal */}
        {selectedLog && (
          <Modal
            open={Boolean(selectedLog)}
            onClose={() => setSelectedLog(null)}
            title="Audit Event Inspection"
            size="lg"
            footer={
              <div className="flex justify-between w-full">
                <Button
                  variant="outlined"
                  onClick={() => handleCopyDetails(selectedLog.details)}
                  aria-label="Copy event details JSON"
                >
                  <ClipboardDocumentCheckIcon className="h-4 w-4 mr-2" aria-hidden="true" />
                  {copiedPayload ? 'Copied!' : 'Copy JSON'}
                </Button>
                <Button variant="filled" onClick={() => setSelectedLog(null)}>
                  Close
                </Button>
              </div>
            }
          >
            <div className="space-y-6">
              {/* Event Summary Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-surface-container-low p-4 rounded-xl border border-outline-variant">
                <div>
                  <p className="text-xs font-medium text-on-surface-variant uppercase">
                    Event Action
                  </p>
                  <p className="text-base font-bold text-on-surface mt-0.5">
                    {formatActionName(selectedLog.action)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-on-surface-variant uppercase">
                    Category
                  </p>
                  <div className="mt-1">
                    <Badge tone={getCategoryBadgeTone(selectedLog.category)}>
                      {selectedLog.category.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-on-surface-variant uppercase">
                    Timestamp (Local)
                  </p>
                  <p className="text-sm font-mono text-on-surface mt-0.5">
                    {formatTimestamp(selectedLog).local}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-on-surface-variant uppercase">
                    Timestamp (UTC)
                  </p>
                  <p className="text-sm font-mono text-on-surface mt-0.5">
                    {formatTimestamp(selectedLog).utc}
                  </p>
                </div>
              </div>

              {/* Actor & Target Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-outline-variant rounded-xl p-4 bg-surface">
                  <h3 className="text-sm font-semibold text-on-surface flex items-center gap-2 mb-3">
                    <UserIcon className="h-4 w-4 text-primary" aria-hidden="true" />
                    Actor Information
                  </h3>
                  <dl className="space-y-2 text-sm">
                    <div>
                      <dt className="text-xs text-on-surface-variant">Name</dt>
                      <dd className="font-medium text-on-surface">
                        {selectedLog.actor?.name || '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-on-surface-variant">Email</dt>
                      <dd className="font-medium text-on-surface font-mono text-xs">
                        {selectedLog.actor?.email || '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-on-surface-variant">UID</dt>
                      <dd className="font-medium text-on-surface font-mono text-xs break-all">
                        {selectedLog.actor?.uid || '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-on-surface-variant">Role</dt>
                      <dd className="font-medium text-on-surface uppercase">
                        {selectedLog.actor?.role}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="border border-outline-variant rounded-xl p-4 bg-surface">
                  <h3 className="text-sm font-semibold text-on-surface flex items-center gap-2 mb-3">
                    <ComputerDesktopIcon className="h-4 w-4 text-secondary" aria-hidden="true" />
                    Target Entity
                  </h3>
                  <dl className="space-y-2 text-sm">
                    <div>
                      <dt className="text-xs text-on-surface-variant">Type</dt>
                      <dd className="font-medium text-on-surface capitalize">
                        {selectedLog.target?.type || 'system'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-on-surface-variant">Label / Name</dt>
                      <dd className="font-medium text-on-surface">
                        {selectedLog.target?.label || '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-on-surface-variant">Entity ID</dt>
                      <dd className="font-medium text-on-surface font-mono text-xs break-all">
                        {selectedLog.target?.id || '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-on-surface-variant">Execution Status</dt>
                      <dd className="mt-0.5">
                        <Badge tone={selectedLog.status === 'success' ? 'success' : 'danger'}>
                          {selectedLog.status}
                        </Badge>
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>

              {/* Diagnostic Network Info */}
              {(selectedLog.ipAddress || selectedLog.userAgent) && (
                <div className="border border-outline-variant rounded-xl p-4 bg-surface text-xs space-y-1">
                  <p className="font-semibold text-on-surface mb-2">Network Diagnostics</p>
                  {selectedLog.ipAddress && (
                    <p className="text-on-surface-variant">
                      <span className="font-medium text-on-surface">IP Address:</span>{' '}
                      <span className="font-mono">{selectedLog.ipAddress}</span>
                    </p>
                  )}
                  {selectedLog.userAgent && (
                    <p className="text-on-surface-variant break-all">
                      <span className="font-medium text-on-surface">User Agent:</span>{' '}
                      <span className="font-mono">{selectedLog.userAgent}</span>
                    </p>
                  )}
                </div>
              )}

              {/* JSON Details Payload */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-on-surface">
                    Operation Payload & Details
                  </h3>
                  <button
                    type="button"
                    onClick={() => handleCopyDetails(selectedLog.details)}
                    className="text-xs text-primary hover:underline font-medium min-h-control flex items-center"
                  >
                    {copiedPayload ? 'Copied' : 'Copy Payload'}
                  </button>
                </div>
                <div className="bg-surface-container-high rounded-xl p-4 overflow-x-auto max-h-64 border border-outline-variant">
                  <pre className="font-mono text-xs text-on-surface whitespace-pre-wrap break-all">
                    {selectedLog.details && Object.keys(selectedLog.details).length > 0
                      ? JSON.stringify(selectedLog.details, null, 2)
                      : '// No additional payload data recorded'}
                  </pre>
                </div>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </AppShell>
  );
};

export default AuditLogsPage;
