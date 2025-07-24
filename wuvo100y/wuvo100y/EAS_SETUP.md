# EAS Build Setup - iOS App Store Deployment

## Overview
This document provides step-by-step instructions for configuring EAS (Expo Application Services) to build and deploy the Wuvo app to the iOS App Store.

## Prerequisites
1. **Apple Developer Account** ($99/year)
2. **EAS CLI** installed globally
3. **Expo Account** (free)

## Step 1: Install EAS CLI
```bash
npm install -g eas-cli
```

## Step 2: Login to Expo
```bash
eas login
```

## Step 3: Configure EAS Project
```bash
# Initialize EAS project (creates project ID)
eas init

# This will update app.config.js with your actual project ID
```

## Step 4: Configure EAS Secrets
Run these commands to securely store all required API keys and configuration:

### API Keys
```bash
eas secret:create --scope project --name TMDB_API_KEY --value "your-tmdb-api-key"
eas secret:create --scope project --name GROQ_API_KEY --value "your-groq-api-key"
```

### Firebase Configuration
```bash
eas secret:create --scope project --name FIREBASE_API_KEY --value "AIzaSyBoUnBWZWZ2fPclNR3LxZZV98GFVbtaVyE"
eas secret:create --scope project --name FIREBASE_AUTH_DOMAIN --value "wuvo100y-social.firebaseapp.com"
eas secret:create --scope project --name FIREBASE_DATABASE_URL --value "https://wuvo100y-social-default-rtdb.firebaseio.com"
eas secret:create --scope project --name FIREBASE_PROJECT_ID --value "wuvo100y-social"
eas secret:create --scope project --name FIREBASE_STORAGE_BUCKET --value "wuvo100y-social.firebasestorage.app"
eas secret:create --scope project --name FIREBASE_MESSAGING_SENDER_ID --value "263509576989"
eas secret:create --scope project --name FIREBASE_APP_ID --value "1:263509576989:web:f1bac2c73bf8638045a5f4"
eas secret:create --scope project --name FIREBASE_MEASUREMENT_ID --value "G-KF1VVYG0HV"
```

## Step 5: Build Configuration
The app is configured with three build profiles:

### Development Build
```bash
eas build --profile development --platform ios
```

### Preview Build (Internal Testing)
```bash
eas build --profile preview --platform ios
```

### Production Build (App Store)
```bash
eas build --profile production --platform ios
```

## Step 6: Apple Developer Setup
1. **Register Bundle Identifier**: `com.wuvo.wuvo`
2. **Create App Store Connect App**
3. **Configure Certificates and Provisioning Profiles**

## Step 7: Submit to App Store
```bash
eas submit --profile production --platform ios
```

## Security Notes
- ✅ **No hardcoded secrets** in source code
- ✅ **Environment-based configuration** via app.config.js
- ✅ **EAS secrets** for secure key management
- ✅ **Production Firebase** database preserved

## Troubleshooting

### Missing Secrets Error
If you get "Missing environment variables" error:
```bash
# List all secrets
eas secret:list

# Add missing secrets using commands above
```

### Build Failures
1. Check bundle identifier matches Apple Developer account
2. Verify all EAS secrets are configured
3. Ensure Apple certificates are valid

### Firebase Connection Issues
1. Verify Firebase project permissions
2. Check Firebase configuration in secrets
3. Test authentication in development build first

## Next Steps After Setup
1. **Test Preview Build** - Install on device via TestFlight
2. **Create App Store Listing** - Screenshots, descriptions, etc.
3. **Submit for Review** - Apple's review process (1-7 days)
4. **Monitor Release** - Track downloads and crashes

## File Structure
```
├── eas.json              # EAS build configuration
├── app.config.js         # Dynamic app configuration
├── app.json.backup       # Original static config (preserved)
└── EAS_SETUP.md          # This documentation
```

## Important Files Modified
- **src/config/environment.js** - Removed hardcoded API keys
- **src/config/firebase.js** - Secure Firebase configuration
- **src/config/apiConfig.js** - Removed legacy hardcoded keys

---

**CRITICAL**: This is a production app with real user data. Handle Firebase configuration changes carefully to avoid breaking existing user authentication.