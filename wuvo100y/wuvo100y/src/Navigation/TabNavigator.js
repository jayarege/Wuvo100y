import React, { useState, createContext, useContext } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import HomeScreen from '../Screens/Home';
// Removed TopRated and Watchlist screens
import AddMovieScreen from '../Screens/AddMovie';
import ProfileScreen from '../Screens/Profile';
// REMOVED: Firebase test screen (Phase 1 complete)
// import FirebaseTestScreen from '../Screens/FirebaseTestScreen';

// Create context for media type
const MediaTypeContext = createContext();

// Custom hook to use media type - export this for use in other components
export const useMediaType = () => {
  const context = useContext(MediaTypeContext);
  if (!context) {
    throw new Error('useMediaType must be used within MediaTypeProvider');
  }
  return context;
};

const Tab = createBottomTabNavigator();

function TabNavigator({
  seen,
  unseen,
  setSeen,
  setUnseen,
  genres,
  isDarkMode,
  toggleTheme,
  skippedMovies = [],
  addToSkippedMovies = () => {},
  removeFromSkippedMovies = () => {},
  newReleases = [],
  onAddToSeen,
  onAddToUnseen,
  onRemoveFromWatchlist,
  onUpdateRating
}) {
  // Add media type state
  const [currentMediaType, setCurrentMediaType] = useState('movie'); // Default to movies

  // Direct passthrough to central location - NO LOCAL LOGIC
  const handleAddToSeen = newMovie => {
    console.log(`📡 TAB NAVIGATOR: Sending ${newMovie.title} to central store`);
    onAddToSeen(newMovie);
    
    // Handle side effects only
    if (skippedMovies.includes(newMovie.id)) {
      removeFromSkippedMovies(newMovie.id);
    }
  };

  // Direct passthrough to central location - NO LOCAL LOGIC
  const handleAddToUnseen = newMovie => {
    console.log(`📡 TAB NAVIGATOR: Sending ${newMovie.title} to unseen central store`);
    onAddToUnseen(newMovie);
    
    // Handle side effects only
    if (skippedMovies.includes(newMovie.id)) {
      removeFromSkippedMovies(newMovie.id);
    }
  };

  // Direct passthrough to central location - NO LOCAL LOGIC
  const handleRemoveFromWatchlist = movieId => {
    console.log(`📡 TAB NAVIGATOR: Removing movie ${movieId} from watchlist via central store`);
    onRemoveFromWatchlist(movieId);
  };

  // Media type context value
  const mediaTypeContextValue = {
    mediaType: currentMediaType,
    setMediaType: setCurrentMediaType,
    isDarkMode
  };

  return (
    <MediaTypeContext.Provider value={mediaTypeContextValue}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            let iconName;
            switch (route.name) {
              case 'Home':
                iconName = focused ? 'home' : 'home-outline';
                break;
              // Removed TopRated and Watchlist icon cases
              case 'AddMovie':
                iconName = focused ? 'add-circle' : 'add-circle-outline';
                break;
              case 'Profile':
                iconName = focused ? 'person' : 'person-outline';
                break;
              // Removed Firebase test tab
              default:
                iconName = 'ellipse';
            }
            return <Ionicons name={iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: isDarkMode ? '#FFD700' : '#4B0082',
          tabBarInactiveTintColor: isDarkMode ? '#D3D3D3' : '#A9A9A9',
          tabBarStyle: {
            backgroundColor: isDarkMode ? '#1C2526' : '#FFFFFF',
            borderTopColor: isDarkMode ? '#4B0082' : '#E0E0E0',
          },
          headerShown: false,
        })}
      >
        <Tab.Screen name="Home" options={{ title: 'Home' }}>
          {props => (
            <HomeScreen
  {...props}
  seen={seen}
  unseen={unseen}
  setSeen={setSeen}
  setUnseen={setUnseen}
  onAddToSeen={handleAddToSeen}
  onAddToUnseen={handleAddToUnseen}
  onRemoveFromWatchlist={handleRemoveFromWatchlist}
  onUpdateRating={onUpdateRating}
  genres={genres}
  isDarkMode={isDarkMode}
  toggleTheme={toggleTheme}
  newReleases={newReleases}
  skippedMovies={skippedMovies}
  addToSkippedMovies={addToSkippedMovies}
  removeFromSkippedMovies={removeFromSkippedMovies}
/>
          )}
        </Tab.Screen>

        {/* Removed TopRated and Watchlist tabs - functionality moved to Profile screen */}

        <Tab.Screen name="AddMovie" options={{ title: 'Add Movie' }}>
          {props => (
            <AddMovieScreen
              {...props}
              seen={seen}
              unseen={unseen}
              onAddToSeen={handleAddToSeen}
              onAddToUnseen={handleAddToUnseen}
              onRemoveFromWatchlist={handleRemoveFromWatchlist}
              onUpdateRating={onUpdateRating}
              genres={genres}
              isDarkMode={isDarkMode}
            />
          )}
        </Tab.Screen>

        <Tab.Screen name="Profile" options={{ title: 'Profile' }}>
          {props => (
            <ProfileScreen
              {...props}
              seen={seen}
              unseen={unseen}
              isDarkMode={isDarkMode}
              genres={genres}
              onUpdateRating={onUpdateRating}
              onAddToSeen={handleAddToSeen}
              onRemoveFromWatchlist={handleRemoveFromWatchlist}
            />
          )}
        </Tab.Screen>

        {/* Firebase test tab removed - Phase 1 complete */}
      </Tab.Navigator>
    </MediaTypeContext.Provider>
  );
}

export default TabNavigator;