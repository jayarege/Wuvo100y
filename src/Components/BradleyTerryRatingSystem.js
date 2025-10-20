/**
 * BRADLEY-TERRY RATING SYSTEM with Bayesian Shrinkage
 *
 * Philosophy: Model win probabilities instead of point differences
 *
 * Key Features:
 * - Probabilistic model: P(A beats B) = exp(θ_A) / (exp(θ_A) + exp(θ_B))
 * - TMDB-informed priors: Movies start at global consensus rating
 * - Bayesian shrinkage: Regularizes toward TMDB rating with decreasing strength
 * - Interpretable uncertainty: Confidence intervals built into the model
 * - Tie handling: Approximation using 0.5 outcome with adjusted Fisher information
 *
 * Mathematical Foundation:
 * θ_i = log-odds strength parameter
 * θ_prior = log(r_TMDB / (10 - r_TMDB))  // TMDB rating as prior
 * θ_posterior = (n * θ_mle + α * θ_prior) / (n + α)  // Bayesian update
 *
 * ⚠️ TIE APPROXIMATION:
 * Original Bradley-Terry (1952) was designed for binary outcomes (win/loss only).
 * We extend this to handle ties using the following approximation:
 *
 * - Tie outcome = 0.5 (half win, half loss)
 * - Gradient update: θ_new = θ_old + η × (0.5 - P(win))
 * - Win/Loss tracking: Both get +0.5 wins and +0.5 losses
 * - Fisher information: Ties provide 75% information vs clear outcomes
 * - Confidence adjustment: Effective n = (clear outcomes) + 0.75 × (ties)
 *
 * This is NOT pure Bradley-Terry but a reasonable UX-motivated extension.
 * For mathematically pure tie handling, consider:
 * - Rao-Kupper extension (1967)
 * - Davidson model (1970)
 * - Ordered Bradley-Terry with tie category
 *
 * Trade-off: We sacrifice mathematical purity for user experience.
 * Users expect a "Too Tough to Decide" option, and ties happen naturally
 * when comparing movies of similar quality.
 *
 * CODE_BIBLE Compliance:
 * - Clear and obvious (Commandment #3): Math matches textbook Bradley-Terry
 * - Preserve context (Commandment #5): Comments explain WHY TMDB prior works
 * - Handle errors explicitly (Commandment #9): Clamps, validation, fallbacks
 * - Be brutally honest (Commandment #4): Acknowledged tie approximation limitations
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  Modal, 
  StyleSheet, 
  Image, 
  Dimensions,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../config/storageConfig';

// ============================================================================
// CONFIGURATION
// ============================================================================

const BT_CONFIG = {
  // Sentiment to percentile mapping (unchanged from ELO system)
  PERCENTILES: {
    LOVED: [0.0, 0.25],
    LIKED: [0.25, 0.50],
    AVERAGE: [0.50, 0.75],
    DISLIKED: [0.75, 1.0]
  },
  
  // Comparison rounds
  // Logic: Min 3, check 80% Wilson CI after each, max 5
  MIN_COMPARISONS: 3,
  MAX_COMPARISONS: 5,
  // Note: Early stopping uses confidencePercent >= 80 directly in shouldStopEarly()

  // Bradley-Terry specific parameters
  LEARNING_RATE: 1.3,        // η: Step size for gradient ascent (DRAMATIC: ~1-2 points per comparison)
  SHRINKAGE_STRENGTH: 0.15,  // α: Pull toward TMDB prior (MINIMAL: allows ±5-6 point swings)
  
  // Rating bounds
  MIN_RATING: 1.0,
  MAX_RATING: 10.0,
  
  // Confidence intervals
  Z_SCORE: 1.96,             // 95% confidence level
  
  // Minimum library size
  MIN_LIBRARY_SIZE: 3,
  
  // Fallback for movies without TMDB score
  DEFAULT_TMDB_RATING: 6   // Median TMDB rating
};

// Sentiment configuration (same as RatingSystem.js)
const SENTIMENT_CONFIG = {
  LOVED: { label: 'Love', emoji: '❤️', color: '#FF4444', description: 'An all-time favorite' },
  LIKED: { label: 'Like', emoji: '👍', color: '#66BB6A', description: 'Really enjoyed it' },
  AVERAGE: { label: 'Okay', emoji: '😐', color: '#FFB74D', description: 'It was alright' },
  DISLIKED: { label: 'Dislike', emoji: '👎', color: '#EF5350', description: 'Not for me' }
};

// ============================================================================
// BRADLEY-TERRY CORE FUNCTIONS
// ============================================================================

/**
 * Convert TMDB rating (1-10) to log-odds (theta)
 * This is the PRIOR mean for Bayesian shrinkage
 * 
 * Formula: θ = log(r / (10 - r))
 * 
 * @param {number} tmdbRating - TMDB rating (1-10 scale)
 * @returns {number} Log-odds strength parameter
 * 
 * Example:
 * - TMDB 8.5 → θ = log(8.5/1.5) = 1.74 (strong movie)
 * - TMDB 5.0 → θ = log(5.0/5.0) = 0.0 (neutral)
 * - TMDB 3.0 → θ = log(3.0/7.0) = -0.85 (weak movie)
 */
export const ratingToTheta = (tmdbRating) => {
  // Clamp to valid range
  const r = Math.max(1.01, Math.min(9.99, tmdbRating));
  
  // Logit transform
  return Math.log(r / (10 - r));
};

/**
 * Convert log-odds (theta) back to 1-10 rating scale
 * This is what users see in the UI
 * 
 * Formula: r = 10 / (1 + exp(-θ))
 * 
 * @param {number} theta - Log-odds strength
 * @returns {number} User rating (1-10 scale)
 * 
 * Example:
 * - θ = 1.74 → r = 8.5
 * - θ = 0.0 → r = 5.0
 * - θ = -0.85 → r = 3.0
 */
export const thetaToRating = (theta) => {
  const rating = 10 / (1 + Math.exp(-theta));
  return Math.max(BT_CONFIG.MIN_RATING, Math.min(BT_CONFIG.MAX_RATING, rating));
};

/**
 * Calculate win probability using Bradley-Terry model
 * 
 * Formula: P(A beats B) = exp(θ_A) / (exp(θ_A) + exp(θ_B))
 * 
 * @param {number} thetaA - Log-odds strength of A
 * @param {number} thetaB - Log-odds strength of B
 * @returns {number} Probability A beats B (0-1)
 * 
 * Properties:
 * - Symmetric: P(A beats B) + P(B beats A) = 1
 * - Transitive: If A > B and B > C, then P(A > C) predictable
 * - Interpretable: 0.73 = "73% chance A wins"
 */
export const bradleyTerryProbability = (thetaA, thetaB) => {
  // Numerically stable computation
  // Instead of exp(θ_A) / (exp(θ_A) + exp(θ_B))
  // Use 1 / (1 + exp(θ_B - θ_A))
  
  const diff = thetaB - thetaA;
  return 1 / (1 + Math.exp(diff));
};

