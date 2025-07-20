import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Alert, Image, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

// Import shared ELO calculation utilities
import { calculateKFactor, calculateExpectedWinProbability, calculateRatingFromComparisons, adjustRatingWildcard } from '../utils/ELOCalculations';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Console log to verify file is loading
console.log('✅ EnhancedRatingSystem component loaded successfully!');

// Comparison result constants for type safety
export const ComparisonResults = {
  A_WINS: 'a_wins',
  B_WINS: 'b_wins', 
  TIE: 'too_tough'
};

// Import storage keys to match the main data hook
import { STORAGE_KEYS } from '../config/storageConfig';

// Dynamic storage keys based on media type (matching useMovieData hook)
const getStorageKey = (mediaType) => mediaType === 'movie' ? STORAGE_KEYS.MOVIES.SEEN : STORAGE_KEYS.TV_SHOWS.SEEN;

// **ENHANCED RATING SYSTEM CONFIGURATION**
const ENHANCED_RATING_CONFIG = {
  RATING_BOUNDS: {
    MIN: 1,
    MAX: 10
  },
  
  K_FACTORS: {
    NEW_MOVIE: 40,
    EXPERIENCED: 20,
    THRESHOLD_GAMES: 10
  },
  
  ELO_CONFIG: {
    SCALE_FACTOR: 100,
    DIVISOR: 400,
    TIE_SCORE: 0.5,
    BASE: 10
  },
  
  PERCENTILE_THRESHOLDS: {
    QUARTER: 0.25,
    HALF: 0.50,
    THREE_QUARTER: 0.75
  },
  
  PERCENTILE_RANGES: {
    LOVED: [75, 100],
    LIKED: [50, 74], 
    AVERAGE: [25, 49],
    DISLIKED: [0, 24]
  },
  
  DYNAMIC_PERCENTILE_RANGES: {
    LOVED: [0.0, 0.25],
    LIKED: [0.25, 0.50],
    AVERAGE: [0.50, 0.75],
    DISLIKED: [0.75, 1.0]
  },
  
  COMPARISON_CONFIG: {
    MIN_MOVIES: 3,
    ROUNDS: 3,
    COMPLETION_DELAY: 2500,
    TIE_OFFSET: 0.05
  },
  
  COLORS: {
    LOVED: '#FF0000',
    LIKED: '#4CAF50', 
    AVERAGE: '#FF9800',
    DISLIKED: '#F44336'
  },
  
  BORDER_COLORS: {
    LOVED: '#1B5E20',
    LIKED: '#4CAF50',
    AVERAGE: '#FFC107', 
    DISLIKED: '#D32F2F'
  }
};

// Helper functions for percentile-based calculations
const calculateMidRatingFromPercentile = (userMovies, percentile) => {
  const sortedRatings = userMovies
    .map(m => m.userRating || (m.eloRating / ENHANCED_RATING_CONFIG.ELO_CONFIG.SCALE_FACTOR))
    .filter(rating => rating && !isNaN(rating))
    .sort((a, b) => a - b);

  if (sortedRatings.length === 0) return (ENHANCED_RATING_CONFIG.RATING_BOUNDS.MIN + ENHANCED_RATING_CONFIG.RATING_BOUNDS.MAX) / 2;

  const lowIndex = Math.floor((percentile[0] / ENHANCED_RATING_CONFIG.ELO_CONFIG.SCALE_FACTOR) * sortedRatings.length);
  const highIndex = Math.floor((percentile[1] / ENHANCED_RATING_CONFIG.ELO_CONFIG.SCALE_FACTOR) * sortedRatings.length);
  
  const lowRating = sortedRatings[Math.max(0, lowIndex)] || sortedRatings[0];
  const highRating = sortedRatings[Math.min(highIndex, sortedRatings.length - 1)] || sortedRatings[sortedRatings.length - 1];
  
  return (lowRating + highRating) / 2;
};

const getDefaultRatingForCategory = (categoryKey) => {
  // Calculate dynamic defaults based on rating bounds
  const midpoint = (ENHANCED_RATING_CONFIG.RATING_BOUNDS.MIN + ENHANCED_RATING_CONFIG.RATING_BOUNDS.MAX) / 2;
  const quarterRange = (ENHANCED_RATING_CONFIG.RATING_BOUNDS.MAX - ENHANCED_RATING_CONFIG.RATING_BOUNDS.MIN) / 4;
  
  const defaults = {
    LOVED: midpoint + quarterRange * 1.5,    // ~8.5 for 1-10 range
    LIKED: midpoint + quarterRange * 0.5,     // ~7.0 for 1-10 range  
    AVERAGE: midpoint,                        // ~5.5 for 1-10 range
    DISLIKED: midpoint - quarterRange * 1.5  // ~2.5 for 1-10 range
  };
  
  return defaults[categoryKey] || midpoint;
};

const getRatingRangeFromPercentile = (userMovies, percentile) => {
  const sortedRatings = userMovies
    .map(m => m.userRating || (m.eloRating / ENHANCED_RATING_CONFIG.ELO_CONFIG.SCALE_FACTOR))
    .filter(rating => rating && !isNaN(rating))
    .sort((a, b) => a - b);

  if (sortedRatings.length === 0) return [ENHANCED_RATING_CONFIG.RATING_BOUNDS.MIN, ENHANCED_RATING_CONFIG.RATING_BOUNDS.MAX];

  const lowIndex = Math.floor((percentile[0] / ENHANCED_RATING_CONFIG.ELO_CONFIG.SCALE_FACTOR) * sortedRatings.length);
  const highIndex = Math.floor((percentile[1] / ENHANCED_RATING_CONFIG.ELO_CONFIG.SCALE_FACTOR) * sortedRatings.length);
  
  const lowRating = sortedRatings[Math.max(0, lowIndex)] || sortedRatings[0];
  const highRating = sortedRatings[Math.min(highIndex, sortedRatings.length - 1)] || sortedRatings[sortedRatings.length - 1];
  
  return [lowRating, highRating];
};

