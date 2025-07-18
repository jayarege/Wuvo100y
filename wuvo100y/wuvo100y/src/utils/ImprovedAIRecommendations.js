import { TMDB_API_KEY, GROQ_API_KEY } from '../Constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

// =============================================================================
// SIMPLIFIED, HIGH-QUALITY RECOMMENDATION ENGINE
// =============================================================================

class ImprovedAIRecommendations {
  constructor() {
    this.cache = new Map();
    this.lastRequestTime = 0;
    this.rateLimitDelay = 250; // Faster requests since we're not using external AI
  }

  // =============================================================================
  // MAIN RECOMMENDATION ENGINE - HYBRID TMDB + GROQ
  // =============================================================================

  async getRecommendations(userMovies, mediaType = 'movie', options = {}) {
    try {
      const {
        count = 20,
        seen = [],
        unseen = [],
        skipped = [],
        useGroq = false
      } = options;

      console.log(`🎯 Getting improved recommendations for ${mediaType}`);

      // Step 1: Analyze user preferences quickly
      const userProfile = this.analyzeUserPreferences(userMovies);
      
      // Step 2: Get base recommendations
      let recommendations;
      if (useGroq && GROQ_API_KEY && userMovies.length >= 5) {
        // Use enhanced Groq for creative, personalized insights
        recommendations = await this.getGroqEnhancedRecommendations(userProfile, mediaType, count);
      } else {
        // Use reliable TMDB native recommendations
        recommendations = await this.getTMDBNativeRecommendations(userProfile, mediaType, count * 2);
      }
      
      // Step 3: Score and rank based on user profile
      const scoredRecommendations = this.scoreRecommendations(recommendations, userProfile);
      
      // Step 4: Filter out seen/skipped content
      const filtered = this.filterContent(scoredRecommendations, seen, unseen, skipped);
      
      // Step 5: Apply diversity rules
      const final = this.ensureDiversity(filtered, userProfile, count);

      console.log(`✅ Generated ${final.length} high-quality recommendations`);
      return final;

    } catch (error) {
      console.error('❌ Improved recommendations error:', error);
      return this.getBasicFallback(userMovies, mediaType);
    }
  }

  // =============================================================================
  // USER PREFERENCE ANALYSIS - SIMPLIFIED
  // =============================================================================

  analyzeUserPreferences(userMovies) {
    const loved = userMovies.filter(m => m.userRating >= 8);
    const liked = userMovies.filter(m => m.userRating >= 6 && m.userRating < 8);
    const disliked = userMovies.filter(m => m.userRating < 5);

    // Genre analysis with weights
    const genreScores = {};
    [...loved, ...liked, ...disliked].forEach(movie => {
      const weight = movie.userRating >= 8 ? 3 : movie.userRating >= 6 ? 1 : -2;
      (movie.genre_ids || []).forEach(genreId => {
        genreScores[genreId] = (genreScores[genreId] || 0) + weight;
      });
    });

    // Quality preference analysis
    const averageUserRating = userMovies.reduce((sum, m) => sum + m.userRating, 0) / userMovies.length;
    const averageTMDBRating = userMovies.reduce((sum, m) => sum + (m.vote_average || 7), 0) / userMovies.length;
    
    // Decade analysis
    const decadeScores = {};
    userMovies.forEach(movie => {
      if (movie.release_date || movie.first_air_date) {
        const year = parseInt((movie.release_date || movie.first_air_date).substring(0, 4));
        const decade = Math.floor(year / 10) * 10;
        const weight = movie.userRating >= 8 ? 2 : movie.userRating >= 6 ? 1 : -1;
        decadeScores[decade] = (decadeScores[decade] || 0) + weight;
      }
    });

    return {
      totalRated: userMovies.length,
      averageUserRating,
      averageTMDBRating,
      topGenres: Object.entries(genreScores)
        .filter(([,score]) => score > 0)
        .sort(([,a], [,b]) => b - a)
        .map(([genreId]) => parseInt(genreId)),
      avoidGenres: Object.entries(genreScores)
        .filter(([,score]) => score < -1)
        .map(([genreId]) => parseInt(genreId)),
      preferredDecades: Object.entries(decadeScores)
        .filter(([,score]) => score > 0)
        .sort(([,a], [,b]) => b - a)
        .map(([decade]) => parseInt(decade)),
      topMovies: loved.slice(0, 5), // Use for similarity searches
      isQualityFocused: averageUserRating > 7.5,
      isGenerousRater: loved.length / userMovies.length > 0.4
    };
  }

