import QRCode from 'qrcode';

/**
 * QR Code Rendering Configuration & Vector Options
 */
export interface QrCodeOptions {
  quietZone?: number;
  gradientId?: string;
  moduleGradient?: boolean;
  startColor?: string;
  endColor?: string;
  solidColor?: string;
  ariaLabel?: string;
  className?: string;
}

export interface QrVectorData {
  size: number;
  totalSize: number;
  path: string;
}

/**
 * Synchronously computes QR module matrix and builds a compact SVG path string.
 * Uses Error Correction Level 'M' and a default 2-module quiet zone per docs/PassUI.md.
 */
export function generateQrVector(
  value: string,
  options?: { quietZone?: number }
): QrVectorData {
  const quietZone = options?.quietZone ?? 2;
  const qr = QRCode.create(value || ' ', { errorCorrectionLevel: 'M' });
  const size = qr.modules.size;
  const totalSize = size + quietZone * 2;

  let path = '';
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (qr.modules.get(r, c)) {
        const x = c + quietZone;
        const y = r + quietZone;
        path += `M${x},${y}h1v1h-1z `;
      }
    }
  }

  return {
    size,
    totalSize,
    path: path.trim(),
  };
}

/**
 * Pure function returning a self-contained inline SVG string for the QR code.
 * Diagonal linear gradient #0b57d0 -> #0f9d58 per the approved Davao pass mock.
 */
export function renderQrSvg(value: string, options: QrCodeOptions = {}): string {
  const {
    quietZone = 2,
    gradientId = 'qr-ticket-grad',
    moduleGradient = true,
    startColor = '#0b57d0',
    endColor = '#0f9d58',
    solidColor = '#0b57d0',
    ariaLabel = 'Entry QR code',
    className = '',
  } = options;

  const { totalSize, path } = generateQrVector(value, { quietZone });

  const fill = moduleGradient ? `url(#${gradientId})` : solidColor;
  const classAttr = className ? ` class="${className}"` : '';

  return (
    `<svg viewBox="0 0 ${totalSize} ${totalSize}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${ariaLabel}"${classAttr}>` +
    (moduleGradient
      ? `<defs><linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${startColor}" /><stop offset="100%" stop-color="${endColor}" /></linearGradient></defs>`
      : '') +
    `<path d="${path}" fill="${fill}" shape-rendering="crispEdges" />` +
    `</svg>`
  );
}
