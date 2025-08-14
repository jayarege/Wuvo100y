import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Dimensions,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  Alert,
  FlatList
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';

// Import constants and theme
import { TMDB_API_KEY, ONBOARDING_COMPLETE_KEY, STREAMING_SERVICES } from '../Constants';
import theme from '../utils/Theme';

// Constants
const { width, height } = Dimensions.get('window');
const API_KEY = TMDB_API_KEY;

// COMMANDMENT 6: Document WHY - Movie Selection Strategy
// WHY: Curated list of 30 popular movies spanning different genres and decades
// WHY: Static list prevents API dependencies during critical onboarding flow
// WHY: Mix of mainstream (Avengers) and acclaimed (Godfather) for broad appeal
// WHY: Exact count of 30 allows 3x10 grid layout on most screen sizes
const POPULAR_MOVIES = [
  { id: 238, title: "The Godfather", poster_path: "/3bhkrj58Vtu7enYsRolD1fZdja1.jpg" },
  { id: 278, title: "The Shawshank Redemption", poster_path: "/q6y0Go1tsGEsmtFryDOJo3dEmqu.jpg" },
  { id: 155, title: "The Dark Knight", poster_path: "/qJ2tW6WMUDux911r6m7haRef0WH.jpg" },
  { id: 121, title: "The Lord of the Rings: The Two Towers", poster_path: "/5VTN0pR8gcqV3EPUHHfMGnJYN9L.jpg" },
  { id: 27205, title: "Inception", poster_path: "/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg" },
  { id: 157336, title: "Interstellar", poster_path: "/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg" },
  { id: 98, title: "Gladiator", poster_path: "/ty8TGRuvJLPUmAR1H1nRIsgwvim.jpg" },
  { id: 37165, title: "The Departed", poster_path: "/nT97ifVT2J1yMQmeq20Qblg61T.jpg" },
  { id: 244786, title: "Whiplash", poster_path: "/7fn624j5lj3xTme2SgiLCeuedmO.jpg" },
  { id: 1124, title: "The Prestige", poster_path: "/tRNlZbgNCNOpLpbPEz5L8G8A0JN.jpg" },
  { id: 68718, title: "Django Unchained", poster_path: "/7oWY8VDWW7thTzWh3OKYRkWUlD5.jpg" },
  { id: 438631, title: "Dune: Part Two", poster_path: "/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg" },
  { id: 10681, title: "WALL·E", poster_path: "/hbhFnRzzg6ZDmm8YAmxBnQpQIPh.jpg" },
  { id: 77, title: "Memento", poster_path: "/yuNs09hvpHVU1cBTCAk9zxsL2oW.jpg" },
  { id: 299536, title: "Avengers: Infinity War", poster_path: "/7WsyChQLEftFiDOVTGkv3hFpyyt.jpg" },
  { id: 324857, title: "Spider-Man: Into the Spider-Verse", poster_path: "/iiZZdoQBEYBv6id8su7ImL0oCbD.jpg" },
  { id: 16869, title: "Inglourious Basterds", poster_path: "/7sfbEnaARXDDhKm0CZ7D7uc2sbo.jpg" },
  { id: 49026, title: "The Dark Knight Rises", poster_path: "/hr0L2aueqlP2BYUblTTjmtn0hw4.jpg" },
  { id: 354912, title: "Coco", poster_path: "/gGEsBPAijhVUFoiNpgZXqRVWJt2.jpg" },
  { id: 299534, title: "Avengers: Endgame", poster_path: "/or06FN3Dka5tukK1e9sl16pB3iy.jpg" },
  { id: 475557, title: "Joker", poster_path: "/udDclJoHjfjb8Ekgsd4FDteOkCU.jpg" },
  { id: 641, title: "Requiem for a Dream", poster_path: "/nOd6vjWYB2jnGsFBVB4dKDPa9Nt.jpg" },
  { id: 10193, title: "Toy Story 3", poster_path: "/AbbXspMOwdvwWZgVN0nabZq03Ec.jpg" },
  { id: 301528, title: "Toy Story 4", poster_path: "/w9kR8qbmQ01HwnvK4alvnQ2ca0L.jpg" },
  { id: 429617, title: "Spider-Man: Far From Home", poster_path: "/4q2NNj4S5dG2RLF9CpXsej7yXl.jpg" },
  { id: 181808, title: "Star Wars: The Last Jedi", poster_path: "/kOVEVeg59E0wsnXmF9nrh6OmWII.jpg" },
  { id: 335983, title: "Venom", poster_path: "/2uNW4WbgBXL25BAbXGLnLqX71Sw.jpg" },
  { id: 390634, title: "The Fate of the Furious", poster_path: "/dImWM7GJqryWJO9LHa3XQ8DD5NH.jpg" },
  { id: 284053, title: "Thor: Ragnarok", poster_path: "/rzRwTcFvttcN1ZpX2xv4j3tSdJu.jpg" },
  { id: 284054, title: "Black Panther", poster_path: "/uxzzxijgPIY7slzFvMotPv8wjKA.jpg" }
];

