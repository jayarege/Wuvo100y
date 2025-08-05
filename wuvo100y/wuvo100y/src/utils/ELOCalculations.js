/**
 * CONSOLIDATED ELO RATING SYSTEM - SINGLE SOURCE OF TRUTH
 * All ELO calculations centralized here to eliminate duplication
 * Used by all screens and components for consistent rating logic
 * 
 * CODE_BIBLE Compliance:
 * - Single source of truth for all ELO calculations
 * - Eliminates duplication across Wildcard, Home, Profile, EnhancedRatingSystem
 * - Consistent K-factors, probability calculations, and rating bounds
 */

// K-Factor calculation for ELO rating adjustments
export const calculateKFactor = (gamesPlayed) => {
  if (gamesPlayed < 5) return 0.5;
  if (gamesPlayed < 10) return 0.25;
  if (gamesPlayed < 20) return 0.125;
  return 0.1;
};

// Expected win probability calculation
export const calculateExpectedWinProbability = (ratingA, ratingB) => {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 4));
};

// Rating adjustment calculation using ELO system
export const calculateRatingFromComparisons = (wins, results, newMovie, suggestedRating = null) => {
  // Get the comparison movies' ratings
  const comparisonRatings = results.map(r => {
    const movie = r.winner === newMovie ? r.loser : r.winner;
    return movie.userRating || (movie.eloRating / 100);
  });

  const avgComparisonRating = comparisonRatings.reduce((sum, r) => sum + r, 0) / comparisonRatings.length;
  
  // Use Wildcard-style ELO calculation approach
  // Calculate expected win probability for each comparison
  let totalExpectedWins = 0;
  results.forEach(result => {
    const comparisonMovie = result.winner === newMovie ? result.loser : result.winner;
    const comparisonRating = comparisonMovie.userRating || (comparisonMovie.eloRating / 100);
    const expectedWinProbability = 1 / (1 + Math.pow(10, (comparisonRating - avgComparisonRating) / 4));
    totalExpectedWins += expectedWinProbability;
  });
  
  // Adjust rating based on actual vs expected performance
  const performance = wins - totalExpectedWins;
  const baseRating = suggestedRating || avgComparisonRating;
  
  // Apply ELO-style rating adjustment
  const kFactor = 0.3; // Moderate adjustment for rating
  const ratingAdjustment = kFactor * performance;
  
  const finalRating = Math.max(1, Math.min(10, baseRating + ratingAdjustment));
  
  return finalRating;
};

// Wildcard's exact adjustRating function
export const adjustRatingWildcard = (winnerRating, loserRating, winnerWon, winnerGamesPlayed = 0, loserGamesPlayed = 5) => {
  const ratingDifference = Math.abs(winnerRating - loserRating);
  const expectedWinProbability = 1 / (1 + Math.pow(10, (loserRating - winnerRating) / 4));
  
  const winnerK = calculateKFactor(winnerGamesPlayed);
  const loserK = calculateKFactor(loserGamesPlayed);
  
  const winnerIncrease = Math.max(0.1, winnerK * (1 - expectedWinProbability));
  const loserDecrease = Math.max(0.1, loserK * (1 - expectedWinProbability));
  
  let adjustedWinnerIncrease = winnerIncrease;
  let adjustedLoserDecrease = loserDecrease;
  if (winnerRating < loserRating) {
    adjustedWinnerIncrease *= 1.2;
  }
  
  const isMajorUpset = winnerRating < loserRating && ratingDifference > 3.0;
  if (isMajorUpset) {
    adjustedWinnerIncrease += 3.0;
  }
  
  const MAX_RATING_CHANGE = 0.7;
  if (!isMajorUpset) {
    adjustedWinnerIncrease = Math.min(MAX_RATING_CHANGE, adjustedWinnerIncrease);
    adjustedLoserDecrease = Math.min(MAX_RATING_CHANGE, adjustedLoserDecrease);
  }
  
  let newWinnerRating = winnerRating + adjustedWinnerIncrease;
  let newLoserRating = loserRating - adjustedLoserDecrease;
  
  newWinnerRating = Math.round(Math.min(10, Math.max(1, newWinnerRating)) * 10) / 10;
  newLoserRating = Math.round(Math.min(10, Math.max(1, newLoserRating)) * 10) / 10;
  
  return {
    updatedSeenContent: newWinnerRating,
    updatedNewContent: newLoserRating
  };
};

// =============================================================================
// PAIRWISE RATING CALCULATION - Consolidated from UnifiedRatingEngine/EnhancedRatingSystem
// =============================================================================

// Comparison result constants for type safety
export const ComparisonResults = {
  A_WINS: 'a_wins',
  B_WINS: 'b_wins', 
  TIE: 'too_tough'
};

/**
 * Unified pairwise rating calculation for all screens
 * Consolidates logic from UnifiedRatingEngine and EnhancedRatingSystem
 */
