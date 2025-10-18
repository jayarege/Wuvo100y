# Rating System Migration Guide

## Overview
This guide shows how to migrate from `EnhancedRatingSystem.js` (3,300 lines) to the new `RatingSystem.js` (650 lines).

**DO NOT DELETE** `EnhancedRatingSystem.js` until all screens are migrated and tested.

---

## What Changed?

### Before (Old System)
```javascript
import { 
  ConfidenceBasedComparison,
  SentimentRatingModal,
  EnhancedRatingButton,
  selectOpponentFromPercentile,
  handleTooToughToDecide,
  // ... 20+ other exports
} from '../Components/EnhancedRatingSystem';
```

### After (New System)
```javascript
import { 
  SentimentRatingModal,
  ComparisonModal,
  // That's it! Only 2 components needed.
} from '../Components/RatingSystem';
```

---

## Migration Steps by Screen

### 1. Home Screen (`src/Screens/Home/index.js`)

#### Old Pattern
```javascript
// State
const [emotionModalVisible, setEmotionModalVisible] = useState(false);
const [comparisonModalVisible, setComparisonModalVisible] = useState(false);
const [selectedMovie, setSelectedMovie] = useState(null);
const [selectedCategory, setSelectedCategory] = useState(null);

// Import old system
import { ConfidenceBasedComparison, SentimentRatingModal } from '../Components/EnhancedRatingSystem';

// Handler
const handleEmotionSelected = (category) => {
  setSelectedCategory(category);
  setEmotionModalVisible(false);
  setComparisonModalVisible(true);
};

// Render
<SentimentRatingModal
  visible={emotionModalVisible}
  movie={selectedMovie}
  onClose={() => setEmotionModalVisible(false)}
  onRatingSelect={(movieWithRating, categoryKey, rating) => {
    setSelectedCategory(categoryKey);
    handleEmotionSelected(categoryKey);
  }}
  colors={colors}
  userMovies={seen}
/>

<ConfidenceBasedComparison
  visible={comparisonModalVisible}
  newMovie={selectedMovie}
  selectedSentiment={selectedCategory}
  availableMovies={seen}
  mediaType={mediaType}
  colors={colors}
  onClose={() => setComparisonModalVisible(false)}
  onComparisonComplete={(finalRating) => {
    // Handle completion
  }}
/>
```

#### New Pattern
```javascript
// State (simplified)
const [sentimentModalVisible, setSentimentModalVisible] = useState(false);
const [comparisonModalVisible, setComparisonModalVisible] = useState(false);
const [selectedMovie, setSelectedMovie] = useState(null);
const [selectedSentiment, setSelectedSentiment] = useState(null);

// Import new system
import { SentimentRatingModal, ComparisonModal } from '../Components/RatingSystem';

// Handler (simplified)
const handleSentimentSelected = (sentiment) => {
  setSelectedSentiment(sentiment);
  setSentimentModalVisible(false);
  setComparisonModalVisible(true);
};

// Render (simplified)
<SentimentRatingModal
  visible={sentimentModalVisible}
  movie={selectedMovie}
  onSelect={handleSentimentSelected}
  onClose={() => setSentimentModalVisible(false)}
  colors={colors}
/>

<ComparisonModal
  visible={comparisonModalVisible}
  newMovie={selectedMovie}
  sentiment={selectedSentiment}
  ratedMovies={seen}
  mediaType={mediaType}
  colors={colors}
  onComplete={(finalRating) => {
    // Save rating
    const updatedMovie = {
      ...selectedMovie,
      userRating: finalRating,
      eloRating: finalRating * 10,
      comparisonHistory: [],
      gamesPlayed: (selectedMovie.gamesPlayed || 0) + 1
    };
    
    handleAddToSeen(updatedMovie);
    setComparisonModalVisible(false);
    setSelectedMovie(null);
    setSelectedSentiment(null);
  }}
  onClose={() => {
    setComparisonModalVisible(false);
    setSelectedMovie(null);
    setSelectedSentiment(null);
  }}
/>
```

#### What to Delete from Home Screen
- ❌ `import { ConfidenceBasedComparison }` - replaced with ComparisonModal
- ❌ All complexity around `onRatingSelect` callback - simplified to `onSelect`
- ❌ `userMovies` prop - not needed in new system
- ❌ Any custom opponent selection logic - handled internally now

---

### 2. AddMovie Screen (`src/Screens/AddMovie/index.js`)

#### Migration Pattern (Same as Home)
```javascript
// OLD
import { SentimentRatingModal, ConfidenceBasedComparison } from '../Components/EnhancedRatingSystem';

// NEW
import { SentimentRatingModal, ComparisonModal } from '../Components/RatingSystem';

// Replace ConfidenceBasedComparison with ComparisonModal
// Use same props pattern as Home screen above
```

---

### 3. Wildcard Screen (`src/Screens/Wildcard/index.js`)

**IMPORTANT**: Check if this screen has custom rating logic.

