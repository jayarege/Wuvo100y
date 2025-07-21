import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import UserSearchService from '../services/UserSearchService';

function UserSearchScreen({ 
  navigation, 
  isDarkMode, 
  currentUser 
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const colors = {
    background: isDarkMode ? '#1C2526' : '#FFFFFF',
    text: isDarkMode ? '#F5F5F5' : '#333',
    subtext: isDarkMode ? '#D3D3D3' : '#666',
    accent: isDarkMode ? '#FFD700' : '#4B0082',
    input: isDarkMode ? '#4B0082' : '#F5F5F5',
    inputText: isDarkMode ? '#F5F5F5' : '#333',
    border: isDarkMode ? '#8A2BE2' : '#E0E0E0',
    card: isDarkMode ? 'rgba(255, 215, 0, 0.1)' : 'rgba(75, 0, 130, 0.05)',
    placeholder: isDarkMode ? '#A9A9A9' : '#999'
  };

  // Debounced search function
  useEffect(() => {
    if (searchQuery.length >= 2) {
      const delayTimer = setTimeout(() => {
        performSearch(searchQuery);
      }, 500);

      return () => clearTimeout(delayTimer);
    } else {
      setSearchResults([]);
      setHasSearched(false);
    }
  }, [searchQuery]);

  const performSearch = async (query) => {
    setIsSearching(true);
    try {
      console.log('🔍 Performing user search for:', query);
      const results = await UserSearchService.searchUsers(query, 20);
      setSearchResults(results);
      setHasSearched(true);
      console.log(`✅ Found ${results.length} users`);
    } catch (error) {
      console.error('❌ Search failed:', error);
      Alert.alert('Search Error', 'Failed to search for users. Please try again.');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleUserPress = useCallback((user) => {
    console.log('👤 Navigating to user profile:', user.username);
    navigation.navigate('PublicProfile', { 
      userId: user.id,
      username: user.username,
      displayName: user.displayName
    });
  }, [navigation]);

  const renderUserItem = ({ item: user }) => (
    <TouchableOpacity
      style={[styles.userItem, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => handleUserPress(user)}
    >
      <View style={styles.userItemContent}>
        {/* Profile Picture */}
        <View style={[styles.profilePicture, { borderColor: colors.border }]}>
          {user.profilePicture ? (
            <Image
              source={{ uri: user.profilePicture }}
              style={styles.profileImage}
              resizeMode="cover"
            />
          ) : (
            <Ionicons
              name="person"
              size={24}
              color={colors.subtext}
            />
          )}
        </View>

        {/* User Info */}
        <View style={styles.userInfo}>
          <Text style={[styles.displayName, { color: colors.text }]}>
            {user.displayName}
          </Text>
          {user.username && (
            <Text style={[styles.username, { color: colors.accent }]}>
              @{user.username}
            </Text>
          )}
          {user.bio && (
            <Text
              style={[styles.bio, { color: colors.subtext }]}
              numberOfLines={2}
            >
              {user.bio}
            </Text>
          )}
        </View>

        {/* User Stats */}
        <View style={styles.userStats}>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: colors.text }]}>
              {user.followerCount || 0}
            </Text>
            <Text style={[styles.statLabel, { color: colors.subtext }]}>
              Followers
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: colors.text }]}>
              {user.totalRatings || 0}
            </Text>
            <Text style={[styles.statLabel, { color: colors.subtext }]}>
              Ratings
            </Text>
          </View>
        </View>

        {/* Arrow Icon */}
        <Ionicons
          name="chevron-forward"
          size={20}
          color={colors.subtext}
          style={styles.arrowIcon}
        />
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => {
    if (isSearching) {
      return (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.emptyStateText, { color: colors.subtext }]}>
            Searching for users...
          </Text>
        </View>
      );
    }

    if (hasSearched && searchResults.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="person-outline" size={64} color={colors.subtext} />
          <Text style={[styles.emptyStateTitle, { color: colors.text }]}>
            No users found
          </Text>
          <Text style={[styles.emptyStateText, { color: colors.subtext }]}>
            Try searching for a different username or name
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyState}>
        <Ionicons name="search-outline" size={64} color={colors.subtext} />
        <Text style={[styles.emptyStateTitle, { color: colors.text }]}>
          Discover Other Users
        </Text>
        <Text style={[styles.emptyStateText, { color: colors.subtext }]}>
          Search for users by @username or display name
        </Text>
      </View>
    );
  };

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
          Find Users
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchInputContainer, { backgroundColor: colors.input, borderColor: colors.border }]}>
          <Ionicons name="search" size={20} color={colors.subtext} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: colors.inputText }]}
            placeholder="Search @username or name"
            placeholderTextColor={colors.placeholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              style={styles.clearButton}
            >
              <Ionicons name="close-circle" size={20} color={colors.subtext} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Search Results */}
      <FlatList
        data={searchResults}
        renderItem={renderUserItem}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />
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
  },
  headerSpacer: {
    width: 40,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  clearButton: {
    padding: 4,
    marginLeft: 8,
  },
  listContainer: {
    padding: 16,
    paddingTop: 8,
  },
  userItem: {
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  userItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  profilePicture: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  profileImage: {
    width: '100%',
    height: '100%',
    borderRadius: 23,
  },
  userInfo: {
    flex: 1,
    marginRight: 12,
  },
  displayName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  username: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  bio: {
    fontSize: 13,
    lineHeight: 18,
  },
  userStats: {
    alignItems: 'center',
    marginRight: 8,
  },
  statItem: {
    alignItems: 'center',
    marginBottom: 4,
  },
  statNumber: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 11,
    textAlign: 'center',
  },
  arrowIcon: {
    marginLeft: 4,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default UserSearchScreen;