/**
 * Update theta using stochastic gradient ascent
 * This is the core learning update after each comparison
 * 
 * Formula: θ_new = θ_old + η * (actual - predicted)
 * 
 * @param {number} theta - Current log-odds strength
 * @param {number} predictedProb - Model's predicted win probability
 * @param {boolean} actualWin - Whether the item actually won
 * @param {number} learningRate - Step size (default 0.1)
 * @returns {number} Updated theta
 * 
 * Intuition:
 * - If we WIN unexpectedly (actual=1, predicted=0.3) → increase θ by 0.7*η
 * - If we LOSE unexpectedly (actual=0, predicted=0.7) → decrease θ by 0.7*η
 * - Gradient points in direction of maximum likelihood
 */
export const updateThetaMLE = (theta, predictedProb, actualWin, learningRate = BT_CONFIG.LEARNING_RATE) => {
  const actualScore = actualWin ? 1 : 0;
  const gradient = actualScore - predictedProb;
  return theta + learningRate * gradient;
};

/**
 * Apply Bayesian shrinkage toward TMDB prior
 * 
 * Formula: θ_posterior = (n * θ_mle + α * θ_prior) / (n + α)
 * 
 * @param {number} thetaMLE - Maximum likelihood estimate from comparisons
 * @param {number} thetaPrior - TMDB-based prior (from ratingToTheta)
 * @param {number} comparisons - Number of user comparisons
 * @param {number} shrinkageStrength - α parameter (higher = more pull to prior)
 * @returns {number} Posterior theta with shrinkage applied
 * 
 * Behavior:
 * - n=0: Returns pure prior (TMDB rating)
 * - n=α: Equal weight between MLE and prior
 * - n→∞: Converges to MLE (user's personal rating dominates)
 * 
 * Example (α=10):
 * - After 1 comparison: 91% prior, 9% user data
 * - After 10 comparisons: 50% prior, 50% user data
 * - After 100 comparisons: 9% prior, 91% user data
 */
export const applyShrinkage = (
  thetaMLE, 
  thetaPrior, 
  comparisons, 
  shrinkageStrength = BT_CONFIG.SHRINKAGE_STRENGTH
) => {
  return (comparisons * thetaMLE + shrinkageStrength * thetaPrior) / 
         (comparisons + shrinkageStrength);
};

/**
 * Get Wilson confidence interval for theta
 * Uses Fisher information approximation with tie adjustment
 *
 * @param {number} theta - Current log-odds strength
 * @param {number} comparisons - Number of comparisons
 * @param {number} wins - Number of wins (can include 0.5 for ties)
 * @param {number} z - Z-score for confidence level (1.96 = 95%)
 * @returns {{lower: number, upper: number, width: number}} Confidence interval
 *
 * Interpretation (Wilson CI):
 * - width ≤ 0.8: High confidence (≥80%) - can stop early
 * - width > 0.8: Low confidence (<80%) - continue comparisons
 * - After 3 comparisons: typically width ≈ 2.3 (need more data)
 * - After 5 comparisons: typically width ≈ 1.8 (approaching threshold)
 *
 * ⚠️ TIE HANDLING:
 * Ties reduce information content. A tie provides less information than a clear win/loss.
 * We adjust the effective sample size to account for this:
 * - Win/Loss: Full information (1.0)
 * - Tie: Reduced information (0.75 multiplier)
 *
 * This prevents overconfidence when many ties are present.
 */
export const getThetaConfidenceInterval = (theta, comparisons, wins = null, z = BT_CONFIG.Z_SCORE) => {
  if (comparisons === 0) {
    return { lower: theta - 2, upper: theta + 2, width: 4 };
  }

  // ✅ FIX: Adjust for ties if win data provided
  let effectiveComparisons = comparisons;

  if (wins !== null) {
    // Count how many ties we have (non-integer wins indicate ties)
    const tieCount = comparisons - Math.floor(wins) - Math.floor(comparisons - wins);

    if (tieCount > 0) {
      // Ties provide 75% of the information of a clear outcome
      // Reduce effective sample size accordingly
      const clearOutcomes = comparisons - tieCount;
      effectiveComparisons = clearOutcomes + (tieCount * 0.75);

      console.log(`   📊 CI Adjustment: ${comparisons} comparisons, ${tieCount.toFixed(1)} ties → effective n = ${effectiveComparisons.toFixed(2)}`);
    }
  }

  // Fisher information for Bradley-Terry is approximately n/4
  // Use effective comparisons to account for reduced information from ties
  const standardError = 2 / Math.sqrt(effectiveComparisons);
  const margin = z * standardError;

  return {
    lower: theta - margin,
    upper: theta + margin,
    width: 2 * margin
  };
};

/**
 * Check if we should stop comparisons early based on Wilson confidence interval
 * 
 * Logic:
 * - Minimum 3 comparisons required
 * - After 3rd: If Wilson CI ≥80% → stop, else continue
 * - After 4th: If Wilson CI ≥80% → stop, else continue
 * - After 5th: Always stop (maximum reached)
 * 
 * @param {number} comparisons - Number of comparisons so far
 * @param {number} confidenceWidth - Width of 95% CI in theta space
 * @returns {boolean} Whether to stop
 */
export const shouldStopEarly = (comparisons, confidencePercent) => {
  // Must complete minimum comparisons
  if (comparisons < BT_CONFIG.MIN_COMPARISONS) {
    console.log(`⏳ Need ${BT_CONFIG.MIN_COMPARISONS - comparisons} more comparison(s) to reach minimum`);
    return false;
  }

  // Check if we've reached 80% confidence
  const hasHighConfidence = confidencePercent >= 80;

  console.log(`📊 Comparison ${comparisons}: Confidence = ${confidencePercent.toFixed(0)}%`);

  if (hasHighConfidence) {
    console.log(`✅ Stopping early: ${comparisons} comparisons, 80%+ confidence reached!`);
    return true;
  }

  // Continue to next comparison if not at max
  console.log(`⏭️  Continuing to next comparison (need 80% confidence)`);
  return false;
};

// ============================================================================
// MOVIE DATA STRUCTURE
// ============================================================================

/**
 * Initialize Bradley-Terry parameters for a new movie
 *
 * @param {Object} movie - Movie object from TMDB
 * @param {string} sentiment - User's initial sentiment (LOVED, LIKED, AVERAGE, DISLIKED) - optional
 * @returns {Object} Movie with BT parameters
 *
 * Initial Rating Formula (when sentiment provided):
 * - Love: 0.7 × 10.0 + 0.3 × TMDB = 7.0 + 0.3×TMDB
 * - Like: 0.7 × 7.5 + 0.3 × TMDB = 5.25 + 0.3×TMDB
 * - Okay: 0.7 × 5.5 + 0.3 × TMDB = 3.85 + 0.3×TMDB
 * - Dislike: 0.7 × 3.5 + 0.3 × TMDB = 2.45 + 0.3×TMDB
 */
