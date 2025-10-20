import firebase from '../config/firebase';

// Fake dev users for Firebase seeding - identical to production user structure
const FAKE_DEV_USERS = [
  { 
    uid: 'alice-cooper-dev', 
    email: 'alice.cooper.dev@wuvo.com',
    displayName: 'Alice Cooper', 
    username: 'alice_movie_fan', 
    profilePicture: 'https://via.placeholder.com/150x150?text=AC&bg=FF6B6B&color=white', 
    followerCount: 1250, 
    followingCount: 342,
    ratingCount: 342, 
    mutualFollowCount: 5,
    isPublic: true,
    searchable: true,
    bio: 'Movie enthusiast and horror film connoisseur 🎬 Love discovering hidden gems and classic horror films!',
    joinDate: '2023-01-15',
    lastActive: new Date().toISOString(),
    preferences: {
      showRatings: true,
      showWatchlist: true,
      enableSocialRecommendations: true,
      enableFriendComments: true,
      showRatingsToFriends: true,
      showWatchlistToFriends: true,
      allowFriendActivityTracking: true,
      publicProfile: true,
      searchableProfile: true
    },
    stats: {
      totalRatings: 342,
      averageRating: 7.2,
      favoriteGenres: ['Horror', 'Thriller', 'Drama'],
      topRatedMovie: 'The Exorcist',
      recentActivity: new Date().toISOString()
    }
  },
  { 
    uid: 'bob-smith-dev', 
    email: 'bob.smith.dev@wuvo.com',
    displayName: 'Bob Smith', 
    username: 'bob_cinephile', 
    profilePicture: 'https://via.placeholder.com/150x150?text=BS&bg=4ECDC4&color=white', 
    followerCount: 890, 
    followingCount: 234,
    ratingCount: 567, 
    mutualFollowCount: 3,
    isPublic: true,
    searchable: true,
    bio: 'Classic cinema lover and film critic 🎭 Writing reviews since 2018. Criterion Collection enthusiast.',
    joinDate: '2022-11-08',
    lastActive: new Date().toISOString(),
    preferences: {
      showRatings: true,
      showWatchlist: false, // Private watchlist
      enableSocialRecommendations: true,
      enableFriendComments: true,
      showRatingsToFriends: true,
      showWatchlistToFriends: false,
      allowFriendActivityTracking: true,
      publicProfile: true,
      searchableProfile: true
    },
    stats: {
      totalRatings: 567,
      averageRating: 8.1,
      favoriteGenres: ['Drama', 'Film-Noir', 'Foreign'],
      topRatedMovie: 'Citizen Kane',
      recentActivity: new Date().toISOString()
    }
  },
  { 
    uid: 'carol-davis-dev', 
    email: 'carol.davis.dev@wuvo.com',
    displayName: 'Carol Davis', 
    username: 'carol_reviews', 
    profilePicture: 'https://via.placeholder.com/150x150?text=CD&bg=45B7D1&color=white', 
    followerCount: 2100, 
    followingCount: 456,
    ratingCount: 789, 
    mutualFollowCount: 8,
    isPublic: true,
    searchable: true,
    bio: 'Professional movie reviewer and awards show predictor 🏆 Featured in MovieScope Magazine. Oscar predictions specialist.',
    joinDate: '2022-03-22',
    lastActive: new Date().toISOString(),
    preferences: {
      showRatings: true,
      showWatchlist: true,
      enableSocialRecommendations: true,
      enableFriendComments: true,
      showRatingsToFriends: true,
      showWatchlistToFriends: true,
      allowFriendActivityTracking: true,
      publicProfile: true,
      searchableProfile: true
    },
    stats: {
      totalRatings: 789,
      averageRating: 7.8,
      favoriteGenres: ['Drama', 'Biography', 'Awards Contenders'],
      topRatedMovie: 'Parasite',
      recentActivity: new Date().toISOString()
    }
  },
  { 
    uid: 'david-wilson-dev', 
    email: 'david.wilson.dev@wuvo.com',
    displayName: 'David Wilson', 
    username: 'david_films', 
    profilePicture: 'https://via.placeholder.com/150x150?text=DW&bg=96CEB4&color=white', 
    followerCount: 450, 
    followingCount: 123,
    ratingCount: 234, 
    mutualFollowCount: 2,
    isPublic: true,
    searchable: true,
    bio: 'Indie film discoverer and documentary specialist 📹 Sundance Film Festival regular. Love stories that challenge perspectives.',
    joinDate: '2023-06-10',
    lastActive: new Date().toISOString(),
    preferences: {
      showRatings: true,
      showWatchlist: true,
      enableSocialRecommendations: false, // Prefers discovering on his own
      enableFriendComments: true,
      showRatingsToFriends: true,
      showWatchlistToFriends: false, // Keeps watchlist private
      allowFriendActivityTracking: false,
      publicProfile: true,
      searchableProfile: true
    },
    stats: {
      totalRatings: 234,
      averageRating: 8.4, // High standards for indie films
      favoriteGenres: ['Documentary', 'Independent', 'Foreign'],
      topRatedMovie: 'Nomadland',
      recentActivity: new Date().toISOString()
    }
  },
  { 
    uid: 'emma-johnson-dev', 
    email: 'emma.johnson.dev@wuvo.com',
    displayName: 'Emma Johnson', 
    username: 'emma_movie_buff', 
    profilePicture: 'https://via.placeholder.com/150x150?text=EJ&bg=FFEAA7&color=black', 
    followerCount: 1680, 
    followingCount: 892,
    ratingCount: 456, 
    mutualFollowCount: 7,
    isPublic: true,
    searchable: true,
    bio: 'Marvel fanatic and popcorn movie enthusiast 🍿 Collector of movie memorabilia. Always up for a good action flick!',
    joinDate: '2022-09-03',
    lastActive: new Date().toISOString(),
    preferences: {
      showRatings: true,
      showWatchlist: true,
      enableSocialRecommendations: true,
      enableFriendComments: true,
      showRatingsToFriends: true,
      showWatchlistToFriends: true,
      allowFriendActivityTracking: true,
      publicProfile: true,
      searchableProfile: true
    },
    stats: {
      totalRatings: 456,
      averageRating: 7.6,
      favoriteGenres: ['Action', 'Superhero', 'Adventure'],
      topRatedMovie: 'Avengers: Endgame',
      recentActivity: new Date().toISOString()
    }
  },
  { 
    uid: 'frank-miller-dev', 
    email: 'frank.miller.dev@wuvo.com',
    displayName: 'Frank Miller', 
    username: 'frank_director', 
    profilePicture: 'https://via.placeholder.com/150x150?text=FM&bg=DDA0DD&color=white', 
    followerCount: 3200, 
    followingCount: 1024,
    ratingCount: 1024, 
    mutualFollowCount: 12,
    isPublic: true,
    searchable: true,
    bio: 'Aspiring director and Criterion Collection collector 🎬 Film school graduate. Working on my first feature. Obsessed with cinematography.',
    joinDate: '2021-12-01',
    lastActive: new Date().toISOString(),
    preferences: {
      showRatings: true,
      showWatchlist: true,
      enableSocialRecommendations: true,
      enableFriendComments: true,
      showRatingsToFriends: true,
      showWatchlistToFriends: true,
      allowFriendActivityTracking: true,
      publicProfile: true,
      searchableProfile: true
    },
    stats: {
      totalRatings: 1024,
      averageRating: 8.2,
      favoriteGenres: ['Drama', 'Art Film', 'Foreign'],
      topRatedMovie: '2001: A Space Odyssey',
      recentActivity: new Date().toISOString()
    }
  }
];

