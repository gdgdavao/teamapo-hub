# Firebase Automation Guide for APOHUB

This guide explains how to automatically set up your Firestore database and Firebase project for APOHUB without manual console work.

## 🚀 Quick Start (One-Command Setup)

For a complete automated setup from scratch:

```bash
npm run firebase:setup
```

This single command will:
- ✅ Install all dependencies
- ✅ Set up Firebase project
- ✅ Deploy rules and indexes
- ✅ Deploy Firebase Functions
- ✅ Initialize database structure
- ✅ Deploy web application

## 📋 Available Automation Scripts

### 1. Complete Setup Scripts

#### `npm run firebase:setup`
**Use this for:** First-time setup of a new Firebase project
- Installs all prerequisites
- Guides you through environment setup
- Deploys everything automatically
- Creates sample data

#### `npm run firebase:deploy`
**Use this for:** Deploying updates to an existing project
- Deploys rules, indexes, functions
- Option to rebuild database
- Option to deploy hosting

### 2. Individual Component Scripts

#### `npm run firebase:validate`
**Use this for:** Checking if your setup is working correctly
- Validates environment configuration
- Tests Firebase connectivity
- Checks collections and indexes
- Generates detailed report

#### `npm run firebase:init-db`
**Use this for:** Setting up database collection structure
- Creates all required collections
- Sets up collection structure templates
- Creates essential system configurations
- Prepares database for data input (no sample data)

#### `npm run firebase:rules`
**Use this for:** Deploying only security rules
- Updates Firestore rules
- Updates Storage rules

#### `npm run firebase:indexes`
**Use this for:** Deploying only database indexes
- Creates all composite indexes
- Updates array field configurations

#### `npm run firebase:functions`
**Use this for:** Deploying only Firebase Functions
- Deploys Python backend functions
- Updates function configurations

#### `npm run firebase:hosting`
**Use this for:** Building and deploying the web app
- Builds React application
- Deploys to Firebase Hosting

## 🔧 Prerequisites

Before running automation scripts, ensure you have:

1. **Node.js** (v18 or higher)
2. **npm** (comes with Node.js)
3. **Python** (for Firebase Functions)
4. **Firebase CLI** (auto-installed by scripts)

## 📝 Step-by-Step Setup

### Option A: Automated Setup (Recommended)

1. **Clone and navigate to project:**
   ```bash
   git clone <your-repo>
   cd apohub
   ```

2. **Run quick setup:**
   ```bash
   npm run firebase:setup
   ```

3. **Follow the prompts:**
   - The script will guide you through each step
   - Update your `.env` file when prompted
   - Add Firebase service account key when requested

4. **Validate setup:**
   ```bash
   npm run firebase:validate
   ```

### Option B: Manual Step-by-Step

1. **Install dependencies:**
   ```bash
   npm install
   npm install firebase-admin dotenv --save-dev
   ```

2. **Set up environment:**
   ```bash
   cp env.example .env
   # Edit .env with your Firebase configuration
   ```

3. **Deploy Firebase configuration:**
   ```bash
   npm run firebase:rules
   npm run firebase:indexes
   npm run firebase:functions
   ```

4. **Initialize database:**
   ```bash
   npm run firebase:init-db
   ```

5. **Deploy web app:**
   ```bash
   npm run firebase:hosting
   ```

## 🔐 Authentication Setup

The automation scripts set up the authentication structure but don't create any users. After running setup:

1. **Go to Firebase Console → Authentication**
2. **Enable sign-in methods:**
   - Email/Password (required)
   - Google (optional)
   - Other providers as needed

3. **Create your first admin user:**
   - Create a user account in the Authentication tab
   - Add a user document in Firestore with role: 'admin'

## 📊 What Gets Created Automatically

