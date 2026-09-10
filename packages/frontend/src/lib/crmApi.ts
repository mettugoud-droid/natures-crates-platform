import { api } from './api';

export const crmApi = {
  dashboard: () => api.get('/crm/dashboard'),
  orders: (params?: Record<string, string | number>) => api.get('/crm/orders', { params }),
  logCall: (orderId: string, data: { employeeId: string; assignmentId?: string; callOutcome: string; notes?: string; nextFollowupAt?: string }) => api.post(`/crm/orders/${orderId}/calls`, data),
  settle: (orderId: string, data: { finalStatus: 'DELIVERED' | 'RTO' | 'CANCELLED'; source?: string; notes?: string }) => api.post(`/crm/orders/${orderId}/settlement`, data),
  importOrders: (fileName: string, rows: unknown[]) => api.post('/crm/import/orders', { fileName, rows }),
};
