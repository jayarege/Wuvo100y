import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Alert, Image, Dimensions, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MovieCard from './MovieCard';

// Console log to verify file is loading
console.log('✅ Enhanced Confidence-Based Rating System loaded successfully!');

// Import storage keys to match the main data hook
import { STORAGE_KEYS } from '../config/storageConfig';

// Dynamic storage keys based on media type (matching useMovieData hook)
const getStorageKey = (mediaType) => mediaType === 'movie' ? STORAGE_KEYS.MOVIES.SEEN : STORAGE_KEYS.TV_SHOWS.SEEN;


// **ENHANCED RATING SYSTEM CONFIGURATION**
const ENHANCED_RATING_CONFIG = {
  RATING_BOUNDS: {
    MIN: 1,
    MAX: 10,
    INITIAL_ELO: 1500 // Standard ELO baseline
  },
  CONFIDENCE: {
    TARGET_INTERVAL_WIDTH: 0.6, // Stop when 95% CI width < 0.6 points (85% confidence target)
    MIN_COMPARISONS: 3, // Minimum comparisons required before checking confidence
    MAX_COMPARISONS: 5, // Maximum comparisons (3-5 dynamic range)
    CONFIDENCE_LEVEL: 0.95, // 95% confidence intervals
    INITIAL_UNCERTAINTY: 2.0, // Initial rating standard deviation
    // Dynamic round termination thresholds (85% confidence = ±0.6 points)
    CONFIDENCE_GOOD: 0.6, // 85% confidence threshold for early stop
    CONFIDENCE_EXCELLENT: 0.4, // Excellent confidence for immediate stop
    RATING_STABILITY_THRESHOLD: 0.2 // Consider stable if rating changes < 0.2
  },
  K_FACTORS: {
    HIGH_UNCERTAINTY: 64, // Large changes when uncertain
    MEDIUM_UNCERTAINTY: 32, // Medium changes
    LOW_UNCERTAINTY: 16, // Small changes when confident
    MINIMUM: 8 // Minimum K-factor
  },
  ELO_CONFIG: {
    SCALE_FACTOR: 10, // ELO to 10-point scale conversion
    BASE: 10, // Base for probability calculations
    DIVISOR: 400, // Standard ELO divisor
    TIE_SCORE: 0.5
  },
  PERCENTILE_RANGES: {
    LOVED: [0.0, 0.25], // Top 0-25% (highest rated movies)
    LIKED: [0.25, 0.50], // 25-50% (upper-middle movies)
    AVERAGE: [0.50, 0.75], // 50-75% (lower-middle movies)
    DISLIKED: [0.75, 1.0] // 75-100% (lowest rated movies)
  },
  // Sentiment-aware starting baselines (consultant's good idea)
  SENTIMENT_BASELINES: {
    LOVED: { idealRange: [7.5, 9.5], fallback: 8.5 },
    LIKED: { idealRange: [6.0, 8.0], fallback: 7.0 },
    AVERAGE: { idealRange: [4.5, 6.5], fallback: 5.5 },
    DISLIKED: { idealRange: [1.5, 4.5], fallback: 3.0 }
  },
  DYNAMIC_PERCENTILE_RANGES: {
    LOVED: [0.0, 0.25], // Top 0-25% (highest rated movies)
    LIKED: [0.25, 0.50], // 25-50% (upper-middle movies)
    AVERAGE: [0.50, 0.75], // 50-75% (lower-middle movies)
    DISLIKED: [0.75, 1.0] // 75-100% (lowest rated movies)
  },
  PERCENTILE_THRESHOLDS: {
    QUARTER: 0.25,
    HALF: 0.5,
    THREE_QUARTER: 0.75
  },
  COMPARISON_CONFIG: {
    MIN_MOVIES: 3
  },
  ADAPTIVE_ELO: {
    TARGET_OFFSET: 0.8, // How much higher/lower to target after win/loss
    SEARCH_RANGES: [0.3, 0.6, 1.0, 1.5], // Expanding search radius for opponents
    DEFAULT_RATING_FALLBACK: 5.5 // Default rating when no rating available
  },
  COLORS: {
    LOVED: '#FF0000',
    LIKED: '#4CAF50',
    AVERAGE: '#FF9800',
    DISLIKED: '#F44336',
    CONFIDENCE_HIGH: '#4CAF50',
    CONFIDENCE_MEDIUM: '#FF9800',
    CONFIDENCE_LOW: '#F44336'
  },
  BORDER_COLORS: {
    LOVED: '#FF4444',
    LIKED: '#66BB6A',
    AVERAGE: '#FFB74D',
    DISLIKED: '#EF5350'
  }
};

// **CONFIDENCE-BASED RATING SYSTEM CONFIGURATION** (alias for backward compatibility)
const CONFIDENCE_RATING_CONFIG = ENHANCED_RATING_CONFIG;

// **COMPARISON RESULT TYPES**
export const ComparisonResults = {
  A_WINS: 'a_wins',
  B_WINS: 'b_wins',
  TIE: 'too_tough'
};

// **STATISTICAL CONFIDENCE CALCULATIONS**

/**
 * Calculate confidence interval for ELO rating using standard error
 * Based on statistical theory for pairwise comparison systems
 */
const calculateConfidenceInterval = (rating, standardError, confidenceLevel = 0.95) => {
  // Z-score for 95% confidence = 1.96, 99% confidence = 2.576
  const zScore = confidenceLevel === 0.95 ? 1.96 : 2.576;
  const margin = zScore * standardError;
  
  return {
    lowerBound: Math.max(CONFIDENCE_RATING_CONFIG.RATING_BOUNDS.MIN, rating - margin),
    upperBound: Math.min(CONFIDENCE_RATING_CONFIG.RATING_BOUNDS.MAX, rating + margin),
    width: 2 * margin,
    confidenceLevel
  };
};

/**
 * Calculate standard error based on number of comparisons and rating variance
 * Uses Bayesian approach for uncertainty estimation
 */
const calculateStandardError = (comparisons, wins, losses, ties = 0) => {
  if (comparisons === 0) return CONFIDENCE_RATING_CONFIG.CONFIDENCE.INITIAL_UNCERTAINTY;
  
  // Bayesian standard error calculation
  const totalGames = wins + losses + ties;
  const winRate = (wins + ties * 0.5) / totalGames;
  
  // Wilson score interval for binomial confidence
  const n = totalGames;
  const p = winRate;
  const variance = (p * (1 - p)) / n;
  
  // Convert to rating scale standard error (uses /4 for variance scaling, not probability)
  const ratingVariance = variance * Math.pow(CONFIDENCE_RATING_CONFIG.ELO_CONFIG.SCALE_FACTOR / 4, 2);
  
  return Math.sqrt(ratingVariance / 100); // Scale to 1-10 rating system
};

/**
 * Dynamic K-factor based on confidence level
 * Higher uncertainty = higher K-factor for faster convergence
 */
const calculateDynamicKFactor = (standardError, comparisons) => {
  const baseK = CONFIDENCE_RATING_CONFIG.K_FACTORS.MINIMUM;
  
  if (standardError > 1.0 || comparisons < 5) {
    return CONFIDENCE_RATING_CONFIG.K_FACTORS.HIGH_UNCERTAINTY;
  } else if (standardError > 0.5 || comparisons < 10) {
    return CONFIDENCE_RATING_CONFIG.K_FACTORS.MEDIUM_UNCERTAINTY;
  } else {
    return CONFIDENCE_RATING_CONFIG.K_FACTORS.LOW_UNCERTAINTY;
  }
};

/**
 * ADAPTIVE OPPONENT SELECTION - INFORMATION THEORY BASED
 * Selects opponents that maximize information gain for rating confidence
 */

/**
 * Calculate expected information gain from comparing against an opponent
 * Higher information gain = better opponent choice
 */
const calculateInformationGain = (currentRating, currentStandardError, opponentRating, opponentStandardError) => {
  // Expected win probability using ELO formula
  const ratingDiff = opponentRating - currentRating;
  const expectedWinProb = 1 / (1 + Math.pow(CONFIDENCE_RATING_CONFIG.ELO_CONFIG.BASE, ratingDiff / CONFIDENCE_RATING_CONFIG.ELO_CONFIG.SCALE_FACTOR));
  
  // Information gain is maximized when outcome is most uncertain (p=0.5)
  // Also consider opponent's rating reliability
  const outcomeUncertainty = 4 * expectedWinProb * (1 - expectedWinProb); // Max at p=0.5
  const opponentReliability = 1 / (1 + opponentStandardError); // More reliable opponents give more info
  
  return outcomeUncertainty * opponentReliability;
};

/**
 * Select optimal opponent for maximum information gain
 * Balances rating similarity with opponent reliability
 */
const selectOptimalOpponent = (currentRating, currentStandardError, availableOpponents, excludeIds = []) => {
  const validOpponents = availableOpponents.filter(movie => 
    movie.userRating && 
    !excludeIds.includes(movie.id) &&
    movie.ratingStats && // Must have confidence statistics
    movie.ratingStats.standardError !== undefined
  );
  
  if (validOpponents.length === 0) {
    // Fallback to random selection if no confidence stats available
    const fallbackOpponents = availableOpponents.filter(movie => 
      movie.userRating && !excludeIds.includes(movie.id)
    );
    return fallbackOpponents[Math.floor(Math.random() * fallbackOpponents.length)] || null;
  }
  
  // Calculate information gain for each opponent
  const opponentsWithGain = validOpponents.map(opponent => ({
    ...opponent,
    informationGain: calculateInformationGain(
      currentRating, currentStandardError,
      opponent.userRating, opponent.ratingStats.standardError
    )
  }));
  
  // Sort by information gain (descending) and add some randomness
  opponentsWithGain.sort((a, b) => b.informationGain - a.informationGain);
  
  // Select from top 3 opponents with some randomness to avoid always picking the same opponent
  const topOpponents = opponentsWithGain.slice(0, Math.min(3, opponentsWithGain.length));
  return topOpponents[Math.floor(Math.random() * topOpponents.length)];
};

/**
 * Initial opponent selection based on sentiment percentile
 * Used for the first comparison when we have no rating yet
 */
const selectInitialOpponent = (sentiment, availableMovies, excludeIds = []) => {
  console.log('🎯 selectInitialOpponent called:', { sentiment, movieCount: availableMovies.length, excludeIds });
  
  const percentileRange = ENHANCED_RATING_CONFIG.PERCENTILE_RANGES[sentiment];
  console.log('📊 Percentile range for', sentiment, ':', percentileRange);
  
  if (!percentileRange || !availableMovies.length) {
    console.log('❌ Early return: no percentile range or no movies');
    return null;
  }
  
  // Sort movies by rating
  const sortedMovies = availableMovies
    .filter(movie => movie.userRating && !excludeIds.includes(movie.id))
    .sort((a, b) => b.userRating - a.userRating);
  
  console.log('🎬 Movies with userRating:', sortedMovies.length);
  console.log('🎬 Sample movies:', sortedMovies.slice(0, 3).map(m => `${m.title}: ${m.userRating}`));
  
  if (sortedMovies.length === 0) {
    console.log('❌ No movies with userRating found after filtering');
    return null;
  }
  
  // Get movies in sentiment percentile range
  const startIndex = Math.floor(percentileRange[0] * sortedMovies.length);
  const endIndex = Math.floor(percentileRange[1] * sortedMovies.length);
  const moviesInRange = sortedMovies.slice(startIndex, Math.max(endIndex, startIndex + 1));
  
  console.log('🎯 Percentile indices:', { startIndex, endIndex, moviesInRange: moviesInRange.length });
  console.log('🎯 Selected opponent candidates:', moviesInRange.map(m => `${m.title}: ${m.userRating}`));
  console.log('🎯 ALL sorted movies for percentile debug:', sortedMovies.map(m => `${m.title}: ${m.userRating}`));
  console.log('🎯 Sentiment:', sentiment, '- Expected percentile range:', percentileRange, '- Actual indices:', startIndex, 'to', endIndex);
  
  const selectedOpponent = moviesInRange[Math.floor(Math.random() * moviesInRange.length)] || sortedMovies[0];
  console.log('✅ Final selected opponent:', selectedOpponent ? `${selectedOpponent.title}: ${selectedOpponent.userRating}` : 'None');
  
  return selectedOpponent;
};

