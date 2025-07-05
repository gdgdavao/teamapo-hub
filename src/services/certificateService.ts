import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  deleteDoc,
  Timestamp,
  limit,
  startAfter
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { db, storage, functions } from '../config/firebase';
import { CertificateTemplate, Certificate } from '../types';

export interface IssuedCertificate {
  id: string;
  templateId: string;
  templateName: string;
  recipientName: string;
  recipientEmail: string;
  eventTitle: string;
  issuedDate: string;
  verificationCode: string;
  status: 'issued' | 'verified' | 'revoked';
  downloadCount: number;
  certificateUrl: string;
}

export class CertificateService {
  private static readonly TEMPLATES_COLLECTION = 'certificateTemplates';
  private static readonly CERTIFICATES_COLLECTION = 'certificates';
  private static readonly TEMPLATE_IMAGES_PATH = 'certificate-templates';
  private static readonly CERTIFICATES_PATH = 'certificates';

  /**
   * Upload certificate template image to Firebase Storage
   */
  static async uploadTemplateImage(templateId: string, imageFile: File): Promise<string> {
    try {
      const imageRef = ref(storage, `${this.TEMPLATE_IMAGES_PATH}/${templateId}/${imageFile.name}`);
      const snapshot = await uploadBytes(imageRef, imageFile);
      return await getDownloadURL(snapshot.ref);
    } catch (error) {
      console.error('Error uploading template image:', error);
      throw new Error('Failed to upload template image');
    }
  }

  /**
   * Upload template image from data URL
   */
  static async uploadTemplateImageFromDataUrl(templateId: string, dataUrl: string): Promise<string> {
    try {
      // Convert data URL to blob
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      
      // Create file reference
      const timestamp = Date.now();
      const imageRef = ref(storage, `${this.TEMPLATE_IMAGES_PATH}/${templateId}/template-${timestamp}.png`);
      
      // Upload the blob
      const snapshot = await uploadBytes(imageRef, blob);
      return await getDownloadURL(snapshot.ref);
    } catch (error) {
      console.error('Error uploading template image from data URL:', error);
      throw new Error('Failed to upload template image');
    }
  }

  /**
   * Create a new certificate template
   */
  static async createTemplate(templateData: Omit<CertificateTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>): Promise<string> {
    try {
      // Generate a new template ID
      const templateRef = doc(collection(db, this.TEMPLATES_COLLECTION));
      const templateId = templateRef.id;

      // Upload image if it's a data URL
      let templateImageUrl = templateData.templateImageUrl;
      if (templateImageUrl && templateImageUrl.startsWith('data:')) {
        templateImageUrl = await this.uploadTemplateImageFromDataUrl(templateId, templateImageUrl);
      }

      // Create the template document
      const template: Omit<CertificateTemplate, 'id'> = {
        ...templateData,
        templateImageUrl: templateImageUrl || '',
        usageCount: 0,
        createdAt: serverTimestamp() as any,
        updatedAt: serverTimestamp() as any
      };

      await setDoc(templateRef, template);
      return templateId;
    } catch (error) {
      console.error('Error creating certificate template:', error);
      throw new Error('Failed to create certificate template');
    }
  }

