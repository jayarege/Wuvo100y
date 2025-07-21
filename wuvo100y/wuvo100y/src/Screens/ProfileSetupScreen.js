import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Switch
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AuthService from '../services/AuthService';

function ProfileSetupScreen({ 
  user, 
  username,
  onProfileComplete, 
  isDarkMode,
  navigation
}) {
  const [bio, setBio] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [searchable, setSearchable] = useState(true);
  const [showRatings, setShowRatings] = useState(true);
  const [showWatchlist, setShowWatchlist] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const colors = {
    background: isDarkMode ? '#1C2526' : '#FFFFFF',
    text: isDarkMode ? '#F5F5F5' : '#333',
    subtext: isDarkMode ? '#D3D3D3' : '#666',
    accent: isDarkMode ? '#FFD700' : '#4B0082',
    input: isDarkMode ? '#4B0082' : '#F5F5F5',
    inputText: isDarkMode ? '#F5F5F5' : '#333',
    border: isDarkMode ? '#8A2BE2' : '#E0E0E0',
    card: isDarkMode ? 'rgba(255, 215, 0, 0.1)' : 'rgba(75, 0, 130, 0.05)',
    placeholder: isDarkMode ? '#A9A9A9' : '#999'
  };

  const handleCompleteSetup = async () => {
    setIsSubmitting(true);
    
    try {
      console.log('🏗️ Completing profile setup...');
      
      // Update user profile in Firebase
      const profileData = {
        bio: bio.trim(),
        isPublic,
        searchable,
        preferences: {
          showRatings,
          showWatchlist,
          darkMode: isDarkMode,
          notifications: {
            follows: true,
            ratings: true,
            recommendations: true
          }
        },
        onboardingComplete: true,
        setupDate: new Date().toISOString()
      };

      // If username was set, confirm it
      if (username) {
        await AuthService.confirmUsername(username, user.id);
        profileData.username = username;
      }

      await AuthService.updateProfile(profileData);
      
      console.log('✅ Profile setup completed');
      
      // Call completion callback or navigate
      if (onProfileComplete) {
        onProfileComplete({
          ...user,
          profile: {
            ...user.profile,
            ...profileData
          }
        });
      } else if (navigation) {
        // Navigate to main app
        navigation.replace('Main', {
          user: {
            ...user,
            profile: {
              ...user.profile,
              ...profileData
            }
          }
        });
      }
      
    } catch (error) {
      console.error('❌ Profile setup failed:', error);
      Alert.alert('Setup Failed', error.message || 'Failed to complete profile setup. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkipSetup = () => {
    Alert.alert(
      'Skip Profile Setup',
      'You can complete your profile setup later in settings. Continue to the app?',
      [
        { text: 'Go Back', style: 'cancel' },
        { 
          text: 'Skip Setup', 
          onPress: async () => {
            try {
              // Mark onboarding as complete with minimal setup
              await AuthService.updateProfile({
                onboardingComplete: true,
                isPublic: false, // Default to private
                searchable: false,
                preferences: {
                  showRatings: false,
                  showWatchlist: false,
                  darkMode: isDarkMode
                }
              });
              
              if (onProfileComplete) {
                onProfileComplete(user);
              } else if (navigation) {
                navigation.replace('Main', { user });
              }
            } catch (error) {
              console.error('Error skipping setup:', error);
              Alert.alert('Error', 'Failed to skip setup. Please try again.');
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView 
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Ionicons name="person-circle" size={80} color={colors.accent} />
            <Text style={[styles.title, { color: colors.text }]}>
              Complete Your Profile
            </Text>
            <Text style={[styles.subtitle, { color: colors.subtext }]}>
              Set up your profile preferences and privacy settings
            </Text>
          </View>

          <View style={styles.formContainer}>
            {/* Bio Section */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Bio (Optional)
              </Text>
              <Text style={[styles.sectionDesc, { color: colors.subtext }]}>
                Tell others about your movie preferences
              </Text>
              <TextInput
                style={[
                  styles.bioInput,
                  { 
                    backgroundColor: colors.input,
                    color: colors.inputText,
                    borderColor: colors.border
                  }
                ]}
                placeholder="Film enthusiast from NYC. Love sci-fi and thrillers!"
                placeholderTextColor={colors.placeholder}
                value={bio}
                onChangeText={setBio}
                multiline
                maxLength={150}
                textAlignVertical="top"
              />
              <Text style={[styles.characterCount, { color: colors.subtext }]}>
                {bio.length}/150 characters
              </Text>
            </View>

            {/* Privacy Settings */}
            <View style={[styles.section, styles.privacySection, { backgroundColor: colors.card }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Privacy Settings
              </Text>
              
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={[styles.settingTitle, { color: colors.text }]}>
                    Public Profile
                  </Text>
                  <Text style={[styles.settingDesc, { color: colors.subtext }]}>
                    Allow others to view your profile
                  </Text>
                </View>
                <Switch
                  value={isPublic}
                  onValueChange={setIsPublic}
                  trackColor={{ false: '#767577', true: colors.accent }}
                  thumbColor={isPublic ? '#FFFFFF' : '#f4f3f4'}
                />
              </View>

              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={[styles.settingTitle, { color: colors.text }]}>
                    Discoverable
                  </Text>
                  <Text style={[styles.settingDesc, { color: colors.subtext }]}>
                    Appear in user search results
                  </Text>
                </View>
                <Switch
                  value={searchable}
                  onValueChange={setSearchable}
                  trackColor={{ false: '#767577', true: colors.accent }}
                  thumbColor={searchable ? '#FFFFFF' : '#f4f3f4'}
                  disabled={!isPublic}
                />
              </View>

              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={[styles.settingTitle, { color: colors.text }]}>
                    Show Ratings
                  </Text>
                  <Text style={[styles.settingDesc, { color: colors.subtext }]}>
                    Display your movie ratings publicly
                  </Text>
                </View>
                <Switch
                  value={showRatings}
                  onValueChange={setShowRatings}
                  trackColor={{ false: '#767577', true: colors.accent }}
                  thumbColor={showRatings ? '#FFFFFF' : '#f4f3f4'}
                  disabled={!isPublic}
                />
              </View>

              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={[styles.settingTitle, { color: colors.text }]}>
                    Show Watchlist
                  </Text>
                  <Text style={[styles.settingDesc, { color: colors.subtext }]}>
                    Display your watchlist publicly
                  </Text>
                </View>
                <Switch
                  value={showWatchlist}
                  onValueChange={setShowWatchlist}
                  trackColor={{ false: '#767577', true: colors.accent }}
                  thumbColor={showWatchlist ? '#FFFFFF' : '#f4f3f4'}
                  disabled={!isPublic}
                />
              </View>
            </View>

            {/* Username Display */}
            {username && (
              <View style={[styles.section, styles.usernameSection, { backgroundColor: colors.card }]}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  Your Username
                </Text>
                <View style={styles.usernameDisplay}>
                  <Ionicons name="at" size={20} color={colors.accent} />
                  <Text style={[styles.usernameText, { color: colors.text }]}>
                    {username}
                  </Text>
                  <Ionicons name="checkmark-circle" size={20} color="#28A745" />
                </View>
                <Text style={[styles.usernameNote, { color: colors.subtext }]}>
                  Others can find you using this username
                </Text>
              </View>
            )}
          </View>

          {/* Action Buttons */}
          <View style={styles.actionContainer}>
            <TouchableOpacity
              style={[
                styles.completeButton,
                { 
                  backgroundColor: colors.accent,
                  opacity: isSubmitting ? 0.6 : 1
                }
              ]}
              onPress={handleCompleteSetup}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={isDarkMode ? '#1C2526' : '#FFFFFF'} />
              ) : (
                <Text style={[
                  styles.completeButtonText,
                  { color: isDarkMode ? '#1C2526' : '#FFFFFF' }
                ]}>
                  Complete Setup
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.skipButton}
              onPress={handleSkipSetup}
              disabled={isSubmitting}
            >
              <Text style={[
                styles.skipButtonText,
                { color: colors.subtext }
              ]}>
                Skip for now
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
    marginTop: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  formContainer: {
    marginBottom: 30,
  },
  section: {
    marginBottom: 24,
  },
  privacySection: {
    padding: 20,
    borderRadius: 12,
  },
  usernameSection: {
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  sectionDesc: {
    fontSize: 14,
    marginBottom: 12,
  },
  bioInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    height: 100,
    marginBottom: 8,
  },
  characterCount: {
    fontSize: 12,
    textAlign: 'right',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.2)',
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  settingDesc: {
    fontSize: 13,
  },
  usernameDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  usernameText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginHorizontal: 8,
  },
  usernameNote: {
    fontSize: 14,
    textAlign: 'center',
  },
  actionContainer: {
    marginTop: 20,
  },
  completeButton: {
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  completeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  skipButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  skipButtonText: {
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});

export default ProfileSetupScreen;