#!/usr/bin/env node

/* eslint-env node */
/* eslint-disable no-console, no-undef, no-unused-vars */

/**
 * Database Initialization Script for APOHUB
 * Automatically creates Firestore collections and populates with sample data
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createRequire } from 'module';
import dotenv from 'dotenv';

// ES module equivalents for __dirname and require
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

dotenv.config();

// Initialize Firebase Admin
let app;
try {
  // Try to use service account key if available
  const serviceAccountPath = join(__dirname, '..', 'firebase-service-account.json');
  try {
    const serviceAccount = require(serviceAccountPath);
    app = initializeApp({
      credential: cert(serviceAccount),
      projectId: process.env.VITE_FIREBASE_PROJECT_ID
    });
  } catch (_e) {
    // Fallback to default credentials (useful in CI/CD)
    app = initializeApp({
      projectId: process.env.VITE_FIREBASE_PROJECT_ID
    });
  }
} catch (error) {
  console.error('Failed to initialize Firebase Admin:', error);
  process.exit(1);
}

const db = getFirestore(app);
const auth = getAuth(app);


const getEventStructureTemplate = () => ({
  _placeholder: true,
  _description: 'Events collection for managing events',
  _structure: {
    id: 'string',
    title: 'string',
    description: 'string',
    shortDescription: 'string',
    imageUrl: 'string (optional)',
    organizer: {
      uid: 'string',
      name: 'string',
      email: 'string'
    },
    speakers: 'array of speaker objects',
    startDate: 'timestamp',
    endDate: 'timestamp',
    timezone: 'string',
    venue: 'venue object',
    ticketTypes: 'array of ticket type objects',
    promoCodes: 'array of promo code objects (optional)',
    tags: 'array of strings',
    category: 'string (workshop|meetup|conference|hackathon|networking|webinar|study-jam|code-lab)',
    status: 'string (draft|published|ongoing|completed|cancelled|postponed)',
    maxAttendees: 'number (optional)',
    currentAttendees: 'number',
    isPublished: 'boolean',
    registrationDeadline: 'timestamp (optional)',
    requirements: 'array of strings (optional)',
    agenda: 'array of agenda items (optional)',
    sponsors: 'array of sponsor objects (optional)',
    socialLinks: 'object (optional)',
    createdAt: 'timestamp',
    updatedAt: 'timestamp'
  },
  createdAt: Timestamp.now()
});

const getFormStructureTemplates = () => ({
  registration: {
    _placeholder: true,
    _description: 'Registration form template for events',
    type: 'registration',
    _structure: {
      type: 'string (registration)',
      fields: 'array of form field objects',
      createdAt: 'timestamp',
      updatedAt: 'timestamp'
    },
    createdAt: Timestamp.now()
  },
  feedback: {
    _placeholder: true,
    _description: 'Feedback form template for events',
    type: 'feedback',
    _structure: {
      type: 'string (feedback)',
      fields: 'array of form field objects',
      createdAt: 'timestamp',
      updatedAt: 'timestamp'
    },
    createdAt: Timestamp.now()
  }
});

const getSystemSettings = () => [
  {
    settingKey: 'registration_enabled',
    settingValue: true,
    description: 'Global setting to enable/disable event registrations',
    updatedAt: Timestamp.now(),
    updatedBy: 'system'
  },
  {
    settingKey: 'max_events_per_organizer',
    settingValue: 10,
    description: 'Maximum number of active events per organizer',
    updatedAt: Timestamp.now(),
    updatedBy: 'system'
  }
];

// Database initialization functions
async function initializeUsers() {
  console.log('📝 Creating users collection...');
  const userStructure = {
    _placeholder: true,
    _description: 'Users collection for organizers and admins',
    _structure: {
      uid: 'string',
      email: 'string',
      displayName: 'string',
      role: 'organizer | admin',
      organization: 'string (optional)',
      phoneNumber: 'string (optional)',
      bio: 'string (optional)',
      skills: 'array (optional)',
      socialLinks: 'object (optional)',
      createdAt: 'timestamp',
      updatedAt: 'timestamp'
    },
    createdAt: Timestamp.now()
  };
  
  // Create placeholder document to ensure collection exists
  await db.collection('users').doc('_structure').set(userStructure);
  console.log(`   ✅ Created users collection with structure template`);
}

async function initializeEvents() {
  console.log('🎉 Creating events collection...');
  const eventStructure = getEventStructureTemplate();
  
  // Create placeholder document to ensure collection exists
  await db.collection('events').doc('_structure').set(eventStructure);
  console.log(`   ✅ Created events collection with structure template`);
  
  // Create form structure templates
  const formStructures = getFormStructureTemplates();
  
  // Create forms subcollection structure
  await db.collection('events').doc('_structure').collection('forms').doc('registration').set(formStructures.registration);
  await db.collection('events').doc('_structure').collection('forms').doc('feedback').set(formStructures.feedback);
  console.log(`   ✅ Created event forms structure templates`);
}

async function initializeSystemSettings() {
  console.log('⚙️  Creating system settings...');
  const settings = getSystemSettings();
  
  for (const setting of settings) {
    await db.collection('system').doc(setting.settingKey).set(setting);
    console.log(`   ✅ Created setting: ${setting.settingKey}`);
  }
}

async function createEmptyCollections() {
  console.log('📂 Creating empty collections...');
  
  // Create placeholder documents to ensure collections exist
  const collections = [
    'registrations',
    'certificates', 
    'feedback',
    'activity_logs',
    'event_analytics',
    'payment_verifications'
  ];
  
  for (const collectionName of collections) {
    const placeholderDoc = {
      _placeholder: true,
      createdAt: Timestamp.now(),
      description: `Placeholder document to create ${collectionName} collection`
    };
    
    await db.collection(collectionName).doc('_placeholder').set(placeholderDoc);
    console.log(`   ✅ Created collection: ${collectionName}`);
  }
}

// Main initialization function
async function initializeDatabase() {
  try {
    console.log('🚀 Starting database initialization...\n');
    
    await initializeUsers();
    console.log('');
    
    await initializeEvents();
    console.log('');
    
    await initializeSystemSettings();
    console.log('');
    
    await createEmptyCollections();
    console.log('');
    
    console.log('🎉 Database initialization completed successfully!');
    console.log('');
    console.log('📋 What was created:');
    console.log('   • Users collection structure (empty, ready for data)');
    console.log('   • Events collection structure (empty, ready for data)');
    console.log('   • Event forms structure templates');
    console.log('   • System settings (essential configurations only)');
    console.log('   • Empty collections for all data types');
    console.log('');
    console.log('✨ Clean Setup Complete:');
    console.log('   • All collections are ready to receive data');
    console.log('   • No sample data included - start fresh!');
    console.log('   • Structure templates provide data format guidance');
    console.log('');
    console.log('🚀 Next Steps:');
    console.log('   1. Create your first admin/organizer users');
    console.log('   2. Configure Authentication providers in Firebase Console');
    console.log('   3. Start creating your events and content');
    console.log('   4. Test the application functionality');
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
}

// Run the initialization
if (import.meta.url === `file://${process.argv[1]}`) {
  initializeDatabase()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Initialization failed:', error);
      process.exit(1);
    });
}

export { initializeDatabase }; 