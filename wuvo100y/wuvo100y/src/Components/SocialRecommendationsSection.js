import React from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MovieCard from './MovieCard';

/**
 * SocialRecommendationsSection - Friend-based movie recommendations
 * 
 * CODE_BIBLE Commandment #3: Use existing MovieCard component for consistency
 */
function SocialRecommendationsSection({
  socialRecommendations = [],
  isLoading = false,
  onMoviePress,
  onNotInterested,
  isDarkMode,
  homeStyles,
  mediaType,
  theme,
  colors,
  getRatingBorderColor = () => 'transparent'
}) {
  // Filter out any invalid recommendations
  const validRecommendations = socialRecommendations.filter(item => 
    item && item.id && (item.poster_path || item.poster)
  );

  if (!validRecommendations || validRecommendations.length === 0) {
    return null; // Don't render section if no recommendations
  }

  return (
    <View style={homeStyles.section}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 1, marginTop: -5 }}>
        <Ionicons 
          name="people" 
          size={16} 
          color={colors.success || '#4CAF50'} 
          style={{ marginRight: 8, marginBottom: 2 }}
        />
        <Text style={homeStyles.sectionTitle}>
          Friends Recommend
        </Text>
        <Text style={{
          fontSize: 12,
          color: colors.accent,
          marginLeft: 'auto',
          fontWeight: '600'
        }}>
          {validRecommendations.length} suggestion{validRecommendations.length !== 1 ? 's' : ''}
        </Text>
      </View>
      
      <Text style={homeStyles.swipeInstructions}>
        Based on what your friends are watching
      </Text>
      
      {isLoading ? (
        <View style={{ height: 200, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={[homeStyles.swipeInstructions, { marginTop: 8 }]}>
            Loading friend recommendations...
          </Text>
        </View>
      ) : (
        <FlatList
          data={validRecommendations}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={homeStyles.carouselContent}
          keyExtractor={(item) => `social-${item.id}`}
          removeClippedSubviews={false}
          windowSize={10}
          initialNumToRender={5}
          maxToRenderPerBatch={3}
          renderItem={({ item }) => {
            // Normalize the item data to match MovieCard expectations
            const normalizedItem = {
              ...item,
              poster_path: item.poster_path || item.poster,
              title: item.title || item.name,
              vote_average: item.vote_average || item.score,
              // Add friend-specific data
              friendsRating: item.friendsRating || item.averageFriendRating || 
                             (item.socialContext ? item.socialContext.averageFriendRating : null),
              recommendedBy: item.recommendedBy || [],
              // Add a visual indicator that this is a friend recommendation
              isFriendRecommendation: true
            };
            
            return (
              <MovieCard
                item={normalizedItem}
                handleMovieSelect={onMoviePress}
                handleNotInterested={onNotInterested}
                mediaType={mediaType}
                isDarkMode={isDarkMode}
                currentSession={null}
                getRatingBorderColor={getRatingBorderColor}
                isFriendRecommendation={true}
              />
            );
          }}
        />
      )}
    </View>
  );
}

export default SocialRecommendationsSection;