// =============================================================================
// AI RECOMMENDATIONS - DISCOVERY SESSION ENHANCED
// =============================================================================
// CODE_BIBLE Commandment #3: "Write code that's clear and obvious"
// CODE_BIBLE Commandment #9: "Handle errors explicitly"
// Incorporates discovery session logic without hardcoded titles

import { TMDB_API_KEY } from '../Constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

class AIRecommendations {
  constructor() {
    this.cache = new Map();
    this.baseURL = 'https://api.themoviedb.org/3';
    this.qualityThreshold = 7.0;
    this.minVoteCount = 500;
    
    // Discovery session types from DiscoverySessionEngine
    this.sessionTypes = {
      morning: {
        name: "Morning Motivation",
        description: "Start your day with inspiring stories",
        moodTags: ["uplifting", "motivational", "energizing"],
        preferredGenres: ["Biography", "Drama", "Adventure"]
      },
      afternoon: {
        name: "Midday Escape", 
        description: "Perfect for a mental break",
        moodTags: ["engaging", "moderate-paced", "escapist"],
        preferredGenres: ["Comedy", "Action", "Romance"]
      },
      evening: {
        name: "Evening Unwind",
        description: "Relax and decompress from your day", 
        moodTags: ["atmospheric", "thoughtful", "immersive"],
        preferredGenres: ["Thriller", "Drama", "Mystery"]
      },
      weekend: {
        name: "Weekend Adventure",
        description: "Epic films for your free time",
        moodTags: ["epic", "cinematic", "binge-worthy"],
        preferredGenres: ["Action", "Sci-Fi", "Fantasy"]
      }
    };
    
    // Genre mapping for session types
    this.genreMap = {
      'Action': 28, 'Adventure': 12, 'Animation': 16, 'Biography': 10751,
      'Comedy': 35, 'Crime': 80, 'Documentary': 99, 'Drama': 18,
      'Family': 10751, 'Fantasy': 14, 'History': 36, 'Horror': 27,
      'Music': 10402, 'Mystery': 9648, 'Romance': 10749, 'Sci-Fi': 878,
      'Thriller': 53, 'War': 10752, 'Western': 37
    };
  }

  // =============================================================================
  // MAIN RECOMMENDATION FUNCTION - DISCOVERY SESSION ENHANCED
  // =============================================================================

  async getImprovedRecommendations(userMovies, mediaType = 'movie', options = {}) {
    try {
      console.log(`🎯 Getting AI recommendations for ${userMovies.length} user movies`);
      
      const {
        count = 10,
        seen = [],
        unseen = [],
        skippedMovies = [],
        sessionType = this.getCurrentSessionType()
      } = options;

      // CODE_BIBLE Commandment #2: "Never assume" - validate inputs
      if (!userMovies || userMovies.length === 0) {
        return this.createEmergencyRecommendations(mediaType, count, sessionType);
      }

      // Enhanced user profiling with discovery session logic
      const userProfile = this.analyzeUserTasteProfile(userMovies);
      
      // Multi-layered fallback system from discovery engine
      const recommendations = await this.createRecommendationsWithFallbacks(
        userProfile, 
        mediaType, 
        sessionType,
        count * 3, // Get extra to filter
        { seen, skippedMovies }
      );

      // Enhanced filtering and scoring with session context
      const filtered = this.filterAndScoreWithSession(recommendations, userProfile, sessionType, { seen, skippedMovies });
      
      return filtered.slice(0, count);

    } catch (error) {
      console.error('❌ AI recommendations failed:', error);
      return this.createEmergencyRecommendations(mediaType, options.count || 10, options.sessionType);
    }
  }

  // =============================================================================
  // ENHANCED USER TASTE ANALYSIS - DISCOVERY SESSION STYLE
  // =============================================================================