// **DYNAMIC PERCENTILE-BASED RATING CATEGORIES**
const calculateDynamicRatingCategories = (userMovies, mediaType = 'movie') => {
  if (!userMovies || userMovies.length === 0) {
    // Fallback to default percentiles if no user data
    return {
      LOVED: { 
        percentile: ENHANCED_RATING_CONFIG.PERCENTILE_RANGES.LOVED, 
        color: ENHANCED_RATING_CONFIG.COLORS.LOVED, 
        borderColor: ENHANCED_RATING_CONFIG.BORDER_COLORS.LOVED, 
        label: 'Love', 
        description: 'This was amazing!' 
      },
      LIKED: { 
        percentile: ENHANCED_RATING_CONFIG.PERCENTILE_RANGES.LIKED, 
        color: ENHANCED_RATING_CONFIG.COLORS.LIKED, 
        borderColor: ENHANCED_RATING_CONFIG.BORDER_COLORS.LIKED, 
        label: 'Like', 
        description: 'Pretty good!' 
      },
      AVERAGE: { 
        percentile: ENHANCED_RATING_CONFIG.PERCENTILE_RANGES.AVERAGE, 
        color: ENHANCED_RATING_CONFIG.COLORS.AVERAGE, 
        borderColor: ENHANCED_RATING_CONFIG.BORDER_COLORS.AVERAGE, 
        label: 'Okay', 
        description: 'Nothing special' 
      },
      DISLIKED: { 
        percentile: ENHANCED_RATING_CONFIG.PERCENTILE_RANGES.DISLIKED, 
        color: ENHANCED_RATING_CONFIG.COLORS.DISLIKED, 
        borderColor: ENHANCED_RATING_CONFIG.BORDER_COLORS.DISLIKED, 
        label: 'Dislike', 
        description: 'Not for me' 
      }
    };
  }

  // Sort user ratings to calculate percentiles, filtered by media type
  const filteredMovies = userMovies.filter(movie => 
    (movie.mediaType || 'movie') === mediaType
  );
  
  const sortedRatings = filteredMovies
    .map(m => m.userRating || (m.eloRating / ENHANCED_RATING_CONFIG.ELO_CONFIG.SCALE_FACTOR))
    .filter(rating => rating && !isNaN(rating))
    .sort((a, b) => a - b);

  if (sortedRatings.length === 0) {
    return calculateDynamicRatingCategories([]);
  }

  // Calculate percentile thresholds
  const get25thPercentile = () => sortedRatings[Math.floor(sortedRatings.length * ENHANCED_RATING_CONFIG.PERCENTILE_THRESHOLDS.QUARTER)] || sortedRatings[0];
  const get50thPercentile = () => sortedRatings[Math.floor(sortedRatings.length * ENHANCED_RATING_CONFIG.PERCENTILE_THRESHOLDS.HALF)] || sortedRatings[0];
  const get75thPercentile = () => sortedRatings[Math.floor(sortedRatings.length * ENHANCED_RATING_CONFIG.PERCENTILE_THRESHOLDS.THREE_QUARTER)] || sortedRatings[0];
  
  const minRating = sortedRatings[0];
  const maxRating = sortedRatings[sortedRatings.length - 1];
  const p25 = get25thPercentile();
  const p50 = get50thPercentile();
  const p75 = get75thPercentile();

  console.log(`📊 Dynamic Rating Ranges - Min: ${minRating}, 25th: ${p25}, 50th: ${p50}, 75th: ${p75}, Max: ${maxRating}`);

  return {
    LOVED: { 
      percentile: ENHANCED_RATING_CONFIG.DYNAMIC_PERCENTILE_RANGES.LOVED,
      color: ENHANCED_RATING_CONFIG.COLORS.LOVED,
      borderColor: ENHANCED_RATING_CONFIG.BORDER_COLORS.LOVED,
      label: 'Love',
      description: 'This was amazing!'
    },
    LIKED: { 
      percentile: ENHANCED_RATING_CONFIG.DYNAMIC_PERCENTILE_RANGES.LIKED,
      color: ENHANCED_RATING_CONFIG.COLORS.LIKED,
      borderColor: ENHANCED_RATING_CONFIG.BORDER_COLORS.LIKED,
      label: 'Like',
      description: 'Pretty good!'
    },
    AVERAGE: { 
      percentile: ENHANCED_RATING_CONFIG.DYNAMIC_PERCENTILE_RANGES.AVERAGE,
      color: ENHANCED_RATING_CONFIG.COLORS.AVERAGE,
      borderColor: ENHANCED_RATING_CONFIG.BORDER_COLORS.AVERAGE,
      label: 'Okay',
      description: 'Nothing special'
    },
    DISLIKED: { 
      percentile: ENHANCED_RATING_CONFIG.DYNAMIC_PERCENTILE_RANGES.DISLIKED,
      color: ENHANCED_RATING_CONFIG.COLORS.DISLIKED,
      borderColor: ENHANCED_RATING_CONFIG.BORDER_COLORS.DISLIKED,
      label: 'Dislike',
      description: 'Not for me'
    }
  };
};

// **UNIFIED RATING ENGINE LOGIC** - Adapted for dynamic percentiles

/**
 * Select movie from percentile range based on sentiment category
 * Adapted from UnifiedRatingEngine to use dynamic percentiles
 */
const selectOpponentFromPercentile = (percentileRange, seenMovies, excludeMovieId = null, mediaType = 'movie') => {
  if (!seenMovies || seenMovies.length === 0) return null;
  if (!percentileRange) return null;
  
  // Get movies sorted by rating, filtered by media type
  const sortedMovies = seenMovies
    .filter(movie => movie.userRating && movie.id !== excludeMovieId)
    .filter(movie => (movie.mediaType || 'movie') === mediaType)
    .sort((a, b) => b.userRating - a.userRating);
  
  if (sortedMovies.length === 0) return null;
  
  // Calculate percentile indices
  const startIndex = Math.floor(percentileRange[0] * sortedMovies.length);
  const endIndex = Math.floor(percentileRange[1] * sortedMovies.length);
  
  // Get movies in percentile range
  const moviesInRange = sortedMovies.slice(startIndex, Math.max(endIndex, startIndex + 1));
  
  if (moviesInRange.length === 0) return sortedMovies[0];
  
  // Return random movie from range
  return moviesInRange[Math.floor(Math.random() * moviesInRange.length)];
};

/**
 * Select random opponent from seen movies
 * Used for rounds 2 and 3 of comparison flow
 */
const selectRandomOpponent = (seenMovies, excludeMovieIds = [], mediaType = 'movie') => {
  if (!seenMovies || seenMovies.length === 0) return null;
  
  const availableMovies = seenMovies.filter(movie => 
    movie.userRating && !excludeMovieIds.includes(movie.id) &&
    (movie.mediaType || 'movie') === mediaType
  );
  
  if (availableMovies.length === 0) return null;
  
  return availableMovies[Math.floor(Math.random() * availableMovies.length)];
};

/**
 * Update opponent movie rating in storage
 * Handles AsyncStorage persistence for opponent rating changes
 */
const updateOpponentRating = async (opponentMovie, newRating, storageKey) => {
  try {
    const storedMovies = await AsyncStorage.getItem(storageKey);
    if (storedMovies) {
      const movies = JSON.parse(storedMovies);
      const movieIndex = movies.findIndex(m => m.id === opponentMovie.id);
      if (movieIndex !== -1) {
        movies[movieIndex] = {
          ...movies[movieIndex],
          userRating: newRating,
          eloRating: Math.round(newRating * 100),
          lastUpdated: new Date().toISOString()
        };
        await AsyncStorage.setItem(storageKey, JSON.stringify(movies));
        console.log(`📊 Updated opponent ${opponentMovie.title}: ${newRating}`);
      }
    }
  } catch (error) {
    console.error('Error updating opponent rating:', error);
  }
};

