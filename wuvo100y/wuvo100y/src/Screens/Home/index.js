import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { 
  View, 
  Text, 
  SafeAreaView, 
  TouchableOpacity, 
  Image, 
  FlatList,
  StyleSheet,
  Dimensions,
  Animated,
  PanResponder,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedHeader } from '../../Styles/headerStyles';

// Import theme system and styles
import { useMediaType } from '../../Navigation/TabNavigator';
import WildcardScreen from '../Wildcard';
import { getHomeStyles } from '../../Styles/homeStyles';
import { getHeaderStyles } from '../../Styles/headerStyles';
import { getModalStyles } from '../../Styles/modalStyles';
import { getButtonStyles } from '../../Styles/buttonStyles';
import { getRatingStyles } from '../../Styles/ratingStyles'; 
import { getLayoutStyles } from '../../Styles/layoutStyles';
import theme from '../../utils/Theme';
import { LinearGradient } from 'expo-linear-gradient';
import MovieCard from '../../Components/MovieCard';
import MovieDetailModal from '../../Components/MovieDetailModal';
// OLD: Complex AI system with poor results
// import { getAIRecommendations, getEnhancedRecommendations, recordNotInterested, recordUserRating, canRefreshAIRecommendations, refreshAIRecommendations } from '../../utils/AIRecommendations';

// NEW: Simple & Effective AI Recommendations
// COMMANDMENT 9: Handle bundler cache issues with explicit file extension
import { getImprovedRecommendations, recordNotInterested } from '../../utils/AIRecommendations.js';
import SocialRecommendationService from '../../services/SocialRecommendationService';
import SocialRecommendationsSection from '../../Components/SocialRecommendationsSection';
import { useDiscoverySessions } from '../../hooks/useDiscoverySessions';
import { getCurrentSessionType } from '../../config/discoveryConfig';
import { useAuth } from '../../hooks/useAuth';
// RatingModal replaced with SentimentRatingModal from EnhancedRatingSystem
import { ActivityIndicator } from 'react-native';
import { TMDB_API_KEY as API_KEY, STREAMING_SERVICES_PRIORITY } from '../../Constants';
import { movieUtils } from '../../utils/movieUtils';
import { formatUtils } from '../../utils/formatUtils';
import { StreamingProviders } from '../../Components/StreamingProviders';
import { filterAdultContent, isContentSafe } from '../../utils/ContentFiltering';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import storage keys to match the main data hook
import { STORAGE_KEYS } from '../../config/storageConfig';

// Dynamic storage keys based on media type (matching useMovieData hook)
const getStorageKey = (mediaType) => mediaType === 'movie' ? STORAGE_KEYS.MOVIES.SEEN : STORAGE_KEYS.TV_SHOWS.SEEN;

// **ENHANCED RATING SYSTEM IMPORT**
import { 
  calculateDynamicRatingCategories, 
  SentimentRatingModal, 
  ConfidenceBasedComparison,
  selectOpponentFromEmotion, 
  selectRandomOpponent, 
  handleTooToughToDecide,
  calculateRatingFromELOComparisons,
  selectMovieFromPercentileUnified,
  calculateAverageRating
} from '../../Components/EnhancedRatingSystem';


// Removed custom percentile logic - now relying ONLY on EnhancedRatingSystem

// **DEBUG LOGGING**
console.log('🏠 HomeScreen: Enhanced Rating System loaded');

// COMMANDMENT 7: Document the WHY - Refresh rate limiting prevents API abuse
// Devil's advocate: Users will try to spam refresh, so we need strict limits
const REFRESH_STORAGE_KEY_PREFIX = 'ai_refresh';
const MAX_DAILY_REFRESHES = 3;
const REFRESH_RESET_HOURS = 24; // 24-hour rolling window

// **STREAMING PROVIDER PAYMENT TYPE MAPPING** - Based on common provider business models
const getProviderPaymentType = (providerId) => {
  // Free services (ad-supported)
  const freeProviders = [
    546, // YouTube
    613, // Tubi
    350, // Apple TV (has free content)
    283, // Crackle
    207, // YouTube Movies
    457, // Vudu (has free with ads)
  ];
  
  // Most major streaming services are paid
  const paidProviders = [
    8,   // Netflix
    384, // HBO Max
    9,   // Amazon Prime Video
    15,  // Hulu
    337, // Disney+
    387, // Peacock Premium
    1899, // Max
    531, // Paramount+
    26,  // Crunchyroll
    2,   // Apple TV+
    286, // Showtime
  ];
  
  if (freeProviders.includes(providerId)) return 'free';
  if (paidProviders.includes(providerId)) return 'paid';
  
  // Default to paid for unknown providers (most streaming services are paid)
  return 'paid';
};

// **SHARED BUTTON STYLES** - Consistent styling with semantic variants
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

const { width } = Dimensions.get('window');

const MOVIE_CARD_WIDTH = (width - 48) / 2.25; // Made 20% smaller from 1.8 to 2.25
const CAROUSEL_ITEM_WIDTH = MOVIE_CARD_WIDTH + 20;

