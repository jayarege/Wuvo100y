/**
 * RATING SYSTEM - Clean Core Implementation
 * 
 * Purpose: Emotion-based movie rating using ELO comparisons
 * Philosophy: Keep it simple, obvious, and maintainable
 * 
 * Core Features:
 * - Sentiment-based opponent selection (LOVED/LIKED/AVERAGE/DISLIKED)
 * - ELO rating adjustments through head-to-head comparisons
 * - Wilson confidence interval for early stopping
 * - Unified comparison modal for all screens
 * 
 * CODE_BIBLE Compliance:
 * - Clear and obvious code (Commandment #3)
 * - Explicit error handling (Commandment #9)
 * - Preserve context with good naming (Commandment #5)
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
  ScrollView,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../config/storageConfig';

// ============================================================================
// CONFIGURATION
// ============================================================================

const RATING_CONFIG = {
  // Sentiment to percentile mapping
  PERCENTILES: {
    LOVED: [0.0, 0.25],      // Top 25% of user's rated content
    LIKED: [0.25, 0.50],     // 25-50% percentile
    AVERAGE: [0.50, 0.75],   // 50-75% percentile
    DISLIKED: [0.75, 1.0]    // Bottom 25%
  },
  
  // Comparison rounds configuration
  MIN_COMPARISONS: 3,        // Minimum rounds before early stop
  MAX_COMPARISONS: 5,        // Maximum rounds
  
  // ELO configuration
  K_FACTOR: 32,              // Base K-factor for rating changes
  ELO_SCALE: 400,            // Standard ELO scale divisor
  
  // Wilson CI configuration for early stopping
  CONFIDENCE_THRESHOLD: 0.6, // Stop if win rate CI excludes 0.5 by this margin
  Z_SCORE: 1.96,             // 95% confidence level
  
  // Rating bounds
  MIN_RATING: 1.0,
  MAX_RATING: 10.0,
  
  // Minimum library size
  MIN_LIBRARY_SIZE: 3
};

// Sentiment display configuration
const SENTIMENT_CONFIG = {
  LOVED: {
    label: 'Love',
    emoji: '❤️',
    color: '#FF4444',
    description: 'An all-time favorite'
  },
  LIKED: {
    label: 'Like',
    emoji: '👍',
    color: '#66BB6A',
    description: 'Really enjoyed it'
  },
  AVERAGE: {
    label: 'Okay',
    emoji: '😐',
    color: '#FFB74D',
    description: 'It was alright'
  },
  DISLIKED: {
    label: 'Dislike',
    emoji: '👎',
    color: '#EF5350',
    description: 'Not for me'
  }
};

// ============================================================================
// CORE MATH FUNCTIONS
// ============================================================================

/**
 * Calculate new ELO ratings after a comparison
 * @param {number} ratingA - Current rating of item A
 * @param {number} ratingB - Current rating of item B
 * @param {boolean} aWon - Whether A won the comparison
 * @param {number} kFactor - K-factor (higher = more volatile changes)
 * @returns {{newA: number, newB: number}} Updated ratings
 */
export const eloUpdate = (ratingA, ratingB, aWon, kFactor = RATING_CONFIG.K_FACTOR) => {
  // Expected score for A based on rating difference
  const expectedA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / RATING_CONFIG.ELO_SCALE));
  
  // Actual score (1 for win, 0 for loss)
  const actualA = aWon ? 1 : 0;
  
  // Calculate new ratings
  const newA = ratingA + kFactor * (actualA - expectedA);
  const newB = ratingB + kFactor * ((1 - actualA) - (1 - expectedA));
  
  return { 
    newA: Math.max(RATING_CONFIG.MIN_RATING, Math.min(RATING_CONFIG.MAX_RATING, newA)),
    newB: Math.max(RATING_CONFIG.MIN_RATING, Math.min(RATING_CONFIG.MAX_RATING, newB))
  };
};

/**
 * Calculate Wilson confidence interval for win rate
 * Used to determine if we're confident enough to stop early
 * 
 * @param {number} wins - Number of wins
 * @param {number} total - Total comparisons
 * @param {number} z - Z-score for confidence level (1.96 = 95%)
 * @returns {{lo: number, hi: number, width: number}} Confidence interval bounds
 */
