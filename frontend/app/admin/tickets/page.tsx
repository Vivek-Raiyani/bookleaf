'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Sidebar from '../../components/Sidebar';
import TicketCard from '../../components/TicketCard';
import { admin, type PaginatedTickets } from '../../lib/api';
import { getUser } from '../../lib/utils';

const STATUSES = ['', 'Open', 'In Progress', 'Resolved', 'Closed'];
const CATEGORIES = ['', 'Royalty & Payments', 'ISBN & Metadata Issues', 'Printing & Quality', 'Distribution & Availability', 'Book Status & Production Updates', 'General Inquiry'];
const PRIORITIES = ['', 'Critical', 'High', 'Medium', 'Low'];

function TicketQueueContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<PaginatedTickets | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [category, setCategory] = useState(searchParams.get('category') || '');
  const [priority, setPriority] = useState(searchParams.get('priority') || '');
  const [page, setPage] = useState(1);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    const params: Record<string, string> = { page: String(page), page_size: '20' };
    if (status) params.status = status;
    if (category) params.category = category;
    if (priority) params.priority = priority;
    if (search) params.search = search;
    try {
      const result = await admin.getTickets(params);
      setData(result);
    } catch (e) {
      console.error('Failed to fetch tickets', e);
    } finally {
      setLoading(false);
    }
  }, [status, category, priority, search, page]);

  useEffect(() => {
    const currentUser = getUser();
    if (!currentUser || currentUser.role !== 'admin') {
      router.replace('/login');
      return;
    }
    fetchTickets();
  }, [fetchTickets, router]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchTickets();
  };

  return (
    <>
      {/* Filter Bar */}
      <div className="filter-bar fade-in">
        <form onSubmit={handleSearch} style={{ flex: 1, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            id="search-input"
            className="form-input"
            style={{ flex: 1, minWidth: 200 }}
            placeholder="🔍 Search tickets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            id="filter-status"
            className="form-select"
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            style={{ width: 140 }}
          >
            <option value="">All Statuses</option>
            {STATUSES.filter(Boolean).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            id="filter-priority"
            className="form-select"
            value={priority}
            onChange={(e) => { setPriority(e.target.value); setPage(1); }}
            style={{ width: 130 }}
          >
            <option value="">All Priorities</option>
            {PRIORITIES.filter(Boolean).map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select
            id="filter-category"
            className="form-select"
            value={category}
            onChange={(e) => { setCategory(e.target.value); setPage(1); }}
            style={{ width: 200 }}
          >
            <option value="">All Categories</option>
            {CATEGORIES.filter(Boolean).map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <button type="submit" className="btn btn-primary btn-sm">Search</button>
          {(status || category || priority || search) && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => { setStatus(''); setCategory(''); setPriority(''); setSearch(''); setPage(1); }}
            >
              Clear
            </button>
          )}
        </form>
      </div>

      {/* Results */}
      {loading ? (
        <div className="page-loader"><div className="spinner" /><span>Loading tickets...</span></div>
      ) : !data || data.items.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🎉</div>
          <h3>No tickets match your filters</h3>
          <p>Try adjusting the filters or clear them to see all tickets.</p>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 12 }}>
            Showing {data.items.length} of {data.total} tickets
          </div>
          <div className="card fade-in" style={{ padding: 0 }}>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Subject / Author</th>
                    <th>Status</th>
                    <th>Priority</th>
                    <th>Category</th>
                    <th>Age</th>
                    <th>Msgs</th>
                    <th>Assigned To</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((ticket) => (
                    <TicketCard
                      key={ticket.id}
                      ticket={ticket}
                      onClick={() => router.push(`/admin/tickets/${ticket.id}`)}
                      showAuthor={true}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {data.total_pages > 1 && (
            <div className="flex items-center justify-center gap-2" style={{ marginTop: 20 }}>
              <button
                className="btn btn-secondary btn-sm"
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
              >
                ← Prev
              </button>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Page {page} of {data.total_pages}
              </span>
              <button
                className="btn btn-secondary btn-sm"
                disabled={page >= data.total_pages}
                onClick={() => setPage(p => p + 1)}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}

export default function AdminTicketsPage() {
  return (
    <div className="layout">
      <Sidebar role="admin" />
      <main className="main-content">
        <div className="page-header fade-in">
          <h1>Ticket Queue</h1>
          <p>All incoming support queries, sorted by priority and age.</p>
        </div>
        <Suspense fallback={<div className="page-loader"><div className="spinner" /></div>}>
          <TicketQueueContent />
        </Suspense>
      </main>
    </div>
  );
}
