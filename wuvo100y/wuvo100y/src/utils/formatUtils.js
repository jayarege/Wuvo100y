export const formatUtils = {
  formatRating(rating) {
    if (typeof rating !== 'number') return '0.0';
    return rating.toFixed(1);
  },

  formatPercentage(value) {
    if (typeof value !== 'number') return '0%';
    return `${Math.round(value)}%`;
  },

  formatTitle(title) {
    if (!title) return 'Unknown Title';
    return title.length > 50 ? `${title.substring(0, 47)}...` : title;
  },

  formatOverview(overview, maxLength = 150) {
    if (!overview) return 'No description available.';
    return overview.length > maxLength 
      ? `${overview.substring(0, maxLength)}...` 
      : overview;
  },

  formatGenres(genreIds, genreMap) {
    if (!genreIds || !Array.isArray(genreIds) || !genreMap) return '';
    return genreIds
      .map(id => genreMap[id])
      .filter(Boolean)
      .join(', ');
  },

  formatDuration(minutes) {
    if (typeof minutes !== 'number' || minutes <= 0) return '';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  },

  formatVoteCount(voteCount) {
    if (typeof voteCount !== 'number') return '0';
    if (voteCount >= 1000000) {
      return `${(voteCount / 1000000).toFixed(1)}M`;
    }
    if (voteCount >= 1000) {
      return `${(voteCount / 1000).toFixed(1)}K`;
    }
    return voteCount.toString();
  },

  formatImageUrl(path, size = 'w500') {
    if (!path || typeof path !== 'string') return null;
    
    // SECURITY: Validate image path and size to prevent attacks
    const cleanPath = path.trim();
    const cleanSize = size.trim();
    
    // Validate path format
    if (cleanPath.includes('..') || cleanPath.includes('<') || cleanPath.includes('>') || 
        cleanPath.includes('script') || cleanPath.includes('javascript:') ||
        cleanPath.length > 100 || !cleanPath.startsWith('/')) {
      console.warn('🚨 SECURITY: Suspicious image path blocked:', cleanPath);
      return null;
    }
    
    // Validate size parameter
    const allowedSizes = ['w92', 'w154', 'w185', 'w342', 'w500', 'w780', 'original'];
    if (!allowedSizes.includes(cleanSize)) {
      console.warn('🚨 SECURITY: Invalid image size blocked:', cleanSize);
      return null;
    }
    
    return `https://image.tmdb.org/t/p/${cleanSize}${cleanPath}`;
  },

  // Standardized error handling functions
  showStandardError(message = 'Something went wrong', actionHint = 'Please try again') {
    const { Alert } = require('react-native');
    Alert.alert('Error', `${message}. ${actionHint}.`);
  },

  showNetworkError() {
    const { Alert } = require('react-native');
    Alert.alert('Network Error', 'Unable to connect. Please check your internet connection and try again.');
  },

  showAuthError() {
    const { Alert } = require('react-native');
    Alert.alert('Authentication Error', 'Please log in again to continue.');
  },

  logAndShowError(error, userMessage = 'An error occurred', actionHint = 'Please try again') {
    console.error('❌ Error:', error);
    this.showStandardError(userMessage, actionHint);
  },

  // Standardized minimum rating error for consistent user experience
  getMinimumRatingError(currentCount, mediaType = 'movie', required = 3) {
    const contentType = mediaType === 'movie' ? 'movies' : 'TV shows';
    return {
      title: '🎬 Need More Ratings',
      message: `You need at least ${required} rated ${contentType} to use this feature.\n\nCurrently you have: ${currentCount} rated ${contentType}.\n\nPlease rate a few more ${contentType} first!`,
      buttons: [{ text: "OK", style: "default" }]
    };
  }
};