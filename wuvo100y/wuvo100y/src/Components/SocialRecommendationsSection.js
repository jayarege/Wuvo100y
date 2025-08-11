import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SocialRecommendationCard from './SocialRecommendationCard';

/**
 * SocialRecommendationsSection - Friend-based movie recommendations
 * 
 * CODE_BIBLE Commandment #3: Clear visual separation from AI recommendations
 * - Distinct icon and title for social vs AI recommendations
 * - Horizontal scrolling for easy browsing
 * - Loading state with clear messaging
 */
function SocialRecommendationsSection({
  socialRecommendations = [],
  isLoading = false,
  onMoviePress,
  isDarkMode,
  homeStyles,
  mediaType,
  theme
}) {
  if (isLoading || socialRecommendations.length === 0) {
    return null; // Don't show section if no social data
  }

  const colors = {
    accent: isDarkMode ? '#FFD700' : '#4B0082',
    text: isDarkMode ? '#F5F5F5' : '#333',
    subtext: isDarkMode ? '#D3D3D3' : '#666'
  };

  return (
    <View style={homeStyles.section}>
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Ionicons 
            name="people" 
            size={16} 
            color={colors.accent} 
            style={styles.icon}
          />
          <Text style={[homeStyles.sectionTitle, styles.title]}>
            Friends Recommend
          </Text>
        </View>
        <Text style={[homeStyles.genreScore, styles.count]}>
          {socialRecommendations.length} suggestions
        </Text>
      </View>
      
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.loadingText, { color: colors.subtext }]}>
            Finding friend recommendations...
          </Text>
        </View>
      ) : (
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {socialRecommendations.map((movie, index) => (
            <SocialRecommendationCard
              key={`social-${movie.id}-${index}`}
              movie={movie}
              onPress={onMoviePress}
              isDarkMode={isDarkMode}
              showSocialContext={true}
              mediaType={mediaType}
              theme={theme}
              homeStyles={homeStyles}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginTop: -5,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 8,
    marginBottom: 2,
  },
  title: {
    // Inherits from homeStyles.sectionTitle
  },
  count: {
    fontSize: 12,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
  },
  scrollContent: {
    paddingHorizontal: 8,
    paddingBottom: 16,
    gap: 8,
  },
});

export default SocialRecommendationsSection;