export const wilsonConfidenceInterval = (wins, total, z = RATING_CONFIG.Z_SCORE) => {
  if (total === 0) {
    return { lo: 0, hi: 1, width: 1 };
  }
  
  const p = wins / total;
  const denom = 1 + (z * z) / total;
  const center = (p + (z * z) / (2 * total)) / denom;
  const margin = (z * Math.sqrt((p * (1 - p)) / total + (z * z) / (4 * total * total))) / denom;
  
  const lo = Math.max(0, center - margin);
  const hi = Math.min(1, center + margin);
  
  return { 
    lo, 
    hi, 
    width: hi - lo 
  };
};

/**
 * Check if we should stop comparisons early
 * Stops if we're confident the item is clearly better or worse than 50/50
 * 
 * @param {number} wins - Number of wins
 * @param {number} comparisons - Total comparisons so far
 * @returns {boolean} Whether to stop
 */
export const shouldStopEarly = (wins, comparisons) => {
  if (comparisons < RATING_CONFIG.MIN_COMPARISONS) {
    return false; // Always do minimum rounds
  }
  
  const ci = wilsonConfidenceInterval(wins, comparisons);
  
  // Stop if confidence interval clearly excludes 0.5 (tie)
  // This means we're confident the item is clearly better or worse
  const excludesTie = (ci.hi < 0.5 - RATING_CONFIG.CONFIDENCE_THRESHOLD) || 
                      (ci.lo > 0.5 + RATING_CONFIG.CONFIDENCE_THRESHOLD);
  
  if (excludesTie) {
    console.log(`✅ Early stop: ${wins}/${comparisons} wins, CI [${ci.lo.toFixed(2)}, ${ci.hi.toFixed(2)}] excludes 0.5`);
  }
  
  return excludesTie;
};

// ============================================================================
// OPPONENT SELECTION
// ============================================================================

/**
 * Select an opponent from a percentile range based on user sentiment
 * 
 * @param {string} sentiment - User's emotion (LOVED/LIKED/AVERAGE/DISLIKED)
 * @param {Array} ratedMovies - User's rated content
 * @param {string|number} excludeId - ID to exclude (the new movie being rated)
 * @param {string} mediaType - 'movie' or 'tv'
 * @returns {Object|null} Selected opponent or null if none available
 */
export const selectOpponentFromSentiment = (sentiment, ratedMovies, excludeId, mediaType) => {
  // Validate inputs
  if (!ratedMovies || ratedMovies.length === 0) {
    console.warn('⚠️ No rated movies available for opponent selection');
    return null;
  }
  
  // Filter valid opponents (same mediaType, has rating, not excluded)
  const validOpponents = ratedMovies.filter(movie => 
    movie.userRating != null &&
    movie.id !== excludeId &&
    (movie.mediaType || 'movie') === mediaType
  );
  
  if (validOpponents.length === 0) {
    console.warn('⚠️ No valid opponents after filtering');
    return null;
  }
  
  // Sort by rating (descending) to establish percentiles
  const sorted = [...validOpponents].sort((a, b) => (b.userRating || 0) - (a.userRating || 0));
  
  // Get percentile range for this sentiment
  const [minPercent, maxPercent] = RATING_CONFIG.PERCENTILES[sentiment] || [0.25, 0.75];
  
  // Calculate indices
  const startIdx = Math.floor(sorted.length * minPercent);
  const endIdx = Math.min(Math.floor(sorted.length * maxPercent), sorted.length - 1);
  
  // Extract pool from percentile range
  const pool = sorted.slice(startIdx, endIdx + 1);
  
  if (pool.length === 0) {
    // Fallback: if percentile is empty, use middle of library
    console.warn(`⚠️ Empty percentile for ${sentiment}, using fallback`);
    const midIdx = Math.floor(sorted.length / 2);
    return sorted[midIdx];
  }
  
  // Random selection from pool
  const opponent = pool[Math.floor(Math.random() * pool.length)];
  
  console.log(`🎯 Selected opponent: ${opponent.title || opponent.name} (${opponent.userRating.toFixed(1)}) from ${sentiment} percentile`);
  
  return opponent;
};

/**
 * Select a random opponent (used for rounds 2+)
 * 
 * @param {Array} ratedMovies - Available opponents
 * @param {Array} excludeIds - IDs to exclude
 * @param {string} mediaType - Media type filter
 * @returns {Object|null} Random opponent
 */
export const selectRandomOpponent = (ratedMovies, excludeIds = [], mediaType) => {
  const validOpponents = ratedMovies.filter(movie =>
    movie.userRating != null &&
    !excludeIds.includes(movie.id) &&
    (movie.mediaType || 'movie') === mediaType
  );
  
  if (validOpponents.length === 0) {
    return null;
  }
  
  // Shuffle and pick first
  const shuffled = [...validOpponents].sort(() => 0.5 - Math.random());
  return shuffled[0];
};

