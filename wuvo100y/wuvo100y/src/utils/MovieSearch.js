// Enhanced movie search with fuzzy matching, user history consideration,
// and modular design for interchangeable components

import { useState, useCallback, useRef } from 'react';

// Core search interface - can be extended for different implementations
class MovieSearcher {
  constructor(options = {}) {
    this.options = {
      maxResults: options.maxResults || 10,
      apiKey: options.apiKey || '',
      similarityThreshold: options.similarityThreshold || 0.3,
      // Weight factors for scoring
      weights: {
        titleSimilarity: options.weights?.titleSimilarity || 0.4,
        userPreference: options.weights?.userPreference || 0.3,
        popularity: options.weights?.popularity || 0.3,
      }
    };
    
    // Similarity algorithm - can be swapped out
    this.similarityAlgorithm = options.similarityAlgorithm || this.levenshteinSimilarity;
  }
  
  // Enhanced similarity algorithm with fuzzy matching and stop word removal
  levenshteinSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    
    // SECURITY: Prevent complexity bomb attacks with very long strings
    const MAX_LENGTH = 200; // Reasonable limit for movie titles
    if (str1.length > MAX_LENGTH || str2.length > MAX_LENGTH) {
      console.warn('String too long for similarity calculation, truncating:', str1.length, str2.length);
      str1 = str1.substring(0, MAX_LENGTH);
      str2 = str2.substring(0, MAX_LENGTH);
    }
    
    // Convert to lowercase for case-insensitive comparison
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();
    
    // Early returns for common cases
    if (s1 === s2) return 1; // Exact match
    if (s1.includes(s2) || s2.includes(s1)) return 0.9; // One is substring of the other
    
    // SECURITY: Early exit if strings are too different to prevent complexity bomb
    const lengthDiff = Math.abs(s1.length - s2.length);
    const maxLength = Math.max(s1.length, s2.length);
    if (lengthDiff > maxLength * 0.8) return 0; // Strings too different
    
    // Remove common stop words and normalize
    const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    const cleanWords = (str) => str.split(/\s+/)
      .filter(w => w.length > 1 && !stopWords.includes(w))
      .map(w => {
        // SECURITY: Safe punctuation removal to prevent ReDoS attacks
        // Remove common punctuation characters without complex regex
        return w.replace(/[.,!?;:'"()[\]{}]/g, '').toLowerCase();
      });
    
    const words1 = cleanWords(s1);
    const words2 = cleanWords(s2);
    
    // Handle typo tolerance (knight vs night)
    const isTypoMatch = (w1, w2) => {
      if (w1 === w2) return true;
      if (Math.abs(w1.length - w2.length) > 2) return false;
      
      // Calculate character similarity for potential typos
      const charSimilarity = this._calculateCharSimilarity(w1, w2);
      return charSimilarity > 0.7; // 70% character similarity threshold
    };
    
    // Check for word matches with typo tolerance
    let commonWords = 0;
    for (const w1 of words1) {
      for (const w2 of words2) {
        if (isTypoMatch(w1, w2) || w1.includes(w2) || w2.includes(w1)) {
          commonWords++;
          break;
        }
      }
    }
    
    if (commonWords > 0) {
      const wordMatchScore = commonWords / Math.max(words1.length, words2.length);
      return 0.6 + (0.35 * wordMatchScore); // Higher base score for word matches
    }
    
    // Calculate Levenshtein distance
    const track = Array(s2.length + 1).fill(null).map(() => 
      Array(s1.length + 1).fill(null));
    
    for (let i = 0; i <= s1.length; i++) track[0][i] = i;
    for (let j = 0; j <= s2.length; j++) track[j][0] = j;
    
    for (let j = 1; j <= s2.length; j++) {
      for (let i = 1; i <= s1.length; i++) {
        const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
        track[j][i] = Math.min(
          track[j][i - 1] + 1, // deletion
          track[j - 1][i] + 1, // insertion
          track[j - 1][i - 1] + indicator // substitution
        );
      }
    }
    
    // Convert distance to similarity (0-1 scale)
    const maxLen = Math.max(s1.length, s2.length);
    const distance = track[s2.length][s1.length];
    return 1 - (distance / maxLen);
  }

  // Helper method for character-level similarity
  _calculateCharSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    
    const len1 = str1.length;
    const len2 = str2.length;
    const maxLen = Math.max(len1, len2);
    
    let matches = 0;
    for (let i = 0; i < Math.min(len1, len2); i++) {
      if (str1[i] === str2[i]) matches++;
    }
    
    // Add partial credit for similar character patterns
    const char1Set = new Set(str1);
    const char2Set = new Set(str2);
    const intersection = new Set([...char1Set].filter(c => char2Set.has(c)));
    const union = new Set([...char1Set, ...char2Set]);
    
    const characterOverlap = intersection.size / union.size;
    const positionMatch = matches / maxLen;
    
    return (positionMatch * 0.6) + (characterOverlap * 0.4);
  }
  
