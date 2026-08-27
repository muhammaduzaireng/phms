// API Configuration
// Uses production API by default, can be overridden with environment variable or localStorage
const getApiUrl = () => {
  let apiUrl = '';
  
  // Check localStorage first (allows runtime configuration)
  if (typeof window !== 'undefined') {
    const savedApiUrl = localStorage.getItem('API_BASE_URL');
    if (savedApiUrl) {
      apiUrl = savedApiUrl;
    }
  }

  // If not in localStorage, check environment variable
  if (!apiUrl && process.env.REACT_APP_API_URL) {
    apiUrl = process.env.REACT_APP_API_URL;
  }

  // Local backend during development; production API otherwise
  if (!apiUrl) {
    apiUrl = process.env.NODE_ENV === 'development'
      ? 'http://localhost:5001'
      : 'http://phms.devzytic.com';
  }

  // In local development, don't keep pointing at production if a stale URL was saved
  if (process.env.NODE_ENV === 'development' && apiUrl.includes('phms.devzytic.com')) {
    apiUrl = 'http://localhost:5001';
  }
  
  // Normalize URL - remove port for production API URLs
  try {
    const url = new URL(apiUrl);
    
    // For production API, remove port (standard HTTP/HTTPS ports)
    if (url.hostname === 'phms.devzytic.com') {
      // Remove default ports
      if (url.protocol === 'http:' && url.port === '80') {
        url.port = '';
      }
      if (url.protocol === 'https:' && url.port === '443') {
        url.port = '';
      }
      // Remove any port for production (use default ports)
      if (url.port === '5001' || url.port === '3000') {
        url.port = '';
      }
    }
    
    apiUrl = url.toString().replace(/\/$/, ''); // Remove trailing slash
  } catch (e) {
    // If URL parsing fails, fix common mistakes with string replacement
    if (apiUrl.includes('phms.devzytic.com')) {
      // Remove port numbers
      apiUrl = apiUrl.replace(/http:\/\/phms\.devzytic\.com:\d+/, 'http://phms.devzytic.com');
      apiUrl = apiUrl.replace(/https:\/\/phms\.devzytic\.com:\d+/, 'https://phms.devzytic.com');
    }
  }
  
  return apiUrl;
};

const API_BASE_URL = getApiUrl();

// Helper function to set API URL at runtime (useful for switching networks)
if (typeof window !== 'undefined') {
  window.setApiUrl = (url) => {
    localStorage.setItem('API_BASE_URL', url);
    window.location.reload();
  };
}

export default API_BASE_URL;

//This is updated

