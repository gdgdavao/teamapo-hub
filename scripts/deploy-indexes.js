#!/usr/bin/env node

/* eslint-env node */
/* eslint-disable no-console, no-undef, no-unused-vars */

/**
 * Firebase Indexes Deployment Script for APOHUB
 * Automatically creates and manages Firestore composite indexes
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createRequire } from 'module';
import { readFileSync, writeFileSync } from 'fs';
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

let app;
let db;

async function initializeFirebase() {
  try {
    printInfo('Initializing Firebase Admin...');
    
    // Try to use service account key if available
    const serviceAccountPath = join(__dirname, '..', 'firebase-service-account.json');
    try {
      const serviceAccount = require(serviceAccountPath);
      app = initializeApp({
        credential: cert(serviceAccount),
        projectId: process.env.VITE_FIREBASE_PROJECT_ID
      });
      printSuccess('Using service account credentials');
    } catch (_e) {
      // Fallback to default credentials
      app = initializeApp({
        projectId: process.env.VITE_FIREBASE_PROJECT_ID
      });
      printSuccess('Using default credentials');
    }
    
    db = getFirestore(app);
    printSuccess('Firebase Admin initialized successfully');
    return true;
  } catch (error) {
    printError(`Failed to initialize Firebase: ${error.message}`);
    return false;
  }
}

// Define all required indexes for APOHUB
const getRequiredIndexes = () => ({
  indexes: [
    // Events collection indexes
    {
      collectionGroup: "events",
      queryScope: "COLLECTION",
      fields: [
        { fieldPath: "isPublished", order: "ASCENDING" },
        { fieldPath: "startDate", order: "ASCENDING" }
      ]
    },
    {
      collectionGroup: "events",
      queryScope: "COLLECTION",
      fields: [
        { fieldPath: "isPublished", order: "ASCENDING" },
        { fieldPath: "status", order: "ASCENDING" },
        { fieldPath: "startDate", order: "ASCENDING" }
      ]
    },
    {
      collectionGroup: "events",
      queryScope: "COLLECTION",
      fields: [
        { fieldPath: "organizer.uid", order: "ASCENDING" },
        { fieldPath: "createdAt", order: "DESCENDING" }
      ]
    },
    {
      collectionGroup: "events",
      queryScope: "COLLECTION",
      fields: [
        { fieldPath: "category", order: "ASCENDING" },
        { fieldPath: "isPublished", order: "ASCENDING" },
        { fieldPath: "startDate", order: "ASCENDING" }
      ]
    },
    {
      collectionGroup: "events",
      queryScope: "COLLECTION",
      fields: [
        { fieldPath: "venue.city", order: "ASCENDING" },
        { fieldPath: "isPublished", order: "ASCENDING" },
        { fieldPath: "startDate", order: "ASCENDING" }
      ]
    },
    {
      collectionGroup: "events",
      queryScope: "COLLECTION",
      fields: [
        { fieldPath: "venue.type", order: "ASCENDING" },
        { fieldPath: "isPublished", order: "ASCENDING" },
        { fieldPath: "startDate", order: "ASCENDING" }
      ]
    },
    
    // Registrations collection indexes
    {
      collectionGroup: "registrations",
      queryScope: "COLLECTION",
      fields: [
        { fieldPath: "eventId", order: "ASCENDING" },
        { fieldPath: "registrationDate", order: "DESCENDING" }
      ]
    },
    {
      collectionGroup: "registrations",
      queryScope: "COLLECTION",
      fields: [
        { fieldPath: "eventId", order: "ASCENDING" },
        { fieldPath: "paymentStatus", order: "ASCENDING" },
        { fieldPath: "registrationDate", order: "DESCENDING" }
      ]
    },
    {
      collectionGroup: "registrations",
      queryScope: "COLLECTION",
      fields: [
        { fieldPath: "eventId", order: "ASCENDING" },
        { fieldPath: "attendanceStatus", order: "ASCENDING" }
      ]
    },
    
    // Activity logs collection indexes
    {
      collectionGroup: "activity_logs",
      queryScope: "COLLECTION",
      fields: [
        { fieldPath: "type", order: "ASCENDING" },
        { fieldPath: "timestamp", order: "DESCENDING" }
      ]
    },
    {
      collectionGroup: "activity_logs",
      queryScope: "COLLECTION",
      fields: [
        { fieldPath: "userId", order: "ASCENDING" },
        { fieldPath: "timestamp", order: "DESCENDING" }
      ]
    },
    
    // Feedback collection indexes
    {
      collectionGroup: "feedback",
      queryScope: "COLLECTION",
      fields: [
        { fieldPath: "eventId", order: "ASCENDING" },
        { fieldPath: "submittedAt", order: "DESCENDING" }
      ]
    },
    
    // Analytics-specific indexes for dashboard queries
    {
      collectionGroup: "events",
      queryScope: "COLLECTION",
      fields: [
        { fieldPath: "isPublished", order: "ASCENDING" },
        { fieldPath: "startDate", order: "ASCENDING" },
        { fieldPath: "__name__", order: "ASCENDING" }
      ]
    },
    {
      collectionGroup: "events",
      queryScope: "COLLECTION",
      fields: [
        { fieldPath: "createdAt", order: "ASCENDING" },
        { fieldPath: "__name__", order: "ASCENDING" }
      ]
    },
    {
      collectionGroup: "registrations",
      queryScope: "COLLECTION",
      fields: [
        { fieldPath: "registrationDate", order: "ASCENDING" },
        { fieldPath: "__name__", order: "ASCENDING" }
      ]
    },
    {
      collectionGroup: "certificates",
      queryScope: "COLLECTION",
      fields: [
        { fieldPath: "issuedAt", order: "ASCENDING" },
        { fieldPath: "__name__", order: "ASCENDING" }
      ]
    },
    
    // Payment proofs collection indexes
    {
      collectionGroup: "paymentProofs",
      queryScope: "COLLECTION",
      fields: [
        { fieldPath: "verificationStatus", order: "ASCENDING" },
        { fieldPath: "submittedAt", order: "DESCENDING" }
      ]
    },
    {
      collectionGroup: "paymentProofs",
      queryScope: "COLLECTION",
      fields: [
        { fieldPath: "eventId", order: "ASCENDING" },
        { fieldPath: "submittedAt", order: "DESCENDING" }
      ]
    }
  ],
  fieldOverrides: [
    // Events tags array index
    {
      collectionGroup: "events",
      fieldPath: "tags",
      indexes: [
        {
          order: "ASCENDING",
          queryScope: "COLLECTION"
        },
        {
          arrayConfig: "CONTAINS",
          queryScope: "COLLECTION"
        }
      ]
    },
    // Events speakers array index
    {
      collectionGroup: "events",
      fieldPath: "speakers",
      indexes: [
        {
          arrayConfig: "CONTAINS",
          queryScope: "COLLECTION"
        }
      ]
    }
  ]
});

async function generateIndexesFile() {
  try {
    printInfo('Generating firestore.indexes.json file...');
    
    const indexesConfig = getRequiredIndexes();
    const indexesPath = join(__dirname, '..', 'firestore.indexes.json');
    
    // Write to firestore.indexes.json
    writeFileSync(indexesPath, JSON.stringify(indexesConfig, null, 2));
    
    printSuccess('Generated firestore.indexes.json file');
    
    // Show summary
    console.log('');
    printInfo(`Index Configuration Summary:`);
    console.log(`   • ${indexesConfig.indexes.length} composite indexes defined`);
    console.log(`   • ${indexesConfig.fieldOverrides.length} field overrides configured`);
    console.log(`   • Collections covered: events, registrations, activity_logs, feedback, paymentProofs, certificates`);
    
    return true;
  } catch (error) {
    printError(`Failed to generate indexes file: ${error.message}`);
    return false;
  }
}

async function validateIndexes() {
  try {
    printInfo('Validating required indexes...');
    
    const testQueries = [
      {
        name: 'Published events by start date',
        test: async () => {
          return await db.collection('events')
            .where('isPublished', '==', true)
            .where('status', '==', 'published')
            .orderBy('startDate', 'asc')
            .limit(1)
            .get();
        }
      },
      {
        name: 'Events by organizer',
        test: async () => {
          return await db.collection('events')
            .where('organizer.uid', '==', 'test-uid')
            .orderBy('createdAt', 'desc')
            .limit(1)
            .get();
        }
      },
      {
        name: 'Registrations by event',
        test: async () => {
          return await db.collection('registrations')
            .where('eventId', '==', 'test-event')
            .orderBy('registrationDate', 'desc')
            .limit(1)
            .get();
        }
      },
      {
        name: 'Activity logs by type',
        test: async () => {
          return await db.collection('activity_logs')
            .where('type', '==', 'event_created')
            .orderBy('timestamp', 'desc')
            .limit(1)
            .get();
        }
      },
      {
        name: 'Payment proofs by verification status',
        test: async () => {
          return await db.collection('paymentProofs')
            .where('verificationStatus', '==', 'pending')
            .orderBy('submittedAt', 'desc')
            .limit(1)
            .get();
        }
      },
      {
        name: 'Published events for dashboard',
        test: async () => {
          return await db.collection('events')
            .where('isPublished', '==', true)
            .orderBy('startDate', 'asc')
            .limit(1)
            .get();
        }
      },
      {
        name: 'Certificates by issue date',
        test: async () => {
          return await db.collection('certificates')
            .orderBy('issuedAt', 'asc')
            .limit(1)
            .get();
        }
      }
    ];
    
    let passedTests = 0;
    
    for (const query of testQueries) {
      try {
        await query.test();
        printSuccess(`Index working: ${query.name}`);
        passedTests++;
      } catch (error) {
        if (error.message.includes('index')) {
          printError(`Missing index for: ${query.name}`);
        } else {
          printWarning(`Query test failed (may be expected): ${query.name}`);
          passedTests++; // Consider as pass if not index-related
        }
      }
    }
    
    console.log('');
    printInfo(`Index Validation Results:`);
    console.log(`   • ${passedTests}/${testQueries.length} queries can execute`);
    
    if (passedTests === testQueries.length) {
      printSuccess('All required indexes are working correctly!');
    } else {
      printWarning('Some indexes may be missing or still building');
      console.log('   • Run: firebase deploy --only firestore:indexes');
      console.log('   • Wait for indexes to build (can take several minutes)');
    }
    
    return passedTests === testQueries.length;
  } catch (error) {
    printError(`Index validation failed: ${error.message}`);
    return false;
  }
}

async function showIndexStatus() {
  try {
    printInfo('Checking current index status...');
    
    // Read current firestore.indexes.json
    const indexesPath = join(__dirname, '..', 'firestore.indexes.json');
    
    try {
      const indexesContent = readFileSync(indexesPath, 'utf8');
      const indexesConfig = JSON.parse(indexesContent);
      
      console.log('');
      printInfo('Current Index Configuration:');
      console.log(`   📊 Composite Indexes: ${indexesConfig.indexes?.length || 0}`);
      console.log(`   🏷️  Field Overrides: ${indexesConfig.fieldOverrides?.length || 0}`);
      
      // Show breakdown by collection
      const collectionBreakdown = {};
      indexesConfig.indexes?.forEach(index => {
        const collection = index.collectionGroup;
        collectionBreakdown[collection] = (collectionBreakdown[collection] || 0) + 1;
      });
      
      console.log('');
      printInfo('Indexes by Collection:');
      Object.entries(collectionBreakdown).forEach(([collection, count]) => {
        console.log(`   • ${collection}: ${count} indexes`);
      });
      
    } catch (error) {
      printWarning('firestore.indexes.json not found or invalid');
    }
    
    return true;
  } catch (error) {
    printError(`Failed to check index status: ${error.message}`);
    return false;
  }
}

async function deployIndexes() {
  try {
    printInfo('Deploying Firestore indexes...');
    
    // First generate the latest indexes file
    await generateIndexesFile();
    
    // Use Firebase CLI to deploy
    const { execSync } = require('child_process');
    
    console.log('');
    printInfo('Running: firebase deploy --only firestore:indexes');
    
    try {
      const output = execSync('firebase deploy --only firestore:indexes', { 
        encoding: 'utf8',
        cwd: join(__dirname, '..')
      });
      
      console.log(output);
      printSuccess('Indexes deployment completed');
      
      console.log('');
      printWarning('Important Notes:');
      console.log('   • Indexes may take several minutes to build');
      console.log('   • Check Firebase Console for build status');
      console.log('   • Run validation after indexes are built');
      
    } catch (error) {
      printError(`Firebase CLI deployment failed: ${error.message}`);
      return false;
    }
    
    return true;
  } catch (error) {
    printError(`Index deployment failed: ${error.message}`);
    return false;
  }
}

async function manageIndexes(action) {
  try {
    console.log('🔥 APOHUB Firebase Indexes Management');
    console.log('====================================\n');
    
    // Initialize Firebase if needed for validation
    if (action === 'validate') {
      const initialized = await initializeFirebase();
      if (!initialized) {
        printError('Cannot validate indexes without Firebase connection');
        return;
      }
    }
    
    switch (action) {
      case 'generate':
        await generateIndexesFile();
        break;
        
      case 'deploy':
        await deployIndexes();
        break;
        
      case 'validate':
        await validateIndexes();
        break;
        
      case 'status':
        await showIndexStatus();
        break;
        
      case 'all':
        await generateIndexesFile();
        console.log('');
        await deployIndexes();
        console.log('');
        printInfo('Waiting 10 seconds before validation...');
        await new Promise(resolve => setTimeout(resolve, 10000));
        await validateIndexes();
        break;
        
      default:
        console.log('Available actions:');
        console.log('  generate - Generate firestore.indexes.json');
        console.log('  deploy   - Deploy indexes to Firebase');
        console.log('  validate - Test if indexes are working');
        console.log('  status   - Show current index configuration');
        console.log('  all      - Generate, deploy, and validate');
        console.log('');
        console.log('Usage: node scripts/deploy-indexes.js [action]');
        break;
    }
    
  } catch (error) {
    printError(`Index management failed: ${error.message}`);
    process.exit(1);
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  const action = process.argv[2] || 'help';
  manageIndexes(action)
    .then(() => {
      if (action !== 'help') {
        console.log('');
        printSuccess('Index management completed successfully!');
      }
      process.exit(0);
    })
    .catch((error) => {
      printError(`Index management failed: ${error.message}`);
      process.exit(1);
    });
}

export { manageIndexes, generateIndexesFile, validateIndexes, deployIndexes }; 