If it uses the same comparison flow:
- Follow Home screen migration pattern

If it has DIFFERENT logic (e.g., direct rating input):
- Keep it separate, don't use ComparisonModal
- This is fine! Not every screen needs comparisons.

---

## Component Props Reference

### SentimentRatingModal (New)
```javascript
<SentimentRatingModal
  visible={boolean}           // Show/hide modal
  movie={object}              // Movie being rated
  onSelect={(sentiment) => {  // Called when user picks emotion
    // sentiment = 'LOVED' | 'LIKED' | 'AVERAGE' | 'DISLIKED'
  }}
  onClose={() => {}}          // Cancel button
  colors={themeColors}        // Theme colors object
/>
```

### ComparisonModal (New)
```javascript
<ComparisonModal
  visible={boolean}              // Show/hide modal
  newMovie={object}              // Movie being rated
  sentiment={string}             // 'LOVED' | 'LIKED' | 'AVERAGE' | 'DISLIKED'
  ratedMovies={array}            // User's rated content (seen array)
  mediaType={string}             // 'movie' | 'tv'
  colors={themeColors}           // Theme colors object
  onComplete={(finalRating) => { // 3-5 rounds complete
    // finalRating = 1.0 to 10.0
  }}
  onClose={() => {}}             // Cancel button
/>
```

---

## Testing Checklist

After migrating each screen, test:

- [ ] **Sentiment modal appears** when clicking "Rate" button
- [ ] **All 4 emotions** (Love/Like/Okay/Dislike) render correctly
- [ ] **Comparison modal appears** after selecting emotion
- [ ] **Correct opponent** selected based on emotion (e.g., LOVED → top 25%)
- [ ] **Rating updates** after each comparison
- [ ] **Early stopping** works (stops before 5 rounds if confident)
- [ ] **"Too tough to decide"** averages ratings correctly
- [ ] **Final rating saves** to AsyncStorage
- [ ] **Opponent ratings update** in storage
- [ ] **Modal closes** and returns to screen
- [ ] **Cancel button** works at any step

---

## Benefits of New System

### Code Quality
- ✅ **82% less code** (3,300 → 650 lines)
- ✅ **Single source of truth** for comparison UX
- ✅ **Clear function names** (no more guessing)
- ✅ **Explicit error handling**
- ✅ **Well-documented** with JSDoc comments

### Performance
- ✅ **Wilson CI early stopping** (can end at 3 rounds)
- ✅ **No wasted opponent searches** (simple percentile selection)
- ✅ **Efficient storage updates** (only changed ratings)

### Maintainability
- ✅ **ONE comparison modal** for all screens
- ✅ **Easy to add bisection** later (just modify selectRandomOpponent)
- ✅ **Clear configuration** (RATING_CONFIG object)
- ✅ **No duplicate functions**

### User Experience
- ✅ **Consistent UI** across all screens
- ✅ **Faster rating** (3-5 rounds instead of always 5)
- ✅ **Clear sentiment labels** (Love/Like/Okay/Dislike)
- ✅ **Better opponent selection** (percentile-based)

---

## Rollback Plan

If something breaks:

1. **Keep both files** for now
2. **Change imports back** to old system:
   ```javascript
   // Rollback
   import { ... } from '../Components/EnhancedRatingSystem';
   ```
3. **Report the issue** before deleting old file

---

## When to Delete Old File

Only delete `EnhancedRatingSystem.js` when:

- ✅ All screens migrated
- ✅ All tests passing
- ✅ No imports of old file found:
  ```bash
  grep -r "EnhancedRatingSystem" wuvo100y/src/Screens
  # Should return: No results
  ```
- ✅ App tested on physical device (not just simulator)

---

## FAQ

**Q: Can I migrate screens one at a time?**  
A: Yes! Both files can coexist. Migrate Home → test → AddMovie → test → etc.

**Q: What if my screen has custom logic?**  
A: Keep it! Not every screen needs to use ComparisonModal. Only migrate comparison-based flows.

**Q: Will ratings change?**  
A: No. ELO math is identical. Only the code organization changed.

**Q: What about my existing user data?**  
A: Safe. AsyncStorage format unchanged. Old ratings still work.

**Q: Can I still add bisection later?**  
A: Yes! New system is designed for easy bisection addition (~50 lines).

---

## Next Steps

1. ✅ **Read this guide fully**
2. ⏳ **Migrate Home screen first** (biggest user impact)
3. ⏳ **Test thoroughly** before moving to next screen
4. ⏳ **Migrate AddMovie screen**
5. ⏳ **Check Wildcard screen** (may not need migration)
6. ⏳ **Run full app test** on device
7. ⏳ **Delete old file** when confident

---

## Support

If you encounter issues during migration:

1. Check console logs for errors
2. Compare old vs new component props
3. Verify AsyncStorage format
4. Test with dev movies (DevConfig.js)
5. Ask for help with specific error messages

Good luck! 🚀
