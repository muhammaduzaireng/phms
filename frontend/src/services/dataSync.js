// Data Sync Service - Selective Caching for Large Datasets
// Only caches essential data (stock, custom products, purchase orders)
// Does NOT cache all medicines - fetches on demand

import API_BASE_URL from '../config/api';
import { storeEssentialData, getEssentialData, cacheSearchResult, getCachedSearch, cleanupCache } from './smartCache';

// Initialize storage - with persistent singleton pattern to prevent multiple initializations
const INIT_FLAG_KEY = 'pharmacy_data_sync_initialized_v2';

// Use a module-level promise to prevent concurrent initializations
let initPromise = null;

export const initDatabase = async () => {
  // If already initialized in this session, return immediately
  try {
    if (sessionStorage.getItem(INIT_FLAG_KEY) === 'true') {
      return true;
    }
  } catch (e) {
    // sessionStorage might not be available (private mode, etc.)
  }

  // If initialization is in progress, wait for it
  if (initPromise) {
    return initPromise;
  }

  // Start initialization and store the promise
  initPromise = (async () => {
    try {
      // Set flag immediately to prevent race conditions
      try {
        sessionStorage.setItem(INIT_FLAG_KEY, 'true');
      } catch (e) {
        // sessionStorage might not be available
      }

      // Cleanup old cache entries
      cleanupCache();
      
      // Only log once per session, and only in development
      if (process.env.NODE_ENV === 'development') {
        console.log('[Data Sync] Storage initialized with selective caching');
      }
      
      return true;
    } catch (error) {
      console.error('[Data Sync] Initialization error:', error);
      // Clear flag on error so it can retry
      try {
        sessionStorage.removeItem(INIT_FLAG_KEY);
      } catch (e) {
        // ignore
      }
      initPromise = null; // Reset promise on error
      return false;
    }
  })();

  return initPromise;
};

// Download essential data only (not all medicines)
// Prevent concurrent downloads with persistent flags
const DOWNLOAD_FLAG_KEY = 'pharmacy_download_in_progress_v2';
const LAST_DOWNLOAD_KEY = 'pharmacy_last_download_time_v2';
const MIN_DOWNLOAD_INTERVAL = 30000; // 30 seconds minimum between downloads

// Use a module-level promise to prevent concurrent downloads
let downloadPromise = null;

