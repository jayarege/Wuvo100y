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
import { RatingModal } from '../../Components/RatingModal';
import { filterAdultContent } from '../../utils/ContentFiltering';
import { TMDB_API_KEY, API_TIMEOUT, STREAMING_SERVICES, DECADES } from '../../Constants';

const { width } = Dimensions.get('window');
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
  const [movieDetailModalVisible, setMovieDetailModalVisible] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [movieCredits, setMovieCredits] = useState(null);
  const [movieProviders, setMovieProviders] = useState(null);
  
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
  
  // Animation refs
  const slideAnim = useRef(new Animated.Value(300)).current;
  
  // TODO: Replace with actual current user ID from Firebase Auth
  const currentUserId = 'demo-user-123';
  
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
    
    return filtered.slice(0, 10);
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
        `https://api.themoviedb.org/3/movie/${movieId}/credits?api_key=${API_KEY}`
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
        `https://api.themoviedb.org/3/movie/${movieId}/watch/providers?api_key=${API_KEY}`
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

  const getProviderLogoUrl = useCallback((logoPath) => {
    if (!logoPath) return null;
    return `https://image.tmdb.org/t/p/w92${logoPath}`;
  }, []);

  // Watchlist helper functions
  const fetchStreamingProviders = useCallback(async () => {
    try {
      const endpoint = mediaType === 'movie' ? 'movie' : 'tv';
      const response = await fetchWithTimeout(
        `https://api.themoviedb.org/3/watch/providers/${endpoint}?api_key=${API_KEY}&watch_region=US`
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

  // TopRated handlers
  const handleMovieSelect = useCallback(async (movie) => {
    setSelectedMovie(movie);
    setMovieDetailModalVisible(true);
    
    const [credits, providers] = await Promise.all([
      fetchMovieCredits(movie.id),
      fetchMovieProviders(movie.id)
    ]);
    
    setMovieCredits(credits);
    setMovieProviders(providers);
  }, [fetchMovieCredits, fetchMovieProviders]);

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

  const handleMoviePress = (movie) => {
    setSelectedMovie(movie);
    setMovieDetailModalVisible(true);
  };

  const closeDetailModal = useCallback(() => {
    setMovieDetailModalVisible(false);
    setSelectedMovie(null);
    setMovieCredits(null);
    setMovieProviders(null);
  }, []);

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
                    onPress={() => handleMovieSelect(movie)}
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
                  onPress={() => handleMoviePress(item)}
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

  return (
    <View style={styles.container}>
      <ThemedHeader isDarkMode={isDarkMode} theme={theme}>
        <Text style={styles.headerTitle}>Profile</Text>
      </ThemedHeader>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Instagram-style Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerButton}>
            <Ionicons name="lock-closed" size={16} color="#fff" />
            <Text style={styles.username}>your.movie.profile</Text>
            <Ionicons name="chevron-down" size={16} color="#fff" />
          </TouchableOpacity>
          
          <View style={styles.headerIcons}>
            <TouchableOpacity style={styles.iconButton}>
              <Ionicons name="add-circle-outline" size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.iconButton}
              onPress={() => setSearchModalVisible(true)}
            >
              <Ionicons name="search" size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.iconButton}
              onPress={() => setShowDropdown(true)}
            >
              <Ionicons name="menu" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Profile Info */}
        <View style={styles.profileSection}>
          <View style={styles.profileHeader}>
            <View style={styles.avatarContainer}>
              <View style={styles.avatar}>
                <Ionicons name="person" size={40} color="#fff" />
              </View>
              <TouchableOpacity style={styles.addButton}>
                <Ionicons name="add" size={16} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{stats.posts}</Text>
                <Text style={styles.statLabel}>rated</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{stats.friends}</Text>
                <Text style={styles.statLabel}>friends</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{stats.following}</Text>
                <Text style={styles.statLabel}>watchlist</Text>
              </View>
            </View>
          </View>

          <View style={styles.profileInfo}>
            <Text style={styles.displayName}>Movie Enthusiast</Text>
            <Text style={styles.location}>Los Angeles</Text>
            <Text style={styles.bio}>
              "What's your favorite {mediaType === 'movie' ? 'movie' : 'TV show'}?"
            </Text>
          </View>

          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.editButton}>
              <Text style={styles.editButtonText}>Edit profile</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shareButton}>
              <Text style={styles.shareButtonText}>Share profile</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.discoverButton}>
              <Ionicons name="person-add" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tabButton, selectedTab === 'toprated' && styles.activeTab]}
            onPress={() => setSelectedTab('toprated')}
          >
            <Ionicons 
              name="trophy" 
              size={24} 
              color={selectedTab === 'toprated' ? '#fff' : '#666'} 
            />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tabButton, selectedTab === 'watchlist' && styles.activeTab]}
            onPress={() => setSelectedTab('watchlist')}
          >
            <Ionicons 
              name="glasses" 
              size={24} 
              color={selectedTab === 'watchlist' ? '#fff' : '#666'} 
            />
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        {renderTabContent()}
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

      {/* Movie Detail Modal - Exact Copy from Home Screen */}
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
                      source={{ uri: getProviderLogoUrl(provider.logo_path) }}
                      style={modalStyles.platformIcon}
                      resizeMode="contain"
                    />
                  ))
              ) : null}
            </View>
            
            <View style={modalStyles.buttonRow}>
              {/* Edit Rating Button - Only for TopRated Tab */}
              {selectedTab === 'toprated' && (
                <TouchableOpacity 
                  style={[
                    standardButtonStyles.baseButton,
                    standardButtonStyles.tertiaryButton
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
                      standardButtonStyles.tertiaryText
                    ]}
                  >
                    Edit Rating
                  </Text>
                </TouchableOpacity>
              )}
              
              {/* Mark as Watched Button - Only for Watchlist Tab */}
              {selectedTab === 'watchlist' && (
                <TouchableOpacity 
                  style={[
                    standardButtonStyles.baseButton,
                    standardButtonStyles.tertiaryButton
                  ]}
                  onPress={() => {
                    closeDetailModal();
                    openRatingModal(selectedMovie);
                  }}
                  activeOpacity={0.7}
                >
                  <Text 
                    style={[
                      standardButtonStyles.baseText,
                      standardButtonStyles.tertiaryText
                    ]}
                  >
                    Mark as Watched
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
          // TODO: Navigate to user's public profile
        }}
        isDarkMode={isDarkMode}
      />
      
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
    </View>
  );
};

