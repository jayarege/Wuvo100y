import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  Dimensions,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const ITEMS_PER_PAGE = 20;

const FullRatingsList = ({
  ratedContent = [],
  colors,
  isOwnProfile,
  selectedRankingType,
  displayRating,
  handleMovieSelect,
  getPosterUrl,
  mediaType = 'movie',
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Paginated data
  const paginatedData = useMemo(() => {
    const totalItems = currentPage * ITEMS_PER_PAGE;
    return ratedContent.slice(0, totalItems);
  }, [ratedContent, currentPage]);

  const hasMoreData = ratedContent.length > paginatedData.length;

  // Load more items
  const loadMoreItems = useCallback(async () => {
    if (hasMoreData && !isLoadingMore) {
      setIsLoadingMore(true);
      // Simulate loading delay for smooth UX
      setTimeout(() => {
        setCurrentPage(prev => prev + 1);
        setIsLoadingMore(false);
      }, 300);
    }
  }, [hasMoreData, isLoadingMore]);

  // Render individual rating item
  const renderRatingItem = useCallback(({ item, index }) => {
    const itemMediaType = item.mediaType || 'movie';
    const title = item.title || item.name;
    const releaseYear = item.release_date ? new Date(item.release_date).getFullYear() : 
                       item.first_air_date ? new Date(item.first_air_date).getFullYear() : '';

    return (
      <TouchableOpacity
        style={[styles.listItem, { borderBottomColor: colors.border }]}
        onPress={() => handleMovieSelect(item, 'full-ratings-list')}
        activeOpacity={0.7}
      >
        {/* Poster */}
        <View style={styles.posterContainer}>
          <Image
            source={{ uri: getPosterUrl(item.poster || item.poster_path) }}
            style={styles.posterImage}
            resizeMode="cover"
          />
        </View>

        {/* Content Info */}
        <View style={styles.contentInfo}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
            {title}
          </Text>
          
          <View style={styles.metaInfo}>
            <Text style={[styles.year, { color: colors.textSecondary }]}>
              {releaseYear}
            </Text>
            {itemMediaType === 'tv' && (
              <View style={styles.tvBadge}>
                <Text style={styles.tvBadgeText}>TV</Text>
              </View>
            )}
          </View>

          {/* Genres */}
          {item.genres && item.genres.length > 0 && (
            <View style={styles.genresContainer}>
              {item.genres.slice(0, 3).map((genre, idx) => (
                <Text 
                  key={genre.id || idx} 
                  style={[styles.genre, { color: colors.textSecondary }]}
                >
                  {genre.name}
                  {idx < Math.min(item.genres.length - 1, 2) && ' • '}
                </Text>
              ))}
            </View>
          )}
        </View>

        {/* Rating */}
        <View style={styles.ratingContainer}>
          <View style={[styles.ratingBadge, { backgroundColor: colors.primary }]}>
            <Text style={[styles.ratingText, { color: colors.textOnPrimary }]}>
              {displayRating(item)}
            </Text>
          </View>
          
          {/* Ranking number */}
          <Text style={[styles.rankNumber, { color: colors.textSecondary }]}>
            #{index + 6} {/* Start from #6 since top 5 are shown above */}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }, [colors, displayRating, handleMovieSelect, getPosterUrl]);

  // Footer component for loading more
  const renderFooter = useCallback(() => {
    if (!hasMoreData) {
      return (
        <View style={styles.footerContainer}>
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>
            {ratedContent.length === 0 
              ? `No ${mediaType === 'movie' ? 'movies' : 'TV shows'} rated yet`
              : `All ${ratedContent.length} ${mediaType === 'movie' ? 'movies' : 'TV shows'} shown`
            }
          </Text>
        </View>
      );
    }

    if (isLoadingMore) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading more...
          </Text>
        </View>
      );
    }

    return (
      <TouchableOpacity
        style={[styles.loadMoreButton, { borderColor: colors.border }]}
        onPress={loadMoreItems}
        activeOpacity={0.7}
      >
        <Ionicons name="chevron-down" size={20} color={colors.primary} />
        <Text style={[styles.loadMoreText, { color: colors.primary }]}>
          Load More ({ratedContent.length - paginatedData.length} remaining)
        </Text>
      </TouchableOpacity>
    );
  }, [hasMoreData, isLoadingMore, ratedContent.length, paginatedData.length, mediaType, colors, loadMoreItems]);

  // Early return if no data
  if (ratedContent.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons 
          name={mediaType === 'movie' ? 'film-outline' : 'tv-outline'} 
          size={48} 
          color={colors.textSecondary} 
        />
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          No {mediaType === 'movie' ? 'movies' : 'TV shows'} rated yet
        </Text>
      </View>
    );
  }

  // Skip first 5 items (they're shown in the top grid)
  const listData = ratedContent.slice(5);

  if (listData.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          All rated {mediaType === 'movie' ? 'movies' : 'TV shows'} are shown above
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        All Rated {mediaType === 'movie' ? 'Movies' : 'TV Shows'} ({ratedContent.length})
      </Text>
      
      <FlatList
        data={paginatedData.slice(5)} // Skip first 5 items
        renderItem={({ item, index }) => renderRatingItem({ item, index })}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        scrollEnabled={false} // Let parent ScrollView handle scrolling
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListFooterComponent={renderFooter}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={true}
        getItemLayout={(data, index) => ({
          length: 120,
          offset: 120 * index,
          index,
        })}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  listItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    alignItems: 'center',
  },
  posterContainer: {
    width: 60,
    height: 90,
    borderRadius: 6,
    overflow: 'hidden',
    marginRight: 12,
  },
  posterImage: {
    width: '100%',
    height: '100%',
  },
  contentInfo: {
    flex: 1,
    paddingRight: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    lineHeight: 20,
  },
  metaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  year: {
    fontSize: 14,
    marginRight: 8,
  },
  tvBadge: {
    backgroundColor: 'rgba(0, 122, 255, 0.8)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tvBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  genresContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  genre: {
    fontSize: 12,
    lineHeight: 16,
  },
  ratingContainer: {
    alignItems: 'center',
    minWidth: 50,
  },
  ratingBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 4,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  rankNumber: {
    fontSize: 11,
    fontWeight: '500',
  },
  separator: {
    height: 0.5,
    backgroundColor: 'transparent',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 12,
  },
  footerContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 14,
  },
  loadMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    marginVertical: 10,
    borderWidth: 1,
    borderRadius: 8,
    borderStyle: 'dashed',
  },
  loadMoreText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
  },
});

export default FullRatingsList;