# Firebase Indexes & Rules Automation for APOHUB

This document describes the automated tools for managing Firebase Firestore indexes and security rules in the APOHUB project.

## 🚀 Quick Start

### One-Command Setup
```bash
# Generate, validate, and deploy everything
npm run firebase:indexes:all
npm run firebase:rules:all
```

### Individual Commands
```bash
# Indexes Management
npm run firebase:indexes:generate    # Generate firestore.indexes.json
npm run firebase:indexes:deploy      # Deploy indexes to Firebase
npm run firebase:indexes:validate    # Test if indexes are working
npm run firebase:indexes:status      # Show current index configuration

# Rules Management
npm run firebase:rules:generate      # Generate rules files
npm run firebase:rules:deploy        # Deploy rules to Firebase
npm run firebase:rules:validate      # Validate rules syntax
npm run firebase:rules:status        # Show current rules status
```

## 📊 Firebase Indexes Automation

### Overview
The indexes automation system manages Firestore composite indexes required for complex queries in APOHUB.

### Features
- **Automated Index Generation**: Creates `firestore.indexes.json` with all required indexes
- **Query Validation**: Tests if indexes are working correctly
- **Deployment Management**: Handles Firebase CLI deployment
- **Status Monitoring**: Shows current index configuration

### Required Indexes
The system automatically generates indexes for:

1. **Events Collection** (5 indexes)
   - Published events by status and date
   - Events by organizer with date sorting
   - Events by category, publication status, and date
   - Events by city, publication status, and date
   - Events by venue type, publication status, and date

2. **Registrations Collection** (3 indexes)
   - Registrations by event and date
   - Registrations by event, payment status, and date
   - Registrations by event and attendance status

3. **Activity Logs Collection** (2 indexes)
   - Logs by type and timestamp
   - Logs by user and timestamp

4. **Feedback Collection** (1 index)
   - Feedback by event and submission date

5. **Array Field Indexes** (2 overrides)
   - Events tags array contains queries
   - Events speakers array contains queries

### Usage Examples

```bash
# Generate index configuration
npm run firebase:indexes:generate

# Deploy to Firebase (includes generation)
npm run firebase:indexes:deploy

# Validate that indexes are working
npm run firebase:indexes:validate

# Check current status
npm run firebase:indexes:status

# Do everything at once
npm run firebase:indexes:all
```

### Index Building Process
1. **Generation**: Creates `firestore.indexes.json` with all required indexes
2. **Deployment**: Uses Firebase CLI to deploy indexes
3. **Building**: Firebase builds indexes (takes several minutes)
4. **Validation**: Tests queries to ensure indexes work

## 🔒 Firebase Rules Automation

### Overview
The rules automation system manages security rules for both Firestore and Storage services.

### Features
- **Automated Rule Generation**: Creates rules files with proper security
- **Role-Based Access Control**: Implements admin, organizer, and anonymous user roles
- **Syntax Validation**: Validates rules before deployment
- **Deployment Management**: Handles Firebase CLI deployment

### Security Model

#### User Roles
- **Admin**: Full access to all data and operations
- **Organizer**: Can manage their own events and view registrations
- **Anonymous**: Can register for events and view public data

#### Access Patterns
- **Public Read**: Events, certificates, forms (for registration)
- **Protected Write**: User accounts, event management, system settings
- **Owner-Based**: Organizers can only modify their own events
- **Immutable Data**: Logs and feedback cannot be modified after creation

### Generated Rules

#### Firestore Rules (`firestore.rules`)
- **Users Collection**: Admin and organizer account management
- **Events Collection**: Public read, organizer write with subcollections
- **Registrations Collection**: Anonymous creation, organizer/admin read
- **Certificates Collection**: Public read, organizer/admin write
- **Feedback Collection**: Anonymous creation, organizer/admin read, immutable
- **Activity Logs Collection**: Admin read, authenticated write, immutable
- **Analytics Collection**: Owner/admin access only
- **Payment Verifications**: Owner/admin access only
- **System Collection**: Admin-only write, authenticated read

#### Storage Rules (`storage.rules`)
- **Event Images**: Public read, organizer write (5MB limit)
- **Event Documents**: Public read, organizer write (10MB limit)
- **Certificates**: Public read, admin/organizer write (2MB limit)
- **Registration Attachments**: Owner/admin read, public write (5MB limit)
- **System Files**: Public read, admin-only write
- **User Profiles**: Public read, owner/admin write (5MB limit)

### Usage Examples

```bash
# Generate both Firestore and Storage rules
npm run firebase:rules:generate

# Generate only Firestore rules
node scripts/deploy-rules.js generate-firestore

# Generate only Storage rules
node scripts/deploy-rules.js generate-storage

# Deploy rules to Firebase
npm run firebase:rules:deploy

# Validate rules syntax
npm run firebase:rules:validate

# Check current rules status
npm run firebase:rules:status

# Do everything at once
npm run firebase:rules:all
```

