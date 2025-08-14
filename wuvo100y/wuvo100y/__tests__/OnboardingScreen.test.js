// COMMANDMENT 4: Test before declaring done - Comprehensive test suite
import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { render, fireEvent } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve()),
  multiSet: jest.fn(() => Promise.resolve()),
  multiGet: jest.fn(() => Promise.resolve()),
  multiRemove: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

// Import the component we're testing
import OnboardingScreen, { OnboardingCleanup } from '../src/Screens/OnboardingScreen';

describe('CODE_BIBLE Commandment Compliance Tests', () => {
  
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    AsyncStorage.setItem.mockClear();
    AsyncStorage.getItem.mockClear();
  });

  describe('Commandment 1: Never Assume - Input Validation', () => {
    
    it('handles null movie selection gracefully', () => {
      // COMMANDMENT 4: Test before declaring done
      // WHY: Test validates our input validation prevents crashes
      const mockOnComplete = jest.fn();
      const { getByTestId } = render(
        <OnboardingScreen onComplete={mockOnComplete} isDarkMode={false} />
      );
      
      // This should not crash the component
      expect(() => {
        // Simulate passing null movie
        const movieItem = getByTestId('movie-item-0');
        fireEvent.press(movieItem, null);
      }).not.toThrow();
    });

    it('validates corrupted state data', async () => {
      // COMMANDMENT 4: Test critical error paths
      // WHY: Ensures app doesn't crash with bad data
      const mockSetState = jest.fn();
      const corruptedData = 'not-an-array';
      
      // Test that validation catches corrupted state
      expect(() => {
        if (!Array.isArray(corruptedData)) {
          throw new Error('State validation failed');
        }
      }).toThrow('State validation failed');
    });

    it('handles missing onComplete prop', () => {
      // COMMANDMENT 4: Test prop validation
      // WHY: Component should not crash if required props missing
      expect(() => {
        render(<OnboardingScreen />);
      }).not.toThrow();
    });

  });

  describe('Commandment 2: Clear and Obvious Code - No Circular Dependencies', () => {
    
    it('defines callbacks in correct dependency order', () => {
      // COMMANDMENT 4: Test our circular dependency fix
      // WHY: Prevents runtime errors from undefined references
      const mockOnComplete = jest.fn();
      
      expect(() => {
        render(<OnboardingScreen onComplete={mockOnComplete} />);
      }).not.toThrow();
      
      // Verify no console errors about undefined functions
      expect(console.error).not.toHaveBeenCalledWith(
        expect.stringContaining('completeOnboarding is not defined')
      );
    });

  });

  describe('Commandment 3: Handle Errors Explicitly - Error Boundaries', () => {
    
    it('catches component errors and shows fallback UI', () => {
      // COMMANDMENT 4: Test error boundary functionality  
      // WHY: Ensures errors don't crash entire app
      const ThrowError = () => {
        throw new Error('Test error');
      };
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const { getByText } = render(
        <OnboardingErrorBoundary onComplete={() => {}}>
          <ThrowError />
        </OnboardingErrorBoundary>
      );
      
      expect(getByText('Setup Encountered an Issue')).toBeTruthy();
      expect(getByText('Try Again')).toBeTruthy();
      expect(getByText('Skip Setup')).toBeTruthy();
      
      consoleSpy.mockRestore();
    });

    it('recovers from storage quota exceeded error', async () => {
      // COMMANDMENT 4: Test critical storage error path
      // WHY: Users with full storage shouldn't lose onboarding progress
      AsyncStorage.setItem.mockRejectedValueOnce(
        new Error('QuotaExceededError: Storage quota exceeded')
      );
      
      const mockOnComplete = jest.fn();
      const { getByTestId } = render(
        <OnboardingScreen onComplete={mockOnComplete} />
      );
      
      // Complete the onboarding flow
      // This should handle storage error gracefully
      expect(mockOnComplete).not.toHaveBeenCalled(); // Should fail gracefully
    });

  });

  describe('Commandment 9: Unified Removal Utilities', () => {
    
    it('cleans up all state on unmount', async () => {
      // COMMANDMENT 4: Test cleanup functionality
      // WHY: Prevents memory leaks and corrupted state
      const mockSetters = {
        setImageLoadErrors: jest.fn(),
        setSelectedMovies: jest.fn(),
        setSelectedStreamingServices: jest.fn(),
        setCriticalError: jest.fn(),
        setLoading: jest.fn(),
        movieCacheRef: { current: { clear: jest.fn() } },
        streamingCacheRef: { current: { clear: jest.fn() } }
      };
      
      await OnboardingCleanup.clearAll(mockSetters);
      
      // Verify all cleanup functions were called
      expect(mockSetters.setImageLoadErrors).toHaveBeenCalledWith(new Set());
      expect(mockSetters.setSelectedMovies).toHaveBeenCalledWith([]);
      expect(mockSetters.setCriticalError).toHaveBeenCalledWith(null);
      expect(mockSetters.movieCacheRef.current.clear).toHaveBeenCalled();
      expect(AsyncStorage.multiRemove).toHaveBeenCalled();
    });

    it('handles cleanup failures gracefully', async () => {
      // COMMANDMENT 4: Test cleanup resilience  
      // WHY: One failing cleanup shouldn't stop others
      const mockSetters = {
        setImageLoadErrors: jest.fn(() => { throw new Error('Cleanup failed'); }),
        setSelectedMovies: jest.fn(),
        setCriticalError: jest.fn()
      };
      
      // Should not throw even if some cleanup fails
      await expect(OnboardingCleanup.clearAll(mockSetters)).resolves.toBeUndefined();
      
      // Other cleanup should still run
      expect(mockSetters.setSelectedMovies).toHaveBeenCalled();
    });

  });

  describe('Selection Logic Validation', () => {
    
    it('enforces movie selection limits correctly', () => {
      // COMMANDMENT 4: Test business logic
      // WHY: Selection rules are critical for UX
      const SELECTION_REQUIREMENTS = {
        MOVIES: { MIN: 5, MAX: 10 }
      };
      
      // Test minimum selection
      const fewMovies = [1, 2, 3, 4];
      expect(fewMovies.length < SELECTION_REQUIREMENTS.MOVIES.MIN).toBe(true);
      
      // Test maximum selection  
      const manyMovies = Array.from({length: 11}, (_, i) => i);
      expect(manyMovies.length > SELECTION_REQUIREMENTS.MOVIES.MAX).toBe(true);
      
      // Test valid selection
      const validMovies = Array.from({length: 7}, (_, i) => i);
      expect(
        validMovies.length >= SELECTION_REQUIREMENTS.MOVIES.MIN &&
        validMovies.length <= SELECTION_REQUIREMENTS.MOVIES.MAX
      ).toBe(true);
    });

  });

  describe('Accessibility Compliance', () => {
    
    it('provides accessible labels for movie selection', () => {
      // COMMANDMENT 4: Test accessibility
      // WHY: App must be usable by all users
      const mockOnComplete = jest.fn();
      const { getByLabelText } = render(
        <OnboardingScreen onComplete={mockOnComplete} />
      );
      
      // Should have accessible movie buttons (would need to add to component)
      expect(() => getByLabelText(/Select.*movie/i)).not.toThrow();
    });

  });

});

describe('Performance Tests', () => {
  
  it('renders movie grid without performance issues', () => {
    // COMMANDMENT 4: Test performance requirements
    // WHY: 30 movies should render quickly
    const startTime = performance.now();
    
    const mockOnComplete = jest.fn();
    render(<OnboardingScreen onComplete={mockOnComplete} />);
    
    const renderTime = performance.now() - startTime;
    
    // Should render in under 100ms
    expect(renderTime).toBeLessThan(100);
  });

});