export const initializeBTMovie = (movie, sentiment = null) => {
  console.log('🟢 initializeBTMovie called with:', JSON.stringify({
    id: movie.id,
    title: movie.title || movie.name,
    userRating: movie.userRating,
    theta: movie.theta,
    comparisons: movie.comparisons,
    confidencePercent: movie.confidencePercent,
    wins: movie.wins,
    sentiment: sentiment
  }, null, 2));

  // ✅ FIX: Check if movie already has Bradley-Terry data (re-rating scenario)
  if (movie.theta !== undefined && movie.comparisons !== undefined && movie.comparisons > 0) {
    console.log(`🔄 Re-rating existing movie: ${movie.title || movie.name}`);
    console.log(`   Keeping existing comparisons: ${movie.comparisons}`);
    console.log(`   Keeping existing rating: ${movie.userRating?.toFixed(2)}`);
    console.log(`   Keeping existing θ: ${movie.theta.toFixed(3)}`);

    // ✅ RECALCULATE CONFIDENCE: If not present or needs update
    let confidencePercent = movie.confidencePercent;
    let confidenceWidth = movie.confidenceWidth;

    if (confidencePercent === undefined || confidencePercent === 0) {
      // Calculate confidence from existing comparison data
      console.log(`   🔍 Recalculating confidence - comparisons: ${movie.comparisons}, wins: ${movie.wins}`);
      const ci = getThetaConfidenceInterval(movie.theta, movie.comparisons, movie.wins);
      confidenceWidth = ci.width;
      confidencePercent = Math.min(80, Math.max(0, 80 - (ci.width - 0.8) * 20));
      console.log(`   ✨ Recalculated confidence: ${confidencePercent.toFixed(0)}% (was missing)`);
    } else {
      console.log(`   ✅ Existing confidence: ${confidencePercent.toFixed(0)}%`);
    }

    const result = {
      ...movie,
      // Ensure thetaPrior exists (for new comparisons)
      thetaPrior: movie.thetaPrior || ratingToTheta(movie.tmdbRating || BT_CONFIG.DEFAULT_TMDB_RATING),
      // Ensure confidence is present
      confidencePercent: confidencePercent,
      confidenceWidth: confidenceWidth
    };

    console.log('🟢 initializeBTMovie RETURNING (re-rating):', JSON.stringify({
      userRating: result.userRating,
      theta: result.theta,
      comparisons: result.comparisons,
      confidencePercent: result.confidencePercent,
      wins: result.wins
    }, null, 2));

    // Return movie with existing BT data PRESERVED + confidence ensured
    return result;
  }

  // ✅ NEW: Seed BT from existing userRating when BT fields are missing
if (movie.theta === undefined && movie.userRating != null) {
  const tmdbRating = movie.vote_average || movie.score || BT_CONFIG.DEFAULT_TMDB_RATING;
  const thetaFromUser = ratingToTheta(movie.userRating);
  const thetaPrior = ratingToTheta(tmdbRating);

  const seeded = {
    ...movie,
    theta: thetaFromUser,               // seed from existing 1–10 user rating
    thetaPrior,                         // prior from TMDB
    comparisons: movie.comparisons ?? 0,
    wins: movie.wins ?? 0,
    losses: movie.losses ?? 0,

    userRating: movie.userRating,       // preserve displayed rating
    confidencePercent: movie.confidencePercent ?? 0,
    confidenceWidth: movie.confidenceWidth ?? 4.0,

    eloRating: movie.userRating * 10,   // legacy compat
    tmdbRating,
    lastUpdated: new Date().toISOString(),
  };

  console.log('🟢 initializeBTMovie RETURNING (seeded from userRating):', JSON.stringify({
    userRating: seeded.userRating,
    theta: seeded.theta,
    comparisons: seeded.comparisons,
    confidencePercent: seeded.confidencePercent,
    wins: seeded.wins
  }, null, 2));

  return seeded;
}  const tmdbRating = movie.vote_average || movie.score || BT_CONFIG.DEFAULT_TMDB_RATING;

  // Sentiment score mapping
  const sentimentScores = {
    LOVED: 10.0,
    LIKED: 7.5,
    AVERAGE: 5.5,
    DISLIKED: 3.5
  };

  let initialRating;
  if (sentiment && sentimentScores[sentiment]) {
    // ✅ NEW FORMULA: 0.7 × (user sentiment) + 0.3 × (TMDB score)
    const sentimentScore = sentimentScores[sentiment];
    initialRating = 0.7 * sentimentScore + 0.3 * tmdbRating;

    // Clamp to valid range
    initialRating = Math.max(1.0, Math.min(10.0, initialRating));

    console.log(`🆕 First-time rating: ${movie.title || movie.name}`);
    console.log(`   Sentiment: ${sentiment} (${sentimentScore.toFixed(1)})`);
    console.log(`   TMDB: ${tmdbRating.toFixed(1)}`);
    console.log(`   Initial rating: 0.7 × ${sentimentScore} + 0.3 × ${tmdbRating.toFixed(1)} = ${initialRating.toFixed(2)}`);
  } else {
    // Fallback to TMDB-only for backward compatibility
    initialRating = tmdbRating;
    console.log(`🆕 First-time rating: ${movie.title || movie.name}`);
    console.log(`   Starting from TMDB: ${tmdbRating.toFixed(1)}`);
  }

  const thetaPrior = ratingToTheta(initialRating);

  return {
    ...movie,
    // Bradley-Terry parameters
    theta: thetaPrior,           // Current log-odds strength
    thetaPrior: thetaPrior,      // Initial rating-based prior (never changes)
    comparisons: 0,              // Number of head-to-head comparisons
    wins: 0,                     // Number of wins
    losses: 0,                   // Number of losses

    // Display rating (for UI)
    userRating: thetaToRating(thetaPrior),

    // Confidence (starts at 0% with 0 comparisons)
    confidencePercent: 0,
    confidenceWidth: 4.0,

    // Legacy compatibility
    eloRating: thetaToRating(thetaPrior) * 10,

    // Metadata
    tmdbRating: tmdbRating,      // Original TMDB rating
    initialSentiment: sentiment,  // Store initial sentiment for reference
    lastUpdated: new Date().toISOString()
  };
};

/**
 * Update movie after a comparison
 * 
 * @param {Object} movie - Movie object
 * @param {number} opponentTheta - Opponent's theta
 * @param {boolean} won - Whether this movie won
 * @returns {Object} Updated movie
 */
