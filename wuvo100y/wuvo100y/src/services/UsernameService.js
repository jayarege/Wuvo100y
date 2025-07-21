import firebase from '../config/firebase';

class UsernameService {
  constructor() {
    this.db = firebase.firestore();
  }

  // Check if username is available
  async checkUsernameAvailability(username) {
    try {
      // Username validation rules
      if (!this.isValidUsername(username)) {
        return {
          available: false,
          error: 'Username must be 3-20 characters, alphanumeric and underscores only'
        };
      }

      // Normalize username (lowercase, remove @)
      const normalizedUsername = this.normalizeUsername(username);
      
      // Check if username exists in Firestore
      const usernameDoc = await this.db.collection('usernames').doc(normalizedUsername).get();
      
      if (usernameDoc.exists) {
        return {
          available: false,
          error: 'Username is already taken'
        };
      }

      return {
        available: true,
        normalizedUsername: normalizedUsername
      };
    } catch (error) {
      console.error('Error checking username availability:', error);
      return {
        available: false,
        error: 'Error checking username availability. Please try again.'
      };
    }
  }

  // Reserve username for user
  async reserveUsername(username, userId) {
    try {
      const normalizedUsername = this.normalizeUsername(username);
      
      // Double-check availability
      const availability = await this.checkUsernameAvailability(username);
      if (!availability.available) {
        throw new Error(availability.error);
      }

      // Create username reservation
      await this.db.collection('usernames').doc(normalizedUsername).set({
        userId: userId,
        reservedAt: firebase.firestore.FieldValue.serverTimestamp(),
        confirmed: false
      });

      return {
        success: true,
        username: normalizedUsername
      };
    } catch (error) {
      console.error('Error reserving username:', error);
      throw new Error('Failed to reserve username. Please try again.');
    }
  }

  // Confirm username reservation (after profile setup)
  async confirmUsername(username, userId) {
    try {
      const normalizedUsername = this.normalizeUsername(username);
      
      // Update reservation to confirmed
      await this.db.collection('usernames').doc(normalizedUsername).update({
        confirmed: true,
        confirmedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      // Update user profile with username
      await this.db.collection('users').doc(userId).update({
        username: normalizedUsername,
        usernameConfirmedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      return {
        success: true,
        username: normalizedUsername
      };
    } catch (error) {
      console.error('Error confirming username:', error);
      throw new Error('Failed to confirm username. Please try again.');
    }
  }

  // Search users by username
  async searchUsers(searchTerm, limit = 10) {
    try {
      const normalizedSearch = this.normalizeUsername(searchTerm);
      
      // Search for usernames starting with the search term
      const usernamesQuery = await this.db.collection('usernames')
        .where('confirmed', '==', true)
        .orderBy(firebase.firestore.FieldPath.documentId())
        .startAt(normalizedSearch)
        .endAt(normalizedSearch + '\uf8ff')
        .limit(limit)
        .get();

      const userIds = usernamesQuery.docs.map(doc => doc.data().userId);
      
      if (userIds.length === 0) {
        return [];
      }

      // Get user profiles
      const usersQuery = await this.db.collection('users')
        .where(firebase.firestore.FieldPath.documentId(), 'in', userIds)
        .get();

      const users = usersQuery.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      return users;
    } catch (error) {
      console.error('Error searching users:', error);
      return [];
    }
  }

  // Username validation rules
  isValidUsername(username) {
    // Remove @ if present
    const cleanUsername = username.replace('@', '');
    
    // Check length (3-20 characters)
    if (cleanUsername.length < 3 || cleanUsername.length > 20) {
      return false;
    }

    // Check characters (alphanumeric and underscores only)
    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    return usernameRegex.test(cleanUsername);
  }

  // Normalize username (lowercase, remove @)
  normalizeUsername(username) {
    return username.replace('@', '').toLowerCase();
  }

  // Format username for display (@username)
  formatUsername(username) {
    const normalized = this.normalizeUsername(username);
    return `@${normalized}`;
  }

  // Clean up expired reservations (utility function)
  async cleanupExpiredReservations() {
    try {
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);

      const expiredReservations = await this.db.collection('usernames')
        .where('confirmed', '==', false)
        .where('reservedAt', '<', oneDayAgo)
        .get();

      const batch = this.db.batch();
      expiredReservations.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      console.log(`Cleaned up ${expiredReservations.docs.length} expired username reservations`);
    } catch (error) {
      console.error('Error cleaning up expired reservations:', error);
    }
  }
}

export default new UsernameService();