export const calculatePairwiseRating = (config) => {
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
      
      // For ties in Round 1, create close ratings around opponent's rating
      return {
        updatedARating: Math.min(10, Math.max(1, bRating + 0.05)),
        updatedBRating: Math.min(10, Math.max(1, bRating - 0.05))
      };
    }
    
    // Direct calculation: opponent ± 0.5 based on result
    const newMovieRating = bRating + (result === ComparisonResults.A_WINS ? 0.5 : -0.5);
    return {
      updatedARating: Math.min(10, Math.max(1, newMovieRating)),
      updatedBRating: bRating // B rating unchanged in Round 1
    };
  }
  
  // For Rounds 2-3 or when both movies have ratings
  if (aRating && bRating) {
    if (result === ComparisonResults.TIE) {
      // Handle tie - create very close ratings
      const averageRating = (aRating + bRating) / 2;
      return {
        updatedARating: Math.min(10, Math.max(1, averageRating + 0.05)),
        updatedBRating: Math.min(10, Math.max(1, averageRating - 0.05))
      };
    }
    
    // Use ELO calculation for known vs known
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

// =============================================================================
// OPPONENT SELECTION - Consolidated from OpponentSelection.js and UnifiedRatingEngine
// =============================================================================

/**
 * Emotion-based percentile ranges for opponent selection
 */
export const EMOTION_PERCENTILES = {
  LOVED: [0.0, 0.25],      // Top 25% of user's rated movies
  LIKED: [0.25, 0.50],     // Upper-middle 25-50%
  AVERAGE: [0.50, 0.75],   // Lower-middle 50-75%  
  DISLIKED: [0.75, 1.0]    // Bottom 25%
};

/**
 * Select movie from percentile range based on emotion
 */
export const selectOpponentFromEmotion = (emotion, seenMovies, excludeMovieId = null) => {
  if (!seenMovies || seenMovies.length === 0) return null;
  
  const percentileRange = EMOTION_PERCENTILES[emotion];
  if (!percentileRange) return null;
  
  // Get movies sorted by rating
  const sortedMovies = seenMovies
    .filter(movie => movie.userRating && movie.id !== excludeMovieId)
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
 */
export const selectRandomOpponent = (seenMovies, excludeMovieIds = []) => {
  if (!seenMovies || seenMovies.length === 0) return null;
  
  const availableMovies = seenMovies.filter(movie => 
    movie.userRating && !excludeMovieIds.includes(movie.id)
  );
  
  if (availableMovies.length === 0) return null;
  
  return availableMovies[Math.floor(Math.random() * availableMovies.length)];
};

/**
 * Select opponent from specific percentile range
 */
export const selectPercentileOpponent = (seenMovies, percentileRange, excludeIds = []) => {
  // Deduplicate and filter
  const uniqueMovies = seenMovies.filter((movie, index, arr) => 
    arr.findIndex(m => m.id === movie.id) === index &&
    !excludeIds.includes(movie.id) &&
    movie.userRating
  );
  
  if (uniqueMovies.length === 0) return null;
  
  // Sort by rating (descending)
  const sortedMovies = [...uniqueMovies].sort((a, b) => (b.userRating || 0) - (a.userRating || 0));
  
  const [minPercentile, maxPercentile] = percentileRange;
  const startIndex = Math.floor(sortedMovies.length * minPercentile);
  const endIndex = Math.floor(sortedMovies.length * maxPercentile);
  
  const bucketMovies = sortedMovies.slice(startIndex, endIndex);
  
  if (bucketMovies.length === 0) {
    // Fallback to middle 60% if bucket is empty
    const fallbackStart = Math.floor(sortedMovies.length * 0.2);
    const fallbackEnd = Math.floor(sortedMovies.length * 0.8);
    const fallbackMovies = sortedMovies.slice(fallbackStart, fallbackEnd);
    return fallbackMovies[Math.floor(Math.random() * fallbackMovies.length)] || null;
  }
  
  return bucketMovies[Math.floor(Math.random() * bucketMovies.length)];
};

// =============================================================================
// RATING FLOW HELPERS - Consolidated from Home/Profile screens
// =============================================================================

/**
 * Calculate rating for Round 1 (Unknown vs Known)
 */
export const calculateRound1Rating = (newMovieWon, opponentRating) => {
  if (newMovieWon) {
    return Math.min(10, opponentRating + 0.5);
  } else {
    return Math.max(1, opponentRating - 0.5);
  }
};

/**
 * Handle "Too Tough to Decide" scenario
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

// =============================================================================
// STANDARD ELO CALCULATION - For compatibility with OpponentSelection.js
// =============================================================================

/**
 * Standard ELO rating calculation (alternative implementation)
 * Note: Uses different parameters than main adjustRatingWildcard
 */
export const calculateNewRating = (currentRating, gamesPlayed, actualScore, expectedScore) => {
  const kFactor = calculateKFactor(gamesPlayed);
  const ratingChange = kFactor * 32 * (actualScore - expectedScore);
  const newRating = currentRating + ratingChange;
  
  // Enforce bounds: ratings must stay within 1.0-10.0 range
  return Math.max(1.0, Math.min(10.0, newRating));
};