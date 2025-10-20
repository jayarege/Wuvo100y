import firebase from '../config/firebase';
import FollowService from './FollowService';
import ActivityFeedService from './ActivityFeedService';
import { TMDB_API_KEY } from '../Constants';

/**
 * SocialRecommendationService - Friend-Influenced Movie Recommendations
 * 
 * CODE_BIBLE Compliance:
 * - Commandment #3: Clear social recommendation algorithms
 * - Commandment #4: Honest about recommendation limitations
 * - Commandment #7: Documents WHY social signals improve recommendations
 * - Commandment #9: Explicit error handling and fallbacks
 */
class SocialRecommendationService {
  constructor() {
    this.db = firebase.firestore();
    this.baseURL = 'https://api.themoviedb.org/3';
    this.cache = new Map();
    this.socialWeight = 0.3; // 30% social influence, 70% personal preferences
  }

  /**
   * Get socially-influenced movie recommendations
   * 
   * WHY social recommendations work:
   * - Friends have similar taste (proven by follow relationship)
   * - Social proof reduces decision paralysis
   * - Recent friend activity indicates trending preferences
   * - Collaborative filtering through social networks
   */
  async getSocialRecommendations(userId, userMovies = [], options = {}) {
    try {
      console.log('🤝 Generating social recommendations for user:', userId);
      
      const {
        mediaType = 'movie',
        count = 10,
        includeReasons = true,
        excludeSeenMovies = true
      } = options;

      // Get user's friends and their recent activities
      const socialContext = await this.buildSocialContext(userId);
      
      if (socialContext.friends.length === 0) {
        console.log('👤 No friends found, falling back to personal recommendations');
        return this.getFallbackRecommendations(userMovies, mediaType, count);
      }

      // Generate recommendations using multiple social strategies
      const strategies = [
        () => this.getFriendsLovedMovies(socialContext, userMovies),
        () => this.getTrendingAmongFriends(socialContext, userMovies),
        () => this.getSimilarToFriendsRatings(socialContext, userMovies),
        () => this.getFriendsGenrePreferences(socialContext, userMovies)
      ];

      let allRecommendations = [];
      
      for (const strategy of strategies) {
        try {
          const strategyRecs = await strategy();
          allRecommendations = allRecommendations.concat(strategyRecs);
        } catch (error) {
          console.warn('⚠️ Strategy failed, continuing with others:', error.message);
        }
      }

      // Remove duplicates and movies user has already seen
      const uniqueRecommendations = this.deduplicateRecommendations(allRecommendations);
      const filteredRecommendations = excludeSeenMovies
        ? this.filterSeenMovies(uniqueRecommendations, userMovies)
        : uniqueRecommendations;

      // Score and rank recommendations based on social signals
      const rankedRecommendations = this.rankSocialRecommendations(
        filteredRecommendations, 
        socialContext, 
        userMovies
      );

      // Enrich with TMDB data and social context
      const enrichedRecommendations = await this.enrichWithTMDBData(
        rankedRecommendations.slice(0, count),
        includeReasons
      );

      console.log(`✅ Generated ${enrichedRecommendations.length} social recommendations`);
      return enrichedRecommendations;

    } catch (error) {
      console.error('❌ Error generating social recommendations:', error);
      // Fallback to non-social recommendations
      return this.getFallbackRecommendations(userMovies, options.mediaType, options.count);
    }
  }

