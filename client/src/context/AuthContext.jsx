import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('skillswap_token') || null);
  const [loading, setLoading] = useState(true);

  // Verify stored token on initial app mount
  useEffect(() => {
    const verifyUser = async () => {
      const storedToken = localStorage.getItem('skillswap_token');
      if (!storedToken) {
        setLoading(false);
        return;
      }

      try {
        const response = await api.get('/auth/me');
        if (response.success && response.data) {
          setUser(response.data);
        } else {
          logout();
        }
      } catch (err) {
        console.warn('Initial session check failed:', err.message);
        logout();
      } finally {
        setLoading(false);
      }
    };

    verifyUser();
  }, []);

  // Listen for session revocation (e.g. account deactivated by admin or token invalidated)
  useEffect(() => {
    const handleSessionRevoked = (event) => {
      const revokeMsg =
        event.detail?.message ||
        'Your account has been deactivated. Please contact the administrator for assistance.';
      logout();
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('auth_revoked_notice', revokeMsg);
      }
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    };

    window.addEventListener('auth:session_revoked', handleSessionRevoked);
    return () => {
      window.removeEventListener('auth:session_revoked', handleSessionRevoked);
    };
  }, []);

  const login = (userData, authToken) => {
    localStorage.setItem('skillswap_token', authToken);
    localStorage.setItem('skillswap_user', JSON.stringify(userData));
    setToken(authToken);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('skillswap_token');
    localStorage.removeItem('skillswap_user');
    setToken(null);
    setUser(null);
  };

  const updateUser = (updatedData) => {
    setUser((prev) => {
      const nextUser = { ...prev, ...updatedData };
      localStorage.setItem('skillswap_user', JSON.stringify(nextUser));
      return nextUser;
    });
  };

  const value = {
    user,
    token,
    loading,
    isAuthenticated: !!token && !!user,
    isAdmin: user?.role === 'admin',
    login,
    logout,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