const styles = StyleSheet.create({
  // Main Container
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  
  // Scroll View
  scrollView: {
    flex: 1,
    backgroundColor: '#000',
  },
  
  // Instagram-style Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#000',
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  username: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginHorizontal: 8,
  },
  headerIcons: {
    flexDirection: 'row',
  },
  iconButton: {
    marginLeft: 16,
    padding: 4,
  },
  
  // Profile Section
  profileSection: {
    paddingHorizontal: 16,
    backgroundColor: '#000',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  
  // Avatar Section
  avatarContainer: {
    position: 'relative',
    marginRight: 24,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#262626',
  },
  addButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#0095f6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000',
  },
  
  // Stats Section
  statsContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  statLabel: {
    color: '#999',
    fontSize: 14,
    marginTop: 2,
  },
  
  // Profile Info Section
  profileInfo: {
    marginBottom: 16,
  },
  displayName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  location: {
    color: '#999',
    fontSize: 14,
    marginBottom: 8,
  },
  bio: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 18,
  },
  
  // Action Buttons Section
  actionButtons: {
    flexDirection: 'row',
    marginBottom: 24,
    gap: 8,
  },
  editButton: {
    flex: 1,
    backgroundColor: '#262626',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  editButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  shareButton: {
    flex: 1,
    backgroundColor: '#262626',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  shareButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  discoverButton: {
    backgroundColor: '#262626',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  
  // Tab Navigation Section
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
    backgroundColor: '#000',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#fff',
  },
  
  // Posts Grid Section
  postsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingTop: 16,
    backgroundColor: '#000',
    justifyContent: 'space-between',
  },
  posterContainer: {
    width: POSTER_SIZE,
    height: POSTER_SIZE * 1.5,
    marginBottom: 4,
    position: 'relative',
    borderRadius: 4,
    overflow: 'hidden',
  },
  posterImage: {
    width: '100%',
    height: '100%',
  },
  ratingOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  ratingText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  watchingOverlay: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  emptyPoster: {
    backgroundColor: '#262626',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#333',
    borderStyle: 'dashed',
  },
  emptyText: {
    color: '#666',
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
  },
  
  // Coming Soon Section
  comingSoonContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    backgroundColor: '#000',
  },
  comingSoonText: {
    color: '#999',
    fontSize: 16,
    marginTop: 12,
    textAlign: 'center',
  },

  // Dropdown Styles
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 100,
    paddingRight: 16,
  },
  dropdownContainer: {
    backgroundColor: '#262626',
    borderRadius: 8,
    paddingVertical: 8,
    minWidth: 150,
    borderWidth: 1,
    borderColor: '#333',
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
    marginLeft: 12,
  },
  dropdownSeparator: {
    height: 1,
    backgroundColor: '#333',
    marginVertical: 4,
  },
});