/**
 * ELO single-game update with draw support
 * @param {number} Ra - Rating of player A
 * @param {number} Rb - Rating of player B  
 * @param {number} Sa - Actual score for A (1 = win, 0.5 = draw, 0 = loss)
 * @param {number} Ka - K-factor for player A
 * @param {number} Kb - K-factor for player B
 * @returns {Array} [newRatingA, newRatingB]
 */
const eloUpdate = (Ra, Rb, Sa, Ka, Kb) => {
  // Input validation
  if (!Ra || !Rb || Sa === undefined || !Ka || !Kb) {
    console.error('Invalid ELO parameters:', { Ra, Rb, Sa, Ka, Kb });
    const fallback = (ENHANCED_RATING_CONFIG.RATING_BOUNDS.MIN + ENHANCED_RATING_CONFIG.RATING_BOUNDS.MAX) / 2;
    return [Ra || fallback, Rb || fallback]; // Safe fallback
  }
  
  const Ea = 1 / (1 + Math.pow(ENHANCED_RATING_CONFIG.ELO_CONFIG.BASE, (Rb - Ra) / ENHANCED_RATING_CONFIG.ELO_CONFIG.DIVISOR));
  const Eb = 1 - Ea;
  
  const newRatingA = Ra + Ka * (Sa - Ea);
  const newRatingB = Rb + Kb * ((1 - Sa) - Eb);
  
  // Apply boundary constraints (1-10 range)
  return [
    Math.max(ENHANCED_RATING_CONFIG.RATING_BOUNDS.MIN, Math.min(ENHANCED_RATING_CONFIG.RATING_BOUNDS.MAX, newRatingA)),
    Math.max(ENHANCED_RATING_CONFIG.RATING_BOUNDS.MIN, Math.min(ENHANCED_RATING_CONFIG.RATING_BOUNDS.MAX, newRatingB))
  ];
};

/**
 * Unified pairwise rating calculation for all rounds
 * Uses ELO calculations for consistent TIE handling
 */
const calculatePairwiseRating = (config) => {
  // Validate config object
  if (!config || typeof config !== 'object') {
    throw new Error('calculatePairwiseRating requires a valid config object');
  }
  
  const { 
    aRating, 
    bRating, 
    aGames = 0, 
    bGames = 0, 
    result
  } = config;
  
  // Validate result parameter
  const validResults = Object.values(ComparisonResults);
  if (!validResults.includes(result)) {
    throw new Error(`Invalid result: ${result}. Must be one of: ${validResults.join(', ')}`);
  }
  
  // Handle Round 1 case where new movie has no rating (always aRating = null)
  if (!aRating && bRating) {
    // New movie A vs existing movie B - direct calculation from comparison
    if (result === ComparisonResults.TIE) {
      // Validate opponent rating exists for tie calculation
      if (bRating == null || isNaN(bRating)) {
        throw new Error('Cannot handle tie without a valid opponent rating');
      }
      
      // For first-round TIE: Start new movie very close to opponent rating
      // Skip complex ELO calculation and use simple approach that maintains high ratings
      const tieOffset = ENHANCED_RATING_CONFIG.COMPARISON_CONFIG.TIE_OFFSET;
      const newMovieRating = Math.max(ENHANCED_RATING_CONFIG.RATING_BOUNDS.MIN, Math.min(ENHANCED_RATING_CONFIG.RATING_BOUNDS.MAX, bRating - tieOffset));
      const opponentNewRating = Math.max(ENHANCED_RATING_CONFIG.RATING_BOUNDS.MIN, Math.min(ENHANCED_RATING_CONFIG.RATING_BOUNDS.MAX, bRating + tieOffset));
      
      return {
        updatedARating: Math.round(newMovieRating * ENHANCED_RATING_CONFIG.ELO_CONFIG.BASE) / ENHANCED_RATING_CONFIG.ELO_CONFIG.BASE,
        updatedBRating: Math.round(opponentNewRating * ENHANCED_RATING_CONFIG.ELO_CONFIG.BASE) / ENHANCED_RATING_CONFIG.ELO_CONFIG.BASE
      };
    }
    
    // Direct calculation: opponent ± 0.5 based on result (ORIGINAL WILDCARD LOGIC)
    const newMovieRating = bRating + (result === ComparisonResults.A_WINS ? ENHANCED_RATING_CONFIG.ELO_CONFIG.TIE_SCORE : -ENHANCED_RATING_CONFIG.ELO_CONFIG.TIE_SCORE);
    return {
      updatedARating: Math.min(ENHANCED_RATING_CONFIG.RATING_BOUNDS.MAX, Math.max(ENHANCED_RATING_CONFIG.RATING_BOUNDS.MIN, newMovieRating)),
      updatedBRating: bRating // B rating unchanged in Round 1
    };
  }
  
  // For Rounds 2-3 or when both movies have ratings
  if (aRating && bRating) {
    // Validate that both ratings exist (should always be true for rounds 2-3)
    if (aRating == null || bRating == null || isNaN(aRating) || isNaN(bRating)) {
      throw new Error('Both movies must have valid ratings for rounds 2-3 calculations');
    }
    
    if (result === ComparisonResults.TIE) {
      // Use proper ELO calculation for draws between established movies
      const Ka = calculateKFactor(aGames) || (aGames < ENHANCED_RATING_CONFIG.K_FACTORS.THRESHOLD_GAMES ? ENHANCED_RATING_CONFIG.K_FACTORS.NEW_MOVIE : ENHANCED_RATING_CONFIG.K_FACTORS.EXPERIENCED);
      const Kb = calculateKFactor(bGames) || (bGames < ENHANCED_RATING_CONFIG.K_FACTORS.THRESHOLD_GAMES ? ENHANCED_RATING_CONFIG.K_FACTORS.NEW_MOVIE : ENHANCED_RATING_CONFIG.K_FACTORS.EXPERIENCED);
      
      const [newA, newB] = eloUpdate(aRating, bRating, ENHANCED_RATING_CONFIG.ELO_CONFIG.TIE_SCORE, Ka, Kb);
      
      return {
        updatedARating: Math.round(newA * ENHANCED_RATING_CONFIG.ELO_CONFIG.BASE) / ENHANCED_RATING_CONFIG.ELO_CONFIG.BASE,
        updatedBRating: Math.round(newB * ENHANCED_RATING_CONFIG.ELO_CONFIG.BASE) / ENHANCED_RATING_CONFIG.ELO_CONFIG.BASE
      };
    }
    
    // Use ELO calculation for known vs known (ORIGINAL WILDCARD LOGIC)
    const aWon = result === ComparisonResults.A_WINS;
    const eloResult = adjustRatingWildcard(
      aWon ? aRating : bRating,
      aWon ? bRating : aRating,
      true,
      aWon ? aGames : bGames,
      aWon ? bGames : aGames
    );
    
    return {
      updatedARating: aWon ? eloResult.updatedSeenContent : eloResult.updatedNewContent,
      updatedBRating: aWon ? eloResult.updatedNewContent : eloResult.updatedSeenContent
    };
  }
  
  // Edge case: should not happen in normal flow
  throw new Error('Invalid pairwise rating configuration: both movies missing ratings');
};

