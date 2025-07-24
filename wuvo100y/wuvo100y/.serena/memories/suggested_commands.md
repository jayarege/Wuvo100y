# Suggested Commands for Wuvo100y Development

## Development Commands
```bash
# Start development server
npm run start
expo start

# Start on specific platforms
npm run ios
npm run android
npm run web

# Install dependencies
npm install

# Clear cache if needed
expo start --clear
```

## EAS Build Commands (Phase 2 Implementation)
```bash
# Install EAS CLI globally
npm install -g eas-cli

# Login to Expo
eas login

# Initialize EAS project
eas init

# Build for different environments
eas build --profile development --platform ios
eas build --profile preview --platform ios
eas build --profile production --platform ios

# Submit to App Store
eas submit --profile production --platform ios

# Manage secrets
eas secret:create --scope project --name SECRET_NAME --value "secret_value"
eas secret:list
```

## Firebase Configuration (Phase 1 Security)
```bash
# Environment variables needed (via EAS secrets):
# TMDB_API_KEY, GROQ_API_KEY
# FIREBASE_API_KEY, FIREBASE_AUTH_DOMAIN, FIREBASE_DATABASE_URL
# FIREBASE_PROJECT_ID, FIREBASE_STORAGE_BUCKET
# FIREBASE_MESSAGING_SENDER_ID, FIREBASE_APP_ID, FIREBASE_MEASUREMENT_ID
```

## Git Commands
```bash
git status
git add .
git commit -m "descriptive message"
git push origin main
```

## System Commands (Linux)
```bash
ls -la          # List files
grep -r "text"  # Search in files
find . -name    # Find files by name
cd directory    # Change directory
```

## Phase 3 Implementation Commands
```bash
# No specific build commands yet - focus on:
# 1. Reviewing documentation requirements
# 2. Implementing App Store Connect metadata
# 3. Setting up privacy policy hosting
# 4. Preparing demo account and screenshots
```