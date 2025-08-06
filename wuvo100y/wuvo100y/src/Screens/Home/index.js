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
import { RatingModal } from '../../Components/RatingModal';
import { ActivityIndicator } from 'react-native';
import { TMDB_API_KEY as API_KEY, STREAMING_SERVICES_PRIORITY } from '../../Constants';
import { filterAdultContent, isContentSafe } from '../../utils/ContentFiltering';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import storage keys to match the main data hook
import { STORAGE_KEYS } from '../../config/storageConfig';

// Dynamic storage keys based on media type (matching useMovieData hook)
const getStorageKey = (mediaType) => mediaType === 'movie' ? STORAGE_KEYS.MOVIES.SEEN : STORAGE_KEYS.TV_SHOWS.SEEN;

// **ENHANCED RATING SYSTEM IMPORT**
import { calculateDynamicRatingCategories, SentimentRatingModal, calculatePairwiseRating, ComparisonResults, selectOpponentFromEmotion, selectRandomOpponent, handleTooToughToDecide } from '../../Components/EnhancedRatingSystem';
import InitialRatingFlow from '../InitialRatingFlow';

// Helper functions for calculating range from percentile (moved from component)
const getRatingRangeFromPercentile = (userMovies, percentile) => {
  const sortedRatings = userMovies
    .map(m => m.userRating || (m.eloRating / 100))
    .filter(rating => rating && !isNaN(rating))
    .sort((a, b) => a - b);

  if (sortedRatings.length === 0) return [1, 10];

  const lowIndex = Math.floor((percentile[0] / 100) * sortedRatings.length);
  const highIndex = Math.floor((percentile[1] / 100) * sortedRatings.length);
  
  const lowRating = sortedRatings[Math.max(0, lowIndex)] || sortedRatings[0];
  const highRating = sortedRatings[Math.min(highIndex, sortedRatings.length - 1)] || sortedRatings[sortedRatings.length - 1];
  
  return [lowRating, highRating];
};

const getDefaultRatingForCategory = (categoryKey) => {
  // Calculate dynamic defaults based on 1-10 rating bounds
  const midpoint = 5.5; // (1 + 10) / 2
  const quarterRange = 2.25; // (10 - 1) / 4
  
  const defaults = {
    LOVED: midpoint + quarterRange * 1.5,    // ~8.875 for 1-10 range
    LIKED: midpoint + quarterRange * 0.5,     // ~6.625 for 1-10 range  
    AVERAGE: midpoint,                        // 5.5 for 1-10 range
    DISLIKED: midpoint - quarterRange * 1.5  // ~2.125 for 1-10 range
  };
  
  return defaults[categoryKey] || midpoint;
};

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

