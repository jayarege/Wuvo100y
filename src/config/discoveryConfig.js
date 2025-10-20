// =============================================================================
// DISCOVERY SESSION CONFIGURATION
// =============================================================================
// COMMANDMENT 3: "Write code that's clear and obvious"
// COMMANDMENT 5: "Preserve context, not delete it"

export const DISCOVERY_SESSION_CONFIG = {
  // Daily limits
  DAILY_SESSION_LIMIT: 3,
  SESSION_EXPIRY_HOURS: 24,
  
  // Session types and their characteristics
  SESSION_TYPES: {
    morning: {
      name: "Morning Motivation",
      description: "Start your day with inspiring stories",
      icon: "☀️",
      moodTags: ["uplifting", "motivational", "energizing"],
      preferredGenres: [99, 18, 12], // Documentary, Drama, Adventure
      timeWindows: [6, 7, 8, 9, 10, 11],
      popularityBoost: 0.2,
      qualityThreshold: 7.0
    },
    afternoon: {
      name: "Midday Escape",
      description: "Perfect for a mental break",
      icon: "🌤️",
      moodTags: ["engaging", "moderate-paced", "escapist"],
      preferredGenres: [35, 28, 10749], // Comedy, Action, Romance
      timeWindows: [12, 13, 14, 15, 16, 17],
      popularityBoost: 0.3,
      qualityThreshold: 6.5
    },
    evening: {
      name: "Evening Unwind",
      description: "Relax and decompress from your day",
      icon: "🌙",
      moodTags: ["atmospheric", "thoughtful", "immersive"],
      preferredGenres: [53, 18, 9648], // Thriller, Drama, Mystery
      timeWindows: [18, 19, 20, 21, 22],
      popularityBoost: 0.1,
      qualityThreshold: 7.5
    },
    weekend: {
      name: "Weekend Adventure",
      description: "Epic films for your free time",
      icon: "🎬",
      moodTags: ["epic", "cinematic", "binge-worthy"],
      preferredGenres: [28, 878, 14], // Action, Sci-Fi, Fantasy
      timeWindows: [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22],
      popularityBoost: 0.4,
      qualityThreshold: 7.0
    },
    latenight: {
      name: "Late Night Picks",
      description: "Mood-driven selections for night owls",
      icon: "🌃",
      moodTags: ["intense", "artistic", "contemplative"],
      preferredGenres: [27, 53, 80], // Horror, Thriller, Crime
      timeWindows: [23, 0, 1, 2, 3, 4, 5],
      popularityBoost: 0.0,
      qualityThreshold: 8.0
    }
  },

  // Theme templates for different user profiles
  THEME_TEMPLATES: {
    new_user: {
      themes: [
        "Popular Movies Everyone Loves",
        "Critically Acclaimed Must-Watch Films",
        "Hidden Gems with Perfect Ratings",
        "Movies That Define Great Cinema"
      ],
      fallbackStrategy: "popularity"
    },
    casual_viewer: {
      themes: [
        "Easy Weekend Watches",
        "Feel-Good Movies to Brighten Your Day",
        "Popular Picks You Might Have Missed",
        "Movies Perfect for Relaxing"
      ],
      fallbackStrategy: "popularity"
    },
    film_enthusiast: {
      themes: [
        "Underrated Masterpieces",
        "Director's Vision: Auteur Cinema",
        "International Cinema Gems",
        "Movies That Redefined Their Genre"
      ],
      fallbackStrategy: "quality"
    },
    genre_specialist: {
      themes: [
        "Deep Cuts in Your Favorite Genre",
        "Genre Evolution: Then and Now",
        "Hidden Influences and Inspirations",
        "Movies That Perfected the Formula"
      ],
      fallbackStrategy: "genre_matching"
    }
  },

  // Scoring weights for different algorithms
  SCORING_WEIGHTS: {
    groq_enhanced: {
      groq_score: 0.6,
      tmdb_rating: 0.2,
      popularity: 0.1,
      genre_match: 0.1
    },
    tmdb_based: {
      genre_match: 0.3,
      tmdb_rating: 0.3,
      popularity: 0.2,
      recency: 0.1,
      user_similarity: 0.1
    },
    emergency: {
      popularity: 0.6,
      tmdb_rating: 0.4
    }
  },

  // Quality thresholds
  QUALITY_THRESHOLDS: {
    min_vote_average: 6.0,
    min_vote_count: 100,
    min_popularity: 10,
    max_age_years: 50,
    preferred_min_year: 1990
  },

  // Social proof messages
  SOCIAL_PROOF_TEMPLATES: {
    popularity: [
      "Loved by millions worldwide",
      "Trending in your region",
      "Consistently rated 8+ by viewers",
      "A crowd favorite you haven't seen"
    ],
    critical: [
      "Critics' choice selection",
      "Award-winning performances",
      "Certified fresh by professionals",
      "Critically acclaimed masterpiece"
    ],
    niche: [
      "Hidden gem discovery",
      "Cult classic waiting for you",
      "Underrated but brilliant",
      "Film buffs' secret favorite"
    ],
    friends: [
      "Movies your taste buddies love",
      "Popular in your social circle",
      "Recommended by similar viewers",
      "Shared by movie enthusiasts"
    ]
  },

  // Quality guarantees
  QUALITY_GUARANTEES: [
    "If you don't love 7/10 of these, we'll give you bonus sessions",
    "Curated specifically for your taste profile",
    "Each film scored 7.5+ on our quality algorithm",
    "Hand-picked from thousands of possibilities",
    "Guaranteed to match your viewing preferences",
    "Quality-tested against your movie history"
  ],

  // Error messages and fallbacks
  ERROR_MESSAGES: {
    daily_limit_reached: {
      title: "Daily Discovery Limit Reached",
      message: "You've used all 3 discovery sessions today. Your sessions reset at midnight!",
      actionText: "View Previous Sessions"
    },
    api_error: {
      title: "Discovery Engine Unavailable",
      message: "We're having trouble generating your personalized session right now. Here are some popular picks instead.",
      actionText: "Try Again"
    },
    no_user_data: {
      title: "Help Us Learn Your Taste",
      message: "Rate a few movies to unlock personalized discovery sessions tailored just for you.",
      actionText: "Rate Movies"
    }
  },

  // Cache settings
  CACHE_SETTINGS: {
    session_cache_hours: 24,
    user_profile_cache_hours: 168, // 1 week
    theme_cache_hours: 72, // 3 days
    fallback_cache_hours: 48 // 2 days
  }
};

// Helper function to get current session type based on time
export const getCurrentSessionType = () => {
  const hour = new Date().getHours();
  const isWeekend = [0, 6].includes(new Date().getDay());
  
  if (isWeekend) {
    return 'weekend';
  }
  
  for (const [type, config] of Object.entries(DISCOVERY_SESSION_CONFIG.SESSION_TYPES)) {
    if (config.timeWindows.includes(hour)) {
      return type;
    }
  }
  
  return 'evening'; // Default fallback
};

// Helper function to get user profile type
export const getUserProfileType = (userStats) => {
  if (!userStats || userStats.ratingsCount < 5) {
    return 'new_user';
  }
  
  if (userStats.ratingsCount < 20) {
    return 'casual_viewer';
  }
  
  if (userStats.averageRating > 8.0 || userStats.ratingsCount > 100) {
    return 'film_enthusiast';
  }
  
  // Check if user has strong genre preferences
  const topGenrePercentage = userStats.topGenres?.[0]?.percentage || 0;
  if (topGenrePercentage > 0.6) {
    return 'genre_specialist';
  }
  
  return 'casual_viewer';
};

export default DISCOVERY_SESSION_CONFIG;