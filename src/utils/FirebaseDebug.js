import firebase from '../config/firebase';
import FirebaseSeeder from './FirebaseSeeder';

// Debug and manually trigger Firebase operations
class FirebaseDebug {
  constructor() {
    this.db = firebase.firestore();
    this.auth = firebase.auth();
  }

  // Test Firebase connection
  async testConnection() {
    try {
      console.log('🔗 Testing Firebase connection...');
      
      // Try to read from a simple collection
      const testDoc = await this.db.collection('test').limit(1).get();
      console.log('✅ Firebase connection successful');
      
      // Check authentication
      const currentUser = this.auth.currentUser;
      console.log('👤 Auth status:', currentUser ? `Logged in as ${currentUser.uid}` : 'Not authenticated');
      
      return true;
    } catch (error) {
      console.error('❌ Firebase connection failed:', error);
      return false;
    }
  }

  // Test Firestore rules by trying to write
  async testFirestoreRules() {
    try {
      console.log('🛡️ Testing Firestore security rules...');
      
      const testRef = this.db.collection('users').doc('test-write-permission');
      await testRef.set({
        testField: 'test value',
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      console.log('✅ Write permission granted');
      
      // Clean up test document
      await testRef.delete();
      console.log('🧹 Test document cleaned up');
      
      return true;
    } catch (error) {
      console.error('❌ Firestore rules test failed:', error.message);
      if (error.code === 'permission-denied') {
        console.log('🚫 Permission denied - check Firestore security rules');
      }
      return false;
    }
  }

  // List existing users in Firebase
  async listExistingUsers() {
    try {
      console.log('📋 Listing existing users in Firebase...');
      
      const users = await this.db
        .collection('users')
        .limit(20)
        .get();
      
      if (users.empty) {
        console.log('📭 No users found in Firebase');
        return [];
      }

      console.log(`👥 Found ${users.docs.length} users:`);
      users.docs.forEach(doc => {
        const data = doc.data();
        console.log(`  - ${data.displayName} (@${data.username || 'no-username'}) [${doc.id}]`);
      });
      
      return users.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('❌ Error listing users:', error);
      return [];
    }
  }

  // Manual seeding with detailed logging
  async manualSeed() {
    try {
      console.log('🌱 Starting manual Firebase seeding...');
      
      // Test connection first
      const connected = await this.testConnection();
      if (!connected) {
        throw new Error('Firebase connection failed');
      }

      // Test write permissions
      const canWrite = await this.testFirestoreRules();
      if (!canWrite) {
        throw new Error('No write permission to Firestore');
      }

      // List existing users
      await this.listExistingUsers();

      // Run the seeder
      const seededCount = await FirebaseSeeder.seedFakeUsers();
      console.log(`🎉 Manual seeding complete! Added ${seededCount} users.`);

      // List users again to confirm
      console.log('📋 Users after seeding:');
      await this.listExistingUsers();

      return seededCount;

    } catch (error) {
      console.error('❌ Manual seeding failed:', error);
      throw error;
    }
  }

  // Test search functionality
  async testSearch(searchTerm = 'alice') {
    try {
      console.log(`🔍 Testing search for "${searchTerm}"...`);
      
      const UserSearchService = (await import('../services/UserSearchService')).default;
      const results = await UserSearchService.searchUsers(searchTerm, 10);
      
      console.log(`✅ Search returned ${results.length} results:`);
      results.forEach(user => {
        console.log(`  - ${user.displayName} (@${user.username})`);
      });

      return results;

    } catch (error) {
      console.error('❌ Search test failed:', error);
      return [];
    }
  }

  // Complete diagnostic
  async runFullDiagnostic() {
    console.log('🏥 Running complete Firebase diagnostic...');
    
    try {
      await this.testConnection();
      await this.testFirestoreRules();
      await this.listExistingUsers();
      await this.manualSeed();
      await this.testSearch('alice');
      
      console.log('🎉 Full diagnostic complete!');
    } catch (error) {
      console.error('💥 Diagnostic failed:', error);
    }
  }
}

// Export for manual use in console
const firebaseDebugger = new FirebaseDebug();

export const testFirebase = () => firebaseDebugger.testConnection();
export const testRules = () => firebaseDebugger.testFirestoreRules();
export const listUsers = () => firebaseDebugger.listExistingUsers();
export const manualSeed = () => firebaseDebugger.manualSeed();
export const testSearch = (term) => firebaseDebugger.testSearch(term);
export const fullDiagnostic = () => firebaseDebugger.runFullDiagnostic();

export default firebaseDebugger;