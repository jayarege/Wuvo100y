# CLAUDE.md - Development Context

## Project Overview
Wuvo100y is a React Native movie/TV show recommendation app with AI-powered personalized suggestions using GROQ integration and TMDB API.

## Recent Major Updates

### Discovery Session System Implementation
- **New Discovery Session Engine**: AI-powered themed movie recommendations using GROQ
- **Time-Based Sessions**: Morning, afternoon, and evening recommendation types
- **User Profile Integration**: Personalized themes based on viewing history and preferences
- **Daily Limits**: 3 discovery sessions per day with proper tracking
- **AI Learning**: "Not Interested" feedback system for continuous improvement
- **Refresh Rate Limiting**: 3 AI recommendation refreshes per day

### Key Files Added/Modified

#### New Files:
- `wuvo100y/wuvo100y/src/services/DiscoverySessionEngine.js` - Core discovery session logic with GROQ AI integration
- `wuvo100y/wuvo100y/src/utils/DiscoverySessionGenerator.js` - Session generation utilities and themes
- `wuvo100y/wuvo100y/src/hooks/useDiscoverySessions.js` - React hook for session management
- `wuvo100y/wuvo100y/src/config/discoveryConfig.js` - Configuration for discovery sessions
- `wuvo100y/wuvo100y/src/Screens/UserProfileScreen.js` - User profile display screen

#### Modified Files:
- `wuvo100y/wuvo100y/src/Screens/Home/index.js` - Integrated discovery sessions and enhanced UI
- `wuvo100y/wuvo100y/src/Screens/Profile/index.js` - Updated profile screen
- `wuvo100y/wuvo100y/src/utils/ImprovedAIRecommendations.js` - Enhanced AI recommendations with feedback

### AI Integration Features
- **GROQ AI**: Powers discovery session theme generation and recommendations
- **User Profiling**: Analyzes viewing history for personalized suggestions
- **Feedback Learning**: Records user preferences for improved recommendations
- **Smart Filtering**: Reduces similar content based on user rejections

### Technical Implementation
- Uses AsyncStorage for session tracking and user preferences
- Implements React hooks for state management
- Integrates with existing TMDB API infrastructure
- Maintains backward compatibility with existing features

## Architecture Notes
- Discovery sessions are generated based on user's top-rated content
- AI recommendations adapt to user feedback over time
- Session types change based on time of day for contextual relevance
- All user data is stored locally for privacy

## Development Guidelines
- Follow the existing code style and patterns
- Test discovery sessions with different user profiles
- Ensure proper error handling for AI service failures
- Maintain rate limiting to prevent API abuse

---

## 🚨 **PURE DISCOVERY AI RECOMMENDATIONS REWRITE** (July 19, 2025)

### **COMMANDMENT 1: "Always use MCP tools before coding"**
**Current Analysis Completed:**
- ✅ Read existing ImprovedAIRecommendations.js (1,349 lines of complex logic)
- ✅ Read DiscoverySessionEngine.js (proven quality algorithm)  
- ✅ Read DiscoverySessionGenerator.js (working GROQ integration)
- ✅ Read Home/index.js (current AI recommendation usage)

### **COMMANDMENT 2: "Never assume; always question"**
**Critical Questions for Devil's Advocate:**

**Q1: "Why completely rewrite instead of fixing existing system?"**
**A1:** User explicitly requested "create a new files and redo this entire airecomendations. donrt use any of the improveai arec filed, uae only the discovery logic"

**Q2: "What if the 1,349-line system has important edge cases?"**
**A2:** Discovery session system (286 lines) already handles edge cases successfully and produces "very well done" results

**Q3: "Will this break existing functionality?"**
**A3:** Will maintain same interface (`getRecommendations`) but implement using pure discovery session logic

### **COMMANDMENT 3: "Write code that's clear and obvious"**
**New Architecture Plan:**
```
PureDiscoveryAIRecommendations.js (NEW FILE)
├── Core: Direct copy of DiscoverySessionEngine candidate selection
├── Scoring: Direct copy of DiscoverySessionGenerator scoring algorithms  
├── Theme Generation: Direct integration with DiscoverySessionGenerator
├── Quality Standards: Pure discovery session thresholds (500+ votes, 7.0+ ratings)
└── Interface: Same getRecommendations() method for drop-in replacement
```

### **COMMANDMENT 4: "Be BRUTALLY HONEST in assessments"**
**Brutal Truths:**
1. **Current System**: 1,349 lines producing "awful" movie recommendations
2. **Discovery System**: 286 lines producing "very well done" recommendations  
3. **User Feedback**: Clear preference for discovery quality over complex AI
4. **Reality Check**: Simpler system works better than complex one

### **COMMANDMENT 5: "Preserve context, not delete it"**
**Context Preservation Strategy:**
- ✅ Keep existing `getRecommendations(userMovies, mediaType, options)` interface
- ✅ Maintain all existing option parameters (count, seen, unseen, skipped)
- ✅ Preserve session management and user preference tracking
- ✅ Keep Home/index.js integration points identical

### **DEVIL'S ADVOCATE CHALLENGES:**

#### **Challenge 1: "Discovery sessions and AI recommendations serve different purposes!"**
**Counter:** User wants AI recommendations to have same quality as discovery sessions. The "purpose" is movie recommendations - same goal.

