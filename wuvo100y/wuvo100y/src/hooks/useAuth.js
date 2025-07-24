import { useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../config';
import { isDevModeEnabled, getDevUser } from '../utils/DevConfig';
import { auth, firestore } from '../config/firebase';

export const useAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Firebase Auth: Sign in with email and password
  const signIn = useCallback(async (email, password) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const userCredential = await auth.signInWithEmailAndPassword(email, password);
      const user = userCredential.user;
      
      // Get user profile from Firestore
      const userDoc = await firestore.collection('users').doc(user.uid).get();
      let userData = { id: user.uid, email: user.email };
      
      if (userDoc.exists) {
        userData = { ...userData, ...userDoc.data() };
      }
      
      setUserInfo(userData);
      setIsAuthenticated(true);
      return userData;
    } catch (error) {
      setError(error.message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Firebase Auth: Create new user account
  const signUp = useCallback(async (email, password, displayName, username) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const userCredential = await auth.createUserWithEmailAndPassword(email, password);
      const user = userCredential.user;
      
      // Create user profile in Firestore
      const userData = {
        id: user.uid,
        email: user.email,
        displayName: displayName || 'User',
        username: username || `user_${Date.now()}`,
        createdAt: new Date().toISOString(),
        isPublic: true,
        searchable: true,
        followerCount: 0,
        followingCount: 0,
        ratingCount: 0,
        lastActive: new Date().toISOString(),
        preferences: {
          showRatings: true,
          showWatchlist: true,
          allowComments: true,
          allowRecommendations: true
        }
      };
      
      await firestore.collection('users').doc(user.uid).set(userData);
      
      setUserInfo(userData);
      setIsAuthenticated(true);
      return userData;
    } catch (error) {
      setError(error.message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Legacy method for backward compatibility
  const handleAuthentication = useCallback(async (userData) => {
    if (isDevModeEnabled()) {
      const session = {
        id: userData.id || 'user_' + Date.now(),
        name: userData.name || 'User',
        email: userData.email || '',
        timestamp: new Date().toISOString()
      };
      
      setUserInfo(session);
      setIsAuthenticated(true);
      return session;
    } else {
      // For production, redirect to proper Firebase Auth
      throw new Error('Use signIn() or signUp() methods for Firebase authentication');
    }
  }, []);

  // Firebase Auth: Sign out
  const signOut = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      if (!isDevModeEnabled()) {
        await auth.signOut();
        
        // Clear local storage data on logout
        await AsyncStorage.multiRemove([
          STORAGE_KEYS.USER.SESSION,
          STORAGE_KEYS.USER.PREFERENCES,
          STORAGE_KEYS.USER.ONBOARDING_COMPLETE,
          // Keep movie data for now during migration period
          // STORAGE_KEYS.MOVIES.SEEN,
          // STORAGE_KEYS.MOVIES.UNSEEN
        ]);
      }
      
      setUserInfo(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Sign out error:', error);
      setError(error.message);
      // Still logout locally even if Firebase signOut fails
      setUserInfo(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Legacy method for backward compatibility
  const handleLogout = useCallback(async () => {
    if (isDevModeEnabled()) {
      setUserInfo(null);
      setIsAuthenticated(false);
    } else {
      await signOut();
    }
  }, [signOut]);

  // Firebase Auth: Initialize auth state listener
  const initializeAuth = useCallback(() => {
    if (isDevModeEnabled()) {
      const devUser = getDevUser();
      setUserInfo(devUser);
      setIsAuthenticated(true);
      setIsLoading(false);
      return () => {}; // Return empty cleanup function
    }

    // Firebase Auth state listener
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      try {
        if (user) {
          // User is signed in
          console.log('🔥 Firebase Auth: User signed in:', user.uid);
          
          // Get user profile from Firestore
          const userDoc = await firestore.collection('users').doc(user.uid).get();
          let userData = { id: user.uid, email: user.email };
          
          if (userDoc.exists) {
            userData = { ...userData, ...userDoc.data() };
          }
          
          setUserInfo(userData);
          setIsAuthenticated(true);
        } else {
          // User is signed out
          console.log('🔥 Firebase Auth: User signed out');
          setUserInfo(null);
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error('Auth state change error:', error);
        setError(error.message);
      } finally {
        setIsLoading(false);
      }
    });

    return unsubscribe; // Return cleanup function
  }, []);

  useEffect(() => {
    const unsubscribe = initializeAuth();
    
    // Cleanup auth listener on unmount
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [initializeAuth]);

  return {
    // State
    isAuthenticated,
    userInfo,
    isLoading,
    error,
    
    // Firebase Auth methods
    signIn,
    signUp,
    signOut,
    
    // Legacy methods for backward compatibility
    handleAuthentication,
    handleLogout,
    initializeAuth
  };
};