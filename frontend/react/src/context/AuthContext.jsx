import { createContext, useContext, useState, useEffect } from 'react';
import { getUser, getToken, clearAuth } from '../services/authStorage';
import { apiRequest } from '../services/apiClient';

// Auth Context for global auth state with HttpOnly Cookie session support
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUserState] = useState(() => getUser());
  const [token, setTokenState] = useState(() => getToken());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verify session with backend using HttpOnly cookie
    const verifySession = async () => {
      try {
        const res = await apiRequest('/auth/profile', 'GET', null, false);
        if (res.user) {
          setUserState(res.user);
          setTokenState((prev) => prev || 'cookie_session');
        } else {
          setUserState(null);
          setTokenState(null);
          clearAuth();
        }
      } catch (err) {
        // If 401 or network error without existing user, reset
        if (!getUser()) {
          setUserState(null);
          setTokenState(null);
        }
      } finally {
        setLoading(false);
      }
    };

    verifySession();
  }, []);

  const setUser = (userData) => {
    setUserState(userData);
    if (userData) {
      localStorage.setItem('user', JSON.stringify(userData));
      if (userData.collegeName) {
        localStorage.setItem('collegeName', userData.collegeName);
      }
    } else {
      localStorage.removeItem('user');
      localStorage.removeItem('collegeName');
    }
  };

  const setAuthToken = (newToken) => {
    setTokenState(newToken);
    if (newToken) {
      localStorage.setItem('token', newToken);
    } else {
      localStorage.removeItem('token');
    }
  };

  const logout = async () => {
    try {
      await apiRequest('/auth/logout', 'POST');
    } catch {
      // Ignore network errors on logout
    }
    setUserState(null);
    setTokenState(null);
    clearAuth();
  };

  const value = {
    user,
    token,
    setUser,
    setToken: setAuthToken,
    logout,
    loading,
    isAuthenticated: !!user || !!token,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
