const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('../firebase-service-account.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function createUserDocument() {
  // Get current user UID from command line argument or prompt
  const userUid = process.argv[2];
  
  if (!userUid) {
    console.error('❌ Please provide a user UID as an argument');
    console.log('Usage: node create-user-document.js <USER_UID>');
    process.exit(1);
  }

  try {
    // Create user document with organizer role
    const userData = {
      uid: userUid,
      email: 'organizer@example.com', // Replace with actual email
      displayName: 'Event Organizer', // Replace with actual name
      role: 'organizer', // This is required for creating events
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      eventsCreated: 0,
      isActive: true
    };

    await db.collection('users').doc(userUid).set(userData);
    
    console.log('✅ User document created successfully!');
    console.log('User UID:', userUid);
    console.log('Role:', userData.role);
    console.log('');
    console.log('🎉 You can now create events!');
    
  } catch (error) {
    console.error('❌ Error creating user document:', error);
  }
  
  process.exit(0);
}

createUserDocument(); 