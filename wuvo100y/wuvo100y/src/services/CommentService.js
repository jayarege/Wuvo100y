import firebase from '../config/firebase';
import FollowService from './FollowService';

/**
 * CommentService - Friend-Only Comment System
 * 
 * CODE_BIBLE Compliance:
 * - Commandment #3: Clear and obvious comment operations
 * - Commandment #4: Brutally honest about privacy limitations
 * - Commandment #7: Documents the WHY of friend-only design
 * - Commandment #9: Explicit error handling throughout
 */
class CommentService {
  constructor() {
    this.db = firebase.firestore();
  }

  // Comment visibility levels - starting with friend-only for safety
  static VISIBILITY_LEVELS = {
    FRIENDS_ONLY: 'friends_only',
    PUBLIC: 'public',        // Future expansion
    PRIVATE: 'private'       // Future expansion
  };

  /**
   * Create a comment on an activity
   * WHY friend-only: Reduces toxicity and moderation burden in Phase 4A
   * 
   * @param {string} activityId - The activity being commented on
   * @param {string} userId - The user creating the comment
   * @param {string} content - The comment text
   * @param {string} parentCommentId - Optional reply to another comment
   * @param {boolean} spoilerWarning - Whether comment contains spoilers
   */
  async createComment(activityId, userId, content, parentCommentId = null, spoilerWarning = false) {
    try {
      console.log('💬 Creating comment on activity:', activityId);

      // Validate input
      if (!activityId || !userId || !content?.trim()) {
        throw new Error('Activity ID, user ID, and content are required');
      }

      if (content.trim().length > 1000) {
        throw new Error('Comment cannot exceed 1000 characters');
      }

      // Check if user can comment (must be friends with activity author or own activity)
      const canComment = await this.canUserComment(activityId, userId);
      if (!canComment) {
        throw new Error('You can only comment on activities from friends');
      }

      // Create comment document
      const comment = {
        activityId,
        userId,
        content: content.trim(),
        parentCommentId,
        spoilerWarning,
        visibility: CommentService.VISIBILITY_LEVELS.FRIENDS_ONLY,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        likes: 0,
        replies: 0,
        edited: false,
        editedAt: null
      };

      // Use batch to ensure atomicity
      const batch = this.db.batch();

      // Add comment
      const commentRef = this.db.collection('activity_comments').doc();
      batch.set(commentRef, comment);

      // Increment comment count on activity
      const activityRef = this.db.collection('activities').doc(activityId);
      batch.update(activityRef, {
        comments: firebase.firestore.FieldValue.increment(1)
      });

      // If this is a reply, increment reply count on parent comment
      if (parentCommentId) {
        const parentCommentRef = this.db.collection('activity_comments').doc(parentCommentId);
        batch.update(parentCommentRef, {
          replies: firebase.firestore.FieldValue.increment(1)
        });
      }

      await batch.commit();

      console.log('✅ Comment created successfully:', commentRef.id);
      return { ...comment, id: commentRef.id };

    } catch (error) {
      console.error('❌ Error creating comment:', error);
      throw error;
    }
  }

  /**
   * Check if user can comment on an activity
   * Privacy rule: Can comment if you're friends with activity author or it's your own activity
   */
  async canUserComment(activityId, userId) {
    try {
      // Get activity to find author
      const activityDoc = await this.db.collection('activities').doc(activityId).get();
      if (!activityDoc.exists) {
        return false;
      }

      const activity = activityDoc.data();
      const activityAuthorId = activity.userId;

      // Can always comment on your own activities
      if (activityAuthorId === userId) {
        return true;
      }

      // Check if user is friends with activity author
      const areFriends = await FollowService.isFollowing(userId, activityAuthorId) &&
                        await FollowService.isFollowing(activityAuthorId, userId);

      return areFriends;

    } catch (error) {
      console.error('❌ Error checking comment permission:', error);
      return false;
    }
  }

