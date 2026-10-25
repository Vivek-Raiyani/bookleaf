'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '../components/Sidebar';
import { books, tickets, type Book, type TicketListItem } from '../lib/api';
import { formatCurrency, formatDate, getStatusBadgeClass, getPriorityBadgeClass, getBookStatusColor, getProductionStagePercent, getUser, timeAgo } from '../lib/utils';

export default function AuthorDashboard() {
  const router = useRouter();
  const [myBooks, setMyBooks] = useState<Book[]>([]);
  const [myTickets, setMyTickets] = useState<TicketListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ id: string; name: string; email?: string; role: string } | null>(null);

  useEffect(() => {
    const currentUser = getUser();
    if (!currentUser || currentUser.role === 'admin') {
      router.replace(currentUser?.role === 'admin' ? '/admin' : '/login');
      return;
    }
    setUser(currentUser);
    Promise.all([books.getMyBooks(), tickets.getMyTickets()])
      .then(([b, t]) => { setMyBooks(b); setMyTickets(t); })
      .catch((err) => {
        console.warn('Dashboard fetch error:', err?.message || err);
      })
      .finally(() => setLoading(false));
  }, [router]);

  const totalRoyaltyEarned = myBooks.reduce((s, b) => s + b.total_royalty_earned, 0);
  const totalRoyaltyPending = myBooks.reduce((s, b) => s + b.royalty_pending, 0);
  const totalCopiesSold = myBooks.reduce((s, b) => s + b.total_copies_sold, 0);
  const openTickets = myTickets.filter((t) => t.status === 'Open' || t.status === 'In Progress').length;
  const liveBooks = myBooks.filter((b) => b.status === 'Published & Live').length;

  if (loading) {
    return (
      <div className="layout">
        <Sidebar role="author" />
        <main className="main-content">
          <div className="page-loader"><div className="spinner" /><span>Loading your dashboard...</span></div>
        </main>
      </div>
    );
  }

  return (
    <div className="layout">
      <Sidebar role="author" />
      <main className="main-content">
        {/* Header */}
        <div className="page-header fade-in">
          <h1>Welcome back, <span className="gradient-text" suppressHydrationWarning>{user?.name?.split(' ')[0] || 'Author'}</span> 👋</h1>
          <p>Here's an overview of your publishing journey with BookLeaf.</p>
        </div>

        {/* Stats Row */}
        <div className="grid-4 fade-in" style={{ marginBottom: 28 }}>
          <div className="stat-card">
            <span className="stat-icon">📚</span>
            <span className="stat-value gradient-text">{myBooks.length}</span>
            <span className="stat-label">Total Books</span>
            <span style={{ fontSize: 12, color: 'var(--brand-success)' }}>{liveBooks} live</span>
          </div>
          <div className="stat-card">
            <span className="stat-icon">📦</span>
            <span className="stat-value" style={{ color: 'var(--brand-primary-light)' }}>{totalCopiesSold.toLocaleString()}</span>
            <span className="stat-label">Copies Sold</span>
          </div>
          <div className="stat-card">
            <span className="stat-icon">💰</span>
            <span className="stat-value" style={{ color: 'var(--brand-success)' }}>{formatCurrency(totalRoyaltyEarned)}</span>
            <span className="stat-label">Total Earned</span>
            <span style={{ fontSize: 12, color: 'var(--priority-medium)' }}>{formatCurrency(totalRoyaltyPending)} pending</span>
          </div>
          <div className="stat-card">
            <span className="stat-icon">🎫</span>
            <span className="stat-value" style={{ color: openTickets > 0 ? 'var(--status-open)' : 'var(--brand-success)' }}>{openTickets}</span>
            <span className="stat-label">Open Tickets</span>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{myTickets.length} total</span>
          </div>
        </div>

        <div className="grid-2" style={{ gap: 24 }}>
          {/* My Books */}
          <div className="card fade-in">
            <div className="flex items-center justify-between mb-4">
              <h3>📚 My Books</h3>
              <a href="/author/books" className="btn btn-secondary btn-sm">View All</a>
            </div>
            {myBooks.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📖</div>
                <h3>No books yet</h3>
                <p>Your published books will appear here</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {myBooks.slice(0, 4).map((book) => (
                  <div
                    key={book.id}
                    onClick={() => router.push('/author/books')}
                    style={{
                      background: 'var(--bg-surface-2)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      padding: '12px 16px',
                      cursor: 'pointer',
                      transition: 'all var(--transition)',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--brand-primary)')}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-color)')}
                  >
                    <div className="flex items-center justify-between">
                      <strong style={{ fontSize: 13, maxWidth: '60%' }} className="truncate">{book.title}</strong>
                      <span style={{ fontSize: 11, color: getBookStatusColor(book.status) }}>{book.status}</span>
                    </div>
                    {book.status === 'Published & Live' && (
                      <div style={{ marginTop: 8, display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-tertiary)' }}>
                        <span>📦 {book.total_copies_sold} sold</span>
                        <span>💰 {formatCurrency(book.royalty_pending)} pending</span>
                      </div>
                    )}
                    {book.status !== 'Published & Live' && (
                      <div style={{ marginTop: 8 }}>
                        <div className="progress-bar">
                          <div className="progress-fill" style={{ width: `${getProductionStagePercent(book.status)}%` }} />
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3, display: 'block' }}>
                          In production
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Tickets */}
          <div className="card fade-in">
            <div className="flex items-center justify-between mb-4">
              <h3>🎫 Recent Tickets</h3>
              <div className="flex gap-2">
                <a href="/author/tickets/new" className="btn btn-primary btn-sm">+ New</a>
                <a href="/author/tickets" className="btn btn-secondary btn-sm">View All</a>
              </div>
            </div>
            {myTickets.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📬</div>
                <h3>No tickets yet</h3>
                <p>Submit a support query and we'll get back to you</p>
                <a href="/author/tickets/new" className="btn btn-primary mt-3">Submit Query</a>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {myTickets.slice(0, 5).map((ticket) => (
                  <div
                    key={ticket.id}
                    onClick={() => router.push(`/author/tickets/${ticket.id}`)}
                    style={{
                      background: 'var(--bg-surface-2)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      padding: '10px 14px',
                      cursor: 'pointer',
                      transition: 'all var(--transition)',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--brand-primary)')}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-color)')}
                  >
                    <div className="flex items-center justify-between">
                      <strong style={{ fontSize: 13, maxWidth: '65%' }} className="truncate">{ticket.subject}</strong>
                      <span className={getStatusBadgeClass(ticket.status)}>{ticket.status}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                      {timeAgo(ticket.created_at)} · {ticket.message_count > 0 ? `${ticket.message_count} reply(ies)` : 'No replies yet'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
