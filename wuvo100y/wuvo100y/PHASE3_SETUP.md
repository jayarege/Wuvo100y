# Phase 3: User Search & Discovery - Setup Guide

## 🚨 **Critical Setup Requirements**

### **1. Firebase Indexes (REQUIRED)**

The following composite indexes must be created in Firebase Console before the search functionality will work:

#### **User Search Indexes**
```
Collection: users
Fields:
1. username (Ascending), isPublic (Ascending), searchable (Ascending)
2. displayName (Ascending), isPublic (Ascending), searchable (Ascending)
3. isPublic (Ascending), searchable (Ascending), followerCount (Descending)
```

#### **Follow System Indexes**
```
Collection: follows
Fields:
1. followerId (Ascending), followingId (Ascending)
2. followingId (Ascending), createdAt (Descending)
3. followerId (Ascending), createdAt (Descending)
```

### **2. How to Create Indexes**

**Option A: Automatic (Recommended)**
1. Run the app and try to search for a user
2. Firebase will show an error with a direct link to create the index
3. Click the link and Firebase will create the index automatically

**Option B: Manual Creation**
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project → Firestore Database → Indexes
3. Click "Create Index" and add the field combinations above

### **3. User Profile Migration**

Existing users need the following fields added to their profiles:

```javascript
// Required fields for Phase 3
{
  isPublic: true,           // Default to public
  searchable: true,         // Default to searchable
  followerCount: 0,         // Initialize to 0
  followingCount: 0,        // Initialize to 0
  preferences: {
    showRatings: true,      // Default to public ratings
    showWatchlist: true     // Default to public watchlist
  }
}
```

## 🧪 **Testing Guide**

### **Test 1: User Registration & Profile Setup**
1. Create a new account with Phase 2 flow
2. Set up username (@testuser1)
3. Complete profile setup with bio and privacy settings
4. Verify user appears in Firebase Console → users collection

### **Test 2: User Search Functionality**
1. Go to Profile tab → Tap search icon (magnifying glass)
2. Search for "@testuser1" → Should show real-time results
3. Search for partial username "test" → Should show matching users
4. Search by display name → Should find users by name

### **Test 3: Public Profile Viewing**
1. Tap on a user from search results
2. Should navigate to PublicProfileScreen
3. Verify profile info displays correctly (bio, stats, join date)
4. Test tab navigation (About/Ratings/Watchlist)
5. Respect privacy settings (hide content if user set to private)

### **Test 4: Follow/Unfollow System**
1. On a public profile, tap "Follow" button
2. Button should show loading spinner briefly
3. Button should change to "Following"
4. Follower count should increment by 1
5. Tap "Following" to unfollow → count should decrement

### **Test 5: Privacy Controls**
1. Go to your own profile settings
2. Toggle "Public Profile" off
3. Sign in with different account
4. Search for your username → should not appear in results
5. Try to access profile directly → should show "Profile Unavailable"

## 🚨 **Common Issues & Solutions**

### **Issue: "Index Required" Error**
```
Error: The query requires an index. You can create it here: [link]
```
**Solution**: Click the provided link to create the index, or create manually in Firebase Console.

### **Issue: Search Returns No Results**
**Possible Causes**:
- User has `isPublic: false` or `searchable: false`
- Firebase indexes not created yet
- Search term too short (minimum 2 characters)

**Solution**: 
1. Check Firebase Console → users collection for test data
2. Verify user has required fields set correctly
3. Ensure indexes are created and active

### **Issue: Follow Button Not Working**
**Possible Causes**:
- User not authenticated (`currentUser.id` is null)
- Trying to follow yourself
- Network connectivity issues

**Solution**:
1. Check authentication state in dev console
2. Verify Firebase connection
3. Check Firestore security rules allow writes

### **Issue: Profile Images Not Loading**
**Possible Causes**:
- Invalid image URLs
- Network connectivity
- CORS issues with external images

**Solution**:
1. Use placeholder icons for missing images
2. Implement image error handling
3. Test with known good image URLs

## 📊 **Performance Monitoring**

### **Key Metrics to Watch**
1. **Search Response Time**: Should be < 500ms for good UX
2. **Profile Load Time**: Should be < 1s including follow status
3. **Follow Action Speed**: Should be < 2s for follow/unfollow
4. **Error Rates**: Monitor Firebase errors and network failures

### **Optimization Tips**
1. **Cache User Profiles**: Store frequently viewed profiles locally
2. **Debounce Search**: 500ms debounce already implemented
3. **Batch Operations**: Follow/unfollow uses batch writes for consistency
4. **Image Optimization**: Use thumbnail URLs for profile pictures

## 🔒 **Security Checklist**

- ✅ **Public Profiles Only**: Search only shows `isPublic: true` users
- ✅ **Searchable Control**: Users can opt out with `searchable: false`
- ✅ **Content Privacy**: Respect `showRatings`/`showWatchlist` settings
- ✅ **Follow Protection**: Cannot follow yourself, prevents duplicates
- ✅ **Authentication Required**: Follow actions require valid user session

## 🚀 **Ready for Production**

Once the Firebase indexes are created and tested, Phase 3 is production-ready! The code follows React Native best practices and includes comprehensive error handling.

**Next**: Phase 4 will add friend activity feeds, social recommendations, and collaborative features.