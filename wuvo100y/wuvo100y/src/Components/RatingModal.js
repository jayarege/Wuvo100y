import React from 'react';
import { 
  Modal, 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  Image, 
  KeyboardAvoidingView, 
  Platform,
  Animated 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getModalStyles } from '../Styles/modalStyles';
import { getRatingStyles } from '../Styles/ratingStyles';

const RatingModal = ({
  visible,
  onClose,
  onSubmit,
  movie,
  ratingInput,
  setRatingInput,
  slideAnim,
  mediaType,
  isDarkMode,
  theme,
  genres
}) => {
  const modalStyles = getModalStyles(mediaType, isDarkMode ? 'dark' : 'light', theme);
  const ratingStyles = getRatingStyles(mediaType, isDarkMode ? 'dark' : 'light', theme);
  const colors = theme[mediaType][isDarkMode ? 'dark' : 'light'];

  const handleTextChange = (text) => {
    if (text === '' || text === '.' || text === '10' || text === '10.0') {
      setRatingInput(text);
    } else {
      const value = parseFloat(text);
      if (!isNaN(value) && value >= 1 && value <= 10) {
        if (text.includes('.')) {
          const parts = text.split('.');
          if (parts[1].length > 1) {
            setRatingInput(parts[0] + '.' + parts[1].substring(0, 1));
          } else {
            setRatingInput(text);
          }
        } else {
          setRatingInput(text);
        }
      }
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 20}
      >
        <View style={modalStyles.modalOverlay}>
          <Animated.View
            style={[
              modalStyles.modalContent,
              { 
                transform: [{ translateY: slideAnim }]
              }
            ]}
          >
            <LinearGradient
              colors={colors.primaryGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ 
                flex: 1, 
                borderRadius: 20,
                position: 'relative',
                minHeight: 400
              }}
            >
              <View style={[ratingStyles.modalContentContainer, { flex: 1, paddingBottom: 150 }]}>
                <View style={modalStyles.modalHandle} />
                
                {/* Movie Info */}
                <View style={ratingStyles.modalMovieInfo}>
                  <Image 
                    source={{ uri: `https://image.tmdb.org/t/p/w500${movie?.poster_path}` }} 
                    style={ratingStyles.modalPoster}
                    resizeMode="cover"
                  />
                  <View style={ratingStyles.modalMovieDetails}>
                    <Text style={ratingStyles.modalMovieTitle}>
                      {movie?.title || movie?.name}
                    </Text>
                    
                    <View style={ratingStyles.genreTextContainer}>
                      <Text style={[ratingStyles.modalGenres, { color: '#FFFFFF' }]}>
                        {movie?.genre_ids?.length > 0 ? genres[movie.genre_ids[0]] || '' : ''}
                      </Text>
                    </View>
                    
                    <View style={ratingStyles.ratingDisplay}>
                      <Ionicons name="star" size={16} color={colors.accent} />
                      <Text style={{ color: colors.accent, marginLeft: 4 }}>
                        TMDb: {movie?.vote_average?.toFixed(1) || '0.0'}
                      </Text>
                    </View>
                  </View>
                </View>
                
                {/* Flexible spacer */}
                <View style={{ flex: 1, justifyContent: 'center', minHeight: 80 }}>
                  {/* Rating input section */}
                  <View style={{ paddingVertical: 15 }}>
                    <Text style={[ratingStyles.ratingLabel, { marginBottom: 15 }]}>
                      Your Rating (1.0-10.0):
                    </Text>
                    
                    <TextInput
                      style={ratingStyles.ratingInput}
                      value={ratingInput}
                      onChangeText={handleTextChange}
                      keyboardType="decimal-pad"
                      placeholder="Enter rating"
                      placeholderTextColor={colors.subText}
                      maxLength={4}
                      autoFocus={true}
                      selectTextOnFocus={true}
                    />
                  </View>
                </View>
              </View>
              
              {/* Modal buttons - Fixed at bottom within gradient */}
              <View style={[ratingStyles.fixedButtonsContainer, { 
                backgroundColor: 'rgba(0,0,0,0.1)',
                borderTopColor: 'rgba(255,255,255,0.2)',
                borderTopWidth: 1,
                marginTop: 'auto'
              }]}>
                <TouchableOpacity
                  style={[
                    modalStyles.modalButton, 
                    { 
                      backgroundColor: 'rgba(255,255,255,0.9)',
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.25,
                      shadowRadius: 3.84,
                      elevation: 5,
                    }
                  ]}
                  onPress={onSubmit}
                >
                  <Text style={[
                    modalStyles.modalButtonText,
                    { 
                      color: colors.primary, 
                      fontWeight: '700',
                      fontSize: 16,
                      textAlign: 'center'
                    }
                  ]}>
                    Submit Rating
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    modalStyles.modalButton, 
                    { 
                      backgroundColor: 'rgba(255,255,255,0.15)',
                      borderWidth: 1.5,
                      borderColor: 'rgba(255,255,255,0.4)',
                    }
                  ]}
                  onPress={onClose}
                >
                  <Text style={[
                    modalStyles.modalButtonText, 
                    { 
                      color: '#FFFFFF', 
                      fontWeight: '600',
                      fontSize: 16,
                      textAlign: 'center'
                    }
                  ]}>
                    Cancel
                  </Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export { RatingModal };