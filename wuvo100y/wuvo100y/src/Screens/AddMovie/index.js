import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  ScrollView,
  Keyboard,
  Modal,
  Alert,
  Dimensions,
  Animated,
  TouchableWithoutFeedback
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Import theme system and styles
import { useMediaType } from '../../Navigation/TabNavigator';
import { getLayoutStyles } from '../../Styles/layoutStyles';
import { getHeaderStyles, ThemedHeader } from '../../Styles/headerStyles';
import { getSearchStyles } from '../../Styles/searchStyles';
import { getMovieCardStyles } from '../../Styles/movieCardStyles';
import { getButtonStyles, ThemedButton } from '../../Styles/buttonStyles';
import { getModalStyles } from '../../Styles/modalStyles';
import { RatingModal } from '../../Components/RatingModal';
import stateStyles from '../../Styles/StateStyles';
import theme from '../../utils/Theme';

import { TMDB_API_KEY as API_KEY } from '../../Constants';

// Smart content filtering functions based on industry standards
const isObfuscatedAdultContent = (text) => {
  if (!text) return false;
  const lower = text.toLowerCase();
  
  // Obfuscation patterns for adult terms
  const obfuscationPatterns = [
    /c[\*\-\_0o]{1,4}[ck]/gi,     // c*ck, c--k, c0ck variants
    /p[\*\-\_0o]{1,4}rn/gi,       // p*rn, p--rn, p0rn variants
    /d[\*\-\_1i]{1,4}[ck]/gi,     // d*ck, d--k, d1ck variants
    /f[\*\-\_]{1,4}ck/gi,         // f*ck, f--k variants
    /[\*\-\_]{3,}/g,              // 3+ consecutive censorship chars
    /\b(cock|dick|penis)\b/gi,    // Explicit anatomy terms
    /\b(pussy|vagina|cunt)\b/gi,  // Female anatomy terms
    /\b(tits|boobs|breasts)\b/gi, // Chest terms
  ];
  
  return obfuscationPatterns.some(pattern => pattern.test(lower));
};

const hasSuspiciousAdultStructure = (title) => {
  if (!title) return false;
  const lower = title.toLowerCase();
  
  // Suspicious title patterns common in adult content
  const suspiciousPatterns = [
    // "My/The [size] [anatomy]" patterns
    /\b(my|the|a)\s+(massive|huge|big|enormous|giant|thick)\s+(cock|dick|penis)/gi,
    /\b(my|the|a)\s+(tight|wet|hot)\s+(pussy|vagina)/gi,
    /\b(my|the|a)\s+(big|huge|massive)\s+(tits|boobs|breasts)/gi,
    
    // Size + anatomy combinations anywhere
    /\b(massive|huge|big|enormous|giant|thick)\s+(cock|dick|penis)/gi,
    /\b(tight|wet|hot|horny)\s+(pussy|vagina)/gi,
    
    // Action + anatomy patterns
    /\b(fucking|sucking|riding|mounting)\s+(my|your|his|her)\s+(cock|dick|pussy)/gi,
    /\b(blowjob|handjob|rimjob|footjob)/gi,
    
    // Adult film title patterns
    /\b(barely|just)\s+(legal|18)/gi,
    /\b(teen|young)\s+(slut|whore|bitch)/gi,
    /\b(milf|gilf|cougar)\b/gi,
    /\b(gangbang|threesome|orgy)/gi,
  ];
  
  return suspiciousPatterns.some(pattern => pattern.test(lower));
};

const hasObviousAdultTerms = (title, overview = '') => {
  if (!title) return false;
  const allText = `${title} ${overview}`.toLowerCase();
  
  // Very obvious adult terms that should always be filtered
  const obviousTerms = [
    'xxx', 'porn', 'pornographic', 'erotic', 'sexual', 'nude', 'naked',
    'hardcore', 'softcore', 'adult film', 'sex tape', 'sex scene',
    'masturbation', 'orgasm', 'cumshot', 'facial', 'anal', 'oral',
    'bdsm', 'fetish', 'kinky', 'strip', 'stripper', 'escort', 'prostitute'
  ];
  
  return obviousTerms.some(term => allText.includes(term));
};

