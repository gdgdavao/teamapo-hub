#!/usr/bin/env node

/**
 * Migrate and scrub `promoCodes` from public `/events/{eventId}` documents into
 * protected `/events/{eventId}/config/promoCodes` subcollection documents (VULN-01).
 *
 * Uses the authenticated Firebase CLI OAuth token (`~/.config/configstore/firebase-tools.json`)
 * against the Firestore v1 REST API so it works out of the box with `firebase login`.
 *
 * Idempotent: events without a top-level `promoCodes` field are skipped.
 *
 * Usage:
 *   bun scripts/scrub-event-promo-codes.cjs [--dry-run]
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const DRY_RUN = process.argv.includes('--dry-run');

function getProjectId() {
  if (process.env.FIREBASE_PROJECT_ID) return process.env.FIREBASE_PROJECT_ID;
  if (process.env.VITE_FIREBASE_PROJECT_ID) return process.env.VITE_FIREBASE_PROJECT_ID;
  const saPath = path.resolve(process.cwd(), 'firebase-service-account.json');
  if (fs.existsSync(saPath)) {
    const sa = JSON.parse(fs.readFileSync(saPath, 'utf8'));
    if (sa.project_id) return sa.project_id;
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
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firestore HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

function isPromoActive(promoMapField) {
  const fields = promoMapField?.mapValue?.fields || {};
  if (fields.isActive && typeof fields.isActive.booleanValue === 'boolean') {
    return fields.isActive.booleanValue !== false;
  }
  return true;
}

async function run() {
  console.log(`Target project: ${projectId}${DRY_RUN ? ' [DRY RUN]' : ''}`);
  const listResp = await firestoreFetch(`${baseUrl}/events?pageSize=200`);
  const docs = listResp?.documents || [];

  let scanned = 0;
  let migratedWithCodes = 0;
  let scrubbedEmpty = 0;
  let alreadyClean = 0;

  for (const doc of docs) {
    scanned += 1;
    const docId = doc.name.split('/').pop();
    const fields = doc.fields || {};
    const title = fields.title?.stringValue || 'Untitled';
    const hasLegacyField = Object.prototype.hasOwnProperty.call(fields, 'promoCodes');
    const legacyArrayValues = fields.promoCodes?.arrayValue?.values || [];

    const configDoc = await firestoreFetch(`${baseUrl}/events/${encodeURIComponent(docId)}/config/promoCodes`);
    const existingConfigValues = configDoc?.fields?.promoCodes?.arrayValue?.values || null;

    if (!hasLegacyField && existingConfigValues === null) {
      alreadyClean += 1;
      continue;
    }

    const finalValues =
      existingConfigValues && existingConfigValues.length > 0
        ? existingConfigValues
        : legacyArrayValues;

    const hasActivePromos = finalValues.some(isPromoActive);
    const currentHasPromoCodes = fields.hasPromoCodes?.booleanValue;

    if (!hasLegacyField && currentHasPromoCodes === hasActivePromos) {
      alreadyClean += 1;
      continue;
    }

    console.log(
      `  • Event ${docId} ("${title}"): legacyPromos=${legacyArrayValues.length}, configPromos=${existingConfigValues ? existingConfigValues.length : 0} -> hasPromoCodes=${hasActivePromos}`
    );

    if (!DRY_RUN) {
      const nowIso = new Date().toISOString();

      // 1. Write promoCodes to /events/{docId}/config/promoCodes if not already populated
      if (finalValues.length > 0 && (!existingConfigValues || existingConfigValues.length === 0)) {
        const configPath = `projects/${projectId}/databases/(default)/documents/events/${docId}/config/promoCodes`;
        await firestoreFetch(
          `${baseUrl}/events/${encodeURIComponent(docId)}/config/promoCodes?updateMask.fieldPaths=promoCodes&updateMask.fieldPaths=updatedAt`,
          {
            method: 'PATCH',
            body: JSON.stringify({
              name: configPath,
              fields: {
                promoCodes: {
                  arrayValue: {
                    values: finalValues,
                  },
                },
                updatedAt: {
                  timestampValue: nowIso,
                },
              },
            }),
          }
        );
      }

      // 2. Scrub `promoCodes` from public /events/{docId} and set `hasPromoCodes`
      // By including `promoCodes` in updateMask.fieldPaths while omitting it from `fields`,
      // Firestore's PATCH API deletes the `promoCodes` field atomically.
      const eventPath = `projects/${projectId}/databases/(default)/documents/events/${docId}`;
      await firestoreFetch(
        `${baseUrl}/events/${encodeURIComponent(docId)}?updateMask.fieldPaths=promoCodes&updateMask.fieldPaths=hasPromoCodes&updateMask.fieldPaths=updatedAt`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            name: eventPath,
            fields: {
              hasPromoCodes: {
                booleanValue: hasActivePromos,
              },
              updatedAt: {
                timestampValue: nowIso,
              },
            },
          }),
        }
      );
    }

    if (finalValues.length > 0) {
      migratedWithCodes += 1;
    } else {
      scrubbedEmpty += 1;
    }
  }

  console.log(
    `\nSummary: scanned=${scanned}, migrated_with_codes=${migratedWithCodes}, scrubbed_empty=${scrubbedEmpty}, already_clean=${alreadyClean}`
  );
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
