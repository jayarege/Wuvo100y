import firebase from '../config/firebase';

class UserSearchService {
  constructor() {
    this.db = firebase.firestore();
  }

  // Search users by username or display name
  async searchUsers(searchTerm, limit = 20) {
    try {
      if (!searchTerm || searchTerm.trim().length < 2) {
        return [];
      }

      const normalizedSearch = searchTerm.toLowerCase().trim();
      console.log('🔍 Searching for users:', normalizedSearch);

      // Search by username (exact match and prefix)
      const usernameResults = await this.searchByUsername(normalizedSearch, limit);
      
      // Search by display name (prefix match)
      const displayNameResults = await this.searchByDisplayName(normalizedSearch, limit);

      // Combine and deduplicate results
      const allResults = [...usernameResults, ...displayNameResults];
      const uniqueResults = this.deduplicateUsers(allResults);

      // Sort by relevance (exact username matches first, then by follower count)
      const sortedResults = this.sortSearchResults(uniqueResults, normalizedSearch);

      console.log(`✅ Found ${sortedResults.length} users for search: "${searchTerm}"`);
      return sortedResults.slice(0, limit);

    } catch (error) {
      console.error('❌ Error searching users:', error);
      return [];
    }
  }

  // Search users by username (supports @username format)
  async searchByUsername(searchTerm, limit = 10) {
    try {
      // Remove @ symbol if present
      const cleanSearch = searchTerm.replace('@', '');
      
      // Exact match
      const exactMatch = await this.db
        .collection('users')
        .where('username', '==', cleanSearch)
        .where('isPublic', '==', true)
        .where('searchable', '==', true)
        .limit(1)
        .get();

      // Prefix match for usernames starting with search term
      const prefixMatches = await this.db
        .collection('users')
        .where('username', '>=', cleanSearch)
        .where('username', '<=', cleanSearch + '\uf8ff')
        .where('isPublic', '==', true)
        .where('searchable', '==', true)
        .limit(limit)
        .get();

      const results = [];
      
      // Add exact match first
      exactMatch.docs.forEach(doc => {
        results.push({ id: doc.id, ...doc.data() });
      });

      // Add prefix matches (excluding exact match if already added)
      prefixMatches.docs.forEach(doc => {
        const userData = { id: doc.id, ...doc.data() };
        if (!results.find(user => user.id === userData.id)) {
          results.push(userData);
        }
      });

      return results;
    } catch (error) {
      console.error('❌ Error searching by username:', error);
      return [];
    }
  }

  // Search users by display name
  async searchByDisplayName(searchTerm, limit = 10) {
    try {
      // Search for display names starting with search term
      const results = await this.db
        .collection('users')
        .where('displayName', '>=', searchTerm)
        .where('displayName', '<=', searchTerm + '\uf8ff')
        .where('isPublic', '==', true)
        .where('searchable', '==', true)
        .limit(limit)
        .get();

      return results.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('❌ Error searching by display name:', error);
      return [];
    }
  }

  // Get user profile by ID
  async getUserProfile(userId) {
    try {
      const userDoc = await this.db.collection('users').doc(userId).get();
      
      if (!userDoc.exists) {
        throw new Error('User not found');
      }

      const userData = userDoc.data();
      
      // Check if profile is public
      if (!userData.isPublic) {
        throw new Error('Profile is private');
      }

      return { id: userDoc.id, ...userData };
    } catch (error) {
      console.error('❌ Error getting user profile:', error);
      throw error;
    }
  }

  // Get user's public ratings
  async getUserRatings(userId, limit = 10) {
    try {
      const userProfile = await this.getUserProfile(userId);
      
      // Check if user allows showing ratings
      if (!userProfile.preferences?.showRatings) {
        return [];
      }

      // This would typically query a user_ratings subcollection
      // For now, we'll return empty array as ratings are stored locally
      // TODO: Implement when ratings are moved to Firebase
      console.log('📊 User ratings query - not yet implemented for Firebase storage');
      return [];
      
    } catch (error) {
      console.error('❌ Error getting user ratings:', error);
      return [];
    }
  }

  // Get user's public watchlist
  async getUserWatchlist(userId, limit = 10) {
    try {
      const userProfile = await this.getUserProfile(userId);
      
      // Check if user allows showing watchlist
      if (!userProfile.preferences?.showWatchlist) {
        return [];
      }

      // This would typically query a user_watchlist subcollection
      // For now, we'll return empty array as watchlist is stored locally
      // TODO: Implement when watchlist is moved to Firebase
      console.log('📝 User watchlist query - not yet implemented for Firebase storage');
      return [];
      
    } catch (error) {
      console.error('❌ Error getting user watchlist:', error);
      return [];
    }
  }

  // Remove duplicate users from search results
  deduplicateUsers(users) {
    const seen = new Set();
    return users.filter(user => {
      if (seen.has(user.id)) {
        return false;
      }
      seen.add(user.id);
      return true;
    });
  }

  // Sort search results by relevance
  sortSearchResults(users, searchTerm) {
    return users.sort((a, b) => {
      // Exact username match gets highest priority
      const aUsernameMatch = a.username === searchTerm;
      const bUsernameMatch = b.username === searchTerm;
      
      if (aUsernameMatch && !bUsernameMatch) return -1;
      if (!aUsernameMatch && bUsernameMatch) return 1;

      // Username prefix match gets next priority
      const aUsernamePrefix = a.username?.startsWith(searchTerm);
      const bUsernamePrefix = b.username?.startsWith(searchTerm);
      
      if (aUsernamePrefix && !bUsernamePrefix) return -1;
      if (!aUsernamePrefix && bUsernamePrefix) return 1;

      // Then sort by follower count (descending)
      return (b.followerCount || 0) - (a.followerCount || 0);
    });
  }

  // Format username for display
  formatUsername(username) {
    return username ? `@${username}` : '';
  }

  // Check if current user can view another user's profile
  async canViewProfile(userId, currentUserId) {
    try {
      const userProfile = await this.getUserProfile(userId);
      
      // Public profiles are viewable by anyone
      if (userProfile.isPublic) {
        return true;
      }

      // Private profiles only viewable by the owner
      return userId === currentUserId;
      
    } catch (error) {
      console.error('❌ Error checking profile visibility:', error);
      return false;
    }
  }
}

export default new UserSearchService();