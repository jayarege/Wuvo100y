// =============================================================================
// FIREBASE CONFIGURATION - SOCIAL FEATURES BACKEND
// =============================================================================
// CODE_BIBLE Commandment #3: "Write code that's clear and obvious"
// CODE_BIBLE Commandment #9: "Handle errors explicitly"

import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

// =============================================================================
// FIREBASE PROJECT CONFIGURATION
// =============================================================================
// ✅ Your actual Firebase configuration 
const firebaseConfig = {
  apiKey: "AIzaSyBoUnBWZWZ2fPclNR3LxZZV98GFVbtaVyE",
  authDomain: "wuvo100y-social.firebaseapp.com",
  databaseURL: "https://wuvo100y-social-default-rtdb.firebaseio.com",
  projectId: "wuvo100y-social",
  storageBucket: "wuvo100y-social.firebasestorage.app",
  messagingSenderId: "263509576989",
  appId: "1:263509576989:web:f1bac2c73bf8638045a5f4",
  measurementId: "G-KF1VVYG0HV"
};

// =============================================================================
// FIREBASE INITIALIZATION
// =============================================================================

let app;
let auth;
let firestore;

try {
  // Initialize Firebase app
  app = initializeApp(firebaseConfig);
  console.log('✅ Firebase app initialized successfully');

  // Initialize Auth with AsyncStorage persistence
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
  console.log('✅ Firebase Auth initialized with persistence');

  // Initialize Firestore
  firestore = getFirestore(app);
  console.log('✅ Firestore initialized successfully');

  // Connect to Firestore emulator in development (optional)
  if (__DEV__ && !firestore._settings?.host?.includes('localhost')) {
    try {
      connectFirestoreEmulator(firestore, 'localhost', 8080);
      console.log('🔧 Connected to Firestore emulator');
    } catch (error) {
      console.log('📡 Using production Firestore (emulator not available)');
    }
  }

} catch (error) {
  console.error('❌ Firebase initialization failed:', error);
  
  // CODE_BIBLE Commandment #9: "Handle errors explicitly"
  // Provide fallback or graceful degradation
  throw new Error(`Firebase initialization failed: ${error.message}`);
}

// =============================================================================
// FIREBASE SERVICES EXPORT
// =============================================================================

export { auth, firestore };
export default app;

// =============================================================================
// DEVELOPMENT HELPERS
// =============================================================================

export const isFirebaseConfigured = () => {
  return firebaseConfig.apiKey !== "your-api-key-here";
};

export const getFirebaseConfig = () => {
  return {
    ...firebaseConfig,
    // Don't expose sensitive keys in logs
    apiKey: firebaseConfig.apiKey.substring(0, 10) + '...'
  };
};

// =============================================================================
// ERROR HANDLING UTILITIES
// =============================================================================

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