// **MAIN HOME SCREEN COMPONENT WITH ENHANCED RATING SYSTEM**
function HomeScreen({ 
  seen, 
  unseen, 
  setSeen, 
  setUnseen, 
  seenTVShows,
  unseenTVShows,
  setSeenTVShows,
  setUnseenTVShows,
  genres, 
  isDarkMode, 
  onAddToSeen, 
  onAddToUnseen, 
  onUpdateRating, // ✅ REQUIRED PROP FOR ENHANCED RATING
  skippedMovies, 
  addToSkippedMovies, 
  removeFromSkippedMovies 
}) {
  const navigation = useNavigation();

  // Use media type context
  const { mediaType, setMediaType } = useMediaType();

  // Use authentication context
  const { userInfo: currentUser } = useAuth();

  // Get all themed styles
  const homeStyles = getHomeStyles(mediaType, isDarkMode ? 'dark' : 'light', theme);
  const colors = theme[mediaType][isDarkMode ? 'dark' : 'light'];
  
  /**
   * Helper function to get modal colors with optional theme override
   * @param {boolean} forceMovieTheme - If true, always use movie theme colors for consistency
   * @returns {object} Color theme object
   */
  const getModalColors = (forceMovieTheme = false) => {
    if (forceMovieTheme) {
      return theme.movie[isDarkMode ? 'dark' : 'light'];
    }
    return colors; // Exact same object reference to prevent unnecessary re-renders
  };
  
  // Initialize standardized button styles
  const standardButtonStyles = getStandardizedButtonStyles(colors);
  
  const headerStyles = getHeaderStyles(mediaType, isDarkMode ? 'dark' : 'light', theme);
  const modalStyles = getModalStyles(mediaType, isDarkMode ? 'dark' : 'light', theme);
  const buttonStyles = getButtonStyles(mediaType, isDarkMode ? 'dark' : 'light', theme);
  const ratingStyles = getRatingStyles(mediaType, isDarkMode ? 'dark' : 'light', theme);
  const layoutStyles = getLayoutStyles(mediaType, isDarkMode ? 'dark' : 'light', theme);

  // **STATE MANAGEMENT - ENGINEER TEAM 1-3**
  const [activeTab, setActiveTab] = useState('new');
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [movieDetailModalVisible, setMovieDetailModalVisible] = useState(false);
  // Removed ratingModalVisible - now uses SentimentRatingModal
  const [ratingInput, setRatingInput] = useState('');
  const [recentReleases, setRecentReleases] = useState([]);
  const [popularMovies, setPopularMovies] = useState([]);
  const [actionMovies, setActionMovies] = useState([]);
  const [thrillerMovies, setThrillerMovies] = useState([]);
  const [comedyMovies, setComedyMovies] = useState([]);
  const [isLoadingRecent, setIsLoadingRecent] = useState(true);
  
  // **SESSION DISMISSAL STATE - For temporary hiding without permanent "not interested"**
  const [dismissedInSession, setDismissedInSession] = useState([]);
  // **AI RECOMMENDATIONS SEPARATED BY MEDIA TYPE - FIX FOR TOGGLE ISSUE**
  const [aiMovieRecommendations, setAiMovieRecommendations] = useState([]);
  const [aiTvRecommendations, setAiTvRecommendations] = useState([]);
  
  // **COMPUTED AI RECOMMENDATIONS BASED ON CURRENT MEDIA TYPE**
  const aiRecommendations = useMemo(() => {
    return mediaType === 'movie' ? aiMovieRecommendations : aiTvRecommendations;
  }, [mediaType, aiMovieRecommendations, aiTvRecommendations]);
  
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);
  const [socialRecommendations, setSocialRecommendations] = useState([]);
  const [isLoadingSocialRecs, setIsLoadingSocialRecs] = useState(false);
  const [refreshStatus, setRefreshStatus] = useState({ canRefresh: true, remainingRefreshes: 3, resetTime: null });
  const [isRefreshingAI, setIsRefreshingAI] = useState(false);
  // COMMANDMENT 2: Never assume - track refresh usage with proper validation
  const [dailyRefreshCount, setDailyRefreshCount] = useState(0);
  const [lastRefreshDate, setLastRefreshDate] = useState(null);
  
  // **COUNTDOWN TIMER STATE FOR 24-HOUR ROLLING REFRESH**
  const [timeUntilReset, setTimeUntilReset] = useState(null);
  const [refreshTimestamps, setRefreshTimestamps] = useState([]);
  const [movieCredits, setMovieCredits] = useState(null);
  const [movieProviders, setMovieProviders] = useState(null);
  
  // **NEW: LOADING AND ERROR STATES FOR MOVIE DETAILS**
  const [isLoadingMovieDetails, setIsLoadingMovieDetails] = useState(false);
  const [isProcessingMovieSelect, setIsProcessingMovieSelect] = useState(false);
  
  // **FIX: Prevent unwanted movie selection during rating completion**
  const [isRatingInProgress, setIsRatingInProgress] = useState(false);
  // CODE_BIBLE Fix: Use useRef instead of useState to prevent cascade re-fetches
  const notInterestedMoviesRef = useRef([]);
  const [notInterestedMovies, setNotInterestedMovies] = useState([]); // Keep state for UI updates only
  const [aiErrorShown, setAiErrorShown] = useState(false); // Prevent multiple error alerts
  
  // **ENHANCED RATING SYSTEM STATE**
  // const [sentimentModalVisible, setSentimentModalVisible] = useState(false); // REMOVED: Now using in-place sentiment buttons
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showSentimentButtons, setShowSentimentButtons] = useState(false);
  const [selectedEmotion, setSelectedEmotion] = useState(null);
  const [currentMovieRating, setCurrentMovieRating] = useState(null);
  const [emotionModalVisible, setEmotionModalVisible] = useState(false);
  const [finalCalculatedRating, setFinalCalculatedRating] = useState(null);
  
  // **ADD MISSING STATE VARIABLES FROM ADDMOVIE**
  const [selectedMovieForRating, setSelectedMovieForRating] = useState(null);
  
  const {
    currentSession,
    dailyLimits,
    loading: sessionLoading,
    generateSession,
    canGenerateNewSession,
    remainingSessions,
    error: sessionError
  } = useDiscoverySessions(userId);
  
  const [showDiscoverySession, setShowDiscoverySession] = useState(false);
  const [sessionType, setSessionType] = useState(getCurrentSessionType());
  const [lastGeneratedSession, setLastGeneratedSession] = useState(null);
  
  // Debug: Log state changes
  useEffect(() => {
    console.log('📊 finalCalculatedRating changed to:', finalCalculatedRating);
  }, [finalCalculatedRating]);
  
  // **DISCOVERY SESSION HANDLERS**
  const handleGenerateDiscoverySession = useCallback(async (type = null) => {
    try {
      console.log('🎪 Generating discovery session...');
      // **FIX**: Pass seen movies to exclude already-rated movies from discovery session
      const session = await generateSession(type || sessionType, { seenMovies: seen });
      
      if (session) {
        setLastGeneratedSession(session);
        setShowDiscoverySession(true);
        
        // Update AI recommendations with discovery session movies
        mediaType === 'movie' ? setAiMovieRecommendations(session.movies || []) : setAiTvRecommendations(session.movies || []);
        
        console.log('✅ Discovery session generated successfully');
      }
    } catch (error) {
      console.error('❌ Discovery session generation failed:', error);
      console.log('🔇 Discovery session error (popup disabled):', error.message);
    }
  }, [generateSession, sessionType, seen, mediaType]);
  
  const handleDiscoverySessionClose = useCallback(() => {
    setShowDiscoverySession(false);
  }, []);
  
  // Auto-detect session type based on time
  useEffect(() => {
    const currentType = getCurrentSessionType();
    if (currentType !== sessionType) {
      setSessionType(currentType);
    }
  }, [sessionType]);
  
  // Show discovery session if we have one
  useEffect(() => {
    if (currentSession && !showDiscoverySession) {
      setShowDiscoverySession(true);
      setLastGeneratedSession(currentSession);
      mediaType === 'movie' ? setAiMovieRecommendations(currentSession.movies || []) : setAiTvRecommendations(currentSession.movies || []);
    }
  }, [currentSession, showDiscoverySession, mediaType]);

  // **CRITICAL FIX: Force reset rating flag on component mount**
  useEffect(() => {
    setIsRatingInProgress(false);
    console.log('🚀 Component mounted - FORCE RESET isRatingInProgress to false');
  }, []);

  // **NEW: COMPREHENSIVE DEBUG LOGGING FOR MODAL STATE**
  useEffect(() => {
    console.log('📱 Modal state changed:', {
      movieDetailModalVisible,
      selectedMovie: selectedMovie?.title || 'null',
      movieCredits: movieCredits?.length || 0,
      movieProviders: movieProviders?.length || 0,
      isLoadingMovieDetails,
      isProcessingMovieSelect
    });
  }, [movieDetailModalVisible, selectedMovie, movieCredits, movieProviders, isLoadingMovieDetails, isProcessingMovieSelect]);
  
  // **PERFORMANCE OPTIMIZATION: Smart Home tab navigation with caching**
  const [lastDataFetch, setLastDataFetch] = useState(null);
  const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes cache

  useEffect(() => {
    const unsubscribe = navigation.addListener('tabPress', (e) => {
      console.log('🏠 Home tab pressed - checking cache validity');
      setActiveTab('new');
      
      // **PERFORMANCE: Only refetch if cache is stale or data is empty**
      const now = Date.now();
      const isCacheStale = !lastDataFetch || (now - lastDataFetch) > CACHE_DURATION;
      const hasNoData = recentReleases.length === 0 && popularMovies.length === 0;
      
      if (isCacheStale || hasNoData) {
        console.log('🔄 Cache stale or no data - refreshing:', { 
          cacheStale: isCacheStale, 
          noData: hasNoData,
          cacheAge: lastDataFetch ? Math.round((now - lastDataFetch) / 1000) + 's' : 'never'
        });
        // Only fetch if truly needed
        if (recentReleases.length === 0) fetchRecentReleases();
        if (popularMovies.length === 0) fetchPopularMovies();
        if (actionMovies.length === 0) fetchActionMovies();
        if (thrillerMovies.length === 0) fetchThrillerMovies();
        if (comedyMovies.length === 0) fetchComedyMovies();
        setLastDataFetch(now);
      } else {
        console.log('✅ Using cached data - age:', Math.round((now - lastDataFetch) / 1000) + 's');
      }
    });

    return unsubscribe;
  }, [navigation, lastDataFetch, recentReleases.length, popularMovies.length, fetchRecentReleases, fetchPopularMovies, CACHE_DURATION]);
  
  // **ANIMATION SYSTEM - ENGINEER TEAM 4-6**
  // REMOVED: slideAnim - caused screen movement
  // REMOVED: popularScrollX - caused screen movement
  const popularScrollRef = useRef(null);
  const [popularIndex, setPopularIndex] = useState(0);
  const autoScrollPopular = useRef(null);
  // All animation variables removed
  // Unused animation refs removed
  
  // Track previous content type to detect changes for AI recommendations
  const previousContentType = useRef(contentType);
  
  // **CONTENT TYPE HELPERS - ENGINEER TEAM 7**
  const contentType = mediaType === 'movie' ? 'movies' : 'tv';
  
  // **AI RECOMMENDATIONS FILTERED BY CURRENT MEDIA TYPE - FIX FOR TOGGLE ISSUE**
  const currentAiRecommendations = useMemo(() => {
    const result = mediaType === 'movie' ? aiMovieRecommendations : aiTvRecommendations;
    if (__DEV__) {
      console.log(`📺 DEV - currentAiRecommendations for ${mediaType}:`, result.length);
    }
    return result;
  }, [mediaType, aiMovieRecommendations, aiTvRecommendations]);

  // **DYNAMIC CONTENT DATA BASED ON MEDIA TYPE**
  const currentSeenContent = useMemo(() => {
    return mediaType === 'movie' ? seen : (seenTVShows || []);
  }, [mediaType, seen, seenTVShows]);

  const currentUnseenContent = useMemo(() => {
    return mediaType === 'movie' ? unseen : (unseenTVShows || []);
  }, [mediaType, unseen, unseenTVShows]);

  // **STABLE REFERENCE FOR AI FILTERING**
  const seenMoviesRef = useRef(currentSeenContent);
  
  // Keep seenMoviesRef updated
  useEffect(() => {
    seenMoviesRef.current = currentSeenContent;
  }, [currentSeenContent]);

  // **DISCOVERY SESSION STATE**
  const userId = 'user_' + (currentSeenContent.length > 0 ? currentSeenContent[0].id : 'default');

  // **IMPROVED 24-HOUR ROLLING REFRESH SYSTEM**
  const checkRefreshEligibility = useCallback(async () => {
    try {
      const timestampsKey = `ai_refresh_timestamps_${mediaType}`;
      const storedTimestamps = await AsyncStorage.getItem(timestampsKey);
      
      const now = Date.now();
      const twentyFourHoursAgo = now - (REFRESH_RESET_HOURS * 60 * 60 * 1000);
      
      let timestamps = storedTimestamps ? JSON.parse(storedTimestamps) : [];
      
      // Filter out timestamps older than 24 hours (rolling window)
      timestamps = timestamps.filter(timestamp => timestamp > twentyFourHoursAgo);
      
      // Update stored timestamps
      await AsyncStorage.setItem(timestampsKey, JSON.stringify(timestamps));
      setRefreshTimestamps(timestamps);
      
      const remaining = Math.max(0, MAX_DAILY_REFRESHES - timestamps.length);
      
      // Calculate time until next reset (when oldest timestamp expires)
      let nextResetTime = null;
      if (timestamps.length >= MAX_DAILY_REFRESHES && timestamps.length > 0) {
        nextResetTime = timestamps[0] + (REFRESH_RESET_HOURS * 60 * 60 * 1000);
      }
      
      return { 
        canRefresh: remaining > 0, 
        remainingRefreshes: remaining,
        count: timestamps.length,
        nextResetTime: nextResetTime,
        timestamps: timestamps
      };
      
    } catch (error) {
      console.error('Error checking refresh eligibility:', error);
      // COMMANDMENT 9: Handle errors explicitly - fail safe with reduced access
      return { canRefresh: false, remainingRefreshes: 0, count: MAX_DAILY_REFRESHES, nextResetTime: null, timestamps: [] };
    }
  }, [mediaType]);

  // **IMPROVED REFRESH WITH ROLLING TIMESTAMPS**
  const handleRefreshRecommendations = useCallback(async () => {
    try {
      const eligibility = await checkRefreshEligibility();
      
      if (!eligibility.canRefresh) {
        console.log('⏰ 24-hour refresh limit reached');
        // TEMP FIX: Reset refresh count to help debug the AI recommendations issue
        console.log('🔧 TEMP DEBUG: Resetting refresh limit to allow more testing');
        const timestampsKey = `ai_refresh_timestamps_${mediaType}`;
        await AsyncStorage.removeItem(timestampsKey);
        setRefreshTimestamps([]);
        setDailyRefreshCount(0);
        setTimeUntilReset(null);
        // Continue with refresh after reset
      }
      
      setIsRefreshingAI(true);
      
      // Add current timestamp to rolling window (but limit to 2 for debugging)
      const now = Date.now();
      const timestampsKey = `ai_refresh_timestamps_${mediaType}`;
      const currentTimestamps = refreshTimestamps || [];
      const recentTimestamps = currentTimestamps.slice(-1); // Keep only the most recent one
      const updatedTimestamps = [...recentTimestamps, now];
      
      await AsyncStorage.setItem(timestampsKey, JSON.stringify(updatedTimestamps));
      setRefreshTimestamps(updatedTimestamps);
      setDailyRefreshCount(updatedTimestamps.length);
      
      // COMMANDMENT 4: Brutally honest - clear old recommendations for fresh start
      mediaType === 'movie' ? setAiMovieRecommendations([]) : setAiTvRecommendations([]);
      setDismissedInSession([]);
      
      console.log('🎯 DEBUG: About to call fetchAIRecommendations with force refresh');
      console.log('🎯 DEBUG: Current media type:', contentType, 'Seen movies count:', movieUtils.getMovieCount(seen));
      
      // Force fresh recommendations with enhanced filtering
      await fetchAIRecommendations(true); // Pass forceRefresh=true for debugging
      
      console.log(`🔄 AI recommendations refreshed (${updatedTimestamps.length}/${MAX_DAILY_REFRESHES})`);
      return true;
      
    } catch (error) {
      console.error('❌ Failed to refresh recommendations:', error);
      // COMMANDMENT 9: Error logged to console (popup disabled by user request)
      console.log('🔇 Refresh error (popup disabled):', error.message);
      return false;
    } finally {
      setIsRefreshingAI(false);
    }
  }, [checkRefreshEligibility, fetchAIRecommendations, mediaType, contentType, seen.length]);

  // COMMANDMENT 8: Test initialization on component mount
  useEffect(() => {
    const initializeRefreshStatus = async () => {
      const eligibility = await checkRefreshEligibility();
      setDailyRefreshCount(eligibility.count);
      if (eligibility.nextResetTime) {
        setTimeUntilReset(eligibility.nextResetTime);
      }
    };
    initializeRefreshStatus();
  }, [checkRefreshEligibility]);
  
  // **COUNTDOWN TIMER EFFECT - Updates every minute when refresh is disabled**
  useEffect(() => {
    let interval;
    if (dailyRefreshCount >= MAX_DAILY_REFRESHES && timeUntilReset) {
      interval = setInterval(() => {
        const now = Date.now();
        if (now >= timeUntilReset) {
          // Reset time reached, refresh eligibility
          setTimeUntilReset(null);
          checkRefreshEligibility();
        }
      }, 60000); // Update every minute
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [dailyRefreshCount, timeUntilReset, checkRefreshEligibility]);
  
  // **COUNTDOWN DISPLAY FORMATTER**
  const formatTimeUntilReset = useCallback((resetTime) => {
    if (!resetTime) return '';
    
    const now = Date.now();
    const remaining = resetTime - now;
    
    if (remaining <= 0) return 'Available now';
    
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }, []);
  
  // **DATE UTILITIES - ENGINEER TEAM 8**
  const today = useMemo(() => new Date(), []);
  const oneWeekAgo = useMemo(() => {
    const date = new Date(today);
    date.setDate(date.getDate() - 7);
    return date;
  }, [today]);

  // ============================================================================
  // **NOT INTERESTED SYSTEM - ENGINEER TEAM 9**
  // ============================================================================

  const sendNegativeFeedbackToAI = useCallback(async (content, mediaType) => {
    try {
      console.log(`📉 AI Feedback: User not interested in ${content.title} (${mediaType})`);
      
      const feedbackKey = `ai_negative_feedback_${mediaType}`;
      let existingFeedback = [];
      
      try {
        const stored = await AsyncStorage.getItem(feedbackKey);
        if (stored) {
          existingFeedback = JSON.parse(stored);
        }
      } catch (e) {
        console.log('No existing negative feedback found');
      }
      
      const feedbackEntry = {
        id: content.id,
        title: content.title,
        genre_ids: content.genre_ids || content.genreIds || [],
        vote_average: content.vote_average,
        timestamp: Date.now(),
        mediaType: mediaType
      };
      
      existingFeedback.push(feedbackEntry);
      
      if (existingFeedback.length > 100) {
        existingFeedback = existingFeedback.slice(-100);
      }
      
      await AsyncStorage.setItem(feedbackKey, JSON.stringify(existingFeedback));
      console.log(`✅ Negative feedback stored for ${content.title}`);
      
    } catch (error) {
      console.error('Failed to store negative feedback:', error);
    }
  }, []);

  const storePermanentlyNotInterested = useCallback(async (movieId, mediaType) => {
    try {
      const notInterestedKey = `not_interested_${mediaType}`;
      let notInterestedList = [];
      
      const stored = await AsyncStorage.getItem(notInterestedKey);
      if (stored) {
        notInterestedList = JSON.parse(stored);
      }
      
      if (!notInterestedList.includes(movieId)) {
        notInterestedList.push(movieId);
        await AsyncStorage.setItem(notInterestedKey, JSON.stringify(notInterestedList));
        
        // CODE_BIBLE Fix: Update both ref and state
        notInterestedMoviesRef.current = notInterestedList;
        setNotInterestedMovies(notInterestedList);
        console.log(`💾 Added movie ${movieId} to permanent not interested list`);
      }
    } catch (error) {
      console.error('Failed to store not interested movie:', error);
    }
  }, []);

  const loadNotInterestedMovies = useCallback(async () => {
    try {
      const notInterestedKey = `not_interested_${mediaType}`;
      const stored = await AsyncStorage.getItem(notInterestedKey);
      if (stored) {
        const notInterestedList = JSON.parse(stored);
        console.log(`📋 Loaded ${notInterestedList.length} not interested ${mediaType}s`);
        return notInterestedList;
      }
      return [];
    } catch (error) {
      console.error('Failed to load not interested movies:', error);
      return [];
    }
  }, [mediaType]);


  // ============================================================================
  // **ENHANCED NOT INTERESTED HANDLER - ISSUE #8**
  // ============================================================================
  
  const handleEnhancedNotInterested = useCallback(async (item, reason = 'not_interested') => {
    try {
      console.log(`❌ Enhanced not interested: ${item.title || item.name} (${reason})`);
      
      // Record in enhanced preference system
      const success = await recordNotInterested(item, reason, mediaType);
      
      if (success) {
        // Remove from current AI recommendations immediately
        if (mediaType === 'movie') {
          setAiMovieRecommendations(prev => {
            const filtered = prev.filter(movie => movie.id !== item.id);
            console.log(`🗑️ Removed from AI recommendations: ${prev.length} -> ${filtered.length}`);
            return filtered;
          });
        } else {
          setAiTvRecommendations(prev => {
            const filtered = prev.filter(movie => movie.id !== item.id);
            console.log(`🗑️ Removed from AI recommendations: ${prev.length} -> ${filtered.length}`);
            return filtered;
          });
        }
        
        // Also add to legacy skipped movies for backward compatibility
        if (addToSkippedMovies) {
          addToSkippedMovies(item.id);
        }
        
        // Show success feedback
        Alert.alert(
          '✅ Not Interested',
          `We won't recommend "${item.title || item.name}" again.`,
          [{ text: 'OK' }],
          { duration: 2000 }
        );
        
        console.log(`✅ Successfully recorded not interested for: ${item.title || item.name}`);
      } else {
        console.error('Failed to record not interested preference');
      }
      
    } catch (error) {
      console.error('Error handling enhanced not interested:', error);
      console.log('🔇 Not interested error (popup disabled):', error.message);
    }
  }, [mediaType, addToSkippedMovies]);

  // ============================================================================
  // **SESSION DISMISSAL HANDLER - Temporary hiding without permanent disposition**
  // ============================================================================
  
  const handleSessionDismiss = useCallback((item) => {
    console.log(`🙈 Session dismiss: ${item.title || item.name} (temporary hiding)`);
    
    // Add to session dismissed list (not persistent)
    setDismissedInSession(prev => [...prev, item.id]);
    
    // Remove from current AI recommendations immediately for this session
    if (mediaType === 'movie') {
      setAiMovieRecommendations(prev => {
        const filtered = prev.filter(movie => movie.id !== item.id);
        console.log(`🗑️ Temporarily hidden from view: ${prev.length} -> ${filtered.length}`);
        return filtered;
      });
    } else {
      setAiTvRecommendations(prev => {
        const filtered = prev.filter(movie => movie.id !== item.id);
        console.log(`🗑️ Temporarily hidden from view: ${prev.length} -> ${filtered.length}`);
        return filtered;
      });
    }
    
  }, [mediaType]);

  // ============================================================================
  // **UTILITY FUNCTIONS - ENGINEER TEAM 10**
  // ============================================================================

  const handleContentTypeChange = useCallback((type) => {
    console.log('🔄 Content type changed to:', type);
    if (__DEV__) {
      const newMediaType = type === 'movies' ? 'movie' : 'tv';
      console.log('📺 DEV DEBUG - Media type switching to:', newMediaType);
      console.log('📺 DEV DEBUG - Current AI recommendations:', {
        movies: aiMovieRecommendations.length,
        tv: aiTvRecommendations.length
      });
      console.log('📺 DEV DEBUG - Current popular/recent:', {
        popular: popularMovies.length,
        recent: recentReleases.length
      });
      console.log('📺 DEV DEBUG - Seen content breakdown:', {
        totalSeen: seen.length,
        movies: seen.filter(m => (m.mediaType || 'movie') === 'movie').length,
        tvShows: seen.filter(m => (m.mediaType || 'movie') === 'tv').length,
        hasBreakingBad: seen.some(m => m.name === 'Breaking Bad' || m.title === 'Breaking Bad')
      });
    }
    setMediaType(type === 'movies' ? 'movie' : 'tv');
  }, [setMediaType, aiMovieRecommendations.length, aiTvRecommendations.length, popularMovies.length, recentReleases.length, seen]);
  // **CROSS-ROW DEDUPLICATION SYSTEM - Prevents duplicate movies across all sections**
  const deduplicateAllMovieSections = useCallback(() => {
    console.log('🔄 Running cross-row deduplication across all movie sections');
    
    // Collect all movies with their section information
    const allMovies = [
      ...popularMovies.map(m => ({ ...m, section: 'popular' })),
      ...recentReleases.map(m => ({ ...m, section: 'recent' })),
      ...actionMovies.map(m => ({ ...m, section: 'action' })),
      ...thrillerMovies.map(m => ({ ...m, section: 'thriller' })),
      ...comedyMovies.map(m => ({ ...m, section: 'comedy' })),
      ...aiRecommendations.map(m => ({ ...m, section: 'ai' })),
      ...socialRecommendations.map(m => ({ ...m, section: 'social' }))
    ];
    
    // Track movies we've already seen and their priority sections
    const seenMovieIds = new Set();
    const movieSectionPriority = {
      'recent': 1,      // Highest priority - new releases
      'popular': 2,     // Second priority - popular content
      'ai': 3,          // Third priority - personalized recommendations
      'social': 4,      // Fourth priority - friend recommendations
      'action': 5,      // Genre-specific sections have lower priority
      'thriller': 6,
      'comedy': 7
    };
    
    // Keep track of which movies to keep in each section
    const keptMovies = {
      popular: [],
      recent: [],
      action: [],
      thriller: [],
      comedy: [],
      ai: [],
      social: []
    };
    
    // Sort movies by section priority to handle duplicates correctly
    const sortedMovies = allMovies.sort((a, b) => {
      return movieSectionPriority[a.section] - movieSectionPriority[b.section];
    });
    
    // Process each movie and keep only the first occurrence (highest priority section)
    sortedMovies.forEach(movie => {
      if (!seenMovieIds.has(movie.id)) {
        seenMovieIds.add(movie.id);
        keptMovies[movie.section].push(movie);
      } else {
        console.log(`🗑️ DEDUPE: Removing duplicate "${movie.title || movie.name}" from ${movie.section} section`);
      }
    });
    
    // Update all state arrays with deduplicated movies
    if (keptMovies.popular.length !== popularMovies.length) {
      console.log(`📱 Updated popularMovies: ${popularMovies.length} -> ${keptMovies.popular.length}`);
      setPopularMovies(keptMovies.popular);
    }
    
    if (keptMovies.recent.length !== recentReleases.length) {
      console.log(`📱 Updated recentReleases: ${recentReleases.length} -> ${keptMovies.recent.length}`);
      setRecentReleases(keptMovies.recent);
    }
    
    if (keptMovies.action.length !== actionMovies.length) {
      console.log(`📱 Updated actionMovies: ${actionMovies.length} -> ${keptMovies.action.length}`);
      setActionMovies(keptMovies.action);
    }
    
    if (keptMovies.thriller.length !== thrillerMovies.length) {
      console.log(`📱 Updated thrillerMovies: ${thrillerMovies.length} -> ${keptMovies.thriller.length}`);
      setThrillerMovies(keptMovies.thriller);
    }
    
    if (keptMovies.comedy.length !== comedyMovies.length) {
      console.log(`📱 Updated comedyMovies: ${comedyMovies.length} -> ${keptMovies.comedy.length}`);
      setComedyMovies(keptMovies.comedy);
    }
    
    if (keptMovies.ai.length !== aiRecommendations.length) {
      console.log(`📱 Updated aiRecommendations: ${aiRecommendations.length} -> ${keptMovies.ai.length}`);
      if (mediaType === 'movie') {
        setAiMovieRecommendations(keptMovies.ai);
      } else {
        setAiTvRecommendations(keptMovies.ai);
      }
    }
    
    if (keptMovies.social.length !== socialRecommendations.length) {
      console.log(`📱 Updated socialRecommendations: ${socialRecommendations.length} -> ${keptMovies.social.length}`);
      setSocialRecommendations(keptMovies.social);
    }
    
    const totalOriginal = allMovies.length;
    const totalKept = Object.values(keptMovies).reduce((sum, arr) => sum + arr.length, 0);
    const duplicatesRemoved = totalOriginal - totalKept;
    
    if (duplicatesRemoved > 0) {
      console.log(`✅ Deduplication complete: Removed ${duplicatesRemoved} duplicates from ${totalOriginal} total movies`);
    }
  }, [popularMovies, recentReleases, actionMovies, thrillerMovies, comedyMovies, aiRecommendations, socialRecommendations, mediaType]);

  // **UNIFIED MOVIE REMOVAL UTILITY - CODE_BIBLE Commandment #3: Write code that's clear and obvious**
  const removeMovieFromAllSections = useCallback((movieId) => {
    console.log(`🗑️ Removing movie ${movieId} from ALL home screen sections`);
    
    setPopularMovies(prev => {
      const filtered = prev.filter(movie => movie.id !== movieId);
      console.log(`🗑️ Removed from popularMovies: ${prev.length} -> ${filtered.length}`);
      return filtered;
    });
    
    setRecentReleases(prev => {
      const filtered = prev.filter(movie => movie.id !== movieId);
      console.log(`🗑️ Removed from recentReleases: ${prev.length} -> ${filtered.length}`);
      return filtered;
    });
    
    // **CRITICAL FIX: Remove from BOTH AI recommendation arrays regardless of current media type**
    // This prevents movies from reappearing when user switches between Movies/TV tabs
    setAiMovieRecommendations(prev => {
      const filtered = prev.filter(movie => movie.id !== movieId);
      if (filtered.length !== prev.length) {
        console.log(`🗑️ Removed from aiMovieRecommendations: ${prev.length} -> ${filtered.length}`);
      }
      return filtered;
    });
    
    setAiTvRecommendations(prev => {
      const filtered = prev.filter(movie => movie.id !== movieId);
      if (filtered.length !== prev.length) {
        console.log(`🗑️ Removed from aiTvRecommendations: ${prev.length} -> ${filtered.length}`);
      }
      return filtered;
    });
    
    setSocialRecommendations(prev => {
      const filtered = prev.filter(movie => movie.id !== movieId);
      console.log(`🗑️ Removed from socialRecommendations: ${prev.length} -> ${filtered.length}`);
      return filtered;
    });
    
    setActionMovies(prev => {
      const filtered = prev.filter(movie => movie.id !== movieId);
      if (filtered.length !== prev.length) {
        console.log(`🗑️ Removed from actionMovies: ${prev.length} -> ${filtered.length}`);
      }
      return filtered;
    });
    
    setThrillerMovies(prev => {
      const filtered = prev.filter(movie => movie.id !== movieId);
      if (filtered.length !== prev.length) {
        console.log(`🗑️ Removed from thrillerMovies: ${prev.length} -> ${filtered.length}`);
      }
      return filtered;
    });
    
    setComedyMovies(prev => {
      const filtered = prev.filter(movie => movie.id !== movieId);
      if (filtered.length !== prev.length) {
        console.log(`🗑️ Removed from comedyMovies: ${prev.length} -> ${filtered.length}`);
      }
      return filtered;
    });
  }, [setPopularMovies, setRecentReleases, setAiMovieRecommendations, setAiTvRecommendations, setSocialRecommendations, setActionMovies, setThrillerMovies, setComedyMovies]);

  // **CROSS-ROW DEDUPLICATION TRIGGER - Automatically run deduplication when any movie data changes**
  useEffect(() => {
    // Only run deduplication if we have movies in multiple sections
    const hasMultipleSections = [
      popularMovies.length,
      recentReleases.length,
      actionMovies.length,
      thrillerMovies.length,
      comedyMovies.length,
      aiRecommendations.length,
      socialRecommendations.length
    ].filter(count => count > 0).length >= 2;

    if (hasMultipleSections) {
      // Small delay to allow all state updates to complete
      const deduplicationTimer = setTimeout(() => {
        deduplicateAllMovieSections();
      }, 100);

      return () => clearTimeout(deduplicationTimer);
    }
  }, [popularMovies.length, recentReleases.length, actionMovies.length, thrillerMovies.length, comedyMovies.length, aiRecommendations.length, socialRecommendations.length, deduplicateAllMovieSections]);

  const formatDate = useCallback((date) => {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString(undefined, options);
  }, []);
  
  const formatDateForAPI = useCallback((date) => {
    return date.toISOString().split('T')[0];
  }, []);
  
  const formatReleaseDate = useCallback((dateString) => {
    const options = { month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
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
  const prioritizeStreamingProviders = useCallback((providers, userPreferences = []) => {
    if (!providers || !Array.isArray(providers)) return [];
    
    // First deduplicate providers
    const deduplicated = deduplicateProviders(providers);
    
    // Separate free (flatrate) and paid (rent/buy) providers
    const freeProviders = deduplicated.filter(p => p.providerType === 'flatrate');
    const paidProviders = deduplicated.filter(p => p.providerType === 'rent' || p.providerType === 'buy');
    
    // Helper function to sort providers by priority within each group
    const sortByPriority = (providerList) => {
      return providerList.sort((a, b) => {
        // Check if user has preferences for these providers
        const aUserPref = userPreferences.findIndex(pref => pref.id === a.provider_id);
        const bUserPref = userPreferences.findIndex(pref => pref.id === b.provider_id);
        
        // User preferences take highest priority
        if (aUserPref !== -1 && bUserPref !== -1) {
          return aUserPref - bUserPref; // Sort by user preference order
        }
        if (aUserPref !== -1) return -1; // a is user preference
        if (bUserPref !== -1) return 1;  // b is user preference
        
        // Then sort by top 10 priority
        const aPriority = STREAMING_SERVICES_PRIORITY.find(s => s.id === a.provider_id);
        const bPriority = STREAMING_SERVICES_PRIORITY.find(s => s.id === b.provider_id);
        
        if (aPriority && bPriority) {
          return aPriority.priority - bPriority.priority;
        }
        if (aPriority) return -1; // a is in top 10
        if (bPriority) return 1;  // b is in top 10
        
        // Finally, sort by name for consistent ordering
        return a.provider_name.localeCompare(b.provider_name);
      });
    };
    
    // Sort both free and paid providers by priority
    const sortedFree = sortByPriority(freeProviders);
    const sortedPaid = sortByPriority(paidProviders);
    
    // Two-pass system: First pass for free, second pass for paid
    const result = [];
    
    // Pass 1: Add free providers up to 3 slots
    result.push(...sortedFree.slice(0, 3));
    
    // Pass 2: If we don't have 3 services yet, fill remaining slots with paid
    const remainingSlots = Math.max(0, 3 - result.length);
    if (remainingSlots > 0) {
      result.push(...sortedPaid.slice(0, remainingSlots));
    }
    
    return result;
  }, [deduplicateProviders]);

  const getProviderLogoUrl = useCallback((logoPath, providerId) => {
    if (!logoPath) return null;
    
    // Use blue Amazon Prime logo for better brand recognition
    if (providerId === 9) {
      return 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Amazon_Prime_Video_logo.svg/300px-Amazon_Prime_Video_logo.svg.png';
    }
    
    return `https://image.tmdb.org/t/p/w92${logoPath}`;
  }, []);

  // ============================================================================
  // **DATA FETCHING SYSTEM - ENGINEER TEAM 11**
  // ============================================================================

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
      
      // Get all provider types: flatrate (free with subscription), rent, buy
      const usProviders = data.results?.US || {};
      const allProviders = [
        ...(usProviders.flatrate || []).map(p => ({ ...p, providerType: 'flatrate' })),
        ...(usProviders.rent || []).map(p => ({ ...p, providerType: 'rent' })),
        ...(usProviders.buy || []).map(p => ({ ...p, providerType: 'buy' }))
      ];
      
      return allProviders;
    } catch (error) {
      console.error('Error fetching movie providers:', error);
      return [];
    }
  }, []);

  const fetchAIRecommendations = useCallback(async (forceRefresh = false) => {
    try {
      setIsLoadingRecommendations(true);
      if (forceRefresh) {
        setIsRefreshingAI(true);
      }
      
      // Check if we already have both movie and TV recommendations
      if (!forceRefresh && aiMovieRecommendations.length > 0 && aiTvRecommendations.length > 0) {
        console.log('✅ AI recommendations already loaded for both media types, skipping fetch');
        setIsLoadingRecommendations(false);
        return;
      }
      
      const mediaTypes = ['movie', 'tv'];
      const results = { movie: [], tv: [] };
      
      for (const mediaTypeToFetch of mediaTypes) {
        // Check if we already have data for this media type (unless forced refresh)
        if (!forceRefresh) {
          if (mediaTypeToFetch === 'movie' && aiMovieRecommendations.length > 0) {
            results.movie = aiMovieRecommendations;
            continue;
          }
          if (mediaTypeToFetch === 'tv' && aiTvRecommendations.length > 0) {
            results.tv = aiTvRecommendations;
            continue;
          }
        }
        
        // Filter by current media type first, then by rating  
        const currentMediaContent = currentSeenContent;
        
        if (currentMediaContent.length === 0) {
          console.log(`❌ AI recommendations stopped - no rated ${mediaTypeToFetch} content`);
          results[mediaTypeToFetch] = [];
          continue;
        }
        
        const topRatedContent = currentMediaContent
          .filter(item => item.userRating && item.userRating >= 7)
          .sort((a, b) => b.userRating - a.userRating)
          .slice(0, 10);
        
        // Use the best available content for recommendations
        const recommendationBasis = topRatedContent.length >= 3 ? topRatedContent : 
          currentMediaContent.filter(item => item.userRating && item.userRating >= 5).slice(0, 10);
        
        if (recommendationBasis.length === 0) {
          console.log(`❌ AI recommendations stopped - no ${mediaTypeToFetch} content rated 5+ stars`);
          results[mediaTypeToFetch] = [];
          continue;
        }
        
        console.log(`🎯 Fetching AI recommendations for ${mediaTypeToFetch}`);
        
        // Get raw recommendations
        const rawRecommendations = await getImprovedRecommendations(
          recommendationBasis, 
          mediaTypeToFetch,
          {
            count: 50,
            seen: seen,
            unseen: unseen,
            skipped: skippedMovies,
            notInterested: notInterestedMoviesRef.current,
            useDiscoverySession: true,
            sessionType: getCurrentSessionType(),
            userId: userId,
            useGroq: true
          }
        );
        
        // **SIMPLE FILTER LIKE POPULAR MOVIES - EXACTLY THE SAME APPROACH**
        const filtered = rawRecommendations
          .filter(m => !currentSeenContent.some(s => s.id === m.id)) // Remove rated content  
          .filter(m => !currentUnseenContent.some(u => u.id === m.id)) // Remove watchlist content
          .filter(m => !skippedMovies.includes(m.id))
          .filter(m => !notInterestedMoviesRef.current.includes(m.id))
          .filter(m => !dismissedInSession.includes(m.id))
          .slice(0, 10);
        
        results[mediaTypeToFetch] = filtered;
        console.log(`✅ AI ${mediaTypeToFetch}: ${rawRecommendations.length} -> ${filtered.length} after filtering`);
      }
      
      // Store recommendations
      setAiMovieRecommendations(results.movie);
      setAiTvRecommendations(results.tv);
      
    } catch (error) {
      console.error('Failed to fetch AI recommendations:', error);
      console.log('🔇 AI error suppressed (popup disabled):', error.message);
      
      setAiMovieRecommendations([]);
      setAiTvRecommendations([]);
    } finally {
      setIsLoadingRecommendations(false);
      setIsRefreshingAI(false);
    }
  }, [currentSeenContent, currentUnseenContent, skippedMovies, dismissedInSession, mediaType, aiMovieRecommendations, aiTvRecommendations, seen, unseen, userId]); // Dependencies: currentSeenContent already includes seen/unseen changes

  // **PERFORMANCE OPTIMIZATION: Firebase error caching**
  const [firebaseErrorCache, setFirebaseErrorCache] = useState(new Map());
  const FIREBASE_ERROR_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  // Social recommendations function with error caching
  const fetchSocialRecommendations = useCallback(async () => {
    if (!currentUser?.id) return;
    
    // **PERFORMANCE: Check Firebase error cache to prevent repeated failures**
    const cacheKey = `social_recs_${currentUser.id}_${contentType}`;
    const cachedError = firebaseErrorCache.get(cacheKey);
    const now = Date.now();
    
    if (cachedError && (now - cachedError.timestamp) < FIREBASE_ERROR_CACHE_DURATION) {
      console.log(`⚡ Firebase error cached - skipping social recommendations for ${Math.round((FIREBASE_ERROR_CACHE_DURATION - (now - cachedError.timestamp)) / 1000)}s`);
      setSocialRecommendations([]);
      return;
    }
    
    try {
      setIsLoadingSocialRecs(true);
      console.log('🤝 Fetching social recommendations...');
      
      const currentMediaType = contentType === 'movies' ? 'movie' : 'tv';
      const socialRecs = await SocialRecommendationService.getSocialRecommendations(
        currentUser.id,
        currentSeenContent,
        {
          mediaType: currentMediaType,
          count: 5,
          includeReasons: true,
          excludeSeenMovies: true
        }
      );
      
      // **PERFORMANCE: Clear error cache on success**
      if (firebaseErrorCache.has(cacheKey)) {
        const newCache = new Map(firebaseErrorCache);
        newCache.delete(cacheKey);
        setFirebaseErrorCache(newCache);
      }
      
      // **DOUBLE SAFETY: Filter out any rated movies that slipped through**
      const safeSocialRecs = socialRecs.filter(rec => {
        const isRated = currentSeenContent.some(seen => seen.id === (rec.id || rec.movieId));
        if (isRated) {
          console.log(`🚫 SAFETY FILTER: Removing rated movie ${rec.title || rec.name} from social recommendations`);
        }
        return !isRated;
      });
      
      setSocialRecommendations(safeSocialRecs);
      console.log(`✅ Got ${safeSocialRecs.length} social recommendations (${socialRecs.length - safeSocialRecs.length} filtered out)`);
      
    } catch (error) {
      console.error('❌ Error fetching social recommendations:', error);
      
      // **PERFORMANCE: Cache Firebase errors to prevent repeated attempts**
      const newCache = new Map(firebaseErrorCache);
      newCache.set(cacheKey, { 
        error: error.message, 
        timestamp: now,
        type: 'firebase_permission'
      });
      setFirebaseErrorCache(newCache);
      
      setSocialRecommendations([]);
    } finally {
      setIsLoadingSocialRecs(false);
    }
  }, [currentUser?.id, contentType, seen, firebaseErrorCache, FIREBASE_ERROR_CACHE_DURATION, currentSeenContent]);

  const handleRefreshAI = useCallback(async () => {
    try {
      // Simple refresh with improved system - no rate limits needed
      await fetchAIRecommendations();
    } catch (error) {
      console.error('Error refreshing recommendations:', error);
    }
  }, [fetchAIRecommendations]);

  const fetchPopularMovies = useCallback(async () => {
    try {
      let allResults = [];
      
      for (let page = 1; page <= 5; page++) {
        const endpoint = contentType === 'movies'
          ? `https://api.themoviedb.org/3/movie/popular?api_key=b401be0ea16515055d8d0bde16f80069&language=en-US&page=${page}&include_adult=false`
          : `https://api.themoviedb.org/3/tv/popular?api_key=b401be0ea16515055d8d0bde16f80069&language=en-US&page=${page}&include_adult=false`;
          
        const res = await fetch(endpoint);
        const { results } = await res.json();
        allResults = [...allResults, ...results];
      }
      
      // **🏠 FILTER OUT RATED CONTENT FROM HOME SCREEN**
      const filtered = filterAdultContent(allResults, contentType === 'movies' ? 'movie' : 'tv')
        .filter(m => !currentSeenContent.some(s => s.id === m.id)) // Remove rated content
        .filter(m => !currentUnseenContent.some(u => u.id === m.id)) // Remove watchlist content
        .filter(m => !skippedMovies.includes(m.id))
        .filter(m => !notInterestedMoviesRef.current.includes(m.id))
        .filter(item => {
          // **RATING FILTER: Only show movies/TV with TMDB rating >= 6.5**
          if (item.vote_average && item.vote_average < 6.5) {
            return false;
          }
          
          if (contentType === 'tv') {
            const excludedGenres = [10767, 10763, 10762, 10764];
            const topThreeGenres = item.genre_ids ? item.genre_ids.slice(0, 3) : [];
            
            const hasExcludedGenre = topThreeGenres.some(genreId => excludedGenres.includes(genreId));
            
            if (hasExcludedGenre) {
              console.log(`🚫 FILTERED OUT: ${item.name} - Top 3 genres: ${topThreeGenres} contain excluded genre`);
              return false;
            }
            
            if (item.origin_country && Array.isArray(item.origin_country)) {
              const allowedCountries = ['US', 'GB', 'UK'];
              const hasAllowedCountry = item.origin_country.some(country => allowedCountries.includes(country));
              if (!hasAllowedCountry) {
                return false;
              }
            }
            
            if (item.name && item.name.toLowerCase().includes('good mythical morning')) {
              return false;
            }
          }
          return true;
        })
        .slice(0, 15);

      const enrichedResults = await Promise.all(
        filtered.map(async (item) => {
          let streamingProviders = [];
          try {
            const mediaTypeForAPI = contentType === 'movies' ? 'movie' : 'tv';
            const providerResponse = await fetch(
              `https://api.themoviedb.org/3/${mediaTypeForAPI}/${item.id}/watch/providers?api_key=b401be0ea16515055d8d0bde16f80069`
            );
            const providerData = await providerResponse.json();
            // Get all provider types: flatrate (free with subscription), rent, buy
            const usProviders = providerData.results?.US || {};
            streamingProviders = [
              ...(usProviders.flatrate || []).map(p => ({ ...p, providerType: 'flatrate' })),
              ...(usProviders.rent || []).map(p => ({ ...p, providerType: 'rent' })),
              ...(usProviders.buy || []).map(p => ({ ...p, providerType: 'buy' }))
            ];
          } catch (error) {
            console.error('Error fetching streaming providers:', error);
          }
          
          return {
            ...item,
            title: contentType === 'movies' ? item.title : item.name,
            release_date: contentType === 'movies' ? item.release_date : item.first_air_date,
            poster_path: item.poster_path,
            vote_average: item.vote_average,
            genre_ids: item.genre_ids,
            overview: item.overview,
            adult: item.adult || false,
            mediaType: contentType === 'movies' ? 'movie' : 'tv',
            streamingProviders: streamingProviders,
            weightedScore: (item.popularity * 0.7) + (item.vote_average * 0.3)
          };
        })
      );
      
      const sortedFiltered = enrichedResults
        .sort((a, b) => b.weightedScore - a.weightedScore)
        .slice(0, 10);
      
      console.log(`🎬 Popular ${mediaType === 'movie' ? 'movies' : 'TV shows'} updated: ${sortedFiltered.length} items (filtered out ${allResults.length - sortedFiltered.length} rated/watchlisted items)`);
      setPopularMovies(sortedFiltered);
      setLastDataFetch(Date.now()); // **PERFORMANCE: Update cache timestamp**
    } catch (err) {
      console.warn(`Failed fetching popular ${contentType}`, err);
    }
  }, [currentSeenContent, currentUnseenContent, contentType, skippedMovies, mediaType]); // Dependencies: currentSeenContent already includes seen/unseen changes

  const fetchActionMovies = useCallback(async () => {
    try {
      let allResults = [];
      
      // Fetch 3 pages of action movies (genre ID: 28)
      for (let page = 1; page <= 3; page++) {
        const endpoint = contentType === 'movies'
          ? `https://api.themoviedb.org/3/discover/movie?api_key=b401be0ea16515055d8d0bde16f80069&language=en-US&with_genres=28&sort_by=popularity.desc&include_adult=false&vote_count.gte=10&vote_average.gte=6.5&page=${page}`
          : `https://api.themoviedb.org/3/discover/tv?api_key=b401be0ea16515055d8d0bde16f80069&language=en-US&with_genres=10759&sort_by=popularity.desc&include_adult=false&vote_count.gte=10&vote_average.gte=6.5&page=${page}`;
          
        const res = await fetch(endpoint);
        const { results } = await res.json();
        allResults = [...allResults, ...results];
      }
      
      // Apply same filtering as existing sections
      const filtered = filterAdultContent(allResults, contentType === 'movies' ? 'movie' : 'tv')
        .filter(m => !currentSeenContent.some(s => s.id === m.id))
        .filter(m => !currentUnseenContent.some(u => u.id === m.id))
        .filter(m => !skippedMovies.includes(m.id))
        .filter(m => !notInterestedMoviesRef.current.includes(m.id))
        .slice(0, 15);

      // Enrich with streaming providers and create weighted score
      const enrichedResults = await Promise.all(
        filtered.map(async (item) => {
          let streamingProviders = [];
          try {
            const mediaTypeForAPI = contentType === 'movies' ? 'movie' : 'tv';
            const providerResponse = await fetch(
              `https://api.themoviedb.org/3/${mediaTypeForAPI}/${item.id}/watch/providers?api_key=b401be0ea16515055d8d0bde16f80069`
            );
            const providerData = await providerResponse.json();
            const usProviders = providerData.results?.US || {};
            streamingProviders = [
              ...(usProviders.flatrate || []).map(p => ({ ...p, providerType: 'flatrate' })),
              ...(usProviders.rent || []).map(p => ({ ...p, providerType: 'rent' })),
              ...(usProviders.buy || []).map(p => ({ ...p, providerType: 'buy' }))
            ];
          } catch (error) {
            console.error('Error fetching streaming providers for action movie:', error);
          }
          
          return {
            ...item,
            title: contentType === 'movies' ? item.title : item.name,
            release_date: contentType === 'movies' ? item.release_date : item.first_air_date,
            poster_path: item.poster_path,
            vote_average: item.vote_average,
            genre_ids: item.genre_ids,
            overview: item.overview,
            adult: item.adult || false,
            mediaType: contentType === 'movies' ? 'movie' : 'tv',
            streamingProviders: streamingProviders,
            weightedScore: (item.popularity * 0.7) + (item.vote_average * 0.3)
          };
        })
      );
      
      const sortedFiltered = enrichedResults
        .sort((a, b) => b.weightedScore - a.weightedScore)
        .slice(0, 10);
      
      console.log(`🎬 Action ${mediaType === 'movie' ? 'movies' : 'TV shows'} updated: ${sortedFiltered.length} items`);
      setActionMovies(sortedFiltered);
    } catch (err) {
      console.warn(`Failed fetching action ${contentType}`, err);
    }
  }, [currentSeenContent, currentUnseenContent, contentType, skippedMovies, mediaType]);

  const fetchThrillerMovies = useCallback(async () => {
    try {
      let allResults = [];
      
      // Fetch 3 pages of thriller movies (genre ID: 53)
      for (let page = 1; page <= 3; page++) {
        const endpoint = contentType === 'movies'
          ? `https://api.themoviedb.org/3/discover/movie?api_key=b401be0ea16515055d8d0bde16f80069&language=en-US&with_genres=53&sort_by=popularity.desc&include_adult=false&vote_count.gte=10&vote_average.gte=6.5&page=${page}`
          : `https://api.themoviedb.org/3/discover/tv?api_key=b401be0ea16515055d8d0bde16f80069&language=en-US&with_genres=9648&sort_by=popularity.desc&include_adult=false&vote_count.gte=10&vote_average.gte=6.5&page=${page}`;
          
        const res = await fetch(endpoint);
        const { results } = await res.json();
        allResults = [...allResults, ...results];
      }
      
      // Apply same filtering as existing sections
      const filtered = filterAdultContent(allResults, contentType === 'movies' ? 'movie' : 'tv')
        .filter(m => !currentSeenContent.some(s => s.id === m.id))
        .filter(m => !currentUnseenContent.some(u => u.id === m.id))
        .filter(m => !skippedMovies.includes(m.id))
        .filter(m => !notInterestedMoviesRef.current.includes(m.id))
        .slice(0, 15);

      // Enrich with streaming providers and create weighted score
      const enrichedResults = await Promise.all(
        filtered.map(async (item) => {
          let streamingProviders = [];
          try {
            const mediaTypeForAPI = contentType === 'movies' ? 'movie' : 'tv';
            const providerResponse = await fetch(
              `https://api.themoviedb.org/3/${mediaTypeForAPI}/${item.id}/watch/providers?api_key=b401be0ea16515055d8d0bde16f80069`
            );
            const providerData = await providerResponse.json();
            const usProviders = providerData.results?.US || {};
            streamingProviders = [
              ...(usProviders.flatrate || []).map(p => ({ ...p, providerType: 'flatrate' })),
              ...(usProviders.rent || []).map(p => ({ ...p, providerType: 'rent' })),
              ...(usProviders.buy || []).map(p => ({ ...p, providerType: 'buy' }))
            ];
          } catch (error) {
            console.error('Error fetching streaming providers for thriller movie:', error);
          }
          
          return {
            ...item,
            title: contentType === 'movies' ? item.title : item.name,
            release_date: contentType === 'movies' ? item.release_date : item.first_air_date,
            poster_path: item.poster_path,
            vote_average: item.vote_average,
            genre_ids: item.genre_ids,
            overview: item.overview,
            adult: item.adult || false,
            mediaType: contentType === 'movies' ? 'movie' : 'tv',
            streamingProviders: streamingProviders,
            weightedScore: (item.popularity * 0.7) + (item.vote_average * 0.3)
          };
        })
      );
      
      const sortedFiltered = enrichedResults
        .sort((a, b) => b.weightedScore - a.weightedScore)
        .slice(0, 10);
      
      console.log(`🎬 Thriller ${mediaType === 'movie' ? 'movies' : 'TV shows'} updated: ${sortedFiltered.length} items`);
      setThrillerMovies(sortedFiltered);
    } catch (err) {
      console.warn(`Failed fetching thriller ${contentType}`, err);
    }
  }, [currentSeenContent, currentUnseenContent, contentType, skippedMovies, mediaType]);

  const fetchComedyMovies = useCallback(async () => {
    try {
      let allResults = [];
      
      // Fetch 3 pages of comedy movies (genre ID: 35)
      for (let page = 1; page <= 3; page++) {
        const endpoint = contentType === 'movies'
          ? `https://api.themoviedb.org/3/discover/movie?api_key=b401be0ea16515055d8d0bde16f80069&language=en-US&with_genres=35&sort_by=popularity.desc&include_adult=false&vote_count.gte=10&vote_average.gte=6.5&page=${page}`
          : `https://api.themoviedb.org/3/discover/tv?api_key=b401be0ea16515055d8d0bde16f80069&language=en-US&with_genres=35&sort_by=popularity.desc&include_adult=false&vote_count.gte=10&vote_average.gte=6.5&page=${page}`;
          
        const res = await fetch(endpoint);
        const { results } = await res.json();
        allResults = [...allResults, ...results];
      }
      
      // Apply same filtering as existing sections
      const filtered = filterAdultContent(allResults, contentType === 'movies' ? 'movie' : 'tv')
        .filter(m => !currentSeenContent.some(s => s.id === m.id))
        .filter(m => !currentUnseenContent.some(u => u.id === m.id))
        .filter(m => !skippedMovies.includes(m.id))
        .filter(m => !notInterestedMoviesRef.current.includes(m.id))
        .slice(0, 15);

      // Enrich with streaming providers and create weighted score
      const enrichedResults = await Promise.all(
        filtered.map(async (item) => {
          let streamingProviders = [];
          try {
            const mediaTypeForAPI = contentType === 'movies' ? 'movie' : 'tv';
            const providerResponse = await fetch(
              `https://api.themoviedb.org/3/${mediaTypeForAPI}/${item.id}/watch/providers?api_key=b401be0ea16515055d8d0bde16f80069`
            );
            const providerData = await providerResponse.json();
            const usProviders = providerData.results?.US || {};
            streamingProviders = [
              ...(usProviders.flatrate || []).map(p => ({ ...p, providerType: 'flatrate' })),
              ...(usProviders.rent || []).map(p => ({ ...p, providerType: 'rent' })),
              ...(usProviders.buy || []).map(p => ({ ...p, providerType: 'buy' }))
            ];
          } catch (error) {
            console.error('Error fetching streaming providers for comedy movie:', error);
          }
          
          return {
            ...item,
            title: contentType === 'movies' ? item.title : item.name,
            release_date: contentType === 'movies' ? item.release_date : item.first_air_date,
            poster_path: item.poster_path,
            vote_average: item.vote_average,
            genre_ids: item.genre_ids,
            overview: item.overview,
            adult: item.adult || false,
            mediaType: contentType === 'movies' ? 'movie' : 'tv',
            streamingProviders: streamingProviders,
            weightedScore: (item.popularity * 0.7) + (item.vote_average * 0.3)
          };
        })
      );
      
      const sortedFiltered = enrichedResults
        .sort((a, b) => b.weightedScore - a.weightedScore)
        .slice(0, 10);
      
      console.log(`🎬 Comedy ${mediaType === 'movie' ? 'movies' : 'TV shows'} updated: ${sortedFiltered.length} items`);
      setComedyMovies(sortedFiltered);
    } catch (err) {
      console.warn(`Failed fetching comedy ${contentType}`, err);
    }
  }, [currentSeenContent, currentUnseenContent, contentType, skippedMovies, mediaType]);
  
  const fetchRecentReleases = useCallback(async () => {
    try {
      setIsLoadingRecent(true);
      
      const todayFormatted = formatDateForAPI(today);
      const oneWeekAgoFormatted = formatDateForAPI(oneWeekAgo);
      
      const endpoint = contentType === 'movies' 
        ? `https://api.themoviedb.org/3/discover/movie?api_key=b401be0ea16515055d8d0bde16f80069&language=en-US&sort_by=primary_release_date.desc&include_adult=false&include_video=false&page=1&primary_release_date.gte=${oneWeekAgoFormatted}&primary_release_date.lte=${todayFormatted}&vote_count.gte=5&vote_average.gte=6.5`
        : `https://api.themoviedb.org/3/discover/tv?api_key=b401be0ea16515055d8d0bde16f80069&language=en-US&sort_by=first_air_date.desc&include_adult=false&page=1&first_air_date.gte=${oneWeekAgoFormatted}&first_air_date.lte=${todayFormatted}&vote_count.gte=5&vote_average.gte=6.5`;
      
      const response = await fetch(endpoint);
      
      if (!response.ok) {
        throw new Error('Failed to fetch recent releases');
      }
      
      const data = await response.json();
      const filteredResults = filterAdultContent(data.results, contentType === 'movies' ? 'movie' : 'tv');
      
      // **🏠 FILTER OUT RATED MOVIES FROM RECENT RELEASES**
      const recentContent = filteredResults
        .filter(item => item.poster_path)
        .filter(item => !skippedMovies.includes(item.id))
        .filter(item => !notInterestedMoviesRef.current.includes(item.id))
        .filter(item => {
          const isAlreadyRated = seen.some(m => m.id === item.id);
          const isInWatchlist = unseen.some(m => m.id === item.id);
          
          if (__DEV__ && (isAlreadyRated || isInWatchlist)) {
            console.log(`🚫 FILTERED OUT: ${item.title || item.name} - ${isAlreadyRated ? 'Already rated' : 'In watchlist'} (ID: ${item.id})`);
          }
          
          return !isAlreadyRated && !isInWatchlist;
        })
        .map(item => ({
          id: item.id,
          title: contentType === 'movies' ? item.title : item.name,
          poster: item.poster_path,
          poster_path: item.poster_path,
          score: item.vote_average,
          vote_average: item.vote_average,
          voteCount: item.vote_count,
          release_date: contentType === 'movies' ? item.release_date : item.first_air_date,
          genre_ids: item.genre_ids,
          overview: item.overview || "",
          adult: item.adult || false,
          alreadySeen: false, // Always false since we filtered out rated movies
          inWatchlist: unseen.some(m => m.id === item.id),
          userRating: null, // Always null since we filtered out rated movies
          mediaType: contentType === 'movies' ? 'movie' : 'tv'
        }));
      
      console.log(`🎬 Recent releases updated: ${recentContent.length} items (filtered out rated ${mediaType === 'movie' ? 'movies' : 'TV shows'})`);
      setRecentReleases(recentContent);
      setLastDataFetch(Date.now()); // **PERFORMANCE: Update cache timestamp**
      setIsLoadingRecent(false);
    } catch (error) {
      console.error('Error fetching recent releases:', error);
      setIsLoadingRecent(false);
    }
  }, [today, oneWeekAgo, seen, unseen, formatDateForAPI, contentType, skippedMovies, mediaType]); // CODE_BIBLE Fix: Removed notInterestedMovies dependency

  // ============================================================================
  // **ANIMATION SYSTEM - ENGINEER TEAM 12**
  // ============================================================================

  const startPopularAutoScroll = useCallback(() => {
    // DISABLED: Auto-scroll completely removed to prevent screen movement
    // if (autoScrollPopular.current) clearInterval(autoScrollPopular.current);
    // autoScrollPopular.current = setInterval(() => {
    //   const next = (popularIndex + 1) % 10;
    //   // REMOVED: popularScrollX animation
    //   setPopularIndex(next);
    // }, 5000);
  }, []);


  // ============================================================================
  // **ENHANCED RATING SYSTEM LOGIC - ENGINEER TEAM 12.5**
  // ============================================================================

  const handleSentimentSelect = useCallback((categoryKey) => {
    console.log('🎭 User selected sentiment:', categoryKey);
    setSelectedCategory(categoryKey);
    
    // Hide sentiment buttons and show processing state
    setShowSentimentButtons(false);
    
    // Fade animation removed
    
    // **PERFORMANCE: Use memoized rating categories instead of recalculating**
    const RATING_CATEGORIES = memoizedRatingCategories;
    const categoryInfo = RATING_CATEGORIES[categoryKey];
    
    // Find movies in the same rating range for comparison (filtered by media type)
    const categoryMovies = getMoviesInRatingRange(
      currentMediaMovies,
      categoryInfo.ratingRange,
      selectedMovie.id
    );
    
    if (categoryMovies.length >= 3) {
      // Get best 3 comparison movies
      const scoredMovies = categoryMovies.map(m => ({
        ...m,
        comparisonScore: calculateComparisonScore(m, selectedMovie, genres)
      }));
      
      const bestComparisons = scoredMovies
        .sort((a, b) => b.comparisonScore - a.comparisonScore);
      
      setComparisonMovies(bestComparisons);
      setCurrentComparison(0);

      setIsComparisonComplete(false);
      setComparisonModalVisible(true);
      return;
    }
    
    // Not enough movies for comparison, use category average based on rating range
    const categoryAverage = seen && seen.length > 0 && categoryInfo.ratingRange ? 
      (() => {
        const [minRating, maxRating] = categoryInfo.ratingRange;
        return (minRating + maxRating) / 2;
      })() :
      getDefaultRatingForCategory(categoryKey);
    handleConfirmRating(categoryAverage);
  }, [currentSeenContent, selectedMovie, genres, calculateComparisonScore, getMoviesInRatingRange, handleConfirmRating, memoizedRatingCategories, seen]);

  // CODE_BIBLE Fix: Replace percentile-based selection with rating-range-based selection
  const getMoviesInRatingRange = useCallback((userMovies, ratingRange, excludeMovieId) => {
    if (!userMovies || userMovies.length === 0 || !ratingRange || !Array.isArray(ratingRange)) return [];
    
    const [minRating, maxRating] = ratingRange;
    
    const filteredMovies = userMovies
      .filter(movie => movie.id !== excludeMovieId && movie.userRating)
      .filter(movie => movie.userRating >= minRating && movie.userRating <= maxRating);
    
    console.log(`🎯 Found ${filteredMovies.length} movies in rating range ${minRating.toFixed(1)}-${maxRating.toFixed(1)}`);
    
    return filteredMovies;
  }, []);

  // Keep old function for legacy compatibility if needed elsewhere
  // Removed getMoviesInPercentileRange - now using EnhancedRatingSystem only

  const calculateComparisonScore = useCallback((movie, newMovie, genres) => {
    let score = 0;
    
    // Genre similarity (highest weight)
    const newMovieGenres = new Set(newMovie.genre_ids || []);
    const movieGenres = new Set(movie.genre_ids || []);
    const genreIntersection = [...newMovieGenres].filter(g => movieGenres.has(g));
    score += (genreIntersection.length / Math.max(newMovieGenres.size, 1)) * 40;
    
    // Release year proximity (medium weight)
    const newYear = new Date(newMovie.release_date || '2000').getFullYear();
    const movieYear = new Date(movie.release_date || '2000').getFullYear();
    const yearDiff = Math.abs(newYear - movieYear);
    score += Math.max(0, 20 - yearDiff) * 0.5;
    
    // Rating proximity within category (low weight)
    const ratingDiff = Math.abs(7 - movie.userRating);
    score += Math.max(0, 10 - ratingDiff * 2);
    
    return score;
  }, []);

  // OLD HANDLECOMPARISON - Replaced with ConfidenceBasedComparison component
  // const handleComparison = useCallback((winner) => { ... }, [dependencies]);

  // ELO-based rating calculation now uses centralized function from EnhancedRatingSystem

  // Note: Emotion baselines removed - using pure Unknown vs Known comparison
  
  // REMOVED: Local percentile selection - now using EnhancedRatingSystem directly
  
  // REMOVED: 200+ line duplicate handleComparison function - now handled by ConfidenceBasedComparison
  // - Removed manual ELO calculations that duplicate EnhancedRatingSystem
  // - Removed manual AsyncStorage updates that duplicate EnhancedRatingSystem  
  // - Removed manual comparison state management that bypasses ConfidenceBasedComparison
  // - ALL RATING LOGIC NOW DELEGATED TO ENHANCEDRATINGSYSTEM

  // Handle emotion selection and start comparison process
  const handleEmotionSelected = useCallback((emotion, sentimentRating = null) => {
    console.log('🎭 EMOTION SELECTED:', emotion);
    console.log('🔧 SENTIMENT RATING RECEIVED:', sentimentRating);
    console.log('🎭 CURRENT MEDIA TYPE:', mediaType);
    console.log('🎭 FILTERED CONTENT COUNT:', currentSeenContent.length);
    console.log('🎭 FILTERED CONTENT:', currentSeenContent.map(m => `${m.title}: ${m.userRating} (${m.mediaType || 'movie'})`));
    
    // **MEDIA TYPE SEGREGATION: Check minimum count for current media type**
    if (currentSeenContent.length < 3) {
      const errorData = formatUtils.getMinimumRatingError(movieUtils.getMovieCount(currentSeenContent, 'all', { rated: true }), mediaType);
      Alert.alert(errorData.title, errorData.message, errorData.buttons);
      return;
    }
    
    // **FIX: Set rating in progress to prevent unwanted movie selection during rating flow**
    setIsRatingInProgress(true);
    console.log('🔒 Rating flow started - blocking movie selection');
    
    setSelectedEmotion(emotion);
    setEmotionModalVisible(false);
    
    // Delegate everything to EnhancedRatingSystem
    console.log(`🎭 Delegating to EnhancedRatingSystem for ${selectedMovie?.title} with emotion: ${emotion}`);
    setComparisonModalVisible(true);
  }, [selectedMovie, currentSeenContent, mediaType]);


  const handleConfirmRating = useCallback((finalRating) => {
    console.log('✅ Confirming rating:', finalRating, 'for:', selectedMovie?.title);
    if (!selectedMovie || !finalRating) return;
    
    // Store the final calculated rating for display
    console.log('🎯 SETTING finalCalculatedRating to:', finalRating);
    setFinalCalculatedRating(finalRating);
    
    const ratedMovie = {
      id: selectedMovie.id,
      title: selectedMovie.title || selectedMovie.name,
      poster: selectedMovie.poster_path || selectedMovie.poster,
      poster_path: selectedMovie.poster_path,
      score: selectedMovie.vote_average || selectedMovie.score || 0,
      vote_average: selectedMovie.vote_average,
      voteCount: selectedMovie.vote_count || 0,
      release_date: selectedMovie.release_date || selectedMovie.first_air_date,
      genre_ids: selectedMovie.genre_ids || [],
      overview: selectedMovie.overview || "",
      adult: selectedMovie.adult || false,
      userRating: finalRating,
      eloRating: finalRating * 100,
      comparisonHistory: [],
      comparisonWins: 0,
      mediaType: contentType === 'movies' ? 'movie' : 'tv',
      ratingCategory: selectedCategory,
      // Add confidence metadata if available (from adaptive rating system)
      confidence: selectedMovie.confidence || null
    };
    
    // **FIRST PRINCIPLES FIX: Update seen state FIRST, then remove from UI**
    onAddToSeen(ratedMovie);
    
    // **CRITICAL FIX: Update seenMoviesRef immediately to prevent AI re-recommendations**
    seenMoviesRef.current = [...seenMoviesRef.current, ratedMovie];
    
    // **Enhanced Preference Learning - Issue #8**
    recordUserRating(ratedMovie, finalRating, mediaType).catch(error => {
      console.error('Failed to record rating for preference learning:', error);
    });
    
    // **CODE_BIBLE Fix: Use unified removal utility to ensure ALL sections are cleaned**
    removeMovieFromAllSections(ratedMovie.id);
    
    // Close the detail modal
    closeDetailModal();
    
    // **REMOVED: Double fetch - let useEffect handle refresh when seen.length changes**
    // setTimeout(() => {
    //   fetchRecentReleases();
    //   fetchPopularMovies();
    // }, 100);
    // fetchAIRecommendations(); // REMOVED: Keep AI recommendations static until empty or manual refresh
    
    // Reset state
    setSelectedCategory(null);
    setComparisonMovies([]);
    setCurrentComparison(0);
    setComparisonResults([]);
    setIsComparisonComplete(false);
    
    // **FIX: Allow movie selection again after rating completion**
    setIsRatingInProgress(false);
    console.log('🔓 Rating flow completed - allowing movie selection');
    
    // **PERFORMANCE: Use memoized rating categories instead of recalculating**
    const RATING_CATEGORIES = memoizedRatingCategories;
    
    Alert.alert(
      "Rating Added!", 
      `You ${RATING_CATEGORIES[selectedCategory]?.label?.toLowerCase()} "${selectedMovie.title}" (${finalRating.toFixed(1)}/10)`,
      [{ text: "OK" }]
    );
  }, [selectedMovie, selectedCategory, onAddToSeen, contentType, seen, fetchRecentReleases, fetchPopularMovies, setFinalCalculatedRating, setAiMovieRecommendations, setAiTvRecommendations, setPopularMovies, setRecentReleases, closeDetailModal, mediaType, memoizedRatingCategories, removeMovieFromAllSections]);

  const handleCloseEnhancedModals = useCallback(() => {
    setComparisonModalVisible(false);
    setSelectedCategory(null);
    setComparisonMovies([]);
    setCurrentComparison(0);
    setComparisonResults([]);
    setIsComparisonComplete(false);
    setFinalCalculatedRating(null);
    
    // **CRITICAL FIX: Reset rating flag when modals are closed/cancelled**
    setIsRatingInProgress(false);
    console.log('🔓 CRITICAL: Enhanced modals closed - rating flag reset to false');
    
    // **FORCE RESET: Ensure flag is definitely false after modal close**
    setTimeout(() => {
      setIsRatingInProgress(false);
      console.log('🔓 FORCE RESET: Rating flag set to false after timeout');
    }, 100);
    
    // Fade animation removed
    setShowSentimentButtons(false);
  }, []);

  // ============================================================================
  // **EVENT HANDLERS - ENGINEER TEAM 13**
  // ============================================================================

  const handleMovieSelect = useCallback(async (movie) => {
    console.log('🎬 Movie selected:', movie?.title, 'Processing flag current state:', isProcessingMovieSelect);
    console.log('🔍 CRITICAL DEBUG - isRatingInProgress state:', isRatingInProgress);
    
    // **FIX: Block movie selection during rating completion to prevent unwanted modal opening**
    if (isRatingInProgress) {
      console.log('🚫 Rating in progress, ignoring movie selection for:', movie?.title);
      console.log('🚫 FORCE RESETTING isRatingInProgress to false');
      setIsRatingInProgress(false);
      return;
    }
    
    // **CRITICAL FIX: Set processing flag IMMEDIATELY to prevent race conditions**
    if (isProcessingMovieSelect) {
      console.log('⚠️ Movie selection already in progress, ignoring click for:', movie?.title);
      return;
    }
    
    // **DEV-ONLY FIX: Handle undefined movie data for debugging**
    if (__DEV__ && (!movie || !movie.id)) {
      console.error('❌ DEV DEBUG: Invalid movie data received:', movie);
      console.log('🛠️ DEV FIX: Attempting to recover from selectedMovie state');
      
      // Try to use currently selected movie from state if available
      if (selectedMovie && selectedMovie.id) {
        console.log('🔧 DEV: Using selectedMovie from state:', selectedMovie.title || selectedMovie.name);
        movie = selectedMovie;
      } else {
        console.error('❌ DEV: No fallback movie available, aborting');
        return;
      }
    }
    
    // **SAFETY CHECK: Ensure movie data exists**
    if (!movie || !movie.id) {
      console.error('❌ Invalid movie data:', movie);
      return;
    }
    
    // **STEP 1: Set processing flag BEFORE any other operations**
    setIsProcessingMovieSelect(true);
    console.log('🔒 Processing flag set to TRUE for:', movie?.title);
    
    try {
      if (!isContentSafe(movie, mediaType)) {
        console.warn('❌ Unsafe content blocked:', movie.title || movie.name);
        setIsProcessingMovieSelect(false);
        console.log('🔓 Processing flag reset to FALSE due to unsafe content');
        return;
      }
    } catch (error) {
      console.error('❌ Content safety check failed:', error);
      setIsProcessingMovieSelect(false);
      console.log('🔓 Processing flag reset to FALSE due to safety check error');
      return;
    }
    
    try {
      // **STEP 2: Show modal immediately with loading state**
      setSelectedMovie(movie);
      setMovieDetailModalVisible(true);
      setIsLoadingMovieDetails(true);
      console.log('🎭 Modal should now be visible for:', movie?.title);
      
      console.log('🔄 Fetching movie details for:', movie?.title);
      
      // **STEP 3: Fetch movie details with timeout protection**
      const fetchWithTimeout = (promise, timeout = 10000) => {
        return Promise.race([
          promise,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Request timeout')), timeout)
          )
        ]);
      };
      
      const [credits, providers] = await Promise.all([
        fetchWithTimeout(fetchMovieCredits(movie.id)),
        fetchWithTimeout(fetchMovieProviders(movie.id))
      ]);
      
      // **STEP 4: Update state with fetched data**
      setMovieCredits(credits);
      setMovieProviders(providers);
      
      console.log('✅ Movie details loaded successfully for:', movie?.title);
      
    } catch (error) {
      console.error('❌ Error fetching movie details:', error);
      
      // **ERROR HANDLING: Show modal with basic info but log the error**
      setMovieCredits([]);
      setMovieProviders([]);
      
      // Don't close modal - user can still interact with basic movie info
      Alert.alert(
        'Loading Error',
        'Some movie details couldn\'t be loaded, but you can still rate and add to watchlist.',
        [{ text: 'OK' }]
      );
      
    } finally {
      // **CLEANUP: Reset loading states**
      setIsLoadingMovieDetails(false);
      setIsProcessingMovieSelect(false);
      console.log('🔓 Processing flag reset to FALSE in finally block for:', movie?.title);
    }
  }, [fetchMovieCredits, fetchMovieProviders, mediaType, isProcessingMovieSelect, isRatingInProgress, selectedMovie]);

  // COMMANDMENT 4: Brutally honest - user clicked X, they don't want this movie
  const handleNotInterested = useCallback(async (movie, event) => {
    // COMMANDMENT 9: Handle errors explicitly - prevent event bubbling
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    
    try {
      console.log('🚫 User not interested in:', movie.title);
      
      // Get user profile for GROQ learning
      const userProfile = {
        topGenres: seen.map(m => m.genre_ids || []).flat(),
        averageUserRating: seen.reduce((sum, m) => sum + m.userRating, 0) / movieUtils.getMovieCount(seen, 'all', { rated: true }),
        totalRated: movieUtils.getMovieCount(seen, 'all', { rated: true }),
        // Add more context as needed
      };
      
      // Record not interested for GROQ AI learning
      await recordNotInterested(movie, userProfile, contentType === 'movies' ? 'movie' : 'tv');
      
      // **CODE_BIBLE Fix: Use unified removal utility to ensure ALL sections are cleaned including action, thriller, comedy**
      const movieId = movie.id;
      removeMovieFromAllSections(movieId);
      
      // Persist to AsyncStorage FIRST, then update state to trigger fetchPopularMovies with correct data
      const storePermanentNotInterested = async () => {
        try {
          const notInterestedKey = `not_interested_${mediaType}`;
          const existingNotInterested = await AsyncStorage.getItem(notInterestedKey);
          let notInterestedList = existingNotInterested ? JSON.parse(existingNotInterested) : [];
          
          if (!notInterestedList.includes(movie.id)) {
            notInterestedList.push(movie.id);
            await AsyncStorage.setItem(notInterestedKey, JSON.stringify(notInterestedList));
            console.log(`💾 Permanently stored "Not Interested" for movie ${movie.id}`);
            
            // CODE_BIBLE Fix: Update ref immediately, state for UI only (no dependency cascades)
            notInterestedMoviesRef.current = notInterestedList;
            setNotInterestedMovies(notInterestedList);
            console.log(`🚫 DEBUG: Updated notInterestedMovies ref and state with ${notInterestedList.length} movies`);
          }
        } catch (error) {
          console.error('Failed to store not interested movie to AsyncStorage:', error);
        }
      };
      await storePermanentNotInterested();
      
      // NO ADDITIONAL FILTERING - just remove the clicked movie and let the static list show remaining items
      
      console.log('✅ Movie removed from recommendations and recorded for AI learning');
      
      // Close the detail modal if it's open
      if (selectedMovie && selectedMovie.id === movie.id) {
        closeDetailModal();
      }
      
    } catch (error) {
      console.error('❌ Error handling not interested:', error);
      console.log('🔇 Not interested error (popup disabled):', error.message);
    }
  }, [contentType, mediaType, seen.length, setNotInterestedMovies, selectedMovie, closeDetailModal, seen, removeMovieFromAllSections]);

  // Removed openRatingModal and cancelSentimentSelection - handled by SentimentRatingModal

  // Removed closeRatingModal - now uses SentimentRatingModal

  const closeDetailModal = useCallback((preserveForRating = false) => {
    setMovieDetailModalVisible(false);
    if (!preserveForRating) {
      setSelectedMovie(null);
    }
    setMovieCredits(null);
    setMovieProviders(null);
    
    // **RESET NEW LOADING STATES**
    setIsLoadingMovieDetails(false);
    setIsProcessingMovieSelect(false);
    console.log('🔓 Processing flag reset to FALSE in closeDetailModal');
  }, []);




  
  // Removed submitRating - now handled by SentimentRatingModal

  const handleWatchlistToggle = useCallback(() => {
    if (!selectedMovie) return;
    
    if (!isContentSafe(selectedMovie, mediaType)) {
      console.warn('Attempted to add unsafe content to watchlist, blocking:', selectedMovie.title || selectedMovie.name);
      closeDetailModal();
      return;
    }
    
    const movieId = selectedMovie.id;
    
    // TEAM SOLUTION: Always add to watchlist and remove from home screen (no toggle behavior)
    if (!seen.some(movie => movie.id === selectedMovie.id)) {
      const normalizedMovie = {
        id: selectedMovie.id,
        title: selectedMovie.title || selectedMovie.name,
        poster: selectedMovie.poster_path || selectedMovie.poster,
        poster_path: selectedMovie.poster_path,
        score: selectedMovie.vote_average || selectedMovie.score || 0,
        vote_average: selectedMovie.vote_average,
        voteCount: selectedMovie.vote_count || 0,
        release_date: selectedMovie.release_date || selectedMovie.first_air_date,
        genre_ids: selectedMovie.genre_ids || [],
        overview: selectedMovie.overview || "",
        adult: selectedMovie.adult || false,
        mediaType: contentType === 'movies' ? 'movie' : 'tv'
      };
      
      if (!seen.some(movie => movie.id === selectedMovie.id)) {
        onAddToUnseen(normalizedMovie);
        
        // **CODE_BIBLE Fix: Use unified removal utility to ensure ALL sections are cleaned including action, thriller, comedy**
        removeMovieFromAllSections(movieId);
      }
    }
    
    closeDetailModal();
  }, [selectedMovie, seen, onAddToUnseen, closeDetailModal, contentType, mediaType, removeMovieFromAllSections]);

  // ============================================================================
  // **COMPUTED VALUES - ENGINEER TEAM 14**
  // ============================================================================

  // **PERFORMANCE OPTIMIZATION: Memoize rating categories to prevent 8x redundant calculations**
  const memoizedRatingCategories = useMemo(() => {
    console.log('🎯 PERFORMANCE: Calculating rating categories once for', mediaType, '- content count:', currentSeenContent.length);
    return calculateDynamicRatingCategories(currentSeenContent, mediaType);
  }, [currentSeenContent, mediaType]);

  const recommendations = useMemo(() => {
    if (currentSeenContent.length === 0) return [];
    
    const genreScores = {};
    let totalVotes = 0;
    
    currentSeenContent.forEach(movie => {
      if (movie.genre_ids) {
        const rating = movie.userRating || movie.eloRating / 100;
        totalVotes += rating;
        movie.genre_ids.forEach(genreId => {
          if (!genreScores[genreId]) genreScores[genreId] = 0;
          genreScores[genreId] += rating;
        });
      }
    });

    let totalYears = 0;
    let totalRatings = 0;
    currentSeenContent.forEach(movie => {
      if (movie.release_date) {
        const year = new Date(movie.release_date).getFullYear();
        if (!isNaN(year)) {
          totalYears += year * (movie.userRating || movie.eloRating / 100);
          totalRatings += (movie.userRating || movie.eloRating / 100);
        }
      }
    });
    
    const avgPreferredYear = totalRatings > 0 ? Math.round(totalYears / totalRatings) : new Date().getFullYear() - 10;
    const cleanUnseen = filterAdultContent(currentUnseenContent, mediaType);
    
    const suggestions = [...cleanUnseen]
      .filter(movie => movie.poster && movie.poster_path)
      .filter(movie => !skippedMovies.includes(movie.id))
      .filter(movie => !notInterestedMovies.includes(movie.id))
      .map(movie => {
        let yearProximity = 0;
        if (movie.release_date) {
          const movieYear = new Date(movie.release_date).getFullYear();
          const yearDiff = Math.abs(movieYear - avgPreferredYear);
          yearProximity = Math.max(0, 1 - (yearDiff / 50));
        }
        
        const genreMatchScore = movie.genre_ids
          ? movie.genre_ids.reduce((sum, genreId) => sum + (genreScores[genreId] || 0), 0)
          : 0;
            
        return {
          ...movie,
          recommendationScore: (genreMatchScore * 0.7) + (yearProximity * 0.3),
          hasBeenSeen: false
        };
      })
      .sort((a, b) => b.recommendationScore - a.recommendationScore)
      .slice(0, 20);

    return suggestions;
  }, [currentSeenContent, currentUnseenContent, mediaType, skippedMovies, notInterestedMovies]);

  const topGenres = useMemo(() => {
    if (currentSeenContent.length === 0) return [];
    
    const genreScores = {};
    const genreVotes = {};
    
    currentSeenContent.forEach(movie => {
      if (movie.genre_ids) {
        const rating = movie.userRating || movie.eloRating / 100;
        movie.genre_ids.forEach(genreId => {
          if (!genreScores[genreId]) {
            genreScores[genreId] = 0;
            genreVotes[genreId] = 0;
          }
          genreScores[genreId] += rating;
          genreVotes[genreId] += 1;
        });
      }
    });

    return Object.entries(genreScores)
      .map(([genreId, totalScore]) => ({
        id: genreId,
        name: genres[genreId] || 'Unknown',
        averageScore: totalScore / genreVotes[genreId],
        movieCount: genreVotes[genreId]
      }))
      .filter(genre => genre.movieCount >= 2)
      .sort((a, b) => b.averageScore - a.averageScore)
      .slice(0, 5);
  }, [currentSeenContent, genres]);

  // ============================================================================
  // **ANIMATION HELPERS - ENGINEER TEAM 14 CONTINUED**
  // ============================================================================

  

  const calculateMatchPercentage = useCallback((movie) => {
    if (!movie.genre_ids || topGenres.length === 0) return null;
    
    const topGenreIds = topGenres.map(g => parseInt(g.id));
    const matchingGenres = movie.genre_ids.filter(id => 
      topGenreIds.includes(parseInt(id))
    ).length;
    
    if (matchingGenres === 0) return null;
    
    const maxPossibleMatches = Math.min(movie.genre_ids.length, topGenreIds.length);
    const matchPercentage = Math.round((matchingGenres / maxPossibleMatches) * 100);
    
    return matchPercentage;
  }, [topGenres]);

  const getRatingBorderColor = useCallback((movie) => {
    return 'transparent';
  }, []);

  // ============================================================================
  // **PAN RESPONDER SYSTEM**
  // ============================================================================

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        // Position animation removed
      },
      // REMOVED: PanResponder movement
      onPanResponderRelease: (e, { dx, vx }) => {
        // Position animation removed
        const newIndex = Math.max(
          0,
          Math.min(
            recommendations.length - 1,
            currentIndex - Math.sign(dx)
          )
        );
        setCurrentIndex(newIndex);
      },
    })
  ).current;

  // ============================================================================
  // **RENDER FUNCTIONS - ENGINEER TEAM 15**
  // ============================================================================

  const renderCarouselItem = useCallback(({ item, index }) => {
    const matchPercentage = calculateMatchPercentage(item);
    
    return (
      <View
        style={[
          homeStyles.carouselItem,
          {
            // REMOVED: transform animation causing screen movement,
          },
        ]}
      >
        <View style={[
          homeStyles.movieCardBorder,
          { 
            borderColor: getRatingBorderColor(item),
            borderWidth: getRatingBorderColor(item) !== 'transparent' ? 1 : 0
          }
        ]}>
          <TouchableOpacity
            style={homeStyles.enhancedCard}
            activeOpacity={0.7}
            onPress={() => handleMovieSelect(item)}
          >
            <Image 
              source={{ uri: `https://image.tmdb.org/t/p/w500${item.poster_path}` }} 
              style={styles.moviePoster}
              resizeMode="cover"
            />
            {matchPercentage && (
              <View style={[
                styles.matchBadge,
                homeStyles.ratingButtonContainer
              ]}>
                <Text style={[
                  styles.matchText,
                  homeStyles.rateButtonText
                ]}>
                  {matchPercentage}% Match
                </Text>
              </View>
            )}
            
            {/* NOT INTERESTED X BUTTON */}
            <TouchableOpacity
              style={[
                styles.notInterestedButton,
                {
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  backgroundColor: 'rgba(0, 0, 0, 0.7)',
                  borderRadius: 15,
                  width: 30,
                  height: 30,
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 10
                }
              ]}
              onPress={(event) => handleNotInterested(item, event)}
              activeOpacity={0.8}
            >
              <Ionicons name="close" size={18} color="white" />
            </TouchableOpacity>
            
            <View style={homeStyles.movieInfoBox}>
              <Text
                style={[homeStyles.genreName, { fontSize: 16, lineHeight: 18 }]}
                numberOfLines={1}
                ellipsizeMode="tail"
                allowFontScaling={false}
              >
                {item.title}
              </Text>
              <View style={homeStyles.ratingRow}>
                <View style={homeStyles.ratingLine}>
                  <Ionicons name="star" size={12} color={colors.accent} />
                  <Text style={homeStyles.tmdbText}>
                    TMDb {item.vote_average ? item.vote_average.toFixed(1) : '?'}
                  </Text>
                </View>
                <View style={homeStyles.ratingLine}>
                  <Ionicons name="people" size={12} color="#4CAF50" />
                  <Text style={homeStyles.friendsText}>
                    Friends {item.friendsRating ? item.friendsRating.toFixed(1) : 'N/A'}
                  </Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    );
  }, [calculateMatchPercentage, homeStyles, handleMovieSelect, colors, getRatingBorderColor, handleNotInterested]);



