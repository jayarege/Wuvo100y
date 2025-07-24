import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  SafeAreaView
} from 'react-native';
import { useAuth } from '../hooks/useAuth';

const FirebaseAuthTest = ({ onClose }) => {
  const [email, setEmail] = useState('test@wuvo100y.com');
  const [password, setPassword] = useState('testpass123');
  const [displayName, setDisplayName] = useState('Test User');
  const [username, setUsername] = useState('testuser123');
  const [isSignUp, setIsSignUp] = useState(false);
  
  const { 
    signIn, 
    signUp, 
    signOut, 
    isAuthenticated, 
    userInfo, 
    isLoading, 
    error 
  } = useAuth();

  const handleAuth = async () => {
    try {
      if (isSignUp) {
        await signUp(email, password, displayName, username);
        Alert.alert('Success', 'Account created successfully!');
      } else {
        await signIn(email, password);
        Alert.alert('Success', 'Signed in successfully!');
      }
    } catch (error) {
      Alert.alert('Auth Error', error.message);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      Alert.alert('Success', 'Signed out successfully!');
    } catch (error) {
      Alert.alert('Sign Out Error', error.message);
    }
  };

  if (isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>🎉 Firebase Auth Test Success!</Text>
          
          <View style={styles.userInfo}>
            <Text style={styles.label}>User Info:</Text>
            <Text style={styles.info}>ID: {userInfo?.id}</Text>
            <Text style={styles.info}>Email: {userInfo?.email}</Text>
            <Text style={styles.info}>Display Name: {userInfo?.displayName}</Text>
            <Text style={styles.info}>Username: {userInfo?.username}</Text>
          </View>

          <TouchableOpacity style={styles.button} onPress={handleSignOut} disabled={isLoading}>
            {isLoading ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text style={styles.buttonText}>Sign Out</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Close Test</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>🔥 Firebase Auth Test</Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {isSignUp && (
            <>
              <TextInput
                style={styles.input}
                placeholder="Display Name"
                value={displayName}
                onChangeText={setDisplayName}
              />

              <TextInput
                style={styles.input}
                placeholder="Username"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
              />
            </>
          )}

          {error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity style={styles.button} onPress={handleAuth} disabled={isLoading}>
            {isLoading ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text style={styles.buttonText}>
                {isSignUp ? 'Sign Up' : 'Sign In'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.switchButton} 
            onPress={() => setIsSignUp(!isSignUp)}
          >
            <Text style={styles.switchButtonText}>
              {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Close Test</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C2526',
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 30,
  },
  form: {
    width: '100%',
  },
  input: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#4B0082',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    marginBottom: 15,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  switchButton: {
    alignItems: 'center',
    marginBottom: 15,
  },
  switchButtonText: {
    color: '#FFD700',
    fontSize: 14,
  },
  closeButton: {
    alignItems: 'center',
    padding: 10,
  },
  closeButtonText: {
    color: '#999',
    fontSize: 14,
  },
  error: {
    color: '#F44336',
    textAlign: 'center',
    marginBottom: 15,
  },
  userInfo: {
    backgroundColor: 'rgba(75, 0, 130, 0.1)',
    borderRadius: 8,
    padding: 15,
    marginBottom: 20,
  },
  label: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  info: {
    color: '#FFF',
    fontSize: 14,
    marginBottom: 5,
  },
});

export default FirebaseAuthTest;