/**
 * ENHANCED RECOMMENDATION ENGINE - Phase 1 Implementation
 * Rules-based system with user preference integration
 * Team: Marcus, Sarah, Jake, Priya, Alex
 */

import UserPreferenceService from './UserPreferenceService.js';
import { TMDB_API_KEY, GROQ_API_KEY } from '../Constants/index.js';

class EnhancedRecommendationEngine {
  constructor() {
    this.cache = new Map();
    this.rateLimitDelay = 1000;
    this.lastRequestTime = 0;
  }

  // =============================================================================
  // MAIN RECOMMENDATION INTERFACE
  // =============================================================================

  async getPersonalizedRecommendations(userMovies, mediaType = 'movie', options = {}) {
    try {
      console.log(`🎯 Getting personalized recommendations for ${mediaType}`);
      
      const {
        count = 20,
        includePopular = true,
        includeHidden = true,
        useMLEnhancement = false // Phase 2 feature
      } = options;

      // Step 1: Analyze user preferences
      const userProfile = await this.buildUserProfile(userMovies, mediaType);
      
      // Step 2: Get base recommendations using multiple strategies
      const baseRecommendations = await this.getBaseRecommendations(
        userMovies, 
        userProfile, 
        mediaType, 
        count * 3 // Get more than needed for filtering
      );

      // Step 3: Apply preference-based filtering and scoring
      const scoredRecommendations = await this.scoreAndFilterRecommendations(
        baseRecommendations,
        userProfile,
        mediaType
      );

      // Step 4: Apply diversity and quality controls
      const finalRecommendations = this.optimizeRecommendationList(
        scoredRecommendations,
        userProfile,
        count
      );

      console.log(`✅ Generated ${finalRecommendations.length} personalized recommendations`);
      return finalRecommendations;

    } catch (error) {
      console.error('Error in personalized recommendations:', error);
      return this.getFallbackRecommendations(userMovies, mediaType);
    }
  }

  // =============================================================================
  // USER PROFILE BUILDING
  // =============================================================================

  async buildUserProfile(userMovies, mediaType) {
    try {
      // Get existing preference data
      const [preferenceWeights, notInterestedList, demographicProfile] = await Promise.all([
        UserPreferenceService.getPreferenceWeights(mediaType),
        UserPreferenceService.getNotInterestedList(mediaType),
        UserPreferenceService.getDemographicProfile()
      ]);

      // Analyze current rating patterns
      const ratingAnalysis = this.analyzeRatingPatterns(userMovies);
      
      // Build comprehensive profile
      const profile = {
        // Basic stats
        totalRated: userMovies.length,
        averageRating: this.calculateAverageRating(userMovies),
        ratingDistribution: this.analyzeRatingDistribution(userMovies),
        
        // Content preferences
        genrePreferences: this.analyzeGenrePreferences(userMovies, preferenceWeights.genres),
        decadePreferences: this.analyzeDecadePreferences(userMovies, preferenceWeights.decades),
        qualityPreferences: this.analyzeQualityPreferences(userMovies, preferenceWeights.quality),
        
        // Behavioral patterns
        ratingPatterns: ratingAnalysis,
        diversityScore: this.calculateDiversityScore(userMovies),
        explorationTendency: this.calculateExplorationTendency(userMovies),
        
        // Negative signals
        notInterestedItems: notInterestedList,
        avoidancePatterns: this.analyzeAvoidancePatterns(notInterestedList),
        
        // Demographic insights (privacy-safe)
        demographicProfile: demographicProfile,
        
        // Recommendation settings
        preferredComplexity: this.inferComplexityPreference(userMovies),
        mainstreamVsNiche: this.calculateMainstreamRatio(userMovies),
        
        lastUpdated: new Date().toISOString()
      };

      return profile;
    } catch (error) {
      console.error('Error building user profile:', error);
      return this.getDefaultProfile();
    }
  }

  analyzeRatingPatterns(userMovies) {
    const ratings = userMovies.map(m => m.userRating).filter(r => r != null);
    
    return {
      isGenerousRater: ratings.filter(r => r >= 8).length / ratings.length > 0.4,
      isCriticalRater: ratings.filter(r => r <= 5).length / ratings.length > 0.3,
      usesFullScale: (Math.max(...ratings) - Math.min(...ratings)) >= 7,
      averageDeviation: this.calculateAverageDeviation(userMovies),
      consistencyScore: this.calculateConsistencyScore(userMovies)
    };
  }

