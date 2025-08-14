// COMMANDMENT 4: Test before declaring done - Jest configuration
module.exports = {
  preset: 'react-native',
  
  // Transform files
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
  },
  
  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  
  // Test environment
  testEnvironment: 'jsdom',
  
  // Coverage settings
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/constants/**',
    '!src/**/*.stories.{js,jsx,ts,tsx}'
  ],
  
  // Coverage thresholds - COMMANDMENT 4: Minimum coverage requirements
  coverageThreshold: {
    global: {
      branches: 70,    // WHY: 70% branch coverage catches most bugs
      functions: 75,   // WHY: 75% function coverage ensures core logic tested
      lines: 80,       // WHY: 80% line coverage industry standard
      statements: 80   // WHY: 80% statement coverage catches regressions
    },
    // Critical files need higher coverage
    'src/Screens/OnboardingScreen.js': {
      branches: 85,    // WHY: Onboarding is critical user flow
      functions: 90,   // WHY: All onboarding functions must be tested
      lines: 85,       // WHY: High line coverage for critical path
      statements: 85   // WHY: All statements in onboarding must be tested
    }
  },
  
  // Mock setup
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/.expo/',
    '<rootDir>/dist/'
  ],
  
  // Test timeout
  testTimeout: 10000,  // WHY: Allow time for async operations
  
  // Verbose output for debugging
  verbose: true
};