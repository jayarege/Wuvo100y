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
  mediaType, 
  colors, 
  searchStyles, 
  seen, 
  unseen, 
  onSearchComplete,
  onSuggestionSelect 
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  
  const timeoutRef = useRef(null);
  const abortControllerRef = useRef(null);
  const justSelectedRef = useRef(false);

  // Enhanced predictive search with modern best practices
  const fetchSuggestions = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new abort controller
    abortControllerRef.current = new AbortController();
    
    // Don't show suggestions if user just selected an item
    if (justSelectedRef.current) {
      return;
    }

    setSuggestionLoading(true);
    
    try {
      const endpoint = mediaType === 'movie' ? 'search/movie' : 'search/tv';
      
      const response = await fetch(
        `https://api.themoviedb.org/3/${endpoint}?api_key=b401be0ea16515055d8d0bde16f80069&language=en-US&query=${encodeURIComponent(query)}&page=1&include_adult=false`,
        { signal: abortControllerRef.current.signal }
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch suggestions');
      }
      
      const data = await response.json();
      
      if (data.results && data.results.length > 0) {
        // Use smart filtering for suggestions (stricter)
        const lightlyFiltered = filterSearchSuggestions(data.results);
        
        // Smart ranking algorithm based on search best practices
        const rankedResults = lightlyFiltered
          .filter(item => item.poster_path != null) // Must have poster
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
            
            return { ...item, searchScore: score };
          })
          .sort((a, b) => b.searchScore - a.searchScore)
          .slice(0, 5); // Show up to 5 suggestions

        // Simple mapping for UI
        const processedResults = rankedResults.map(item => ({
          id: item.id,
          title: item.title || item.name,
          poster_path: item.poster_path,
          vote_average: item.vote_average,
          genre_ids: item.genre_ids || [],
          overview: item.overview || "",
          release_date: item.release_date || item.first_air_date,
          alreadyRated: seen.some(sm => sm.id === item.id),
          inWatchlist: unseen.some(um => um.id === item.id),
          currentRating: seen.find(sm => sm.id === item.id)?.userRating,
          searchScore: item.searchScore
        }));
        
        setSuggestions(processedResults);
        setShowSuggestions(true);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    } catch (err) {
      // Don't show errors for aborted requests
      if (err.name !== 'AbortError') {
        console.error('Error fetching suggestions:', err);
      }
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setSuggestionLoading(false);
    }
  }, [seen, unseen, mediaType]);

  // Handle search input changes with debouncing
  const handleSearchChange = useCallback((text) => {
    setSearchQuery(text);
    
    // Reset selection flag when user types
    justSelectedRef.current = false;
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    if (!text || text.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    
    timeoutRef.current = setTimeout(() => {
      fetchSuggestions(text);
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

  // Get thumbnail poster URL
  const getThumbnailUrl = useCallback(path => {
    if (!path) return 'https://via.placeholder.com/92x138?text=No+Image';
    return `https://image.tmdb.org/t/p/w92${path}`;
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
          
          {suggestion.release_date && suggestion.vote_average > 0 && (
            <Text style={{ color: colors.subText, marginHorizontal: 4 }}>•</Text>
          )}
          
          {suggestion.vote_average > 0 && (
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
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