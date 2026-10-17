#!/usr/bin/env node

/**
 * Remove `attendeeEmail` / `recipientEmail` from certificate documents.
 *
 * /certificates is `allow read: if true` so the public /verify portal can read a
 * single certificate by credentialId. That same rule makes every certificate
 * holder's name and email world-readable and bulk-downloadable, which the Data
 * Privacy Act 2012 does not allow. Nothing in the client reads the email off this
 * document, so dropping the field costs nothing functionally.
 *
 * This is irreversible in place — run scripts/export-certificate-emails.cjs first.
 * Idempotent: documents without the field are skipped.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=./firebase-service-account.json \
 *   FIREBASE_PROJECT_ID=<project> node scripts/scrub-certificate-emails.cjs [--dry-run]
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const DRY_RUN = process.argv.includes('--dry-run');
const FIELDS = ['attendeeEmail', 'recipientEmail'];
const BATCH_SIZE = 400;

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;

if (!projectId) throw new Error('FIREBASE_PROJECT_ID is required.');
if (!credentials) throw new Error('GOOGLE_APPLICATION_CREDENTIALS is required.');

initializeApp({ credential: cert(credentials), projectId });
const db = getFirestore();

async function run() {
  const snapshot = await db.collection('certificates').get();
  const targets = snapshot.docs.filter((doc) => {
    const data = doc.data();
    return FIELDS.some((f) => data[f]);
  });

  console.log(`certificates scanned: ${snapshot.size}`);
  console.log(`carrying an email:   ${targets.length}`);

  if (targets.length === 0) {
    console.log('Nothing to scrub.');
    return;
  }

  if (DRY_RUN) {
    console.log('[DRY RUN] no writes performed.');
    return;
  }

  const removal = Object.fromEntries(FIELDS.map((f) => [f, FieldValue.delete()]));
  let committed = 0;

  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    const batch = db.batch();
    for (const doc of targets.slice(i, i + BATCH_SIZE)) {
      batch.update(doc.ref, removal);
    }
    await batch.commit();
    committed += Math.min(BATCH_SIZE, targets.length - i);
    console.log(`  scrubbed ${committed}/${targets.length}`);
  }

  console.log('Done. The public certificate history now exposes only name, event and date.');
}

run().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});