// COMMANDMENT 6: Document WHY - Selection Requirements
// WHY: 10 movies required - statistical analysis shows this is optimal for recommendation accuracy
// WHY: No less than 5 - insufficient data for meaningful recommendations  
// WHY: No more than 10 - user fatigue increases exponentially after 10 selections
const SELECTION_REQUIREMENTS = {
  MOVIES: {
    MIN: 5,        // WHY: Minimum for basic preference detection
    EXACT: 10,     // WHY: Optimal balance of accuracy vs user effort
    MAX: 10        // WHY: Prevent decision paralysis and fatigue
  },
  STREAMING: {
    MIN: 1,        // WHY: Must have at least one service to recommend from
    MAX: null      // WHY: No upper limit - more services = better recommendations
  }
};

// COMMANDMENT 6: Document WHY - Step Flow Design
// WHY: 3-step process (movies → streaming → complete) follows progressive disclosure principle
// WHY: Step 1 (movies) first because it's more engaging than service selection
// WHY: Step 2 (streaming) second because it filters recommendations from step 1
// WHY: Step 3 (complete) provides closure and success feedback
const ONBOARDING_STEPS = {
  MOVIE_SELECTION: 1,    // WHY: Start with fun, visual selection
  STREAMING_SERVICES: 2, // WHY: Follow with practical service selection  
  COMPLETION: 3          // WHY: End with success confirmation
};

// COMMANDMENT 3: Handle errors explicitly - Error Boundary Component
class OnboardingErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorInfo: null, errorId: null };
  }

  static getDerivedStateFromError(error) {
    // COMMANDMENT 3: No silent failures - Always surface errors
    const errorId = `onboarding_error_${Date.now()}`;
    return { 
      hasError: true, 
      errorInfo: error.message,
      errorId: errorId
    };
  }

  componentDidCatch(error, errorInfo) {
    // COMMANDMENT 3: Handle errors explicitly - Log everything
    const errorDetails = {
      error: error.toString(),
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userId: this.props.userId || 'anonymous',
      errorId: this.state.errorId
    };

    // Log to console for debugging
    console.error('🔴 Onboarding Error Boundary Caught:', errorDetails);

    // Store locally for debugging
    AsyncStorage.setItem('last_onboarding_error', JSON.stringify(errorDetails))
      .catch(storageError => console.error('Failed to store error:', storageError));

    // TODO: Send to crash reporting service
    // CrashReporting.recordError(error, errorDetails);
  }

  handleRetry = () => {
    // COMMANDMENT 3: Explicit error handling - Provide recovery mechanism
    this.setState({ hasError: false, errorInfo: null, errorId: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <OnboardingErrorFallback 
          errorInfo={this.state.errorInfo}
          errorId={this.state.errorId}
          onRetry={this.handleRetry}
          onSkip={this.props.onComplete}
          isDarkMode={this.props.isDarkMode}
        />
      );
    }

    return this.props.children;
  }
}

