import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FeedbackService } from '../../src/services/feedbackService';
import { CertificateService } from '../../src/services/certificateService';
import { FormField } from '../../src/types';

const mockHttpsCallable = vi.fn();
const mockGetEvent = vi.fn();
const mockGetEventBySlug = vi.fn();
const mockGetFeedbackForm = vi.fn();

vi.mock('firebase/functions', () => ({
  httpsCallable: (...args: unknown[]) => mockHttpsCallable(...args)
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  deleteDoc: vi.fn(),
  limit: vi.fn(),
  serverTimestamp: () => 'SERVER_TIMESTAMP_MOCK',
  Timestamp: class MockTimestamp {
    seconds = 0;
    nanoseconds = 0;
    static fromDate(d: Date) {
      const ts = new MockTimestamp();
      ts.seconds = Math.floor(d.getTime() / 1000);
      return ts;
    }
    toDate() {
      return new Date(this.seconds * 1000);
    }
  }
}));

vi.mock('firebase/storage', () => ({
  ref: vi.fn(),
  uploadBytes: vi.fn(),
  getDownloadURL: vi.fn(),
  deleteObject: vi.fn()
}));

vi.mock('../../src/config/firebase', () => ({
  db: {},
  functions: {},
  storage: {},
  APP_URL: 'https://apohub.gdgdavao.org'
}));

vi.mock('../../src/services/eventService', () => ({
  EventService: {
    getEvent: (...args: unknown[]) => mockGetEvent(...args),
    getEventBySlug: (...args: unknown[]) => mockGetEventBySlug(...args),
    getFeedbackForm: (...args: unknown[]) => mockGetFeedbackForm(...args)
  }
}));

const DEVFEST_FEEDBACK_FIELDS: FormField[] = [
  { id: 'overall_rating', type: 'rating', label: 'Overall Event Rating', required: true, gridSize: 'full' },
  { id: 'field_1794293259393_51am9', type: 'spacer', label: 'Section Divider', required: false, gridSize: 'full' },
  {
    id: 'field_1794293465710_e3sl0',
    type: 'checkbox',
    label: 'How has attending GDG events impacted you?',
    required: true,
    gridSize: 'full',
    options: [
      'Connected with other developers',
      'Learned new technical skills',
      'Inspired to build a project',
      'Other...'
    ]
  }
];

describe('FeedbackService.getPublicFeedbackContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves completed event metadata and custom 9-field feedbackForm from resolveFeedbackToken callable', async () => {
    const callableFn = vi.fn().mockResolvedValue({
      data: {
        success: true,
        eventId: 'c6dzpNS14RxTer8F8Ppd',
        event: {
          id: 'c6dzpNS14RxTer8F8Ppd',
          slug: 'devfest-davao-2026',
          title: 'DevFest Davao 2026',
          startDate: '2026-11-08T00:00:00+00:00',
          endDate: '2026-11-08T09:00:00+00:00',
          venue: { type: 'offline', name: 'SMX Convention Center Davao' },
          status: 'completed',
          isPublished: false
        },
        feedbackForm: {
          id: 'feedback',
          type: 'feedback',
          fields: DEVFEST_FEEDBACK_FIELDS
        }
      }
    });
    mockHttpsCallable.mockReturnValue(callableFn);

    const ctx = await FeedbackService.getPublicFeedbackContext('devfest-davao-2026');

    expect(callableFn).toHaveBeenCalledWith({ eventId: 'devfest-davao-2026' });
    expect(ctx.eventId).toBe('c6dzpNS14RxTer8F8Ppd');
    expect(ctx.event?.title).toBe('DevFest Davao 2026');
    expect(ctx.event?.status).toBe('completed');
    expect(ctx.feedbackForm?.fields).toEqual(DEVFEST_FEEDBACK_FIELDS);
    expect(mockGetEvent).not.toHaveBeenCalled();
  });

  it('falls back to direct Firestore reads and synthesizes an Event shell when callable fails on untokenized load', async () => {
    const callableFn = vi.fn().mockRejectedValue(new Error('token is required'));
    mockHttpsCallable.mockReturnValue(callableFn);
    // Simulate completed event returning null on anonymous client read
    mockGetEvent.mockResolvedValue(null);
    mockGetEventBySlug.mockResolvedValue(null);
    mockGetFeedbackForm.mockResolvedValue({
      id: 'feedback',
      type: 'feedback',
      fields: DEVFEST_FEEDBACK_FIELDS
    });

    const ctx = await FeedbackService.getPublicFeedbackContext('c6dzpNS14RxTer8F8Ppd');

    expect(ctx.eventId).toBe('c6dzpNS14RxTer8F8Ppd');
    expect(ctx.event).not.toBeNull();
    expect(ctx.event?.id).toBe('c6dzpNS14RxTer8F8Ppd');
    expect(ctx.feedbackForm?.fields).toEqual(DEVFEST_FEEDBACK_FIELDS);
  });

  it('rethrows invalid/expired token errors when a token is explicitly supplied', async () => {
    const callableFn = vi.fn().mockRejectedValue(new Error('Invalid or expired feedback token'));
    mockHttpsCallable.mockReturnValue(callableFn);

    await expect(
      FeedbackService.getPublicFeedbackContext('c6dzpNS14RxTer8F8Ppd', 'bad_token')
    ).rejects.toThrow('Invalid or expired feedback token');
  });
});