  // =============================================================================
  // TMDB NATIVE RECOMMENDATIONS - MULTIPLE STRATEGIES
  // =============================================================================

  async getTMDBNativeRecommendations(userProfile, mediaType, targetCount) {
    const strategies = [
      this.getSimilarMovieRecommendations.bind(this),
      this.getGenreBasedRecommendations.bind(this),
      this.getPopularInGenreRecommendations.bind(this),
      this.getHighRatedRecommendations.bind(this)
    ];

    const results = await Promise.all(
      strategies.map(strategy => strategy(userProfile, mediaType, Math.ceil(targetCount / strategies.length)))
    );

    // Combine and remove duplicates
    const combined = results.flat();
    const uniqueResults = combined.filter((item, index, self) => 
      index === self.findIndex(t => t.id === item.id)
    );

    return uniqueResults.slice(0, targetCount);
  }

  // Strategy 1: Similar to top-rated movies
  async getSimilarMovieRecommendations(userProfile, mediaType, count) {
    const similarPromises = userProfile.topMovies.slice(0, 3).map(async movie => {
      try {
        await this.rateLimit();
        const response = await fetch(
          `https://api.themoviedb.org/3/${mediaType}/${movie.id}/similar?api_key=${TMDB_API_KEY}&page=1`
        );
        const data = await response.json();
        return data.results?.slice(0, Math.ceil(count / 3)) || [];
      } catch (error) {
        console.error('Similar movies error:', error);
        return [];
      }
    });

    const results = await Promise.all(similarPromises);
    return results.flat().map(item => ({
      ...item,
      recommendationReason: 'Similar to your favorites',
      strategyScore: 0.9
    }));
  }

  // Strategy 2: Top content in preferred genres
  async getGenreBasedRecommendations(userProfile, mediaType, count) {
    if (userProfile.topGenres.length === 0) return [];

    try {
      await this.rateLimit();
      const genreId = userProfile.topGenres[0]; // Use top genre
      const response = await fetch(
        `https://api.themoviedb.org/3/discover/${mediaType}?api_key=${TMDB_API_KEY}&with_genres=${genreId}&sort_by=vote_average.desc&vote_count.gte=500&page=1`
      );
      const data = await response.json();
      
      return (data.results?.slice(0, count) || []).map(item => ({
        ...item,
        recommendationReason: `Top-rated in your favorite genres`,
        strategyScore: 0.8
      }));
    } catch (error) {
      console.error('Genre-based recommendations error:', error);
      return [];
    }
  }

  // Strategy 3: Popular in user's preferred genres  
  async getPopularInGenreRecommendations(userProfile, mediaType, count) {
    if (userProfile.topGenres.length < 2) return [];

    try {
      await this.rateLimit();
      const genreIds = userProfile.topGenres.slice(0, 2).join(',');
      const response = await fetch(
        `https://api.themoviedb.org/3/discover/${mediaType}?api_key=${TMDB_API_KEY}&with_genres=${genreIds}&sort_by=popularity.desc&vote_average.gte=6.5&page=1`
      );
      const data = await response.json();
      
      return (data.results?.slice(0, count) || []).map(item => ({
        ...item,
        recommendationReason: 'Popular in your preferred genres',
        strategyScore: 0.7
      }));
    } catch (error) {
      console.error('Popular genre recommendations error:', error);
      return [];
    }
  }

  // Strategy 4: Generally high-rated recent content
  async getHighRatedRecommendations(userProfile, mediaType, count) {
    try {
      await this.rateLimit();
      const currentYear = new Date().getFullYear();
      const response = await fetch(
        `https://api.themoviedb.org/3/discover/${mediaType}?api_key=${TMDB_API_KEY}&sort_by=vote_average.desc&vote_count.gte=1000&primary_release_year=${currentYear - 1}&page=1`
      );
      const data = await response.json();
      
      return (data.results?.slice(0, count) || []).map(item => ({
        ...item,
        recommendationReason: 'Highly rated recent releases',
        strategyScore: 0.6
      }));
    } catch (error) {
      console.error('High-rated recommendations error:', error);
      return [];
    }
  }

  // =============================================================================
  // SCORING AND FILTERING
  // =============================================================================

