import { describe, it, expect, vi } from 'vitest';
import { sanitizeDocument, ALLOWED_COLLECTIONS } from '../../scripts/mcp/tools/firestore';
import { getEmulatorStatus, checkSingleEmulator } from '../../scripts/mcp/tools/emulator';
import { createApohubMcpServer } from '../../scripts/mcp/server';

describe('Apohub Dev MCP Tools', () => {
  describe('Data Privacy Act / Sanitize Document', () => {
    it('redacts sensitive credentials and secrets', () => {
      const input = {
        uid: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        password: 'SuperSecretPassword123!',
        passwordHash: '$2b$10$...',
        apiKey: 'AIzaSy...',
        token: 'ey...',
        refreshToken: 'def...',
        secret: 'my-salt',
        role: 'organizer'
      };

      const sanitized = sanitizeDocument(input);

      expect(sanitized.uid).toBe('user-123');
      expect(sanitized.email).toBe('test@example.com');
      expect(sanitized.displayName).toBe('Test User');
      expect(sanitized.role).toBe('organizer');

      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.passwordHash).toBe('[REDACTED]');
      expect(sanitized.apiKey).toBe('[REDACTED]');
      expect(sanitized.token).toBe('[REDACTED]');
      expect(sanitized.refreshToken).toBe('[REDACTED]');
      expect(sanitized.secret).toBe('[REDACTED]');
    });

    it('sanitizes nested objects and arrays', () => {
      const input = {
        eventTitle: 'GDG DevFest',
        attendees: [
          { name: 'Alice', token: 'token-alice' },
          { name: 'Bob', token: 'token-bob' }
        ],
        metadata: {
          author: 'Admin',
          secret: 'should-not-leak'
        }
      };

      const sanitized = sanitizeDocument(input);

      expect(sanitized.eventTitle).toBe('GDG DevFest');
      expect((sanitized.metadata as Record<string, unknown>).author).toBe('Admin');
      expect((sanitized.metadata as Record<string, unknown>).secret).toBe('[REDACTED]');
      const attendees = sanitized.attendees as Array<Record<string, unknown>>;
      expect(attendees[0].name).toBe('Alice');
      expect(attendees[0].token).toBe('[REDACTED]');
      expect(attendees[1].name).toBe('Bob');
      expect(attendees[1].token).toBe('[REDACTED]');
    });

    it('converts Date-like objects to ISO strings', () => {
      const fakeDate = new Date('2026-10-04T12:00:00.000Z');
      const input = {
        title: 'Meeting',
        createdAt: {
          toDate: () => fakeDate
        }
      };

      const sanitized = sanitizeDocument(input);
      expect(sanitized.createdAt).toBe('2026-10-04T12:00:00.000Z');
    });

    it('contains all core Apohub collections in whitelist', () => {
      expect(ALLOWED_COLLECTIONS).toContain('events');
      expect(ALLOWED_COLLECTIONS).toContain('users');
      expect(ALLOWED_COLLECTIONS).toContain('registrations');
      expect(ALLOWED_COLLECTIONS).toContain('payments');
      expect(ALLOWED_COLLECTIONS).toContain('feedback');
      expect(ALLOWED_COLLECTIONS).toContain('certificates');
    });
  });

  describe('Emulator Status Checker', () => {
    it('accurately reports offline when fetch fails', async () => {
      const mockEndpoints = [
        { name: 'test-down-1', port: 19991, url: 'http://127.0.0.1:19991' },
        { name: 'test-down-2', port: 19992, url: 'http://127.0.0.1:19992' }
      ];

      const report = await getEmulatorStatus(mockEndpoints);

      expect(report.status).toBe('offline');
      expect(report.activeCount).toBe(0);
      expect(report.totalCount).toBe(2);
      expect(report.instructions).toContain('bun run emulator:start');
    });

    it('checks single emulator with failure fallback', async () => {
      const res = await checkSingleEmulator({ name: 'unreachable', port: 59999, url: 'http://127.0.0.1:59999' }, 200);
      expect(res.running).toBe(false);
    });
  });

  describe('McpServer Initialization', () => {
    it('creates server instance successfully', () => {
      const server = createApohubMcpServer();
      expect(server).toBeDefined();
    });
  });
});
