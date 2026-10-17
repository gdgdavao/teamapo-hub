#!/usr/bin/env node

/**
 * Back up the attendee emails on certificate documents BEFORE scrubbing them.
 *
 * /certificates is `allow read: if true` so the public verification portal works,
 * which means every certificate holder's email is world-readable. The scrub is a
 * one-way field removal (Firestore has no field-level delete), so take a copy first.
 *
 * Run once, commit the output somewhere private, then run the scrub.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=./firebase-service-account.json \
 *   FIREBASE_PROJECT_ID=<project> node scripts/export-certificate-emails.cjs [outfile]
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { writeFileSync } = require('node:fs');

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;

if (!projectId) throw new Error('FIREBASE_PROJECT_ID is required.');
if (!credentials) throw new Error('GOOGLE_APPLICATION_CREDENTIALS is required.');

const outFile = process.argv[2] || 'certificate-emails-backup.json';

initializeApp({ credential: cert(credentials), projectId });
const db = getFirestore();

async function run() {
  const snapshot = await db.collection('certificates').get();
  const rows = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const email = data.attendeeEmail ?? data.recipientEmail;
    if (!email) continue;
    rows.push({
      certificateId: doc.id,
      eventId: data.eventId ?? null,
      attendeeName: data.attendeeName ?? data.recipientName ?? null,
      email,
    });
  }

  writeFileSync(outFile, JSON.stringify(rows, null, 2));
  console.log(`certificates scanned: ${snapshot.size}`);
  console.log(`emails exported:      ${rows.length}`);
  console.log(`written to:           ${outFile}`);
  if (rows.length === 0) console.log('Nothing to back up.');
}

run().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});