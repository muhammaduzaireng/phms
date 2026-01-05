// Smart Cache Manager for Large Datasets
// Only caches essential data, not the full dataset

const CACHE_CONFIG = {
  MAX_CACHED_SEARCHES: 500, // Maximum cached medicine searches
  CACHE_EXPIRY_DAYS: 7, // Cache expiry in days
  ESSENTIAL_DATA: ['stock', 'custom_products', 'purchase_orders'], // Always cache these
};

const STORAGE_KEYS = {
  STOCK: 'pharmacy_stock',
  CUSTOM_PRODUCTS: 'pharmacy_custom_products',
  PURCHASE_ORDERS: 'pharmacy_purchase_orders',
  SEARCH_CACHE: 'pharmacy_search_cache', // LRU cache for searches
  LAST_SYNC: 'pharmacy_last_sync'
};

// Cache search results (LRU - Least Recently Used)
export const cacheSearchResult = (searchTerm, results) => {
  try {
    const cache = getSearchCache();
    
    // Remove if already exists (to update position)
    const existingIndex = cache.findIndex(item => item.searchTerm === searchTerm);
    if (existingIndex >= 0) {
      cache.splice(existingIndex, 1);
    }
    
    // Add to front (most recent)
    cache.unshift({
      searchTerm: searchTerm.toLowerCase(),
      results: results,
      timestamp: Date.now()
    });
    
    // Keep only last N items (LRU)
    if (cache.length > CACHE_CONFIG.MAX_CACHED_SEARCHES) {
      cache.splice(CACHE_CONFIG.MAX_CACHED_SEARCHES);
    }
    
    localStorage.setItem(STORAGE_KEYS.SEARCH_CACHE, JSON.stringify(cache));
    return true;
  } catch (error) {
    console.error('[Smart Cache] Error caching search:', error);
    return false;
  }
};

// Get cached search result
export const getCachedSearch = (searchTerm) => {
  try {
    const cache = getSearchCache();
    const searchTermLower = searchTerm.toLowerCase();
    
    // Find exact match
    const cached = cache.find(item => item.searchTerm === searchTermLower);
    if (cached) {
      // Check if expired
      const ageInDays = (Date.now() - cached.timestamp) / (1000 * 60 * 60 * 24);
      if (ageInDays < CACHE_CONFIG.CACHE_EXPIRY_DAYS) {
        // Move to front (mark as recently used)
        const index = cache.indexOf(cached);
        cache.splice(index, 1);
        cache.unshift(cached);
        localStorage.setItem(STORAGE_KEYS.SEARCH_CACHE, JSON.stringify(cache));
        return cached.results;
      }
    }
    
    // Try fuzzy match (contains)
    const fuzzyMatch = cache.find(item => 
      searchTermLower.includes(item.searchTerm) || item.searchTerm.includes(searchTermLower)
    );
    if (fuzzyMatch) {
      const ageInDays = (Date.now() - fuzzyMatch.timestamp) / (1000 * 60 * 60 * 24);
      if (ageInDays < CACHE_CONFIG.CACHE_EXPIRY_DAYS) {
        return fuzzyMatch.results;
      }
    }
    
    return null;
  } catch (error) {
    console.error('[Smart Cache] Error getting cached search:', error);
    return null;
  }
};

// Get search cache
const getSearchCache = () => {
  try {
    const cacheData = localStorage.getItem(STORAGE_KEYS.SEARCH_CACHE);
    return cacheData ? JSON.parse(cacheData) : [];
  } catch (error) {
    return [];
  }
};

// Store essential data (stock, custom products, etc.)
export const storeEssentialData = (key, data) => {
  try {
    if (!CACHE_CONFIG.ESSENTIAL_DATA.includes(key)) {
      console.warn(`[Smart Cache] ${key} is not in essential data list`);
    }
    
    const storageKey = STORAGE_KEYS[key.toUpperCase()] || key;
    localStorage.setItem(storageKey, JSON.stringify({
      data: data,
      timestamp: Date.now()
    }));
    return true;
  } catch (error) {
    console.error(`[Smart Cache] Error storing ${key}:`, error);
    return false;
  }
};

// Get essential data
export const getEssentialData = (key) => {
  try {
    const storageKey = STORAGE_KEYS[key.toUpperCase()] || key;
    const data = localStorage.getItem(storageKey);
    if (!data) return null;
    
    const parsed = JSON.parse(data);
    return parsed.data;
  } catch (error) {
    console.error(`[Smart Cache] Error getting ${key}:`, error);
    return null;
  }
};

// Clear old cache entries
export const cleanupCache = () => {
  try {
    const cache = getSearchCache();
    const now = Date.now();
    const expiryTime = CACHE_CONFIG.CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    
    const filtered = cache.filter(item => (now - item.timestamp) < expiryTime);
    
    if (filtered.length !== cache.length) {
      localStorage.setItem(STORAGE_KEYS.SEARCH_CACHE, JSON.stringify(filtered));
      console.log(`[Smart Cache] Cleaned up ${cache.length - filtered.length} expired entries`);
    }
    
    return true;
  } catch (error) {
    console.error('[Smart Cache] Error cleaning cache:', error);
    return false;
  }
};

// Get cache stats
export const getCacheStats = () => {
  try {
    const cache = getSearchCache();
    const stock = getEssentialData('stock') || [];
    const customProducts = getEssentialData('custom_products') || [];
    const purchaseOrders = getEssentialData('purchase_orders') || [];
    
    // Calculate storage size (rough estimate)
    const cacheSize = JSON.stringify(cache).length;
    const stockSize = JSON.stringify(stock).length;
    const customSize = JSON.stringify(customProducts).length;
    const poSize = JSON.stringify(purchaseOrders).length;
    const totalSize = cacheSize + stockSize + customSize + poSize;
    
    return {
      searchCacheEntries: cache.length,
      stockItems: stock.length,
      customProducts: customProducts.length,
      purchaseOrders: purchaseOrders.length,
      estimatedSize: {
        cache: (cacheSize / 1024).toFixed(2) + ' KB',
        stock: (stockSize / 1024).toFixed(2) + ' KB',
        customProducts: (customSize / 1024).toFixed(2) + ' KB',
        purchaseOrders: (poSize / 1024).toFixed(2) + ' KB',
        total: (totalSize / 1024).toFixed(2) + ' KB'
      }
    };
  } catch (error) {
    console.error('[Smart Cache] Error getting stats:', error);
    return null;
  }
};

// Clear all cache
export const clearAllCache = () => {
  try {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
    console.log('[Smart Cache] All cache cleared');
    return true;
  } catch (error) {
    console.error('[Smart Cache] Error clearing cache:', error);
    return false;
  }
};