export const updateMovieAfterComparison = (movie, opponentTheta, won) => {
  // Calculate predicted win probability
  const predictedProb = bradleyTerryProbability(movie.theta, opponentTheta);

  // ✅ FIX: Scale learning rate based on existing comparisons
  // Movies with many ratings should move MUCH less per comparison
  // Formula: effective_η = η / (1 + comparisons/10)
  // Examples:
  //   0 comparisons: η = 1.3 / 1 = 1.3 (full impact)
  //   5 comparisons: η = 1.3 / 1.5 = 0.87 (reduced)
  //   50 comparisons: η = 1.3 / 6 = 0.22 (small impact)
  //   1000 comparisons: η = 1.3 / 101 = 0.013 (tiny impact)
  const scaledLearningRate = BT_CONFIG.LEARNING_RATE / (1 + movie.comparisons / 10);

  // Update theta using gradient ascent with scaled learning rate
  const thetaMLE = updateThetaMLE(movie.theta, predictedProb, won, scaledLearningRate);

  // Apply Bayesian shrinkage toward TMDB prior
  // NOTE: For movies with many comparisons, shrinkage becomes negligible
  // This ensures accumulated data is respected
  const thetaPosterior = applyShrinkage(
    thetaMLE,
    movie.thetaPrior,
    movie.comparisons + 1
  );
  
  // Convert back to user rating
  const newRating = thetaToRating(thetaPosterior);

  // Calculate confidence interval (pass wins for tie adjustment)
  const ci = getThetaConfidenceInterval(
    thetaPosterior,
    movie.comparisons + 1,
    movie.wins + (won ? 1 : 0)  // Include current outcome
  );

  // Calculate confidence percentage (80% = target)
  // CI width: 0.8 or less = 80%+ confidence
  // CI width: 4.0 or more = 0% confidence (starting point)
  // Formula: confidence = 80 - (ci.width - 0.8) * 20
  const confidencePercent = Math.min(80, Math.max(0, 80 - (ci.width - 0.8) * 20));

  console.log(`📊 ${movie.title || movie.name}:`);
  console.log(`   Comparisons: ${movie.comparisons} → ${movie.comparisons + 1}`);
  console.log(`   Scaled η: ${scaledLearningRate.toFixed(3)} (base: ${BT_CONFIG.LEARNING_RATE})`);
  console.log(`   Predicted P(win) = ${(predictedProb * 100).toFixed(1)}%`);
  console.log(`   Actual: ${won ? 'WIN' : 'LOSS'}`);
  console.log(`   θ: ${movie.theta.toFixed(3)} → ${thetaPosterior.toFixed(3)}`);
  console.log(`   Rating: ${movie.userRating.toFixed(2)} → ${newRating.toFixed(2)}`);
  console.log(`   Confidence: ${confidencePercent.toFixed(0)}% (CI width: ${ci.width.toFixed(2)})`);

  return {
    ...movie,
    theta: thetaPosterior,
    comparisons: movie.comparisons + 1,
    wins: movie.wins + (won ? 1 : 0),
    losses: movie.losses + (won ? 0 : 1),
    userRating: newRating,
    confidencePercent: confidencePercent, // NEW: Confidence percentage
    confidenceWidth: ci.width,            // NEW: CI width for debugging
    eloRating: newRating * 10, // Legacy compatibility
    lastUpdated: new Date().toISOString()
  };
};

// ============================================================================
// OPPONENT SELECTION (same logic as RatingSystem.js)
// ============================================================================

export const selectOpponentFromSentiment = (sentiment, ratedMovies, excludeId, mediaType) => {
  if (!ratedMovies || ratedMovies.length === 0) {
    console.warn('⚠️ No rated movies available');
    return null;
  }
  
  const validOpponents = ratedMovies.filter(movie => 
    movie.userRating != null &&
    movie.id !== excludeId &&
    (movie.mediaType || 'movie') === mediaType
  );
  
  if (validOpponents.length === 0) {
    console.warn('⚠️ No valid opponents after filtering');
    return null;
  }
  
  // Sort by rating (descending)
  const sorted = [...validOpponents].sort((a, b) => (b.userRating || 0) - (a.userRating || 0));
  
  // Get percentile range
  const [minPercent, maxPercent] = BT_CONFIG.PERCENTILES[sentiment] || [0.25, 0.75];
  const startIdx = Math.floor(sorted.length * minPercent);
  const endIdx = Math.min(Math.floor(sorted.length * maxPercent), sorted.length - 1);
  const pool = sorted.slice(startIdx, endIdx + 1);
  
  if (pool.length === 0) {
    const midIdx = Math.floor(sorted.length / 2);
    return sorted[midIdx];
  }
  
  const opponent = pool[Math.floor(Math.random() * pool.length)];
  console.log(`🎯 Opponent: ${opponent.title || opponent.name} (θ=${opponent.theta?.toFixed(2) || 'N/A'}, rating=${opponent.userRating?.toFixed(1) || 'N/A'})`);

  return opponent;
};

/**
 * Select opponent with preference for 45-55% win probability
 *
 * Strategy:
 * 1. Find opponents that would give 45-55% win probability (close matches)
 * 2. If none available, use any valid opponent
 *
 * @param {Array} ratedMovies - All rated movies
 * @param {Array} excludeIds - IDs to exclude
 * @param {string} mediaType - 'movie' or 'tv'
 * @param {number} currentTheta - Theta of the movie being rated (optional for targeting)
 * @returns {Object|null} Selected opponent
 */
export const selectRandomOpponent = (ratedMovies, excludeIds = [], mediaType, currentTheta = null) => {
  const validOpponents = ratedMovies.filter(movie =>
    movie.userRating != null &&
    !excludeIds.includes(movie.id) &&
    (movie.mediaType || 'movie') === mediaType
  );

  if (validOpponents.length === 0) return null;

  // ✅ FIX: If currentTheta provided, prefer opponents with 45-55% win probability
  if (currentTheta !== null) {
    // Calculate win probability for each opponent
    const opponentsWithProb = validOpponents.map(opponent => {
      const opponentTheta = opponent.theta || ratingToTheta(opponent.userRating);
      const winProb = bradleyTerryProbability(currentTheta, opponentTheta);

      return {
        ...opponent,
        winProb: winProb,
        // Distance from ideal 50% - lower is better
        probDistance: Math.abs(winProb - 0.5)
      };
    });

    // Find opponents in the 45-55% range
    const closeMatches = opponentsWithProb.filter(opp =>
      opp.winProb >= 0.45 && opp.winProb <= 0.55
    );

    if (closeMatches.length > 0) {
      // Randomly select from close matches
      const selected = closeMatches[Math.floor(Math.random() * closeMatches.length)];
      console.log(`🎯 Close match opponent: ${selected.title || selected.name} (P(win)=${(selected.winProb * 100).toFixed(1)}%)`);
      return selected;
    } else {
      // No close matches, find closest to 50%
      opponentsWithProb.sort((a, b) => a.probDistance - b.probDistance);
      const closest = opponentsWithProb[0];
      console.log(`⚠️ No 45-55% matches, using closest: ${closest.title || closest.name} (P(win)=${(closest.winProb * 100).toFixed(1)}%)`);
      return closest;
    }
  }

  // Fallback: random selection (for first opponent or when theta not available)
  const shuffled = [...validOpponents].sort(() => 0.5 - Math.random());
  return shuffled[0];
};

// ============================================================================
// STORAGE HELPERS
// ============================================================================

const getStorageKey = (mediaType) => {
  return mediaType === 'movie' ? STORAGE_KEYS.MOVIES.SEEN : STORAGE_KEYS.TV_SHOWS.SEEN;
};

const updateOpponentInStorage = async (opponent, mediaType) => {
  try {
    const storageKey = getStorageKey(mediaType);
    const stored = await AsyncStorage.getItem(storageKey);

    if (!stored) return;

    const items = JSON.parse(stored);
    const index = items.findIndex(item => item.id === opponent.id);

    if (index !== -1) {
      items[index] = opponent;
      await AsyncStorage.setItem(storageKey, JSON.stringify(items));
      console.log(`💾 Updated opponent ${opponent.title || opponent.name}`);
    }
  } catch (error) {
    console.error('❌ Failed to update opponent:', error);
  }
};

