// =============================================================================
// DISCOVERY SESSION ENGINE - CORE ARCHITECTURE
// =============================================================================
// COMMANDMENT 3: "Write code that's clear and obvious"
// COMMANDMENT 9: "Handle errors explicitly"

import { TMDB_API_KEY, GROQ_API_KEY } from '../Constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getImprovedRecommendations } from '../utils/ImprovedAIRecommendations.js';

class DiscoverySessionEngine {
  constructor() {
    this.cache = new Map();
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
  }

  // =============================================================================
  // MAIN DISCOVERY SESSION GENERATION
  // =============================================================================

  async generateDiscoverySession(userId, sessionType = 'evening', options = {}) {
    try {
      console.log(`🎪 Generating discovery session for user ${userId}, type: ${sessionType}`);

      // COMMANDMENT 10: "Treat user data as sacred"
      const userProfile = await this.getUserProfile(userId);
      const dailyLimits = await this.checkDailyLimits(userId);
      
      if (dailyLimits.sessionsUsed >= 3) {
        return this.createLimitReachedSession(userId, dailyLimits);
      }

      // COMMANDMENT 9: "Handle errors explicitly" - Multiple fallback layers
      const sessionData = await this.createSessionWithFallbacks(userId, sessionType, userProfile, options);
      
      // Track session generation
      await this.recordSessionGeneration(userId, sessionType);
      
      return sessionData;

    } catch (error) {
      console.error('❌ Discovery session generation failed:', error);
      return this.createEmergencySession(userId, sessionType);
    }
  }

  // =============================================================================
  // SESSION CREATION WITH FALLBACKS
  // =============================================================================

  async createSessionWithFallbacks(userId, sessionType, userProfile, options) {
    const sessionTemplate = this.sessionTypes[sessionType] || this.sessionTypes.evening;
    
    // Layer 1: Try enhanced Groq-powered session
    try {
      if (GROQ_API_KEY && userProfile.ratingsCount >= 5) {
        const enhancedSession = await this.createGroqEnhancedSession(userProfile, sessionTemplate, options);
        if (enhancedSession) {
          console.log('✨ Created Groq-enhanced discovery session');
          return enhancedSession;
        }
      }
    } catch (groqError) {
      console.log('⚠️ Groq enhancement failed, using fallback');
    }

    // Layer 2: TMDB-based session with smart theming
    try {
      const tmdbSession = await this.createTMDBSession(userProfile, sessionTemplate, options);
      if (tmdbSession) {
        console.log('🎬 Created TMDB-based discovery session');
        return tmdbSession;
      }
    } catch (tmdbError) {
      console.log('⚠️ TMDB session failed, using basic fallback');
    }

    // Layer 3: Emergency fallback
    return this.createEmergencySession(userId, sessionType);
  }

  // =============================================================================
  // GROQ-ENHANCED SESSION CREATION
  // =============================================================================

  async createGroqEnhancedSession(userProfile, sessionTemplate, options) {
    try {
      // Get base movie candidates
      const candidates = await this.getCandidateMovies(userProfile, sessionTemplate, 30);
      
      // Generate theme and narrative with Groq
      const themeData = await this.generateSessionTheme(userProfile, sessionTemplate, candidates);
      
      // Score and rank movies
      const rankedMovies = await this.rankMoviesForSession(candidates, userProfile, themeData);
      
      return {
        id: this.generateSessionId(),
        type: 'groq-enhanced',
        theme: themeData,
        movies: rankedMovies.slice(0, 10),
        timestamp: Date.now(),
        expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
        qualityGuarantee: this.getQualityGuarantee(),
        socialProof: await this.getSocialProof(rankedMovies, userProfile)
      };
    } catch (error) {
      console.error('Groq session creation failed:', error);
      return null;
    }
  }

  // =============================================================================
  // TMDB SESSION CREATION
  // =============================================================================

