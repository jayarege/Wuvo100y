// =============================================================================
// DISCOVERY SESSIONS HOOK
// =============================================================================
// COMMANDMENT 3: "Write code that's clear and obvious"
// COMMANDMENT 9: "Handle errors explicitly"

import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DiscoverySessionEngine from '../services/DiscoverySessionEngine';
import { getCurrentSessionType, getUserProfileType } from '../config/discoveryConfig';

export const useDiscoverySessions = (userId) => {
  const [sessions, setSessions] = useState([]);
  const [currentSession, setCurrentSession] = useState(null);
  const [dailyLimits, setDailyLimits] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // =============================================================================
  // LOAD DAILY LIMITS
  // =============================================================================

  const loadDailyLimits = useCallback(async () => {
    try {
      const limits = await DiscoverySessionEngine.checkDailyLimits(userId);
      setDailyLimits(limits);
      return limits;
    } catch (err) {
      console.error('Error loading daily limits:', err);
      setError('Failed to load session limits');
      return null;
    }
  }, [userId]);

  // =============================================================================
  // GENERATE NEW SESSION
  // =============================================================================

  const generateSession = useCallback(async (sessionType = null, options = {}) => {
    if (loading) return null;
    
    setLoading(true);
    setError(null);
    
    try {
      // Check limits first
      const limits = await loadDailyLimits();
      if (limits && limits.sessionsUsed >= 3) {
        setError('Daily session limit reached. Try again tomorrow!');
        setLoading(false);
        return null;
      }

      // Auto-detect session type if not provided
      const finalSessionType = sessionType || getCurrentSessionType();
      
      console.log(`🎪 Generating ${finalSessionType} discovery session...`);
      
      const session = await DiscoverySessionEngine.generateDiscoverySession(
        userId, 
        finalSessionType, 
        options
      );
      
      if (session) {
        setCurrentSession(session);
        setSessions(prev => [session, ...prev.slice(0, 4)]); // Keep last 5 sessions
        await loadDailyLimits(); // Refresh limits
        console.log('✅ Discovery session generated successfully');
        return session;
      } else {
        throw new Error('Failed to generate session');
      }
      
    } catch (err) {
      console.error('Session generation error:', err);
      setError(err.message || 'Failed to generate discovery session');
      return null;
    } finally {
      setLoading(false);
    }
  }, [userId, loading, loadDailyLimits]);

  // =============================================================================
  // LOAD PREVIOUS SESSIONS
  // =============================================================================

  const loadPreviousSessions = useCallback(async () => {
    try {
      const today = new Date().toDateString();
      const sessionKey = `discovery_sessions_${userId}_${today}`;
      const stored = await AsyncStorage.getItem(sessionKey);
      
      if (stored) {
        const parsedSessions = JSON.parse(stored);
        setSessions(parsedSessions);
        
        // Set most recent as current if still valid
        const mostRecent = parsedSessions[0];
        if (mostRecent && mostRecent.expiresAt > Date.now()) {
          setCurrentSession(mostRecent);
        }
      }
    } catch (err) {
      console.error('Error loading previous sessions:', err);
    }
  }, [userId]);

  // =============================================================================
  // SESSION ACTIONS
  // =============================================================================

  const refreshCurrentSession = useCallback(async () => {
    if (!currentSession) return null;
    
    return await generateSession(currentSession.sessionType, { 
      refresh: true 
    });
  }, [currentSession, generateSession]);

  const markMovieAsWatched = useCallback(async (movieId) => {
    if (!currentSession) return;
    
    try {
      const updatedSession = {
        ...currentSession,
        movies: currentSession.movies.map(movie => 
          movie.id === movieId 
            ? { ...movie, watchedAt: Date.now() }
            : movie
        )
      };
      
      setCurrentSession(updatedSession);
      
      // Update in sessions list
      setSessions(prev => 
        prev.map(session => 
          session.id === currentSession.id ? updatedSession : session
        )
      );
      
      // Persist to storage
      const today = new Date().toDateString();
      const sessionKey = `discovery_sessions_${userId}_${today}`;
      const allSessions = sessions.map(session => 
        session.id === currentSession.id ? updatedSession : session
      );
      await AsyncStorage.setItem(sessionKey, JSON.stringify(allSessions));
      
    } catch (err) {
      console.error('Error marking movie as watched:', err);
    }
  }, [currentSession, sessions, userId]);

  const rateSessionMovie = useCallback(async (movieId, rating) => {
    if (!currentSession) return;
    
    try {
      const updatedSession = {
        ...currentSession,
        movies: currentSession.movies.map(movie => 
          movie.id === movieId 
            ? { ...movie, userRating: rating, ratedAt: Date.now() }
            : movie
        )
      };
      
      setCurrentSession(updatedSession);
      
      // Update in sessions list
      setSessions(prev => 
        prev.map(session => 
          session.id === currentSession.id ? updatedSession : session
        )
      );
      
    } catch (err) {
      console.error('Error rating session movie:', err);
    }
  }, [currentSession]);

  // =============================================================================
  // ANALYTICS & INSIGHTS
  // =============================================================================

  const getSessionStats = useCallback(() => {
    if (!currentSession) return null;
    
    const watchedCount = currentSession.movies.filter(m => m.watchedAt).length;
    const ratedCount = currentSession.movies.filter(m => m.userRating).length;
    const avgRating = currentSession.movies
      .filter(m => m.userRating)
      .reduce((sum, m) => sum + m.userRating, 0) / ratedCount || 0;
    
    return {
      totalMovies: currentSession.movies.length,
      watchedCount,
      ratedCount,
      avgRating: avgRating.toFixed(1),
      completionRate: (watchedCount / currentSession.movies.length * 100).toFixed(1)
    };
  }, [currentSession]);

  const canGenerateNewSession = useCallback(() => {
    return dailyLimits && dailyLimits.sessionsUsed < 3;
  }, [dailyLimits]);

  // =============================================================================
  // INITIALIZATION
  // =============================================================================

  useEffect(() => {
    if (userId) {
      loadDailyLimits();
      loadPreviousSessions();
    }
  }, [userId, loadDailyLimits, loadPreviousSessions]);

  // =============================================================================
  // RETURN INTERFACE
  // =============================================================================

  return {
    // State
    sessions,
    currentSession,
    dailyLimits,
    loading,
    error,
    
    // Actions
    generateSession,
    refreshCurrentSession,
    markMovieAsWatched,
    rateSessionMovie,
    loadDailyLimits,
    
    // Utilities
    getSessionStats,
    canGenerateNewSession,
    
    // Computed values
    hasAvailableSessions: canGenerateNewSession(),
    sessionStats: getSessionStats(),
    remainingSessions: dailyLimits ? 3 - dailyLimits.sessionsUsed : 0
  };
};

export default useDiscoverySessions;