describe('CertificateService.createCertificateRecord server-side imageDataUrl support', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('forwards imageDataUrl to issueCertificateRecord callable for anonymous certificate issuance', async () => {
    const issueCallable = vi.fn().mockResolvedValue({
      data: {
        success: true,
        certificateId: 'reg_123',
        certificateUrl: 'https://firebasestorage.googleapis.com/v0/b/bucket/o/cert.png?alt=media'
      }
    });
    mockHttpsCallable.mockReturnValue(issueCallable);

    const certId = await CertificateService.createCertificateRecord({
      recipientName: 'Ada Lovelace',
      recipientEmail: 'ada@example.com',
      eventId: 'c6dzpNS14RxTer8F8Ppd',
      eventTitle: 'DevFest Davao 2026',
      eventDate: '2026-11-08T00:00:00.000Z',
      registrationId: 'reg_123',
      certificateUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      imageDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      verificationCode: 'GDG-2026-ABCD',
      templateId: '7yPQolEbKKm1DyEIhr9a'
    });

    expect(certId).toBe('reg_123');
    expect(issueCallable).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'c6dzpNS14RxTer8F8Ppd',
        registrationId: 'reg_123',
        imageDataUrl: expect.stringContaining('data:image/png;base64,')
      })
    );
  });
});

describe('functions/main.py feedback & certificate callable invariants', () => {
  const mainPy = readFileSync(join(process.cwd(), 'functions/main.py'), 'utf8');

  it('supports slug resolution and completed-event feedbackForm retrieval in resolveFeedbackToken', () => {
    const start = mainPy.indexOf('def resolveFeedbackToken');
    const nextFn = mainPy.indexOf('\n@https_fn', start);
    const body = mainPy.slice(start, nextFn);

    expect(body).toContain("FieldFilter('slug', '==', clean_event_arg)");
    expect(body).toContain("collection('forms').document('feedback')");
    expect(body).toContain("'feedbackForm': feedback_form");
  });

  it('supports server-side base64 PNG upload to Storage in issueCertificateRecord', () => {
    const start = mainPy.indexOf('def issueCertificateRecord');
    const nextFn = mainPy.indexOf('\n@https_fn', start);
    const body = mainPy.slice(start, nextFn);

    expect(body).toContain("data.get('imageDataUrl')");
    expect(body).toContain("blob.upload_from_string(png_bytes, content_type='image/png')");
    expect(body).toContain('firebaseStorageDownloadTokens');
  });
});
