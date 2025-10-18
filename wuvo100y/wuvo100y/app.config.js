// =============================================================================
// EXPO APP CONFIGURATION - EAS BUILD COMPATIBLE
// =============================================================================
// WHY: Dynamic configuration needed for secure environment variable injection
// WHAT: Replaces static app.json with dynamic config supporting EAS secrets
// HOW: Environment variables injected at build time via EAS secrets

// Environment variables loaded from EAS secrets in production
// Development uses fallback values in firebase.js

module.exports = ({ config }) => {
  const isProduction = process.env.EXPO_PUBLIC_ENV === 'production';
  const isPreview = process.env.EXPO_PUBLIC_ENV === 'preview';
  const isDevelopment = process.env.EXPO_PUBLIC_ENV === 'development';
  
  // Dynamic versioning based on environment
  const version = process.env.APP_VERSION || '1.0.0';
  const buildNumber = process.env.BUILD_NUMBER || version;
  
  return {
    ...config,
    name: isProduction ? 'Wuvo' : (isPreview ? 'Wuvo Preview' : 'Wuvo Dev'),
    slug: 'wuvo-movie-rating',
    version: version,
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    newArchEnabled: true,
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff'
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: isDevelopment ? 'com.wuvo.wuvo.app.dev' : 'com.wuvo.wuvo.app',
      // Dynamic build number based on environment
      buildNumber: buildNumber
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff'
      },
      package: 'com.wuvo.wuvo',
      versionCode: 1
    },
    web: {
      favicon: './assets/favicon.png'
    },
    scheme: 'wuvo',
    extra: {
      // EAS Project configuration
      eas: {
        projectId: process.env.EAS_PROJECT_ID || 'placeholder-project-id'
      },
      
      // Environment flag
      environment: isProduction ? 'production' : (isPreview ? 'preview' : 'development'),
      
      // API Keys (injected securely via EAS secrets)
      tmdbApiKey: process.env.TMDB_API_KEY,
      groqApiKey: process.env.GROQ_API_KEY,
      
      // Firebase Configuration (injected securely via EAS secrets)
      firebaseApiKey: process.env.FIREBASE_API_KEY,
      firebaseAuthDomain: process.env.FIREBASE_AUTH_DOMAIN,
      firebaseDatabaseURL: process.env.FIREBASE_DATABASE_URL,
      firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
      firebaseStorageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      firebaseMessagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
      firebaseAppId: process.env.FIREBASE_APP_ID,
      firebaseMeasurementId: process.env.FIREBASE_MEASUREMENT_ID
    },
    
    // Build-specific configurations
    updates: {
      fallbackToCacheTimeout: 0
    },
    assetBundlePatterns: [
      '**/*'
    ]
  };
};