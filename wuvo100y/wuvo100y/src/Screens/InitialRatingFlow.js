import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Image,
  StyleSheet,
  SafeAreaView,
  Alert,
  Animated,
  Dimensions,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { calculateDynamicRatingCategories } from '../Components/EnhancedRatingSystem';
import { getModalStyles } from '../Styles/modalStyles';
import { getCompareStyles } from '../Styles/compareStyles';
import { useMediaType } from '../Navigation/TabNavigator';
import theme from '../utils/Theme';
import { 
  selectPercentileOpponent, 
  selectProximityOpponent,
  calculateKFactor,
  calculateExpectedWinProbability,
  calculateNewRating
} from '../utils/OpponentSelection';

const { width, height } = Dimensions.get('window');

// **SHARED BUTTON STYLES** - Consistent styling with Home screen buttons
const getStandardizedButtonStyles = (colors) => ({
  // Base button style - consistent across all variants
  baseButton: {
    flex: 1,
    marginHorizontal: 2,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44, // Accessibility: minimum touch target
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  
  // Tertiary button variant - for sentiment actions (matching Home screen style)
  tertiaryButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  
  // Base text style - consistent typography with responsive sizing
  baseText: {
    fontSize: Math.min(16, width * 0.035), // Responsive font size based on screen width
    fontWeight: '600',
    textAlign: 'center',
    fontFamily: colors.font?.body || 'System',
    lineHeight: Math.min(20, width * 0.045), // Responsive line height
  },
  
  // Tertiary text style
  tertiaryText: {
    color: '#FFFFFF',
  },
});

// Initial emotion to rating mapping (converts sentiment to starting rating)
const getInitialRatingFromEmotion = (emotion) => {
  const emotionRatings = {
    LOVED: 8.5,
    LIKED: 7.0,
    AVERAGE: 5.5,
    DISLIKED: 3.0
  };
  
  return emotionRatings[emotion] || 6.0;
};

// Genre mapping helper function
const getGenreName = (genreIds) => {
  const genreMap = {
    28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
    99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History',
    27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance', 878: 'Sci-Fi',
    10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western'
  };
  
  if (!genreIds || !Array.isArray(genreIds) || genreIds.length === 0) {
    return 'Unknown';
  }
  
  return genreIds.map(id => genreMap[id] || 'Unknown').join(', ');
};

// Phase 1: Percentile-based selection for initial emotion
const selectMovieFromPercentile = (seenMovies, emotion, usedOpponentIds = []) => {
  // Map emotions to percentile ranges (corrected for descending sort order)
  const percentileRanges = {
    LOVED: [0.0, 0.25],      // Top 25% - indices 0-25% in descending sorted array
    LIKED: [0.25, 0.50],     // Upper-middle 25-50% 
    AVERAGE: [0.50, 0.75],   // Lower-middle 50-75%
    DISLIKED: [0.75, 1.0]    // Bottom 25% - indices 75-100% in descending sorted array
  };
  
  const range = percentileRanges[emotion] || [0.25, 0.75];
  
  console.log(`🎯 Phase 1 - Emotion: ${emotion}, Total movies: ${seenMovies.length}, Percentile range: [${range[0]*100}%, ${range[1]*100}%]`);
  
  const selectedMovie = selectPercentileOpponent(seenMovies, range, usedOpponentIds);
  
  if (selectedMovie) {
    console.log(`✅ Selected opponent: ${selectedMovie.title || selectedMovie.name} (Rating: ${selectedMovie.userRating})`);
    
    // Additional logging for debugging percentile selection
    const sortedRatings = seenMovies
      .filter(m => m.userRating)
      .map(m => m.userRating)
      .sort((a, b) => b - a);
    console.log(`📊 User's rating distribution: ${sortedRatings.slice(0, 5).join(', ')}... (showing top 5)`);
  } else {
    console.log(`❌ No opponent found in percentile range`);
  }
  
  return selectedMovie;
};

// Phase 2-3: Wildcard-style proximity matching for subsequent rounds
const selectLadderOpponent = (seenMovies, currentRating, usedOpponentIds = []) => {
  console.log(`🎯 Phase 2-3 - Finding opponent near rating: ${currentRating}, Excluding: ${usedOpponentIds.length} movies`);
  
  // Use Wildcard's proximity matching algorithm
  const opponent = selectProximityOpponent(seenMovies, currentRating, usedOpponentIds, 1.0);
  
  if (opponent) {
    console.log(`✅ Selected proximity opponent: ${opponent.title || opponent.name} (Rating: ${opponent.userRating})`);
  } else {
    console.log(`❌ No proximity opponent found`);
  }
  
  return opponent;
};

const InitialRatingFlow = ({
  visible,
  movie,
  seenMovies = [],
  onClose,
  onComplete,
  isDarkMode = false
}) => {
  const [currentStep, setCurrentStep] = useState('emotion'); // 'emotion', 'comparison', 'complete'
  const [selectedEmotion, setSelectedEmotion] = useState(null);
  const [roundIndex, setRoundIndex] = useState(0);
  const [currentMovieRating, setCurrentMovieRating] = useState(null);
  const [opponentMovie, setOpponentMovie] = useState(null);
  const [usedOpponentIds, setUsedOpponentIds] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [comparedMovieIds, setComparedMovieIds] = useState([]);
  const [flowStartTime] = useState(new Date().toISOString());
  
  const colors = {
    background: isDarkMode ? '#1C2526' : '#FFFFFF',
    card: isDarkMode ? '#4B0082' : '#F8F9FA',
    text: isDarkMode ? '#F5F5F5' : '#333333',
    subText: isDarkMode ? '#D3D3D3' : '#666666',
    accent: isDarkMode ? '#FFD700' : '#4B0082',
    border: isDarkMode ? '#8A2BE2' : '#E0E0E0',
    success: '#4CAF50',
    error: '#F44336',
    font: { body: 'System' }
  };

  // Initialize mediaType and styles
  const { mediaType } = useMediaType();
  const standardButtonStyles = getStandardizedButtonStyles(colors);
  const modalStyles = getModalStyles(mediaType, isDarkMode ? 'dark' : 'light', theme);
  const compareStyles = getCompareStyles(mediaType, isDarkMode ? 'dark' : 'light', theme);
  const themeColors = theme[mediaType][isDarkMode ? 'dark' : 'light'];


  // Check if user has enough rated movies (10 minimum)
  const hasEnoughMovies = useMemo(() => {
    return seenMovies && seenMovies.length >= 10;
  }, [seenMovies]);

  // Get dynamic rating categories
  const RATING_CATEGORIES = useMemo(() => {
    return calculateDynamicRatingCategories(seenMovies);
  }, [seenMovies]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (visible) {
      setCurrentStep('emotion');
      setSelectedEmotion(null);
      setRoundIndex(0);
      setCurrentMovieRating(null);
      setOpponentMovie(null);
      setUsedOpponentIds([]);
      setIsLoading(false);
      setComparedMovieIds([]);
    }
  }, [visible]);

  const handleEmotionSelect = useCallback((emotion) => {
    if (!hasEnoughMovies) {
      Alert.alert(
        "Not Enough Ratings",
        "You need at least 10 rated movies to use this feature. Please rate more movies first!",
        [{ text: "OK", onPress: onClose }]
      );
      return;
    }

    setSelectedEmotion(emotion);
    const initialRating = getInitialRatingFromEmotion(emotion);
    setCurrentMovieRating(initialRating);
    
    // Select first opponent from emotion-based percentile
    const firstOpponent = selectMovieFromPercentile(seenMovies, emotion, []);
    
    if (!firstOpponent) {
      Alert.alert(
        "No Comparison Available",
        "Could not find a suitable movie for comparison. Please try rating this movie manually.",
        [{ text: "OK", onPress: onClose }]
      );
      return;
    }
    
    setOpponentMovie(firstOpponent);
    setUsedOpponentIds([firstOpponent.id]);
    setComparedMovieIds([firstOpponent.id]);
    setCurrentStep('comparison');
  }, [hasEnoughMovies, seenMovies, onClose]);

  const handleComparison = useCallback((newMovieWins) => {
    if (!opponentMovie || !movie) return;
    
    setIsLoading(true);
    
    setTimeout(() => {
      // Current games played for new movie (starts at 0, increments each round)
      const newMovieGamesPlayed = roundIndex;
      const opponentGamesPlayed = opponentMovie.gamesPlayed || 1;
      
      // Current ratings for Elo calculation
      const newMovieCurrentRating = currentMovieRating;
      const opponentCurrentRating = opponentMovie.userRating || opponentMovie.eloRating / 10;
      
      // Calculate expected win probabilities
      const newMovieExpected = calculateExpectedWinProbability(newMovieCurrentRating, opponentCurrentRating);
      const opponentExpected = calculateExpectedWinProbability(opponentCurrentRating, newMovieCurrentRating);
      
      // Calculate new ratings using Wildcard's system
      const newMovieNewRating = calculateNewRating(
        newMovieCurrentRating,
        newMovieGamesPlayed,
        newMovieWins ? 1 : 0,
        newMovieExpected
      );
      
      const opponentNewRating = calculateNewRating(
        opponentCurrentRating,
        opponentGamesPlayed,
        newMovieWins ? 0 : 1,
        opponentExpected
      );
      
      // Update current movie rating immediately (like Wildcard)
      setCurrentMovieRating(newMovieNewRating);
      
      console.log(`🎬 Round ${roundIndex + 1}:`);
      console.log(`  ${movie.title || movie.name}: ${newMovieCurrentRating.toFixed(2)} → ${newMovieNewRating.toFixed(2)} (GP: ${newMovieGamesPlayed})`);
      console.log(`  ${opponentMovie.title || opponentMovie.name}: ${opponentCurrentRating.toFixed(2)} → ${opponentNewRating.toFixed(2)} (GP: ${opponentGamesPlayed})`);
      console.log(`  Winner: ${newMovieWins ? 'NEW MOVIE' : 'OPPONENT'}`);
      
      // TODO: Update opponent's rating in seenMovies (immediate like Wildcard)
      // This would require callback to parent component
      
      // Check if we need more rounds
      if (roundIndex < 2) {
        // Select next opponent using Wildcard-style proximity matching
        const nextOpponent = selectLadderOpponent(
          seenMovies, 
          newMovieNewRating, 
          usedOpponentIds
        );
        
        if (nextOpponent) {
          setOpponentMovie(nextOpponent);
          setUsedOpponentIds(prev => [...prev, nextOpponent.id]);
          setComparedMovieIds(prev => [...prev, nextOpponent.id]);
          setRoundIndex(prev => prev + 1);
        } else {
          // No more opponents available, finish early
          finishRatingFlow(newMovieNewRating);
        }
      } else {
        // All 3 rounds complete
        finishRatingFlow(newMovieNewRating);
      }
      
      setIsLoading(false);
    }, 300);
  }, [opponentMovie, movie, currentMovieRating, roundIndex, usedOpponentIds, seenMovies]);

  const finishRatingFlow = useCallback((finalRating) => {
    const finalRoundedRating = Math.round(finalRating * 10) / 10;
    const completedRounds = roundIndex + 1; // +1 because roundIndex starts at 0
    
    const ratedMovie = {
      ...movie,
      userRating: finalRoundedRating,
      eloRating: finalRoundedRating * 10,
      gamesPlayed: completedRounds, // Actual rounds completed (1-3)
      ratingMetadata: {
        initialEmotion: selectedEmotion,
        comparedMovieIds: comparedMovieIds,
        completedRounds: completedRounds,
        timestamp: new Date().toISOString(),
        flowStartTime: flowStartTime,
        method: 'initial_rating_flow_v2'
      }
    };
    
    console.log(`🏁 Rating flow complete: ${movie.title || movie.name} = ${finalRoundedRating} (${completedRounds} rounds)`);
    
    setCurrentStep('complete');
    
    setTimeout(() => {
      onComplete(ratedMovie);
      onClose();
    }, 2000);
  }, [movie, selectedEmotion, comparedMovieIds, flowStartTime, onComplete, onClose]);

  const generateNewOpponent = useCallback(() => {
    if (!selectedEmotion || !seenMovies || seenMovies.length === 0) return;
    
    // Get a new opponent that hasn't been used yet
    const newOpponent = selectMovieFromPercentile(seenMovies, selectedEmotion, usedOpponentIds);
    
    if (newOpponent) {
      setOpponentMovie(newOpponent);
      setUsedOpponentIds(prev => [...prev, newOpponent.id]);
    } else {
      // If no more unique opponents available, just pick a random one from seen movies
      const availableMovies = seenMovies.filter(m => m.id !== movie?.id);
      if (availableMovies.length > 0) {
        const randomOpponent = availableMovies[Math.floor(Math.random() * availableMovies.length)];
        setOpponentMovie(randomOpponent);
      }
    }
  }, [selectedEmotion, seenMovies, usedOpponentIds, movie?.id]);

  const renderEmotionStep = () => (
    <View style={modalStyles.detailModalOverlay}>
      <LinearGradient
        colors={themeColors.primaryGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={modalStyles.detailModalContent}
      >
        {/* Close Button */}
        <TouchableOpacity 
          onPress={onClose} 
          style={{
            position: 'absolute',
            top: 20,
            right: 20,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            borderRadius: 20,
            padding: 8,
            zIndex: 10,
          }}
        >
          <Ionicons name="close" size={20} color="#FFFFFF" />
        </TouchableOpacity>

        <Image 
          source={{ 
            uri: movie?.poster_path 
              ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` 
              : 'https://via.placeholder.com/200x300?text=No+Image'
          }} 
          style={modalStyles.detailPoster}
          resizeMode="cover" 
        />
        
        <Text style={modalStyles.detailTitle}>
          {movie?.title || movie?.name}
        </Text>
        
        <Text style={modalStyles.detailYear}>
          ({movie?.release_date ? new Date(movie.release_date).getFullYear() : 
            movie?.first_air_date ? new Date(movie.first_air_date).getFullYear() : 'Unknown'})
        </Text>
        
        <Text style={modalStyles.detailScore}>
          TMDb: {movie?.vote_average?.toFixed(1) || 'N/A'}
        </Text>
        
        <Text 
          style={modalStyles.detailPlot}
          numberOfLines={4}
          ellipsizeMode="tail"
        >
          {movie?.overview || 'No description available.'}
        </Text>
        
        {!hasEnoughMovies && (
          <View style={[styles.warningContainer, { backgroundColor: colors.error + '20', borderColor: colors.error }]}>
            <Ionicons name="warning" size={20} color={colors.error} />
            <Text style={[styles.warningText, { color: colors.error }]}>
              You need at least 10 rated movies to use this feature
            </Text>
          </View>
        )}
        
        <View style={modalStyles.buttonRow}>
          {/* **SENTIMENT BUTTONS** */}
          {Object.entries(RATING_CATEGORIES).map(([key, category]) => (
            <TouchableOpacity
              key={key}
              style={[
                standardButtonStyles.baseButton,
                standardButtonStyles.tertiaryButton,
                { opacity: hasEnoughMovies ? 1 : 0.5 }
              ]}
              onPress={() => handleEmotionSelect(key)}
              disabled={!hasEnoughMovies}
              activeOpacity={0.7}
            >
              <Text 
                style={[
                  standardButtonStyles.baseText,
                  standardButtonStyles.tertiaryText
                ]}
                numberOfLines={1}
                ellipsizeMode="tail"
                adjustsFontSizeToFit={true}
              >
                {category.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </LinearGradient>
    </View>
  );

  const renderComparisonStep = () => (
    <View style={[compareStyles.compareContainer, { paddingTop: 0, marginTop: -10 }]}>
      <View style={compareStyles.compareContent}>
        <Text style={compareStyles.compareTitle}>
          Round {roundIndex + 1} of 3 - Which movie is better?
        </Text>
        
        <View style={compareStyles.compareMovies}>
          {/* NEW MOVIE CARD (Left) */}
          <TouchableOpacity 
            style={compareStyles.posterContainer} 
            onPress={() => handleComparison(true)}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            <Image
              source={{
                uri: movie?.poster_path 
                  ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
                  : 'https://via.placeholder.com/200x300?text=No+Image'
              }}
              style={compareStyles.poster}
              resizeMode="cover"
            />
            <View style={compareStyles.posterOverlay}>
              <Text style={compareStyles.posterTitle} numberOfLines={1}>
                {movie?.title || movie?.name}
              </Text>
              <Text style={compareStyles.posterYear}>
                ({movie?.release_date?.split('-')[0] || movie?.first_air_date?.split('-')[0] || 'Unknown'})
              </Text>
              <Text style={compareStyles.posterGenre} numberOfLines={1} adjustsFontSizeToFit={true} minimumFontScale={0.7}>
                {getGenreName(movie?.genre_ids) || 'Unknown'}
              </Text>
            </View>
          </TouchableOpacity>

          {/* VS ELEMENT */}
          <View style={compareStyles.vsContainer}>
            <Text style={compareStyles.vsText}>VS</Text>
          </View>

          {/* OPPONENT MOVIE CARD (Right) */}
          <TouchableOpacity 
            style={compareStyles.posterContainer} 
            onPress={() => handleComparison(false)}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            <Image
              source={{
                uri: opponentMovie?.poster_path 
                  ? `https://image.tmdb.org/t/p/w500${opponentMovie.poster_path}`
                  : 'https://via.placeholder.com/200x300?text=No+Image'
              }}
              style={compareStyles.poster}
              resizeMode="cover"
            />
            <View style={compareStyles.posterOverlay}>
              <Text style={compareStyles.posterTitle} numberOfLines={1}>
                {opponentMovie?.title || opponentMovie?.name}
              </Text>
              <Text style={compareStyles.posterYear}>
                ({opponentMovie?.release_date?.split('-')[0] || opponentMovie?.first_air_date?.split('-')[0] || 'Unknown'})
              </Text>
              <Text style={compareStyles.posterGenre} numberOfLines={1} adjustsFontSizeToFit={true} minimumFontScale={0.7}>
                {getGenreName(opponentMovie?.genre_ids) || 'Unknown'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* ACTION BUTTONS */}
        <View style={compareStyles.actionButtons}>
          <TouchableOpacity
            style={compareStyles.toughButton}
            onPress={generateNewOpponent}
            activeOpacity={0.7}
          >
            <Text style={compareStyles.toughButtonText}>
              Too tough to decide
            </Text>
          </TouchableOpacity>
        </View>

        {/* LOADING INDICATOR */}
        {isLoading && (
          <View style={compareStyles.loadingContainer || styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        )}
      </View>
    </View>
  );

  const renderCompleteStep = () => (
    <View style={[styles.stepContainer, { backgroundColor: colors.card }]}>
      <Ionicons name="checkmark-circle" size={64} color={colors.success} />
      <Text style={[styles.stepTitle, { color: colors.text }]}>
        Rating Complete!
      </Text>
      <Text style={[styles.finalRatingText, { color: colors.accent }]}>
        Final Rating: {currentMovieRating?.toFixed(1)}/10
      </Text>
      <Text style={[styles.completionSubtitle, { color: colors.subText }]}>
        Based on 3 movie comparisons
      </Text>
    </View>
  );

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {currentStep === 'emotion' && renderEmotionStep()}
      {currentStep === 'comparison' && (
        <View style={styles.modalOverlay}>
          <SafeAreaView style={styles.modalContainer}>
            <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
              <Text style={[styles.headerTitle, { color: colors.text }]}>
                Initial Rating
              </Text>
              <View style={styles.placeholder} />
            </View>
            
            <View style={[styles.content, { backgroundColor: colors.background }]}>
              {renderComparisonStep()}
            </View>
          </SafeAreaView>
        </View>
      )}
      {currentStep === 'complete' && (
        <View style={styles.modalOverlay}>
          <SafeAreaView style={styles.modalContainer}>
            <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
              <Text style={[styles.headerTitle, { color: colors.text }]}>
                Rating Complete
              </Text>
              <View style={styles.placeholder} />
            </View>
            
            <View style={[styles.content, { backgroundColor: colors.background }]}>
              {renderCompleteStep()}
            </View>
          </SafeAreaView>
        </View>
      )}
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: width * 0.95,
    height: height * 0.85,
    backgroundColor: '#FFF',
    borderRadius: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  stepContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    borderRadius: 12,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  movieTitle: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 32,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 24,
  },
  warningText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  emotionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
  },
  emotionButton: {
    width: (width - 80) / 2,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    marginBottom: 16,
  },
  emotionEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  emotionLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  emotionDescription: {
    fontSize: 12,
    textAlign: 'center',
  },
  comparisonSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
  },
  comparisonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 16,
  },
  movieCard: {
    width: (width - 120) / 2,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
  },
  moviePoster: {
    width: 80,
    height: 120,
    borderRadius: 8,
    marginBottom: 8,
  },
  movieCardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  movieYear: {
    fontSize: 12,
    textAlign: 'center',
  },
  vsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
  },
  vsText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  loadingContainer: {
    alignItems: 'center',
    marginTop: 24,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
  },
  finalRatingText: {
    fontSize: 32,
    fontWeight: 'bold',
    marginVertical: 16,
  },
  completionSubtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
});

export default InitialRatingFlow;