/**
 * CONFIDENCE-BASED RATING ENGINE
 * Replaces fixed 3-comparison system with adaptive confidence-based approach
 */

/**
 * Update movie rating using ELO with confidence tracking
 */
const updateRatingWithConfidence = (movieStats, opponentRating, result, opponentStats = null) => {
  const currentRating = movieStats.rating || (CONFIDENCE_RATING_CONFIG.RATING_BOUNDS.MIN + CONFIDENCE_RATING_CONFIG.RATING_BOUNDS.MAX) / 2;
  const currentStandardError = movieStats.standardError || CONFIDENCE_RATING_CONFIG.CONFIDENCE.INITIAL_UNCERTAINTY;
  
  // Calculate expected win probability
  const ratingDiff = opponentRating - currentRating;
  const expectedWinProb = 1 / (1 + Math.pow(CONFIDENCE_RATING_CONFIG.ELO_CONFIG.BASE, ratingDiff / CONFIDENCE_RATING_CONFIG.ELO_CONFIG.SCALE_FACTOR));
  
  // Determine actual score
  let actualScore;
  if (result === ComparisonResults.A_WINS) actualScore = 1.0;
  else if (result === ComparisonResults.B_WINS) actualScore = 0.0;
  else actualScore = CONFIDENCE_RATING_CONFIG.ELO_CONFIG.TIE_SCORE;
  
  // Dynamic K-factor based on current confidence
  const kFactor = calculateDynamicKFactor(currentStandardError, movieStats.comparisons || 0);
  
  // Update rating using ELO formula
  const ratingChange = (kFactor / 100) * (actualScore - expectedWinProb);
  const newRating = Math.max(
    CONFIDENCE_RATING_CONFIG.RATING_BOUNDS.MIN,
    Math.min(CONFIDENCE_RATING_CONFIG.RATING_BOUNDS.MAX, currentRating + ratingChange)
  );
  
  // Update comparison statistics
  const newComparisons = (movieStats.comparisons || 0) + 1;
  const newWins = (movieStats.wins || 0) + (actualScore === 1.0 ? 1 : 0);
  const newLosses = (movieStats.losses || 0) + (actualScore === 0.0 ? 1 : 0);
  const newTies = (movieStats.ties || 0) + (actualScore === 0.5 ? 1 : 0);
  
  // Calculate new standard error
  const newStandardError = calculateStandardError(newComparisons, newWins, newLosses, newTies);
  
  // Calculate confidence interval
  const confidenceInterval = calculateConfidenceInterval(newRating, newStandardError);
  
  return {
    rating: newRating,
    standardError: newStandardError,
    comparisons: newComparisons,
    wins: newWins,
    losses: newLosses,
    ties: newTies,
    confidenceInterval,
    lastUpdated: new Date().toISOString()
  };
};

/**
 * Determine if rating has sufficient confidence to stop comparisons
 */
const hasTargetConfidence = (ratingStats) => {
  if (!ratingStats || !ratingStats.confidenceInterval) return false;
  
  const comparisons = ratingStats.comparisons || 0;
  const intervalWidth = ratingStats.confidenceInterval.width;
  
  // Must meet minimum comparisons AND have narrow enough confidence interval
  return comparisons >= CONFIDENCE_RATING_CONFIG.CONFIDENCE.MIN_COMPARISONS &&
         intervalWidth <= CONFIDENCE_RATING_CONFIG.CONFIDENCE.TARGET_INTERVAL_WIDTH;
};

/**
 * Main confidence-based rating flow
 * Continues comparisons until statistical confidence is achieved
 */
const processConfidenceBasedRating = async (config) => {
  const {
    newMovie,
    selectedSentiment,
    availableMovies,
    mediaType = 'movie',
    onComparisonStart,
    onComparisonResult,
    onConfidenceUpdate,
    onFinalRating,
    onError
  } = config;
  
  try {
    console.log(`🎬 Starting confidence-based rating for: ${newMovie.title}`);
    console.log(`🎭 User sentiment: ${selectedSentiment}`);
    
    // Initialize movie statistics
    let movieStats = {
      rating: Math.max(1, Math.min(10, newMovie?.suggestedRating ?? 7.0)),
      standardError: CONFIDENCE_RATING_CONFIG.CONFIDENCE.INITIAL_UNCERTAINTY,
      comparisons: 0,
      wins: 0,
      losses: 0,
      ties: 0,
      confidenceInterval: null
    };
    
    let comparisonHistory = [];
    let usedOpponentIds = [];
    let comparisonCount = 0;
    
    // Continue comparisons until confidence target is met
    while (comparisonCount < CONFIDENCE_RATING_CONFIG.CONFIDENCE.MAX_COMPARISONS && 
           !hasTargetConfidence(movieStats)) {
      
      comparisonCount++;
      
      // Select optimal opponent
      let opponent;
      if (movieStats.rating === null) {
        // First comparison: use sentiment-based selection
        opponent = selectInitialOpponent(selectedSentiment, availableMovies, [...usedOpponentIds, newMovie.id]);
      } else {
        // Subsequent comparisons: use information-gain-based selection
        opponent = selectOptimalOpponent(
          movieStats.rating, movieStats.standardError,
          availableMovies, [...usedOpponentIds, newMovie.id]
        );
      }
      
      if (!opponent) {
        console.log(`⚠️ No more opponents available after ${comparisonCount - 1} comparisons`);
        break;
      }
      
      usedOpponentIds.push(opponent.id);
      
      // Notify UI of comparison start
      if (onComparisonStart) {
        onComparisonStart({
          comparison: comparisonCount,
          opponent,
          currentConfidence: movieStats.confidenceInterval ? movieStats.confidenceInterval.width : 'Unknown',
          targetConfidence: CONFIDENCE_RATING_CONFIG.CONFIDENCE.TARGET_INTERVAL_WIDTH
        });
      }
      
      // Wait for user's comparison choice
      const userChoice = await new Promise((resolve) => {
        if (onComparisonResult) {
          onComparisonResult({
            comparison: comparisonCount,
            newMovie,
            opponent,
            onChoice: resolve,
            onTooTough: () => resolve('too_tough')
          });
        }
      });
      
      // Process comparison result
      let result;
      if (userChoice === 'too_tough') {
        result = ComparisonResults.TIE;
      } else if (userChoice === 'new') {
        result = ComparisonResults.A_WINS;
      } else {
        result = ComparisonResults.B_WINS;
      }
      
      // Update movie statistics
      const previousStats = { ...movieStats };
      movieStats = updateRatingWithConfidence(movieStats, opponent.userRating, result, opponent.ratingStats);
      
      // Record comparison in history
      comparisonHistory.push({
        comparison: comparisonCount,
        opponent: opponent.title,
        result: userChoice,
        ratingBefore: previousStats.rating,
        ratingAfter: movieStats.rating,
        confidenceInterval: movieStats.confidenceInterval,
        informationGain: movieStats.rating !== null ? calculateInformationGain(
          previousStats.rating || 5.5, previousStats.standardError,
          opponent.userRating, opponent.ratingStats?.standardError || 1.0
        ) : null
      });
      
      // Update opponent's statistics as well (if they have stats)
      if (opponent.ratingStats) {
        const opponentResult = result === ComparisonResults.A_WINS ? 
          ComparisonResults.B_WINS : 
          result === ComparisonResults.B_WINS ? 
          ComparisonResults.A_WINS : 
          ComparisonResults.TIE;
        
        const updatedOpponentStats = updateRatingWithConfidence(
          opponent.ratingStats, movieStats.rating, opponentResult, movieStats
        );
        
        // Update opponent in storage
        await updateOpponentInStorage(opponent, updatedOpponentStats, mediaType);
      }
      
      // Notify UI of confidence update
      if (onConfidenceUpdate) {
        onConfidenceUpdate({
          comparison: comparisonCount,
          currentRating: movieStats.rating,
          confidenceInterval: movieStats.confidenceInterval,
          targetReached: hasTargetConfidence(movieStats)
        });
      }
      
      console.log(`📊 Comparison ${comparisonCount}: Rating ${movieStats.rating?.toFixed(2)} ± ${movieStats.confidenceInterval?.width?.toFixed(2)}`);
    }
    
    // Final rating callback
    if (onFinalRating && movieStats.rating !== null) {
      onFinalRating({
        finalRating: movieStats.rating,
        ratingStats: movieStats,
        comparisonHistory,
        method: 'confidence_based_rating_engine',
        sentiment: selectedSentiment,
        targetConfidenceReached: hasTargetConfidence(movieStats)
      });
    }
    
    return {
      success: true,
      finalRating: movieStats.rating,
      ratingStats: movieStats,
      comparisonHistory,
      targetConfidenceReached: hasTargetConfidence(movieStats)
    };
    
  } catch (error) {
    console.error('Confidence-Based Rating Engine Error:', error);
    if (onError) {
      onError(error);
    }
    return { success: false, error: error.message };
  }
};

/**
 * Update opponent movie's statistics in storage
 */
const updateOpponentInStorage = async (opponent, newStats, mediaType) => {
  try {
    const storageKey = getStorageKey(mediaType);
    const storedMovies = await AsyncStorage.getItem(storageKey);
    if (storedMovies) {
      const movies = JSON.parse(storedMovies);
      const movieIndex = movies.findIndex(m => m.id === opponent.id);
      if (movieIndex !== -1) {
        movies[movieIndex] = {
          ...movies[movieIndex],
          userRating: newStats.rating,
          ratingStats: newStats
        };
        await AsyncStorage.setItem(storageKey, JSON.stringify(movies));
        console.log(`📊 Updated opponent ${opponent.title}: ${newStats.rating?.toFixed(2)} ± ${newStats.confidenceInterval?.width?.toFixed(2)}`);
      }
    }
  } catch (error) {
    console.error('Error updating opponent statistics:', error);
  }
};

/**
 * Calculate mid-rating from percentile range
 */
