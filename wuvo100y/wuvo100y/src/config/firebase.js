// =============================================================================
// FIREBASE V8 CONFIGURATION - EXPO SNACK COMPATIBLE
// =============================================================================
import firebase from 'firebase';

// Your Firebase configuration
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

// Initialize Firebase (v8 style)
let app;
if (!firebase.apps.length) {
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
  return firebaseConfig.apiKey !== "your-api-key-here";
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