/**
 * Main 3-round comparison flow orchestrator
 * Integrates dynamic sentiment with original Wildcard logic
 */
const processUnifiedRatingFlow = async (config) => {
  const {
    newMovie,
    selectedCategory,
    seenMovies,
    mediaType = 'movie', // Default to movie for backward compatibility
    onComparisonStart,
    onComparisonResult,
    onFinalRating,
    onError
  } = config;

  try {
    // Validate inputs
    if (!newMovie || !selectedCategory || !seenMovies) {
      throw new Error('Missing required parameters for rating flow');
    }

    if (seenMovies.length < ENHANCED_RATING_CONFIG.COMPARISON_CONFIG.MIN_MOVIES) {
      throw new Error(`Need at least ${ENHANCED_RATING_CONFIG.COMPARISON_CONFIG.MIN_MOVIES} rated movies for comparison system`);
    }

    console.log(`🎬 Starting unified rating flow for: ${newMovie.title}`);
    console.log(`🎭 User sentiment: ${selectedCategory}`);

    // Get dynamic categories and percentile for selected sentiment
    const categories = calculateDynamicRatingCategories(seenMovies, mediaType);
    const selectedCategoryData = categories[selectedCategory];
    const percentileRange = selectedCategoryData.percentile;

    // Round 1: Unknown vs Known (sentiment-based opponent using dynamic percentiles)
    const round1Opponent = selectOpponentFromPercentile(percentileRange, seenMovies, newMovie.id, mediaType);
    if (!round1Opponent) {
      throw new Error('No suitable opponent found for sentiment-based comparison');
    }

    let currentRating = null;
    let comparisonHistory = [];
    let usedOpponentIds = [round1Opponent.id];

    // Start comparison flow
    if (onComparisonStart) {
      onComparisonStart({
        round: 1,
        opponent: round1Opponent,
        totalRounds: 3,
        sentiment: selectedCategory,
        sentimentData: selectedCategoryData
      });
    }

    // Process each round
    for (let round = 1; round <= 3; round++) {
      let opponent;
      
      if (round === 1) {
        opponent = round1Opponent;
      } else {
        // Rounds 2-3: Random opponents (original Wildcard logic)
        opponent = selectRandomOpponent(seenMovies, [...usedOpponentIds, newMovie.id], mediaType);
        if (!opponent) {
          console.log(`⚠️ No more opponents available for round ${round}`);
          break;
        }
        usedOpponentIds.push(opponent.id);
      }

      // Wait for user's comparison choice
      const userChoice = await new Promise((resolve) => {
        if (onComparisonResult) {
          onComparisonResult({
            round,
            newMovie,
            opponent,
            onChoice: resolve,
            onTooTough: () => resolve('too_tough')
          });
        }
      });

      // Process the comparison result
      if (userChoice === 'too_tough') {
        // Handle "Too Tough to Decide" - use unified pairwise calculation
        const opponentRating = opponent.userRating; // Should always exist (opponent was pre-validated)
        const currentMovieRating = currentRating; // Should always exist after Round 1
        
        const pairwiseResult = calculatePairwiseRating({
          aRating: currentRating, // New movie
          bRating: opponentRating, // Opponent movie
          aGames: round - 1, // Games played so far by new movie
          bGames: opponent.gamesPlayed || 0,
          result: ComparisonResults.TIE
        });
        
        currentRating = pairwiseResult.updatedARating;
        const newOpponentRating = pairwiseResult.updatedBRating;
        
        // Update opponent rating in storage
        await updateOpponentRating(opponent, newOpponentRating, getStorageKey(mediaType));
        
        // Keep in-memory seenMovies in sync
        opponent.userRating = newOpponentRating;
        opponent.eloRating = Math.round(newOpponentRating * 100);
        opponent.lastUpdated = new Date().toISOString();
        
        console.log(`🤷 Too tough to decide - current: ${currentRating}, opponent: ${newOpponentRating}`);
        
        // Record the neutral outcome
        comparisonHistory.push({
          round,
          opponent: opponent.title,
          result: 'neutral',
          ratingChange: currentRating - currentMovieRating
        });
        
        // Continue to next round instead of breaking early
        
      } else {
        // Regular win/loss outcome - use unified pairwise calculation
        const newMovieWon = userChoice === 'new';
        const opponentRating = opponent.userRating; // Should always exist (opponent was pre-validated)
        const previousRating = currentRating;
        
        const pairwiseResult = calculatePairwiseRating({
          aRating: currentRating, // New movie
          bRating: opponentRating, // Opponent movie
          aGames: round - 1, // Games played so far by new movie
          bGames: opponent.gamesPlayed || 0,
          result: newMovieWon ? ComparisonResults.A_WINS : ComparisonResults.B_WINS
        });
        
        currentRating = pairwiseResult.updatedARating;
        const newOpponentRating = pairwiseResult.updatedBRating;
        
        // Update opponent rating in storage (only if it changed)
        if (newOpponentRating !== opponentRating) {
          await updateOpponentRating(opponent, newOpponentRating, getStorageKey(mediaType));
          
          // Keep in-memory seenMovies in sync
          opponent.userRating = newOpponentRating;
          opponent.eloRating = Math.round(newOpponentRating * 100);
          opponent.lastUpdated = new Date().toISOString();
        }
        
        console.log(`⚡ Round ${round}: ${previousRating} → ${currentRating} (vs ${opponent.title})`);
        
        // Record comparison result
        comparisonHistory.push({
          round,
          opponent: opponent.title,
          result: newMovieWon ? 'win' : 'loss',
          ratingBefore: round === 1 ? null : currentRating,
          ratingAfter: currentRating,
          opponentRating
        });
      }
    }

    // Final rating callback
    if (onFinalRating && currentRating !== null) {
      onFinalRating({
        finalRating: currentRating,
        comparisonHistory,
        gamesPlayed: comparisonHistory.length, // Actual number of comparisons performed
        method: 'unified_enhanced_rating_engine',
        sentiment: selectedCategory,
        sentimentData: selectedCategoryData
      });
    }

    return {
      success: true,
      finalRating: currentRating,
      comparisonHistory,
      sentiment: selectedCategory
    };

  } catch (error) {
    console.error('Unified Enhanced Rating Engine Error:', error);
    if (onError) {
      onError(error);
    }
    return {
      success: false,
      error: error.message
    };
  }
};

