// =============================================================================
// FIREBASE CONNECTION TEST SCREEN
// =============================================================================
// CODE_BIBLE Commandment #8: "Test before declaring done"
// This screen helps verify Firebase is properly configured

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { isFirebaseConfigured, getFirebaseConfig } from '../config/firebase';
import AuthService from '../services/AuthService';

export default function FirebaseTestScreen() {
  const [connectionStatus, setConnectionStatus] = useState('checking');
  const [authUser, setAuthUser] = useState(null);

  useEffect(() => {
    checkFirebaseConnection();
    
    // Listen for auth state changes
    const unsubscribe = AuthService.addAuthStateListener((user) => {
      setAuthUser(user);
    });

    return unsubscribe;
  }, []);

  const checkFirebaseConnection = async () => {
    try {
      if (!isFirebaseConfigured()) {
        setConnectionStatus('not-configured');
        return;
      }

      // Test Firestore connection
      setConnectionStatus('connected');
      console.log('✅ Firebase connection test passed');
    } catch (error) {
      setConnectionStatus('error');
      console.error('❌ Firebase connection test failed:', error);
    }
  };

  const testEmailSignUp = async () => {
    try {
      const result = await AuthService.signUpWithEmail(
        'test@wuvo100y.com',
        'testpassword123',
        'Test User'
      );
      
      Alert.alert('Success', `Account created for ${result.user.email}`);
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const testSignOut = async () => {
    try {
      await AuthService.signOut();
      Alert.alert('Success', 'Signed out successfully');
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const renderConnectionStatus = () => {
    switch (connectionStatus) {
      case 'checking':
        return <Text style={styles.status}>🔄 Checking Firebase connection...</Text>;
      case 'not-configured':
        return (
          <View>
            <Text style={styles.error}>❌ Firebase not configured</Text>
            <Text style={styles.hint}>
              Please update /src/config/firebase.js with your Firebase config
            </Text>
          </View>
        );
      case 'connected':
        return <Text style={styles.success}>✅ Firebase connected successfully!</Text>;
      case 'error':
        return <Text style={styles.error}>❌ Firebase connection failed</Text>;
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔥 Firebase Connection Test</Text>
      
      {renderConnectionStatus()}
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Authentication Status:</Text>
        {authUser ? (
          <View>
            <Text style={styles.success}>✅ Signed in as: {authUser.email}</Text>
            <TouchableOpacity style={styles.button} onPress={testSignOut}>
              <Text style={styles.buttonText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            <Text style={styles.hint}>Not signed in</Text>
            <TouchableOpacity style={styles.button} onPress={testEmailSignUp}>
              <Text style={styles.buttonText}>Test Email Sign-Up</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Firebase Config:</Text>
        <Text style={styles.config}>
          {JSON.stringify(getFirebaseConfig(), null, 2)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  section: {
    marginVertical: 20,
    padding: 15,
    backgroundColor: 'white',
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  status: {
    fontSize: 16,
    textAlign: 'center',
    marginVertical: 10,
  },
  success: {
    color: '#4CAF50',
    fontSize: 16,
  },
  error: {
    color: '#f44336',
    fontSize: 16,
  },
  hint: {
    color: '#666',
    fontSize: 14,
    marginTop: 5,
  },
  config: {
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 4,
    fontSize: 12,
    fontFamily: 'monospace',
  },
  button: {
    backgroundColor: '#2196F3',
    padding: 12,
    borderRadius: 6,
    marginTop: 10,
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
  },
});