# User Account Creation Guide

## Overview

Your APOHUB application assigns r### Method 4: Manual Registration + Role Update

1. **Have the user register normally through your app**
   - They can use any email address
   - The role will be initially set to "organizer"

2. **Manually update the role in Firestore (if needed)**
   - Go to Firebase Console > Firestore Database
   - Navigate to `users/{userId}` document
   - Change the `role` field from "organizer" to "admin" if admin access is needed

## Valid Emails for User Accounts

✅ **Any valid email can be used:**

- `admin@example.com`
- `organizer@company.com`
- `manager@business.org`
- `user@gmail.com`

**Note**: User roles are manually assigned during account creation, not based on email domain.**Admin**: Manually created users with full system access
- **Organizer**: Manually created users who can create and manage events  
- **Attendees**: Anonymous users who register for events without accounts

**Note**: Only Admin and Organizer users need accounts and must be created manually. Attendees remain anonymous and interact with the platform through event registration forms and email-based certificate access.

## Methods to Create User Accounts

### Method 1: Using the Firebase Console (Recommended)

1. **Go to Firebase Console**
   - Visit [Firebase Console](https://console.firebase.google.com/)
   - Select your APOHUB project

2. **Navigate to Authentication**
   - Click on "Authentication" in the left sidebar
   - Go to the "Users" tab

3. **Add User**
   - Click "Add user" button
   - Enter user email (e.g., `admin@example.com`, `organizer@company.com`)
   - Set a temporary password
   - Click "Add user"

4. **User Profile Creation**
   - The user profile in Firestore will be automatically created when they first sign in
   - You'll need to manually update their role to "admin" or "organizer" in Firestore (see instructions below)
   - Note: Only admin and organizer roles are supported for authenticated users

### Method 2: Using the UserCreator Component (Development Only)

1. **Temporarily add the component to your app**

   ```tsx
   // In your App.tsx or any route, temporarily add:
   import UserCreator from './components/AdminUserCreator';
   
   // Add this component to your JSX
   <UserCreator />
   ```

2. **Access the form**
   - Navigate to the page where you added the component
   - Fill out the form with user details and select the appropriate role
   - Submit to create the user

3. **Remove the component**
   - After creating users, remove the component from your app
   - Never deploy this component to production

### Method 3: Using the JavaScript Script

1. **Update the script with your Firebase config**
   ```javascript
   // In scripts/create-admin-user.js
   const firebaseConfig = {
     apiKey: "your-actual-api-key",
     authDomain: "your-actual-auth-domain",
     projectId: "your-actual-project-id",
     // ... other config values
   };
   ```

2. **Run the script**

   ```javascript
   // Example usage:
   createUser('organizer@example.com', 'password123', 'Organizer Name', 'organizer');
   createUser('admin@example.com', 'password123', 'Admin User', 'admin');
   ```

### Method 4: Manual Registration + Role Update

1. **Have the admin user register normally through your app**
   - They can use any email address
   - The role will be initially set to "organizer"

2. **Manually update the role in Firestore**
   - Go to Firebase Console > Firestore Database
   - Navigate to `users/{userId}` document
   - Change the `role` field from "organizer" to "admin"

## Email Requirements for Admin Accounts

✅ **Any valid email can be used:**
- `admin@example.com`
- `john@company.com`
- `manager@business.org`
- `user@gmail.com`

**Note**: Admin role is now manually assigned, not based on email domain.

## Security Considerations

1. **Use strong passwords** for admin accounts
2. **Limit admin account creation** to authorized personnel only
3. **Remove development tools** (like AdminUserCreator) from production
4. **Monitor admin account usage** in Firebase Console
5. **Implement email verification** for additional security

## Troubleshooting

### Common Issues:

1. **Role not assigned correctly**
   - Check that user document exists in Firestore `users` collection
   - Verify `role` field is manually set to "admin"

2. **Can't create user**
   - Ensure Firebase Authentication is enabled
   - Check Firebase project permissions
   - Verify Firebase configuration is correct

3. **User created but can't access admin features**
   - Check user document in Firestore
   - Verify `role` field is set to "admin"
   - Check if user needs to sign out and back in

### Verification Steps:

1. **Check Firebase Authentication**
   - User appears in Firebase Console > Authentication > Users

2. **Check Firestore Document**
   - Document exists in `users/{userId}` collection
   - `role` field is set to "admin"
   - `email` field matches the authenticated email

3. **Test Admin Access**
   - User can access admin routes
   - Admin navigation appears
   - Admin features are functional

## Next Steps

After creating admin accounts:

1. **Test admin functionality**
2. **Remove development components**
3. **Document admin credentials securely**
4. **Set up proper backup and recovery procedures**
5. **Consider implementing role-based access control for more granular permissions**

---

**Note**: This guide assumes you have Firebase Authentication and Firestore properly configured. If you need help with Firebase setup, refer to the `FIREBASE_SETUP.md` file.
