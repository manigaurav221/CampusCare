import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest, formatApiError } from '../services/apiClient';
import { setToken, setUser } from '../services/authStorage';
import { useAuth as useAuthContext } from '../context/AuthContext';

// Auth operations hook
// Replaces: auth.js login/register handlers

export function useAuthOperations() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const { setUser: setContextUser, setToken: setContextToken } = useAuthContext();

  const login = async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest('/auth/login', 'POST', {
        email: email.trim(),
        password,
      });

      setToken(res.token);
      setUser(res.user);
      setContextToken(res.token);
      setContextUser(res.user);

      navigate('/splash');
      return { success: true };
    } catch (err) {
      const errorMessage = formatApiError(err);
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const register = async (payload) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest('/auth/register', 'POST', payload);

      if (res.token) {
        setToken(res.token);
        setContextToken(res.token);
      }
      if (res.user) {
        setUser(res.user);
        setContextUser(res.user);
      }

      navigate('/splash');
      return { success: true };
    } catch (err) {
      const errorMessage = formatApiError(err);
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const getProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest('/auth/profile', 'GET', null, true);
      setUser(res.user);
      setContextUser(res.user);
      return { success: true, user: res.user };
    } catch (err) {
      const errorMessage = formatApiError(err);
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (payload) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest('/auth/profile', 'PUT', payload, true);
      if (res.user) {
        setUser(res.user);
        setContextUser(res.user);
      }
      return { success: true, user: res.user, message: res.message };
    } catch (err) {
      const errorMessage = formatApiError(err);
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const googleLogin = async (credential) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest('/auth/google-login', 'POST', { credential });

      setToken(res.token);
      setUser(res.user);
      setContextToken(res.token);
      setContextUser(res.user);

      navigate('/splash');
      return { success: true };
    } catch (err) {
      const errorMessage = formatApiError(err);
      setError(errorMessage);
      return { 
        success: false, 
        error: errorMessage,
        notRegistered: err?.response?.data?.notRegistered || err?.notRegistered || false,
        prefillData: err?.response?.data || err || null
      };
    } finally {
      setLoading(false);
    }
  };

  const sendVerificationCode = async (email) => {
    try {
      const res = await apiRequest('/auth/send-verification-code', 'POST', { email });
      return { success: true, message: res.message, college: res.college };
    } catch (err) {
      const errorMessage = formatApiError(err);
      return { success: false, error: errorMessage };
    }
  };

  const verifyCode = async (email, code) => {
    try {
      const res = await apiRequest('/auth/verify-code', 'POST', { email, code });
      return { success: true, message: res.message };
    } catch (err) {
      const errorMessage = formatApiError(err);
      return { success: false, error: errorMessage };
    }
  };

  return {
    login,
    register,
    googleLogin,
    sendVerificationCode,
    verifyCode,
    getProfile,
    updateProfile,
    loading,
    error,
    setError,
  };
}


