// Opponent selection utilities for consistent movie comparisons across rating flows

// Baseline content IDs extracted from Wildcard - high quality movies for consistent comparisons
const BASELINE_MOVIE_IDS = [
  680, 155, 13, 16869, 550, 27205, 278, 19404, 389, 129, 14, 165, 238, 240, 424, 
  539, 533, 510, 122, 11, 599, 49026, 73, 18, 103, 1891, 77, 807, 598, 1124, 
  744, 857, 15, 1892, 497, 330, 11324, 105, 914, 10515, 597, 862, 10193, 161, 
  592, 607, 311, 562, 274, 620, 24, 324, 1895, 769, 6479, 1893, 500, 9806, 
  1422, 568, 10376, 4584, 2062, 9880, 10494, 2105, 1359, 49047, 7345, 590, 
  1366, 557, 4995, 975, 1359, 329, 10020, 672, 7326, 118, 348, 641, 1771, 16360, 
  2269, 7326, 120, 423, 109, 1858, 1396, 310, 1858, 49051, 339, 857, 767, 
  1370, 1374, 242, 1366, 630, 496243, 10195, 1573, 1422, 1366, 2080, 13223
];

const BASELINE_TV_IDS = [
  1399, 60625, 1396, 46648, 82856, 1668, 1412, 4614, 60059, 1622, 73640, 76479, 
  63926, 85552, 60574, 1409, 46261, 1434, 2316, 1390, 95557, 83867, 1398, 60735, 
  1416, 1419, 60625, 1415, 46261, 46648, 60735, 1390, 1411, 73586, 82364, 1399, 
  70523, 69050, 1434, 1416, 1433, 1402, 1418, 4057, 60625, 1399, 1408, 1399, 
  1418, 1434, 1390, 1622, 60625, 1622, 1419, 1433, 1412, 82364, 1402, 1434, 
  1433, 1434, 1418, 1419, 1402, 1434, 1418, 1622, 1390, 1412, 1390, 1622, 
  1396, 1622, 1416, 1412, 1622, 1434, 1418, 1390, 1416, 1419, 1622, 1433, 
  1399, 1408, 1622, 1418, 1433, 1434, 1412, 1390, 1419, 1418, 1433, 1622, 
  1434, 1418, 1390, 1434, 1418, 1433, 1390, 1418, 1434, 1622
];

/**
 * Core opponent selection functions extracted from Wildcard screen
 * These ensure consistent opponent quality across all rating flows
 */

/**
 * Selects a random opponent from the user's seen movies
 * @param {Array} seenMovies - User's rated movies
 * @param {Array} excludeIds - Movie IDs to exclude from selection
 * @returns {Object|null} Selected movie or null if none available
 */
export const selectRandomSeenOpponent = (seenMovies, excludeIds = []) => {
  const availableMovies = seenMovies.filter(movie => 
    !excludeIds.includes(movie.id) && movie.userRating
  );
  
  if (availableMovies.length === 0) return null;
  
  return availableMovies[Math.floor(Math.random() * availableMovies.length)];
};

/**
 * Selects an opponent within a specific rating range (for ladder-style progression)
 * @param {Array} seenMovies - User's rated movies  
 * @param {number} targetRating - Target rating to find opponents near
 * @param {Array} excludeIds - Movie IDs to exclude
 * @param {number} tolerance - Rating tolerance (default 1.0)
 * @returns {Object|null} Selected movie or null if none available
 */
export const selectProximityOpponent = (seenMovies, targetRating, excludeIds = [], tolerance = 1.0) => {
  const availableMovies = seenMovies.filter(movie => 
    !excludeIds.includes(movie.id) && 
    movie.userRating &&
    Math.abs(movie.userRating - targetRating) <= tolerance
  );
  
  if (availableMovies.length === 0) {
    // Expand tolerance if no close matches
    return selectProximityOpponent(seenMovies, targetRating, excludeIds, tolerance + 0.5);
  }
  
  // Sort by proximity to target rating
  availableMovies.sort((a, b) => 
    Math.abs(a.userRating - targetRating) - Math.abs(b.userRating - targetRating)
  );
  
  // Return one of the closest matches (add some randomness)
  const closeMatches = availableMovies.slice(0, Math.min(3, availableMovies.length));
  return closeMatches[Math.floor(Math.random() * closeMatches.length)];
};

/**
 * Selects an opponent from a specific percentile range
 * @param {Array} seenMovies - User's rated movies
 * @param {Array} percentileRange - [min, max] percentile (e.g., [0.75, 1.0] for top 25%)
 * @param {Array} excludeIds - Movie IDs to exclude
 * @returns {Object|null} Selected movie or null if none available
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

/**
 * Gets baseline content ID for high-quality comparisons
 * @param {string} mediaType - 'movie' or 'tv'
 * @param {Array} excludeIds - IDs to exclude (already compared/seen)
 * @returns {number|null} Baseline content ID or null if none available
 */
export const getNextBaselineContentId = (mediaType, excludeIds = []) => {
  const baselineIds = mediaType === 'movie' ? BASELINE_MOVIE_IDS : BASELINE_TV_IDS;
  const remainingIds = baselineIds.filter(id => !excludeIds.includes(id));
  
  if (remainingIds.length === 0) return null;
  
  return remainingIds[Math.floor(Math.random() * remainingIds.length)];
};

// Note: getBaselineOpponent removed as Initial Rating Flow only compares against user's seen movies

/**
 * Main opponent selection function that mimics Wildcard's logic
 * @param {Array} seenMovies - User's rated movies
 * @param {Object} options - Selection options
 * @returns {Object|null} Selected opponent or null
 */
export const selectOpponent = (seenMovies, options = {}) => {
  const {
    targetRating = null,
    percentileRange = null,
    excludeIds = [],
    preferProximity = false
  } = options;
  
  // If targeting specific rating, use proximity selection
  if (targetRating !== null && preferProximity) {
    return selectProximityOpponent(seenMovies, targetRating, excludeIds);
  }
  
  // If percentile range specified, use percentile selection
  if (percentileRange) {
    return selectPercentileOpponent(seenMovies, percentileRange, excludeIds);
  }
  
  // Default: random selection from seen movies
  return selectRandomSeenOpponent(seenMovies, excludeIds);
};

// ✅ CONSOLIDATED: ELO calculations now imported from centralized utility
// Removed duplicate implementations - use ELOCalculations.js instead