import { StyleSheet, Platform, Dimensions } from 'react-native';

const { height, width } = Dimensions.get('window');

// Function to get themed modal styles
const getModalStyles = (mediaType = 'movie', mode = 'light', theme) => {
  const colors = theme[mediaType][mode];

  return StyleSheet.create({
    // STANDARD RATING MODAL (TopRated-style) - This is now the default
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
   modalContent: {
      width: '90%',
      borderRadius: 20,
      overflow: 'hidden',
      backgroundColor: colors.primary,
      maxHeight: '75%',
      minHeight: 400,
      flex: 1,
      marginVertical: '12.5%',
    },
    modalHandle: {
      width: 40,
      height: 5,
      borderRadius: 3,
      backgroundColor: colors.subText,
      alignSelf: 'center',
      marginBottom: 15,
    },
    modalButton: {
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderRadius: 10,
      flex: 1,
      marginHorizontal: 8,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 1.5,
    },
    cancelButton: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.3)',
      elevation: 0,
      shadowOpacity: 0,
    },
    modalButtonText: {
      fontSize: 16,
      fontWeight: '600',
      fontFamily: colors.font.body,
    },
    
    // LEGACY BOTTOM SHEET MODAL (for other uses)
    bottomSheetOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
      alignItems: 'center',
    },
    bottomSheetContent: {
      width: '100%',
      padding: 20,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      backgroundColor: colors.card,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.15,
      shadowRadius: 6,
      elevation: 8,
      paddingBottom: Platform.OS === 'ios' ? 30 : 20,
      maxHeight: height * 0.8,
    },
    animatedContainer: {
      width: '100%',
      position: 'relative',
      alignSelf: 'center',
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      marginBottom: 20,
      textAlign: 'center',
      color: colors.text,
      fontFamily: colors.font.header,
    },

    // MOVIE DETAIL MODAL (keep existing)
    detailModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.8)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 20,
    },
    detailModalContent: {
      width: width * 0.85,
      maxWidth: 350,
      backgroundColor: colors.primary,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.primary,
      padding: 20,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 10,
      maxHeight: height * 0.9,
    },
    detailPoster: {
      width: 140,
      height: 210,
      borderRadius: 12,
      marginBottom: 15,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 5,
    },
    detailTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 5,
      fontFamily: colors.font.header,
      lineHeight: 24,
    },
    detailYear: {
      fontSize: 16,
      color: colors.text,
      textAlign: 'center',
      marginBottom: 8,
      fontFamily: colors.font.body,
    },
    detailScore: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.accent,
      textAlign: 'center',
      marginBottom: 12,
      fontFamily: colors.font.body,
    },
    detailActors: {
      fontSize: 14,
      color: colors.text,
      textAlign: 'center',
      marginBottom: 12,
      paddingHorizontal: 10,
      fontFamily: colors.font.body,
      lineHeight: 18,
    },
    detailPlot: {
      fontSize: 14,
      color: colors.text,
      textAlign: 'center',
      marginBottom: 20,
      paddingHorizontal: 5,
      lineHeight: 20,
      fontFamily: colors.font.body,
    },
    streamingRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 20,
      minHeight: 40,
      paddingHorizontal: 10,
    },
    platformIcon: {
      width: 32,
      height: 32,
      marginHorizontal: 4,
      borderRadius: 6,
      backgroundColor: '#FFFFFF',
    },
    buttonRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      width: '100%',
      marginBottom: 20,
      paddingHorizontal: 5,
    },
    actionButton: {
      backgroundColor: colors.card,
      paddingVertical: 12,
      paddingHorizontal: 8,
      borderRadius: 10,
      flex: 1,
      marginHorizontal: 3,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 44,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 2,
      elevation: 3,
    },
    actionButtonText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '600',
      textAlign: 'center',
      fontFamily: colors.font.body,
      lineHeight: 16,
    },
    cancelButtonContainer: {
      paddingVertical: 8,
      paddingHorizontal: 20,
      alignItems: 'center',
    },
    cancelText: {
      color: colors.text,
      fontSize: 16,
      fontFamily: colors.font.body,
      textDecorationLine: 'underline',
    },

    // COMPARISON MODAL STYLES - Added for Profile screen consistency with Home screen
    comparisonModalContent: {
      width: '95%',
      maxWidth: 500,
      padding: 20,
      borderRadius: 16,
      maxHeight: '80%',
    },
    comparisonHeader: {
      alignItems: 'center',
      marginBottom: 20,
    },
    comparisonSubtitle: {
      fontSize: 14,
      marginTop: 4,
      color: colors.subText,
    },
    moviesComparison: {
      flexDirection: 'row',
      alignItems: 'flex-start', // Changed from 'center' to 'flex-start' for MovieCard alignment
      justifyContent: 'space-around', // Added for better spacing
      marginBottom: 20,
      paddingHorizontal: 10, // Added padding for better spacing
    },
    movieComparisonCard: {
      flex: 1,
      alignItems: 'center',
      padding: 16,
      borderRadius: 12,
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      marginHorizontal: 8,
    },
    comparisonPoster: {
      width: 120,
      height: 180,
      borderRadius: 8,
      marginBottom: 12,
    },
    movieCardName: {
      fontSize: 14,
      fontWeight: '600',
      textAlign: 'center',
      marginBottom: 4,
      color: colors.text,
    },
    movieCardYear: {
      fontSize: 12,
      textAlign: 'center',
      marginBottom: 8,
      color: colors.subText,
    },
    vsIndicator: {
      alignItems: 'center',
      justifyContent: 'center',
      marginHorizontal: 8, // Reduced from 16 to 8 for tighter spacing
      paddingVertical: 20, // Added vertical padding to center with MovieCards
    },
    vsText: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.accent,
    },
    ratingBadge: {
      position: 'absolute',
      top: 8,
      right: 8,
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderRadius: 12,
    },
    ratingText: {
      color: '#FFF',
      fontSize: 12,
      fontWeight: 'bold',
    },
    progressIndicator: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 20,
    },
    progressDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      marginHorizontal: 4,
    },
    finalRatingModal: {
      alignItems: 'center',
      paddingVertical: 20,
    },
    finalRatingPoster: {
      width: 140,
      height: 210,
      borderRadius: 12,
      marginBottom: 16,
    },
    finalRatingTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 8,
      paddingHorizontal: 20,
    },
    finalRatingYear: {
      fontSize: 12,
      color: colors.subText,
      textAlign: 'center',
      marginBottom: 20,
    },
    finalRatingScore: {
      fontSize: 28,
      fontWeight: 'bold',
      textAlign: 'center',
      color: colors.accent,
    },
  });
};

// Keep the original static styles for backward compatibility
const modalStyles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    position: 'absolute',
    width: '90%',
    borderRadius: 20,
    top: '10%',
  },
  modalHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#CCCCCC',
    alignSelf: 'center',
    marginBottom: 15,
  },
  modalButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    flex: 1,
    marginHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    elevation: 0,
    shadowOpacity: 0,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export { getModalStyles };
export default modalStyles;