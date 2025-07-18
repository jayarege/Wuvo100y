/**
 * Test 3-Movie Edge Case Scenario
 * Verifies that all sentiment categories can select opponents with minimal data
 */

// Simulate the calculateDynamicRatingCategories function
const calculateDynamicRatingCategories = (userMovies) => {
  if (!userMovies || userMovies.length === 0) {
    return {
      LOVED: { percentile: [0.0, 0.25] },
      LIKED: { percentile: [0.25, 0.50] },
      AVERAGE: { percentile: [0.50, 0.75] },
      DISLIKED: { percentile: [0.75, 1.0] }
    };
  }
  
  return {
    LOVED: { percentile: [0.0, 0.25] },    // Top 25%
    LIKED: { percentile: [0.25, 0.50] },   // Upper-middle 25-50%
    AVERAGE: { percentile: [0.50, 0.75] }, // Lower-middle 50-75%
    DISLIKED: { percentile: [0.75, 1.0] }  // Bottom 25%
  };
};

// Simulate the selectOpponentFromPercentile function
const selectOpponentFromPercentile = (percentileRange, seenMovies, excludeMovieId = null) => {
  if (!seenMovies || seenMovies.length === 0) return null;
  if (!percentileRange) return null;
  
  // Get movies sorted by rating
  const sortedMovies = seenMovies
    .filter(movie => movie.userRating && movie.id !== excludeMovieId)
    .sort((a, b) => b.userRating - a.userRating);
  
  if (sortedMovies.length === 0) return null;
  
  // Calculate percentile indices
  const startIndex = Math.floor(percentileRange[0] * sortedMovies.length);
  const endIndex = Math.floor(percentileRange[1] * sortedMovies.length);
  
  // Get movies in percentile range
  const moviesInRange = sortedMovies.slice(startIndex, Math.max(endIndex, startIndex + 1));
  
  if (moviesInRange.length === 0) return sortedMovies[0];
  
  // Return first movie from range (deterministic for testing)
  return moviesInRange[0];
};

// Test scenario: 3 movies with different ratings
const testScenario = () => {
  console.log('🧪 Testing 3-Movie Edge Case Scenario');
  console.log('=====================================');
  
  // Create 3 movies with different ratings
  const seenMovies = [
    { id: 1, title: 'High Rated Movie', userRating: 9.0 },
    { id: 2, title: 'Medium Rated Movie', userRating: 6.0 },
    { id: 3, title: 'Low Rated Movie', userRating: 3.0 }
  ];
  
  const newMovieId = 999;
  
  console.log('📊 Movies available:', seenMovies.map(m => `${m.title} (${m.userRating})`));
  console.log('📊 Movies sorted by rating:', seenMovies.sort((a, b) => b.userRating - a.userRating).map(m => `${m.title} (${m.userRating})`));
  
  // Get dynamic categories
  const categories = calculateDynamicRatingCategories(seenMovies);
  
  // Test each sentiment category
  const results = {};
  
  for (const [categoryName, categoryData] of Object.entries(categories)) {
    const percentileRange = categoryData.percentile;
    const selectedOpponent = selectOpponentFromPercentile(percentileRange, seenMovies, newMovieId);
    
    const startIndex = Math.floor(percentileRange[0] * seenMovies.length);
    const endIndex = Math.floor(percentileRange[1] * seenMovies.length);
    
    results[categoryName] = {
      percentileRange,
      startIndex,
      endIndex,
      selectedOpponent: selectedOpponent ? selectedOpponent.title : 'None',
      selectedRating: selectedOpponent ? selectedOpponent.userRating : null
    };
    
    console.log(`\n${categoryName}:`);
    console.log(`  Percentile: [${percentileRange[0]}, ${percentileRange[1]}]`);
    console.log(`  Indices: [${startIndex}, ${endIndex}]`);
    console.log(`  Selected: ${selectedOpponent ? selectedOpponent.title : 'None'} (${selectedOpponent ? selectedOpponent.userRating : 'N/A'})`);
  }
  
  // Verify each category found an opponent
  const failedCategories = Object.entries(results).filter(([_, result]) => !result.selectedOpponent || result.selectedOpponent === 'None');
  
  if (failedCategories.length === 0) {
    console.log('\n✅ SUCCESS: All sentiment categories found valid opponents!');
    console.log('✅ 3-movie edge case handling works correctly');
  } else {
    console.log('\n❌ FAILURE: Some categories failed to find opponents:');
    failedCategories.forEach(([category, result]) => {
      console.log(`  ${category}: ${result.selectedOpponent}`);
    });
  }
  
  return results;
};

// Run the test
testScenario();