// Whitelist for major studios/franchises that should never be filtered
const trustedSources = [
  'disney', 'pixar', 'marvel', 'lucasfilm', 'warner bros', 'universal',
  'paramount', 'sony pictures', 'columbia', 'dreamworks', 'netflix',
  'hbo', 'amc', 'fx', 'bbc', 'cbs', 'nbc', 'abc', 'fox'
];

const isTrustedContent = (item) => {
  // High vote count usually indicates legitimate content
  if (item.vote_count && item.vote_count > 1000) return true;
  
  // Check production companies
  if (item.production_companies && Array.isArray(item.production_companies)) {
    const hasTrustedStudio = item.production_companies.some(company => 
      trustedSources.some(trusted => 
        (company.name || '').toLowerCase().includes(trusted)
      )
    );
    if (hasTrustedStudio) return true;
  }
  
  return false;
};

// Strict filtering for search suggestions (higher bar)
const filterSearchSuggestions = (items) => {
  return items.filter(item => {
    // Always block explicitly marked adult content
    if (item.adult === true) return false;
    
    // Allow trusted content even if it might trigger some patterns
    if (isTrustedContent(item)) return true;
    
    const title = item.title || item.name || '';
    const overview = item.overview || '';
    
    // Block obvious adult terms
    if (hasObviousAdultTerms(title, overview)) return false;
    
    // Block obfuscated content
    if (isObfuscatedAdultContent(title)) return false;
    
    // Block suspicious title structures
    if (hasSuspiciousAdultStructure(title)) return false;
    
    return true;
  });
};

// Moderate filtering for full search results (more permissive)
const filterFullSearchResults = (items) => {
  return items.filter(item => {
    // Always block explicitly marked adult content
    if (item.adult === true) return false;
    
    // Allow trusted content
    if (isTrustedContent(item)) return true;
    
    const title = item.title || item.name || '';
    const overview = item.overview || '';
    
    // Block obvious adult terms
    if (hasObviousAdultTerms(title, overview)) return false;
    
    // Block obfuscated content (stricter check)
    if (isObfuscatedAdultContent(title)) return false;
    
    // For full search, only block the most obvious suspicious patterns
    const veryObviousPatterns = [
      /\b(my|the)\s+(massive|huge|enormous)\s+(cock|dick)/gi,
      /\b(gangbang|threesome|orgy)/gi,
      /\bxxx\b/gi,
    ];
    
    const hasVeryObviousPattern = veryObviousPatterns.some(pattern => 
      pattern.test(title.toLowerCase())
    );
    
    if (hasVeryObviousPattern) return false;
    
    return true;
  });
};

