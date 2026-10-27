import { describe, it, expect } from 'vitest';
import {
  sanitizeTicketFilename,
  drawTicketCanvas,
  downloadTicketAsPng,
  TicketCanvasData
} from '../../src/utils/ticketCanvas';

describe('ticketCanvas Logic & Sanitization (Node Environment)', () => {
  const sampleTicketData: TicketCanvasData = {
    registrationId: 'reg_dvo_2026_xyz',
    attendeeName: 'Juan John Dela Cruz',
    role: 'Speaker',
    eventTitle: 'DevFest Davao 2026',
    venue: 'SMX Convention Center, Lanang, Davao City',
    eventDate: '2026-11-20T01:00:00.000Z',
    timezone: 'Asia/Manila',
    qrCode: 'registration:reg_dvo_2026_xyz'
  };

  describe('sanitizeTicketFilename', () => {
    it('formats a clean alphanumeric registration ID', () => {
      expect(sanitizeTicketFilename('reg123456')).toBe('ticket-reg123456.png');
    });

    it('replaces slashes, spaces, and punctuation with underscores', () => {
      expect(sanitizeTicketFilename('reg/dvo 2026#abc!')).toBe('ticket-reg_dvo_2026_abc_.png');
    });

    it('falls back to ticket-pass.png when ID is missing or empty', () => {
      expect(sanitizeTicketFilename('')).toBe('ticket-pass.png');
      expect(sanitizeTicketFilename(undefined)).toBe('ticket-pass.png');
    });
  });

  describe('Node environment safeguards', () => {
    it('drawTicketCanvas throws descriptive error in headless/node environment', async () => {
      await expect(drawTicketCanvas(sampleTicketData)).rejects.toThrow(
        'Canvas drawing is only supported in a browser environment'
      );
    });

    it('downloadTicketAsPng rejects immediately if registrationId is missing', async () => {
      await expect(
        downloadTicketAsPng({
          registrationId: '',
          eventTitle: 'DevFest'
        })
      ).rejects.toThrow('Registration ID is required');
    });
  });
});
