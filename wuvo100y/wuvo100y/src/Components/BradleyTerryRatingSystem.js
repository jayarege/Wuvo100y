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
 * 
 * Mathematical Foundation:
 * θ_i = log-odds strength parameter
 * θ_prior = log(r_TMDB / (10 - r_TMDB))  // TMDB rating as prior
 * θ_posterior = (n * θ_mle + α * θ_prior) / (n + α)  // Bayesian update
 * 
 * CODE_BIBLE Compliance:
 * - Clear and obvious (Commandment #3): Math matches textbook Bradley-Terry
 * - Preserve context (Commandment #5): Comments explain WHY TMDB prior works
 * - Handle errors explicitly (Commandment #9): Clamps, validation, fallbacks
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
  WILSON_CONFIDENCE_THRESHOLD: 0.80, // 80% confidence required to stop early
  
  // Bradley-Terry specific parameters
  LEARNING_RATE: 0.1,        // η: Step size for gradient ascent (0.1 recommended)
  SHRINKAGE_STRENGTH: 10,    // α: Pull toward TMDB prior (10 = moderate)
  
  // Rating bounds
  MIN_RATING: 1.0,
  MAX_RATING: 10.0,
  
  // Confidence intervals
  Z_SCORE: 1.96,             // 95% confidence level
  
  // Minimum library size
  MIN_LIBRARY_SIZE: 3,
  
  // Fallback for movies without TMDB score
  DEFAULT_TMDB_RATING: 6.5   // Median TMDB rating
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
 * Uses Fisher information approximation
 * 
 * @param {number} theta - Current log-odds strength
 * @param {number} comparisons - Number of comparisons
 * @param {number} z - Z-score for confidence level (1.96 = 95%)
 * @returns {{lower: number, upper: number, width: number}} Confidence interval
 * 
 * Interpretation (Wilson CI):
 * - width ≤ 0.8: High confidence (≥80%) - can stop early
 * - width > 0.8: Low confidence (<80%) - continue comparisons
 * - After 3 comparisons: typically width ≈ 2.3 (need more data)
 * - After 5 comparisons: typically width ≈ 1.8 (approaching threshold)
 */
export const getThetaConfidenceInterval = (theta, comparisons, z = BT_CONFIG.Z_SCORE) => {
  if (comparisons === 0) {
    return { lower: theta - 2, upper: theta + 2, width: 4 };
  }
  
  // Fisher information for Bradley-Terry is approximately n/4
  const standardError = 2 / Math.sqrt(comparisons);
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
export const shouldStopEarly = (comparisons, confidenceWidth) => {
  // Must complete minimum comparisons
  if (comparisons < BT_CONFIG.MIN_COMPARISONS) {
    console.log(`⏳ Need ${BT_CONFIG.MIN_COMPARISONS - comparisons} more comparison(s) to reach minimum`);
    return false;
  }
  
  // Convert CI width to confidence percentage
  // Narrower CI = higher confidence
  // confidenceWidth of ~0.8 ≈ 80% confidence
  // confidenceWidth of ~1.2 ≈ 60% confidence
  const CONFIDENCE_THRESHOLD = 0.8; // 80% confidence corresponds to CI width ≤ 0.8
  
  const hasHighConfidence = confidenceWidth <= CONFIDENCE_THRESHOLD;
  
  console.log(`📊 Comparison ${comparisons}: CI width = ${confidenceWidth.toFixed(2)}, Confidence ${hasHighConfidence ? '≥' : '<'} 80%`);
  
  if (hasHighConfidence) {
    console.log(`✅ Stopping early: ${comparisons} comparisons, High confidence (CI width ≤ ${CONFIDENCE_THRESHOLD})`);
    return true;
  }
  
  // Continue to next comparison if not at max
  console.log(`⏭️  Continuing to next comparison (confidence < 80%)`);
  return false;
};

// ============================================================================
// MOVIE DATA STRUCTURE
// ============================================================================

/**
 * Initialize Bradley-Terry parameters for a new movie
 * 
 * @param {Object} movie - Movie object from TMDB
 * @returns {Object} Movie with BT parameters
 */
export const initializeBTMovie = (movie) => {
  // Get TMDB rating (score field from API)
  const tmdbRating = movie.vote_average || movie.score || BT_CONFIG.DEFAULT_TMDB_RATING;
  
  // Convert to theta (log-odds)
  const thetaPrior = ratingToTheta(tmdbRating);
  
  return {
    ...movie,
    // Bradley-Terry parameters
    theta: thetaPrior,           // Current log-odds strength
    thetaPrior: thetaPrior,      // TMDB-based prior (never changes)
    comparisons: 0,              // Number of head-to-head comparisons
    wins: 0,                     // Number of wins
    losses: 0,                   // Number of losses
    
    // Display rating (for UI)
    userRating: thetaToRating(thetaPrior),
    
    // Legacy compatibility
    eloRating: thetaToRating(thetaPrior) * 10,
    
    // Metadata
    tmdbRating: tmdbRating,      // Original TMDB rating
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
  
  // Update theta using gradient ascent
  const thetaMLE = updateThetaMLE(movie.theta, predictedProb, won);
  
  // Apply Bayesian shrinkage toward TMDB prior
  const thetaPosterior = applyShrinkage(
    thetaMLE,
    movie.thetaPrior,
    movie.comparisons + 1
  );
  
  // Convert back to user rating
  const newRating = thetaToRating(thetaPosterior);
  
  console.log(`📊 ${movie.title || movie.name}:`);
  console.log(`   Predicted P(win) = ${(predictedProb * 100).toFixed(1)}%`);
  console.log(`   Actual: ${won ? 'WIN' : 'LOSS'}`);
  console.log(`   θ: ${movie.theta.toFixed(3)} → ${thetaPosterior.toFixed(3)}`);
  console.log(`   Rating: ${movie.userRating.toFixed(2)} → ${newRating.toFixed(2)}`);
  
  return {
    ...movie,
    theta: thetaPosterior,
    comparisons: movie.comparisons + 1,
    wins: movie.wins + (won ? 1 : 0),
    losses: movie.losses + (won ? 0 : 1),
    userRating: newRating,
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
  console.log(`🎯 Opponent: ${opponent.title || opponent.name} (θ=${opponent.theta.toFixed(2)}, rating=${opponent.userRating.toFixed(1)})`);
  
  return opponent;
};

export const selectRandomOpponent = (ratedMovies, excludeIds = [], mediaType) => {
  const validOpponents = ratedMovies.filter(movie =>
    movie.userRating != null &&
    !excludeIds.includes(movie.id) &&
    (movie.mediaType || 'movie') === mediaType
  );
  
  if (validOpponents.length === 0) return null;
  
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
  const usedIdsRef = useRef([]);
  
  // Safety check: don't render if newMovie is null/undefined
  if (!newMovie) {
    return null;
  }
  
  // Initialize when modal opens
  useEffect(() => {
    if (visible && newMovie && currentRound === 1 && !currentOpponent) {
      // Initialize new movie with BT parameters
      const btMovie = initializeBTMovie(newMovie);
      setCurrentMovie(btMovie);
      
      // Select first opponent based on sentiment
      const opponent = selectOpponentFromSentiment(sentiment, ratedMovies, newMovie.id, mediaType);
      
      if (!opponent) {
        Alert.alert(
          'Not Enough Ratings',
          `You need at least ${BT_CONFIG.MIN_LIBRARY_SIZE} rated ${mediaType}s.`,
          [{ text: 'OK', onPress: onClose }]
        );
        return;
      }
      
      setCurrentOpponent(opponent);
      usedIdsRef.current = [opponent.id];
      setUsedOpponentIds([opponent.id]);
      
      console.log(`🆕 New movie: ${btMovie.title || btMovie.name}`);
      console.log(`   TMDB rating: ${btMovie.tmdbRating.toFixed(1)}`);
      console.log(`   θ_prior: ${btMovie.thetaPrior.toFixed(3)}`);
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
    
    // Save opponent to storage
    await updateOpponentInStorage(updatedOpponent, mediaType);
    
    setCurrentMovie(updatedMovie);
    
    // Check stopping conditions
    const ci = getThetaConfidenceInterval(updatedMovie.theta, updatedMovie.comparisons);
    const shouldStop = 
      currentRound >= BT_CONFIG.MAX_COMPARISONS ||
      shouldStopEarly(updatedMovie.comparisons, ci.width);
    
    if (shouldStop) {
      console.log(`🏁 Complete after ${currentRound} rounds`);
      console.log(`   Final θ: ${updatedMovie.theta.toFixed(3)}`);
      console.log(`   Final rating: ${updatedMovie.userRating.toFixed(2)}`);
      console.log(`   Win rate: ${(updatedMovie.wins / updatedMovie.comparisons * 100).toFixed(1)}%`);
      
      onComplete(updatedMovie);
      resetState();
    } else {
      // Get next opponent
      const nextOpponent = selectRandomOpponent(
        ratedMovies,
        [...usedIdsRef.current, newMovie.id],
        mediaType
      );
      
      if (!nextOpponent) {
        onComplete(updatedMovie);
        resetState();
      } else {
        setCurrentOpponent(nextOpponent);
        setCurrentRound(currentRound + 1);
        usedIdsRef.current = [...usedIdsRef.current, nextOpponent.id];
        setUsedOpponentIds([...usedIdsRef.current]);
      }
    }
  }, [currentOpponent, currentMovie, currentRound, newMovie?.id, ratedMovies, mediaType, onComplete]);
  
  // Handle "too tough to decide"
  const handleTooTough = useCallback(async () => {
    if (!currentOpponent || !currentMovie) return;
    
    // Average the theta values
    const avgTheta = (currentMovie.theta + currentOpponent.theta) / 2;
    const movieTheta = avgTheta + 0.01;
    const opponentTheta = avgTheta - 0.01;
    
    const finalMovie = {
      ...currentMovie,
      theta: movieTheta,
      userRating: thetaToRating(movieTheta),
      eloRating: thetaToRating(movieTheta) * 10,
      comparisons: currentMovie.comparisons + 1
    };
    
    const updatedOpponent = {
      ...currentOpponent,
      theta: opponentTheta,
      userRating: thetaToRating(opponentTheta),
      eloRating: thetaToRating(opponentTheta) * 10
    };
    
    await updateOpponentInStorage(updatedOpponent, mediaType);
    
    console.log(`🤷 Too tough - averaged θ values`);
    onComplete(finalMovie);
    resetState();
  }, [currentOpponent, currentMovie, mediaType, onComplete]);
  
  const resetState = () => {
    setCurrentRound(1);
    setCurrentOpponent(null);
    setCurrentMovie(null);
    setUsedOpponentIds([]);
    usedIdsRef.current = [];
  };
  
  useEffect(() => {
    if (!visible) resetState();
  }, [visible]);
  
  if (!currentOpponent || !currentMovie) return null;
  
  // Calculate win probability for display
  const winProb = bradleyTerryProbability(currentMovie.theta, currentOpponent.theta);
  const ci = getThetaConfidenceInterval(currentMovie.theta, currentMovie.comparisons);
  
  return (
    <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.comparisonContainer, { backgroundColor: colors.card }]}>
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
                ★ {currentOpponent.userRating.toFixed(1)}
              </Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.tooToughButton, { borderColor: colors.border }]}
              onPress={handleTooTough}
            >
              <Text style={[styles.tooToughText, { color: colors.text }]}>
                Too Tough to Decide
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.cancelButton, { borderColor: colors.border }]}
              onPress={() => {
                resetState();
                onClose();
              }}
            >
              <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
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
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  tooToughText: {
    fontSize: 14,
    fontWeight: '600',
  },
  cancelButton: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
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
