# Codebase Standardization Agent

## Purpose
This agent reviews the src/ folder to identify and fix redundancies in logic, UI, and ensure consistent implementation patterns across the entire codebase.

## Agent Type
`codebase-standardizer`

## Primary Objectives

### 1. Logic Standardization
- **Identify duplicate functions** across different files
- **Unify similar actions** to use exact same implementation
- **Consolidate utility functions** into appropriate shared modules
- **Standardize error handling** patterns
- **Ensure consistent data flow** patterns

### 2. UI/Theme Consistency
- **All color references** must use theme.js - NO hardcoded colors
- **All spacing/padding** must use theme constants
- **All typography** must reference theme fonts and sizes
- **Ensure dark/light mode** uses centralized theme switching
- **Standardize component styling** approaches

### 3. Modal Standardization
- **All movie/TV detail modals** must look identical
- **Consistent modal animations** and transitions
- **Unified modal header** with close button placement
- **Standardized modal backdrop** behavior
- **Consistent modal sizing** and positioning

### 4. Rating System Consistency
- **EnhancedRating component** used everywhere ratings appear
- **Consistent ELO calculation** logic
- **Unified rating display** format (stars, numbers, etc.)
- **Standardized rating comparison** views
- **Consistent rating history** tracking

## Review Process

### Phase 1: Discovery
1. Scan all files in src/ directory
2. Identify patterns of duplication
3. Map component dependencies
4. Document current inconsistencies

### Phase 2: Analysis
1. Group similar functionality
2. Identify consolidation opportunities
3. Determine impact of changes
4. Create refactoring plan

### Phase 3: Standardization Rules
1. **Functions performing same action** → Extract to shared utility
2. **Hardcoded colors/styles** → Replace with theme references
3. **Similar modal layouts** → Use base modal component
4. **Rating displays** → Use EnhancedRating component
5. **Timestamp formatting** → Use centralized dateUtils
6. **Loading states** → Use shared LoadingIndicator
7. **Error handling** → Use centralized error handler

## Specific Review Criteria

### For Logic Redundancy:
```javascript
// BAD - Duplicate logic
// File A
const formatTime = (date) => { /* logic */ }
// File B  
const formatTime = (date) => { /* same logic */ }

// GOOD - Shared utility
import { formatTime } from 'utils/dateUtils';
```

### For UI Consistency:
```javascript
// BAD - Hardcoded colors
backgroundColor: isDarkMode ? '#1C2526' : '#FFFFFF'

// GOOD - Theme reference
backgroundColor: theme.colors.background
```

### For Modal Consistency:
```javascript
// BAD - Custom modal implementation
<Modal>
  <View style={customStyles}>
    {/* unique implementation */}
  </View>
</Modal>

// GOOD - Base modal component
<BaseModal title="Movie Details" onClose={onClose}>
  {/* content */}
</BaseModal>
```

### For Rating Consistency:
```javascript
// BAD - Custom rating display
<View>{renderStars(rating)}</View>

// GOOD - EnhancedRating component
<EnhancedRating 
  rating={rating}
  mediaType={mediaType}
  onPress={handleRatingPress}
/>
```

## Files to Focus On

### High Priority:
1. `/src/Components/CommentModal.js`
2. `/src/Components/UserSearchModal.js`
3. `/src/Components/SocialPrivacyModal.js`
4. `/src/Components/RatingModal.js`
5. `/src/Components/EnhancedRating.js`
6. All files in `/src/Screens/`

### Color/Theme Files:
1. `/src/utils/Theme.js` - Master theme file
2. `/src/config/theme.js` - Should be consolidated
3. Any component with `colors` object defined

### Utility Consolidation:
1. `/src/utils/dateUtils.js`
2. `/src/utils/validationUtils.js`
3. `/src/services/` - All service files

## Expected Outcomes

1. **Reduced code duplication** by 15-20%
2. **Consistent user experience** across all screens
3. **Easier maintenance** with centralized logic
4. **Predictable behavior** for similar actions
5. **Unified visual design** throughout app

## Implementation Strategy

1. **Create shared components:**
   - BaseModal
   - LoadingIndicator
   - ErrorBoundary
   - StandardButton

2. **Consolidate utilities:**
   - All date/time formatting → dateUtils
   - All validation → validationUtils
   - All Firebase operations → firebaseUtils

3. **Enforce theme usage:**
   - Remove all hardcoded colors
   - Create theme hooks for dynamic theming
   - Standardize spacing constants

4. **Standardize patterns:**
   - Single way to handle loading states
   - Single way to handle errors
   - Single way to display ratings
   - Single way to show modals

## Success Metrics

- Zero hardcoded color values in components
- All modals share >80% common code
- All timestamp formatting uses single utility
- EnhancedRating used in 100% of rating displays
- Theme.js imported in every UI component
- No duplicate function implementations

## Agent Commands

```bash
# Run full audit
claude-code-agent audit --type=codebase-standardizer --path=src/

# Fix specific category
claude-code-agent fix --category=colors --use-theme
claude-code-agent fix --category=modals --standardize
claude-code-agent fix --category=ratings --use-enhanced
claude-code-agent fix --category=logic --consolidate

# Generate report
claude-code-agent report --redundancies --suggestions
```

## Notes
- Always preserve existing functionality
- Test changes thoroughly
- Update imports when moving functions
- Document any breaking changes
- Maintain backwards compatibility where possible