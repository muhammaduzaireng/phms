// API Configuration
// Uses production API by default, can be overridden with environment variable or localStorage
const getApiUrl = () => {
  // Check localStorage first (allows runtime configuration)
  if (typeof window !== 'undefined') {
    const savedApiUrl = localStorage.getItem('API_BASE_URL');
    if (savedApiUrl) {
      return savedApiUrl;
    }
  }
  
  // If explicitly set in environment variable, use it
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  
  // Production API URL - works on all internet connections
  return 'https://api.phms.devzytic.com';
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

