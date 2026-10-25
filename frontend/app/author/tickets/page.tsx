'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '../../components/Sidebar';
import TicketCard from '../../components/TicketCard';
import { tickets, type TicketListItem } from '../../lib/api';
import { getUser } from '../../lib/utils';

export default function AuthorTicketsPage() {
  const router = useRouter();
  const [myTickets, setMyTickets] = useState<TicketListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    const currentUser = getUser();
    if (!currentUser || currentUser.role === 'admin') {
      router.replace(currentUser?.role === 'admin' ? '/admin' : '/login');
      return;
    }
    tickets.getMyTickets()
      .then(setMyTickets)
      .catch((err: any) => {
        console.warn('Tickets fetch error:', err?.message || err);
      })
      .finally(() => setLoading(false));
  }, [router]);

  const filtered = filter
    ? myTickets.filter((t) => t.status === filter)
    : myTickets;

  const counts = {
    All: myTickets.length,
    Open: myTickets.filter((t) => t.status === 'Open').length,
    'In Progress': myTickets.filter((t) => t.status === 'In Progress').length,
    Resolved: myTickets.filter((t) => t.status === 'Resolved').length,
    Closed: myTickets.filter((t) => t.status === 'Closed').length,
  };

  return (
    <div className="layout">
      <Sidebar role="author" />
      <main className="main-content">
        <div className="page-header fade-in">
          <div className="flex items-center justify-between">
            <div>
              <h1>My Support Tickets</h1>
              <p>Track your queries and view responses from the BookLeaf team.</p>
            </div>
            <a href="/author/tickets/new" className="btn btn-primary" id="new-ticket-btn">
              + Submit Query
            </a>
          </div>
        </div>

        {/* Status Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {Object.entries(counts).map(([status, count]) => (
            <button
              key={status}
              className={`btn ${filter === status || (status === 'All' && !filter) ? 'btn-primary' : 'btn-secondary'} btn-sm`}
              onClick={() => setFilter(status === 'All' ? '' : status)}
              id={`filter-${status.toLowerCase().replace(' ', '-')}`}
            >
              {status} ({count})
            </button>
          ))}
        </div>

        {loading ? (
          <div className="page-loader"><div className="spinner" /><span>Loading tickets...</span></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📬</div>
            <h3>{filter ? `No ${filter} tickets` : 'No tickets yet'}</h3>
            <p>Submit a query and our team will get back to you within 24–48 hours.</p>
            <a href="/author/tickets/new" className="btn btn-primary mt-3">Submit Your First Query</a>
          </div>
        ) : (
          <div className="card fade-in" style={{ padding: 0 }}>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>Status</th>
                    <th>Priority</th>
                    <th>Category</th>
                    <th>Created</th>
                    <th>Replies</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((ticket) => (
                    <TicketCard
                      key={ticket.id}
                      ticket={ticket}
                      onClick={() => router.push(`/author/tickets/${ticket.id}`)}
                      showAuthor={false}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
