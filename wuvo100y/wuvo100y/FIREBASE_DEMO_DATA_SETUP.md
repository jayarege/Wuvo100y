# 🎯 Simple Firebase Demo Data Setup

## **Step 4: Initialize Demo Data - CLEAR INSTRUCTIONS**

### **Option A: Manual Setup (Recommended - 5 minutes)**

#### **Step 4.1: Get Demo User UID**
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your `wuvo100y-social` project
3. Click **"Authentication"** → **"Users"** tab
4. Find the demo user (`demo@wuvo.app`)
5. **COPY the UID** (long string like `xy4kJ2mNpQR8vF3sA1cB...`)
6. **Keep this UID handy** - you'll need it in next steps

#### **Step 4.2: Create User Profile**
1. Click **"Firestore Database"** in left sidebar
2. Click **"+ Start collection"**
3. **Collection ID**: `users`
4. Click **"Next"**
5. **Document ID**: Paste the UID you copied above
6. Add these fields one by one:

**Field 1:**
- Field: `uid` 
- Type: `string`
- Value: (paste the same UID again)

**Field 2:**
- Field: `email`
- Type: `string` 
- Value: `demo@wuvo.app`

**Field 3:**
- Field: `displayName`
- Type: `string`
- Value: `Demo User`

**Field 4:**
- Field: `username`
- Type: `string`
- Value: `demouser`

**Field 5:**
- Field: `bio`
- Type: `string`
- Value: `Demo account for App Store review`

**Field 6:**
- Field: `isPublic`
- Type: `boolean`
- Value: `true`

**Field 7:**
- Field: `searchable`
- Type: `boolean`
- Value: `true`

**Field 8:**
- Field: `followerCount`
- Type: `number`
- Value: `0`

**Field 9:**
- Field: `followingCount`
- Type: `number`
- Value: `0`

**Field 10:**
- Field: `totalRatings`
- Type: `number`
- Value: `25`

7. Click **"Save"**

#### **Step 4.3: Create Username Record**
1. Click **"+ Start collection"** again
2. **Collection ID**: `usernames`
3. Click **"Next"**
4. **Document ID**: `demouser`
5. Add these fields:

**Field 1:**
- Field: `userId`
- Type: `string`
- Value: (paste the UID you copied earlier)

**Field 2:**
- Field: `confirmed`
- Type: `boolean`
- Value: `true`

6. Click **"Save"**

### **Step 4.4: Test the Setup**
1. **Build and run your app**
2. **Go to Profile screen**
3. **Tap the search icon (🔍)**
4. **Search for "demo"**
5. **You should see "Demo User" appear!**
6. **Tap on it to view the profile**

---

## **Option B: Import JSON Data (Advanced)**

If you're comfortable with JSON, you can import this data:

### **Step B.1: Prepare Import File**
Create a file called `demo-data.json`:

```json
{
  "users": {
    "YOUR_DEMO_USER_UID_HERE": {
      "uid": "YOUR_DEMO_USER_UID_HERE",
      "email": "demo@wuvo.app",
      "displayName": "Demo User",
      "username": "demouser",
      "bio": "Demo account for App Store review",
      "isPublic": true,
      "searchable": true,
      "followerCount": 0,
      "followingCount": 0,
      "totalRatings": 25,
      "averageRating": 7.2
    }
  },
  "usernames": {
    "demouser": {
      "userId": "YOUR_DEMO_USER_UID_HERE",
      "confirmed": true
    }
  }
}
```

### **Step B.2: Replace UID Placeholder**
1. Get the demo user UID from Authentication → Users
2. Replace **both** instances of `YOUR_DEMO_USER_UID_HERE` with the actual UID

### **Step B.3: Import via Firebase CLI** (if installed)
```bash
firebase firestore:import demo-data.json --project wuvo100y-social
```

---

## **🧪 Verify Everything Works**

### **Test User Search:**
1. Open your app
2. Navigate to Profile screen
3. Tap search icon
4. Type "demo" or "Demo User"
5. **Should find the demo user**

### **Test Profile View:**
1. Tap on the demo user from search
2. **Should show profile with bio and stats**
3. **Should display "Demo User" and bio text**

### **If Search Doesn't Work:**
- Make sure `isPublic: true` and `searchable: true`
- Check that username is exactly `demouser` (lowercase)
- Verify the UID matches between Authentication and Firestore

---

## **🚨 Common Issues & Solutions**

### **"User not found" Error:**
- **Problem**: UID mismatch between Auth and Firestore
- **Solution**: Double-check the UID is exactly the same in both places

### **Search Returns No Results:**
- **Problem**: Missing `searchable: true` or wrong username
- **Solution**: Verify boolean fields are set correctly

### **App Crashes on Search:**
- **Problem**: Firestore security rules too restrictive
- **Solution**: Make sure you've set the security rules from earlier steps

---

## **🎉 Success Indicators**

You know it's working when:
- ✅ User search finds "Demo User"
- ✅ Profile page shows bio and stats
- ✅ No crashes when viewing profile
- ✅ Follow button appears (even if you can't follow yourself)

---

**Once this works, your app is ready for App Store deployment!** 🚀