// Movie comparison engine
const MovieComparisonEngine = {
  getMoviesInPercentileRange(userMovies, targetPercentile, excludeMovieId) {
    if (!userMovies || userMovies.length === 0) return [];
    
    const sortedMovies = [...userMovies]
      .filter(movie => movie.id !== excludeMovieId && movie.userRating)
      .sort((a, b) => b.userRating - a.userRating);
    
    if (sortedMovies.length === 0) return [];
    
    const totalMovies = sortedMovies.length;
    const startIndex = Math.floor((targetPercentile[0] / 100) * totalMovies);
    const endIndex = Math.ceil((targetPercentile[1] / 100) * totalMovies);
    
    return sortedMovies.slice(startIndex, Math.min(endIndex, totalMovies));
  },

  calculateComparisonScore(movie, newMovie, genres) {
    let score = 0;
    
    // Genre similarity (highest weight)
    const newMovieGenres = new Set(newMovie.genre_ids || []);
    const movieGenres = new Set(movie.genre_ids || []);
    const genreIntersection = [...newMovieGenres].filter(g => movieGenres.has(g));
    score += (genreIntersection.length / Math.max(newMovieGenres.size, 1)) * 40;
    
    // Release year proximity (medium weight)
    const newYear = new Date(newMovie.release_date || '2000').getFullYear();
    const movieYear = new Date(movie.release_date || '2000').getFullYear();
    const yearDiff = Math.abs(newYear - movieYear);
    score += Math.max(0, 20 - yearDiff) * 0.5;
    
    // Rating proximity within category (low weight)
    const ratingDiff = Math.abs((newMovie.suggestedRating || 7) - movie.userRating);
    score += Math.max(0, 10 - ratingDiff * 2);
    
    return score;
  },

  findBestComparison(categoryMovies, newMovie, genres) {
    if (categoryMovies.length === 0) return null;
    
    const scoredMovies = categoryMovies.map(movie => ({
      ...movie,
      comparisonScore: this.calculateComparisonScore(movie, newMovie, genres)
    }));
    
    return scoredMovies.sort((a, b) => b.comparisonScore - a.comparisonScore)[0];
  }
};

