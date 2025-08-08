/**
 * Movie utility functions for consistent movie counting across all screens
 * 
 * CODE_BIBLE Commandment #3: Write obvious code
 * - Function names clearly indicate their purpose
 * - Parameters are self-documenting
 * - Return values are predictable and consistent
 */

export const movieUtils = {
  /**
   * Get standardized movie count with optional filtering
   * @param {Array} movies - Array of movie objects
   * @param {string} mediaType - 'movie', 'tv', or 'all' (default: 'all')
   * @param {Object} filters - Optional filters: {rated: boolean, unrated: boolean}
   * @returns {number} Count of movies matching criteria
   */
  getMovieCount(movies, mediaType = 'all', filters = {}) {
    // CODE_BIBLE Commandment #9: Handle errors explicitly
    if (!movies || !Array.isArray(movies)) {
      console.warn('movieUtils.getMovieCount: Invalid movies array provided');
      return 0;
    }
    
    let filteredMovies = movies;
    
    // Media type filtering - obvious logic
    if (mediaType !== 'all') {
      filteredMovies = movies.filter(movie => {
        const movieType = movie.mediaType || 'movie'; // Default to 'movie' if not specified
        return movieType === mediaType;
      });
    }
    
    // Rating status filtering - explicit and clear
    if (filters.rated === true) {
      filteredMovies = filteredMovies.filter(movie => 
        movie.userRating && typeof movie.userRating === 'number'
      );
    }
    
    if (filters.unrated === true) {
      filteredMovies = filteredMovies.filter(movie => 
        !movie.userRating || typeof movie.userRating !== 'number'
      );
    }
    
    // CODE_BIBLE Commandment #5: Preserve context
    // Log for debugging but don't break existing functionality
    if (process.env.NODE_ENV === 'development') {
      console.debug(`movieUtils.getMovieCount: ${filteredMovies.length} movies found`, {
        total: movies.length,
        mediaType,
        filters
      });
    }
    
    return filteredMovies.length;
  },

  /**
   * Check if user has enough rated movies for a feature
   * @param {Array} movies - Array of movie objects
   * @param {string} mediaType - Media type to check
   * @param {number} required - Minimum required count (default: 3)
   * @returns {boolean} True if user has enough rated movies
   */
  hasEnoughRatedMovies(movies, mediaType = 'all', required = 3) {
    const ratedCount = this.getMovieCount(movies, mediaType, { rated: true });
    return ratedCount >= required;
  },

  /**
   * Get breakdown of movie counts by type and rating status
   * @param {Array} movies - Array of movie objects
   * @returns {Object} Breakdown object with counts
   */
  getMovieBreakdown(movies) {
    if (!movies || !Array.isArray(movies)) {
      return {
        total: 0,
        movies: 0,
        tvShows: 0,
        rated: 0,
        unrated: 0
      };
    }

    return {
      total: movies.length,
      movies: this.getMovieCount(movies, 'movie'),
      tvShows: this.getMovieCount(movies, 'tv'),
      rated: this.getMovieCount(movies, 'all', { rated: true }),
      unrated: this.getMovieCount(movies, 'all', { unrated: true })
    };
  }
};