  // Calculate user preference score based on user history
  calculateUserPreferenceScore(movie, userHistory) {
    if (!userHistory || userHistory.length === 0) return 0.5; // Neutral score
    
    // Start with base score
    let score = 0.5;
    
    // Check if user has rated similar genres
    const userGenreScores = this._aggregateGenreScores(userHistory);
    const genreBoost = movie.genre_ids?.reduce((sum, genreId) => {
      return sum + (userGenreScores[genreId] || 0);
    }, 0) || 0;
    
    // Normalize genre boost (0-0.3 range)
    const normalizedGenreBoost = Math.min(0.3, genreBoost / 10);
    
    // Check for directors/actors the user likes (simplified)
    const directorBoost = 0; // Placeholder for director preference
    
    // Check release year preference
    const yearPreference = this._calculateYearPreference(movie, userHistory);
    
    // Combine all factors
    score += normalizedGenreBoost + directorBoost + yearPreference;
    
    // Clamp the score to 0-1 range
    return Math.max(0, Math.min(1, score));
  }
  
  // Helper for aggregating genre scores from user history
  _aggregateGenreScores(userHistory) {
    const genreScores = {};
    
    userHistory.forEach(historyItem => {
      const userRating = historyItem.userRating || historyItem.eloRating / 100;
      // Convert rating to -1 to +1 scale (5 is neutral)
      const ratingFactor = (userRating - 5) / 5;
      
      historyItem.genre_ids?.forEach(genreId => {
        if (!genreScores[genreId]) genreScores[genreId] = 0;
        genreScores[genreId] += ratingFactor;
      });
    });
    
    return genreScores;
  }
  
  // Helper for calculating year preference
  _calculateYearPreference(movie, userHistory) {
    if (!movie.release_date || userHistory.length === 0) return 0;
    
    const movieYear = new Date(movie.release_date).getFullYear();
    if (isNaN(movieYear)) return 0;
    
    // Calculate weighted average of years from user's highly rated movies
    let totalWeight = 0;
    let weightedYearSum = 0;
    
    userHistory.forEach(historyItem => {
      if (!historyItem.release_date) return;
      
      const historyYear = new Date(historyItem.release_date).getFullYear();
      if (isNaN(historyYear)) return;
      
      const rating = historyItem.userRating || historyItem.eloRating / 100;
      if (rating >= 7) { // Only consider highly rated movies
        const weight = (rating - 7) * 3; // Weight by how much they liked it
        totalWeight += weight;
        weightedYearSum += historyYear * weight;
      }
    });
    
    if (totalWeight === 0) return 0;
    
    const preferredYear = weightedYearSum / totalWeight;
    const yearDiff = Math.abs(movieYear - preferredYear);
    
    // Convert to a score (closer to preferred year = higher score)
    // Maximum of 0.1 boost/penalty based on year
    return 0.1 - (Math.min(yearDiff, 30) / 300);
  }
  