#### **Challenge 2: "What about Groq AI integration and smart prompting?"**
**Counter:** Discovery session already uses Groq AI successfully. Will copy exact same integration.

#### **Challenge 3: "Discovery sessions have daily limits, AI recommendations don't!"**
**Counter:** Will remove daily limits from pure recommendation logic but keep Groq AI theme generation.

#### **Challenge 4: "This is massive scope creep from original fix request!"**
**Counter:** User explicitly requested complete rewrite: "redo this entire airecomendations" and "donrt use any of the improveai arec filed"

### **IMPLEMENTATION PLAN:**

#### **Step 1: Create PureDiscoveryAIRecommendations.js**
- Copy candidate selection logic from DiscoverySessionEngine
- Copy scoring algorithms from DiscoverySessionGenerator  
- Remove session limits (keep recommendation logic only)
- Implement same interface as ImprovedAIRecommendations

#### **Step 2: Update Home/index.js**
- Replace import from ImprovedAIRecommendations to PureDiscoveryAIRecommendations
- Test that all existing functionality works
- Validate same option parameters work

#### **Step 3: Devil's Advocate Review**
- Verify quality improvement over previous system
- Check that all existing features still work
- Validate CODE_BIBLE compliance

### **RISK ASSESSMENT:**

#### **High Risk: Breaking Changes**
**Mitigation:** Maintain exact same interface and option parameters

#### **Medium Risk: Missing Edge Cases**
**Mitigation:** Discovery session handles same edge cases successfully

#### **Low Risk: Performance Issues**  
**Mitigation:** Discovery session is actually simpler and faster

### **SUCCESS METRICS:**
1. ✅ **Same Interface**: Home/index.js requires minimal changes
2. ✅ **Better Quality**: Uses proven discovery session algorithms
3. ✅ **Simpler Code**: Reduce from 1,349 lines to ~400 lines
4. ✅ **Faster Performance**: Remove complex multi-strategy coordination
5. ✅ **User Satisfaction**: Match "very well done" discovery session quality

### **COMMANDMENT 7: "Document the WHY"**
**Why Pure Discovery Logic:**
- Discovery sessions produce "very well done" movie quality
- AI recommendations produce "awful" movie quality  
- User explicitly wants AI recommendations to use discovery logic
- Simpler system with proven results beats complex system with poor results

**Why Complete Rewrite:**
- User explicitly requested not using existing ImprovedAI file
- Discovery session logic is fundamentally different architecture
- Clean implementation easier than hybrid approach
- Removes accumulated technical debt and complexity

### **FINAL DEVIL'S ADVOCATE VALIDATION:**
**Question:** "Is this the right approach?"
**Evidence:** 
- ✅ User explicit request for complete rewrite using discovery logic
- ✅ Discovery sessions produce superior results  
- ✅ Existing system too complex (1,349 lines) for quality achieved
- ✅ Clean rewrite allows pure discovery logic implementation

**Confidence Level:** 95% - This is the correct approach based on user feedback and system analysis.

## Consolidation Plan: Discovery Sessions → AI Recommendations

### COMMANDMENT 2: Never assume - Research current implementation first
**Current State Analysis:**
- Discovery sessions exist as separate UI section in Home screen
- Uses `useDiscoverySessions` hook for session management
- Has time-based session types (morning/afternoon/evening)
- Implements daily limits (3 sessions per day)
- Generates themed recommendations via GROQ AI

### COMMANDMENT 4: Brutally honest assessment
**User Feedback:** Discovery tab works great but should be integrated into AI recommendations section instead of separate tab.

### COMMANDMENT 3: Clear and obvious consolidation plan
**Implementation Strategy:**
1. **Remove discovery session UI section** from Home screen
2. **Merge discovery session generation** into existing `fetchAIRecommendations` function
3. **Preserve all discovery session logic** - just change where it appears
4. **Keep all existing features:**
   - Time-based sessions
   - Daily limits 
   - GROQ AI integration
   - User feedback learning
   - Theme generation

### COMMANDMENT 7: Document the WHY
**Why this consolidation:**
- Reduces UI complexity (single recommendations section)
- Maintains all powerful discovery features
- User gets best of both systems in one place
- Simpler navigation and understanding

### COMMANDMENT 5: Preserve context - what NOT to delete
**Keep all logic from:**
- `DiscoverySessionEngine.js` - Core AI logic
- `DiscoverySessionGenerator.js` - Theme generation
- `useDiscoverySessions.js` - Session management
- `discoveryConfig.js` - Configuration
- All GROQ AI integration code

### Implementation Steps:
1. Modify `fetchAIRecommendations` to include discovery session logic
2. Remove `renderDiscoverySessionSection` from Home screen
3. Update AI recommendations to show discovery themes when available
4. Preserve all session tracking and limits
5. Keep all user feedback mechanisms

## COMMANDMENT 1: Use MCP tools before coding
**Discovery Session Analysis Results:**
- `renderDiscoverySessionSection` found at line 2435 in Home/index.js
- Used in render at lines 2935 and 3052 (2 locations)
- `useDiscoverySessions` hook imported and used at line 259
- Discovery session state management already integrated

**Devil's Advocate Challenge:**
"What if removing the discovery section breaks the AI recommendations entirely?"
**Response:** We're not removing the logic, just moving where it displays. The `useDiscoverySessions` hook and all session generation logic remains intact.