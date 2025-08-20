# Firebase Emulator Setup Guide

🎯 **Goal**: Reduce Firebase billing costs by using local emulators for development

## 🚀 Quick Start

### Option 1: Use the automated script (Recommended)
```bash
./scripts/start-emulator.sh
```

### Option 2: Manual setup

1. **Create environment file**:
```bash
cp env.example .env
# Edit .env and set VITE_USE_EMULATOR=true
```

2. **Start the emulators**:
```bash
npm run emulator:start
```

3. **In another terminal, start your app**:
```bash
npm run dev:emulator
```

### Option 3: Run everything at once
```bash
npm run dev:full
```

## 📊 Emulator URLs

Once running, you can access:

- **Emulator UI**: http://localhost:4000 (Main dashboard)
- **Firestore**: http://localhost:8080
- **Authentication**: http://localhost:9099  
- **Storage**: http://localhost:9199
- **Functions**: http://localhost:5001
- **Your App**: http://localhost:5173

## 💡 Available NPM Scripts

```bash
# Development with emulator
npm run dev:emulator              # Start dev server with emulator mode
npm run dev:full                  # Start both emulator and dev server

# Emulator management
npm run emulator:start            # Start emulators (fresh)
npm run emulator:start:import     # Start with saved data
npm run emulator:export           # Export current data
npm run emulator:clear            # Start with data import & auto-export on exit

# Sample data (for testing)
npm run sample-data               # Populate emulator with sample data
npm run emulator:with-data        # Start emulator and add sample data
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file with these settings:

```env
# Firebase Configuration (dummy values work fine for emulator)
VITE_FIREBASE_API_KEY=demo-api-key
VITE_FIREBASE_AUTH_DOMAIN=demo-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=demo-project
VITE_FIREBASE_STORAGE_BUCKET=demo-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=demo-app-id
VITE_FIREBASE_MEASUREMENT_ID=demo-measurement-id

# Enable emulator mode
VITE_USE_EMULATOR=true

# Your real Paymongo keys
VITE_PAYMONGO_PUBLIC_KEY=pk_test_your_actual_key
VITE_PAYMONGO_SECRET_KEY=sk_test_your_actual_key

# App settings
VITE_APP_URL=http://localhost:5173
VITE_APP_NAME=APOHUB
VITE_ORGANIZATION=GDG Davao
```

### Switching Between Emulator and Production

**For Local Development (Emulator)**:
```env
VITE_USE_EMULATOR=true
```

**For Production Testing**:
```env
VITE_USE_EMULATOR=false
# Add your real Firebase config values
```

## 📁 Data Persistence

- Emulator data is saved in `./emulator-data/` directory
- Data persists between emulator restarts when using import/export
- You can reset by deleting the `emulator-data` folder

## 🎯 Sample Data for Testing

The project includes a comprehensive sample data script that creates realistic test data:

### What's Included
- **3 Users**: 1 admin, 2 organizers with different roles
- **4 Events**: Mix of workshops, conferences (3 published, 1 draft)
- **4 Registrations**: Sample attendee registrations across events
- **1 Feedback**: Sample event feedback with ratings
- **1 Certificate**: Sample completion certificate
- **4 System Settings**: Basic app configuration
- **3 Activity Logs**: Sample system activity tracking

### How to Use Sample Data

```bash
# Option 1: Add to existing emulator
npm run sample-data

# Option 2: Start fresh with sample data
npm run emulator:with-data

# Option 3: Manual approach
npm run emulator:start
# Wait for emulators to start, then:
npm run sample-data
```

### Test User Accounts

After running sample data, you can test with these accounts:

- **Admin**: admin@gdgdavao.org
  - Full system access
  - Can manage all events and users
  
- **Organizer**: maria.organizer@gdgdavao.org
  - Can create and manage events
  - Limited admin access

- **Organizer**: carlos.dev@gdgdavao.org
  - Alternative organizer account
  - Backend development focused

### Sample Events Available

1. **React Workshop** (Published)
   - Hands-on React development workshop
   - 23 registered attendees
   - Mix of paid ticket types

2. **Google I/O Extended** (Published)
   - Large conference-style event
   - Free admission
   - 45 registered attendees

3. **Node.js Bootcamp** (Published)
   - 3-day intensive bootcamp
   - Mixed pricing (student/professional)
   - 19 registered attendees

4. **Flutter Workshop** (Draft)
   - Mobile app development workshop
   - Online event
   - Still in draft mode for testing

## 🧪 Testing Features

### Authentication
- Create test users without affecting production
- Test Google Sign-in (works in emulator UI)
- No email verification required in emulator mode

### Firestore
- Full Firestore functionality
- Real-time updates work normally
- Security rules are enforced
- No billing for reads/writes

### Storage  
- Upload/download files locally
- No storage costs
- Same API as production

### Functions
- Functions run locally
- Python functions supported (your current setup)
- Debug with console logs
- No invocation costs

## 🛠️ Troubleshooting

### Emulator won't start
```bash
# Kill any existing Firebase processes
pkill -f firebase
pkill -f emulator

# Try starting again
npm run emulator:start
```

### Port conflicts
Edit `firebase.json` and change the ports:
```json
{
  "emulators": {
    "auth": { "port": 9099 },
    "firestore": { "port": 8080 },
    "functions": { "port": 5001 },
    "storage": { "port": 9199 },
    "ui": { "port": 4000 }
  }
}
```

### App not connecting to emulator
1. Check console logs for connection messages
2. Verify `VITE_USE_EMULATOR=true` in your `.env`
3. Make sure emulators are running first

### Functions not working
Make sure you have Python 3.13 installed (as specified in firebase.json)

## 💰 Cost Savings

Using emulators eliminates costs for:
- ✅ Firestore reads/writes
- ✅ Authentication operations  
- ✅ Storage uploads/downloads
- ✅ Function invocations
- ✅ Data egress

**Estimated savings**: $50-200+ per month depending on usage

## 🔄 Workflow

### Daily Development
1. `./scripts/start-emulator.sh` - Start emulators
2. Develop and test features locally
3. Data automatically saved on exit

### Before Deploying
1. Set `VITE_USE_EMULATOR=false`
2. Test against production Firebase
3. Deploy when ready

### Production Deployment  
```bash
npm run build
firebase deploy
```

## 📋 Best Practices

1. **Always develop with emulator** to avoid costs
2. **Export data regularly** for backup
3. **Test critical features** against production before deploying
4. **Use production mode** only for final testing
5. **Monitor Firebase console** for any unexpected usage

## 🆘 Need Help?

- Check emulator logs in terminal
- Visit Emulator UI at http://localhost:4000
- Review Firebase documentation
- Check this project's GitHub issues

---

**Happy cost-effective developing! 🎉** 