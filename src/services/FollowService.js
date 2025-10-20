import firebase from '../config/firebase';

class FollowService {
  constructor() {
    this.db = firebase.firestore();
  }

  // Follow a user
  async followUser(currentUserId, targetUserId) {
    try {
      console.log('👥 Following user:', targetUserId);

      if (currentUserId === targetUserId) {
        throw new Error('Cannot follow yourself');
      }

      // Check if already following
      const existingFollow = await this.db
        .collection('follows')
        .where('followerId', '==', currentUserId)
        .where('followingId', '==', targetUserId)
        .get();

      if (!existingFollow.empty) {
        throw new Error('Already following this user');
      }

      // Create follow relationship
      const batch = this.db.batch();

      // Add follow document
      const followDoc = this.db.collection('follows').doc();
      batch.set(followDoc, {
        followerId: currentUserId,
        followingId: targetUserId,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'active'
      });

      // Update follower count
      const targetUserRef = this.db.collection('users').doc(targetUserId);
      batch.update(targetUserRef, {
        followerCount: firebase.firestore.FieldValue.increment(1)
      });

      // Update following count  
      const currentUserRef = this.db.collection('users').doc(currentUserId);
      batch.update(currentUserRef, {
        followingCount: firebase.firestore.FieldValue.increment(1)
      });

      await batch.commit();
      console.log('✅ User followed successfully');
      
      return { success: true, action: 'followed' };
    } catch (error) {
      console.error('❌ Error following user:', error);
      throw error;
    }
  }

  // Unfollow a user
  async unfollowUser(currentUserId, targetUserId) {
    try {
      console.log('👋 Unfollowing user:', targetUserId);

      // Find existing follow relationship
      const followQuery = await this.db
        .collection('follows')
        .where('followerId', '==', currentUserId)
        .where('followingId', '==', targetUserId)
        .get();

      if (followQuery.empty) {
        throw new Error('Not following this user');
      }

      // Remove follow relationship
      const batch = this.db.batch();

      // Delete follow document
      followQuery.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      // Update follower count
      const targetUserRef = this.db.collection('users').doc(targetUserId);
      batch.update(targetUserRef, {
        followerCount: firebase.firestore.FieldValue.increment(-1)
      });

      // Update following count
      const currentUserRef = this.db.collection('users').doc(currentUserId);
      batch.update(currentUserRef, {
        followingCount: firebase.firestore.FieldValue.increment(-1)
      });

      await batch.commit();
      console.log('✅ User unfollowed successfully');
      
      return { success: true, action: 'unfollowed' };
    } catch (error) {
      console.error('❌ Error unfollowing user:', error);
      throw error;
    }
  }

  // Check if current user is following target user
  async isFollowing(currentUserId, targetUserId) {
    try {
      if (!currentUserId || !targetUserId) {
        return false;
      }

      const followQuery = await this.db
        .collection('follows')
        .where('followerId', '==', currentUserId)
        .where('followingId', '==', targetUserId)
        .limit(1)
        .get();

      return !followQuery.empty;
    } catch (error) {
      console.error('❌ Error checking follow status:', error);
      return false;
    }
  }

  // Get user's followers
  async getFollowers(userId, limit = 20) {
    try {
      const followersQuery = await this.db
        .collection('follows')
        .where('followingId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();

      const followerIds = followersQuery.docs.map(doc => doc.data().followerId);
      
      if (followerIds.length === 0) {
        return [];
      }

      // Get user profiles for followers
      const usersQuery = await this.db
        .collection('users')
        .where(firebase.firestore.FieldPath.documentId(), 'in', followerIds)
        .get();

      return usersQuery.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('❌ Error getting followers:', error);
      return [];
    }
  }

  // Get users that a user is following
  async getFollowing(userId, limit = 20) {
    try {
      const followingQuery = await this.db
        .collection('follows')
        .where('followerId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();

      const followingIds = followingQuery.docs.map(doc => doc.data().followingId);
      
      if (followingIds.length === 0) {
        return [];
      }

      // Get user profiles for following
      const usersQuery = await this.db
        .collection('users')
        .where(firebase.firestore.FieldPath.documentId(), 'in', followingIds)
        .get();

      return usersQuery.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('❌ Error getting following:', error);
      return [];
    }
  }

  // Toggle follow status (follow if not following, unfollow if following)
  async toggleFollow(currentUserId, targetUserId) {
    try {
      const isCurrentlyFollowing = await this.isFollowing(currentUserId, targetUserId);
      
      if (isCurrentlyFollowing) {
        return await this.unfollowUser(currentUserId, targetUserId);
      } else {
        return await this.followUser(currentUserId, targetUserId);
      }
    } catch (error) {
      console.error('❌ Error toggling follow:', error);
      throw error;
    }
  }

  // Get follow statistics for a user
  async getFollowStats(userId) {
    try {
      const userDoc = await this.db.collection('users').doc(userId).get();
      
      if (!userDoc.exists) {
        return { followerCount: 0, followingCount: 0 };
      }

      const userData = userDoc.data();
      return {
        followerCount: userData.followerCount || 0,
        followingCount: userData.followingCount || 0
      };
    } catch (error) {
      console.error('❌ Error getting follow stats:', error);
      return { followerCount: 0, followingCount: 0 };
    }
  }

  // Get suggested users to follow (basic implementation)
  async getSuggestedUsers(currentUserId, limit = 10) {
    try {
      // Get users that current user is not following
      // This is a basic implementation - in production you'd want more sophisticated recommendations
      const allUsersQuery = await this.db
        .collection('users')
        .where('isPublic', '==', true)
        .where('searchable', '==', true)
        .orderBy('followerCount', 'desc')
        .limit(limit * 2) // Get more to filter out follows
        .get();

      const allUsers = allUsersQuery.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Filter out current user and users already being followed
      const filteredUsers = allUsers.filter(user => user.id !== currentUserId);
      
      // TODO: Filter out users already being followed
      // This would require additional queries for better performance
      
      return filteredUsers.slice(0, limit);
    } catch (error) {
      console.error('❌ Error getting suggested users:', error);
      return [];
    }
  }
}

export default new FollowService();