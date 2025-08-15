import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Alert, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MovieCard from './MovieCard/MovieCard';

// Console log to verify file is loading
console.log('✅ Enhanced Confidence-Based Rating System loaded successfully!');

// Import storage keys to match the main data hook
import { STORAGE_KEYS } from '../config/storageConfig';

// Dynamic storage keys based on media type (matching useMovieData hook)
const getStorageKey = (mediaType) => mediaType === 'movie' ? STORAGE_KEYS.MOVIES.SEEN : STORAGE_KEYS.TV_SHOWS.SEEN;

/**
 * Get sentiment-aware starting rating based on user's history and emotion
 * Combines consultant's good idea with user data respect
 */
const getSentimentBaseline = (sentiment, userMovies = []) => {
  const baseline = ENHANCED_RATING_CONFIG.SENTIMENT_BASELINES[sentiment];
  if (!baseline) return 5.5; // fallback
  
  // If user has insufficient data, use sentiment fallback
  if (!userMovies || userMovies.length < 10) {
    return baseline.fallback;
  }
  
  // Find user's typical ratings in this sentiment range
  const userRatings = userMovies
    .map(m => m.userRating)
    .filter(r => r != null)
    .sort((a, b) => a - b);
    
  if (userRatings.length < 5) {
    return baseline.fallback;
  }
  
  // Calculate user's actual sentiment ranges based on percentiles
  let sentimentMovies = [];
  
  if (sentiment === 'LOVED') {
    // Top 25% of user's ratings
    const cutoff = Math.floor(userRatings.length * 0.75);
    sentimentMovies = userRatings.slice(cutoff);
  } else if (sentiment === 'LIKED') {
    // 50-75% percentile
    const start = Math.floor(userRatings.length * 0.50);
    const end = Math.floor(userRatings.length * 0.75);
    sentimentMovies = userRatings.slice(start, end);
  } else if (sentiment === 'AVERAGE') {
    // 25-50% percentile  
    const start = Math.floor(userRatings.length * 0.25);
    const end = Math.floor(userRatings.length * 0.50);
    sentimentMovies = userRatings.slice(start, end);
  } else if (sentiment === 'DISLIKED') {
    // Bottom 25%
    const end = Math.floor(userRatings.length * 0.25);
    sentimentMovies = userRatings.slice(0, end);
  }
  
  if (sentimentMovies.length > 0) {
    // Use user's actual average for this sentiment
    const userSentimentAvg = sentimentMovies.reduce((a, b) => a + b, 0) / sentimentMovies.length;
    
    // Ensure it's reasonable (within broad bounds)
    const { idealRange } = baseline;
    return Math.max(idealRange[0] - 1, Math.min(idealRange[1] + 1, userSentimentAvg));
  }
  
  return baseline.fallback;
};

// **UNIFIED RATING KERNEL CONFIGURATION**
// Following CODE_BIBLE: Single-source mathematical model with clear assumptions
const UNIFIED_RATING_CONFIG = {
  RATING_BOUNDS: {
    MIN: 1,
    MAX: 10,
    DEFAULT_INITIAL: null // Always start unrated for sentiment-based placement
  },
  
  // **SINGLE PROBABILITY MODEL: Bradley-Terry Logistic**
  // P(A beats B) = 1 / (1 + exp(-(rating_A - rating_B) / scale))
  PROBABILITY: {
    SCALE: 1.8, // Logistic scale parameter (controls spread)
    MODEL: 'bradley-terry-logistic'
  },
  
  // **UNIFIED UNCERTAINTY SCHEDULE**
  // σ (standard error) directly drives K-factor via information theory
  UNCERTAINTY: {
    INITIAL: 2.0,           // Starting uncertainty (rating points)
    MIN: 0.1,               // Minimum uncertainty when highly confident
    DECAY_RATE: 0.85,       // How fast uncertainty shrinks with info
    K_MULTIPLIER: 48        // K = K_MULTIPLIER * σ
  },
  
  // **STOPPING CRITERIA**
  CONFIDENCE: {
    TARGET_INTERVAL_WIDTH: 0.3, // Stop when 95% CI < 0.3 points
    MIN_COMPARISONS: 3,
    MAX_COMPARISONS: 15,
    CONFIDENCE_LEVEL: 0.95
  },
  
  // **SENTIMENT BASELINES** (unchanged - user-tested)
  SENTIMENT_BASELINES: {
    'LOVED': { idealRange: [8.5, 9.5], fallback: 9.0 },
    'LIKED': { idealRange: [7.0, 8.5], fallback: 7.5 },
    'AVERAGE': { idealRange: [5.5, 7.0], fallback: 6.0 },
    'DISLIKED': { idealRange: [3.0, 5.5], fallback: 4.0 },
    'HATED': { idealRange: [1.0, 3.0], fallback: 2.5 }
  },

  // **PERCENTILE RANGES** (for opponent selection)
  PERCENTILE_RANGES: {
    'LOVED': [0.75, 1.0],   // Top 25% of ratings
    'LIKED': [0.5, 0.75],   // 50-75th percentile  
    'AVERAGE': [0.25, 0.5], // 25-50th percentile
    'DISLIKED': [0.0, 0.25] // Bottom 25% of ratings
  },

  // **DYNAMIC PERCENTILE RANGES** (adaptive based on user data)
  DYNAMIC_PERCENTILE_RANGES: {
    'LOVED': [0.75, 1.0],
    'LIKED': [0.5, 0.75],
    'AVERAGE': [0.25, 0.5], 
    'DISLIKED': [0.0, 0.25]
  },

  // **UI COLORS** (for confidence indicators)
  COLORS: {
    CONFIDENCE_HIGH: '#4CAF50',   // Green - high confidence
    CONFIDENCE_MEDIUM: '#FF9800', // Orange - medium confidence  
    CONFIDENCE_LOW: '#F44336',    // Red - low confidence
    LIKED: '#4CAF50'              // Default liked color
  },

  // **LEGACY ELO CONFIG** (for backward compatibility - will be removed)
  ELO_CONFIG: {
    SCALE_FACTOR: 10,       // ELO to 10-point scale conversion
    BASE: 10,               // Base for probability calculations
    DIVISOR: 400,           // Standard ELO divisor
    TIE_SCORE: 0.5          // Score for ties
  }
};

