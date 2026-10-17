/**
 * Firestore Emulator Inspection Tools for Apohub Dev MCP Server
 * Follows SOLID, KISS, and Data Privacy Act (Philippines) rules.
 */

import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getFirestore, Firestore, Timestamp, DocumentData } from 'firebase-admin/firestore';

export const ALLOWED_COLLECTIONS = [
  'events',
  'users',
  'registrations',
  'payments',
  'paymentProofs',
  'payment_verifications',
  'feedback',
  'certificates',
  'certificateTemplates',
  'activity_logs',
  'email_logs',
  'forms',
  'settings'
] as const;

export type AllowedCollection = (typeof ALLOWED_COLLECTIONS)[number];

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordHash',
  'salt',
  'token',
  'refreshToken',
  'secret',
  'apiKey',
  'privateKey'
]);

let adminApp: App | null = null;
let firestoreDb: Firestore | null = null;

export function getFirestoreInstance(): Firestore {
  if (firestoreDb) return firestoreDb;

  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
  process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';

  const existingApps = getApps();
  if (existingApps.length > 0) {
    adminApp = existingApps[0];
  } else {
    const projectId = process.env.GCLOUD_PROJECT || 'demo-apohub';
    adminApp = initializeApp({ projectId });
  }

  firestoreDb = getFirestore(adminApp);
  return firestoreDb;
}

/**
 * Sanitize Firestore document to comply with Data Privacy Act of 2012 (Philippines)
 * and convert Timestamps to ISO strings for JSON serialization.
 */
export function sanitizeDocument(data: DocumentData | undefined): Record<string, unknown> {
  if (!data || typeof data !== 'object') return {};

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_KEYS.has(key)) {
      sanitized[key] = '[REDACTED]';
      continue;
    }

    if (value instanceof Timestamp) {
      sanitized[key] = value.toDate().toISOString();
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      if (typeof (value as { toDate?: () => Date }).toDate === 'function') {
        sanitized[key] = (value as { toDate: () => Date }).toDate().toISOString();
      } else {
        sanitized[key] = sanitizeDocument(value as DocumentData);
      }
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map((item) =>
        item && typeof item === 'object' ? sanitizeDocument(item as DocumentData) : item
      );
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

export interface QueryOptions {
  collection: string;
  limit?: number;
  filterField?: string;
  filterValue?: unknown;
  orderByField?: string;
  orderDirection?: 'asc' | 'desc';
}

export async function queryFirestoreCollection(options: QueryOptions) {
  const { collection, limit = 10, filterField, filterValue, orderByField, orderDirection = 'desc' } = options;

  if (!ALLOWED_COLLECTIONS.includes(collection as AllowedCollection)) {
    throw new Error(
      `Access to collection "${collection}" is restricted. Allowed collections: ${ALLOWED_COLLECTIONS.join(', ')}`
    );
  }

  const db = getFirestoreInstance();
  const cappedLimit = Math.min(Math.max(1, limit), 50);

  let query: FirebaseFirestore.Query = db.collection(collection);

  if (filterField && filterValue !== undefined) {
    query = query.where(filterField, '==', filterValue);
  }

  if (orderByField) {
    query = query.orderBy(orderByField, orderDirection);
  }

  query = query.limit(cappedLimit);

  const snapshot = await query.get();
  const documents = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...sanitizeDocument(doc.data())
  }));

  return {
    collection,
    count: documents.length,
    limit: cappedLimit,
    documents
  };
}

export async function getFirestoreDocument(collection: string, docId: string) {
  if (!ALLOWED_COLLECTIONS.includes(collection as AllowedCollection)) {
    throw new Error(
      `Access to collection "${collection}" is restricted. Allowed collections: ${ALLOWED_COLLECTIONS.join(', ')}`
    );
  }

  const db = getFirestoreInstance();
  const docRef = db.collection(collection).doc(docId);
  const snap = await docRef.get();

  if (!snap.exists) {
    return {
      found: false,
      collection,
      id: docId
    };
  }

  return {
    found: true,
    collection,
    id: docId,
    data: sanitizeDocument(snap.data())
  };
}