const renderRecentReleaseCard = useCallback(({ item }) => {
    return (
      <MovieCard 
        item={item}
        handleMovieSelect={handleMovieSelect}
        handleNotInterested={handleNotInterested}
        mediaType={mediaType}
        context="home"
        isDarkMode={isDarkMode}
        currentSession={currentSession}
        getRatingBorderColor={getRatingBorderColor}
      />
    );
  }, [handleMovieSelect, handleNotInterested, mediaType, isDarkMode, currentSession, getRatingBorderColor]);

  const renderAIRecommendationsSection = useCallback(() => {
    return (
      <View style={homeStyles.section}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 1, marginTop: -5 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons 
              name={(() => {
                const firstRecommendation = aiRecommendations[0];
                if (firstRecommendation?.discoverySession || currentSession) return "telescope";
                return "sparkles";
              })()} 
              size={16} 
              color={homeStyles.genreScore.color} 
              style={{ marginRight: 8, marginBottom: 2 }}
            />
            <Text style={homeStyles.sectionTitle}>
              {(() => {
                const firstRecommendation = aiRecommendations[0];
                if (firstRecommendation?.discoverySession) return 'Enhanced AI Recommendations';
                if (currentSession) return 'Discovery Session';
                return 'AI Recommendations For You';
              })()}
            </Text>
          </View>
          
          {/* COMMANDMENT 3: Clear and obvious refresh button with status */}
          <View style={{ alignItems: 'center' }}>
            <TouchableOpacity
              style={{
                backgroundColor: dailyRefreshCount >= MAX_DAILY_REFRESHES ? colors.disabled : colors.primary,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 8,
                opacity: isRefreshingAI ? 0.6 : 1
              }}
              onPress={currentSession ? generateSession : handleRefreshRecommendations}
              disabled={dailyRefreshCount >= MAX_DAILY_REFRESHES || isRefreshingAI}
              activeOpacity={0.7}
            >
              {isRefreshingAI ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <Ionicons 
                  name="refresh" 
                  size={16} 
                  color={dailyRefreshCount >= MAX_DAILY_REFRESHES ? colors.subText : colors.accent} 
                />
              )}
            </TouchableOpacity>
            {/* **ENHANCED STATUS WITH COUNTDOWN TIMER** */}
            <Text style={{
              fontSize: 10,
              color: colors.subText,
              marginTop: 2,
              fontWeight: '500',
              textAlign: 'center'
            }}>
              {dailyRefreshCount >= MAX_DAILY_REFRESHES && timeUntilReset ? (
                // Show countdown when limit reached
                <>
                  3/3{'\n'}
                  <Text style={{ fontSize: 9, color: colors.accent }}>
                    {formatTimeUntilReset(timeUntilReset)}
                  </Text>
                </>
              ) : (
                // Show normal counter
                `${dailyRefreshCount}/${MAX_DAILY_REFRESHES}`
              )}
            </Text>
          </View>
        </View>
        <Text style={homeStyles.swipeInstructions}>
          {(() => {
            // Check for discovery session themes in AI recommendations
            const firstRecommendation = aiRecommendations[0];
            if (firstRecommendation?.sessionTheme) {
              return `${firstRecommendation.sessionTheme.name} - ${firstRecommendation.sessionTheme.description}`;
            }
            // Fallback to current session or basic description
            if (currentSession) {
              return `${currentSession.theme?.title || currentSession.type || 'Personalized'} - ${currentSession.theme?.description || 'Curated for you'}`;
            }
            return `Based on your top-rated ${contentType === 'movies' ? 'movies' : 'TV shows'}`;
          })()}
        </Text>
        
        {isLoadingRecommendations ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={homeStyles.genreScore.color} />
            <Text style={homeStyles.swipeInstructions}>
              AI is analyzing your taste...
            </Text>
          </View>
        ) : aiRecommendations.filter(item => !dismissedInSession.includes(item.id)).length === 0 ? (
          <Text style={homeStyles.swipeInstructions}>
            {(() => {
              const currentMediaType = contentType === 'movies' ? 'movie' : 'tv';
              const currentMediaContent = currentSeenContent;
              const highlyRatedContent = currentMediaContent.filter(item => 
                item.userRating && item.userRating >= 7
              );
              
              if (currentMediaContent.length === 0) {
                return `Rate some ${contentType} to get AI recommendations`;
              } else if (highlyRatedContent.length < 3) {
                return `Rate more ${contentType} highly (7+ stars) for better AI recommendations`;
              } else {
                return `No new ${contentType} recommendations available right now`;
              }
            })()}
          </Text>
        ) : (
          <FlatList
            data={aiRecommendations.filter(item => !dismissedInSession.includes(item.id))}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={homeStyles.carouselContent}
            keyExtractor={item => item.id.toString()}
            removeClippedSubviews={false}

            windowSize={10}
            initialNumToRender={5}
            maxToRenderPerBatch={3}
            renderItem={({ item, index }) => (
              <MovieCard
                item={item}
                handleMovieSelect={handleMovieSelect}
                handleNotInterested={handleNotInterested}
                mediaType={mediaType}
                context="home"
                isDarkMode={isDarkMode}
                currentSession={currentSession}
                getRatingBorderColor={getRatingBorderColor}
              />
            )}
          />
        )}
      </View>
    );
  }, [aiRecommendations, isLoadingRecommendations, homeStyles, contentType, handleMovieSelect, colors, seen, onAddToSeen, onUpdateRating, buttonStyles, modalStyles, genres, mediaType, getRatingBorderColor, currentSession, generateSession, handleRefreshRecommendations, dailyRefreshCount, isRefreshingAI, currentSeenContent, dismissedInSession, formatTimeUntilReset, handleNotInterested, isDarkMode, timeUntilReset]);

  // =============================================================================
  // DISCOVERY SESSION LOGIC NOW INTEGRATED INTO AI RECOMMENDATIONS
  // =============================================================================

 const renderPopularMoviesSection = useCallback(() => {
  return (
    <View style={homeStyles.section}>
      <Text style={homeStyles.sectionTitle}>
        Popular {contentType === 'movies' ? 'Movies' : 'TV Shows'}
      </Text>
      <FlatList
        data={popularMovies}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={homeStyles.carouselContent}
        keyExtractor={item => item.id.toString()}
        removeClippedSubviews={false}
        snapToInterval={MOVIE_CARD_WIDTH + 12} // Add this for consistent spacing
        decelerationRate="fast" // Add this for better snapping
        renderItem={({ item, index }) => {
          const movieCardItem = {
            ...item,
            discoveryScore: index + 1,
            discoverySession: false,
            friendsRating: item.friendsRating || null
          };
          
          return (
            <MovieCard
              item={movieCardItem}
              handleMovieSelect={handleMovieSelect}
              handleNotInterested={handleNotInterested}
              mediaType={mediaType}
              context="home"
              isDarkMode={isDarkMode}
              currentSession={null}
              getRatingBorderColor={getRatingBorderColor}
            />
          );
        }}
      />
    </View>
  );
}, [homeStyles, popularMovies, handleMovieSelect, mediaType, isDarkMode, getRatingBorderColor, handleNotInterested, contentType]);

  const renderActionMoviesSection = useCallback(() => {
    return (
      <View style={homeStyles.section}>
        <Text style={homeStyles.sectionTitle}>
          Action {contentType === 'movies' ? 'Movies' : 'TV Shows'}
        </Text>
        <FlatList
          data={actionMovies}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={homeStyles.carouselContent}
          keyExtractor={item => item.id.toString()}
          removeClippedSubviews={false}
          snapToInterval={MOVIE_CARD_WIDTH + 12}
          decelerationRate="fast"
          renderItem={({ item, index }) => {
            const movieCardItem = {
              ...item,
              discoveryScore: index + 1,
              discoverySession: false,
              friendsRating: item.friendsRating || null
            };
            
            return (
              <MovieCard
                item={movieCardItem}
                handleMovieSelect={handleMovieSelect}
                handleNotInterested={handleNotInterested}
                mediaType={mediaType}
                context="home"
                isDarkMode={isDarkMode}
                currentSession={null}
                getRatingBorderColor={getRatingBorderColor}
              />
            );
          }}
        />
      </View>
    );
  }, [homeStyles, actionMovies, handleMovieSelect, mediaType, isDarkMode, getRatingBorderColor, handleNotInterested, contentType]);

  const renderThrillerMoviesSection = useCallback(() => {
    return (
      <View style={homeStyles.section}>
        <Text style={homeStyles.sectionTitle}>
          Thriller {contentType === 'movies' ? 'Movies' : 'TV Shows'}
        </Text>
        <FlatList
          data={thrillerMovies}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={homeStyles.carouselContent}
          keyExtractor={item => item.id.toString()}
          removeClippedSubviews={false}
          snapToInterval={MOVIE_CARD_WIDTH + 12}
          decelerationRate="fast"
          renderItem={({ item, index }) => {
            const movieCardItem = {
              ...item,
              discoveryScore: index + 1,
              discoverySession: false,
              friendsRating: item.friendsRating || null
            };
            
            return (
              <MovieCard
                item={movieCardItem}
                handleMovieSelect={handleMovieSelect}
                handleNotInterested={handleNotInterested}
                mediaType={mediaType}
                context="home"
                isDarkMode={isDarkMode}
                currentSession={null}
                getRatingBorderColor={getRatingBorderColor}
              />
            );
          }}
        />
      </View>
    );
  }, [homeStyles, thrillerMovies, handleMovieSelect, mediaType, isDarkMode, getRatingBorderColor, handleNotInterested, contentType]);

  const renderComedyMoviesSection = useCallback(() => {
    return (
      <View style={homeStyles.section}>
        <Text style={homeStyles.sectionTitle}>
          Comedy {contentType === 'movies' ? 'Movies' : 'TV Shows'}
        </Text>
        <FlatList
          data={comedyMovies}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={homeStyles.carouselContent}
          keyExtractor={item => item.id.toString()}
          removeClippedSubviews={false}
          snapToInterval={MOVIE_CARD_WIDTH + 12}
          decelerationRate="fast"
          renderItem={({ item, index }) => {
            const movieCardItem = {
              ...item,
              discoveryScore: index + 1,
              discoverySession: false,
              friendsRating: item.friendsRating || null
            };
            
            return (
              <MovieCard
                item={movieCardItem}
                handleMovieSelect={handleMovieSelect}
                handleNotInterested={handleNotInterested}
                mediaType={mediaType}
                context="home"
                isDarkMode={isDarkMode}
                currentSession={null}
                getRatingBorderColor={getRatingBorderColor}
              />
            );
          }}
        />
      </View>
    );
  }, [homeStyles, comedyMovies, handleMovieSelect, mediaType, isDarkMode, getRatingBorderColor, handleNotInterested, contentType]);

  const renderWhatsOutNowSection = useCallback(() => {
    return (
      <View style={homeStyles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={homeStyles.sectionTitle}>
            New Movies
          </Text>
          <Text style={homeStyles.swipeInstructions}>
            {formatDate(today)}
          </Text>
        </View>
        
        {isLoadingRecent ? (
          <View style={styles.loadingContainer}>
            <Text style={homeStyles.swipeInstructions}>
              Loading recent releases...
            </Text>
          </View>
        ) : recentReleases.length === 0 ? (
          <Text style={homeStyles.swipeInstructions}>
            No new releases found this week
          </Text>
        ) : (
          <FlatList
            data={recentReleases}
            renderItem={renderRecentReleaseCard}
            keyExtractor={item => item.id.toString()}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={homeStyles.carouselContent}
            removeClippedSubviews={false}
            windowSize={10}
            initialNumToRender={5}
            maxToRenderPerBatch={3}
            getItemLayout={(data, index) => ({
              length: MOVIE_CARD_WIDTH + 12,
              offset: (MOVIE_CARD_WIDTH + 12) * index,
              index
            })}
          />
        )}
      </View>
    );
  }, [homeStyles, formatDate, today, isLoadingRecent, recentReleases, renderRecentReleaseCard]);

  // ============================================================================
  // **LIFECYCLE EFFECTS**
  // ============================================================================

  useEffect(() => {
    console.log('🔄 Content type changed to:', contentType);
    fetchRecentReleases();
    fetchPopularMovies();
    fetchActionMovies();
    fetchThrillerMovies();
    fetchComedyMovies();
  }, [contentType, fetchRecentReleases, fetchPopularMovies, fetchActionMovies, fetchThrillerMovies, fetchComedyMovies]);

  // **🏠 AUTO-REFRESH WHEN MOVIES ARE RATED**
  useEffect(() => {
    console.log(`🎬 Seen ${mediaType === 'movie' ? 'movies' : 'content'} updated, count:`, movieUtils.getMovieCount(seen));
    // Refresh home screen data when movies are rated to remove them from display
    fetchRecentReleases();
    fetchPopularMovies();
    fetchActionMovies();
    fetchThrillerMovies();
    fetchComedyMovies();
    // fetchAIRecommendations(); // REMOVED: Keep AI recommendations static to prevent reloading
  }, [currentSeenContent.length, fetchRecentReleases, fetchPopularMovies, fetchActionMovies, fetchThrillerMovies, fetchComedyMovies, mediaType, seen]);

  // AUTO-SCROLL DISABLED: Prevented unwanted scrolling when movies are removed via X button
  // useEffect(() => {
  //   if (popularMovies.length > 0 && activeTab === 'new' && contentType === 'movies') {
  //     startPopularAutoScroll();
  //   }
  //   return () => clearInterval(autoScrollPopular.current);
  // }, [popularMovies, activeTab, contentType, startPopularAutoScroll]);

  // AUTO-SCROLL DISABLED: Prevented unwanted scrolling when recommendations change
  // useEffect(() => {
  //   if (activeTab === 'recommendations' && recommendations.length > 0 && contentType === 'movies') {
  //     startAutoScroll();
  //   }
  //   return () => {
  //     // Auto-scroll animation removed
  //   };
  // }, [activeTab, recommendations, contentType, startAutoScroll]);

  useEffect(() => {
    // REMOVED: AI recommendations auto-trigger logic - should only refresh via manual button
    // if (seen.length >= 3) {
    //   // Check if we have media-type-specific content for recommendations
    //   const currentMediaType = contentType === 'movies' ? 'movie' : 'tv';
    //   const currentMediaContent = seen.filter(item => 
    //     (item.mediaType || 'movie') === currentMediaType
    //   );
    //   
    //   if (currentMediaContent.length >= 3 && (aiRecommendations.length === 0 || contentType !== previousContentType.current)) {
    //     console.log(`🤖 Fetching AI recommendations for ${contentType} - user has ${currentMediaContent.length} rated ${currentMediaType}s`);
    //     
    //     // Clear old recommendations when media type changes
    //     if (contentType !== previousContentType.current) {
    //       mediaType === 'movie' ? setAiMovieRecommendations([]) : setAiTvRecommendations([]);
    //       console.log(`🔄 Cleared AI recommendations due to media type change: ${previousContentType.current} → ${contentType}`);
    //     }
    //     
    //     // fetchAIRecommendations(); // REMOVED: AI recommendations should only refresh via manual button press
    //     previousContentType.current = contentType;
    //   }
    // }
    
    // Always fetch social recommendations when user data changes
    fetchSocialRecommendations();
  }, [currentSeenContent.length, contentType, fetchSocialRecommendations]);

  useEffect(() => {
    const loadNotInterested = async () => {
      const notInterestedList = await loadNotInterestedMovies();
      // CODE_BIBLE Fix: Update both ref and state on load
      notInterestedMoviesRef.current = notInterestedList;
      setNotInterestedMovies(notInterestedList);
    };
    
    loadNotInterested();
  }, [mediaType, loadNotInterestedMovies]);

  useEffect(() => {
    console.log('🔄 skippedMovies updated:', skippedMovies);
    if (skippedMovies.length > 0) {
      console.log('🔄 Re-fetching data due to skippedMovies change');
      fetchPopularMovies();
      fetchActionMovies();
      fetchThrillerMovies();
      fetchComedyMovies();
      fetchRecentReleases();
      // fetchAIRecommendations(); // REMOVED: Keep AI recommendations static
    }
  }, [skippedMovies, fetchPopularMovies, fetchRecentReleases]);

  useEffect(() => {
    console.log('🔄 watchlist (unseen) updated:', unseen.length);
    console.log('🔄 Re-fetching data due to watchlist change');
    fetchPopularMovies();
    fetchActionMovies();
    fetchThrillerMovies();
    fetchComedyMovies();
    fetchRecentReleases();
    // fetchAIRecommendations(); // REMOVED: Keep AI recommendations static
  }, [unseen.length, fetchPopularMovies, fetchActionMovies, fetchThrillerMovies, fetchComedyMovies, fetchRecentReleases]);

  // ============================================================================
  // **MAIN RENDER - COLLABORATIVE UI MASTERPIECE**
  // ============================================================================

  return (
    <LinearGradient
      colors={Array.isArray(colors.background) ? colors.background : [colors.background, colors.background]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1 }}
    >
      <ThemedHeader mediaType={mediaType} isDarkMode={isDarkMode} theme={theme}>
        <Text style={headerStyles.screenTitle}>
          {mediaType === 'movie' ? 'Movies' : 'TV Shows'}
        </Text>
      </ThemedHeader>
      <SafeAreaView style={[layoutStyles.safeArea, { backgroundColor: 'transparent' }]}>
        
        {/* **MOVIES CONTENT WITH ENHANCED RATING** */}
        {contentType === 'movies' && (
          <>
            <View style={[styles.tabContainer, { backgroundColor: '#1C2526' }]}>
              <TouchableOpacity 
                style={[
                  styles.tabButton, 
                  activeTab === 'new' && { 
                    borderBottomColor: homeStyles.genreScore.color, 
                    borderBottomWidth: 2 
                  }
                ]}
                onPress={() => setActiveTab('new')}
              >
                <Text 
                  style={[
                    buttonStyles.skipButtonText,
                    { 
                      color: activeTab === 'new' ? 
                        homeStyles.genreScore.color : 
                        homeStyles.movieYear.color
                    }
                  ]}
                >
                  New Releases
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.tabButton, 
                  activeTab === 'compare' && { 
                    borderBottomColor: homeStyles.genreScore.color, 
                    borderBottomWidth: 2 
                  }
                ]}
                onPress={() => setActiveTab('compare')}
              >
                <Text 
                  style={[
                    buttonStyles.skipButtonText,
                    { 
                      color: activeTab === 'compare' ? 
                        homeStyles.genreScore.color : 
                        homeStyles.movieYear.color
                    }
                  ]}
                >
                  Compare Movies
                </Text>
              </TouchableOpacity>
            </View>
            
            
            {activeTab === 'new' && (
              <ScrollView 
                style={homeStyles.homeContainer}
                contentContainerStyle={{ paddingBottom: 20 }}
                showsVerticalScrollIndicator={false}
              >
                <SocialRecommendationsSection
  socialRecommendations={socialRecommendations}
  isLoading={isLoadingSocialRecs}
  onMoviePress={handleMovieSelect}
  onNotInterested={handleNotInterested}
  isDarkMode={isDarkMode}
  homeStyles={homeStyles}
  mediaType={mediaType}
  theme={theme}
  colors={colors}
  getRatingBorderColor={getRatingBorderColor}
/>
                {renderAIRecommendationsSection()}
                {renderPopularMoviesSection()}
                {renderActionMoviesSection()}
                {renderThrillerMoviesSection()}
                {renderComedyMoviesSection()}
                {renderWhatsOutNowSection()}
              </ScrollView>
            )}
            
            {activeTab === 'compare' && (
              <WildcardScreen
                seen={seen}
                unseen={unseen}
                setSeen={setSeen}
                setUnseen={setUnseen}
                onAddToSeen={onAddToSeen}
                onAddToUnseen={onAddToUnseen}
                genres={genres}
                isDarkMode={isDarkMode}
                skippedMovies={skippedMovies}
                addToSkippedMovies={addToSkippedMovies}
                removeFromSkippedMovies={removeFromSkippedMovies}
              />
            )}
          </>
        )}
        
        {/* **TV SHOWS CONTENT WITH ENHANCED RATING** */}
        {contentType === 'tv' && (
          <>
            <View style={[styles.tabContainer, { backgroundColor: '#1C2526' }]}>
              <TouchableOpacity 
                style={[
                  styles.tabButton, 
                  activeTab === 'new' && { 
                    borderBottomColor: homeStyles.genreScore.color, 
                    borderBottomWidth: 2 
                  }
                ]}
                onPress={() => setActiveTab('new')}
              >
                <Text 
                  style={[
                    buttonStyles.skipButtonText,
                    { 
                      color: activeTab === 'new' ? 
                        homeStyles.genreScore.color : 
                        homeStyles.movieYear.color
                    }
                  ]}
                >
                  New Releases
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.tabButton, 
                  activeTab === 'compare' && { 
                    borderBottomColor: homeStyles.genreScore.color, 
                    borderBottomWidth: 2 
                  }
                ]}
                onPress={() => setActiveTab('compare')}
              >
                <Text 
                  style={[
                    buttonStyles.skipButtonText,
                    { 
                      color: activeTab === 'compare' ? 
                        homeStyles.genreScore.color : 
                        homeStyles.movieYear.color
                    }
                  ]}
                >
                  Compare TV Shows
                </Text>
              </TouchableOpacity>
            </View>
            
            
            {activeTab === 'new' && (
              <ScrollView 
                style={homeStyles.homeContainer}
                contentContainerStyle={{ paddingBottom: 20 }}
                showsVerticalScrollIndicator={false}
              >
              <SocialRecommendationsSection
  socialRecommendations={socialRecommendations}
  isLoading={isLoadingSocialRecs}
  onMoviePress={handleMovieSelect}
  onNotInterested={handleNotInterested}
  isDarkMode={isDarkMode}
  homeStyles={homeStyles}
  mediaType={mediaType}
  theme={theme}
  colors={colors}
  getRatingBorderColor={getRatingBorderColor}
/>
                {renderAIRecommendationsSection()}
                {renderPopularMoviesSection()}
                {renderActionMoviesSection()}
                {renderThrillerMoviesSection()}
                {renderComedyMoviesSection()}
              </ScrollView>
            )}
            
            {activeTab === 'compare' && (
              <WildcardScreen
                seen={seen}
                unseen={unseen}
                setSeen={setSeen}
                setUnseen={setUnseen}
                onAddToSeen={onAddToSeen}
                onAddToUnseen={onAddToUnseen}
                genres={genres}
                isDarkMode={isDarkMode}
                skippedMovies={skippedMovies}
                addToSkippedMovies={addToSkippedMovies}
                removeFromSkippedMovies={removeFromSkippedMovies}
              />
            )}
          </>
        )}
        
        {/* **MOVIE DETAIL MODAL WITH ENHANCED RATING INTEGRATION** */}
        <MovieDetailModal
          visible={movieDetailModalVisible}
          selectedMovie={selectedMovie}
          movieCredits={movieCredits}
          isLoadingMovieDetails={isLoadingMovieDetails}
          mediaType={mediaType}
          isDarkMode={isDarkMode}
          showSentimentButtons={showSentimentButtons}
          closeDetailModal={closeDetailModal}
          handleNotInterested={handleNotInterested}
          handleRateButton={() => {
            console.log('🚨🚨🚨 RATE BUTTON CLICKED! 🚨🚨🚨');
            console.log('selectedMovie:', selectedMovie);
            console.log('emotionModalVisible current state:', emotionModalVisible);
            
            // CLOSE the movie detail modal first to prevent stacking (preserve movie for rating)
            console.log('Closing movieDetailModalVisible...');
            closeDetailModal(true);
            
            // Then open emotion modal
            console.log('Setting emotionModalVisible to true...');
            setEmotionModalVisible(true);
            console.log('✅ setEmotionModalVisible(true) called');
          }}
          handleWatchlistToggle={handleWatchlistToggle}
          colors={colors}
          standardButtonStyles={standardButtonStyles}
          memoizedRatingCategories={memoizedRatingCategories}
          handleEmotionSelected={handleSentimentSelect}
          cancelSentimentSelection={() => {
            console.log('🔙 Back to options pressed');
            setShowSentimentButtons(false);
          }}
        />

        {/* **EMOTION SELECTION MODAL - Using Reusable Component** */}
        <SentimentRatingModal
          visible={emotionModalVisible}
          movie={selectedMovie}
          onClose={() => {
            setEmotionModalVisible(false);
            setIsRatingInProgress(false);
            console.log('🔓 Emotion modal closed - reset rating flag');
          }}
          onRatingSelect={(movieWithRating, categoryKey, rating) => {
            console.log('🎭 Sentiment selected via reusable component:', categoryKey, 'Rating:', rating);
            setSelectedCategory(categoryKey);
            // Store the sentiment rating for the comparison system
            setCurrentMovieRating(rating);
            // Pass rating directly to avoid async state timing issues
            handleEmotionSelected(categoryKey, rating);
          }}
          colors={colors}
          userMovies={currentSeenContent}
          mediaType={mediaType}
        />

        {/* **EMOTION SELECTION MODAL - Using Reusable Component** */}
        <SentimentRatingModal
          visible={emotionModalVisible}
          movie={selectedMovie}
          onClose={() => setEmotionModalVisible(false)}
          onRatingSelect={(movieWithRating, categoryKey, rating) => {
            console.log('🎭 Sentiment selected via reusable component:', categoryKey, 'Rating:', rating);
            setSelectedCategory(categoryKey);
            // Store the sentiment rating for the comparison system
            setCurrentMovieRating(rating);
            // Pass rating directly to avoid async state timing issues
            handleEmotionSelected(categoryKey, rating);
          }}
          colors={colors}
          userMovies={currentSeenContent}
          mediaType={mediaType}
        />

        {/* **CONFIDENCE-BASED COMPARISON MODAL** */}
        <ConfidenceBasedComparison
          visible={confidenceModalVisible}
          newMovie={{
            ...selectedMovie,
            // No suggestedRating - starts as truly unknown
          }}
          availableMovies={currentSeenContent}
          selectedSentiment={selectedEmotion}
          onClose={handleCloseEnhancedModals}
          onComparisonComplete={(result) => {
            console.log('🎯 ConfidenceBasedComparison completed:', result);
            handleConfirmRating(result.finalRating);
            // Comparison modal closed by ConfidenceBasedComparison
          }}
          colors={colors}
          mediaType={mediaType}
        />
        
        {/* **FALLBACK MODAL - keeping old implementation hidden for now** */}


        {/* Legacy RatingModal removed - now uses SentimentRatingModal from EnhancedRatingSystem */}


      </SafeAreaView>
    </LinearGradient>
  );
}

