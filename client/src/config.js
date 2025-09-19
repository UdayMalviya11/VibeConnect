// Centralized client configuration for API and assets
const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL ||
  (typeof window !== 'undefined' && window.__API_BASE_URL__) ||
  'http://localhost:3001';

// Ensure no double slashes
const cleanApiBaseUrl = API_BASE_URL.replace(/\/+$/, '');

export const config = {
  apiBaseUrl: cleanApiBaseUrl,
  assetsBaseUrl: `${cleanApiBaseUrl}/assets`,
};

export default config;


