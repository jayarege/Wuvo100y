# CLAUDE.md - Development Context

## Project Overview
Wuvo100y is a React Native movie/TV show recommendation app with AI-powered personalized suggestions using GROQ integration and TMDB API.

## Current System Architecture
- **Discovery Sessions**: AI-powered themed recommendations using GROQ with daily limits
- **Social Features**: Friend-only comments, social recommendations, privacy controls
- **Firebase Backend**: Authentication, Firestore database, real-time sync
- **Data Storage**: AsyncStorage for local data, Firebase for social features
- **Security**: Environment variables for API keys (in progress)

## Key Features Implemented
- Discovery session engine with time-based recommendations
- Friend-only comment system with real-time updates  
- Social recommendation engine with 4 strategies
- Privacy controls with 7 granular settings
- Firebase authentication and user profiles

## Current File Structure
### Core Services:
- `src/services/DiscoverySessionEngine.js` - GROQ AI integration
- `src/services/CommentService.js` - Friend-only comments
- `src/services/SocialRecommendationService.js` - Social recommendations
- `src/services/AuthService.js` - Firebase authentication
- `src/config/firebase.js` - Firebase configuration
- `src/config/environment.js` - Secure API key management

### React Components:
- `src/Components/CommentModal.js` - Comment interface
- `src/Components/SocialPrivacyModal.js` - Privacy controls
- `src/Screens/Home/index.js` - Main app screen with recommendations
- `src/Screens/Profile/index.js` - User profile screen

## Development Status
### ✅ Completed:
- Firebase backend integration and authentication
- Advanced social features (comments, recommendations, privacy)
- Discovery session system with GROQ AI
- Environment variable security system

### 🚧 In Progress:
- iOS launch preparation (API key security)
- Data migration from AsyncStorage to Firebase
- EAS build configuration

### ❌ Pending:
- Apple Developer account setup
- App Store submission preparation
- Production deployment configuration

## Technical Architecture
- **Frontend**: React Native with Expo
- **Backend**: Firebase (Authentication, Firestore, Storage)
- **AI**: GROQ for discovery sessions and recommendations  
- **APIs**: TMDB for movie data
- **Storage**: AsyncStorage (local) + Firestore (cloud)
- **State Management**: React hooks and context

## Development Guidelines
- Follow CODE_BIBLE principles for implementation
- Use MCP tools before coding
- Maintain privacy-first design for social features
- Test on multiple devices and iOS versions
- Ensure proper error handling and fallbacks
- Keep API keys secure in production builds