  calculateAverageDeviation(userMovies) {
    const withTMDBRatings = userMovies.filter(m => m.vote_average && m.userRating);
    if (withTMDBRatings.length === 0) return 0;
    
    const deviations = withTMDBRatings.map(m => Math.abs(m.userRating - m.vote_average));
    return deviations.reduce((sum, dev) => sum + dev, 0) / deviations.length;
  }

  calculateConsistencyScore(userMovies) {
    // Analyze consistency within genres
    const genreConsistency = {};
    
    userMovies.forEach(movie => {
      if (movie.genre_ids && movie.userRating) {
        movie.genre_ids.forEach(genreId => {
          if (!genreConsistency[genreId]) genreConsistency[genreId] = [];
          genreConsistency[genreId].push(movie.userRating);
        });
      }
    });

    // Calculate standard deviation for each genre
    const consistencyScores = Object.values(genreConsistency)
      .filter(ratings => ratings.length >= 3)
      .map(ratings => {
        const mean = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
        const variance = ratings.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / ratings.length;
        return Math.sqrt(variance);
      });

    return consistencyScores.length > 0 
      ? consistencyScores.reduce((sum, score) => sum + score, 0) / consistencyScores.length
      : 0;
  }

  analyzeGenrePreferences(userMovies, existingWeights) {
    const genreScores = { ...existingWeights };
    
    // Add current movie analysis
    userMovies.forEach(movie => {
      if (movie.genre_ids && movie.userRating) {
        const weight = this.getRatingWeight(movie.userRating);
        movie.genre_ids.forEach(genreId => {
          genreScores[genreId] = (genreScores[genreId] || 0) + weight;
        });
      }
    });

    // Normalize scores
    const maxScore = Math.max(...Object.values(genreScores));
    if (maxScore > 0) {
      Object.keys(genreScores).forEach(genre => {
        genreScores[genre] = genreScores[genre] / maxScore;
      });
    }

    return genreScores;
  }

  getRatingWeight(userRating) {
    if (userRating >= 9) return 3;
    if (userRating >= 8) return 2;
    if (userRating >= 7) return 1;
    if (userRating >= 6) return 0.5;
    if (userRating >= 4) return -1;
    return -2;
  }

  // =============================================================================
  // BASE RECOMMENDATION STRATEGIES
  // =============================================================================

  async getBaseRecommendations(userMovies, userProfile, mediaType, count) {
    const strategies = [
      () => this.getCollaborativeRecommendations(userMovies, userProfile, mediaType, Math.ceil(count * 0.4)),
      () => this.getContentBasedRecommendations(userMovies, userProfile, mediaType, Math.ceil(count * 0.3)),
      () => this.getPopularityBasedRecommendations(userProfile, mediaType, Math.ceil(count * 0.2)),
      () => this.getSerendipityRecommendations(userProfile, mediaType, Math.ceil(count * 0.1))
    ];

    const results = await Promise.allSettled(strategies.map(strategy => strategy()));
    
    const allRecommendations = results
      .filter(result => result.status === 'fulfilled')
      .flatMap(result => result.value || []);

    // Remove duplicates
    const uniqueRecommendations = this.removeDuplicates(allRecommendations);
    
    return uniqueRecommendations.slice(0, count);
  }

  async getCollaborativeRecommendations(userMovies, userProfile, mediaType, count) {
    try {
      // Simplified collaborative filtering based on similar rating patterns
      const userGenres = this.getTopGenres(userProfile.genrePreferences, 5);
      const userDecades = this.getTopDecades(userProfile.decadePreferences, 3);
      
      const recommendations = await this.searchTMDBWithCriteria({
        genres: userGenres,
        decades: userDecades,
        minRating: userProfile.averageRating - 1,
        maxRating: userProfile.averageRating + 2,
        mediaType,
        count: count * 2
      });

      return recommendations.filter(item => !this.isAlreadyConsumed(item, userMovies));
    } catch (error) {
      console.error('Error in collaborative recommendations:', error);
      return [];
    }
  }

  async getContentBasedRecommendations(userMovies, userProfile, mediaType, count) {
    try {
      // Find movies similar to highest-rated ones
      const topRatedMovies = userMovies
        .filter(m => m.userRating >= 8)
        .sort((a, b) => b.userRating - a.userRating)
        .slice(0, 5);

      const recommendations = [];
      
      for (const movie of topRatedMovies) {
        const similar = await this.findSimilarContent(movie, mediaType, Math.ceil(count / topRatedMovies.length));
        recommendations.push(...similar);
      }

      return this.removeDuplicates(recommendations);
    } catch (error) {
      console.error('Error in content-based recommendations:', error);
      return [];
    }
  }

