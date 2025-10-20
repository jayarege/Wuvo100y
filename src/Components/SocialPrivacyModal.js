import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Switch,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import firebase from '../config/firebase';
import theme from '../utils/Theme';

/**
 * SocialPrivacyModal - User consent and privacy controls for social features
 * 
 * CODE_BIBLE Commandment #3: Clear privacy controls with obvious consequences
 * CODE_BIBLE Commandment #7: Document WHY each privacy setting matters
 * CODE_BIBLE Commandment #10: Treat user data as sacred - give full control
 */
function SocialPrivacyModal({
  visible,
  onClose,
  onConsent,
  currentUser,
  isDarkMode,
  isFirstTime = false
}) {
  const [privacySettings, setPrivacySettings] = useState({
    enableSocialRecommendations: false,
    enableFriendComments: false,
    showRatingsToFriends: false,
    showWatchlistToFriends: false,
    allowFriendActivityTracking: false,
    searchableProfile: true,
    publicProfile: true
  });

  const [isSaving, setIsSaving] = useState(false);
  const [hasLoadedSettings, setHasLoadedSettings] = useState(false);

  // Use centralized theme instead of hardcoded colors
  const themeColors = theme.movie[isDarkMode ? 'dark' : 'light'];
  const colors = {
    background: themeColors.background,
    modal: themeColors.card,
    text: themeColors.text,
    subtext: themeColors.subText,
    accent: themeColors.accent,
    card: isDarkMode ? 'rgba(255, 215, 0, 0.1)' : 'rgba(75, 0, 130, 0.05)',
    border: themeColors.border.color,
    success: themeColors.success,
    warning: '#FF9800',
    danger: '#F44336'
  };

  // Load existing privacy settings
  useEffect(() => {
    if (visible && currentUser?.id && !hasLoadedSettings) {
      loadUserPrivacySettings();
    }
  }, [visible, currentUser, hasLoadedSettings]);

  const loadUserPrivacySettings = async () => {
    try {
      const userDoc = await firebase.firestore()
        .collection('users')
        .doc(currentUser.id)
        .get();

      if (userDoc.exists) {
        const userData = userDoc.data();
        const currentSettings = userData.socialPrivacy || {};
        
        setPrivacySettings({
          enableSocialRecommendations: currentSettings.enableSocialRecommendations || false,
          enableFriendComments: currentSettings.enableFriendComments || false,
          showRatingsToFriends: userData.preferences?.showRatings || false,
          showWatchlistToFriends: userData.preferences?.showWatchlist || false,
          allowFriendActivityTracking: currentSettings.allowFriendActivityTracking || false,
          searchableProfile: userData.searchable !== false,
          publicProfile: userData.isPublic !== false
        });
      }
      
      setHasLoadedSettings(true);
    } catch (error) {
      console.error('❌ Error loading privacy settings:', error);
    }
  };

  const handleSettingChange = (setting, value) => {
    setPrivacySettings(prev => ({
      ...prev,
      [setting]: value
    }));
  };

  const handleSaveSettings = async () => {
    if (!currentUser?.id) return;

    setIsSaving(true);
    try {
      // Update user document with privacy settings
      await firebase.firestore()
        .collection('users')
        .doc(currentUser.id)
        .update({
          socialPrivacy: {
            enableSocialRecommendations: privacySettings.enableSocialRecommendations,
            enableFriendComments: privacySettings.enableFriendComments,
            allowFriendActivityTracking: privacySettings.allowFriendActivityTracking,
            consentDate: firebase.firestore.FieldValue.serverTimestamp(),
            consentVersion: '1.0'
          },
          preferences: {
            showRatings: privacySettings.showRatingsToFriends,
            showWatchlist: privacySettings.showWatchlistToFriends
          },
          searchable: privacySettings.searchableProfile,
          isPublic: privacySettings.publicProfile,
          socialConsentGiven: true
        });

      console.log('✅ Privacy settings saved successfully');
      
      // Call the consent callback with the settings
      if (onConsent) {
        onConsent(privacySettings);
      }
      
      onClose();

    } catch (error) {
      console.error('❌ Error saving privacy settings:', error);
      Alert.alert('Error', 'Failed to save privacy settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const privacyOptions = [
    {
      key: 'enableSocialRecommendations',
      title: 'Friend-Based Recommendations',
      description: 'Use your friends\' movie ratings to improve your recommendations',
      icon: 'people',
      category: 'recommendations',
      impact: 'Shares: Your movie preferences with recommendation algorithm'
    },
    {
      key: 'enableFriendComments',
      title: 'Friend Comments',
      description: 'Allow friends to comment on your movie activities',
      icon: 'chatbubbles',
      category: 'social',
      impact: 'Shares: Your movie activities with friends who follow you'
    },
    {
      key: 'showRatingsToFriends',
      title: 'Share Movie Ratings',
      description: 'Let friends see the ratings you give to movies',
      icon: 'star',
      category: 'sharing',
      impact: 'Shares: Your movie ratings and reviews with friends'
    },
    {
      key: 'showWatchlistToFriends',
      title: 'Share Watchlist',
      description: 'Let friends see movies you want to watch',
      icon: 'bookmark',
      category: 'sharing',
      impact: 'Shares: Your watchlist with friends'
    },
    {
      key: 'allowFriendActivityTracking',
      title: 'Friend Activity Analysis',
      description: 'Allow analysis of friend activities for better social recommendations',
      icon: 'analytics',
      category: 'recommendations',
      impact: 'Analyzes: Your friends\' public activities to find patterns'
    },
    {
      key: 'publicProfile',
      title: 'Public Profile',
      description: 'Make your profile visible to other users',
      icon: 'person',
      category: 'profile',
      impact: 'Shares: Your profile information with all app users'
    },
    {
      key: 'searchableProfile',
      title: 'Searchable Profile',
      description: 'Allow other users to find you in search',
      icon: 'search',
      category: 'profile',
      impact: 'Makes: Your profile discoverable through user search'
    }
  ];

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'recommendations': return 'sparkles';
      case 'social': return 'people';
      case 'sharing': return 'share';
      case 'profile': return 'person-circle';
      default: return 'settings';
    }
  };

  const getCategoryColor = (category) => {
    switch (category) {
      case 'recommendations': return colors.accent;
      case 'social': return colors.success;
      case 'sharing': return colors.warning;
      case 'profile': return '#2196F3';
      default: return colors.subtext;
    }
  };

  const renderPrivacyOption = (option) => (
    <View key={option.key} style={[styles.optionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.optionHeader}>
        <View style={styles.optionTitle}>
          <View style={[styles.categoryIcon, { backgroundColor: getCategoryColor(option.category) }]}>
            <Ionicons name={getCategoryIcon(option.category)} size={16} color="#FFFFFF" />
          </View>
          <View style={styles.titleText}>
            <Text style={[styles.optionTitleText, { color: colors.text }]}>
              {option.title}
            </Text>
            <Text style={[styles.optionDescription, { color: colors.subtext }]}>
              {option.description}
            </Text>
          </View>
        </View>
        
        <Switch
          value={privacySettings[option.key]}
          onValueChange={(value) => handleSettingChange(option.key, value)}
          trackColor={{ false: colors.border, true: getCategoryColor(option.category) }}
          thumbColor={privacySettings[option.key] ? '#FFFFFF' : colors.subtext}
        />
      </View>
      
      <View style={[styles.impactNotice, { backgroundColor: colors.background }]}>
        <Ionicons name="information-circle-outline" size={14} color={colors.subtext} />
        <Text style={[styles.impactText, { color: colors.subtext }]}>
          {option.impact}
        </Text>
      </View>
    </View>
  );

  const getEnabledFeaturesCount = () => {
    return Object.values(privacySettings).filter(Boolean).length;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: colors.modal }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          {!isFirstTime && (
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          )}
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {isFirstTime ? 'Social Features Privacy' : 'Privacy Settings'}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Content */}
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Introduction */}
          <View style={[styles.introSection, { backgroundColor: colors.card }]}>
            <View style={styles.introHeader}>
              <Ionicons name="shield-checkmark" size={24} color={colors.accent} />
              <Text style={[styles.introTitle, { color: colors.text }]}>
                Your Privacy, Your Choice
              </Text>
            </View>
            <Text style={[styles.introText, { color: colors.subtext }]}>
              {isFirstTime 
                ? 'Welcome to social features! Choose what you\'re comfortable sharing with friends. You can change these settings anytime.'
                : 'Control how your movie data is used for social features. All settings are optional and can be changed anytime.'
              }
            </Text>
            
            {getEnabledFeaturesCount() > 0 && (
              <View style={styles.summaryBadge}>
                <Text style={[styles.summaryText, { color: colors.accent }]}>
                  {getEnabledFeaturesCount()} of {privacyOptions.length} features enabled
                </Text>
              </View>
            )}
          </View>

          {/* Privacy Options */}
          <View style={styles.optionsSection}>
            {privacyOptions.map(renderPrivacyOption)}
          </View>

          {/* Footer Information */}
          <View style={[styles.footerSection, { backgroundColor: colors.card }]}>
            <Text style={[styles.footerTitle, { color: colors.text }]}>
              Data Protection
            </Text>
            <Text style={[styles.footerText, { color: colors.subtext }]}>
              • All data stays within the app - we never sell your information{'\n'}
              • You can disable any feature or delete your data anytime{'\n'}
              • Friend interactions are limited to mutual followers only{'\n'}
              • All social features are optional and can be turned off
            </Text>
          </View>
        </ScrollView>

        {/* Action Buttons */}
        <View style={[styles.actions, { borderTopColor: colors.border }]}>
          {isFirstTime && (
            <TouchableOpacity
              style={[styles.skipButton, { borderColor: colors.border }]}
              onPress={() => {
                // Save minimal settings (all disabled)
                onConsent({});
                onClose();
              }}
            >
              <Text style={[styles.skipButtonText, { color: colors.subtext }]}>
                Skip Social Features
              </Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: colors.accent }]}
            onPress={handleSaveSettings}
            disabled={isSaving}
          >
            <Text style={[styles.saveButtonText, { color: isDarkMode ? '#1C2526' : '#FFFFFF' }]}>
              {isSaving ? 'Saving...' : isFirstTime ? 'Save & Continue' : 'Save Settings'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 32,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  introSection: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  introHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  introTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 12,
  },
  introText: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  summaryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
  },
  summaryText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  optionsSection: {
    marginBottom: 24,
  },
  optionCard: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  optionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  categoryIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  titleText: {
    flex: 1,
  },
  optionTitleText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
    lineHeight: 18,
  },
  impactNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  impactText: {
    fontSize: 12,
    marginLeft: 6,
    fontStyle: 'italic',
  },
  footerSection: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  footerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  footerText: {
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    gap: 12,
  },
  skipButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  skipButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 2,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default SocialPrivacyModal;