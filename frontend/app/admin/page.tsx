'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '../components/Sidebar';
import { admin, type AdminStats, type TicketListItem } from '../lib/api';
import { getUser, getPriorityEmoji, getStatusBadgeClass, getPriorityBadgeClass, timeAgo } from '../lib/utils';

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [recentTickets, setRecentTickets] = useState<TicketListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const currentUser = getUser();
    if (!currentUser || currentUser.role !== 'admin') {
      router.replace('/login');
      return;
    }
    Promise.all([
      admin.getStats(),
      admin.getTickets({ page: '1', page_size: '6' }),
    ]).then(([s, t]) => {
      setStats(s);
      setRecentTickets(t.items);
    }).catch((err) => {
      console.warn('Failed to load admin stats:', err?.message || err);
    }).finally(() => setLoading(false));
  }, [router]);

  const statCards = stats ? [
    { icon: '📬', label: 'Open', value: stats.open_tickets, color: 'var(--status-open)' },
    { icon: '⚙️', label: 'In Progress', value: stats.in_progress, color: 'var(--status-in-progress)' },
    { icon: '🔴', label: 'Critical', value: stats.critical_tickets, color: 'var(--priority-critical)' },
    { icon: '❓', label: 'Unassigned', value: stats.unassigned, color: 'var(--priority-high)' },
    { icon: '✅', label: 'Resolved', value: stats.resolved, color: 'var(--brand-success)' },
    { icon: '👥', label: 'Total Authors', value: stats.total_authors, color: 'var(--brand-primary-light)' },
    { icon: '📚', label: 'Total Books', value: stats.total_books, color: 'var(--brand-accent)' },
    { icon: '🎟️', label: 'All Tickets', value: stats.total_tickets, color: 'var(--text-secondary)' },
  ] : [];

  if (loading) {
    return (
      <div className="layout">
        <Sidebar role="admin" />
        <main className="main-content">
          <div className="page-loader"><div className="spinner" /><span>Loading dashboard...</span></div>
        </main>
      </div>
    );
  }

  return (
    <div className="layout">
      <Sidebar role="admin" />
      <main className="main-content">
        <div className="page-header fade-in">
          <h1>Admin Dashboard</h1>
          <p>BookLeaf Author Support Operations — real-time overview.</p>
        </div>

        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }} className="fade-in">
          {statCards.map((s) => (
            <div key={s.label} className="stat-card">
              <span className="stat-icon">{s.icon}</span>
              <span className="stat-value" style={{ color: s.color }}>{s.value}</span>
              <span className="stat-label">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Alerts */}
        {stats && stats.critical_tickets > 0 && (
          <div className="alert alert-error fade-in" style={{ marginBottom: 20 }}>
            <span>🔴</span>
            <div>
              <strong>{stats.critical_tickets} Critical Ticket{stats.critical_tickets !== 1 ? 's' : ''}</strong>
              <p style={{ color: 'inherit', marginTop: 2, fontSize: 13 }}>
                These require immediate attention. <a href="/admin/tickets?priority=Critical" style={{ color: 'inherit', textDecoration: 'underline' }}>View them now →</a>
              </p>
            </div>
          </div>
        )}

        {stats && stats.unassigned > 0 && (
          <div className="alert alert-warning fade-in" style={{ marginBottom: 20 }}>
            <span>⚠️</span>
            <div>
              <strong>{stats.unassigned} Unassigned Ticket{stats.unassigned !== 1 ? 's' : ''}</strong>
              <p style={{ color: 'inherit', marginTop: 2, fontSize: 13 }}>
                Assign these to prevent author queries from going unanswered.
              </p>
            </div>
          </div>
        )}

        {/* Recent Tickets */}
        <div className="card fade-in">
          <div className="flex items-center justify-between mb-4">
            <h3>🕐 Most Urgent Tickets</h3>
            <a href="/admin/tickets" className="btn btn-primary btn-sm">View All Tickets</a>
          </div>

          {recentTickets.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🎉</div>
              <h3>All clear!</h3>
              <p>No open tickets right now. Great job!</p>
            </div>
          ) : (
            <div className="table-container" style={{ border: 'none' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>Author</th>
                    <th>Status</th>
                    <th>Priority</th>
                    <th>Category</th>
                    <th>Age</th>
                    <th>Assigned</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTickets.map((ticket) => (
                    <tr
                      key={ticket.id}
                      onClick={() => router.push(`/admin/tickets/${ticket.id}`)}
                      id={`ticket-${ticket.id}`}
                    >
                      <td>
                        <strong style={{ fontSize: 13 }}>{ticket.subject}</strong>
                        {ticket.book_title && (
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{ticket.book_title}</div>
                        )}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {ticket.author_name}
                      </td>
                      <td>
                        <span className={getStatusBadgeClass(ticket.status)}>{ticket.status}</span>
                      </td>
                      <td>
                        {ticket.priority ? (
                          <span className={getPriorityBadgeClass(ticket.priority)}>
                            {getPriorityEmoji(ticket.priority)} {ticket.priority}
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Classifying...</span>
                        )}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {ticket.category || '—'}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                        {timeAgo(ticket.created_at)}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                        {ticket.assigned_admin_name || <span style={{ color: 'var(--brand-danger)' }}>Unassigned</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