class FirebaseSeeder {
  constructor() {
    this.db = firebase.firestore();
    this.auth = firebase.auth();
  }

  // Seed all fake dev users to Firebase
  async seedFakeUsers() {
    try {
      console.log('🌱 Starting Firebase seeding of fake dev users...');
      
      const batch = this.db.batch();
      let seededCount = 0;

      for (const user of FAKE_DEV_USERS) {
        // Check if user already exists
        const existingUser = await this.db.collection('users').doc(user.uid).get();
        
        if (existingUser.exists) {
          console.log(`⚠️ User ${user.displayName} already exists, skipping...`);
          continue;
        }

        // Add user to batch
        const userRef = this.db.collection('users').doc(user.uid);
        batch.set(userRef, {
          ...user,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        seededCount++;
        console.log(`📝 Queued user: ${user.displayName} (@${user.username})`);
      }

      if (seededCount > 0) {
        // Commit the batch
        await batch.commit();
        console.log(`✅ Successfully seeded ${seededCount} fake dev users to Firebase!`);
      } else {
        console.log('ℹ️ All fake dev users already exist in Firebase');
      }

      return seededCount;

    } catch (error) {
      console.error('❌ Error seeding fake users:', error);
      throw error;
    }
  }

  // Clear all fake dev users from Firebase
  async clearFakeUsers() {
    try {
      console.log('🧹 Clearing fake dev users from Firebase...');
      
      const batch = this.db.batch();
      let clearedCount = 0;

      for (const user of FAKE_DEV_USERS) {
        const userRef = this.db.collection('users').doc(user.uid);
        const userDoc = await userRef.get();
        
        if (userDoc.exists) {
          batch.delete(userRef);
          clearedCount++;
          console.log(`🗑️ Queued for deletion: ${user.displayName}`);
        }
      }

      if (clearedCount > 0) {
        await batch.commit();
        console.log(`✅ Successfully cleared ${clearedCount} fake dev users from Firebase!`);
      } else {
        console.log('ℹ️ No fake dev users found to clear');
      }

      return clearedCount;

    } catch (error) {
      console.error('❌ Error clearing fake users:', error);
      throw error;
    }
  }

  // Reseed - clear and then seed fresh
  async reseedFakeUsers() {
    try {
      console.log('🔄 Reseeding fake dev users...');
      
      await this.clearFakeUsers();
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      const seededCount = await this.seedFakeUsers();
      
      console.log(`🎉 Reseed complete! ${seededCount} users refreshed.`);
      return seededCount;

    } catch (error) {
      console.error('❌ Error reseeding fake users:', error);
      throw error;
    }
  }

  // Get seeded user count for verification
  async getSeededUserCount() {
    try {
      const fakeUserIds = FAKE_DEV_USERS.map(user => user.uid);
      const existingUsers = await Promise.all(
        fakeUserIds.map(uid => this.db.collection('users').doc(uid).get())
      );
      
      const existingCount = existingUsers.filter(doc => doc.exists).length;
      console.log(`📊 Found ${existingCount}/${FAKE_DEV_USERS.length} fake dev users in Firebase`);
      
      return existingCount;

    } catch (error) {
      console.error('❌ Error checking seeded users:', error);
      return 0;
    }
  }

  // Test search functionality with seeded users
  async testSearchWithSeededUsers(searchTerm = 'alice') {
    try {
      console.log(`🔍 Testing search for "${searchTerm}" with Firebase-stored users...`);
      
      // Import UserSearchService dynamically to avoid circular imports
      const UserSearchService = (await import('../services/UserSearchService')).default;
      
      const results = await UserSearchService.searchUsers(searchTerm, 10);
      
      console.log(`✅ Search returned ${results.length} results:`);
      results.forEach(user => {
        console.log(`  - ${user.displayName} (@${user.username})`);
      });

      return results;

    } catch (error) {
      console.error('❌ Error testing search:', error);
      return [];
    }
  }
}

// Export both the singleton instance and the class for different use cases
const seederInstance = new FirebaseSeeder();

// Export useful functions for manual testing
export const seedFakeUsers = () => seederInstance.seedFakeUsers();
export const clearFakeUsers = () => seederInstance.clearFakeUsers();
export const reseedFakeUsers = () => seederInstance.reseedFakeUsers();
export const getSeededUserCount = () => seederInstance.getSeededUserCount();
export const testSearch = (term) => seederInstance.testSearchWithSeededUsers(term);

export default seederInstance;