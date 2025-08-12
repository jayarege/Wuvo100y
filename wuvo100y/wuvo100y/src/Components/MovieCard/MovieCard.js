import React from 'react';
import { View, Text, Image, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getHomeStyles } from '../../Styles/homeStyles';
import theme from '../../utils/Theme';

const { width } = Dimensions.get('window');
// Original horizontal scroll sizing
const MOVIE_CARD_WIDTH_HORIZONTAL = (width - 48) / 2.2;
// New 3x3 grid sizing for testing
const MOVIE_CARD_WIDTH_3x3 = (width - 60) / 3;
// Use 3x3 sizing for now to preview
const MOVIE_CARD_WIDTH = MOVIE_CARD_WIDTH_3x3;

/**
 * MovieCard - Enhanced to support friend recommendations
 * CODE_BIBLE Commandment #3: Write obvious code - standardized card component
 */
const MovieCard = ({ 
  item, 
  handleMovieSelect, 
  handleNotInterested,
  mediaType = 'movie',
  isDarkMode = false,
  getRatingBorderColor = () => 'transparent',
  rankingNumber = null, // Prop for showing ranking numbers (1-10) in Profile screen
  context = 'general', // New prop to control X button visibility
  customWidth = null // Custom width override for Profile 3x3 grid
}) => {
  const colors = theme[mediaType][isDarkMode ? 'dark' : 'light'];
  const homeStyles = getHomeStyles(mediaType, isDarkMode ? 'dark' : 'light', theme);

  // No longer needed since badges are removed for Home screen

  // FORCE THE WIDTH - NO MATTER WHAT (or use custom width for Profile 3x3 grid)
  const cardWidth = customWidth || MOVIE_CARD_WIDTH;
  
  return (
    <View style={{
      width: cardWidth,
      maxWidth: cardWidth,
      minWidth: cardWidth,
      height: cardWidth * 1.9,
      marginRight: customWidth ? 0 : 12, // No margin for 3x3 grid
      borderColor: getRatingBorderColor(item),
      borderWidth: getRatingBorderColor(item) !== 'transparent' ? 1 : 0,
      flex: 0,
      flexShrink: 0,
      flexGrow: 0,
    }}>
      <TouchableOpacity
        style={{ width: '100%', height: '100%' }}
        activeOpacity={0.7}
        onPress={() => handleMovieSelect(item)}
      >
        <View style={[homeStyles.enhancedCard, { 
          width: '100%', 
          height: '100%',
          overflow: 'hidden'
        }]}>
          {/* Ranking number - Only shown for Profile screen with rankingNumber prop */}
          {rankingNumber && (
            <Text style={[
              styles.rankingNumberLarge,
              { 
                color: colors.primary,
                top: 8,
                left: 8,
                position: 'absolute',
                zIndex: 1
              }
            ]}>
              {rankingNumber}
            </Text>
          )}
          
          {/* NOT INTERESTED X BUTTON - TOP RIGHT - Hidden for Profile screen top movies/shows */}
          {!(context === 'toprated' || context === 'toppicks-grid') && (
            <TouchableOpacity
              style={{
                position: 'absolute',
                top: 8,
                right: 8,
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                borderRadius: 15,
                width: 30,
                height: 30,
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10
              }}
              onPress={(event) => handleNotInterested(item, event)}
              activeOpacity={0.8}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={18} color="white" />
            </TouchableOpacity>
          )}
          
          {/* Poster with rounded bottom corners */}
          <Image
            source={{
              uri: `https://image.tmdb.org/t/p/w500${item.poster_path || item.poster}`
            }}
            style={[styles.moviePoster, {
              borderRadius: 12, // Round all corners to match MovieCard
              borderBottomWidth: 0.5, // Add border at bottom of poster
              borderBottomColor: colors.primaryGradient[1], // Match MovieCard border color
              height: '70%' // Make poster shorter so text doesn't overlap
            }]}
            resizeMode="cover"
          />
          
          <View style={[homeStyles.movieInfoBox, { 
            position: 'absolute',
            bottom: -5, // Move text up closer to the poster
            left: 0,
            right: 0,
            width: '100%',
            minHeight: 80,
            paddingHorizontal: 8,
            paddingVertical: 8,
            backgroundColor: homeStyles.movieInfoBox?.backgroundColor || 'rgba(0,0,0,0.8)',
            borderBottomLeftRadius: 12, // Match MovieCard corner radius
            borderBottomRightRadius: 12 // Match MovieCard corner radius
          }]}>
            <Text
              style={[homeStyles.genreName, { 
                fontSize: 14, 
                lineHeight: 18, 
                marginBottom: 2,
                width: '100%'
              }]}
              numberOfLines={1}
              ellipsizeMode="tail"
              allowFontScaling={false}
            >
              {item.title || item.name || ''}
            </Text>
            <View style={[homeStyles.ratingRow, { width: '100%' }]}>
              <View style={[homeStyles.ratingLine, { flex: 1 }]}>
                <Ionicons name="star" size={12} color={colors.accent} />
                <Text style={[homeStyles.tmdbText, { fontSize: 11 }]} numberOfLines={1}>
                  TMDb {item.vote_average ? item.vote_average.toFixed(1) : '?'}
                </Text>
              </View>
              <View style={[homeStyles.ratingLine, { flex: 1 }]}>
                <Ionicons name="people" size={12} color={colors.success || '#4CAF50'} />
                <Text style={[homeStyles.friendsText, { fontSize: 11 }]} numberOfLines={1}>
                  {item.averageFriendRating ? 
                    `${item.averageFriendRating.toFixed(1)}` :
                    item.friendsRating ? `${item.friendsRating.toFixed(1)}` : 
                    'N/A'
                  }
                </Text>
              </View>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
};

// Local styles matching Home screen exactly (colors from theme)
const styles = {
  moviePoster: {
    width: '100%',
    height: MOVIE_CARD_WIDTH * 1.5,
    borderRadius: 8,
  },
  rankingNumberLarge: {
    fontSize: 40,
    fontWeight: '900',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
};

export default MovieCard;
export { MOVIE_CARD_WIDTH };