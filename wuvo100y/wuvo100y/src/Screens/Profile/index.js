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
import { getHomeStyles } from '../../Styles/homeStyles';
import stateStyles from '../../Styles/StateStyles';
import theme from '../../utils/Theme';
import UserSearchModal from '../../Components/UserSearchModal';
import { useAuth } from '../../hooks/useAuth';
import FirebaseAuthTest from '../../Components/FirebaseAuthTest';
// RatingModal replaced with EnhancedRatingSystem components
import { 
  SentimentRatingModal, 
  calculateDynamicRatingCategories,
  selectMovieFromPercentileUnified,
  calculateAverageRating
} from '../../Components/EnhancedRatingSystem';
import MovieCard, { MOVIE_CARD_WIDTH } from '../../Components/MovieCard/MovieCard';
import MovieDetailModal from '../../Components/MovieDetailModal/MovieDetailModal';
import { calculatePairwiseRating, ComparisonResults, selectOpponentFromEmotion } from '../../Components/EnhancedRatingSystem';
import { filterAdultContent } from '../../utils/ContentFiltering';
import { movieUtils } from '../../utils/movieUtils';
import { formatUtils } from '../../utils/formatUtils';
import { StreamingProviders } from '../../Components/StreamingProviders';
import { TMDB_API_KEY, API_TIMEOUT, STREAMING_SERVICES, DECADES, STREAMING_SERVICES_PRIORITY } from '../../Constants';
import { ENV } from '../../config/environment';

const POSTER_SIZE = (width - 60) / 3; // 3 columns with spacing

