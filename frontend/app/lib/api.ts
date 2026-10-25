/**
 * API client utility
 * All requests go through /api/* which Next.js proxies to the FastAPI backend.
 * The token is read from localStorage and attached to every protected request.
 */

const API_BASE = '/api';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('bookleaf_token');
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      message = data.detail || data.message || message;
    } catch {
      // ignore parse errors
    }
    if (res.status === 401 || (res.status === 403 && (message === 'Not authenticated' || message.includes('token')))) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('bookleaf_token');
        localStorage.removeItem('bookleaf_user');
        if (!window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
      }
    }
    throw new ApiError(message, res.status);
  }

  // Handle 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json();
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export const auth = {
  login: (email: string, password: string) =>
    request<{ access_token: string; role: string; user_id: string; name: string }>('/auth/login', {
      method: 'POST',
      body: { email, password },
    }),
  me: () => request('/auth/me'),
};

// ── Books ─────────────────────────────────────────────────────────────────────

export const books = {
  getMyBooks: () => request<Book[]>('/books'),
  getBook: (id: string) => request<Book>(`/books/${id}`),
};

// ── Tickets ───────────────────────────────────────────────────────────────────

export const tickets = {
  create: (data: { book_id?: string | null; subject: string; description: string }) =>
    request<Ticket>('/tickets', { method: 'POST', body: data }),
  getMyTickets: () => request<TicketListItem[]>('/tickets'),
  getTicket: (id: string) => request<Ticket>(`/tickets/${id}`),
  poll: (id: string) => request<Ticket>(`/tickets/${id}/poll`),
};

// ── Admin ─────────────────────────────────────────────────────────────────────

export const admin = {
  getTickets: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<PaginatedTickets>(`/admin/tickets${qs}`);
  },
  getTicket: (id: string) => request<Ticket>(`/admin/tickets/${id}`),
  updateStatus: (id: string, status: string) =>
    request<Ticket>(`/admin/tickets/${id}/status`, { method: 'PATCH', body: { status } }),
  updateCategory: (id: string, category: string) =>
    request<Ticket>(`/admin/tickets/${id}/category`, { method: 'PATCH', body: { category } }),
  updatePriority: (id: string, priority: string) =>
    request<Ticket>(`/admin/tickets/${id}/priority`, { method: 'PATCH', body: { priority } }),
  assignToMe: (id: string) =>
    request<Ticket>(`/admin/tickets/${id}/assign`, { method: 'PATCH' }),
  unassign: (id: string) =>
    request<Ticket>(`/admin/tickets/${id}/unassign`, { method: 'PATCH' }),
  reply: (id: string, content: string, isAiDraft = false) =>
    request<Ticket>(`/admin/tickets/${id}/reply`, {
      method: 'POST',
      body: { content, is_ai_draft: isAiDraft },
    }),
  addNote: (id: string, content: string) =>
    request<Ticket>(`/admin/tickets/${id}/notes`, { method: 'POST', body: { content } }),
  getStats: () => request<AdminStats>('/admin/stats'),
  getAuthors: () => request<User[]>('/admin/authors'),
  getAuthorBooks: (authorId: string) => request<Book[]>(`/admin/authors/${authorId}/books`),
};

// ── AI ────────────────────────────────────────────────────────────────────────

export const ai = {
  classify: (ticketId: string) =>
    request<AIClassification>(`/ai/classify/${ticketId}`, { method: 'POST' }),
  getDraft: (ticketId: string) =>
    request<AIDraft>(`/ai/draft/${ticketId}`),
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'author' | 'admin';
  phone?: string;
  city?: string;
  joined_date?: string;
}

export interface Book {
  id: string;
  author_id: string;
  title: string;
  isbn?: string;
  genre?: string;
  publication_date?: string;
  status: string;
  mrp?: number;
  author_royalty_per_copy?: number;
  total_copies_sold: number;
  total_royalty_earned: number;
  royalty_paid: number;
  royalty_pending: number;
  last_royalty_payout_date?: string;
  print_partner?: string;
  available_on: string[];
}

export interface TicketMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender_role: 'author' | 'admin';
  sender_name?: string;
  content: string;
  is_ai_draft: boolean;
  created_at: string;
}

export interface InternalNote {
  id: string;
  ticket_id: string;
  author_id: string;
  author_name?: string;
  content: string;
  created_at: string;
}

export interface Ticket {
  id: string;
  author_id: string;
  author_name?: string;
  author_email?: string;
  book_id?: string;
  book_title?: string;
  subject: string;
  description: string;
  status: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
  category?: string;
  priority?: string;
  ai_category?: string;
  ai_priority?: string;
  ai_classification_done: boolean;
  assigned_to?: string;
  assigned_admin_name?: string;
  created_at: string;
  updated_at?: string;
  resolved_at?: string;
  messages: TicketMessage[];
  notes: InternalNote[];
}

export interface TicketListItem {
  id: string;
  author_id: string;
  author_name?: string;
  author_email?: string;
  book_id?: string;
  book_title?: string;
  subject: string;
  status: string;
  category?: string;
  priority?: string;
  ai_classification_done: boolean;
  assigned_to?: string;
  assigned_admin_name?: string;
  created_at: string;
  updated_at?: string;
  message_count: number;
}

export interface PaginatedTickets {
  items: TicketListItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface AdminStats {
  total_tickets: number;
  open_tickets: number;
  in_progress: number;
  resolved: number;
  critical_tickets: number;
  unassigned: number;
  total_authors: number;
  total_books: number;
}

export interface AIClassification {
  category: string;
  priority: string;
  reasoning: string;
}

export interface AIDraft {
  draft: string;
  model_used: string;
  tokens_used?: number;
  fallback: boolean;
}
