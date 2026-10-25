'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Sidebar from '../../../components/Sidebar';
import FormattedText from '../../../components/FormattedText';
import { tickets, type Ticket } from '../../../lib/api';
import {
  getStatusBadgeClass, getPriorityBadgeClass, getPriorityEmoji,
  formatDateTime, timeAgo, getUser
} from '../../../lib/utils';

export default function AuthorTicketDetail() {
  const params = useParams();
  const router = useRouter();
  const ticketId = params.id as string;
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const fetchTicket = async () => {
    try {
      const t = await tickets.poll(ticketId);
      setTicket(t);
    } catch (e) {
      setError('Could not load ticket');
    }
  };

  useEffect(() => {
    const currentUser = getUser();
    if (!currentUser || currentUser.role === 'admin') {
      router.replace(currentUser?.role === 'admin' ? '/admin' : '/login');
      return;
    }
    fetchTicket().finally(() => setLoading(false));

    // Poll every 8 seconds for near-real-time updates
    pollRef.current = setInterval(fetchTicket, 8000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [ticketId]);

  if (loading) {
    return (
      <div className="layout">
        <Sidebar role="author" />
        <main className="main-content">
          <div className="page-loader"><div className="spinner" /><span>Loading ticket...</span></div>
        </main>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="layout">
        <Sidebar role="author" />
        <main className="main-content">
          <div className="alert alert-error">{error || 'Ticket not found'}</div>
          <a href="/author/tickets" className="btn btn-secondary">← Back to Tickets</a>
        </main>
      </div>
    );
  }

  const adminMessages = ticket.messages.filter((m) => m.sender_role === 'admin');

  return (
    <div className="layout">
      <Sidebar role="author" />
      <main className="main-content">
        {/* Back */}
        <a href="/author/tickets" className="btn btn-secondary btn-sm" style={{ marginBottom: 20 }}>
          ← Back to Tickets
        </a>

        <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>
          {/* Main Column */}
          <div>
            {/* Header */}
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span className={getStatusBadgeClass(ticket.status)}>{ticket.status}</span>
                  {ticket.priority && (
                    <span className={getPriorityBadgeClass(ticket.priority)}>
                      {getPriorityEmoji(ticket.priority)} {ticket.priority}
                    </span>
                  )}
                  {ticket.category && (
                    <span className="badge" style={{ background: 'var(--bg-surface-2)', color: 'var(--text-secondary)', border: '1px solid var(--border-color-strong)' }}>
                      {ticket.category}
                    </span>
                  )}
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>#{ticket.id.slice(0, 8)}</span>
              </div>
              <h2 style={{ fontSize: '1.2rem', marginBottom: 8 }}>{ticket.subject}</h2>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                {ticket.book_title ? `📚 ${ticket.book_title}` : '📋 General / Account Level'}
                {' · '}Submitted {timeAgo(ticket.created_at)}
              </div>
            </div>

            {/* Original Description */}
            <div className="card" style={{ marginBottom: 20 }}>
              <h4 style={{ marginBottom: 12, color: 'var(--text-secondary)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Your Original Query
              </h4>
              <div style={{
                background: 'var(--bg-surface-2)',
                borderRadius: 'var(--radius-md)',
                padding: '16px 20px',
                fontSize: 14,
                lineHeight: 1.7,
                color: 'var(--text-primary)',
                wordBreak: 'break-word',
              }}>
                <FormattedText text={ticket.description} />
              </div>
            </div>

            {/* Conversation Thread */}
            {ticket.messages.length > 0 && (
              <div className="card">
                <h4 style={{ marginBottom: 16, color: 'var(--text-secondary)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Conversation Thread ({ticket.messages.length})
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {ticket.messages.map((msg) => (
                    <div key={msg.id} style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: msg.sender_role === 'admin' ? 'flex-end' : 'flex-start',
                    }}>
                      <div style={{
                        fontSize: 11,
                        color: 'var(--text-tertiary)',
                        marginBottom: 4,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}>
                        {msg.sender_role === 'admin' ? (
                          <>
                            {msg.is_ai_draft && <span style={{ color: 'var(--brand-primary-light)' }}>🤖 AI-assisted · </span>}
                            <strong style={{ color: 'var(--text-secondary)' }}>BookLeaf Support</strong>
                            {' · '}{formatDateTime(msg.created_at)}
                          </>
                        ) : (
                          <>
                            <strong style={{ color: 'var(--text-secondary)' }}>You</strong>
                            {' · '}{formatDateTime(msg.created_at)}
                          </>
                        )}
                      </div>
                      <div
                        className={`message-bubble ${msg.sender_role === 'admin' ? 'message-admin' : 'message-author'}`}
                        style={{ maxWidth: '80%' }}
                      >
                        <FormattedText text={msg.content} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* No replies yet */}
            {ticket.messages.length === 0 && (
              <div className="card" style={{ textAlign: 'center', padding: 40 }}>
                <div style={{ fontSize: '2rem', marginBottom: 12 }}>⏳</div>
                <h3 style={{ color: 'var(--text-secondary)' }}>Awaiting Response</h3>
                <p style={{ fontSize: 13 }}>
                  Our support team typically responds within 24–48 hours.
                  This page auto-updates when a response arrives.
                </p>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Ticket Info */}
            <div className="card">
              <h4 style={{ marginBottom: 14 }}>Ticket Details</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-tertiary)' }}>Status</span>
                  <span className={getStatusBadgeClass(ticket.status)}>{ticket.status}</span>
                </div>
                {ticket.priority && (
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-tertiary)' }}>Priority</span>
                    <span className={getPriorityBadgeClass(ticket.priority)}>
                      {getPriorityEmoji(ticket.priority)} {ticket.priority}
                    </span>
                  </div>
                )}
                {ticket.category && (
                  <div className="flex justify-between items-center" style={{ gap: 8 }}>
                    <span style={{ color: 'var(--text-tertiary)' }}>Category</span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'right' }}>{ticket.category}</span>
                  </div>
                )}
                {ticket.assigned_admin_name && (
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-tertiary)' }}>Assigned to</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{ticket.assigned_admin_name}</span>
                  </div>
                )}
                <div className="divider" style={{ margin: '4px 0' }} />
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-tertiary)' }}>Created</span>
                  <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{formatDateTime(ticket.created_at)}</span>
                </div>
                {ticket.resolved_at && (
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-tertiary)' }}>Resolved</span>
                    <span style={{ color: 'var(--brand-success)', fontSize: 12 }}>{formatDateTime(ticket.resolved_at)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Auto-refresh notice */}
            <div className="alert alert-info" style={{ fontSize: 12 }}>
              <span>🔄</span>
              <div>
                <strong>Auto-updating</strong>
                <p style={{ color: 'inherit', marginTop: 2 }}>This page refreshes every 8 seconds to show new responses.</p>
              </div>
            </div>

            {/* Escalation */}
            {ticket.status === 'Open' && (
              <div className="card" style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 13, marginBottom: 12 }}>
                  Need to follow up? You can submit a new query referencing this ticket ID:
                </p>
                <code style={{
                  background: 'var(--bg-surface-2)',
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 12,
                  display: 'block',
                  marginBottom: 12,
                  wordBreak: 'break-all',
                }}>
                  {ticket.id}
                </code>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