const updateMovieInStorage = async (movie, mediaType) => {
  try {
    const storageKey = getStorageKey(mediaType);
    const stored = await AsyncStorage.getItem(storageKey);

    if (!stored) return;

    const items = JSON.parse(stored);
    const index = items.findIndex(item => item.id === movie.id);

    if (index !== -1) {
      items[index] = movie;
      console.log(`💾 Updated rated movie: ${movie.title || movie.name} (userRating: ${movie.userRating?.toFixed(2)}, confidence: ${movie.confidencePercent?.toFixed(0)}%)`);
    } else {
      items.push(movie);
      console.log(`💾 Added new rated movie: ${movie.title || movie.name}`);
    }

    await AsyncStorage.setItem(storageKey, JSON.stringify(items));
  } catch (error) {
    console.error('❌ Failed to update rated movie in storage:', error);
  }
};

// ============================================================================
// UI COMPONENTS (imported from RatingSystem.js structure)
// ============================================================================

export const SentimentRatingModal = ({ visible, movie, onSelect, onClose, colors }) => {
  const sentiments = ['LOVED', 'LIKED', 'AVERAGE', 'DISLIKED'];
  
  return (
    <Modal visible={visible} transparent={true} animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContainer, { backgroundColor: colors.card }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              How did you feel about
            </Text>
            <Text style={[styles.movieTitle, { color: colors.accent }]}>
              {movie?.title || movie?.name}?
            </Text>
          </View>
          
          <View style={styles.sentimentGrid}>
            {sentiments.map((sentiment) => {
              const config = SENTIMENT_CONFIG[sentiment];
              return (
                <TouchableOpacity
                  key={sentiment}
                  style={[styles.sentimentButton, { borderColor: config.color }]}
                  onPress={() => onSelect(sentiment)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.sentimentEmoji}>{config.emoji}</Text>
                  <Text style={[styles.sentimentLabel, { color: config.color }]}>
                    {config.label}
                  </Text>
                  <Text style={[styles.sentimentDescription, { color: colors.subText }]}>
                    {config.description}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          
          <TouchableOpacity 
            style={[styles.cancelButton, { borderColor: colors.border }]}
            onPress={onClose}
          >
            <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// ============================================================================
// RATING COMPLETION MODAL
// ============================================================================

export const RatingCompletionModal = ({ visible, movie, rating, onClose, colors }) => {
  const [autoCloseTimer, setAutoCloseTimer] = useState(null);

  useEffect(() => {
    if (visible) {
      // Auto-close after 3 seconds
      const timer = setTimeout(() => {
        console.log('⏰ Auto-closing completion modal after 3 seconds');
        onClose();
      }, 3000);

      setAutoCloseTimer(timer);

      return () => {
        if (timer) clearTimeout(timer);
      };
    }
  }, [visible, onClose]);

  const handleManualClose = () => {
    if (autoCloseTimer) clearTimeout(autoCloseTimer);
    console.log('👆 User manually closed completion modal');
    onClose();
  };

  if (!movie || rating == null) return null;

  return (
    <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={handleManualClose}>
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={handleManualClose}
      >
        <LinearGradient
          colors={colors.primaryGradient || [colors.primary, colors.secondary]}
          style={styles.completionContainer}
        >
          <View style={styles.completionHeader}>
            <Ionicons name="checkmark-circle" size={64} color="#4CAF50" />
            <Text style={[styles.completionTitle, { color: colors.text }]}>
              Rating Complete!
            </Text>
          </View>

          <Text style={[styles.completionMovieTitle, { color: colors.accent }]}>
            {movie.title || movie.name}
          </Text>

          <View style={styles.ratingDisplay}>
            <Text style={[styles.ratingNumber, { color: colors.accent }]}>
              {rating.toFixed(1)}
            </Text>
            <Text style={[styles.ratingOutOf, { color: colors.subText }]}>
              / 10
            </Text>
          </View>

          <Text style={[styles.tapToCloseText, { color: colors.subText }]}>
            Tap anywhere to continue
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    </Modal>
  );
};

// ============================================================================
// COMPARISON MODAL (Bradley-Terry version)
// ============================================================================

export const ComparisonModal = ({
  visible,
  newMovie,
  sentiment,
  ratedMovies,
  mediaType = 'movie',
  colors,
  onComplete,
  onClose
}) => {
  const [currentRound, setCurrentRound] = useState(1);
  const [currentOpponent, setCurrentOpponent] = useState(null);
  const [currentMovie, setCurrentMovie] = useState(null);
  const [usedOpponentIds, setUsedOpponentIds] = useState([]);
  const [showCompletion, setShowCompletion] = useState(false);
  const [completedMovie, setCompletedMovie] = useState(null);
  const usedIdsRef = useRef([]);

  // Initialize when modal opens
  useEffect(() => {
    if (visible && newMovie && currentRound === 1 && !currentOpponent) {
      console.log('🔵 ComparisonModal useEffect TRIGGERED');
      console.log('🔵 newMovie received:', JSON.stringify({
        id: newMovie.id,
        title: newMovie.title || newMovie.name,
        userRating: newMovie.userRating,
        theta: newMovie.theta,
        comparisons: newMovie.comparisons,
        confidencePercent: newMovie.confidencePercent,
        wins: newMovie.wins,
        thetaPrior: newMovie.thetaPrior
      }, null, 2));

      // ✅ RE-RATING DETECTION: Check if movie already has Bradley-Terry data
      const isRerating = newMovie.theta !== undefined && newMovie.comparisons !== undefined && newMovie.comparisons > 0;
      console.log('🔵 Is Re-rating?', isRerating);
      console.log('🔵 Sentiment:', sentiment);

      // Initialize new movie with BT parameters
      // For re-rating: Pass null sentiment to skip sentiment-based initial rating
      // For new rating: Pass sentiment to calculate weighted initial rating
      const btMovie = initializeBTMovie(newMovie, isRerating ? null : sentiment);
      console.log('🔵 btMovie after initializeBTMovie:', JSON.stringify({
        id: btMovie.id,
        title: btMovie.title || btMovie.name,
        userRating: btMovie.userRating,
        theta: btMovie.theta,
        comparisons: btMovie.comparisons,
        confidencePercent: btMovie.confidencePercent,
        wins: btMovie.wins
      }, null, 2));

      setCurrentMovie(btMovie);

      // Select first opponent
      // For re-rating: Use random opponent (no sentiment bias)
      // For new rating: Use sentiment-based opponent selection
      let opponent;
      if (isRerating) {
        console.log(`🔄 RE-RATING: ${newMovie.title || newMovie.name}`);
        console.log(`   Current rating: ${btMovie.userRating.toFixed(2)}/10`);
        console.log(`   Comparisons: ${btMovie.comparisons}`);
        console.log(`   Confidence: ${btMovie.confidencePercent?.toFixed(0)}%`);
        console.log(`   Existing θ: ${btMovie.theta.toFixed(3)}`);
        console.log(`   Skipping sentiment selection, selecting random opponent`);
        opponent = selectRandomOpponent(ratedMovies, [newMovie.id], mediaType, btMovie.theta);
      } else {
        console.log(`🆕 NEW RATING: ${newMovie.title || newMovie.name}`);
        opponent = selectOpponentFromSentiment(sentiment, ratedMovies, newMovie.id, mediaType);
      }

      if (!opponent) {
        Alert.alert(
          'Not Enough Ratings',
          `You need at least ${BT_CONFIG.MIN_LIBRARY_SIZE} rated ${mediaType}s.`,
          [{ text: 'OK', onPress: onClose }]
        );
        return;
      }

      // Ensure opponent has BT parameters initialized
      const btOpponent = opponent.theta !== undefined ? opponent : initializeBTMovie(opponent);

      setCurrentOpponent(btOpponent);
      usedIdsRef.current = [opponent.id];
      setUsedOpponentIds([opponent.id]);

      if (!isRerating) {
        console.log(`   TMDB rating: ${btMovie.tmdbRating.toFixed(1)}`);
        console.log(`   θ_prior: ${btMovie.thetaPrior.toFixed(3)}`);
      }
    }
  }, [visible, currentRound, currentOpponent, sentiment, ratedMovies, newMovie, mediaType]);
  
  // Handle comparison result
  const handleChoice = useCallback(async (userChoseNew) => {
    if (!currentOpponent || !currentMovie) return;
    
    // Update new movie
    const updatedMovie = updateMovieAfterComparison(
      currentMovie,
      currentOpponent.theta,
      userChoseNew
    );
    
    // Update opponent
    const updatedOpponent = updateMovieAfterComparison(
      currentOpponent,
      currentMovie.theta,
      !userChoseNew
    );

    // Save both movies to storage
    await updateMovieInStorage(updatedMovie, mediaType);
    await updateOpponentInStorage(updatedOpponent, mediaType);

    setCurrentMovie(updatedMovie);
    
    // Check stopping conditions
    const shouldStop =
      currentRound >= BT_CONFIG.MAX_COMPARISONS ||
      shouldStopEarly(updatedMovie.comparisons, updatedMovie.confidencePercent);
    
    if (shouldStop) {
      console.log(`🏁 Complete after ${currentRound} rounds`);
      console.log(`   Final θ: ${updatedMovie.theta.toFixed(3)}`);
      console.log(`   Final rating: ${updatedMovie.userRating.toFixed(2)}`);
      console.log(`   Win rate: ${(updatedMovie.wins / updatedMovie.comparisons * 100).toFixed(1)}%`);

      // Show completion modal for 3 seconds before calling onComplete
      setCompletedMovie(updatedMovie);
      setShowCompletion(true);
    } else {
      // Get next opponent (prefer 45-55% win probability)
      let nextOpponent = selectRandomOpponent(
        ratedMovies,
        [...usedIdsRef.current, newMovie.id],
        mediaType,
        updatedMovie.theta  // ✅ Pass current theta for probability targeting
      );

      // If no opponent found but haven't met minimum, allow reusing opponents
      if (!nextOpponent && updatedMovie.comparisons < BT_CONFIG.MIN_COMPARISONS) {
        console.log(`⚠️ Running out of opponents, allowing reuse to meet minimum ${BT_CONFIG.MIN_COMPARISONS} comparisons`);
        nextOpponent = selectRandomOpponent(
          ratedMovies,
          [newMovie.id], // Only exclude the new movie, allow reusing previous opponents
          mediaType,
          updatedMovie.theta  // ✅ Pass current theta for probability targeting
        );
      }

      if (!nextOpponent) {
        console.log(`⚠️ No more opponents available. Completing after ${updatedMovie.comparisons} comparison(s).`);
        await updateMovieInStorage(updatedMovie, mediaType);
        onComplete(updatedMovie);
        resetState();
      } else {
        // Ensure next opponent has BT parameters initialized
        const btNextOpponent = nextOpponent.theta !== undefined ? nextOpponent : initializeBTMovie(nextOpponent);

        setCurrentOpponent(btNextOpponent);
        setCurrentRound(currentRound + 1);
        usedIdsRef.current = [...usedIdsRef.current, nextOpponent.id];
        setUsedOpponentIds([...usedIdsRef.current]);
      }
    }
  }, [currentOpponent, currentMovie, currentRound, newMovie?.id, ratedMovies, mediaType, onComplete]);
  
  // Handle "too tough to decide" - treat as TIE
  const handleTooTough = useCallback(async () => {
    if (!currentOpponent || !currentMovie) return;

    // ✅ FIX: Treat as TIE (0.5 win probability for both)
    // In Bradley-Terry, a tie means predicted probability = 0.5
    // Both movies update as if they had 50% chance and "half won"

    console.log(`🤷 Too tough to decide - treating as TIE`);
    console.log(`   New movie: ${currentMovie.title || currentMovie.name} (current: ${currentMovie.userRating?.toFixed(2)})`);
    console.log(`   Opponent: ${currentOpponent.title || currentOpponent.name} (current: ${currentOpponent.userRating?.toFixed(2)})`);

    // Calculate win probability (should be close to 0.5 for similar movies)
    const predictedProb = bradleyTerryProbability(currentMovie.theta, currentOpponent.theta);
    console.log(`   Predicted P(new wins) = ${(predictedProb * 100).toFixed(1)}%`);

    // Update new movie with tie outcome (actual = 0.5)
    const scaledLearningRate = BT_CONFIG.LEARNING_RATE / (1 + currentMovie.comparisons / 10);
    const tieScore = 0.5; // Tie = half a win
    const gradient = tieScore - predictedProb;
    const thetaMLE = currentMovie.theta + scaledLearningRate * gradient;

    // Apply shrinkage
    const thetaPosterior = applyShrinkage(
      thetaMLE,
      currentMovie.thetaPrior,
      currentMovie.comparisons + 1
    );

    const newRating = thetaToRating(thetaPosterior);

    // Calculate confidence (with tie adjustment)
    const ci = getThetaConfidenceInterval(
      thetaPosterior,
      currentMovie.comparisons + 1,
      currentMovie.wins + 0.5  // Include tie as 0.5 win
    );
    const confidencePercent = Math.min(80, Math.max(0, 80 - (ci.width - 0.8) * 20));

    const updatedMovie = {
      ...currentMovie,
      theta: thetaPosterior,
      comparisons: currentMovie.comparisons + 1,
      wins: currentMovie.wins + 0.5, // Half a win for tie
      losses: currentMovie.losses + 0.5, // Half a loss for tie
      userRating: newRating,
      confidencePercent: confidencePercent,
      confidenceWidth: ci.width,
      eloRating: newRating * 10,
      lastUpdated: new Date().toISOString()
    };

    // Update opponent with tie outcome
    const opponentPredictedProb = bradleyTerryProbability(currentOpponent.theta, currentMovie.theta);
    const opponentScaledLR = BT_CONFIG.LEARNING_RATE / (1 + currentOpponent.comparisons / 10);
    const opponentGradient = tieScore - opponentPredictedProb;
    const opponentThetaMLE = currentOpponent.theta + opponentScaledLR * opponentGradient;
    const opponentThetaPosterior = applyShrinkage(
      opponentThetaMLE,
      currentOpponent.thetaPrior,
      currentOpponent.comparisons + 1
    );

    const updatedOpponent = {
      ...currentOpponent,
      theta: opponentThetaPosterior,
      comparisons: currentOpponent.comparisons + 1,
      wins: currentOpponent.wins + 0.5,
      losses: currentOpponent.losses + 0.5,
      userRating: thetaToRating(opponentThetaPosterior),
      eloRating: thetaToRating(opponentThetaPosterior) * 10,
      lastUpdated: new Date().toISOString()
    };

    // Save both movies to storage
    await updateMovieInStorage(updatedMovie, mediaType);
    await updateOpponentInStorage(updatedOpponent, mediaType);

    console.log(`   New movie updated: ${currentMovie.userRating?.toFixed(2)} → ${newRating.toFixed(2)}`);
    console.log(`   Opponent updated: ${currentOpponent.userRating?.toFixed(2)} → ${updatedOpponent.userRating.toFixed(2)}`);

    setCurrentMovie(updatedMovie);

    // ✅ FIX: Continue to next round instead of completing
    // Check stopping conditions
    const shouldStop =
      currentRound >= BT_CONFIG.MAX_COMPARISONS ||
      shouldStopEarly(updatedMovie.comparisons, updatedMovie.confidencePercent);

    if (shouldStop) {
      console.log(`🏁 Complete after ${currentRound} rounds (tie was final round)`);
      console.log(`   Final rating: ${updatedMovie.userRating.toFixed(2)}`);

      // Show completion modal
      setCompletedMovie(updatedMovie);
      setShowCompletion(true);
    } else {
      // Get next opponent (prefer 45-55% win probability after tie)
      let nextOpponent = selectRandomOpponent(
        ratedMovies,
        [...usedIdsRef.current, newMovie.id],
        mediaType,
        updatedMovie.theta  // ✅ Pass current theta for probability targeting
      );

      if (!nextOpponent && updatedMovie.comparisons < BT_CONFIG.MIN_COMPARISONS) {
        console.log(`⚠️ Running out of opponents, allowing reuse to meet minimum ${BT_CONFIG.MIN_COMPARISONS} comparisons`);
        nextOpponent = selectRandomOpponent(
          ratedMovies,
          [newMovie.id],
          mediaType,
          updatedMovie.theta  // ✅ Pass current theta for probability targeting
        );
      }

      if (!nextOpponent) {
        console.log(`⚠️ No more opponents available. Completing after ${updatedMovie.comparisons} comparison(s).`);
        await updateMovieInStorage(updatedMovie, mediaType);
        onComplete(updatedMovie);
        resetState();
      } else {
        // Ensure next opponent has BT parameters initialized
        const btNextOpponent = nextOpponent.theta !== undefined ? nextOpponent : initializeBTMovie(nextOpponent);

        setCurrentOpponent(btNextOpponent);
        setCurrentRound(currentRound + 1);
        usedIdsRef.current = [...usedIdsRef.current, nextOpponent.id];
        setUsedOpponentIds([...usedIdsRef.current]);

        console.log(`⏭️  Moving to round ${currentRound + 1} after tie`);
      }
    }
  }, [currentOpponent, currentMovie, currentRound, newMovie?.id, ratedMovies, mediaType, onComplete]);
  
  const handleCompletionClose = useCallback(() => {
    console.log('🎉 Completion modal closed, finalizing rating');
    setShowCompletion(false);

    if (completedMovie) {
      onComplete(completedMovie);
    }
    resetState();

    // ✅ FIX: Add timing safeguard to prevent race conditions
    // Allow parent to process onComplete before closing modals
    // This prevents AsyncStorage updates from being interrupted
    setTimeout(() => {
      console.log('🔓 Closing all parent modals (after 150ms safeguard)');
      onClose();
    }, 150);
  }, [completedMovie, onComplete, onClose]);

  const resetState = () => {
    setCurrentRound(1);
    setCurrentOpponent(null);
    setCurrentMovie(null);
    setUsedOpponentIds([]);
    setShowCompletion(false);
    setCompletedMovie(null);
    usedIdsRef.current = [];
  };
  
  useEffect(() => {
    if (!visible) resetState();
  }, [visible]);
  
  // Show completion modal if rating is complete
  if (showCompletion && completedMovie) {
    return (
      <RatingCompletionModal
        visible={true}
        movie={completedMovie}
        rating={completedMovie.userRating}
        onClose={handleCompletionClose}
        colors={colors}
      />
    );
  }

  if (!currentOpponent || !currentMovie) return null;

  // Ensure both movies have theta values (BT parameters initialized)
  if (currentMovie.theta === undefined || currentOpponent.theta === undefined) {
    console.error('❌ Movies missing Bradley-Terry parameters:', {
      currentMovie: currentMovie.title || currentMovie.name,
      currentMovieTheta: currentMovie.theta,
      opponent: currentOpponent.title || currentOpponent.name,
      opponentTheta: currentOpponent.theta
    });
    return null;
  }

  // Calculate win probability for display
  const winProb = bradleyTerryProbability(currentMovie.theta, currentOpponent.theta);

  return (
    <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <LinearGradient
          colors={colors.primaryGradient || [colors.primary, colors.secondary]}
          style={styles.comparisonContainer}
        >
          <View style={styles.comparisonHeader}>
            <Text style={[styles.roundText, { color: colors.subText }]}>
              Round {currentRound} of {BT_CONFIG.MAX_COMPARISONS}
            </Text>
            {currentMovie.userRating && (
              <Text style={[styles.currentRatingText, { color: colors.accent }]}>
                Current: {currentMovie.userRating.toFixed(1)}
              </Text>
            )}
          </View>

          {/* Confidence Progress Bar */}
          {currentMovie.confidencePercent !== undefined && (
            <View style={styles.confidenceContainer}>
              <View style={[styles.progressBarContainer, { borderColor: colors.border }]}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${currentMovie.confidencePercent}%`,
                      backgroundColor: currentMovie.confidencePercent >= 80 ? '#4CAF50' : colors.accent
                    }
                  ]}
                />
              </View>
              <Text style={[styles.confidenceText, { color: colors.subText }]}>
                {currentMovie.confidencePercent.toFixed(0)}% confident
              </Text>
            </View>
          )}

          {/* Show predicted probability */}
          <Text style={[styles.probabilityText, { color: colors.subText }]}>
            Model predicts {(winProb * 100).toFixed(0)}% chance new movie wins
          </Text>
          
          <Text style={[styles.questionText, { color: colors.text }]}>
            Which do you prefer?
          </Text>
          
          <View style={styles.choicesContainer}>
            <TouchableOpacity
              style={[styles.choiceButton, { borderColor: colors.accent }]}
              onPress={() => handleChoice(true)}
              activeOpacity={0.7}
            >
              <Image
                source={{ uri: `https://image.tmdb.org/t/p/w500${newMovie.poster_path}` }}
                style={styles.poster}
                resizeMode="cover"
              />
              <Text style={[styles.choiceTitle, { color: colors.text }]} numberOfLines={2}>
                {newMovie.title || newMovie.name}
              </Text>
              <Text style={[styles.newBadge, { color: colors.accent }]}>NEW</Text>
            </TouchableOpacity>
            
            <Text style={[styles.vsText, { color: colors.subText }]}>VS</Text>
            
            <TouchableOpacity
              style={[styles.choiceButton, { borderColor: colors.border }]}
              onPress={() => handleChoice(false)}
              activeOpacity={0.7}
            >
              <Image
                source={{ uri: `https://image.tmdb.org/t/p/w500${currentOpponent.poster_path}` }}
                style={styles.poster}
                resizeMode="cover"
              />
              <Text style={[styles.choiceTitle, { color: colors.text }]} numberOfLines={2}>
                {currentOpponent.title || currentOpponent.name}
              </Text>
              <Text style={[styles.ratingBadge, { color: colors.subText }]}>
                ★ {currentOpponent.userRating?.toFixed(1) || currentOpponent.tmdbRating?.toFixed(1) || 'N/A'}
              </Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[
                styles.tooToughButton,
                colors.tertiaryButton && {
                  backgroundColor: colors.tertiaryButton.backgroundColor,
                  borderWidth: colors.tertiaryButton.borderWidth,
                  borderColor: colors.tertiaryButton.borderColor
                }
              ]}
              onPress={handleTooTough}
            >
              <Text style={[styles.tooToughText, { color: colors.text }]}>
                Too Tough to Decide
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.cancelButton,
                colors.tertiaryButton && {
                  backgroundColor: colors.tertiaryButton.backgroundColor,
                  borderWidth: colors.tertiaryButton.borderWidth,
                  borderColor: colors.tertiaryButton.borderColor
                }
              ]}
              onPress={() => {
                resetState();
                onClose();
              }}
            >
              <Text style={[styles.cancelButtonText, { color: colors.text }]}>cancel</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    </Modal>
  );
};

// ============================================================================
// STYLES (same as RatingSystem.js)
// ============================================================================

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: width * 0.9,
    maxWidth: 500,
    borderRadius: 20,
    padding: 24,
  },
  modalHeader: {
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  movieTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  sentimentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  sentimentButton: {
    width: '48%',
    aspectRatio: 1,
    borderWidth: 2,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sentimentEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  sentimentLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  sentimentDescription: {
    fontSize: 12,
    textAlign: 'center',
  },
  comparisonContainer: {
    width: width * 0.95,
    maxWidth: 600,
    maxHeight: height * 0.9,
    borderRadius: 20,
    padding: 20,
  },
  comparisonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  roundText: {
    fontSize: 14,
    fontWeight: '600',
  },
  currentRatingText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  confidenceContainer: {
    marginVertical: 12,
    alignItems: 'center',
  },
  progressBarContainer: {
    width: '100%',
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 1,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  confidenceText: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 6,
  },
  probabilityText: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  questionText: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 24,
  },
  choicesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 24,
  },
  choiceButton: {
    width: '42%',
    borderWidth: 2,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  poster: {
    width: '100%',
    aspectRatio: 2/3,
    borderRadius: 8,
    marginBottom: 12,
  },
  choiceTitle: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  newBadge: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  ratingBadge: {
    fontSize: 12,
  },
  vsText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  actionButtons: {
    gap: 12,
  },
  tooToughButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',  // Semi-transparent white
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  tooToughText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 16,
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',  // Semi-transparent white
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  cancelButtonText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 16,
  },
  // Completion Modal styles
  completionContainer: {
    width: width * 0.85,
    maxWidth: 400,
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
  },
  completionHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  completionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
    textAlign: 'center',
  },
  completionMovieTitle: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 24,
  },
  ratingDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 24,
  },
  ratingNumber: {
    fontSize: 72,
    fontWeight: 'bold',
  },
  ratingOutOf: {
    fontSize: 32,
    fontWeight: '500',
    marginLeft: 8,
  },
  tapToCloseText: {
    fontSize: 14,
    fontStyle: 'italic',
    opacity: 0.7,
  },
});