// **THREE-COMPARISON SYSTEM LIKE WILDCARD**
const WildcardComparison = ({ 
  visible, 
  newMovie, 
  comparisonMovies, 
  category, 
  onClose, 
  onComparisonComplete,
  colors,
  genres,
  userMovies 
}) => {
  const [currentComparison, setCurrentComparison] = useState(0);
  const [comparisonResults, setComparisonResults] = useState([]);
  const [isComplete, setIsComplete] = useState(false);

  const RATING_CATEGORIES = calculateDynamicRatingCategories(userMovies);
  const categoryInfo = RATING_CATEGORIES[category];

  const handleComparison = useCallback((winner) => {
    const currentComparisonMovie = comparisonMovies[currentComparison];
    const result = {
      comparison: currentComparison + 1,
      winner: winner === 'new' ? newMovie : currentComparisonMovie,
      loser: winner === 'new' ? currentComparisonMovie : newMovie,
      userChoice: winner
    };

    const newResults = [...comparisonResults, result];
    setComparisonResults(newResults);

    if (currentComparison < 2) {
      // Move to next comparison
      setCurrentComparison(currentComparison + 1);
    } else {
      // All comparisons complete
      setIsComplete(true);
      
      // Calculate final rating based on comparison results
      const newMovieWins = newResults.filter(r => r.userChoice === 'new').length;
      const finalRating = calculateRatingFromComparisons(newMovieWins, newResults, newMovie);
      
      console.log(`🎯 Comparison Complete: ${newMovieWins}/3 wins, Final Rating: ${finalRating}`);
      
      // Show results for 2 seconds, then complete with calculated rating
      setTimeout(() => {
        onComparisonComplete(finalRating);
      }, 2500);
    }
  }, [currentComparison, comparisonResults, comparisonMovies, newMovie, categoryInfo, onComparisonComplete]);


  const resetComparison = () => {
    setCurrentComparison(0);
    setComparisonResults([]);
    setIsComplete(false);
  };

  useEffect(() => {
    if (visible) {
      resetComparison();
    }
  }, [visible]);

  if (!visible || !comparisonMovies || comparisonMovies.length < 3) return null;

  const currentComparisonMovie = comparisonMovies[currentComparison];

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <LinearGradient
          colors={colors.primaryGradient || ['#667eea', '#764ba2']}
          style={[styles.comparisonModalContent]}
        >
          {!isComplete ? (
            <>
              <View style={styles.comparisonHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  Comparison {currentComparison + 1}/3
                </Text>
                <Text style={[styles.comparisonSubtitle, { color: colors.subText }]}>
                  Which one do you prefer?
                </Text>
              </View>
              
              <View style={styles.moviesComparison}>
                {/* New Movie */}
                <TouchableOpacity 
                  style={[styles.movieComparisonCard, styles.wildcardStyleCard]}
                  onPress={() => handleComparison('new')}
                  activeOpacity={0.8}
                >
                  <View style={styles.posterContainer}>
                    <Image
                      source={{ uri: `https://image.tmdb.org/t/p/w500${newMovie?.poster_path}` }}
                      style={styles.comparisonPoster}
                      resizeMode="cover"
                    />
                    <View style={[styles.newMovieBadge, { backgroundColor: colors.accent }]}>
                      <Text style={styles.newMovieText}>NEW</Text>
                    </View>
                  </View>
                  <Text style={[styles.movieCardName, { color: colors.text }]} numberOfLines={2}>
                    {newMovie?.title || newMovie?.name}
                  </Text>
                  <Text style={[styles.movieCardYear, { color: colors.subText }]}>
                    {newMovie?.release_date ? new Date(newMovie.release_date).getFullYear() : 'N/A'}
                  </Text>
                  <Text style={[styles.categoryBadge, { color: categoryInfo?.color }]}>
                    {categoryInfo?.label}
                  </Text>
                </TouchableOpacity>
                
                {/* VS Indicator - Wildcard Style */}
                <View style={styles.vsIndicatorWildcard}>
                  <View style={[styles.vsCircle, { borderColor: colors.accent }]}>
                    <Text style={[styles.vsText, { color: colors.accent }]}>VS</Text>
                  </View>
                  <Text style={[styles.comparisonCountText, { color: colors.subText }]}>
                    {currentComparison + 1} of 3
                  </Text>
                </View>
                
                {/* Comparison Movie */}
                <TouchableOpacity 
                  style={[styles.movieComparisonCard, styles.wildcardStyleCard]}
                  onPress={() => handleComparison('comparison')}
                  activeOpacity={0.8}
                >
                  <View style={styles.posterContainer}>
                    <Image
                      source={{ uri: `https://image.tmdb.org/t/p/w500${currentComparisonMovie?.poster_path}` }}
                      style={styles.comparisonPoster}
                      resizeMode="cover"
                    />
                  </View>
                  <Text style={[styles.movieCardName, { color: colors.text }]} numberOfLines={2}>
                    {currentComparisonMovie?.title || currentComparisonMovie?.name}
                  </Text>
                  <Text style={[styles.movieCardYear, { color: colors.subText }]}>
                    {currentComparisonMovie?.release_date ? new Date(currentComparisonMovie.release_date).getFullYear() : 'N/A'}
                  </Text>
                  <View style={[styles.ratingBadgeWildcard, { backgroundColor: categoryInfo?.color }]}>
                    <Ionicons name="star" size={12} color="#FFF" />
                    <Text style={styles.ratingTextWildcard}>
                      {currentComparisonMovie?.userRating?.toFixed(1)}
                    </Text>
                  </View>
                </TouchableOpacity>
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
            </>
          ) : (
            // Completion Screen - Wildcard Style with calculated rating preview
            <View style={styles.completionScreen}>
              <View style={[styles.completionHeader, { borderBottomColor: colors.border?.color || '#333' }]}>
                <Text style={[styles.completionTitle, { color: colors.text }]}>
                  Rating Calculated!
                </Text>
                <View style={[styles.winsBadge, { backgroundColor: colors.accent }]}>
                  <Text style={styles.winsText}>
                    {comparisonResults.filter(r => r.userChoice === 'new').length}/3 Wins
                  </Text>
                </View>
                
                {/* Show calculated rating preview */}
                <View style={[styles.ratingPreview, { borderColor: categoryInfo?.color }]}>
                  <Text style={[styles.ratingPreviewLabel, { color: colors.subText }]}>Calculated Rating:</Text>
                  <View style={styles.ratingPreviewValue}>
                    <Ionicons name="star" size={16} color={categoryInfo?.color} />
                    <Text style={[styles.ratingPreviewText, { color: categoryInfo?.color }]}>
                      {calculateRatingFromComparisons(
                        comparisonResults.filter(r => r.userChoice === 'new').length,
                        comparisonResults,
                        newMovie
                      ).toFixed(1)}/10
                    </Text>
                  </View>
                </View>
              </View>
              
              <View style={styles.resultsContainer}>
                <Text style={[styles.resultsHeader, { color: colors.text }]}>How it performed:</Text>
                {comparisonResults.map((result, index) => (
                  <View key={index} style={[styles.resultRowWildcard, { borderLeftColor: result.userChoice === 'new' ? '#4CAF50' : '#F44336' }]}>
                    <View style={styles.resultContent}>
                      <Text style={[styles.resultNumber, { color: colors.accent }]}>
                        #{result.comparison}
                      </Text>
                      <Text style={[styles.resultText, { color: colors.text }]}>
                        vs {result.loser.title || result.loser.name}
                      </Text>
                      <View style={[styles.resultBadge, { backgroundColor: result.userChoice === 'new' ? '#4CAF50' : '#F44336' }]}>
                        <Text style={styles.resultBadgeText}>
                          {result.userChoice === 'new' ? 'WON' : 'LOST'}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
                
                <View style={[styles.performanceSummary, { backgroundColor: colors.card || 'rgba(255,255,255,0.05)' }]}>
                  <Text style={[styles.performanceSummaryText, { color: colors.subText }]}>
                    Performance vs similar {categoryInfo?.label.toLowerCase()} movies: 
                    <Text style={{ color: categoryInfo?.color, fontWeight: 'bold' }}>
                      {comparisonResults.filter(r => r.userChoice === 'new').length > 1.5 ? 'Above Average' : 'Below Average'}
                    </Text>
                  </Text>
                </View>
              </View>
            </View>
          )}
          
          <TouchableOpacity 
            style={[styles.cancelButton, { borderColor: colors.border?.color || '#ccc' }]}
            onPress={onClose}
          >
            <Text style={[styles.cancelButtonText, { color: colors.subText }]}>
              {isComplete ? 'Close' : 'Cancel'}
            </Text>
          </TouchableOpacity>
        </LinearGradient>
      </View>
    </Modal>
  );
};

// Sentiment Rating Modal Component  
const SentimentRatingModal = ({ visible, movie, onClose, onRatingSelect, colors, userMovies }) => {
  const [selectedCategory, setSelectedCategory] = useState(null);

  // Calculate dynamic categories based on user's rating history
  const RATING_CATEGORIES = calculateDynamicRatingCategories(userMovies);

  const handleCategorySelect = useCallback((categoryKey) => {
    console.log('🎭 User selected sentiment:', categoryKey);
    setSelectedCategory(categoryKey);
    
    const category = RATING_CATEGORIES[categoryKey];
    // Calculate mid-rating based on percentile position (default to dynamic midpoint for new users)
    const midRating = userMovies && userMovies.length > 0 ? 
      calculateMidRatingFromPercentile(userMovies, category.percentile) : 
      getDefaultRatingForCategory(categoryKey);
    
    const movieWithRating = { ...movie, suggestedRating: midRating };
    onRatingSelect(movieWithRating, categoryKey, midRating);
  }, [movie, onRatingSelect, RATING_CATEGORIES, userMovies]);

  const renderSentimentButton = (categoryKey) => {
    const category = RATING_CATEGORIES[categoryKey];
    const isSelected = selectedCategory === categoryKey;
    
    return (
      <View key={categoryKey} style={styles.sentimentButtonWrapper}>
        <LinearGradient
          colors={['rgba(255,255,255,0.1)', 'rgba(246,238,255,0.1)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.gradientBorder,
            { opacity: isSelected ? 0.3 : 0.1 }
          ]}
        />
        <TouchableOpacity
          style={[
            styles.sentimentButton,
            { 
              backgroundColor: `${category.color}15`,
              borderColor: category.color,
              borderWidth: 1.5,
              margin: 2,
              borderRadius: 10,
            }
          ]}
          onPress={() => handleCategorySelect(categoryKey)}
          activeOpacity={0.8}
        >
          <Text style={[
            styles.sentimentLabel,
            { color: colors.text }
          ]}>
            {category.label}
          </Text>
          <Text style={[
            styles.sentimentDescription,
            { color: colors.textSecondary || 'rgba(255,255,255,0.6)' }
          ]}>
            {category.description}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={[styles.sentimentModalContent, { backgroundColor: colors.card }]}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>
            How did you feel about
          </Text>
          <Text style={[styles.movieTitle, { color: colors.accent }]}>
            {movie?.title || movie?.name}?
          </Text>
          
          <View style={styles.sentimentGrid}>
            {Object.keys(RATING_CATEGORIES).map(renderSentimentButton)}
          </View>
          
          <TouchableOpacity 
            style={[styles.cancelButton, { borderColor: colors.border?.color || '#ccc' }]}
            onPress={onClose}
          >
            <Text style={[styles.cancelButtonText, { color: colors.subText }]}>
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// **SINGLE UNIFIED ENHANCED RATING BUTTON COMPONENT**
const EnhancedRatingButton = ({ 
  movie, 
  seen, 
  onAddToSeen, 
  onUpdateRating,
  colors,
  buttonStyles,
  modalStyles,
  genres,
  mediaType,
  size = 'medium', // 'small', 'medium', 'large'
  variant = 'default', // 'default', 'compact', 'icon-only'
  onSuccess, // Callback when rating is completed
  showRatingValue = false // Show current rating on button
}) => {
  console.log('🎬 EnhancedRatingButton rendering for:', movie?.title);
  
  const [sentimentModalVisible, setSentimentModalVisible] = useState(false);
  const [comparisonModalVisible, setComparisonModalVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [suggestedRating, setSuggestedRating] = useState(null);
  const [comparisonMovies, setComparisonMovies] = useState([]);

  const isAlreadyRated = useMemo(() => {
    return seen?.some(item => item.id === movie?.id) || false;
  }, [seen, movie?.id]);

  const currentRating = useMemo(() => {
    const ratedMovie = seen?.find(item => item.id === movie?.id);
    return ratedMovie?.userRating || null;
  }, [seen, movie?.id]);

  const handleRateButtonPress = useCallback(() => {
    console.log('📱 Rate button pressed for:', movie?.title);
    if (!movie) return;
    setSentimentModalVisible(true);
  }, [movie]);

  const handleSentimentSelect = useCallback((movieWithRating, categoryKey, rating) => {
    console.log('🎭 Sentiment selected:', categoryKey, 'Rating:', rating);
    setSelectedCategory(categoryKey);
    setSuggestedRating(rating);
    setSentimentModalVisible(false);
    
    // Calculate dynamic categories based on user's rating history
    const RATING_CATEGORIES = calculateDynamicRatingCategories(seen);
    const categoryInfo = RATING_CATEGORIES[categoryKey];
    
    // Find movies in the same percentile range for comparison
    const categoryMovies = MovieComparisonEngine.getMoviesInPercentileRange(
      seen,
      categoryInfo.percentile,
      movie.id
    );
    
    // Always route through Wildcard UI for 3 comparisons if enough movies exist 
    if (categoryMovies.length >= 3) {
      // Get best 3 comparison movies
      const scoredMovies = categoryMovies.map(m => ({
        ...m,
        comparisonScore: MovieComparisonEngine.calculateComparisonScore(m, movieWithRating, genres)
      }));
      
      const bestComparisons = scoredMovies
        .sort((a, b) => b.comparisonScore - a.comparisonScore)
        .slice(0, 3);
      
      setComparisonMovies(bestComparisons);
      setComparisonModalVisible(true);
      return;
    }
    
    // Not enough movies for comparison, use category average but still show in wildcard-style UI
    const categoryAverage = calculateMidRatingFromPercentile(seen, categoryInfo.percentile);
    // Create mock comparison movies if needed to demonstrate the flow
    const mockComparisons = seen.slice(0, 3).map(m => ({ ...m, comparisonScore: 50 }));
    if (mockComparisons.length >= 3) {
      setComparisonMovies(mockComparisons);
      setComparisonModalVisible(true);
    } else {
      handleConfirmRating(categoryAverage);
    }
  }, [seen, movie, genres]);

  const handleComparisonComplete = useCallback((finalRating) => {
    console.log('✅ Comparison complete, final rating:', finalRating);
    setComparisonModalVisible(false);
    handleConfirmRating(finalRating);
  }, []);

  const handleConfirmRating = useCallback((finalRating) => {
    console.log('✅ Confirming rating:', finalRating, 'for:', movie?.title);
    if (!movie || !finalRating) return;
    
    // Create movie item with Wildcard-style ELO integration
    const newItem = {
      ...movie,
      userRating: finalRating,
      eloRating: finalRating * 100, // Convert to ELO scale (100-1000)
      comparisonHistory: [],
      comparisonWins: 0, // Will be updated by comparison system
      gamesPlayed: (movie.gamesPlayed || 0) + (comparisonMovies.length > 0 ? 3 : 0), // Track comparison games
      mediaType: mediaType,
      ratingCategory: selectedCategory,
      ratingMethod: 'enhanced_comparison' // Mark as using enhanced system
    };
    
    if (isAlreadyRated) {
      onUpdateRating(movie.id, finalRating);
    } else {
      onAddToSeen(newItem);
    }
    
    // Reset state
    setSelectedCategory(null);
    setSuggestedRating(null);
    setComparisonMovies([]);
    
    // Call success callback if provided
    if (onSuccess) {
      onSuccess(finalRating, movie);
    }
    
    const RATING_CATEGORIES = calculateDynamicRatingCategories(seen);
    const categoryLabel = RATING_CATEGORIES[selectedCategory]?.label || 'rated';
    
    Alert.alert(
      `Rating Complete!`, 
      `You ${categoryLabel.toLowerCase()} "${movie.title}" (${finalRating.toFixed(1)}/10)\n\nCalculated through ${comparisonMovies.length > 0 ? '3 movie comparisons' : 'category average'}`,
      [
        {
          text: "Perfect!",
          onPress: () => {
            console.log('🏠 Enhanced rating completed, returning to app');
          }
        }
      ]
    );
  }, [movie, selectedCategory, isAlreadyRated, onUpdateRating, onAddToSeen, mediaType, seen, comparisonMovies]);

  const handleCloseModals = useCallback(() => {
    console.log('🚫 Closing modals');
    setSentimentModalVisible(false);
    setComparisonModalVisible(false);
    setSelectedCategory(null);
    setSuggestedRating(null);
    setComparisonMovies([]);
  }, []);

  // Dynamic button styles based on size and variant
  const getButtonStyles = () => {
    const baseStyle = {
      flexDirection: variant === 'icon-only' ? 'column' : 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: size === 'small' ? 6 : size === 'large' ? 12 : 8,
      borderWidth: 1,
      borderColor: colors.accent,
      backgroundColor: isAlreadyRated ? (colors.secondary || colors.primary) : colors.primary,
    };

    // Size-based padding
    if (size === 'small') {
      baseStyle.paddingVertical = 4;
      baseStyle.paddingHorizontal = variant === 'icon-only' ? 6 : 8;
    } else if (size === 'large') {
      baseStyle.paddingVertical = 12;
      baseStyle.paddingHorizontal = variant === 'icon-only' ? 16 : 20;
    } else {
      baseStyle.paddingVertical = 8;
      baseStyle.paddingHorizontal = variant === 'icon-only' ? 12 : 16;
    }

    // Variant-based adjustments
    if (variant === 'compact') {
      baseStyle.paddingVertical = Math.max(4, baseStyle.paddingVertical - 2);
      baseStyle.paddingHorizontal = Math.max(6, baseStyle.paddingHorizontal - 2);
    }

    return baseStyle;
  };

  const getIconSize = () => {
    if (size === 'small') return 12;
    if (size === 'large') return 20;
    return 16;
  };

  const getTextSize = () => {
    if (size === 'small') return 12;
    if (size === 'large') return 16;
    return 14;
  };

  const getButtonText = () => {
    if (variant === 'icon-only') return '';
    if (isAlreadyRated) {
      if (showRatingValue && currentRating) {
        return variant === 'compact' ? `${currentRating.toFixed(1)}★` : `${currentRating.toFixed(1)}/10`;
      }
      return variant === 'compact' ? 'Edit' : 'Update Rating';
    }
    return variant === 'compact' ? 'Rate' : 'Rate';
  };

  return (
    <>
      <TouchableOpacity
        style={[
          buttonStyles?.primaryButton || styles.defaultButton,
          styles.enhancedRateButton,
          getButtonStyles()
        ]}
        onPress={handleRateButtonPress}
        activeOpacity={0.8}
      >
        <Ionicons 
          name={isAlreadyRated ? "star" : "star-outline"} 
          size={getIconSize()} 
          color={colors.accent} 
        />
        {variant !== 'icon-only' && (
          <Text style={[
            buttonStyles?.primaryButtonText || styles.defaultButtonText,
            styles.enhancedRateButtonText,
            { 
              color: colors.accent,
              fontSize: getTextSize(),
              marginLeft: variant === 'compact' ? 4 : 6,
              marginTop: 0
            }
          ]}>
            {getButtonText()}
          </Text>
        )}
        {variant === 'icon-only' && showRatingValue && currentRating && (
          <Text style={[
            styles.iconOnlyRatingText,
            { 
              color: colors.accent,
              fontSize: size === 'small' ? 8 : size === 'large' ? 12 : 10
            }
          ]}>
            {currentRating.toFixed(1)}
          </Text>
        )}
      </TouchableOpacity>

      <SentimentRatingModal
        visible={sentimentModalVisible}
        movie={movie}
        onClose={handleCloseModals}
        onRatingSelect={handleSentimentSelect}
        colors={colors}
        userMovies={seen}
      />

      <WildcardComparison
        visible={comparisonModalVisible}
        newMovie={movie}
        comparisonMovies={comparisonMovies}
        category={selectedCategory}
        onClose={handleCloseModals}
        onComparisonComplete={handleComparisonComplete}
        colors={colors}
        genres={genres}
        userMovies={seen}
      />
    </>
  );
};

// Styles
const styles = StyleSheet.create({
  // Enhanced Rate Button
  enhancedRateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
  },
  enhancedRateButtonText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '600',
  },
  iconOnlyRatingText: {
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 2,
  },
  defaultButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  defaultButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },

  // Modal Overlays
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Sentiment Modal
  sentimentModalContent: {
    width: '90%',
    maxWidth: 400,
    padding: 24,
    borderRadius: 16,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  movieTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 24,
  },
  sentimentGrid: {
    gap: 12,
    marginBottom: 24,
    maxHeight: 400,
  },
  sentimentButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 6,
    minHeight: 80,
  },
  sentimentLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  sentimentDescription: {
    fontSize: 12,
    textAlign: 'center',
  },

  // Comparison Modal
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
  movieCard: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  movieCardTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
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
  
  // **Wildcard-Style Comparison Cards**
  wildcardStyleCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  posterContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  movieComparisonCard: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 8,
  },
  comparisonPoster: {
    width: 120,
    height: 180,
    borderRadius: 8,
  },
  newMovieBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 8,
    elevation: 2,
  },
  newMovieText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  categoryBadge: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },

  // **Enhanced VS Indicator**
  vsIndicatorWildcard: {
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
  },
  vsCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  comparisonCountText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  ratingBadgeWildcard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginTop: 8,
  },
  ratingTextWildcard: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 12,
    marginLeft: 4,
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
  // **Enhanced Completion Screen**
  completionScreen: {
    paddingVertical: 20,
  },
  completionHeader: {
    alignItems: 'center',
    paddingBottom: 16,
    borderBottomWidth: 1,
    marginBottom: 16,
  },
  completionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  winsBadge: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 16,
  },
  winsText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  resultsContainer: {
    width: '100%',
  },
  resultsHeader: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  resultRowWildcard: {
    marginVertical: 6,
    borderLeftWidth: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  resultContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  resultNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    width: 30,
  },
  resultText: {
    flex: 1,
    fontSize: 14,
    marginLeft: 8,
  },
  resultBadge: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  resultBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  
  // **Rating Preview & Performance Summary**
  ratingPreview: {
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
  },
  ratingPreviewLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  ratingPreviewValue: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingPreviewText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  performanceSummary: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  performanceSummaryText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },

  // Action Buttons
  actionButtons: {
    gap: 12,
  },
  confirmButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  adjustButton: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  adjustButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Cancel Button
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
  gradientBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  sentimentButtonWrapper: {
    position: 'relative',
    borderRadius: 12,
    marginBottom: 6,
  },
});

