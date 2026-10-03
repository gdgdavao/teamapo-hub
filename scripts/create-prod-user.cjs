#!/usr/bin/env node

/**
 * Create a single production user in Firebase Auth and Firestore
 * Usage: node scripts/create-prod-user.cjs
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const path = require('path');
const fs = require('fs');

(async () => {
  console.log('🔐 Creating production user in Firebase');

  // Target user details (override via env if needed)
  const targetEmail = process.env.PROD_USER_EMAIL;
  if (!targetEmail) throw new Error('PROD_USER_EMAIL is required.');
  const targetPassword = process.env.PROD_USER_PASSWORD;
  if (!targetPassword) throw new Error('PROD_USER_PASSWORD is required.');
  const targetDisplayName = process.env.PROD_USER_NAME || 'GDG Davao';
  const targetRole = process.env.PROD_USER_ROLE || 'admin'; // 'admin' | 'organizer'

  // Load service account
  const serviceAccountPath = path.join(__dirname, '..', 'firebase-service-account.json');
  if (!fs.existsSync(serviceAccountPath)) {
    console.error('❌ Service account file not found at:', serviceAccountPath);
    process.exit(1);
  }

  let app;
  try {
    const serviceAccount = require(serviceAccountPath);
    // Ensure environment is aligned with the service account
    process.env.GOOGLE_CLOUD_PROJECT = serviceAccount.project_id;
    process.env.GCLOUD_PROJECT = serviceAccount.project_id;

    app = initializeApp({
      credential: cert(serviceAccount),
      // Let Admin infer project from credentials to avoid mismatches
    });
    console.log('✅ Initialized Firebase Admin (production)');
  } catch (err) {
    console.error('❌ Failed to initialize Firebase Admin:', err);
    process.exit(1);
  }

  const db = getFirestore(app);
  const auth = getAuth(app);

  try {
    // Quick connectivity check to Auth (also initializes project Auth if available)
    try {
      await getAuth(app).listUsers(1);
    } catch (probeErr) {
      if (probeErr?.code === 'auth/configuration-not-found') {
        console.error('❌ Firebase Authentication is not initialized for project:', process.env.GOOGLE_CLOUD_PROJECT);
        console.error('   Open the Firebase Console → Authentication once to initialize the service.');
        console.error('   Then re-run this script.');
        process.exit(1);
      }
      // If other error, continue and let main flow handle
    }

    // Create or fetch Auth user
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(targetEmail);
      console.log(`ℹ️  Auth user already exists: ${userRecord.uid}`);
      // Ensure display name and emailVerified
      await auth.updateUser(userRecord.uid, {
        displayName: targetDisplayName,
        emailVerified: true,
        password: targetPassword, // keep script idempotent but ensures known password
      });
      console.log('✅ Updated existing Auth user');
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        userRecord = await auth.createUser({
          email: targetEmail,
          password: targetPassword,
          displayName: targetDisplayName,
          emailVerified: true,
          disabled: false,
        });
        console.log(`✅ Created Auth user: ${userRecord.uid}`);
      } else {
        throw err;
      }
    }

    // Create/merge Firestore user document
    const userDocRef = db.collection('users').doc(userRecord.uid);
    const existingSnap = await userDocRef.get();

    const createdAt = existingSnap.exists && existingSnap.get('createdAt')
      ? existingSnap.get('createdAt')
      : Timestamp.now();

    const userDoc = {
      email: targetEmail,
      displayName: targetDisplayName,
      role: targetRole,
      organization: 'GDG Davao',
      isActive: true,
      updatedAt: Timestamp.now(),
      createdAt,
    };

    await userDocRef.set(userDoc, { merge: true });
    console.log('✅ Ensured Firestore user document exists/updated');

    console.log('\n🎉 Done. Production user is ready:');
    console.log(`   • UID: ${userRecord.uid}`);
    console.log(`   • Email: ${targetEmail}`);
    console.log(`   • Name: ${targetDisplayName}`);
    console.log(`   • Role: ${targetRole}`);
  } catch (err) {
    console.error('❌ Failed to create production user:', err);
    process.exit(1);
  }
})();