// ============================================================================
// ELO TO BRADLEY-TERRY MIGRATION
// ============================================================================

/**
 * Convert existing ELO-based movie to Bradley-Terry format
 *
 * @param {Object} movie - Movie with ELO rating system
 * @returns {Object} Movie with BT parameters
 */
export const convertELOMovieToBT = (movie) => {
  // Get existing user rating (convert from ELO if needed)
  const userRating = movie.userRating || (movie.eloRating ? movie.eloRating / 10 : null);

  // Get TMDB rating as prior
  const tmdbRating = movie.vote_average || movie.score || BT_CONFIG.DEFAULT_TMDB_RATING;

  // If user has rated, use their rating as initial theta
  // Otherwise, use TMDB prior
  const thetaMLE = userRating ? ratingToTheta(userRating) : ratingToTheta(tmdbRating);
  const thetaPrior = ratingToTheta(tmdbRating);

  // Convert ELO comparison data to BT format
  const comparisons = movie.gamesPlayed || movie.comparisons || 0;
  const wins = movie.comparisonWins || movie.wins || 0;
  const losses = comparisons - wins;

  console.log(`🔄 Converting ${movie.title || movie.name}:`);
  console.log(`   ELO rating: ${movie.eloRating || 'none'}`);
  console.log(`   User rating: ${userRating?.toFixed(2) || 'none'}`);
  console.log(`   TMDB rating: ${tmdbRating.toFixed(2)}`);
  console.log(`   Comparisons: ${comparisons} (${wins}W/${losses}L)`);
  console.log(`   θ_MLE: ${thetaMLE.toFixed(3)}, θ_prior: ${thetaPrior.toFixed(3)}`);

  return {
    ...movie,
    // Bradley-Terry parameters
    theta: thetaMLE,
    thetaPrior: thetaPrior,
    comparisons: comparisons,
    wins: wins,
    losses: losses,

    // Display rating (preserve user rating or use TMDB)
    userRating: userRating || thetaToRating(thetaPrior),

    // Legacy compatibility
    eloRating: (userRating || thetaToRating(thetaPrior)) * 10,

    // Metadata
    tmdbRating: tmdbRating,
    migratedToBT: true,
    lastUpdated: new Date().toISOString()
  };
};

