import React from 'react';
import { View, Text, Image, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getHomeStyles } from '../../Styles/homeStyles';
import theme from '../../utils/Theme';

const { width } = Dimensions.get('window');
const MOVIE_CARD_WIDTH = (width - 48) / 2.2;

/**
 * MovieCard - EXACT copy of AI recommendations from Home screen (lines 2756-2840)
 * CODE_BIBLE Commandment #3: Write obvious code - this is a direct extraction
 */
const MovieCard = ({ 
  item, 
  handleMovieSelect, 
  handleNotInterested,
  mediaType = 'movie',
  isDarkMode = false,
  currentSession = null,
  getRatingBorderColor = () => 'transparent'
}) => {
  const colors = theme[mediaType][isDarkMode ? 'dark' : 'light'];
  const homeStyles = getHomeStyles(mediaType, isDarkMode ? 'dark' : 'light', theme);

  // FORCE THE WIDTH - NO MATTER WHAT
  return (
    <View style={{
      width: MOVIE_CARD_WIDTH,
      maxWidth: MOVIE_CARD_WIDTH,
      minWidth: MOVIE_CARD_WIDTH,
      height: MOVIE_CARD_WIDTH * 1.9,
      marginRight: 12,
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
          <View style={[
            styles.aiRecommendationBadge, 
            { 
              backgroundColor: (item.discoverySession || currentSession) ? '#FF6B6B' : '#4CAF50', 
              top: 12 
            }
          ]}>
            <Text style={[styles.rankingNumber, { color: '#000' }]}>
              {(() => {
                if (item.discoveryScore) return Math.round(item.discoveryScore);
                if (item.discoverySession || currentSession) return 'DS';
                return 'AI';
              })()}
            </Text>
          </View>
          
          {/* NOT INTERESTED X BUTTON - TOP RIGHT */}
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
          
          <Image
            source={{
              uri: `https://image.tmdb.org/t/p/w500${item.poster_path}`
            }}
            style={styles.moviePoster}
            resizeMode="cover"
          />
          
          <View style={[homeStyles.movieInfoBox, { 
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            width: '100%',
            minHeight: 80,
            paddingHorizontal: 8,
            paddingVertical: 8,
            backgroundColor: homeStyles.movieInfoBox?.backgroundColor || 'rgba(0,0,0,0.8)'
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
                  Friends {item.friendsRating ? item.friendsRating.toFixed(1) : 'N/A'}
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
  aiRecommendationBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    zIndex: 1,
    minWidth: 24,
    alignItems: 'center',
  },
  rankingNumber: {
    fontSize: 12,
    fontWeight: 'bold',
  },
};

export default MovieCard;
export { MOVIE_CARD_WIDTH };