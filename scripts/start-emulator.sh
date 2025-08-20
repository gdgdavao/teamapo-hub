#!/bin/bash

# Script to start Firebase Emulator with proper setup
# This helps reduce Firebase billing costs by using local emulators

echo "🔥 Starting Firebase Emulator Suite..."
echo "💰 This will help reduce your Firebase billing costs!"
echo ""

# Check if emulator data directory exists
if [ ! -d "./emulator-data" ]; then
    echo "📁 Creating emulator-data directory..."
    mkdir -p emulator-data
fi

# Check if .env file exists for emulator config
if [ ! -f ".env" ]; then
    echo "⚠️  No .env file found. Creating one for emulator development..."
    cat > .env << EOL
# Firebase Configuration (for emulator - these can be dummy values)
VITE_FIREBASE_API_KEY=demo-api-key
VITE_FIREBASE_AUTH_DOMAIN=demo-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=demo-project
VITE_FIREBASE_STORAGE_BUCKET=demo-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=demo-app-id
VITE_FIREBASE_MEASUREMENT_ID=demo-measurement-id

# Firebase Emulator (set to 'true' to use local emulators)
VITE_USE_EMULATOR=true

# Paymongo Configuration (add your real keys here)
VITE_PAYMONGO_PUBLIC_KEY=pk_test_your_paymongo_public_key
VITE_PAYMONGO_SECRET_KEY=sk_test_your_paymongo_secret_key

# Application Settings
VITE_APP_URL=http://localhost:5173
VITE_APP_NAME=APOHUB
VITE_ORGANIZATION=GDG Davao
EOL
    echo "✅ Created .env file with emulator configuration"
fi

echo ""
echo "🚀 Starting Firebase Emulator Suite..."
echo "📊 Emulator UI will be available at: http://localhost:4000"
echo "🔥 Firestore: http://localhost:8080"
echo "👤 Auth: http://localhost:9099"
echo "📦 Storage: http://localhost:9199"
echo "⚡ Functions: http://localhost:5001"
echo ""
echo "💡 Tip: After emulators start, run 'npm run sample-data' to add test data"
echo "🎯 Or use 'npm run emulator:with-data' to start with sample data"
echo ""
echo "Press Ctrl+C to stop the emulators"
echo ""

# Start with import if data exists, otherwise start fresh
if [ -d "./emulator-data" ] && [ "$(ls -A ./emulator-data)" ]; then
    echo "📂 Importing existing emulator data..."
    firebase emulators:start --only auth,firestore,functions,storage --import=./emulator-data --export-on-exit
else
    echo "🆕 Starting fresh emulator (no existing data found)..."
    firebase emulators:start --only auth,firestore,functions,storage --export-on-exit=./emulator-data
fi 