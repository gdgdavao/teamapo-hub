import { describe, it, expect } from 'vitest';
import { generateQrVector, renderQrSvg } from '../../src/utils/qrCode';
import QRCode from 'qrcode';

describe('QR Code Vector Generation (src/utils/qrCode.ts)', () => {
  const sampleDoorCode = 'REG-1730000000-xyz123-abc';

  it('generates consistent module dimensions and quiet zones', () => {
    const rawQr = QRCode.create(sampleDoorCode, { errorCorrectionLevel: 'M' });
    const vector = generateQrVector(sampleDoorCode, { quietZone: 2 });

    expect(vector.size).toBe(rawQr.modules.size);
    expect(vector.totalSize).toBe(rawQr.modules.size + 4); // 2 on each side
    expect(vector.path).toContain('M2,2'); // At least quiet zone offset
  });

  it('renders SVG string containing accessibility attributes and gradient definition', () => {
    const svg = renderQrSvg(sampleDoorCode, {
      ariaLabel: 'Entry QR code for DevFest 2025, 09/21 10:00AM',
      gradientId: 'test-grad-1',
    });

    expect(svg).toContain('<svg');
    expect(svg).toContain('role="img"');
    expect(svg).toContain('aria-label="Entry QR code for DevFest 2025, 09/21 10:00AM"');
    expect(svg).toContain('<defs><linearGradient id="test-grad-1"');
    expect(svg).toContain('stop-color="#0b57d0"');
    expect(svg).toContain('stop-color="#0f9d58"');
    expect(svg).toContain('fill="url(#test-grad-1)"');
    expect(svg).toContain('shape-rendering="crispEdges"');
  });

  it('supports solid fill when moduleGradient is disabled', () => {
    const svg = renderQrSvg(sampleDoorCode, {
      moduleGradient: false,
      solidColor: '#0b57d0',
    });

    expect(svg).not.toContain('<linearGradient');
    expect(svg).toContain('fill="#0b57d0"');
  });

  it('preserves module dark/light cell positions byte-identical to QRCode library', () => {
    const rawQr = QRCode.create(sampleDoorCode, { errorCorrectionLevel: 'M' });
    const quietZone = 2;
    const vector = generateQrVector(sampleDoorCode, { quietZone });

    // Every filled module in rawQr must correspond to a path directive M{x},{y}h1v1h-1z
    let filledCount = 0;
    for (let r = 0; r < rawQr.modules.size; r++) {
      for (let c = 0; c < rawQr.modules.size; c++) {
        if (rawQr.modules.get(r, c)) {
          filledCount++;
          const targetModule = `M${c + quietZone},${r + quietZone}h1v1h-1z`;
          expect(vector.path).toContain(targetModule);
        }
      }
    }
    expect(filledCount).toBeGreaterThan(0);
  });
});
