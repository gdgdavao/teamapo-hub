#!/usr/bin/env node

/**
 * Backfill `organizerUid` on flat event-scoped collections.
 *
 * firestore.rules scopes attendee PII by `organizerUid` first, falling back to an
 * event-ownership lookup for docs that lack it. This script populates the field so
 * the cheap path applies and the rules can ship.
 *
 * Idempotent: docs that already have a non-empty organizerUid are skipped.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=./firebase-service-account.json \
 *   FIREBASE_PROJECT_ID=<project> node scripts/backfill-organizer-uid.cjs [--dry-run]
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const DRY_RUN = process.argv.includes('--dry-run');
const COLLECTIONS = ['registrations', 'feedback', 'activity_logs'];

const projectId =
  process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;

if (!projectId) throw new Error('FIREBASE_PROJECT_ID is required.');
if (!credentials) throw new Error('GOOGLE_APPLICATION_CREDENTIALS is required.');

initializeApp({ credential: cert(credentials), projectId });
const db = getFirestore();

async function organizerUidFor(eventId, cache) {
  if (cache.has(eventId)) return cache.get(eventId);
  const snap = await db.collection('events').doc(eventId).get();
  const uid = snap.exists ? (snap.data().organizer || {}).uid || '' : '';
  cache.set(eventId, uid);
  return uid;
}

async function run() {
  const eventCache = new Map();
  let scanned = 0;
  let updated = 0;
  let skipped = 0;
  let orphaned = 0;

  for (const name of COLLECTIONS) {
    const snapshot = await db.collection(name).get();
    console.log(`\n${name}: ${snapshot.size} docs`);

    const batch = db.batch();
    let pending = 0;

    for (const doc of snapshot.docs) {
      scanned += 1;
      const data = doc.data();

      if (data.organizerUid) {
        skipped += 1;
        continue;
      }
      if (!data.eventId) {
        orphaned += 1;
        continue;
      }

      const uid = await organizerUidFor(data.eventId, eventCache);
      if (!uid) {
        orphaned += 1;
        console.warn(`  ! ${doc.id} references missing event ${data.eventId}`);
        continue;
      }

      batch.update(doc.ref, { organizerUid: uid });
      pending += 1;

      if (pending === 400) {
        if (!DRY_RUN) await batch.commit();
        updated += pending;
        pending = 0;
      }
    }

    if (pending > 0) {
      if (!DRY_RUN) await batch.commit();
      updated += pending;
    }
  }

  console.log(
    `\n${DRY_RUN ? '[DRY RUN] ' : ''}scanned=${scanned} updated=${updated} already-set=${skipped} orphaned=${orphaned}`
  );
  if (DRY_RUN) console.log('Re-run without --dry-run to apply.');
}

run().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});