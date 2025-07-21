import React, { useState } from 'react';
import {
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  TextInput, 
  SafeAreaView,
  Alert,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AuthService from '../services/AuthService';

// Import these when ready to implement real Google Sign-In
// import * as WebBrowser from 'expo-web-browser';
// import * as Google from 'expo-auth-session/providers/google';

// Initialize WebBrowser for Google auth redirect
// WebBrowser.maybeCompleteAuthSession();

// Your Google client IDs
const IOS_CLIENT_ID = '258138577739-bomfeo1vd1egsktp6m2dqkj7qmb7oc16.apps.googleusercontent.com';
const WEB_CLIENT_ID = '258138577739-bomfeo1vd1egsktp6m2dqkj7qmb7oc16.apps.googleusercontent.com';

function AuthScreen({ onAuthenticate, isDarkMode, navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  // ------------------------------------------------------------------------
  // REAL GOOGLE AUTHENTICATION CODE (Uncomment when ready to deploy)
  // ------------------------------------------------------------------------
  /*
  // Set up Google Auth Request
  const [request, response, promptAsync] = Google.useAuthRequest({
    iosClientId: IOS_CLIENT_ID,
    webClientId: WEB_CLIENT_ID,
    // Make sure this matches the scheme in your app.json
    redirectUri: 'wuvo://'
  });

  // Monitor for authentication response
  React.useEffect(() => {
    if (response?.type === 'success') {
      // Successfully authenticated with Google
      const { authentication } = response;
      
      // Get user info using the access token
      getUserInfo(authentication.accessToken);
    }
  }, [response]);

  // Function to get user info from Google
  async function getUserInfo(token) {
    try {
      setIsLoading(true);
      const response = await fetch(
        "https://www.googleapis.com/userinfo/v2/me",
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      const userData = await response.json();
      
      // Pass user data to the app
      onAuthenticate({
        id: userData.id,
        email: userData.email,
        name: userData.name || userData.email.split('@')[0],
        provider: 'google'
      });
      
      setIsLoading(false);
    } catch (error) {
      console.error("Error getting user info:", error);
      Alert.alert("Authentication Error", "Failed to get Google user information.");
      setIsLoading(false);
    }
  }

  // Real Google Sign-In function
  const handleRealGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      await promptAsync();
      // The rest happens in the useEffect above
    } catch (error) {
      console.error("Google Sign-In Error:", error);
      Alert.alert("Sign-In Error", "There was a problem signing in with Google.");
      setIsLoading(false);
    }
  };
  */
  // ------------------------------------------------------------------------
  // END OF REAL GOOGLE AUTHENTICATION CODE
  // ------------------------------------------------------------------------

  // Real Firebase authentication
  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter both email and password");
      return;
    }
    
    setIsLoading(true);
    
    try {
      console.log('🔐 Starting Firebase sign-in...');
      const { user, profile } = await AuthService.signInWithEmail(email, password);
      
      console.log('✅ Firebase sign-in successful:', user.uid);
      
      // Check if user needs onboarding (new users or missing username)
      if (profile.isNewUser || !profile.username || !profile.onboardingComplete) {
        console.log('🚀 Navigating to username selection for onboarding');
        navigation.navigate('UsernameSelection', {
          user: {
            id: user.uid,
            email: user.email,
            name: user.displayName || profile.displayName || email.split('@')[0],
            provider: 'firebase',
            profile: profile
          }
        });
      } else {
        // Existing user with complete profile
        console.log('✅ Existing user, proceeding to main app');
        onAuthenticate({
          id: user.uid,
          email: user.email,
          name: user.displayName || profile.displayName || email.split('@')[0],
          provider: 'firebase',
          profile: profile
        });
      }
      
    } catch (error) {
      console.error('❌ Firebase sign-in failed:', error);
      Alert.alert("Sign In Failed", error.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Firebase sign up
  const handleSignUp = async () => {
    if (!email || !password || !displayName) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }
    
    if (password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters");
      return;
    }
    
    setIsLoading(true);
    
    try {
      console.log('📝 Starting Firebase sign-up...');
      const { user, profile } = await AuthService.signUpWithEmail(email, password, displayName);
      
      console.log('✅ Firebase sign-up successful:', user.uid);
      
      // New users always need onboarding
      console.log('🚀 New user, navigating to username selection');
      navigation.navigate('UsernameSelection', {
        user: {
          id: user.uid,
          email: user.email,
          name: user.displayName || profile.displayName,
          provider: 'firebase',
          profile: { ...profile, isNewUser: true }
        }
      });
      
    } catch (error) {
      console.error('❌ Firebase sign-up failed:', error);
      Alert.alert("Sign Up Failed", error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Google Sign-In (placeholder for future implementation)
  const handleGoogleSignIn = () => {
    Alert.alert(
      "Google Sign-In", 
      "Google authentication will be implemented in a future update. Please use email sign-in for now."
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: isDarkMode ? '#1C2526' : '#FFFFFF' }]}>
      <View style={[styles.container, { backgroundColor: isDarkMode ? '#1C2526' : '#FFFFFF' }]}>
        <View style={styles.logoContainer}>
          <Text style={[styles.appTitle, { color: isDarkMode ? '#F5F5F5' : '#333' }]}>
            Wuvo
          </Text>
          <Text style={[styles.appTagline, { color: isDarkMode ? '#D3D3D3' : '#666' }]}>
            Movies you'll love, ranked your way
          </Text>
        </View>
        
        <View style={styles.formContainer}>
          {isSignUp && (
            <TextInput
              style={[
                styles.input,
                { 
                  backgroundColor: isDarkMode ? '#4B0082' : '#F5F5F5',
                  color: isDarkMode ? '#F5F5F5' : '#333',
                  borderColor: isDarkMode ? '#8A2BE2' : '#E0E0E0' 
                }
              ]}
              placeholder="Display Name"
              placeholderTextColor={isDarkMode ? '#A9A9A9' : '#999'}
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="words"
            />
          )}
          
          <TextInput
            style={[
              styles.input,
              { 
                backgroundColor: isDarkMode ? '#4B0082' : '#F5F5F5',
                color: isDarkMode ? '#F5F5F5' : '#333',
                borderColor: isDarkMode ? '#8A2BE2' : '#E0E0E0' 
              }
            ]}
            placeholder="Email"
            placeholderTextColor={isDarkMode ? '#A9A9A9' : '#999'}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          
          <TextInput
            style={[
              styles.input,
              { 
                backgroundColor: isDarkMode ? '#4B0082' : '#F5F5F5',
                color: isDarkMode ? '#F5F5F5' : '#333',
                borderColor: isDarkMode ? '#8A2BE2' : '#E0E0E0' 
              }
            ]}
            placeholder="Password"
            placeholderTextColor={isDarkMode ? '#A9A9A9' : '#999'}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          
          <TouchableOpacity
            style={[
              styles.loginButton,
              { backgroundColor: isDarkMode ? '#FFD700' : '#4B0082' }
            ]}
            onPress={isSignUp ? handleSignUp : handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={isDarkMode ? '#1C2526' : '#FFFFFF'} />
            ) : (
              <Text style={[
                styles.loginButtonText,
                { color: isDarkMode ? '#1C2526' : '#FFFFFF' }
              ]}>
                {isSignUp ? 'Create Account' : 'Sign In'}
              </Text>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.switchModeButton}
            onPress={() => {
              setIsSignUp(!isSignUp);
              setDisplayName('');
              setEmail('');
              setPassword('');
            }}
            disabled={isLoading}
          >
            <Text style={[
              styles.switchModeText,
              { color: isDarkMode ? '#FFD700' : '#4B0082' }
            ]}>
              {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.googleButton,
              { borderColor: isDarkMode ? '#8A2BE2' : '#4B0082' }
            ]}
            onPress={handleGoogleSignIn}
            disabled={isLoading}
          >
            <Ionicons name="logo-google" size={20} color={isDarkMode ? '#FFD700' : '#4B0082'} style={styles.googleIcon} />
            <Text style={[
              styles.googleButtonText,
              { color: isDarkMode ? '#FFD700' : '#4B0082' }
            ]}>
              Continue with Google
            </Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: isDarkMode ? '#D3D3D3' : '#666' }]}>
            Rate movies and discover new favorites
          </Text>
          
          <Text style={[styles.footerSubtext, { color: isDarkMode ? '#A9A9A9' : '#999' }]}>
            Firebase authentication enabled
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  appTitle: {
    fontSize: 40,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  appTagline: {
    fontSize: 16,
    textAlign: 'center',
  },
  formContainer: {
    marginBottom: 30,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 16,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  loginButton: {
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  googleButton: {
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    flexDirection: 'row',
  },
  googleIcon: {
    marginRight: 10,
  },
  googleButtonText: {
    fontSize: 16,
  },
  footer: {
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },
  footerSubtext: {
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  switchModeButton: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  switchModeText: {
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});

export default AuthScreen;