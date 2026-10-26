import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';
import { WalletPassUrlResult } from '../types';
import { logger } from '../utils/logger';

export interface CreateWalletPassParams {
  registrationId: string;
  walletPassToken: string;
}

export interface WalletPassServiceResponse extends Partial<WalletPassUrlResult> {
  error?: 'wallet-not-configured' | 'not-approved' | 'not-found' | 'upstream';
  message?: string;
}

export class WalletPassService {
  /**
   * Request a signed Google Wallet Save URL for an approved registration.
   */
  static async createWalletPassUrl(
    params: CreateWalletPassParams
  ): Promise<WalletPassServiceResponse> {
    try {
      const createCallable = httpsCallable<
        CreateWalletPassParams,
        WalletPassServiceResponse
      >(functions, 'createWalletPassUrl');

      const result = await createCallable(params);
      const data = result.data;

      if (data.error) {
        return {
          error: data.error,
          message: data.message || 'Google Wallet is not available.'
        };
      }

      if (!data.saveUrl) {
        return {
          error: 'upstream',
          message: 'Failed to generate wallet pass URL.'
        };
      }

      return {
        saveUrl: data.saveUrl,
        expiryAt: data.expiryAt
      };
    } catch (err: any) {
      logger.warn('[WalletPassService] createWalletPassUrl failed:', err);
      const code = err?.code || '';
      const message = err?.message || '';

      if (code === 'functions/not-found' || message.includes('not found')) {
        return { error: 'not-found', message: 'Registration record not found or link has expired.' };
      }
      if (code === 'functions/failed-precondition' || message.includes('not been approved')) {
        return { error: 'not-approved', message: 'Registration has not been approved yet.' };
      }

      return {
        error: 'upstream',
        message: 'Could not generate Google Wallet pass. Please try again later.'
      };
    }
  }
}
