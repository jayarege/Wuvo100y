import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
  Switch
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import CommentService from '../services/CommentService';

/**
 * CommentModal - Friend-Only Comment Interface
 * 
 * CODE_BIBLE Commandment #3: Clear and obvious UI interactions
 * - Single modal handles both viewing and creating comments
 * - Clear visual hierarchy with user avatars and timestamps
 * - Obvious friend-only messaging and spoiler warnings
 */
function CommentModal({
  visible,
  onClose,
  activity,
  currentUser,
  isDarkMode
}) {
  const [comments, setComments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [spoilerWarning, setSpoilerWarning] = useState(false);
  const [replyToComment, setReplyToComment] = useState(null);
  const [likedComments, setLikedComments] = useState(new Set());

  const colors = {
    background: isDarkMode ? '#1C2526' : '#FFFFFF',
    modal: isDarkMode ? '#2A2F30' : '#F8F9FA',
    text: isDarkMode ? '#F5F5F5' : '#333',
    subtext: isDarkMode ? '#D3D3D3' : '#666',
    accent: isDarkMode ? '#FFD700' : '#4B0082',
    input: isDarkMode ? '#3D4344' : '#F0F0F0',
    border: isDarkMode ? '#8A2BE2' : '#E0E0E0',
    danger: '#FF6B6B',
    success: '#4CAF50',
    warning: '#FF9800'
  };

  const loadComments = useCallback(async () => {
    if (!activity?.id || !currentUser?.id) return;

    setIsLoading(true);
    try {
      console.log('💬 Loading comments for activity:', activity.id);
      const result = await CommentService.getCommentsForActivity(
        activity.id,
        currentUser.id,
        20
      );
      
      setComments(result.comments);
      
      // Load like status for comments
      if (result.comments.length > 0) {
        await loadCommentLikes(result.comments);
      }

    } catch (error) {
      console.error('❌ Error loading comments:', error);
      Alert.alert('Error', 'Failed to load comments. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [activity?.id, currentUser?.id]);

  const loadCommentLikes = async (commentsToCheck) => {
    if (!currentUser?.id) return;

    try {
      const likePromises = commentsToCheck.map(comment =>
        CommentService.hasUserLikedComment(comment.id, currentUser.id)
      );

      const likeResults = await Promise.all(likePromises);
      const newLikedComments = new Set();

      commentsToCheck.forEach((comment, index) => {
        if (likeResults[index]) {
          newLikedComments.add(comment.id);
        }
      });

      setLikedComments(newLikedComments);
    } catch (error) {
      console.error('❌ Error loading comment likes:', error);
    }
  };

  useEffect(() => {
    if (visible) {
      loadComments();
    } else {
      // Reset state when modal closes
      setComments([]);
      setNewComment('');
      setSpoilerWarning(false);
      setReplyToComment(null);
      setLikedComments(new Set());
    }
  }, [visible, loadComments]);

  const handleSubmitComment = async () => {
    if (!newComment.trim()) {
      Alert.alert('Error', 'Please enter a comment');
      return;
    }

    if (!currentUser?.id) {
      Alert.alert('Error', 'You must be signed in to comment');
      return;
    }

    setIsSubmitting(true);
    try {
      await CommentService.createComment(
        activity.id,
        currentUser.id,
        newComment,
        replyToComment?.id || null,
        spoilerWarning
      );

      setNewComment('');
      setSpoilerWarning(false);
      setReplyToComment(null);
      
      // Reload comments to show new comment
      await loadComments();
      
      console.log('✅ Comment submitted successfully');
    } catch (error) {
      console.error('❌ Error submitting comment:', error);
      
      // Show user-friendly error message based on error type
      if (error.message.includes('friends')) {
        Alert.alert(
          'Comments Limited to Friends',
          'You can only comment on activities from people you follow and who follow you back.'
        );
      } else if (error.message.includes('characters')) {
        Alert.alert('Comment Too Long', 'Comments cannot exceed 1000 characters.');
      } else {
        Alert.alert('Error', 'Failed to post comment. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLikeComment = async (commentId) => {
    if (!currentUser?.id) return;

    try {
      await CommentService.toggleCommentLike(commentId, currentUser.id);
      
      // Update local state optimistically
      const newLikedComments = new Set(likedComments);
      const wasLiked = likedComments.has(commentId);

      if (wasLiked) {
        newLikedComments.delete(commentId);
      } else {
        newLikedComments.add(commentId);
      }

      setLikedComments(newLikedComments);

      // Update comment like count optimistically
      setComments(prev => prev.map(comment => {
        if (comment.id === commentId) {
          return {
            ...comment,
            likes: wasLiked ? comment.likes - 1 : comment.likes + 1
          };
        }
        return comment;
      }));

    } catch (error) {
      console.error('❌ Error liking comment:', error);
      Alert.alert('Error', 'Failed to like comment. Please try again.');
    }
  };

  const handleReply = (comment) => {
    setReplyToComment(comment);
    setNewComment(`@${comment.user.username || comment.user.displayName} `);
  };

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

  const renderComment = (comment, isReply = false) => (
    <View
      key={comment.id}
      style={[
        styles.commentItem,
        isReply && styles.replyItem,
        { backgroundColor: colors.background, borderBottomColor: colors.border }
      ]}
    >
      {/* User Header */}
      <View style={styles.commentHeader}>
        <View style={[styles.avatar, { borderColor: colors.border }]}>
          {comment.user.profilePicture ? (
            <Image
              source={{ uri: comment.user.profilePicture }}
              style={styles.avatarImage}
              resizeMode="cover"
            />
          ) : (
            <Ionicons name="person" size={20} color={colors.subtext} />
          )}
        </View>
        
        <View style={styles.commentInfo}>
          <View style={styles.userInfo}>
            <Text style={[styles.userName, { color: colors.text }]}>
              {comment.user.displayName}
            </Text>
            {comment.user.username && (
              <Text style={[styles.userHandle, { color: colors.subtext }]}>
                @{comment.user.username}
              </Text>
            )}
            <Text style={[styles.timestamp, { color: colors.subtext }]}>
              {formatTimestamp(comment.timestamp)}
            </Text>
          </View>
          
          {comment.spoilerWarning && (
            <View style={[styles.spoilerWarning, { backgroundColor: colors.warning }]}>
              <Ionicons name="warning" size={12} color="#FFFFFF" />
              <Text style={styles.spoilerText}>Spoiler Warning</Text>
            </View>
          )}
        </View>
      </View>

      {/* Comment Content */}
      <Text style={[styles.commentText, { color: colors.text }]}>
        {comment.content}
      </Text>

      {/* Comment Actions */}
      <View style={styles.commentActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleLikeComment(comment.id)}
        >
          <Ionicons
            name={likedComments.has(comment.id) ? 'heart' : 'heart-outline'}
            size={18}
            color={likedComments.has(comment.id) ? colors.danger : colors.subtext}
          />
          <Text style={[
            styles.actionText,
            { color: likedComments.has(comment.id) ? colors.danger : colors.subtext }
          ]}>
            {comment.likes || 0}
          </Text>
        </TouchableOpacity>

        {!isReply && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleReply(comment)}
          >
            <Ionicons name="chatbubble-outline" size={18} color={colors.subtext} />
            <Text style={[styles.actionText, { color: colors.subtext }]}>
              Reply
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Recent Replies */}
      {comment.recentReplies && comment.recentReplies.length > 0 && (
        <View style={styles.repliesContainer}>
          {comment.recentReplies.map(reply => renderComment(reply, true))}
          {comment.replies > comment.recentReplies.length && (
            <TouchableOpacity style={styles.moreRepliesButton}>
              <Text style={[styles.moreRepliesText, { color: colors.accent }]}>
                View {comment.replies - comment.recentReplies.length} more replies
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="chatbubbles-outline" size={64} color={colors.subtext} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        No Comments Yet
      </Text>
      <Text style={[styles.emptyText, { color: colors.subtext }]}>
        Be the first to comment on this activity
      </Text>
      <Text style={[styles.friendsOnlyNote, { color: colors.subtext }]}>
        Only friends can see and comment here
      </Text>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: colors.modal }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Comments
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Movie Info */}
        <View style={[styles.movieInfo, { borderBottomColor: colors.border }]}>
          <Text style={[styles.movieTitle, { color: colors.text }]}>
            {activity?.data?.movieTitle || 'Activity'}
          </Text>
          <Text style={[styles.friendsOnlyBadge, { color: colors.accent }]}>
            👥 Friends Only
          </Text>
        </View>

        {/* Comments List */}
        <ScrollView
          style={styles.commentsList}
          showsVerticalScrollIndicator={false}
        >
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={[styles.loadingText, { color: colors.subtext }]}>
                Loading comments...
              </Text>
            </View>
          ) : comments.length === 0 ? (
            renderEmptyState()
          ) : (
            comments.map(comment => renderComment(comment))
          )}
        </ScrollView>

        {/* Comment Input */}
        <View style={[styles.inputContainer, { borderTopColor: colors.border }]}>
          {replyToComment && (
            <View style={[styles.replyIndicator, { backgroundColor: colors.input }]}>
              <Text style={[styles.replyingTo, { color: colors.subtext }]}>
                Replying to @{replyToComment.user.username || replyToComment.user.displayName}
              </Text>
              <TouchableOpacity onPress={() => setReplyToComment(null)}>
                <Ionicons name="close-circle" size={20} color={colors.subtext} />
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.inputRow}>
            <TextInput
              style={[
                styles.textInput,
                { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }
              ]}
              placeholder="Add a comment..."
              placeholderTextColor={colors.subtext}
              value={newComment}
              onChangeText={setNewComment}
              multiline
              maxLength={1000}
              editable={!isSubmitting}
            />
            
            <TouchableOpacity
              style={[
                styles.submitButton,
                { backgroundColor: newComment.trim() ? colors.accent : colors.border }
              ]}
              onPress={handleSubmitComment}
              disabled={!newComment.trim() || isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="send" size={20} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>

          {/* Spoiler Warning Toggle */}
          <View style={styles.spoilerToggle}>
            <View style={styles.spoilerInfo}>
              <Ionicons name="warning-outline" size={16} color={colors.warning} />
              <Text style={[styles.spoilerLabel, { color: colors.text }]}>
                Contains spoilers
              </Text>
            </View>
            <Switch
              value={spoilerWarning}
              onValueChange={setSpoilerWarning}
              trackColor={{ false: colors.border, true: colors.warning }}
              thumbColor={spoilerWarning ? colors.warning : colors.subtext}
            />
          </View>
        </View>
      </View>
    </Modal>
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
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 32,
  },
  movieInfo: {
    padding: 16,
    borderBottomWidth: 1,
  },
  movieTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  friendsOnlyBadge: {
    fontSize: 14,
    fontWeight: '600',
  },
  commentsList: {
    flex: 1,
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
  commentItem: {
    padding: 16,
    borderBottomWidth: 1,
  },
  replyItem: {
    marginLeft: 32,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: '#E0E0E0',
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 15,
  },
  commentInfo: {
    flex: 1,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  userName: {
    fontSize: 14,
    fontWeight: 'bold',
    marginRight: 8,
  },
  userHandle: {
    fontSize: 12,
    marginRight: 8,
  },
  timestamp: {
    fontSize: 12,
  },
  spoilerWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  spoilerText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  commentText: {
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 12,
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 24,
    paddingVertical: 4,
  },
  actionText: {
    fontSize: 13,
    marginLeft: 6,
    fontWeight: '500',
  },
  repliesContainer: {
    marginTop: 12,
  },
  moreRepliesButton: {
    paddingVertical: 8,
    paddingLeft: 44,
  },
  moreRepliesText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
  friendsOnlyNote: {
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  inputContainer: {
    borderTopWidth: 1,
    padding: 16,
  },
  replyIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  replyingTo: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    marginRight: 12,
    maxHeight: 100,
  },
  submitButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spoilerToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  spoilerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  spoilerLabel: {
    fontSize: 14,
    marginLeft: 8,
  },
});

export default CommentModal;