  analyzeUserTasteProfile(userMovies) {
    // CODE_BIBLE Commandment #2: "Never assume" - validate data like discovery engine
    const ratedMovies = userMovies.filter(movie => movie.userRating && movie.userRating > 0);
    
    if (!Array.isArray(ratedMovies) || ratedMovies.length === 0) {
      return this.getDefaultUserProfile();
    }

    // Enhanced genre preference analysis
    const genreCount = {};
    const genreRatingSum = {};
    const genreQualitySum = {};
    
    ratedMovies.forEach(movie => {
      if (movie.genre_ids) {
        movie.genre_ids.forEach(genreId => {
          genreCount[genreId] = (genreCount[genreId] || 0) + 1;
          genreRatingSum[genreId] = (genreRatingSum[genreId] || 0) + movie.userRating;
          // Factor in TMDB quality too
          if (movie.vote_average) {
            genreQualitySum[genreId] = (genreQualitySum[genreId] || 0) + movie.vote_average;
          }
        });
      }
    });

    // Calculate top genres with quality weighting
    const topGenres = Object.keys(genreCount)
      .map(genreId => {
        const count = genreCount[genreId];
        const userAvg = genreRatingSum[genreId] / count;
        const qualityAvg = genreQualitySum[genreId] ? genreQualitySum[genreId] / count : 7.0;
        return {
          id: parseInt(genreId),
          count,
          userAvg,
          qualityAvg,
          // Discovery session style scoring
          score: count * userAvg * (qualityAvg / 10)
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(g => g.id);

    // Get top rated movies for similarity matching
    const topRatedMovies = ratedMovies
      .sort((a, b) => b.userRating - a.userRating)
      .slice(0, 5);

    // Enhanced profiling like discovery engine
    return {
      topGenres,
      topRatedMovies,
      averageRating: ratedMovies.reduce((sum, m) => sum + m.userRating, 0) / ratedMovies.length,
      ratingsCount: ratedMovies.length,
      preferredDecades: this.analyzeDecadePreferences(ratedMovies),
      tasteTags: this.generateTasteTags(ratedMovies),
      qualityAlignment: this.analyzeQualityAlignment(ratedMovies)
    };
  }

  analyzeDecadePreferences(movies) {
    const decadeCounts = {};
    
    movies.forEach(movie => {
      if (movie.release_date) {
        const year = parseInt(movie.release_date.substring(0, 4));
        const decade = Math.floor(year / 10) * 10;
        decadeCounts[decade] = (decadeCounts[decade] || 0) + movie.userRating;
      }
    });

    return Object.keys(decadeCounts)
      .sort((a, b) => decadeCounts[b] - decadeCounts[a])
      .slice(0, 2)
      .map(d => parseInt(d));
  }

  // =============================================================================
  // MULTI-LAYERED FALLBACK SYSTEM - DISCOVERY ENGINE STYLE
  // =============================================================================

  async createRecommendationsWithFallbacks(userProfile, mediaType, sessionType, count, filters) {
    const sessionTemplate = this.sessionTypes[sessionType] || this.sessionTypes.evening;
    
    // Layer 1: Session-aware recommendations (temporarily disabled - function not implemented)
    // TODO: Implement createSessionAwareRecommendations for enhanced session-based filtering
    console.log('ℹ️ Skipping session-aware recommendations (not implemented), using multi-strategy approach');

    // Layer 2: Multi-strategy TMDB approach
    try {
      const multiStrategyRecs = await this.getMultiStrategyRecommendations(userProfile, mediaType, count, filters);
      if (multiStrategyRecs && multiStrategyRecs.length > 0) {
        console.log('🎬 Created multi-strategy recommendations');
        return multiStrategyRecs;
      }
    } catch (multiError) {
      console.log('⚠️ Multi-strategy failed, using basic fallback');
    }

    // Layer 3: Emergency fallback like discovery engine
    return this.createEmergencyRecommendations(mediaType, Math.ceil(count / 3), sessionType);
  }

  async getMultiStrategyRecommendations(userProfile, mediaType, count) {
    const strategies = [
      () => this.getSimilarMovies(userProfile, mediaType, count * 0.4),
      () => this.getGenreBasedRecommendations(userProfile, mediaType, count * 0.3),
      () => this.getPopularInGenres(userProfile, mediaType, count * 0.2),
      () => this.getHighRatedRecent(userProfile, mediaType, count * 0.1)
    ];

    const results = [];
    
    for (const strategy of strategies) {
      try {
        const strategyResults = await strategy();
        results.push(...strategyResults);
      } catch (error) {
        console.log('⚠️ Strategy failed, continuing with others:', error.message);
      }
    }

    return this.removeDuplicates(results);
  }

  // =============================================================================
  // RECOMMENDATION STRATEGIES
  // =============================================================================

  async getSimilarMovies(userProfile, mediaType, count) {
    const recommendations = [];
    
    for (const movie of userProfile.topRatedMovies.slice(0, 3)) {
      try {
        const url = `${this.baseURL}/${mediaType}/${movie.id}/similar?api_key=${TMDB_API_KEY}&page=1`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.results) {
          recommendations.push(...data.results.slice(0, Math.ceil(count / 3)));
        }
      } catch (error) {
        console.log('⚠️ Similar movies fetch failed for movie:', movie.id);
      }
    }

    return recommendations;
  }

  async getGenreBasedRecommendations(userProfile, mediaType, count) {
    try {
      const genreIds = userProfile.topGenres.slice(0, 2).join(',');
      const url = `${this.baseURL}/discover/${mediaType}?api_key=${TMDB_API_KEY}&with_genres=${genreIds}&vote_average.gte=${this.qualityThreshold}&vote_count.gte=${this.minVoteCount}&sort_by=vote_average.desc&page=1`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      return data.results ? data.results.slice(0, count) : [];
    } catch (error) {
      console.log('⚠️ Genre-based recommendations failed:', error);
      return [];
    }
  }

  async getPopularInGenres(userProfile, mediaType, count) {
    try {
      const genreIds = userProfile.topGenres.join(',');
      const url = `${this.baseURL}/discover/${mediaType}?api_key=${TMDB_API_KEY}&with_genres=${genreIds}&sort_by=popularity.desc&vote_average.gte=6.5&page=1`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      return data.results ? data.results.slice(0, count) : [];
    } catch (error) {
      console.log('⚠️ Popular in genres failed:', error);
      return [];
    }
  }

  async getHighRatedRecent(userProfile, mediaType, count) {
    try {
      const currentYear = new Date().getFullYear();
      const url = `${this.baseURL}/discover/${mediaType}?api_key=${TMDB_API_KEY}&primary_release_year=${currentYear}&vote_average.gte=8.0&vote_count.gte=1000&sort_by=vote_average.desc&page=1`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      return data.results ? data.results.slice(0, count) : [];
    } catch (error) {
      console.log('⚠️ High-rated recent failed:', error);
      return [];
    }
  }

  // =============================================================================
  // ENHANCED FILTERING AND SCORING WITH SESSION CONTEXT
  // =============================================================================

  filterAndScoreWithSession(recommendations, userProfile, sessionType, filters) {
    const { seen = [], skippedMovies = [] } = filters;
    const seenIds = new Set(seen.map(m => m.id));
    const skippedIds = new Set(skippedMovies.map(m => m.id));
    const sessionTemplate = this.sessionTypes[sessionType] || this.sessionTypes.evening;

    return recommendations
      .filter(movie => !seenIds.has(movie.id) && !skippedIds.has(movie.id))
      .filter(movie => movie.vote_average >= 6.0 && movie.vote_count >= 100)
      .map(movie => this.scoreMovieWithSession(movie, userProfile, sessionTemplate))
      .sort((a, b) => b.recommendationScore - a.recommendationScore);
  }

  scoreMovieWithSession(movie, userProfile, sessionTemplate) {
    let score = movie.vote_average || 5.0;

    // Genre matching bonus (enhanced with session preferences)
    if (movie.genre_ids && userProfile.topGenres) {
      const genreMatches = movie.genre_ids.filter(g => userProfile.topGenres.includes(g)).length;
      score += genreMatches * 0.8;
      
      // Session genre bonus
      const sessionGenreIds = sessionTemplate.preferredGenres.map(genre => this.genreMap[genre]).filter(Boolean);
      const sessionMatches = movie.genre_ids.filter(g => sessionGenreIds.includes(g)).length;
      score += sessionMatches * 0.5;
    }

    // Quality bonus (discovery engine style)
    if (movie.vote_average > 8.0) {
      score += 1.0;
    } else if (movie.vote_average > 7.5) {
      score += 0.5;
    }

    // Vote count quality threshold
    if (movie.vote_count >= this.minVoteCount) {
      score += 0.3;
    }

    // Popularity factor
    if (movie.popularity > 100) {
      score += 0.3;
    }

    // Recent release bonus
    if (movie.release_date) {
      const year = parseInt(movie.release_date.substring(0, 4));
      if (year >= 2020) {
        score += 0.2;
      }
      
      // Decade preference bonus
      if (userProfile.preferredDecades) {
        const decade = Math.floor(year / 10) * 10;
        if (userProfile.preferredDecades.includes(decade)) {
          score += 0.3;
        }
      }
    }

    return {
      ...movie,
      recommendationScore: Math.max(1, Math.min(10, score)),
      sessionMatch: sessionTemplate.name
    };
  }

  // =============================================================================
  // UTILITY FUNCTIONS
  // =============================================================================

  removeDuplicates(movies) {
    const seen = new Set();
    return movies.filter(movie => {
      if (seen.has(movie.id)) {
        return false;
      }
      seen.add(movie.id);
      return true;
    });
  }

  getDefaultUserProfile() {
    return {
      topGenres: [18, 28, 35], // Drama, Action, Comedy
      topRatedMovies: [],
      averageRating: 7.0,
      ratingsCount: 0,
      preferredDecades: [2010, 2020],
      tasteTags: ['mainstream', 'quality-focused'],
      qualityAlignment: 0.7
    };
  }

  async createEmergencyRecommendations(mediaType, count, sessionType = 'evening') {
    try {
      const sessionTemplate = this.sessionTypes[sessionType] || this.sessionTypes.evening;
      const sessionGenreIds = sessionTemplate.preferredGenres
        .map(genre => this.genreMap[genre])
        .filter(Boolean)
        .slice(0, 2)
        .join(',');
      
      // Try session-specific popular movies first
      if (sessionGenreIds) {
        const url = `${this.baseURL}/discover/${mediaType}?api_key=${TMDB_API_KEY}&with_genres=${sessionGenreIds}&vote_average.gte=6.5&sort_by=popularity.desc&page=1`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
          return data.results.slice(0, count).map(movie => ({
            ...movie,
            emergencyReason: `Popular ${sessionTemplate.name.toLowerCase()} movies`,
            sessionMatch: sessionTemplate.name
          }));
        }
      }
      
      // Fallback to general popular
      const url = `${this.baseURL}/${mediaType}/popular?api_key=${TMDB_API_KEY}&page=1`;
      const response = await fetch(url);
      const data = await response.json();
      
      return data.results ? data.results.slice(0, count).map(movie => ({
        ...movie,
        emergencyReason: 'Popular movies worldwide'
      })) : [];
    } catch (error) {
      console.error('❌ Emergency recommendations failed:', error);
      return [];
    }
  }

  // =============================================================================
  // COMPATIBILITY FUNCTIONS
  // =============================================================================

  async recordNotInterested(movieId, userId = 'default') {
    try {
      const key = `not_interested_${userId}`;
      const existing = await AsyncStorage.getItem(key);
      const notInterestedIds = existing ? JSON.parse(existing) : [];
      
      if (!notInterestedIds.includes(movieId)) {
        notInterestedIds.push(movieId);
        await AsyncStorage.setItem(key, JSON.stringify(notInterestedIds));
        console.log('📝 Recorded not interested for movie:', movieId);
      }
    } catch (error) {
      console.error('❌ Failed to record not interested:', error);
    }
  }

  async getNotInterestedMovies(userId = 'default') {
    try {
      const key = `not_interested_${userId}`;
      const data = await AsyncStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('❌ Failed to get not interested movies:', error);
      return [];
    }
  }

  // =============================================================================
  // COMPATIBILITY WITH DISCOVERY SESSION ENGINE
  // =============================================================================

  generateSessionId() {
    return `ai_session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  getQualityGuarantee() {
    const guarantees = [
      "Curated using proven TMDB algorithms",
      "Each film meets quality thresholds", 
      "Matched to your taste profile",
      "Selected from thousands of possibilities"
    ];
    return guarantees[Math.floor(Math.random() * guarantees.length)];
  }
}

export default new AIRecommendations();

// Named exports for compatibility
export const { getImprovedRecommendations, recordNotInterested } = new AIRecommendations();