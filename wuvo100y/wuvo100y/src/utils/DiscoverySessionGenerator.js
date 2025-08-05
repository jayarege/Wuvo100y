// =============================================================================
// DISCOVERY SESSION GENERATOR - GROQ INTEGRATION
// =============================================================================
// COMMANDMENT 3: "Write code that's clear and obvious"
// COMMANDMENT 9: "Handle errors explicitly"

import { GROQ_API_KEY } from '../Constants';

class DiscoverySessionGenerator {
  constructor() {
    this.groqEndpoint = 'https://api.groq.com/openai/v1/chat/completions';
    this.rateLimitDelay = 1000; // 1 second between requests
    this.lastRequestTime = 0;
  }

  // =============================================================================
  // MAIN THEME GENERATION
  // =============================================================================

  async generateSessionTheme(userProfile, sessionTemplate, candidateMovies) {
    try {
      if (!true) {
        console.log('⚠️ No Groq API key, using template theme');
        return this.createTemplateTheme(sessionTemplate, userProfile);
      }

      const prompt = this.buildThemePrompt(userProfile, sessionTemplate, candidateMovies);
      const groqResponse = await this.callGroqAPI(prompt);
      
      if (groqResponse && groqResponse.theme) {
        return this.validateAndFormatTheme(groqResponse.theme);
      }
      
      // Fallback to template
      return this.createTemplateTheme(sessionTemplate, userProfile);
      
    } catch (error) {
      console.error('Theme generation failed:', error);
      return this.createTemplateTheme(sessionTemplate, userProfile);
    }
  }

  // =============================================================================
  // GROQ PROMPT BUILDING
  // =============================================================================

  buildThemePrompt(userProfile, sessionTemplate, candidateMovies) {
    const topMovies = userProfile.topRatedMovies || [];
    const topGenres = userProfile.topGenres || [];
    const currentHour = new Date().getHours();
    
    // Sample movies for context
    const movieSamples = candidateMovies.slice(0, 10).map(movie => 
      `"${movie.title}" (${movie.release_date?.substring(0, 4) || 'N/A'}) - ${movie.vote_average}/10`
    ).join(', ');

    return `You are a movie curation expert creating a themed discovery session. 

USER PROFILE:
- Top rated movies: ${topMovies.map(m => `"${m.title}" (${m.userRating}/10)`).join(', ')}
- Preferred genres: ${this.mapGenresToNames(topGenres)}
- Average rating: ${userProfile.averageRating}/10
- Movies rated: ${userProfile.ratingsCount}

SESSION CONTEXT:
- Time of day: ${this.getTimeOfDay(currentHour)}
- Session type: ${sessionTemplate.name}
- Mood: ${sessionTemplate.moodTags.join(', ')}
- Template description: ${sessionTemplate.description}

CANDIDATE MOVIES:
${movieSamples}

Create a compelling discovery session theme that:
1. Connects these movies to the user's proven taste
2. Fits the current time/mood context
3. Has a catchy, engaging theme name
4. Explains WHY these movies work together
5. Gives the user excitement about watching

Respond in JSON format:
{
  "theme": {
    "name": "Engaging theme name (max 6 words)",
    "description": "Why this collection is perfect for you right now",
    "explanation": "How these movies connect to your taste profile",
    "moodMatch": "Why this fits your current mood/time",
    "watchPrompt": "Compelling reason to start watching now"
  }
}

Keep it concise, personal, and exciting. No generic descriptions.`;
  }

  // =============================================================================
  // GROQ API INTERACTION
  // =============================================================================