// Profile-specific styles for TopRated and Watchlist functionality
const profileStyles = StyleSheet.create({
  // Filter Section Styles
  filterSection: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4, 
    borderBottomWidth: 1,
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  filterTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  clearButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  genreList: {
    paddingVertical: 4,
    paddingRight: 12,
  },
  genreButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
  },
  selectedGenreButton: {
    borderWidth: 1,
  },
  genreButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  activeFilterIndicator: {
    marginTop: 8,
    marginBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeFilterText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  
  // Filter Button
  filterButton: {
    padding: 4,
    position: 'relative',
  },
  filterBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF9500',
  },
  
  // Active Filters Section
  activeFiltersSection: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  activeFiltersTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  activeFiltersContainer: {
    flexDirection: 'row',
  },
  activeFilterChip: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    marginRight: 8,
    borderRadius: 12,
  },
  activeFilterText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  
  // Button Styles
  editButton: {
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 1,
    // CODE_BIBLE #3: Compact button sizing
  },
  editButtonText: {
    fontSize: 10,
    fontWeight: '600',
    // CODE_BIBLE #3: Smaller button text for compact design
  },
  
  // Score Container
  scoreContainer: {
    marginTop: 8,
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  finalScore: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
    textAlign: 'left',
    // CODE_BIBLE #3: 50% size reduction for mobile optimization
  },
  
  // Clear filters button styling
  clearFiltersButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 16,
    alignSelf: 'center',
  },
  clearFiltersButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Filter title with arrow
  filterTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  
  // Friend profile ranking options
  rankingOptionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 8,
  },
  rankingOption: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    minWidth: 120,
  },
  selectedRankingOption: {
    borderWidth: 2,
  },
  rankingOptionText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  
  // Unwatched movies toggle
  unwatchedToggleContainer: {
    marginTop: 8,
  },
  unwatchedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  selectedUnwatchedToggle: {
    borderWidth: 2,
  },
  unwatchedToggleText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  
  // Unwatched movie indicator
  unwatchedIndicator: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginTop: 4,
  },
  unwatchedIndicatorText: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
});

// Filter Modal Styles
const filterStyles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  enhancedModalContent: {
    width: '95%',
    maxHeight: '85%',
    elevation: 10,
    shadowOpacity: 0.5,
    borderRadius: 12,
    paddingTop: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  clearAllButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  clearAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalScrollContainer: {
    flex: 1,
    minHeight: 300,
    maxHeight: 500,
  },
  modalScrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  scrollViewContent: {
    paddingBottom: 20,
    flexGrow: 1,
  },
  filterSection: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#FFFFFF',
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
    marginBottom: 8,
  },
  optionChipText: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  streamingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 8,
    minWidth: 120,
  },
  streamingLogoImage: {
    width: 24,
    height: 24,
    marginRight: 8,
    borderRadius: 4,
  },
  streamingLogoPlaceholder: {
    width: 24,
    height: 24,
    marginRight: 8,
    borderRadius: 4,
    backgroundColor: '#666',
    justifyContent: 'center',
    alignItems: 'center',
  },
  streamingLogoText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  streamingText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    marginTop: 10,
  },
  applyButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginLeft: 8,
  },
  applyButtonText: {
    fontWeight: '600',
    fontSize: 16,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    marginRight: 8,
  },
  cancelButtonText: {
    fontWeight: '600',
    fontSize: 16,
  },
});

export default ProfileScreen;