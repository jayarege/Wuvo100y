/**
 * UnifiedSearchService - Combines movie/TV and user search capabilities
 * 
 * CODE_BIBLE Commandment #2: Write code that's clear and obvious
 * - Single search interface for both content and users
 * - Clear separation of search types with consistent scoring
 * - Intelligent intent detection without explicit toggles
 */

import { MovieSearcher } from '../utils/MovieSearch';
import UserSearchService from './UserSearchService';

class UnifiedSearchService {
  constructor(options = {}) {
    this.movieSearcher = new MovieSearcher({
      apiKey: options.apiKey || '',
      maxResults: options.maxMovieResults || 15,
      ...options.movieOptions
    });
    
    this.userSearchService = new UserSearchService();
    this.options = {
      maxUserResults: options.maxUserResults || 10,
      maxTotalResults: options.maxTotalResults || 20,
      userSearchMinLength: options.userSearchMinLength || 2,
      movieSearchMinLength: options.movieSearchMinLength || 2,
      ...options
    };
  }

  /**
   * Unified search that returns both content and users
   * CODE_BIBLE Commandment #1: Never assume - validate all inputs
   */
  async search(query, context = {}) {
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return { movies: [], users: [], totalResults: 0 };
    }

    const cleanQuery = query.trim();
    console.log(`🔍 Unified search for: "${cleanQuery}"`);

