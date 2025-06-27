import { CertificateTemplate, Certificate } from '../types';

export interface CertificateGenerationRequest {
  templateId: string;
  recipientName: string;
  recipientEmail: string;
  eventTitle: string;
  eventDate: string;
  verificationCode?: string;
}

export class CertificateGenerationService {
  private static generateVerificationCode(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `CERT-${timestamp}-${random}`.toUpperCase();
  }

  private static generateQRCode(verificationUrl: string): Promise<string> {
    // In a real implementation, this would use a QR code library like qrcode
    // For now, return a placeholder
    return Promise.resolve(`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(verificationUrl)}`);
  }

  static async generateCertificate(
    template: CertificateTemplate,
    request: CertificateGenerationRequest
  ): Promise<{ certificateUrl: string; verificationCode: string }> {
    const verificationCode = request.verificationCode || this.generateVerificationCode();
    const verificationUrl = `${window.location.origin}/verify/${verificationCode}`;
    
    try {
      // Create a canvas to generate the certificate
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        throw new Error('Could not get canvas context');
      }

      // Set canvas size (you might want to make this configurable)
      canvas.width = 1200;
      canvas.height = 800;

      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        img.onload = async () => {
          try {
            // Draw the template image
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            // Draw recipient name
            const namePos = template.textPositions.recipientName;
            ctx.font = `${namePos.fontSize}px ${namePos.fontFamily}`;
            ctx.fillStyle = namePos.color;
            ctx.textAlign = namePos.align;
            
            const nameX = (namePos.x / 100) * canvas.width;
            const nameY = (namePos.y / 100) * canvas.height;
            ctx.fillText(request.recipientName, nameX, nameY);

            // Draw verification code
            const codePos = template.textPositions.verificationCode;
            ctx.font = `${codePos.fontSize}px ${codePos.fontFamily}`;
            ctx.fillStyle = codePos.color;
            ctx.textAlign = codePos.align;
            
            const codeX = (codePos.x / 100) * canvas.width;
            const codeY = (codePos.y / 100) * canvas.height;
            ctx.fillText(`Verification Code: ${verificationCode}`, codeX, codeY);

            // Draw event title if position is defined
            if (template.textPositions.eventTitle) {
              const eventPos = template.textPositions.eventTitle;
              ctx.font = `${eventPos.fontSize}px ${eventPos.fontFamily}`;
              ctx.fillStyle = eventPos.color;
              ctx.textAlign = eventPos.align;
              
              const eventX = (eventPos.x / 100) * canvas.width;
              const eventY = (eventPos.y / 100) * canvas.height;
              ctx.fillText(request.eventTitle, eventX, eventY);
            }

            // Draw event date if position is defined
            if (template.textPositions.eventDate) {
              const datePos = template.textPositions.eventDate;
              ctx.font = `${datePos.fontSize}px ${datePos.fontFamily}`;
              ctx.fillStyle = datePos.color;
              ctx.textAlign = datePos.align;
              
              const dateX = (datePos.x / 100) * canvas.width;
              const dateY = (datePos.y / 100) * canvas.height;
              ctx.fillText(new Date(request.eventDate).toLocaleDateString(), dateX, dateY);
            }

            // Generate and draw QR code
            const qrCodeUrl = await this.generateQRCode(verificationUrl);
            const qrImg = new Image();
            qrImg.crossOrigin = 'anonymous';
            
            qrImg.onload = () => {
              const qrPos = template.textPositions.qrCode;
              const qrX = (qrPos.x / 100) * canvas.width - (qrPos.size / 2);
              const qrY = (qrPos.y / 100) * canvas.height - (qrPos.size / 2);
              
              ctx.drawImage(qrImg, qrX, qrY, qrPos.size, qrPos.size);

              // Convert to blob and create URL
              canvas.toBlob((blob) => {
                if (blob) {
                  const certificateUrl = URL.createObjectURL(blob);
                  resolve({ certificateUrl, verificationCode });
                } else {
                  reject(new Error('Failed to create certificate blob'));
                }
              }, 'image/png');
            };

            qrImg.onerror = () => {
              // If QR code fails to load, continue without it
              canvas.toBlob((blob) => {
                if (blob) {
                  const certificateUrl = URL.createObjectURL(blob);
                  resolve({ certificateUrl, verificationCode });
                } else {
                  reject(new Error('Failed to create certificate blob'));
                }
              }, 'image/png');
            };

            qrImg.src = qrCodeUrl;
          } catch (error) {
            reject(error);
          }
        };

        img.onerror = () => {
          reject(new Error('Failed to load template image'));
        };

        img.src = template.templateImageUrl;
      });
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