/**
 * Migrate entire movie library from ELO to Bradley-Terry
 *
 * @param {Array} movies - Array of ELO-based movies
 * @returns {Array} Array of BT movies
 */
export const migrateLibraryToBT = (movies) => {
  console.log(`🚀 Migrating ${movies.length} movies from ELO to Bradley-Terry...`);

  const migrated = movies.map(movie => {
    // Skip if already migrated
    if (movie.migratedToBT) {
      console.log(`⏭️  Skipping ${movie.title || movie.name} (already migrated)`);
      return movie;
    }

    return convertELOMovieToBT(movie);
  });

  const newlyMigrated = migrated.filter(m => !movies.find(old => old.id === m.id)?.migratedToBT);
  console.log(`✅ Migration complete: ${newlyMigrated.length} newly migrated, ${migrated.length - newlyMigrated.length} already done`);

  return migrated;
};

/**
 * Check if a movie has been migrated to BT
 *
 * @param {Object} movie - Movie object
 * @returns {boolean} Whether movie uses BT system
 */
export const isBradleyTerryMovie = (movie) => {
  return movie.migratedToBT === true &&
         movie.theta !== undefined &&
         movie.thetaPrior !== undefined;
};

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  // Components
  SentimentRatingModal,
  ComparisonModal,
  RatingCompletionModal,

  // Core BT functions
  ratingToTheta,
  thetaToRating,
  bradleyTerryProbability,
  updateThetaMLE,
  applyShrinkage,
  getThetaConfidenceInterval,
  shouldStopEarly,

  // Movie management
  initializeBTMovie,
  updateMovieAfterComparison,

  // Migration functions
  convertELOMovieToBT,
  migrateLibraryToBT,
  isBradleyTerryMovie,

  // Opponent selection
  selectOpponentFromSentiment,
  selectRandomOpponent,

  // Configuration
  BT_CONFIG,
  SENTIMENT_CONFIG,
};