    try {
      // Run both searches in parallel for better performance
      const [movieResults, userResults] = await Promise.all([
        this.searchMovies(cleanQuery, context),
        this.searchUsers(cleanQuery, context)
      ]);

      const totalResults = movieResults.length + userResults.length;
      
      console.log(`✅ Unified search results: ${movieResults.length} movies/TV, ${userResults.length} users`);
      
      return {
        movies: movieResults,
        users: userResults,
        totalResults,
        query: cleanQuery
      };

    } catch (error) {
      console.error('❌ Error in unified search:', error);
      return { movies: [], users: [], totalResults: 0, error: error.message };
    }
  }

  /**
   * Search movies and TV shows
   * CODE_BIBLE Commandment #3: Handle errors explicitly
   */
  async searchMovies(query, context = {}) {
    try {
      if (query.length < this.options.movieSearchMinLength) {
        return [];
      }

      // Use the enhanced MovieSearcher with fuzzy matching
      const results = await this.movieSearcher.searchMovies(query, context.userHistory || []);
      const formatted = this.movieSearcher.formatResults(results);
      
      // Add search result type for UI rendering
      return formatted.map(movie => ({
        ...movie,
        searchType: 'movie',
        mediaType: movie.media_type || 'movie' // Ensure media type is set
      })).slice(0, this.options.maxMovieResults);

    } catch (error) {
      console.error('❌ Error searching movies:', error);
      return [];
    }
  }

  /**
   * Search users with intent detection
   * CODE_BIBLE Commandment #4: Be BRUTALLY HONEST - detect user search intent
   */
  async searchUsers(query, context = {}) {
    try {
      if (query.length < this.options.userSearchMinLength) {
        return [];
      }

      // Enhanced user search intent detection
      const hasUserIntent = this.detectUserSearchIntent(query);
      
      if (!hasUserIntent) {
        console.log(`⚪ No user search intent detected for: "${query}"`);
        return [];
      }

      console.log(`👤 User search intent detected for: "${query}"`);
      
      const results = await this.userSearchService.searchUsers(query, this.options.maxUserResults);
      
      // Add search result type and formatting for UI rendering
      return results.map(user => ({
        ...user,
        searchType: 'user',
        displayName: user.displayName || user.username || 'Unknown User',
        formattedUsername: this.userSearchService.formatUsername(user.username),
        // Add movie-like properties for unified rendering
        title: user.displayName || user.username,
        subtitle: `@${user.username}`,
        poster_path: user.profilePictureUrl || null,
        overview: user.bio || `${user.followerCount || 0} followers`,
        searchScore: this.calculateUserRelevanceScore(user, query)
      }));

    } catch (error) {
      console.error('❌ Error searching users:', error);
      return [];
    }
  }

  /**
   * Intelligent user search intent detection
   * CODE_BIBLE Commandment #6: Document WHY each decision matters
   */
  detectUserSearchIntent(query) {
    const lowerQuery = query.toLowerCase();
    
    // Strong user search indicators
    if (lowerQuery.startsWith('@')) return true; // @username format
    if (lowerQuery.includes('user')) return true; // "user john"
    if (lowerQuery.includes('profile')) return true; // "profile sarah"
    if (lowerQuery.includes('friend')) return true; // "friend alex"
    
    // Weak indicators (require additional checks)
    const commonNames = [
      'john', 'jane', 'mike', 'sarah', 'alex', 'chris', 'taylor', 'jordan',
      'sam', 'jamie', 'casey', 'morgan', 'riley', 'drew', 'avery', 'quinn'
    ];
    
    const isCommonName = commonNames.some(name => lowerQuery.includes(name));
    
    // Movie title patterns that should NOT trigger user search
    const moviePatterns = [
      'the ', 'a ', 'an ', // Articles
      'movie', 'film', 'show', 'series', // Media keywords
      'part', 'vol', 'season', 'episode', // Sequence keywords
      ':', '-', '(', ')', '[', ']', // Title formatting
      'of', 'in', 'for', 'with', 'and', 'or' // Common title words
    ];
    
    const hasMoviePatterns = moviePatterns.some(pattern => lowerQuery.includes(pattern));
    
    // If query has movie patterns, suppress user search even for common names
    if (hasMoviePatterns && isCommonName) {
      return false;
    }
    
    // Single word common names trigger user search
    if (isCommonName && lowerQuery.split(' ').length === 1) {
      return true;
    }
    
    // Short, simple queries without movie indicators might be usernames
    if (lowerQuery.length >= 3 && lowerQuery.length <= 15 && 
        !hasMoviePatterns && /^[a-zA-Z0-9_-]+$/.test(lowerQuery)) {
      return true;
    }
    
    return false;
  }

  /**
   * Calculate relevance score for user search results
   * CODE_BIBLE Commandment #3: Handle errors explicitly with fallbacks
   */
  calculateUserRelevanceScore(user, query) {
    const lowerQuery = query.toLowerCase().replace('@', '');
    let score = 0;
    
    // Exact username match gets highest priority
    if (user.username === lowerQuery) {
      score += 1000;
    } else if (user.username?.startsWith(lowerQuery)) {
      score += 500;
    } else if (user.username?.includes(lowerQuery)) {
      score += 200;
    }
    
    // Display name matching
    const displayName = (user.displayName || '').toLowerCase();
    if (displayName === lowerQuery) {
      score += 800;
    } else if (displayName.startsWith(lowerQuery)) {
      score += 400;
    } else if (displayName.includes(lowerQuery)) {
      score += 150;
    }
    
    // Follower count boost (popularity signal)
    const followerBoost = Math.log10((user.followerCount || 0) + 1) * 10;
    score += followerBoost;
    
    // Recency boost if available
    if (user.lastActive) {
      const daysSinceActive = (Date.now() - new Date(user.lastActive).getTime()) / (1000 * 60 * 60 * 24);
      const recencyBoost = Math.max(0, 30 - daysSinceActive) * 2; // Max 60 point boost for recent activity
      score += recencyBoost;
    }
    
    return score;
  }

  /**
   * Get search suggestions for both content and users
   * CODE_BIBLE Commandment #5: Treat user data as sacred - respect privacy preferences
   */
  async getSearchSuggestions(context = {}) {
    try {
      const suggestions = {
        recentSearches: context.recentSearches || [],
        trendingMovies: [],
        suggestedUsers: []
      };

      // Only get user suggestions if user is authenticated
      if (context.currentUserId) {
        suggestions.suggestedUsers = await this.userSearchService.getSearchSuggestions(
          context.currentUserId, 
          3 // Limit to 3 users to keep suggestions manageable
        );
      }

      return suggestions;

    } catch (error) {
      console.error('❌ Error getting search suggestions:', error);
      return { recentSearches: [], trendingMovies: [], suggestedUsers: [] };
    }
  }

  /**
   * Format unified results for UI rendering
   * CODE_BIBLE Commandment #7: Clear visual separation between result types
   */
  formatUnifiedResults(searchResults) {
    const { movies, users, totalResults } = searchResults;
    
    // Combine and sort all results by relevance score
    const combinedResults = [
      ...movies.map(m => ({ ...m, relevanceScore: m.relevance || m.searchScore || 0 })),
      ...users.map(u => ({ ...u, relevanceScore: u.searchScore || 0 }))
    ].sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Group results by type for sectioned rendering
    const groupedResults = {
      all: combinedResults,
      movies: movies,
      users: users,
      sections: []
    };

    // Create sections for UI rendering
    if (movies.length > 0) {
      groupedResults.sections.push({
        title: 'Movies & TV Shows',
        data: movies,
        type: 'movie'
      });
    }

    if (users.length > 0) {
      groupedResults.sections.push({
        title: 'Users',
        data: users,
        type: 'user'
      });
    }

    return groupedResults;
  }
}

export default UnifiedSearchService;