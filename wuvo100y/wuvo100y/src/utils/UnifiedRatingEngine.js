/**
 * Unified Rating Engine - CODE_BIBLE Compliant
 * 
 * Eliminates code duplication across Home, AddMovie, and Wildcard screens
 * by providing a single, consistent rating system that all screens can use.
 * 
 * Follows CODE_BIBLE principles:
 * - Don't Repeat Yourself (DRY)
 * - Single Source of Truth
 * - Clear and obvious code structure
 * - Preserve context, not delete it
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { adjustRatingWildcard } from './ELOCalculations';

const STORAGE_KEY_MOVIES = 'watchedMovies';

/**
 * Comparison result constants for type safety
 */
export const ComparisonResults = {
  A_WINS: 'a_wins',
  B_WINS: 'b_wins', 
  TIE: 'too_tough'
};

/**
 * Emotion-based percentile ranges
 * Used consistently across all screens for opponent selection
 */
const EMOTION_PERCENTILES = {
  LOVED: [0.0, 0.25],      // Top 25% of user's rated movies
  LIKED: [0.25, 0.50],     // Upper-middle 25-50%
  AVERAGE: [0.50, 0.75],   // Lower-middle 50-75%  
  DISLIKED: [0.75, 1.0]    // Bottom 25%
};

/**
 * Unified Rating Engine Class
 * Handles all rating logic that was previously duplicated across screens
 */
class UnifiedRatingEngine {
  
  /**
   * Select movie from percentile range based on emotion
   * Replaces duplicated selectMovieFromPercentile functions
   */
  static selectOpponentFromEmotion(emotion, seenMovies, excludeMovieId = null) {
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
  }

  /**
   * Select random opponent from seen movies
   * Used for rounds 2 and 3 of comparison flow
   */
  static selectRandomOpponent(seenMovies, excludeMovieIds = []) {
    if (!seenMovies || seenMovies.length === 0) return null;
    
    const availableMovies = seenMovies.filter(movie => 
      movie.userRating && !excludeMovieIds.includes(movie.id)
    );
    
    if (availableMovies.length === 0) return null;
    
    return availableMovies[Math.floor(Math.random() * availableMovies.length)];
  }

  /**
   * Calculate rating for Round 1 (Unknown vs Known)
   * Uses the baseline-free approach from Home/AddMovie screens
   */
  static calculateRound1Rating(newMovieWon, opponentRating) {
    if (newMovieWon) {
      return Math.min(10, opponentRating + 0.5);
    } else {
      return Math.max(1, opponentRating - 0.5);
    }
  }

  /**
   * Unified pairwise rating calculation for all rounds
   * Uses consistent Bradley-Terry math throughout
   */
  static calculatePairwiseRating(config) {
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
  }


  /**
   * Handle "Too Tough to Decide" scenario
   * Creates very close ratings between the two movies
   */
  static handleTooToughToDecide(currentRating, opponentRating) {
    const averageRating = (currentRating + opponentRating) / 2;
    
    // Create very close ratings (±0.05 difference)
    const newCurrentRating = Math.min(10, Math.max(1, averageRating + 0.05));
    const newOpponentRating = Math.min(10, Math.max(1, averageRating - 0.05));
    
    return {
      currentRating: newCurrentRating,
      opponentRating: newOpponentRating
    };
  }

  /**
   * Update opponent movie rating in storage
   * Handles AsyncStorage persistence for opponent rating changes
   */
  static async updateOpponentRating(opponentMovie, newRating, storageKey = STORAGE_KEY_MOVIES) {
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
  }

