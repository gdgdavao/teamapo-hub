#!/usr/bin/env node

/* eslint-env node */
/* eslint-disable no-console, no-undef, no-unused-vars */

/**
 * Firebase Rules Deployment Script for APOHUB
 * Automatically creates and manages Firestore and Storage security rules
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createRequire } from 'module';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import dotenv from 'dotenv';

// ES module equivalents for __dirname and require
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

dotenv.config();

// Colors for output
const GREEN = '\x1b[0;32m';
const RED = '\x1b[0;31m';
const YELLOW = '\x1b[1;33m';
const BLUE = '\x1b[0;34m';
const NC = '\x1b[0m';

const printSuccess = (message) => console.log(`${GREEN}✅ ${message}${NC}`);
const printError = (message) => console.log(`${RED}❌ ${message}${NC}`);
const printWarning = (message) => console.log(`${YELLOW}⚠️  ${message}${NC}`);
const printInfo = (message) => console.log(`${BLUE}ℹ️  ${message}${NC}`);

function getFirestoreRules() {
  return `rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isOwner(uid) {
      return request.auth != null && request.auth.uid == uid;
    }
    
    function isAdmin() {
      return request.auth != null && 
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    function isOrganizer() {
      return request.auth != null && 
             (get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'organizer' || 
              get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin');
    }
    
    function isValidTimestamp(value) {
      return value is timestamp;
    }
    
    function isValidEmail(email) {
      return email is string && email.matches('.*@.*[.].*');
    }
    
    // Users collection - Admin and Organizer accounts only
    match /users/{userId} {
      allow read: if isAuthenticated() && 
                     (isOwner(userId) || isAdmin());
      allow write: if isAdmin();
      allow create: if isAdmin() && 
                       isValidEmail(resource.data.email) &&
                       resource.data.role in ['admin', 'organizer'] &&
                       isValidTimestamp(resource.data.createdAt);
      allow update: if isAdmin() || 
                       (isOwner(userId) && 
                        request.resource.data.role == resource.data.role);
      allow delete: if isAdmin();
    }
    
    // Events collection
    match /events/{eventId} {
      allow read: if true; // Public events are readable by anyone
      allow create: if isOrganizer() && 
                       isValidTimestamp(resource.data.createdAt) &&
                       resource.data.organizer.uid == request.auth.uid;
      allow update: if isAdmin() || 
                       (isAuthenticated() && 
                        resource.data.organizer.uid == request.auth.uid);
      allow delete: if isAdmin() || 
                       (isAuthenticated() && 
                        resource.data.organizer.uid == request.auth.uid);
      
      // Event forms subcollection
      match /forms/{formId} {
        allow read: if true; // Forms are public for registration
        allow write: if isAdmin() || 
                        (isAuthenticated() && 
                         get(/databases/$(database)/documents/events/$(eventId)).data.organizer.uid == request.auth.uid);
      }
      
      // Event config subcollection
      match /config/{configId} {
        allow read: if isAdmin() || 
                       (isAuthenticated() && 
                        get(/databases/$(database)/documents/events/$(eventId)).data.organizer.uid == request.auth.uid);
        allow write: if isAdmin() || 
                        (isAuthenticated() && 
                         get(/databases/$(database)/documents/events/$(eventId)).data.organizer.uid == request.auth.uid);
      }
    }
    
    // Registrations collection - Anonymous attendee registrations
    match /registrations/{registrationId} {
      allow read: if isAdmin() || 
                     (isAuthenticated() && 
                      get(/databases/$(database)/documents/events/$(resource.data.eventId)).data.organizer.uid == request.auth.uid);
      allow create: if isValidEmail(resource.data.email) &&
                       isValidTimestamp(resource.data.registrationDate) &&
                       resource.data.eventId is string;
      allow update: if isAdmin() || 
                       (isAuthenticated() && 
                        get(/databases/$(database)/documents/events/$(resource.data.eventId)).data.organizer.uid == request.auth.uid);
      allow delete: if isAdmin();
    }
    
    // Certificates collection
    match /certificates/{certificateId} {
      allow read: if true; // Certificates are publicly verifiable
      allow write: if isAdmin() || 
                      (isAuthenticated() && 
                       get(/databases/$(database)/documents/events/$(resource.data.eventId)).data.organizer.uid == request.auth.uid);
    }
    
    // Feedback collection
    match /feedback/{feedbackId} {
      allow read: if isAdmin() || 
                     (isAuthenticated() && 
                      get(/databases/$(database)/documents/events/$(resource.data.eventId)).data.organizer.uid == request.auth.uid);
      allow create: if isValidEmail(resource.data.email) &&
                       isValidTimestamp(resource.data.submittedAt) &&
                       resource.data.eventId is string;
      allow update: if false; // Feedback is immutable
      allow delete: if isAdmin();
    }
    
    // Activity logs collection
    match /activity_logs/{logId} {
      allow read: if isAdmin();
      allow create: if isAuthenticated() && 
                       isValidTimestamp(resource.data.timestamp) &&
                       resource.data.type is string;
      allow update: if false; // Logs are immutable
      allow delete: if isAdmin();
    }
    
    // Event analytics collection
    match /event_analytics/{analyticsId} {
      allow read: if isAdmin() || 
                     (isAuthenticated() && 
                      get(/databases/$(database)/documents/events/$(resource.data.eventId)).data.organizer.uid == request.auth.uid);
      allow write: if isAdmin() || 
                      (isAuthenticated() && 
                       get(/databases/$(database)/documents/events/$(resource.data.eventId)).data.organizer.uid == request.auth.uid);
    }
    
    // Payment verifications collection
    match /payment_verifications/{verificationId} {
      allow read: if isAdmin() || 
                     (isAuthenticated() && 
                      get(/databases/$(database)/documents/events/$(resource.data.eventId)).data.organizer.uid == request.auth.uid);
      allow create: if isValidTimestamp(resource.data.verifiedAt) &&
                       resource.data.eventId is string;
      allow update: if isAdmin() || 
                       (isAuthenticated() && 
                        get(/databases/$(database)/documents/events/$(resource.data.eventId)).data.organizer.uid == request.auth.uid);
      allow delete: if isAdmin();
    }
    
    // Payment proofs collection
    match /paymentProofs/{proofId} {
      allow read: if isAdmin() || 
                     (isAuthenticated() && 
                      get(/databases/$(database)/documents/events/$(resource.data.eventId)).data.organizer.uid == request.auth.uid);
      allow create: if isValidEmail(resource.data.email) &&
                       isValidTimestamp(resource.data.submittedAt) &&
                       resource.data.eventId is string &&
                       resource.data.verificationStatus == 'pending';
      allow update: if isAdmin() || 
                       (isAuthenticated() && 
                        get(/databases/$(database)/documents/events/$(resource.data.eventId)).data.organizer.uid == request.auth.uid);
      allow delete: if isAdmin();
    }
    
    // System collection - Configuration and settings
    match /system/{docId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }
    
    // Deny all other operations
    match /{document=**} {
      allow read, write: if false;
    }
  }
}`;
}

function getStorageRules() {
  return `rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {
    
    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isAdmin() {
      return request.auth != null && 
             firestore.get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    function isOrganizer() {
      return request.auth != null && 
             (firestore.get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'organizer' || 
              firestore.get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin');
    }
    
    function isValidImageSize() {
      return resource.size < 5 * 1024 * 1024; // 5MB limit
    }
    
    function isValidImageType() {
      return resource.contentType.matches('image/.*');
    }
    
    function isValidDocumentType() {
      return resource.contentType in ['application/pdf', 'image/jpeg', 'image/png'];
    }
    
    // Event images - banners, logos, etc.
    match /events/{eventId}/images/{imageId} {
      allow read: if true; // Event images are public
      allow write: if isOrganizer() && 
                      isValidImageSize() && 
                      isValidImageType();
      allow delete: if isAdmin() || 
                       (isAuthenticated() && 
                        firestore.get(/databases/(default)/documents/events/$(eventId)).data.organizer.uid == request.auth.uid);
    }
    
    // Event documents - schedules, materials, etc.
    match /events/{eventId}/documents/{docId} {
      allow read: if true; // Event documents are public
      allow write: if isOrganizer() && 
                      resource.size < 10 * 1024 * 1024 && // 10MB limit
                      isValidDocumentType();
      allow delete: if isAdmin() || 
                       (isAuthenticated() && 
                        firestore.get(/databases/(default)/documents/events/$(eventId)).data.organizer.uid == request.auth.uid);
    }
    
    // Certificates - Generated certificates
    match /certificates/{certificateId} {
      allow read: if true; // Certificates are publicly accessible for verification
      allow write: if isAdmin() || 
                      (isAuthenticated() && 
                       isValidDocumentType() && 
                       resource.size < 2 * 1024 * 1024); // 2MB limit
      allow delete: if isAdmin();
    }
    
    // Registration attachments - Files uploaded during registration
    match /registrations/{registrationId}/attachments/{attachmentId} {
      allow read: if isAdmin() || 
                     (isAuthenticated() && 
                      firestore.get(/databases/(default)/documents/registrations/$(registrationId)).data.eventId != null &&
                      firestore.get(/databases/(default)/documents/events/$(firestore.get(/databases/(default)/documents/registrations/$(registrationId)).data.eventId)).data.organizer.uid == request.auth.uid);
      allow write: if resource.size < 5 * 1024 * 1024 && // 5MB limit
                      isValidDocumentType();
      allow delete: if isAdmin();
    }
    
    // System files - App assets, templates, etc.
    match /system/{allPaths=**} {
      allow read: if true; // System files are public
      allow write: if isAdmin();
      allow delete: if isAdmin();
    }
    
    // User profile images (for admin/organizer accounts)
    match /users/{userId}/profile/{imageId} {
      allow read: if true; // Profile images are public
      allow write: if isAuthenticated() && 
                      (request.auth.uid == userId || isAdmin()) &&
                      isValidImageSize() && 
                      isValidImageType();
      allow delete: if isAuthenticated() && 
                       (request.auth.uid == userId || isAdmin());
    }
    
    // Deny all other operations
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}`;
}

async function generateFirestoreRules() {
  try {
    printInfo('Generating firestore.rules file...');
    
    const rulesContent = getFirestoreRules();
    const rulesPath = join(__dirname, '..', 'firestore.rules');
    
    writeFileSync(rulesPath, rulesContent);
    printSuccess('Generated firestore.rules file');
    
    // Show summary
    console.log('');
    printInfo('Firestore Rules Summary:');
    console.log('   • Role-based access control (admin, organizer, anonymous)');
    console.log('   • Public read access for events and certificates');
    console.log('   • Protected admin and organizer operations');
    console.log('   • Validation for email formats and timestamps');
    console.log('   • Immutable logs and feedback');
    console.log('   • Payment proofs collection with verification controls');
    
    return true;
  } catch (error) {
    printError(`Failed to generate Firestore rules: ${error.message}`);
    return false;
  }
}

async function generateStorageRules() {
  try {
    printInfo('Generating storage.rules file...');
    
    const rulesContent = getStorageRules();
    const rulesPath = join(__dirname, '..', 'storage.rules');
    
    writeFileSync(rulesPath, rulesContent);
    printSuccess('Generated storage.rules file');
    
    // Show summary
    console.log('');
    printInfo('Storage Rules Summary:');
    console.log('   • Public read access for event images and certificates');
    console.log('   • File size limits: 5MB for images, 10MB for documents');
    console.log('   • Content type validation for security');
    console.log('   • Organizer-specific file management');
    console.log('   • Protected system and user files');
    
    return true;
  } catch (error) {
    printError(`Failed to generate Storage rules: ${error.message}`);
    return false;
  }
}

async function validateRulesSyntax() {
  try {
    printInfo('Validating rules syntax...');
    
    const firestoreRulesPath = join(__dirname, '..', 'firestore.rules');
    const storageRulesPath = join(__dirname, '..', 'storage.rules');
    
    let validationResults = [];
    
    // Check if files exist
    if (existsSync(firestoreRulesPath)) {
      try {
        const firestoreRules = readFileSync(firestoreRulesPath, 'utf8');
        
        // Basic syntax validation
        if (firestoreRules.includes('rules_version = \'2\'')) {
          validationResults.push({ type: 'Firestore', status: 'valid', message: 'Rules version 2 format' });
        } else {
          validationResults.push({ type: 'Firestore', status: 'warning', message: 'Missing rules version' });
        }
        
        if (firestoreRules.includes('service cloud.firestore')) {
          validationResults.push({ type: 'Firestore', status: 'valid', message: 'Service declaration found' });
        } else {
          validationResults.push({ type: 'Firestore', status: 'error', message: 'Missing service declaration' });
        }
        
        // Check for required collections
        const requiredCollections = ['users', 'events', 'registrations', 'certificates', 'feedback', 'paymentProofs'];
        requiredCollections.forEach(collection => {
          if (firestoreRules.includes(`/${collection}/`)) {
            validationResults.push({ type: 'Firestore', status: 'valid', message: `${collection} collection rules found` });
          } else {
            validationResults.push({ type: 'Firestore', status: 'warning', message: `${collection} collection rules missing` });
          }
        });
        
      } catch (error) {
        validationResults.push({ type: 'Firestore', status: 'error', message: `Failed to read rules: ${error.message}` });
      }
    } else {
      validationResults.push({ type: 'Firestore', status: 'error', message: 'firestore.rules file not found' });
    }
    
    // Validate Storage rules
    if (existsSync(storageRulesPath)) {
      try {
        const storageRules = readFileSync(storageRulesPath, 'utf8');
        
        if (storageRules.includes('rules_version = \'2\'')) {
          validationResults.push({ type: 'Storage', status: 'valid', message: 'Rules version 2 format' });
        } else {
          validationResults.push({ type: 'Storage', status: 'warning', message: 'Missing rules version' });
        }
        
        if (storageRules.includes('service firebase.storage')) {
          validationResults.push({ type: 'Storage', status: 'valid', message: 'Service declaration found' });
        } else {
          validationResults.push({ type: 'Storage', status: 'error', message: 'Missing service declaration' });
        }
        
        // Check for required paths
        const requiredPaths = ['events', 'certificates', 'registrations', 'system'];
        requiredPaths.forEach(path => {
          if (storageRules.includes(`/${path}/`)) {
            validationResults.push({ type: 'Storage', status: 'valid', message: `${path} path rules found` });
          } else {
            validationResults.push({ type: 'Storage', status: 'warning', message: `${path} path rules missing` });
          }
        });
        
      } catch (error) {
        validationResults.push({ type: 'Storage', status: 'error', message: `Failed to read rules: ${error.message}` });
      }
    } else {
      validationResults.push({ type: 'Storage', status: 'error', message: 'storage.rules file not found' });
    }
    
    // Display results
    console.log('');
    printInfo('Rules Validation Results:');
    
    let hasErrors = false;
    validationResults.forEach(result => {
      const icon = result.status === 'valid' ? '✅' : result.status === 'warning' ? '⚠️' : '❌';
      console.log(`   ${icon} ${result.type}: ${result.message}`);
      if (result.status === 'error') hasErrors = true;
    });
    
    if (hasErrors) {
      printError('Rules validation failed with errors');
      return false;
    } else {
      printSuccess('Rules validation completed successfully');
      return true;
    }
    
  } catch (error) {
    printError(`Rules validation failed: ${error.message}`);
    return false;
  }
}

async function deployRules() {
  try {
    printInfo('Deploying Firebase rules...');
    
    // First generate the latest rules
    await generateFirestoreRules();
    console.log('');
    await generateStorageRules();
    
    // Use Firebase CLI to deploy
    const { execSync } = require('child_process');
    
    console.log('');
    printInfo('Running: firebase deploy --only firestore:rules,storage');
    
    try {
      const output = execSync('firebase deploy --only firestore:rules,storage', { 
        encoding: 'utf8',
        cwd: join(__dirname, '..')
      });
      
      console.log(output);
      printSuccess('Rules deployment completed');
      
      console.log('');
      printWarning('Important Notes:');
      console.log('   • Rules take effect immediately');
      console.log('   • Test your app functionality after deployment');
      console.log('   • Check Firebase Console for any rule violations');
      
    } catch (error) {
      printError(`Firebase CLI deployment failed: ${error.message}`);
      return false;
    }
    
    return true;
  } catch (error) {
    printError(`Rules deployment failed: ${error.message}`);
    return false;
  }
}

async function showRulesStatus() {
  try {
    printInfo('Checking current rules status...');
    
    const firestoreRulesPath = join(__dirname, '..', 'firestore.rules');
    const storageRulesPath = join(__dirname, '..', 'storage.rules');
    
    console.log('');
    printInfo('Rules Files Status:');
    
    // Check Firestore rules
    if (existsSync(firestoreRulesPath)) {
      const stats = require('fs').statSync(firestoreRulesPath);
      const size = (stats.size / 1024).toFixed(2);
      console.log(`   📄 firestore.rules: ${size} KB (${stats.mtime.toLocaleDateString()})`);
      
      const content = readFileSync(firestoreRulesPath, 'utf8');
      const lines = content.split('\n').length;
      const matches = content.match(/match\s+\/[^{]+\{/g) || [];
      console.log(`      • ${lines} lines, ${matches.length} match rules`);
    } else {
      console.log('   ❌ firestore.rules: Not found');
    }
    
    // Check Storage rules
    if (existsSync(storageRulesPath)) {
      const stats = require('fs').statSync(storageRulesPath);
      const size = (stats.size / 1024).toFixed(2);
      console.log(`   📄 storage.rules: ${size} KB (${stats.mtime.toLocaleDateString()})`);
      
      const content = readFileSync(storageRulesPath, 'utf8');
      const lines = content.split('\n').length;
      const matches = content.match(/match\s+\/[^{]+\{/g) || [];
      console.log(`      • ${lines} lines, ${matches.length} match rules`);
    } else {
      console.log('   ❌ storage.rules: Not found');
    }
    
    console.log('');
    printInfo('Security Features:');
    console.log('   • Role-based access control');
    console.log('   • Email and timestamp validation');
    console.log('   • File size and type restrictions');
    console.log('   • Public access for events and certificates');
    console.log('   • Protected admin and organizer operations');
    
    return true;
  } catch (error) {
    printError(`Failed to check rules status: ${error.message}`);
    return false;
  }
}

async function manageRules(action) {
  try {
    console.log('🔥 APOHUB Firebase Rules Management');
    console.log('==================================\n');
    
    switch (action) {
      case 'generate':
        await generateFirestoreRules();
        console.log('');
        await generateStorageRules();
        break;
        
      case 'generate-firestore':
        await generateFirestoreRules();
        break;
        
      case 'generate-storage':
        await generateStorageRules();
        break;
        
      case 'deploy':
        await deployRules();
        break;
        
      case 'validate':
        await validateRulesSyntax();
        break;
        
      case 'status':
        await showRulesStatus();
        break;
        
      case 'all':
        await generateFirestoreRules();
        console.log('');
        await generateStorageRules();
        console.log('');
        await validateRulesSyntax();
        console.log('');
        await deployRules();
        break;
        
      default:
        console.log('Available actions:');
        console.log('  generate           - Generate both Firestore and Storage rules');
        console.log('  generate-firestore - Generate only Firestore rules');
        console.log('  generate-storage   - Generate only Storage rules');
        console.log('  deploy             - Deploy rules to Firebase');
        console.log('  validate           - Validate rules syntax');
        console.log('  status             - Show current rules status');
        console.log('  all                - Generate, validate, and deploy');
        console.log('');
        console.log('Usage: node scripts/deploy-rules.js [action]');
        break;
    }
    
  } catch (error) {
    printError(`Rules management failed: ${error.message}`);
    process.exit(1);
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  const action = process.argv[2] || 'help';
  manageRules(action)
    .then(() => {
      if (action !== 'help') {
        console.log('');
        printSuccess('Rules management completed successfully!');
      }
      process.exit(0);
    })
    .catch((error) => {
      printError(`Rules management failed: ${error.message}`);
      process.exit(1);
    });
}

export { manageRules, generateFirestoreRules, generateStorageRules, validateRulesSyntax, deployRules }; 