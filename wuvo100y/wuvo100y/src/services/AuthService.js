// =============================================================================
// FIREBASE AUTHENTICATION SERVICE
// =============================================================================
// CODE_BIBLE Commandment #3: "Write code that's clear and obvious"
// CODE_BIBLE Commandment #9: "Handle errors explicitly"
// CODE_BIBLE Commandment #10: "Treat user data as sacred"

import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  GoogleAuthProvider,
  signInWithCredential
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  serverTimestamp,
  collection,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { auth, firestore, handleFirebaseError } from '../config/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';

class AuthService {
  constructor() {
    this.currentUser = null;
    this.authStateListeners = [];
    
    // Listen for auth state changes
    onAuthStateChanged(auth, (user) => {
      this.currentUser = user;
      this.notifyAuthStateListeners(user);
    });
  }

  // =============================================================================
  // AUTHENTICATION METHODS
  // =============================================================================

  async signInWithEmail(email, password) {
    try {
      console.log('🔐 Attempting email sign-in...');
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
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
      
      // Check if username is available (we'll add this later)
      // const isUsernameAvailable = await this.checkUsernameAvailability(username);
      
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Update user profile
      await updateProfile(user, {
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

  async signInWithGoogle(googleCredential) {
    try {
      console.log('🔐 Attempting Google sign-in...');
      
      // Create credential from Google auth response
      const credential = GoogleAuthProvider.credential(
        googleCredential.idToken,
        googleCredential.accessToken
      );
      
      const userCredential = await signInWithCredential(auth, credential);
      const user = userCredential.user;
      
      // Get or create user profile
      const userProfile = await this.getOrCreateUserProfile(user);
      
      console.log('✅ Google sign-in successful:', user.uid);
      return { user, profile: userProfile };
      
    } catch (error) {
      console.error('❌ Google sign-in failed:', error);
      throw new Error(handleFirebaseError(error));
    }
  }

  async signOut() {
    try {
      console.log('👋 Signing out...');
      await signOut(auth);
      
      // Clear local data if needed
      await this.clearLocalUserData();
      
      console.log('✅ Sign-out successful');
    } catch (error) {
      console.error('❌ Sign-out failed:', error);
      throw new Error(handleFirebaseError(error));
    }
  }

  // =============================================================================
  // USER PROFILE MANAGEMENT
  // =============================================================================

  async getOrCreateUserProfile(user) {
    try {
      const userDoc = await getDoc(doc(firestore, 'users', user.uid));
      
      if (userDoc.exists()) {
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
        joinDate: serverTimestamp(),
        lastActive: serverTimestamp(),
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

      await setDoc(doc(firestore, 'users', user.uid), userProfile);
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

      await updateDoc(doc(firestore, 'users', this.currentUser.uid), {
        ...updates,
        lastActive: serverTimestamp()
      });

      console.log('✅ User profile updated successfully');
      return true;
    } catch (error) {
      console.error('❌ Error updating user profile:', error);
      throw new Error(handleFirebaseError(error));
    }
  }

  // =============================================================================
  // USERNAME MANAGEMENT (Phase 2)
  // =============================================================================

  async checkUsernameAvailability(username) {
    try {
      const usernameQuery = query(
        collection(firestore, 'users'),
        where('username', '==', username.toLowerCase())
      );
      
      const querySnapshot = await getDocs(usernameQuery);
      return querySnapshot.empty;
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
        migrationDate: serverTimestamp(),
        localDataFound: {
          movies: !!localMovies,
          watchlist: !!localWatchlist,
          preferences: !!localPreferences
        }
      };

      // We'll implement the actual data migration in Phase 1.5
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