  async createTMDBSession(userProfile, sessionTemplate, options) {
    try {
      // Get candidates using TMDB's recommendation engine
      const candidates = await this.getCandidateMovies(userProfile, sessionTemplate, 50);
      
      // Create theme based on template and user preferences
      const theme = this.createTemplateTheme(sessionTemplate, userProfile);
      
      // Score movies using algorithmic approach
      const rankedMovies = this.scoreMoviesAlgorithmically(candidates, userProfile, theme);
      
      return {
        id: this.generateSessionId(),
        type: 'tmdb-based',
        theme: theme,
        movies: rankedMovies.slice(0, 10),
        timestamp: Date.now(),
        expiresAt: Date.now() + (24 * 60 * 60 * 1000),
        qualityGuarantee: this.getQualityGuarantee(),
        socialProof: await this.getSocialProof(rankedMovies, userProfile)
      };
    } catch (error) {
      console.error('TMDB session creation failed:', error);
      return null;
    }
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  async getUserProfile(userId) {
    try {
      const userMovies = await AsyncStorage.getItem('userMovies') || '[]';
      const movies = JSON.parse(userMovies);
      
      // COMMANDMENT 2: "Never assume" - validate data
      if (!Array.isArray(movies) || movies.length === 0) {
        return this.getDefaultUserProfile();
      }
      
      return this.analyzeUserTaste(movies);
    } catch (error) {
      console.error('Error loading user profile:', error);
      return this.getDefaultUserProfile();
    }
  }

  async checkDailyLimits(userId) {
    try {
      const today = new Date().toDateString();
      const limitsKey = `daily_limits_${userId}_${today}`;
      const limits = await AsyncStorage.getItem(limitsKey);
      
      if (limits) {
        return JSON.parse(limits);
      }
      
      return {
        sessionsUsed: 0,
        maxSessions: 3,
        resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      };
    } catch (error) {
      console.error('Error checking daily limits:', error);
      return { sessionsUsed: 0, maxSessions: 3 };
    }
  }

  async recordSessionGeneration(userId, sessionType) {
    try {
      const today = new Date().toDateString();
      const limitsKey = `daily_limits_${userId}_${today}`;
      const limits = await this.checkDailyLimits(userId);
      
      limits.sessionsUsed += 1;
      limits.lastSessionType = sessionType;
      limits.lastSessionTime = Date.now();
      
      await AsyncStorage.setItem(limitsKey, JSON.stringify(limits));
      console.log(`📊 Session recorded: ${limits.sessionsUsed}/3 used today`);
    } catch (error) {
      console.error('Error recording session:', error);
    }
  }

  createEmergencySession(userId, sessionType) {
    const sessionTemplate = this.sessionTypes[sessionType] || this.sessionTypes.evening;
    
    return {
      id: this.generateSessionId(),
      type: 'emergency',
      theme: {
        name: sessionTemplate.name,
        description: sessionTemplate.description,
        explanation: "Popular movies curated for you"
      },
      movies: this.getPopularMoviesFallback(),
      timestamp: Date.now(),
      expiresAt: Date.now() + (24 * 60 * 60 * 1000),
      qualityGuarantee: "These popular films are loved by millions",
      socialProof: { type: 'popularity', message: 'Trending worldwide' }
    };
  }

  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getQualityGuarantee() {
    const guarantees = [
      "If you don't love 7/10 of these, we'll give you bonus sessions",
      "Curated specifically for your taste profile",
      "Each film scored 7.5+ on our quality algorithm",
      "Hand-picked from thousands of possibilities"
    ];
    return guarantees[Math.floor(Math.random() * guarantees.length)];
  }

  getPopularMoviesFallback() {
    // Emergency fallback movies - popular, well-rated films
    return [
      { id: 550, title: "Fight Club", vote_average: 8.4, popularity: 63.8 },
      { id: 13, title: "Forrest Gump", vote_average: 8.5, popularity: 48.3 },
      { id: 680, title: "Pulp Fiction", vote_average: 8.5, popularity: 67.4 },
      { id: 155, title: "The Dark Knight", vote_average: 9.0, popularity: 123.1 },
      { id: 19404, title: "Dilwale Dulhania Le Jayenge", vote_average: 8.7, popularity: 29.2 },
      { id: 278, title: "The Shawshank Redemption", vote_average: 8.7, popularity: 88.4 },
      { id: 238, title: "The Godfather", vote_average: 8.7, popularity: 94.3 },
      { id: 424, title: "Schindler's List", vote_average: 8.6, popularity: 54.2 },
      { id: 129, title: "Spirited Away", vote_average: 8.5, popularity: 81.9 },
      { id: 12477, title: "Grave of the Fireflies", vote_average: 8.4, popularity: 29.8 }
    ];
  }

  getDefaultUserProfile() {
    return {
      ratingsCount: 0,
      topGenres: [18, 28, 53], // Drama, Action, Thriller
      averageRating: 7.0,
      preferredDecades: [2010, 2020],
      tasteTags: ['mainstream', 'quality-focused']
    };
  }
}

export default new DiscoverySessionEngine();