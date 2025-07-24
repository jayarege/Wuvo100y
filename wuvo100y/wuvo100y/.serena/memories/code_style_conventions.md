# Code Style and Conventions

## JavaScript/React Native Conventions
- **File Naming**: PascalCase for components (e.g., `UserSearchModal.js`)
- **Directory Structure**: Organized by feature (Screens, Components, services, utils)
- **Import Style**: ES6 imports, destructuring where appropriate
- **Component Structure**: Functional components with hooks
- **State Management**: useState, useEffect, custom hooks

## File Organization
```
src/
├── Components/     # Reusable UI components
├── Screens/        # Screen components (by feature)
├── Navigation/     # Navigation configuration
├── services/       # Business logic and API calls
├── utils/          # Utility functions
├── config/         # Configuration files (Firebase, environment)
├── Constants/      # App constants and configuration
├── Styles/         # Shared styles
└── hooks/          # Custom React hooks
```

## Naming Conventions
- **Components**: PascalCase (`CommentModal`, `EnhancedRatingSystem`)
- **Files**: PascalCase for components, camelCase for utilities
- **Variables**: camelCase (`isProduction`, `movieDetails`)
- **Constants**: UPPER_SNAKE_CASE (`TMDB_API_KEY`, `STORAGE_KEY_MOVIES`)

## Comment Style
- **File Headers**: Clear purpose documentation with WHY/WHAT/HOW
- **Complex Logic**: Inline comments explaining business logic
- **Security**: Clear documentation for sensitive configuration

## CODE_BIBLE Compliance
Following the established CODE_BIBLE principles:
1. Always use MCP tools before coding
2. Never assume; always question
3. Write code that's clear and obvious
4. Be brutally honest in assessments
5. Preserve context, not delete it
6. Make atomic, descriptive commits
7. Document the WHY, not just the WHAT
8. Test before declaring done
9. Handle errors explicitly
10. Treat user data as sacred