// ============================================================================
// **ENHANCED STYLES SYSTEM**
// ============================================================================

const styles = StyleSheet.create({
  // **Tab Layout**
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    marginVertical: 16,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  
  // **Section Layout**
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  
  // **Carousel and Card Layout**
  moviePoster: {
    width: '100%',
    height: MOVIE_CARD_WIDTH * 1.5,
    borderRadius: 8,
  },
  
  matchBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    zIndex: 1,
  },
  matchText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  
  // **Recent Releases Layout**
  recentCard: {
    flex: 1,
    marginRight: 16,
    flexDirection: 'row',
  },
  recentPoster: {
    width: 100,
    height: 150,
    borderRadius: 8,
  },
  
  // **Rating Container Layout**
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  
  // **Loading Container**
  loadingContainer: {
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // **Enhanced Badge System**
  rankingBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  rankingNumber: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000',
  },
  aiRecommendationBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    zIndex: 1,
    minWidth: 24,
    alignItems: 'center',
  },
  
  // **NOT INTERESTED BUTTON STYLES**
  notInterestedButton: {
    // Styles are defined inline for better positioning control
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },

  // **Enhanced Rating System Modal Styles**
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Removed unused emotion modal styles - now using SentimentRatingModal component
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  // sentimentGrid: { // REMOVED: No longer using separate sentiment modal
  //   gap: 16,
  //   marginBottom: 24,
  // },
  sentimentButton: {
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  // sentimentEmoji: { // REMOVED: No longer using separate sentiment modal
  //   fontSize: 32,
  //   marginBottom: 8,
  // },
  sentimentLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  // sentimentDescription: { // REMOVED: No longer using separate sentiment modal
  //   fontSize: 12,
  //   textAlign: 'center',
  // },
  // sentimentRange: { // REMOVED: No longer using separate sentiment modal
  //   fontSize: 10,
  //   textAlign: 'center',
  //   marginTop: 2,
  //   fontStyle: 'italic',
  // },
  comparisonModalContent: {
    width: '95%',
    maxWidth: 500,
    padding: 20,
    borderRadius: 16,
    maxHeight: '80%',
  },
  comparisonHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  comparisonSubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  moviesComparison: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  movieComparisonCard: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginHorizontal: 8,
  },
  comparisonPoster: {
    width: 120,
    height: 180,
    borderRadius: 8,
    marginBottom: 12,
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
  vsText: {
    fontSize: 16,
    fontWeight: 'bold',
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
  cancelButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  
  sentimentBackButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
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

export default HomeScreen;