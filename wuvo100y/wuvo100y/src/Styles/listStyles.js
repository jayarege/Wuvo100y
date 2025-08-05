import { StyleSheet } from 'react-native';

// Function to get themed list styles with right-side ranking
const getListStyles = (mediaType = 'movie', mode = 'light', theme) => {
  const colors = theme[mediaType][mode];

  return StyleSheet.create({
    rankingsList: {
      flex: 1,
      backgroundColor: colors.background,
    },
    rankingItem: {
      flexDirection: 'row',
      marginHorizontal: 16,
      marginVertical: 4,
      borderRadius: 8,
      backgroundColor: colors.card,
      overflow: 'hidden',
      borderWidth: .5,
      borderColor: colors.primaryGradient[1],
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
      // CODE_BIBLE #3: Clear 50% size reduction for mobile optimization
      minHeight: 98,
    },
    resultPoster: {
      width: 50,
      height: 98,
      // CODE_BIBLE #3: 50% size reduction maintains 2:3 aspect ratio with 30% height increase
    },
    movieDetails: {
      flex: 1,
      padding: 6,
      height: 98,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      overflow: 'hidden',
      // CODE_BIBLE #3: Horizontal layout for content + action button
      paddingRight: 4,
    },
    resultTitle: {
      fontSize: 12,
      fontWeight: 'bold',
      marginBottom: 2,
      color: colors.text,
      fontFamily: colors.font.header,
      minHeight: 14,
      maxHeight: 28,
      textAlignVertical: 'top',
      // CODE_BIBLE #3: Compact title sizing for mobile
      paddingRight: 2,
    },
    resultYear: {
      fontSize: 13,
      marginBottom: 3,
      color: colors.subText,
      fontFamily: colors.font.body,
    },
    resultOverview: {
      fontSize: 13,
      lineHeight: 16,
      color: colors.text,
      fontFamily: colors.font.body,
      numberOfLines: 2,
      ellipsizeMode: 'tail',
    },
    resultRating: {
      fontSize: 13,
      marginTop: 4,
      color: colors.accent,
      fontFamily: colors.font.body,
      fontWeight: '600',
    },
    
    // UPDATED: Right-side ranking container
    rankingContainer: {
      width: 30, // CODE_BIBLE #3: 50% width reduction for mobile
      height: 98,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.primary,
      // Devil's Advocate: Smaller but still prominent
    },
    
    // UPDATED: Larger, more prominent ranking badge
    rankBadge: {
      width: 25,
      height: 25,
      borderRadius: 12.5,
      backgroundColor: 'rgba(255, 255, 255, 0.15)', // Subtle overlay
      alignItems: 'center',
      justifyContent: 'center',
      // CODE_BIBLE #3: 50% badge size reduction
      borderWidth: 1,
      borderColor: colors.accent,
    },
    
    // UPDATED: Much larger ranking number
    rankNumber: {
      fontWeight: 'bold',
      fontSize: 12, // CODE_BIBLE #3: 50% size reduction, still readable
      color: colors.accent,
      fontFamily: colors.font.header,
      textAlign: 'center',
    },
    
    // Additional optimized styles for content fitting
    scoreContainer: {
      marginTop: 2,
      flexGrow: 1,
      justifyContent: 'center',
    },
    finalScore: {
      fontSize: 14,
      fontWeight: 'bold',
      marginBottom: 2,
      color: colors.accent,
      // CODE_BIBLE #3: Compact score display
    },
    genresText: {
      fontSize: 9,
      color: colors.subText,
      numberOfLines: 1,
      ellipsizeMode: 'tail',
      marginBottom: 2,
      // CODE_BIBLE #3: Smaller genre text for compact design
    },
    editButton: {
      paddingVertical: 3,
      paddingHorizontal: 6,
      borderRadius: 4,
      alignSelf: 'flex-start',
      backgroundColor: colors.primary,
      // CODE_BIBLE #3: Compact button for mobile UX
    },
    editButtonText: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.accent,
      // CODE_BIBLE #3: Smaller button text for compact design
    },
  });
};

// Updated static styles for backward compatibility
const listStyles = StyleSheet.create({
  rankingsList: {
    flex: 1,
  },
  rankingItem: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: .5,
    borderColor: '#6C2BD9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    minHeight: 150,
  },
  resultPoster: {
    width: 100,
    height: 150,
  },
  movieDetails: {
    flex: 1,
    padding: 12,
    height: 150,
    justifyContent: 'space-between',
    overflow: 'hidden',
    paddingRight: 8,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
    height: 38,
    textAlignVertical: 'top',
    paddingRight: 4,
  },
  
  // Updated ranking styles
  rankingContainer: {
    width: 60,
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#8B5CF6',
  },
  rankBadge: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  rankNumber: {
    fontWeight: 'bold',
    fontSize: 24,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  
  scoreContainer: {
    marginTop: 2,
    flexGrow: 1,
    justifyContent: 'center',
  },
  finalScore: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  genresText: {
    fontSize: 11,
    numberOfLines: 1,
    ellipsizeMode: 'tail',
    marginBottom: 4,
  },
  editButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  editButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
});

export { getListStyles };
export default listStyles;