// ============================================================================
// STORAGE HELPERS
// ============================================================================

/**
 * Get storage key based on media type
 */
const getStorageKey = (mediaType) => {
  return mediaType === 'movie' ? STORAGE_KEYS.MOVIES.SEEN : STORAGE_KEYS.TV_SHOWS.SEEN;
};

/**
 * Update opponent's rating in storage
 * This is important because opponents get ELO updates too
 */
const updateOpponentInStorage = async (opponent, newRating, mediaType) => {
  try {
    const storageKey = getStorageKey(mediaType);
    const stored = await AsyncStorage.getItem(storageKey);
    
    if (!stored) return;
    
    const items = JSON.parse(stored);
    const index = items.findIndex(item => item.id === opponent.id);
    
    if (index !== -1) {
      items[index].userRating = newRating;
      items[index].eloRating = newRating * 10; // Legacy compatibility
      await AsyncStorage.setItem(storageKey, JSON.stringify(items));
      console.log(`💾 Updated opponent ${opponent.title || opponent.name} to ${newRating.toFixed(2)}`);
    }
  } catch (error) {
    console.error('❌ Failed to update opponent rating:', error);
  }
};

// ============================================================================
// SENTIMENT SELECTION MODAL
// ============================================================================

/**
 * Modal for user to select their sentiment about the content
 * This drives which percentile we select opponents from
 */
export const SentimentRatingModal = ({ visible, movie, onSelect, onClose, colors }) => {
  const sentiments = ['LOVED', 'LIKED', 'AVERAGE', 'DISLIKED'];
  
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContainer, { backgroundColor: colors.card }]}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              How did you feel about
            </Text>
            <Text style={[styles.movieTitle, { color: colors.accent }]}>
              {movie?.title || movie?.name}?
            </Text>
          </View>
          
          {/* Sentiment options */}
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
          
          {/* Cancel button */}
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
// COMPARISON MODAL (Unified across all screens)
// ============================================================================

