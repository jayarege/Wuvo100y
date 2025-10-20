import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  Keyboard,
  TouchableWithoutFeedback,
  StyleSheet
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { filterSearchSuggestions } from '../utils/ContentFiltering';
import { TMDB_API_KEY as API_KEY } from '../Constants';

const SearchBar = ({ 
  mediaType = 'movie', 
  colors = {}, 
  searchStyles = {}, 
  seen = [], 
  unseen = [], 
  onSearchComplete = () => {},
  onSuggestionSelect = () => {}
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  
  const timeoutRef = useRef(null);
  const abortControllerRef = useRef(null);
  const justSelectedRef = useRef(false);
  const currentQueryRef = useRef(''); // SECURITY: Track current query to prevent stale updates
  const isMountedRef = useRef(true); // SECURITY: Track component mount state to prevent timing attacks

  // Enhanced predictive search with modern best practices
  const fetchSuggestions = useCallback(async (query) => {
    // SECURITY: Set current query to prevent stale updates
    currentQueryRef.current = query;
    
    if (!query || query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // EDGE CASE: Skip queries that are only punctuation/symbols
    // Include: Latin, Extended Latin, CJK, Arabic, Hebrew, Cyrillic, emoji
    const alphanumericCount = (query.match(/[a-zA-Z0-9\u00C0-\u017F\u0400-\u04FF\u0590-\u05FF\u0600-\u06FF\u4e00-\u9fff\uD800-\uDBFF\uDC00-\uDFFF]/g) || []).length;
    if (alphanumericCount === 0) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // Cancel previous request with proper cleanup
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null; // SECURITY: Prevent memory leaks
    }
    
    // Create new abort controller
    abortControllerRef.current = new AbortController();
    
    // Don't show suggestions if user just selected an item
    if (justSelectedRef.current) {
      return;
    }

    setSuggestionLoading(true);
    
    try {
      // **Use dedicated endpoint for requested media type - CLEAR AND OBVIOUS**
      const endpoint = mediaType === 'tv' ? 'search/tv' : 'search/movie';
      
      const response = await fetch(
        `https://api.themoviedb.org/3/${endpoint}?api_key=${API_KEY}&language=en-US&query=${encodeURIComponent(query)}&page=1&include_adult=false`,
        { signal: abortControllerRef.current.signal }
      );
      
      if (!response.ok) {
        // Handle specific API key issues
        if (response.status === 401) {
          throw new Error(`API key invalid or expired for ${mediaType === 'tv' ? 'TV show' : 'movie'} search`);
        } else if (response.status === 429) {
          throw new Error(`Too many requests - please wait before searching for ${mediaType === 'tv' ? 'TV shows' : 'movies'}`);
        } else {
          throw new Error(`Failed to fetch ${mediaType === 'tv' ? 'TV show' : 'movie'} suggestions (${response.status})`);
        }
      }
      
      const data = await response.json();
      
      if (data.results && Array.isArray(data.results) && data.results.length > 0) {
        // Normalize titles for TV shows (they use 'name' instead of 'title')
        // Add explicit media_type since we know exactly what type we requested
        // DEFENSIVE: Filter out malformed items that could crash the app
        const normalizedResults = data.results
          .filter(item => item && typeof item === 'object' && (item.title || item.name) && item.id)
          .map(item => ({
            // SECURITY: Explicit property allowlist to prevent object injection
            id: typeof item.id === 'number' ? item.id : 0,
            title: item.title || item.name || 'Unknown Title',
            poster_path: typeof item.poster_path === 'string' ? item.poster_path : null,
            release_date: item.release_date || item.first_air_date || null,
            overview: typeof item.overview === 'string' ? item.overview : '',
            genre_ids: Array.isArray(item.genre_ids) ? item.genre_ids : [],
            media_type: mediaType,  // EXPLICIT - we know exactly what we requested
            vote_average: typeof item.vote_average === 'number' ? item.vote_average : null,
            vote_count: typeof item.vote_count === 'number' ? item.vote_count : null,
            backdrop_path: typeof item.backdrop_path === 'string' ? item.backdrop_path : null,
            popularity: typeof item.popularity === 'number' ? item.popularity : 0,
            adult: typeof item.adult === 'boolean' ? item.adult : false,
            original_language: typeof item.original_language === 'string' ? item.original_language : '',
            original_title: typeof item.original_title === 'string' ? item.original_title : ''
          }));
        
        // Use smart filtering for suggestions (stricter)
        const lightlyFiltered = filterSearchSuggestions(normalizedResults);
        
        // SECURITY: Early limit to prevent memory exhaustion attacks
        const limitedResults = lightlyFiltered.slice(0, 20); // Process max 20 items
        
        // Smart ranking algorithm based on search best practices  
        // SECURITY: Keep all results, UI will handle missing posters gracefully
        const rankedResults = limitedResults
          .map(item => {
            const title = (item.title || item.name || '').toLowerCase();
            const queryLower = query.toLowerCase();
            
            // Scoring algorithm (higher = better)
            let score = 0;
            
            // Exact match gets highest score
            if (title === queryLower) score += 1000;
            
            // Starts with query gets high score
            else if (title.startsWith(queryLower)) score += 500;
            
            // Contains query as whole word gets medium score
            else if (title.includes(` ${queryLower} `) || title.includes(`${queryLower} `)) score += 250;
            
            // Contains query anywhere gets lower score
            else if (title.includes(queryLower)) score += 100;
            
            // Popularity boost (logarithmic to avoid dominating)
            const popularityBoost = Math.log10((item.vote_count || 0) + 1) * 10;
            score += popularityBoost;
            
            // Rating boost
            const ratingBoost = (item.vote_average || 0) * 2;
            score += ratingBoost;
            
            // Prefer newer content slightly
            const year = item.release_date || item.first_air_date;
            if (year) {
              const releaseYear = new Date(year).getFullYear();
              const yearBoost = Math.max(0, (releaseYear - 1990) / 10);
              score += yearBoost;
            }
            
            // SECURITY: Explicit property construction to prevent injection
            return {
              id: item.id,
              title: item.title,
              poster_path: item.poster_path,
              release_date: item.release_date,
              overview: item.overview,
              genre_ids: item.genre_ids,
              media_type: item.media_type,
              vote_average: item.vote_average,
              vote_count: item.vote_count,
              backdrop_path: item.backdrop_path,
              popularity: item.popularity,
              adult: item.adult,
              original_language: item.original_language,
              original_title: item.original_title,
              searchScore: score
            };
          })
          .sort((a, b) => b.searchScore - a.searchScore)
          .slice(0, 5); // Show up to 5 suggestions

        // Simple mapping for UI (now includes media_type from multi search)
        const processedResults = rankedResults.map(item => ({
          id: item.id,
          title: item.title || item.name,
          poster_path: item.poster_path,
          vote_average: item.vote_average,
          genre_ids: item.genre_ids || [],
          overview: item.overview || "",
          release_date: item.release_date || item.first_air_date,
          media_type: item.media_type,  // SECURITY: Use validated media_type from allowlist
          alreadyRated: seen.some(sm => sm.id === item.id),
          inWatchlist: unseen.some(um => um.id === item.id),
          currentRating: seen.find(sm => sm.id === item.id)?.userRating,
          searchScore: item.searchScore
        }));
        
        // SECURITY: Only update suggestions if component is still mounted and this is current query
        if (isMountedRef.current && currentQueryRef.current === query) {
          setSuggestions(processedResults);
          setShowSuggestions(true);
        }
      } else {
        // SECURITY: Only clear suggestions if component is mounted and this is current query
        if (isMountedRef.current && currentQueryRef.current === query) {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      }
    } catch (err) {
      // Don't show errors for aborted requests
      if (err.name !== 'AbortError') {
        console.error('Error fetching suggestions:', err);
      }
      // SECURITY: Only clear suggestions if component is mounted and this is current query
      if (isMountedRef.current && currentQueryRef.current === query) {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    } finally {
      setSuggestionLoading(false);
    }
  }, [seen, unseen, mediaType]);

  // Handle search input changes with debouncing
  const handleSearchChange = useCallback((text) => {
    // CRITICAL: Remove zero-width characters AND normalize Unicode
    let cleanText = text.replace(/[\u200B-\u200D\u2060-\u2063\uFEFF]/g, '');
    
    // SECURITY: Normalize Unicode to prevent duplicate requests via NFC/NFD differences
    if (cleanText.normalize) {
      cleanText = cleanText.normalize('NFC');
    }
    
    setSearchQuery(cleanText);
    
    // Reset selection flag when user types
    justSelectedRef.current = false;
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    if (!cleanText || cleanText.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    
    timeoutRef.current = setTimeout(() => {
      fetchSuggestions(cleanText);
    }, 300);
  }, [fetchSuggestions]);

  // Handle selecting a suggestion
  const handleSelectSuggestion = useCallback((suggestion) => {
    // Set flag to prevent dropdown from reappearing
    justSelectedRef.current = true;
    
    setSearchQuery(suggestion.title);
    setShowSuggestions(false);
    setSuggestions([]);
    Keyboard.dismiss();
    
    // Clear any pending suggestion fetches
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    onSuggestionSelect(suggestion);
  }, [onSuggestionSelect]);

  // Get thumbnail poster URL with proper error handling
  const getThumbnailUrl = useCallback(path => {
    if (!path || typeof path !== 'string') {
      return 'https://via.placeholder.com/92x138?text=No+Image';
    }
    
    // SECURITY: Strict validation to prevent malicious URLs
    // TMDB paths must be strings starting with '/' and under 200 chars
    if (!path.startsWith('/') || path.length > 200) {
      console.warn('Invalid TMDB poster path:', path);
      return 'https://via.placeholder.com/92x138?text=Invalid+Image';
    }
    
    // SECURITY: Sanitize path to prevent path traversal attacks
    // Only allow alphanumeric, hyphens, underscores, dots and forward slashes
    const sanitizedPath = path.replace(/[^a-zA-Z0-9\-_.\/]/g, '');
    if (sanitizedPath !== path) {
      console.warn('Sanitized malicious poster path:', path, 'to', sanitizedPath);
      return 'https://via.placeholder.com/92x138?text=Invalid+Image';
    }
    
    // SECURITY: Force small thumbnail size to prevent DoS via large images
    return `https://image.tmdb.org/t/p/w92${sanitizedPath}`;
  }, []);

  // Render a suggestion item
  const renderSuggestionItem = useCallback((suggestion, index) => (
    <TouchableOpacity
      key={suggestion.id.toString()}
      style={[
        styles.suggestionItem,
        { 
          backgroundColor: colors.card,
          borderBottomColor: colors.primary,
          borderBottomWidth: index < suggestions.length - 1 ? 1 : 0,
        },
        index === 0 && { borderTopWidth: 1, borderTopColor: colors.primary }
      ]}
      onPress={() => handleSelectSuggestion(suggestion)}
      activeOpacity={0.7}
    >
      <Image 
        source={{ uri: getThumbnailUrl(suggestion.poster_path) }}
        style={styles.suggestionImage}
        resizeMode="cover"
        onError={() => {
          // SECURITY: Handle image loading failures gracefully
          console.warn('Failed to load poster image for movie:', suggestion.title);
        }}
        defaultSource={{ uri: 'https://via.placeholder.com/92x138?text=No+Image' }}
      />
      
      <View style={styles.suggestionContent}>
        <Text 
          style={[styles.suggestionTitle, { color: colors.text }]}
          numberOfLines={1}
        >
          {suggestion.title}
        </Text>
        
        <View style={styles.suggestionMeta}>
          {suggestion.release_date && (
            <Text style={[styles.suggestionYear, { color: colors.subText }]}>
              {new Date(suggestion.release_date).getFullYear()}
            </Text>
          )}
          
          {suggestion.release_date && suggestion.vote_average != null && suggestion.vote_average > 0 && (
            <Text style={{ color: colors.subText, marginHorizontal: 4 }}>•</Text>
          )}
          
          {suggestion.vote_average != null && typeof suggestion.vote_average === 'number' && suggestion.vote_average > 0 && (
            <View style={styles.suggestionRating}>
              <Ionicons name="star" size={12} color={colors.accent} />
              <Text style={{ color: colors.accent, marginLeft: 2, fontSize: 12 }}>
                {suggestion.vote_average.toFixed(1)}
              </Text>
            </View>
          )}
        </View>
      </View>
      
      {(suggestion.alreadyRated || suggestion.inWatchlist) && (
        <View style={[
          styles.suggestionStatus,
          { backgroundColor: suggestion.alreadyRated ? colors.secondary : colors.accent }
        ]}>
          <Text style={{ 
            color: colors.background,
            fontSize: 12,
            fontWeight: '500'
          }}>
            {suggestion.alreadyRated ? 'Rated' : 'Watchlist'}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  ), [colors, handleSelectSuggestion, getThumbnailUrl, suggestions.length]);

  // Cancel pending requests when mediaType changes
  useEffect(() => {
    // Cancel any pending requests when media type changes
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    // Clear suggestions to prevent wrong content type showing
    setSuggestions([]);
    setShowSuggestions(false);
  }, [mediaType]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // SECURITY: Set unmounted flag FIRST to prevent timing attacks
      isMountedRef.current = false;
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return (
    <View>
      {/* Search Input */}
      <View style={[searchStyles.searchContainer, { backgroundColor: colors.background, borderBottomColor: colors.primary }]}>
        <View style={styles.searchInputContainer}>
          <TextInput
            style={[
              searchStyles.searchInput,
              {
                backgroundColor: colors.card,
                borderColor: colors.primary,
                color: colors.text,
              },
            ]}
            placeholder={`Search for a ${mediaType === 'movie' ? 'movie' : 'TV show'}...`}
            placeholderTextColor={colors.subText}
            value={searchQuery}
            onChangeText={handleSearchChange}
            returnKeyType="search"
            onSubmitEditing={() => onSearchComplete(searchQuery)}
            autoCorrect={false}
            maxLength={100}
          />
          
          {searchQuery.length > 0 && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => {
                setSearchQuery('');
                setSuggestions([]);
                setShowSuggestions(false);
              }}
            >
              <Ionicons 
                name="close-circle" 
                size={20} 
                color={colors.subText} 
              />
            </TouchableOpacity>
          )}
        </View>
        
        <TouchableOpacity
          style={[searchStyles.searchButton, { backgroundColor: colors.primary }]}
          onPress={() => onSearchComplete(searchQuery)}
          disabled={!searchQuery.trim()}
        >
          <Text style={[searchStyles.searchButtonText, { color: colors.text }]}>Search</Text>
        </TouchableOpacity>
      </View>
      
      {/* Suggestions */}
      {showSuggestions && suggestions.length > 0 && (
        <View style={[
          styles.suggestionsWrapper,
          { 
            backgroundColor: colors.card,
            borderColor: colors.primary,
            shadowColor: colors.text,
          }
        ]}>
          {/* SECURITY: Always limit to max 3 rendered suggestions to prevent memory exhaustion */}
          {suggestions.slice(0, 3).map((suggestion, index) => renderSuggestionItem(suggestion, index))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  searchInputContainer: {
    flex: 1,
    position: 'relative',
    marginRight: 10,
  },
  clearButton: {
    position: 'absolute',
    right: 10,
    top: '50%',
    marginTop: -10,
    height: 20,
    width: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  suggestionsWrapper: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  suggestionImage: {
    width: 60,
    height: 90,
    borderRadius: 8,
    marginRight: 12,
  },
  suggestionContent: {
    flex: 1,
    justifyContent: 'center',
  },
  suggestionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  suggestionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  suggestionYear: {
    fontSize: 12,
    fontWeight: '500',
  },
  suggestionRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  suggestionStatus: {
    marginLeft: 8,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
});

export default SearchBar;