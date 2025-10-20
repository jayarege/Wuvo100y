import React, { useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  StyleSheet
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const MovieSearchResults = ({ 
  searchResults,
  colors,
  genres,
  movieCardStyles,
  buttonStyles,
  seen,
  unseen,
  onAddToUnseen,
  onRateMovie,
  mediaType,
  loading,
  error,
  searchQuery,
  stateStyles,
  onRetry
}) => {
  // Get poster URL with security validation
  const getPosterUrl = useCallback(path => {
    if (!path || typeof path !== 'string') {
      return 'https://via.placeholder.com/342x513?text=No+Poster';
    }
    
    // SECURITY: Validate poster path to prevent directory traversal and XSS
    const cleanPath = path.trim();
    
    // Reject suspicious paths
    if (cleanPath.includes('..') || cleanPath.includes('<') || cleanPath.includes('>') || 
        cleanPath.includes('script') || cleanPath.includes('javascript:') ||
        cleanPath.length > 100 || !cleanPath.startsWith('/')) {
      console.warn('🚨 SECURITY: Suspicious poster path blocked:', cleanPath);
      return 'https://via.placeholder.com/342x513?text=Invalid+Poster';
    }
    
    // SECURITY: Only allow TMDB image domain and valid image sizes
    const allowedSizes = ['w92', 'w154', 'w185', 'w342', 'w500', 'w780', 'original'];
    return `https://image.tmdb.org/t/p/w342${cleanPath}`;
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
          Genres: {(item.genre_ids || []).map(id => genres[id] || 'Unknown').join(', ') || 'No genres available'}
        </Text>
        
        {item.alreadyRated && (
          <View style={styles.ratingContainer}>
            <Text style={{ color: colors.secondary, marginRight: 10, fontWeight: 'bold' }}>
              Your rating: {item.currentRating ? item.currentRating.toFixed(1) : '0.0'}
            </Text>
            
            <TouchableOpacity
              style={[
                buttonStyles.outlineButton, 
                { 
                  borderColor: colors.primary,
                  backgroundColor: colors.primary
                }
              ]}
              onPress={() => onRateMovie(item)}
              activeOpacity={0.7}
            >
              <Text style={[buttonStyles.outlineButtonText, { color: colors.text }]}>
                Re-rate
              </Text>
            </TouchableOpacity>
          </View>
        )}
        
        <View style={styles.buttonContainer}>
          {!item.alreadyRated && (
            <TouchableOpacity
              style={[
                buttonStyles.outlineButton, 
                { 
                  borderColor: colors.primary,
                  backgroundColor: colors.primary
                }
              ]}
              onPress={() => onRateMovie(item)}
              activeOpacity={0.7}
            >
              <Text style={[buttonStyles.outlineButtonText, { color: colors.text }]}>
                Rate {mediaType === 'movie' ? 'Movie' : 'Show'}
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
            onPress={() => onAddToUnseen(item)}
          >
            <Text style={[buttonStyles.outlineButtonText, { color: colors.text }]}>
              {unseen.some(m => m.id === item.id) ? 'Remove from Watchlist' : 'Add to Watchlist'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  ), [colors, genres, getPosterUrl, onAddToUnseen, unseen, movieCardStyles, buttonStyles, mediaType, onRateMovie]);

  // Error state
  if (error) {
    return (
      <View style={stateStyles.errorContainer}>
        <Ionicons name="alert-circle" size={32} color={colors.accent} />
        <Text style={[stateStyles.errorText, { color: colors.accent }]}>
          {error}
        </Text>
        <TouchableOpacity
          style={[buttonStyles.primaryButton, { backgroundColor: colors.primary, marginTop: 16 }]}
          onPress={onRetry}
        >
          <Text style={[buttonStyles.primaryButtonText, { color: colors.text }]}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // No results state
  if ((!searchResults || searchResults.length === 0) && !loading && searchQuery.trim()) {
    return (
      <View style={stateStyles.emptyStateContainer}>
        <Ionicons name="search-outline" size={64} color={colors.subText} />
        <Text style={[stateStyles.emptyStateText, { color: colors.subText }]}>
          No {mediaType === 'movie' ? 'movies' : 'TV shows'} found for "{searchQuery}"
        </Text>
        <Text style={[stateStyles.emptyStateText, { color: colors.subText, fontSize: 14, marginTop: 8 }]}>
          Try a different search term
        </Text>
      </View>
    );
  }

  // Empty state (no search yet)
  if ((!searchResults || searchResults.length === 0) && !loading) {
    return (
      <View style={stateStyles.emptyStateContainer}>
        <Ionicons name="search" size={64} color={colors.subText} />
        <Text style={[stateStyles.emptyStateText, { color: colors.subText }]}>
          Search for {mediaType === 'movie' ? 'movies' : 'TV shows'} to add to your lists
        </Text>
      </View>
    );
  }

  // Results list
  return (
    <FlatList
      data={searchResults || []}
      keyExtractor={item => item.id.toString()}
      renderItem={renderMovieItem}
      contentContainerStyle={{ padding: 16 }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    />
  );
};

const styles = StyleSheet.create({
  moviePoster: {
    width: 110,
    height: 165,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonContainer: {
    flexDirection: 'row',
    marginTop: 10,
    flexWrap: 'wrap',
    gap: 8,
  },
});

export default MovieSearchResults;