  /**
   * Get comments for an activity
   * Returns only comments visible to the requesting user
   */
  async getCommentsForActivity(activityId, userId, limit = 20, lastDoc = null) {
    try {
      console.log('💬 Getting comments for activity:', activityId);

      // Build query for top-level comments first
      let query = this.db
        .collection('activity_comments')
        .where('activityId', '==', activityId)
        .where('parentCommentId', '==', null)
        .orderBy('timestamp', 'desc');

      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }

      const snapshot = await query.limit(limit).get();
      const comments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date()
      }));

      // Filter comments based on visibility and friendship
      const visibleComments = await this.filterVisibleComments(comments, userId);

      // Enrich with user data
      const enrichedComments = await this.enrichCommentsWithUserData(visibleComments);

      // Get recent replies for each comment (limit 3 per comment)
      const commentsWithReplies = await this.addRecentRepliesToComments(enrichedComments, userId);

      console.log(`✅ Retrieved ${commentsWithReplies.length} comments for activity`);
      return {
        comments: commentsWithReplies,
        lastDoc: snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null
      };

    } catch (error) {
      console.error('❌ Error getting comments:', error);
      return { comments: [], lastDoc: null };
    }
  }

  /**
   * Filter comments based on visibility rules and friendship status
   */
  async filterVisibleComments(comments, userId) {
    if (!userId || comments.length === 0) {
      return [];
    }

    try {
      // Get friendship status for all comment authors
      const authorIds = [...new Set(comments.map(c => c.userId))];
      const friendshipChecks = await Promise.all(
        authorIds.map(async (authorId) => {
          if (authorId === userId) return { authorId, canView: true };
          
          // Check mutual friendship
          const areFriends = await FollowService.isFollowing(userId, authorId) &&
                            await FollowService.isFollowing(authorId, userId);
          
          return { authorId, canView: areFriends };
        })
      );

      // Create lookup map
      const friendshipMap = friendshipChecks.reduce((map, check) => {
        map[check.authorId] = check.canView;
        return map;
      }, {});

      // Filter comments based on visibility
      return comments.filter(comment => {
        if (comment.visibility === CommentService.VISIBILITY_LEVELS.FRIENDS_ONLY) {
          return friendshipMap[comment.userId] || false;
        }
        return true; // Future: handle other visibility levels
      });

    } catch (error) {
      console.error('❌ Error filtering visible comments:', error);
      return []; // Fail closed - show no comments if error
    }
  }

  /**
   * Enrich comments with user profile data
   */
  async enrichCommentsWithUserData(comments) {
    if (comments.length === 0) return comments;

    try {
      // Get unique user IDs
      const userIds = [...new Set(comments.map(comment => comment.userId))];
      
      // Fetch user data in chunks
      const chunks = this.chunkArray(userIds, 10);
      let allUsers = [];

      for (const chunk of chunks) {
        const usersSnapshot = await this.db
          .collection('users')
          .where(firebase.firestore.FieldPath.documentId(), 'in', chunk)
          .get();

        const users = usersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        allUsers = allUsers.concat(users);
      }

      // Create user lookup map
      const userMap = allUsers.reduce((map, user) => {
        map[user.id] = user;
        return map;
      }, {});

      // Enrich comments with user data
      return comments.map(comment => ({
        ...comment,
        user: userMap[comment.userId] || {
          id: comment.userId,
          displayName: 'Unknown User',
          username: null,
          profilePicture: null
        }
      }));

    } catch (error) {
      console.error('❌ Error enriching comments with user data:', error);
      return comments;
    }
  }

  /**
   * Add recent replies to each comment (for threading preview)
   */
  async addRecentRepliesToComments(comments, userId, repliesPerComment = 3) {
    if (comments.length === 0) return comments;

    try {
      const commentsWithReplies = await Promise.all(
        comments.map(async (comment) => {
          if (comment.replies === 0) {
            return { ...comment, recentReplies: [] };
          }

          // Get recent replies for this comment
          const repliesSnapshot = await this.db
            .collection('activity_comments')
            .where('parentCommentId', '==', comment.id)
            .orderBy('timestamp', 'desc')
            .limit(repliesPerComment)
            .get();

          const replies = repliesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp?.toDate() || new Date()
          }));

          // Filter and enrich replies
          const visibleReplies = await this.filterVisibleComments(replies, userId);
          const enrichedReplies = await this.enrichCommentsWithUserData(visibleReplies);

          return {
            ...comment,
            recentReplies: enrichedReplies
          };
        })
      );

      return commentsWithReplies;

    } catch (error) {
      console.error('❌ Error adding replies to comments:', error);
      return comments.map(comment => ({ ...comment, recentReplies: [] }));
    }
  }

  /**
   * Like/unlike a comment
   */
  async toggleCommentLike(commentId, userId) {
    try {
      const likeRef = this.db.collection('comment_likes').doc(`${commentId}_${userId}`);
      const commentRef = this.db.collection('activity_comments').doc(commentId);

      await this.db.runTransaction(async (transaction) => {
        const likeDoc = await transaction.get(likeRef);
        
        if (likeDoc.exists) {
          // Unlike
          transaction.delete(likeRef);
          transaction.update(commentRef, {
            likes: firebase.firestore.FieldValue.increment(-1)
          });
          return { liked: false };
        } else {
          // Like
          transaction.set(likeRef, {
            commentId,
            userId,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
          });
          transaction.update(commentRef, {
            likes: firebase.firestore.FieldValue.increment(1)
          });
          return { liked: true };
        }
      });

      console.log('✅ Comment like toggled successfully');
    } catch (error) {
      console.error('❌ Error toggling comment like:', error);
      throw error;
    }
  }

  /**
   * Check if user has liked a comment
   */
  async hasUserLikedComment(commentId, userId) {
    try {
      const likeDoc = await this.db
        .collection('comment_likes')
        .doc(`${commentId}_${userId}`)
        .get();

      return likeDoc.exists;
    } catch (error) {
      console.error('❌ Error checking comment like:', error);
      return false;
    }
  }

  /**
   * Delete a comment (author only)
   */
  async deleteComment(commentId, userId) {
    try {
      console.log('🗑️ Deleting comment:', commentId);

      const commentDoc = await this.db.collection('activity_comments').doc(commentId).get();
      if (!commentDoc.exists) {
        throw new Error('Comment not found');
      }

      const comment = commentDoc.data();
      
      // Only author can delete their comment
      if (comment.userId !== userId) {
        throw new Error('You can only delete your own comments');
      }

      const batch = this.db.batch();

      // Delete comment
      batch.delete(commentDoc.ref);

      // Decrement comment count on activity
      const activityRef = this.db.collection('activities').doc(comment.activityId);
      batch.update(activityRef, {
        comments: firebase.firestore.FieldValue.increment(-1)
      });

      // If this is a reply, decrement reply count on parent
      if (comment.parentCommentId) {
        const parentCommentRef = this.db.collection('activity_comments').doc(comment.parentCommentId);
        batch.update(parentCommentRef, {
          replies: firebase.firestore.FieldValue.increment(-1)
        });
      }

      // Delete all likes on this comment
      const likesSnapshot = await this.db
        .collection('comment_likes')
        .where('commentId', '==', commentId)
        .get();
      
      likesSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      console.log('✅ Comment deleted successfully');

    } catch (error) {
      console.error('❌ Error deleting comment:', error);
      throw error;
    }
  }

  /**
   * Utility function to chunk array for Firestore 'in' queries
   */
  chunkArray(array, chunkSize) {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Report inappropriate comment content
   */
  async reportComment(commentId, userId, reason = 'inappropriate') {
    try {
      const reportRef = this.db.collection('comment_reports').doc();
      await reportRef.set({
        commentId,
        reportedBy: userId,
        reason,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'pending' // 'pending', 'reviewed', 'resolved'
      });

      console.log('✅ Comment reported successfully');
    } catch (error) {
      console.error('❌ Error reporting comment:', error);
      throw error;
    }
  }
}

export default new CommentService();