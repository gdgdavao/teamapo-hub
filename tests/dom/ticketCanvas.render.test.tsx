import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  drawTicketCanvas,
  downloadTicketAsPng,
  TicketCanvasData
} from '../../src/utils/ticketCanvas';

describe('ticketCanvas in DOM (jsdom Environment)', () => {
  const sampleTicketData: TicketCanvasData = {
    registrationId: 'reg_dvo_2026_xyz',
    attendeeName: 'Juan John Dela Cruz',
    role: 'Speaker',
    eventTitle: 'DevFest Davao 2026',
    venue: 'SMX Convention Center, Lanang, Davao City',
    eventDate: '2026-11-20T01:00:00.000Z',
    timezone: 'Asia/Manila',
    bannerUrl: 'https://assets.gdgdavao.org/test-banner.png',
    qrCode: 'registration:reg_dvo_2026_xyz'
  };

  const mockCtx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
    shadowColor: '',
    shadowBlur: 0,
    shadowOffsetY: 0,
    fillRect: vi.fn(),
    fillText: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    arcTo: vi.fn(),
    clip: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    drawImage: vi.fn(),
    createLinearGradient: vi.fn().mockReturnValue({
      addColorStop: vi.fn(),
    }),
    roundRect: vi.fn(),
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(mockCtx as any);

    // Fast Mock for Image in jsdom
    class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      crossOrigin = '';
      width = 1200;
      height = 720;
      private _src = '';
      set src(val: string) {
        this._src = val;
        setTimeout(() => this.onload && this.onload(), 0);
      }
      get src() {
        return this._src;
      }
    }
    vi.stubGlobal('Image', MockImage);
  });

  it('drawTicketCanvas acquires 2d context and draws 1:1 ticket elements', async () => {
    const canvas = await drawTicketCanvas(sampleTicketData, { loadRemoteImages: false });
    expect(canvas).toBeDefined();
    expect(canvas.width).toBe(2100);
    expect(canvas.height).toBeGreaterThan(1800);
    expect(mockCtx.fillRect).toHaveBeenCalled();
    expect(mockCtx.fillText).toHaveBeenCalled();
    expect(mockCtx.clip).toHaveBeenCalled();
  });

  it('downloadTicketAsPng invokes toBlob and clicks anchor download link', async () => {
    const mockBlob = new Blob(['mock-png'], { type: 'image/png' });
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    HTMLCanvasElement.prototype.toBlob = vi.fn(function (
      this: HTMLCanvasElement,
      callback: (blob: Blob | null) => void
    ) {
      callback(mockBlob);
    });

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    const result = await downloadTicketAsPng(sampleTicketData);
    expect(result).toBe(true);
    expect(createObjectURLSpy).toHaveBeenCalledWith(mockBlob);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('downloadTicketAsPng falls back to toDataURL when toBlob returns null', async () => {
    HTMLCanvasElement.prototype.toBlob = vi.fn(function (
      this: HTMLCanvasElement,
      callback: (blob: Blob | null) => void
    ) {
      callback(null);
    });

    const toDataUrlSpy = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,mock');
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    const result = await downloadTicketAsPng(sampleTicketData);
    expect(result).toBe(true);
    expect(toDataUrlSpy).toHaveBeenCalledWith('image/png');
    expect(clickSpy).toHaveBeenCalled();
  });

  it('downloadTicketAsPng catches SecurityError on tainted canvas and retries without remote images', async () => {
    let callCount = 0;
    HTMLCanvasElement.prototype.toBlob = vi.fn(function (
      this: HTMLCanvasElement,
      callback: (blob: Blob | null) => void
    ) {
      callCount++;
      if (callCount === 1) {
        const securityErr = new Error('The operation is insecure.');
        securityErr.name = 'SecurityError';
        throw securityErr;
      }
      callback(new Blob(['clean-fallback-png'], { type: 'image/png' }));
    });

    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fallback-url');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    const result = await downloadTicketAsPng(sampleTicketData);
    expect(result).toBe(true);
    expect(callCount).toBe(2);
  });
});
