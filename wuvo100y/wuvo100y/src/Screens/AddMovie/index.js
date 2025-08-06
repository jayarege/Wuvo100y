import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  ScrollView,
  Keyboard,
  Modal,
  Dimensions,
  TouchableWithoutFeedback,
  Alert,
  Animated
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { EnhancedRatingButton, SentimentRatingModal, calculateDynamicRatingCategories } from '../../Components/EnhancedRatingSystem';
import { adjustRatingWildcard } from '../../Components/EnhancedRatingSystem';
import { 
  isObfuscatedAdultContent, 
  hasSuspiciousAdultStructure, 
  hasObviousAdultTerms, 
  isTrustedContent, 
  filterSearchSuggestions, 
  filterFullSearchResults 
} from '../../utils/ContentFiltering';
import UnifiedSearchService from '../../services/UnifiedSearchService';
import SearchBar from '../../Components/SearchBar';
import MovieSearchResults from '../../Components/MovieSearchResults';
import UserSearchResult from '../../Components/UserSearchResult';

// Import theme system and styles
import { useMediaType } from '../../Navigation/TabNavigator';
import { getLayoutStyles } from '../../Styles/layoutStyles';
import { getHeaderStyles, ThemedHeader } from '../../Styles/headerStyles';
import { getSearchStyles } from '../../Styles/searchStyles';
import { getMovieCardStyles } from '../../Styles/movieCardStyles';
import { getButtonStyles, ThemedButton } from '../../Styles/buttonStyles';
import { getModalStyles } from '../../Styles/modalStyles';
import stateStyles from '../../Styles/StateStyles';
import theme from '../../utils/Theme';

import { TMDB_API_KEY as API_KEY } from '../../Constants';