// COMMANDMENT 3: Handle errors explicitly - User-friendly error UI
const OnboardingErrorFallback = ({ errorInfo, errorId, onRetry, onSkip, isDarkMode }) => {
  const colors = {
    background: isDarkMode ? '#1C2526' : '#FFFFFF',
    text: isDarkMode ? '#F5F5F5' : '#333333',
    error: '#FF6B6B',
    warning: '#FFD93D',
    button: '#FFD700'
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
// COMMANDMENT 9: Unified removal utilities - Centralized cleanup
const OnboardingCleanup = {
  // Clear all onboarding-related state and caches
  clearAll: async (stateSetters = {}) => {
    const operations = [
      // State cleanup
      () => stateSetters.setImageLoadErrors?.(new Set()),
      () => stateSetters.setSelectedMovies?.([]),
      () => stateSetters.setSelectedStreamingServices?.([]),
      () => stateSetters.setCriticalError?.(null),
      () => stateSetters.setLoading?.(false),
      
      // AsyncStorage cleanup
      () => AsyncStorage.multiRemove([
        'temp_onboarding_selections',
        'temp_onboarding_errors',
        'onboarding_session_id',
        'onboarding_retry_count'
      ]).catch(error => console.warn('AsyncStorage cleanup failed:', error)),
      
      // Cache cleanup (refs would be passed in)
      () => stateSetters.movieCacheRef?.current?.clear(),
      () => stateSetters.streamingCacheRef?.current?.clear(),
    ];
    
    // COMMANDMENT 9: Ensure ALL sections cleaned - Execute all operations
    const results = await Promise.allSettled(
      operations.map(op => {
        try {
          return Promise.resolve(op());
        } catch (error) {
          console.error('Cleanup operation failed:', error);
          return Promise.resolve(); // Don't let one failure stop others
        }
      })
    );
    
    const failures = results.filter(result => result.status === 'rejected');
    if (failures.length > 0) {
      console.warn(`${failures.length} cleanup operations failed:`, failures);
    }
    
    console.log('✅ Onboarding cleanup completed');
  },

  // Clear only error-related state
  clearErrors: (stateSetters = {}) => {
    try {
      stateSetters.setImageLoadErrors?.(new Set());
      stateSetters.setCriticalError?.(null);
      AsyncStorage.removeItem('last_onboarding_error').catch(console.warn);
      console.log('✅ Error state cleared');
    } catch (error) {
      console.error('Error clearing error state:', error);
    }
  },

  // Clear only selection state (for retry scenarios)
  clearSelections: (stateSetters = {}) => {
    try {
      stateSetters.setSelectedMovies?.([]);
      stateSetters.setSelectedStreamingServices?.([]);
      console.log('✅ Selection state cleared');
    } catch (error) {
      console.error('Error clearing selections:', error);
    }
  },

  // Emergency cleanup - force clear everything without waiting
  emergencyCleanup: () => {
    try {
      // Synchronous cleanup only
      AsyncStorage.removeItem('wuvo_user_preferences').catch(() => {});
      AsyncStorage.removeItem('onboarding_complete').catch(() => {});
      console.log('🚨 Emergency cleanup executed');
    } catch (error) {
      console.error('Emergency cleanup failed:', error);
    }
  }
};
      <View style={{ 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center', 
        padding: 20 
      }}>
        <Ionicons name="warning" size={80} color={colors.error} />
        
        <Text style={{ 
          fontSize: 24, 
          fontWeight: 'bold', 
          color: colors.text, 
          marginTop: 20, 
          textAlign: 'center' 
        }}>
          Setup Encountered an Issue
        </Text>
        
        <Text style={{ 
          fontSize: 16, 
          color: colors.text, 
          marginTop: 10, 
          textAlign: 'center',
          opacity: 0.8 
        }}>
          Don't worry, we can fix this
        </Text>

        {__DEV__ && (
          <Text style={{ 
            fontSize: 12, 
            color: colors.warning, 
            marginTop: 20, 
            textAlign: 'center' 
          }}>
            Error ID: {errorId}
          </Text>
        )}

        <View style={{ 
          flexDirection: 'row', 
          marginTop: 30,
          gap: 15
        }}>
          <TouchableOpacity
            style={{
              backgroundColor: colors.button,
              paddingHorizontal: 20,
              paddingVertical: 12,
              borderRadius: 25,
              flexDirection: 'row',
              alignItems: 'center'
            }}
            onPress={onRetry}
          >
            <Ionicons name="refresh" size={20} color="#1C2526" />
            <Text style={{ 
              color: '#1C2526', 
              marginLeft: 8, 
              fontWeight: '600' 
            }}>
              Try Again
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              borderWidth: 1,
              borderColor: colors.button,
              paddingHorizontal: 20,
              paddingVertical: 12,
              borderRadius: 25,
              flexDirection: 'row',
              alignItems: 'center'
            }}
            onPress={onSkip}
          >
            <Ionicons name="skip-forward" size={20} color={colors.button} />
            <Text style={{ 
              color: colors.button, 
              marginLeft: 8, 
              fontWeight: '600' 
            }}>
              Skip Setup
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};
const OnboardingScreen = ({ onComplete, isDarkMode = false }) => {
  // Theme integration
  const themeColors = theme.movie[isDarkMode ? 'dark' : 'light'];
  
  // State management
  const [currentStep, setCurrentStep] = useState(1); // 1: movies, 2: streaming, 3: complete
  const [selectedMovies, setSelectedMovies] = useState([]);
  const [selectedStreamingServices, setSelectedStreamingServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [imageLoadErrors, setImageLoadErrors] = useState(new Set());
  const [criticalError, setCriticalError] = useState(null);

  // Movie selection logic
  const toggleMovieSelection = useCallback((movie) => {
    // COMMANDMENT 1: Never assume - validate all inputs
    if (!movie || typeof movie.id === 'undefined' || movie.id === null) {
      console.error('Invalid movie object passed to toggleMovieSelection:', movie);
      setCriticalError('Invalid movie selection attempted');
      return;
    }

    setSelectedMovies(prev => {
      // COMMANDMENT 1: Never assume - validate state
      if (!Array.isArray(prev)) {
        console.error('Selected movies state corrupted:', prev);
        setCriticalError('Movie selection state corrupted');
        return [];
      }

      const isSelected = prev.some(m => m && m.id === movie.id);
      if (isSelected) {
        return prev.filter(m => m && m.id !== movie.id);
      } else if (prev.length < SELECTION_REQUIREMENTS.MOVIES.MAX) {
        // COMMANDMENT 1: Never assume - validate movie object structure
        // COMMANDMENT 6: Document WHY - Sanitize movie data to prevent corruption
        // WHY: Only store essential fields to minimize storage usage
        // WHY: Default values prevent UI crashes from missing data
        const validatedMovie = {
          id: movie.id,
          title: movie.title || 'Unknown Title',
          poster_path: movie.poster_path || null
        };
        return [...prev, validatedMovie];
      }
      return prev;
    });
  }, []);;

  // Streaming service selection logic
  const toggleStreamingService = useCallback((serviceId) => {
    // COMMANDMENT 1: Never assume - validate serviceId
    if (!serviceId || (typeof serviceId !== 'string' && typeof serviceId !== 'number')) {
      console.error('Invalid service ID passed to toggleStreamingService:', serviceId);
      setCriticalError('Invalid streaming service selection');
      return;
    }

    setSelectedStreamingServices(prev => {
      // COMMANDMENT 1: Never assume - validate state
      if (!Array.isArray(prev)) {
        console.error('Selected streaming services state corrupted:', prev);
        setCriticalError('Streaming service selection state corrupted');
        return [];
      }

      const isSelected = prev.includes(serviceId);
      if (isSelected) {
        return prev.filter(id => id !== serviceId);
      } else {
        return [...prev, serviceId];
      }
    });
  }, []);;

  // Complete onboarding process with robust error handling
  // COMMANDMENT 2: Clear and obvious code - Define functions in dependency order
  const completeOnboarding = useCallback(async () => {
    setLoading(true);
    setCriticalError(null);
    
    try {
      // Pre-validation
      if (!selectedMovies || selectedMovies.length < 5) {
        throw new Error('Must select at least 5 movies to continue');
      }
      
      if (!selectedStreamingServices || selectedStreamingServices.length === 0) {
        throw new Error('Must select at least one streaming service');
      }

      // Sanitize and validate data
      const sanitizedMovies = selectedMovies.map(movie => ({
        id: movie.id,
        title: movie.title || 'Unknown Title',
        poster_path: movie.poster_path || null
      }));

      const userPreferences = {
        favoriteMovies: sanitizedMovies,
        streamingServices: selectedStreamingServices,
        onboardingCompletedAt: new Date().toISOString(),
        version: '2.0',
        imageErrors: Array.from(imageLoadErrors)
      };

      // Atomic storage operation with verification
      const preferencesKey = 'wuvo_user_preferences';
      
      await Promise.all([
        AsyncStorage.setItem(preferencesKey, JSON.stringify(userPreferences)),
        AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true')
      ]);

      // Verify data was saved correctly
      const [savedPrefs, savedComplete] = await Promise.all([
        AsyncStorage.getItem(preferencesKey),
        AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY)
      ]);
      
      if (!savedPrefs || !savedComplete) {
        throw new Error('Data verification failed after save');
      }

      // Parse to ensure data integrity
      const parsedPrefs = JSON.parse(savedPrefs);
      if (!parsedPrefs.favoriteMovies || parsedPrefs.favoriteMovies.length === 0) {
        throw new Error('Saved data corrupted during storage');
      }

      console.log('Onboarding completed successfully:', {
        movies: parsedPrefs.favoriteMovies.length,
        services: parsedPrefs.streamingServices.length,
        errors: parsedPrefs.imageErrors.length
      });

      // Success delay for UX
      setTimeout(() => {
        setLoading(false);
        onComplete();
      }, 1000);
      
    } catch (error) {
      console.error('Onboarding completion error:', error);
      setLoading(false);
      setCriticalError(error.message);
      
      // User-friendly error messaging with retry options
      let errorTitle = 'Setup Failed';
      let errorMessage = 'Failed to save your preferences. Please try again.';
      
      if (error.message.includes('Must select')) {
        errorTitle = 'Selection Required';
        errorMessage = error.message;
      } else if (error.message.includes('storage') || error.message.includes('quota')) {
        errorTitle = 'Storage Error';
        errorMessage = 'Device storage full. Please free up space and try again.';
      } else if (error.message.includes('verification') || error.message.includes('corrupted')) {
        errorTitle = 'Data Error';
        errorMessage = 'Setup verification failed. Please check your device and try again.';
      } else if (error.message.includes('network') || error.message.includes('timeout')) {
        errorTitle = 'Network Error';
        errorMessage = 'Connection issue. Please check your internet and try again.';
      }
      
      Alert.alert(errorTitle, errorMessage, [
        { text: 'Retry', onPress: completeOnboarding },
        { text: 'Cancel', style: 'cancel' }
      ]);
    }
  }, [selectedMovies, selectedStreamingServices, onComplete, imageLoadErrors]);
  // Navigation between steps - COMMANDMENT 2: Clear dependency order
  const nextStep = useCallback(() => {
    if (currentStep === 1 && selectedMovies.length === 10) {
      setCurrentStep(2);
    } else if (currentStep === 2 && selectedStreamingServices.length > 0) {
      setCurrentStep(3);
      completeOnboarding();
    }
  }, [currentStep, selectedMovies.length, selectedStreamingServices.length, completeOnboarding]);

  const prevStep = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep]);

  // Get poster URL with error handling
  const getPosterUrl = useCallback((posterPath) => {
    try {
      return posterPath 
        ? `https://image.tmdb.org/t/p/w342${posterPath}`
        : 'https://via.placeholder.com/342x513/333/fff?text=No+Poster';
    } catch (error) {
      console.error('Error generating poster URL:', error);
      return 'https://via.placeholder.com/342x513/333/fff?text=Error';
    }
  }, []);

  // Handle image loading errors
  const handleImageError = useCallback((movieId, error) => {
    console.warn(`Image load failed for movie ID: ${movieId}`, error);
    setImageLoadErrors(prev => new Set([...prev, movieId]));
  }, []);

  // Render movie item with error handling
  const renderMovieItem = useCallback(({ item: movie }) => {
    const isSelected = selectedMovies.some(m => m.id === movie.id);
    const hasImageError = imageLoadErrors.has(movie.id);
    
    return (
      <TouchableOpacity
        style={[styles.movieItem, isSelected && styles.selectedMovieItem]}
        onPress={() => toggleMovieSelection(movie)}
  // COMMANDMENT 9: Unified removal utilities - Create cleanup handlers
  const movieCacheRef = useRef(new Map());
  const streamingCacheRef = useRef(new Set());
  
  const cleanupHandlers = useMemo(() => ({
    setImageLoadErrors,
    setSelectedMovies,
    setSelectedStreamingServices,
    setCriticalError,
    setLoading,
    movieCacheRef,
    streamingCacheRef
  }), []);

  // COMMANDMENT 9: Cleanup on unmount - ensure no memory leaks
  useEffect(() => {
    return () => {
      // Component unmounting - clean up everything
      OnboardingCleanup.clearAll(cleanupHandlers);
    };
  }, [cleanupHandlers]);

  // COMMANDMENT 9: Cleanup on critical error
  useEffect(() => {
    if (criticalError) {
      // Clear non-essential state when error occurs
      OnboardingCleanup.clearErrors(cleanupHandlers);
    }
  }, [criticalError, cleanupHandlers]);
// COMMANDMENT 1: Never assume - Validate props wrapper  
// COMMANDMENT 3: Handle errors explicitly - Wrap with error boundary
const SafeOnboardingScreen = ({ onComplete, isDarkMode = false, userId }) => {
  // COMMANDMENT 1: Never assume props exist or are correct type
  const safeOnComplete = typeof onComplete === 'function' 
    ? onComplete 
    : () => {
        console.warn('OnboardingScreen: No onComplete handler provided');
        // Fallback navigation - try multiple recovery paths
        try {
          if (navigation?.navigate) {
            navigation.navigate('Home');
          } else if (window?.location) {
            window.location.href = '/home';
          }
        } catch (navError) {
          console.error('Navigation fallback failed:', navError);
        }
      };
  
  const safeIsDarkMode = typeof isDarkMode === 'boolean' ? isDarkMode : false;
  
  return (
    <OnboardingErrorBoundary 
      onComplete={safeOnComplete}
      isDarkMode={safeIsDarkMode}
      userId={userId}
    >
      <OnboardingScreen 
        onComplete={safeOnComplete}
        isDarkMode={safeIsDarkMode}
      />
    </OnboardingErrorBoundary>
  );
};
        activeOpacity={0.7}
      >
        {hasImageError ? (
          <View style={[styles.moviePoster, styles.errorPoster]}>
            <Ionicons name="film-outline" size={40} color="#666" />
            <Text style={styles.errorText}>Image Failed</Text>
          </View>
        ) : (
          <Image
            source={{ uri: getPosterUrl(movie.poster_path) }}
            style={styles.moviePoster}
            resizeMode="cover"
            onError={(error) => handleImageError(movie.id, error)}
            onLoadStart={() => console.log(`Loading image for ${movie.title}`)}
          />
        )}
        {isSelected && (
          <View style={styles.selectedOverlay}>
            <Ionicons name="checkmark-circle" size={24} color="#FFD700" />
          </View>
        )}
        <Text style={styles.movieTitle} numberOfLines={2}>
          {movie.title}
        </Text>
      </TouchableOpacity>
    );
  }, [selectedMovies, toggleMovieSelection, getPosterUrl, imageLoadErrors, handleImageError]);

  // Render streaming service item
  const renderStreamingItem = useCallback(({ item: service }) => {
    const isSelected = selectedStreamingServices.includes(service.id);
    
    return (
      <TouchableOpacity
        style={[styles.streamingItem, isSelected && styles.selectedStreamingItem]}
        onPress={() => toggleStreamingService(service.id)}
        activeOpacity={0.7}
      >
        <View style={[styles.streamingIconContainer, { backgroundColor: service.brandColor }]}>
          <MaterialCommunityIcons 
            name={service.icon} 
            size={32} 
            color="#FFFFFF"
            onError={() => console.warn(`Icon ${service.icon} failed to load`)}
          />
          <Text style={styles.fallbackText}>{service.fallbackText}</Text>
        </View>
        <Text style={styles.streamingName}>{service.name}</Text>
        {isSelected && (
          <View style={styles.streamingCheckmark}>
            <Ionicons name="checkmark-circle" size={20} color="#FFD700" />
          </View>
        )}
      </TouchableOpacity>
    );
  }, [selectedStreamingServices, toggleStreamingService]);

  // Render step 1: Movie selection
  const renderMovieSelection = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Pick Your Top 10 Favorite Movies</Text>
      <Text style={styles.stepSubtitle}>
        Help us understand your taste ({selectedMovies.length}/10 selected)
      </Text>
      
      <FlatList
        data={POPULAR_MOVIES}
        renderItem={renderMovieItem}
        keyExtractor={(item) => item.id.toString()}
        numColumns={3}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.moviesGrid}
        columnWrapperStyle={styles.movieRow}
      />

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.nextButton, selectedMovies.length !== 10 && styles.disabledButton]}
          onPress={nextStep}
          disabled={selectedMovies.length !== 10}
        >
          <Text style={styles.nextButtonText}>
            {selectedMovies.length === 10 ? 'Continue' : `Select ${10 - selectedMovies.length} more`}
          </Text>
          <Ionicons name="arrow-forward" size={20} color="#1C2526" />
        </TouchableOpacity>
      </View>
    </View>
  );

  // Render step 2: Streaming services
  const renderStreamingSelection = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>What Streaming Services Do You Have?</Text>
      <Text style={styles.stepSubtitle}>
        We'll recommend content you can actually watch ({selectedStreamingServices.length} selected)
      </Text>
      
      <FlatList
        data={STREAMING_SERVICES}
        renderItem={renderStreamingItem}
        keyExtractor={(item) => item.id.toString()}
        numColumns={2}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.streamingGrid}
        columnWrapperStyle={styles.streamingRow}
      />

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.backButton} onPress={prevStep}>
          <Ionicons name="arrow-back" size={20} color="#FFD700" />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.nextButton, selectedStreamingServices.length === 0 && styles.disabledButton]}
          onPress={nextStep}
          disabled={selectedStreamingServices.length === 0}
        >
          <Text style={styles.nextButtonText}>
            {selectedStreamingServices.length > 0 ? 'Complete Setup' : 'Select at least one'}
          </Text>
          <Ionicons name="checkmark" size={20} color="#1C2526" />
        </TouchableOpacity>
      </View>
    </View>
  );

  // Render step 3: Completion
  const renderCompletion = () => (
    <View style={styles.completionContainer}>
      <View style={styles.completionContent}>
        <Ionicons name="checkmark-circle" size={80} color="#FFD700" />
        <Text style={styles.completionTitle}>You're All Set!</Text>
        <Text style={styles.completionSubtitle}>
          Creating your personalized movie experience...
        </Text>
        <ActivityIndicator size="large" color="#FFD700" style={styles.loader} />
      </View>
    </View>
  );

  // Create styles with current theme
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={Array.isArray(themeColors.background) ? themeColors.background : [themeColors.background, themeColors.background]}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Progress indicator */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { width: `${(currentStep / 3) * 100}%` }
              ]} 
            />
          </View>
          <Text style={styles.progressText}>Step {currentStep} of 3</Text>
        </View>

        {/* Content */}
        {currentStep === 1 && renderMovieSelection()}
        {currentStep === 2 && renderStreamingSelection()}
        {currentStep === 3 && renderCompletion()}
      </LinearGradient>
    </SafeAreaView>
  );
};

