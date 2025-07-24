// =============================================================================
// FIREBASE V8 CONFIGURATION - SECURE PRODUCTION READY
// =============================================================================
import firebase from 'firebase';
import Constants from 'expo-constants';

// WHY: Hardcoded Firebase config was security risk for App Store submission
// WHAT: Config now loads from secure environment variables in production
// HOW: Falls back to development config for local testing
// CRITICAL: This is PRODUCTION database with REAL USER DATA - handle carefully!

const firebaseConfig = {
  apiKey: Constants.expoConfig?.extra?.firebaseApiKey || 
    (__DEV__ ? "AIzaSyBoUnBWZWZ2fPclNR3LxZZV98GFVbtaVyE" : null),
  authDomain: Constants.expoConfig?.extra?.firebaseAuthDomain || 
    (__DEV__ ? "wuvo100y-social.firebaseapp.com" : null),
  databaseURL: Constants.expoConfig?.extra?.firebaseDatabaseURL || 
    (__DEV__ ? "https://wuvo100y-social-default-rtdb.firebaseio.com" : null),
  projectId: Constants.expoConfig?.extra?.firebaseProjectId || 
    (__DEV__ ? "wuvo100y-social" : null),
  storageBucket: Constants.expoConfig?.extra?.firebaseStorageBucket || 
    (__DEV__ ? "wuvo100y-social.firebasestorage.app" : null),
  messagingSenderId: Constants.expoConfig?.extra?.firebaseMessagingSenderId || 
    (__DEV__ ? "263509576989" : null),
  appId: Constants.expoConfig?.extra?.firebaseAppId || 
    (__DEV__ ? "1:263509576989:web:f1bac2c73bf8638045a5f4" : null),
  measurementId: Constants.expoConfig?.extra?.firebaseMeasurementId || 
    (__DEV__ ? "G-KF1VVYG0HV" : null)
};

// Validate Firebase configuration before initialization
const validateFirebaseConfig = () => {
  const required = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
  const missing = required.filter(key => !firebaseConfig[key]);
  
  if (missing.length > 0) {
    const error = `Missing Firebase config: ${missing.join(', ')}`;
    if (!__DEV__) {
      throw new Error(error);
    } else {
      console.warn('⚠️ Firebase config incomplete in development:', missing.join(', '));
    }
  }
  
  console.log('✅ Firebase configuration validated');
  return missing.length === 0;
};

// Initialize Firebase (v8 style) with validation
let app;
if (!firebase.apps.length) {
  validateFirebaseConfig();
  app = firebase.initializeApp(firebaseConfig);
} else {
  app = firebase.app();
}

// Initialize services (v8 style)
const auth = firebase.auth();
const firestore = firebase.firestore();

// Firebase v8 compatible exports
export { auth, firestore };
export default app;

// Utility functions
export const isFirebaseConfigured = () => {
  return firebaseConfig.apiKey && firebaseConfig.apiKey !== "your-api-key-here";
};

export const getFirebaseConfig = () => {
  return {
    ...firebaseConfig,
    apiKey: firebaseConfig.apiKey.substring(0, 10) + '...'
  };
};

export const handleFirebaseError = (error) => {
  const errorMessages = {
    'auth/user-not-found': 'No account found with this email address.',
    'auth/wrong-password': 'Incorrect password. Please try again.',
    'auth/email-already-in-use': 'An account already exists with this email address.',
    'auth/weak-password': 'Password should be at least 6 characters long.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/network-request-failed': 'Network error. Please check your connection.',
    'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
    'permission-denied': 'You don\'t have permission to access this data.',
    'unavailable': 'Service temporarily unavailable. Please try again.',
  };

  return errorMessages[error.code] || error.message || 'An unexpected error occurred.';
};