import React from 'react';
import { 
  View, 
  Text, 
  Image, 
  TouchableOpacity, 
  Modal, 
  ActivityIndicator,
  Dimensions 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getModalStyles } from '../../Styles/modalStyles';
import { StreamingProviders } from '../StreamingProviders';
import theme from '../../utils/Theme';

const { width } = Dimensions.get('window');

/**
 * MovieDetailModal - EXACT copy of Home screen modal (lines 3318-3561)
 * CODE_BIBLE Commandment #3: Write obvious code - this is a direct extraction
 */
const MovieDetailModal = ({
  visible,
  selectedMovie,
  movieCredits,
  isLoadingMovieDetails,
  mediaType = 'movie',
  isDarkMode = false,
  showSentimentButtons,
  closeDetailModal,
  handleNotInterested,
  handleRateButton,
  handleWatchlistToggle,
  colors,
  standardButtonStyles,
  memoizedRatingCategories,
  handleEmotionSelected,
  cancelSentimentSelection,
  context = 'general' // New prop to control button visibility
}) => {
  const modalStyles = getModalStyles(mediaType, isDarkMode ? 'dark' : 'light', theme);

  // Debug: Enhanced logging to understand X button behavior
  console.log('🔍 MovieDetailModal context:', context, 'Type:', typeof context);
  console.log('🔍 X button should be hidden:', (context === 'toprated' || context === 'toppicks-grid' || context === 'watchlist' || context === 'watchlist-grid'));
  console.log('🔍 Context checks:', {
    isToprated: context === 'toprated',
    isToppicksGrid: context === 'toppicks-grid', 
    isWatchlist: context === 'watchlist',
    isWatchlistGrid: context === 'watchlist-grid'
  });

  // EXACT copy from Home screen lines 3318-3561
  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={closeDetailModal}
    >
      <View style={modalStyles.detailModalOverlay}>
        <LinearGradient
          colors={theme[mediaType][isDarkMode ? 'dark' : 'light'].primaryGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={modalStyles.detailModalContent}
        >
          {/* X button at top-right - Hidden for all Profile screen contexts */}
          {!(context === 'toprated' || context === 'toppicks-grid' || context === 'watchlist' || context === 'watchlist-grid') && (
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
              onPress={(event) => handleNotInterested(selectedMovie, event)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              activeOpacity={0.8}
            >
              <Ionicons name="close" size={18} color="white" />
            </TouchableOpacity>
          )}
          
          <Image 
            source={{ uri: `https://image.tmdb.org/t/p/w500${selectedMovie?.poster_path}` }} 
            style={modalStyles.detailPoster}
            resizeMode="cover" 
          />
          
          <Text style={modalStyles.detailTitle}>
            {selectedMovie?.title}
          </Text>
          
          <Text style={modalStyles.detailYear}>
            ({selectedMovie?.release_date ? new Date(selectedMovie.release_date).getFullYear() : 'Unknown'})
          </Text>
          
          <Text style={modalStyles.detailScore}>
            TMDb: {selectedMovie?.vote_average?.toFixed(1) || 'N/A'}
          </Text>
          
          {/* **LOADING INDICATOR FOR MOVIE DETAILS** */}
          {isLoadingMovieDetails ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 8 }}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={[modalStyles.detailActors, { marginLeft: 8 }]}>
                Loading movie details...
              </Text>
            </View>
          ) : (
            movieCredits && movieCredits.length > 0 && (
              <Text style={modalStyles.detailActors}>
                Actors: {movieCredits.map(actor => actor.name).join(', ')}
              </Text>
            )
          )}
          
          <Text 
            style={modalStyles.detailPlot}
            numberOfLines={4}
            ellipsizeMode="tail"
          >
            {selectedMovie?.overview || 'No description available.'}
          </Text>
          
          <StreamingProviders
            movie={selectedMovie}
            visible={visible}
            style={{ marginVertical: 12 }}
          />
          
          <View style={modalStyles.buttonRow}>
            {/* **ACTION BUTTONS** */}
            <View 
              style={{ 
                opacity: showSentimentButtons ? 0 : 1,
                position: showSentimentButtons ? 'absolute' : 'relative',
                width: '100%',
                flexDirection: 'row'
              }}
              pointerEvents="auto"
            >
              {/* Conditional button rendering based on context */}
              {(context === 'toprated' || context === 'toppicks-grid') ? (
                // Top movies/shows: Only show Rerate button
                <TouchableOpacity 
                  style={[
                    standardButtonStyles.baseButton,
                    standardButtonStyles.tertiaryButton
                  ]}
                  onPress={handleRateButton}
                  activeOpacity={0.7}
                >
                  <Text 
                    style={[
                      standardButtonStyles.baseText,
                      standardButtonStyles.tertiaryText,
                      { fontSize: Math.min(16, width * 0.035) }
                    ]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    adjustsFontSizeToFit={true}
                  >
                    Rerate
                  </Text>
                </TouchableOpacity>
              ) : (context === 'watchlist' || context === 'watchlist-grid') ? (
                // Watchlist: Show Rate and Remove buttons
                <>
                  <TouchableOpacity 
                    style={[
                      standardButtonStyles.baseButton,
                      standardButtonStyles.tertiaryButton
                    ]}
                    onPress={handleRateButton}
                    activeOpacity={0.7}
                  >
                    <Text 
                      style={[
                        standardButtonStyles.baseText,
                        standardButtonStyles.tertiaryText,
                        { fontSize: Math.min(16, width * 0.035) }
                      ]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                      adjustsFontSizeToFit={true}
                    >
                      Rate
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[
                      standardButtonStyles.baseButton,
                      standardButtonStyles.tertiaryButton
                    ]}
                    onPress={handleWatchlistToggle}
                    activeOpacity={0.7}
                  >
                    <Text 
                      style={[
                        standardButtonStyles.baseText,
                        standardButtonStyles.tertiaryText,
                        { fontSize: Math.min(16, width * 0.035) }
                      ]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                      adjustsFontSizeToFit={true}
                    >
                      Remove
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                // Default: Show all original buttons
                <>
                  <TouchableOpacity 
                    style={[
                      standardButtonStyles.baseButton,
                      standardButtonStyles.tertiaryButton
                    ]}
                    onPress={handleRateButton}
                    activeOpacity={0.7}
                  >
                    <Text 
                      style={[
                        standardButtonStyles.baseText,
                        standardButtonStyles.tertiaryText,
                        { fontSize: Math.min(16, width * 0.035) }
                      ]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                      adjustsFontSizeToFit={true}
                    >
                      Rate
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[
                      standardButtonStyles.baseButton,
                      standardButtonStyles.tertiaryButton
                    ]}
                    onPress={handleWatchlistToggle}
                    activeOpacity={0.7}
                  >
                    <Text 
                      style={[
                        standardButtonStyles.baseText,
                        standardButtonStyles.tertiaryText,
                        { fontSize: Math.min(16, width * 0.035) }
                      ]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                      adjustsFontSizeToFit={true}
                    >
                      Watchlist
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[
                      standardButtonStyles.baseButton,
                      standardButtonStyles.tertiaryButton
                    ]}
                    onPress={(event) => handleNotInterested(selectedMovie, event)}
                    activeOpacity={0.7}
                  >
                    <Text 
                      style={[
                        standardButtonStyles.baseText,
                        standardButtonStyles.tertiaryText,
                        { fontSize: Math.min(14, width * 0.032) }
                      ]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                      adjustsFontSizeToFit={true}
                    >
                      Not Interested
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>

            {/* **SENTIMENT SELECTION BUTTONS** */}
            {showSentimentButtons && memoizedRatingCategories && (
              <View style={{
                position: 'absolute',
                width: '100%',
                flexDirection: 'row',
                flexWrap: 'wrap',
                justifyContent: 'space-between'
              }}>
                {Object.entries(memoizedRatingCategories).map(([categoryKey, category]) => (
                  <TouchableOpacity
                    key={categoryKey}
                    style={[
                      styles.sentimentButton,
                      {
                        backgroundColor: 'transparent',
                        borderColor: category.borderColor || category.color,
                        borderWidth: 2,
                        flex: 1,
                        marginHorizontal: 2,
                        minHeight: 60
                      }
                    ]}
                    onPress={() => handleEmotionSelected(categoryKey)}
                    activeOpacity={0.8}
                  >
                    <Text style={{ fontSize: 20, marginBottom: 4 }}>
                      {category.emoji}
                    </Text>
                    <Text 
                      style={{
                        fontSize: Math.min(14, width * 0.032),
                        textAlign: 'center',
                        fontWeight: '600',
                        color: category.color
                      }}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                      adjustsFontSizeToFit={true}
                    >
                      {category.label}
                    </Text>
                  </TouchableOpacity>
                ))}
                
                {/* Back Button */}
                <TouchableOpacity
                  style={[
                    styles.sentimentBackButton,
                    {
                      borderColor: colors.border?.color || colors.subText,
                      borderWidth: 1,
                      width: '100%',
                      marginTop: 8,
                      paddingVertical: 8,
                      alignItems: 'center',
                      borderRadius: 8
                    }
                  ]}
                  onPress={cancelSentimentSelection}
                  activeOpacity={0.8}
                >
                  <Text style={{
                    color: colors.subText,
                    fontSize: 14
                  }}>
                    ← Back to Options
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Cancel Button */}
          <TouchableOpacity
            onPress={closeDetailModal}
            style={modalStyles.cancelButtonContainer}
          >
            <Text style={modalStyles.cancelText}>cancel</Text>
          </TouchableOpacity>
        </LinearGradient>
      </View>
    </Modal>
  );
};

// Local styles matching Home screen exactly
const styles = {
  sentimentButton: {
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  sentimentBackButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
};

export default MovieDetailModal;