  /**
   * Get all certificate templates
   */
  static async getAllTemplates(): Promise<CertificateTemplate[]> {
    try {
      const templatesQuery = query(
        collection(db, this.TEMPLATES_COLLECTION),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(templatesQuery);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as CertificateTemplate));
    } catch (error) {
      console.error('Error fetching certificate templates:', error);
      throw new Error('Failed to fetch certificate templates');
    }
  }

  /**
   * Get certificate template by ID
   */
  static async getTemplateById(templateId: string): Promise<CertificateTemplate | null> {
    try {
      const templateRef = doc(db, this.TEMPLATES_COLLECTION, templateId);
      const templateSnap = await getDoc(templateRef);
      
      if (templateSnap.exists()) {
        return {
          id: templateSnap.id,
          ...templateSnap.data()
        } as CertificateTemplate;
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching certificate template:', error);
      throw new Error('Failed to fetch certificate template');
    }
  }

  /**
   * Update certificate template
   */
  static async updateTemplate(templateId: string, updates: Partial<CertificateTemplate>): Promise<void> {
    try {
      const templateRef = doc(db, this.TEMPLATES_COLLECTION, templateId);
      await updateDoc(templateRef, {
        ...updates,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating certificate template:', error);
      throw new Error('Failed to update certificate template');
    }
  }

  /**
   * Delete certificate template
   */
  static async deleteTemplate(templateId: string): Promise<void> {
    try {
      // Delete template document
      const templateRef = doc(db, this.TEMPLATES_COLLECTION, templateId);
      await deleteDoc(templateRef);

      // Delete template images from storage
      try {
        const imagesRef = ref(storage, `${this.TEMPLATE_IMAGES_PATH}/${templateId}`);
        await deleteObject(imagesRef);
      } catch (error) {
        // Ignore if files don't exist
        console.warn('Template images not found or already deleted');
      }
    } catch (error) {
      console.error('Error deleting certificate template:', error);
      throw new Error('Failed to delete certificate template');
    }
  }

  /**
   * Generate certificate for a user
   */
  static async generateCertificate(data: {
    templateId: string;
    recipientName: string;
    recipientEmail: string;
    eventId: string;
    eventTitle: string;
    userId?: string;
    registrationId?: string;
  }): Promise<string> {
    try {
      // Call Firebase Function to generate certificate
      const generateCertificate = httpsCallable(functions, 'generateCertificate');
      const result = await generateCertificate(data);
      
      const response = result.data as { success: boolean; certificateId?: string; message?: string };
      if (!response.success) {
        throw new Error(response.message || 'Failed to generate certificate');
      }
      
      // Increment template usage count
      const templateRef = doc(db, this.TEMPLATES_COLLECTION, data.templateId);
      await updateDoc(templateRef, {
        usageCount: (await getDoc(templateRef)).data()?.usageCount + 1 || 1,
        updatedAt: serverTimestamp()
      });
      
      return response.certificateId!;
    } catch (error) {
      console.error('Error generating certificate:', error);
      throw new Error('Failed to generate certificate');
    }
  }

  /**
   * Get all issued certificates
   */
  static async getAllIssuedCertificates(): Promise<IssuedCertificate[]> {
    try {
      const certificatesQuery = query(
        collection(db, this.CERTIFICATES_COLLECTION),
        orderBy('issuedAt', 'desc')
      );
      const snapshot = await getDocs(certificatesQuery);
      
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          templateId: data.templateId,
          templateName: data.templateName || 'Unknown Template',
          recipientName: data.recipientName,
          recipientEmail: data.recipientEmail || '',
          eventTitle: data.eventTitle,
          issuedDate: data.issuedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          verificationCode: data.credentialId,
          status: data.isVerified ? 'issued' : 'issued',
          downloadCount: data.downloadCount || 0,
          certificateUrl: data.certificateUrl || ''
        } as IssuedCertificate;
      });
    } catch (error) {
      console.error('Error fetching issued certificates:', error);
      throw new Error('Failed to fetch issued certificates');
    }
  }

  /**
   * Get certificates for a specific event
   */
  static async getCertificatesByEvent(eventId: string): Promise<IssuedCertificate[]> {
    try {
      const certificatesQuery = query(
        collection(db, this.CERTIFICATES_COLLECTION),
        where('eventId', '==', eventId),
        orderBy('issuedAt', 'desc')
      );
      const snapshot = await getDocs(certificatesQuery);
      
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          templateId: data.templateId,
          templateName: data.templateName || 'Unknown Template',
          recipientName: data.recipientName,
          recipientEmail: data.recipientEmail || '',
          eventTitle: data.eventTitle,
          issuedDate: data.issuedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          verificationCode: data.credentialId,
          status: data.isVerified ? 'issued' : 'issued',
          downloadCount: data.downloadCount || 0,
          certificateUrl: data.certificateUrl || ''
        } as IssuedCertificate;
      });
    } catch (error) {
      console.error('Error fetching certificates by event:', error);
      throw new Error('Failed to fetch certificates by event');
    }
  }

  /**
   * Verify certificate by verification code
   */
  static async verifyCertificate(verificationCode: string): Promise<{
    isValid: boolean;
    recipientName?: string;
    eventTitle?: string;
    eventDate?: string;
    issuedDate?: string;
    certificateUrl?: string;
  }> {
    try {
      const certificatesQuery = query(
        collection(db, this.CERTIFICATES_COLLECTION),
        where('credentialId', '==', verificationCode.toUpperCase()),
        limit(1)
      );
      const snapshot = await getDocs(certificatesQuery);
      
      if (snapshot.empty) {
        return { isValid: false };
      }
      
      const certificate = snapshot.docs[0].data();
      
      // Increment verification count
      await updateDoc(snapshot.docs[0].ref, {
        verificationCount: (certificate.verificationCount || 0) + 1
      });
      
      return {
        isValid: true,
        recipientName: certificate.recipientName,
        eventTitle: certificate.eventTitle,
        eventDate: certificate.eventDate,
        issuedDate: certificate.issuedAt?.toDate?.()?.toISOString(),
        certificateUrl: certificate.certificateUrl
      };
    } catch (error) {
      console.error('Error verifying certificate:', error);
      throw new Error('Failed to verify certificate');
    }
  }

  /**
   * Get certificate by ID
   */
  static async getCertificateById(certificateId: string): Promise<Certificate | null> {
    try {
      const certificateRef = doc(db, this.CERTIFICATES_COLLECTION, certificateId);
      const certificateSnap = await getDoc(certificateRef);
      
      if (certificateSnap.exists()) {
        return {
          id: certificateSnap.id,
          ...certificateSnap.data()
        } as Certificate;
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching certificate:', error);
      throw new Error('Failed to fetch certificate');
    }
  }

  /**
   * Revoke certificate
   */
  static async revokeCertificate(certificateId: string, reason?: string): Promise<void> {
    try {
      const certificateRef = doc(db, this.CERTIFICATES_COLLECTION, certificateId);
      await updateDoc(certificateRef, {
        isVerified: false,
        revokedAt: serverTimestamp(),
        revokeReason: reason || 'Revoked by admin'
      });
    } catch (error) {
      console.error('Error revoking certificate:', error);
      throw new Error('Failed to revoke certificate');
    }
  }

  /**
   * Get certificate statistics
   */
  static async getCertificateStats(): Promise<{
    totalTemplates: number;
    totalIssued: number;
    totalVerified: number;
    totalDownloads: number;
  }> {
    try {
      // Get template count
      const templatesSnapshot = await getDocs(collection(db, this.TEMPLATES_COLLECTION));
      const totalTemplates = templatesSnapshot.size;

      // Get certificate stats
      const certificatesSnapshot = await getDocs(collection(db, this.CERTIFICATES_COLLECTION));
      let totalIssued = certificatesSnapshot.size;
      let totalVerified = 0;
      let totalDownloads = 0;

      certificatesSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.isVerified) totalVerified++;
        totalDownloads += data.downloadCount || 0;
      });

      return {
        totalTemplates,
        totalIssued,
        totalVerified,
        totalDownloads
      };
    } catch (error) {
      console.error('Error fetching certificate stats:', error);
      throw new Error('Failed to fetch certificate stats');
    }
  }
} 