### Collections
- ✅ `users` - User accounts collection (empty with structure template)
- ✅ `events` - Events collection (empty with structure template)
- ✅ `registrations` - Registration data collection (empty)
- ✅ `certificates` - Certificate data collection (empty)
- ✅ `feedback` - Feedback data collection (empty)
- ✅ `activity_logs` - System activity logs collection (empty)
- ✅ `event_analytics` - Event analytics collection (empty)
- ✅ `payment_verifications` - Payment verification collection (empty)
- ✅ `system` - Essential system settings only

### Indexes
- ✅ Event queries (published, category, location, date)
- ✅ Registration queries (by event, payment status, attendance)
- ✅ Activity log queries (by type, user, timestamp)
- ✅ Feedback queries (by event, submission date)
- ✅ Array field indexes (tags, speakers)

### Security Rules
- ✅ Role-based access control
- ✅ Data protection for sensitive information
- ✅ Anonymous attendee support
- ✅ Organizer-event relationship enforcement

### Structure Templates
- ✅ User account data structure and field definitions
- ✅ Event data structure with all required fields
- ✅ Form templates for registration and feedback
- ✅ Essential system configuration settings
- ✅ Collection documentation within placeholder documents

## 🧪 Testing Your Setup

### Automated Validation
```bash
npm run firebase:validate
```

This will check:
- ✅ Environment configuration
- ✅ Firebase connectivity
- ✅ Database collections
- ✅ Security rules
- ✅ Composite indexes
- ✅ Sample data

### Manual Testing
1. **Open your web app:** `https://YOUR_PROJECT_ID.web.app`
2. **Create your first admin account** and test login
3. **Create a test event** as organizer
4. **Register for an event** as anonymous attendee
5. **Verify all functionality** works with your setup

## 🔄 Environment-Specific Setup

### Development Environment
```bash
# Use local Firebase emulators
firebase emulators:start

# In another terminal
npm run dev
```

### Production Environment
```bash
# Deploy everything
npm run firebase:deploy

# Or deploy specific components
npm run firebase:hosting  # Just the web app
npm run firebase:functions # Just the backend
```

### Staging Environment
```bash
# Switch to staging project
firebase use staging

# Deploy with validation
npm run firebase:deploy
npm run firebase:validate
```

## 📂 Script Locations

All automation scripts are in the `scripts/` directory:

- `scripts/quick-setup.sh` - Complete automated setup
- `scripts/deploy-firebase.sh` - Deployment automation
- `scripts/init-database.js` - Database initialization
- `scripts/validate-setup.js` - Setup validation

## 🛠️ Troubleshooting

### Common Issues

**"Firebase CLI not found"**
```bash
npm install -g firebase-tools
firebase login
```

**"Permission denied on script execution"**
```bash
chmod +x scripts/*.sh
```

**"Environment variables missing"**
- Check your `.env` file
- Compare with `env.example`
- Ensure all `VITE_FIREBASE_*` variables are set

**"Service account key not found"**
1. Go to Firebase Console → Project Settings → Service Accounts
2. Generate new private key
3. Save as `firebase-service-account.json` in project root

**"Index creation failed"**
- Indexes are automatically created by scripts
- Check Firebase Console → Firestore → Indexes
- May take several minutes to complete

### Getting Help

1. **Run validation:** `npm run firebase:validate`
2. **Check logs:** Look at script output for specific errors
3. **Firebase Console:** Check for any setup issues
4. **Documentation:** Refer to Firebase docs for specific features

## 🚀 Next Steps

After successful setup:

1. **Customize branding** in the web app
2. **Configure payment methods** for paid events
3. **Set up email templates** for notifications
4. **Configure monitoring** and alerts
5. **Add custom domains** for hosting

## 📈 Scaling Considerations

The automation scripts set up:
- ✅ Production-ready security rules
- ✅ Optimized database indexes
- ✅ Scalable architecture patterns
- ✅ Performance monitoring hooks

For high-traffic scenarios, consider:
- Firebase project quotas and limits
- CDN configuration for static assets
- Database partitioning strategies
- Caching layers for frequent queries

---

**🎉 Your APOHUB platform is now ready for event management!** 