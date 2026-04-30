import axios from 'axios';

const API_BASE = 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
});

const ACCESS_TOKEN_KEY = 'token';
const REFRESH_TOKEN_KEY = 'refresh_token';

export const tokenStorage = {
  getAccessToken: () => localStorage.getItem(ACCESS_TOKEN_KEY),
  getRefreshToken: () => localStorage.getItem(REFRESH_TOKEN_KEY),
  setTokens: (accessToken, refreshToken) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  },
  clear: () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },
};

let isRefreshing = false;
let refreshPromise = null;

api.interceptors.request.use((config) => {
  const token = tokenStorage.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config || {};
    const isAuthRefreshRequest = originalRequest.url?.includes('/auth/refresh');

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthRefreshRequest) {
      const refreshToken = tokenStorage.getRefreshToken();
      if (!refreshToken) {
        tokenStorage.clear();
        window.location.href = '/login';
        return Promise.reject(error);
      }

      originalRequest._retry = true;
      try {
        if (!isRefreshing) {
          isRefreshing = true;
          refreshPromise = axios.post(`${API_BASE}/auth/refresh`, { refresh_token: refreshToken });
        }
        const refreshResponse = await refreshPromise;
        const { access_token, refresh_token } = refreshResponse.data;
        tokenStorage.setTokens(access_token, refresh_token);
        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return api(originalRequest);
      } catch (refreshError) {
        tokenStorage.clear();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
        refreshPromise = null;
      }
    } else if (error.response?.status === 401 && isAuthRefreshRequest) {
      tokenStorage.clear();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  register: (userData) => api.post('/auth/register', userData),
  login: (username, password) => {
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);
    return api.post('/auth/token', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  },
  logout: (refreshToken) => api.post('/auth/logout', { refresh_token: refreshToken }),
  me: () => api.get('/auth/me'),
};

export const eventsAPI = {
  getEvents: (params = {}) => api.get('/events/', { params }),
  getEvent: (eventId) => api.get(`/events/${eventId}`),
  createEvent: (eventData) => api.post('/events/', eventData),
  updateEvent: (eventId, eventData) => api.put(`/events/${eventId}`, eventData),
  deleteEvent: (eventId) => api.delete(`/events/${eventId}`),
  uploadPoster: (eventId, file) => {
    const form = new FormData();
    form.append('file', file);
    return api.post(`/events/${eventId}/poster`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  deletePoster: (eventId) => api.delete(`/events/${eventId}/poster`),
  getJsonLd: (eventId) => api.get(`/events/${eventId}/json-ld`),
};

export const ticketsAPI = {
  createTicket: (ticketData) => api.post('/tickets', ticketData),
};

export const usersAPI = {
  getMe: () => api.get('/users/me'),
  getMyTickets: () => api.get('/users/me/tickets'),
};

export const aiAPI = {
  parseImage: (imageUrl) => api.post('/ai/parse-image', { image_url: imageUrl }),
};

export const weatherAPI = {
  getWeather: (city) => api.get('/weather', { params: { city } }),
};

export default api;
