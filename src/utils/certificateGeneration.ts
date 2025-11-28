import { CertificateTemplate, Certificate } from '../types';

export interface CertificateGenerationRequest {
  templateId: string;
  recipientName: string;
  recipientEmail: string;
  eventTitle: string;
  eventDate: string;
  verificationCode?: string;
}

// High resolution settings for 300 PPI certificate generation
const CERTIFICATE_DPI = 300;
const DEFAULT_WIDTH_INCHES = 11; // Letter landscape width
const DEFAULT_HEIGHT_INCHES = 8.5; // Letter landscape height
const HIGH_RES_WIDTH = Math.round(DEFAULT_WIDTH_INCHES * CERTIFICATE_DPI); // 3300px
const HIGH_RES_HEIGHT = Math.round(DEFAULT_HEIGHT_INCHES * CERTIFICATE_DPI); // 2550px

export class CertificateGenerationService {
  private static generateVerificationCode(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `CERT-${timestamp}-${random}`.toUpperCase();
  }

  private static generateQRCode(verificationUrl: string, size: number = 300): Promise<string> {
    // Generate high resolution QR code for better quality at 300 DPI
    const qrSize = Math.max(size, 300); // Minimum 300px for good quality
    return Promise.resolve(`https://api.qrserver.com/v1/create-qr-code/?size=${qrSize}x${qrSize}&data=${encodeURIComponent(verificationUrl)}`);
  }

  /**
   * Load an image with retry logic and exponential backoff
   */
  private static async loadImageWithRetry(url: string, maxRetries = 3): Promise<HTMLImageElement> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image();
          image.crossOrigin = 'anonymous';
          
          image.onload = () => resolve(image);
          image.onerror = () => reject(new Error(`Failed to load image: ${url}`));
          
