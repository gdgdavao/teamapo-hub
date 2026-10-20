#!/usr/bin/env node

/**
 * Migration Script: Strip event ownership across collections.
 *
 * Removes the legacy `organizer` map from `events` documents and `organizerUid`
 * from `registrations`, `certificateTemplates`, `feedback`, and `activity_logs`.
 *
 * Idempotent: documents lacking the fields are cleanly skipped.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=./firebase-service-account.json \
 *   FIREBASE_PROJECT_ID=<project> node scripts/strip-event-ownership.cjs [--dry-run]
 *
 * For local emulator:
 *   FIRESTORE_EMULATOR_HOST=localhost:8080 node scripts/strip-event-ownership.cjs [--dry-run]
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { Firestore, FieldValue } = require('@google-cloud/firestore');
const { OAuth2Client } = require('google-auth-library');

const DRY_RUN = process.argv.includes('--dry-run');

const projectId =
  process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || 'project-iris-gdgdavao';

function createDbClient() {
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    return new Firestore({ projectId });
  }

  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credPath && fs.existsSync(credPath)) {
    try {
      // Test key file format
      const keyData = JSON.parse(fs.readFileSync(credPath, 'utf8'));
      if (keyData.private_key && !keyData.private_key.includes('INVALID')) {
        return new Firestore({ projectId, keyFilename: credPath });
      }
    } catch {
      // Fall through to Firebase CLI OAuth credentials
    }
  }

  // Fallback: use Firebase CLI active OAuth credentials
  const firebaseConfigPath = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
  if (fs.existsSync(firebaseConfigPath)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
      if (cfg.tokens) {
        const authClient = new OAuth2Client();
        authClient.setCredentials(cfg.tokens);
        return new Firestore({ projectId, authClient });
      }
    } catch (e) {
      console.warn('Failed reading firebase-tools credentials:', e.message);
    }
  }

  return new Firestore({ projectId });
}

const db = createDbClient();

async function run() {
  console.log(`Starting event ownership cleanup... ${DRY_RUN ? '[DRY RUN]' : ''}`);

  // 1. Clean events collection: remove `organizer`
  const eventsSnap = await db.collection('events').get();
  console.log(`\nevents: ${eventsSnap.size} docs`);
  let eventsUpdated = 0;
  let eventsSkipped = 0;

  let batch = db.batch();
  let pending = 0;

  for (const doc of eventsSnap.docs) {
    const data = doc.data();
    if (data.organizer !== undefined) {
      batch.update(doc.ref, { organizer: FieldValue.delete() });
      pending += 1;
      eventsUpdated += 1;

      if (pending === 400) {
        if (!DRY_RUN) await batch.commit();
        batch = db.batch();
        pending = 0;
      }
    } else {
      eventsSkipped += 1;
    }
  }
  if (pending > 0 && !DRY_RUN) {
    await batch.commit();
  }
  console.log(`events: ${eventsUpdated} stripped, ${eventsSkipped} already clean`);

  // 2. Clean flat collections: remove `organizerUid`
  const FLAT_COLLECTIONS = ['registrations', 'certificateTemplates', 'feedback', 'activity_logs'];

  for (const colName of FLAT_COLLECTIONS) {
    const snap = await db.collection(colName).get();
    console.log(`\n${colName}: ${snap.size} docs`);
    let colUpdated = 0;
    let colSkipped = 0;

    batch = db.batch();
    pending = 0;

    for (const doc of snap.docs) {
      const data = doc.data();
      if (data.organizerUid !== undefined) {
        batch.update(doc.ref, { organizerUid: FieldValue.delete() });
        pending += 1;
        colUpdated += 1;

        if (pending === 400) {
          if (!DRY_RUN) await batch.commit();
          batch = db.batch();
          pending = 0;
        }
      } else {
        colSkipped += 1;
      }
    }
    if (pending > 0 && !DRY_RUN) {
      await batch.commit();
    }
    console.log(`${colName}: ${colUpdated} stripped, ${colSkipped} already clean`);
  }

  console.log(`\nMigration completed. ${DRY_RUN ? 'Run without --dry-run to commit changes.' : 'All changes committed.'}`);
}

run().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