function AddMovieScreen({ seen, unseen, seenTVShows, unseenTVShows, onAddToSeen, onAddToUnseen, onRemoveFromWatchlist, onUpdateRating, genres, isDarkMode }) {
  // Use media type context
  const { mediaType } = useMediaType();
  
  // Helper functions to get appropriate arrays based on media type
  const getCurrentSeen = () => {
    return mediaType === 'movie' ? seen : (seenTVShows || []);
  };
  
  const getCurrentUnseen = () => {
    return mediaType === 'movie' ? unseen : (unseenTVShows || []);
  };
  
  // Get all themed styles
  const headerStyles = getHeaderStyles(mediaType, isDarkMode ? 'dark' : 'light', theme);
  const searchStyles = getSearchStyles(mediaType, isDarkMode ? 'dark' : 'light', theme);
  const movieCardStyles = getMovieCardStyles(mediaType, isDarkMode ? 'dark' : 'light', theme);
  const buttonStyles = getButtonStyles(mediaType, isDarkMode ? 'dark' : 'light', theme);

  // Get theme colors for this media type and mode
  const colors = theme[mediaType][isDarkMode ? 'dark' : 'light'];

  // Initialize unified search service
  const unifiedSearchService = useMemo(() => new UnifiedSearchService({
    apiKey: API_KEY,
    maxMovieResults: 15,
    maxUserResults: 8,
    maxTotalResults: 20
  }), []);

  // State variables
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [userResults, setUserResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Rating modal state - EXACT COPY FROM HOME SCREEN
  const [emotionModalVisible, setEmotionModalVisible] = useState(false);
  const [comparisonModalVisible, setComparisonModalVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [comparisonMovies, setComparisonMovies] = useState([]);
  const [currentComparison, setCurrentComparison] = useState(0);
  const [comparisonResults, setComparisonResults] = useState([]);
  const [isComparisonComplete, setIsComparisonComplete] = useState(false);
  const [selectedEmotion, setSelectedEmotion] = useState(null);
  const [currentMovieRating, setCurrentMovieRating] = useState(null);
  const [finalCalculatedRating, setFinalCalculatedRating] = useState(null);
  const [selectedMovieForRating, setSelectedMovieForRating] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  

  // Clear search when media type changes
  useEffect(() => {
    setSearchQuery('');
    setSearchResults([]);
    setUserResults([]);
    setError(null);
  }, [mediaType]);

  // ============================================================================
  // **RATING SYSTEM FUNCTIONS - EXACT COPY FROM HOME SCREEN**
  // ============================================================================

  // Select movie from percentile based on emotion (from InitialRatingFlow logic)
  const selectMovieFromPercentile = useCallback((seenMovies, emotion) => {
    const percentileRanges = {
      LOVED: [0.0, 0.25],      // Top 25%
      LIKED: [0.25, 0.50],     // Upper-middle 25-50% 
      AVERAGE: [0.50, 0.75],   // Lower-middle 50-75%
      DISLIKED: [0.75, 1.0]    // Bottom 25%
    };
    
    const range = percentileRanges[emotion] || [0.25, 0.75];
    
    // Sort movies by rating descending
    const sortedMovies = [...seenMovies]
      .filter(movie => movie.userRating && !isNaN(movie.userRating))
      .sort((a, b) => b.userRating - a.userRating);
    
    if (sortedMovies.length === 0) return null;
    
    const startIndex = Math.floor(range[0] * sortedMovies.length);
    const endIndex = Math.floor(range[1] * sortedMovies.length);
    const candidates = sortedMovies.slice(startIndex, Math.max(endIndex, startIndex + 1));
    
    // Return random movie from the percentile range
    return candidates[Math.floor(Math.random() * candidates.length)];
  }, []);
  
  // Handle emotion selection and start comparison process
  const handleEmotionSelected = useCallback((emotion) => {
    console.log('🎭 EMOTION SELECTED:', emotion);
    console.log('🎭 CURRENT SEEN COUNT:', getCurrentSeen().length);
    console.log('🎭 CURRENT SEEN ITEMS:', getCurrentSeen().map(m => `${m.title}: ${m.userRating}`));
    
    setSelectedEmotion(emotion);
    setEmotionModalVisible(false);
    
    // Get current seen movies based on media type (use appropriate array)
    const currentMediaMovies = getCurrentSeen();
    console.log('🎭 CURRENT MEDIA MOVIES COUNT:', currentMediaMovies.length);
    
    // Select first opponent from percentile (same media type only)
    const firstOpponent = selectMovieFromPercentile(currentMediaMovies, emotion);
    if (!firstOpponent) {
      console.log('❌ NO FIRST OPPONENT FOUND');
      Alert.alert(
        '🎬 Need More Ratings', 
        `You need at least 3 rated ${mediaType === 'movie' ? 'movies' : 'TV shows'} to use this feature.\n\nCurrently you have: ${currentMediaMovies.length} rated ${mediaType === 'movie' ? 'movies' : 'TV shows'}.\n\nPlease rate a few more ${mediaType === 'movie' ? 'movies' : 'TV shows'} first!`,
        [{ text: "OK", style: "default" }]
      );
      return;
    }
    
    // Select second and third opponents randomly from same media type movies (for known vs known)
    const remainingMovies = currentMediaMovies.filter(movie => movie.id !== firstOpponent.id);
    
    if (remainingMovies.length < 2) {
      console.log('❌ NOT ENOUGH REMAINING MOVIES');
      Alert.alert(
        '🎬 Need More Ratings', 
        `You need at least 3 rated ${mediaType === 'movie' ? 'movies' : 'TV shows'} to use this feature.\n\nCurrently you have: ${currentMediaMovies.length} rated ${mediaType === 'movie' ? 'movies' : 'TV shows'}.\n\nPlease rate a few more ${mediaType === 'movie' ? 'movies' : 'TV shows'} first!`,
        [{ text: "OK", style: "default" }]
      );
      return;
    }
    
    // Shuffle remaining movies and pick 2
    const shuffled = remainingMovies.sort(() => 0.5 - Math.random());
    const secondOpponent = shuffled[0];
    const thirdOpponent = shuffled[1];
    
    // Set up comparison movies and start
    setComparisonMovies([firstOpponent, secondOpponent, thirdOpponent]);
    setCurrentComparison(0);
    setComparisonResults([]);
    setIsComparisonComplete(false);
    setCurrentMovieRating(null);
    setComparisonModalVisible(true);
    
    console.log(`🎭 Starting rating for ${selectedMovieForRating?.title} with emotion: ${emotion} (no baseline)`);
    console.log(`🎯 First opponent (${emotion} percentile): ${firstOpponent.title} (${firstOpponent.userRating})`);
    console.log(`🎯 Second opponent (random): ${secondOpponent.title} (${secondOpponent.userRating})`);
    console.log(`🎯 Third opponent (random): ${thirdOpponent.title} (${thirdOpponent.userRating})`);
  }, [selectedMovieForRating, getCurrentSeen, selectMovieFromPercentile]);


  const handleComparison = useCallback((winner) => {
    const currentComparisonMovie = comparisonMovies[currentComparison];
    const newMovieWon = winner === 'new';
    
    if (currentComparison === 0) {
      // FIRST COMPARISON: Unknown vs Known (no baseline - pure comparison result)
      const opponentRating = currentComparisonMovie.userRating;
      let derivedRating;
      
      if (newMovieWon) {
        // If unknown movie won, it should be rated higher than opponent
        // Use a simple heuristic: winner gets opponent rating + small bonus
        derivedRating = Math.min(10, opponentRating + 0.5);
      } else {
        // If unknown movie lost, it should be rated lower than opponent  
        // Use a simple heuristic: loser gets opponent rating - small penalty
        derivedRating = Math.max(1, opponentRating - 0.5);
      }
      
      // Round to nearest 0.1
      derivedRating = Math.round(derivedRating * 10) / 10;
      
      setCurrentMovieRating(derivedRating);
      
      console.log(`🎯 Round 1 (Unknown vs Known): ${newMovieWon ? 'WIN' : 'LOSS'} vs ${currentComparisonMovie.title} (${opponentRating}) -> Initial Rating: ${derivedRating}`);
      
      // Move to next comparison
      setCurrentComparison(1);
      
    } else if (currentComparison < comparisonMovies.length - 1) {
      // SUBSEQUENT COMPARISONS: Known vs Known
      let updatedRating;
      if (newMovieWon) {
        const { updatedSeenContent, updatedNewContent } = adjustRatingWildcard(
          currentMovieRating,  // New movie current rating
          currentComparisonMovie.userRating,  // Opponent rating
          true,  // New movie won
          currentComparison,  // New movie now has currentComparison games played
          5      // Opponent has experience
        );
        updatedRating = updatedSeenContent;
      } else {
        const { updatedSeenContent, updatedNewContent } = adjustRatingWildcard(
          currentComparisonMovie.userRating,  // Opponent won
          currentMovieRating,  // New movie current rating
          true,  // Opponent won
          5,     // Opponent has experience
          currentComparison   // New movie now has currentComparison games played
        );
        updatedRating = updatedNewContent;
      }
      
      setCurrentMovieRating(updatedRating);
      
      console.log(`🎯 Round ${currentComparison + 1} (Known vs Known): ${newMovieWon ? 'WIN' : 'LOSS'} vs ${currentComparisonMovie.title} (${currentComparisonMovie.userRating}) -> Rating: ${updatedRating}`);
      
      // Move to next comparison
      setCurrentComparison(currentComparison + 1);
      
    } else {
      // FINAL COMPARISON: Known vs Known
      let finalRating;
      if (newMovieWon) {
        const { updatedSeenContent, updatedNewContent } = adjustRatingWildcard(
          currentMovieRating,  // New movie current rating
          currentComparisonMovie.userRating,  // Opponent rating
          true,  // New movie won
          currentComparison,  // New movie now has currentComparison games played
          5      // Opponent has experience
        );
        finalRating = updatedSeenContent;
      } else {
        const { updatedSeenContent, updatedNewContent } = adjustRatingWildcard(
          currentComparisonMovie.userRating,  // Opponent won
          currentMovieRating,  // New movie current rating
          true,  // Opponent won
          5,     // Opponent has experience
          currentComparison   // New movie now has currentComparison games played
        );
        finalRating = updatedNewContent;
      }
      
      console.log(`🎯 Round ${currentComparison + 1} (Known vs Known - FINAL): ${newMovieWon ? 'WIN' : 'LOSS'} vs ${currentComparisonMovie.title} (${currentComparisonMovie.userRating}) -> Final Rating: ${finalRating}`);
      
      // SET RATING FIRST, then show completion screen
      console.log('🎯 SETTING finalCalculatedRating BEFORE completion screen:', finalRating);
      setFinalCalculatedRating(finalRating);
      setIsComparisonComplete(true);
      setTimeout(() => {
        setComparisonModalVisible(false);
        handleConfirmRating(finalRating);
      }, 1500);
    }
  }, [currentComparison, comparisonMovies, selectedMovieForRating, selectedEmotion, currentMovieRating]);

  const handleConfirmRating = useCallback((finalRating) => {
    console.log('✅ Confirming rating:', finalRating, 'for:', selectedMovieForRating?.title);
    if (!selectedMovieForRating || !finalRating) return;
    
    // Store the final calculated rating for display
    console.log('🎯 SETTING finalCalculatedRating to:', finalRating);
    setFinalCalculatedRating(finalRating);
    
    const ratedMovie = {
      id: selectedMovieForRating.id,
      title: selectedMovieForRating.title || selectedMovieForRating.name,
      poster: selectedMovieForRating.poster_path || selectedMovieForRating.poster,
      poster_path: selectedMovieForRating.poster_path,
      score: selectedMovieForRating.vote_average || selectedMovieForRating.score || 0,
      vote_average: selectedMovieForRating.vote_average,
      voteCount: selectedMovieForRating.vote_count || 0,
      release_date: selectedMovieForRating.release_date || selectedMovieForRating.first_air_date,
      genre_ids: selectedMovieForRating.genre_ids || [],
      overview: selectedMovieForRating.overview || "",
      adult: selectedMovieForRating.adult || false,
      userRating: finalRating,
      eloRating: finalRating * 100,
      comparisonHistory: [],
      comparisonWins: 0,
      mediaType: mediaType,
      ratingCategory: selectedCategory
    };
    
    onAddToSeen(ratedMovie);
    
    // Reset state
    setSelectedCategory(null);
    setComparisonMovies([]);
    setCurrentComparison(0);
    setComparisonResults([]);
    setIsComparisonComplete(false);
    setSelectedMovieForRating(null);
    
    // Update search results to show as rated
    setSearchResults(prev => 
      prev.map(m => 
        m.id === selectedMovieForRating.id 
          ? { ...m, alreadyRated: true, currentRating: finalRating } 
          : m
      )
    );
    
    Alert.alert(
      "Rating Added!", 
      `You rated "${selectedMovieForRating.title}" (${finalRating.toFixed(1)}/10)`,
      [{ text: "OK" }]
    );
  }, [selectedMovieForRating, selectedCategory, onAddToSeen, mediaType]);

  const handleCloseEnhancedModals = useCallback(() => {
    setComparisonModalVisible(false);
    setEmotionModalVisible(false);
    setSelectedCategory(null);
    setComparisonMovies([]);
    setCurrentComparison(0);
    setComparisonResults([]);
    setIsComparisonComplete(false);
    setFinalCalculatedRating(null);
    setSelectedMovieForRating(null);
  }, []);



  // Enhanced unified search with movies and users
  const handleFullSearch = useCallback(async (query = searchQuery) => {
    if (!query || query.trim().length === 0) return;
    
    setLoading(true);
    setError(null);
    setShowSuggestions(false);
    
    try {
      console.log(`🔍 Unified search for: "${query}"`);
      
      // Search both movies/TV and users
      const searchContext = {
        userHistory: getCurrentSeen(), // User's rating history for better movie recommendations
        currentUserId: null, // TODO: Get from auth context when available
        mediaType: mediaType
      };
      
      const results = await unifiedSearchService.search(query, searchContext);
      
      if (results.error) {
        throw new Error(results.error);
      }
      
      // Process movie/TV results with current watchlist/seen status
      const processedMovieResults = results.movies.map(item => ({
        ...item,
        alreadyRated: getCurrentSeen().some(sm => sm.id === item.id),
        inWatchlist: getCurrentUnseen().some(um => um.id === item.id),
        currentRating: getCurrentSeen().find(sm => sm.id === item.id)?.userRating,
        media_type: item.mediaType || 'movie'
      }));
      
      setSearchResults(processedMovieResults);
      setUserResults(results.users);
      
      console.log(`✅ Unified search complete: ${processedMovieResults.length} movies/TV, ${results.users.length} users`);
      
    } catch (err) {
      console.error('❌ Error in unified search:', err);
      setError(`Failed to search. Please try again.`);
      setSearchResults([]);
      setUserResults([]);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, getCurrentSeen, getCurrentUnseen, mediaType, unifiedSearchService]);

  // Handle selecting a suggestion
  const handleSelectSuggestion = useCallback((suggestion) => {
    handleFullSearch(suggestion.title);
  }, [handleFullSearch]);

  // Handle user profile selection
  const handleUserPress = useCallback((user) => {
    console.log(`👤 User selected: ${user.username}`);
    // TODO: Navigate to user profile screen
    Alert.alert(
      "User Profile", 
      `${user.displayName || user.username}
@${user.username}

${user.overview || 'No bio available'}`,
      [{ text: "OK" }]
    );
  }, []);

  // Add item to watchlist
  const addToUnseen = useCallback((item) => {
    if (getCurrentSeen().some(m => m.id === item.id)) {
      return;
    }
    
    if (item.inWatchlist) {
      onRemoveFromWatchlist(item.id);
      setSearchResults(prev => 
        prev.map(m => 
          m.id === item.id 
            ? { ...m, inWatchlist: false } 
            : m
        )
      );
      return;
    }
    
    const itemWithMediaType = {
      ...item,
      mediaType: mediaType
    };
    onAddToUnseen(itemWithMediaType);
    
    setSearchResults(prev => 
      prev.map(m => 
        m.id === item.id 
          ? { ...m, inWatchlist: true } 
          : m
      )
    );
  }, [onAddToUnseen, onRemoveFromWatchlist, getCurrentSeen, getCurrentUnseen, mediaType]);



  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ThemedHeader mediaType={mediaType} isDarkMode={isDarkMode} theme={theme}>
        <Text style={headerStyles.screenTitle}>
          Add {mediaType === 'movie' ? 'Movies' : 'TV Shows'}
        </Text>
      </ThemedHeader>
      
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: 0 }}>
        {/* Search bar */}
        <SearchBar
          mediaType={mediaType}
          colors={colors}
          searchStyles={searchStyles}
          seen={seen}
          unseen={unseen}
          onSearchComplete={(query) => {
            setSearchQuery(query);
            handleFullSearch(query);
          }}
          onSuggestionSelect={(suggestion) => {
            setSearchQuery(suggestion.title);
            handleSelectSuggestion(suggestion);
          }}
        />

        {/* Search results - Unified display */}
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            
            {/* Movie/TV Results Section */}
            {searchResults.length > 0 && (
              <>
                <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
                  <Text style={[{ 
                    fontSize: 18, 
                    fontWeight: 'bold', 
                    color: colors.text 
                  }]}>
                    {mediaType === 'movie' ? 'Movies' : 'TV Shows'} ({searchResults.length})
                  </Text>
                </View>
                <MovieSearchResults
                  searchResults={searchResults}
                  colors={colors}
                  genres={genres}
                  movieCardStyles={movieCardStyles}
                  buttonStyles={buttonStyles}
                  seen={getCurrentSeen()}
                  unseen={getCurrentUnseen()}
                  onAddToUnseen={addToUnseen}
                  onRateMovie={(item) => {
                    setSelectedMovieForRating(item);
                    setEmotionModalVisible(true);
                  }}
                  mediaType={mediaType}
                  loading={loading && searchResults.length === 0}
                  error={error}
                  searchQuery={searchQuery}
                  stateStyles={stateStyles}
                  onRetry={() => {
                    setError(null);
                    if (searchQuery.trim()) {
                      handleFullSearch();
                    }
                  }}
                />
              </>
            )}

            {/* User Results Section */}
            {userResults.length > 0 && (
              <>
                <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
                  <Text style={[{ 
                    fontSize: 18, 
                    fontWeight: 'bold', 
                    color: colors.text 
                  }]}>
                    Users ({userResults.length})
                  </Text>
                </View>
                {userResults.map((user, index) => (
                  <UserSearchResult
                    key={`user-${user.id}-${index}`}
                    user={user}
                    onPress={handleUserPress}
                    isDarkMode={isDarkMode}
                    colors={colors}
                  />
                ))}
              </>
            )}

            {/* No Results State */}
            {!loading && searchQuery.trim() && searchResults.length === 0 && userResults.length === 0 && (
              <View style={[stateStyles.emptyState, { marginTop: 60 }]}>
                <Ionicons name="search" size={48} color={colors.subText} />
                <Text style={[stateStyles.emptyTitle, { color: colors.text }]}>
                  No Results Found
                </Text>
                <Text style={[stateStyles.emptySubtitle, { color: colors.subText }]}>
                  Try adjusting your search terms or check for typos.
                </Text>
              </View>
            )}

            {/* Loading State */}
            {loading && (
              <View style={[stateStyles.loadingState, { marginTop: 40 }]}>
                <ActivityIndicator size="large" color={colors.accent} />
                <Text style={[stateStyles.loadingText, { color: colors.text }]}>
                  Searching...
                </Text>
              </View>
            )}

            {/* Error State */}
            {error && (
              <View style={[stateStyles.errorState, { marginTop: 40 }]}>
                <Ionicons name="alert-circle" size={48} color={colors.secondary} />
                <Text style={[stateStyles.errorTitle, { color: colors.text }]}>
                  Search Error
                </Text>
                <Text style={[stateStyles.errorSubtitle, { color: colors.subText }]}>
                  {error}
                </Text>
                <TouchableOpacity
                  style={[buttonStyles.primary, { marginTop: 16 }]}
                  onPress={() => {
                    setError(null);
                    if (searchQuery.trim()) {
                      handleFullSearch();
                    }
                  }}
                >
                  <Text style={[buttonStyles.primaryText, { color: colors.textOnPrimary }]}>
                    Try Again
                  </Text>
                </TouchableOpacity>
              </View>
            )}
            
          </ScrollView>
        </TouchableWithoutFeedback>
        
      </View>

      {/* **EMOTION SELECTION MODAL - Using Reusable Component** */}
      <SentimentRatingModal
        visible={emotionModalVisible}
        movie={selectedMovieForRating}
        onClose={() => setEmotionModalVisible(false)}
        onRatingSelect={(movieWithRating, categoryKey, rating) => {
          console.log('🎭 Sentiment selected via reusable component:', categoryKey, 'Rating:', rating);
          setSelectedCategory(categoryKey);
          // Wire to existing handleEmotionSelected logic
          handleEmotionSelected(categoryKey);
        }}
        colors={colors}
        userMovies={getCurrentSeen()}
      />

      {/* **WILDCARD COMPARISON MODAL - EXACT COPY FROM HOME SCREEN** */}
      <Modal visible={comparisonModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <LinearGradient
            colors={colors.primaryGradient || ['#667eea', '#764ba2']}
            style={[styles.comparisonModalContent]}
          >
            {!isComparisonComplete ? (
              <>
                <View style={styles.comparisonHeader}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>
                    🎬 Comparison {currentComparison + 1}/3
                  </Text>
                  <Text style={[styles.comparisonSubtitle, { color: colors.subText }]}>
                    Which one do you prefer?
                  </Text>
                </View>
                
                <View style={styles.moviesComparison}>
                  {/* New Movie */}
                  <TouchableOpacity 
                    style={styles.movieComparisonCard}
                    onPress={() => handleComparison('new')}
                    activeOpacity={0.8}
                  >
                    <Image
                      source={{ uri: `https://image.tmdb.org/t/p/w500${selectedMovieForRating?.poster_path}` }}
                      style={styles.comparisonPoster}
                      resizeMode="cover"
                    />
                    <Text style={[styles.movieCardName, { color: colors.text }]} numberOfLines={2}>
                      {selectedMovieForRating?.title || selectedMovieForRating?.name}
                    </Text>
                    <Text style={[styles.movieCardYear, { color: colors.subText }]}>
                      {selectedMovieForRating?.release_date ? new Date(selectedMovieForRating.release_date).getFullYear() : 'N/A'}
                    </Text>
                  </TouchableOpacity>
                  
                  {/* VS Indicator */}
                  <View style={styles.vsIndicator}>
                    <Text style={[styles.vsText, { color: colors.accent }]}>VS</Text>
                  </View>
                  
                  {/* Comparison Movie */}
                  {comparisonMovies[currentComparison] && (
                    <TouchableOpacity 
                      style={styles.movieComparisonCard}
                      onPress={() => handleComparison('comparison')}
                      activeOpacity={0.8}
                    >
                      <Image
                        source={{ uri: `https://image.tmdb.org/t/p/w500${comparisonMovies[currentComparison]?.poster_path}` }}
                        style={styles.comparisonPoster}
                        resizeMode="cover"
                      />
                      <Text style={[styles.movieCardName, { color: colors.text }]} numberOfLines={2}>
                        {comparisonMovies[currentComparison]?.title || comparisonMovies[currentComparison]?.name}
                      </Text>
                      <Text style={[styles.movieCardYear, { color: colors.subText }]}>
                        {comparisonMovies[currentComparison]?.release_date ? new Date(comparisonMovies[currentComparison].release_date).getFullYear() : 'N/A'}
                      </Text>
                      <View style={[styles.ratingBadge, { backgroundColor: colors.accent }]}>
                        <Text style={styles.ratingText}>
                          {comparisonMovies[currentComparison]?.userRating?.toFixed(1)}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Progress Indicator */}
                <View style={styles.progressIndicator}>
                  {[0, 1, 2].map(index => (
                    <View
                      key={index}
                      style={[
                        styles.progressDot,
                        { 
                          backgroundColor: index <= currentComparison ? colors.accent : colors.border?.color || '#ccc'
                        }
                      ]}
                    />
                  ))}
                </View>

                {/* Too Tough to Decide Button */}
                <TouchableOpacity 
                  style={[styles.cancelButton, { borderColor: colors.border?.color || '#ccc' }]}
                  onPress={() => {
                    console.log('User selected: Too tough to decide');
                    // Handle too tough to decide logic - could skip this comparison or record as neutral
                    if (currentComparison < 2) {
                      setCurrentComparison(currentComparison + 1);
                    } else {
                      // Calculate average rating between current movie and opponent for "too tough to decide"
                      const currentComparisonMovie = comparisonMovies[currentComparison];
                      const currentRating = currentMovieRating || 5.0;
                      const opponentRating = currentComparisonMovie?.userRating || 5.0;
                      const averageRating = (currentRating + opponentRating) / 2;
                      
                      // Assign very close ratings (like Wildcard screen)
                      const neutralRating = Math.min(10, Math.max(1, averageRating + 0.05));
                      const opponentNewRating = Math.min(10, Math.max(1, averageRating - 0.05));
                      
                      console.log('🤷 Too tough to decide - current:', currentRating, 'opponent:', opponentRating, 'average:', averageRating);
                      console.log('🎯 SETTING finalCalculatedRating BEFORE completion screen (neutral):', neutralRating);
                      
                      // Update opponent's rating too (similar to Wildcard logic)
                      if (currentComparisonMovie) {
                        currentComparisonMovie.userRating = opponentNewRating;
                        // Save updated opponent rating to storage
                        const updateOpponentRating = async () => {
                          try {
                            const storedMovies = await AsyncStorage.getItem(STORAGE_KEY_MOVIES);
                            if (storedMovies) {
                              const movies = JSON.parse(storedMovies);
                              const movieIndex = movies.findIndex(m => m.id === currentComparisonMovie.id);
                              if (movieIndex !== -1) {
                                movies[movieIndex].userRating = opponentNewRating;
                                await AsyncStorage.setItem(STORAGE_KEY_MOVIES, JSON.stringify(movies));
                              }
                            }
                          } catch (error) {
                            console.error('Error updating opponent rating:', error);
                          }
                        };
                        updateOpponentRating();
                      }
                      
                      setFinalCalculatedRating(neutralRating);
                      setIsComparisonComplete(true);
                      setTimeout(() => {
                        setComparisonModalVisible(false);
                        handleConfirmRating(neutralRating);
                      }, 1500);
                    }
                  }}
                >
                  <Text style={[styles.cancelButtonText, { color: colors.subText }]}>Too Tough to Decide</Text>
                </TouchableOpacity>
              </>
            ) : (
              // Completion Screen
              <View style={styles.finalRatingModal}>
                {console.log('🎬 COMPLETION SCREEN RENDERING - finalCalculatedRating:', finalCalculatedRating)}
                {/* Movie Poster */}
                <Image
                  source={{ uri: `https://image.tmdb.org/t/p/w500${selectedMovieForRating?.poster_path}` }}
                  style={styles.finalRatingPoster}
                  resizeMode="cover"
                />
                
                {/* Movie Title */}
                <Text style={styles.finalRatingTitle} numberOfLines={1} ellipsizeMode="tail">
                  {selectedMovieForRating?.title || selectedMovieForRating?.name}
                </Text>
                
                {/* Movie Year */}
                <Text style={styles.finalRatingYear} numberOfLines={1} ellipsizeMode="tail">
                  ({selectedMovieForRating?.release_date ? new Date(selectedMovieForRating.release_date).getFullYear() : selectedMovieForRating?.first_air_date ? new Date(selectedMovieForRating.first_air_date).getFullYear() : 'N/A'})
                </Text>
                
                {/* Emotion Text */}
                <Text style={[styles.finalRatingEmotion, { color: colors.text }]}>
                  {selectedEmotion === 'LOVED' ? 'Love' : 
                   selectedEmotion === 'LIKED' ? 'Like' : 
                   selectedEmotion === 'AVERAGE' ? 'Okay' : 
                   selectedEmotion === 'DISLIKED' ? 'Dislike' : selectedEmotion}
                </Text>
                
                {/* Final Score */}
                <Text style={[styles.finalRatingScore, { color: colors.secondary }]}>
                  {(() => {
                    console.log('🔍 Rendering final score, finalCalculatedRating is:', finalCalculatedRating);
                    return finalCalculatedRating?.toFixed(1) || 'test';
                  })()}
                </Text>
              </View>
            )}
            
            <TouchableOpacity 
              style={[styles.cancelButton, { borderColor: colors.border?.color || '#ccc' }]}
              onPress={handleCloseEnhancedModals}
            >
              <Text style={[styles.cancelButtonText, { color: colors.subText }]}>
                {isComparisonComplete ? 'Close' : 'Cancel'}
              </Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({

  // **MODAL STYLES - EXACT COPY FROM HOME SCREEN**
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Removed unused emotion modal styles - now using SentimentRatingModal component
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  comparisonModalContent: {
    width: '95%',
    maxWidth: 500,
    padding: 20,
    borderRadius: 16,
    maxHeight: '80%',
  },
  comparisonHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  comparisonSubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  moviesComparison: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  movieComparisonCard: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginHorizontal: 8,
  },
  comparisonPoster: {
    width: 120,
    height: 180,
    borderRadius: 8,
    marginBottom: 12,
  },
  movieCardName: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  movieCardYear: {
    fontSize: 12,
    marginBottom: 8,
  },
  ratingBadge: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  ratingText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  vsIndicator: {
    marginHorizontal: 16,
    paddingVertical: 8,
  },
  vsText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  progressIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginHorizontal: 4,
  },
  cancelButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  finalRatingModal: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  finalRatingPoster: {
    width: 120,
    height: 180,
    borderRadius: 8,
    marginBottom: 20,
  },
  finalRatingTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  finalRatingYear: {
    fontSize: 12,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 20,
  },
  finalRatingEmotion: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 15,
  },
  finalRatingScore: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default AddMovieScreen;