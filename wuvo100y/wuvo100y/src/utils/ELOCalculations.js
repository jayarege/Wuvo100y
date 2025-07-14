/**
 * ELO Rating System Calculations
 * Extracted from duplicated code across components
 * Used for movie rating comparisons and adjustments
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