import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const api = axios.create({
  baseURL: `${API_BASE}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.error || error.message || 'An error occurred';
    console.error('API Error:', message);
    return Promise.reject(error);
  }
);

// API functions
export const productsApi = {
  search: (params?: Record<string, any>) => api.get('/products', { params }),
  getById: (id: string) => api.get(`/products/${id}`),
  discover: (category: string) => api.post('/products/discover', { category }),
  getDashboardStats: () => api.get('/products/dashboard/stats'),
};

export const marginsApi = {
  calculate: (data: any) => api.post('/margins/calculate', data),
  getByProduct: (productId: string) => api.get(`/margins/${productId}`),
  getHighMargin: (limit?: number) => api.get('/margins/high-margin/list', { params: { limit } }),
};

export const opportunitiesApi = {
  getAll: (limit?: number) => api.get('/opportunities', { params: { limit } }),
  analyze: (data: any) => api.post('/opportunities/analyze', data),
  batchAnalyze: (limit?: number) => api.post('/opportunities/batch-analyze', { limit }),
};

export const suppliersApi = {
  search: (data: any) => api.post('/suppliers/search', data),
  getForProduct: (productId: string) => api.get(`/suppliers/product/${productId}`),
  verify: (id: string) => api.post(`/suppliers/${id}/verify`),
  getTop: (limit?: number) => api.get('/suppliers/top', { params: { limit } }),
};

export const recommendationsApi = {
  getByCategory: (category: string) => api.get(`/recommendations/${category}`),
  generate: (category: string) => api.post('/recommendations/generate', { category }),
  generateAll: () => api.post('/recommendations/generate-all'),
};

export const complianceApi = {
  getReport: (period?: string) => api.get('/compliance/report', { params: { period } }),
  getSources: () => api.get('/compliance/sources'),
  getConnectors: () => api.get('/compliance/connectors'),
  enableConnector: (name: string) => api.post(`/compliance/connectors/${name}/enable`),
  disableConnector: (name: string) => api.post(`/compliance/connectors/${name}/disable`),
};
