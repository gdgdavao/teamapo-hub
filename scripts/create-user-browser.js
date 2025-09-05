// Run this in your browser console while logged into your app
// Make sure you're authenticated first

// Copy this entire block and paste it into your browser console:

(async function createUserDocument() {
  try {
    // Get Firebase imports (assumes they're available globally)
    const { doc, setDoc, serverTimestamp } = window.firebase?.firestore || window.firestore;
    const { getAuth } = window.firebase?.auth || window.auth;
    const db = window.db; // Your Firestore instance
    
    if (!db) {
      console.error('❌ Firestore not available. Make sure you\'re on the app page.');
      return;
    }
    
    const auth = getAuth();
    const currentUser = auth.currentUser;
    
    if (!currentUser) {
      console.error('❌ No user is currently logged in. Please log in first.');
      return;
    }
    
    console.log('Current user UID:', currentUser.uid);
    console.log('Current user email:', currentUser.email);
    
    // Create user document with organizer role
    const userData = {
      uid: currentUser.uid,
      email: currentUser.email || 'user@example.com',
      displayName: currentUser.displayName || 'Event Organizer',
      role: 'organizer', // This is the key field for permissions
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      eventsCreated: 0,
      isActive: true
    };
    
    const userRef = doc(db, 'users', currentUser.uid);
    await setDoc(userRef, userData);
    
    console.log('✅ User document created successfully!');
    console.log('Role set to:', userData.role);
    console.log('');
    console.log('🎉 You can now create events! Try refreshing the page and creating an event.');
    
  } catch (error) {
    console.error('❌ Error creating user document:', error);
    console.log('');
    console.log('💡 Alternative: Create manually in Firebase Console:');
    console.log('1. Go to Firebase Console > Firestore Database');
    console.log('2. Create collection: "users"');
    console.log('3. Create document with your UID as document ID');
    console.log('4. Add these fields:');
    console.log('   - role: "organizer" (string)');
    console.log('   - email: your email (string)');
    console.log('   - displayName: your name (string)');
    console.log('   - isActive: true (boolean)');
    console.log('   - eventsCreated: 0 (number)');
  }
})(); 