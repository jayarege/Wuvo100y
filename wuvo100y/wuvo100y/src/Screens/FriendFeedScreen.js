import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  SafeAreaView,
  StyleSheet,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ActivityFeedService from '../services/ActivityFeedService';

function FriendFeedScreen({ navigation, isDarkMode, currentUser }) {
  const [activities, setActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState(null);
  const [likedActivities, setLikedActivities] = useState(new Set());

  const colors = {
    background: isDarkMode ? '#1C2526' : '#FFFFFF',
    text: isDarkMode ? '#F5F5F5' : '#333',
    subtext: isDarkMode ? '#D3D3D3' : '#666',
    accent: isDarkMode ? '#FFD700' : '#4B0082',
    card: isDarkMode ? 'rgba(255, 215, 0, 0.1)' : 'rgba(75, 0, 130, 0.05)',
    border: isDarkMode ? '#8A2BE2' : '#E0E0E0',
    like: '#FF6B6B',
    gradient: isDarkMode ? ['#4B0082', '#8A2BE2'] : ['#9370DB', '#8A2BE2']
  };

  const loadFeed = useCallback(async (refresh = false) => {
    if (!currentUser?.id) return;

    try {
      if (refresh) {
        setIsRefreshing(true);
        setLastDoc(null);
      } else {
        setIsLoading(true);
      }

      console.log('📰 Loading friend feed...');
      const result = await ActivityFeedService.getFeedForUser(
        currentUser.id, 
        20, 
        refresh ? null : lastDoc
      );

      if (refresh) {
        setActivities(result.activities);
      } else {
        setActivities(prev => [...prev, ...result.activities]);
      }

      setLastDoc(result.lastDoc);

      // Load like status for activities
      await loadLikeStatus(result.activities);

      console.log(`✅ Loaded ${result.activities.length} activities`);
    } catch (error) {
      console.error('❌ Error loading feed:', error);
      Alert.alert('Error', 'Failed to load activity feed. Please try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      setIsLoadingMore(false);
    }
  }, [currentUser, lastDoc]);

  const loadLikeStatus = async (activitiesToCheck) => {
    if (!currentUser?.id) return;

    try {
      const likePromises = activitiesToCheck.map(activity =>
        ActivityFeedService.hasUserLikedActivity(activity.id, currentUser.id)
      );

      const likeResults = await Promise.all(likePromises);
      const newLikedActivities = new Set(likedActivities);

      activitiesToCheck.forEach((activity, index) => {
        if (likeResults[index]) {
          newLikedActivities.add(activity.id);
        }
      });

      setLikedActivities(newLikedActivities);
    } catch (error) {
      console.error('❌ Error loading like status:', error);
    }
  };

  const handleLikeActivity = async (activityId) => {
    if (!currentUser?.id) return;

    try {
      await ActivityFeedService.likeActivity(activityId, currentUser.id);
      
      const newLikedActivities = new Set(likedActivities);
      const wasLiked = likedActivities.has(activityId);

      if (wasLiked) {
        newLikedActivities.delete(activityId);
      } else {
        newLikedActivities.add(activityId);
      }

      setLikedActivities(newLikedActivities);

      // Update like count optimistically
      setActivities(prev => prev.map(activity => {
        if (activity.id === activityId) {
          return {
            ...activity,
            likes: wasLiked ? activity.likes - 1 : activity.likes + 1
          };
        }
        return activity;
      }));

    } catch (error) {
      console.error('❌ Error liking activity:', error);
      Alert.alert('Error', 'Failed to like activity. Please try again.');
    }
  };

  const loadMoreActivities = () => {
    if (isLoadingMore || !lastDoc) return;
    setIsLoadingMore(true);
    loadFeed(false);
  };

  useEffect(() => {
    loadFeed(true);
  }, []);

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Recently';
    
    const now = new Date();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return timestamp.toLocaleDateString();
  };

  const renderActivityIcon = (activityType) => {
    const iconProps = { size: 20, color: colors.accent };
    
    switch (activityType) {
      case ActivityFeedService.ACTIVITY_TYPES.MOVIE_RATED:
        return <Ionicons name="star" {...iconProps} />;
      case ActivityFeedService.ACTIVITY_TYPES.MOVIE_ADDED_TO_WATCHLIST:
        return <Ionicons name="bookmark" {...iconProps} />;
      case ActivityFeedService.ACTIVITY_TYPES.USER_FOLLOWED:
        return <Ionicons name="person-add" {...iconProps} />;
      default:
        return <Ionicons name="film" {...iconProps} />;
    }
  };

  const renderActivity = ({ item: activity }) => (
    <View style={[styles.activityCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* User Header */}
      <View style={styles.activityHeader}>
        <TouchableOpacity 
          style={styles.userInfo}
          onPress={() => {
            if (activity.user.id !== currentUser?.id) {
              navigation.navigate('PublicProfile', {
                userId: activity.user.id,
                username: activity.user.username,
                displayName: activity.user.displayName
              });
            }
          }}
        >
          <View style={[styles.avatar, { borderColor: colors.border }]}>
            {activity.user.profilePicture ? (
              <Image
                source={{ uri: activity.user.profilePicture }}
                style={styles.avatarImage}
                resizeMode="cover"
              />
            ) : (
              <Ionicons name="person" size={20} color={colors.subtext} />
            )}
          </View>
          <View style={styles.userDetails}>
            <Text style={[styles.displayName, { color: colors.text }]}>
              {activity.user.displayName}
            </Text>
            {activity.user.username && (
              <Text style={[styles.username, { color: colors.subtext }]}>
                @{activity.user.username}
              </Text>
            )}
          </View>
        </TouchableOpacity>
        
        <View style={styles.activityMeta}>
          {renderActivityIcon(activity.type)}
          <Text style={[styles.timestamp, { color: colors.subtext }]}>
            {formatTimestamp(activity.timestamp)}
          </Text>
        </View>
      </View>

      {/* Activity Content */}
      {activity.type === ActivityFeedService.ACTIVITY_TYPES.MOVIE_RATED && (
        <View style={styles.movieActivity}>
          <TouchableOpacity 
            style={styles.movieInfo}
            onPress={() => {
              navigation.navigate('MovieDetail', {
                movieId: activity.data.movieId,
                movieTitle: activity.data.movieTitle
              });
            }}
          >
            {activity.data.moviePoster && (
              <Image
                source={{ 
                  uri: `https://image.tmdb.org/t/p/w154${activity.data.moviePoster}` 
                }}
                style={styles.moviePoster}
                resizeMode="cover"
              />
            )}
            <View style={styles.movieDetails}>
              <Text style={[styles.movieTitle, { color: colors.text }]}>
                {activity.data.movieTitle}
              </Text>
              {activity.data.movieYear && (
                <Text style={[styles.movieYear, { color: colors.subtext }]}>
                  {activity.data.movieYear}
                </Text>
              )}
              <View style={styles.ratingContainer}>
                <View style={styles.rating}>
                  <Ionicons name="star" size={16} color="#FFD700" />
                  <Text style={[styles.ratingText, { color: colors.accent }]}>
                    {activity.data.rating.toFixed(1)}
                  </Text>
                </View>
                {activity.data.tmdbRating && (
                  <Text style={[styles.tmdbRating, { color: colors.subtext }]}>
                    TMDB: {activity.data.tmdbRating.toFixed(1)}
                  </Text>
                )}
              </View>
              {activity.data.review && (
                <Text style={[styles.review, { color: colors.text }]} numberOfLines={3}>
                  "{activity.data.review}"
                </Text>
              )}
            </View>
          </TouchableOpacity>
        </View>
      )}

      {activity.type === ActivityFeedService.ACTIVITY_TYPES.MOVIE_ADDED_TO_WATCHLIST && (
        <View style={styles.watchlistActivity}>
          <Text style={[styles.activityText, { color: colors.text }]}>
            Added <Text style={{ fontWeight: 'bold' }}>{activity.data.movieTitle}</Text> to watchlist
          </Text>
        </View>
      )}

      {activity.type === ActivityFeedService.ACTIVITY_TYPES.USER_FOLLOWED && (
        <View style={styles.followActivity}>
          <Text style={[styles.activityText, { color: colors.text }]}>
            Started following{' '}
            <TouchableOpacity 
              onPress={() => {
                navigation.navigate('PublicProfile', {
                  userId: activity.data.followedUserId,
                  username: activity.data.followedUsername,
                  displayName: activity.data.followedDisplayName
                });
              }}
            >
              <Text style={[styles.mentionedUser, { color: colors.accent }]}>
                @{activity.data.followedUsername}
              </Text>
            </TouchableOpacity>
          </Text>
        </View>
      )}

      {/* Activity Actions */}
      <View style={styles.activityActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleLikeActivity(activity.id)}
        >
          <Ionicons
            name={likedActivities.has(activity.id) ? 'heart' : 'heart-outline'}
            size={20}
            color={likedActivities.has(activity.id) ? colors.like : colors.subtext}
          />
          <Text style={[
            styles.actionText,
            { 
              color: likedActivities.has(activity.id) ? colors.like : colors.subtext 
            }
          ]}>
            {activity.likes || 0}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="chatbubble-outline" size={20} color={colors.subtext} />
          <Text style={[styles.actionText, { color: colors.subtext }]}>
            {activity.comments || 0}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="share-outline" size={20} color={colors.subtext} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="people-outline" size={64} color={colors.subtext} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        No Activity Yet
      </Text>
      <Text style={[styles.emptyText, { color: colors.subtext }]}>
        Follow friends to see their movie activities here
      </Text>
      <TouchableOpacity
        style={[styles.discoverButton, { backgroundColor: colors.accent }]}
        onPress={() => navigation.navigate('UserSearch')}
      >
        <Text style={[styles.discoverButtonText, { color: isDarkMode ? '#1C2526' : '#FFFFFF' }]}>
          Discover Users
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderFooter = () => {
    if (!isLoadingMore) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color={colors.accent} />
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <LinearGradient colors={colors.gradient} style={styles.header}>
        <Text style={styles.headerTitle}>Friend Feed</Text>
        <TouchableOpacity
          style={styles.searchButton}
          onPress={() => navigation.navigate('UserSearch')}
        >
          <Ionicons name="search" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </LinearGradient>

      {/* Feed List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.loadingText, { color: colors.subtext }]}>
            Loading your feed...
          </Text>
        </View>
      ) : (
        <FlatList
          data={activities}
          renderItem={renderActivity}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => loadFeed(true)}
              tintColor={colors.accent}
            />
          }
          onEndReached={loadMoreActivities}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={renderEmptyState}
          ListFooterComponent={renderFooter}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.listContainer,
            activities.length === 0 && styles.emptyListContainer
          ]}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 50,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  searchButton: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  listContainer: {
    padding: 16,
  },
  emptyListContainer: {
    flex: 1,
  },
  activityCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
  },
  userDetails: {
    flex: 1,
  },
  displayName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  username: {
    fontSize: 14,
  },
  activityMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timestamp: {
    fontSize: 12,
    marginLeft: 6,
  },
  movieActivity: {
    marginBottom: 12,
  },
  movieInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  moviePoster: {
    width: 60,
    height: 90,
    borderRadius: 8,
    marginRight: 12,
  },
  movieDetails: {
    flex: 1,
  },
  movieTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  movieYear: {
    fontSize: 14,
    marginBottom: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  ratingText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  tmdbRating: {
    fontSize: 12,
  },
  review: {
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  watchlistActivity: {
    marginBottom: 12,
  },
  followActivity: {
    marginBottom: 12,
  },
  activityText: {
    fontSize: 15,
    lineHeight: 22,
  },
  mentionedUser: {
    fontWeight: 'bold',
  },
  activityActions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128, 128, 128, 0.2)',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 24,
  },
  actionText: {
    fontSize: 14,
    marginLeft: 6,
    fontWeight: '500',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  discoverButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  discoverButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  footer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
});

export default FriendFeedScreen;