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
  FlatList,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useMediaType } from '../Navigation/TabNavigator';
import { ThemedHeader } from '../Styles/headerStyles';
import { getLayoutStyles } from '../Styles/layoutStyles';
import { getHeaderStyles } from '../Styles/headerStyles';
import { getListStyles } from '../Styles/listStyles';
import { getButtonStyles } from '../Styles/buttonStyles';
import { getMovieCardStyles } from '../Styles/movieCardStyles';
import stateStyles from '../Styles/StateStyles';
import theme from '../utils/Theme';

const { width } = Dimensions.get('window');
const POSTER_SIZE = (width - 60) / 3; // 3 columns with spacing

// Mock user movie data - in real app this would come from API
const mockUserMovies = [
  { 
    id: 1, 
    title: 'The Shawshank Redemption', 
    userRating: 9.2, 
    poster_path: '/q6y0Go1tsGEsmtFryDOJo3dEmqu.jpg',
    genres: [18], // Drama
    release_date: '1994-09-23'
  },
  { 
    id: 2, 
    title: 'The Godfather', 
    userRating: 9.0, 
    poster_path: '/3bhkrj58Vtu7enYsRolD1fZdja1.jpg',
    genres: [80, 18], // Crime, Drama
    release_date: '1972-03-14'
  },
  { 
    id: 3, 
    title: 'The Dark Knight', 
    userRating: 8.8, 
    poster_path: '/qJ2tW6WMUDux911r6m7haRef0WH.jpg',
    genres: [28, 80], // Action, Crime
    release_date: '2008-07-18'
  },
  { 
    id: 4, 
    title: 'Pulp Fiction', 
    userRating: 8.5, 
    poster_path: '/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg',
    genres: [80, 18], // Crime, Drama
    release_date: '1994-10-14'
  },
  { 
    id: 5, 
    title: 'Forrest Gump', 
    userRating: 8.3, 
    poster_path: '/arw2vcBveWOVZr6pxd9XTd1TdQa.jpg',
    genres: [18, 10749], // Drama, Romance
    release_date: '1994-06-23'
  }
];

