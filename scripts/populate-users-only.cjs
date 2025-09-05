#!/usr/bin/env node

/**
 * Populate Firebase Emulator with Sample Users Only
 * This script creates realistic test users for development
 * 
 * Usage:
 *   node scripts/populate-users-only.cjs
 *   npm run sample-users
 *   npm run emulator:with-users
 * 
 * What it creates:
 *   - 8 test users with different roles (admin, organizer, attendee, speaker, volunteer, sponsor)
 *   - Firebase Auth users with password: password123
 *   - Firestore user documents with detailed profiles
 *   - No events, registrations, or other data - just users
 * 
 * Test accounts:
 *   - admin@gdgdavao.org / password123 (admin)
 *   - maria.organizer@gdgdavao.org / password123 (organizer)
 *   - carlos.dev@gdgdavao.org / password123 (organizer)
 *   - sarah.attendee@gmail.com / password123 (attendee)
 *   - mike.student@university.edu / password123 (attendee)
 *   - dr.tech@techcorp.com / password123 (speaker)
 *   - anna.volunteer@community.org / password123 (volunteer)
 *   - contact@startupdavao.com / password123 (sponsor)
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const { join } = require('path');

console.log('👥 Populating Firebase Emulator with Sample Users Only');
console.log('💡 This creates realistic test users for development');
console.log('');

// Set emulator environment variables
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

// Initialize Firebase Admin for Emulator
let app;
try {
  // For emulator, use the actual project ID
  app = initializeApp({
    projectId: 'apohub-gdgdvo' // Use the actual project ID
  });
  console.log('✅ Connected to Firebase Emulator');
} catch (error) {
  console.error('Failed to initialize Firebase Admin:', error);
  process.exit(1);
}

const db = getFirestore(app);
const auth = getAuth(app);

// Sample users data
const generateSampleUsers = () => [
  {
    uid: 'admin-001',
    email: 'admin@gdgdavao.org',
    displayName: 'John Admin',
    role: 'admin',
    organization: 'GDG Davao',
    phoneNumber: '+639123456789',
    bio: 'Lead organizer and admin for GDG Davao. Passionate about technology and community building.',
    skills: ['Event Management', 'Community Building', 'Public Speaking'],
    socialLinks: {
      linkedin: 'https://linkedin.com/in/johnadmin',
      twitter: 'https://twitter.com/johnadmin'
    },
    createdAt: Timestamp.fromDate(new Date('2024-01-15')),
    updatedAt: Timestamp.now(),
    isActive: true,
    eventsCreated: 0
  },
  {
    uid: 'organizer-001',
    email: 'maria.organizer@gdgdavao.org',
    displayName: 'Maria Santos',
    role: 'organizer',
    organization: 'GDG Davao',
    phoneNumber: '+639987654321',
    bio: 'Frontend developer and event organizer. Loves React and helping others learn tech.',
    skills: ['React', 'JavaScript', 'Event Planning', 'Workshop Facilitation'],
    socialLinks: {
      github: 'https://github.com/mariasantos',
      linkedin: 'https://linkedin.com/in/mariasantos'
    },
    createdAt: Timestamp.fromDate(new Date('2024-02-01')),
    updatedAt: Timestamp.now(),
    isActive: true,
    eventsCreated: 0
  },
  {
    uid: 'organizer-002',
    email: 'carlos.dev@gdgdavao.org',
    displayName: 'Carlos Rodriguez',
    role: 'organizer',
    organization: 'GDG Davao',
    phoneNumber: '+639555123456',
    bio: 'Full-stack developer specializing in Node.js and cloud technologies.',
    skills: ['Node.js', 'Cloud Computing', 'Database Design', 'API Development'],
    socialLinks: {
      github: 'https://github.com/carlosdev',
      twitter: 'https://twitter.com/carlosdev'
    },
    createdAt: Timestamp.fromDate(new Date('2024-03-10')),
    updatedAt: Timestamp.now(),
    isActive: true,
    eventsCreated: 0
  },
  {
    uid: 'attendee-001',
    email: 'sarah.attendee@gmail.com',
    displayName: 'Sarah Johnson',
    role: 'attendee',
    organization: 'Freelance Developer',
    phoneNumber: '+639123456780',
    bio: 'Passionate about learning new technologies and attending tech events.',
    skills: ['JavaScript', 'Python', 'Web Development'],
    socialLinks: {
      github: 'https://github.com/sarahjohnson',
      linkedin: 'https://linkedin.com/in/sarahjohnson'
    },
    createdAt: Timestamp.fromDate(new Date('2024-04-01')),
    updatedAt: Timestamp.now(),
    isActive: true,
    eventsAttended: 0
  },
  {
    uid: 'attendee-002',
    email: 'mike.student@university.edu',
    displayName: 'Mike Chen',
    role: 'attendee',
    organization: 'University of Mindanao',
    phoneNumber: '+639123456781',
    bio: 'Computer Science student interested in mobile app development and AI.',
    skills: ['Java', 'Android Development', 'Machine Learning'],
    socialLinks: {
      github: 'https://github.com/mikechen',
      linkedin: 'https://linkedin.com/in/mikechen'
    },
    createdAt: Timestamp.fromDate(new Date('2024-04-15')),
    updatedAt: Timestamp.now(),
    isActive: true,
    eventsAttended: 0
  },
  {
    uid: 'speaker-001',
    email: 'dr.tech@techcorp.com',
    displayName: 'Dr. Tech Expert',
    role: 'speaker',
    organization: 'Tech Corp Philippines',
    phoneNumber: '+639123456782',
    bio: 'Senior software architect with 15+ years of experience in enterprise solutions.',
    skills: ['Software Architecture', 'Cloud Computing', 'DevOps', 'Team Leadership'],
    socialLinks: {
      linkedin: 'https://linkedin.com/in/drtechexpert',
      twitter: 'https://twitter.com/drtechexpert'
    },
    createdAt: Timestamp.fromDate(new Date('2024-01-01')),
    updatedAt: Timestamp.now(),
    isActive: true,
    eventsSpoken: 0
  },
  {
    uid: 'volunteer-001',
    email: 'anna.volunteer@community.org',
    displayName: 'Anna Volunteer',
    role: 'volunteer',
    organization: 'Tech Community Davao',
    phoneNumber: '+639123456783',
    bio: 'Community volunteer passionate about making tech accessible to everyone.',
    skills: ['Event Coordination', 'Community Management', 'Social Media'],
    socialLinks: {
      linkedin: 'https://linkedin.com/in/annavolunteer',
      twitter: 'https://twitter.com/annavolunteer'
    },
    createdAt: Timestamp.fromDate(new Date('2024-03-01')),
    updatedAt: Timestamp.now(),
    isActive: true,
    eventsVolunteered: 0
  },
  {
    uid: 'sponsor-001',
    email: 'contact@startupdavao.com',
    displayName: 'Startup Davao Rep',
    role: 'sponsor',
    organization: 'Startup Davao',
    phoneNumber: '+639123456784',
    bio: 'Representative from Startup Davao, supporting local tech entrepreneurship.',
    skills: ['Business Development', 'Startup Mentoring', 'Investment'],
    socialLinks: {
      linkedin: 'https://linkedin.com/company/startupdavao',
      website: 'https://startupdavao.com'
    },
    createdAt: Timestamp.fromDate(new Date('2024-02-15')),
    updatedAt: Timestamp.now(),
    isActive: true,
    eventsSponsored: 0
  }
];

// Population function for users only
async function populateUsers() {
  console.log('👥 Creating sample users...');
  const users = generateSampleUsers();
  
  for (const user of users) {
    // Create Firebase Auth user
    try {
      await auth.createUser({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        phoneNumber: user.phoneNumber,
        password: 'password123', // Default password for testing
        emailVerified: true
      });
      console.log(`   ✅ Created Auth user: ${user.displayName} (${user.role})`);
    } catch (error) {
      if (error.code === 'auth/uid-already-exists') {
        console.log(`   ⚠️  Auth user already exists: ${user.displayName}`);
      } else {
        console.error(`   ❌ Failed to create Auth user ${user.displayName}:`, error.message);
      }
    }
    
    // Create Firestore user document
    await db.collection('users').doc(user.uid).set(user);
    console.log(`   ✅ Created Firestore user: ${user.displayName} (${user.role})`);
  }
  console.log(`   📊 Total users created: ${users.length}`);
}

// Main population function
async function populateUsersOnly() {
  try {
    console.log('🚀 Starting users-only data population...\n');
    
    await populateUsers();
    console.log('');
    
    console.log('🎉 Users-only data population completed successfully!');
    console.log('');
    console.log('📋 What was created:');
    console.log('   • 8 Auth Users + Firestore Documents:');
    console.log('     - 1 Admin (admin@gdgdavao.org)');
    console.log('     - 2 Organizers (maria.organizer@gdgdavao.org, carlos.dev@gdgdavao.org)');
    console.log('     - 2 Attendees (sarah.attendee@gmail.com, mike.student@university.edu)');
    console.log('     - 1 Speaker (dr.tech@techcorp.com)');
    console.log('     - 1 Volunteer (anna.volunteer@community.org)');
    console.log('     - 1 Sponsor (contact@startupdavao.com)');
    console.log('');
    console.log('🎯 Test Data Ready:');
    console.log('   • All users have password: password123');
    console.log('   • Login with any of the emails above');
    console.log('   • Test different user roles and permissions');
    console.log('   • Create events, manage users, test workflows');
    console.log('');
    console.log('💡 Next Steps:');
    console.log('   • Use the admin account to create events');
    console.log('   • Test user management features');
    console.log('   • Verify role-based access controls');
    console.log('');
    
  } catch (error) {
    console.error('❌ Error during population:', error);
    process.exit(1);
  }
}

// Run the population
if (require.main === module) {
  populateUsersOnly()
    .then(() => {
      console.log('✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { populateUsersOnly, generateSampleUsers };