function AddMovieScreen({ seen, unseen, onAddToSeen, onAddToUnseen, onRemoveFromWatchlist, onUpdateRating, genres, isDarkMode }) {
  // Use media type context
  const { mediaType } = useMediaType();
  
  // Get all themed styles
  const headerStyles = getHeaderStyles(mediaType, isDarkMode ? 'dark' : 'light', theme);
  const searchStyles = getSearchStyles(mediaType, isDarkMode ? 'dark' : 'light', theme);
  const movieCardStyles = getMovieCardStyles(mediaType, isDarkMode ? 'dark' : 'light', theme);
  const buttonStyles = getButtonStyles(mediaType, isDarkMode ? 'dark' : 'light', theme);

  // Get theme colors for this media type and mode
  const colors = theme[mediaType][isDarkMode ? 'dark' : 'light'];

  // State variables
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Rating modal state
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [ratingInput, setRatingInput] = useState('');
  
  // Animation refs
  const slideAnim = useRef(new Animated.Value(300)).current;
  const timeoutRef = useRef(null);
  const abortControllerRef = useRef(null);
  const justSelectedRef = useRef(false);

  // Clear search when media type changes
  useEffect(() => {
    setSearchQuery('');
    setSearchResults([]);
    setSuggestions([]);
    setShowSuggestions(false);
    setError(null);
  }, [mediaType]);

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
      // Use TV search for "breaking" since Breaking Bad is a TV show
      const endpoint = mediaType === 'movie' ? 'search/movie' : 'search/tv';
      
      console.log(`🔍 Searching ${endpoint} for: "${query}"`);
      
      const response = await fetch(
        `https://api.themoviedb.org/3/${endpoint}?api_key=${API_KEY}&language=en-US&query=${encodeURIComponent(query)}&page=1&include_adult=false`,
        { signal: abortControllerRef.current.signal }
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch suggestions');
      }
      
      const data = await response.json();
      console.log(`📺 Raw API results:`, data.results?.length || 0);
      console.log(`📺 First few results:`, data.results?.slice(0, 3).map(r => r.title || r.name) || []);
      
      if (data.results && data.results.length > 0) {
        // Use smart filtering for suggestions (stricter)
        const lightlyFiltered = filterSearchSuggestions(data.results);
        
        console.log(`🧹 After smart suggestion filtering:`, lightlyFiltered.length);
        
        // Log any filtered items for debugging
        const filteredOut = data.results.filter(item => !lightlyFiltered.includes(item));
        if (filteredOut.length > 0) {
          console.log(`🚫 Filtered out from suggestions:`, filteredOut.map(item => item.title || item.name));
        }
        
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
        
        console.log(`🎯 Top ranked results:`, rankedResults.map(r => `${r.title || r.name} (${r.searchScore.toFixed(1)})`));

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
        console.log(`❌ No results found for "${query}"`);
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

  // Enhanced full search with intelligent ranking
  const handleFullSearch = useCallback(async (query = searchQuery) => {
    if (!query || query.trim().length === 0) return;
    
    setLoading(true);
    setError(null);
    setShowSuggestions(false);
    
    try {
      const endpoint = mediaType === 'movie' ? 'search/movie' : 'search/tv';
      
      console.log(`🔍 Full search ${endpoint} for: "${query}"`);
      
      const response = await fetch(
        `https://api.themoviedb.org/3/${endpoint}?api_key=${API_KEY}&language=en-US&query=${encodeURIComponent(query)}&page=1&include_adult=false`
      );
      
      if (!response.ok) {
        throw new Error(`Failed to search for ${mediaType === 'movie' ? 'movies' : 'TV shows'}`);
      }
      
      const data = await response.json();
      console.log(`📺 Full search raw results:`, data.results?.length || 0);
      
      if (data.results && data.results.length > 0) {
        // Use moderate filtering for full search (more permissive)
        const lightlyFiltered = filterFullSearchResults(data.results);
        
        console.log(`🧹 Full search after smart filtering:`, lightlyFiltered.length);
        
        // Log any filtered items for debugging
        const filteredOut = data.results.filter(item => !lightlyFiltered.includes(item));
        if (filteredOut.length > 0) {
          console.log(`🚫 Filtered out from full search:`, filteredOut.map(item => item.title || item.name));
        }
        
        const seenIds = new Set();
        
        const processedResults = lightlyFiltered
          .filter(item => {
            if (!item.poster_path) return false;
            if (seenIds.has(item.id)) return false;
            seenIds.add(item.id);
            return true;
          })
          .map(item => {
            const title = (item.title || item.name || '').toLowerCase();
            const queryLower = query.toLowerCase();
            
            // Same scoring algorithm as suggestions but for full results
            let score = 0;
            
            if (title === queryLower) score += 1000;
            else if (title.startsWith(queryLower)) score += 500;
            else if (title.includes(` ${queryLower} `) || title.includes(`${queryLower} `)) score += 250;
            else if (title.includes(queryLower)) score += 100;
            
            const popularityBoost = Math.log10((item.vote_count || 0) + 1) * 10;
            score += popularityBoost;
            
            const ratingBoost = (item.vote_average || 0) * 2;
            score += ratingBoost;
            
            const year = item.release_date || item.first_air_date;
            if (year) {
              const releaseYear = new Date(year).getFullYear();
              const yearBoost = Math.max(0, (releaseYear - 1990) / 10);
              score += yearBoost;
            }
            
            return {
              id: item.id,
              title: item.title || item.name,
              poster_path: item.poster_path,
              vote_average: item.vote_average,
              vote_count: item.vote_count || 0,
              overview: item.overview || "No overview available",
              release_date: item.release_date || item.first_air_date || 'Unknown',
              genre_ids: item.genre_ids || [],
              alreadyRated: seen.some(sm => sm.id === item.id),
              inWatchlist: unseen.some(um => um.id === item.id),
              currentRating: seen.find(sm => sm.id === item.id)?.userRating,
              searchScore: score
            };
          })
          .sort((a, b) => b.searchScore - a.searchScore);
        
        console.log(`🎯 Full search top results:`, processedResults.slice(0, 5).map(r => `${r.title} (${r.searchScore.toFixed(1)})`));
        
        setSearchResults(processedResults);
      } else {
        console.log(`❌ No full search results for "${query}"`);
        setSearchResults([]);
      }
    } catch (err) {
      console.error('Error searching:', err);
      setError(`Failed to search for ${mediaType === 'movie' ? 'movies' : 'TV shows'}. Please try again.`);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, seen, unseen, mediaType]);

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
    
    handleFullSearch(suggestion.title);
  }, [handleFullSearch]);

  // Open rating modal
  const openRatingModal = useCallback((item) => {
    setSelectedMovie(item);
    setRatingInput(item.alreadyRated ? item.currentRating.toString() : '');
    setRatingModalVisible(true);
    
    // Start slide animation
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [slideAnim]);

  // Close rating modal
  const closeRatingModal = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: 300,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setRatingModalVisible(false);
      setSelectedMovie(null);
      setRatingInput('');
    });
  }, [slideAnim]);

  // Handle rating submission
  const handleRateMovie = useCallback(() => {
    if (!selectedMovie) return;
    
    let rating = parseFloat(ratingInput);
    
    if (isNaN(rating) || rating < 1 || rating > 10) {
      Alert.alert(
        "Invalid Rating",
        "Please enter a valid rating between 1.0 and 10.0",
        [{ text: "OK" }]
      );
      return;
    }
    
    rating = Math.round(rating * 10) / 10;
    
    const isUpdate = seen.some(item => item.id === selectedMovie.id);
    
    if (isUpdate) {
      console.log(`📱 ADD ${mediaType.toUpperCase()}: Updating ${selectedMovie.title} via central store`);
      onUpdateRating(selectedMovie.id, rating);
    } else {
      console.log(`📱 ADD ${mediaType.toUpperCase()}: Adding new ${mediaType} ${selectedMovie.title} via central store`);
      const newItem = {
        ...selectedMovie,
        userRating: rating,
        eloRating: rating * 10,
        comparisonHistory: [],
        comparisonWins: 0,
        mediaType: mediaType,
      };
      
      onAddToSeen(newItem);
      
      if (unseen.some(item => item.id === selectedMovie.id)) {
        onRemoveFromWatchlist(selectedMovie.id);
      }
    }
    
    // Update local results for immediate UI feedback
    setSearchResults(prev => 
      prev.map(m => 
        m.id === selectedMovie.id 
          ? { ...m, alreadyRated: true, currentRating: rating, inWatchlist: false } 
          : m
      )
    );
    
    closeRatingModal();
  }, [selectedMovie, ratingInput, onAddToSeen, onUpdateRating, onRemoveFromWatchlist, seen, unseen, mediaType, closeRatingModal]);

  // Add item to watchlist
  const addToUnseen = useCallback((item) => {
    if (seen.some(m => m.id === item.id)) {
      return;
    }
    
    if (item.inWatchlist) {
      console.log(`📱 ADD ${mediaType.toUpperCase()}: Removing ${item.title} from watchlist via central store`);
      onRemoveFromWatchlist(item.id);
      
      setSearchResults(prev => 
        prev.map(m => 
          m.id === item.id 
            ? { ...m, inWatchlist: false } 
            : m
        )
      );
      return;
    }
    
    console.log(`📱 ADD ${mediaType.toUpperCase()}: Adding ${item.title} to watchlist via central store`);
    const itemWithMediaType = {
      ...item,
      mediaType: mediaType
    };
    onAddToUnseen(itemWithMediaType);
    
    setSearchResults(prev => 
      prev.map(m => 
        m.id === item.id 
          ? { ...m, inWatchlist: true } 
          : m
      )
    );
  }, [onAddToUnseen, onRemoveFromWatchlist, seen, unseen, mediaType]);

  // Get poster URL
  const getPosterUrl = useCallback(path => {
    if (!path) return 'https://via.placeholder.com/342x513?text=No+Poster';
    return `https://image.tmdb.org/t/p/w342${path}`;
  }, []);

  // Get thumbnail poster URL
  const getThumbnailUrl = useCallback(path => {
    if (!path) return 'https://via.placeholder.com/92x138?text=No+Image';
    return `https://image.tmdb.org/t/p/w92${path}`;
  }, []);

  // Render an item (movie or TV show)
  const renderMovieItem = useCallback(({ item }) => (
    <View style={[movieCardStyles.movieCard, { backgroundColor: colors.card }]}>
      <Image
        source={{ uri: getPosterUrl(item.poster_path) }}
        style={styles.moviePoster}
        resizeMode="cover"
      />
      <View style={movieCardStyles.movieInfo}>
        <Text
          style={[movieCardStyles.movieTitle, { color: colors.text }]}
          numberOfLines={2}
        >
          {item.title}
        </Text>
        <Text style={[movieCardStyles.releaseDate, { color: colors.subText }]}>
          {item.release_date ? new Date(item.release_date).getFullYear() : 'Unknown'}
        </Text>
        <Text
          style={[movieCardStyles.movieOverview, { color: colors.text }]}
          numberOfLines={3}
        >
          {item.overview}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
          <Ionicons name="star" size={14} color={colors.accent} />
          <Text style={{ color: colors.accent, marginLeft: 4 }}>
            {item.vote_average ? item.vote_average.toFixed(1) : '0.0'} ({(item.vote_count || 0).toLocaleString()} votes)
          </Text>
        </View>
        <Text style={[movieCardStyles.genresText, { color: colors.subText }]}>
          Genres: {item.genre_ids.map(id => genres[id] || 'Unknown').join(', ')}
        </Text>
        
        {item.alreadyRated && (
          <View style={styles.ratingContainer}>
            <Text style={{ color: colors.secondary, marginRight: 10, fontWeight: 'bold' }}>
              Your rating: {item.currentRating ? item.currentRating.toFixed(1) : '0.0'}
            </Text>
            
            <TouchableOpacity
              style={[styles.reRankButton, { backgroundColor: colors.primary }]}
              onPress={() => openRatingModal(item)}
            >
              <Text style={[styles.buttonText, { color: colors.text }]}>
                Update Rating
              </Text>
            </TouchableOpacity>
          </View>
        )}
        
        <View style={styles.buttonContainer}>
          {!item.alreadyRated && (
            <TouchableOpacity
              style={[buttonStyles.primaryButton, { backgroundColor: colors.primary }]}
              onPress={() => openRatingModal(item)}
            >
              <Text style={[buttonStyles.primaryButtonText, { color: colors.accent }]}>
                Rate {mediaType === 'movie' ? 'Movie' : 'TV Show'}
              </Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity
            style={[
              buttonStyles.outlineButton, 
              { 
                borderColor: colors.primary,
                backgroundColor: unseen.some(m => m.id === item.id) ? 
                  colors.secondary : 'transparent'
              }
            ]}
            onPress={() => addToUnseen(item)}
          >
            <Text style={[buttonStyles.outlineButtonText, { color: colors.text }]}>
              {unseen.some(m => m.id === item.id) ? 'Remove from Watchlist' : 'Add to Watchlist'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  ), [colors, genres, getPosterUrl, openRatingModal, addToUnseen, unseen, movieCardStyles, buttonStyles, mediaType]);

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

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ThemedHeader mediaType={mediaType} isDarkMode={isDarkMode} theme={theme}>
        <Text style={headerStyles.screenTitle}>
          Add {mediaType === 'movie' ? 'Movies' : 'TV Shows'}
        </Text>
      </ThemedHeader>
      
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: 0 }}>
        {/* Search bar */}
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
              onSubmitEditing={() => handleFullSearch()}
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
            onPress={() => handleFullSearch()}
            disabled={loading || !searchQuery.trim()}
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.text} />
            ) : (
              <Text style={[searchStyles.searchButtonText, { color: colors.text }]}>Search</Text>
            )}
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

        {/* Search results or empty state - wrapped for keyboard dismissal */}
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={{ flex: 1 }}>
            {error ? (
              <View style={stateStyles.errorContainer}>
                <Ionicons name="alert-circle" size={32} color={colors.accent} />
                <Text style={[stateStyles.errorText, { color: colors.accent }]}>
                  {error}
                </Text>
                <TouchableOpacity
                  style={[searchStyles.searchButton, { backgroundColor: colors.primary, marginTop: 16 }]}
                  onPress={() => {
                    setError(null);
                    if (searchQuery.trim()) {
                      handleFullSearch();
                    }
                  }}
                >
                  <Text style={[searchStyles.searchButtonText, { color: colors.text }]}>Try Again</Text>
                </TouchableOpacity>
              </View>
            ) : searchResults.length === 0 && !loading && searchQuery.trim() ? (
              <View style={stateStyles.emptyStateContainer}>
                <Ionicons name="search-outline" size={64} color={colors.subText} />
                <Text style={[stateStyles.emptyStateText, { color: colors.subText }]}>
                  No {mediaType === 'movie' ? 'movies' : 'TV shows'} found for "{searchQuery}"
                </Text>
                <Text style={[stateStyles.emptyStateText, { color: colors.subText, fontSize: 14, marginTop: 8 }]}>
                  Try a different search term
                </Text>
              </View>
            ) : searchResults.length === 0 && !loading ? (
              <View style={stateStyles.emptyStateContainer}>
                <Ionicons name="search" size={64} color={colors.subText} />
                <Text style={[stateStyles.emptyStateText, { color: colors.subText }]}>
                  Search for {mediaType === 'movie' ? 'movies' : 'TV shows'} to add to your lists
                </Text>
                {searchQuery && suggestionLoading && (
                  <ActivityIndicator size="small" color={colors.accent} style={{ marginTop: 16 }} />
                )}
              </View>
            ) : (
              <FlatList
                data={searchResults}
                keyExtractor={item => item.id.toString()}
                renderItem={renderMovieItem}
                contentContainerStyle={{ padding: 16 }}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
              />
            )}
          </View>
        </TouchableWithoutFeedback>
        
        {/* Rating Modal */}
        <RatingModal
          visible={ratingModalVisible}
          onClose={closeRatingModal}
          onSubmit={handleRateMovie}
          movie={selectedMovie}
          ratingInput={ratingInput}
          setRatingInput={setRatingInput}
          slideAnim={slideAnim}
          mediaType={mediaType}
          isDarkMode={isDarkMode}
          theme={theme}
          genres={genres}
        />
      </View>
    </View>
  );
}

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
  moviePoster: {
    width: 110,
    height: 165,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  reRankButton: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 4,
    alignItems: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    marginTop: 10,
    flexWrap: 'wrap',
    gap: 8,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default AddMovieScreen;