const UserProfileScreen = ({ route, navigation, isDarkMode = false, genres = {} }) => {
  const { user } = route.params;
  const { mediaType } = useMediaType();
  
  // Use same styling system as ProfileScreen
  const layoutStyles = getLayoutStyles(mediaType, isDarkMode ? 'dark' : 'light', theme);
  const headerStyles = getHeaderStyles(mediaType, isDarkMode ? 'dark' : 'light', theme);
  const listStyles = getListStyles(mediaType, isDarkMode ? 'dark' : 'light', theme);
  const buttonStyles = getButtonStyles(mediaType, isDarkMode ? 'dark' : 'light', theme);
  const movieCardStyles = getMovieCardStyles(mediaType, isDarkMode ? 'dark' : 'light', theme);
  const colors = theme[mediaType][isDarkMode ? 'dark' : 'light'];
  
  // State management following ProfileScreen pattern
  const [selectedTab, setSelectedTab] = useState('toprated');
  const [userMovies, setUserMovies] = useState([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedGenreId, setSelectedGenreId] = useState(null);

  // Helper function to get poster URL (following existing pattern)
  const getPosterUrl = (poster_path) => {
    if (!poster_path) return 'https://via.placeholder.com/300x450?text=No+Image';
    if (poster_path.startsWith('http')) return poster_path;
    return `https://image.tmdb.org/t/p/w500${poster_path}`;
  };

  // Simulate loading user data
  useEffect(() => {
    const loadUserData = async () => {
      try {
        setIsLoading(true);
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Load mock user movies
        setUserMovies(mockUserMovies);
        
        // Simulate checking follow status
        setIsFollowing(Math.random() > 0.5);
      } catch (error) {
        console.error('Error loading user data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadUserData();
  }, [user.id]);

  // Follow/unfollow functionality
  const handleFollowToggle = useCallback(async () => {
    try {
      setIsFollowing(!isFollowing);
      // Here you would make API call to follow/unfollow
      console.log(`${isFollowing ? 'Unfollowed' : 'Followed'} user:`, user.username);
    } catch (error) {
      console.error('Error toggling follow status:', error);
    }
  }, [isFollowing, user.username]);

  // Filter and rank movies (following ProfileScreen pattern)
  const filteredAndRankedMovies = useMemo(() => {
    let filtered = userMovies;
    
    // Filter by selected genre if any
    if (selectedGenreId !== null) {
      filtered = userMovies.filter(movie => 
        movie.genres && movie.genres.includes(selectedGenreId)
      );
    }
    
    // Filter for top rated (7.5+) for toprated tab
    if (selectedTab === 'toprated') {
      filtered = filtered.filter(movie => movie.userRating >= 7.5);
    }
    
    // Sort by rating descending
    return filtered.sort((a, b) => (b.userRating || 0) - (a.userRating || 0));
  }, [userMovies, selectedGenreId, selectedTab]);

  // Get unique genre IDs for filter buttons
  const uniqueGenreIds = useMemo(() => {
    const genreIds = new Set();
    userMovies.forEach(movie => {
      if (movie.genres) {
        movie.genres.forEach(genreId => genreIds.add(genreId));
      }
    });
    return Array.from(genreIds);
  }, [userMovies]);

  // Genre selection handler
  const handleGenreSelect = useCallback((genreId) => {
    setSelectedGenreId(selectedGenreId === genreId ? null : genreId);
  }, [selectedGenreId]);

  // Tab selection handler
  const handleTabPress = useCallback((tab) => {
    setSelectedTab(tab);
    setSelectedGenreId(null); // Reset genre filter when switching tabs
  }, []);

  // Render genre filter button (following ProfileScreen pattern)
  const renderGenreButton = useCallback(({ item: genreId }) => {
    const isSelected = selectedGenreId === genreId;
    const genreName = genres[genreId] || `Genre ${genreId}`;
    
    return (
      <TouchableOpacity
        style={[
          profileStyles.genreButton,
          { 
            backgroundColor: isSelected ? colors.accent : colors.card,
            borderColor: colors.accent 
          }
        ]}
        onPress={() => handleGenreSelect(genreId)}
      >
        <Text style={[
          profileStyles.genreButtonText,
          { color: isSelected ? colors.background : colors.accent }
        ]}>
          {genreName}
        </Text>
      </TouchableOpacity>
    );
  }, [selectedGenreId, genres, colors, handleGenreSelect]);

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <ThemedHeader isDarkMode={isDarkMode} theme={theme}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            @{user.username}
          </Text>
          <View style={styles.placeholder} />
        </ThemedHeader>
        
        <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.loadingText, { color: colors.subText }]}>
            Loading profile...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ThemedHeader isDarkMode={isDarkMode} theme={theme}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()} 
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          @{user.username}
        </Text>
        <View style={styles.placeholder} />
      </ThemedHeader>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* User Profile Info Header */}
        <View style={styles.profileHeader}>
          <View style={styles.userInfoSection}>
            <Image
              source={{ uri: user.profilePicture }}
              style={[styles.profilePicture, { borderColor: colors.accent }]}
            />
            <View style={styles.userDetails}>
              <Text style={[styles.displayName, { color: colors.text }]}>
                {user.displayName}
              </Text>
              <Text style={[styles.username, { color: colors.subText }]}>
                @{user.username}
              </Text>
            </View>
          </View>

          {/* Stats Row (following ProfileScreen pattern) */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: colors.accent }]}>
                {user.ratingCount || 0}
              </Text>
              <Text style={[styles.statLabel, { color: colors.subText }]}>
                ratings
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: colors.accent }]}>
                {user.followerCount || 0}
              </Text>
              <Text style={[styles.statLabel, { color: colors.subText }]}>
                followers
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: colors.accent }]}>
                {filteredAndRankedMovies.length}
              </Text>
              <Text style={[styles.statLabel, { color: colors.subText }]}>
                top rated
              </Text>
            </View>
          </View>

          {/* Follow Button */}
          <TouchableOpacity
            style={[
              styles.followButton,
              {
                backgroundColor: isFollowing ? colors.card : colors.accent,
                borderColor: colors.accent
              }
            ]}
            onPress={handleFollowToggle}
          >
            <Text style={[
              styles.followButtonText,
              { color: isFollowing ? colors.accent : colors.background }
            ]}>
              {isFollowing ? 'Following' : 'Follow'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content Tabs (following ProfileScreen pattern) */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[
              styles.tab,
              selectedTab === 'toprated' && { borderBottomColor: colors.accent, borderBottomWidth: 2 }
            ]}
            onPress={() => handleTabPress('toprated')}
          >
            <Text style={[
              styles.tabText,
              { color: selectedTab === 'toprated' ? colors.accent : colors.subText }
            ]}>
              Top Rated
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tab,
              selectedTab === 'recent' && { borderBottomColor: colors.accent, borderBottomWidth: 2 }
            ]}
            onPress={() => handleTabPress('recent')}
          >
            <Text style={[
              styles.tabText,
              { color: selectedTab === 'recent' ? colors.accent : colors.subText }
            ]}>
              Recent Activity
            </Text>
          </TouchableOpacity>
        </View>

        {/* Genre Filter (when on toprated tab) */}
        {selectedTab === 'toprated' && uniqueGenreIds.length > 0 && (
          <View style={profileStyles.genreFilterContainer}>
            <FlatList
              data={uniqueGenreIds}
              renderItem={renderGenreButton}
              keyExtractor={(item) => item.toString()}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={profileStyles.genreList}
            />
            
            {selectedGenreId !== null && (
              <View style={profileStyles.activeFilterIndicator}>
                <Text style={[profileStyles.activeFilterText, { color: colors.subText }]}>
                  Showing: {genres[selectedGenreId] || 'Unknown'} movies
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Movies List */}
        {filteredAndRankedMovies.length > 0 ? (
          <ScrollView style={[listStyles.rankingsList, { backgroundColor: colors.background }]}>
            {filteredAndRankedMovies.map((movie, index) => (
              <View
                key={movie.id}
                style={[listStyles.rankingItem, { backgroundColor: colors.card }]}
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
                  source={{ uri: getPosterUrl(movie.poster_path) }}
                  style={listStyles.resultPoster}
                />
                <View style={[listStyles.movieDetails, { flexDirection: 'row' }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[listStyles.resultTitle, { color: colors.text }]} numberOfLines={2}>
                      {movie.title}
                    </Text>
                    <View style={listStyles.scoreContainer}>
                      <Ionicons name="star" size={16} color={colors.accent} />
                      <Text style={[listStyles.score, { color: colors.accent }]}>
                        {movie.userRating}/10
                      </Text>
                    </View>
                    {movie.genres && movie.genres.length > 0 && (
                      <Text style={[listStyles.genres, { color: colors.subText }]} numberOfLines={1}>
                        {movie.genres.map(genreId => genres[genreId] || `Genre ${genreId}`).join(', ')}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>
        ) : (
          <View style={[stateStyles.emptyStateContainer, { backgroundColor: colors.background }]}>
            <Ionicons 
              name={selectedTab === 'toprated' ? 'star-outline' : 'time-outline'} 
              size={48} 
              color={colors.subText} 
            />
            <Text style={[stateStyles.emptyStateText, { color: colors.subText }]}>
              {selectedTab === 'toprated' 
                ? selectedGenreId 
                  ? `No top-rated ${genres[selectedGenreId] || 'genre'} movies`
                  : 'No top-rated movies yet'
                : 'No recent activity'
              }
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

// Profile-specific styles (extracted from ProfileScreen pattern)
const profileStyles = StyleSheet.create({
  genreFilterContainer: {
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  genreList: {
    paddingRight: 16,
  },
  genreButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
    minWidth: 60,
    alignItems: 'center',
  },
  genreButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  activeFilterIndicator: {
    paddingTop: 12,
    alignItems: 'center',
  },
  activeFilterText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
});

// Main component styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  placeholder: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
  },
  profileHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  userInfoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  profilePicture: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    marginRight: 16,
  },
  userDetails: {
    flex: 1,
  },
  displayName: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  username: {
    fontSize: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
  },
  followButton: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 25,
    borderWidth: 2,
    alignItems: 'center',
    alignSelf: 'center',
  },
  followButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default UserProfileScreen;