  // Search implementation - can be replaced with other APIs
  async searchMovies(query, userHistory = [], mediaType = 'movie') {
    if (!query || query.length < 2) return [];
    
    try {
      // Fetch initial results from TMDb (or could be replaced with other sources)
      const results = await this._fetchFromTMDb(query, mediaType);
      
      if (!results || results.length === 0) return [];
      
      // Enrich and score results
      const scoredResults = this._scoreResults(results, query, userHistory);
      
      // Return top N results based on maxResults setting
      return scoredResults.slice(0, this.options.maxResults);
    } catch (error) {
      console.error('Error searching movies:', error);
      return [];
    }
  }
  
  // TMDb API integration - can be replaced with other data sources
  async _fetchFromTMDb(query, mediaType = 'movie') {
    const apiKey = this.options.apiKey;
    if (!apiKey) {
      console.error('No API key provided for TMDb');
      return [];
    }
    
    // Use dedicated endpoint for requested media type - CLEAR AND OBVIOUS
    const encodedQuery = encodeURIComponent(query);
    const endpoint = mediaType === 'tv' ? 'search/tv' : 'search/movie';
    const response = await fetch(
      `https://api.themoviedb.org/3/${endpoint}?api_key=${this.options.apiKey}&language=en-US&query=${encodedQuery}&page=1&include_adult=false`
    );
    
    if (!response.ok) {
      throw new Error(`Failed to search for ${mediaType === 'tv' ? 'TV shows' : 'movies'}`);
    }
    
    const data = await response.json();
    let results = data.results || [];
    
    // Normalize the response for consistency (TV shows have 'name' instead of 'title')
    // Add explicit media_type since we know exactly what type we requested
    results = results.map(item => ({
      ...item,
      title: item.title || item.name,
      release_date: item.release_date || item.first_air_date,
      media_type: mediaType  // EXPLICIT - we know exactly what we requested
    }));
    
    // If we have few results, try a more permissive search
    if (results.length < 3 && query.includes(' ')) {
      // Try with the first significant word
      const firstWord = query.split(' ')[0];
      if (firstWord.length > 2) {
        const backupResponse = await fetch(
          `https://api.themoviedb.org/3/${endpoint}?api_key=${this.options.apiKey}&language=en-US&query=${encodeURIComponent(
            firstWord
          )}&page=1&include_adult=false`
        );
        
        if (backupResponse.ok) {
          const backupData = await backupResponse.json();
          
          if (backupData.results && Array.isArray(backupData.results)) {
            // Normalize backup results - we know the media type from endpoint
            const backupFiltered = backupData.results.map(item => ({
              ...item,
              title: item.title || item.name,
              release_date: item.release_date || item.first_air_date,
              media_type: mediaType  // EXPLICIT - we know what endpoint we used
            }));
            
            // Only add new results that don't duplicate what we already have
            const existingIds = new Set(results.map(m => m.id));
            
            backupFiltered.forEach(item => {
              if (!existingIds.has(item.id)) {
                results.push(item);
              }
            });
          }
        }
      }
    }
    
    return results;
  }
  
