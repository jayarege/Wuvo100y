import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  TouchableOpacity, 
  Image, 
  ScrollView, 
  Dimensions,
  Modal,
  Alert,
  ActivityIndicator,
  TextInput,
  Animated,
  FlatList,
  Keyboard
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useMediaType } from '../../Navigation/TabNavigator';
import { ThemedHeader } from '../../Styles/headerStyles';
import { getModalStyles } from '../../Styles/modalStyles';
import { getLayoutStyles } from '../../Styles/layoutStyles';
import { getHeaderStyles } from '../../Styles/headerStyles';
import { getListStyles } from '../../Styles/listStyles';

const { width } = Dimensions.get('window');

const getStandardizedButtonStyles = (colors) => ({
  // Base button style - consistent across all variants
  baseButton: {
    flex: 1,
    marginHorizontal: 2,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44, // Accessibility: minimum touch target
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  
  // Primary button variant - for main actions (Rate)
  primaryButton: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  
  // Secondary button variant - for important actions (Watchlist)
  secondaryButton: {
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  
  // Tertiary button variant - for less prominent actions (Not Interested)
  tertiaryButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  
  // Base text style - consistent typography with responsive sizing
  baseText: {
    fontSize: Math.min(16, width * 0.035), // Responsive font size based on screen width
    fontWeight: '600',
    textAlign: 'center',
    fontFamily: colors.font?.body || 'System',
    lineHeight: Math.min(20, width * 0.045), // Responsive line height
  },
  
  // Text color variants
  primaryText: {
    color: colors.primary,
    fontWeight: '700',
  },
  
  secondaryText: {
    color: colors.accent,
  },
  
  tertiaryText: {
    color: '#FFFFFF',
  },
});
import { getMovieCardStyles } from '../../Styles/movieCardStyles';
import stateStyles from '../../Styles/StateStyles';
import theme from '../../utils/Theme';
import UserSearchModal from '../../Components/UserSearchModal';
import { useAuth } from '../../hooks/useAuth';
import FirebaseAuthTest from '../../Components/FirebaseAuthTest';
import { RatingModal } from '../../Components/RatingModal';
import { SentimentRatingModal, calculateDynamicRatingCategories, calculatePairwiseRating, ComparisonResults } from '../../Components/EnhancedRatingSystem';
import { filterAdultContent } from '../../utils/ContentFiltering';
import { TMDB_API_KEY, API_TIMEOUT, STREAMING_SERVICES, DECADES } from '../../Constants';
import { ENV } from '../../config/environment';

const POSTER_SIZE = (width - 60) / 3; // 3 columns with spacing

const ProfileScreen = ({ seen = [], unseen = [], isDarkMode, navigation, onUpdateRating, onAddToSeen, onRemoveFromWatchlist, genres, route }) => {
  const { mediaType } = useMediaType();
  const { handleLogout, userInfo } = useAuth();
  const modalStyles = getModalStyles(mediaType, isDarkMode ? 'dark' : 'light', theme);
  const layoutStyles = getLayoutStyles(mediaType, isDarkMode ? 'dark' : 'light', theme);
  const headerStyles = getHeaderStyles(mediaType, isDarkMode ? 'dark' : 'light', theme);
  const listStyles = getListStyles(mediaType, isDarkMode ? 'dark' : 'light', theme);
  const movieCardStyles = getMovieCardStyles(mediaType, isDarkMode ? 'dark' : 'light', theme);
  const colors = theme[mediaType][isDarkMode ? 'dark' : 'light'];
  const standardButtonStyles = getStandardizedButtonStyles(colors);
  
  // Detect if viewing friend's profile
  const friendProfile = route?.params?.user;
  const isOwnProfile = !friendProfile;
  const profileUser = friendProfile || userInfo;
  
  // Tab state
  const [selectedTab, setSelectedTab] = useState('toprated');
  
  // Profile UI state
  const [showDropdown, setShowDropdown] = useState(false);
  const [showGenreDropdown, setShowGenreDropdown] = useState(false);
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [firebaseTestVisible, setFirebaseTestVisible] = useState(false);
  const [movieDetailModalVisible, setMovieDetailModalVisible] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [movieCredits, setMovieCredits] = useState(null);
  const [movieProviders, setMovieProviders] = useState(null);
  const [isLoadingMovieDetails, setIsLoadingMovieDetails] = useState(false);
  const [movieContext, setMovieContext] = useState(null); // Track where the movie was selected from
  
  // Friend profile ranking state
  const [selectedRankingType, setSelectedRankingType] = useState('user'); // 'user', 'average', 'imdb'
  const [showUnwatchedMovies, setShowUnwatchedMovies] = useState(false);
  
  // TopRated functionality state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [newRating, setNewRating] = useState('');
  const [selectedGenreId, setSelectedGenreId] = useState(null);
  
  // Watchlist functionality state
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [ratingInput, setRatingInput] = useState('');
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [selectedDecades, setSelectedDecades] = useState([]);
  const [selectedStreamingServices, setSelectedStreamingServices] = useState([]);
  const [tempGenres, setTempGenres] = useState([]);
  const [tempDecades, setTempDecades] = useState([]);
  const [tempStreamingServices, setTempStreamingServices] = useState([]);
  const [streamingProviders, setStreamingProviders] = useState([]);
  
  // Enhanced rating modal state
  const [emotionModalVisible, setEmotionModalVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  
  // Comparison modal state
  const [comparisonModalVisible, setComparisonModalVisible] = useState(false);
  const [comparisonMovies, setComparisonMovies] = useState([]);
  const [currentComparison, setCurrentComparison] = useState(0);
  const [comparisonResults, setComparisonResults] = useState([]);
  const [isComparisonComplete, setIsComparisonComplete] = useState(false);
  const [currentMovieRating, setCurrentMovieRating] = useState(null);
  const [selectedEmotion, setSelectedEmotion] = useState(null);
  
  // Animation refs
  const slideAnim = useRef(new Animated.Value(300)).current;
  
  // Get current user ID from Firebase Auth (userInfo.id is set in useAuth hook)
  const currentUserId = userInfo?.id || userInfo?.uid || userInfo?.userId || 'demo-user-123';
  
  const API_KEY = TMDB_API_KEY;

  // Helper function to add timeout to fetch requests
  const fetchWithTimeout = async (url, options = {}, timeout = API_TIMEOUT) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timed out');
      }
      throw error;
    }
  };

  // Clear filters when media type changes
  useEffect(() => {
    setSelectedGenres([]);
    setSelectedDecades([]);
    setSelectedStreamingServices([]);
    setSelectedGenreId(null);
  }, [mediaType]);

  // Filter content by current media type
  const currentSeen = useMemo(() => {
    return seen.filter(item => (item.mediaType || 'movie') === mediaType);
  }, [seen, mediaType]);

  const currentUnseen = useMemo(() => {
    return unseen.filter(item => (item.mediaType || 'movie') === mediaType);
  }, [unseen, mediaType]);

  // Get top rated content for display
  const topRatedContent = useMemo(() => {
    let sortedContent = [...currentSeen];
    
    // For friend profiles, apply different ranking logic
    if (!isOwnProfile) {
      switch (selectedRankingType) {
        case 'user':
          sortedContent = sortedContent.sort((a, b) => (b.userRating || 0) - (a.userRating || 0));
          break;
        case 'average':
          // Mock average friend rating (in real app, this would be calculated from actual friends)
          sortedContent = sortedContent.sort((a, b) => {
            const avgA = ((a.userRating || 0) + (a.vote_average || 0)) / 2;
            const avgB = ((b.userRating || 0) + (b.vote_average || 0)) / 2;
            return avgB - avgA;
          });
          break;
        case 'imdb':
          sortedContent = sortedContent.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
          break;
      }
      
      // Include unwatched movies if enabled
      if (showUnwatchedMovies) {
        const unwatchedWithRatings = currentUnseen.map(movie => ({
          ...movie,
          isUnwatched: true
        }));
        sortedContent = [...sortedContent, ...unwatchedWithRatings];
      }
    } else {
      // Own profile - original logic
      sortedContent = sortedContent
        .filter(item => item.userRating >= 7)
        .sort((a, b) => b.userRating - a.userRating);
    }
    
    return sortedContent.slice(0, 9);
  }, [currentSeen, currentUnseen, isOwnProfile, selectedRankingType, showUnwatchedMovies]);

  // Get recently watched content (latest rated first)
  const recentlyWatchedContent = useMemo(() => {
    return currentSeen
      .sort((a, b) => (b.userRating || 0) - (a.userRating || 0))
      .slice(0, 9);
  }, [currentSeen]);

  // Calculate stats
  const stats = useMemo(() => {
    const totalRated = currentSeen.length;
    const averageRating = totalRated > 0 
      ? currentSeen.reduce((sum, item) => sum + (item.userRating || 0), 0) / totalRated 
      : 0;
    const watchlistSize = currentUnseen.length;

    return {
      posts: totalRated,
      friends: Math.floor(Math.random() * 100) + 50, // Random friends count for demo
      following: watchlistSize
    };
  }, [currentSeen, currentUnseen]);

  // TopRated data processing
  const mediaFilteredMovies = useMemo(() => {
    if (!currentSeen || !Array.isArray(currentSeen)) return [];
    
    return currentSeen.filter(movie => {
      const itemMediaType = movie.mediaType || 'movie';
      return itemMediaType === mediaType;
    });
  }, [currentSeen, mediaType]);

  const uniqueGenreIds = useMemo(() => {
    const genreSet = new Set();
    mediaFilteredMovies.forEach(movie => {
      if (movie.genre_ids && Array.isArray(movie.genre_ids)) {
        movie.genre_ids.forEach(id => genreSet.add(id));
      }
    });
    return Array.from(genreSet);
  }, [mediaFilteredMovies]);

  const filteredAndRankedMovies = useMemo(() => {
    const safeContent = filterAdultContent(mediaFilteredMovies, mediaType);
    let filtered = [...safeContent];
    
    // Apply friend profile ranking logic for toprated tab
    if (!isOwnProfile && selectedTab === 'toprated') {
      switch (selectedRankingType) {
        case 'user':
          filtered = filtered.sort((a, b) => (b.userRating || 0) - (a.userRating || 0));
          break;
        case 'average':
          filtered = filtered.sort((a, b) => {
            const avgA = ((a.userRating || 0) + (a.vote_average || 0)) / 2;
            const avgB = ((b.userRating || 0) + (b.vote_average || 0)) / 2;
            return avgB - avgA;
          });
          break;
        case 'imdb':
          filtered = filtered.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
          break;
      }
      
      // Include unwatched movies if enabled
      if (showUnwatchedMovies) {
        const unwatchedWithRatings = currentUnseen.map(movie => ({
          ...movie,
          isUnwatched: true
        }));
        filtered = [...filtered, ...unwatchedWithRatings];
      }
    } else {
      // Original logic for own profile
      if (selectedGenreId !== null) {
        filtered = filtered.filter(movie => 
          movie.genre_ids && movie.genre_ids.includes(selectedGenreId)
        );
      }
      
      filtered = filtered.sort((a, b) => {
        if (a.userRating !== undefined && b.userRating !== undefined) {
          return b.userRating - a.userRating;
        }
        return b.eloRating - a.eloRating;
      });
    }
    
    return filtered.slice(0, 5);
  }, [mediaFilteredMovies, selectedGenreId, mediaType, isOwnProfile, selectedTab, selectedRankingType, showUnwatchedMovies, currentUnseen]);

  // Watchlist data processing
  const moviesByMediaType = useMemo(() => {
    return currentUnseen.filter(movie => (movie.mediaType || 'movie') === mediaType);
  }, [currentUnseen, mediaType]);

  const sortedMovies = [...moviesByMediaType].sort((a, b) => b.score - a.score);

  const uniqueWatchlistGenreIds = useMemo(() => {
    return Array.from(new Set(moviesByMediaType.flatMap(m => m.genre_ids || [])));
  }, [moviesByMediaType]);

  const filteredMovies = useMemo(() => {
    const safeContent = filterAdultContent(sortedMovies, mediaType);
    let filtered = safeContent;

    if (selectedGenres.length > 0) {
      filtered = filtered.filter(movie => 
        movie.genre_ids && movie.genre_ids.some(genreId => 
          selectedGenres.includes(genreId.toString())
        )
      );
    }

    if (selectedDecades.length > 0) {
      filtered = filtered.filter(movie => {
        const dateField = movie.release_date || movie.first_air_date;
        if (!dateField) return false;
        const year = new Date(dateField).getFullYear();
        return selectedDecades.some(decade => {
          const decadeInfo = DECADES.find(d => d.value === decade);
          return year >= decadeInfo.startYear && year <= decadeInfo.endYear;
        });
      });
    }

    if (selectedGenres.length === 0 && selectedDecades.length === 0 && selectedStreamingServices.length === 0 && selectedGenreId) {
      filtered = filtered.filter(movie => movie.genre_ids?.includes(selectedGenreId));
    }

    return filtered;
  }, [selectedGenres, selectedDecades, selectedStreamingServices, selectedGenreId, sortedMovies, mediaType]);

  const hasActiveFilters = selectedGenres.length > 0 || selectedDecades.length > 0 || selectedStreamingServices.length > 0;

  // TopRated helper functions
  const fetchMovieCredits = useCallback(async (movieId) => {
    try {
      const response = await fetch(
        `https://api.themoviedb.org/3/movie/${movieId}/credits?api_key=b401be0ea16515055d8d0bde16f80069`
      );
      const data = await response.json();
      return data.cast?.slice(0, 3) || [];
    } catch (error) {
      console.error('Error fetching movie credits:', error);
      return [];
    }
  }, []);

  const fetchMovieProviders = useCallback(async (movieId) => {
    try {
      const response = await fetch(
        `https://api.themoviedb.org/3/movie/${movieId}/watch/providers?api_key=b401be0ea16515055d8d0bde16f80069`
      );
      const data = await response.json();
      return data.results?.US?.flatrate || [];
    } catch (error) {
      console.error('Error fetching movie providers:', error);
      return [];
    }
  }, []);

  const normalizeProviderName = useCallback((providerName) => {
    const normalized = providerName.toLowerCase();
    
    // Remove Amazon Channel redundancies - prefer main service over channel
    if (normalized.includes('amazon channel')) {
      // Extract the main service name (e.g., "HBO Max Amazon Channel" -> "max")
      if (normalized.includes('hbo') || normalized.includes('max')) return 'max';
      if (normalized.includes('starz')) return 'starz';
      if (normalized.includes('showtime')) return 'showtime';
      if (normalized.includes('mgm')) return 'mgm';
      if (normalized.includes('cinemax')) return 'cinemax';
      if (normalized.includes('epix')) return 'epix';
      // Skip other Amazon channels that don't have main service equivalent
      return null;
    }
    
    if (normalized.includes('netflix')) return 'netflix';
    if (normalized.includes('prime') || normalized.includes('amazon')) return 'prime';
    if (normalized.includes('apple')) return 'apple';
    if (normalized.includes('hulu')) return 'hulu';
    if (normalized.includes('disney')) return 'disney';
    if (normalized.includes('max') || normalized.includes('hbo')) return 'max';
    if (normalized.includes('paramount')) return 'paramount';
    if (normalized.includes('peacock')) return 'peacock';
    if (normalized.includes('showtime')) return 'showtime';
    if (normalized.includes('starz')) return 'starz';
    
    return normalized
      .replace(/\s*\(.*?\)/g, '')
      .replace(/\s*(with\s+)?ads?$/gi, '')
      .replace(/\s*premium$/gi, '')
      .replace(/\s*plus$/gi, '')
      .replace(/\s*\+$/gi, '')
      .trim();
  }, []);

  const deduplicateProviders = useCallback((providers) => {
    if (!providers || !Array.isArray(providers)) return [];
    
    const seen = new Set();
    const filtered = [];
    
    const sorted = [...providers].sort((a, b) => {
      const aHasAds = a.provider_name.toLowerCase().includes('ads');
      const bHasAds = b.provider_name.toLowerCase().includes('ads');
      
      if (aHasAds && !bHasAds) return 1;
      if (!aHasAds && bHasAds) return -1;
      return 0;
    });
    
    for (const provider of sorted) {
      const normalizedName = normalizeProviderName(provider.provider_name);
      
      // Skip providers that should be filtered out (Amazon channels without main service)
      if (normalizedName === null) {
        continue;
      }
      
      if (!seen.has(normalizedName)) {
        seen.add(normalizedName);
        filtered.push(provider);
      }
    }
    
    return filtered;
  }, [normalizeProviderName]);

  const getProviderLogoUrl = useCallback((logoPath, providerId) => {
    if (!logoPath) return null;
    
    // Use blue Amazon Prime logo for better brand recognition
    if (providerId === 9) {
      return 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Amazon_Prime_Video_logo.svg/300px-Amazon_Prime_Video_logo.svg.png';
    }
    
    return `https://image.tmdb.org/t/p/w92${logoPath}`;
  }, []);

  // Watchlist helper functions
  const fetchStreamingProviders = useCallback(async () => {
    try {
      const endpoint = mediaType === 'movie' ? 'movie' : 'tv';
      const response = await fetchWithTimeout(
        `https://api.themoviedb.org/3/watch/providers/${endpoint}?api_key=b401be0ea16515055d8d0bde16f80069&watch_region=US`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      const availableProviders = data.results
        .filter(provider => STREAMING_SERVICES.some(service => service.id === provider.provider_id))
        .map(provider => {
          const serviceInfo = STREAMING_SERVICES.find(service => service.id === provider.provider_id);
          return {
            id: provider.provider_id,
            name: serviceInfo?.name || provider.provider_name,
            logo_path: provider.logo_path,
            logo_url: `https://image.tmdb.org/t/p/w92${provider.logo_path}`
          };
        });
      
      setStreamingProviders(availableProviders);
    } catch (err) {
      console.error('Error fetching streaming providers:', err);
      setStreamingProviders(STREAMING_SERVICES.map(service => ({
        ...service,
        logo_url: null
      })));
    }
  }, [mediaType]);

  useEffect(() => {
    fetchStreamingProviders();
  }, [fetchStreamingProviders]);

  const getPosterUrl = (path) => {
    if (!path) return 'https://via.placeholder.com/342x513/333/fff?text=No+Poster';
    // If path already includes https:// it's a full URL
    if (path.startsWith('http')) return path;
    return `https://image.tmdb.org/t/p/w342${path}`;
  };

  // Universal movie selection handler with context
  const handleMovieSelect = useCallback(async (movie, context = 'general') => {
    console.log('🎬 Movie selected:', movie.title || movie.name, 'Context:', context);
    setSelectedMovie(movie);
    setMovieContext(context);
    setIsLoadingMovieDetails(true);
    setMovieDetailModalVisible(true);
    
    try {
      // Fetch movie credits
      const creditsResponse = await fetch(
        `https://api.themoviedb.org/3/${mediaType}/${movie.id}/credits?api_key=b401be0ea16515055d8d0bde16f80069`
      );
      const creditsData = await creditsResponse.json();
      const cast = creditsData.cast?.slice(0, 5) || [];
      setMovieCredits(cast);
      
      // Fetch streaming providers
      const providersResponse = await fetch(
        `https://api.themoviedb.org/3/${mediaType}/${movie.id}/watch/providers?api_key=b401be0ea16515055d8d0bde16f80069`
      );
      const providersData = await providersResponse.json();
      const usProviders = providersData.results?.US?.flatrate || [];
      setMovieProviders(usProviders);
    } catch (error) {
      console.error('Error fetching movie details:', error);
    } finally {
      setIsLoadingMovieDetails(false);
    }
  }, [mediaType]);

  const openEditModal = useCallback((movie) => {
    setSelectedMovie(movie);
    const initialRating = movie.userRating !== undefined
      ? movie.userRating.toFixed(1)
      : (movie.eloRating / 100).toFixed(1);
    setNewRating(initialRating);
    setEditModalVisible(true);
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [slideAnim]);

  const closeEditModal = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: 300,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setEditModalVisible(false);
      setSelectedMovie(null);
      setNewRating('');
    });
  }, [slideAnim]);

  const updateRating = useCallback(() => {
    const rating = parseFloat(newRating);
    if (isNaN(rating) || rating < 1 || rating > 10) {
      Animated.sequence([
        Animated.timing(slideAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]).start();
      return;
    }
    onUpdateRating(selectedMovie.id, rating);
    closeEditModal();
  }, [newRating, selectedMovie, onUpdateRating, closeEditModal, slideAnim]);

  const displayRating = useCallback((movie) => {
    // For friend profiles, show rating based on selected ranking type
    if (!isOwnProfile) {
      switch (selectedRankingType) {
        case 'user':
          return movie.userRating ? movie.userRating.toFixed(1) : 'N/A';
        case 'average':
          if (movie.userRating && movie.vote_average) {
            return (((movie.userRating + movie.vote_average) / 2)).toFixed(1);
          }
          return movie.userRating ? movie.userRating.toFixed(1) : (movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A');
        case 'imdb':
          return movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A';
        default:
          return movie.userRating ? movie.userRating.toFixed(1) : 'N/A';
      }
    }
    
    // Own profile - original logic
    if (movie.userRating !== undefined) {
      return movie.userRating.toFixed(1);
    }
    return (movie.eloRating / 100).toFixed(1);
  }, [isOwnProfile, selectedRankingType]);

  const handleGenreSelect = useCallback((genreId) => {
    setSelectedGenreId(prev => prev === genreId ? null : genreId);
  }, []);

  const clearFilters = useCallback(() => {
    setSelectedGenreId(null);
  }, []);

  const getTitle = useCallback((item) => {
    return item.title || item.name || 'Unknown Title';
  }, []);

  // Watchlist handlers
  const openRatingModal = useCallback((movie) => {
    setSelectedMovie(movie);
    setRatingInput('');
    setRatingModalVisible(true);
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [slideAnim]);

  const closeRatingModal = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: 300,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setRatingModalVisible(false);
      setSelectedMovie(null);
    });
  }, [slideAnim]);

  const handleRatingSubmit = useCallback(() => {
    const rating = parseFloat(ratingInput);
    if (!isNaN(rating) && rating >= 1 && rating <= 10) {
      onAddToSeen({
        ...selectedMovie,
        userRating: rating,
        eloRating: rating * 100,
        comparisonWins: 0,
        gamesPlayed: 0,
        comparisonHistory: [],
      });
      closeRatingModal();
    } else {
      Animated.sequence([
        Animated.timing(slideAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]).start();
    }
  }, [ratingInput, selectedMovie, onAddToSeen, closeRatingModal, slideAnim]);

  const handleRemoveFromWatchlist = useCallback((movie) => {
    onRemoveFromWatchlist(movie.id);
  }, [onRemoveFromWatchlist]);

  // Filter modal functions
  const openFilterModal = useCallback(() => {
    setTempGenres([...selectedGenres]);
    setTempDecades([...selectedDecades]);
    setTempStreamingServices([...selectedStreamingServices]);
    setFilterModalVisible(true);
  }, [selectedGenres, selectedDecades, selectedStreamingServices]);

  const applyFilters = useCallback(() => {
    setFilterModalVisible(false);
    setSelectedGenres([...tempGenres]);
    setSelectedDecades([...tempDecades]);
    setSelectedStreamingServices([...tempStreamingServices]);
    if (tempGenres.length > 0 || tempDecades.length > 0 || tempStreamingServices.length > 0) {
      setSelectedGenreId(null);
    }
  }, [tempGenres, tempDecades, tempStreamingServices]);

  const cancelFilters = useCallback(() => {
    setFilterModalVisible(false);
  }, []);

  const toggleGenre = useCallback((genreId) => {
    setTempGenres(prev => 
      prev.includes(genreId) 
        ? prev.filter(id => id !== genreId)
        : [...prev, genreId]
    );
  }, []);

  const toggleDecade = useCallback((decade) => {
    setTempDecades(prev => 
      prev.includes(decade) 
        ? prev.filter(d => d !== decade)
        : [...prev, decade]
    );
  }, []);

  const toggleStreamingService = useCallback((serviceId) => {
    setTempStreamingServices(prev => 
      prev.includes(serviceId.toString()) 
        ? prev.filter(id => id !== serviceId.toString())
        : [...prev, serviceId.toString()]
    );
  }, []);

  const clearAllFilters = useCallback(() => {
    setTempGenres([]);
    setTempDecades([]);
    setTempStreamingServices([]);
  }, []);

  const closeDetailModal = useCallback((preserveForRating = false) => {
    setMovieDetailModalVisible(false);
    if (!preserveForRating) {
      setSelectedMovie(null);
      setMovieCredits(null);
      setMovieProviders(null);
      setIsLoadingMovieDetails(false);
      setMovieContext(null);
    }
    console.log('🔓 Profile modal closed, preserveForRating:', preserveForRating);
  }, []);
  
  // Enhanced rating functions
  const handleWatchlistToggle = useCallback(() => {
    if (!selectedMovie) return;
    
    const isInWatchlist = unseen.some(movie => movie.id === selectedMovie.id);
    if (isInWatchlist) {
      onRemoveFromWatchlist(selectedMovie.id);
    }
    closeDetailModal();
  }, [selectedMovie, unseen, onRemoveFromWatchlist, closeDetailModal]);
  
  const handleNotInterested = useCallback((movie) => {
    // Add to skipped movies if function exists
    closeDetailModal();
  }, [closeDetailModal]);
  
  // Select movie from percentile based on emotion (from Home screen logic)
  const selectMovieFromPercentile = useCallback((seenMovies, emotion) => {
    const percentileRanges = {
      LOVED: [0.0, 0.25],      // Top 25%
      LIKED: [0.25, 0.50],     // Upper-middle 25-50% 
      AVERAGE: [0.50, 0.75],   // Lower-middle 50-75%
      DISLIKED: [0.75, 1.0]    // Bottom 25%
    };

    if (!seenMovies || seenMovies.length === 0) {
      console.log('🚨 No seen movies available');
      return null;
    }

    // Sort movies by rating to establish percentile ranges
    const sortedMovies = [...seenMovies].sort((a, b) => (a.userRating || 0) - (b.userRating || 0));
    const [minPercent, maxPercent] = percentileRanges[emotion] || [0.5, 0.75];
    
    const startIndex = Math.floor(sortedMovies.length * minPercent);
    const endIndex = Math.min(Math.floor(sortedMovies.length * maxPercent), sortedMovies.length - 1);
    
    console.log(`🎯 ${emotion} percentile [${minPercent}-${maxPercent}]: indices ${startIndex}-${endIndex}`);
    
    const percentileMovies = sortedMovies.slice(startIndex, endIndex + 1);
    if (percentileMovies.length === 0) return sortedMovies[0]; // Fallback
    
    // Random selection from percentile
    const selectedMovie = percentileMovies[Math.floor(Math.random() * percentileMovies.length)];
    console.log(`🎬 Selected from ${emotion} percentile: ${selectedMovie.title} (Rating: ${selectedMovie.userRating})`);
    
    return selectedMovie;
  }, []);

  const handleEmotionSelected = useCallback((emotion) => {
    console.log('🎭 PROFILE EMOTION SELECTED:', emotion);
    console.log('🎭 SEEN MOVIES COUNT:', seen.length);
    
    setSelectedEmotion(emotion);
    setEmotionModalVisible(false);
    // Don't clear selectedMovie here - keep it for comparison modal
    
    // Select first opponent from percentile - EXACT COPY FROM HOME SCREEN LOGIC
    const firstOpponent = selectMovieFromPercentile(seen, emotion);
    if (!firstOpponent) {
      console.log('❌ NO FIRST OPPONENT FOUND');
      Alert.alert(
        '🎬 Need More Ratings', 
        `You need at least 3 rated movies to use this feature.\n\nCurrently you have: ${seen.length} rated movies.\n\nPlease rate a few more movies first!`,
        [{ text: "OK", style: "default" }]
      );
      return;
    }
    
    // Select second and third opponents randomly from all seen movies (for known vs known)
    const remainingMovies = seen.filter(movie => movie.id !== firstOpponent.id);
    
    if (remainingMovies.length < 2) {
      console.log('❌ NOT ENOUGH REMAINING MOVIES');
      Alert.alert(
        '🎬 Need More Ratings', 
        `You need at least 3 rated movies to use this feature.\n\nCurrently you have: ${seen.length} rated movies.\n\nPlease rate a few more movies first!`,
        [{ text: "OK", style: "default" }]
      );
      return;
    }
    
    // Shuffle remaining movies and pick 2
    const shuffled = remainingMovies.sort(() => 0.5 - Math.random());
    const secondOpponent = shuffled[0];
    const thirdOpponent = shuffled[1];
    
    // Set up comparison movies and start
    setComparisonMovies([firstOpponent, secondOpponent, thirdOpponent]);
    setCurrentComparison(0);
    setComparisonResults([]);
    setIsComparisonComplete(false);
    setCurrentMovieRating(null);
    setComparisonModalVisible(true);
    
    console.log(`🎭 Starting rating for ${selectedMovie?.title} with emotion: ${emotion} (no baseline)`);
    console.log(`🎯 First opponent (${emotion} percentile): ${firstOpponent.title} (${firstOpponent.userRating})`);
    console.log(`🎯 Second opponent (random): ${secondOpponent.title} (${secondOpponent.userRating})`);
    console.log(`🎯 Third opponent (random): ${thirdOpponent.title} (${thirdOpponent.userRating})`);
  }, [selectedMovie, seen, selectMovieFromPercentile]);

  const handleComparison = useCallback((winner) => {
    const currentComparisonMovie = comparisonMovies[currentComparison];
    
    if (currentComparison === 0) {
      // FIRST COMPARISON: Unknown vs Known (use unified pairwise calculation)
      const opponentRating = currentComparisonMovie.userRating;
      let result;
      
      if (winner === 'new') {
        result = 'A_WINS';
      } else if (winner === 'comparison') {
        result = 'B_WINS';
      } else if (winner === 'tie') {
        result = 'TIE';
      }
      
      const pairwiseResult = calculatePairwiseRating({
        aRating: null, // New movie has no rating yet
        bRating: opponentRating, // Opponent rating
        aGames: 0, // New movie has no games
        bGames: currentComparisonMovie.gamesPlayed || 5,
        result: result
      });
      
      const derivedRating = pairwiseResult.updatedARating;
      setCurrentMovieRating(derivedRating);
      
      console.log(`🎯 ROUND 1 BASELINE-FREE: ${selectedMovie?.title} derived rating: ${derivedRating} (from ${winner} vs ${currentComparisonMovie.title})`);
      
      setComparisonResults([{ winner, opponentRating, derivedRating }]);
      setCurrentComparison(1);
    } else {
      // Rounds 2-3: Known vs Known - Use Wildcard ELO system
      const currentRating = currentMovieRating;
      const opponentRating = currentComparisonMovie.userRating;
      
      // Wildcard ELO calculation
      const adjustedRating = adjustRatingWildcard(winner, currentRating, opponentRating, selectedEmotion);
      setCurrentMovieRating(adjustedRating);
      
      console.log(`🎯 ROUND ${currentComparison + 1} WILDCARD ELO: ${selectedMovie?.title} rating: ${currentRating} → ${adjustedRating} (${winner} vs ${currentComparisonMovie.title})`);
      
      setComparisonResults(prev => [...prev, { winner, opponentRating, newRating: adjustedRating }]);
      
      if (currentComparison === 2) {
        // All comparisons complete
        setIsComparisonComplete(true);
      } else {
        setCurrentComparison(currentComparison + 1);
      }
    }
  }, [comparisonMovies, currentComparison, currentMovieRating, selectedMovie, selectedEmotion]);

  const adjustRatingWildcard = useCallback((winner, currentRating, opponentRating, emotion) => {
    const K = 32; // ELO K-factor
    const currentK = winner === 'tie' ? K * 0.3 : K;
    
    // Calculate expected score
    const ratingDiff = opponentRating - currentRating;
    const expectedScore = 1 / (1 + Math.pow(10, ratingDiff / 400));
    
    // Determine actual score based on winner
    let actualScore;
    if (winner === 'new') actualScore = 1;
    else if (winner === 'comparison') actualScore = 0;
    else actualScore = 0.5; // tie
    
    // Calculate new rating
    const newRating = currentRating + currentK * (actualScore - expectedScore);
    
    // Clamp between 1 and 10
    return Math.max(1, Math.min(10, newRating));
  }, []);

  const handleConfirmRating = useCallback((finalRating) => {
    console.log('✅ PROFILE: Confirming rating:', finalRating, 'for:', selectedMovie?.title);
    if (!selectedMovie || !finalRating) return;

    // Add movie to seen list with the calculated rating
    onAddToSeen({
      ...selectedMovie,
      userRating: finalRating,
      sentimentCategory: selectedEmotion,
      eloRating: finalRating * 100,
      comparisonWins: comparisonResults.filter(r => r.winner === 'new').length,
      gamesPlayed: 3,
      comparisonHistory: comparisonResults,
    });

    // Close all modals and reset state
    setComparisonModalVisible(false);
    setSelectedMovie(null);
    setSelectedCategory(null);
    setComparisonMovies([]);
    setCurrentComparison(0);
    setComparisonResults([]);
    setIsComparisonComplete(false);
    setCurrentMovieRating(null);
    setSelectedEmotion(null);

    Alert.alert(
      "Rating Added!", 
      `You rated "${selectedMovie.title}" (${finalRating.toFixed(1)}/10) from Profile watchlist`,
      [{ text: "OK" }]
    );
  }, [selectedMovie, selectedEmotion, comparisonResults, onAddToSeen]);

  // Render functions
  const renderGenreButton = useCallback(({ item }) => {
    const isSelected = item === selectedGenreId;
    const genreName = genres[item] || 'Unknown';
    
    return (
      <TouchableOpacity
        style={[
          profileStyles.genreButton,
          isSelected && profileStyles.selectedGenreButton,
          { 
            backgroundColor: isSelected 
              ? colors.primary 
              : colors.card,
            borderColor: colors.border.color
          }
        ]}
        onPress={() => handleGenreSelect(item)}
        activeOpacity={0.7}
      >
        <Text 
          style={[
            profileStyles.genreButtonText,
            { 
              color: isSelected 
                ? colors.accent 
                : colors.subText
            }
          ]}
        >
          {genreName}
        </Text>
      </TouchableOpacity>
    );
  }, [selectedGenreId, genres, colors, handleGenreSelect]);

  const renderWatchlistGenreButton = useCallback(({ item }) => {
    const isSelected = item === selectedGenreId;
    const genreName = genres[item] || 'Unknown';
    
    return (
      <TouchableOpacity
        style={[
          profileStyles.genreButton,
          isSelected && profileStyles.selectedGenreButton,
          { 
            backgroundColor: isSelected 
              ? colors.primary 
              : colors.card,
            borderColor: colors.border.color
          }
        ]}
        onPress={() => handleGenreSelect(item)}
        activeOpacity={0.7}
      >
        <Text 
          style={[
            profileStyles.genreButtonText,
            { 
              color: isSelected 
                ? colors.accent 
                : colors.subText
            }
          ]}
        >
          {genreName}
        </Text>
      </TouchableOpacity>
    );
  }, [selectedGenreId, genres, colors, handleGenreSelect]);

  const handleDropdownSelect = async (option) => {
    setShowDropdown(false);
    if (option === 'settings') {
      navigation.navigate('Settings');
    } else if (option === 'logout') {
      Alert.alert(
        'Confirm Logout',
        'Are you sure you want to logout? This will clear all your data.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Logout',
            style: 'destructive',
            onPress: async () => {
              try {
                await handleLogout();
                // Navigation will be handled automatically by App.js auth state change
              } catch (error) {
                console.error('Logout error:', error);
                Alert.alert('Error', 'Failed to logout. Please try again.');
              }
            }
          }
        ]
      );
    }
  };

  const renderTabContent = () => {
    switch (selectedTab) {
      case 'toprated':
        if (mediaFilteredMovies.length === 0) {
          return (
            <View style={[stateStyles.emptyStateContainer, { backgroundColor: colors.background }]}>
              <Ionicons name={mediaType === 'movie' ? 'film-outline' : 'tv-outline'} size={64} color={colors.subText} />
              <Text style={[stateStyles.emptyStateText, { color: colors.subText }]}>
                You haven't ranked any {mediaType === 'movie' ? 'movies' : 'TV shows'} yet.
              </Text>
            </View>
          );
        }
        
        return (
          <View style={{ flex: 1, backgroundColor: colors.background }}>
            {/* Friend Profile Ranking Options */}
            {!isOwnProfile && (
              <View style={[
                profileStyles.filterSection, 
                { 
                  borderBottomColor: colors.border.color,
                  backgroundColor: colors.background
                }
              ]}>
                <View style={profileStyles.filterHeader}>
                  <Text style={[profileStyles.filterTitle, { color: colors.text }]}>
                    Rank by
                  </Text>
                </View>
                
                <View style={profileStyles.rankingOptionsContainer}>
                  <TouchableOpacity
                    style={[
                      profileStyles.rankingOption,
                      selectedRankingType === 'user' && profileStyles.selectedRankingOption,
                      { 
                        backgroundColor: selectedRankingType === 'user' ? colors.primary : colors.card,
                        borderColor: colors.border.color
                      }
                    ]}
                    onPress={() => setSelectedRankingType('user')}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      profileStyles.rankingOptionText,
                      { 
                        color: selectedRankingType === 'user' ? colors.accent : colors.text
                      }
                    ]}>
                      {profileUser?.displayName || profileUser?.username || 'Friend'}'s Rating
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      profileStyles.rankingOption,
                      selectedRankingType === 'average' && profileStyles.selectedRankingOption,
                      { 
                        backgroundColor: selectedRankingType === 'average' ? colors.primary : colors.card,
                        borderColor: colors.border.color
                      }
                    ]}
                    onPress={() => setSelectedRankingType('average')}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      profileStyles.rankingOptionText,
                      { 
                        color: selectedRankingType === 'average' ? colors.accent : colors.text
                      }
                    ]}>
                      Average Friend Rating
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      profileStyles.rankingOption,
                      selectedRankingType === 'imdb' && profileStyles.selectedRankingOption,
                      { 
                        backgroundColor: selectedRankingType === 'imdb' ? colors.primary : colors.card,
                        borderColor: colors.border.color
                      }
                    ]}
                    onPress={() => setSelectedRankingType('imdb')}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      profileStyles.rankingOptionText,
                      { 
                        color: selectedRankingType === 'imdb' ? colors.accent : colors.text
                      }
                    ]}>
                      IMDb Rating
                    </Text>
                  </TouchableOpacity>
                </View>
                
                {/* Unwatched Movies Toggle */}
                <View style={profileStyles.unwatchedToggleContainer}>
                  <TouchableOpacity
                    style={[
                      profileStyles.unwatchedToggle,
                      showUnwatchedMovies && profileStyles.selectedUnwatchedToggle,
                      { 
                        backgroundColor: showUnwatchedMovies ? colors.primary : colors.card,
                        borderColor: colors.border.color
                      }
                    ]}
                    onPress={() => setShowUnwatchedMovies(!showUnwatchedMovies)}
                    activeOpacity={0.7}
                  >
                    <Ionicons 
                      name={showUnwatchedMovies ? "checkmark-circle" : "circle-outline"} 
                      size={20} 
                      color={showUnwatchedMovies ? colors.accent : colors.subText} 
                    />
                    <Text style={[
                      profileStyles.unwatchedToggleText,
                      { 
                        color: showUnwatchedMovies ? colors.accent : colors.text
                      }
                    ]}>
                      Include Unwatched Movies
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            
            {/* Genre Filter Section */}
            <View style={[
              profileStyles.filterSection, 
              { 
                borderBottomColor: colors.border.color,
                backgroundColor: colors.background
              }
            ]}>
              <View style={profileStyles.filterHeader}>
                <TouchableOpacity 
                  style={profileStyles.filterTitleContainer}
                  onPress={() => setShowGenreDropdown(!showGenreDropdown)}
                  activeOpacity={0.7}
                >
                  <Text style={[profileStyles.filterTitle, { color: colors.text }]}>
                    Filter by Genre
                  </Text>
                  <Ionicons 
                    name={showGenreDropdown ? "chevron-up" : "chevron-down"} 
                    size={20} 
                    color={colors.subText} 
                  />
                </TouchableOpacity>
                {selectedGenreId !== null && (
                  <TouchableOpacity 
                    style={profileStyles.clearButton}
                    onPress={clearFilters}
                  >
                    <Text style={[profileStyles.clearButtonText, { color: colors.accent }]}>
                      Clear
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              
              {/* Genre Buttons - Show/Hide with Arrow */}
              {showGenreDropdown && (
                <FlatList
                  data={uniqueGenreIds}
                  renderItem={renderGenreButton}
                  keyExtractor={(item) => item.toString()}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={profileStyles.genreList}
                />
              )}
              
              {selectedGenreId !== null && (
                <View style={profileStyles.activeFilterIndicator}>
                  <Text style={[profileStyles.activeFilterText, { color: colors.subText }]}>
                    Showing: {genres[selectedGenreId] || 'Unknown'} {mediaType === 'movie' ? 'movies' : 'TV shows'}
                  </Text>
                </View>
              )}
            </View>
            
            {/* Rankings List */}
            {filteredAndRankedMovies.length > 0 ? (
              <ScrollView style={[listStyles.rankingsList, { backgroundColor: colors.background }]}>
                {filteredAndRankedMovies.map((movie, index) => (
                  <TouchableOpacity
                    key={movie.id}
                    style={[listStyles.rankingItem, { backgroundColor: colors.card }]}
                    onPress={() => handleMovieSelect(movie, 'toprated')}
                    activeOpacity={0.7}
                    accessibilityLabel={`View details for ${getTitle(movie)}, rated ${displayRating(movie)} out of 10`}
                    accessibilityRole="button"
                    accessibilityHint="Double tap to view movie details and edit rating"
                  >
                    <LinearGradient
                      colors={colors.primaryGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={listStyles.rankingContainer}
                    >
                      <Text style={[listStyles.rankNumber, { color: colors.accent, fontSize: 12 }]}>
                        {index + 1}
                      </Text>
                    </LinearGradient>
                    <Image
                      source={{ uri: getPosterUrl(movie.poster || movie.poster_path) }}
                      style={listStyles.resultPoster}
                      resizeMode="cover"
                    />
                    <View style={[listStyles.movieDetails, { backgroundColor: colors.card }]}>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[listStyles.resultTitle, { color: colors.text }]}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {getTitle(movie)}
                        </Text>
                        <Text
                          style={[listStyles.resultTitle, { color: colors.subText, fontSize: 12, marginTop: 2 }]}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          ({(movie.release_date || movie.first_air_date || '').substring(0, 4) || 'Unknown Year'})
                        </Text>
                        <Text 
                          style={[movieCardStyles.genresText, { color: colors.subText, marginTop: 2 }]}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {movie.genre_ids && Array.isArray(movie.genre_ids) 
                            ? movie.genre_ids.slice(0, 2).map(id => (genres && genres[id]) || 'Unknown').join(', ') 
                            : 'Unknown'}
                        </Text>
                      </View>
                      <View style={{ 
                        alignItems: 'flex-start', 
                        justifyContent: 'center', 
                        marginHorizontal: 0, 
                        flex: 0.4, 
                        paddingLeft: 4
                      }}>
                        <View style={{ 
                          flexDirection: 'row', 
                          alignItems: 'center', 
                          justifyContent: 'flex-start', 
                          width: '100%',
                          paddingHorizontal: 0
                        }}>
                          <View style={{ alignItems: 'center', minWidth: Math.max(32, width * 0.06), marginRight: Math.max(8, width * 0.02) }}>
                            <Text style={[profileStyles.ratingLabel, { 
                              color: colors.subText, 
                              fontSize: Math.max(9, width * 0.025), 
                              fontWeight: '600', 
                              textAlign: 'center',
                              numberOfLines: 1
                            }]}>
                              USER
                            </Text>
                            <Text style={[profileStyles.finalScore, { 
                              color: colors.accent, 
                              fontSize: Math.max(15, width * 0.039), 
                              fontWeight: 'bold', 
                              textAlign: 'center' 
                            }]}>
                              {displayRating(movie)}
                            </Text>
                          </View>
                          <View style={{ alignItems: 'center', minWidth: Math.max(32, width * 0.06), marginRight: Math.max(12, width * 0.03) }}>
                            <Text style={[profileStyles.ratingLabel, { 
                              color: '#4CAF50', 
                              fontSize: Math.max(9, width * 0.025), 
                              fontWeight: '600', 
                              textAlign: 'center',
                              numberOfLines: 1
                            }]}>
                              FRIENDS
                            </Text>
                            <Text style={[profileStyles.finalScore, { 
                              color: '#4CAF50', 
                              fontSize: Math.max(15, width * 0.039), 
                              fontWeight: 'bold', 
                              textAlign: 'center' 
                            }]}>
                              {movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A'}
                            </Text>
                          </View>
                        </View>
                        {movie.isUnwatched && (
                          <View style={[profileStyles.unwatchedIndicator, { backgroundColor: colors.primary }]}>
                            <Text style={[profileStyles.unwatchedIndicatorText, { color: colors.accent }]}>
                              Unwatched
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <View style={stateStyles.emptyStateContainer}>
                <Ionicons name="search-outline" size={64} color={colors.subText} />
                <Text style={[stateStyles.emptyStateText, { color: colors.subText }]}>
                  No {mediaType === 'movie' ? 'movies' : 'TV shows'} found for this genre.
                </Text>
                <TouchableOpacity
                  style={[profileStyles.clearFiltersButton, { backgroundColor: colors.primary }]}
                  onPress={clearFilters}
                >
                  <Text style={[profileStyles.clearFiltersButtonText, { color: colors.accent }]}>
                    Show All {mediaType === 'movie' ? 'Movies' : 'TV Shows'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        );
      
      case 'watchlist':
        if (sortedMovies.length === 0) {
          return (
            <View style={[stateStyles.emptyStateContainer, { backgroundColor: colors.background }]}>
              <Ionicons
                name="eye-off-outline"
                size={64}
                color={colors.subText}
              />
              <Text style={[stateStyles.emptyStateText, { color: colors.text }]}>
                Your {mediaType === 'movie' ? 'movie' : 'TV show'} watchlist is empty.
              </Text>
            </View>
          );
        }
        
        return (
          <View style={{ flex: 1, backgroundColor: colors.background }}>
            {/* Genre Filter Section */}
            <View style={[
              profileStyles.filterSection, 
              { 
                borderBottomColor: colors.border.color,
                backgroundColor: colors.background
              }
            ]}>
              <View style={profileStyles.filterHeader}>
                <TouchableOpacity 
                  style={profileStyles.filterTitleContainer}
                  onPress={() => setShowGenreDropdown(!showGenreDropdown)}
                  activeOpacity={0.7}
                >
                  <Text style={[profileStyles.filterTitle, { color: colors.text }]}>
                    Filter by Genre
                  </Text>
                  <Ionicons 
                    name={showGenreDropdown ? "chevron-up" : "chevron-down"} 
                    size={20} 
                    color={colors.subText} 
                  />
                </TouchableOpacity>
                {selectedGenreId !== null && (
                  <TouchableOpacity 
                    style={profileStyles.clearButton}
                    onPress={clearFilters}
                  >
                    <Text style={[profileStyles.clearButtonText, { color: colors.accent }]}>
                      Clear
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              
              {/* Genre Buttons - Show/Hide with Arrow */}
              {showGenreDropdown && (
                <FlatList
                  data={uniqueWatchlistGenreIds}
                  renderItem={renderWatchlistGenreButton}
                  keyExtractor={(item) => item.toString()}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={profileStyles.genreList}
                />
              )}
              
              {selectedGenreId !== null && (
                <View style={profileStyles.activeFilterIndicator}>
                  <Text style={[profileStyles.activeFilterText, { color: colors.subText }]}>
                    Showing: {genres[selectedGenreId] || 'Unknown'} {mediaType === 'movie' ? 'movies' : 'TV shows'}
                  </Text>
                </View>
              )}
            </View>
            
            
            {/* Movie/TV Show List */}
            <ScrollView style={[listStyles.rankingsList, { backgroundColor: colors.background }]}>
              {filteredMovies.map((item, index) => (
                <TouchableOpacity
                  key={item.id}
                  style={[listStyles.rankingItem, { backgroundColor: colors.card }]}
                  onPress={() => handleMovieSelect(item, 'watchlist')}
                  activeOpacity={0.7}
                  accessibilityLabel={`View details for ${item.title || item.name}, rated ${item.score?.toFixed(1) || item.vote_average?.toFixed(1) || 'N/A'}`}
                  accessibilityRole="button"
                  accessibilityHint="Double tap to view movie details and mark as watched"
                >
                  <LinearGradient
                    colors={colors.primaryGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={listStyles.rankingContainer}
                  >
                    <Text style={[listStyles.rankNumber, { color: colors.accent, fontSize: 12 }]}>
                      {index + 1}
                    </Text>
                  </LinearGradient>
                  <Image
                    source={{ uri: getPosterUrl(item.poster || item.poster_path) }}
                    style={listStyles.resultPoster}
                    resizeMode="cover"
                  />
                  <View style={[listStyles.movieDetails, { backgroundColor: colors.card }]}>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[listStyles.resultTitle, { color: colors.text }]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {item.title || item.name || 'Unknown Title'}
                      </Text>
                      <Text
                        style={[listStyles.resultTitle, { color: colors.subText, fontSize: 12, marginTop: 2 }]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        ({(item.release_date || item.first_air_date || '').substring(0, 4) || 'Unknown Year'})
                      </Text>
                      <Text 
                        style={[movieCardStyles.genresText, { color: colors.subText, marginTop: 2 }]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {item.genre_ids && Array.isArray(item.genre_ids) 
                          ? item.genre_ids.slice(0, 2).map(id => (genres && genres[id]) || 'Unknown').join(', ') 
                          : 'Unknown'}
                      </Text>
                    </View>
                    <View style={{ 
                      alignItems: 'flex-start', 
                      justifyContent: 'center', 
                      marginHorizontal: 0, 
                      flex: 0.4, 
                      paddingLeft: 4
                    }}>
                      <View style={{ 
                        flexDirection: 'row', 
                        alignItems: 'center', 
                        justifyContent: 'flex-start', 
                        width: '100%',
                        paddingHorizontal: 0
                      }}>
                        <View style={{ alignItems: 'center', minWidth: Math.max(32, width * 0.06), marginRight: Math.max(8, width * 0.02) }}>
                          <Text style={[profileStyles.ratingLabel, { 
                            color: colors.subText, 
                            fontSize: Math.max(9, width * 0.025), 
                            fontWeight: '600', 
                            textAlign: 'center',
                            numberOfLines: 1
                          }]}>
                            TMDB
                          </Text>
                          <Text style={[profileStyles.finalScore, { 
                            color: colors.accent, 
                            fontSize: Math.max(15, width * 0.039), 
                            fontWeight: 'bold', 
                            textAlign: 'center' 
                          }]}>
                            {item.vote_average ? item.vote_average.toFixed(1) : 'N/A'}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'center', minWidth: Math.max(32, width * 0.06), marginRight: Math.max(12, width * 0.03) }}>
                          <Text style={[profileStyles.ratingLabel, { 
                            color: '#4CAF50', 
                            fontSize: Math.max(9, width * 0.025), 
                            fontWeight: '600', 
                            textAlign: 'center',
                            numberOfLines: 1
                          }]}>
                            FRIENDS
                          </Text>
                          <Text style={[profileStyles.finalScore, { 
                            color: '#4CAF50', 
                            fontSize: Math.max(15, width * 0.039), 
                            fontWeight: 'bold', 
                            textAlign: 'center' 
                          }]}>
                            {item.vote_average ? item.vote_average.toFixed(1) : 'N/A'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        );
      
      default:
        return null;
    }
  };

  // Mock friends data for similarity carousel
  const mockFriends = [
    { id: 1, name: 'Sarah', avatar: null, similarity: 87 },
    { id: 2, name: 'Mike', avatar: null, similarity: 76 },
    { id: 3, name: 'Anna', avatar: null, similarity: 73 },
    { id: 4, name: 'David', avatar: null, similarity: 68 },
    { id: 5, name: 'Lisa', avatar: null, similarity: 65 }
  ];

  // Grid calculations for movie posters
  const GRID_COLUMNS = 5;
  const GRID_PADDING = 16;
  const GRID_GAP = 8;
  const POSTER_WIDTH = (width - (GRID_PADDING * 2) - (GRID_GAP * 4)) / GRID_COLUMNS;
  const POSTER_HEIGHT = POSTER_WIDTH * 1.5;

  // Get top 5 rated movies for grid display
  const topPicksForGrid = useMemo(() => {
    return topRatedContent.slice(0, 5);
  }, [topRatedContent]);

  // Get top 5 watchlist movies sorted by TMDB score
  const watchlistForGrid = useMemo(() => {
    return [...moviesByMediaType]
      .sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0))
      .slice(0, 5);
  }, [moviesByMediaType]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* ThemedHeader with gradient and movie/TV toggle - identical to Home screen */}
      <ThemedHeader mediaType={mediaType} isDarkMode={isDarkMode} theme={theme}>
        <Text style={headerStyles.screenTitle}>Profile</Text>
      </ThemedHeader>

      <SafeAreaView style={[styles.container, { backgroundColor: 'transparent' }]}>
        {/* Settings Button - positioned right below header */}
        <TouchableOpacity 
          style={styles.floatingSettingsButton}
          onPress={() => setShowDropdown(true)}
        >
          <Ionicons name="settings-outline" size={24} color="#fff" />
        </TouchableOpacity>
        
        {/* Search Button - positioned below settings button */}
        <TouchableOpacity 
          style={styles.floatingSearchButton}
          onPress={() => setSearchModalVisible(true)}
        >
          <Ionicons name="search-outline" size={24} color="#fff" />
        </TouchableOpacity>

        {/* Firebase Auth Test Button - positioned below search button */}
        <TouchableOpacity 
          style={styles.floatingFirebaseButton}
          onPress={() => setFirebaseTestVisible(true)}
        >
          <Ionicons name="flame-outline" size={24} color="#fff" />
        </TouchableOpacity>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Profile Info Row */}
        <View style={styles.profileInfoRow}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={24} color="#fff" />
            </View>
          </View>
          <View style={styles.profileTextBlock}>
            <Text style={styles.username}>Movie Buff</Text>
            <Text style={styles.filmCount}>{stats.posts} films rated</Text>
          </View>
        </View>

        {/* Friends Similarity Carousel */}
        <FlatList
          data={mockFriends}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.friendsCarousel}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.friendItem}>
              <View style={styles.friendAvatar}>
                <Ionicons name="person" size={20} color="#DDD" />
              </View>
              <Text style={styles.similarityPercentage}>{item.similarity}%</Text>
            </TouchableOpacity>
          )}
        />

        {/* Top Picks Grid */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Top Picks</Text>
          <View style={styles.movieGrid}>
            {topPicksForGrid.map((movie, index) => (
              <TouchableOpacity
                key={movie.id}
                style={[styles.posterContainer, { width: POSTER_WIDTH, height: POSTER_HEIGHT }]}
                onPress={() => handleMovieSelect(movie, 'toppicks-grid')}
              >
                <Image
                  source={{ uri: getPosterUrl(movie.poster || movie.poster_path) }}
                  style={styles.posterImage}
                  resizeMode="cover"
                />
                <View style={styles.ratingBadge}>
                  <Text style={styles.ratingText}>{displayRating(movie)}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Watchlist Grid */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Watchlist</Text>
          <View style={styles.movieGrid}>
            {watchlistForGrid.map((movie, index) => (
              <TouchableOpacity
                key={movie.id}
                style={[styles.posterContainer, { width: POSTER_WIDTH, height: POSTER_HEIGHT }]}
                onPress={() => handleMovieSelect(movie, 'watchlist-grid')}
              >
                <Image
                  source={{ uri: getPosterUrl(movie.poster || movie.poster_path) }}
                  style={styles.posterImage}
                  resizeMode="cover"
                />
                <View style={styles.ratingBadge}>
                  <Text style={styles.ratingText}>{movie.vote_average?.toFixed(1) || 'N/A'}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Genre Filter Dropdown */}
        <View style={styles.genreFilterContainer}>
          <TouchableOpacity 
            style={styles.genreFilterButton}
            onPress={() => setShowGenreDropdown(!showGenreDropdown)}
          >
            <Text style={styles.genreFilterText}>Filter by Genre</Text>
            <Ionicons 
              name={showGenreDropdown ? "chevron-up" : "chevron-down"} 
              size={20} 
              color="#fff" 
            />
          </TouchableOpacity>
          
          {showGenreDropdown && (
            <FlatList
              data={uniqueGenreIds}
              renderItem={renderGenreButton}
              keyExtractor={(item) => item.toString()}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.genreButtonsList}
            />
          )}
        </View>

        {/* Full Ratings List */}
        <View style={styles.fullListContainer}>
          {filteredAndRankedMovies.length > 0 ? (
            filteredAndRankedMovies.map((movie, index) => (
              <TouchableOpacity
                key={movie.id}
                style={styles.listItem}
                onPress={() => handleMovieSelect(movie, 'fulllist')}
              >
                <Image
                  source={{ uri: getPosterUrl(movie.poster || movie.poster_path) }}
                  style={styles.listPoster}
                  resizeMode="cover"
                />
                <View style={styles.listMovieInfo}>
                  <Text style={styles.listTitle} numberOfLines={1}>
                    {getTitle(movie)}
                  </Text>
                  <Text style={styles.listYear} numberOfLines={1}>
                    ({(movie.release_date || movie.first_air_date || '').substring(0, 4) || 'Unknown'})
                  </Text>
                  <Text style={styles.listGenres} numberOfLines={1}>
                    {movie.genre_ids && Array.isArray(movie.genre_ids) 
                      ? movie.genre_ids.slice(0, 2).map(id => genres[id] || 'Unknown').join(', ') 
                      : 'Unknown'}
                  </Text>
                </View>
                <View style={styles.listRatings}>
                  <View style={styles.ratingColumn}>
                    <Text style={styles.ratingLabel}>USER</Text>
                    <Text style={styles.ratingValue}>{displayRating(movie)}</Text>
                  </View>
                  <View style={styles.ratingColumn}>
                    <Text style={styles.friendsRatingLabel}>FRIENDS</Text>
                    <Text style={styles.friendsRatingValue}>
                      {movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A'}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="film-outline" size={64} color="#666" />
              <Text style={styles.emptyText}>
                No {mediaType === 'movie' ? 'movies' : 'TV shows'} found.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Dropdown Modal */}
      <Modal
        visible={showDropdown}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDropdown(false)}
      >
        <TouchableOpacity 
          style={styles.dropdownOverlay}
          onPress={() => setShowDropdown(false)}
        >
          <View style={styles.dropdownContainer}>
            <TouchableOpacity 
              style={styles.dropdownItem}
              onPress={() => handleDropdownSelect('settings')}
            >
              <Ionicons name="settings-outline" size={20} color="#fff" />
              <Text style={styles.dropdownText}>Settings</Text>
            </TouchableOpacity>
            <View style={styles.dropdownSeparator} />
            <TouchableOpacity 
              style={styles.dropdownItem}
              onPress={() => handleDropdownSelect('logout')}
            >
              <Ionicons name="log-out-outline" size={20} color="#ff4444" />
              <Text style={[styles.dropdownText, { color: '#ff4444' }]}>Logout</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Enhanced Movie Detail Modal - Now used for ALL movie interactions */}
      <Modal
        visible={movieDetailModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeDetailModal}
      >
        <View style={modalStyles.detailModalOverlay}>
          <LinearGradient
            colors={theme[mediaType][isDarkMode ? 'dark' : 'light'].primaryGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={modalStyles.detailModalContent}
          >
            <Image 
              source={{ uri: `https://image.tmdb.org/t/p/w500${selectedMovie?.poster_path || selectedMovie?.poster}` }} 
              style={modalStyles.detailPoster}
              resizeMode="cover" 
            />
            
            <Text style={modalStyles.detailTitle}>
              {selectedMovie?.title || selectedMovie?.name}
            </Text>
            
            <Text style={modalStyles.detailYear}>
              ({selectedMovie?.release_date ? new Date(selectedMovie.release_date).getFullYear() : 
                selectedMovie?.first_air_date ? new Date(selectedMovie.first_air_date).getFullYear() : 'Unknown'})
            </Text>
            
            <Text style={modalStyles.detailScore}>
              {selectedMovie?.userRating ? `Your Rating: ${selectedMovie.userRating.toFixed(1)}` : 
               selectedMovie?.vote_average ? `TMDb: ${selectedMovie.vote_average.toFixed(1)}` : 'N/A'}
            </Text>
            
            {/* Cast Information */}
            {movieCredits && movieCredits.length > 0 && (
              <Text style={modalStyles.detailActors}>
                Actors: {movieCredits.map(actor => actor.name).join(', ')}
              </Text>
            )}
            
            <Text 
              style={modalStyles.detailPlot}
              numberOfLines={4}
              ellipsizeMode="tail"
            >
              {selectedMovie?.overview || 'No description available.'}
            </Text>
            
            <View style={modalStyles.streamingRow}>
              {movieProviders && movieProviders.length > 0 ? (
                deduplicateProviders(movieProviders)
                  .filter(provider => provider.logo_path)
                  .slice(0, 5)
                  .map((provider) => (
                    <Image 
                      key={provider.provider_id}
                      source={{ uri: getProviderLogoUrl(provider.logo_path, provider.provider_id) }}
                      style={modalStyles.platformIcon}
                      resizeMode="contain"
                    />
                  ))
              ) : null}
            </View>
            
            <View style={modalStyles.buttonRow}>
              {/* Dynamic buttons based on context */}
              {movieContext === 'toprated' || movieContext === 'toppicks-grid' || movieContext === 'fulllist' ? (
                // For movies already rated - show Edit Rating button
                <TouchableOpacity 
                  style={[
                    standardButtonStyles.baseButton,
                    standardButtonStyles.primaryButton
                  ]}
                  onPress={() => {
                    closeDetailModal();
                    openEditModal(selectedMovie);
                  }}
                  activeOpacity={0.7}
                >
                  <Text 
                    style={[
                      standardButtonStyles.baseText,
                      standardButtonStyles.primaryText
                    ]}
                  >
                    Edit Rating
                  </Text>
                </TouchableOpacity>
              ) : movieContext === 'watchlist' || movieContext === 'watchlist-grid' ? (
                // For watchlist movies - show Rate and Remove buttons
                <>
                  <TouchableOpacity 
                    style={[
                      standardButtonStyles.baseButton,
                      standardButtonStyles.primaryButton
                    ]}
                    onPress={() => {
                      console.log('🎬 Rate button clicked from enhanced modal');
                      closeDetailModal(true);
                      setEmotionModalVisible(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text 
                      style={[
                        standardButtonStyles.baseText,
                        standardButtonStyles.primaryText
                      ]}
                    >
                      Rate
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[
                      standardButtonStyles.baseButton,
                      standardButtonStyles.tertiaryButton
                    ]}
                    onPress={handleWatchlistToggle}
                    activeOpacity={0.7}
                  >
                    <Text 
                      style={[
                        standardButtonStyles.baseText,
                        standardButtonStyles.tertiaryText
                      ]}
                    >
                      Remove
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                // Default case - show View Details button
                <TouchableOpacity 
                  style={[
                    standardButtonStyles.baseButton,
                    standardButtonStyles.primaryButton
                  ]}
                  onPress={() => {
                    closeDetailModal();
                    navigation.navigate('MovieDetail', {
                      movieId: selectedMovie.id,
                      movieTitle: selectedMovie.title || selectedMovie.name,
                      mediaType: mediaType
                    });
                  }}
                  activeOpacity={0.7}
                >
                  <Text 
                    style={[
                      standardButtonStyles.baseText,
                      standardButtonStyles.primaryText
                    ]}
                  >
                    View Details
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            
            <TouchableOpacity onPress={closeDetailModal} style={modalStyles.cancelButtonContainer}>
              <Text style={modalStyles.cancelText}>cancel</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </Modal>

      {/* User Search Modal */}
      <UserSearchModal
        visible={searchModalVisible}
        onClose={() => setSearchModalVisible(false)}
        currentUserId={currentUserId}
        onUserSelect={(user) => {
          console.log('User selected:', user);
          setSearchModalVisible(false);
          navigation.navigate('PublicProfile', {
            userId: user.id,
            username: user.username,
            displayName: user.displayName
          });
        }}
        isDarkMode={isDarkMode}
      />

      {/* Firebase Auth Test Modal */}
      {firebaseTestVisible && (
        <FirebaseAuthTest 
          onClose={() => setFirebaseTestVisible(false)}
        />
      )}
      
      {/* TopRated Edit Modal */}
      <RatingModal
        visible={editModalVisible}
        onClose={closeEditModal}
        onSubmit={updateRating}
        movie={selectedMovie}
        ratingInput={newRating}
        setRatingInput={setNewRating}
        slideAnim={slideAnim}
        mediaType={mediaType}
        isDarkMode={isDarkMode}
        theme={theme}
        genres={genres}
      />
      
      {/* Watchlist Rating Modal */}
      <RatingModal
        visible={ratingModalVisible}
        onClose={closeRatingModal}
        onSubmit={handleRatingSubmit}
        movie={selectedMovie}
        ratingInput={ratingInput}
        setRatingInput={setRatingInput}
        slideAnim={slideAnim}
        mediaType={mediaType}
        isDarkMode={isDarkMode}
        theme={theme}
        genres={genres}
      />
      
      {/* Enhanced Emotion Selection Modal */}
      <SentimentRatingModal
        visible={emotionModalVisible}
        movie={selectedMovie}
        onClose={() => setEmotionModalVisible(false)}
        onRatingSelect={(movieWithRating, categoryKey, rating) => {
          console.log('🎭 Profile: Sentiment selected via reusable component:', categoryKey, 'Rating:', rating);
          setSelectedCategory(categoryKey);
          handleEmotionSelected(categoryKey);
        }}
        colors={colors}
        userMovies={seen.filter(item => (item.mediaType || 'movie') === mediaType)}
      />
      
      {/* Comparison Modal */}
      <Modal visible={comparisonModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <LinearGradient
            colors={colors.primaryGradient || ['#667eea', '#764ba2']}
            style={[styles.comparisonModalContent]}
          >
            {!isComparisonComplete ? (
              <>
                <View style={styles.comparisonHeader}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>
                    🎬 Comparison {currentComparison + 1}/3
                  </Text>
                  <Text style={[styles.comparisonSubtitle, { color: colors.subText }]}>
                    Which do you prefer?
                  </Text>
                </View>

                <View style={styles.movieComparisonContainer}>
                  {/* New Movie */}
                  <TouchableOpacity 
                    style={styles.movieComparisonCard}
                    onPress={() => handleComparison('new')}
                    activeOpacity={0.8}
                  >
                    <Image
                      source={{ uri: `https://image.tmdb.org/t/p/w500${selectedMovie?.poster_path || selectedMovie?.poster}` }}
                      style={styles.comparisonPoster}
                      resizeMode="cover"
                    />
                    <Text style={[styles.comparisonTitle, { color: colors.text }]} numberOfLines={2}>
                      {selectedMovie?.title || selectedMovie?.name}
                    </Text>
                    <Text style={[styles.comparisonSubtext, { color: colors.subText }]}>
                      New Movie
                    </Text>
                  </TouchableOpacity>

                  <View style={styles.vsContainer}>
                    <Text style={[styles.vsText, { color: colors.accent }]}>VS</Text>
                  </View>

                  {/* Comparison Movie */}
                  <TouchableOpacity 
                    style={styles.movieComparisonCard}
                    onPress={() => handleComparison('comparison')}
                    activeOpacity={0.8}
                  >
                    <Image
                      source={{ uri: `https://image.tmdb.org/t/p/w500${comparisonMovies[currentComparison]?.poster_path}` }}
                      style={styles.comparisonPoster}
                      resizeMode="cover"
                    />
                    <Text style={[styles.comparisonTitle, { color: colors.text }]} numberOfLines={2}>
                      {comparisonMovies[currentComparison]?.title || comparisonMovies[currentComparison]?.name}
                    </Text>
                    <Text style={[styles.comparisonSubtext, { color: colors.subText }]}>
                      Your Rating: {comparisonMovies[currentComparison]?.userRating?.toFixed(1) || 'N/A'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity 
                  style={[styles.tieButton, { backgroundColor: colors.card }]}
                  onPress={() => handleComparison('tie')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.tieButtonText, { color: colors.text }]}>
                    Too Close to Call
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.cancelButton}
                  onPress={() => setComparisonModalVisible(false)}
                >
                  <Text style={[styles.cancelButtonText, { color: colors.subText }]}>Cancel</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.comparisonHeader}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>
                    🎉 Rating Complete!
                  </Text>
                  <Text style={[styles.comparisonSubtitle, { color: colors.subText }]}>
                    Final Rating: {currentMovieRating?.toFixed(1)}/10
                  </Text>
                </View>

                <View style={styles.resultsContainer}>
                  <Text style={[styles.resultsTitle, { color: colors.text }]}>
                    {selectedMovie?.title || selectedMovie?.name}
                  </Text>
                  <Text style={[styles.finalRatingText, { color: colors.accent }]}>
                    {currentMovieRating?.toFixed(1)}/10
                  </Text>
                </View>

                <View style={styles.comparisonButtonRow}>
                  <TouchableOpacity 
                    style={[styles.confirmButton, { backgroundColor: colors.primary }]}
                    onPress={() => handleConfirmRating(currentMovieRating)}
                  >
                    <Text style={[styles.confirmButtonText, { color: colors.accent }]}>
                      Confirm Rating
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </LinearGradient>
        </View>
      </Modal>
      
      {/* Enhanced Filter Modal */}
      <Modal
        visible={filterModalVisible}
        transparent
        animationType="slide"
        onRequestClose={cancelFilters}
      >
        <View style={filterStyles.modalOverlay}>
          <LinearGradient
            colors={colors.primaryGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={filterStyles.enhancedModalContent}
          >
            {/* Modal Header */}
            <View style={filterStyles.modalHeader}>
              <Text style={filterStyles.modalTitle}>
                Filter {mediaType === 'movie' ? 'Movies' : 'TV Shows'}
              </Text>
              <TouchableOpacity
                style={filterStyles.clearAllButton}
                onPress={clearAllFilters}
                activeOpacity={0.7}
              >
                <Text style={filterStyles.clearAllText}>
                  Clear All
                </Text>
              </TouchableOpacity>
            </View>

            <View style={filterStyles.modalScrollContainer}>
              <ScrollView 
                style={filterStyles.modalScrollView} 
                contentContainerStyle={filterStyles.scrollViewContent}
                showsVerticalScrollIndicator={false}
              >
              
              {/* Genre Filter Section */}
              <View style={filterStyles.filterSection}>
                <Text style={filterStyles.sectionTitle}>
                  Filter {mediaType === 'movie' ? 'Movies' : 'TV Shows'}
                </Text>
                <View style={filterStyles.optionsGrid}>
                  {genres && Object.keys(genres).length > 0 ? (
                    Object.entries(genres)
                      .filter(([, name]) => name && name.trim() !== '')
                      .map(([id, name]) => (
                        <TouchableOpacity
                          key={id}
                          style={[
                            filterStyles.optionChip,
                            { 
                              backgroundColor: tempGenres.includes(id)
                                ? '#FFFFFF'
                                : 'transparent',
                              borderColor: '#FFFFFF'
                            }
                          ]}
                          onPress={() => toggleGenre(id)}
                          activeOpacity={0.7}
                        >
                          <Text style={[
                            filterStyles.optionChipText,
                            { 
                              color: tempGenres.includes(id)
                                ? colors.primary
                                : '#FFFFFF'
                            }
                          ]}>
                            {name}
                          </Text>
                        </TouchableOpacity>
                      ))
                  ) : (
                    <Text style={[
                      filterStyles.optionChipText,
                      { color: '#FF6B6B', padding: 10 }
                    ]}>
                      No genres available
                    </Text>
                  )}
                </View>
              </View>

              {/* Decade Filter Section */}
              <View style={filterStyles.filterSection}>
                <Text style={filterStyles.sectionTitle}>
                  Decades ({tempDecades.length} selected)
                </Text>
                <View style={filterStyles.optionsGrid}>
                  {DECADES.map((decade) => (
                    <TouchableOpacity
                      key={decade.value}
                      style={[
                        filterStyles.optionChip,
                        { 
                          backgroundColor: tempDecades.includes(decade.value)
                            ? '#FFFFFF'
                            : 'transparent',
                          borderColor: '#FFFFFF'
                        }
                      ]}
                      onPress={() => toggleDecade(decade.value)}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        filterStyles.optionChipText,
                        { 
                          color: tempDecades.includes(decade.value)
                            ? colors.primary
                            : '#FFFFFF'
                        }
                      ]}>
                        {decade.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Streaming Services Filter Section */}
              <View style={filterStyles.filterSection}>
                <Text style={filterStyles.sectionTitle}>
                  Streaming Services ({tempStreamingServices.length} selected)
                </Text>
                <View style={filterStyles.optionsGrid}>
                  {streamingProviders.map((service) => (
                    <TouchableOpacity
                      key={service.id}
                      style={[
                        filterStyles.streamingChip,
                        { 
                          backgroundColor: tempStreamingServices.includes(service.id.toString())
                            ? '#FFFFFF'
                            : 'transparent',
                          borderColor: '#FFFFFF'
                        }
                      ]}
                      onPress={() => toggleStreamingService(service.id)}
                      activeOpacity={0.7}
                    >
                      {service.logo_url ? (
                        <Image
                          source={{ uri: service.logo_url }}
                          style={filterStyles.streamingLogoImage}
                          resizeMode="contain"
                        />
                      ) : (
                        <View style={filterStyles.streamingLogoPlaceholder}>
                          <Text style={filterStyles.streamingLogoText}>
                            {service.name.charAt(0)}
                          </Text>
                        </View>
                      )}
                      <Text style={[
                        filterStyles.streamingText,
                        { 
                          color: tempStreamingServices.includes(service.id.toString())
                            ? colors.primary
                            : '#FFFFFF'
                        }
                      ]}>
                        {service.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

            </ScrollView>
            </View>
            
            {/* Modal Action Buttons */}
           <View style={filterStyles.modalButtons}>
             <TouchableOpacity
               style={[
                 filterStyles.cancelButton,
                 { borderColor: '#FFFFFF' }
               ]}
               onPress={cancelFilters}
             >
               <Text style={[
                 filterStyles.cancelButtonText,
                 { color: '#FFFFFF' }
               ]}>
                 Cancel
               </Text>
             </TouchableOpacity>
             <TouchableOpacity
               style={[
                 filterStyles.applyButton,
                 { backgroundColor: '#FFFFFF' }
               ]}
               onPress={applyFilters}
             >
               <Text style={[
                 filterStyles.applyButtonText,
                 { color: colors.primary }
               ]}>
                 Apply Filters
               </Text>
             </TouchableOpacity>
           </View>
         </LinearGradient>
       </View>
     </Modal>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  floatingSettingsButton: {
    position: 'absolute',
    top: 10, // Right below header
    right: 20,
    zIndex: 100,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 8,
  },
  floatingSearchButton: {
    position: 'absolute',
    top: 60, // Below settings button 
    right: 20,
    zIndex: 100,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 8,
  },
  floatingFirebaseButton: {
    position: 'absolute',
    top: 110, // Below search button
    right: 20,
    zIndex: 100,
    backgroundColor: 'rgba(255, 69, 0, 0.7)', // Firebase orange
    borderRadius: 20,
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  profileInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  avatarContainer: {
    marginRight: 15,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#666',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileTextBlock: {
    flex: 1,
  },
  username: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  filmCount: {
    fontSize: 14,
    color: '#ccc',
  },
  friendsCarousel: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  friendItem: {
    alignItems: 'center',
    marginRight: 20,
  },
  friendAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#444',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  similarityPercentage: {
    fontSize: 12,
    color: '#fff',
    fontWeight: 'bold',
  },
  sectionContainer: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
  },
  movieGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  posterContainer: {
    marginBottom: 10,
    borderRadius: 8,
    overflow: 'hidden',
  },
  posterImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  ratingBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  ratingText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  genreFilterContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  genreFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    marginBottom: 10,
  },
  genreFilterText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  genreButtonsList: {
    paddingHorizontal: 0,
  },
  fullListContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  listPoster: {
    width: 60,
    height: 90,
    borderRadius: 6,
    marginRight: 12,
  },
  listMovieInfo: {
    flex: 1,
    marginRight: 10,
  },
  listTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  listYear: {
    color: '#ccc',
    fontSize: 14,
    marginBottom: 4,
  },
  listGenres: {
    color: '#999',
    fontSize: 12,
  },
  listRatings: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingColumn: {
    alignItems: 'center',
    marginLeft: 12,
  },
  ratingLabel: {
    color: '#ccc',
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  ratingValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  friendsRatingLabel: {
    color: '#4CAF50',
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  friendsRatingValue: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: '#999',
    fontSize: 16,
    marginTop: 10,
    textAlign: 'center',
  },
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 100,
    paddingRight: 20,
  },
  dropdownContainer: {
    backgroundColor: '#333',
    borderRadius: 8,
    minWidth: 150,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  dropdownText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 8,
  },
  dropdownSeparator: {
    height: 1,
    backgroundColor: '#555',
    marginHorizontal: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  comparisonModalContent: {
    width: '90%',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    maxHeight: '80%',
  },
  comparisonHeader: {
    alignItems: 'center',
    marginBottom: 30,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  comparisonSubtitle: {
    fontSize: 16,
    opacity: 0.8,
  },
  movieComparisonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 20,
  },
  movieComparisonCard: {
    alignItems: 'center',
    flex: 1,
    maxWidth: 120,
  },
  comparisonPoster: {
    width: 100,
    height: 150,
    borderRadius: 12,
    marginBottom: 10,
  },
  comparisonTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  comparisonSubtext: {
    fontSize: 12,
    textAlign: 'center',
    opacity: 0.7,
  },
  vsContainer: {
    paddingHorizontal: 15,
  },
  vsText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  tieButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 15,
  },
  tieButtonText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  cancelButton: {
    paddingVertical: 8,
  },
  cancelButtonText: {
    fontSize: 14,
    textAlign: 'center',
  },
  resultsContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  resultsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  finalRatingText: {
    fontSize: 36,
    fontWeight: 'bold',
  },
  comparisonButtonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
  },
  confirmButton: {
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 8,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

const filterStyles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  enhancedModalContent: {
    width: '90%',
    maxHeight: '80%',
    borderRadius: 12,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  clearAllButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 6,
  },
  clearAllText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalScrollContainer: {
    flex: 1,
    maxHeight: 400,
  },
  modalScrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingBottom: 20,
  },
  filterSection: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
    marginBottom: 8,
  },
  optionChipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  streamingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
    marginBottom: 8,
  },
  streamingLogoImage: {
    width: 20,
    height: 20,
    marginRight: 6,
    borderRadius: 4,
  },
  streamingLogoPlaceholder: {
    width: 20,
    height: 20,
    borderRadius: 4,
    backgroundColor: '#666',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  streamingLogoText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  streamingText: {
    fontSize: 14,
    fontWeight: '500',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  applyButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

const profileStyles = StyleSheet.create({
  genreButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
    marginBottom: 8,
  },
  selectedGenreButton: {
    borderWidth: 2,
  },
  genreButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  filterSection: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  filterTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  filterTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clearButton: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    backgroundColor: 'transparent',
    borderRadius: 12,
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  rankingOptionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  rankingOption: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
  },
  selectedRankingOption: {
    borderWidth: 2,
  },
  rankingOptionText: {
    fontSize: 13,
    fontWeight: '500',
  },
  unwatchedToggleContainer: {
    marginTop: 8,
  },
  unwatchedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  selectedUnwatchedToggle: {
    borderWidth: 2,
  },
  unwatchedToggleText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  genreList: {
    paddingVertical: 8,
  },
  activeFilterIndicator: {
    paddingTop: 8,
    paddingBottom: 4,
  },
  activeFilterText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  ratingLabel: {
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 2,
  },
  finalScore: {
    fontSize: 15,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  unwatchedIndicator: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    marginTop: 4,
  },
  unwatchedIndicatorText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  clearFiltersButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 16,
    alignItems: 'center',
  },
  clearFiltersButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default ProfileScreen;