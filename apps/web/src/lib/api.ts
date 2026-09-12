import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('saahvik_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('saahvik_token');
      localStorage.removeItem('saahvik_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export default api;

// Helper to unwrap the { success, data } envelope
export function unwrap<T>(response: { data: { success: boolean; data: T } }): T {
  return response.data.data;
}
