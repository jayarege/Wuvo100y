# Firebase Demo Account Implementation Guide

## Overview
**CRITICAL REQUIREMENT**: App Store requires demo account for app review process.
**Firebase Project**: `wuvo100y-social` (production database with real users)

## Demo Account Specifications
- **Email**: `demo@wuvo.app`
- **Password**: `DemoAccount123!`
- **Purpose**: Apple App Store reviewer access

## Implementation Steps

### Step 1: Access Firebase Console
1. **Open Firebase Console**: https://console.firebase.google.com/
2. **Select Project**: `wuvo100y-social`
3. **Navigate to Authentication** → Users tab

### Step 2: Create Demo User Account
#### Method A: Firebase Console (Recommended)
1. **Click "Add User"** in Authentication → Users
2. **Enter Details**:
   - Email: `demo@wuvo.app`
   - Password: `DemoAccount123!`
   - Email Verified: ✅ Check this box
3. **Save User**

#### Method B: Firebase Auth API (Alternative)
```javascript
// If running this from Firebase Functions or admin SDK
const admin = require('firebase-admin');

const createDemoAccount = async () => {
  try {
    const userRecord = await admin.auth().createUser({
      email: 'demo@wuvo.app',
      password: 'DemoAccount123!',
      emailVerified: true,
      displayName: 'Demo Account'
    });
    console.log('Demo account created:', userRecord.uid);
  } catch (error) {
    console.error('Error creating demo account:', error);
  }
};
```

### Step 3: Populate Demo Account with Sample Data
**IMPORTANT**: Demo account needs realistic data for App Store review.

#### 3.1 Sample Movies to Rate (via App Interface)
**Login as demo account and rate these movies**:

**High Ratings (8-10)**:
- The Shawshank Redemption (1994)
- The Godfather (1972) 
- Pulp Fiction (1994)
- The Dark Knight (2008)
- Forrest Gump (1994)

**Medium Ratings (5-7)**:
- Spider-Man: No Way Home (2021)
- Top Gun: Maverick (2022)
- Avatar: The Way of Water (2022)
- Black Panther (2018)
- Wonder Woman (2017)

**Lower Ratings (3-5)**:
- Justice League (2017)
- The Mummy (2017)
- Fantastic Four (2015)
- Green Lantern (2011)
- Cats (2019)

#### 3.2 Social Features Setup
1. **Profile Information**:
   - Display Name: "Demo User"
   - Bio: "Sample account for app review"
   - Profile Picture: Default avatar

2. **Friend Connections** (Optional):
   - Add 1-2 existing users as friends for social feature demonstration

3. **Comments/Reviews**:
   - Add 2-3 sample comments on popular movies
   - Keep content appropriate and relevant

### Step 4: Validation Testing

#### 4.1 Authentication Test
```bash
# Test login from app
1. Open app
2. Navigate to login screen
3. Enter: demo@wuvo.app / DemoAccount123!
4. Verify successful login
5. Check profile data loads correctly
```

#### 4.2 Feature Testing Checklist
- [ ] **Login**: Successful authentication
- [ ] **Movie Rating**: Can rate movies via comparison system
- [ ] **Watchlist**: Can add/remove movies from watchlist
- [ ] **Social Features**: Comments and friend connections work
- [ ] **Discovery**: AI recommendations generate properly
- [ ] **Profile**: User data displays correctly

#### 4.3 Data Verification in Firebase
1. **Firestore Database** → Users collection
2. **Find demo user document** (by email or UID)
3. **Verify data structure**:
   ```json
   {
     "email": "demo@wuvo.app",
     "displayName": "Demo User",
     "ratedMovies": [...],
     "watchlist": [...],
     "social": {...}
   }
   ```

### Step 5: App Store Connect Configuration

#### 5.1 Add Demo Account to App Information
1. **App Store Connect** → Your App → App Information
2. **Demo Account Section**:
   - Username: `demo@wuvo.app`
   - Password: `DemoAccount123!`
   - Additional Notes: "Demo account with sample ratings and social data"

#### 5.2 Review Notes Template
```
DEMO ACCOUNT ACCESS:
Email: demo@wuvo.app
Password: DemoAccount123!

FEATURES TO TEST:
1. Movie Discovery - View AI-powered recommendations
2. Rating System - Rate movies through comparison battles
3. Social Features - View friend comments and recommendations
4. Watchlist - Add/remove movies from personal watchlist
5. Profile - View user statistics and top-rated movies

SAMPLE DATA:
- Account has 15+ rated movies across different genres
- Includes high, medium, and low ratings for comparison testing
- Social features populated with sample comments
- Watchlist contains 5-10 movies for testing

SPECIAL NOTES:
- App uses Firebase authentication
- Rating system uses unique comparison-based approach
- Social features are friend-only for privacy
```

## Security Considerations

### Data Protection
- **Real User Data**: Production database contains actual user data
- **Demo Isolation**: Demo account is separate from real users
- **Privacy**: Demo data follows same privacy rules as real accounts

### Access Control
- **Limited Scope**: Demo account only for App Store review
- **No Admin Access**: Demo account has standard user permissions
- **Data Cleanup**: Option to remove demo data post-approval

## Troubleshooting

### "User Already Exists"
```bash
# Check if demo@wuvo.app already exists
# If yes, reset password instead of creating new account
# Firebase Console → Authentication → Users → Find user → Reset Password
```

### "Email Not Verified"
```bash
# Manually verify email in Firebase Console
# Authentication → Users → demo@wuvo.app → Edit → Email Verified: ✅
```

### "No Sample Data"
```bash
# Login to app as demo user and manually rate movies
# Or use Firebase Functions to populate programmatically
```

## Automation Script (Optional)

### Firebase Functions Setup
```javascript
// functions/createDemoData.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');

exports.setupDemoAccount = functions.https.onCall(async (data, context) => {
  // Create user account
  // Populate sample ratings
  // Add to social features
  // Return success status
});
```

## Completion Checklist
- [ ] Demo account created in Firebase Authentication
- [ ] Sample movie ratings added (15+ movies)
- [ ] Social features populated with sample data
- [ ] Watchlist contains sample movies
- [ ] Login tested successfully from app
- [ ] All core features verified working
- [ ] App Store Connect metadata updated with credentials
- [ ] Review notes prepared with demo account details

---

**CRITICAL SUCCESS FACTOR**: Demo account must demonstrate all app features working properly for Apple reviewer.

**Timeline**: 30 minutes setup + 15 minutes testing = 45 minutes total

**Next Step**: Test demo account thoroughly before App Store submission to ensure reviewer experience is smooth.