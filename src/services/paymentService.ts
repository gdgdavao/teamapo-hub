import { 
  collection, 
  doc, 
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
  QueryConstraint
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
import { generateWalletPassToken } from '../utils/passArtwork';
import { PaymentProof, PaymentDetails } from '../types';
import { AuditLogService } from './auditLogService';

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
  private static readonly EVENTS_COLLECTION = 'events';
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
    paymentToken?: string;
    transactionId?: string;
    paymentMethod?: string;
    notes?: string;
  }): Promise<string> {
    try {
      if (!data.paymentToken || !data.proofImageFile) throw new Error('Payment token and image are required');
      const bytes = new Uint8Array(await data.proofImageFile.arrayBuffer());
      if (bytes.byteLength > 4 * 1024 * 1024) throw new Error('Payment proof image must be smaller than 4MB');
      let binary = '';
      bytes.forEach(byte => { binary += String.fromCharCode(byte); });
      const submit = httpsCallable(functions, 'submitAnonymousPaymentProof');
      const result = await submit({
        registrationId: data.registrationId,
        paymentToken: data.paymentToken,
        transactionId: data.transactionId,
        paymentMethod: data.paymentMethod,
        notes: data.notes,
        imageBase64: btoa(binary),
        contentType: data.proofImageFile.type || 'image/jpeg',
        fileName: data.proofImageFile.name,
      });
      return (result.data as { proofId: string }).proofId;
    } catch (error) {
      logger.error('Error submitting payment proof:', error);
      throw new Error('Failed to submit payment proof');
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
   * Verify payment proof (approve or reject).
   *
   * `notes` is deliberately absent from the write. That field belongs to the
   * attendee — it is their "Additional Notes" from PaymentPage, stored when the
   * proof is created (functions/main.py submitAnonymousPaymentProof). This
   * method used to overwrite it with `notes || ''` on every verification, which
   * silently destroyed whatever the attendee wrote.
   */
  static async verifyPaymentProof(
    proofId: string,
    status: 'approved' | 'rejected',
    verifierUid: string,
    verifierName: string
  ): Promise<void> {
    try {
      // Update payment proof status
      const proofRef = doc(db, this.PAYMENT_PROOFS_COLLECTION, proofId);
      await updateDoc(proofRef, {
        verificationStatus: status,
        verifiedAt: serverTimestamp(),
        verifiedBy: verifierName,
        verifierUid: verifierUid
      });

      // Get the payment proof data to update registration
      const proofSnap = await getDoc(proofRef);
      if (proofSnap.exists()) {
        const proofData = proofSnap.data();
        const registrationRef = doc(db, this.REGISTRATIONS_COLLECTION, proofData.registrationId);
        
        // Update registration payment status
        const newPaymentStatus = status === 'approved' ? 'paid' : 'failed';
        const regUpdate: Record<string, any> = {
          paymentStatus: newPaymentStatus,
          updatedAt: serverTimestamp()
        };

        // Mint walletPassToken if approving and token is absent
        if (status === 'approved') {
          const regSnap = await getDoc(registrationRef);
          if (regSnap.exists()) {
            const regData = regSnap.data();
            if (!regData.walletPassToken) {
              regUpdate.walletPassToken = generateWalletPassToken();
            }
          }
        }

        await updateDoc(registrationRef, regUpdate);

        // If approved, update payment details
        if (status === 'approved') {
          const paymentDetails: Partial<PaymentDetails> = {
            paymentId: proofId,
            paymentMethod: proofData.paymentMethod || 'bank_transfer',
            transactionId: proofData.transactionId || 'manual_verification',
            paidAt: serverTimestamp() as any
          };

          await updateDoc(registrationRef, {
            paymentDetails: paymentDetails
          });
        }

        // Send notification to attendee via Firebase Function
        try {
          let resolvedEventTitle = proofData.eventTitle;
          if (!resolvedEventTitle && proofData.eventId) {
            try {
              const evSnap = await getDoc(doc(db, this.EVENTS_COLLECTION, proofData.eventId));
              if (evSnap.exists()) {
                resolvedEventTitle = evSnap.data().title;
              }
            } catch {
              // ignore lookup failure
            }
          }

          const sendPaymentNotification = httpsCallable(functions, 'sendPaymentNotification');
          await sendPaymentNotification({
            registrationId: proofData.registrationId,
            status: status,
            eventTitle: resolvedEventTitle || 'Event',
            attendeeEmail: proofData.attendeeEmail,
            attendeeName: proofData.attendeeName || 'Attendee'
          });
        } catch (notificationError) {
          logger.warn('Failed to send payment notification:', notificationError);
          // Don't throw error for notification failure
        }

        void AuditLogService.recordAuditLog({
          category: 'financial',
          action: status === 'approved' ? 'payment_approved' : 'payment_rejected',
          target: {
            type: 'payment_proof',
            id: proofId,
            label: proofData.attendeeName,
          },
          details: {
            status,
            verifierName,
            verifierUid,
            registrationId: proofData.registrationId,
            eventTitle: proofData.eventTitle,
          },
        });
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
  static async getLatestPaymentProofByRegistrationId(
    registrationId: string,
    eventId?: string
  ): Promise<PaymentVerificationData | null> {
    try {
      const constraints: QueryConstraint[] = [
        where('registrationId', '==', registrationId),
      ];
      if (eventId) {
        constraints.push(where('eventId', '==', eventId));
      }
      constraints.push(orderBy('submittedAt', 'desc'), limit(1));

      const proofsQuery = query(
        collection(db, this.PAYMENT_PROOFS_COLLECTION),
        ...constraints
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
          const fallbackConstraints: QueryConstraint[] = [
            where('registrationId', '==', registrationId),
          ];
          if (eventId) {
            fallbackConstraints.push(where('eventId', '==', eventId));
          }
          const fallbackQuery = query(
            collection(db, this.PAYMENT_PROOFS_COLLECTION),
            ...fallbackConstraints
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
   * Get payment statistics for the platform dashboard
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
      
      const totalProofs = proofsSnapshot.size;
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
    verifierName: string
  ): Promise<void> {
    try {
      const verificationPromises = proofIds.map(proofId =>
        this.verifyPaymentProof(proofId, status, verifierUid, verifierName)
      );
      
      await Promise.all(verificationPromises);
    } catch (error) {
      logger.error('Error bulk verifying payment proofs:', error);
      throw new Error('Failed to bulk verify payment proofs');
    }
  }


}