const calculateMidRatingFromPercentile = (userMovies, percentileRange) => {
  if (!userMovies || userMovies.length === 0) return 7.0; // Default fallback
  
  const sortedRatings = userMovies
    .filter(m => m.userRating)
    .map(m => m.userRating || (m.eloRating / ENHANCED_RATING_CONFIG.ELO_CONFIG.SCALE_FACTOR))
    .sort((a, b) => b - a);
  
  if (sortedRatings.length === 0) return 7.0;
  
  // Get midpoint of percentile range
  const midPercentile = (percentileRange[0] + percentileRange[1]) / 2;
  const index = Math.floor(midPercentile * sortedRatings.length);
  
  return sortedRatings[Math.min(index, sortedRatings.length - 1)] || 7.0;
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
  
  const sortedMovies = filteredMovies
    .filter(m => m.userRating || m.eloRating)
    .map(m => ({
      ...m,
      rating: m.userRating || (m.eloRating / ENHANCED_RATING_CONFIG.ELO_CONFIG.SCALE_FACTOR)
    }))
    .filter(m => m.rating && !isNaN(m.rating))
    .sort((a, b) => a.rating - b.rating);
    
  if (sortedMovies.length === 0) {
    return calculateDynamicRatingCategories([]);
  }
  
  // Get unique ratings to check for edge cases
  const uniqueRatings = [...new Set(sortedMovies.map(m => m.rating))].sort((a, b) => a - b);
  const minRating = uniqueRatings[0];
  const maxRating = uniqueRatings[uniqueRatings.length - 1];
  
  let p25, p50, p75;
  
  // EDGE CASE HANDLING: Check if we have enough rating diversity
  if (uniqueRatings.length < 4 || sortedMovies.length < 4) {
    // Not enough diversity - use simple midpoint split
    console.log(`⚠️ Edge case detected: Only ${uniqueRatings.length} unique ratings among ${sortedMovies.length} movies`);
    console.log(`⚠️ Using fallback: simple midpoint split instead of percentiles`);
    
    const midpoint = Math.round((minRating + maxRating) / 2 * 10) / 10;
    
    // For extreme narrow ranges, adjust the split
    if (maxRating - minRating < 1.0) {
      // Ultra narrow range (like 8.8-9.2)
      p25 = minRating;
      p50 = Math.round((minRating + maxRating) / 2 * 10) / 10;
      p75 = maxRating;
    } else {
      // Simple binary split for limited data
      p25 = midpoint;
      p50 = midpoint;
      p75 = midpoint;
    }
    
    console.log(`📊 Fallback Ranges - Min: ${minRating}, Mid: ${midpoint}, Max: ${maxRating}`);
  } else {
    // NORMAL CASE: Use positional percentiles based on actual movie distribution
    const p25Index = Math.floor(sortedMovies.length * 0.25);
    const p50Index = Math.floor(sortedMovies.length * 0.50);
    const p75Index = Math.floor(sortedMovies.length * 0.75);
    
    // Get the ratings at those positions
    p25 = Math.round(sortedMovies[p25Index].rating * 10) / 10;
    p50 = Math.round(sortedMovies[p50Index].rating * 10) / 10;
    p75 = Math.round(sortedMovies[p75Index].rating * 10) / 10;
    
    // Ensure percentiles are distinct (handle clustered ratings)
    if (p25 === p50) p50 = Math.min(p25 + 0.1, p75);
    if (p50 === p75) p75 = Math.min(p50 + 0.1, maxRating);
    
    // console.log(`📊 True Percentile Ranges based on movie positions:`);
    // console.log(`   Bottom 25% (${p25Index + 1} movies): ${minRating} - ${p25}`);
    // console.log(`   25-50% (${p50Index - p25Index} movies): ${p25} - ${p50}`);
    // console.log(`   50-75% (${p75Index - p50Index} movies): ${p50} - ${p75}`);
    // console.log(`   Top 25% (${sortedMovies.length - p75Index} movies): ${p75} - ${maxRating}`);
  }
  
  // console.log(`🎯 LOVE will select from: ${p75}-${maxRating} (your top-rated movies)`);
  // console.log(`🎯 LIKE will select from: ${p50}-${p75} (your above-average movies)`);
  // console.log(`🎯 OKAY will select from: ${p25}-${p50} (your below-average movies)`);
  // console.log(`🎯 DISLIKE will select from: ${minRating}-${p25} (your lowest-rated movies)`);
  
  // Use rating-based ranges (not movie pooling percentiles)
  // For your ratings 6.2-9.7: Love gets 8.825-9.7 (top 25% of rating spread)
  return {
    LOVED: {
      ratingRange: [p75, maxRating], // Top 25% of rating range
      minRating: p75,
      maxRating: maxRating,
      color: ENHANCED_RATING_CONFIG.COLORS.LOVED,
      borderColor: ENHANCED_RATING_CONFIG.BORDER_COLORS.LOVED,
      label: 'Love',
      description: 'This was amazing!'
    },
    LIKED: {
      ratingRange: [p50, p75], // 50-75% of rating range
      minRating: p50,
      maxRating: p75,
      color: ENHANCED_RATING_CONFIG.COLORS.LIKED,
      borderColor: ENHANCED_RATING_CONFIG.BORDER_COLORS.LIKED,
      label: 'Like',
      description: 'Pretty good!'
    },
    AVERAGE: {
      ratingRange: [p25, p50], // 25-50% of rating range
      minRating: p25,
      maxRating: p50,
      color: ENHANCED_RATING_CONFIG.COLORS.AVERAGE,
      borderColor: ENHANCED_RATING_CONFIG.BORDER_COLORS.AVERAGE,
      label: 'Okay',
      description: 'Nothing special'
    },
    DISLIKED: {
      ratingRange: [minRating, p25], // Bottom 25% of rating range
      minRating: minRating,
      maxRating: p25,
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
 * Uses dynamic percentiles for opponent selection
 */
// **WORKING POSITIONAL PERCENTILE LOGIC** (copied from selectMovieFromPercentileUnified)
const selectOpponentFromPercentile = (emotion, seenMovies, excludeMovieId = null, mediaType = 'movie', enhancedLogging = true) => {
  const percentileRanges = ENHANCED_RATING_CONFIG.PERCENTILE_RANGES;
  
  if (!seenMovies || seenMovies.length === 0) {
    if (enhancedLogging) console.log('🚨 No seen movies available');
    return null;
  }
  
  // Apply media type filtering
  let filteredMovies = seenMovies;
  if (mediaType) {
    filteredMovies = seenMovies.filter(movie => 
      movie.userRating && 
      movie.id !== excludeMovieId && 
      (movie.mediaType || 'movie') === mediaType
    );
  } else {
    // Standard filtering without media type
    filteredMovies = seenMovies.filter(movie => movie.userRating && movie.id !== excludeMovieId);
  }
  
  if (filteredMovies.length === 0) {
    console.log('❌ No available movies after filtering');
    return null;
  }
  
  // Sort movies by rating to establish percentile ranges (HIGH to LOW for correct percentiles)
  const sortedMovies = [...filteredMovies].sort((a, b) => (b.userRating || 0) - (a.userRating || 0));
  
  const [minPercent, maxPercent] = percentileRanges[emotion] || [0.5, 0.75];
  const startIndex = Math.floor(sortedMovies.length * minPercent);
  const endIndex = Math.min(Math.floor(sortedMovies.length * maxPercent), sortedMovies.length - 1);
  
  if (enhancedLogging) {
    console.log(`🎯 ${emotion} percentile [${minPercent}-${maxPercent}]: indices ${startIndex}-${endIndex}`);
    console.log(`🎯 Sorted movies (high to low): ${sortedMovies.map(m => `${m.title}(${m.userRating})`).join(', ')}`);
  }
  
  const percentileMovies = sortedMovies.slice(startIndex, endIndex + 1);
  
  if (percentileMovies.length === 0) {
    // Adjacent bucket fallback - never skip more than one bucket
    const adjacentBuckets = getAdjacentBuckets(emotion);
    
    for (const adjacentEmotion of adjacentBuckets) {
      const adjacentRange = percentileRanges[adjacentEmotion];
      const adjStartIndex = Math.floor(sortedMovies.length * adjacentRange[0]);
      const adjEndIndex = Math.min(Math.floor(sortedMovies.length * adjacentRange[1]), sortedMovies.length - 1);
      const adjacentMovies = sortedMovies.slice(adjStartIndex, adjEndIndex + 1);
      
      if (adjacentMovies.length > 0) {
        if (enhancedLogging) {
          console.log(`🔄 Fallback to adjacent bucket ${adjacentEmotion}: ${adjacentMovies[0].title} (Rating: ${adjacentMovies[0].userRating})`);
        }
        return adjacentMovies[Math.floor(Math.random() * adjacentMovies.length)];
      }
    }
    
    // Final fallback if no adjacent buckets have movies
    return sortedMovies[0];
  }
  
  // Random selection from percentile
  const selectedMovie = percentileMovies[Math.floor(Math.random() * percentileMovies.length)];
  
  if (enhancedLogging) {
    console.log(`🎬 Selected from ${emotion} percentile: ${selectedMovie.title} (Rating: ${selectedMovie.userRating})`);
    console.log(`🎯 Selected from movies: ${percentileMovies.map(m => `${m.title}(${m.userRating})`).join(', ')}`);
  }
  
  return selectedMovie;
};

/**
 * Adaptive ELO opponent selection for rounds 2+ (Known vs Known)
 * Won last round → find slightly higher opponent, Lost → find slightly lower
 */
const selectAdaptiveELOOpponent = (seenMovies, currentRating, lastRoundWon, excludeMovieIds = [], mediaType = 'movie') => {
  if (!seenMovies || seenMovies.length === 0) return null;
  
  // Filter available movies by media type and exclusions
  const availableMovies = seenMovies.filter(movie => 
    movie.userRating && 
    !excludeMovieIds.includes(movie.id) &&
    (movie.mediaType || 'movie') === mediaType
  );
  
  if (availableMovies.length === 0) return null;
  
  // Adaptive targeting based on last result
  let targetRating;
  let searchDirection;
  
  if (lastRoundWon) {
    // Won last round → find slightly higher opponent to test upper limit
    targetRating = currentRating + ENHANCED_RATING_CONFIG.ADAPTIVE_ELO.TARGET_OFFSET;
    searchDirection = 'higher';
  } else {
    // Lost last round → find slightly lower opponent to establish floor
    targetRating = currentRating - ENHANCED_RATING_CONFIG.ADAPTIVE_ELO.TARGET_OFFSET;
    searchDirection = 'lower';
  }
  
  console.log(`🎯 Adaptive ELO: ${searchDirection} after ${lastRoundWon ? 'WIN' : 'LOSS'}, targeting ${targetRating.toFixed(2)} from current ${currentRating.toFixed(2)}`);
  
  // Find best candidate in target direction with expanding search ranges
  const searchRanges = ENHANCED_RATING_CONFIG.ADAPTIVE_ELO.SEARCH_RANGES;
  
  for (const range of searchRanges) {
    const candidatesInRange = availableMovies.filter(movie => {
      const ratingDiff = movie.userRating - targetRating;
      return Math.abs(ratingDiff) <= range;
    });
    
    if (candidatesInRange.length > 0) {
      // Sort by proximity to target rating and pick closest
      candidatesInRange.sort((a, b) => 
        Math.abs(a.userRating - targetRating) - Math.abs(b.userRating - targetRating)
      );
      
      const selected = candidatesInRange[0];
      console.log(`🎯 Selected opponent: ${selected.title} (${selected.userRating.toFixed(2)}) within ±${range} of target ${targetRating.toFixed(2)}`);
      return selected;
    }
  }
  
  // Fallback: find closest available opponent in any direction
  availableMovies.sort((a, b) => 
    Math.abs(a.userRating - currentRating) - Math.abs(b.userRating - currentRating)
  );
  
  console.log(`⚠️ Fallback: Using closest available opponent ${availableMovies[0].title} (${availableMovies[0].userRating.toFixed(2)})`);
  return availableMovies[0];
};

// selectRandomOpponent is now defined in the legacy exports section at the end of the file

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
  
  const Ea = 1 / (1 + Math.pow(ENHANCED_RATING_CONFIG.ELO_CONFIG.BASE, (Rb - Ra) / ENHANCED_RATING_CONFIG.ELO_CONFIG.SCALE_FACTOR));
  const Eb = 1 - Ea;
  
  const newRatingA = Ra + Ka * (Sa - Ea);
  const newRatingB = Rb + Kb * ((1 - Sa) - Eb);
  
  // Apply boundary constraints (1-10 range)
  return [
    Math.max(ENHANCED_RATING_CONFIG.RATING_BOUNDS.MIN, Math.min(ENHANCED_RATING_CONFIG.RATING_BOUNDS.MAX, newRatingA)),
    Math.max(ENHANCED_RATING_CONFIG.RATING_BOUNDS.MIN, Math.min(ENHANCED_RATING_CONFIG.RATING_BOUNDS.MAX, newRatingB))
  ];
};

// calculatePairwiseRating is defined below for pairwise movie comparisons

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
    
    // Get dynamic categories and rating range for selected sentiment
    const categories = calculateDynamicRatingCategories(seenMovies, mediaType);
    console.log(`🔍 Categories generated:`, Object.keys(categories));
    console.log(`🔍 Selected category key: "${selectedCategory}"`);
    
    const categoryData = categories[selectedCategory];
    console.log(`🔍 Selected category data:`, categoryData);
    
    if (!categoryData) {
      console.log(`❌ No category data found for key: "${selectedCategory}"`);
      console.log(`❌ Available keys:`, Object.keys(categories));
      throw new Error(`Invalid sentiment category: ${selectedCategory}`);
    }
    
    // Round 1: Unknown vs Known (sentiment-based opponent using rating ranges)
    const round1Opponent = selectOpponentFromPercentile(categoryData, seenMovies, newMovie.id, mediaType);
    
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
    
    // Dynamic rounds based on confidence (3-6 range)
    let round = 1;
    
    while (round <= ENHANCED_RATING_CONFIG.CONFIDENCE.MAX_COMPARISONS) {
      let opponent;
      
      if (round === 1) {
        opponent = round1Opponent;
      } else {
        // Check if we should stop due to confidence achieved
        if (round > ENHANCED_RATING_CONFIG.CONFIDENCE.MIN_COMPARISONS && currentRating !== null) {
          const currentStats = {
            rating: currentRating,
            standardError: calculateStandardError(comparisonHistory.length, 
              comparisonHistory.filter(h => h.result === 'win').length,
              comparisonHistory.filter(h => h.result === 'loss').length,
              comparisonHistory.filter(h => h.result === 'neutral').length),
            comparisons: comparisonHistory.length
          };
          
          // Calculate confidence interval
          const confidenceInterval = calculateConfidenceInterval(currentStats.rating, currentStats.standardError);
          
          // Stop if target confidence reached
          if (confidenceInterval.width <= ENHANCED_RATING_CONFIG.CONFIDENCE.TARGET_INTERVAL_WIDTH) {
            console.log(`🎯 Target confidence reached after ${round-1} rounds: ±${confidenceInterval.width.toFixed(2)} ≤ ±${ENHANCED_RATING_CONFIG.CONFIDENCE.TARGET_INTERVAL_WIDTH}`);
            break;
          }
        }
        
        // Rounds 2+: Adaptive ELO opponent selection (Known vs Known)
        const currentMovieRating = newMovie.userRating || newMovie.eloRating / 100 || ENHANCED_RATING_CONFIG.ADAPTIVE_ELO.DEFAULT_RATING_FALLBACK;
        
        // Determine if we won the last round to guide opponent selection
        const lastRoundWon = comparisonHistory.length > 0 ? 
          comparisonHistory[comparisonHistory.length - 1].result === 'win' : true;
        
        console.log(`🎯 Round ${round}: Adaptive ELO selection, current rating ${currentMovieRating?.toFixed(2)}, last round: ${lastRoundWon ? 'WON' : 'LOST'}`);
        
        opponent = selectAdaptiveELOOpponent(seenMovies, currentMovieRating, lastRoundWon, [...usedOpponentIds, newMovie.id], mediaType);
        
        // Fallback to random if no adaptive opponent found
        if (!opponent) {
          console.log(`⚠️ No adaptive opponent found, falling back to random selection`);
          opponent = selectRandomOpponent(seenMovies, [...usedOpponentIds, newMovie.id], mediaType);
        }
        
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
      
      // Increment round for next iteration
      round++;
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
    return { success: false, error: error.message };
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

// **CONFIDENCE-BASED COMPARISON MODAL**
const ConfidenceBasedComparison = ({ visible, newMovie, availableMovies, selectedSentiment, sentimentRating, onClose, onComparisonComplete, colors, mediaType = 'movie' }) => {
  const [currentComparison, setCurrentComparison] = useState(0);
  const [currentOpponent, setCurrentOpponent] = useState(null);
  const [movieStats, setMovieStats] = useState({
    rating: newMovie?.userRating || null, // Use actual user rating if available
    standardError: CONFIDENCE_RATING_CONFIG.CONFIDENCE.INITIAL_UNCERTAINTY,
    comparisons: newMovie?.userRating ? 1 : 0, // Set > 0 if movie was rated before
    wins: 0,
    losses: 0,
    ties: 0,
    confidenceInterval: null
  });
  const [comparisonHistory, setComparisonHistory] = useState([]);
  const [isComplete, setIsComplete] = useState(false);
  const [usedOpponentIds, setUsedOpponentIds] = useState([]);
  
  // **CODE_BIBLE: "Update both ref and state" - Immediate exclusion tracking**
  const usedOpponentIdsRef = useRef([]);
  
  // Reset ref when modal opens
  useEffect(() => {
    if (visible) {
      usedOpponentIdsRef.current = [];
    }
  }, [visible]);

  // **RATING-PROXIMITY SELECTION STATE**
  const [placementState, setPlacementState] = useState(() => {
    // Use sentiment-based starting rating instead of neutral 5.5
    const currentEstimate = sentimentRating || newMovie.suggestedRating || 5.5;
    console.log(`🔧 ConfidenceBasedComparison init - sentimentRating: ${sentimentRating}, suggestedRating: ${newMovie.suggestedRating}, final: ${currentEstimate}`);
    
    return {
      currentEstimate: currentEstimate,
      searchRadius: 1.0, // Consistent ±1 point radius
      round: 0,
      usedOpponents: [],
      lastOpponent: null
    };
  });

  // **RATING-PROXIMITY OPPONENT SELECTION**
  const pickOpponentFromProximity = useCallback((seen, currentRating, searchRadius, excludeIds = []) => {
    console.log(`🔍 pickOpponentFromProximity called with ${excludeIds.length} exclusions`);
    
    const availableOpponents = seen
      .filter(m => {
        // **STRICT VALIDATION: Multiple checks for exclusion**
        if (m.userRating == null) return false;
        if (excludeIds.includes(m.id)) {
          console.log(`🚫 Excluding ${m.title} (${m.id}) - already used`);
          return false;
        }
        return true;
      })
      .filter(m => {
        const ratingDiff = Math.abs(m.userRating - currentRating);
        const withinRadius = ratingDiff <= searchRadius;
        if (!withinRadius) {
          console.log(`📏 ${m.title} (${m.userRating.toFixed(1)}) outside ±${searchRadius} radius (diff: ${ratingDiff.toFixed(1)})`);
        }
        return withinRadius;
      })
      .sort((a, b) => {
        // Sort by proximity to current rating (closest first)
        const diffA = Math.abs(a.userRating - currentRating);
        const diffB = Math.abs(b.userRating - currentRating);
        return diffA - diffB;
      });

    if (availableOpponents.length === 0) {
      // Fallback: if no opponents within ±1 point, expand slightly but cap at ±1.5 points max
      const expandedOpponents = seen
        .filter(m => m.userRating != null && !excludeIds.includes(m.id))
        .filter(m => {
          const ratingDiff = Math.abs(m.userRating - currentRating);
          return ratingDiff <= 1.5; // Never allow >1.5 point differences
        })
        .sort((a, b) => {
          const diffA = Math.abs(a.userRating - currentRating);
          const diffB = Math.abs(b.userRating - currentRating);
          return diffA - diffB;
        });
      
      if (expandedOpponents.length > 0) {
        console.log(`⚠️ Expanded search from ±${searchRadius} to ±1.5 points`);
        return expandedOpponents[0]; // Return closest opponent
      }
      return null;
    }

    // Select from top 3 closest opponents to add some randomness while staying close
    const topCandidates = availableOpponents.slice(0, Math.min(3, availableOpponents.length));
    const randomIndex = Math.floor(Math.random() * topCandidates.length);
    
    // Final validation: ensure selected opponent is within reasonable range
    const selectedOpponent = topCandidates[randomIndex];
    const finalDiff = Math.abs(selectedOpponent.userRating - currentRating);
    
    if (finalDiff > 1.5) {
      console.warn(`🚨 Warning: Large rating difference detected (${finalDiff.toFixed(1)} pts) - this should not happen`);
    }
    
    return selectedOpponent;
  }, []);

  const placeAfterResult = useCallback((currentRating, opponentRating, didWin) => {
    if (didWin) {
      // **EDGE CASE: If opponent = 10.0 and user picks new movie → set 10.0 (cap)**
      if (opponentRating >= 10.0) {
        return 10.0;
      }
      // One spot above opponent; minimal tick
      const step = 0.1;
      return Math.min(10, Math.max(opponentRating + step, currentRating));
    } else {
      // No immediate rating change; we'll probe lower band next
      return currentRating;
    }
  }, []);

  const updateRatingEstimate = useCallback((newRating) => {
    setPlacementState(prev => ({
      ...prev,
      currentEstimate: newRating,
      round: prev.round + 1
    }));
  }, []);

  // Get confidence color based on interval width
  const getConfidenceColor = (intervalWidth) => {
    if (!intervalWidth) return CONFIDENCE_RATING_CONFIG.COLORS.CONFIDENCE_LOW;
    
    if (intervalWidth <= CONFIDENCE_RATING_CONFIG.CONFIDENCE.TARGET_INTERVAL_WIDTH) {
      return CONFIDENCE_RATING_CONFIG.COLORS.CONFIDENCE_HIGH;
    } else if (intervalWidth <= CONFIDENCE_RATING_CONFIG.CONFIDENCE.TARGET_INTERVAL_WIDTH * 2) {
      return CONFIDENCE_RATING_CONFIG.COLORS.CONFIDENCE_MEDIUM;
    } else {
      return CONFIDENCE_RATING_CONFIG.COLORS.CONFIDENCE_LOW;
    }
  };

  // Get next opponent using rating proximity
  const getNextOpponent = useCallback(() => {
    // **CODE_BIBLE: Test edge cases where state updates might be delayed**
    console.log(`🔍 getNextOpponent called - ref has ${usedOpponentIdsRef.current.length} used IDs, state has ${usedOpponentIds.length} used IDs`);
    
    // Use current rating estimate or sentiment baseline for first round
    const currentRating = movieStats.rating || placementState.currentEstimate;
    
    // Consistent ±1 point radius for all rounds
    const searchRadius = 1.0; // ±1 point for all rounds
    
    // **CODE_BIBLE: Use ref for immediate exclusion (not stale state)**
    // Ensure no movie is used more than once (excludeIds includes usedOpponentIds + newMovie)
    const excludeIds = [...usedOpponentIdsRef.current, newMovie.id];
    
    console.log(`🎯 Round ${movieStats.comparisons + 1}: Looking for opponent near ${currentRating?.toFixed(1) || 'unknown'} (±${searchRadius} pts)`);
    console.log(`🔧 CODE_BIBLE Fix: Using immediate ref [${usedOpponentIdsRef.current.join(',')}] instead of stale state`);
    console.log(`🚫 Excluded opponents: [${excludeIds.map(id => {
      const movie = availableMovies.find(m => m.id === id);
      return movie ? `${movie.title}(${id})` : `Unknown(${id})`;
    }).join(', ')}]`);
    console.log(`📊 Available pool: ${availableMovies.filter(m => !excludeIds.includes(m.id)).length} movies`);
    
    // **EARLY DETECTION: Check if sufficient unique opponents exist**
    const availablePool = availableMovies.filter(m => m.userRating != null && !excludeIds.includes(m.id));
    const potentialOpponents = availablePool.filter(m => {
      const ratingDiff = Math.abs(m.userRating - currentRating);
      return ratingDiff <= 1.5; // Check within expanded radius
    });
    
    if (potentialOpponents.length === 0) {
      console.warn(`⚠️ No more unique opponents available within ±1.5 points of ${currentRating?.toFixed(1)}`);
      console.warn(`⚠️ Used ${excludeIds.length - 1} opponents, ${availablePool.length} remaining in total pool`);
    }
    
    // **PERCENTILE-BASED SELECTION: Use emotion for first opponent, random for subsequent**
    let opponent;
    
    if (movieStats.comparisons === 0 && selectedSentiment) {
      // First opponent: Use percentile selection based on user's emotion
      console.log(`🎯 First opponent: Using percentile selection for emotion ${selectedSentiment}`);
      opponent = selectOpponentFromPercentile(
        selectedSentiment,
        availableMovies,
        newMovie.id, // exclude the new movie
        mediaType,
        true // enhanced logging
      );
      
      // Fallback to random if percentile selection fails
      if (!opponent) {
        console.warn(`⚠️ Percentile selection failed for ${selectedSentiment}, falling back to random`);
        const availableOpponents = availableMovies.filter(movie => !excludeIds.includes(movie.id));
        if (availableOpponents.length > 0) {
          const shuffled = availableOpponents.sort(() => 0.5 - Math.random());
          opponent = shuffled[0];
        }
      } else {
        console.log(`🎬 Percentile opponent selected: ${opponent?.title} (${opponent?.userRating})`);
      }
    } else {
      // Subsequent opponents: Random selection from remaining movies
      const availableOpponents = availableMovies.filter(movie => !excludeIds.includes(movie.id));
      
      if (availableOpponents.length > 0) {
        const shuffled = availableOpponents.sort(() => 0.5 - Math.random());
        opponent = shuffled[0];
        console.log(`🎲 Subsequent opponent: Random selection: ${opponent?.title} (${opponent?.userRating})`);
      } else {
        opponent = null;
      }
    }
    
    if (opponent) {
      // **CRITICAL VALIDATION: Double-check opponent isn't already used**
      if (usedOpponentIdsRef.current.includes(opponent.id)) {
        console.error(`🚨 DUPLICATE OPPONENT DETECTED: ${opponent.title} (${opponent.id}) was already used!`);
        console.error(`🚨 Used IDs: [${usedOpponentIdsRef.current.join(', ')}]`);
        console.error(`🚨 This should NEVER happen - opponent selection failed!`);
        return null; // Reject duplicate opponent
      }
      
      console.log(`✅ Selected opponent: ${opponent.title} (${opponent.userRating.toFixed(1)}) - diff: ${Math.abs(opponent.userRating - currentRating).toFixed(1)} pts`);
      console.log(`✅ Opponent ID: ${opponent.id} (verified unique)`);
    } else {
      console.log(`❌ No suitable opponent found within ±${searchRadius} pts of ${currentRating?.toFixed(1)}`);
    }
    
    return opponent;
  }, [pickOpponentFromProximity, availableMovies, movieStats.rating, movieStats.comparisons, placementState.currentEstimate, usedOpponentIds, newMovie.id]);

  // Initialize comparison on modal open
  useEffect(() => {
    if (visible && !currentOpponent) {
      // **EDGE CASE: Handle tiny library**
      if (availableMovies.length < 3) {
        console.log('📚 Tiny library detected, cannot establish rating without comparisons');
        setTimeout(() => {
          onComparisonComplete({
            finalRating: null, // Cannot establish rating without sufficient data
            ratingStats: {
              rating: null,
              standardError: 0.15,
              comparisons: 0,
              wins: 0,
              losses: 0,
              ties: 0,
              confidenceInterval: null
            },
            comparisonHistory: [],
            targetConfidenceReached: false,
            error: 'Insufficient data for rating'
          });
        }, 1000);
        return;
      }

      const opponent = getNextOpponent();
      if (opponent) {
        setCurrentOpponent(opponent);
        setCurrentComparison(1);
      }
    }
  }, [visible, availableMovies, getNextOpponent, currentOpponent, newMovie, onComparisonComplete]);

  const handleComparison = useCallback(async (userChoice) => {
    if (!currentOpponent) return;

    // **UNIFIED RATING SYSTEM LOGIC** - Use same system as Wildcard screen
    const didWin = (userChoice === 'new');
    const didTie = (userChoice === 'too_tough');
    
    // Determine comparison result
    let result;
    if (didTie) {
      result = ComparisonResults.TIE;
    } else if (didWin) {
      result = ComparisonResults.A_WINS;
    } else {
      result = ComparisonResults.B_WINS;
    }

    // For first comparison (round 1): Use percentile + sentiment logic
    // For subsequent comparisons (rounds 2+): Use Wildcard ELO system
    let newRating;
    let updatedOpponentRating = currentOpponent.userRating;
    
    if (movieStats.comparisons === 0) {
      // **ROUND 1: Use percentile/sentiment system (as requested)**
      const pairwiseResult = calculatePairwiseRating({
        aRating: null, // New movie has no rating yet (triggers round 1 logic)
        bRating: currentOpponent.userRating,
        aGames: 0,
        bGames: currentOpponent.gamesPlayed || 5,
        result: result,
        sentiment: selectedSentiment,
        userMovies: availableMovies
      });
      
      newRating = pairwiseResult.updatedARating;
      updatedOpponentRating = pairwiseResult.updatedBRating;
    } else {
      // **ROUNDS 2+: Use Wildcard ELO system (as requested)**
      const pairwiseResult = calculatePairwiseRating({
        aRating: movieStats.rating,
        bRating: currentOpponent.userRating,
        aGames: movieStats.comparisons,
        bGames: currentOpponent.gamesPlayed || 5,
        result: result
      });
      
      newRating = pairwiseResult.updatedARating;
      updatedOpponentRating = pairwiseResult.updatedBRating;
    }

    // Update movie statistics
    const newStats = {
      ...movieStats,
      rating: newRating,
      comparisons: movieStats.comparisons + 1,
      wins: movieStats.wins + (didWin ? 1 : 0),
      losses: movieStats.losses + (!didWin && !didTie ? 1 : 0),
      ties: movieStats.ties + (didTie ? 1 : 0)
    };

    // Calculate confidence interval (fixed SE floor)
    const n = Math.max(1, newStats.comparisons);
    const winRate = Math.max(0.05, Math.min(0.95, newStats.wins / n)); // Clamp between 0.05-0.95
    const se = Math.max(0.15, Math.sqrt((winRate * (1 - winRate)) / n) * 2.0); // Floor at 0.15

    newStats.standardError = se;
    newStats.confidenceInterval = {
      lower: Math.max(1, newRating - 1.96 * se),
      upper: Math.min(10, newRating + 1.96 * se),
      width: 2 * 1.96 * se
    };

    setMovieStats(newStats);

    // Update opponent rating if it changed (for rounds 2+ when using ELO system)
    if (updatedOpponentRating !== currentOpponent.userRating) {
      // Update the opponent in the available movies array to keep in-memory data consistent
      const updatedMovies = availableMovies.map(movie => 
        movie.id === currentOpponent.id ? 
          { ...movie, userRating: updatedOpponentRating, eloRating: Math.round(updatedOpponentRating * 100) } : 
          movie
      );
      console.log(`🔄 Updated opponent ${currentOpponent.title}: ${currentOpponent.userRating.toFixed(2)} → ${updatedOpponentRating.toFixed(2)}`);
    }

    // Record comparison in history
    const comparisonRecord = {
      comparison: currentComparison,
      opponent: currentOpponent.title,
      result: userChoice,
      ratingBefore: movieStats.rating,
      ratingAfter: newRating,
      confidenceInterval: newStats.confidenceInterval
    };

    setComparisonHistory(prev => [...prev, comparisonRecord]);

    // **CODE_BIBLE: Update both ref and state for immediate exclusion tracking**
    // 
    // WHY DUPLICATES OCCURRED:
    // - React's setState is asynchronous and batched
    // - setUsedOpponentIds() doesn't update immediately 
    // - getNextOpponent() called on line 1532 sees stale usedOpponentIds state
    // - Same opponent could be selected multiple times in rapid succession
    //
    // HOW WE PREVENT DUPLICATES:
    // - Update usedOpponentIdsRef.current IMMEDIATELY (synchronous)
    // - getNextOpponent() uses usedOpponentIdsRef.current (always current)
    // - Also update state for UI consistency (asynchronous, for display)
    //
    usedOpponentIdsRef.current = [...usedOpponentIdsRef.current, currentOpponent.id];
    setUsedOpponentIds(prev => [...prev, currentOpponent.id]);

    // Update placement state
    setPlacementState(prev => ({
      ...prev,
      currentEstimate: newRating,
      round: prev.round + 1,
      lastOpponent: {
        id: currentOpponent.id,
        rating: currentOpponent.userRating
      }
    }));

    console.log(`📊 Comparison ${currentComparison}: Rating ${newRating?.toFixed(2)} ± ${newStats.confidenceInterval?.width?.toFixed(2)}`);

    // **MATCH ADD MOVIE: Always exactly 3 comparisons**
    let shouldStop = false;
    let stopReason = '';
    
    // Stop after exactly 3 comparisons (matching Add Movie screen)
    if (newStats.comparisons >= 3) {
      shouldStop = true;
      stopReason = 'Completed 3 comparisons (matching Add Movie logic)';
    }
    
    // Also stop if no more opponents available
    if (availableMovies.length <= usedOpponentIds.length + 1) {
      shouldStop = true;
      stopReason = 'No more opponents available';
    }
    
    console.log(`🎯 Round ${newStats.comparisons}: Confidence width=${newStats.confidenceInterval?.width?.toFixed(2)}, Stop=${shouldStop} (${stopReason})`);

    if (shouldStop) {
      // Rating complete
      setIsComplete(true);
      setTimeout(() => {
        onComparisonComplete({
          finalRating: newRating,
          ratingStats: newStats,
          comparisonHistory: [...comparisonHistory, comparisonRecord],
          targetConfidenceReached: newStats.confidenceInterval?.width <= CONFIDENCE_RATING_CONFIG.CONFIDENCE.TARGET_INTERVAL_WIDTH,
          stopReason: stopReason,
          totalRounds: newStats.comparisons
        });
      }, 2000);
    } else {
      // **UPDATE RATING ESTIMATE FOR NEXT ROUND**
      updateRatingEstimate(newRating);

      // Get next opponent using proximity-based selection with updated rating
      const nextOpponent = getNextOpponent();

      if (nextOpponent) {
        // **CODE_BIBLE: Never assume exclusion worked - validate explicitly**
        if (usedOpponentIdsRef.current.includes(nextOpponent.id)) {
          console.error(`🚨 CRITICAL: Exclusion validation FAILED! ${nextOpponent.title} already used!`);
          console.error(`🚨 This indicates a bug in opponent selection logic.`);
          // Force completion to prevent infinite loop
          setIsComplete(true);
          return;
        }
        
        console.log(`✅ Exclusion validation PASSED: ${nextOpponent.title} is unique`);
        setCurrentOpponent(nextOpponent);
        setCurrentComparison(prev => prev + 1);
      } else {
        // No more opponents available in any band
        setIsComplete(true);
        setTimeout(() => {
          onComparisonComplete({
            finalRating: newRating,
            ratingStats: newStats,
            comparisonHistory: [...comparisonHistory, comparisonRecord],
            targetConfidenceReached: newStats.confidenceInterval?.width <= CONFIDENCE_RATING_CONFIG.CONFIDENCE.TARGET_INTERVAL_WIDTH,
            stopReason: 'No more opponents available',
            totalRounds: newStats.comparisons
          });
        }, 2000);
      }
    }
  }, [currentOpponent, movieStats, currentComparison, comparisonHistory, getNextOpponent, onComparisonComplete]);

  const resetComparison = () => {
    setCurrentComparison(0);
    setCurrentOpponent(null);
    setMovieStats({
      rating: null, // Start as truly unknown - no initial rating
      standardError: CONFIDENCE_RATING_CONFIG.CONFIDENCE.INITIAL_UNCERTAINTY,
      comparisons: 0,
      wins: 0,
      losses: 0,
      ties: 0,
      confidenceInterval: null
    });
    setComparisonHistory([]);
    setIsComplete(false);
    setUsedOpponentIds([]);
    // **CODE_BIBLE: Reset ref to match state**
    usedOpponentIdsRef.current = [];
  };

  useEffect(() => {
    if (visible) {
      resetComparison();
    }
  }, [visible]);

  if (!visible || !availableMovies || availableMovies.length < ENHANCED_RATING_CONFIG.COMPARISON_CONFIG.MIN_MOVIES) return null;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <LinearGradient
          colors={colors.primaryGradient || ['#667eea', '#764ba2']}
          style={styles.comparisonModalContent}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            style={styles.scrollContainer}
          >
          {!isComplete && currentOpponent ? (
            <>
              <View style={styles.comparisonHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  Confidence-Based Rating
                </Text>
                <Text style={[styles.comparisonSubtitle, { color: colors.subText }]}>
                  Comparison {currentComparison} • Which do you prefer?
                </Text>
                
                {/* Confidence Indicator */}
                <View style={styles.confidenceIndicator}>
                  <Text style={[styles.confidenceLabel, { color: colors.subText }]}>
                    Progress:
                  </Text>
                  <View style={[
                    styles.confidenceBadge,
                    { backgroundColor: getConfidenceColor(movieStats.confidenceInterval?.width) }
                  ]}>
                  </View>
                  <View style={[styles.targetContainer, { borderColor: colors.accent }]}>
                    <Text style={[styles.targetLabel, { color: colors.subText }]}>
                      Goal:
                    </Text>
                    <Text style={[styles.targetValue, { color: colors.accent }]}>
                      ±{CONFIDENCE_RATING_CONFIG.CONFIDENCE.TARGET_INTERVAL_WIDTH}
                    </Text>
                  </View>
                </View>

                {/* Current Rating Display */}
                <View style={styles.currentRatingDisplay}>
                  <Text style={[styles.currentRatingLabel, { color: colors.subText }]}>
                    Current Rating:
                  </Text>
                  <Text style={[styles.currentRatingValue, { color: movieStats.rating ? colors.accent : colors.subText }]}>
                    {movieStats.rating ? `${movieStats.rating.toFixed(2)}/10` : 'Unknown'}
                  </Text>
                </View>
              </View>

              <View style={styles.moviesComparison}>
                {/* New Movie - Using MovieCard component for exact home screen appearance */}
                <MovieCard
                  item={newMovie}
                  handleMovieSelect={() => handleComparison('new')}
                  handleNotInterested={() => {}} // No "not interested" in comparison modal
                  isDarkMode={true} // Match comparison modal theme
                  context="comparison" // Use comparison context for proper sizing
                  getRatingBorderColor={() => 'transparent'}
                />

                {/* VS Indicator with Confidence */}
                <View style={styles.vsIndicatorWildcard}>
                  <View style={[styles.vsCircle, { borderColor: colors.accent }]}>
                    <Text style={[styles.vsText, { color: colors.accent }]}>VS</Text>
                  </View>
                  <Text style={[styles.comparisonCountText, { color: colors.subText }]}>
                    Round {currentComparison}
                  </Text>
                  <Text style={[styles.informationGainText, { color: colors.subText }]}>
                    Info Gain: High
                  </Text>
                </View>

                {/* Opponent Movie - Using MovieCard component for exact home screen appearance */}
                <MovieCard
                  item={currentOpponent}
                  handleMovieSelect={() => handleComparison('opponent')}
                  handleNotInterested={() => {}} // No "not interested" in comparison modal
                  isDarkMode={true} // Match comparison modal theme
                  context="comparison" // Use comparison context for proper sizing
                  getRatingBorderColor={() => 'transparent'}
                />
              </View>

              {/* Too Tough to Decide Button */}
              <TouchableOpacity
                style={[styles.tooToughButton, { borderColor: colors.subText }]}
                onPress={() => handleComparison('too_tough')}
                activeOpacity={0.8}
              >
                <Text style={[styles.tooToughText, { color: colors.subText }]}>
                  Too Tough to Decide
                </Text>
              </TouchableOpacity>

              {/* Progress Bar */}
              {movieStats.comparisons > 0 && (
                <View style={styles.confidenceContainer}>
                  <View style={[styles.confidenceBar, { backgroundColor: colors.surface }]}>
                    <View 
                      style={[
                        styles.confidenceFill, 
                        { 
                          backgroundColor: getConfidenceColor(movieStats.confidenceInterval?.width),
                          width: `${Math.max(0, Math.min(100, (1 - (movieStats.confidenceInterval?.width || 2) / 2) * 100))}%`
                        }
                      ]} 
                    />
                  </View>
                </View>
              )}

              {/* Progress Indicator */}
              <View style={styles.progressIndicator}>
                {[0, 1, 2, 3, 4, 5].map(index => (
                  <View
                    key={index}
                    style={[
                      styles.progressDot,
                      { 
                        backgroundColor: index < currentComparison ? colors.accent : colors.border?.color || '#ccc',
                        // Make dots smaller to fit 6 in the same space
                        width: 8,
                        height: 8,
                        marginHorizontal: 3
                      }
                    ]}
                  />
                ))}
              </View>
            </>
          ) : (
            // **SIMPLIFIED COMPLETION SCREEN** - Just poster, title, rating, close button
            <View style={styles.completionScreen}>
              <View style={styles.completionMovieCard}>
                <Image
                  source={{ uri: `https://image.tmdb.org/t/p/w500${newMovie?.poster_path}` }}
                  style={styles.completionPoster}
                  resizeMode="cover"
                />
                <Text style={[styles.completionMovieTitle, { color: colors.text }]} numberOfLines={2}>
                  {newMovie?.title || newMovie?.name}
                </Text>
                <View style={styles.completionRatingContainer}>
                  <Ionicons name="star" size={20} color={colors.accent} />
                  <Text style={[styles.completionRating, { color: colors.accent }]}>
                    {(movieStats.rating || 0).toFixed(1)}/10
                  </Text>
                </View>
              </View>
            </View>
          )}
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.cancelButton, { borderColor: colors.border?.color || '#ccc' }]}
              onPress={onClose}
            >
              <Text style={[styles.cancelButtonText, { color: colors.subText }]}>
                {isComplete ? 'Close' : 'Cancel'}
              </Text>
            </TouchableOpacity>
          </View>
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
  
  // Default rating helper function
  const getDefaultRatingForCategory = (categoryKey) => {
    const defaults = {
      'LOVED': 8.5,
      'LIKED': 7.0,
      'AVERAGE': 5.5,
      'DISLIKED': 3.0
    };
    return defaults[categoryKey] || 5.0;
  };
  
  const handleCategorySelect = useCallback((categoryKey) => {
    console.log('🎭 User selected sentiment:', categoryKey);
    setSelectedCategory(categoryKey);
    
    const category = RATING_CATEGORIES[categoryKey];
    
    // Calculate mid-rating based on rating range (default to dynamic midpoint for new users)
    const midRating = userMovies && userMovies.length > 0 && category.ratingRange ?
      (category.ratingRange[0] + category.ratingRange[1]) / 2 :
      getDefaultRatingForCategory(categoryKey);
    
    const movieWithRating = {
      ...movie,
      suggestedRating: midRating
    };
    
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
    
    // Find movies in the same rating range for comparison
    const categoryMovies = seen
      .filter(m => m.id !== movie.id && m.userRating)
      .filter(m => {
        if (!categoryInfo.ratingRange) return false;
        const [minRating, maxRating] = categoryInfo.ratingRange;
        return m.userRating >= minRating && m.userRating <= maxRating;
      });
    
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
    const categoryAverage = categoryInfo.ratingRange ? 
      (categoryInfo.ratingRange[0] + categoryInfo.ratingRange[1]) / 2 :
      getDefaultRatingForCategory(categoryKey);
    
    // Create mock comparison movies if needed to demonstrate the flow
    const mockComparisons = seen.slice(0, 3).map(m => ({ ...m, comparisonScore: 50 }));
    
    if (mockComparisons.length >= 3) {
      setComparisonMovies(mockComparisons);
      setComparisonModalVisible(true);
    } else {
      handleConfirmRating(categoryAverage);
    }
  }, [seen, movie, genres, handleConfirmRating]);
  
  const handleComparisonComplete = useCallback((result) => {
    console.log('✅ Confidence-based comparison complete:', result);
    setComparisonModalVisible(false);
    
    // Handle both old format (just rating) and new format (object with stats)
    const finalRating = typeof result === 'number' ? result : result.finalRating;
    const ratingStats = typeof result === 'object' ? result.ratingStats : null;
    const stopReason = result.stopReason || 'Comparison complete';
    const totalRounds = result.totalRounds || ratingStats?.comparisons || 3;
    
    console.log(`🎯 Final Rating: ${finalRating?.toFixed(2)} with confidence ±${ratingStats?.confidenceInterval?.width?.toFixed(2) || 'Unknown'}`);
    console.log(`📊 Total Rounds: ${totalRounds}, Stop Reason: ${stopReason}`);
    console.log(`✨ Target reached: ${result.targetConfidenceReached || false}`);
    
    handleConfirmRating(finalRating, ratingStats, stopReason, totalRounds);
  }, [handleConfirmRating]);
  
  const handleConfirmRating = useCallback((finalRating, ratingStats = null, stopReason = '', totalRounds = 3) => {
    console.log('✅ Confirming rating:', finalRating, 'for:', movie?.title);
    if (!movie || !finalRating) return;
    
    // Create movie item with confidence-based statistics
    const newItem = {
      ...movie,
      userRating: finalRating,
      eloRating: finalRating * 100, // Legacy compatibility
      ratingStats: ratingStats || {
        rating: finalRating,
        standardError: CONFIDENCE_RATING_CONFIG.CONFIDENCE.INITIAL_UNCERTAINTY,
        comparisons: 1,
        wins: 0,
        losses: 0,
        ties: 0,
        confidenceInterval: null,
        lastUpdated: new Date().toISOString()
      },
      mediaType: mediaType,
      ratingCategory: selectedCategory,
      ratingMethod: 'confidence_based_rating' // Mark as using new system
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
    
    // Create dynamic success message with stop reason
    const confidenceInfo = ratingStats ? 
      `Confidence: ±${ratingStats.confidenceInterval?.width?.toFixed(2) || 'Unknown'} points` :
      'Standard rating applied';
    
    const targetReached = ratingStats?.confidenceInterval?.width <= CONFIDENCE_RATING_CONFIG.CONFIDENCE.TARGET_INTERVAL_WIDTH;
    
    // Dynamic message based on stop reason
    let statusEmoji = '✅';
    if (stopReason.includes('Excellent')) statusEmoji = '🎯';
    else if (stopReason.includes('Good')) statusEmoji = '✨';
    else if (stopReason.includes('Maximum')) statusEmoji = '⏰';
    
    Alert.alert(
      "Rating Complete!",
      `You ${categoryLabel.toLowerCase()} "${movie.title}" (${finalRating.toFixed(1)}/10)\n\n${confidenceInfo}\nCompleted in ${totalRounds} rounds\n\n${statusEmoji} ${stopReason}`,
      [
        {
          text: "Perfect!",
          onPress: () => {
            console.log(`🎊 Dynamic rating completed: ${totalRounds} rounds, ${stopReason}`);
          }
        }
      ]
    );
  }, [movie, selectedCategory, isAlreadyRated, onUpdateRating, onAddToSeen, mediaType, seen, onSuccess]);
  
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
      backgroundColor: isAlreadyRated ? 
        (colors.secondary || colors.primary) : 
        colors.primary,
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

      <ConfidenceBasedComparison
        visible={comparisonModalVisible}
        newMovie={{...movie, suggestedRating}}
        availableMovies={seen}
        selectedSentiment={selectedCategory}
        onClose={handleCloseModals}
        onComparisonComplete={handleComparisonComplete}
        colors={colors}
        mediaType={mediaType}
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

  // Confidence Indicators
  confidenceIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 6,
  },
  confidenceLabel: {
    fontSize: 12,
    marginRight: 8,
  },
  confidenceBadge: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginHorizontal: 8,
  },
  confidenceText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  targetContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    marginLeft: 8,
  },
  targetLabel: {
    fontSize: 10,
    marginRight: 4,
    fontWeight: '600',
  },
  targetValue: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  currentRatingDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  currentRatingLabel: {
    fontSize: 12,
    marginRight: 8,
  },
  currentRatingValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  informationGainText: {
    fontSize: 10,
    textAlign: 'center',
    marginTop: 4,
  },
  tooToughButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  tooToughText: {
    fontSize: 14,
    fontWeight: '600',
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
    borderRadius: 16,
    maxHeight: '90%',
    minHeight: '80%',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 15,
    paddingBottom: 20,
    flexGrow: 1,
  },
  modalFooter: {
    padding: 15,
    paddingTop: 10,
  },
  comparisonHeader: {
    alignItems: 'center',
    marginBottom: 12,
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
  movieInfoBox: {
    position: 'absolute',
    bottom: -20, // Match MovieCard.js bottom positioning exactly
    left: 0,
    right: 0,
    width: '100%',
    minHeight: 80, // Match MovieCard.js minHeight
    paddingHorizontal: 8,
    paddingVertical: 1, // Match MovieCard.js tight padding
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  movieCardName: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
    marginBottom: 2,
    width: '100%',
    textAlign: 'center',
  },
  movieCardYear: {
    fontSize: 10,
    opacity: 0.7,
    lineHeight: 14,
    width: '100%',
    textAlign: 'center',
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

  // **Wildcard-Style Comparison Cards - Mobile-optimized sizing**
  wildcardStyleCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
    // Reduced dimensions for mobile modal
    width: 100,
    maxWidth: 100,
    minWidth: 100,
    height: 100 * 1.8, // 180px (reduced from 228px)
    overflow: 'hidden',
  },
  posterContainer: {
    position: 'relative',
    width: '100%',
    height: '70%', // Match MovieCard.js poster height ratio
  },
  movieComparisonCard: {
    // Match home screen MovieCard dimensions exactly
    alignItems: 'center',
    borderRadius: 12,
    marginHorizontal: 6,
    width: Math.min((Dimensions.get('window').width - 48) / 2.8, 130),
    maxWidth: Math.min((Dimensions.get('window').width - 48) / 2.8, 130),
    minWidth: Math.min((Dimensions.get('window').width - 48) / 2.8, 130),
    height: Math.min((Dimensions.get('window').width - 48) / 2.8, 130) * 1.9,
  },
  comparisonPoster: {
    width: '100%',
    height: '70%', // Match MovieCard.js poster height ratio exactly
    borderRadius: 12, // Match MovieCard.js rounded corners
    overflow: 'hidden', // Ensure rounded corners are clean
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
  confidenceContainer: {
    marginTop: 20,
    marginBottom: 10,
    paddingHorizontal: 20,
    alignItems: 'center'
  },
  confidenceLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  confidenceBar: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6
  },
  confidenceFill: {
    height: '100%',
    borderRadius: 4
  },
  confidenceText: {
    fontSize: 11,
    fontWeight: '500'
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

  // **SIMPLIFIED COMPLETION SCREEN STYLES**
  completionScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  completionMovieCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  completionPoster: {
    width: 225, // 50% larger (150 * 1.5)
    height: 338, // 50% larger (225 * 1.5) 
    borderRadius: 12,
    marginBottom: 16,
  },
  completionMovieTitle: {
    fontSize: 27, // 50% larger (18 * 1.5)
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 36, // 50% larger (24 * 1.5)
  },
  completionRatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  completionRating: {
    fontSize: 30, // 50% larger (20 * 1.5)
    fontWeight: 'bold',
    marginLeft: 8,
  },
});

// Quick Rating Button for Home Screen Cards
const QuickRatingButton = ({ movie, seen, onAddToSeen, onUpdateRating, colors, onSuccess }) => {
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
const CompactRatingButton = ({ movie, seen, onAddToSeen, onUpdateRating, colors, onSuccess }) => {
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
  
  // Find which rating range this rating falls into
  for (const [key, category] of Object.entries(categories)) {
    if (category.ratingRange && Array.isArray(category.ratingRange)) {
      const [minRating, maxRating] = category.ratingRange;
      if (rating >= minRating && rating <= maxRating) {
        return { key, ...category };
      }
    }
  }
  
  return null;
};

// **MISSING FUNCTIONS NEEDED BY OTHER SCREENS**

/**
 * Legacy ELO calculation for backward compatibility
 * Used by Wildcard and other screens that haven't been updated yet
 */
export const adjustRatingWildcard = (winnerRating, loserRating, winnerWon, winnerGamesPlayed = 0, loserGamesPlayed = 5) => {
  const ratingDifference = Math.abs(winnerRating - loserRating);
  const expectedWinProbability = 1 / (1 + Math.pow(ENHANCED_RATING_CONFIG.ELO_CONFIG.BASE, (loserRating - winnerRating) / ENHANCED_RATING_CONFIG.ELO_CONFIG.SCALE_FACTOR));
  
  const winnerK = calculateDynamicKFactor(winnerGamesPlayed < 5 ? 2.0 : 1.0, winnerGamesPlayed);
  const loserK = calculateDynamicKFactor(loserGamesPlayed < 5 ? 2.0 : 1.0, loserGamesPlayed);
  
  const winnerIncrease = Math.max(0.1, (winnerK / 100) * (1 - expectedWinProbability));
  const loserDecrease = Math.max(0.1, (loserK / 100) * (1 - expectedWinProbability));
  
  let adjustedWinnerIncrease = winnerIncrease;
  if (winnerRating < loserRating) {
    adjustedWinnerIncrease *= 1.2; // Boost for upset wins
  }
  
  const isMajorUpset = winnerRating < loserRating && ratingDifference > 3.0;
  if (isMajorUpset) {
    adjustedWinnerIncrease += 0.5; // Additional boost for major upsets
  }
  
  const MAX_RATING_CHANGE = 0.7;
  if (!isMajorUpset) {
    adjustedWinnerIncrease = Math.min(MAX_RATING_CHANGE, adjustedWinnerIncrease);
  }
  
  let newWinnerRating = winnerRating + adjustedWinnerIncrease;
  let newLoserRating = loserRating - loserDecrease;
  
  newWinnerRating = Math.round(Math.min(10, Math.max(1, newWinnerRating)) * 10) / 10;
  newLoserRating = Math.round(Math.min(10, Math.max(1, newLoserRating)) * 10) / 10;
  
  return {
    updatedSeenContent: newWinnerRating,
    updatedNewContent: newLoserRating
  };
};

/**
 * Legacy opponent selection for backward compatibility
 */
export const selectOpponentFromEmotion = (emotion, seenMovies, excludeMovieId = null) => {
  return selectInitialOpponent(emotion, seenMovies, excludeMovieId ? [excludeMovieId] : []);
};

/**
 * Legacy random opponent selection with mediaType support
 */
export const selectRandomOpponent = (seenMovies, excludeMovieIds = [], mediaType = 'movie') => {
  if (!seenMovies || seenMovies.length === 0) return null;
  
  const availableMovies = seenMovies.filter(movie => 
    movie.userRating && 
    !excludeMovieIds.includes(movie.id) &&
    (movie.mediaType || 'movie') === mediaType
  );
  
  if (availableMovies.length === 0) return null;
  
  return availableMovies[Math.floor(Math.random() * availableMovies.length)];
};

/**
 * Handle "Too Tough to Decide" logic
 */
export const handleTooToughToDecide = (currentRating, opponentRating) => {
  const averageRating = (currentRating + opponentRating) / 2;
  
  // Create very close ratings (±0.05 difference)
  const newCurrentRating = Math.min(10, Math.max(1, averageRating + 0.05));
  const newOpponentRating = Math.min(10, Math.max(1, averageRating - 0.05));
  
  return {
    currentRating: newCurrentRating,
    opponentRating: newOpponentRating
  };
};

/**
 * Pairwise rating calculation for backward compatibility
 */
export const calculatePairwiseRating = (config) => {
  const { aRating, bRating, aGames = 0, bGames = 0, result, sentiment = null, userMovies = [] } = config;
  
  // Validate result parameter
  const validResults = Object.values(ComparisonResults);
  if (!validResults.includes(result)) {
    throw new Error(`Invalid result: ${result}. Must be one of: ${validResults.join(', ')}`);
  }
  
  // Handle Round 1 case where new movie has no rating
  if (!aRating && bRating) {
    if (result === ComparisonResults.TIE) {
      // For ties, average with opponent rating
      const avgRating = bRating;
      return {
        updatedARating: Math.min(10, Math.max(1, avgRating + 0.05)),
        updatedBRating: Math.min(10, Math.max(1, avgRating - 0.05))
      };
    }
    
    // Simple logic without sentiment baselines
    let newMovieRating;
    if (result === ComparisonResults.A_WINS) {
      // New movie won - should be higher than opponent
      newMovieRating = bRating + 0.5;
    } else {
      // New movie lost - should be lower than opponent
      newMovieRating = bRating - 0.5;
    }
    
    return {
      updatedARating: Math.min(10, Math.max(1, newMovieRating)),
      updatedBRating: bRating
    };
  }
  
  // For both movies having ratings
  if (aRating && bRating) {
    if (result === ComparisonResults.TIE) {
      const averageRating = (aRating + bRating) / 2;
      return {
        updatedARating: Math.min(10, Math.max(1, averageRating + 0.05)),
        updatedBRating: Math.min(10, Math.max(1, averageRating - 0.05))
      };
    }
    
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
  
  throw new Error('Invalid pairwise rating configuration');
};

/**
 * Legacy K-factor calculation for backward compatibility
 */
export const calculateKFactor = (gamesPlayed) => {
  if (gamesPlayed < 5) return 0.5;
  if (gamesPlayed < 10) return 0.25;
  if (gamesPlayed < 20) return 0.125;
  return 0.1;
};

/**
 * Legacy expected win probability calculation
 */
export const calculateExpectedWinProbability = (ratingA, ratingB) => {
  return 1 / (1 + Math.pow(ENHANCED_RATING_CONFIG.ELO_CONFIG.BASE, (ratingB - ratingA) / ENHANCED_RATING_CONFIG.ELO_CONFIG.SCALE_FACTOR));
};

/**
 * Legacy rating calculation for InitialRatingFlow
 */
export const calculateNewRating = (currentRating, gamesPlayed, actualScore, expectedScore) => {
  const kFactor = calculateKFactor(gamesPlayed);
  const ratingChange = kFactor * 32 * (actualScore - expectedScore);
  const newRating = currentRating + ratingChange;
  
  return Math.max(1.0, Math.min(10.0, newRating));
};

// **CONSOLIDATED CALCULATION FUNCTIONS**
// Following CODE_BIBLE: Single source of truth for all rating calculations

/**
 * Consolidated ELO calculation function used by all screens
 * Replaces duplicate implementations in Home/Wildcard/Profile screens
 */
const calculateRatingFromELOComparisons = (results, selectedMovie) => {
  // Use centralized ELO calculation system (following CODE_BIBLE single-source-of-truth)
  let currentRating = null; // Start with no rating, just like the confidence-based system
  
  // Process each comparison using centralized ELO logic
  results.forEach((result, index) => {
    const opponent = result.winner === selectedMovie ? result.loser : result.winner;
    const newMovieWon = result.userChoice === 'new';
    const opponentRating = opponent.userRating || (opponent.eloRating / 100);
    
    if (currentRating === null) {
      // First comparison: use direct opponent-based calculation
      currentRating = opponentRating + (newMovieWon ? 0.5 : -0.5);
      currentRating = Math.max(1, Math.min(10, currentRating));
    } else {
      // Subsequent comparisons: use proper ELO calculation
      const comparisonResult = newMovieWon ? ComparisonResults.A_WINS : ComparisonResults.B_WINS;
      const eloResult = calculatePairwiseRating({
        aRating: currentRating,
        bRating: opponentRating,
        aGames: index,
        bGames: opponent.gamesPlayed || 5,
        result: comparisonResult
      });
      currentRating = eloResult.updatedARating;
    }
    
    console.log(`📊 Comparison ${index + 1}: ${newMovieWon ? 'WIN' : 'LOSS'} vs ${opponent.title} (${opponentRating}) -> Rating: ${currentRating?.toFixed(2)}`);
  });
  
  return currentRating;
};

/**
 * Unified opponent selection with media type filtering support
 * Consolidates all selectMovieFromPercentile implementations
 */
// Helper function to get adjacent buckets (max 1 bucket away)
const getAdjacentBuckets = (emotion) => {
  const bucketOrder = ['LOVED', 'LIKED', 'AVERAGE', 'DISLIKED'];
  const currentIndex = bucketOrder.indexOf(emotion);
  const adjacent = [];
  
  // Add immediately adjacent buckets only
  if (currentIndex > 0) adjacent.push(bucketOrder[currentIndex - 1]);
  if (currentIndex < bucketOrder.length - 1) adjacent.push(bucketOrder[currentIndex + 1]);
  
  return adjacent;
};

const selectMovieFromPercentileUnified = (seenMovies, emotion, options = {}) => {
  const { mediaType = null, excludeMovieId = null, enableMediaTypeFilter = false, enhancedLogging = false } = options;
  const percentileRanges = ENHANCED_RATING_CONFIG.PERCENTILE_RANGES;
  
  if (!seenMovies || seenMovies.length === 0) {
    if (enhancedLogging) console.log('🚨 No seen movies available');
    return null;
  }
  
  // Apply media type filtering if enabled
  let filteredMovies = seenMovies;
  if (enableMediaTypeFilter && mediaType) {
    filteredMovies = seenMovies.filter(movie => 
      movie.id !== excludeMovieId && (movie.mediaType || 'movie') === mediaType
    );
    if (enhancedLogging) {
      console.log(`🎯 Available opponents for ${mediaType}:`, filteredMovies.length);
      console.log(`🎯 Media type filter: ${mediaType}, Sample opponents:`, filteredMovies.slice(0, 3).map(m => `${m.title} (${m.mediaType || 'movie'})`));
    }
  } else {
    // Standard filtering without media type
    filteredMovies = seenMovies.filter(movie => movie.id !== excludeMovieId);
  }
  
  // Sort movies by rating to establish percentile ranges (HIGH to LOW for correct percentiles)
  const sortedMovies = [...filteredMovies].sort((a, b) => (b.userRating || 0) - (a.userRating || 0));
  
  const [minPercent, maxPercent] = percentileRanges[emotion] || [0.5, 0.75];
  const startIndex = Math.floor(sortedMovies.length * minPercent);
  const endIndex = Math.min(Math.floor(sortedMovies.length * maxPercent), sortedMovies.length - 1);
  
  if (enhancedLogging) {
    console.log(`🎯 ${emotion} percentile [${minPercent}-${maxPercent}]: indices ${startIndex}-${endIndex}`);
  }
  
  const percentileMovies = sortedMovies.slice(startIndex, endIndex + 1);
  
  if (percentileMovies.length === 0) {
    // Adjacent bucket fallback - never skip more than one bucket
    const adjacentBuckets = getAdjacentBuckets(emotion);
    
    for (const adjacentEmotion of adjacentBuckets) {
      const adjacentRange = percentileRanges[adjacentEmotion];
      const adjStartIndex = Math.floor(sortedMovies.length * adjacentRange[0]);
      const adjEndIndex = Math.min(Math.floor(sortedMovies.length * adjacentRange[1]), sortedMovies.length - 1);
      const adjacentMovies = sortedMovies.slice(adjStartIndex, adjEndIndex + 1);
      
      if (adjacentMovies.length > 0) {
        if (enhancedLogging) {
          console.log(`🔄 Fallback to adjacent bucket ${adjacentEmotion}: ${adjacentMovies[0].title} (Rating: ${adjacentMovies[0].userRating})`);
        }
        return adjacentMovies[Math.floor(Math.random() * adjacentMovies.length)];
      }
    }
    
    // Final fallback if no adjacent buckets have movies
    return sortedMovies[0];
  }
  
  // Random selection from percentile
  const randomIndex = Math.floor(Math.random() * percentileMovies.length);
  const selectedMovie = percentileMovies[randomIndex];
  
  if (enhancedLogging) {
    console.log(`🎬 Selected from ${emotion} percentile: ${selectedMovie.title} (Rating: ${selectedMovie.userRating})`);
    console.log(`🎯 Available in ${emotion} percentile:`, percentileMovies.map(m => `${m.title}(${m.userRating})`));
    console.log(`🎲 Random index: ${randomIndex} of ${percentileMovies.length} options`);
  }
  
  return selectedMovie;
};

/**
 * Unified comparison handling for all screens
 * Consolidates handleComparison logic with screen-specific behavior
 */
const handleComparisonUnified = async (screenConfig, comparisonParams) => {
  const { winner, currentComparison, comparisonMovies, selectedMovie, mediaType, setCurrentMovieRating, updateMovieInStorage } = comparisonParams;
  
  const currentComparisonMovie = comparisonMovies[currentComparison];
  
  if (currentComparison === 0) {
    // FIRST COMPARISON: Unknown vs Known (use unified pairwise calculation)
    const opponentRating = currentComparisonMovie.userRating;
    
    let result;
    if (winner === 'new') {
      result = ComparisonResults.A_WINS;
    } else if (winner === 'comparison') {
      result = ComparisonResults.B_WINS;
    } else if (winner === 'tie') {
      result = ComparisonResults.TIE;
    }
    
    const pairwiseResult = calculatePairwiseRating({
      aRating: null, // New movie has no rating yet
      bRating: opponentRating, // Opponent rating
      aGames: 0, // New movie has no games
      bGames: currentComparisonMovie.gamesPlayed || 5,
      result: result
    });
    
    const derivedRating = pairwiseResult.updatedARating;
    const opponentNewRating = pairwiseResult.updatedBRating;
    
    setCurrentMovieRating(derivedRating);
    
    // Update opponent rating if it changed
    if (opponentNewRating !== opponentRating && updateMovieInStorage) {
      currentComparisonMovie.userRating = opponentNewRating;
      await updateMovieInStorage(currentComparisonMovie, opponentNewRating);
    }
    
    console.log(`🎯 Round 1 result: ${winner} -> Derived rating: ${derivedRating?.toFixed(2)}, Opponent updated: ${opponentNewRating?.toFixed(2)}`);
    
    return { derivedRating, opponentNewRating, isComplete: false };
  }
  
  // Subsequent comparisons handled by existing logic
  return null;
};

/**
 * Simple utility for calculating average ratings
 * Used in "Too Tough to Decide" scenarios
 */
const calculateAverageRating = (rating1, rating2) => {
  const avg = (rating1 + rating2) / 2;
  return Math.max(1, Math.min(10, avg));
};

export {
  EnhancedRatingButton,
  QuickRatingButton,
  CompactRatingButton,
  SentimentRatingModal,
  ConfidenceBasedComparison,
  getRatingCategory,
  calculateDynamicRatingCategories,
  selectOpponentFromPercentile,
  processUnifiedRatingFlow,
  updateRatingWithConfidence,
  calculateConfidenceInterval,
  hasTargetConfidence,
  CONFIDENCE_RATING_CONFIG,
  // Consolidated calculation functions
  calculateRatingFromELOComparisons,
  selectMovieFromPercentileUnified,
  handleComparisonUnified,
  calculateAverageRating
};