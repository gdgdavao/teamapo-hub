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
  limit
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { db, storage, functions } from '../config/firebase';
import { logger } from '../utils/logger';
import { PaymentProof, PaymentDetails } from '../types';
import { NotificationService } from './notificationService';

export interface PaymentVerificationData {
  id: string;
  registrationId: string;
  attendeeName: string;
  attendeeEmail: string;
  eventTitle: string;
  eventDate: string;
  ticketPrice: number;
  proofImageUrl?: string;
  transactionId?: string;
  submittedAt: string;
  verificationStatus: 'pending' | 'approved' | 'rejected';
  verifiedAt?: string;
  verifiedBy?: string;
  notes?: string;
}

export class PaymentService {
  private static readonly PAYMENT_PROOFS_COLLECTION = 'paymentProofs';
  private static readonly REGISTRATIONS_COLLECTION = 'registrations';
  private static readonly PAYMENT_PROOFS_PATH = 'payment-proofs';

  /**
   * Upload payment proof image to Firebase Storage
   */
  static async uploadPaymentProof(registrationId: string, imageFile: File): Promise<string> {
    try {
      const timestamp = Date.now();
      // Use file extension from original file, fallback to jpg
      const fileExtension = imageFile.name.split('.').pop()?.toLowerCase() || 'jpg';
      const safeExtension = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'].includes(fileExtension) 
        ? fileExtension 
        : 'jpg';
      
      const imageRef = ref(storage, `${this.PAYMENT_PROOFS_PATH}/${registrationId}/proof-${timestamp}.${safeExtension}`);
      
      // Normalize content type, ensuring it's always set for CORS compliance
      let contentType = imageFile.type;
      if (!contentType || !contentType.startsWith('image/')) {
        // Infer from extension if type is missing (Safari issue)
        const typeMap: Record<string, string> = {
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'png': 'image/png',
          'gif': 'image/gif',
          'webp': 'image/webp',
          'heic': 'image/heic',
          'heif': 'image/heif'
        };
        contentType = typeMap[safeExtension] || 'image/jpeg';
      }

      logger.log(`[PaymentService] Uploading payment proof: ${imageRef.fullPath}, type: ${contentType}`);
      
      const snapshot = await uploadBytes(imageRef, imageFile, { 
        contentType,
        customMetadata: {
          registrationId,
          uploadedAt: new Date().toISOString()
        }
      });

      logger.log(`[PaymentService] Upload successful: ${snapshot.ref.fullPath}`);

      // Try to obtain a download URL (for authenticated users or if rules allow)
      try {
        const downloadUrl = await getDownloadURL(snapshot.ref);
        return downloadUrl;
      } catch (urlError) {
        logger.warn('[PaymentService] Could not get download URL, using storage path:', urlError);
        // Fallback: return storage path for server-side access
        return snapshot.ref.fullPath;
      }
    } catch (error: any) {
      logger.error('[PaymentService] Error uploading payment proof:', error);
      
      // Provide more specific error messages
      if (error?.code === 'storage/unauthorized') {
        throw new Error('Upload failed: Permission denied. Please try again or contact support.');
      } else if (error?.code === 'storage/canceled') {
        throw new Error('Upload was canceled. Please try again.');
      } else if (error?.code === 'storage/unknown') {
        throw new Error('Upload failed due to network error. Please check your connection and try again.');
      } else if (error?.message?.includes('CORS')) {
        throw new Error('Upload failed due to browser security settings. Please try a different browser or contact support.');
      }
      
      throw new Error('Failed to upload payment proof. Please try again.');
    }
  }