// Quick Rating Button for Home Screen Cards
const QuickRatingButton = ({ 
  movie, 
  seen, 
  onAddToSeen, 
  onUpdateRating,
  colors,
  onSuccess
}) => {
  return (
    <EnhancedRatingButton
      movie={movie}
      seen={seen}
      onAddToSeen={onAddToSeen}
      onUpdateRating={onUpdateRating}
      colors={colors}
      size="small"
      variant="icon-only"
      showRatingValue={true}
      onSuccess={onSuccess}
    />
  );
};

// Compact Rating Button for Lists
const CompactRatingButton = ({ 
  movie, 
  seen, 
  onAddToSeen, 
  onUpdateRating,
  colors,
  onSuccess
}) => {
  return (
    <EnhancedRatingButton
      movie={movie}
      seen={seen}
      onAddToSeen={onAddToSeen}
      onUpdateRating={onUpdateRating}
      colors={colors}
      size="small"
      variant="compact"
      showRatingValue={true}
      onSuccess={onSuccess}
    />
  );
};

// Helper function to get rating category for a movie
const getRatingCategory = (rating, userMovies) => {
  if (!rating) return null;
  
  // ALWAYS use dynamic categories - no hardcoded thresholds
  const categories = calculateDynamicRatingCategories(userMovies || []);
  
  if (!userMovies || userMovies.length === 0) {
    // For new users, use configuration-based fallback (no hardcoded values)
    const midpoint = (ENHANCED_RATING_CONFIG.RATING_BOUNDS.MIN + ENHANCED_RATING_CONFIG.RATING_BOUNDS.MAX) / 2;
    const quarterRange = (ENHANCED_RATING_CONFIG.RATING_BOUNDS.MAX - ENHANCED_RATING_CONFIG.RATING_BOUNDS.MIN) / 4;
    
    if (rating >= midpoint + quarterRange) return { key: 'LOVED', ...categories.LOVED };
    if (rating >= midpoint) return { key: 'LIKED', ...categories.LIKED };
    if (rating >= midpoint - quarterRange) return { key: 'AVERAGE', ...categories.AVERAGE };
    return { key: 'DISLIKED', ...categories.DISLIKED };
  }
  
  const sortedRatings = userMovies
    .map(m => m.userRating || (m.eloRating / ENHANCED_RATING_CONFIG.ELO_CONFIG.SCALE_FACTOR))
    .filter(r => r && !isNaN(r))
    .sort((a, b) => a - b);
  
  // Find rating's percentile position
  const position = sortedRatings.findIndex(r => r >= rating);
  const percentile = position === -1 ? 100 : (position / sortedRatings.length) * 100;
  
  for (const [key, category] of Object.entries(categories)) {
    if (percentile >= category.percentile[0] && percentile <= category.percentile[1]) {
      return { key, ...category };
    }
  }
  
  return null;
};

export { 
  EnhancedRatingButton, 
  QuickRatingButton, 
  CompactRatingButton, 
  SentimentRatingModal,
  getRatingCategory, 
  calculateDynamicRatingCategories,
  processUnifiedRatingFlow,
  calculatePairwiseRating
};