// **CONFIDENCE-BASED RATING SYSTEM CONFIGURATION** (alias for backward compatibility)
const CONFIDENCE_RATING_CONFIG = UNIFIED_RATING_CONFIG;

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
// calculateConfidenceInterval removed - now handled internally by unifiedRatingKernel
};

/**
 * Calculate standard error based on number of comparisons and rating variance
 * Uses Bayesian approach for uncertainty estimation
 */
// calculateStandardError removed - now handled internally by unifiedRatingKernel

/**
 * INFORMATION GAIN CALCULATION (Updated for unified kernel)
 * Higher information gain = better opponent choice for rating convergence
 */
const calculateInformationGain = (currentRating, currentStandardError, opponentRating, opponentStandardError) => {
  // **UNIFIED PROBABILITY MODEL**: Bradley-Terry logistic
  const ratingDiff = currentRating - opponentRating;
  const expectedWinProb = 1 / (1 + Math.exp(-ratingDiff / UNIFIED_RATING_CONFIG.PROBABILITY.SCALE));
  
  // Information gain maximized when outcome is most uncertain (p=0.5)
  // Also weight by opponent's rating reliability
  const outcomeUncertainty = 4 * expectedWinProb * (1 - expectedWinProb); // Max at p=0.5
  const opponentReliability = 1 / (1 + opponentStandardError); // More reliable = more info
  
  return outcomeUncertainty * opponentReliability;
};

/**
 * Select optimal opponent for maximum information gain
 * Balances rating similarity with opponent reliability
 */