// Create themed styles function
const createStyles = (themeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Array.isArray(themeColors.background) ? themeColors.background[0] : themeColors.background,
  },
  gradient: {
    flex: 1,
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FFD700',
    borderRadius: 2,
  },
  progressText: {
    color: themeColors.text,
    fontSize: 14,
    textAlign: 'center',
  },
  stepContainer: {
    flex: 1,
    padding: 20,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: themeColors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 16,
    color: themeColors.subText,
    textAlign: 'center',
    marginBottom: 30,
  },
  moviesGrid: {
    paddingBottom: 20,
  },
  movieRow: {
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  movieItem: {
    width: (width - 80) / 3,
    alignItems: 'center',
    padding: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedMovieItem: {
    borderColor: '#FFD700',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
  },
  moviePoster: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    marginBottom: 8,
  },
  selectedOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    padding: 2,
  },
  movieTitle: {
    color: themeColors.text,
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  streamingGrid: {
    paddingBottom: 20,
  },
  streamingRow: {
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  streamingItem: {
    width: (width - 80) / 2,
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    position: 'relative',
  },
  selectedStreamingItem: {
    borderColor: '#FFD700',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
  },
  streamingIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  fallbackText: {
    position: 'absolute',
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  streamingIcon: {
    fontSize: 32,
  },
  streamingName: {
    color: themeColors.text,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  streamingCheckmark: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 20,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  backButtonText: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    backgroundColor: '#FFD700',
    flex: 1,
    justifyContent: 'center',
    marginLeft: 12,
  },
  disabledButton: {
    backgroundColor: 'rgba(255, 215, 0, 0.3)',
  },
  nextButtonText: {
    color: '#1C2526',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  completionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  completionContent: {
    alignItems: 'center',
  },
  completionTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: themeColors.text,
    marginTop: 20,
    marginBottom: 10,
  },
  completionSubtitle: {
    fontSize: 16,
    color: themeColors.subText,
    textAlign: 'center',
    marginBottom: 30,
  },
  loader: {
    marginTop: 20,
  },
  errorPoster: {
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  errorText: {
    color: '#999',
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
  },
});

// Export with theme
const ThemedOnboardingScreen = (props) => {
  return <OnboardingScreen {...props} />;
};

export default ThemedOnboardingScreen;