  async callGroqAPI(prompt) {
    try {
      // Rate limiting
      await this.enforceRateLimit();
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(this.groqEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer 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`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.1-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 800,
          response_format: { type: 'json_object' }
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Groq API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      
      if (!content) {
        throw new Error('Empty response from Groq');
      }

      return JSON.parse(content);
      
    } catch (error) {
      console.error('Groq API call failed:', error);
      throw error;
    }
  }

  async enforceRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.rateLimitDelay) {
      const waitTime = this.rateLimitDelay - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
  }

  // =============================================================================
  // MOVIE SCORING WITH GROQ
  // =============================================================================

  async scoreMoviesWithGroq(movies, userProfile, theme) {
    try {
      if (movies.length === 0) {
        return this.scoreMoviesAlgorithmically(movies, userProfile);
      }

      const scoringPrompt = this.buildScoringPrompt(movies, userProfile, theme);
      const groqResponse = await this.callGroqAPI(scoringPrompt);
      
      if (groqResponse && groqResponse.scores) {
        return this.applyGroqScores(movies, groqResponse.scores);
      }
      
      return this.scoreMoviesAlgorithmically(movies, userProfile);
      
    } catch (error) {
      console.error('Groq scoring failed:', error);
      return this.scoreMoviesAlgorithmically(movies, userProfile);
    }
  }

  buildScoringPrompt(movies, userProfile, theme) {
    const movieList = movies.map((movie, index) => 
      `${index + 1}. "${movie.title}" (${movie.release_date?.substring(0, 4) || 'N/A'}) - ${movie.vote_average}/10 - ${movie.overview?.substring(0, 100) || 'No description'}...`
    ).join('\n');

    return `Score these ${movies.length} movies for a user based on their taste profile and the session theme.

USER TASTE:
${userProfile.topRatedMovies?.map(m => `"${m.title}" (${m.userRating}/10)`).join(', ')}

SESSION THEME: ${theme.name}
${theme.description}

MOVIES TO SCORE:
${movieList}

Rate each movie 1-10 based on:
- How well it fits the user's demonstrated taste
- How well it matches the session theme
- Overall quality and appeal

Respond in JSON format:
{
  "scores": [
    {"movieIndex": 1, "score": 8.5, "reason": "Perfect fit because..."},
    {"movieIndex": 2, "score": 7.2, "reason": "Good match but..."},
    ...
  ]
}

Be honest about scores - don't inflate them.`;
  }

  // =============================================================================
  // FALLBACK METHODS
  // =============================================================================

  createTemplateTheme(sessionTemplate, userProfile) {
    const timeOfDay = this.getTimeOfDay(new Date().getHours());
    
    return {
      name: sessionTemplate.name,
      description: sessionTemplate.description,
      explanation: `Curated based on your love of ${this.mapGenresToNames(userProfile.topGenres).join(' and ')} movies`,
      moodMatch: `Perfect for ${timeOfDay} ${sessionTemplate.moodTags.join(', ')} viewing`,
      watchPrompt: "Each film hand-picked to match your taste profile"
    };
  }

  scoreMoviesAlgorithmically(movies, userProfile) {
    return movies.map(movie => {
      let score = 5.0; // Base score
      
      // Genre matching
      if (movie.genre_ids && userProfile.topGenres) {
        const genreMatches = movie.genre_ids.filter(g => userProfile.topGenres.includes(g)).length;
        score += genreMatches * 0.5;
      }
      
      // Quality bonus
      if (movie.vote_average > 7.0) {
        score += (movie.vote_average - 7.0) * 0.5;
      }
      
      // Popularity bonus
      if (movie.popularity > 50) {
        score += 0.3;
      }
      
      // Recent release bonus
      if (movie.release_date) {
        const year = parseInt(movie.release_date.substring(0, 4));
        if (year >= 2020) score += 0.2;
      }
      
      return {
        ...movie,
        discoveryScore: Math.max(1, Math.min(10, score)),
        scoringMethod: 'algorithmic'
      };
    }).sort((a, b) => b.discoveryScore - a.discoveryScore);
  }

  applyGroqScores(movies, groqScores) {
    return movies.map((movie, index) => {
      const groqScore = groqScores.find(s => s.movieIndex === index + 1);
      
      return {
        ...movie,
        discoveryScore: groqScore?.score || 5.0,
        scoringReason: groqScore?.reason || 'Quality selection',
        scoringMethod: 'groq-enhanced'
      };
    }).sort((a, b) => b.discoveryScore - a.discoveryScore);
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  validateAndFormatTheme(theme) {
    // COMMANDMENT 9: "Handle errors explicitly"
    if (!theme || typeof theme !== 'object') {
      throw new Error('Invalid theme format');
    }

    return {
      name: theme.name || 'Curated Selection',
      description: theme.description || 'Movies picked for you',
      explanation: theme.explanation || 'Based on your preferences',
      moodMatch: theme.moodMatch || 'Perfect for your current mood',
      watchPrompt: theme.watchPrompt || 'Ready to discover something great?'
    };
  }

  getTimeOfDay(hour) {
    if (hour < 6) return 'late night';
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    if (hour < 21) return 'evening';
    return 'night';
  }

  mapGenresToNames(genreIds) {
    const genreMap = {
      28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
      99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History',
      27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance', 878: 'Sci-Fi',
      10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western'
    };
    
    return genreIds.map(id => genreMap[id]).filter(Boolean);
  }
}

export default new DiscoverySessionGenerator();