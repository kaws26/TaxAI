const rawBaseUrl = import.meta.env.VITE_API_URL || 'https://taxai-77xc.onrender.com';

export const API_BASE_URL = rawBaseUrl.replace(/\/+$/, '');
export const API_PREFIX = `${API_BASE_URL}/api`;

const getToken = () => localStorage.getItem('access_token');

const parseJsonSafely = async (response) => {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
};

export const authAPI = {
  async login(identifier, password) {
    const response = await fetch(`${API_PREFIX}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ identifier, password }),
    });

    const data = await parseJsonSafely(response);

    if (!response.ok) {
      throw new Error(data.message || 'Login failed');
    }

    return data;
  },

  async register(userData) {
    const response = await fetch(`${API_PREFIX}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });

    const data = await parseJsonSafely(response);

    if (!response.ok) {
      throw new Error(data.message || 'Registration failed');
    }

    return data;
  },

  async getMe() {
    const token = getToken();

    if (!token) {
      throw new Error('No authentication token found');
    }

    const response = await fetch(`${API_PREFIX}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await parseJsonSafely(response);

    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch user data');
    }

    return data;
  },
};

export const apiCall = async (endpoint, options = {}) => {
  const token = getToken();
  const isFormData = options.body instanceof FormData;

  const defaultHeaders = isFormData
    ? {}
    : {
        'Content-Type': 'application/json',
      };

  if (token) {
    defaultHeaders.Authorization = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const response = await fetch(`${API_PREFIX}${normalizedEndpoint}`, config);
  const data = await parseJsonSafely(response);

  if (!response.ok) {
    throw new Error(data.message || 'API request failed');
  }

  return data;
};