  /**
   * Main rating flow orchestrator
   * Handles the complete 3-round comparison process
   */
  static async processRatingFlow(config) {
    const {
      newMovie,
      emotion,
      seenMovies,
      onComparisonStart,
      onComparisonResult,
      onFinalRating,
      onError
    } = config;

    try {
      // Validate inputs
      if (!newMovie || !emotion || !seenMovies) {
        throw new Error('Missing required parameters for rating flow');
      }

      if (seenMovies.length < 3) {
        throw new Error('Need at least 3 rated movies for comparison system');
      }

      console.log(`🎬 Starting unified rating flow for: ${newMovie.title}`);
      console.log(`🎭 User emotion: ${emotion}`);

      // Round 1: Unknown vs Known (emotion-based opponent)
      const round1Opponent = this.selectOpponentFromEmotion(emotion, seenMovies, newMovie.id);
      if (!round1Opponent) {
        throw new Error('No suitable opponent found for emotion-based comparison');
      }

      let currentRating = null;
      let comparisonHistory = [];
      let usedOpponentIds = [round1Opponent.id];

      // Start comparison flow
      if (onComparisonStart) {
        onComparisonStart({
          round: 1,
          opponent: round1Opponent,
          totalRounds: 3
        });
      }

      // Process each round
      for (let round = 1; round <= 3; round++) {
        let opponent;
        
        if (round === 1) {
          opponent = round1Opponent;
        } else {
          // Rounds 2-3: Random opponents
          opponent = this.selectRandomOpponent(seenMovies, [...usedOpponentIds, newMovie.id]);
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
          const opponentRating = opponent.userRating || 6.2;
          const currentMovieRating = currentRating || 6.2;
          
          const pairwiseResult = this.calculatePairwiseRating({
            aRating: currentRating, // New movie
            bRating: opponentRating, // Opponent movie
            aGames: round - 1, // Games played so far by new movie
            bGames: opponent.gamesPlayed || 0,
            result: ComparisonResults.TIE
          });
          
          currentRating = pairwiseResult.updatedARating;
          const newOpponentRating = pairwiseResult.updatedBRating;
          
          // Update opponent rating in storage
          await this.updateOpponentRating(opponent, newOpponentRating);
          
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
            ratingChange: currentRating - (currentMovieRating || 6.2)
          });
          
          // Continue to next round instead of breaking early
          
        } else {
          // Regular win/loss outcome - use unified pairwise calculation
          const newMovieWon = userChoice === 'new';
          const opponentRating = opponent.userRating || 6.2;
          const previousRating = currentRating;
          
          const pairwiseResult = this.calculatePairwiseRating({
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
            await this.updateOpponentRating(opponent, newOpponentRating);
            
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
          method: 'unified_rating_engine'
        });
      }

      return {
        success: true,
        finalRating: currentRating,
        comparisonHistory
      };

    } catch (error) {
      console.error('Unified Rating Engine Error:', error);
      if (onError) {
        onError(error);
      }
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Validate that a movie has minimum required data for rating
   */
  static validateMovie(movie) {
    if (!movie) return false;
    if (!movie.id) return false;
    if (!movie.title && !movie.name) return false;
    return true;
  }

  /**
   * Get emotion label for display purposes
   */
  static getEmotionLabel(emotion) {
    const labels = {
      LOVED: 'Love',
      LIKED: 'Like', 
      AVERAGE: 'Okay',
      DISLIKED: 'Dislike'
    };
    return labels[emotion] || emotion;
  }

  /**
   * Calculate rating statistics for debugging
   */
  static calculateRatingStats(seenMovies) {
    if (!seenMovies || seenMovies.length === 0) {
      return { count: 0, average: 0, min: 0, max: 0 };
    }

    const ratings = seenMovies
      .map(m => m.userRating)
      .filter(r => r && !isNaN(r));

    if (ratings.length === 0) {
      return { count: 0, average: 0, min: 0, max: 0 };
    }

    return {
      count: ratings.length,
      average: ratings.reduce((a, b) => a + b, 0) / ratings.length,
      min: Math.min(...ratings),
      max: Math.max(...ratings)
    };
  }
}

/**
 * Screen-specific integration helpers
 * Provide easy ways for each screen to use the unified engine
 */
export const HomeScreenIntegration = {
  
  /**
   * Start rating flow for Home screen
   * Integrates with existing Home screen state management
   */
  startRatingFlow(newMovie, emotion, seenMovies, callbacks) {
    return UnifiedRatingEngine.processRatingFlow({
      newMovie,
      emotion,
      seenMovies,
      ...callbacks
    });
  },

  /**
   * Handle Home screen specific movie saving
   */
  async saveRatedMovie(movie, rating, gamesPlayed, seen, setSeen, onAddToSeen) {
    const ratedMovie = {
      ...movie,
      userRating: rating,
      eloRating: Math.round(rating * 100),
      gamesPlayed: gamesPlayed, // Actual number of comparisons performed
      ratingMethod: 'unified_engine',
      dateRated: new Date().toISOString()
    };

    if (onAddToSeen) {
      onAddToSeen(ratedMovie);
    }

    console.log(`✅ Home: Saved ${movie.title} with rating ${rating}`);
  }
};

export const AddMovieIntegration = {
  
  /**
   * Start rating flow for AddMovie screen
   */
  startRatingFlow(newMovie, emotion, seenMovies, callbacks) {
    return UnifiedRatingEngine.processRatingFlow({
      newMovie,
      emotion,
      seenMovies,
      ...callbacks
    });
  },

  /**
   * Handle AddMovie screen specific movie saving
   */
  async saveRatedMovie(movie, rating, gamesPlayed, onAddToSeen) {
    const ratedMovie = {
      ...movie,
      userRating: rating,
      eloRating: Math.round(rating * 100),
      gamesPlayed: gamesPlayed, // Actual number of comparisons performed
      ratingMethod: 'unified_engine',
      source: 'manual_add',
      dateRated: new Date().toISOString()
    };

    if (onAddToSeen) {
      onAddToSeen(ratedMovie);
    }

    console.log(`✅ AddMovie: Saved ${movie.title} with rating ${rating}`);
  }
};

export const WildcardIntegration = {
  
  /**
   * Process single Wildcard comparison
   * Maintains existing Wildcard functionality while using unified logic
   */
  async processComparison(movie1, movie2, movie1Won) {
    const result = adjustRatingWildcard(
      movie1Won ? movie1.userRating : movie2.userRating,
      movie1Won ? movie2.userRating : movie1.userRating,
      true,
      movie1.gamesPlayed || 0,
      movie2.gamesPlayed || 0
    );

    return {
      movie1Rating: movie1Won ? result.updatedSeenContent : result.updatedNewContent,
      movie2Rating: movie1Won ? result.updatedNewContent : result.updatedSeenContent
    };
  }
};

export default UnifiedRatingEngine;