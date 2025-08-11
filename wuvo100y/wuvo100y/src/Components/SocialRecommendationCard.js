import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import defaultTheme from '../utils/Theme';

const { width } = Dimensions.get('window');
const MOVIE_CARD_WIDTH = (width - 48) / 2.2;

/**
 * SocialRecommendationCard - Movie recommendation with social context
 * 
 * CODE_BIBLE Commandment #3: Clear visual hierarchy showing social proof
 * - Movie poster and basic info prominent
 * - Social reason clearly displayed with friend context
 * - Obvious tap target for movie details
 */
const SocialRecommendationCard = React.memo(({
  movie,
  onPress,
  isDarkMode,
  showSocialContext = true,
  mediaType = 'movie',
  theme,
  homeStyles
}) => {
  // Use centralized theme instead of hardcoded colors
  const currentTheme = theme || defaultTheme;
  const themeColors = currentTheme[mediaType][isDarkMode ? 'dark' : 'light'];
  
  const colors = {
    background: themeColors.card,
    text: themeColors.text,
    subtext: themeColors.subText,
    accent: themeColors.accent,
    border: themeColors.border.color,
    socialBg: isDarkMode ? 'rgba(255, 215, 0, 0.1)' : 'rgba(75, 0, 130, 0.05)',
    socialText: themeColors.accent
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
    <View style={[
      homeStyles?.movieCardBorder || styles.cardBorder,
      {
        borderColor: movie.userRating ? themeColors.primaryGradient[1] : 'transparent',
        borderWidth: movie.userRating ? 1 : 0
      }
    ]}>
      <TouchableOpacity
        style={[
          homeStyles?.enhancedCard || styles.container, 
          { 
            backgroundColor: colors.background,
            borderColor: themeColors.primaryGradient[1]
          }
        ]}
        onPress={() => onPress(movie)}
        activeOpacity={0.7}
      >
        {/* Movie Poster - Vertical Layout */}
        {movie.poster_path ? (
          <Image
            source={{ uri: `https://image.tmdb.org/t/p/w500${movie.poster_path}` }}
            style={styles.poster}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.posterPlaceholder, { backgroundColor: colors.border }]}>
            <Ionicons name="film" size={40} color={colors.subtext} />
          </View>
        )}

        {/* Movie Info Box - Below Poster */}
        <View style={homeStyles?.movieInfoBox || styles.movieInfoBox}>
          <Text
            style={homeStyles?.genreName || styles.title}
            numberOfLines={1}
            adjustsFontSizeToFit={true}
            minimumFontScale={0.7}
            ellipsizeMode="tail"
          >
            {movie.title}
          </Text>
          
          {/* Rating Row */}
          <View style={homeStyles?.ratingRow || styles.ratingRow}>
            <View style={homeStyles?.ratingLine || styles.ratingLine}>
              <Ionicons name="star" size={12} color={colors.accent} />
              <Text style={homeStyles?.tmdbText || styles.ratingText}>
                TMDb {movie.vote_average ? movie.vote_average.toFixed(1) : '?'}
              </Text>
            </View>
            
            {/* Social Context as Second Rating */}
            {showSocialContext && movie.socialContext && (
              <View style={homeStyles?.ratingLine || styles.ratingLine}>
                <Ionicons
                  name={getSocialIcon(movie.socialContext.strategy)}
                  size={12}
                  color={colors.socialText}
                />
                <Text style={homeStyles?.friendsText || styles.socialText} numberOfLines={1}>
                  {movie.socialContext.reason.split(' ').slice(0, 2).join(' ')}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
});

const styles = StyleSheet.create({
  cardBorder: {
    borderWidth: 0,
    borderRadius: 0,
    marginHorizontal: 0,
    marginVertical: 0,
    padding: 0,
    backgroundColor: 'transparent',
    width: MOVIE_CARD_WIDTH,
    marginRight: 12,
  },
  container: {
    borderWidth: 0.5,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  poster: {
    width: MOVIE_CARD_WIDTH,
    height: MOVIE_CARD_WIDTH * 1.5,
  },
  posterPlaceholder: {
    width: MOVIE_CARD_WIDTH,
    height: MOVIE_CARD_WIDTH * 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  movieInfoBox: {
    padding: 6,
    width: '100%',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
    textAlign: 'center',
  },
  ratingRow: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
  },
  ratingLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingText: {
    fontSize: 11,
    marginLeft: 4,
  },
  socialText: {
    fontSize: 11,
    marginLeft: 4,
    fontWeight: '600',
  },
});

export default SocialRecommendationCard;