          image.src = url;
        });
        
        return img;
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < maxRetries - 1) {
          // Exponential backoff: 1s, 2s, 4s
          const delay = Math.pow(2, attempt) * 1000;
          console.warn(`Image load attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError || new Error('Failed to load image after retries');
  }

  /**
   * Generate certificate using enhanced template elements
   */
  private static async generateFromEnhancedTemplate(
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    template: CertificateTemplate,
    request: CertificateGenerationRequest,
    verificationCode: string,
    verificationUrl: string,
    scaleFactor: number = 1
  ): Promise<void> {
    if (!template.elements || template.elements.length === 0) {
      console.warn('No elements found in enhanced template');
      return;
    }

    for (const element of template.elements) {
      const x = (element.position.x / 100) * canvas.width;
      const y = (element.position.y / 100) * canvas.height;

      ctx.save();

      if (element.type === 'text') {
        // Scale font size for high resolution
        const baseFontSize = element.style.fontSize || 16;
        const fontSize = Math.round(baseFontSize * scaleFactor);
        const fontFamily = element.style.fontFamily || 'Arial';
        const fontWeight = element.style.fontWeight || 'normal';
        const fontStyle = element.style.fontStyle || 'normal';

        ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
        ctx.fillStyle = element.style.color || '#000000';
        ctx.textAlign = (element.style.align as CanvasTextAlign) || 'left';

        // Replace template variables with actual values
        let text = element.content
          .replace(/\{\{\s*recipientName\s*\}\}/g, request.recipientName)
          .replace(/\{\{\s*verificationCode\s*\}\}/g, verificationCode)
          .replace(/\{\{\s*eventTitle\s*\}\}/g, request.eventTitle)
          .replace(/\{\{\s*eventDate\s*\}\}/g, new Date(request.eventDate).toLocaleDateString())
          .replace(/\{\{\s*verificationUrl\s*\}\}/g, verificationUrl);

        ctx.fillText(text, x, y);
      } else if (element.type === 'qrcode') {
        try {
          // Scale QR code size for high resolution
          const qrSize = Math.round((element.position.width || 150) * scaleFactor);
          const qrCodeUrl = await this.generateQRCode(verificationUrl, qrSize);
          const qrImg = await this.loadImageWithRetry(qrCodeUrl);
          
          const qrX = x - qrSize / 2;
          const qrY = y - qrSize / 2;
          
          ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
        } catch (error) {
          console.warn('Failed to load QR code, skipping:', error);
          // Draw a placeholder rectangle if QR fails
          const size = Math.round((element.position.width || 100) * scaleFactor);
          ctx.fillStyle = '#f0f0f0';
          ctx.fillRect(x - size/2, y - size/2, size, size);
          ctx.fillStyle = '#999';
          ctx.font = `${Math.round(12 * scaleFactor)}px Arial`;
          ctx.textAlign = 'center';
          ctx.fillText('QR Code', x, y);
        }
      }

      ctx.restore();
    }
  }

  /**
   * Generate certificate using legacy template textPositions
   */
  private static async generateFromLegacyTemplate(
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    template: CertificateTemplate,
    request: CertificateGenerationRequest,
    verificationCode: string,
    verificationUrl: string,
    scaleFactor: number = 1
  ): Promise<void> {
    if (!template.textPositions) {
      console.warn('No textPositions found in legacy template');
      return;
    }

    // Draw recipient name
    if (template.textPositions.recipientName) {
      const namePos = template.textPositions.recipientName;
      const fontSize = Math.round(namePos.fontSize * scaleFactor);
      ctx.font = `${namePos.fontStyle || 'normal'} ${namePos.fontWeight || 'normal'} ${fontSize}px ${namePos.fontFamily}`;
      ctx.fillStyle = namePos.color;
      ctx.textAlign = namePos.align as CanvasTextAlign;

      const nameX = (namePos.x / 100) * canvas.width;
      const nameY = (namePos.y / 100) * canvas.height;
      ctx.fillText(request.recipientName, nameX, nameY);
    }

    // Draw verification code
    if (template.textPositions.verificationCode) {
      const codePos = template.textPositions.verificationCode;
      const fontSize = Math.round(codePos.fontSize * scaleFactor);
      ctx.font = `${codePos.fontStyle || 'normal'} ${codePos.fontWeight || 'normal'} ${fontSize}px ${codePos.fontFamily}`;
      ctx.fillStyle = codePos.color;
      ctx.textAlign = codePos.align as CanvasTextAlign;

      const codeX = (codePos.x / 100) * canvas.width;
      const codeY = (codePos.y / 100) * canvas.height;
      ctx.fillText(verificationCode, codeX, codeY);
    }

    // Draw event title if position is defined
    if (template.textPositions.eventTitle) {
      const eventPos = template.textPositions.eventTitle;
      const fontSize = Math.round(eventPos.fontSize * scaleFactor);
      ctx.font = `${eventPos.fontStyle || 'normal'} ${eventPos.fontWeight || 'normal'} ${fontSize}px ${eventPos.fontFamily}`;
      ctx.fillStyle = eventPos.color;
      ctx.textAlign = eventPos.align as CanvasTextAlign;

      const eventX = (eventPos.x / 100) * canvas.width;
      const eventY = (eventPos.y / 100) * canvas.height;
      ctx.fillText(request.eventTitle, eventX, eventY);
    }

    // Draw event date if position is defined
    if (template.textPositions.eventDate) {
      const datePos = template.textPositions.eventDate;
      const fontSize = Math.round(datePos.fontSize * scaleFactor);
      ctx.font = `${datePos.fontStyle || 'normal'} ${datePos.fontWeight || 'normal'} ${fontSize}px ${datePos.fontFamily}`;
      ctx.fillStyle = datePos.color;
      ctx.textAlign = datePos.align as CanvasTextAlign;

      const dateX = (datePos.x / 100) * canvas.width;
      const dateY = (datePos.y / 100) * canvas.height;
      ctx.fillText(new Date(request.eventDate).toLocaleDateString(), dateX, dateY);
    }

    // Draw QR code
    if (template.textPositions.qrCode) {
      try {
        const qrPos = template.textPositions.qrCode;
        const qrSize = Math.round(qrPos.size * scaleFactor);
        const qrCodeUrl = await this.generateQRCode(verificationUrl, qrSize);
        const qrImg = await this.loadImageWithRetry(qrCodeUrl);

        const qrX = (qrPos.x / 100) * canvas.width - (qrSize / 2);
        const qrY = (qrPos.y / 100) * canvas.height - (qrSize / 2);

        ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
      } catch (error) {
        console.warn('Failed to load QR code in legacy template:', error);
      }
    }
  }

  static async generateCertificate(
    template: CertificateTemplate,
    request: CertificateGenerationRequest
  ): Promise<{ certificateUrl: string; verificationCode: string; blob: Blob }> {
    const verificationCode = request.verificationCode || this.generateVerificationCode();
    const verificationUrl = `${window.location.origin}/verify/${verificationCode}`;

    try {
      // Create a canvas to generate the certificate
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Could not get canvas context');
      }

      // Set high resolution canvas size for 300 DPI output
      // Use template dimensions as base, then scale up for high DPI
      const baseWidth = template.dimensions?.width || 1200;
      const baseHeight = template.dimensions?.height || 800;
      
      // Calculate scale factor to achieve 300 DPI
      // Assuming template dimensions were designed for 72-96 DPI display
      const scaleFactor = CERTIFICATE_DPI / 96; // Scale from 96 DPI to 300 DPI (~3.125x)
      
      canvas.width = Math.round(baseWidth * scaleFactor);
      canvas.height = Math.round(baseHeight * scaleFactor);
      
      // Ensure minimum high resolution dimensions
      if (canvas.width < HIGH_RES_WIDTH) {
        const aspectRatio = baseHeight / baseWidth;
        canvas.width = HIGH_RES_WIDTH;
        canvas.height = Math.round(HIGH_RES_WIDTH * aspectRatio);
      }

      // Enable high-quality image rendering
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Load template image with retry
      const templateImg = await this.loadImageWithRetry(template.templateImageUrl);

      // Draw the template image at high resolution
      ctx.drawImage(templateImg, 0, 0, canvas.width, canvas.height);

      // Generate content based on template mode
      // Scale factor for text and element positions
      const textScaleFactor = canvas.width / baseWidth;
      
      if (template.templateMode === 'enhanced' && template.elements) {
        await this.generateFromEnhancedTemplate(canvas, ctx, template, request, verificationCode, verificationUrl, textScaleFactor);
      } else if (template.textPositions) {
        await this.generateFromLegacyTemplate(canvas, ctx, template, request, verificationCode, verificationUrl, textScaleFactor);
      }

      // Convert to high-quality PNG blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => {
          if (b) {
            resolve(b);
          } else {
            reject(new Error('Failed to create certificate blob'));
          }
        }, 'image/png', 1.0); // Maximum quality
      });

      const certificateUrl = URL.createObjectURL(blob);
      return { certificateUrl, verificationCode, blob };
    } catch (error) {
      console.error('Error generating certificate:', error);
      throw error;
    }
  }

  static async bulkGenerateCertificates(
    template: CertificateTemplate,
    recipients: Array<{
      name: string;
      email: string;
      eventTitle: string;
      eventDate: string;
    }>
  ): Promise<Array<{ recipient: string; certificateUrl: string; verificationCode: string }>> {
    const results: Array<{ recipient: string; certificateUrl: string; verificationCode: string }> = [];
    
    for (const recipient of recipients) {
      try {
        const result = await this.generateCertificate(template, {
          templateId: template.id,
          recipientName: recipient.name,
          recipientEmail: recipient.email,
          eventTitle: recipient.eventTitle,
          eventDate: recipient.eventDate
        });
        
        results.push({
          recipient: recipient.name,
          certificateUrl: result.certificateUrl,
          verificationCode: result.verificationCode
        });
      } catch (error) {
        console.error(`Failed to generate certificate for ${recipient.name}:`, error);
        results.push({
          recipient: recipient.name,
          certificateUrl: '',
          verificationCode: ''
        });
      }
    }
    
    return results;
  }

  static downloadCertificate(certificateUrl: string, filename: string) {
    const link = document.createElement('a');
    link.href = certificateUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