/**
 * Unified comparison modal - head-to-head battle interface
 * This component is used by ALL screens for consistent UX
 * 
 * Features:
 * - 3-5 rounds of comparisons
 * - ELO rating updates
 * - Wilson CI early stopping
 * - "Too tough to decide" option
 */
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
  // State
  const [currentRound, setCurrentRound] = useState(1);
  const [currentOpponent, setCurrentOpponent] = useState(null);
  const [currentRating, setCurrentRating] = useState(null);
  const [wins, setWins] = useState(0);
  const [usedOpponentIds, setUsedOpponentIds] = useState([]);
  const usedIdsRef = useRef([]);
  
  // Initialize first opponent when modal opens
  useEffect(() => {
    if (visible && currentRound === 1 && !currentOpponent) {
      // First round: use sentiment-based selection
      const opponent = selectOpponentFromSentiment(
        sentiment,
        ratedMovies,
        newMovie.id,
        mediaType
      );
      
      if (!opponent) {
        Alert.alert(
          'Not Enough Ratings',
          `You need at least ${RATING_CONFIG.MIN_LIBRARY_SIZE} rated ${mediaType}s to use comparisons.`,
          [{ text: 'OK', onPress: onClose }]
        );
        return;
      }
      
      setCurrentOpponent(opponent);
      // Start with opponent's rating as baseline
      setCurrentRating(opponent.userRating);
      usedIdsRef.current = [opponent.id];
      setUsedOpponentIds([opponent.id]);
    }
  }, [visible, currentRound, currentOpponent, sentiment, ratedMovies, newMovie.id, mediaType]);
  
  // Handle comparison choice
  const handleChoice = useCallback(async (userChoseNew) => {
    if (!currentOpponent || currentRating === null) return;
    
    // Update ELO ratings
    const { newA, newB } = eloUpdate(
      currentRating,
      currentOpponent.userRating,
      userChoseNew,
      RATING_CONFIG.K_FACTOR
    );
    
    console.log(`⚔️ Round ${currentRound}: ${userChoseNew ? 'New wins' : 'Opponent wins'}`);
    console.log(`📊 Rating: ${currentRating.toFixed(2)} → ${newA.toFixed(2)}`);
    
    // Update opponent's rating in storage
    await updateOpponentInStorage(currentOpponent, newB, mediaType);
    
    // Track wins
    const newWins = userChoseNew ? wins + 1 : wins;
    setWins(newWins);
    setCurrentRating(newA);
    
    // Check stopping conditions
    const shouldStop = 
      currentRound >= RATING_CONFIG.MAX_COMPARISONS ||
      shouldStopEarly(newWins, currentRound);
    
    if (shouldStop) {
      console.log(`🏁 Comparison complete after ${currentRound} rounds`);
      console.log(`📊 Final rating: ${newA.toFixed(2)} (${newWins}/${currentRound} wins)`);
      onComplete(newA);
      resetState();
    } else {
      // Get next opponent (random from remaining)
      const nextOpponent = selectRandomOpponent(
        ratedMovies,
        [...usedIdsRef.current, newMovie.id],
        mediaType
      );
      
      if (!nextOpponent) {
        // Ran out of opponents
        console.log('⚠️ No more opponents available');
        onComplete(newA);
        resetState();
      } else {
        setCurrentOpponent(nextOpponent);
        setCurrentRound(currentRound + 1);
        usedIdsRef.current = [...usedIdsRef.current, nextOpponent.id];
        setUsedOpponentIds([...usedIdsRef.current]);
      }
    }
  }, [currentOpponent, currentRating, currentRound, wins, newMovie.id, ratedMovies, mediaType, onComplete]);
  
  // Handle "too tough to decide"
  const handleTooTough = useCallback(async () => {
    if (!currentOpponent || currentRating === null) return;
    
    // Average the two ratings and place them very close together
    const avgRating = (currentRating + currentOpponent.userRating) / 2;
    const newMovieRating = Math.min(10, Math.max(1, avgRating + 0.05));
    const opponentRating = Math.min(10, Math.max(1, avgRating - 0.05));
    
    console.log(`🤷 Too tough to decide - averaging ratings`);
    console.log(`📊 New movie: ${newMovieRating.toFixed(2)}, Opponent: ${opponentRating.toFixed(2)}`);
    
    await updateOpponentInStorage(currentOpponent, opponentRating, mediaType);
    
    onComplete(newMovieRating);
    resetState();
  }, [currentOpponent, currentRating, mediaType, onComplete]);
  
  // Reset state when modal closes
  const resetState = () => {
    setCurrentRound(1);
    setCurrentOpponent(null);
    setCurrentRating(null);
    setWins(0);
    setUsedOpponentIds([]);
    usedIdsRef.current = [];
  };
  
  useEffect(() => {
    if (!visible) {
      resetState();
    }
  }, [visible]);
  
  if (!currentOpponent) {
    return null;
  }
  
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.comparisonContainer, { backgroundColor: colors.card }]}>
          {/* Header */}
          <View style={styles.comparisonHeader}>
            <Text style={[styles.roundText, { color: colors.subText }]}>
              Round {currentRound} of {RATING_CONFIG.MAX_COMPARISONS}
            </Text>
            {currentRating && (
              <Text style={[styles.currentRatingText, { color: colors.accent }]}>
                Current: {currentRating.toFixed(1)}
              </Text>
            )}
          </View>
          
          {/* Question */}
          <Text style={[styles.questionText, { color: colors.text }]}>
            Which do you prefer?
          </Text>
          
          {/* Movie choices */}
          <View style={styles.choicesContainer}>
            {/* New movie */}
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
            
            {/* VS divider */}
            <Text style={[styles.vsText, { color: colors.subText }]}>VS</Text>
            
            {/* Opponent */}
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
              {currentOpponent.userRating && (
                <Text style={[styles.ratingBadge, { color: colors.subText }]}>
                  ★ {currentOpponent.userRating.toFixed(1)}
                </Text>
              )}
            </TouchableOpacity>
          </View>
          
          {/* Action buttons */}
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
// STYLES
// ============================================================================

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  // Modal overlay
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Sentiment modal
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
  
  // Comparison modal
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
    marginBottom: 16,
  },
  roundText: {
    fontSize: 14,
    fontWeight: '600',
  },
  currentRatingText: {
    fontSize: 14,
    fontWeight: 'bold',
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
  
  // Action buttons
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
// EXPORTS
// ============================================================================

export default {
  // Components
  SentimentRatingModal,
  ComparisonModal,
  
  // Functions
  eloUpdate,
  wilsonConfidenceInterval,
  shouldStopEarly,
  selectOpponentFromSentiment,
  selectRandomOpponent,
  
  // Configuration
  RATING_CONFIG,
  SENTIMENT_CONFIG,
};
