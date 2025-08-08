import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  SafeAreaView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import UserSearchService from '../services/UserSearchService';
import FollowService from '../services/FollowService';
import theme from '../utils/Theme';

function PublicProfileScreen({ 
  route, 
  navigation, 
  isDarkMode,
  currentUser 
}) {
  const { userId, username, displayName } = route.params;
  
  const [userProfile, setUserProfile] = useState(null);
  const [userRatings, setUserRatings] = useState([]);
  const [userWatchlist, setUserWatchlist] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('about'); // 'about', 'ratings', 'watchlist'
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);

  // Use centralized theme instead of hardcoded colors
  const themeColors = theme.movie[isDarkMode ? 'dark' : 'light'];
  const colors = {
    background: themeColors.background,
    text: themeColors.text,
    subtext: themeColors.subText,
    accent: themeColors.accent,
    card: isDarkMode ? 'rgba(255, 215, 0, 0.1)' : 'rgba(75, 0, 130, 0.05)',
    border: themeColors.border.color,
    button: themeColors.accent,
    buttonText: themeColors.textOnPrimary
  };

  const loadUserProfile = useCallback(async () => {
    try {
      console.log('📄 Loading user profile:', userId);
      setIsLoading(true);

      const profile = await UserSearchService.getUserProfile(userId);
      setUserProfile(profile);

      // Load user data based on privacy settings
      if (profile.preferences?.showRatings) {
        const ratings = await UserSearchService.getUserRatings(userId, 10);
        setUserRatings(ratings);
      }

      if (profile.preferences?.showWatchlist) {
        const watchlist = await UserSearchService.getUserWatchlist(userId, 10);
        setUserWatchlist(watchlist);
      }

      // Check follow status if user is authenticated
      if (currentUser?.id && currentUser.id !== userId) {
        const followStatus = await FollowService.isFollowing(currentUser.id, userId);
        setIsFollowing(followStatus);
      }

      console.log('✅ Profile loaded successfully');
    } catch (error) {
      console.error('❌ Failed to load profile:', error);
      Alert.alert(
        'Profile Unavailable',
        error.message || 'Unable to load this profile. It may be private or no longer exist.',
        [
          { text: 'Go Back', onPress: () => navigation.goBack() }
        ]
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [userId, navigation]);

  useEffect(() => {
    loadUserProfile();
  }, [loadUserProfile]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadUserProfile();
  }, [loadUserProfile]);

  const handleFollowToggle = useCallback(async () => {
    if (!currentUser?.id) {
      Alert.alert('Sign In Required', 'Please sign in to follow users');
      return;
    }

    setIsFollowLoading(true);
    try {
      const result = await FollowService.toggleFollow(currentUser.id, userId);
      setIsFollowing(result.action === 'followed');
      
      // Update the userProfile follower count optimistically
      if (userProfile) {
        setUserProfile(prev => ({
          ...prev,
          followerCount: result.action === 'followed' 
            ? (prev.followerCount || 0) + 1
            : Math.max(0, (prev.followerCount || 0) - 1)
        }));
      }

      console.log(`✅ ${result.action} user successfully`);
    } catch (error) {
      console.error('❌ Follow toggle failed:', error);
      Alert.alert('Error', error.message || 'Failed to update follow status');
    } finally {
      setIsFollowLoading(false);
    }
  }, [currentUser, userId, userProfile]);

  const renderProfileHeader = () => (
    <View style={styles.profileHeader}>
      {/* Profile Picture */}
      <View style={[styles.profilePicture, { borderColor: colors.accent }]}>
        {userProfile?.profilePicture ? (
          <Image
            source={{ uri: userProfile.profilePicture }}
            style={styles.profileImage}
            resizeMode="cover"
          />
        ) : (
          <Ionicons
            name="person"
            size={48}
            color={colors.subtext}
          />
        )}
      </View>

      {/* User Info */}
      <View style={styles.userInfo}>
        <Text style={[styles.displayName, { color: colors.text }]}>
          {userProfile?.displayName}
        </Text>
        {userProfile?.username && (
          <Text style={[styles.username, { color: colors.accent }]}>
            @{userProfile.username}
          </Text>
        )}
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: colors.text }]}>
            {userProfile?.followerCount || 0}
          </Text>
          <Text style={[styles.statLabel, { color: colors.subtext }]}>
            Followers
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: colors.text }]}>
            {userProfile?.followingCount || 0}
          </Text>
          <Text style={[styles.statLabel, { color: colors.subtext }]}>
            Following
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: colors.text }]}>
            {userProfile?.totalRatings || 0}
          </Text>
          <Text style={[styles.statLabel, { color: colors.subtext }]}>
            Ratings
          </Text>
        </View>
      </View>

      {/* Bio */}
      {userProfile?.bio && (
        <Text style={[styles.bio, { color: colors.text }]}>
          {userProfile.bio}
        </Text>
      )}

      {/* Action Buttons */}
      {currentUser?.id !== userId && (
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[
              styles.followButton,
              { 
                backgroundColor: isFollowing ? colors.card : colors.button,
                borderColor: colors.button
              }
            ]}
            onPress={handleFollowToggle}
            disabled={isFollowLoading}
          >
            {isFollowLoading ? (
              <ActivityIndicator 
                size="small" 
                color={isFollowing ? colors.text : colors.buttonText} 
              />
            ) : (
              <Text style={[
                styles.followButtonText,
                { 
                  color: isFollowing ? colors.text : colors.buttonText
                }
              ]}>
                {isFollowing ? 'Following' : 'Follow'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderTabBar = () => (
    <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
      <TouchableOpacity
        style={[
          styles.tab,
          activeTab === 'about' && { borderBottomColor: colors.accent }
        ]}
        onPress={() => setActiveTab('about')}
      >
        <Ionicons
          name="person-outline"
          size={20}
          color={activeTab === 'about' ? colors.accent : colors.subtext}
        />
        <Text style={[
          styles.tabText,
          { color: activeTab === 'about' ? colors.accent : colors.subtext }
        ]}>
          About
        </Text>
      </TouchableOpacity>

      {userProfile?.preferences?.showRatings && (
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'ratings' && { borderBottomColor: colors.accent }
          ]}
          onPress={() => setActiveTab('ratings')}
        >
          <Ionicons
            name="star-outline"
            size={20}
            color={activeTab === 'ratings' ? colors.accent : colors.subtext}
          />
          <Text style={[
            styles.tabText,
            { color: activeTab === 'ratings' ? colors.accent : colors.subtext }
          ]}>
            Ratings
          </Text>
        </TouchableOpacity>
      )}

      {userProfile?.preferences?.showWatchlist && (
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'watchlist' && { borderBottomColor: colors.accent }
          ]}
          onPress={() => setActiveTab('watchlist')}
        >
          <Ionicons
            name="bookmark-outline"
            size={20}
            color={activeTab === 'watchlist' ? colors.accent : colors.subtext}
          />
          <Text style={[
            styles.tabText,
            { color: activeTab === 'watchlist' ? colors.accent : colors.subtext }
          ]}>
            Watchlist
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderAboutTab = () => (
    <View style={styles.tabContent}>
      <View style={[styles.infoCard, { backgroundColor: colors.card }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>
          Profile Information
        </Text>
        
        <View style={styles.infoRow}>
          <Ionicons name="calendar-outline" size={16} color={colors.subtext} />
          <Text style={[styles.infoText, { color: colors.subtext }]}>
            Joined {userProfile?.joinDate ? new Date(userProfile.joinDate.seconds * 1000).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'Recently'}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="time-outline" size={16} color={colors.subtext} />
          <Text style={[styles.infoText, { color: colors.subtext }]}>
            Last active {userProfile?.lastActive ? new Date(userProfile.lastActive.seconds * 1000).toLocaleDateString() : 'Unknown'}
          </Text>
        </View>

        {userProfile?.totalRatings > 0 && (
          <View style={styles.infoRow}>
            <Ionicons name="trending-up-outline" size={16} color={colors.subtext} />
            <Text style={[styles.infoText, { color: colors.subtext }]}>
              Average rating: {userProfile.averageRating ? userProfile.averageRating.toFixed(1) : 'N/A'}/10
            </Text>
          </View>
        )}
      </View>

      {userProfile?.preferences && (
        <View style={[styles.infoCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            Sharing Preferences
          </Text>
          
          <View style={styles.preferenceRow}>
            <Ionicons 
              name={userProfile.preferences.showRatings ? 'checkmark-circle' : 'close-circle'} 
              size={16} 
              color={userProfile.preferences.showRatings ? '#4CAF50' : '#F44336'} 
            />
            <Text style={[styles.preferenceText, { color: colors.subtext }]}>
              Movie ratings are {userProfile.preferences.showRatings ? 'public' : 'private'}
            </Text>
          </View>

          <View style={styles.preferenceRow}>
            <Ionicons 
              name={userProfile.preferences.showWatchlist ? 'checkmark-circle' : 'close-circle'} 
              size={16} 
              color={userProfile.preferences.showWatchlist ? '#4CAF50' : '#F44336'} 
            />
            <Text style={[styles.preferenceText, { color: colors.subtext }]}>
              Watchlist is {userProfile.preferences.showWatchlist ? 'public' : 'private'}
            </Text>
          </View>
        </View>
      )}
    </View>
  );

  const renderRatingsTab = () => (
    <View style={styles.tabContent}>
      <View style={[styles.infoCard, { backgroundColor: colors.card }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>
          Movie Ratings
        </Text>
        <Text style={[styles.comingSoonText, { color: colors.subtext }]}>
          User ratings will be displayed here when movie data is migrated to Firebase.
        </Text>
      </View>
    </View>
  );

  const renderWatchlistTab = () => (
    <View style={styles.tabContent}>
      <View style={[styles.infoCard, { backgroundColor: colors.card }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>
          Watchlist
        </Text>
        <Text style={[styles.comingSoonText, { color: colors.subtext }]}>
          User watchlist will be displayed here when movie data is migrated to Firebase.
        </Text>
      </View>
    </View>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'ratings':
        return renderRatingsTab();
      case 'watchlist':
        return renderWatchlistTab();
      default:
        return renderAboutTab();
    }
  };

  if (isLoading && !userProfile) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Profile
          </Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.loadingText, { color: colors.subtext }]}>
            Loading profile...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {userProfile?.displayName || displayName || 'Profile'}
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.accent}
          />
        }
      >
        {renderProfileHeader()}
        {renderTabBar()}
        {renderTabContent()}
      </ScrollView>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.2)',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
    marginRight: 40, // Compensate for back button
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  profileHeader: {
    padding: 20,
    alignItems: 'center',
  },
  profilePicture: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    overflow: 'hidden',
  },
  profileImage: {
    width: '100%',
    height: '100%',
    borderRadius: 47,
  },
  userInfo: {
    alignItems: 'center',
    marginBottom: 20,
  },
  displayName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
    textAlign: 'center',
  },
  username: {
    fontSize: 18,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 20,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 14,
    textAlign: 'center',
  },
  bio: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    width: '100%',
    paddingHorizontal: 20,
  },
  followButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  followButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    backgroundColor: 'transparent',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '600',
  },
  tabContent: {
    padding: 16,
  },
  infoCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoText: {
    marginLeft: 8,
    fontSize: 14,
  },
  preferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  preferenceText: {
    marginLeft: 8,
    fontSize: 14,
  },
  comingSoonText: {
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 20,
  },
});

export default PublicProfileScreen;