  // Score and rank the results based on multiple factors
  _scoreResults(results, query, userHistory) {
    const { weights, similarityThreshold } = this.options;
    
    // Process each result
    const scoredResults = results.map(movie => {
      // Calculate title similarity score
      const titleSimilarity = this.similarityAlgorithm(movie.title, query);
      
      // Skip results with very low similarity unless it's a very short query
      if (titleSimilarity < similarityThreshold && query.length > 3) {
        return null;
      }
      
      // Calculate user preference score
      const userPreferenceScore = this.calculateUserPreferenceScore(movie, userHistory);
      
      // Calculate popularity score (normalized from TMDb data)
      const voteCount = movie.vote_count || 0;
      const voteAverage = movie.vote_average || 5;
      
      // Normalize vote count (log scale to handle very popular movies)
      const normalizedVoteCount = voteCount > 0 ? Math.min(1, Math.log10(voteCount) / 4) : 0;
      
      // Normalize vote average (1-10 scale to 0-1)
      const normalizedVoteAverage = (voteAverage - 1) / 9;
      
      // Combined popularity score
      const popularityScore = (normalizedVoteCount * 0.7) + (normalizedVoteAverage * 0.3);
      
      // Calculate final score using weights
      const finalScore = 
        (titleSimilarity * weights.titleSimilarity) +
        (userPreferenceScore * weights.userPreference) +
        (popularityScore * weights.popularity);
      
      // Special case for extremely short queries like "the"
      const isGenericQuery = query.length <= 3;
      
      // Return enhanced result with scores
      return {
        ...movie,
        titleSimilarity,
        userPreferenceScore,
        popularityScore,
        finalScore: isGenericQuery ? (popularityScore * 0.8) + (titleSimilarity * 0.2) : finalScore
      };
    })
    .filter(Boolean) // Remove null results
    .sort((a, b) => b.finalScore - a.finalScore); // Sort by final score
    
    return scoredResults;
  }
  
  // Process results into a UI-friendly format
  formatResults(results) {
    return results.map(movie => ({
      id: movie.id,
      title: movie.title,
      year: movie.release_date ? new Date(movie.release_date).getFullYear() : null,
      poster: movie.poster_path ? `https://image.tmdb.org/t/p/w92${movie.poster_path}` : null,
      poster_path: movie.poster_path, // CRITICAL FIX: Preserve original poster_path for UI components
      vote_count: movie.vote_count, // CRITICAL FIX: Keep original field name for UI compatibility
      vote_average: movie.vote_average, // CRITICAL FIX: Keep original field name for UI compatibility
      genre_ids: movie.genre_ids, // CRITICAL FIX: Keep original field name for UI compatibility
      overview: movie.overview, // CRITICAL FIX: Keep original field name for UI compatibility
      release_date: movie.release_date, // CRITICAL FIX: Keep original field name for UI compatibility
      media_type: movie.media_type, // CRITICAL FIX: Keep media type for proper categorization
      similarity: movie.titleSimilarity,
      relevance: movie.finalScore
    }));
  }
}

// Example usage
// const movieSearcher = new MovieSearcher({
//   apiKey: 'your_tmdb_api_key',
//   maxResults: 10,
//   weights: {
//     titleSimilarity: 0.4, 
//     userPreference: 0.3,
//     popularity: 0.3
//   }
// });
// 
// // For React component integration
// async function handleSearch(query, userHistory) {
//   if (!query || query.length < 2) return [];
//   
//   const results = await movieSearcher.searchMovies(query, userHistory);
//   return movieSearcher.formatResults(results);
// }

// Integration with React component (AddMovieScreen example)
const useMovieSearch = (apiKey, options = {}) => {
  const [results, setResults] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const searcherRef = useRef(null);
  
  // Initialize the searcher if needed
  if (!searcherRef.current) {
    searcherRef.current = new MovieSearcher({
      apiKey,
      ...options
    });
  }
  
  // Function to update suggestions as user types
  const updateSuggestions = useCallback(async (query, userHistory) => {
    if (!query || query.length < 2) {
      setSuggestions([]);
      return;
    }
    
    try {
      const results = await searcherRef.current.searchMovies(query, userHistory);
      const formattedResults = searcherRef.current.formatResults(results);
      setSuggestions(formattedResults);
    } catch (err) {
      console.error('Error getting suggestions:', err);
      setSuggestions([]);
    }
  }, []);
  
  // Main search function
  const searchMovies = useCallback(async (query, userHistory) => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const results = await searcherRef.current.searchMovies(query, userHistory);
      const formattedResults = searcherRef.current.formatResults(results);
      setResults(formattedResults);
    } catch (err) {
      console.error('Error searching movies:', err);
      setError('Failed to search for movies. Please try again.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);
  
  return {
    results,
    suggestions,
    loading,
    error,
    updateSuggestions,
    searchMovies
  };
};

export { MovieSearcher, useMovieSearch };