import { isHeadlessAutomation } from './test-mode';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

export function setToken(token: string) {
  localStorage.setItem('token', token);
}

export function clearToken() {
  localStorage.removeItem('token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_URL}/api${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });
  if (res.status === 401) {
    clearToken();
    if (typeof window !== 'undefined') window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? res.statusText);
  }
  return res.json();
}

export const api = {
  login: (email: string, password: string) =>
    request<{ accessToken: string; user: { id: string; email: string; name: string } }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) },
    ),

  me: () => request<{ id: string; email: string; name: string }>('/auth/me'),

  listApplications: (params?: {
    status?: string;
    search?: string;
    sort?: string;
    order?: string;
    page?: number;
    pageSize?: number;
    attention?: boolean;
  }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.search) qs.set('search', params.search);
    if (params?.sort) qs.set('sort', params.sort);
    if (params?.order) qs.set('order', params.order);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
    if (params?.attention) qs.set('attention', 'true');
    const query = qs.toString();
    return request<ApplicationListResponse>(
      `/applications${query ? `?${query}` : ''}`,
    );
  },

  getApplication: (id: string) => request<ApplicationDetail>(`/applications/${id}`),

  createApplication: (data: { clientRef: string; constitution: string; formData?: object }) =>
    request<ApplicationDetail>('/applications', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateForm: (id: string, formData: object) =>
    request<ApplicationDetail>(`/applications/${id}/form`, {
      method: 'PATCH',
      body: JSON.stringify({ formData }),
    }),

  updateStep: (id: string, step: string) =>
    request<ApplicationDetail>(`/applications/${id}/step`, {
      method: 'PATCH',
      body: JSON.stringify({ step }),
    }),

  startAutomation: (id: string, fromStep?: string) =>
    request<{ applicationId: string; jobId: string }>(`/applications/${id}/start`, {
      method: 'POST',
      body: JSON.stringify({ fromStep, headless: isHeadlessAutomation() }),
    }),

  resumeAutomation: (id: string) =>
    request<{ applicationId: string; jobId: string }>(`/applications/${id}/resume`, {
      method: 'POST',
      body: JSON.stringify({ headless: isHeadlessAutomation() }),
    }),

  submitInput: (id: string, input: Record<string, string | undefined>) =>
    request<{ success: boolean }>(`/applications/${id}/input`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  cancelAutomation: (id: string) =>
    request<ApplicationDetail>(`/applications/${id}/cancel`, { method: 'POST' }),

  deleteApplication: (id: string) =>
    request<{ success: boolean; id: string }>(`/applications/${id}`, { method: 'DELETE' }),

  uploadDocument: (applicationId: string, type: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<{ id: string; type: string; fileName: string }>(
      `/applications/${applicationId}/documents/${type}`,
      { method: 'POST', body: form },
    );
  },

  getDocumentDownloadUrl: (applicationId: string, documentId: string) =>
    request<{ url: string; fileName: string }>(
      `/applications/${applicationId}/documents/${documentId}/download`,
    ),

  getFailureScreenshotUrl: (id: string) =>
    request<{ url: string }>(`/applications/${id}/failure-screenshot`),

  listTemplates: () =>
    request<Array<{ id: string; name: string; constitution: string }>>('/templates'),

  getTemplate: (id: string) =>
    request<{ id: string; name: string; constitution: string; formData: Record<string, unknown> }>(
      `/templates/${id}`,
    ),

  createTemplate: (data: {
    name: string;
    constitution: string;
    formData: Record<string, unknown>;
  }) =>
    request('/templates', { method: 'POST', body: JSON.stringify(data) }),

  listUsers: () =>
    request<Array<{ id: string; email: string; name: string; role: string }>>('/users'),

  createUser: (data: { email: string; name: string; password: string; role?: string }) =>
    request('/users', { method: 'POST', body: JSON.stringify(data) }),

  assignOperator: (applicationId: string, operatorId: string | null) =>
    request(`/applications/${applicationId}/assign`, {
      method: 'PATCH',
      body: JSON.stringify({ operatorId }),
    }),

  logout: () => request('/auth/logout', { method: 'POST' }),
};

export interface AutomationProgress {
  percent: number;
  phase: string;
  label: string;
  updatedAt: string;
}

export interface ApplicationListResponse {
  items: ApplicationSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApplicationSummary {
  id: string;
  clientRef: string;
  status: string;
  currentStep: string;
  constitution: string;
  trn?: string;
  trnExpiresAt?: string;
  arn?: string;
  createdAt: string;
  updatedAt: string;
  actionRequired: boolean;
  pendingInput?: string;
  daysUntilTrnExpiry?: number;
  trnExpiringSoon?: boolean;
  needsAttention?: boolean;
  automationProgress?: AutomationProgress;
}

export interface ApplicationDetail extends ApplicationSummary {
  formData: Record<string, unknown>;
  documents: Array<{ id: string; type: string; fileName: string }>;
  auditEvents: Array<{ id: string; eventType: string; message: string; createdAt: string }>;
  errorLog?: string;
  failureScreenshotKey?: string;
  pendingInputData?: Record<string, unknown>;
}

export { API_URL };
