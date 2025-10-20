/**
 * UserSearchResult - Individual user result in search
 * 
 * CODE_BIBLE Commandment #7: Clear visual separation from movie results
 * - Distinct styling to differentiate from movie cards
 * - User-specific information display
 * - Consistent interaction patterns
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

function UserSearchResult({ 
  user, 
  onPress, 
  isDarkMode,
  colors 
}) {
  const resultColors = colors || {
    background: isDarkMode ? '#2A2F30' : '#FFFFFF',
    text: isDarkMode ? '#F5F5F5' : '#333',
    subtext: isDarkMode ? '#D3D3D3' : '#666',
    accent: isDarkMode ? '#FFD700' : '#4B0082',
    border: isDarkMode ? '#8A2BE2' : '#E0E0E0',
  };

  const formatFollowerCount = (count) => {
    if (!count || count === 0) return '0 followers';
    if (count === 1) return '1 follower';
    if (count < 1000) return `${count} followers`;
    if (count < 1000000) return `${(count / 1000).toFixed(1)}k followers`;
    return `${(count / 1000000).toFixed(1)}m followers`;
  };

  return (
    <TouchableOpacity
      style={[styles.container, { 
        backgroundColor: resultColors.background,
        borderColor: resultColors.border 
      }]}
      onPress={() => onPress(user)}
      activeOpacity={0.7}
    >
      {/* User Avatar */}
      <View style={styles.avatarContainer}>
        {user.profilePictureUrl ? (
          <Image
            source={{ uri: user.profilePictureUrl }}
            style={styles.avatar}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.avatarPlaceholder, { backgroundColor: resultColors.border }]}>
            <Ionicons name="person" size={20} color={resultColors.subtext} />
          </View>
        )}
        
        {/* User Type Badge */}
        <View style={[styles.userBadge, { backgroundColor: resultColors.accent }]}>
          <Ionicons name="person" size={10} color="#FFFFFF" />
        </View>
      </View>

      {/* User Info */}
      <View style={styles.userInfo}>
        <Text style={[styles.displayName, { color: resultColors.text }]} numberOfLines={1}>
          {user.displayName || user.username || 'Unknown User'}
        </Text>
        
        <Text style={[styles.username, { color: resultColors.subtext }]} numberOfLines={1}>
          @{user.username}
        </Text>
        
        <View style={styles.userMeta}>
          <Text style={[styles.followerCount, { color: resultColors.subtext }]}>
            {formatFollowerCount(user.followerCount)}
          </Text>
          
          {user.isVerified && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={12} color={resultColors.accent} />
            </View>
          )}
        </View>

        {/* User Bio Preview */}
        {user.bio && (
          <Text style={[styles.bio, { color: resultColors.subtext }]} numberOfLines={2}>
            {user.bio}
          </Text>
        )}
      </View>

      {/* Action Indicator */}
      <View style={styles.actionIndicator}>
        <Ionicons name="chevron-forward" size={20} color={resultColors.subtext} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 12,
    marginVertical: 4,
    marginHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  displayName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  username: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 6,
  },
  userMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  followerCount: {
    fontSize: 12,
    marginRight: 6,
  },
  verifiedBadge: {
    marginLeft: 4,
  },
  bio: {
    fontSize: 13,
    lineHeight: 16,
    marginTop: 2,
  },
  actionIndicator: {
    alignSelf: 'center',
    marginLeft: 8,
  },
});

export default UserSearchResult;