const ProfileScreen = ({ seen = [], unseen = [], seenTVShows = [], unseenTVShows = [], isDarkMode, navigation, onUpdateRating, onAddToSeen, onRemoveFromWatchlist, genres, route }) => {
  const { mediaType } = useMediaType();
  const { handleLogout, userInfo } = useAuth();
  const modalStyles = getModalStyles(mediaType, isDarkMode ? 'dark' : 'light', theme);
  const layoutStyles = getLayoutStyles(mediaType, isDarkMode ? 'dark' : 'light', theme);
  const headerStyles = getHeaderStyles(mediaType, isDarkMode ? 'dark' : 'light', theme);
  const homeStyles = getHomeStyles(mediaType, isDarkMode ? 'dark' : 'light', theme);
  const listStyles = getListStyles(mediaType, isDarkMode ? 'dark' : 'light', theme);
  const movieCardStyles = getMovieCardStyles(mediaType, isDarkMode ? 'dark' : 'light', theme);
  const colors = theme[mediaType][isDarkMode ? 'dark' : 'light'];
  const standardButtonStyles = getStandardizedButtonStyles(colors);
  
  // Always use movie theme colors for comparison modal to maintain consistency
  const comparisonModalColors = theme.movie[isDarkMode ? 'dark' : 'light'];
  
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
  
  // TopRated functionality - now uses EnhancedRatingButton instead of modal
  const [selectedGenreId, setSelectedGenreId] = useState(null);
  
  // Watchlist functionality state
  // Removed ratingModalVisible - watchlist now uses EnhancedRatingButton
  const [ratingInput, setRatingInput] = useState('');
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  
  // Modal states for "See All" functionality
  const [topMoviesModalVisible, setTopMoviesModalVisible] = useState(false);
  const [watchlistModalVisible, setWatchlistModalVisible] = useState(false);
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [selectedDecades, setSelectedDecades] = useState([]);
  const [selectedStreamingServices, setSelectedStreamingServices] = useState([]);
  const [tempGenres, setTempGenres] = useState([]);
  const [tempDecades, setTempDecades] = useState([]);
  const [tempStreamingServices, setTempStreamingServices] = useState([]);
  
  // Advanced Filters modal state
  const [advancedFiltersModalVisible, setAdvancedFiltersModalVisible] = useState(false);
  const [selectedPaymentTypes, setSelectedPaymentTypes] = useState([]); // 'free', 'paid'
  const [selectedStreamingProviders, setSelectedStreamingProviders] = useState([]);
  const [tempPaymentTypes, setTempPaymentTypes] = useState([]);
  const [tempStreamingProviders, setTempStreamingProviders] = useState([]);
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
    setSelectedPaymentTypes([]);
    setSelectedStreamingProviders([]);
  }, [mediaType]);

  // Filter content by current media type - CODE_BIBLE: Use both movie and TV data
  const currentSeen = useMemo(() => {
    if (mediaType === 'movie') {
      return seen.filter(item => (item.mediaType || 'movie') === 'movie');
    } else {
      return seenTVShows.filter(item => (item.mediaType || 'tv') === 'tv');
    }
  }, [seen, seenTVShows, mediaType]);

  const currentUnseen = useMemo(() => {
    if (mediaType === 'movie') {
      return unseen.filter(item => (item.mediaType || 'movie') === 'movie');
    } else {
      return unseenTVShows.filter(item => (item.mediaType || 'tv') === 'tv');
    }
  }, [unseen, unseenTVShows, mediaType]);

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
    const totalRated = movieUtils.getMovieCount(currentSeen);
    const averageRating = totalRated > 0 
      ? currentSeen.reduce((sum, item) => sum + (item.userRating || 0), 0) / totalRated 
      : 0;
    const watchlistSize = movieUtils.getMovieCount(currentUnseen);

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
      
      // Apply advanced filters (payment type & streaming services)
      if (selectedPaymentTypes.length > 0 || selectedStreamingProviders.length > 0) {
        filtered = filtered.filter(movie => {
          // Note: In a real app, you would fetch streaming data for each movie
          // For now, this is a placeholder that shows the filtering structure
          // You would need to modify handleMovieSelect to fetch and store provider data
          if (!movie.streamingProviders) return true; // Show all if no provider data
          
          let passesPaymentFilter = selectedPaymentTypes.length === 0;
          let passesProviderFilter = selectedStreamingProviders.length === 0;
          
          if (selectedPaymentTypes.length > 0) {
            const hasFree = selectedPaymentTypes.includes('free') && 
              movie.streamingProviders.some(p => p.type === 'flatrate');
            const hasPaid = selectedPaymentTypes.includes('paid') && 
              movie.streamingProviders.some(p => p.type === 'rent' || p.type === 'buy');
            passesPaymentFilter = hasFree || hasPaid;
          }
          
          if (selectedStreamingProviders.length > 0) {
            passesProviderFilter = movie.streamingProviders.some(p => 
              selectedStreamingProviders.includes(p.provider_id.toString())
            );
          }
          
          return passesPaymentFilter && passesProviderFilter;
        });
      }
      
      filtered = filtered.sort((a, b) => {
        if (a.userRating !== undefined && b.userRating !== undefined) {
          return b.userRating - a.userRating;
        }
        return b.eloRating - a.eloRating;
      });
    }
    
    return filtered.slice(0, 10);
  }, [mediaFilteredMovies, selectedGenreId, selectedPaymentTypes, selectedStreamingProviders, mediaType, isOwnProfile, selectedTab, selectedRankingType, showUnwatchedMovies, currentUnseen]);

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

    // Apply advanced filters (payment type & streaming services from new modal)
    if (selectedPaymentTypes.length > 0 || selectedStreamingProviders.length > 0) {
      filtered = filtered.filter(movie => {
        // Note: In a real app, you would fetch streaming data for each movie
        // For now, this is a placeholder that shows the filtering structure
        if (!movie.streamingProviders) return true; // Show all if no provider data
        
        let passesPaymentFilter = selectedPaymentTypes.length === 0;
        let passesProviderFilter = selectedStreamingProviders.length === 0;
        
        if (selectedPaymentTypes.length > 0) {
          const hasFree = selectedPaymentTypes.includes('free') && 
            movie.streamingProviders.some(p => p.type === 'flatrate');
          const hasPaid = selectedPaymentTypes.includes('paid') && 
            movie.streamingProviders.some(p => p.type === 'rent' || p.type === 'buy');
          passesPaymentFilter = hasFree || hasPaid;
        }
        
        if (selectedStreamingProviders.length > 0) {
          passesProviderFilter = movie.streamingProviders.some(p => 
            selectedStreamingProviders.includes(p.provider_id.toString())
          );
        }
        
        return passesPaymentFilter && passesProviderFilter;
      });
    }

    return filtered;
  }, [selectedGenres, selectedDecades, selectedStreamingServices, selectedPaymentTypes, selectedStreamingProviders, selectedGenreId, sortedMovies, mediaType]);

  const hasActiveFilters = selectedGenres.length > 0 || selectedDecades.length > 0 || selectedStreamingServices.length > 0 || selectedPaymentTypes.length > 0 || selectedStreamingProviders.length > 0;

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

  const deduplicateProviders = useCallback((providers) => {
    if (!providers || !Array.isArray(providers)) return [];
    
    const seen = new Set();
    const filtered = [];
    
    for (const provider of providers) {
      const normalizedName = provider.provider_name.toLowerCase();
      if (!seen.has(normalizedName)) {
        seen.add(normalizedName);
        filtered.push(provider);
      }
    }
    
    return filtered;
  }, []);

  // SECURITY: Secure image URL generation with validation
  const getSecureImageUrl = useCallback((path, size = 'w92') => {
    if (!path || typeof path !== 'string') return null;
    
    const cleanPath = path.trim();
    const cleanSize = size.trim();
    
    // Validate path format
    if (cleanPath.includes('..') || cleanPath.includes('<') || cleanPath.includes('>') || 
        cleanPath.includes('script') || cleanPath.includes('javascript:') ||
        cleanPath.length > 100 || !cleanPath.startsWith('/')) {
      console.warn('🚨 SECURITY: Suspicious image path blocked in Profile:', cleanPath);
      return null;
    }
    
    // Validate size parameter
    const allowedSizes = ['w92', 'w154', 'w185', 'w342', 'w500', 'w780', 'original'];
    if (!allowedSizes.includes(cleanSize)) {
      console.warn('🚨 SECURITY: Invalid image size blocked in Profile:', cleanSize);
      return null;
    }
    
    return `https://image.tmdb.org/t/p/${cleanSize}${cleanPath}`;
  }, []);

  const getProviderLogoUrl = useCallback((logoPath) => {
    return getSecureImageUrl(logoPath, 'w92');
  }, [getSecureImageUrl]);

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
            logo_url: getSecureImageUrl(provider.logo_path, 'w92')
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
    // If path already includes https:// it's a full URL (but validate it)
    if (path.startsWith('http')) {
      // SECURITY: Only allow trusted domains
      if (path.startsWith('https://image.tmdb.org/') || path.startsWith('https://via.placeholder.com/')) {
        return path;
      } else {
        console.warn('🚨 SECURITY: Untrusted image URL blocked:', path);
        return 'https://via.placeholder.com/342x513/333/fff?text=Invalid+URL';
      }
    }
    return getSecureImageUrl(path, 'w342');
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

  // Removed closeEditModal and updateRating - now handled by EnhancedRatingButton components

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
    setSelectedPaymentTypes([]);
    setSelectedStreamingProviders([]);
  }, []);

  const getTitle = useCallback((item) => {
    return item.title || item.name || 'Unknown Title';
  }, []);

  // Watchlist handlers
  // Removed openRatingModal, closeRatingModal, handleRatingSubmit - watchlist now uses EnhancedRatingButton

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
    setTempPaymentTypes([]);
    setTempStreamingProviders([]);
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

  const handleCloseEnhancedModals = useCallback(() => {
    setComparisonModalVisible(false);
    setSelectedCategory(null);
    setComparisonMovies([]);
    setCurrentComparison(0);
    setComparisonResults([]);
    setIsComparisonComplete(false);
    setFinalCalculatedRating(null);
  }, []);
  
  // Select movie from percentile based on emotion (from Home screen logic)
  const selectMovieFromPercentile = useCallback((seenMovies, emotion) => {
    // Use unified percentile selection function
    return selectMovieFromPercentileUnified(seenMovies, emotion, {
      enhancedLogging: true
    });
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
      const errorData = formatUtils.getMinimumRatingError(
        movieUtils.getMovieCount(seen, 'movie'),
        'movie',
        3
      );
      Alert.alert(errorData.title, errorData.message, errorData.buttons);
      return;
    }
    
    // Select second and third opponents randomly from all seen movies (for known vs known)
    const remainingMovies = seen.filter(movie => movie.id !== firstOpponent.id);
    
    if (remainingMovies.length < 2) {
      console.log('❌ NOT ENOUGH REMAINING MOVIES');
      const errorData = formatUtils.getMinimumRatingError(
        movieUtils.getMovieCount(seen, 'movie'),
        'movie',
        3
      );
      Alert.alert(errorData.title, errorData.message, errorData.buttons);
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
      // Rounds 2-3: Known vs Known - Use centralized ELO calculation
      const currentRating = currentMovieRating;
      const opponentRating = currentComparisonMovie.userRating;
      
      // Determine comparison result
      let result;
      if (winner === 'new') {
        result = ComparisonResults.A_WINS;
      } else if (winner === 'comparison') {
        result = ComparisonResults.B_WINS;  
      } else if (winner === 'tie') {
        result = ComparisonResults.TIE;
      }
      
      // Use centralized pairwise calculation
      const pairwiseResult = calculatePairwiseRating({
        aRating: currentRating,
        bRating: opponentRating,
        aGames: currentComparison,
        bGames: currentComparisonMovie.gamesPlayed || 0,
        result: result
      });
      
      const adjustedRating = pairwiseResult.updatedARating;
      setCurrentMovieRating(adjustedRating);
      
      console.log(`🎯 ROUND ${currentComparison + 1} CENTRALIZED ELO: ${selectedMovie?.title} rating: ${currentRating} → ${adjustedRating} (${winner} vs ${currentComparisonMovie.title})`);
      
      setComparisonResults(prev => [...prev, { winner, opponentRating, newRating: adjustedRating }]);
      
      if (currentComparison === 2) {
        // All comparisons complete
        setIsComparisonComplete(true);
      } else {
        setCurrentComparison(currentComparison + 1);
      }
    }
  }, [comparisonMovies, currentComparison, currentMovieRating, selectedMovie, selectedEmotion]);

  // ✅ CONSOLIDATED: Removed custom ELO implementation - now uses centralized calculatePairwiseRating

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
                <View>
                  <FlatList
                    data={uniqueGenreIds}
                    renderItem={renderGenreButton}
                    keyExtractor={(item) => item.toString()}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={profileStyles.genreList}
                  />
                  
                  {/* Advanced Filters Button */}
                  <TouchableOpacity 
                    style={[profileStyles.advancedFiltersButton, { backgroundColor: colors.accent + '20', borderColor: colors.accent }]}
                    onPress={() => {
                      setAdvancedFiltersModalVisible(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons 
                      name="options-outline" 
                      size={18} 
                      color={colors.accent} 
                      style={{ marginRight: 8 }}
                    />
                    <Text style={[profileStyles.advancedFiltersText, { color: colors.accent }]}>
                      Advanced Filters
                    </Text>
                  </TouchableOpacity>
                </View>
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
                    <LinearGradient
                      colors={colors.primaryGradient}
                      style={{
                        padding: 1,
                        borderRadius: 4,
                        width: 50,
                        height: 75
                      }}
                    >
                      <Image
                        source={{ uri: getPosterUrl(movie.poster || movie.poster_path) }}
                        style={[listStyles.resultPoster, { width: 48, height: 73 }]}
                        resizeMode="cover"
                      />
                    </LinearGradient>
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
                  <LinearGradient
                    colors={colors.primaryGradient}
                    style={{
                      padding: 1,
                      borderRadius: 4,
                      width: 50,
                      height: 75
                    }}
                  >
                    <Image
                      source={{ uri: getPosterUrl(item.poster || item.poster_path) }}
                      style={[listStyles.resultPoster, { width: 48, height: 73 }]}
                      resizeMode="cover"
                    />
                  </LinearGradient>
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

  // Movie card dimensions matching Home screen
  const MOVIE_CARD_WIDTH = (width - 48) / 2.2;

  // Get top 10 rated movies for grid display
  const topPicksForGrid = useMemo(() => {
    return topRatedContent.slice(0, 10); // Show only top 10 in horizontal list
  }, [topRatedContent]);

  // Get top 10 watchlist movies sorted by TMDB score
  const watchlistForGrid = useMemo(() => {
    return [...currentUnseen]
      .sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0))
      .slice(0, 10); // Show only top 10 in horizontal list
  }, [currentUnseen]);

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

        {/* Top Picks - Single Line with Home Screen Style */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Top {mediaType === 'movie' ? 'Movies' : 'TV Shows'}</Text>
            <TouchableOpacity 
              onPress={() => setTopMoviesModalVisible(true)}
              style={styles.seeAllButton}
            >
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={topPicksForGrid}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16 }}
            keyExtractor={item => item.id.toString()}
            removeClippedSubviews={false}
            renderItem={({ item, index }) => (
              <MovieCard
                item={item}
                handleMovieSelect={(movie) => handleMovieSelect(movie, 'toppicks-grid')}
                handleNotInterested={handleNotInterested}
                mediaType={mediaType}
                isDarkMode={isDarkMode}
                rankingNumber={index + 1}
              />
            )}
          />
        </View>

        {/* Watchlist - Single Line with Home Screen Style */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Watchlist</Text>
            <TouchableOpacity 
              onPress={() => setWatchlistModalVisible(true)}
              style={styles.seeAllButton}
            >
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={watchlistForGrid}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16 }}
            keyExtractor={item => item.id.toString()}
            removeClippedSubviews={false}
            renderItem={({ item }) => (
              <MovieCard
                item={item}
                handleMovieSelect={(movie) => handleMovieSelect(movie, 'watchlist-grid')}
                handleNotInterested={handleNotInterested}
                mediaType={mediaType}
                isDarkMode={isDarkMode}
              />
            )}
          />
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

      {/* Movie Detail Modal - Now uses standardized component */}
      <MovieDetailModal
        visible={movieDetailModalVisible}
        selectedMovie={selectedMovie}
        movieCredits={movieCredits}
        isLoadingMovieDetails={isLoadingMovieDetails}
        mediaType={mediaType}
        isDarkMode={isDarkMode}
        showSentimentButtons={false}
        closeDetailModal={closeDetailModal}
        handleNotInterested={handleNotInterested}
        handleRateButton={() => {
          console.log('🎬 Rate button clicked from Profile modal');
          closeDetailModal(true);
          setEmotionModalVisible(true);
        }}
        handleWatchlistToggle={handleWatchlistToggle}
        colors={theme[mediaType][isDarkMode ? 'dark' : 'light']}
        standardButtonStyles={getStandardizedButtonStyles(theme[mediaType][isDarkMode ? 'dark' : 'light'])}
        memoizedRatingCategories={null}
        handleEmotionSelected={null}
        cancelSentimentSelection={null}
      />

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
      
      {/* TopRated Edit Modal - now uses EnhancedRatingButton components */}
      
      {/* Top Movies Modal */}
      <Modal visible={topMoviesModalVisible} transparent animationType="fade">
        <View style={modalStyles.modalOverlay}>
          <View style={[modalStyles.modalContent, { 
          backgroundColor: colors.background,
          flex: 0,
          height: '90%',
          width: '90%'
        }]}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={() => setTopMoviesModalVisible(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
              <Text style={[modalStyles.modalTitle, { color: colors.text }]}>Top Movies</Text>
              <View style={{ width: 24 }} />
            </View>
            
            {/* Genre Filter Section - Same as main profile */}
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
                <View>
                  <FlatList
                    data={uniqueGenreIds}
                    renderItem={renderGenreButton}
                    keyExtractor={(item) => item.toString()}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={profileStyles.genreList}
                  />
                  
                  {/* Advanced Filters Button */}
                  <TouchableOpacity 
                    style={[profileStyles.advancedFiltersButton, { backgroundColor: colors.accent + '20', borderColor: colors.accent }]}
                    onPress={() => {
                      setAdvancedFiltersModalVisible(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons 
                      name="options-outline" 
                      size={18} 
                      color={colors.accent} 
                      style={{ marginRight: 8 }}
                    />
                    <Text style={[profileStyles.advancedFiltersText, { color: colors.accent }]}>
                      Advanced Filters
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
              
              {selectedGenreId !== null && (
                <View style={profileStyles.activeFilterIndicator}>
                  <Text style={[profileStyles.activeFilterText, { color: colors.subText }]}>
                    Showing: {genres[selectedGenreId] || 'Unknown'} {mediaType === 'movie' ? 'movies' : 'TV shows'}
                  </Text>
                </View>
              )}
            </View>
            
            {/* Rankings List - Show ALL movies, not just top 10 */}
            {(selectedGenreId === null ? mediaFilteredMovies : 
              mediaFilteredMovies.filter(movie => movie.genre_ids && movie.genre_ids.includes(selectedGenreId))
            ).length > 0 ? (
              <ScrollView style={[listStyles.rankingsList, { backgroundColor: colors.background }]}>
                {mediaFilteredMovies
                  .filter(movie => {
                    // Genre filter
                    if (selectedGenreId !== null && (!movie.genre_ids || !movie.genre_ids.includes(selectedGenreId))) {
                      return false;
                    }
                    
                    // Advanced filters (only apply if any are selected)
                    if (selectedPaymentTypes.length > 0 || selectedStreamingProviders.length > 0) {
                      if (!movie.streamingProviders) return false; // Skip if no provider data
                      
                      let passesPaymentFilter = selectedPaymentTypes.length === 0;
                      let passesProviderFilter = selectedStreamingProviders.length === 0;
                      
                      if (selectedPaymentTypes.length > 0) {
                        const hasFree = selectedPaymentTypes.includes('free') && 
                          movie.streamingProviders.some(p => p.type === 'flatrate');
                        const hasPaid = selectedPaymentTypes.includes('paid') && 
                          movie.streamingProviders.some(p => p.type === 'rent' || p.type === 'buy');
                        passesPaymentFilter = hasFree || hasPaid;
                      }
                      
                      if (selectedStreamingProviders.length > 0) {
                        passesProviderFilter = movie.streamingProviders.some(p => 
                          selectedStreamingProviders.includes(p.provider_id.toString())
                        );
                      }
                      
                      if (!passesPaymentFilter || !passesProviderFilter) {
                        return false;
                      }
                    }
                    
                    return true;
                  })
                  .sort((a, b) => {
                    if (a.userRating !== undefined && b.userRating !== undefined) {
                      return b.userRating - a.userRating;
                    }
                    return b.eloRating - a.eloRating;
                  })
                  .map((movie, index) => (
                  <TouchableOpacity
                    key={movie.id}
                    style={[listStyles.rankingItem, { backgroundColor: colors.card }]}
                    onPress={() => {
                      setTopMoviesModalVisible(false);
                      handleMovieSelect(movie, 'toprated');
                    }}
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
                    <LinearGradient
                      colors={colors.primaryGradient}
                      style={{
                        padding: 1,
                        borderRadius: 4,
                        width: 50,
                        height: 75
                      }}
                    >
                      <Image
                        source={{ uri: getPosterUrl(movie.poster || movie.poster_path) }}
                        style={[listStyles.resultPoster, { width: 48, height: 73 }]}
                        resizeMode="cover"
                      />
                    </LinearGradient>
                    <View style={[listStyles.movieDetails, { backgroundColor: colors.card }]}>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[listStyles.resultTitle, { color: colors.text }]}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {getTitle(movie)}
                        </Text>
                        <Text style={[styles.listGenres, { color: colors.subText }]} numberOfLines={1}>
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
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <View style={[stateStyles.emptyStateContainer, { backgroundColor: colors.background }]}>
                <Ionicons name={mediaType === 'movie' ? 'film-outline' : 'tv-outline'} size={64} color={colors.subText} />
                <Text style={[stateStyles.emptyStateText, { color: colors.subText }]}>
                  No {selectedGenreId ? genres[selectedGenreId] : ''} {mediaType === 'movie' ? 'movies' : 'TV shows'} found.
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
      
      {/* Watchlist Modal */}
      <Modal visible={watchlistModalVisible} transparent animationType="fade">
        <View style={modalStyles.modalOverlay}>
          <View style={[modalStyles.modalContent, { 
          backgroundColor: colors.background,
          flex: 0,
          height: '90%',
          width: '90%'
        }]}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={() => setWatchlistModalVisible(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
              <Text style={[modalStyles.modalTitle, { color: colors.text }]}>Watchlist</Text>
              <View style={{ width: 24 }} />
            </View>
            
            {/* Advanced Filter Section - Same as main profile watchlist */}
            <View style={[
              profileStyles.filterSection, 
              { 
                borderBottomColor: colors.border.color,
                backgroundColor: colors.background
              }
            ]}>
              <View style={profileStyles.filterHeader}>
                <Text style={[profileStyles.filterTitle, { color: colors.text }]}>
                  Advanced Filters
                </Text>
                <TouchableOpacity 
                  style={profileStyles.filterButton}
                  onPress={openFilterModal}
                  activeOpacity={0.7}
                >
                  <Ionicons name="options-outline" size={20} color={colors.accent} />
                  <Text style={[profileStyles.filterButtonText, { color: colors.accent }]}>
                    Filter
                  </Text>
                  {hasActiveFilters && (
                    <View style={[profileStyles.filterIndicator, { backgroundColor: colors.accent }]} />
                  )}
                </TouchableOpacity>
              </View>
              
              {/* Active Filters Display */}
              {hasActiveFilters && (
                <View style={profileStyles.activeFiltersContainer}>
                  <Text style={[profileStyles.activeFiltersText, { color: colors.subText }]}>
                    Active filters: {[
                      selectedGenres.length > 0 && `${selectedGenres.length} genres`,
                      selectedDecades.length > 0 && `${selectedDecades.length} decades`, 
                      selectedStreamingServices.length > 0 && `${selectedStreamingServices.length} services`
                    ].filter(Boolean).join(', ')}
                  </Text>
                </View>
              )}
            </View>
            
            {/* Genre Filter with Dropdown */}
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

              {/* Advanced Filters Button - Show when genre dropdown is expanded */}
              {showGenreDropdown && (
                <TouchableOpacity
                  style={styles.advancedFiltersButton}
                  onPress={() => {
                    console.log('Advanced Filters button clicked');
                    setTempPaymentTypes(selectedPaymentTypes);
                    setTempStreamingProviders(selectedStreamingProviders);
                    setAdvancedFiltersModalVisible(true);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.advancedFiltersButtonText, { color: colors.accent }]}>
                    Advanced Filters
                  </Text>
                  <Ionicons name="filter-outline" size={16} color={colors.accent} style={{ marginLeft: 6 }} />
                </TouchableOpacity>
              )}
            </View>
            
            {/* Watchlist Rankings List - Show ALL watchlist movies */}
            {moviesByMediaType
              .filter(movie => {
                // Genre filter
                if (selectedGenreId !== null && (!movie.genre_ids || !movie.genre_ids.includes(selectedGenreId))) {
                  return false;
                }
                
                // Advanced filters (only apply if any are selected)
                if (selectedPaymentTypes.length > 0 || selectedStreamingProviders.length > 0) {
                  const watchProviders = movie.watchProviders || movie['watch/providers'] || {};
                  const results = watchProviders.results || {};
                  const usProviders = results.US || {};
                  
                  let hasMatchingPaymentType = selectedPaymentTypes.length === 0;
                  let hasMatchingStreamingProvider = selectedStreamingProviders.length === 0;
                  
                  // Check payment types
                  if (selectedPaymentTypes.length > 0) {
                    if (selectedPaymentTypes.includes('free')) {
                      hasMatchingPaymentType = hasMatchingPaymentType || (usProviders.flatrate && usProviders.flatrate.length > 0);
                    }
                    if (selectedPaymentTypes.includes('paid')) {
                      hasMatchingPaymentType = hasMatchingPaymentType || 
                        (usProviders.rent && usProviders.rent.length > 0) || 
                        (usProviders.buy && usProviders.buy.length > 0);
                    }
                  }
                  
                  // Check streaming providers
                  if (selectedStreamingProviders.length > 0) {
                    const allProviders = [
                      ...(usProviders.flatrate || []),
                      ...(usProviders.rent || []),
                      ...(usProviders.buy || [])
                    ];
                    hasMatchingStreamingProvider = allProviders.some(provider => 
                      selectedStreamingProviders.includes(provider.provider_id.toString())
                    );
                  }
                  
                  if (!hasMatchingPaymentType || !hasMatchingStreamingProvider) {
                    return false;
                  }
                }
                
                return true;
              })
              .length > 0 ? (
              <ScrollView style={[listStyles.rankingsList, { backgroundColor: colors.background }]}>
                {moviesByMediaType
                  .filter(movie => {
                    // Genre filter
                    if (selectedGenreId !== null && (!movie.genre_ids || !movie.genre_ids.includes(selectedGenreId))) {
                      return false;
                    }
                    
                    // Advanced filters (only apply if any are selected)
                    if (selectedPaymentTypes.length > 0 || selectedStreamingProviders.length > 0) {
                      const watchProviders = movie.watchProviders || movie['watch/providers'] || {};
                      const results = watchProviders.results || {};
                      const usProviders = results.US || {};
                      
                      let hasMatchingPaymentType = selectedPaymentTypes.length === 0;
                      let hasMatchingStreamingProvider = selectedStreamingProviders.length === 0;
                      
                      // Check payment types
                      if (selectedPaymentTypes.length > 0) {
                        if (selectedPaymentTypes.includes('free')) {
                          hasMatchingPaymentType = hasMatchingPaymentType || (usProviders.flatrate && usProviders.flatrate.length > 0);
                        }
                        if (selectedPaymentTypes.includes('paid')) {
                          hasMatchingPaymentType = hasMatchingPaymentType || 
                            (usProviders.rent && usProviders.rent.length > 0) || 
                            (usProviders.buy && usProviders.buy.length > 0);
                        }
                      }
                      
                      // Check streaming providers
                      if (selectedStreamingProviders.length > 0) {
                        const allProviders = [
                          ...(usProviders.flatrate || []),
                          ...(usProviders.rent || []),
                          ...(usProviders.buy || [])
                        ];
                        hasMatchingStreamingProvider = allProviders.some(provider => 
                          selectedStreamingProviders.includes(provider.provider_id.toString())
                        );
                      }
                      
                      if (!hasMatchingPaymentType || !hasMatchingStreamingProvider) {
                        return false;
                      }
                    }
                    
                    return true;
                  })
                  .map((movie, index) => (
                  <TouchableOpacity
                    key={movie.id}
                    style={[listStyles.rankingItem, { backgroundColor: colors.card }]}
                    onPress={() => {
                      setWatchlistModalVisible(false);
                      handleMovieSelect(movie, 'watchlist');
                    }}
                    activeOpacity={0.7}
                    accessibilityLabel={`View details for ${getTitle(movie)}, TMDB rating ${movie.vote_average?.toFixed(1) || 'N/A'}`}
                    accessibilityRole="button"
                    accessibilityHint="Double tap to view movie details and rate"
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
                    <LinearGradient
                      colors={colors.primaryGradient}
                      style={{
                        padding: 1,
                        borderRadius: 4,
                        width: 50,
                        height: 75
                      }}
                    >
                      <Image
                        source={{ uri: getPosterUrl(movie.poster || movie.poster_path) }}
                        style={[listStyles.resultPoster, { width: 48, height: 73 }]}
                        resizeMode="cover"
                      />
                    </LinearGradient>
                    <View style={[listStyles.movieDetails, { backgroundColor: colors.card }]}>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[listStyles.resultTitle, { color: colors.text }]}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {getTitle(movie)}
                        </Text>
                        <Text style={[styles.listGenres, { color: colors.subText }]} numberOfLines={1}>
                          {movie.genre_ids && Array.isArray(movie.genre_ids) 
                            ? movie.genre_ids.slice(0, 2).map(id => genres[id] || 'Unknown').join(', ') 
                            : 'Unknown'}
                        </Text>
                      </View>
                      <View style={styles.listRatings}>
                        <View style={styles.ratingColumn}>
                          <Text style={styles.ratingLabel}>USER</Text>
                          <Text style={styles.ratingValue}>N/A</Text>
                        </View>
                        <View style={styles.ratingColumn}>
                          <Text style={styles.friendsRatingLabel}>FRIENDS</Text>
                          <Text style={styles.friendsRatingValue}>
                            {movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <View style={[stateStyles.emptyStateContainer, { backgroundColor: colors.background }]}>
                <Ionicons name={mediaType === 'movie' ? 'film-outline' : 'tv-outline'} size={64} color={colors.subText} />
                <Text style={[stateStyles.emptyStateText, { color: colors.subText }]}>
                  No {selectedGenreId ? genres[selectedGenreId] : ''} {mediaType === 'movie' ? 'movies' : 'TV shows'} in watchlist.
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Watchlist Rating Modal */}
      {/* Watchlist RatingModal removed - now uses EnhancedRatingButton */}
      
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
      
      {/* Comparison Modal - Using Home screen implementation with movie theme */}
      <Modal visible={comparisonModalVisible} transparent animationType="none">
        <View style={styles.modalOverlay}>
          <LinearGradient
            colors={theme.movie[isDarkMode ? 'dark' : 'light'].primaryGradient || ['#667eea', '#764ba2']}
            style={styles.comparisonModalContent}
          >
            {!isComparisonComplete ? (
              <>
                <View style={styles.comparisonHeader}>
                  <Text style={[styles.modalTitle, { color: comparisonModalColors.text }]}>
                    🎬 Comparison {currentComparison + 1}/3
                  </Text>
                  <Text style={[styles.comparisonSubtitle, { color: comparisonModalColors.subText }]}>
                    Which one do you prefer?
                  </Text>
                </View>
                
                <View style={styles.moviesComparison}>
                  {/* New Movie */}
                  <TouchableOpacity 
                    style={styles.movieComparisonCard}
                    onPress={() => handleComparison('new')}
                    activeOpacity={0.8}
                  >
                    <Image
                      source={{ uri: `https://image.tmdb.org/t/p/w500${selectedMovie?.poster_path}` }}
                      style={styles.comparisonPoster}
                      resizeMode="cover"
                    />
                    <Text style={[styles.movieCardName, { color: comparisonModalColors.text }]} numberOfLines={2}>
                      {selectedMovie?.title || selectedMovie?.name}
                    </Text>
                    <Text style={[styles.movieCardYear, { color: comparisonModalColors.subText }]}>
                      {selectedMovie?.release_date ? new Date(selectedMovie.release_date).getFullYear() : 'N/A'}
                    </Text>
                  </TouchableOpacity>
                  
                  {/* VS Indicator */}
                  <View style={styles.vsIndicator}>
                    <Text style={[styles.vsText, { color: comparisonModalColors.accent }]}>VS</Text>
                  </View>
                  
                  {/* Comparison Movie */}
                  {comparisonMovies[currentComparison] && (
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
                      <Text style={[styles.movieCardName, { color: comparisonModalColors.text }]} numberOfLines={2}>
                        {comparisonMovies[currentComparison]?.title || comparisonMovies[currentComparison]?.name}
                      </Text>
                      <Text style={[styles.movieCardYear, { color: comparisonModalColors.subText }]}>
                        {comparisonMovies[currentComparison]?.release_date ? new Date(comparisonMovies[currentComparison].release_date).getFullYear() : 'N/A'}
                      </Text>
                      <View style={[styles.ratingBadge, { backgroundColor: comparisonModalColors.accent }]}>
                        <Text style={styles.ratingText}>
                          {comparisonMovies[currentComparison]?.userRating?.toFixed(1)}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Progress Indicator */}
                <View style={styles.progressIndicator}>
                  {[0, 1, 2].map(index => (
                    <View
                      key={index}
                      style={[
                        styles.progressDot,
                        { 
                          backgroundColor: index <= currentComparison ? comparisonModalColors.accent : comparisonModalColors.border?.color || '#ccc'
                        }
                      ]}
                    />
                  ))}
                </View>

                {/* Too Tough to Decide Button */}
                <TouchableOpacity 
                  style={[styles.cancelButton, { borderColor: comparisonModalColors.border?.color || '#ccc' }]}
                  onPress={() => {
                    console.log('User selected: Too tough to decide');
                    // Use unified pairwise calculation for TIE result
                    handleComparison('tie');
                  }}
                >
                  <Text style={[styles.cancelButtonText, { color: comparisonModalColors.subText }]}>Too Tough to Decide</Text>
                </TouchableOpacity>
              </>
            ) : (
              // Completion Screen
              <View style={styles.finalRatingModal}>
                {console.log('🎬 COMPLETION SCREEN RENDERING - finalCalculatedRating:', finalCalculatedRating)}
                {/* Movie Poster */}
                <Image
                  source={{ uri: `https://image.tmdb.org/t/p/w500${selectedMovie?.poster_path}` }}
                  style={styles.finalRatingPoster}
                  resizeMode="cover"
                />
                
                {/* Movie Title */}
                <Text style={styles.finalRatingTitle} numberOfLines={1} ellipsizeMode="tail">
                  {selectedMovie?.title || selectedMovie?.name}
                </Text>
                
                {/* Movie Year */}
                <Text style={styles.finalRatingYear} numberOfLines={1} ellipsizeMode="tail">
                  ({selectedMovie?.release_date ? new Date(selectedMovie.release_date).getFullYear() : selectedMovie?.first_air_date ? new Date(selectedMovie.first_air_date).getFullYear() : 'N/A'})
                </Text>
                
                {/* Final Score */}
                <Text style={[styles.finalRatingScore, { color: comparisonModalColors.secondary }]}>
                  {(() => {
                    console.log('🔍 Rendering final score, finalCalculatedRating is:', finalCalculatedRating);
                    return finalCalculatedRating?.toFixed(1) || 'test';
                  })()}
                </Text>
              </View>
            )}
            
            <TouchableOpacity 
              style={[styles.cancelButton, { borderColor: comparisonModalColors.border?.color || '#ccc' }]}
              onPress={handleCloseEnhancedModals}
            >
              <Text style={[styles.cancelButtonText, { color: comparisonModalColors.subText }]}>
                {isComparisonComplete ? 'Close' : 'Cancel'}
              </Text>
            </TouchableOpacity>
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

     {/* Advanced Filters Modal - Using absolute positioning instead of Modal */}
     {advancedFiltersModalVisible && (
       <View style={{
         position: 'absolute',
         top: 0,
         left: 0,
         right: 0,
         bottom: 0,
         backgroundColor: 'rgba(0,0,0,0.8)',
         justifyContent: 'center',
         alignItems: 'center',
         zIndex: 9999
       }}>
         <LinearGradient
           colors={colors.primaryGradient}
           start={{ x: 0, y: 0 }}
           end={{ x: 1, y: 1 }}
           style={{
             width: '90%',
             maxHeight: '80%',
             borderRadius: 12,
             padding: 20
           }}
         >
           {/* Modal Header */}
           <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
             <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#FFFFFF' }}>
               Advanced Filters
             </Text>
             <TouchableOpacity
               style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, borderWidth: 1, borderColor: '#FFFFFF' }}
               onPress={() => {
                 setTempPaymentTypes([]);
                 setTempStreamingProviders([]);
               }}
               activeOpacity={0.7}
             >
               <Text style={{ color: '#FFFFFF', fontSize: 14 }}>
                 Clear All
               </Text>
             </TouchableOpacity>
           </View>

           <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: '70%' }}>
             {/* Payment Type Filter Section */}
             <View style={{ marginBottom: 24 }}>
               <Text style={{ fontSize: 16, fontWeight: '600', color: '#FFFFFF', marginBottom: 12 }}>
                 Payment Type ({tempPaymentTypes.length} selected)
               </Text>
               <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                 <TouchableOpacity
                   style={{
                     paddingVertical: 10,
                     paddingHorizontal: 16,
                     borderRadius: 20,
                     borderWidth: 1,
                     backgroundColor: tempPaymentTypes.includes('free') ? '#FFFFFF' : 'transparent',
                     borderColor: '#FFFFFF'
                   }}
                   onPress={() => {
                     if (tempPaymentTypes.includes('free')) {
                       setTempPaymentTypes(tempPaymentTypes.filter(t => t !== 'free'));
                     } else {
                       setTempPaymentTypes([...tempPaymentTypes, 'free']);
                     }
                   }}
                   activeOpacity={0.7}
                 >
                   <Text style={{
                     color: tempPaymentTypes.includes('free') ? colors.primary : '#FFFFFF',
                     fontSize: 14,
                     fontWeight: '500'
                   }}>
                     Free (with subscription)
                   </Text>
                 </TouchableOpacity>
                 
                 <TouchableOpacity
                   style={{
                     paddingVertical: 10,
                     paddingHorizontal: 16,
                     borderRadius: 20,
                     borderWidth: 1,
                     backgroundColor: tempPaymentTypes.includes('paid') ? '#FFFFFF' : 'transparent',
                     borderColor: '#FFFFFF'
                   }}
                   onPress={() => {
                     if (tempPaymentTypes.includes('paid')) {
                       setTempPaymentTypes(tempPaymentTypes.filter(t => t !== 'paid'));
                     } else {
                       setTempPaymentTypes([...tempPaymentTypes, 'paid']);
                     }
                   }}
                   activeOpacity={0.7}
                 >
                   <Text style={{
                     color: tempPaymentTypes.includes('paid') ? colors.primary : '#FFFFFF',
                     fontSize: 14,
                     fontWeight: '500'
                   }}>
                     Paid (rent/buy)
                   </Text>
                 </TouchableOpacity>
               </View>
             </View>

             {/* Top 10 Streaming Services Filter Section */}
             <View style={{ marginBottom: 24 }}>
               <Text style={{ fontSize: 16, fontWeight: '600', color: '#FFFFFF', marginBottom: 12 }}>
                 Streaming Services ({tempStreamingProviders.length} selected)
               </Text>
               <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                 {STREAMING_SERVICES_PRIORITY.map((service) => (
                   <TouchableOpacity
                     key={service.id}
                     style={{
                       flexDirection: 'row',
                       alignItems: 'center',
                       paddingVertical: 8,
                       paddingHorizontal: 12,
                       borderRadius: 16,
                       borderWidth: 1,
                       backgroundColor: tempStreamingProviders.includes(service.id.toString()) ? '#FFFFFF' : 'transparent',
                       borderColor: '#FFFFFF',
                       marginBottom: 8
                     }}
                     onPress={() => {
                       if (tempStreamingProviders.includes(service.id.toString())) {
                         setTempStreamingProviders(tempStreamingProviders.filter(id => id !== service.id.toString()));
                       } else {
                         setTempStreamingProviders([...tempStreamingProviders, service.id.toString()]);
                       }
                     }}
                     activeOpacity={0.7}
                   >
                     <Image
                       source={{ uri: getSecureImageUrl(service.logo_path, 'w92') || 'https://via.placeholder.com/92x92/333/fff?text=?' }}
                       style={{ width: 24, height: 24, marginRight: 8, borderRadius: 4 }}
                       resizeMode="contain"
                     />
                     <Text style={{
                       color: tempStreamingProviders.includes(service.id.toString()) ? colors.primary : '#FFFFFF',
                       fontSize: 14,
                       fontWeight: '500'
                     }}>
                       {service.name}
                     </Text>
                   </TouchableOpacity>
                 ))}
               </View>
             </View>
           </ScrollView>
           
           {/* Modal Action Buttons */}
           <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, gap: 12 }}>
             <TouchableOpacity
               style={{
                 flex: 1,
                 paddingVertical: 14,
                 borderRadius: 8,
                 borderWidth: 1,
                 borderColor: '#FFFFFF',
                 alignItems: 'center'
               }}
               onPress={() => {
                 setTempPaymentTypes(selectedPaymentTypes);
                 setTempStreamingProviders(selectedStreamingProviders);
                 setAdvancedFiltersModalVisible(false);
               }}
             >
               <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>
                 Cancel
               </Text>
             </TouchableOpacity>
             <TouchableOpacity
               style={{
                 flex: 1,
                 paddingVertical: 14,
                 borderRadius: 8,
                 backgroundColor: '#FFFFFF',
                 alignItems: 'center'
               }}
               onPress={() => {
                 setSelectedPaymentTypes(tempPaymentTypes);
                 setSelectedStreamingProviders(tempStreamingProviders);
                 setAdvancedFiltersModalVisible(false);
               }}
             >
               <Text style={{ color: colors.primary, fontSize: 16, fontWeight: '600' }}>
                 Apply Filters
               </Text>
             </TouchableOpacity>
           </View>
         </LinearGradient>
       </View>
     )}
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
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  seeAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  seeAllText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  movieInfoContainer: {
    flex: 1,
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  // Grid styles removed - now using single-line FlatList matching Home screen
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
  advancedFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  advancedFiltersText: {
    fontSize: 14,
    fontWeight: '500',
  },
  // **Comparison Modal Styles from Home screen**
  moviesComparison: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  movieCardName: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  movieCardYear: {
    fontSize: 12,
    marginBottom: 8,
  },
  ratingBadge: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  ratingText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  vsIndicator: {
    marginHorizontal: 16,
    paddingVertical: 8,
  },
  progressIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginHorizontal: 4,
  },
  // **Final Rating Modal Styles**
  finalRatingModal: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  finalRatingPoster: {
    width: 120,
    height: 180,
    borderRadius: 8,
    marginBottom: 20,
  },
  finalRatingTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  finalRatingYear: {
    fontSize: 12,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 20,
  },
  finalRatingScore: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default ProfileScreen;