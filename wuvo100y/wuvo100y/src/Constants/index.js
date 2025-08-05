// =============================================================================
// SECURE API CONFIGURATION - HARDCODED KEYS REMOVED
// =============================================================================
// WHY: Hardcoded API keys were critical security vulnerability
// WHAT: Keys now imported from secure environment system
// HOW: Import ENV.TMDB_API_KEY and ENV.GROQ_API_KEY from ../config/environment

import { ENV } from '../config/environment';

// API Configuration - now secure
console.log('🔍 Constants loading - ENV.TMDB_API_KEY:', ENV.TMDB_API_KEY ? ENV.TMDB_API_KEY.substring(0, 10) + '...' : 'NULL');
export const TMDB_API_KEY = ENV.TMDB_API_KEY;
export const GROQ_API_KEY = ENV.GROQ_API_KEY;
export const API_KEY = ENV.TMDB_API_KEY; // Backward compatibility
export const API_TIMEOUT = 10000;
export const MIN_VOTE_COUNT = 500;
export const MIN_SCORE = 7.0;

// Storage Keys
export const USER_SESSION_KEY = 'wuvo_user_session';
export const USER_DATA_KEY = 'wuvo_user_data';
export const USER_SEEN_MOVIES_KEY = 'wuvo_user_seen_movies';
export const USER_UNSEEN_MOVIES_KEY = 'wuvo_user_unseen_movies';
export const USER_PREFERENCES_KEY = 'wuvo_user_preferences';
export const ONBOARDING_COMPLETE_KEY = 'wuvo_onboarding_complete';

// Wildcard Storage Keys
export const STORAGE_KEY_MOVIES = 'wuvo_compared_movies';
export const STORAGE_KEY_TV = 'wuvo_compared_tv';
export const BASELINE_COMPLETE_KEY_MOVIES = 'wuvo_baseline_complete_movies';
export const BASELINE_COMPLETE_KEY_TV = 'wuvo_baseline_complete_tv';
export const COMPARISON_COUNT_KEY_MOVIES = 'wuvo_comparison_count_movies';
export const COMPARISON_COUNT_KEY_TV = 'wuvo_comparison_count_tv';
export const COMPARISON_PATTERN_KEY_MOVIES = 'wuvo_comparison_pattern_movies';
export const COMPARISON_PATTERN_KEY_TV = 'wuvo_comparison_pattern_tv';
export const STREAMING_CACHE_KEY = 'wuvo_streaming_cache';
export const RATE_LIMIT_KEY = 'groq_api_rate_limit';

// Initial genres mapping
export const INITIAL_GENRES = {
  28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy',
  80: 'Crime', 99: 'Documentary', 18: 'Drama', 10751: 'Family',
  14: 'Fantasy', 36: 'History', 27: 'Horror', 10402: 'Music',
  9648: 'Mystery', 10749: 'Romance', 878: 'Science Fiction',
  10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western'
};

// Streaming services
export const STREAMING_SERVICES = [
  { 
    id: 8, 
    name: 'Netflix', 
    icon: 'netflix',
    iconFamily: 'MaterialCommunityIcons',
    brandColor: '#E50914',
    fallbackText: 'NET'
  },
  { 
    id: 350, 
    name: 'Apple TV+', 
    icon: 'apple',
    iconFamily: 'MaterialCommunityIcons', 
    brandColor: '#000000',
    fallbackText: 'ATV'
  },
  { 
    id: 15, 
    name: 'Hulu', 
    icon: 'hulu',
    iconFamily: 'MaterialCommunityIcons',
    brandColor: '#1CE783',
    fallbackText: 'HULU'
  },
  { 
    id: 384, 
    name: 'HBO Max', 
    icon: 'television-classic',
    iconFamily: 'MaterialCommunityIcons',
    brandColor: '#8560A8',
    fallbackText: 'HBO'
  },
  { 
    id: 337, 
    name: 'Disney+', 
    icon: 'disney',
    iconFamily: 'MaterialCommunityIcons',
    brandColor: '#113CCF',
    fallbackText: 'DIS+'
  },
  { 
    id: 387, 
    name: 'Peacock', 
    icon: 'television',
    iconFamily: 'MaterialCommunityIcons',
    brandColor: '#00B8CC',
    fallbackText: 'PCCK'
  },
  { 
    id: 9, 
    name: 'Prime Video', 
    icon: 'amazon',
    iconFamily: 'MaterialCommunityIcons',
    brandColor: '#00A8E1',
    fallbackText: 'AMZN'
  }
];

// Top 10 streaming services with priority for Advanced Filters
export const STREAMING_SERVICES_PRIORITY = [
  { id: 8, priority: 1, name: 'Netflix', logo_path: '/pbpMk2JmcoNnQwx5JGpXngfoWtp.jpg' },
  { id: 9, priority: 2, name: 'Prime Video', logo_path: '/emthp39XA2YScoYL1p0sdbAH2WA.jpg' },
  { id: 337, priority: 3, name: 'Disney+', logo_path: '/7rwgEs15tFwyR9NPQ5vpzxTj19Q.jpg' },
  { id: 384, priority: 4, name: 'HBO Max', logo_path: '/aS2zvJWn9mWiCOeaVQwRrpvuCWw.jpg' },
  { id: 15, priority: 5, name: 'Hulu', logo_path: '/giwM8XX4V2AQb9vsoN7yti82tKK.jpg' },
  { id: 350, priority: 6, name: 'Apple TV+', logo_path: '/peURlLlr8jggOwK53fJ5wdQl05y.jpg' },
  { id: 387, priority: 7, name: 'Peacock', logo_path: '/xbhHHa1YgtpwhC8lb1NQ3ACVcLd.jpg' },
  { id: 531, priority: 8, name: 'Paramount+', logo_path: '/h5DcR0J2EESLitnhR8xLG1QymTE.jpg' },
  { id: 283, priority: 9, name: 'Crunchyroll', logo_path: '/8Gt1iClBlzTeQs8WQm8UrCoIxnQ.jpg' },
  { id: 546, priority: 10, name: 'Showtime', logo_path: '/Allhh8fH8876NNjjsQpWeEgOFOr.jpg' }
];

// Decades for filtering
export const DECADES = [
  { value: '1960s', label: 'Pre-70s', startYear: 1900, endYear: 1969 },
  { value: '1970s', label: '1970s', startYear: 1970, endYear: 1979 },
  { value: '1980s', label: '1980s', startYear: 1980, endYear: 1989 },
  { value: '1990s', label: '1990s', startYear: 1990, endYear: 1999 },
  { value: '2000s', label: '2000s', startYear: 2000, endYear: 2009 },
  { value: '2010s', label: '2010s', startYear: 2010, endYear: 2019 },
  { value: '2020s', label: '2020s', startYear: 2020, endYear: 2029 }
];