export const downloadAllData = async (token = null) => {
  if (!navigator.onLine) {
    return { success: false, error: 'Offline' };
  }

  // FIRST: Check promise (module-level, fastest check, prevents race conditions)
  if (downloadPromise) {
    // Wait for existing download if in progress
    return await downloadPromise;
  }

  // SECOND: Check sessionStorage and throttling
  try {
    // Throttle downloads - don't download if last download was recent
    const lastDownloadTime = parseInt(sessionStorage.getItem(LAST_DOWNLOAD_KEY) || '0', 10);
    const now = Date.now();
    if (now - lastDownloadTime < MIN_DOWNLOAD_INTERVAL) {
      return { success: true, skipped: true };
    }

    // Check if a download is marked as in progress (from previous session/module reload)
    if (sessionStorage.getItem(DOWNLOAD_FLAG_KEY) === 'true') {
      // Clear stale flag (download might have completed but flag wasn't cleared)
      const staleTime = parseInt(sessionStorage.getItem(`${DOWNLOAD_FLAG_KEY}_time`) || '0', 10);
      if (now - staleTime > 60000) { // If flag is older than 1 minute, it's stale
        sessionStorage.removeItem(DOWNLOAD_FLAG_KEY);
        sessionStorage.removeItem(`${DOWNLOAD_FLAG_KEY}_time`);
      } else {
        return { success: false, error: 'Download in progress', skipped: true };
      }
    }

    // Set download flag immediately (before creating promise) to prevent race conditions
    sessionStorage.setItem(DOWNLOAD_FLAG_KEY, 'true');
    sessionStorage.setItem(`${DOWNLOAD_FLAG_KEY}_time`, now.toString());
    sessionStorage.setItem(LAST_DOWNLOAD_KEY, now.toString());
  } catch (e) {
    // sessionStorage might not be available (private mode, etc.)
    // Continue anyway - promise will prevent concurrent downloads
  }

  // Create and store the download promise
  downloadPromise = (async () => {
    try {
      const authHeaders = token ? { 'Authorization': `Bearer ${token}` } : {};

      // Only log once per download attempt (throttled already)
      if (process.env.NODE_ENV === 'development') {
        console.log('[Data Sync] Starting essential data download (selective caching)...');
      }

      // Download stock (if authenticated) - ESSENTIAL
      let stock = [];
      if (token) {
        try {
          const stockResponse = await fetch(`${API_BASE_URL}/api/stock`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (stockResponse.ok) {
            stock = await stockResponse.json();
            storeEssentialData('stock', stock);
          }
        } catch (err) {
          console.error('[Data Sync] Error downloading stock:', err);
        }
      }

      // Download custom products (if authenticated) - ESSENTIAL
      let customProducts = [];
      if (token) {
        try {
          const customResponse = await fetch(`${API_BASE_URL}/api/custom-products`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (customResponse.ok) {
            customProducts = await customResponse.json();
            storeEssentialData('custom_products', customProducts.products || customProducts);
          }
        } catch (err) {
          console.error('[Data Sync] Error downloading custom products:', err);
        }
      }

      // Download purchase orders (if authenticated) - ESSENTIAL (recent only)
      let purchaseOrders = [];
      if (token) {
        try {
          const poResponse = await fetch(`${API_BASE_URL}/api/purchase-orders?limit=100`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (poResponse.ok) {
            const poData = await poResponse.json();
            purchaseOrders = poData.orders || [];
            storeEssentialData('purchase_orders', purchaseOrders);
          }
        } catch (err) {
          console.error('[Data Sync] Error downloading purchase orders:', err);
        }
      }

      // Store last sync timestamp
      storeEssentialData('last_sync', {
        timestamp: Date.now(),
        dataCount: {
          stock: stock.length,
          customProducts: customProducts.length,
          purchaseOrders: purchaseOrders.length
        }
      });

      if (process.env.NODE_ENV === 'development') {
        console.log('[Data Sync] Essential data download complete:', {
          stock: stock.length,
          customProducts: customProducts.length,
          purchaseOrders: purchaseOrders.length,
          note: 'Medicines are fetched on-demand (not cached)'
        });
      }

      return { success: true };
    } catch (error) {
      console.error('[Data Sync] Error downloading data:', error);
      return { success: false, error: error.message };
    } finally {
      // Clear download flag and promise
      try {
        sessionStorage.removeItem(DOWNLOAD_FLAG_KEY);
      } catch (e) {
        // ignore
      }
      downloadPromise = null;
    }
  })();

  return downloadPromise;
};

// Get data from local storage (essential data only)
export const getLocalData = async (storeName) => {
  try {
    const data = getEssentialData(storeName);
    return data || [];
  } catch (error) {
    console.error(`[Data Sync] Error getting data from ${storeName}:`, error);
    return null;
  }
};

// Cache medicine search result
export const cacheMedicineSearch = (searchTerm, results) => {
  return cacheSearchResult(searchTerm, results);
};

// Get cached medicine search
export const getCachedMedicineSearch = (searchTerm) => {
  return getCachedSearch(searchTerm);
};

// Sync queue management (using localStorage)
const STORAGE_KEYS = {
  SYNC_QUEUE: 'pharmacy_sync_queue'
};

// Get sync queue
const getSyncQueue = () => {
  try {
    const queueData = localStorage.getItem(STORAGE_KEYS.SYNC_QUEUE);
    return queueData ? JSON.parse(queueData) : [];
  } catch (error) {
    return [];
  }
};

// Add item to sync queue
export const addToSyncQueue = async (type, data, endpoint, method = 'POST') => {
  try {
    const queue = getSyncQueue();
    
    const queueItem = {
      id: Date.now() + Math.random(), // Unique ID
      type,
      data,
      endpoint,
      method,
      status: 'pending',
      createdAt: Date.now(),
      retryCount: 0
    };

    queue.push(queueItem);
    localStorage.setItem(STORAGE_KEYS.SYNC_QUEUE, JSON.stringify(queue));

    console.log(`[Data Sync] Added to sync queue: ${type} (Queue size: ${queue.length})`);
    return true;
  } catch (error) {
    console.error('[Data Sync] Error adding to sync queue:', error);
    return false;
  }
};

// Sync pending items in queue
export const syncQueue = async (token) => {
  if (!navigator.onLine || !token) {
    return { synced: 0, failed: 0 };
  }

  try {
    const queue = getSyncQueue();
    const pendingItems = queue.filter(item => item.status === 'pending');
    
    let synced = 0;
    let failed = 0;
    const updatedQueue = [...queue];

    for (let i = 0; i < updatedQueue.length; i++) {
      const item = updatedQueue[i];
      if (item.status !== 'pending') continue;

      try {
        const response = await fetch(`${API_BASE_URL}${item.endpoint}`, {
          method: item.method,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(item.data)
        });

        if (response.ok) {
          // Remove from queue
          updatedQueue.splice(i, 1);
          i--; // Adjust index after removal
          synced++;
          console.log(`[Data Sync] Synced item: ${item.type}`);
        } else {
          // Mark as failed after 3 retries
          if (item.retryCount >= 3) {
            item.status = 'failed';
            failed++;
          } else {
            item.retryCount++;
          }
        }
      } catch (error) {
        console.error(`[Data Sync] Error syncing item ${item.id}:`, error);
        if (item.retryCount >= 3) {
          item.status = 'failed';
          failed++;
        } else {
          item.retryCount++;
        }
      }
    }

    // Save updated queue
    localStorage.setItem(STORAGE_KEYS.SYNC_QUEUE, JSON.stringify(updatedQueue));

    console.log(`[Data Sync] Sync complete: ${synced} synced, ${failed} failed, ${updatedQueue.length} remaining`);
    return { synced, failed, remaining: updatedQueue.length };
  } catch (error) {
    console.error('[Data Sync] Error syncing queue:', error);
    return { synced: 0, failed: 0 };
  }
};

// Get sync queue status
export const getSyncQueueStatus = async () => {
  try {
    const queue = getSyncQueue();
    const pending = queue.filter(item => item.status === 'pending').length;
    const failed = queue.filter(item => item.status === 'failed').length;

    return { pending, failed, total: queue.length };
  } catch (error) {
    console.error('[Data Sync] Error getting queue status:', error);
    return { pending: 0, failed: 0, total: 0 };
  }
};

// Check if online and trigger sync
export const checkAndSync = async (token) => {
  if (navigator.onLine && token) {
    // Sync queue first
    await syncQueue(token);
    // Then download fresh essential data
    await downloadAllData(token);
  }
};

// Get last sync time
export const getLastSyncTime = async () => {
  try {
    const lastSync = getEssentialData('last_sync');
    return lastSync ? lastSync.timestamp : null;
  } catch (error) {
    return null;
  }
};

// Clear all offline data (for testing/debugging)
export const clearOfflineData = () => {
  try {
    localStorage.removeItem(STORAGE_KEYS.SYNC_QUEUE);
    // Clear essential data
    ['stock', 'custom_products', 'purchase_orders', 'last_sync'].forEach(key => {
      const storageKey = `pharmacy_${key}`;
      localStorage.removeItem(storageKey);
    });
    console.log('[Data Sync] All offline data cleared');
    return true;
  } catch (error) {
    console.error('[Data Sync] Error clearing data:', error);
    return false;
  }
};
