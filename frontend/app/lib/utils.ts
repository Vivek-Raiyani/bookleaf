/**
 * Utility helpers
 */

export function formatCurrency(amount: number | null | undefined, currency = '₹'): string {
  if (amount == null) return '—';
  return `${currency}${amount.toLocaleString('en-IN')}`;
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

export function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return formatDate(dateStr);
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function getStatusBadgeClass(status: string): string {
  const map: Record<string, string> = {
    'Open': 'badge-open',
    'In Progress': 'badge-in_progress',
    'Resolved': 'badge-resolved',
    'Closed': 'badge-closed',
  };
  return `badge ${map[status] || 'badge-open'}`;
}

export function getPriorityBadgeClass(priority: string): string {
  const map: Record<string, string> = {
    'Critical': 'badge-critical',
    'High': 'badge-high',
    'Medium': 'badge-medium',
    'Low': 'badge-low',
  };
  return `badge ${map[priority] || 'badge-medium'}`;
}

export function getPriorityEmoji(priority: string): string {
  const map: Record<string, string> = {
    'Critical': '🔴',
    'High': '🟠',
    'Medium': '🟡',
    'Low': '🟢',
  };
  return map[priority] || '⚪';
}

export function getStatusIcon(status: string): string {
  const map: Record<string, string> = {
    'Open': '📬',
    'In Progress': '⚙️',
    'Resolved': '✅',
    'Closed': '🔒',
  };
  return map[status] || '📋';
}

export function getBookStatusColor(status: string): string {
  if (status === 'Published & Live') return 'var(--brand-success)';
  if (status.includes('Production')) return 'var(--priority-medium)';
  return 'var(--text-secondary)';
}

export function getProductionStagePercent(status: string): number {
  const stages: Record<string, number> = {
    'Manuscript Received': 10,
    'Editing': 20,
    'In Production - Cover Design': 35,
    'In Production - Typesetting': 50,
    'Proofreading': 65,
    'ISBN Assignment': 75,
    'Printing': 85,
    'Distribution Setup': 95,
    'Published & Live': 100,
  };
  return stages[status] ?? 50;
}

export function saveUser(user: { id: string; name: string; email?: string; role: string }) {
  localStorage.setItem('bookleaf_user', JSON.stringify(user));
}

export function getUser(): { id: string; name: string; email?: string; role: string } | null {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem('bookleaf_token');
  if (!token) return null;
  const raw = localStorage.getItem('bookleaf_user');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function logout() {
  localStorage.removeItem('bookleaf_token');
  localStorage.removeItem('bookleaf_user');
  window.location.href = '/login';
}
