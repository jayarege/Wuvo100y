import React, { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { TMDB_API_KEY, STREAMING_SERVICES_PRIORITY } from '../Constants';

// **STREAMING PROVIDER PAYMENT TYPE MAPPING** - Based on common provider business models
const getProviderPaymentType = (providerId) => {
  // Free services (ad-supported)
  const freeProviders = [
    546, // YouTube
    613, // Tubi
    350, // Apple TV (has free content)
    283, // Crackle
    207, // YouTube Movies
    457, // Vudu (has free with ads)
  ];
  
  // Most major streaming services are paid
  const paidProviders = [
    8,   // Netflix
    384, // HBO Max
    9,   // Amazon Prime Video
    15,  // Hulu
    337, // Disney+
    387, // Peacock Premium
    1899, // Max
    531, // Paramount+
    26,  // Crunchyroll
    2,   // Apple TV+
    286, // Showtime
  ];
  
  if (freeProviders.includes(providerId)) return 'free';
  if (paidProviders.includes(providerId)) return 'paid';
  
  // Default to paid for unknown providers (most streaming services are paid)
  return 'paid';
};

export const StreamingProviders = ({ movie, visible, style }) => {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && movie?.id) {
      fetchStreamingProviders(movie.id, movie.mediaType || 'movie');
    }
  }, [movie, visible]);

  const fetchStreamingProviders = async (movieId, mediaType) => {
    setLoading(true);
    try {
      const response = await fetch(
        `https://api.themoviedb.org/3/${mediaType}/${movieId}/watch/providers?api_key=${TMDB_API_KEY}`
      );
      const data = await response.json();
      
      // Get US providers and prioritize based on STREAMING_SERVICES_PRIORITY
      const usProviders = data.results?.US?.flatrate || [];
      const sortedProviders = usProviders.sort((a, b) => {
        const priorityA = STREAMING_SERVICES_PRIORITY.indexOf(a.provider_name) || 999;
        const priorityB = STREAMING_SERVICES_PRIORITY.indexOf(b.provider_name) || 999;
        return priorityA - priorityB;
      });
      
      setProviders(sortedProviders.slice(0, 3)); // Show max 3 providers
    } catch (error) {
      console.error('Error fetching streaming providers:', error);
      setProviders([]);
    } finally {
      setLoading(false);
    }
  };

  if (!visible || loading) {
    return loading ? <ActivityIndicator size="small" /> : null;
  }

  if (providers.length === 0) {
    return null;
  }

  return (
    <View style={[styles.container, style]}>
      <View style={styles.providersRow}>
        {providers.map((provider) => {
          const paymentType = getProviderPaymentType(provider.provider_id);
          return (
            <View key={provider.provider_id} style={styles.providerItem}>
              <Image
                source={{ uri: `https://image.tmdb.org/t/p/w92${provider.logo_path}` }}
                style={[
                  styles.providerLogo,
                  {
                    borderColor: paymentType === 'paid' ? '#FF4444' : '#22C55E',
                    borderWidth: 0.5,
                  }
                ]}
                resizeMode="contain"
              />
              <Text style={[
                styles.paymentIndicator,
                {
                  color: paymentType === 'paid' ? '#FF4444' : '#22C55E',
                }
              ]}>
                {paymentType === 'paid' ? '$' : 'FREE'}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  providersRow: {
    flexDirection: 'row',
    marginTop: 4,
    flexWrap: 'wrap',
  },
  providerItem: {
    alignItems: 'center',
    marginRight: 8,
  },
  providerLogo: {
    width: 32,
    height: 32,
    borderRadius: 4,
  },
  paymentIndicator: {
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 2,
  },
});