### Validation Features
- **Syntax Checking**: Validates rules version and service declarations
- **Collection Coverage**: Ensures all required collections have rules
- **Path Coverage**: Verifies all storage paths are covered
- **Error Detection**: Identifies missing or invalid rules

## 🛠️ Advanced Usage

### Direct Script Execution
```bash
# Indexes management
node scripts/deploy-indexes.js [action]

# Rules management
node scripts/deploy-rules.js [action]

# Available actions:
# - generate: Generate configuration files
# - deploy: Deploy to Firebase
# - validate: Test/validate setup
# - status: Show current status
# - all: Do everything
```

### Troubleshooting

#### Index Issues
```bash
# Check if indexes are building
npm run firebase:indexes:status

# Common issues:
# - Indexes take 5-15 minutes to build
# - Check Firebase Console for build status
# - Ensure you have sufficient quota
```

#### Rules Issues
```bash
# Validate rules syntax
npm run firebase:rules:validate

# Common issues:
# - Rules take effect immediately
# - Check Firebase Console for rule violations
# - Test app functionality after deployment
```

#### Authentication Issues
```bash
# Ensure you have proper credentials
firebase login
firebase projects:list

# For scripts requiring admin access:
# Download service account key to firebase-service-account.json
```

## 📋 Prerequisites

### Required Tools
- Node.js 18+ with npm
- Firebase CLI (`npm install -g firebase-tools`)
- Firebase project with Firestore and Storage enabled

### Required Files
- `.env` file with `VITE_FIREBASE_PROJECT_ID`
- `.firebaserc` file with project configuration
- `firebase-service-account.json` (for admin operations)

### Project Setup
```bash
# Install dependencies
npm install

# Configure Firebase
firebase login
firebase use <project-id>

# Download service account key
# Go to Firebase Console > Project Settings > Service Accounts
# Generate new private key, save as firebase-service-account.json
```

## 🔄 Integration with Existing Scripts

### Complete Setup Workflow
```bash
# 1. Full Firebase setup (includes indexes and rules)
npm run firebase:setup

# 2. Deploy everything
npm run firebase:deploy

# 3. Validate setup
npm run firebase:validate

# 4. Initialize database
npm run firebase:init-db
```

### Maintenance Workflow
```bash
# Update indexes after schema changes
npm run firebase:indexes:all

# Update rules after security changes
npm run firebase:rules:all

# Check everything is working
npm run firebase:validate
```

## 📈 Performance Benefits

### Manual vs Automated
- **Manual Setup**: 2-3 hours of console work
- **Automated Setup**: 5-10 minutes of commands
- **Error Reduction**: Eliminates manual typos and omissions
- **Consistency**: Ensures same setup across environments

### Index Benefits
- **Query Performance**: Complex queries run instantly
- **Cost Reduction**: Prevents expensive collection scans
- **Scalability**: Handles large datasets efficiently

### Rules Benefits
- **Security**: Proper access control from day one
- **Maintainability**: Version controlled and documented
- **Consistency**: Same rules across all deployments

## 🔧 Customization

### Adding New Indexes
Edit `scripts/deploy-indexes.js` in the `getRequiredIndexes()` function:

```javascript
// Add new composite index
{
  collectionGroup: "your_collection",
  queryScope: "COLLECTION",
  fields: [
    { fieldPath: "field1", order: "ASCENDING" },
    { fieldPath: "field2", order: "DESCENDING" }
  ]
}
```

### Modifying Rules
Edit `scripts/deploy-rules.js` in the `getFirestoreRules()` or `getStorageRules()` functions:

```javascript
// Add new collection rules
match /your_collection/{docId} {
  allow read: if isAuthenticated();
  allow write: if isAdmin();
}
```

## 🚨 Important Notes

### Index Deployment
- Indexes take 5-15 minutes to build in production
- Large collections may take longer
- Monitor build status in Firebase Console
- Queries will fail until indexes are complete

### Rules Deployment
- Rules take effect immediately
- Test your app after deployment
- Rules are version controlled
- Backup existing rules before changes

### Security Considerations
- Never commit `firebase-service-account.json`
- Use environment variables for sensitive data
- Test rules in Firebase Console simulator
- Monitor security violations in Firebase Console

## 📚 Additional Resources

- [Firebase Indexes Documentation](https://firebase.google.com/docs/firestore/query-data/indexing)
- [Firebase Security Rules Documentation](https://firebase.google.com/docs/firestore/security/get-started)
- [APOHUB Firebase Setup Guide](./FIREBASE_SETUP.md)
- [APOHUB Automation Guide](./FIREBASE_AUTOMATION_GUIDE.md)

---

*This automation system is part of the APOHUB project's comprehensive Firebase setup. For additional support, refer to the project documentation or contact the development team.* 