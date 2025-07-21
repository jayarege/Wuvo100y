import firebase from '../config/firebase';
import FollowService from './FollowService';

class ActivityFeedService {
  constructor() {
    this.db = firebase.firestore();
  }

  // Activity types for the feed
  static ACTIVITY_TYPES = {
    MOVIE_RATED: 'movie_rated',
    MOVIE_ADDED_TO_WATCHLIST: 'movie_added_to_watchlist',
    MOVIE_WATCHED: 'movie_watched',
    USER_FOLLOWED: 'user_followed',
    REVIEW_POSTED: 'review_posted',
    LIST_CREATED: 'list_created',
    LIST_SHARED: 'list_shared'
  };

  // Create a new activity entry
  async createActivity(userId, activityType, data) {
    try {
      console.log('📝 Creating activity:', activityType, 'for user:', userId);

      const activity = {
        userId,
        type: activityType,
        data: data,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        visibility: 'public', // 'public', 'friends', 'private'
        likes: 0,
        comments: 0,
        id: null // Will be set by Firestore
      };

      const docRef = await this.db.collection('activities').add(activity);
      activity.id = docRef.id;

      console.log('✅ Activity created successfully:', docRef.id);
      return activity;
    } catch (error) {
      console.error('❌ Error creating activity:', error);
      throw error;
    }
  }

  // Create activity for movie rating
  async createMovieRatingActivity(userId, movieData, rating, review = null) {
    const activityData = {
      movieId: movieData.id,
      movieTitle: movieData.title,
      moviePoster: movieData.poster_path,
      movieYear: movieData.release_date ? new Date(movieData.release_date).getFullYear() : null,
      rating: rating,
      review: review,
      tmdbRating: movieData.vote_average
    };

    return this.createActivity(userId, ActivityFeedService.ACTIVITY_TYPES.MOVIE_RATED, activityData);
  }

  // Create activity for adding movie to watchlist
  async createWatchlistActivity(userId, movieData) {
    const activityData = {
      movieId: movieData.id,
      movieTitle: movieData.title,
      moviePoster: movieData.poster_path,
      movieYear: movieData.release_date ? new Date(movieData.release_date).getFullYear() : null
    };

    return this.createActivity(userId, ActivityFeedService.ACTIVITY_TYPES.MOVIE_ADDED_TO_WATCHLIST, activityData);
  }

  // Create activity for following a user
  async createFollowActivity(userId, followedUserId, followedUserData) {
    const activityData = {
      followedUserId: followedUserId,
      followedUsername: followedUserData.username,
      followedDisplayName: followedUserData.displayName,
      followedProfilePicture: followedUserData.profilePicture
    };

    return this.createActivity(userId, ActivityFeedService.ACTIVITY_TYPES.USER_FOLLOWED, activityData);
  }

  // Get activity feed for a user (shows activities from people they follow)
  async getFeedForUser(userId, limit = 20, lastDoc = null) {
    try {
      console.log('📰 Getting feed for user:', userId);

      // Get list of users that current user follows
      const following = await FollowService.getFollowing(userId, 100);
      const followingIds = following.map(user => user.id);
      
      // Include own activities in feed
      followingIds.push(userId);

      if (followingIds.length === 0) {
        return { activities: [], lastDoc: null };
      }

      // Get activities from followed users (Firestore 'in' query limit is 10)
      const chunks = this.chunkArray(followingIds, 10);
      let allActivities = [];

      for (const chunk of chunks) {
        let query = this.db
          .collection('activities')
          .where('userId', 'in', chunk)
          .where('visibility', '==', 'public')
          .orderBy('timestamp', 'desc');

        if (lastDoc) {
          query = query.startAfter(lastDoc);
        }

        const snapshot = await query.limit(Math.ceil(limit / chunks.length)).get();
        const activities = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate() || new Date()
        }));

