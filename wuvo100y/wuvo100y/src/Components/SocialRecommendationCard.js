import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * SocialRecommendationCard - Movie recommendation with social context
 * 
 * CODE_BIBLE Commandment #3: Clear visual hierarchy showing social proof
 * - Movie poster and basic info prominent
 * - Social reason clearly displayed with friend context
 * - Obvious tap target for movie details
 */
function SocialRecommendationCard({
  movie,
  onPress,
  isDarkMode,
  showSocialContext = true
}) {
  const colors = {
    background: isDarkMode ? '#2A2F30' : '#FFFFFF',
    text: isDarkMode ? '#F5F5F5' : '#333',
    subtext: isDarkMode ? '#D3D3D3' : '#666',
    accent: isDarkMode ? '#FFD700' : '#4B0082',
    border: isDarkMode ? '#8A2BE2' : '#E0E0E0',
    socialBg: isDarkMode ? 'rgba(255, 215, 0, 0.1)' : 'rgba(75, 0, 130, 0.05)',
    socialText: isDarkMode ? '#FFD700' : '#4B0082'
  };

  const formatYear = (releaseDate) => {
    if (!releaseDate) return '';
    return new Date(releaseDate).getFullYear();
  };

  const formatRating = (rating) => {
    return rating ? rating.toFixed(1) : 'N/A';
  };

  const getSocialIcon = (strategy) => {
    switch (strategy) {
      case 'friends_loved':
        return 'heart';
      case 'trending_friends':
        return 'trending-up';
      case 'similar_to_friends':
        return 'shuffle';
      default:
        return 'people';
    }
  };

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: colors.background, borderColor: colors.border }]}
      onPress={() => onPress(movie)}
      activeOpacity={0.7}
    >
      {/* Movie Poster */}
      <View style={styles.posterContainer}>
        {movie.poster_path ? (
          <Image
            source={{ uri: `https://image.tmdb.org/t/p/w154${movie.poster_path}` }}
            style={styles.poster}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.posterPlaceholder, { backgroundColor: colors.border }]}>
            <Ionicons name="film" size={24} color={colors.subtext} />
          </View>
        )}
        
        {/* TMDB Rating Badge */}
        {movie.vote_average > 0 && (
          <View style={[styles.ratingBadge, { backgroundColor: colors.accent }]}>
            <Ionicons name="star" size={10} color="#FFFFFF" />
            <Text style={styles.ratingText}>
              {formatRating(movie.vote_average)}
            </Text>
          </View>
        )}
      </View>

      {/* Movie Info */}
      <View style={styles.movieInfo}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
          {movie.title}
        </Text>
        
        <View style={styles.movieMeta}>
          {movie.release_date && (
            <Text style={[styles.year, { color: colors.subtext }]}>
              {formatYear(movie.release_date)}
            </Text>
          )}
          
          {movie.genre_ids && movie.genre_ids.length > 0 && (
            <Text style={[styles.genres, { color: colors.subtext }]} numberOfLines={1}>
              • {movie.genres?.map(g => g.name).join(', ') || 'Multiple genres'}
            </Text>
          )}
        </View>

        {/* Social Context */}
        {showSocialContext && movie.socialContext && (
          <View style={[styles.socialContext, { backgroundColor: colors.socialBg }]}>
            <Ionicons
              name={getSocialIcon(movie.socialContext.strategy)}
              size={14}
              color={colors.socialText}
            />
            <Text style={[styles.socialReason, { color: colors.socialText }]} numberOfLines={2}>
              {movie.socialContext.reason}
            </Text>
          </View>
        )}

        {/* Movie Overview Preview */}
        {movie.overview && (
          <Text style={[styles.overview, { color: colors.subtext }]} numberOfLines={3}>
            {movie.overview}
          </Text>
        )}
      </View>

      {/* Action Indicator */}
      <View style={styles.actionIndicator}>
        <Ionicons name="chevron-forward" size={20} color={colors.subtext} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 12,
    marginVertical: 6,
    marginHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  posterContainer: {
    position: 'relative',
    marginRight: 12,
  },
  poster: {
    width: 80,
    height: 120,
    borderRadius: 8,
  },
  posterPlaceholder: {
    width: 80,
    height: 120,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 36,
    justifyContent: 'center',
  },
  ratingText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 2,
  },
  movieInfo: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
    lineHeight: 20,
  },
  movieMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  year: {
    fontSize: 14,
    fontWeight: '500',
  },
  genres: {
    fontSize: 12,
    marginLeft: 4,
    flex: 1,
  },
  socialContext: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 8,
  },
  socialReason: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
    flex: 1,
    lineHeight: 16,
  },
  overview: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  actionIndicator: {
    alignSelf: 'center',
    marginLeft: 8,
  },
});

export default SocialRecommendationCard;