const MOVIE_CARD_WIDTH = (width - 48) / 2.2;
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
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [initialRatingFlowVisible, setInitialRatingFlowVisible] = useState(false);
  const [ratingInput, setRatingInput] = useState('');
  const [recentReleases, setRecentReleases] = useState([]);
  const [popularMovies, setPopularMovies] = useState([]);
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
  const [comparisonModalVisible, setComparisonModalVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [comparisonMovies, setComparisonMovies] = useState([]);
  const [currentComparison, setCurrentComparison] = useState(0);
  const [comparisonResults, setComparisonResults] = useState([]);
  const [isComparisonComplete, setIsComparisonComplete] = useState(false);
  const [showSentimentButtons, setShowSentimentButtons] = useState(false);
  const [selectedEmotion, setSelectedEmotion] = useState(null);
  const [currentMovieRating, setCurrentMovieRating] = useState(null);
  const [emotionModalVisible, setEmotionModalVisible] = useState(false);
  const [finalCalculatedRating, setFinalCalculatedRating] = useState(null);
  
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
  }, [generateSession, sessionType, seen]);
  
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
  }, [currentSession, showDiscoverySession]);

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
        setLastDataFetch(now);
      } else {
        console.log('✅ Using cached data - age:', Math.round((now - lastDataFetch) / 1000) + 's');
      }
    });

    return unsubscribe;
  }, [navigation, lastDataFetch, recentReleases.length, popularMovies.length, fetchRecentReleases, fetchPopularMovies]);
  
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
      console.log('🎯 DEBUG: Current media type:', contentType, 'Seen movies count:', seen.length);
      
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
  }, [mediaType, recordNotInterested, addToSkippedMovies]);

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
    
  }, []);

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
  }, [mediaType, setPopularMovies, setRecentReleases, setAiMovieRecommendations, setAiTvRecommendations, setSocialRecommendations]);

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
  }, [deduplicateProviders]);;

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
  }, []);;

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
  }, [currentSeenContent, currentUnseenContent, skippedMovies, dismissedInSession, mediaType]); // Dependencies: currentSeenContent already includes seen/unseen changes

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
      
      setSocialRecommendations(socialRecs);
      console.log(`✅ Got ${socialRecs.length} social recommendations`);
      
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
  }, [currentUser?.id, contentType, seen, firebaseErrorCache]);

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
            
            if (item.vote_average && item.vote_average < 6.5) {
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
  }, [currentSeenContent, currentUnseenContent, contentType, skippedMovies]); // Dependencies: currentSeenContent already includes seen/unseen changes
  
  const fetchRecentReleases = useCallback(async () => {
    try {
      setIsLoadingRecent(true);
      
      const todayFormatted = formatDateForAPI(today);
      const oneWeekAgoFormatted = formatDateForAPI(oneWeekAgo);
      
      const endpoint = contentType === 'movies' 
        ? `https://api.themoviedb.org/3/discover/movie?api_key=b401be0ea16515055d8d0bde16f80069&language=en-US&sort_by=primary_release_date.desc&include_adult=false&include_video=false&page=1&primary_release_date.gte=${oneWeekAgoFormatted}&primary_release_date.lte=${todayFormatted}&vote_count.gte=5`
        : `https://api.themoviedb.org/3/discover/tv?api_key=b401be0ea16515055d8d0bde16f80069&language=en-US&sort_by=first_air_date.desc&include_adult=false&page=1&first_air_date.gte=${oneWeekAgoFormatted}&first_air_date.lte=${todayFormatted}&vote_count.gte=5`;
      
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
  }, [today, oneWeekAgo, seen, unseen, formatDateForAPI, contentType, skippedMovies]); // CODE_BIBLE Fix: Removed notInterestedMovies dependency

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
    
    // Find movies in the same percentile range for comparison (filtered by media type)
    const categoryMovies = getMoviesInPercentileRange(
      currentMediaMovies,
      categoryInfo.percentile,
      selectedMovie.id
    );
    
    if (categoryMovies.length >= 3) {
      // Get best 3 comparison movies
      const scoredMovies = categoryMovies.map(m => ({
        ...m,
        comparisonScore: calculateComparisonScore(m, selectedMovie, genres)
      }));
      
      const bestComparisons = scoredMovies
        .sort((a, b) => b.comparisonScore - a.comparisonScore)
        .slice(0, 3);
      
      setComparisonMovies(bestComparisons);
      setCurrentComparison(0);
      setComparisonResults([]);
      setIsComparisonComplete(false);
      setComparisonModalVisible(true);
      return;
    }
    
    // Not enough movies for comparison, use category average based on percentile
    const categoryAverage = seen && seen.length > 0 ? 
      (() => {
        const range = getRatingRangeFromPercentile(seen, categoryInfo.percentile);
        return (range[0] + range[1]) / 2;
      })() :
      getDefaultRatingForCategory(categoryKey);
    handleConfirmRating(categoryAverage);
  }, [currentSeenContent, selectedMovie, genres]);

  const getMoviesInPercentileRange = useCallback((userMovies, targetPercentile, excludeMovieId) => {
    if (!userMovies || userMovies.length === 0) return [];
    
    const sortedMovies = [...userMovies]
      .filter(movie => movie.id !== excludeMovieId && movie.userRating)
      .sort((a, b) => b.userRating - a.userRating);
    
    if (sortedMovies.length === 0) return [];
    
    const totalMovies = sortedMovies.length;
    const startIndex = Math.floor((targetPercentile[0] / 100) * totalMovies);
    const endIndex = Math.ceil((targetPercentile[1] / 100) * totalMovies);
    
    return sortedMovies.slice(startIndex, Math.min(endIndex, totalMovies));
  }, []);

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

  const handleComparison = useCallback((winner) => {
    const currentComparisonMovie = comparisonMovies[currentComparison];
    
    if (currentComparison === 0) {
      // FIRST COMPARISON: Unknown vs Known (use unified pairwise calculation)
      const opponentRating = currentComparisonMovie.userRating;
      let result;
      
      if (winner === 'new') {
        result = ComparisonResults.A_WINS;
      } else if (winner === 'comparison') {
        result = ComparisonResults.B_WINS;
      } else if (winner === 'tie') {
        result = ComparisonResults.TIE;
      }
      
      const pairwiseResult = calculatePairwiseRating({
        aRating: null, // New movie has no rating yet
        bRating: opponentRating, // Opponent rating
        aGames: 0, // New movie has no games
        bGames: currentComparisonMovie.gamesPlayed || 5,
        result: result
      });
      
      const derivedRating = pairwiseResult.updatedARating;
      const opponentNewRating = pairwiseResult.updatedBRating;
      
      setCurrentMovieRating(derivedRating);
      
      // Update opponent rating if it changed
      if (opponentNewRating !== opponentRating) {
        currentComparisonMovie.userRating = opponentNewRating;
        // Save to storage
        const updateOpponentRating = async () => {
          try {
            const storageKey = getStorageKey(mediaType);
            const storedMovies = await AsyncStorage.getItem(storageKey);
            if (storedMovies) {
              const movies = JSON.parse(storedMovies);
              const movieIndex = movies.findIndex(m => m.id === currentComparisonMovie.id);
              if (movieIndex !== -1) {
                movies[movieIndex].userRating = opponentNewRating;
                await AsyncStorage.setItem(storageKey, JSON.stringify(movies));
              }
            }
          } catch (error) {
            console.error('Error updating opponent rating in Round 1:', error);
          }
        };
        updateOpponentRating();
      }
      
      console.log(`🎯 Round 1 (Unknown vs Known): ${winner.toUpperCase()} vs ${currentComparisonMovie.title} (${opponentRating}) -> New: ${derivedRating}, Opponent: ${opponentNewRating}`);
      
      // Move to next comparison
      setCurrentComparison(1);
      
    } else if (currentComparison < comparisonMovies.length - 1) {
      // SUBSEQUENT COMPARISONS: Known vs Known (use unified pairwise calculation)
      const opponentRating = currentComparisonMovie.userRating;
      let result;
      
      if (winner === 'new') {
        result = ComparisonResults.A_WINS;
      } else if (winner === 'comparison') {
        result = ComparisonResults.B_WINS;
      } else if (winner === 'tie') {
        result = ComparisonResults.TIE;
      }
      
      const pairwiseResult = calculatePairwiseRating({
        aRating: currentMovieRating, // New movie current rating
        bRating: opponentRating, // Opponent rating
        aGames: currentComparison, // New movie games played so far
        bGames: currentComparisonMovie.gamesPlayed || 5,
        result: result
      });
      
      const updatedRating = pairwiseResult.updatedARating;
      const opponentNewRating = pairwiseResult.updatedBRating;
      
      setCurrentMovieRating(updatedRating);
      
      // Update opponent rating if it changed
      if (opponentNewRating !== opponentRating) {
        currentComparisonMovie.userRating = opponentNewRating;
        // Save to storage
        const updateOpponentRating = async () => {
          try {
            const storageKey = getStorageKey(mediaType);
            const storedMovies = await AsyncStorage.getItem(storageKey);
            if (storedMovies) {
              const movies = JSON.parse(storedMovies);
              const movieIndex = movies.findIndex(m => m.id === currentComparisonMovie.id);
              if (movieIndex !== -1) {
                movies[movieIndex].userRating = opponentNewRating;
                await AsyncStorage.setItem(storageKey, JSON.stringify(movies));
              }
            }
          } catch (error) {
            console.error('Error updating opponent rating in Round ' + (currentComparison + 1) + ':', error);
          }
        };
        updateOpponentRating();
      }
      
      console.log(`🎯 Round ${currentComparison + 1} (Known vs Known): ${winner.toUpperCase()} vs ${currentComparisonMovie.title} (${opponentRating}) -> New: ${updatedRating}, Opponent: ${opponentNewRating}`);
      
      // Move to next comparison
      setCurrentComparison(currentComparison + 1);
      
    } else {
      // FINAL COMPARISON: Known vs Known (use unified pairwise calculation)
      const opponentRating = currentComparisonMovie.userRating;
      let result;
      
      if (winner === 'new') {
        result = ComparisonResults.A_WINS;
      } else if (winner === 'comparison') {
        result = ComparisonResults.B_WINS;
      } else if (winner === 'tie') {
        result = ComparisonResults.TIE;
      }
      
      const pairwiseResult = calculatePairwiseRating({
        aRating: currentMovieRating, // New movie current rating
        bRating: opponentRating, // Opponent rating
        aGames: currentComparison, // New movie games played so far
        bGames: currentComparisonMovie.gamesPlayed || 5,
        result: result
      });
      
      const finalRating = pairwiseResult.updatedARating;
      const opponentNewRating = pairwiseResult.updatedBRating;
      
      // Update opponent rating if it changed
      if (opponentNewRating !== opponentRating) {
        currentComparisonMovie.userRating = opponentNewRating;
        // Save to storage
        const updateOpponentRating = async () => {
          try {
            const storageKey = getStorageKey(mediaType);
            const storedMovies = await AsyncStorage.getItem(storageKey);
            if (storedMovies) {
              const movies = JSON.parse(storedMovies);
              const movieIndex = movies.findIndex(m => m.id === currentComparisonMovie.id);
              if (movieIndex !== -1) {
                movies[movieIndex].userRating = opponentNewRating;
                await AsyncStorage.setItem(storageKey, JSON.stringify(movies));
              }
            }
          } catch (error) {
            console.error('Error updating opponent rating in Final Round:', error);
          }
        };
        updateOpponentRating();
      }
      
      console.log(`🎯 Round ${currentComparison + 1} (Known vs Known - FINAL): ${winner.toUpperCase()} vs ${currentComparisonMovie.title} (${opponentRating}) -> Final: ${finalRating}, Opponent: ${opponentNewRating}`);
      
      // SET RATING FIRST, then show completion screen
      console.log('🎯 SETTING finalCalculatedRating BEFORE completion screen:', finalRating);
      setFinalCalculatedRating(finalRating);
      setIsComparisonComplete(true);
      setTimeout(() => {
        setComparisonModalVisible(false);
        handleConfirmRating(finalRating);
      }, 1500);
    }
  }, [currentComparison, comparisonMovies, selectedMovie, selectedEmotion, currentMovieRating]);

  // ELO-based rating calculation using Wildcard's superior system
  const calculateRatingFromELOComparisons = useCallback((results) => {
    // Use centralized ELO calculation system (following CODE_BIBLE single-source-of-truth)
    let currentRating = null; // Start with no rating, just like the confidence-based system
    
    // Process each comparison using centralized ELO logic
    results.forEach((result, index) => {
      const opponent = result.winner === selectedMovie ? result.loser : result.winner;
      const newMovieWon = result.userChoice === 'new';
      const opponentRating = opponent.userRating || (opponent.eloRating / 100);
      
      if (currentRating === null) {
        // First comparison: use direct opponent-based calculation
        currentRating = opponentRating + (newMovieWon ? 0.5 : -0.5);
        currentRating = Math.max(1, Math.min(10, currentRating));
      } else {
        // Subsequent comparisons: use proper ELO calculation
        const comparisonResult = newMovieWon ? ComparisonResults.A_WINS : ComparisonResults.B_WINS;
        const eloResult = calculatePairwiseRating({
          aRating: currentRating,
          bRating: opponentRating,
          aGames: index,
          bGames: opponent.gamesPlayed || 5,
          result: comparisonResult
        });
        currentRating = eloResult.updatedARating;
      }
      
      console.log(`📊 Comparison ${index + 1}: ${newMovieWon ? 'WIN' : 'LOSS'} vs ${opponent.title} (${opponentRating}) -> Rating: ${currentRating?.toFixed(2)}`);
    });
    
    return currentRating;
  }, [selectedMovie]);

  // Note: Emotion baselines removed - using pure Unknown vs Known comparison
  
  // ✅ CONSOLIDATED: Now using centralized opponent selection
  const selectMovieFromPercentile = useCallback((seenMovies, emotion) => {
    // **MEDIA TYPE SEGREGATION: Only use content of the same media type for comparison**
    const filteredMovies = seenMovies.filter(movie => 
      movie.id !== selectedMovie?.id &&
      (movie.mediaType || 'movie') === mediaType
    );
    
    console.log(`🎯 Available opponents for ${mediaType}:`, filteredMovies.length);
    console.log(`🎯 Media type filter: ${mediaType}, Sample opponents:`, filteredMovies.slice(0, 3).map(m => `${m.title} (${m.mediaType || 'movie'})`));
    
    return selectOpponentFromEmotion(emotion, filteredMovies, selectedMovie?.id);
  }, [mediaType, selectedMovie?.id]);
  
  // Handle emotion selection and start comparison process
  const handleEmotionSelected = useCallback((emotion) => {
    console.log('🎭 EMOTION SELECTED:', emotion);
    console.log('🎭 CURRENT MEDIA TYPE:', mediaType);
    console.log('🎭 FILTERED CONTENT COUNT:', currentSeenContent.length);
    console.log('🎭 FILTERED CONTENT:', currentSeenContent.map(m => `${m.title}: ${m.userRating} (${m.mediaType || 'movie'})`));
    
    // **MEDIA TYPE SEGREGATION: Check minimum count for current media type**
    if (currentSeenContent.length < 3) {
      Alert.alert(
        '🎬 Need More Ratings', 
        `You need at least 3 rated ${mediaType === 'movie' ? 'movies' : 'TV shows'} to use this feature.\n\nCurrently you have: ${currentSeenContent.length} rated ${mediaType === 'movie' ? 'movies' : 'TV shows'}.\n\nPlease rate a few more ${mediaType === 'movie' ? 'movies' : 'TV shows'} first!`,
        [{ text: "OK", style: "default" }]
      );
      return;
    }
    
    // **FIX: Set rating in progress to prevent unwanted movie selection during rating flow**
    setIsRatingInProgress(true);
    console.log('🔒 Rating flow started - blocking movie selection');
    
    setSelectedEmotion(emotion);
    setEmotionModalVisible(false);
    // Don't clear selectedMovie here - keep it for comparison modal
    
    // Select first opponent from percentile - USING MEDIA-TYPE-FILTERED CONTENT
    const firstOpponent = selectMovieFromPercentile(currentSeenContent, emotion);
    if (!firstOpponent) {
      console.log('❌ NO FIRST OPPONENT FOUND');
      console.log('❌ DEBUG INFO:');
      console.log('- Current media type:', mediaType);
      console.log('- Filtered content count:', currentSeenContent.length);
      console.log('- Emotion/sentiment:', emotion);
      console.log('- Content with userRating:', currentSeenContent.filter(movie => movie.userRating).length);
      console.log('- Sample filtered content:', currentSeenContent[0] ? {
        title: currentSeenContent[0].title,
        userRating: currentSeenContent[0].userRating,
        mediaType: currentSeenContent[0].mediaType,
        id: currentSeenContent[0].id
      } : 'No content found');
      
      Alert.alert(
        '🎬 Need More Ratings', 
        `You need at least 3 rated ${mediaType === 'movie' ? 'movies' : 'TV shows'} to use this feature.\n\nCurrently you have: ${currentSeenContent.length} rated ${mediaType === 'movie' ? 'movies' : 'TV shows'}.\n\nPlease rate a few more ${mediaType === 'movie' ? 'movies' : 'TV shows'} first!`,
        [{ text: "OK", style: "default" }]
      );
      return;
    }
    
    // Select second and third opponents randomly from current media type content (for known vs known)
    const remainingMovies = currentSeenContent
      .filter(movie => movie.id !== firstOpponent.id);
    
    if (remainingMovies.length < 2) {
      console.log('❌ NOT ENOUGH REMAINING MOVIES');
      Alert.alert(
        '🎬 Need More Ratings', 
        `You need at least 3 total rated ${mediaType === 'movie' ? 'movies' : 'TV shows'} to use this feature.\n\nCurrently you have: ${currentSeenContent.length} rated ${mediaType === 'movie' ? 'movies' : 'TV shows'}.\n\nPlease rate a few more ${mediaType === 'movie' ? 'movies' : 'TV shows'} first!`,
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
  }, [selectedMovie, currentSeenContent, selectMovieFromPercentile, mediaType]);


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
    
    // **SIMPLE FIX: Remove from AI recommendations immediately after rating**
    setAiMovieRecommendations(prev => prev.filter(movie => movie.id !== ratedMovie.id));
    setAiTvRecommendations(prev => prev.filter(movie => movie.id !== ratedMovie.id));
    
    // **CODE_BIBLE Fix: Use unified removal utility to ensure ALL sections are cleaned**
    removeMovieFromAllSections(ratedMovie.id);
    setSocialRecommendations(prev => prev.filter(movie => movie.id !== ratedMovie.id));
    
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
  }, [selectedMovie, selectedCategory, onAddToSeen, contentType, seen, fetchRecentReleases, fetchPopularMovies, setFinalCalculatedRating, setAiMovieRecommendations, setAiTvRecommendations, setPopularMovies, setRecentReleases, closeDetailModal]);

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
  }, [fetchMovieCredits, fetchMovieProviders, mediaType, isProcessingMovieSelect, isRatingInProgress]);

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
        averageUserRating: seen.reduce((sum, m) => sum + m.userRating, 0) / seen.length,
        totalRated: seen.length,
        // Add more context as needed
      };
      
      // Record not interested for GROQ AI learning
      await recordNotInterested(movie, userProfile, contentType === 'movies' ? 'movie' : 'tv');
      
      // Remove from current recommendations - ONLY update the specific list that contains the item
      // This prevents multiple FlatList re-renders that cause screen "spazzing"
      const movieId = movie.id;
      
      // Check which list contains the movie and only update that one
      if (mediaType === 'movie') {
        setAiMovieRecommendations(prev => {
          const hasMovie = prev.some(item => item.id === movieId);
          if (hasMovie) {
            console.log(`🎯 Removing ${movie.title} from AI recommendations`);
            return prev.filter(item => item.id !== movieId);
          }
          return prev; // No change if movie not in this list
        });
      } else {
        setAiTvRecommendations(prev => {
          const hasMovie = prev.some(item => item.id === movieId);
          if (hasMovie) {
            console.log(`🎯 Removing ${movie.title} from AI recommendations`);
            return prev.filter(item => item.id !== movieId);
          }
          return prev; // No change if movie not in this list
        });
      }
      
      setPopularMovies(prev => {
        const hasMovie = prev.some(item => item.id === movieId);
        if (hasMovie) {
          console.log(`🎯 Removing ${movie.title} from popular movies`);
          return prev.filter(item => item.id !== movieId);
        }
        return prev; // No change if movie not in this list
      });
      
      setRecentReleases(prev => {
        const hasMovie = prev.some(item => item.id === movieId);
        if (hasMovie) {
          console.log(`🎯 Removing ${movie.title} from recent releases`);
          return prev.filter(item => item.id !== movieId);
        }
        return prev; // No change if movie not in this list
      });
      
      setSocialRecommendations(prev => {
        const hasMovie = prev.some(item => item.id === movieId);
        if (hasMovie) {
          console.log(`🎯 Removing ${movie.title} from social recommendations`);
          return prev.filter(item => item.id !== movieId);
        }
        return prev; // No change if movie not in this list
      });
      
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
  }, [contentType, mediaType, seen.length, recordNotInterested, setAiMovieRecommendations, setAiTvRecommendations, setPopularMovies, setRecentReleases, setSocialRecommendations, setNotInterestedMovies, selectedMovie, closeDetailModal]);

  const openRatingModal = useCallback(() => {
    // Fade animation removed
    setShowSentimentButtons(true);
  }, []);
  
  const cancelSentimentSelection = useCallback(() => {
    // Fade animation removed
    setShowSentimentButtons(false);
  }, []);

  const closeRatingModal = useCallback(() => {
    // Slide animation removed
    setRatingModalVisible(false);
    setRatingInput('');
  }, []);

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

  // **INITIAL RATING FLOW FUNCTIONS**
  const openInitialRatingFlow = useCallback(() => {
    setInitialRatingFlowVisible(true);
  }, []);

  const closeInitialRatingFlow = useCallback(() => {
    setInitialRatingFlowVisible(false);
    setSelectedMovie(null);
  }, []);

  const handleInitialRatingComplete = useCallback((ratedMovie) => {
    console.log('🎬 Initial rating flow completed:', ratedMovie);
    
    // Add to seen list with the calibrated rating
    onAddToSeen(ratedMovie);
    
    // **CRITICAL FIX: Update seenMoviesRef immediately to prevent AI re-recommendations**
    seenMoviesRef.current = [...seenMoviesRef.current, ratedMovie];
    
    // **SIMPLE FIX: Remove from AI recommendations immediately after rating**
    setAiMovieRecommendations(prev => prev.filter(movie => movie.id !== ratedMovie.id));
    setAiTvRecommendations(prev => prev.filter(movie => movie.id !== ratedMovie.id));
    
    // **CODE_BIBLE Fix: Use unified removal utility to ensure ALL sections are cleaned**
    removeMovieFromAllSections(ratedMovie.id);
    
    // Close the flow
    setInitialRatingFlowVisible(false);
    setSelectedMovie(null);
    
    // Show success feedback
    Alert.alert(
      "Rating Complete!",
      `${ratedMovie.title} has been rated ${ratedMovie.userRating}/10 and added to your collection.`,
      [{ text: "OK" }]
    );
  }, [onAddToSeen, removeMovieFromAllSections]);
  
  const submitRating = useCallback(() => {
    const rating = parseFloat(ratingInput);
    if (isNaN(rating) || rating < 1 || rating > 10) {
      return;
    }
    
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
      userRating: rating,
      eloRating: rating * 100,
      comparisonHistory: [],
      comparisonWins: 0,
      mediaType: contentType === 'movies' ? 'movie' : 'tv',
      // Add confidence metadata if available (from adaptive rating system)
      confidence: selectedMovie.confidence || null
    };
    
    onAddToSeen(ratedMovie);
    
    // **Enhanced Preference Learning - Issue #8**
    recordUserRating(ratedMovie, rating, mediaType).catch(error => {
      console.error('Failed to record rating for preference learning:', error);
    });
    
    // **CODE_BIBLE Fix: Remove rated movie from ALL home screen sections**
    removeMovieFromAllSections(selectedMovie.id);
    
    // **AI RECOMMENDATIONS REFRESH: Manual refresh needed since auto-refresh is disabled**
    setTimeout(() => {
      fetchAIRecommendations(true); // Force refresh AI recommendations after rating
    }, 100); // Brief delay for React state updates to propagate
    
    closeRatingModal();
  }, [ratingInput, selectedMovie, onAddToSeen, removeMovieFromAllSections, closeRatingModal, contentType, fetchAIRecommendations]); // Added fetchAIRecommendations for manual refresh

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
        
        // Remove movie from all home screen sections when added to watchlist
        setPopularMovies(prev => {
          const filtered = prev.filter(movie => movie.id !== movieId);
          console.log(`🗑️ Removed watchlisted movie from popularMovies: ${prev.length} -> ${filtered.length}`);
          return filtered;
        });
        setRecentReleases(prev => {
          const filtered = prev.filter(movie => movie.id !== movieId);
          console.log(`🗑️ Removed watchlisted movie from recentReleases: ${prev.length} -> ${filtered.length}`);
          return filtered;
        });
        if (mediaType === 'movie') {
          setAiMovieRecommendations(prev => {
            const filtered = prev.filter(movie => movie.id !== movieId);
            console.log(`🗑️ Removed watchlisted movie from aiRecommendations: ${prev.length} -> ${filtered.length}`);
            return filtered;
          });
        } else {
          setAiTvRecommendations(prev => {
            const filtered = prev.filter(movie => movie.id !== movieId);
            console.log(`🗑️ Removed watchlisted movie from aiRecommendations: ${prev.length} -> ${filtered.length}`);
            return filtered;
          });
        }
      }
    }
    
    closeDetailModal();
  }, [selectedMovie, seen, onAddToUnseen, closeDetailModal, contentType, mediaType, setPopularMovies, setRecentReleases, setAiMovieRecommendations, setAiTvRecommendations]);

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
                style={homeStyles.genreName}
                numberOfLines={1}
                adjustsFontSizeToFit={true}
                minimumFontScale={0.7}
                ellipsizeMode="tail"
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
  }, [calculateMatchPercentage, homeStyles, handleMovieSelect, colors, getRatingBorderColor]);

  // **PERFORMANCE OPTIMIZATION: Memoized movie card component**
  const MovieCard = React.memo(({ item }) => (
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
            style={homeStyles.genreName}
            numberOfLines={1}
            adjustsFontSizeToFit={true}
            minimumFontScale={0.7}
            ellipsizeMode="tail"
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
  ), (prevProps, nextProps) => {
    // **PERFORMANCE: Custom comparison for memo optimization**
    return prevProps.item.id === nextProps.item.id && 
           prevProps.item.userRating === nextProps.item.userRating &&
           prevProps.item.alreadySeen === nextProps.item.alreadySeen;
  });

  const renderMovieCard = useCallback(({ item }) => <MovieCard item={item} />, []);

  // **🎯 CRITICAL ENHANCED RATING BUTTON INTEGRATION**
  // **PERFORMANCE OPTIMIZATION: Memoized recent release card component**
  const RecentReleaseCard = React.memo(({ item }) => {
    console.log('🎬 Rendering recent release card for:', item?.title, 'Already seen:', item?.alreadySeen);
    
    return (
      <View style={[
        homeStyles.movieCardBorder, 
        { 
          width: 320, 
          alignSelf: 'center', 
          height: 150,
          borderColor: getRatingBorderColor(item),
          borderWidth: getRatingBorderColor(item) !== 'transparent' ? 1 : 0
        }
      ]}>
        <TouchableOpacity 
          style={[homeStyles.enhancedCard, styles.recentCard, { alignItems: 'center', height: 150 }]}
          activeOpacity={0.7}
          onPress={() => handleMovieSelect(item)}
        >
          {/* NOT INTERESTED X BUTTON - TOP RIGHT */}
          <TouchableOpacity
            style={{
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
            }}
            onPress={(event) => handleNotInterested(item, event)}
            activeOpacity={0.8}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={18} color="white" />
          </TouchableOpacity>
          
          <Image 
            source={{ uri: `https://image.tmdb.org/t/p/w500${item.poster}` }} 
            style={styles.recentPoster}
            resizeMode="cover"
          />
          <View style={[homeStyles.movieInfoBox, { flex: 1, padding: 12, minWidth: 200, alignItems: 'center', justifyContent: 'center', height: 150 }]}>
            <Text
              style={[homeStyles.genreName, { fontSize: 20, lineHeight: 25, textAlign: 'center' }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {item.title}
            </Text>
            <Text style={[homeStyles.movieYear, { fontSize: 11, marginTop: 2, marginBottom: 4, textAlign: 'center' }]}>
              Released: {formatReleaseDate(item.release_date)}
            </Text>
            <View style={[styles.ratingContainer, { marginVertical: 2, justifyContent: 'center' }]}>
              <Ionicons name="star" size={12} color={homeStyles.genreScore.color} />
              <Text style={[homeStyles.genreScore, { marginLeft: 4, fontSize: 11 }]}>
                TMDb: {item.score.toFixed(1)}
              </Text>
            </View>
            
          </View>
        </TouchableOpacity>
      </View>
    );
  }, (prevProps, nextProps) => {
    // **PERFORMANCE: Custom comparison for memo optimization**
    return prevProps.item.id === nextProps.item.id && 
           prevProps.item.alreadySeen === nextProps.item.alreadySeen &&
           prevProps.item.userRating === nextProps.item.userRating;
  });

  const renderRecentReleaseCard = useCallback(({ item }) => <RecentReleaseCard item={item} />, []);

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
              <View style={[
                homeStyles.movieCardBorder,
                { 
                  borderColor: getRatingBorderColor(item),
                  borderWidth: getRatingBorderColor(item) !== 'transparent' ? 1 : 0
                }
              ]}>
                <TouchableOpacity
                  style={{ marginRight: 12, width: MOVIE_CARD_WIDTH, height: MOVIE_CARD_WIDTH * 1.9 }}
                  activeOpacity={0.7}
                  onPress={() => handleMovieSelect(item)}
                >
                  <View
                    style={[homeStyles.enhancedCard, { width: MOVIE_CARD_WIDTH, height: MOVIE_CARD_WIDTH * 1.9 }]}
                  >
                    <View style={[styles.aiRecommendationBadge, { 
                      backgroundColor: (item.discoverySession || currentSession) ? '#FF6B6B' : '#4CAF50', 
                      top: 12 
                    }]}>
                      <Text style={styles.rankingNumber}>
                        {(() => {
                          if (item.discoveryScore) return Math.round(item.discoveryScore);
                          if (item.discoverySession || currentSession) return 'DS';
                          return 'AI';
                        })()}
                      </Text>
                    </View>
                    
                    {/* NOT INTERESTED X BUTTON - TOP RIGHT */}
                    <TouchableOpacity
                      style={{
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
                      }}
                      onPress={(event) => handleNotInterested(item, event)}
                      activeOpacity={0.8}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name="close" size={18} color="white" />
                    </TouchableOpacity>
                    
                    <Image
                      source={{
                        uri: `https://image.tmdb.org/t/p/w500${item.poster_path}`
                      }}
                      style={[styles.moviePoster, { width: MOVIE_CARD_WIDTH - 6, height: MOVIE_CARD_WIDTH * 1.5 - 6 }]}
                      resizeMode="cover"
                    />
                    <View style={[homeStyles.movieInfoBox, { width: MOVIE_CARD_WIDTH - 6, minHeight: 80 }]}>
                      <Text
                        style={[homeStyles.genreName, { fontSize: 16, lineHeight: 18, marginBottom: 2 }]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
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
                  </View>
                </TouchableOpacity>
              </View>
            )}
          />
        )}
      </View>
    );
  }, [aiRecommendations, isLoadingRecommendations, homeStyles, contentType, handleMovieSelect, colors, seen, onAddToSeen, onUpdateRating, buttonStyles, modalStyles, genres, mediaType, getRatingBorderColor, currentSession, generateSession, handleRefreshRecommendations, dailyRefreshCount, isRefreshingAI]);

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
          renderItem={({ item, index }) => (
            <View style={[
              homeStyles.movieCardBorder, 
              { 
                padding: 0,
                borderColor: getRatingBorderColor(item),
                borderWidth: getRatingBorderColor(item) !== 'transparent' ? 1 : 0
              }
            ]}>
              <TouchableOpacity
                style={{ marginRight: 12, width: MOVIE_CARD_WIDTH, height: MOVIE_CARD_WIDTH * 1.9 }}
                activeOpacity={0.7}
                onPress={() => handleMovieSelect(item)}
              >
                <View
                  style={[homeStyles.enhancedCard, { width: MOVIE_CARD_WIDTH, height: MOVIE_CARD_WIDTH * 1.9 }]}
                >
                  <View style={[styles.rankingBadge, { backgroundColor: theme[mediaType][isDarkMode ? 'dark' : 'light'].accent }]}>
                    <Text style={styles.rankingNumber}>{index + 1}</Text>
                  </View>
                  
                  {/* NOT INTERESTED X BUTTON - TOP RIGHT */}
                  <TouchableOpacity
                    style={{
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
                    }}
                    onPress={(event) => handleNotInterested(item, event)}
                    activeOpacity={0.8}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="close" size={18} color="white" />
                  </TouchableOpacity>
                  
                  <Image
                    source={{
                      uri: `https://image.tmdb.org/t/p/w500${item.poster_path}`
                    }}
                    style={[styles.moviePoster, { width: MOVIE_CARD_WIDTH - 6, height: MOVIE_CARD_WIDTH * 1.5 - 6 }]}
                    resizeMode="cover"
                  />
                  <View style={[homeStyles.movieInfoBox, { width: MOVIE_CARD_WIDTH - 6, minHeight: 80 }]}>
                    <Text
                      style={[homeStyles.genreName, { fontSize: 16, lineHeight: 18, marginBottom: 2 }]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
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
                    {item.streamingProviders && item.streamingProviders.length > 0 && (
                      <View style={{ flexDirection: 'row', marginTop: 4, flexWrap: 'wrap' }}>
                        {item.streamingProviders.slice(0, 3).map((provider) => {
                          const paymentType = getProviderPaymentType(provider.provider_id);
                          return (
                            <View key={provider.provider_id} style={{ alignItems: 'center', marginRight: 4 }}>
                              <Image
                                source={{ uri: `https://image.tmdb.org/t/p/w92${provider.logo_path}` }}
                                style={{
                                  width: 16,
                                  height: 16,
                                  borderRadius: 2,
                                  borderColor: paymentType === 'paid' ? '#FF4444' : '#22C55E',
                                  borderWidth: 0.5,
                                }}
                                resizeMode="contain"
                              />
                              <Text style={{
                                fontSize: 6,
                                color: paymentType === 'paid' ? '#FF4444' : '#22C55E',
                                fontWeight: 'bold',
                                marginTop: 1
                              }}>
                                {paymentType === 'paid' ? '$' : 'FREE'}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    )}

                  </View>
                </View>
              </TouchableOpacity>
            </View>
          )}
          // REMOVED: onScroll animation causing unwanted movement
          // AUTO-SCROLL DISABLED: No touch-based scrolling
          // onTouchStart={() => clearInterval(autoScrollPopular.current)}
          // onTouchEnd={startPopularAutoScroll}
        />
      </View>
    );
  }, [homeStyles, popularMovies, handleMovieSelect, theme, mediaType, isDarkMode, colors, seen, onAddToSeen, onUpdateRating, buttonStyles, modalStyles, genres, getRatingBorderColor]);

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
  }, [contentType, fetchRecentReleases, fetchPopularMovies]);

  // **🏠 AUTO-REFRESH WHEN MOVIES ARE RATED**
  useEffect(() => {
    console.log(`🎬 Seen ${mediaType === 'movie' ? 'movies' : 'content'} updated, count:`, seen.length);
    // Refresh home screen data when movies are rated to remove them from display
    fetchRecentReleases();
    fetchPopularMovies();
    // fetchAIRecommendations(); // REMOVED: Keep AI recommendations static to prevent reloading
  }, [currentSeenContent.length, fetchRecentReleases, fetchPopularMovies]);

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
      fetchRecentReleases();
      // fetchAIRecommendations(); // REMOVED: Keep AI recommendations static
    }
  }, [skippedMovies, fetchPopularMovies, fetchRecentReleases]);

  useEffect(() => {
    console.log('🔄 watchlist (unseen) updated:', unseen.length);
    console.log('🔄 Re-fetching data due to watchlist change');
    fetchPopularMovies();
    fetchRecentReleases();
    // fetchAIRecommendations(); // REMOVED: Keep AI recommendations static
  }, [unseen.length, fetchPopularMovies, fetchRecentReleases]);

  // ============================================================================
  // **MAIN RENDER - COLLABORATIVE UI MASTERPIECE**
  // ============================================================================

  return (
    <View style={{ flex: 1, backgroundColor: mediaType === 'movie' ? '#8B5CF6' : '#3B82F6' }}>
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
                contentContainerStyle={{ paddingBottom: 100 }}
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
                />
                {renderAIRecommendationsSection()}
                {renderPopularMoviesSection()}
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
                contentContainerStyle={{ paddingBottom: 100 }}
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
                />
                {renderAIRecommendationsSection()}
                {renderPopularMoviesSection()}
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
        <Modal
          visible={movieDetailModalVisible}
          transparent
          animationType="none"
          onRequestClose={closeDetailModal}
        >
          <View style={modalStyles.detailModalOverlay}>
            <LinearGradient
              colors={theme[mediaType][isDarkMode ? 'dark' : 'light'].primaryGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={modalStyles.detailModalContent}
            >
              {/* X button at top-right - NOW WORKS AS NOT INTERESTED */}
              <TouchableOpacity
                style={{
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
                }}
                onPress={(event) => handleNotInterested(selectedMovie, event)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                activeOpacity={0.8}
              >
                <Ionicons name="close" size={18} color="white" />
              </TouchableOpacity>
              
              <Image 
                source={{ uri: `https://image.tmdb.org/t/p/w500${selectedMovie?.poster_path}` }} 
                style={modalStyles.detailPoster}
                resizeMode="cover" 
              />
              
              <Text style={modalStyles.detailTitle}>
                {selectedMovie?.title}
              </Text>
              
              <Text style={modalStyles.detailYear}>
                ({selectedMovie?.release_date ? new Date(selectedMovie.release_date).getFullYear() : 'Unknown'})
              </Text>
              
              <Text style={modalStyles.detailScore}>
                TMDb: {selectedMovie?.vote_average?.toFixed(1) || 'N/A'}
              </Text>
              
              {/* **LOADING INDICATOR FOR MOVIE DETAILS** */}
              {isLoadingMovieDetails ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 8 }}>
                  <ActivityIndicator size="small" color={colors.accent} />
                  <Text style={[modalStyles.detailActors, { marginLeft: 8 }]}>
                    Loading movie details...
                  </Text>
                </View>
              ) : (
                movieCredits && movieCredits.length > 0 && (
                  <Text style={modalStyles.detailActors}>
                    Actors: {movieCredits.map(actor => actor.name).join(', ')}
                  </Text>
                )
              )}
              
              <Text 
                style={modalStyles.detailPlot}
                numberOfLines={4}
                ellipsizeMode="tail"
              >
                {selectedMovie?.overview || 'No description available.'}
              </Text>
              
              <View style={modalStyles.streamingRow}>
                {isLoadingMovieDetails ? (
                  <Text style={[modalStyles.detailActors, { fontSize: 12, color: colors.subText }]}>
                    Loading streaming providers...
                  </Text>
                ) : (
                  movieProviders && movieProviders.length > 0 ? (
                    prioritizeStreamingProviders(movieProviders, currentUser?.profile?.preferences?.streamingServices || [])
                      .filter(provider => provider.logo_path)
                      .map((provider) => {
                        const paymentType = getProviderPaymentType(provider.provider_id);
                        return (
                          <View key={provider.provider_id} style={{ alignItems: 'center', marginRight: 8 }}>
                            <Image 
                              source={{ uri: getProviderLogoUrl(provider.logo_path, provider.provider_id) }}
                              style={[
                                modalStyles.platformIcon,
                                {
                                  borderColor: paymentType === 'paid' ? '#FF4444' : '#22C55E',
                                  borderWidth: 0.5,
                                }
                              ]}
                              resizeMode="contain"
                            />
                            <Text style={{
                              fontSize: 8,
                              color: paymentType === 'paid' ? '#FF4444' : '#22C55E',
                              fontWeight: 'bold',
                              marginTop: 2
                            }}>
                              {paymentType === 'paid' ? '$' : 'FREE'}
                            </Text>
                          </View>
                        );
                      })
                  ) : null
                )}
              </View>
              
              <View style={modalStyles.buttonRow}>
                {/* **ACTION BUTTONS** */}
                <View 
                  style={{ 
                    opacity: showSentimentButtons ? 0 : 1,
                    position: showSentimentButtons ? 'absolute' : 'relative',
                    width: '100%',
                    flexDirection: 'row'
                  }}
                  pointerEvents="auto"
                >
                  {/* Rate Button */}
                  <TouchableOpacity 
                    style={[
                      standardButtonStyles.baseButton,
                      standardButtonStyles.tertiaryButton
                    ]}
                    onPress={() => {
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
                    activeOpacity={0.7}
                  >
                    <Text 
                      style={[
                        standardButtonStyles.baseText,
                        standardButtonStyles.tertiaryText
                      ]}
                    >
                      {seen.some(movie => movie.id === selectedMovie?.id) ? 'Re-rate' : 'Rate'}
                    </Text>
                  </TouchableOpacity>
                  
                  {/* Watchlist Button */}
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
                      numberOfLines={1}
                      ellipsizeMode="tail"
                      adjustsFontSizeToFit={true}
                    >
                      Watchlist
                    </Text>
                  </TouchableOpacity>
                  
                  {/* Not Interested Button - Tertiary Action */}
                  <TouchableOpacity 
                    style={[
                      standardButtonStyles.baseButton,
                      standardButtonStyles.tertiaryButton
                    ]}
                    onPress={(event) => handleNotInterested(selectedMovie, event)}
                    activeOpacity={0.7}
                  >
                    <Text 
                      style={[
                        standardButtonStyles.baseText,
                        standardButtonStyles.tertiaryText
                      ]}
                    >
                      Not Interested
                    </Text>
                  </TouchableOpacity>
                </View>
                
                {/* **SENTIMENT BUTTONS** */}
                {showSentimentButtons && (
                  <View 
                    style={{ 
                      opacity: 1,
                      position: 'absolute',
                      width: '100%',
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      justifyContent: 'space-between'
                    }}
                  >
                    {Object.entries(memoizedRatingCategories).map(([categoryKey, category]) => (
                      <TouchableOpacity
                        key={categoryKey}
                        style={[
                          styles.sentimentButton,
                          { 
                            backgroundColor: 'transparent',
                            borderColor: category.borderColor || category.color,
                            borderWidth: 2,
                            flex: 1,
                            marginHorizontal: 2,
                            minHeight: 60
                          }
                        ]}
                        onPress={() => handleSentimentSelect(categoryKey)}
                        activeOpacity={0.8}
                      >
                        <Text style={{ fontSize: 20, marginBottom: 4 }}>{category.emoji}</Text>
                        <Text 
                          style={[
                            styles.sentimentLabel,
                            { 
                              color: category.color, 
                              fontSize: Math.min(14, width * 0.032), 
                              textAlign: 'center',
                              fontWeight: '600'
                            }
                          ]}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                          adjustsFontSizeToFit={true}
                        >
                          {category.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                    
                    {/* Back button for sentiment selection */}
                    <TouchableOpacity
                      style={[
                        styles.sentimentBackButton,
                        { 
                          borderColor: colors.border?.color || '#ccc',
                          borderWidth: 1,
                          width: '100%',
                          marginTop: 8,
                          paddingVertical: 8,
                          alignItems: 'center',
                          borderRadius: 8
                        }
                      ]}
                      onPress={cancelSentimentSelection}
                      activeOpacity={0.8}
                    >
                      <Text style={{ color: colors.subText, fontSize: 14 }}>← Back to Options</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
              
              <TouchableOpacity onPress={closeDetailModal} style={modalStyles.cancelButtonContainer}>
                <Text style={modalStyles.cancelText}>cancel</Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </Modal>

        {/* **EMOTION SELECTION MODAL - Using Reusable Component** */}
        <SentimentRatingModal
          visible={emotionModalVisible}
          movie={selectedMovie}
          onClose={() => {
            setEmotionModalVisible(false);
            // **FIX: Reset rating flag if user cancels emotion selection**
            setIsRatingInProgress(false);
            console.log('🔓 Emotion modal closed - reset rating flag');
          }}
          onRatingSelect={(movieWithRating, categoryKey, rating) => {
            console.log('🎭 Sentiment selected via reusable component:', categoryKey, 'Rating:', rating);
            setSelectedCategory(categoryKey);
            // Wire to existing handleEmotionSelected logic
            handleEmotionSelected(categoryKey);
          }}
          colors={colors}
          userMovies={currentSeenContent}
          mediaType={mediaType}
        />

        {/* **WILDCARD COMPARISON MODAL** */}
        <Modal visible={comparisonModalVisible} transparent animationType="none">
          <View style={styles.modalOverlay}>
            <LinearGradient
              colors={colors.primaryGradient || ['#667eea', '#764ba2']}
              style={styles.comparisonModalContent}
            >
              {!isComparisonComplete ? (
                <>
                  <View style={styles.comparisonHeader}>
                    <Text style={[styles.modalTitle, { color: colors.text }]}>
                      🎬 Comparison {currentComparison + 1}/3
                    </Text>
                    <Text style={[styles.comparisonSubtitle, { color: colors.subText }]}>
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
                      <Text style={[styles.movieCardName, { color: colors.text }]} numberOfLines={2}>
                        {selectedMovie?.title || selectedMovie?.name}
                      </Text>
                      <Text style={[styles.movieCardYear, { color: colors.subText }]}>
                        {selectedMovie?.release_date ? new Date(selectedMovie.release_date).getFullYear() : 'N/A'}
                      </Text>
                    </TouchableOpacity>
                    
                    {/* VS Indicator */}
                    <View style={styles.vsIndicator}>
                      <Text style={[styles.vsText, { color: colors.accent }]}>VS</Text>
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
                        <Text style={[styles.movieCardName, { color: colors.text }]} numberOfLines={2}>
                          {comparisonMovies[currentComparison]?.title || comparisonMovies[currentComparison]?.name}
                        </Text>
                        <Text style={[styles.movieCardYear, { color: colors.subText }]}>
                          {comparisonMovies[currentComparison]?.release_date ? new Date(comparisonMovies[currentComparison].release_date).getFullYear() : 'N/A'}
                        </Text>
                        <View style={[styles.ratingBadge, { backgroundColor: colors.accent }]}>
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
                            backgroundColor: index <= currentComparison ? colors.accent : colors.border?.color || '#ccc'
                          }
                        ]}
                      />
                    ))}
                  </View>

                  {/* Too Tough to Decide Button */}
                  <TouchableOpacity 
                    style={[styles.cancelButton, { borderColor: colors.border?.color || '#ccc' }]}
                    onPress={() => {
                      console.log('User selected: Too tough to decide');
                      // Use unified pairwise calculation for TIE result
                      handleComparison('tie');
                    }}
                  >
                    <Text style={[styles.cancelButtonText, { color: colors.subText }]}>Too Tough to Decide</Text>
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
                  <Text style={[styles.finalRatingScore, { color: colors.secondary }]}>
                    {(() => {
                      console.log('🔍 Rendering final score, finalCalculatedRating is:', finalCalculatedRating);
                      return finalCalculatedRating?.toFixed(1) || 'test';
                    })()}
                  </Text>
                </View>
              )}
              
              <TouchableOpacity 
                style={[styles.cancelButton, { borderColor: colors.border?.color || '#ccc' }]}
                onPress={handleCloseEnhancedModals}
              >
                <Text style={[styles.cancelButtonText, { color: colors.subText }]}>
                  {isComparisonComplete ? 'Close' : 'Cancel'}
                </Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </Modal>

        {/* **LEGACY RATING MODAL (FALLBACK)** */}
        <RatingModal
          visible={ratingModalVisible}
          onClose={closeRatingModal}
          onSubmit={submitRating}
          movie={selectedMovie}
          ratingInput={ratingInput}
          setRatingInput={setRatingInput}
          mediaType={mediaType}
          isDarkMode={isDarkMode}
          theme={theme}
          genres={genres}
        />

        {/* **INITIAL RATING FLOW MODAL** */}
        <InitialRatingFlow
          visible={initialRatingFlowVisible}
          movie={selectedMovie}
          seenMovies={currentSeenContent}
          onClose={closeInitialRatingFlow}
          onComplete={handleInitialRatingComplete}
          isDarkMode={isDarkMode}
        />
      </SafeAreaView>
    </View>
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
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
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