  scoreRecommendations(recommendations, userProfile) {
    return recommendations.map(item => {
      let score = item.strategyScore || 0.5;

      // Genre matching bonus
      if (item.genre_ids) {
        const genreMatches = item.genre_ids.filter(g => userProfile.topGenres.includes(g)).length;
        const genrePenalties = item.genre_ids.filter(g => userProfile.avoidGenres.includes(g)).length;
        score += (genreMatches * 0.1) - (genrePenalties * 0.2);
      }

      // Quality alignment
      if (item.vote_average) {
        const qualityDiff = Math.abs(item.vote_average - userProfile.averageTMDBRating);
        score += Math.max(0, 1 - (qualityDiff / 5)) * 0.1;
      }

      // Vote count reliability
      if (item.vote_count > 100) {
        score += Math.min(item.vote_count / 1000, 0.1);
      }

      // Recent content slight boost
      if (item.release_date || item.first_air_date) {
        const year = parseInt((item.release_date || item.first_air_date).substring(0, 4));
        if (year >= 2020) score += 0.05;
      }

      return {
        ...item,
        personalizedScore: Math.max(0, Math.min(1, score)),
        title: item.title || item.name,
        mediaType: item.mediaType || mediaType
      };
    });
  }

  filterContent(recommendations, seen, unseen, skipped) {
    return recommendations.filter(rec => 
      !seen.some(s => s.id === rec.id) &&
      !unseen.some(u => u.id === rec.id) &&
      !skipped.includes(rec.id) &&
      rec.poster_path && // Must have poster
      rec.vote_count > 50 // Minimum credibility
    );
  }

  ensureDiversity(recommendations, userProfile, targetCount) {
    const result = [];
    const genresUsed = {};
    const maxPerGenre = Math.ceil(targetCount / 5); // Max 5 different genres

    // Sort by personalized score first
    const sorted = recommendations.sort((a, b) => b.personalizedScore - a.personalizedScore);

    for (const item of sorted) {
      if (result.length >= targetCount) break;

      // Check genre diversity
      const itemGenres = item.genre_ids || [];
      const genreOveruse = itemGenres.some(genre => (genresUsed[genre] || 0) >= maxPerGenre);

      if (!genreOveruse) {
        result.push(item);
        itemGenres.forEach(genre => {
          genresUsed[genre] = (genresUsed[genre] || 0) + 1;
        });
      }
    }

    // Fill remaining spots if needed
    if (result.length < targetCount) {
      const remaining = sorted.filter(item => !result.includes(item));
      result.push(...remaining.slice(0, targetCount - result.length));
    }

    return result;
  }

  // =============================================================================
  // GROQ ENHANCED RECOMMENDATIONS - CODE_BIBLE COMPLIANT
  // =============================================================================

