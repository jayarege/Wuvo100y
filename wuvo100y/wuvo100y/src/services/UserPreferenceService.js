/**
 * USER PREFERENCE SERVICE - Enhanced AI Recommendation System
 * Comprehensive user preference tracking and analysis
 * Team: Marcus, Sarah, Jake, Priya, Alex
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

class UserPreferenceService {
  constructor() {
    this.cache = new Map();
    this.preferenceKeys = {
      NOT_INTERESTED: 'user_not_interested',
      VIEWING_HISTORY: 'user_viewing_history', 
      PREFERENCE_WEIGHTS: 'user_preference_weights',
      DEMOGRAPHIC_PROFILE: 'user_demographic_profile',
      INTERACTION_PATTERNS: 'user_interaction_patterns'
    };
  }

  // =============================================================================
  // NOT INTERESTED TRACKING - Enhanced negative signal processing
  // =============================================================================

  async addNotInterestedItem(item, reason = 'not_interested', mediaType = 'movie') {
    try {
      const notInterestedList = await this.getNotInterestedList(mediaType);
      
      const notInterestedItem = {
        id: item.id,
        title: item.title || item.name,
        genre_ids: item.genre_ids || [],
        vote_average: item.vote_average,
        release_date: item.release_date || item.first_air_date,
        reason: reason, // 'not_interested', 'too_old', 'wrong_genre', 'seen_before'
        timestamp: new Date().toISOString(),
        confidence: this.calculateReasonConfidence(reason)
      };

      // Remove duplicates and add new item
      const filteredList = notInterestedList.filter(existing => existing.id !== item.id);
      filteredList.unshift(notInterestedItem);

      // Keep only last 500 items for performance
      const limitedList = filteredList.slice(0, 500);

      await AsyncStorage.setItem(
        `${this.preferenceKeys.NOT_INTERESTED}_${mediaType}`,
        JSON.stringify(limitedList)
      );

      // Update preference weights based on negative feedback
      await this.updatePreferenceWeights(notInterestedItem, -1, mediaType);

      console.log(`❌ Added to not interested: ${item.title || item.name} (${reason})`);
      return true;
    } catch (error) {
      console.error('Error adding not interested item:', error);
      return false;
    }
  }

  async getNotInterestedList(mediaType = 'movie') {
    try {
      const stored = await AsyncStorage.getItem(`${this.preferenceKeys.NOT_INTERESTED}_${mediaType}`);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error getting not interested list:', error);
      return [];
    }
  }

  async removeFromNotInterested(itemId, mediaType = 'movie') {
    try {
      const notInterestedList = await this.getNotInterestedList(mediaType);
      const filteredList = notInterestedList.filter(item => item.id !== itemId);
      
      await AsyncStorage.setItem(
        `${this.preferenceKeys.NOT_INTERESTED}_${mediaType}`,
        JSON.stringify(filteredList)
      );

      return true;
    } catch (error) {
      console.error('Error removing from not interested:', error);
      return false;
    }
  }

  calculateReasonConfidence(reason) {
    const confidenceMap = {
      'not_interested': 0.9,
      'wrong_genre': 0.8,
      'too_old': 0.6,
      'seen_before': 0.7,
      'low_quality': 0.8,
      'too_long': 0.5,
      'too_short': 0.5
    };
    return confidenceMap[reason] || 0.5;
  }

  // =============================================================================
  // PREFERENCE WEIGHT SYSTEM - Dynamic learning from user behavior
  // =============================================================================

  async updatePreferenceWeights(item, weight, mediaType = 'movie') {
    try {
      const weights = await this.getPreferenceWeights(mediaType);
      
      // Update genre preferences
      if (item.genre_ids && Array.isArray(item.genre_ids)) {
        item.genre_ids.forEach(genreId => {
          weights.genres[genreId] = (weights.genres[genreId] || 0) + weight;
        });
      }

      // Update decade preferences
      if (item.release_date) {
        const year = parseInt(item.release_date.substring(0, 4));
        const decade = Math.floor(year / 10) * 10;
        weights.decades[decade] = (weights.decades[decade] || 0) + weight;
      }

      // Update quality preferences
      if (item.vote_average) {
        const qualityTier = this.getQualityTier(item.vote_average);
        weights.quality[qualityTier] = (weights.quality[qualityTier] || 0) + weight;
      }

      // Update timestamp
      weights.lastUpdated = new Date().toISOString();

      await AsyncStorage.setItem(
        `${this.preferenceKeys.PREFERENCE_WEIGHTS}_${mediaType}`,
        JSON.stringify(weights)
      );

      return weights;
    } catch (error) {
      console.error('Error updating preference weights:', error);
      return null;
    }
  }

  async getPreferenceWeights(mediaType = 'movie') {
    try {
      const stored = await AsyncStorage.getItem(`${this.preferenceKeys.PREFERENCE_WEIGHTS}_${mediaType}`);
      if (stored) {
        return JSON.parse(stored);
      }
      
      // Return default weights structure
      return {
        genres: {},
        decades: {},
        quality: {},
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting preference weights:', error);
      return { genres: {}, decades: {}, quality: {}, lastUpdated: new Date().toISOString() };
    }
  }

  getQualityTier(voteAverage) {
    if (voteAverage >= 8.5) return 'exceptional';
    if (voteAverage >= 7.5) return 'high';
    if (voteAverage >= 6.5) return 'good';
    if (voteAverage >= 5.5) return 'average';
    return 'low';
  }

  // =============================================================================
  // DEMOGRAPHIC INFERENCE - Privacy-first behavioral analysis
  // =============================================================================

  async analyzeDemographicPatterns(userMovies, interactions) {
    try {
      const profile = {
        inferredAgeRange: this.inferAgeRange(userMovies),
        contentMaturity: this.analyzeContentMaturity(userMovies),
        viewingPatterns: this.analyzeViewingPatterns(interactions),
        genrePersonality: this.analyzeGenrePersonality(userMovies),
        lastAnalyzed: new Date().toISOString()
      };

      await AsyncStorage.setItem(
        this.preferenceKeys.DEMOGRAPHIC_PROFILE,
        JSON.stringify(profile)
      );

      return profile;
    } catch (error) {
      console.error('Error analyzing demographic patterns:', error);
      return null;
    }
  }

  inferAgeRange(userMovies) {
    const decadePreferences = {};
    const currentYear = new Date().getFullYear();

    userMovies.forEach(movie => {
      if (movie.release_date && movie.userRating >= 7) {
        const year = parseInt(movie.release_date.substring(0, 4));
        const decade = Math.floor(year / 10) * 10;
        decadePreferences[decade] = (decadePreferences[decade] || 0) + 1;
      }
    });

    // Analyze preference patterns
    const recentMoviePreference = (decadePreferences[2020] || 0) + (decadePreferences[2010] || 0);
    const nostalgia90s = decadePreferences[1990] || 0;
    const nostalgia80s = decadePreferences[1980] || 0;
    const classicPreference = (decadePreferences[1970] || 0) + (decadePreferences[1960] || 0);

    // Age inference logic (privacy-safe)
    if (recentMoviePreference > nostalgia90s && recentMoviePreference > classicPreference) {
      return '18-25'; // Prefers recent content
    } else if (nostalgia90s > recentMoviePreference && nostalgia90s > classicPreference) {
      return '26-35'; // 90s nostalgia
    } else if (nostalgia80s > recentMoviePreference) {
      return '36-50'; // 80s nostalgia  
    } else if (classicPreference > recentMoviePreference) {
      return '40+'; // Classic film appreciation
    }

    return 'unknown';
  }

  analyzeContentMaturity(userMovies) {
    const ratingCounts = { G: 0, PG: 0, 'PG-13': 0, R: 0, 'NC-17': 0 };
    const genreMaturity = { family: 0, teen: 0, adult: 0 };

    userMovies.forEach(movie => {
      // Analyze by genre patterns
      if (movie.genre_ids) {
        const hasFamily = movie.genre_ids.includes(10751) || movie.genre_ids.includes(16);
        const hasAdult = movie.genre_ids.includes(27) || movie.genre_ids.includes(53) || movie.genre_ids.includes(80);
        
        if (hasFamily) genreMaturity.family++;
        else if (hasAdult) genreMaturity.adult++;
        else genreMaturity.teen++;
      }
    });

    const totalMovies = userMovies.length;
    return {
      familyContent: genreMaturity.family / totalMovies,
      teenContent: genreMaturity.teen / totalMovies,
      adultContent: genreMaturity.adult / totalMovies,
      preferredMaturityLevel: Object.keys(genreMaturity).reduce((a, b) => 
        genreMaturity[a] > genreMaturity[b] ? a : b
      )
    };
  }

  analyzeViewingPatterns(interactions) {
    // Analyze interaction timing, frequency, and patterns
    return {
      avgSessionLength: this.calculateAverageSessionLength(interactions),
      preferredTimes: this.findPreferredViewingTimes(interactions),
      bingePotential: this.calculateBingePotential(interactions),
      discoveryVsKnown: this.analyzeDiscoveryRatio(interactions)
    };
  }

  analyzeGenrePersonality(userMovies) {
    const genreProfiles = {
      adventurous: [12, 14, 878], // Adventure, Fantasy, Sci-Fi
      thoughtful: [18, 36, 99], // Drama, History, Documentary  
      entertaining: [35, 10751, 16], // Comedy, Family, Animation
      intense: [27, 53, 80], // Horror, Thriller, Crime
      romantic: [10749, 10402], // Romance, Music
      classic: [37, 10752] // Western, War
    };

    const personalityScores = {};
    
    Object.entries(genreProfiles).forEach(([personality, genres]) => {
      personalityScores[personality] = userMovies.reduce((score, movie) => {
        if (movie.genre_ids && movie.userRating >= 7) {
          const hasGenre = genres.some(genre => movie.genre_ids.includes(genre));
          return score + (hasGenre ? 1 : 0);
        }
        return score;
      }, 0);
    });

    return personalityScores;
  }

  // Helper methods for viewing pattern analysis
  calculateAverageSessionLength(interactions) {
    // Implement based on interaction timestamps
    return 30; // placeholder
  }

  findPreferredViewingTimes(interactions) {
    // Analyze interaction timestamps to find patterns
    return ['evening', 'weekend']; // placeholder
  }

  calculateBingePotential(interactions) {
    // Analyze rapid consecutive interactions
    return 0.7; // placeholder
  }

  analyzeDiscoveryRatio(interactions) {
    // Ratio of new discoveries vs familiar content
    return 0.6; // placeholder
  }

  // =============================================================================
  // RECOMMENDATION FILTERING - Enhanced content matching
  // =============================================================================

  async filterRecommendationsByPreferences(recommendations, mediaType = 'movie') {
    try {
      const [notInterestedList, preferenceWeights, demographicProfile] = await Promise.all([
        this.getNotInterestedList(mediaType),
        this.getPreferenceWeights(mediaType),
        this.getDemographicProfile()
      ]);

      return recommendations.filter(item => {
        // Filter out not interested items
        if (notInterestedList.some(notInterested => notInterested.id === item.id)) {
          console.log(`🚫 Filtered (not interested): ${item.title || item.name}`);
          return false;
        }

        // Apply preference weight filtering
        const preferenceScore = this.calculatePreferenceScore(item, preferenceWeights);
        if (preferenceScore < -0.5) { // Negative preference threshold
          console.log(`🚫 Filtered (low preference): ${item.title || item.name} (score: ${preferenceScore})`);
          return false;
        }

        // Apply demographic filtering if available
        if (demographicProfile && !this.matchesDemographicProfile(item, demographicProfile)) {
          console.log(`🚫 Filtered (demographic mismatch): ${item.title || item.name}`);
          return false;
        }

        return true;
      });
    } catch (error) {
      console.error('Error filtering recommendations:', error);
      return recommendations; // Return unfiltered on error
    }
  }

  calculatePreferenceScore(item, weights) {
    let score = 0;
    let factors = 0;

    // Genre preference score
    if (item.genre_ids && Array.isArray(item.genre_ids)) {
      const genreScore = item.genre_ids.reduce((sum, genreId) => {
        return sum + (weights.genres[genreId] || 0);
      }, 0);
      score += genreScore / item.genre_ids.length;
      factors++;
    }

    // Decade preference score
    if (item.release_date || item.first_air_date) {
      const year = parseInt((item.release_date || item.first_air_date).substring(0, 4));
      const decade = Math.floor(year / 10) * 10;
      score += (weights.decades[decade] || 0);
      factors++;
    }

    // Quality preference score
    if (item.vote_average) {
      const qualityTier = this.getQualityTier(item.vote_average);
      score += (weights.quality[qualityTier] || 0);
      factors++;
    }

    return factors > 0 ? score / factors : 0;
  }

  matchesDemographicProfile(item, profile) {
    // Implement demographic matching logic
    // This is a simplified version - could be more sophisticated
    
    if (profile.contentMaturity) {
      const itemMaturity = this.inferItemMaturity(item);
      if (profile.contentMaturity.preferredMaturityLevel !== itemMaturity) {
        return false;
      }
    }

    return true;
  }

  inferItemMaturity(item) {
    if (!item.genre_ids) return 'teen';
    
    const hasFamily = item.genre_ids.includes(10751) || item.genre_ids.includes(16);
    const hasAdult = item.genre_ids.includes(27) || item.genre_ids.includes(53) || item.genre_ids.includes(80);
    
    if (hasFamily) return 'family';
    if (hasAdult) return 'adult';
    return 'teen';
  }

  async getDemographicProfile() {
    try {
      const stored = await AsyncStorage.getItem(this.preferenceKeys.DEMOGRAPHIC_PROFILE);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('Error getting demographic profile:', error);
      return null;
    }
  }

  // =============================================================================
  // ANALYTICS AND INSIGHTS
  // =============================================================================

  async getPreferenceInsights(mediaType = 'movie') {
    try {
      const [weights, notInterested, demographic] = await Promise.all([
        this.getPreferenceWeights(mediaType),
        this.getNotInterestedList(mediaType),
        this.getDemographicProfile()
      ]);

      return {
        topLikedGenres: this.getTopPreferences(weights.genres, 5),
        topAvoidedGenres: this.getBottomPreferences(weights.genres, 3),
        preferredDecades: this.getTopPreferences(weights.decades, 3),
        qualityPreference: this.getTopPreferences(weights.quality, 1)[0],
        totalNotInterested: notInterested.length,
        commonAvoidanceReasons: this.analyzeAvoidanceReasons(notInterested),
        demographicInsights: demographic ? this.formatDemographicInsights(demographic) : null
      };
    } catch (error) {
      console.error('Error getting preference insights:', error);
      return null;
    }
  }

  getTopPreferences(preferences, count) {
    return Object.entries(preferences)
      .sort(([,a], [,b]) => b - a)
      .slice(0, count)
      .map(([key, value]) => ({ preference: key, score: value }));
  }

  getBottomPreferences(preferences, count) {
    return Object.entries(preferences)
      .filter(([,score]) => score < 0)
      .sort(([,a], [,b]) => a - b)
      .slice(0, count)
      .map(([key, value]) => ({ preference: key, score: value }));
  }

  analyzeAvoidanceReasons(notInterestedList) {
    const reasonCounts = {};
    notInterestedList.forEach(item => {
      reasonCounts[item.reason] = (reasonCounts[item.reason] || 0) + 1;
    });
    
    return Object.entries(reasonCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([reason, count]) => ({ reason, count }));
  }

  formatDemographicInsights(demographic) {
    return {
      inferredAgeRange: demographic.inferredAgeRange,
      contentPreference: demographic.contentMaturity.preferredMaturityLevel,
      topPersonalityTraits: Object.entries(demographic.genrePersonality || {})
        .sort(([,a], [,b]) => b - a)
        .slice(0, 2)
        .map(([trait]) => trait)
    };
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  async clearAllPreferences() {
    try {
      const keys = Object.values(this.preferenceKeys);
      const allKeys = [];
      
      // Add media type variants
      ['movie', 'tv'].forEach(mediaType => {
        keys.forEach(key => {
          if (key.includes('user_')) {
            allKeys.push(`${key}_${mediaType}`);
          }
        });
      });
      
      allKeys.push(this.preferenceKeys.DEMOGRAPHIC_PROFILE);
      
      await AsyncStorage.multiRemove(allKeys);
      this.cache.clear();
      
      console.log('✅ All user preferences cleared');
      return true;
    } catch (error) {
      console.error('Error clearing preferences:', error);
      return false;
    }
  }
}

export default new UserPreferenceService();