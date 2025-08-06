import AsyncStorage from '@react-native-async-storage/async-storage';

// SECURITY: Safe JSON parsing to prevent prototype pollution
const safeJSONParse = (jsonString) => {
  try {
    // Parse JSON without allowing __proto__ or constructor properties
    const parsed = JSON.parse(jsonString, (key, value) => {
      // SECURITY: Block dangerous property names that can cause prototype pollution
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        console.warn('Blocked potentially malicious property during JSON parse:', key);
        return undefined;
      }
      return value;
    });
    
    // SECURITY: Additional validation to ensure we don't have malicious objects
    if (parsed && typeof parsed === 'object') {
      // Remove any dangerous properties that might have slipped through
      delete parsed.__proto__;
      delete parsed.constructor;
      delete parsed.prototype;
    }
    
    return parsed;
  } catch (error) {
    console.error('Safe JSON parse failed:', error);
    return null;
  }
};

export const storageService = {
  async getItem(key) {
    try {
      // SECURITY: Validate key to prevent directory traversal
      if (typeof key !== 'string' || key.length === 0 || key.includes('..') || key.length > 200) {
        console.error('Invalid storage key:', key);
        return null;
      }
      
      const value = await AsyncStorage.getItem(key);
      return value ? safeJSONParse(value) : null;
    } catch (error) {
      console.error(`Failed to get item ${key}:`, error);
      return null;
    }
  },

  async setItem(key, value) {
    try {
      // SECURITY: Validate key to prevent directory traversal  
      if (typeof key !== 'string' || key.length === 0 || key.includes('..') || key.length > 200) {
        console.error('Invalid storage key:', key);
        return false;
      }
      
      // SECURITY: Prevent storing dangerous objects
      if (value && typeof value === 'object') {
        if (value.__proto__ || value.constructor !== Object || value.prototype) {
          console.error('Blocked storage of potentially malicious object');
          return false;
        }
      }
      
      const jsonValue = JSON.stringify(value);
      
      // SECURITY: Limit storage size to prevent DoS attacks
      if (jsonValue.length > 1000000) { // 1MB limit
        console.error('Storage value too large:', jsonValue.length);
        return false;
      }
      
      await AsyncStorage.setItem(key, jsonValue);
      return true;
    } catch (error) {
      console.error(`Failed to set item ${key}:`, error);
      return false;
    }
  },

  async removeItem(key) {
    try {
      await AsyncStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error(`Failed to remove item ${key}:`, error);
      return false;
    }
  },

  async multiRemove(keys) {
    try {
      await AsyncStorage.multiRemove(keys);
      return true;
    } catch (error) {
      console.error(`Failed to remove multiple items:`, error);
      return false;
    }
  },

  async clear() {
    try {
      await AsyncStorage.clear();
      return true;
    } catch (error) {
      console.error('Failed to clear storage:', error);
      return false;
    }
  },

  async getAllKeys() {
    try {
      return await AsyncStorage.getAllKeys();
    } catch (error) {
      console.error('Failed to get all keys:', error);
      return [];
    }
  }
};