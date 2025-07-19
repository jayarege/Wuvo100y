// =============================================================================
// USERNAME SELECTION SCREEN - PHASE 2: USER IDENTITY SYSTEM
// =============================================================================
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Animated,
  ActivityIndicator,
  ScrollView
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AuthService from '../services/AuthService';

const UsernameSelectionScreen = ({ navigation, route }) => {
  // User data from registration
  const { user, profile } = route.params || {};
  
  // Username state
  const [username, setUsername] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState(null);
  const [validationError, setValidationError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Animation values
  const slideUpAnimation = useRef(new Animated.Value(100)).current;
  const fadeInAnimation = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    // Animate screen entrance
    Animated.parallel([
      Animated.timing(slideUpAnimation, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(fadeInAnimation, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  // =============================================================================
  // USERNAME VALIDATION
  // =============================================================================
  
  const validateUsername = useCallback((input) => {
    // Reset states
    setValidationError('');
    setIsAvailable(null);
    
    if (!input) {
      return false;
    }
    
    // Length validation
    if (input.length < 3) {
      setValidationError('Username must be at least 3 characters');
      return false;
    }
    
    if (input.length > 20) {
      setValidationError('Username must be 20 characters or less');
      return false;
    }
    
    // Character validation
    const validPattern = /^[a-zA-Z0-9_]+$/;
    if (!validPattern.test(input)) {
      setValidationError('Only letters, numbers, and underscore allowed');
      return false;
    }
    
    // Cannot start with underscore
    if (input.startsWith('_')) {
      setValidationError('Username cannot start with underscore');
      return false;
    }
    
    // Cannot end with underscore
    if (input.endsWith('_')) {
      setValidationError('Username cannot end with underscore');
      return false;
    }
    
    // Cannot have consecutive underscores
    if (input.includes('__')) {
      setValidationError('Username cannot have consecutive underscores');
      return false;
    }
    
    return true;
  }, []);

  // =============================================================================
  // REAL-TIME AVAILABILITY CHECKING
  // =============================================================================
  
  const checkUsernameAvailability = useCallback(async (input) => {
    if (!validateUsername(input)) {
      return;
    }
    
    setIsChecking(true);
    
    try {
      console.log('🔍 Checking username availability:', input);
      const available = await AuthService.checkUsernameAvailability(input);
      
      setIsAvailable(available);
      
      if (!available) {
        setValidationError('Username is already taken');
      }
      
      console.log('✅ Username availability result:', { username: input, available });
      
    } catch (error) {
      console.error('❌ Error checking username availability:', error);
      setValidationError('Unable to check availability. Please try again.');
      setIsAvailable(null);
    } finally {
      setIsChecking(false);
    }
  }, [validateUsername]);

  // Debounced username input handler
  const handleUsernameChange = useCallback((input) => {
    const cleanInput = input.toLowerCase().trim();
    setUsername(cleanInput);
    
    // Reset states on input change
    setIsAvailable(null);
    setValidationError('');
    
    // Debounce availability check
    const timeoutId = setTimeout(() => {
      if (cleanInput.length >= 3) {
        checkUsernameAvailability(cleanInput);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [checkUsernameAvailability]);

  // =============================================================================
  // USERNAME SUBMISSION
  // =============================================================================
  
  const handleContinue = async () => {
    if (!username || !isAvailable || validationError) {
      Alert.alert('Invalid Username', 'Please enter a valid, available username');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      console.log('💾 Setting username:', username);
      
      await AuthService.setUsername(username);
      
      console.log('✅ Username set successfully, navigating to profile setup');
      
      // Navigate to profile setup
      navigation.replace('ProfileSetup', {
        user,
        profile: {
          ...profile,
          username
        }
      });
      
    } catch (error) {
      console.error('❌ Error setting username:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to set username. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // =============================================================================
  // RENDER HELPERS
  // =============================================================================
  
  const renderStatusIcon = () => {
    if (isChecking) {
      return <ActivityIndicator size="small" color="#4B0082" />;
    }
    
    if (validationError) {
      return <Ionicons name="close-circle" size={20} color="#FF4444" />;
    }
    
    if (isAvailable === true) {
      return <Ionicons name="checkmark-circle" size={20} color="#00AA00" />;
    }
    
    if (isAvailable === false) {
      return <Ionicons name="close-circle" size={20} color="#FF4444" />;
    }
    
    return null;
  };

  const getInputBorderColor = () => {
    if (validationError || isAvailable === false) {
      return '#FF4444';
    }
    
    if (isAvailable === true) {
      return '#00AA00';
    }
    
    return '#E0E0E0';
  };

  // =============================================================================
  // RENDER
  // =============================================================================
  
  return (
    <LinearGradient
      colors={['#4B0082', '#8A2BE2', '#9370DB']}
      style={{ flex: 1 }}
    >
      <StatusBar style="light" />
      
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View 
            style={{
              flex: 1,
              paddingHorizontal: 30,
              paddingTop: 80,
              opacity: fadeInAnimation,
              transform: [{ translateY: slideUpAnimation }]
            }}
          >
            
            {/* Header Section */}
            <View style={{ alignItems: 'center', marginBottom: 50 }}>
              <Ionicons name="person-add" size={80} color="#FFD700" />
              <Text style={{
                fontSize: 28,
                fontWeight: 'bold',
                color: '#FFFFFF',
                textAlign: 'center',
                marginTop: 20,
                marginBottom: 10
              }}>
                Choose Your Username
              </Text>
              <Text style={{
                fontSize: 16,
                color: '#E0E0E0',
                textAlign: 'center',
                lineHeight: 22
              }}>
                This will be your unique @username that others can use to find you
              </Text>
            </View>

            {/* Username Input Section */}
            <View style={{ marginBottom: 30 }}>
              <Text style={{
                fontSize: 16,
                fontWeight: '600',
                color: '#FFFFFF',
                marginBottom: 10
              }}>
                Username
              </Text>
              
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#FFFFFF',
                borderRadius: 15,
                paddingHorizontal: 20,
                height: 60,
                borderWidth: 2,
                borderColor: getInputBorderColor()
              }}>
                <Text style={{
                  fontSize: 18,
                  color: '#666666',
                  marginRight: 5
                }}>
                  @
                </Text>
                
                <TextInput
                  value={username}
                  onChangeText={handleUsernameChange}
                  placeholder="your_username"
                  placeholderTextColor="#AAAAAA"
                  style={{
                    flex: 1,
                    fontSize: 18,
                    color: '#333333'
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="username"
                  maxLength={20}
                />
                
                <View style={{ marginLeft: 10 }}>
                  {renderStatusIcon()}
                </View>
              </View>
              
              {/* Validation Message */}
              {(validationError || isAvailable === false) && (
                <Text style={{
                  color: '#FF4444',
                  fontSize: 14,
                  marginTop: 8,
                  marginLeft: 5
                }}>
                  {validationError || 'Username is already taken'}
                </Text>
              )}
              
              {isAvailable === true && (
                <Text style={{
                  color: '#00AA00',
                  fontSize: 14,
                  marginTop: 8,
                  marginLeft: 5
                }}>
                  ✓ Username is available!
                </Text>
              )}
            </View>

            {/* Requirements Section */}
            <View style={{
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              borderRadius: 15,
              padding: 20,
              marginBottom: 40
            }}>
              <Text style={{
                fontSize: 16,
                fontWeight: '600',
                color: '#FFFFFF',
                marginBottom: 15
              }}>
                Username Requirements:
              </Text>
              
              <Text style={{ color: '#E0E0E0', fontSize: 14, marginBottom: 8 }}>
                • 3-20 characters long
              </Text>
              <Text style={{ color: '#E0E0E0', fontSize: 14, marginBottom: 8 }}>
                • Letters, numbers, and underscores only
              </Text>
              <Text style={{ color: '#E0E0E0', fontSize: 14, marginBottom: 8 }}>
                • Cannot start or end with underscore
              </Text>
              <Text style={{ color: '#E0E0E0', fontSize: 14 }}>
                • No consecutive underscores
              </Text>
            </View>

            {/* Continue Button */}
            <TouchableOpacity
              onPress={handleContinue}
              disabled={!username || !isAvailable || !!validationError || isSubmitting}
              style={{
                backgroundColor: (!username || !isAvailable || !!validationError || isSubmitting) 
                  ? 'rgba(255, 255, 255, 0.3)' 
                  : '#FFD700',
                borderRadius: 15,
                height: 60,
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 20
              }}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#4B0082" />
              ) : (
                <Text style={{
                  fontSize: 18,
                  fontWeight: 'bold',
                  color: (!username || !isAvailable || !!validationError) ? '#AAAAAA' : '#4B0082'
                }}>
                  Continue to Profile Setup
                </Text>
              )}
            </TouchableOpacity>

            {/* Skip Option */}
            <TouchableOpacity
              onPress={() => {
                Alert.alert(
                  'Skip Username',
                  'You can set your username later in your profile settings.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { 
                      text: 'Skip', 
                      onPress: () => navigation.replace('ProfileSetup', { user, profile })
                    }
                  ]
                );
              }}
              style={{
                alignItems: 'center',
                paddingVertical: 15
              }}
            >
              <Text style={{
                fontSize: 16,
                color: '#E0E0E0',
                textDecorationLine: 'underline'
              }}>
                Skip for now
              </Text>
            </TouchableOpacity>

          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};

export default UsernameSelectionScreen;