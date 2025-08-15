import React from 'react';
import { View, Text, Image, TouchableOpacity, Dimensions, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getHomeStyles } from '../../Styles/homeStyles';
import theme from '../../utils/Theme';

const { width } = Dimensions.get('window');

// Responsive sizing that works from iPhone 8 (375px) to iPhone 15 Pro Max (430px)
// Home screen horizontal scroll sizing - 35% smaller than before
const MOVIE_CARD_WIDTH_HOME = Math.min(
  (width - 48) / 2.8, // Made 35% smaller (was 1.8, now 2.8)
  130 // Max width cap reduced 35% (was 200, now 130)
);

// Profile screen 3x3 grid sizing - 35% smaller
const MOVIE_CARD_WIDTH_PROFILE = Math.max(
  (width - 60) / 4.6, // Made 35% smaller (was 3, now 4.6)
  60 // Minimum width reduced 35% (was 90, now 60)
);

// Comparison modal sizing - compact for side-by-side layout
const MOVIE_CARD_WIDTH_COMPARISON = 120;

// Constants for external use - CODE_BIBLE Commandment #3: Clear naming
export const MOVIE_CARD_WIDTH = MOVIE_CARD_WIDTH_HOME;

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
  context = 'general', // New prop to control X button visibility and sizing
  customWidth = null // Custom width override for Profile 3x3 grid
}) => {
  const colors = theme[mediaType][isDarkMode ? 'dark' : 'light'];
  const homeStyles = getHomeStyles(mediaType, isDarkMode ? 'dark' : 'light', theme);

  // CODE_BIBLE Commandment #3: Write obvious code - explicit card sizing
  const cardWidth = (() => {
    // Explicit override takes precedence
    if (customWidth) return customWidth;
    
    // Context-based sizing for clear screen differentiation
    switch (context) {
      case 'home':
      case 'general':
        return MOVIE_CARD_WIDTH_HOME; // Larger cards for horizontal scrolling
      case 'comparison':
        return MOVIE_CARD_WIDTH_COMPARISON; // Compact cards for modal comparison
      case 'profile':
      case 'grid':
      default:
        return MOVIE_CARD_WIDTH_PROFILE; // Compact cards for grid layout
    }
  })();
  
  return (
    <View style={{
      width: cardWidth,
      maxWidth: cardWidth,
      minWidth: cardWidth,
      height: cardWidth * 1.9,
      marginRight: customWidth ? 0 : 4, // Reduced margin for closer spacing like Profile screen
      borderColor: getRatingBorderColor(item),
      borderWidth: getRatingBorderColor(item) !== 'transparent' ? StyleSheet.hairlineWidth : 0,
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
          {/* {rankingNumber && (
            <Text style={[
              styles.rankingNumberLarge,
              { 
                color: colors.primary,
                position: 'absolute',
                top: 8,
                left: 8,
                zIndex: 1
              }
            ]}>
              {rankingNumber}
            </Text>
          )} */}
          
          {/* NOT INTERESTED X BUTTON - TOP RIGHT - Hidden for Profile screen top movies/shows and comparison modal */}
          {!(context === 'toprated' || context === 'toppicks-grid' || context === 'comparison') && (
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
              height: '70%', // Make poster shorter so text doesn't overlap
              borderRadius: 12, // Round all corners to match MovieCard
              overflow: 'hidden' // Ensure rounded corners are clean
            }]}
            resizeMode="cover"
          />
          
          <View style={[homeStyles.movieInfoBox, { 
            position: 'absolute',
            bottom: -20, // Move text down a little bit more to stop cutting off poster
            left: 0,
            right: 0,
            width: '100%',
            minHeight: 80,
            paddingHorizontal: 8,
            paddingVertical: 1, // Even tighter padding for minimal spacing
            backgroundColor: homeStyles.movieInfoBox?.backgroundColor || 'rgba(0,0,0,0.8)',
            borderBottomLeftRadius: 12, // Match MovieCard corner radius
            borderBottomRightRadius: 12 // Match MovieCard corner radius
          }]}>
            {/* Show title on Home screen OR scores on Profile screen OR simple display for comparison */}
            {context === 'comparison' ? (
              // Comparison modal: Show just title and year like current implementation
              <>
                <Text
                  style={[homeStyles.genreName, { 
                    fontSize: 12, 
                    lineHeight: 16, 
                    marginBottom: 2,
                    width: '100%',
                    textAlign: 'center'
                  }]}
                  numberOfLines={2}
                  ellipsizeMode="tail"
                  allowFontScaling={false}
                >
                  {item.title || item.name || ''}
                </Text>
                <Text
                  style={[homeStyles.genreName, { 
                    fontSize: 10, 
                    lineHeight: 14, 
                    width: '100%',
                    textAlign: 'center',
                    opacity: 0.7
                  }]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  allowFontScaling={false}
                >
                  {item.release_date ? new Date(item.release_date).getFullYear() : 
                   item.first_air_date ? new Date(item.first_air_date).getFullYear() : 'N/A'}
                </Text>
              </>
            ) : context !== 'toprated' && context !== 'toppicks-grid' ? (
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
            ) : (
              // Profile screen: Show user score and friend score
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%' }}>
                <Text style={{ 
                  fontSize: 14, 
                  fontWeight: 'bold',
                  color: colors.secondary, // Yellow from theme (#FFA000)
                }}>
                  {item.userRating ? item.userRating.toFixed(1) : 'N/A'}
                </Text>
                <Text style={{ 
                  fontSize: 14, 
                  fontWeight: 'bold',
                  color: colors.success, // Green from theme (#4CAF50)
                }}>
                  {item.averageFriendRating ? 
                    item.averageFriendRating.toFixed(1) :
                    item.friendsRating ? item.friendsRating.toFixed(1) : 
                    'N/A'
                  }
                </Text>
              </View>
            )}
            {/* Only show ratings on Home screen, hide on Profile screen and comparison modal */}
            {context !== 'toprated' && context !== 'toppicks-grid' && context !== 'comparison' && (
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
            )}
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
    textShadowColor: 'rgba(255, 160, 0, 0.4)', // More transparent yellow shadow
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 3,
  },
};

export default MovieCard;