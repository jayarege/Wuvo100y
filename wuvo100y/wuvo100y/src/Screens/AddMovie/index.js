import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  Keyboard,
  Dimensions,
  TouchableWithoutFeedback,
  Alert,
  Animated
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  SentimentRatingModal,
  ComparisonModal,
  selectOpponentFromSentiment,
  selectRandomOpponent
} from '../../Components/BradleyTerryRatingSystem';
import { STORAGE_KEYS } from '../../config/storageConfig';
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
import { movieUtils } from '../../utils/movieUtils';
import { formatUtils } from '../../utils/formatUtils';
import stateStyles from '../../Styles/StateStyles';
import theme from '../../utils/Theme';

import { TMDB_API_KEY as API_KEY } from '../../Constants';

function AddMovieScreen({ seen, unseen, seenTVShows, unseenTVShows, onAddToSeen, onAddToUnseen, onRemoveFromWatchlist, onUpdateRating, genres, isDarkMode }) {
  // Use media type context
  const { mediaType } = useMediaType();
  
  // CRITICAL FIX: Ensure all props are valid arrays to prevent crashes
  const safeSeen = Array.isArray(seen) ? seen : [];
  const safeUnseen = Array.isArray(unseen) ? unseen : [];
  const safeSeenTVShows = Array.isArray(seenTVShows) ? seenTVShows : [];
  const safeUnseenTVShows = Array.isArray(unseenTVShows) ? unseenTVShows : [];
  
  // CRITICAL DEBUG: Check what props are being received
  console.log('🔍 ADD MOVIE SCREEN PROPS DEBUG:', {
    'seen.length': movieUtils.getMovieCount(seen || []),
    'unseen.length': unseen?.length || 'undefined', 
    'seenTVShows.length': seenTVShows?.length || 'undefined',
    'unseenTVShows.length': unseenTVShows?.length || 'undefined',
    'current mediaType': mediaType,
    'SAFETY CHECK - safeSeen.length': safeSeen.length,
    'SAFETY CHECK - safeSeenTVShows.length': safeSeenTVShows.length
  });
  
  // CRITICAL ERROR TRACKING: Log if any props are invalid
  if (!Array.isArray(seenTVShows)) {
    console.error('❌ CRITICAL ERROR: seenTVShows prop is not an array!', {
      type: typeof seenTVShows,
      value: seenTVShows,
      mediaType: mediaType
    });
  }
  
  // CRITICAL FIX: Helper functions to get appropriate arrays based on media type
  // This matches the pattern used in Home screen and other components
  // REMOVED: getStorageKey - now handled by EnhancedRatingSystem
  
  const getCurrentSeen = () => {
    console.log(`🎭 getCurrentSeen() called with mediaType: ${mediaType}`);
    
    // CRITICAL FIX: Use the safety-checked arrays
    let result;
    if (mediaType === 'movie') {
      result = safeSeen;
      console.log(`🎭 Using safeSeen array with ${result.length} items`);
    } else {
      result = safeSeenTVShows;
      console.log(`🎭 Using safeSeenTVShows array with ${result.length} items`);
    }
    
    console.log(`🎭 getCurrentSeen() returning array with ${result.length} items:`, result.map(m => m.title || m.name));
    return result;
  };

  const getCurrentUnseen = () => {
    const result = mediaType === 'movie' ? safeUnseen : safeUnseenTVShows;
    console.log(`🎭 getCurrentUnseen() - mediaType: ${mediaType}, array length: ${result.length}`);
    return result;
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
  
  // Rating modal state - DELEGATED TO ENHANCEDRATINGSYSTEM
  const [emotionModalVisible, setEmotionModalVisible] = useState(false);
  const [enhancedRatingModalVisible, setEnhancedRatingModalVisible] = useState(false);
  const [selectedEmotion, setSelectedEmotion] = useState(null);
  const [selectedMovieForRating, setSelectedMovieForRating] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  
  // REMOVED legacy state variables - now handled by EnhancedRatingSystem:
  // - comparisonMovies, currentComparison, comparisonResults, isComparisonComplete, 
  //   comparisonModalVisible, currentMovieRating (all handled by ConfidenceBasedComparison)
  

  // Clear search when media type changes
  useEffect(() => {
    setSearchQuery('');
    setSearchResults([]);
    setUserResults([]);
    setError(null);
  }, [mediaType]);

  // ============================================================================
  // **RATING SYSTEM - FULLY DELEGATED TO ENHANCEDRATINGSYSTEM**
  // ============================================================================
  
  // REMOVED: selectMovieFromPercentile() - now handled by EnhancedRatingSystem
  // REMOVED: handleComparison() - now handled by ConfidenceBasedComparison
  // REMOVED: All manual rating calculations - now handled by processUnifiedRatingFlow
  
  // Handle emotion selection - PURE DELEGATION TO ENHANCEDRATINGSYSTEM
  const handleEmotionSelected = useCallback((emotion) => {
    console.log(`🎭 Delegating to EnhancedRatingSystem: ${selectedMovieForRating?.title} with emotion: ${emotion}`);
    
    setSelectedEmotion(emotion);
    setEmotionModalVisible(false);
    setEnhancedRatingModalVisible(true);
  }, [selectedMovieForRating]);


  // handleComparison removed - now handled by EnhancedRatingSystem

  const handleConfirmRating = useCallback((finalRating) => {
    console.log('✅ Confirming rating:', finalRating, 'for:', selectedMovieForRating?.title);
    
    // EXPLICIT ERROR HANDLING - CODE_BIBLE Commandment #9
    if (!selectedMovieForRating) {
      console.error('❌ handleConfirmRating: No movie selected');
      return;
    }
    if (!finalRating || typeof finalRating !== 'number') {
      console.error('❌ handleConfirmRating: Invalid rating:', finalRating);
      return;
    }
    
    // COMPREHENSIVE DUPLICATE CHECK: Check across both movies and TV shows
    const existingInMovies = safeSeen.find(m => m.id === selectedMovieForRating.id);
    const existingInTVShows = safeSeenTVShows.find(m => m.id === selectedMovieForRating.id);
    const existingMovie = existingInMovies || existingInTVShows;
    
    if (existingMovie && !selectedMovieForRating.alreadyRated) {
      console.warn('⚠️ DUPLICATE PREVENTION: Content already rated but not marked as such!', {
        id: selectedMovieForRating.id,
        title: selectedMovieForRating.title || selectedMovieForRating.name,
        existingRating: existingMovie.userRating,
        existingMediaType: existingMovie.mediaType,
        currentContext: mediaType,
        foundInMovies: !!existingInMovies,
        foundInTVShows: !!existingInTVShows
      });
      
      // Determine if this is a cross-media type issue
      const mediaTypeMismatch = existingMovie.mediaType !== mediaType;
      const alertTitle = mediaTypeMismatch ? "Already Rated in Different Category" : "Already Rated";
      const alertMessage = mediaTypeMismatch 
        ? `"${selectedMovieForRating.title || selectedMovieForRating.name}" is already rated as a ${existingMovie.mediaType} (${existingMovie.userRating.toFixed(1)}/10). Switch to ${existingMovie.mediaType}s tab to re-rate.`
        : `"${selectedMovieForRating.title || selectedMovieForRating.name}" is already rated (${existingMovie.userRating.toFixed(1)}/10). Use Re-rate to update.`;
      
      Alert.alert(alertTitle, alertMessage, [{ text: "OK" }]);
      setEnhancedRatingModalVisible(false);
      setSelectedMovieForRating(null);
      setSelectedEmotion(null);
      return;
    }
    
    // Rating calculated and handled by EnhancedRatingSystem
    console.log('🎯 Final rating received from EnhancedRatingSystem:', finalRating);
    
    // CRITICAL FIX: Use the media_type from the search result, or fall back to current context
    // This ensures TV shows from search results get properly categorized
    const itemMediaType = selectedMovieForRating.media_type || selectedMovieForRating.mediaType || mediaType;
    
    console.log('🔍 MEDIA TYPE DEBUG:', {
      'selectedMovie.media_type': selectedMovieForRating.media_type,
      'selectedMovie.mediaType': selectedMovieForRating.mediaType,
      'context.mediaType': mediaType,
      'final.itemMediaType': itemMediaType,
      'movie.title': selectedMovieForRating.title || selectedMovieForRating.name
    });
    
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
      mediaType: itemMediaType // CRITICAL FIX: Use the determined media type
      // ratingCategory removed - handled by EnhancedRatingSystem
    };
    
    console.log(`🎬 FINAL RATED MOVIE OBJECT: ${ratedMovie.title} - mediaType: ${ratedMovie.mediaType}`);
    
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

    // Note: Rating completion screen is now shown within ComparisonModal (3 second auto-close)
  }, [selectedMovieForRating, onAddToSeen, mediaType]);

  const handleCloseEnhancedModals = useCallback(() => {
    setEnhancedRatingModalVisible(false);
    setEmotionModalVisible(false);
    setSelectedMovieForRating(null);
    setSelectedEmotion(null);
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
      
      // Process movie/TV results with comprehensive watchlist/seen status check
      const processedMovieResults = results.movies.map(item => {
        // Check across both movies and TV shows for duplicates
        const existingInMovies = safeSeen.find(sm => sm.id === item.id);
        const existingInTVShows = safeSeenTVShows.find(sm => sm.id === item.id);
        const existingRated = existingInMovies || existingInTVShows;
        
        return {
          ...item,
          alreadyRated: !!existingRated,
          inWatchlist: getCurrentUnseen().some(um => um.id === item.id),
          currentRating: existingRated?.userRating,
          media_type: item.mediaType || 'movie'
        };
      });
      
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
    <LinearGradient
      colors={Array.isArray(colors.background) ? colors.background : [colors.background, colors.background]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1 }}
    >
      <ThemedHeader mediaType={mediaType} isDarkMode={isDarkMode} theme={theme}>
        <Text style={headerStyles.screenTitle}>
          Add {mediaType === 'movie' ? 'Movies' : 'TV Shows'}
        </Text>
      </ThemedHeader>
      
      <SafeAreaView style={{ 
        flex: 1, 
        backgroundColor: 'transparent', 
        paddingTop: 0,
      }}>
        {/* Search bar */}
        <SearchBar
          mediaType={mediaType}
          colors={colors}
          searchStyles={searchStyles}
          seen={getCurrentSeen()}
          unseen={getCurrentUnseen()}
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
                    // COMPREHENSIVE DUPLICATE CHECK: Check across both media types
                    const existingInMovies = safeSeen.find(m => m.id === item.id);
                    const existingInTVShows = safeSeenTVShows.find(m => m.id === item.id);
                    const existingMovie = existingInMovies || existingInTVShows;

                    if (existingMovie) {
                      console.log('🔄 Re-rating existing content:', item.title || item.name, 'Current rating:', existingMovie.userRating, 'Media type:', existingMovie.mediaType);
                      // ✅ RE-RATING: Skip emotion modal, go straight to comparisons
                      // Pass existing movie data with Bradley-Terry parameters preserved
                      setSelectedMovieForRating({ ...item, ...existingMovie });
                      setSelectedEmotion(null); // No sentiment for re-rating
                      setEmotionModalVisible(false);
                      setEnhancedRatingModalVisible(true); // Go straight to comparison modal
                    } else {
                      console.log('⭐ Rating new content:', item.title || item.name);
                      // NEW RATING: Show emotion modal first
                      setSelectedMovieForRating(item);
                      setEmotionModalVisible(true);
                    }
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
        
      </SafeAreaView>

      {/* **SENTIMENT SELECTION MODAL (Bradley-Terry Simplified)** */}
      <SentimentRatingModal
        visible={emotionModalVisible}
        movie={selectedMovieForRating}
        onSelect={(sentiment) => {
          console.log('🎭 Sentiment selected:', sentiment);
          setSelectedCategory(sentiment);
          setSelectedEmotion(sentiment);
          setEmotionModalVisible(false);
          setEnhancedRatingModalVisible(true);
        }}
        onClose={() => setEmotionModalVisible(false)}
        colors={colors}
      />

      {/* **BRADLEY-TERRY COMPARISON MODAL** */}
      {selectedMovieForRating && (
        <ComparisonModal
          visible={enhancedRatingModalVisible}
          newMovie={selectedMovieForRating}
          sentiment={selectedEmotion}
          ratedMovies={getCurrentSeen()}
          mediaType={mediaType}
          colors={colors}
          onComplete={(updatedMovie) => {
            console.log('✅ BradleyTerry rating complete:', updatedMovie);
            setEnhancedRatingModalVisible(false);
            handleConfirmRating(updatedMovie.userRating);
          }}
          onClose={() => {
            setEnhancedRatingModalVisible(false);
            setSelectedMovieForRating(null);
            setSelectedEmotion(null);
          }}
        />
      )}

      {/* LEGACY COMPARISON MODAL REMOVED - NOW HANDLED BY ConfidenceBasedComparison
          * Removed 200+ lines of duplicate rating logic
          * Removed manual opponent rating updates  
          * Removed local storage management
          * Removed progress indicators and comparison state
          * ALL FUNCTIONALITY DELEGATED TO ENHANCEDRATINGSYSTEM
      */}

    </LinearGradient>
  );
}

// STYLES REMOVED - All modal styles now handled by EnhancedRatingSystem components

export default AddMovieScreen;