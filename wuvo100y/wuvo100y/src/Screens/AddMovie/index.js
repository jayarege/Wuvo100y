import React, { useState, useCallback, useRef, useEffect } from 'react';
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
import { EnhancedRatingButton } from '../../Components/EnhancedRatingSystem';
import { calculateDynamicRatingCategories } from '../../Components/EnhancedRatingSystem';
import { adjustRatingWildcard } from '../../utils/ELOCalculations';
import { 
  isObfuscatedAdultContent, 
  hasSuspiciousAdultStructure, 
  hasObviousAdultTerms, 
  isTrustedContent, 
  filterSearchSuggestions, 
  filterFullSearchResults 
} from '../../utils/ContentFiltering';
import SearchBar from '../../Components/SearchBar';
import MovieSearchResults from '../../Components/MovieSearchResults';

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

function AddMovieScreen({ seen, unseen, onAddToSeen, onAddToUnseen, onRemoveFromWatchlist, onUpdateRating, genres, isDarkMode }) {
  // Use media type context
  const { mediaType } = useMediaType();
  
  // Get all themed styles
  const headerStyles = getHeaderStyles(mediaType, isDarkMode ? 'dark' : 'light', theme);
  const searchStyles = getSearchStyles(mediaType, isDarkMode ? 'dark' : 'light', theme);
  const movieCardStyles = getMovieCardStyles(mediaType, isDarkMode ? 'dark' : 'light', theme);
  const buttonStyles = getButtonStyles(mediaType, isDarkMode ? 'dark' : 'light', theme);

  // Get theme colors for this media type and mode
  const colors = theme[mediaType][isDarkMode ? 'dark' : 'light'];

  // State variables
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
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
  

  // Clear search when media type changes
  useEffect(() => {
    setSearchQuery('');
    setSearchResults([]);
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
    console.log('🎭 SEEN MOVIES COUNT:', seen.length);
    console.log('🎭 SEEN MOVIES:', seen.map(m => `${m.title}: ${m.userRating}`));
    
    setSelectedEmotion(emotion);
    setEmotionModalVisible(false);
    
    // Select first opponent from percentile
    const firstOpponent = selectMovieFromPercentile(seen, emotion);
    if (!firstOpponent) {
      console.log('❌ NO FIRST OPPONENT FOUND');
      Alert.alert(
        '🎬 Need More Ratings', 
        `You need at least 3 rated movies to use this feature.\n\nCurrently you have: ${seen.length} rated movies.\n\nPlease rate a few more movies first!`,
        [{ text: "OK", style: "default" }]
      );
      return;
    }
    
    // Select second and third opponents randomly from all seen movies (for known vs known)
    const remainingMovies = seen.filter(movie => movie.id !== firstOpponent.id);
    
    if (remainingMovies.length < 2) {
      console.log('❌ NOT ENOUGH REMAINING MOVIES');
      Alert.alert(
        '🎬 Need More Ratings', 
        `You need at least 3 rated movies to use this feature.\n\nCurrently you have: ${seen.length} rated movies.\n\nPlease rate a few more movies first!`,
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
  }, [selectedMovieForRating, seen, selectMovieFromPercentile]);


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



  // Enhanced full search with intelligent ranking
  const handleFullSearch = useCallback(async (query = searchQuery) => {
    if (!query || query.trim().length === 0) return;
    
    setLoading(true);
    setError(null);
    setShowSuggestions(false);
    
    try {
      const endpoint = mediaType === 'movie' ? 'search/movie' : 'search/tv';
      
      console.log(`🔍 Full search ${endpoint} for: "${query}"`);
      
      const response = await fetch(
        `https://api.themoviedb.org/3/${endpoint}?api_key=${API_KEY}&language=en-US&query=${encodeURIComponent(query)}&page=1&include_adult=false`
      );
      
      if (!response.ok) {
        throw new Error(`Failed to search for ${mediaType === 'movie' ? 'movies' : 'TV shows'}`);
      }
      
      const data = await response.json();
      console.log(`📺 Full search raw results:`, data.results?.length || 0);
      
      if (data.results && data.results.length > 0) {
        // Use moderate filtering for full search (more permissive)
        const lightlyFiltered = filterFullSearchResults(data.results);
        
        console.log(`🧹 Full search after smart filtering:`, lightlyFiltered.length);
        
        // Log any filtered items for debugging
        const filteredOut = data.results.filter(item => !lightlyFiltered.includes(item));
        if (filteredOut.length > 0) {
          console.log(`🚫 Filtered out from full search:`, filteredOut.map(item => item.title || item.name));
        }
        
        const seenIds = new Set();
        
        const processedResults = lightlyFiltered
          .filter(item => {
            if (!item.poster_path) return false;
            if (seenIds.has(item.id)) return false;
            seenIds.add(item.id);
            return true;
          })
          .map(item => {
            const title = (item.title || item.name || '').toLowerCase();
            const queryLower = query.toLowerCase();
            
            // Same scoring algorithm as suggestions but for full results
            let score = 0;
            
            if (title === queryLower) score += 1000;
            else if (title.startsWith(queryLower)) score += 500;
            else if (title.includes(` ${queryLower} `) || title.includes(`${queryLower} `)) score += 250;
            else if (title.includes(queryLower)) score += 100;
            
            const popularityBoost = Math.log10((item.vote_count || 0) + 1) * 10;
            score += popularityBoost;
            
            const ratingBoost = (item.vote_average || 0) * 2;
            score += ratingBoost;
            
            const year = item.release_date || item.first_air_date;
            if (year) {
              const releaseYear = new Date(year).getFullYear();
              const yearBoost = Math.max(0, (releaseYear - 1990) / 10);
              score += yearBoost;
            }
            
            return {
              id: item.id,
              title: item.title || item.name,
              poster_path: item.poster_path,
              vote_average: item.vote_average,
              vote_count: item.vote_count || 0,
              overview: item.overview || "No overview available",
              release_date: item.release_date || item.first_air_date || 'Unknown',
              genre_ids: item.genre_ids || [],
              alreadyRated: seen.some(sm => sm.id === item.id),
              inWatchlist: unseen.some(um => um.id === item.id),
              currentRating: seen.find(sm => sm.id === item.id)?.userRating,
              searchScore: score
            };
          })
          .sort((a, b) => b.searchScore - a.searchScore);
        
        console.log(`🎯 Full search top results:`, processedResults.slice(0, 5).map(r => `${r.title} (${r.searchScore.toFixed(1)})`));
        
        setSearchResults(processedResults);
      } else {
        console.log(`❌ No full search results for "${query}"`);
        setSearchResults([]);
      }
    } catch (err) {
      console.error('Error searching:', err);
      setError(`Failed to search for ${mediaType === 'movie' ? 'movies' : 'TV shows'}. Please try again.`);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, seen, unseen, mediaType]);

  // Handle selecting a suggestion
  const handleSelectSuggestion = useCallback((suggestion) => {
    handleFullSearch(suggestion.title);
  }, []);

  // Add item to watchlist
  const addToUnseen = useCallback((item) => {
    if (seen.some(m => m.id === item.id)) {
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
  }, [onAddToUnseen, onRemoveFromWatchlist, seen, unseen, mediaType]);



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

        {/* Search results */}
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={{ flex: 1 }}>
            <MovieSearchResults
              searchResults={searchResults}
              colors={colors}
              genres={genres}
              movieCardStyles={movieCardStyles}
              buttonStyles={buttonStyles}
              seen={seen}
              unseen={unseen}
              onAddToUnseen={addToUnseen}
              onRateMovie={(item) => {
                setSelectedMovieForRating(item);
                setEmotionModalVisible(true);
              }}
              mediaType={mediaType}
              loading={loading}
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
          </View>
        </TouchableWithoutFeedback>
        
      </View>

      {/* **EMOTION SELECTION MODAL - EXACT COPY FROM HOME SCREEN** */}
      <Modal visible={emotionModalVisible} transparent animationType="fade">
        <View style={[styles.modalOverlay, { zIndex: 9999 }]}>
          <LinearGradient
            colors={colors.primaryGradient || ['#667eea', '#764ba2']}
            style={[styles.sentimentModalContent]}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              How did you feel about this {mediaType === 'movie' ? 'movie' : 'show'}?
            </Text>
            
            <View style={styles.emotionButtonsContainer}>
              <View style={styles.emotionButtonWrapper}>
                <LinearGradient
                  colors={colors.primaryGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.emotionGradientBorder}
                />
                <TouchableOpacity 
                  style={[styles.emotionButton]}
                  onPress={() => handleEmotionSelected('LOVED')}
                >
                  <Text style={styles.emotionButtonText}>LOVED</Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.emotionButtonWrapper}>
                <LinearGradient
                  colors={colors.primaryGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.emotionGradientBorder}
                />
                <TouchableOpacity 
                  style={[styles.emotionButton]}
                  onPress={() => handleEmotionSelected('LIKED')}
                >
                  <Text style={styles.emotionButtonText}>LIKED</Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.emotionButtonWrapper}>
                <LinearGradient
                  colors={colors.primaryGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.emotionGradientBorder}
                />
                <TouchableOpacity 
                  style={[styles.emotionButton]}
                  onPress={() => handleEmotionSelected('AVERAGE')}
                >
                  <Text style={styles.emotionButtonText}>AVERAGE</Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.emotionButtonWrapper}>
                <LinearGradient
                  colors={colors.primaryGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.emotionGradientBorder}
                />
                <TouchableOpacity 
                  style={[styles.emotionButton]}
                  onPress={() => handleEmotionSelected('DISLIKED')}
                >
                  <Text style={styles.emotionButtonText}>DISLIKED</Text>
                </TouchableOpacity>
              </View>
            </View>
            
            <TouchableOpacity 
              style={[styles.cancelButton, { borderColor: colors.border?.color || '#ccc' }]}
              onPress={() => setEmotionModalVisible(false)}
            >
              <Text style={[styles.cancelButtonText, { color: colors.subText }]}>Cancel</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </Modal>

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
                      // Give a neutral rating based on the selected emotion category
                      const neutralRating = currentMovieRating || 5.0; // Use current rating or default neutral
                      console.log('🤷 Too tough to decide - assigning neutral rating:', neutralRating);
                      console.log('🎯 SETTING finalCalculatedRating BEFORE completion screen (neutral):', neutralRating);
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
  sentimentModalContent: {
    width: '90%',
    maxWidth: 400,
    padding: 24,
    borderRadius: 16,
  },
  emotionButtonsContainer: {
    marginVertical: 20,
  },
  emotionButton: {
    padding: 16,
    borderRadius: 11,
    alignItems: 'center',
    flex: 1,
  },
  emotionButtonWrapper: {
    position: 'relative',
    borderRadius: 12,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  emotionGradientBorder: {
    position: 'absolute',
    top: 1,
    left: 1,
    right: 1,
    bottom: 1,
    borderRadius: 11,
  },
  emotionButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
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
  finalRatingScore: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default AddMovieScreen;