import { ref, getDownloadURL } from 'firebase/storage';
import { storage } from '../config/firebase';

/**
 * Convert a Firebase Storage path to a download URL
 * @param storagePath - The full path from Firebase Storage (e.g., 'payment-proofs/reg123/proof-456.jpg')
 * @returns Promise resolving to the download URL, or null if conversion fails
 */
export const getDownloadUrlFromPath = async (storagePath: string): Promise<string | null> => {
  try {
    // If it's already a download URL (starts with https://), return as is
    if (storagePath.startsWith('https://')) {
      return storagePath;
    }

    // Convert storage path to storage reference and get download URL
    const storageRef = ref(storage, storagePath);
    const downloadUrl = await getDownloadURL(storageRef);
    return downloadUrl;
  } catch (error) {
    console.error('Failed to get download URL for storage path:', storagePath, error);
    return null;
  }
};

/**
 * Convert multiple storage paths to download URLs
 * @param storagePaths - Array of storage paths
 * @returns Promise resolving to array of download URLs (null for failed conversions)
 */
export const getDownloadUrlsFromPaths = async (storagePaths: string[]): Promise<(string | null)[]> => {
  return Promise.all(storagePaths.map(path => getDownloadUrlFromPath(path)));
};