        allActivities = allActivities.concat(activities);
      }

      // Sort by timestamp and limit
      allActivities.sort((a, b) => b.timestamp - a.timestamp);
      allActivities = allActivities.slice(0, limit);

      // Get user data for activities
      const activitiesWithUsers = await this.enrichActivitiesWithUserData(allActivities);

      console.log(`✅ Retrieved ${activitiesWithUsers.length} activities for feed`);
      return {
        activities: activitiesWithUsers,
        lastDoc: allActivities.length > 0 ? allActivities[allActivities.length - 1] : null
      };

    } catch (error) {
      console.error('❌ Error getting feed:', error);
      return { activities: [], lastDoc: null };
    }
  }

  // Get activities for a specific user (their profile activity)
  async getUserActivities(userId, limit = 20, lastDoc = null) {
    try {
      console.log('👤 Getting activities for user:', userId);

      let query = this.db
        .collection('activities')
        .where('userId', '==', userId)
        .where('visibility', 'in', ['public', 'friends'])
        .orderBy('timestamp', 'desc');

      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }

      const snapshot = await query.limit(limit).get();
      const activities = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date()
      }));

      // Get user data for activities
      const activitiesWithUsers = await this.enrichActivitiesWithUserData(activities);

      return {
        activities: activitiesWithUsers,
        lastDoc: snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null
      };

    } catch (error) {
      console.error('❌ Error getting user activities:', error);
      return { activities: [], lastDoc: null };
    }
  }

  // Enrich activities with user profile data
  async enrichActivitiesWithUserData(activities) {
    if (activities.length === 0) return activities;

    try {
      // Get unique user IDs
      const userIds = [...new Set(activities.map(activity => activity.userId))];
      
      // Fetch user data in chunks (Firestore 'in' limit)
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

      // Enrich activities with user data
      return activities.map(activity => ({
        ...activity,
        user: userMap[activity.userId] || {
          id: activity.userId,
          displayName: 'Unknown User',
          username: null,
          profilePicture: null
        }
      }));

    } catch (error) {
      console.error('❌ Error enriching activities with user data:', error);
      return activities;
    }
  }

  // Like an activity
  async likeActivity(activityId, userId) {
    try {
      const likeRef = this.db.collection('activity_likes').doc(`${activityId}_${userId}`);
      const activityRef = this.db.collection('activities').doc(activityId);

      await this.db.runTransaction(async (transaction) => {
        const likeDoc = await transaction.get(likeRef);
        
        if (likeDoc.exists) {
          // Unlike
          transaction.delete(likeRef);
          transaction.update(activityRef, {
            likes: firebase.firestore.FieldValue.increment(-1)
          });
          return { liked: false };
        } else {
          // Like
          transaction.set(likeRef, {
            activityId,
            userId,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
          });
          transaction.update(activityRef, {
            likes: firebase.firestore.FieldValue.increment(1)
          });
          return { liked: true };
        }
      });

      console.log('✅ Activity like toggled successfully');
    } catch (error) {
      console.error('❌ Error toggling activity like:', error);
      throw error;
    }
  }

  // Check if user has liked an activity
  async hasUserLikedActivity(activityId, userId) {
    try {
      const likeDoc = await this.db
        .collection('activity_likes')
        .doc(`${activityId}_${userId}`)
        .get();

      return likeDoc.exists;
    } catch (error) {
      console.error('❌ Error checking activity like:', error);
      return false;
    }
  }

  // Get trending movies based on recent activity
  async getTrendingMovies(limit = 10, timeframeHours = 24) {
    try {
      const timeframeStart = new Date();
      timeframeStart.setHours(timeframeStart.getHours() - timeframeHours);

      const snapshot = await this.db
        .collection('activities')
        .where('type', '==', ActivityFeedService.ACTIVITY_TYPES.MOVIE_RATED)
        .where('timestamp', '>=', timeframeStart)
        .get();

      // Count movie ratings and calculate trending score
      const movieStats = {};
      
      snapshot.docs.forEach(doc => {
        const activity = doc.data();
        const movieId = activity.data.movieId;
        
        if (!movieStats[movieId]) {
          movieStats[movieId] = {
            movieId,
            movieTitle: activity.data.movieTitle,
            moviePoster: activity.data.moviePoster,
            movieYear: activity.data.movieYear,
            ratingCount: 0,
            totalRating: 0,
            averageRating: 0
          };
        }
        
        movieStats[movieId].ratingCount++;
        movieStats[movieId].totalRating += activity.data.rating;
        movieStats[movieId].averageRating = movieStats[movieId].totalRating / movieStats[movieId].ratingCount;
      });

      // Sort by rating count and average rating
      const trending = Object.values(movieStats)
        .filter(movie => movie.ratingCount >= 2) // Minimum 2 ratings to be trending
        .sort((a, b) => {
          // Weighted score: rating count * average rating
          const scoreA = a.ratingCount * a.averageRating;
          const scoreB = b.ratingCount * b.averageRating;
          return scoreB - scoreA;
        })
        .slice(0, limit);

      return trending;
    } catch (error) {
      console.error('❌ Error getting trending movies:', error);
      return [];
    }
  }

  // Utility function to chunk array for Firestore 'in' queries
  chunkArray(array, chunkSize) {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  // Delete user's activity (for privacy/account deletion)
  async deleteUserActivities(userId) {
    try {
      const batch = this.db.batch();
      
      const activities = await this.db
        .collection('activities')
        .where('userId', '==', userId)
        .get();

      activities.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      console.log(`✅ Deleted ${activities.docs.length} activities for user:`, userId);
    } catch (error) {
      console.error('❌ Error deleting user activities:', error);
      throw error;
    }
  }
}

export default new ActivityFeedService();