  async getGroqEnhancedRecommendations(userProfile, mediaType, count) {
    try {
      // COMMANDMENT 2: Never assume - comprehensive input validation
      if (!this.validateGroqInputs(userProfile, mediaType, count)) {
        console.log('⚠️ Groq requirements not met, falling back to TMDB');
        return await this.getTMDBNativeRecommendations(userProfile, mediaType, count);
      }

      // COMMANDMENT 3: Clear and obvious - structured approach with timeout
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Groq enhancement timeout')), 15000)
      );
      
      const groqPromise = this.executeGroqWorkflow(userProfile, mediaType, count);
      
      // Race between Groq enhancement and timeout
      const result = await Promise.race([groqPromise, timeoutPromise]);
      
      // COMMANDMENT 4: Brutally honest - calculate actual quality score
      if (result && result.length > 0) {
        return this.scoreGroqResults(result, userProfile);
      }
      
      // Graceful fallback
      console.log('🔄 Groq enhancement incomplete, using TMDB fallback');
      return await this.getTMDBNativeRecommendations(userProfile, mediaType, count);

    } catch (error) {
      console.error('❌ Groq enhancement failed:', error.message);
      return await this.getTMDBNativeRecommendations(userProfile, mediaType, count);
    }
  }

  // COMMANDMENT 2: Never assume - validate all inputs thoroughly
  validateGroqInputs(userProfile, mediaType, count) {
    if (!GROQ_API_KEY || typeof GROQ_API_KEY !== 'string' || GROQ_API_KEY.length < 10) {
      return false;
    }
    
    if (!userProfile || typeof userProfile !== 'object') {
      return false;
    }
    
    if (!Array.isArray(userProfile.topMovies) || userProfile.topMovies.length === 0) {
      return false;
    }
    
    // Validate topMovies structure
    const hasValidMovies = userProfile.topMovies.every(movie => 
      movie && typeof movie === 'object' && 
      (movie.title || movie.name) &&
      typeof movie.userRating === 'number'
    );
    
    if (!hasValidMovies) {
      return false;
    }
    
    if (!['movie', 'tv'].includes(mediaType)) {
      return false;
    }
    
    if (!Number.isInteger(count) || count < 1 || count > 50) {
      return false;
    }
    
    return true;
  }

  // COMMANDMENT 3: Clear workflow execution
  async executeGroqWorkflow(userProfile, mediaType, count) {
    const groqPrompt = this.buildCodeBibleCompliantPrompt(userProfile, mediaType);
    const groqResponse = await this.callGroqAPI(groqPrompt);
    
    if (!groqResponse?.recommendations || !Array.isArray(groqResponse.recommendations)) {
      return null;
    }
    
    // COMMANDMENT 9: Handle validation with circuit breaker
    const validatedRecommendations = await this.validateGroqSuggestionsWithCircuitBreaker(
      groqResponse.recommendations, 
      mediaType
    );
    
    return this.sanitizeGroqResults(validatedRecommendations, groqResponse);
  }

  // COMMANDMENT 4: Brutally honest scoring based on actual match quality
  scoreGroqResults(results, userProfile) {
    return results.map(item => {
      // Calculate honest score based on user preference alignment
      let actualScore = 0.6; // Base Groq score
      
      // Genre alignment bonus
      if (item.genre_ids && userProfile.topGenres) {
        const genreMatches = item.genre_ids.filter(g => 
          userProfile.topGenres.includes(g)
        ).length;
        actualScore += genreMatches * 0.05;
      }
      
      // Quality alignment
      if (item.vote_average && userProfile.averageTMDBRating) {
        const qualityDiff = Math.abs(item.vote_average - userProfile.averageTMDBRating);
        actualScore += Math.max(0, (2 - qualityDiff) * 0.1);
      }
      
      // Vote count reliability
      if (item.vote_count > 1000) {
        actualScore += 0.05;
      }
      
      return {
        ...item,
        recommendationReason: `AI-enhanced: ${item.groqReason || 'Personalized match'}`,
        strategyScore: Math.min(0.95, Math.max(0.6, actualScore)), // Honest scoring
        groqEnhanced: true
      };
    });
  }

  // COMMANDMENT 7: Document the WHY - Groq prompt engineering
  buildCodeBibleCompliantPrompt(userProfile, mediaType) {
    // Devil's advocate: Previous AI was hallucinating, so we must constrain Groq
    // to only suggest real, verifiable content with specific TMDB criteria
    
    // COMMANDMENT 2: Never assume - validate topMovies exists
    const safeTopMovies = userProfile.topMovies || [];
    const topMoviesTitles = safeTopMovies.length > 0 
      ? safeTopMovies
          .slice(0, 3)
          .map(m => `"${m.title || m.name}" (${(m.release_date || m.first_air_date || '').substring(0, 4)})`)
          .join(', ')
      : 'No highly rated movies yet';

    const genreNames = this.mapGenreIdsToNames((userProfile.topGenres || []).slice(0, 3));
    const avoidGenreNames = this.mapGenreIdsToNames(userProfile.avoidGenres || []);

    return `You are a movie recommendation specialist. Based on this user's viewing profile, suggest 10 specific ${mediaType}s.

USER PROFILE:
- Highly rated favorites: ${topMoviesTitles}
- Preferred genres: ${genreNames.length > 0 ? genreNames.join(', ') : 'All genres'}
- Avoid genres: ${avoidGenreNames.length > 0 ? avoidGenreNames.join(', ') : 'None'}
- Average rating given: ${(userProfile.averageUserRating || 5.5).toFixed(1)}/10
- Quality focused: ${userProfile.isQualityFocused ? 'Yes' : 'No'}

STRICT REQUIREMENTS:
1. Only suggest real ${mediaType}s that exist on TMDB
2. Include exact title and release year for each
3. Prioritize ${mediaType}s from 2015-2024 with 500+ votes
4. Avoid obscure or unverifiable content
5. Match the user's quality standards (avg rating ${(userProfile.averageTMDBRating || 7.0).toFixed(1)}/10)

Format response as JSON:
{
  "recommendations": [
    {"title": "Exact Title", "year": 2023, "reason": "brief explanation"},
    ...
  ],
  "reasoning": "Overall strategy explanation"
}

Focus on mainstream, critically acclaimed ${mediaType}s that align with their taste profile.`;
  }

  async callGroqAPI(prompt) {
    // COMMANDMENT 9: Handle errors explicitly with comprehensive error handling
    const maxRetries = 2;
    let attempt = 0;
    
    while (attempt < maxRetries) {
      try {
        await this.rateLimit();
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // Shorter timeout
        
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${GROQ_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'llama-3.1-70b-versatile',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
            max_tokens: 1200, // Reduced for faster response
            response_format: { type: 'json_object' }
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        // COMMANDMENT 9: Explicit rate limit handling
        if (response.status === 429) {
          console.log(`⏳ Groq rate limited (attempt ${attempt + 1}/${maxRetries})`);
          if (attempt < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, 3000 * (attempt + 1))); // Exponential backoff
            attempt++;
            continue;
          }
          throw new Error('Rate limit exceeded after retries');
        }

        if (!response.ok) {
          throw new Error(`Groq API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        
        if (!content || typeof content !== 'string') {
          throw new Error('Invalid or empty Groq response content');
        }

        // COMMANDMENT 9: Robust JSON parsing with schema validation
        const parsedResponse = this.parseAndValidateGroqResponse(content);
        if (!parsedResponse) {
          throw new Error('Failed to parse or validate Groq response');
        }
        
        return parsedResponse;

      } catch (error) {
        if (error.name === 'AbortError') {
          console.error(`Groq API timeout (attempt ${attempt + 1}/${maxRetries})`);
        } else {
          console.error(`Groq API failed (attempt ${attempt + 1}/${maxRetries}):`, error.message);
        }
        
        if (attempt >= maxRetries - 1) {
          throw error;
        }
        
        attempt++;
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Progressive delay
      }
    }
    
    return null;
  }

  // COMMANDMENT 4: Brutally honest response validation
  parseAndValidateGroqResponse(content) {
    try {
      const parsed = JSON.parse(content);
      
      // Validate structure
      if (!parsed || typeof parsed !== 'object') {
        return null;
      }
      
      if (!Array.isArray(parsed.recommendations)) {
        return null;
      }
      
      // Validate each recommendation
      const validRecommendations = parsed.recommendations.filter(rec => 
        rec && 
        typeof rec === 'object' &&
        typeof rec.title === 'string' &&
        rec.title.length > 0 &&
        (!rec.year || (Number.isInteger(rec.year) && rec.year > 1900 && rec.year <= new Date().getFullYear() + 2))
      );
      
      if (validRecommendations.length === 0) {
        return null;
      }
      
      return {
        recommendations: validRecommendations,
        reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : 'AI analysis'
      };
      
    } catch (parseError) {
      console.error('JSON parse error:', parseError.message);
      return null;
    }
  }

  // COMMANDMENT 9: Circuit breaker pattern for validation
  async validateGroqSuggestionsWithCircuitBreaker(suggestions, mediaType) {
    const validated = [];
    const maxValidationTime = 10000; // 10 second total limit
    const maxConcurrentValidations = 3;
    const startTime = Date.now();
    
    // Process in smaller batches with concurrency control
    const suggestionBatches = this.createBatches(suggestions.slice(0, 12), maxConcurrentValidations);
    
    for (const batch of suggestionBatches) {
      // Check time limit
      if (Date.now() - startTime > maxValidationTime) {
        console.log('⏱️ Validation time limit reached, returning partial results');
        break;
      }
      
      // Process batch concurrently
      const batchPromises = batch.map(suggestion => 
        this.validateSingleSuggestion(suggestion, mediaType)
      );
      
      try {
        const batchResults = await Promise.allSettled(batchPromises);
        
        batchResults.forEach(result => {
          if (result.status === 'fulfilled' && result.value) {
            validated.push(result.value);
          }
        });
        
        // Stop when we have enough good results
        if (validated.length >= 8) {
          break;
        }
        
      } catch (error) {
        console.error('Batch validation failed:', error.message);
        continue;
      }
    }
    
    return validated;
  }

  // COMMANDMENT 3: Clear and obvious single validation
  async validateSingleSuggestion(suggestion, mediaType) {
    try {
      await this.rateLimit();
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second per validation
      
      const searchQuery = encodeURIComponent(`${suggestion.title} ${suggestion.year || ''}`);
      const searchResponse = await fetch(
        `https://api.themoviedb.org/3/search/${mediaType}?api_key=${TMDB_API_KEY}&query=${searchQuery}&include_adult=false`,
        { signal: controller.signal }
      );
      
      clearTimeout(timeoutId);
      
      if (!searchResponse.ok) {
        return null;
      }
      
      const searchData = await searchResponse.json();
      const match = searchData.results?.[0];
      
      // COMMANDMENT 4: Brutally honest validation criteria
      if (!this.isValidTMDBMatch(match, suggestion)) {
        return null;
      }
      
      return this.sanitizeTMDBResult(match, suggestion);
      
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error(`Validation failed for "${suggestion.title}":`, error.message);
      }
      return null;
    }
  }

  // COMMANDMENT 4: Honest validation criteria
  isValidTMDBMatch(match, suggestion) {
    if (!match || !match.poster_path) {
      return false;
    }
    
    if (match.vote_count < 50) {
      return false;
    }
    
    // Basic title similarity check
    const tmdbTitle = (match.title || match.name || '').toLowerCase();
    const groqTitle = (suggestion.title || '').toLowerCase();
    
    if (tmdbTitle.length === 0 || groqTitle.length === 0) {
      return false;
    }
    
    // Allow for minor differences in titles
    const similarity = this.calculateStringSimilarity(tmdbTitle, groqTitle);
    return similarity > 0.7; // 70% similarity threshold
  }

  // COMMANDMENT 10: Sanitize external data before merging
  sanitizeTMDBResult(match, suggestion) {
    const sanitizedResult = {
      id: match.id,
      title: match.title || match.name,
      poster_path: match.poster_path,
      backdrop_path: match.backdrop_path,
      overview: match.overview,
      release_date: match.release_date || match.first_air_date,
      vote_average: match.vote_average,
      vote_count: match.vote_count,
      genre_ids: Array.isArray(match.genre_ids) ? match.genre_ids : [],
      popularity: match.popularity,
      adult: match.adult || false
    };
    
    // Add Groq insight safely
    if (suggestion.reason && typeof suggestion.reason === 'string') {
      sanitizedResult.groqReason = suggestion.reason.substring(0, 200); // Limit length
    }
    
    return sanitizedResult;
  }

  // COMMANDMENT 3: Clear utility functions
  createBatches(array, batchSize) {
    const batches = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }

  calculateStringSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  // COMMANDMENT 10: Sanitize all external data
  sanitizeGroqResults(validatedRecommendations, groqResponse) {
    return validatedRecommendations.map(item => ({
      ...item,
      mediaType: item.mediaType || (item.first_air_date ? 'tv' : 'movie'),
      // Ensure no malicious data injection
      groqReasoning: typeof groqResponse?.reasoning === 'string' 
        ? groqResponse.reasoning.substring(0, 500) 
        : null
    }));
  }

  mapGenreIdsToNames(genreIds) {
    // COMMANDMENT 2: Never assume - validate input
    if (!Array.isArray(genreIds)) return [];
    
    const genreMap = {
      28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
      99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History',
      27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance', 878: 'Sci-Fi',
      10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western'
    };
    
    // COMMANDMENT 4: Brutally honest - only return known genres
    return genreIds
      .map(id => genreMap[id])
      .filter(Boolean); // Remove unknown genres instead of showing Genre${id}
  }

  // =============================================================================
  // UTILITIES
  // =============================================================================

  async rateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.rateLimitDelay) {
      await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay - timeSinceLastRequest));
    }
    this.lastRequestTime = Date.now();
  }

  async getBasicFallback(userMovies, mediaType) {
    console.log('🔄 Using basic fallback');
    const topMovie = userMovies
      .filter(m => m.userRating >= 7)
      .sort((a, b) => b.userRating - a.userRating)[0];

    if (topMovie) {
      try {
        const response = await fetch(
          `https://api.themoviedb.org/3/${mediaType}/${topMovie.id}/similar?api_key=${TMDB_API_KEY}`
        );
        const data = await response.json();
        return (data.results || []).slice(0, 10).map(item => ({
          ...item,
          title: item.title || item.name,
          mediaType,
          recommendationReason: 'Basic similarity'
        }));
      } catch {
        return [];
      }
    }
    return [];
  }

  clearCache() {
    this.cache.clear();
  }
}

// =============================================================================
// EXPORT INTERFACE
// =============================================================================

export const improvedAIRecommendations = new ImprovedAIRecommendations();

export const getImprovedRecommendations = async (userMovies, mediaType = 'movie', options = {}) => {
  // Require minimum data
  if (userMovies.length < 3) {
    console.log('📊 Need at least 3 rated items for quality recommendations');
    return [];
  }

  return await improvedAIRecommendations.getRecommendations(userMovies, mediaType, options);
};

export default improvedAIRecommendations;