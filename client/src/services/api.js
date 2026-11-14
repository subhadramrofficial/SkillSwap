import axios from 'axios';

const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD
    ? 'https://skillswap-backend-tytf.onrender.com/api/v1'
    : 'http://localhost:5000/api/v1');

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: Attach JWT token if present in localStorage
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('skillswap_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor: Extract response data and handle auth expiration or deactivation cleanly
api.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    const status = error.response?.status;
    const message =
      error.response?.data?.message ||
      error.message ||
      'An unexpected network error occurred';

    const url = error.config?.url || '';
    const isAuthRoute =
      url.includes('/auth/login') ||
      url.includes('/auth/register') ||
      url.includes('/auth/forgot-password');

    const isDeactivated =
      message.toLowerCase().includes('deactivated') ||
      message.toLowerCase().includes('suspended') ||
      message.toLowerCase().includes('inactive');

    // If session expired (401) or account was deactivated/suspended (403) while logged in:
    if (!isAuthRoute && (status === 401 || (status === 403 && isDeactivated))) {
      localStorage.removeItem('skillswap_token');
      localStorage.removeItem('skillswap_user');

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('auth:session_revoked', {
            detail: { message, status },
          })
        );
      }
    }

    return Promise.reject({
      status,
      message,
      errors: error.response?.data?.errors,
    });
  }
);

export default api;