  /**
   * Submit payment proof for verification
   */
  static async submitPaymentProof(data: {
    registrationId: string;
    attendeeName: string;
    attendeeEmail: string;
    eventTitle: string;
    eventId: string;
    ticketPrice: number;
    proofImageFile?: File;
    proofImageUrl?: string;
    transactionId?: string;
    paymentMethod?: string;
    notes?: string;
  }): Promise<string> {
    try {
      // Generate a new payment proof ID
      const proofRef = doc(collection(db, this.PAYMENT_PROOFS_COLLECTION));
      const proofId = proofRef.id;

      // Upload proof image if provided
      let proofImageUrl = data.proofImageUrl;
      if (data.proofImageFile) {
        proofImageUrl = await this.uploadPaymentProof(data.registrationId, data.proofImageFile);
      }

      // Create payment proof document
      const paymentProof: Omit<PaymentProof, 'id'> = {
        registrationId: data.registrationId,
        proofImageUrl,
        transactionId: data.transactionId,
        submittedAt: serverTimestamp() as any,
        verificationStatus: 'pending',
        notes: data.notes
      };

      // Additional data for admin view
      // Ensure required fields for Firestore rules
      const safeAttendeeEmail = (typeof data.attendeeEmail === 'string' && /.+@.+\..+/.test(data.attendeeEmail))
        ? data.attendeeEmail
        : 'anon@placeholder.local';

      const proofData = {
        ...paymentProof,
        attendeeName: data.attendeeName,
        attendeeEmail: safeAttendeeEmail,
        // Add top-level email for compatibility with deployed Firestore rules
        email: safeAttendeeEmail,
        eventTitle: data.eventTitle,
        eventId: data.eventId,
        ticketPrice: data.ticketPrice,
        paymentMethod: data.paymentMethod || 'bank_transfer',
        // Add userDetails to satisfy Firestore rules expecting userDetails.email
        userDetails: {
          name: data.attendeeName,
          email: safeAttendeeEmail
        }
      };

      // Clean undefined values to avoid Firestore null/undefined errors
      const cleanProofData = Object.fromEntries(
        Object.entries(proofData).map(([k, v]) => {
          if (v && typeof v === 'object' && !('toDate' in (v as any))) {
            // Deep-clean one level for nested userDetails
            const cleaned = Object.fromEntries(Object.entries(v as any).filter(([_, val]) => val !== undefined));
            return [k, cleaned];
          }
          return [k, v];
        }).filter(([_, v]) => v !== undefined)
      );

      // Debug and validate payload against Firestore rules expectations
      try {
        const debugPayload = {
          email: (cleanProofData as any).email,
          eventId: (cleanProofData as any).eventId,
          verificationStatus: (cleanProofData as any).verificationStatus,
          userDetailsEmail: (cleanProofData as any)?.userDetails?.email
        };
        // eslint-disable-next-line no-console
        console.debug('[PaymentService] submitPaymentProof payload preview:', debugPayload);

        const emailOk = typeof (cleanProofData as any).email === 'string' && /.+@.+\..+/.test((cleanProofData as any).email);
        const eventIdOk = typeof (cleanProofData as any).eventId === 'string' && (cleanProofData as any).eventId.length > 0;
        const statusOk = (cleanProofData as any).verificationStatus === 'pending';

        if (!emailOk || !eventIdOk || !statusOk) {
          // eslint-disable-next-line no-console
          logger.error('[PaymentService] submitPaymentProof validation failed', { emailOk, eventIdOk, statusOk, cleanProofData });
        }
      } catch (debugErr) {
        // eslint-disable-next-line no-console
        logger.warn('[PaymentService] submitPaymentProof debug failed:', debugErr);
      }

      await setDoc(proofRef, cleanProofData);

    // Update registration status
      try {
        const registrationRef = doc(db, this.REGISTRATIONS_COLLECTION, data.registrationId);
        await updateDoc(registrationRef, {
          paymentStatus: 'processing',
          paymentProofId: proofId,
      updatedAt: serverTimestamp(),
      paymentLinkStatus: 'consumed'
        });
      } catch (e) {
        // Likely unauthenticated update; ignore and proceed
        logger.warn('Skipping registration update (unauthenticated):', e);
      }

      // Send notification to admin about new payment proof
      try {
        // Get admin users to notify
        const adminQuery = query(
          collection(db, 'users'),
          where('role', '==', 'admin')
        );
        const adminSnapshot = await getDocs(adminQuery);

        adminSnapshot.docs.forEach(async (adminDoc) => {
          await NotificationService.createNotification(
            adminDoc.id,
            'event_update',
            'New Payment Proof Submitted',
            `${data.attendeeName} submitted payment proof for "${data.eventTitle}" (₱${data.ticketPrice})`,
            {
              proofId,
              registrationId: data.registrationId,
              eventId: data.eventId,
              attendeeEmail: data.attendeeEmail,
              amount: data.ticketPrice
            }
          );
        });
      } catch (error) {
        logger.warn('Failed to create payment proof notification:', error);
      }

      return proofId;
    } catch (error) {
      logger.error('Error submitting payment proof:', error);
      throw new Error('Failed to submit payment proof');
    }
  }

