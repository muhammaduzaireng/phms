// Same-origin API. Browser uses the current host/protocol
// (e.g. https://phms.devzytic.com/api/...). Nginx or the
// CRA dev proxy forwards /api to the backend.
const API_BASE_URL = '';

if (typeof window !== 'undefined') {
  localStorage.removeItem('API_BASE_URL');
}

export default API_BASE_URL;
