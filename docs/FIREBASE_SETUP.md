# Firebase Setup Guide for APOHUB

This guide will help you set up Firebase for the APOHUB project.

## Prerequisites

1. **Node.js and npm/yarn installed**
2. **Firebase CLI installed**: `npm install -g firebase-tools`
3. **A Google account**

## Step 1: Create a Firebase Project

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Enter project name (e.g., "apohub-gdgdavao")
4. Choose whether to enable Google Analytics
5. Create the project

## Step 2: Enable Firebase Services

### Authentication
1. In the Firebase console, go to **Authentication**
2. Click "Get started"
3. Go to **Sign-in method** tab
4. Enable the following providers:
   - Email/Password
   - Google (recommended)
   - Any other providers you want to support

### Firestore Database
1. Go to **Firestore Database**
2. Click "Create database"
3. Choose **Start in test mode** (we'll deploy proper rules later)
4. Select a location closest to your users

### Storage
1. Go to **Storage**
2. Click "Get started"
3. Choose **Start in test mode**
4. Use the same location as Firestore

### Functions (Optional)
1. Go to **Functions**
2. Click "Get started"
3. Follow the setup instructions if you plan to use Cloud Functions

## Step 3: Get Firebase Configuration

1. In the Firebase console, go to **Project Settings** (gear icon)
2. Scroll down to "Your apps"
3. Click the web icon `</>`
4. Register your app with a nickname (e.g., "APOHUB Web App")
5. Copy the configuration object

## Step 4: Configure Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp env.example .env
   ```

2. Update the `.env` file with your Firebase configuration:
   ```env
   VITE_FIREBASE_API_KEY=your_api_key_here
   VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
   ```

## Step 5: Initialize Firebase in Your Project

1. Run the setup script:
   ```bash
   ./setup-firebase.sh
   ```

   Or manually:
   ```bash
   firebase login
   firebase init
   ```

2. When prompted, select:
   - ✅ Firestore
   - ✅ Storage
   - ✅ Functions (optional)
   - ✅ Hosting

3. For Firestore rules, choose the existing `firestore.rules` file
4. For Storage rules, choose the existing `storage.rules` file
5. For hosting, set the public directory to `dist`

## Step 6: Deploy Security Rules

Deploy the pre-configured security rules:
```bash
firebase deploy --only firestore:rules,storage
```

## Step 7: Test the Connection

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Open the app in your browser
3. Look for the Firebase connection status indicator in the bottom-right corner (development mode only)
4. All services should show green indicators

## Step 8: Set Up User Roles

The app automatically assigns roles based on email domains:
- `@gdgdavao.org` emails with "admin" → **admin** role
- Other `@gdgdavao.org` emails → **organizer** role  
- All other emails → **attendee** role

You can manually update roles in the Firestore console if needed.

## Firebase Emulators (Optional for Development)

To use Firebase emulators for local development:

1. Install the Firebase emulators:
   ```bash
   firebase init emulators
   ```

2. Set the environment variable:
   ```env
   VITE_USE_FIREBASE_EMULATORS=true
   ```

3. Start the emulators:
   ```bash
   firebase emulators:start
   ```

4. The app will automatically connect to the local emulators

## Security Rules Overview

The project includes pre-configured security rules:

### Firestore Rules
- Users can read/write their own user documents
- Events are publicly readable, writable by organizers/admins
- Registrations are readable by owners and organizers
- Admin collections require admin role

### Storage Rules
- Profile pictures are publicly readable, writable by owners
- Event images are publicly readable, writable by organizers/admins
- Certificates are readable by owners, writable by organizers/admins

## Troubleshooting

### Common Issues

1. **"Property 'env' does not exist on type 'ImportMeta'"**
   - Make sure `src/vite-env.d.ts` exists and is properly configured

2. **Firebase connection fails**
   - Check that all environment variables are correctly set
   - Verify the Firebase project configuration
   - Ensure you're using the correct project ID

3. **Authentication not working**
   - Verify that the authentication providers are enabled in Firebase console
   - Check that the auth domain is correctly configured

4. **Permission denied errors**
   - Make sure security rules are properly deployed
   - Check that user roles are correctly assigned in Firestore

### Getting Help

- Check the [Firebase Documentation](https://firebase.google.com/docs)
- Review the console logs for detailed error messages
- Verify your Firebase project settings in the console

## Next Steps

After Firebase is set up:
1. Test user registration and authentication
2. Create some sample events
3. Test the various user roles and permissions
4. Deploy to Firebase Hosting when ready for production

## Production Deployment

When ready for production:
```bash
npm run build
firebase deploy
```

This will deploy your app to Firebase Hosting with the URL: `https://your-project-id.web.app`
