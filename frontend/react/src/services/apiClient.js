// API request client
// Replaces: apiRequest() function from api.js

import { API_BASE_URL } from '../config/api.js';
import { getToken, clearAuth } from './authStorage.js';
import { retry } from '../utils/retry.js';

/**
 * Makes an API request with automatic token handling and retry logic
 * @param {string} endpoint - API endpoint (e.g., '/auth/login')
 * @param {string} method - HTTP method (GET, POST, PUT, DELETE)
 * @param {object|null} body - Request body (will be JSON stringified)
 * @param {boolean|string|null} token - true = use stored token, string = use provided token, null = no auth
 * @param {object} options - Additional options (retry, retryCount, etc.)
 * @returns {Promise<object>} Response data
 */
export async function apiRequest(endpoint, method = 'GET', body = null, token = null, options = {}) {
  const { retryOnFailure = true, maxRetries = 3 } = options;

  const makeRequest = async () => {
    const headers = {
      'Content-Type': 'application/json',
    };

    // Resolve token
    let resolvedToken = null;
    if (token === true) {
      resolvedToken = getToken();
    } else if (typeof token === 'string') {
      resolvedToken = token;
    }

    let cleanEndpoint = endpoint;
    if (cleanEndpoint.startsWith('/api/') && API_BASE_URL.endsWith('/api')) {
      cleanEndpoint = cleanEndpoint.substring(4);
    }

    if (resolvedToken) {
      headers['Authorization'] = `Bearer ${resolvedToken}`;
    }

    const response = await fetch(`${API_BASE_URL}${cleanEndpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null,
      credentials: 'include',
    });

    let data;
    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (!response.ok) {
      // Handle 401 unauthorized - clear auth and redirect
      if (response.status === 401) {
        clearAuth();
        throw new Error('Unauthorized: Invalid credentials or token.');
      }

      const error = new Error(data.message || 'Something went wrong');
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  };

  // Use retry logic for GET requests and 5xx errors
  if (retryOnFailure && (method === 'GET' || method === 'HEAD')) {
    try {
      return await retry(makeRequest, maxRetries);
    } catch (error) {
      throw error;
    }
  }

  return makeRequest();
}

/**
 * Format API error messages for display
 * Replaces: formatApiError() from auth.js
 */
export function formatApiError(err) {
  const status = err?.status;
  const data = err?.data;

  if (status === 400 && data?.errors?.length) {
    const details = data.errors
      .map((e) => `- ${e.field}: ${e.message}`)
      .join('\n');
    return `${data.message || 'Validation failed'}\n\n${details}`;
  }

  if (status === 401) return 'Unauthorized: Invalid credentials or token.';
  if (status === 403) return err.message || 'Forbidden: Access denied.';
  if (status === 409) return err.message || 'Conflict: This record already exists.';
  if (status >= 500) return err.message || 'Server error. Please try again later.';

  return err?.message || 'Something went wrong.';
}
