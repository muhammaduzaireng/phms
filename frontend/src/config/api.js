// API Configuration
// Priority: Environment variable > Production API > Check if running on network IP > Default to localhost
const getApiUrl = () => {
  // If explicitly set in environment variable, use it
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  
  // Production API URL
  const PRODUCTION_API = 'http://phms.devzytic.com';
  
  // If in Electron and packaged, use production API
  if (typeof window !== 'undefined' && window.electronAPI && window.location.protocol === 'file:') {
    return PRODUCTION_API;
  }
  
  // If accessing from another machine (not localhost), detect server IP
  // This helps when accessing from another laptop on the same network
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    
    // If accessing via IP address (not localhost), try to use same IP for API
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return `http://${hostname}:5001`;
    }
  }
  
  // Default to localhost for local development
  return 'http://localhost:5001';
};

const API_BASE_URL = getApiUrl();

export default API_BASE_URL;