const selectOptimalOpponent = (currentRating, currentStandardError, availableOpponents, excludeIds = [], mediaType) => {
  const validOpponents = availableOpponents.filter(movie => 
    movie.userRating && 
    !excludeIds.includes(movie.id) &&
    (!mediaType || (movie.mediaType || 'movie') === mediaType) &&
    movie.ratingStats && // Must have confidence statistics
    movie.ratingStats.standardError !== undefined
  );
  
  if (validOpponents.length === 0) {
    // Fallback to random selection if no confidence stats available
    const fallbackOpponents = availableOpponents.filter(movie => 
      movie.userRating && 
      !excludeIds.includes(movie.id) &&
      (!mediaType || (movie.mediaType || 'movie') === mediaType)
    );
    return fallbackOpponents[Math.floor(Math.random() * fallbackOpponents.length)] || null;
  }
  
  // Calculate information gain for each opponent
  const opponentsWithGain = validOpponents.map(opponent => ({
    ...opponent,
    informationGain: calculateInformationGain(
      currentRating,
      currentStandardError,
      opponent.userRating,
      opponent.ratingStats.standardError
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
  
  const percentileRange = UNIFIED_RATING_CONFIG.PERCENTILE_RANGES[sentiment];
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
  
  const selectedOpponent = moviesInRange[Math.floor(Math.random() * moviesInRange.length)] || sortedMovies[0];
  console.log('✅ Final selected opponent:', selectedOpponent ? `${selectedOpponent.title}: ${selectedOpponent.userRating}` : 'None');
  
  return selectedOpponent;
};

/**
 * CONFIDENCE-BASED RATING ENGINE
 * Replaces fixed 3-comparison system with adaptive confidence-based approach
 */

/**
 * UNIFIED RATING KERNEL
 * Following CODE_BIBLE: Single probability model, unified math, explicit error handling
 */
const unifiedRatingKernel = (currentStats, opponentRating, result, opponentStats = null) => {
  // **VALIDATION** - CODE_BIBLE: Never assume, validate inputs
  if (!currentStats) {
    throw new Error('Current stats required for rating update');
  }
  if (typeof opponentRating !== 'number' || opponentRating < 1 || opponentRating > 10) {
    throw new Error('Valid opponent rating (1-10) required');
  }
  if (!['win', 'loss', 'tie'].includes(result)) {
    throw new Error('Result must be win, loss, or tie');
  }

  // **CURRENT STATE EXTRACTION**
  const currentRating = currentStats.rating; // Can be null for first comparison
  const currentUncertainty = currentStats.standardError || UNIFIED_RATING_CONFIG.UNCERTAINTY.INITIAL;
  const comparisons = currentStats.comparisons || 0;

  // **UNIFIED PROBABILITY MODEL: Bradley-Terry Logistic**
  // P(A beats B) = 1 / (1 + exp(-(rating_A - rating_B) / scale))
  const calculateWinProbability = (ratingA, ratingB) => {
    const diff = ratingA - ratingB;
    return 1 / (1 + Math.exp(-diff / UNIFIED_RATING_CONFIG.PROBABILITY.SCALE));
  };

  // **RESULT SCORING**
  const actualScore = {
    'win': 1.0,
    'loss': 0.0,
    'tie': 0.5
  }[result];

  // **UNCERTAINTY-DRIVEN K-FACTOR**
  // K = K_MULTIPLIER * σ (directly tied to uncertainty)
  const kFactor = UNIFIED_RATING_CONFIG.UNCERTAINTY.K_MULTIPLIER * currentUncertainty;

  let newRating;
  let newUncertainty;

  if (currentRating === null) {
    // **FIRST COMPARISON: Initialize rating based on result**
    if (result === 'win') {
      newRating = Math.min(10, opponentRating + 1.0);
    } else if (result === 'loss') {
      newRating = Math.max(1, opponentRating - 1.0);
    } else { // tie
      newRating = opponentRating;
    }
    
    // Start with reduced uncertainty after first comparison
    newUncertainty = currentUncertainty * UNIFIED_RATING_CONFIG.UNCERTAINTY.DECAY_RATE;
  } else {
    // **SUBSEQUENT COMPARISONS: Update using Bradley-Terry model**
    const expectedScore = calculateWinProbability(currentRating, opponentRating);
    const prediction_error = actualScore - expectedScore;
    
    // Apply update with bounds checking
    const ratingChange = kFactor * prediction_error;
    newRating = Math.max(
      UNIFIED_RATING_CONFIG.RATING_BOUNDS.MIN,
      Math.min(UNIFIED_RATING_CONFIG.RATING_BOUNDS.MAX, currentRating + ratingChange)
    );
    
    // **UNCERTAINTY UPDATE: Decreases with information gained**
    // More uncertain predictions give more information when resolved
    const informationGain = Math.abs(prediction_error);
    const uncertaintyReduction = UNIFIED_RATING_CONFIG.UNCERTAINTY.DECAY_RATE * informationGain;
    newUncertainty = Math.max(
      UNIFIED_RATING_CONFIG.UNCERTAINTY.MIN,
      currentUncertainty * (1 - uncertaintyReduction)
    );
  }

  // **UPDATED STATISTICS**
  const newComparisons = comparisons + 1;
  const newWins = (currentStats.wins || 0) + (result === 'win' ? 1 : 0);
  const newLosses = (currentStats.losses || 0) + (result === 'loss' ? 1 : 0);
  const newTies = (currentStats.ties || 0) + (result === 'tie' ? 1 : 0);

  // **CONFIDENCE INTERVAL CALCULATION**
  // 95% CI = rating ± 1.96 * σ
  const margin = 1.96 * newUncertainty;
  const confidenceInterval = {
    lower: Math.max(1, newRating - margin),
    upper: Math.min(10, newRating + margin),
    width: 2 * margin,
    level: UNIFIED_RATING_CONFIG.CONFIDENCE.CONFIDENCE_LEVEL
  };

  // **RETURN UPDATED STATS**
  return {
    rating: newRating,
    standardError: newUncertainty,
    comparisons: newComparisons,
    wins: newWins,
    losses: newLosses,
    ties: newTies,
    confidenceInterval,
    lastUpdated: new Date().toISOString(),
    // Debugging info
    debug: {
      kFactor,
      informationGain: currentRating ? Math.abs(actualScore - calculateWinProbability(currentRating, opponentRating)) : 'first_comparison',
      model: 'unified-bradley-terry'
    }
  };
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
  return comparisons >= UNIFIED_RATING_CONFIG.CONFIDENCE.MIN_COMPARISONS &&
         intervalWidth <= UNIFIED_RATING_CONFIG.CONFIDENCE.TARGET_INTERVAL_WIDTH;
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
      rating: null, // start unrated so round 1 honors sentiment
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
          movieStats.rating,
          movieStats.standardError,
          availableMovies,
          [...usedOpponentIds, newMovie.id],
          mediaType
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
        result = 'tie';
      } else if (userChoice === 'new') {
        result = 'win';
      } else {
        result = 'loss';
      }

      // Update movie statistics using unified kernel
      const previousStats = { ...movieStats };
      movieStats = unifiedRatingKernel(movieStats, opponent.userRating, result, opponent.ratingStats);

      // Record comparison in history
      comparisonHistory.push({
        comparison: comparisonCount,
        opponent: opponent.title,
        result: userChoice,
        ratingBefore: previousStats.rating,
        ratingAfter: movieStats.rating,
        confidenceInterval: movieStats.confidenceInterval,
        informationGain: movieStats.rating !== null ? calculateInformationGain(
          previousStats.rating || 5.5,
          previousStats.standardError,
          opponent.userRating,
          opponent.ratingStats?.standardError || 1.0
        ) : null
      });

      // Update opponent's statistics as well (if they have stats)
      if (opponent.ratingStats) {
        const opponentResult = result === 'win' ? 'loss' :
                             result === 'loss' ? 'win' :
                             'tie';
        
        const updatedOpponentStats = unifiedRatingKernel(
          opponent.ratingStats,
          movieStats.rating,
          opponentResult,
          movieStats
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
    return {
      success: false,
      error: error.message
    };
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
    .map(m => m.userRating || (m.eloRating / UNIFIED_RATING_CONFIG.ELO_CONFIG.SCALE_FACTOR))
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
        percentile: UNIFIED_RATING_CONFIG.PERCENTILE_RANGES.LOVED, 
        color: ENHANCED_RATING_CONFIG.COLORS.LOVED, 
        borderColor: ENHANCED_RATING_CONFIG.BORDER_COLORS.LOVED, 
        label: 'Love', 
        description: 'This was amazing!' 
      },
      LIKED: { 
        percentile: UNIFIED_RATING_CONFIG.PERCENTILE_RANGES.LIKED, 
        color: ENHANCED_RATING_CONFIG.COLORS.LIKED, 
        borderColor: ENHANCED_RATING_CONFIG.BORDER_COLORS.LIKED, 
        label: 'Like', 
        description: 'Pretty good!' 
      },
      AVERAGE: { 
        percentile: UNIFIED_RATING_CONFIG.PERCENTILE_RANGES.AVERAGE, 
        color: ENHANCED_RATING_CONFIG.COLORS.AVERAGE, 
        borderColor: ENHANCED_RATING_CONFIG.BORDER_COLORS.AVERAGE, 
        label: 'Okay', 
        description: 'Nothing special' 
      },
      DISLIKED: { 
        percentile: UNIFIED_RATING_CONFIG.PERCENTILE_RANGES.DISLIKED, 
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
    .map(m => m.userRating || (m.eloRating / UNIFIED_RATING_CONFIG.ELO_CONFIG.SCALE_FACTOR))
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
      percentile: UNIFIED_RATING_CONFIG.DYNAMIC_PERCENTILE_RANGES.LOVED,
      color: ENHANCED_RATING_CONFIG.COLORS.LOVED,
      borderColor: ENHANCED_RATING_CONFIG.BORDER_COLORS.LOVED,
      label: 'Love',
      description: 'This was amazing!'
    },
    LIKED: { 
      percentile: UNIFIED_RATING_CONFIG.DYNAMIC_PERCENTILE_RANGES.LIKED,
      color: ENHANCED_RATING_CONFIG.COLORS.LIKED,
      borderColor: ENHANCED_RATING_CONFIG.BORDER_COLORS.LIKED,
      label: 'Like',
      description: 'Pretty good!'
    },
    AVERAGE: { 
      percentile: UNIFIED_RATING_CONFIG.DYNAMIC_PERCENTILE_RANGES.AVERAGE,
      color: ENHANCED_RATING_CONFIG.COLORS.AVERAGE,
      borderColor: ENHANCED_RATING_CONFIG.BORDER_COLORS.AVERAGE,
      label: 'Okay',
      description: 'Nothing special'
    },
    DISLIKED: { 
      percentile: UNIFIED_RATING_CONFIG.DYNAMIC_PERCENTILE_RANGES.DISLIKED,
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
// eloUpdate function removed - replaced by unifiedRatingKernel

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
    const p0 = targetPercentile[0] <= 1 ? targetPercentile[0] : targetPercentile[0] / 100;
    const p1 = targetPercentile[1] <= 1 ? targetPercentile[1] : targetPercentile[1] / 100;
    const startIndex = Math.floor(p0 * totalMovies);
    const endIndex = Math.ceil(p1 * totalMovies);
    
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
const ConfidenceBasedComparison = ({ 
  visible, 
  newMovie, 
  availableMovies,
  selectedSentiment, 
  onClose, 
  onComparisonComplete,
  colors,
  mediaType = 'movie'
}) => {
  const [currentComparison, setCurrentComparison] = useState(0);
  const [currentOpponent, setCurrentOpponent] = useState(null);
  const [movieStats, setMovieStats] = useState({
    rating: null, // Start unrated for true sentiment-based placement
    standardError: CONFIDENCE_RATING_CONFIG.CONFIDENCE.INITIAL_UNCERTAINTY,
    comparisons: 0,
    wins: 0,
    losses: 0,
    ties: 0,
    confidenceInterval: null
  });
  const [comparisonHistory, setComparisonHistory] = useState([]);
  const [isComplete, setIsComplete] = useState(false);
  const [usedOpponentIds, setUsedOpponentIds] = useState([]);

  // **DETERMINISTIC PLACEMENT STATE**
  const [placementState, setPlacementState] = useState(() => {
    const sortedRatings = availableMovies
      .map(m => m.userRating)
      .filter(r => r != null)
      .sort((a, b) => a - b);
    
    const bands = [
      [0.0, 0.25],   // LOVED: Top 25%
      [0.25, 0.50],  // LIKED: Upper-middle 25%
      [0.50, 0.75],  // AVERAGE: Lower-middle 25%
      [0.75, 1.0]    // DISLIKED: Bottom 25%
    ];
    
    // Start from sentiment band
    const sentimentToBand = {
      'LOVED': 0,
      'LIKED': 1,
      'AVERAGE': 2,
      'DISLIKED': 3
    };
    
    const currentBand = sentimentToBand[selectedSentiment] || 1; // Default to LIKED if unknown
    
    return {
      sorted: sortedRatings,
      bands: bands,
      currentBand: currentBand,
      lastOpponent: null
    };
  });

  // **PLACEMENT HELPER FUNCTIONS**
  const pickOpponentFromBand = useCallback((seen, bandIndex, excludeIds = []) => {
    const [minPercentile, maxPercentile] = placementState.bands[bandIndex];
    const sortedMovies = seen
      .filter(m => m.userRating != null && !excludeIds.includes(m.id))
      .filter(m => (m.mediaType || 'movie') === mediaType) // FIXED: Add mediaType safety
      .sort((a, b) => a.userRating - b.userRating);
    
    if (sortedMovies.length === 0) return null;
    
    const minIndex = Math.floor(minPercentile * sortedMovies.length);
    const maxIndex = Math.min(Math.ceil(maxPercentile * sortedMovies.length), sortedMovies.length - 1);
    
    const bandMovies = sortedMovies.slice(minIndex, maxIndex + 1);
    if (bandMovies.length === 0) return null;
    
    // Sample one randomly from the band
    const randomIndex = Math.floor(Math.random() * bandMovies.length);
    return bandMovies[randomIndex];
  }, [placementState.bands, mediaType]);

  const placeAfterResult = useCallback((currentRating, opponentRating, didWin) => {
    // Handle null rating (first comparison)
    if (currentRating === null) {
      if (didWin) {
        // Place slightly above opponent
        return Math.min(10, opponentRating + 0.2);
      } else {
        // Place slightly below opponent
        return Math.max(1, opponentRating - 0.2);
      }
    }
    
    if (didWin) {
      // **EDGE CASE: If opponent = 10.0 and user picks new movie → set 10.0 (cap)**
      if (opponentRating >= 10.0) {
        return 10.0;
      }
      // Move above opponent
      const step = 0.15;
      return Math.min(10, Math.max(opponentRating + step, currentRating));
    } else {
      // **CRITICAL FIX: Move rating DOWN on losses (CODE_BIBLE: "Write code that's clear and obvious")**
      if (opponentRating <= 1.0) {
        return 1.0;
      }
      // Move below opponent  
      const step = 0.15;
      return Math.max(1, Math.min(opponentRating - step, currentRating));
    }
  }, []);

  const nextBandOnLoss = useCallback(() => {
    setPlacementState(prev => ({
      ...prev,
      currentBand: Math.min(prev.bands.length - 1, prev.currentBand + 1)
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

  // Get next opponent - sentiment-based for first, optimal for rest
  const getNextOpponent = useCallback(() => {
    // **PATCH #4: True sentiment-based first opponent**
    const opponent = movieStats.rating == null
      ? selectInitialOpponent(selectedSentiment, availableMovies.filter(m => (m.mediaType||'movie')===mediaType), [...usedOpponentIds, newMovie.id])
      : selectOptimalOpponent(
          movieStats.rating ?? 5.5,
          movieStats.standardError ?? CONFIDENCE_RATING_CONFIG.CONFIDENCE.INITIAL_UNCERTAINTY,
          availableMovies,
          [...usedOpponentIds, newMovie.id],
          mediaType
        );
    
    return opponent;
  }, [movieStats.rating, movieStats.standardError, selectedSentiment, availableMovies, usedOpponentIds, newMovie.id, mediaType]);

  // Initialize comparison on modal open
  useEffect(() => {
    if (visible && !currentOpponent) {
      // **EDGE CASE: Handle tiny library**
      if (availableMovies.length < 3) {
        console.log('📚 Tiny library detected, using suggestedRating without comparisons');
        setTimeout(() => {
          onComparisonComplete({
            finalRating: Math.max(1, Math.min(10, newMovie?.suggestedRating ?? 7.0)),
            ratingStats: {
              rating: Math.max(1, Math.min(10, newMovie?.suggestedRating ?? 7.0)),
              standardError: 0.15,
              comparisons: 0,
              wins: 0,
              losses: 0,
              ties: 0,
              confidenceInterval: { lower: 6, upper: 8, width: 2 }
            },
            comparisonHistory: [],
            targetConfidenceReached: false
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

    // **PATCH #2: Seed from sentiment if first comparison**
    let seedStats = movieStats;
    if (seedStats.rating == null) {
      const seed = getSentimentBaseline(selectedSentiment, availableMovies);
      seedStats = { ...movieStats, rating: seed };
      console.log(`🎯 Seeded rating from sentiment ${selectedSentiment}: ${seed}`);
    }

    // **PATCH #3: Use unified kernel (no deterministic placement)**
    const outcome = userChoice === 'new' ? 1 : (userChoice === 'too_tough' ? 0.5 : 0);

    // Build opponent stats
    const oppStats = {
      rating: currentOpponent.userRating ?? 5.5,
      standardError: currentOpponent.ratingStats?.standardError ?? CONFIDENCE_RATING_CONFIG.CONFIDENCE.INITIAL_UNCERTAINTY,
      comparisons: currentOpponent.ratingStats?.comparisons ?? 5
    };

    // Use unified confidence engine
    const updated = unifiedRatingKernel(
      seedStats,
      oppStats.rating,
      outcome === 1 ? 'win' : outcome === 0 ? 'loss' : 'tie',
      oppStats
    );
    
    setMovieStats(updated);

    // Record comparison in history
    const comparisonRecord = {
      comparison: currentComparison,
      opponent: currentOpponent.title,
      result: userChoice,
      ratingBefore: seedStats.rating,
      ratingAfter: updated.rating,
      confidenceInterval: updated.confidenceInterval
    };
    setComparisonHistory(prev => [...prev, comparisonRecord]);

    // Update used opponents
    setUsedOpponentIds(prev => [...prev, currentOpponent.id]);
    
    // Update placement state
    setPlacementState(prev => ({
      ...prev,
      lastOpponent: { id: currentOpponent.id, rating: currentOpponent.userRating }
    }));

    console.log(`📊 Comparison ${currentComparison}: Rating ${updated.rating?.toFixed(2)} ± ${updated.confidenceInterval?.width?.toFixed(2)}`);

    // **FIXED STOPPING CRITERIA** (CODE_BIBLE: "Handle errors explicitly")
    const shouldStop = (() => {
      // Minimum rounds safety check
      if (updated.comparisons < 3) return false;
      
      // Primary: Target confidence reached
      const targetConfidenceReached = updated.confidenceInterval?.width <= 
        CONFIDENCE_RATING_CONFIG.CONFIDENCE.TARGET_INTERVAL_WIDTH;
      if (targetConfidenceReached && updated.comparisons >= 3) return true;
      
      // Secondary: Rating stability (only check if we have enough history)
      if (updated.comparisons >= 4 && comparisonHistory.length >= 2) {
        const lastTwoChanges = comparisonHistory.slice(-2);
        const totalChange = Math.abs(
          lastTwoChanges[1]?.ratingAfter - lastTwoChanges[0]?.ratingAfter
        );
        if (totalChange < 0.15) return true; // Stable rating found
      }
      
      // Hard limits
      return updated.comparisons >= 6 || // Maximum rounds
             availableMovies.length <= usedOpponentIds.length + 1; // No opponents
    })();

    if (shouldStop) {
      // Rating complete
      setIsComplete(true);
      setTimeout(() => {
        onComparisonComplete({
          finalRating: updated.rating,
          ratingStats: updated,
          comparisonHistory: [...comparisonHistory, comparisonRecord],
          targetConfidenceReached: updated.confidenceInterval?.width <= CONFIDENCE_RATING_CONFIG.CONFIDENCE.TARGET_INTERVAL_WIDTH
        });
      }, 2000);
    } else {
      // **PATCH #3: Simplified opponent selection using unified kernel**
      const nextOpponent = selectOptimalOpponent(
        updated.rating ?? 5.5,
        updated.standardError ?? CONFIDENCE_RATING_CONFIG.CONFIDENCE.INITIAL_UNCERTAINTY,
        availableMovies,
        [...usedOpponentIds, newMovie.id],
        mediaType
      );

      if (nextOpponent) {
        setCurrentOpponent(nextOpponent);
        setCurrentComparison(prev => prev + 1);
      } else {
        // No more opponents available
        setIsComplete(true);
        setTimeout(() => {
          onComparisonComplete({
            finalRating: updated.rating,
            ratingStats: updated,
            comparisonHistory: [...comparisonHistory, comparisonRecord],
            targetConfidenceReached: updated.confidenceInterval?.width <= CONFIDENCE_RATING_CONFIG.CONFIDENCE.TARGET_INTERVAL_WIDTH
          });
        }, 2000);
      }
    }
  }, [currentOpponent, movieStats, currentComparison, comparisonHistory, getNextOpponent, onComparisonComplete]);


  const resetComparison = () => {
    setCurrentComparison(0);
    setCurrentOpponent(null);
    setMovieStats({
      rating: null, // Start unrated for true sentiment-based placement
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



                
                {/* VS Indicator with Confidence */}
                <View style={styles.vsIndicatorWildcard}>

                </TouchableOpacity>
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
            // **FIXED COMPLETION SCREEN** - Uses actual tracked data (movieStats, comparisonHistory)
            <View style={styles.completionScreen}>
              <View style={[styles.completionHeader, { borderBottomColor: colors.border?.color || '#333' }]}>
                <Text style={[styles.completionTitle, { color: colors.text }]}>
                  Rating Calculated!
                </Text>
                <View style={[styles.winsBadge, { backgroundColor: colors.accent }]}>
                  <Text style={styles.winsText}>
                    {comparisonHistory.filter(r => r.result === 'new').length}/{movieStats.comparisons} Wins
                  </Text>
                </View>
                
                {/* Show final rating with confidence interval */}
                <View style={[styles.ratingPreview, { borderColor: colors.accent }]}>
                  <Text style={[styles.ratingPreviewLabel, { color: colors.subText }]}>Final Rating:</Text>
                  <View style={styles.ratingPreviewValue}>
                    <Ionicons name="star" size={16} color={colors.accent} />
                    <Text style={[styles.ratingPreviewText, { color: colors.accent }]}>
                      {(movieStats.rating ?? newMovie?.suggestedRating ?? 7.0).toFixed(1)}/10
                    </Text>
                    {movieStats.confidenceInterval && (
                      <Text style={[styles.confidenceText, { color: colors.subText }]}>
                        ±{(movieStats.confidenceInterval.width ?? 0).toFixed(2)}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
              
              <View style={styles.resultsContainer}>
                <Text style={[styles.resultsHeader, { color: colors.text }]}>Comparison Results:</Text>
                {comparisonHistory.map((record, index) => (
                  <View key={index} style={[styles.resultRowWildcard, { borderLeftColor: record.result === 'new' ? '#4CAF50' : record.result === 'too_tough' ? '#FF9800' : '#F44336' }]}>
                    <View style={styles.resultContent}>
                      <Text style={[styles.resultNumber, { color: colors.accent }]}>
                        #{record.comparison}
                      </Text>
                      <Text style={[styles.resultText, { color: colors.text }]}>
                        vs {record.opponent}
                      </Text>
                      <View style={[styles.resultBadge, { backgroundColor: record.result === 'new' ? '#4CAF50' : record.result === 'too_tough' ? '#FF9800' : '#F44336' }]}>
                        <Text style={styles.resultBadgeText}>
                          {record.result === 'new' ? 'WON' : record.result === 'too_tough' ? 'TIE' : 'LOST'}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
                
                <View style={[styles.performanceSummary, { backgroundColor: colors.card || 'rgba(255,255,255,0.05)' }]}>
                  <Text style={[styles.performanceSummaryText, { color: colors.subText }]}>
                    Performance Summary: 
                    <Text style={{ color: colors.accent, fontWeight: 'bold' }}>
                      {movieStats.wins} wins, {movieStats.losses} losses, {movieStats.ties} ties
                    </Text>
                  </Text>
                  {movieStats.confidenceInterval && (
                    <Text style={[styles.performanceSummaryText, { color: colors.subText, fontSize: 12 }]}>
                      Target confidence {movieStats.confidenceInterval.width <= CONFIDENCE_RATING_CONFIG.CONFIDENCE.TARGET_INTERVAL_WIDTH ? '✅ reached' : '⚠️ not reached'}
                    </Text>
                  )}
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
  }, [seen, movie, genres, handleConfirmRating]);

  const handleComparisonComplete = useCallback((result) => {
    console.log('✅ Confidence-based comparison complete:', result);
    setComparisonModalVisible(false);
    
    // Handle both old format (just rating) and new format (object with stats)
    const finalRating = typeof result === 'number' ? result : result.finalRating;
    const ratingStats = typeof result === 'object' ? result.ratingStats : null;
    
    console.log(`🎯 Final Rating: ${finalRating?.toFixed(2)} with confidence ±${ratingStats?.confidenceInterval?.width?.toFixed(2) || 'Unknown'}`);
    console.log(`📊 Comparisons: ${ratingStats?.comparisons || 'Unknown'}, Target reached: ${result.targetConfidenceReached || false}`);
    
    handleConfirmRating(finalRating, ratingStats);
  }, [handleConfirmRating]);

  const handleConfirmRating = useCallback((finalRating, ratingStats = null) => {
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
    
    // Create confidence-based success message
    const confidenceInfo = ratingStats ? 
      `Confidence: ±${ratingStats.confidenceInterval?.width?.toFixed(2) || 'Unknown'} (${ratingStats.comparisons} comparisons)` :
      'Standard rating applied';
    
    const targetReached = ratingStats?.confidenceInterval?.width <= CONFIDENCE_RATING_CONFIG.CONFIDENCE.TARGET_INTERVAL_WIDTH;
    
    Alert.alert(
      `Rating Complete!`, 
      `You ${categoryLabel.toLowerCase()} "${movie.title}" (${finalRating.toFixed(1)}/10)\n\n${confidenceInfo}\n${targetReached ? '✅ Target confidence reached!' : '⚠️ Stopped at maximum comparisons'}`,
      [
        {
          text: "Perfect!",
          onPress: () => {
            console.log('🏠 Confidence-based rating completed, returning to app');
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
    marginTop: 12,
    marginBottom: 8,
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
  targetLabel: {
    fontSize: 10,
    marginLeft: 4,
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
    .map(m => m.userRating || (m.eloRating / UNIFIED_RATING_CONFIG.ELO_CONFIG.SCALE_FACTOR))
    .filter(r => r && !isNaN(r))
    .sort((a, b) => a - b);
  
  // Find rating's percentile position (FIXED: Normalize to 0-1)
  const position = sortedRatings.findIndex(r => r >= rating);
  const pct = position === -1 ? 1 : position / sortedRatings.length; // 0..1
  
  for (const [key, category] of Object.entries(categories)) {
    const [lo, hi] = category.percentile; // assumed 0..1
    if (pct >= lo && pct <= hi) {
      return { key, ...category };
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
  const expectedWinProbability = 1 / (1 + Math.pow(UNIFIED_RATING_CONFIG.ELO_CONFIG.BASE, (loserRating - winnerRating) / UNIFIED_RATING_CONFIG.ELO_CONFIG.SCALE_FACTOR));
  
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
 * Pairwise rating calculation using unified kernel
 * Updated to use the new unified rating system
 */
export const calculatePairwiseRating = (config) => {
  const { 
    aRating, 
    bRating, 
    aGames = 0, 
    bGames = 0, 
    result,
    sentiment = null,
    userMovies = []
  } = config;

  // Convert old result format to new format
  let unifiedResult;
  if (result === ComparisonResults.A_WINS) {
    unifiedResult = 'win';
  } else if (result === ComparisonResults.B_WINS) {
    unifiedResult = 'loss';
  } else {
    unifiedResult = 'tie';
  }

  // Handle case where movie A has no rating (first comparison)
  if (!aRating && bRating) {
    const initialStats = {
      rating: null,
      standardError: UNIFIED_RATING_CONFIG.UNCERTAINTY.INITIAL,
      comparisons: 0,
      wins: 0,
      losses: 0,
      ties: 0
    };
    
    const updatedStats = unifiedRatingKernel(initialStats, bRating, unifiedResult);
    
    return {
      updatedARating: updatedStats.rating,
      updatedBRating: bRating // Opponent rating unchanged in simple mode
    };
  }

  // Handle case where both movies have ratings
  if (aRating && bRating) {
    const aStats = {
      rating: aRating,
      standardError: Math.max(UNIFIED_RATING_CONFIG.UNCERTAINTY.MIN, 
                             UNIFIED_RATING_CONFIG.UNCERTAINTY.INITIAL * Math.pow(0.9, aGames)),
      comparisons: aGames,
      wins: 0, // These could be tracked if needed
      losses: 0,
      ties: 0
    };

    const updatedAStats = unifiedRatingKernel(aStats, bRating, unifiedResult);
    
    // For simple pairwise, we only update A's rating
    return {
      updatedARating: updatedAStats.rating,
      updatedBRating: bRating
    };
  }

  // Fallback case
  return {
    updatedARating: aRating || 5.0,
    updatedBRating: bRating || 5.0
  };
};

/**
 * Legacy K-factor calculation - now uses unified uncertainty model
 */
export const calculateKFactor = (gamesPlayed) => {
  // Convert games played to uncertainty estimate
  const uncertainty = UNIFIED_RATING_CONFIG.UNCERTAINTY.INITIAL * 
                     Math.pow(UNIFIED_RATING_CONFIG.UNCERTAINTY.DECAY_RATE, gamesPlayed);
  
  // Convert to legacy K-factor scale (0-1 range)
  return Math.min(1.0, uncertainty / UNIFIED_RATING_CONFIG.UNCERTAINTY.INITIAL);
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
const selectMovieFromPercentileUnified = (seenMovies, emotion, options = {}) => {
  const { 
    mediaType = null, 
    excludeMovieId = null,
    enableMediaTypeFilter = false,
    enhancedLogging = false 
  } = options;

  const percentileRanges = UNIFIED_RATING_CONFIG.PERCENTILE_RANGES;

  if (!seenMovies || seenMovies.length === 0) {
    if (enhancedLogging) console.log('🚨 No seen movies available');
    return null;
  }

  // Apply media type filtering if enabled
  let filteredMovies = seenMovies;
  if (enableMediaTypeFilter && mediaType) {
    filteredMovies = seenMovies.filter(movie => 
      movie.id !== excludeMovieId &&
      (movie.mediaType || 'movie') === mediaType
    );
    
    if (enhancedLogging) {
      console.log(`🎯 Available opponents for ${mediaType}:`, filteredMovies.length);
      console.log(`🎯 Media type filter: ${mediaType}, Sample opponents:`, 
        filteredMovies.slice(0, 3).map(m => `${m.title} (${m.mediaType || 'movie'})`));
    }
  } else {
    // Standard filtering without media type
    filteredMovies = seenMovies.filter(movie => movie.id !== excludeMovieId);
  }

  // Sort movies by rating to establish percentile ranges
  const sortedMovies = [...filteredMovies].sort((a, b) => (a.userRating || 0) - (b.userRating || 0));
  const [minPercent, maxPercent] = percentileRanges[emotion] || [0.5, 0.75];
  
  const startIndex = Math.floor(sortedMovies.length * minPercent);
  const endIndex = Math.min(Math.floor(sortedMovies.length * maxPercent), sortedMovies.length - 1);
  
  if (enhancedLogging) {
    console.log(`🎯 ${emotion} percentile [${minPercent}-${maxPercent}]: indices ${startIndex}-${endIndex}`);
  }
  
  const percentileMovies = sortedMovies.slice(startIndex, endIndex + 1);
  if (percentileMovies.length === 0) return sortedMovies[0]; // Fallback
  
  // Random selection from percentile
  const selectedMovie = percentileMovies[Math.floor(Math.random() * percentileMovies.length)];
  
  if (enhancedLogging) {
    console.log(`🎬 Selected from ${emotion} percentile: ${selectedMovie.title} (Rating: ${selectedMovie.userRating})`);
  }
  
  return selectedMovie;
};

/**
 * Unified comparison handling for all screens
 * Consolidates handleComparison logic with screen-specific behavior
 */
const handleComparisonUnified = async (screenConfig, comparisonParams) => {
  const {
    winner,
    currentComparison,
    comparisonMovies,
    selectedMovie,
    mediaType,
    setCurrentMovieRating,
    updateMovieInStorage
  } = comparisonParams;

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
    
    return {
      derivedRating,
      opponentNewRating,
      isComplete: false
    };
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
  processConfidenceBasedRating,
  updateRatingWithConfidence,
  calculateConfidenceInterval,
  hasTargetConfidence,
  CONFIDENCE_RATING_CONFIG,
  // Consolidated calculation functions
  calculateRatingFromELOComparisons,
  selectMovieFromPercentileUnified,
  handleComparisonUnified,
  calculateAverageRating,
  getSentimentBaseline
};