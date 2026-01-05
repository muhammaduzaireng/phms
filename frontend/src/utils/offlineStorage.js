// Offline Storage Utilities
// Store data in IndexedDB or localStorage for offline access

const STORAGE_PREFIX = 'pharmacy_offline_';

export const offlineStorage = {
  // Save data to localStorage
  set: (key, value) => {
    try {
      const data = {
        value,
        timestamp: Date.now()
      };
      localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('Error saving to offline storage:', error);
      return false;
    }
  },

  // Get data from localStorage
  get: (key) => {
    try {
      const item = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
      if (!item) return null;
      
      const data = JSON.parse(item);
      return data.value;
    } catch (error) {
      console.error('Error reading from offline storage:', error);
      return null;
    }
  },

  // Remove data from localStorage
  remove: (key) => {
    try {
      localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
      return true;
    } catch (error) {
      console.error('Error removing from offline storage:', error);
      return false;
    }
  },

  // Clear all offline data
  clear: () => {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(STORAGE_PREFIX)) {
          localStorage.removeItem(key);
        }
      });
      return true;
    } catch (error) {
      console.error('Error clearing offline storage:', error);
      return false;
    }
  },

  // Check if online
  isOnline: () => {
    return navigator.onLine;
  },

  // Get all keys
  getAllKeys: () => {
    try {
      const keys = Object.keys(localStorage);
      return keys
        .filter(key => key.startsWith(STORAGE_PREFIX))
        .map(key => key.replace(STORAGE_PREFIX, ''));
    } catch (error) {
      console.error('Error getting keys:', error);
      return [];
    }
  }
};

// Cache API responses for offline access
export const cacheApiResponse = (url, data) => {
  offlineStorage.set(`api_${url}`, data);
};

export const getCachedApiResponse = (url) => {
  return offlineStorage.get(`api_${url}`);
};

