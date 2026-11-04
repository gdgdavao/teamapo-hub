#!/usr/bin/env node

/**
 * Audit Ghost Paid Registrations
 *
 * Discovers registrations for paid tickets that were created with
 * `paymentStatus: 'pending'` but never had a paymentProof attached
 * (e.g., from browser drops or pre-atomic registration flow).
 *
 * DPA 2012 Compliance:
 * Zero raw attendee PII is logged to console; outputs document IDs, event IDs,
 * creation timestamps, and amounts only.
 *
 * Usage:
 *   bun scripts/audit-ghost-registrations.mjs [--dry-run]
 *   bun scripts/audit-ghost-registrations.mjs --apply --confirm (Requires explicit confirmation)
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DRY_RUN = !process.argv.includes('--apply');
const CONFIRMED = process.argv.includes('--confirm');

function getProjectId() {
  if (process.env.FIREBASE_PROJECT_ID) return process.env.FIREBASE_PROJECT_ID;
  if (process.env.VITE_FIREBASE_PROJECT_ID) return process.env.VITE_FIREBASE_PROJECT_ID;
  const saPath = path.resolve(process.cwd(), 'firebase-service-account.json');
  if (fs.existsSync(saPath)) {
    try {
      const sa = JSON.parse(fs.readFileSync(saPath, 'utf8'));
      if (sa.project_id) return sa.project_id;
    } catch {
      // fallback
    }
  }
  return 'project-iris-gdgdavao';
}

function getAccessToken() {
  if (process.env.GOOGLE_OAUTH_ACCESS_TOKEN) return process.env.GOOGLE_OAUTH_ACCESS_TOKEN;
  const cfgPath = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
  if (fs.existsSync(cfgPath)) {
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    if (cfg?.tokens?.access_token) return cfg.tokens.access_token;
  }
  throw new Error('No Firebase CLI access token found. Run `firebase login` first.');
}

const projectId = getProjectId();
const accessToken = getAccessToken();
const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

async function firestoreFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firestore API HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

async function runAudit() {
  console.log(`[Audit] Running ghost registration audit on project: ${projectId}`);
  console.log(`[Audit] Mode: ${DRY_RUN ? 'DRY RUN (read only)' : 'APPLY (modifications requested)'}`);

  // Query registrations with paymentStatus == 'pending'
  const queryPayload = {
    structuredQuery: {
      from: [{ collectionId: 'registrations' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'paymentStatus' },
          op: 'EQUAL',
          value: { stringValue: 'pending' },
        },
      },
      limit: 100,
    },
  };

  const results = await firestoreFetch(`${baseUrl}:runQuery`, {
    method: 'POST',
    body: JSON.stringify(queryPayload),
  });

  const ghostRegistrations = [];

  for (const item of results) {
    if (!item.document) continue;
    const doc = item.document;
    const fields = doc.fields || {};
    const regId = doc.name.split('/').pop();
    const eventId = fields.eventId?.stringValue;
    const totalAmount = fields.totalAmount?.doubleValue ?? fields.totalAmount?.integerValue ?? 0;
    const paymentProofId = fields.paymentProofId?.stringValue;
    const attendanceStatus = fields.attendanceStatus?.stringValue;
    const regDate = fields.registrationDate?.timestampValue || fields.createdAt?.timestampValue;

    // Check if this is a paid event/ticket with NO payment proof
    const isPaid = Number(totalAmount) > 0;
    const hasProof = !!paymentProofId;

    if (isPaid && !hasProof && attendanceStatus !== 'cancelled') {
      ghostRegistrations.push({
        id: regId,
        eventId,
        totalAmount,
        attendanceStatus,
        registrationDate: regDate,
      });
    }
  }

  console.log(`\n[Audit] Found ${ghostRegistrations.length} ghost registration(s) (paid, pending, but NO payment proof):`);
  console.table(ghostRegistrations);

  if (ghostRegistrations.length === 0) {
    console.log('[Audit] All paid pending registrations have valid payment proofs attached.');
    return;
  }

  if (DRY_RUN) {
    console.log('\n[Audit] DRY RUN complete. No documents were modified.');
    console.log('[Audit] To cancel these orphaned registrations and release inventory, run with:');
    console.log('        bun scripts/audit-ghost-registrations.mjs --apply --confirm');
    return;
  }

  if (!CONFIRMED) {
    console.error('\n[Error] --apply flag requires explicit --confirm flag to execute changes.');
    process.exit(1);
  }

  console.log('\n[Audit] Applying cancellations...');
  for (const ghost of ghostRegistrations) {
    console.log(`[Audit] Cancelling registration ${ghost.id}...`);
    const patchUrl = `${baseUrl}/registrations/${ghost.id}?updateMask.fieldPaths=paymentStatus&updateMask.fieldPaths=attendanceStatus&updateMask.fieldPaths=cancellationReason`;
    await firestoreFetch(patchUrl, {
      method: 'PATCH',
      body: JSON.stringify({
        fields: {
          paymentStatus: { stringValue: 'cancelled' },
          attendanceStatus: { stringValue: 'cancelled' },
          cancellationReason: { stringValue: 'ghost_submission_no_proof' },
        },
      }),
    });
    console.log(`[Audit] Successfully cancelled ${ghost.id}.`);
  }

  console.log('\n[Audit] All specified ghost registrations have been cancelled.');
}

runAudit().catch((err) => {
  console.error('[Audit Error]', err);
  process.exit(1);
});