  /**
   * Build social context for the user
   * Gets friends, their recent activities, and preference patterns
   */
  async buildSocialContext(userId) {
    try {
      // Get user's friends (mutual follows)
      const following = await FollowService.getFollowing(userId, 100);
      const mutualFriends = [];

      // Filter for mutual friendships only (more trust signal)
      for (const followedUser of following) {
        const isFollowingBack = await FollowService.isFollowing(followedUser.id, userId);
        if (isFollowingBack) {
          mutualFriends.push(followedUser);
        }
      }

      // Get recent activities from friends (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const friendActivities = [];
      const friendIds = mutualFriends.map(f => f.id);

      if (friendIds.length > 0) {
        // Get activities in chunks due to Firestore 'in' limit
        const chunks = this.chunkArray(friendIds, 10);
        
        for (const chunk of chunks) {
          const activitiesSnapshot = await this.db
            .collection('activities')
            .where('userId', 'in', chunk)
            .where('type', '==', ActivityFeedService.ACTIVITY_TYPES.MOVIE_RATED)
            .where('timestamp', '>=', thirtyDaysAgo)
            .orderBy('timestamp', 'desc')
            .limit(200)
            .get();

          const activities = activitiesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp?.toDate() || new Date()
          }));

          friendActivities.push(...activities);
        }
      }

      return {
        friends: mutualFriends,
        recentActivities: friendActivities,
        friendCount: mutualFriends.length
      };

    } catch (error) {
      console.error('❌ Error building social context:', error);
      return { friends: [], recentActivities: [], friendCount: 0 };
    }
  }

  /**
   * Strategy 1: Movies that friends loved (8.0+ ratings)
   * High confidence recommendations from trusted social network
   */
  async getFriendsLovedMovies(socialContext, userMovies) {
    const lovedMovies = socialContext.recentActivities
      .filter(activity => activity.data.rating >= 8.0)
      .map(activity => ({
        movieId: activity.data.movieId,
        title: activity.data.movieTitle,
        poster: activity.data.moviePoster,
        year: activity.data.movieYear,
        socialScore: activity.data.rating,
        socialReason: `${activity.user?.displayName || 'A friend'} loved this (${activity.data.rating}/10)`,
        strategy: 'friends_loved',
        friendUserId: activity.userId,
        tmdbRating: activity.data.tmdbRating
      }));

    return lovedMovies.slice(0, 5); // Top 5 loved movies
  }

  /**
   * Strategy 2: Trending among friends (multiple recent ratings)
   * Movies getting attention in user's social circle
   */
  async getTrendingAmongFriends(socialContext, userMovies) {
    // Group activities by movie and count recent ratings
    const movieCounts = {};
    const ratingTotals = {};

    socialContext.recentActivities.forEach(activity => {
      const movieId = activity.data.movieId;
      if (!movieCounts[movieId]) {
        movieCounts[movieId] = [];
        ratingTotals[movieId] = 0;
      }
      movieCounts[movieId].push(activity);
      ratingTotals[movieId] += activity.data.rating;
    });

    // Find movies with multiple friend ratings (trending)
    const trendingMovies = Object.entries(movieCounts)
      .filter(([movieId, activities]) => activities.length >= 2) // 2+ friends rated it
      .map(([movieId, activities]) => {
        const avgRating = ratingTotals[movieId] / activities.length;
        const firstActivity = activities[0];
        
        return {
          movieId: parseInt(movieId),
          title: firstActivity.data.movieTitle,
          poster: firstActivity.data.moviePoster,
          year: firstActivity.data.movieYear,
          socialScore: avgRating,
          socialReason: `${activities.length} friends recently watched this (avg: ${avgRating.toFixed(1)}/10)`,
          strategy: 'trending_friends',
          friendCount: activities.length,
          tmdbRating: firstActivity.data.tmdbRating
        };
      })
      .sort((a, b) => b.friendCount - a.friendCount); // Sort by friend engagement

    return trendingMovies.slice(0, 3); // Top 3 trending
  }

  /**
   * Strategy 3: Similar to movies friends rated highly
   * Uses TMDB's similar movie API based on friend preferences
   */
  async getSimilarToFriendsRatings(socialContext, userMovies) {
    // Get top-rated movies from friends as seed movies
    const seedMovies = socialContext.recentActivities
      .filter(activity => activity.data.rating >= 7.5)
      .slice(0, 3) // Use top 3 as seeds
      .map(activity => activity.data.movieId);

    if (seedMovies.length === 0) return [];

    const similarMovies = [];

    for (const seedMovieId of seedMovies) {
      try {
        const response = await fetch(
          `${this.baseURL}/movie/${seedMovieId}/similar?api_key=b401be0ea16515055d8d0bde16f80069&page=1`
        );
        
        if (!response.ok) continue;
        
        const data = await response.json();
        const topSimilar = data.results.slice(0, 2).map(movie => ({
          movieId: movie.id,
          title: movie.title,
          poster: movie.poster_path,
          year: movie.release_date ? new Date(movie.release_date).getFullYear() : null,
          socialScore: movie.vote_average,
          socialReason: `Similar to movies your friends love`,
          strategy: 'similar_to_friends',
          tmdbRating: movie.vote_average,
          voteCount: movie.vote_count
        }));

        similarMovies.push(...topSimilar);
      } catch (error) {
        console.warn('⚠️ Failed to get similar movies for seed:', seedMovieId, error);
      }
    }

    return similarMovies;
  }

  /**
   * Strategy 4: Based on friends' genre preferences
   * Discover new movies in genres friends are currently enjoying
   */
  async getFriendsGenrePreferences(socialContext, userMovies) {
    // Analyze genre preferences from friend activities
    const genreScores = {};
    
    socialContext.recentActivities.forEach(activity => {
      // Extract genres from movie data (would need TMDB lookup in real implementation)
      // For now, using placeholder logic
      const rating = activity.data.rating;
      // This would be enhanced with actual genre data from TMDB
      // genreScores[genre] += rating;
    });

    // For Phase 4, return placeholder recommendations
    // Full implementation would discover movies in top friend genres
    return [];
  }

  /**
   * Remove duplicate recommendations and merge social signals
   */
  deduplicateRecommendations(recommendations) {
    const movieMap = new Map();

    recommendations.forEach(rec => {
      const existing = movieMap.get(rec.movieId);
      
      if (existing) {
        // Combine social signals for duplicate movies
        existing.socialScore = Math.max(existing.socialScore, rec.socialScore);
        existing.socialReason += ` • ${rec.socialReason}`;
        existing.strategies = existing.strategies || new Set();
        existing.strategies.add(rec.strategy);
      } else {
        movieMap.set(rec.movieId, {
          ...rec,
          strategies: new Set([rec.strategy])
        });
      }
    });

    return Array.from(movieMap.values());
  }

  /**
   * Filter out movies the user has already seen
   */
  filterSeenMovies(recommendations, userMovies) {
    const seenMovieIds = new Set(userMovies.map(movie => movie.id));
    return recommendations.filter(rec => !seenMovieIds.has(rec.movieId || rec.id));
  }

  /**
   * Rank recommendations based on social signals and personal fit
   */
  rankSocialRecommendations(recommendations, socialContext, userMovies) {
    return recommendations
      .map(rec => {
        let score = rec.socialScore || 0;
        
        // Boost score based on social signals
        if (rec.strategy === 'friends_loved') score += 2.0;
        if (rec.strategy === 'trending_friends') score += 1.5;
        if (rec.friendCount > 2) score += 1.0;
        
        // Boost for high TMDB ratings
        if (rec.tmdbRating >= 8.0) score += 1.0;
        if (rec.voteCount >= 1000) score += 0.5;

        return { ...rec, finalScore: score };
      })
      .sort((a, b) => b.finalScore - a.finalScore);
  }

  /**
   * Enrich recommendations with detailed TMDB data
   */
  async enrichWithTMDBData(recommendations, includeReasons = true) {
    if (recommendations.length === 0) return [];

    try {
      const enrichedRecs = await Promise.all(
        recommendations.map(async (rec) => {
          try {
            const response = await fetch(
              `${this.baseURL}/movie/${rec.movieId}?api_key=b401be0ea16515055d8d0bde16f80069`
            );
            
            if (!response.ok) return rec;
            
            const movieData = await response.json();
            
            return {
              ...rec,
              ...movieData,
              socialContext: includeReasons ? {
                reason: rec.socialReason,
                strategy: rec.strategy,
                score: rec.finalScore
              } : undefined
            };
          } catch (error) {
            console.warn('⚠️ Failed to enrich movie data for:', rec.movieId);
            return rec;
          }
        })
      );

      return enrichedRecs;
    } catch (error) {
      console.error('❌ Error enriching with TMDB data:', error);
      return recommendations;
    }
  }

  /**
   * Fallback recommendations when no social data available
   */
  async getFallbackRecommendations(userMovies, mediaType = 'movie', count = 10) {
    try {
      console.log('🔄 Using fallback recommendations (no social data)');
      
      // Use existing AI recommendation system as fallback
      const AIRecommendations = await import('../utils/AIRecommendations');
      return await AIRecommendations.default.getImprovedRecommendations(userMovies, mediaType, count);
      
    } catch (error) {
      console.error('❌ Fallback recommendations failed:', error);
      return [];
    }
  }

  /**
   * Get social proof for a specific movie
   * Shows which friends liked/rated this movie
   */
  async getSocialProofForMovie(movieId, userId) {
    try {
      const socialContext = await this.buildSocialContext(userId);
      
      const friendsWhoRated = socialContext.recentActivities
        .filter(activity => activity.data.movieId === movieId)
        .map(activity => ({
          userId: activity.userId,
          displayName: activity.user?.displayName,
          username: activity.user?.username,
          rating: activity.data.rating,
          timestamp: activity.timestamp,
          review: activity.data.review
        }))
        .sort((a, b) => b.rating - a.rating); // Sort by rating

      return {
        friendCount: friendsWhoRated.length,
        averageRating: friendsWhoRated.length > 0
          ? friendsWhoRated.reduce((sum, f) => sum + f.rating, 0) / friendsWhoRated.length
          : null,
        friendRatings: friendsWhoRated
      };

    } catch (error) {
      console.error('❌ Error getting social proof:', error);
      return { friendCount: 0, averageRating: null, friendRatings: [] };
    }
  }

  /**
   * Utility: Chunk array for Firestore 'in' queries
   */
  chunkArray(array, chunkSize) {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Clear recommendation cache
   */
  clearCache() {
    this.cache.clear();
    console.log('🧹 Social recommendation cache cleared');
  }
}

export default new SocialRecommendationService();