  async getPopularityBasedRecommendations(userProfile, mediaType, count) {
    try {
      // Get popular content filtered by user preferences
      const endpoint = mediaType === 'movie' ? 'movie/popular' : 'tv/popular';
      const response = await fetch(
        `https://api.themoviedb.org/3/${endpoint}?api_key=b401be0ea16515055d8d0bde16f80069&page=1`
      );
      
      const data = await response.json();
      return data.results?.slice(0, count) || [];
    } catch (error) {
      console.error('Error in popularity-based recommendations:', error);
      return [];
    }
  }

  async getSerendipityRecommendations(userProfile, mediaType, count) {
    try {
      // Recommendations outside user's comfort zone for discovery
      const avoidedGenres = this.getBottomGenres(userProfile.genrePreferences, 2);
      const unexploredDecades = this.getUnexploredDecades(userProfile.decadePreferences);
      
      if (avoidedGenres.length === 0 && unexploredDecades.length === 0) {
        return [];
      }

      const recommendations = await this.searchTMDBWithCriteria({
        genres: avoidedGenres.slice(0, 1), // Only one avoided genre
        decades: unexploredDecades.slice(0, 1),
        minRating: 7.5, // High quality only for serendipity
        mediaType,
        count
      });

      return recommendations;
    } catch (error) {
      console.error('Error in serendipity recommendations:', error);
      return [];
    }
  }

  // =============================================================================
  // SCORING AND FILTERING
  // =============================================================================

  async scoreAndFilterRecommendations(recommendations, userProfile, mediaType) {
    try {
      // Apply user preference filtering
      const filteredRecommendations = await UserPreferenceService.filterRecommendationsByPreferences(
        recommendations,
        mediaType
      );

      // Score remaining recommendations
      const scoredRecommendations = filteredRecommendations.map(item => ({
        ...item,
        personalizedScore: this.calculatePersonalizedScore(item, userProfile),
        confidenceScore: this.calculateConfidenceScore(item, userProfile),
        noveltyScore: this.calculateNoveltyScore(item, userProfile)
      }));

      // Sort by combined score
      scoredRecommendations.sort((a, b) => {
        const scoreA = (a.personalizedScore * 0.6) + (a.confidenceScore * 0.3) + (a.noveltyScore * 0.1);
        const scoreB = (b.personalizedScore * 0.6) + (b.confidenceScore * 0.3) + (b.noveltyScore * 0.1);
        return scoreB - scoreA;
      });

      return scoredRecommendations;
    } catch (error) {
      console.error('Error scoring recommendations:', error);
      return recommendations;
    }
  }

  calculatePersonalizedScore(item, userProfile) {
    let score = 0;
    let factors = 0;

    // Genre preference scoring
    if (item.genre_ids && userProfile.genrePreferences) {
      const genreScore = item.genre_ids.reduce((sum, genreId) => {
        return sum + (userProfile.genrePreferences[genreId] || 0);
      }, 0) / item.genre_ids.length;
      score += genreScore;
      factors++;
    }

    // Quality alignment scoring
    if (item.vote_average && userProfile.averageRating) {
      const qualityAlignment = 1 - Math.abs(item.vote_average - userProfile.averageRating) / 10;
      score += qualityAlignment;
      factors++;
    }

    // Decade preference scoring
    if (item.release_date || item.first_air_date) {
      const year = parseInt((item.release_date || item.first_air_date).substring(0, 4));
      const decade = Math.floor(year / 10) * 10;
      const decadeScore = userProfile.decadePreferences[decade] || 0;
      score += decadeScore;
      factors++;
    }

    return factors > 0 ? score / factors : 0;
  }

  calculateConfidenceScore(item, userProfile) {
    // Higher confidence for items similar to user's highly-rated content
    if (!item.vote_average || !item.vote_count) return 0.5;
    
    const qualityScore = item.vote_average / 10;
    const popularityScore = Math.min(item.vote_count / 1000, 1);
    const reliabilityScore = item.vote_count > 100 ? 1 : item.vote_count / 100;
    
    return (qualityScore * 0.5) + (popularityScore * 0.3) + (reliabilityScore * 0.2);
  }

  calculateNoveltyScore(item, userProfile) {
    // Score based on how different this is from user's typical content
    let noveltyFactors = 0;
    let noveltySum = 0;

    // Genre novelty
    if (item.genre_ids && userProfile.genrePreferences) {
      const avgGenreScore = item.genre_ids.reduce((sum, genreId) => {
        return sum + (userProfile.genrePreferences[genreId] || 0);
      }, 0) / item.genre_ids.length;
      
      noveltySum += (avgGenreScore < 0 ? 1 : 0); // Novel if from avoided genres
      noveltyFactors++;
    }

    // Decade novelty
    if (item.release_date || item.first_air_date) {
      const year = parseInt((item.release_date || item.first_air_date).substring(0, 4));
      const decade = Math.floor(year / 10) * 10;
      const isUnexploredDecade = !(decade in userProfile.decadePreferences);
      
      noveltySum += (isUnexploredDecade ? 1 : 0);
      noveltyFactors++;
    }

    return noveltyFactors > 0 ? noveltySum / noveltyFactors : 0.5;
  }

