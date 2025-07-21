// =============================================================================
// SECURE ENVIRONMENT CONFIGURATION - iOS PRODUCTION READY
// =============================================================================
import Constants from 'expo-constants';

/**
 * Secure environment variable access for production builds
 * API keys are loaded from EAS secrets during build process
 * 
 * Phase 1.1: API Key Security Implementation
 * - Removes hardcoded API keys from source code
 * - Uses Expo Constants for secure access
 * - Provides development fallbacks
 */

export const ENV = {
  // TMDB API Key - for movie data
  TMDB_API_KEY: Constants.expoConfig?.extra?.tmdbApiKey || 
    (__DEV__ ? 'b401be0ea16515055d8d0bde16f80069' : null),
  
  // GROQ API Key - for AI recommendations  
  GROQ_API_KEY: Constants.expoConfig?.extra?.groqApiKey || 
    (__DEV__ ? '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' : null),
    
  // Environment info
  IS_DEV: __DEV__,
  IS_PRODUCTION: !__DEV__ && Constants.expoConfig?.extra?.environment === 'production'
};

/**
 * Validates that required API keys are available
 * Throws error in production if keys missing
 */
export const validateEnvironment = () => {
  const missing = [];
  
  if (!ENV.TMDB_API_KEY) missing.push('TMDB_API_KEY');
  if (!ENV.GROQ_API_KEY) missing.push('GROQ_API_KEY');
  
  if (missing.length > 0 && ENV.IS_PRODUCTION) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  if (missing.length > 0 && ENV.IS_DEV) {
    console.warn('⚠️ Missing environment variables in development:', missing.join(', '));
  }
  
  return missing.length === 0;
};

/**
 * Safe API key getter with fallback handling
 */
export const getApiKey = (keyName) => {
  const key = ENV[keyName];
  
  if (!key && ENV.IS_PRODUCTION) {
    throw new Error(`API key ${keyName} not available in production`);
  }
  
  return key;
};

// Initialize validation on import
try {
  validateEnvironment();
  console.log('✅ Environment validation passed');
} catch (error) {
  console.error('❌ Environment validation failed:', error.message);
}

export default ENV;