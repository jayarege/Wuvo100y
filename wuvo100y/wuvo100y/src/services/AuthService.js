// =============================================================================
// FIREBASE V8 AUTHENTICATION SERVICE - EXPO SNACK COMPATIBLE
// =============================================================================
import { auth, firestore, handleFirebaseError } from '../config/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';

class AuthService {
  constructor() {
    this.currentUser = null;
    this.authStateListeners = [];
    
    // Listen for auth state changes (v8 style)
    auth.onAuthStateChanged((user) => {
      this.currentUser = user;
      this.notifyAuthStateListeners(user);
    });
  }

  // =============================================================================
  // AUTHENTICATION METHODS (FIREBASE V8)
  // =============================================================================

  async signInWithEmail(email, password) {
    try {
      console.log('🔐 Attempting email sign-in...');
      const userCredential = await auth.signInWithEmailAndPassword(email, password);
      const user = userCredential.user;
      
      // Get or create user profile
      const userProfile = await this.getOrCreateUserProfile(user);
      
      console.log('✅ Email sign-in successful:', user.uid);
      return { user, profile: userProfile };
      
    } catch (error) {
      console.error('❌ Email sign-in failed:', error);
      throw new Error(handleFirebaseError(error));
    }
  }

  async signUpWithEmail(email, password, displayName) {
    try {
      console.log('📝 Creating new account...');
      
      const userCredential = await auth.createUserWithEmailAndPassword(email, password);
      const user = userCredential.user;
      
      // Update user profile (v8 style)
      await user.updateProfile({
        displayName: displayName
      });
      
      // Create user profile in Firestore
      const userProfile = await this.createUserProfile(user, {
        displayName,
        email
      });
      
      console.log('✅ Account created successfully:', user.uid);
      return { user, profile: userProfile };
      
    } catch (error) {
      console.error('❌ Account creation failed:', error);
      throw new Error(handleFirebaseError(error));
    }
  }

  async signOut() {
    try {
      console.log('👋 Signing out...');
      await auth.signOut();
      
      // Clear local data if needed
      await this.clearLocalUserData();
      
      console.log('✅ Sign-out successful');
    } catch (error) {
      console.error('❌ Sign-out failed:', error);
      throw new Error(handleFirebaseError(error));
    }
  }

  // =============================================================================
  // USER PROFILE MANAGEMENT (FIREBASE V8)
  // =============================================================================

  async getOrCreateUserProfile(user) {
    try {
      const userDoc = await firestore.collection('users').doc(user.uid).get();
      
      if (userDoc.exists) {
        console.log('📄 User profile found');
        return userDoc.data();
      } else {
        console.log('📝 Creating new user profile');
        return await this.createUserProfile(user);
      }
    } catch (error) {
      console.error('❌ Error getting user profile:', error);
      throw new Error(handleFirebaseError(error));
    }
  }

  async createUserProfile(user, additionalData = {}) {
    try {
      const userProfile = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || additionalData.displayName || 'Movie Enthusiast',
        username: null, // Will be set during onboarding
        profilePicture: user.photoURL || null,
        bio: '',
        isPublic: true,
        followerCount: 0,
        followingCount: 0,
        totalRatings: 0,
        averageRating: 0,
        joinDate: new Date(),
        lastActive: new Date(),
        preferences: {
          darkMode: true,
          discoverySessions: true,
          notifications: {
            follows: true,
            recommendations: true,
            mentions: true
          },
          privacy: {
            profileVisibility: 'public',
            ratingsVisibility: 'public',
            watchlistVisibility: 'public',
            discoverable: true,
            allowFollowRequests: true
          }
        },
        ...additionalData
      };

      await firestore.collection('users').doc(user.uid).set(userProfile);
      console.log('✅ User profile created successfully');
      
      return userProfile;
    } catch (error) {
      console.error('❌ Error creating user profile:', error);
      throw new Error(handleFirebaseError(error));
    }
  }

  async updateUserProfile(updates) {
    try {
      if (!this.currentUser) {
        throw new Error('No authenticated user');
      }

      await firestore.collection('users').doc(this.currentUser.uid).update({
        ...updates,
        lastActive: new Date()
      });

      console.log('✅ User profile updated successfully');
      return true;
    } catch (error) {
      console.error('❌ Error updating user profile:', error);
      throw new Error(handleFirebaseError(error));
    }
  }

  // =============================================================================
  // USERNAME MANAGEMENT
  // =============================================================================

  async checkUsernameAvailability(username) {
    try {
      const usernameQuery = await firestore
        .collection('users')
        .where('username', '==', username.toLowerCase())
        .get();
      
      return usernameQuery.empty;
    } catch (error) {
      console.error('❌ Error checking username availability:', error);
      return false;
    }
  }

  async setUsername(username) {
    try {
      if (!this.currentUser) {
        throw new Error('No authenticated user');
      }

      const isAvailable = await this.checkUsernameAvailability(username);
      if (!isAvailable) {
        throw new Error('Username is already taken');
      }

      await this.updateUserProfile({
        username: username.toLowerCase(),
        displayName: this.currentUser.displayName || username
      });

      console.log('✅ Username set successfully:', username);
      return true;
    } catch (error) {
      console.error('❌ Error setting username:', error);
      throw new Error(handleFirebaseError(error));
    }
  }

  // =============================================================================
  // AUTH STATE MANAGEMENT
  // =============================================================================

  addAuthStateListener(callback) {
    this.authStateListeners.push(callback);
    
    // Immediately call with current state
    callback(this.currentUser);
    
    // Return unsubscribe function
    return () => {
      this.authStateListeners = this.authStateListeners.filter(
        listener => listener !== callback
      );
    };
  }

  notifyAuthStateListeners(user) {
    this.authStateListeners.forEach(callback => {
      try {
        callback(user);
      } catch (error) {
        console.error('❌ Auth state listener error:', error);
      }
    });
  }

  getCurrentUser() {
    return this.currentUser;
  }

  isAuthenticated() {
    return !!this.currentUser;
  }

  // =============================================================================
  // DATA MIGRATION HELPERS
  // =============================================================================

  async migrateLocalData() {
    try {
      if (!this.currentUser) {
        throw new Error('No authenticated user for migration');
      }

      console.log('📦 Starting local data migration...');
      
      // Get existing local data
      const localMovies = await AsyncStorage.getItem('userMovies');
      const localWatchlist = await AsyncStorage.getItem('userWatchlist');
      const localPreferences = await AsyncStorage.getItem('userPreferences');
      
      const migrationData = {
        hasMigratedData: true,
        migrationDate: new Date(),
        localDataFound: {
          movies: !!localMovies,
          watchlist: !!localWatchlist,
          preferences: !!localPreferences
        }
      };

      await this.updateUserProfile(migrationData);
      
      console.log('✅ Data migration metadata saved');
      return true;
    } catch (error) {
      console.error('❌ Data migration failed:', error);
      return false;
    }
  }

  async clearLocalUserData() {
    try {
      // Clear sensitive local data on sign out
      await AsyncStorage.multiRemove([
        'wuvo_user_session',
        'wuvo_cached_user_profile'
      ]);
      
      console.log('🧹 Local user data cleared');
    } catch (error) {
      console.error('❌ Error clearing local data:', error);
    }
  }
}

// Export singleton instance
export default new AuthService();