  // =============================================================================
  // OPTIMIZATION AND DIVERSITY
  // =============================================================================

  optimizeRecommendationList(scoredRecommendations, userProfile, targetCount) {
    const result = [];
    const genresUsed = {};
    const decadesUsed = {};
    
    // Ensure diversity while maintaining quality
    for (const item of scoredRecommendations) {
      if (result.length >= targetCount) break;
      
      // Check diversity constraints
      const itemGenres = item.genre_ids || [];
      const itemYear = item.release_date || item.first_air_date;
      const itemDecade = itemYear ? Math.floor(parseInt(itemYear.substring(0, 4)) / 10) * 10 : null;
      
      // Genre diversity check
      const genreOverlap = itemGenres.filter(genre => genresUsed[genre]).length;
      const maxGenreRepetition = Math.ceil(targetCount / 10); // Max 10% repetition
      
      if (genreOverlap <= maxGenreRepetition) {
        // Decade diversity check
        const decadeCount = decadesUsed[itemDecade] || 0;
        const maxDecadeRepetition = Math.ceil(targetCount / 5); // Max 20% repetition
        
        if (decadeCount < maxDecadeRepetition) {
          result.push(item);
          
          // Update usage counters
          itemGenres.forEach(genre => {
            genresUsed[genre] = (genresUsed[genre] || 0) + 1;
          });
          if (itemDecade) {
            decadesUsed[itemDecade] = (decadesUsed[itemDecade] || 0) + 1;
          }
        }
      }
    }
    
    // Fill remaining slots with best available if needed
    if (result.length < targetCount) {
      const remaining = scoredRecommendations
        .filter(item => !result.includes(item))
        .slice(0, targetCount - result.length);
      result.push(...remaining);
    }
    
    return result;
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  removeDuplicates(recommendations) {
    const seen = new Set();
    return recommendations.filter(item => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }

  isAlreadyConsumed(item, userMovies) {
    return userMovies.some(userMovie => userMovie.id === item.id);
  }

  getTopGenres(genrePreferences, count) {
    return Object.entries(genrePreferences)
      .sort(([,a], [,b]) => b - a)
      .slice(0, count)
      .map(([genreId]) => parseInt(genreId));
  }

  getBottomGenres(genrePreferences, count) {
    return Object.entries(genrePreferences)
      .filter(([,score]) => score < 0)
      .sort(([,a], [,b]) => a - b)
      .slice(0, count)
      .map(([genreId]) => parseInt(genreId));
  }

  getTopDecades(decadePreferences, count) {
    return Object.entries(decadePreferences)
      .sort(([,a], [,b]) => b - a)
      .slice(0, count)
      .map(([decade]) => parseInt(decade));
  }

  getUnexploredDecades(decadePreferences) {
    const allDecades = [1960, 1970, 1980, 1990, 2000, 2010, 2020];
    const exploredDecades = Object.keys(decadePreferences).map(d => parseInt(d));
    return allDecades.filter(decade => !exploredDecades.includes(decade));
  }

  async searchTMDBWithCriteria(criteria) {
    // Implementation for TMDB search with specific criteria
    // This would integrate with existing TMDB search functions
    return [];
  }

  async findSimilarContent(movie, mediaType, count) {
    // Implementation for finding similar content
    // This would use TMDB's similar/recommendations endpoints
    return [];
  }

  getFallbackRecommendations(userMovies, mediaType) {
    // Simple fallback when main system fails
    console.log('🔄 Using basic fallback recommendations');
    return [];
  }

  getDefaultProfile() {
    return {
      totalRated: 0,
      averageRating: 7,
      genrePreferences: {},
      decadePreferences: {},
      notInterestedItems: [],
      ratingPatterns: {
        isGenerousRater: false,
        isCriticalRater: false,
        usesFullScale: true
      }
    };
  }

  calculateAverageRating(userMovies) {
    const ratings = userMovies.map(m => m.userRating).filter(r => r != null);
    return ratings.length > 0 ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : 7;
  }

  analyzeRatingDistribution(userMovies) {
    const distribution = {};
    userMovies.forEach(movie => {
      if (movie.userRating) {
        const rating = Math.floor(movie.userRating);
        distribution[rating] = (distribution[rating] || 0) + 1;
      }
    });
    return distribution;
  }

  analyzeDecadePreferences(userMovies, existingWeights) {
    const decadeScores = { ...existingWeights };
    
    userMovies.forEach(movie => {
      if ((movie.release_date || movie.first_air_date) && movie.userRating) {
        const year = parseInt((movie.release_date || movie.first_air_date).substring(0, 4));
        const decade = Math.floor(year / 10) * 10;
        const weight = this.getRatingWeight(movie.userRating);
        decadeScores[decade] = (decadeScores[decade] || 0) + weight;
      }
    });

    return decadeScores;
  }

  analyzeQualityPreferences(userMovies, existingWeights) {
    const qualityScores = { ...existingWeights };
    
    userMovies.forEach(movie => {
      if (movie.vote_average && movie.userRating) {
        const qualityTier = this.getQualityTier(movie.vote_average);
        const weight = this.getRatingWeight(movie.userRating);
        qualityScores[qualityTier] = (qualityScores[qualityTier] || 0) + weight;
      }
    });

    return qualityScores;
  }

  getQualityTier(voteAverage) {
    if (voteAverage >= 8.5) return 'exceptional';
    if (voteAverage >= 7.5) return 'high';
    if (voteAverage >= 6.5) return 'good';
    if (voteAverage >= 5.5) return 'average';
    return 'low';
  }

  calculateDiversityScore(userMovies) {
    const genres = new Set();
    const decades = new Set();
    
    userMovies.forEach(movie => {
      if (movie.genre_ids) movie.genre_ids.forEach(genre => genres.add(genre));
      if (movie.release_date || movie.first_air_date) {
        const year = parseInt((movie.release_date || movie.first_air_date).substring(0, 4));
        decades.add(Math.floor(year / 10) * 10);
      }
    });

    return (genres.size + decades.size) / userMovies.length;
  }

  calculateExplorationTendency(userMovies) {
    // Analyze tendency to explore vs stick to comfort zone
    const recentMovies = userMovies.filter(m => {
      const year = parseInt((m.release_date || m.first_air_date || '2020').substring(0, 4));
      return year >= 2015;
    });

    const olderMovies = userMovies.filter(m => {
      const year = parseInt((m.release_date || m.first_air_date || '2020').substring(0, 4));
      return year < 2000;
    });

    return olderMovies.length / Math.max(userMovies.length, 1);
  }

  analyzeAvoidancePatterns(notInterestedList) {
    const patterns = {
      commonGenres: {},
      commonDecades: {},
      commonReasons: {}
    };

    notInterestedList.forEach(item => {
      // Analyze avoided genres
      if (item.genre_ids) {
        item.genre_ids.forEach(genreId => {
          patterns.commonGenres[genreId] = (patterns.commonGenres[genreId] || 0) + 1;
        });
      }

      // Analyze avoided decades
      if (item.release_date) {
        const year = parseInt(item.release_date.substring(0, 4));
        const decade = Math.floor(year / 10) * 10;
        patterns.commonDecades[decade] = (patterns.commonDecades[decade] || 0) + 1;
      }

      // Analyze avoidance reasons
      patterns.commonReasons[item.reason] = (patterns.commonReasons[item.reason] || 0) + 1;
    });

    return patterns;
  }

  inferComplexityPreference(userMovies) {
    // Analyze preference for complex vs simple content based on genres
    const complexGenres = [18, 53, 9648, 878]; // Drama, Thriller, Mystery, Sci-Fi
    const simpleGenres = [35, 16, 10751]; // Comedy, Animation, Family

    let complexCount = 0;
    let simpleCount = 0;

    userMovies.forEach(movie => {
      if (movie.genre_ids && movie.userRating >= 7) {
        const hasComplex = movie.genre_ids.some(genre => complexGenres.includes(genre));
        const hasSimple = movie.genre_ids.some(genre => simpleGenres.includes(genre));
        
        if (hasComplex) complexCount++;
        if (hasSimple) simpleCount++;
      }
    });

    const total = complexCount + simpleCount;
    return total > 0 ? complexCount / total : 0.5;
  }

  calculateMainstreamRatio(userMovies) {
    const popularMovies = userMovies.filter(m => m.vote_count && m.vote_count > 1000 && m.userRating >= 7);
    const nicheMovies = userMovies.filter(m => m.vote_count && m.vote_count <= 500 && m.userRating >= 7);
    
    const total = popularMovies.length + nicheMovies.length;
    return total > 0 ? popularMovies.length / total : 0.7; // Default to mainstream preference
  }
}

export default new EnhancedRecommendationEngine();