  /**
   * Get all payment proofs for admin verification
   */
  static async getAllPaymentProofs(): Promise<PaymentVerificationData[]> {
    try {
      const proofsQuery = query(
        collection(db, this.PAYMENT_PROOFS_COLLECTION),
        orderBy('submittedAt', 'desc')
      );
      const snapshot = await getDocs(proofsQuery);
      
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          registrationId: data.registrationId,
          attendeeName: data.attendeeName,
          attendeeEmail: data.attendeeEmail,
          eventTitle: data.eventTitle,
          eventDate: data.eventDate || new Date().toISOString(),
          ticketPrice: data.ticketPrice,
          proofImageUrl: data.proofImageUrl,
          transactionId: data.transactionId,
          submittedAt: data.submittedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          verificationStatus: data.verificationStatus,
          verifiedAt: data.verifiedAt?.toDate?.()?.toISOString(),
          verifiedBy: data.verifiedBy,
          notes: data.notes
        } as PaymentVerificationData;
      });
    } catch (error) {
      logger.error('Error fetching payment proofs:', error);
      throw new Error('Failed to fetch payment proofs');
    }
  }

  /**
   * Get payment proofs by status
   */
  static async getPaymentProofsByStatus(status: 'pending' | 'approved' | 'rejected'): Promise<PaymentVerificationData[]> {
    try {
      const proofsQuery = query(
        collection(db, this.PAYMENT_PROOFS_COLLECTION),
        where('verificationStatus', '==', status),
        orderBy('submittedAt', 'desc')
      );
      const snapshot = await getDocs(proofsQuery);
      
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          registrationId: data.registrationId,
          attendeeName: data.attendeeName,
          attendeeEmail: data.attendeeEmail,
          eventTitle: data.eventTitle,
          eventDate: data.eventDate || new Date().toISOString(),
          ticketPrice: data.ticketPrice,
          proofImageUrl: data.proofImageUrl,
          transactionId: data.transactionId,
          submittedAt: data.submittedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          verificationStatus: data.verificationStatus,
          verifiedAt: data.verifiedAt?.toDate?.()?.toISOString(),
          verifiedBy: data.verifiedBy,
          notes: data.notes
        } as PaymentVerificationData;
      });
    } catch (error) {
      logger.error('Error fetching payment proofs by status:', error);
      throw new Error('Failed to fetch payment proofs by status');
    }
  }

  /**
   * Verify payment proof (approve or reject)
   */
  static async verifyPaymentProof(
    proofId: string, 
    status: 'approved' | 'rejected', 
    verifierUid: string,
    verifierName: string,
    notes?: string
  ): Promise<void> {
    try {
      // Update payment proof status
      const proofRef = doc(db, this.PAYMENT_PROOFS_COLLECTION, proofId);
      await updateDoc(proofRef, {
        verificationStatus: status,
        verifiedAt: serverTimestamp(),
        verifiedBy: verifierName,
        verifierUid: verifierUid,
        notes: notes || ''
      });

      // Get the payment proof data to update registration
      const proofSnap = await getDoc(proofRef);
      if (proofSnap.exists()) {
        const proofData = proofSnap.data();
        const registrationRef = doc(db, this.REGISTRATIONS_COLLECTION, proofData.registrationId);
        
        // Update registration payment status
        const newPaymentStatus = status === 'approved' ? 'paid' : 'failed';
        await updateDoc(registrationRef, {
          paymentStatus: newPaymentStatus,
          updatedAt: serverTimestamp()
        });

        // If approved, update payment details
        if (status === 'approved') {
          const paymentDetails: Partial<PaymentDetails> = {
            paymentId: proofId,
            paymentMethod: 'qrph' as any,
            paymentProvider: 'paymongo' as any,
            transactionId: proofData.transactionId || 'manual_verification',
            paidAt: serverTimestamp() as any,
            fees: {
              processingFee: 0,
              platformFee: 0
            }
          };

          await updateDoc(registrationRef, {
            paymentDetails: paymentDetails
          });
        }

        // Send notification to attendee via Firebase Function
        try {
          const sendPaymentNotification = httpsCallable(functions, 'sendPaymentNotification');
          await sendPaymentNotification({
            registrationId: proofData.registrationId,
            status: status,
            eventTitle: proofData.eventTitle,
            attendeeEmail: proofData.attendeeEmail,
            attendeeName: proofData.attendeeName
          });
        } catch (notificationError) {
          logger.warn('Failed to send payment notification:', notificationError);
          // Don't throw error for notification failure
        }

        // Send notification to attendee about payment verification
        try {
          // Get the registration to find the user ID (if available)
          const registrationRef = doc(db, this.REGISTRATIONS_COLLECTION, proofData.registrationId);
          const registrationSnap = await getDoc(registrationRef);

          if (registrationSnap.exists()) {
            const registrationData = registrationSnap.data();
            // If userId exists in registration, send them a notification
            if (registrationData.userId) {
              const notificationType = status === 'approved' ? 'payment_success' : 'event_update';
              const title = status === 'approved' ? 'Payment Approved' : 'Payment Rejected';
              const message = status === 'approved'
                ? `Your payment for "${proofData.eventTitle}" has been approved!`
                : `Your payment for "${proofData.eventTitle}" has been rejected. Please check your payment details.`;

              await NotificationService.createNotification(
                registrationData.userId,
                notificationType,
                title,
                message,
                {
                  registrationId: proofData.registrationId,
                  eventTitle: proofData.eventTitle,
                  amount: proofData.ticketPrice,
                  status: status
                }
              );
            }
          }
        } catch (error) {
          logger.warn('Failed to create payment verification notification:', error);
        }
      }
    } catch (error) {
      logger.error('Error verifying payment proof:', error);
      throw new Error('Failed to verify payment proof');
    }
  }

  /**
   * Get payment proof by ID
   */
  static async getPaymentProofById(proofId: string): Promise<PaymentVerificationData | null> {
    try {
      const proofRef = doc(db, this.PAYMENT_PROOFS_COLLECTION, proofId);
      const proofSnap = await getDoc(proofRef);
      
      if (proofSnap.exists()) {
        const data = proofSnap.data();
        return {
          id: proofSnap.id,
          registrationId: data.registrationId,
          attendeeName: data.attendeeName,
          attendeeEmail: data.attendeeEmail,
          eventTitle: data.eventTitle,
          eventDate: data.eventDate || new Date().toISOString(),
          ticketPrice: data.ticketPrice,
          proofImageUrl: data.proofImageUrl,
          transactionId: data.transactionId,
          submittedAt: data.submittedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          verificationStatus: data.verificationStatus,
          verifiedAt: data.verifiedAt?.toDate?.()?.toISOString(),
          verifiedBy: data.verifiedBy,
          notes: data.notes
        } as PaymentVerificationData;
      }
      
      return null;
    } catch (error) {
      logger.error('Error fetching payment proof:', error);
      throw new Error('Failed to fetch payment proof');
    }
  }

  /**
   * Get the most recent payment proof for a registration
   */
  static async getLatestPaymentProofByRegistrationId(registrationId: string): Promise<PaymentVerificationData | null> {
    try {
      const proofsQuery = query(
        collection(db, this.PAYMENT_PROOFS_COLLECTION),
        where('registrationId', '==', registrationId),
        orderBy('submittedAt', 'desc'),
        limit(1)
      );
      const snapshot = await getDocs(proofsQuery);

      if (snapshot.empty) return null;

      const docSnap = snapshot.docs[0];
      const data = docSnap.data();
      return {
        id: docSnap.id,
        registrationId: data.registrationId,
        attendeeName: data.attendeeName,
        attendeeEmail: data.attendeeEmail,
        eventTitle: data.eventTitle,
        eventDate: data.eventDate || new Date().toISOString(),
        ticketPrice: data.ticketPrice,
        proofImageUrl: data.proofImageUrl,
        transactionId: data.transactionId,
        submittedAt: data.submittedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        verificationStatus: data.verificationStatus,
        verifiedAt: data.verifiedAt?.toDate?.()?.toISOString(),
        verifiedBy: data.verifiedBy,
        notes: data.notes
      } as PaymentVerificationData;
    } catch (error: any) {
      // Check if it's an index error
      if (error?.code === 'failed-precondition' || error?.message?.includes('index')) {
        logger.warn('[PaymentService] Firestore index required. Falling back to client-side sorting.');
        
        // Fallback: Get all proofs for this registration and sort client-side
        try {
          const fallbackQuery = query(
            collection(db, this.PAYMENT_PROOFS_COLLECTION),
            where('registrationId', '==', registrationId)
          );
          const fallbackSnapshot = await getDocs(fallbackQuery);
          
          if (fallbackSnapshot.empty) return null;
          
          // Sort client-side by submittedAt (descending)
          const sortedDocs = fallbackSnapshot.docs.sort((a, b) => {
            const aTime = a.data().submittedAt?.toDate?.()?.getTime() || 0;
            const bTime = b.data().submittedAt?.toDate?.()?.getTime() || 0;
            return bTime - aTime;
          });
          
          const docSnap = sortedDocs[0];
          const data = docSnap.data();
          
          return {
            id: docSnap.id,
            registrationId: data.registrationId,
            attendeeName: data.attendeeName,
            attendeeEmail: data.attendeeEmail,
            eventTitle: data.eventTitle,
            eventDate: data.eventDate || new Date().toISOString(),
            ticketPrice: data.ticketPrice,
            proofImageUrl: data.proofImageUrl,
            transactionId: data.transactionId,
            submittedAt: data.submittedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
            verificationStatus: data.verificationStatus,
            verifiedAt: data.verifiedAt?.toDate?.()?.toISOString(),
            verifiedBy: data.verifiedBy,
            notes: data.notes
          } as PaymentVerificationData;
        } catch (fallbackError) {
          logger.error('[PaymentService] Fallback query also failed:', fallbackError);
          throw new Error('Failed to fetch payment proof - please contact support');
        }
      }
      
      logger.error('Error fetching latest payment proof by registration:', error);
      throw new Error('Failed to fetch payment proof');
    }
  }

  /**
   * Get payment statistics for admin dashboard
   */
  static async getPaymentStats(): Promise<{
    totalProofs: number;
    pendingProofs: number;
    approvedProofs: number;
    rejectedProofs: number;
    totalRevenue: number;
  }> {
    try {
      // Get all payment proofs
      const proofsSnapshot = await getDocs(collection(db, this.PAYMENT_PROOFS_COLLECTION));
      
      let totalProofs = proofsSnapshot.size;
      let pendingProofs = 0;
      let approvedProofs = 0;
      let rejectedProofs = 0;
      let totalRevenue = 0;

      proofsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        switch (data.verificationStatus) {
          case 'pending':
            pendingProofs++;
            break;
          case 'approved':
            approvedProofs++;
            totalRevenue += data.ticketPrice || 0;
            break;
          case 'rejected':
            rejectedProofs++;
            break;
        }
      });

      return {
        totalProofs,
        pendingProofs,
        approvedProofs,
        rejectedProofs,
        totalRevenue
      };
    } catch (error) {
      logger.error('Error fetching payment stats:', error);
      throw new Error('Failed to fetch payment stats');
    }
  }

  /**
   * Delete payment proof (admin only)
   */
  static async deletePaymentProof(proofId: string): Promise<void> {
    try {
      // Get proof data first to delete associated files
      const proofRef = doc(db, this.PAYMENT_PROOFS_COLLECTION, proofId);
      const proofSnap = await getDoc(proofRef);
      
      if (proofSnap.exists()) {
        const proofData = proofSnap.data();
        
        // Delete proof image from storage if exists
        if (proofData.proofImageUrl) {
          try {
            const imageRef = ref(storage, proofData.proofImageUrl);
            await deleteObject(imageRef);
          } catch (error) {
            logger.warn('Proof image not found or already deleted');
          }
        }
        
        // Delete proof document
        await deleteDoc(proofRef);
        
        // Update registration to remove payment proof reference
        if (proofData.registrationId) {
          const registrationRef = doc(db, this.REGISTRATIONS_COLLECTION, proofData.registrationId);
          await updateDoc(registrationRef, {
            paymentProofId: null,
            paymentStatus: 'pending',
            updatedAt: serverTimestamp()
          });
        }
      }
    } catch (error) {
      logger.error('Error deleting payment proof:', error);
      throw new Error('Failed to delete payment proof');
    }
  }

  /**
   * Bulk verify payment proofs
   */
  static async bulkVerifyPaymentProofs(
    proofIds: string[], 
    status: 'approved' | 'rejected',
    verifierUid: string,
    verifierName: string,
    notes?: string
  ): Promise<void> {
    try {
      const verificationPromises = proofIds.map(proofId => 
        this.verifyPaymentProof(proofId, status, verifierUid, verifierName, notes)
      );
      
      await Promise.all(verificationPromises);
    } catch (error) {
      logger.error('Error bulk verifying payment proofs:', error);
      throw new Error('Failed to bulk verify payment proofs');
    }
  }

  /**
   * Get payment proofs for a specific event
   */
  static async getPaymentProofsByEvent(eventId: string): Promise<PaymentVerificationData[]> {
    try {
      const proofsQuery = query(
        collection(db, this.PAYMENT_PROOFS_COLLECTION),
        where('eventId', '==', eventId),
        orderBy('submittedAt', 'desc')
      );
      const snapshot = await getDocs(proofsQuery);
      
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          registrationId: data.registrationId,
          attendeeName: data.attendeeName,
          attendeeEmail: data.attendeeEmail,
          eventTitle: data.eventTitle,
          eventDate: data.eventDate || new Date().toISOString(),
          ticketPrice: data.ticketPrice,
          proofImageUrl: data.proofImageUrl,
          transactionId: data.transactionId,
          submittedAt: data.submittedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          verificationStatus: data.verificationStatus,
          verifiedAt: data.verifiedAt?.toDate?.()?.toISOString(),
          verifiedBy: data.verifiedBy,
          notes: data.notes
        } as PaymentVerificationData;
      });
    } catch (error) {
      logger.error('Error fetching payment proofs by event:', error);
      throw new Error('Failed to fetch payment proofs by event');
    }
  }
} 