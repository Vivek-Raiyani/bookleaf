'use client';

import { getStatusBadgeClass, getPriorityBadgeClass, getPriorityEmoji, timeAgo } from '../lib/utils';
import type { TicketListItem } from '../lib/api';

interface TicketCardProps {
  ticket: TicketListItem;
  onClick: () => void;
  showAuthor?: boolean;
}

export default function TicketCard({ ticket, onClick, showAuthor = false }: TicketCardProps) {
  return (
    <tr
      onClick={onClick}
      style={{ cursor: 'pointer' }}
      id={`ticket-row-${ticket.id}`}
    >
      <td>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <strong style={{ fontSize: 13 }}>{ticket.subject}</strong>
          {showAuthor && ticket.author_name && (
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              {ticket.author_name}
              {ticket.book_title ? ` · ${ticket.book_title}` : ' · General'}
            </span>
          )}
          {!showAuthor && (
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              {ticket.book_title || 'General / Account Level'}
            </span>
          )}
        </div>
      </td>
      <td>
        <span className={getStatusBadgeClass(ticket.status)}>
          {ticket.status}
        </span>
      </td>
      <td>
        {ticket.priority ? (
          <span className={getPriorityBadgeClass(ticket.priority)}>
            {getPriorityEmoji(ticket.priority)} {ticket.priority}
          </span>
        ) : (
          <span className="badge" style={{ background: 'var(--bg-surface-2)', color: 'var(--text-tertiary)' }}>
            Classifying...
          </span>
        )}
      </td>
      <td>
        {ticket.category ? (
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{ticket.category}</span>
        ) : (
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>—</span>
        )}
      </td>
      <td>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
          {timeAgo(ticket.created_at)}
        </span>
      </td>
      <td>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
          {ticket.message_count > 0 ? `${ticket.message_count} msg${ticket.message_count !== 1 ? 's' : ''}` : '—'}
        </span>
      </td>
      {showAuthor && (
        <td>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            {ticket.assigned_admin_name || '—'}
          </span>
        </td>
      )}
    </tr>
  );
}
