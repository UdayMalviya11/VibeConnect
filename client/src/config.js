// Centralized client configuration for API and assets
const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL ||
  (typeof window !== 'undefined' && window.__API_BASE_URL__) ||
  'http://localhost:3001';

export const config = {
  apiBaseUrl: API_BASE_URL,
  assetsBaseUrl: `${API_BASE_URL}/assets`,
};

export default config;


