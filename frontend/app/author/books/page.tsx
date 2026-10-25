'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '../../components/Sidebar';
import { books, type Book } from '../../lib/api';
import { formatCurrency, formatDate, getBookStatusColor, getProductionStagePercent, getUser } from '../../lib/utils';

export default function AuthorBooksPage() {
  const router = useRouter();
  const [myBooks, setMyBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Book | null>(null);

  useEffect(() => {
    const currentUser = getUser();
    if (!currentUser || currentUser.role === 'admin') {
      router.replace(currentUser?.role === 'admin' ? '/admin' : '/login');
      return;
    }
    books.getMyBooks()
      .then(setMyBooks)
      .catch((err) => {
        console.warn('Books fetch error:', err?.message || err);
      })
      .finally(() => setLoading(false));
  }, [router]);

  const liveBooks = myBooks.filter((b) => b.status === 'Published & Live');
  const inProduction = myBooks.filter((b) => b.status !== 'Published & Live');

  return (
    <div className="layout">
      <Sidebar role="author" />
      <main className="main-content">
        <div className="page-header fade-in">
          <h1>My Books</h1>
          <p>Track royalties, sales, and production status for all your titles.</p>
        </div>

        {loading ? (
          <div className="page-loader"><div className="spinner" /><span>Loading books...</span></div>
        ) : myBooks.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📚</div>
            <h3>No books found</h3>
            <p>Your published books will appear here once available.</p>
          </div>
        ) : (
          <>
            {/* Published Books */}
            {liveBooks.length > 0 && (
              <div className="fade-in" style={{ marginBottom: 32 }}>
                <h3 style={{ marginBottom: 16 }}>📗 Published & Live ({liveBooks.length})</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {liveBooks.map((book) => (
                    <div
                      key={book.id}
                      className="card"
                      id={`book-${book.id}`}
                      style={{
                        cursor: 'pointer',
                        borderColor: selected?.id === book.id ? 'var(--brand-primary)' : undefined,
                        boxShadow: selected?.id === book.id ? 'var(--shadow-glow)' : undefined,
                      }}
                      onClick={() => setSelected(selected?.id === book.id ? null : book)}
                    >
                      <div className="flex items-center justify-between">
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="flex items-center gap-3">
                            <h3 style={{ fontSize: '1rem' }}>{book.title}</h3>
                            <span style={{
                              background: 'rgba(0,184,148,0.15)',
                              color: 'var(--brand-success)',
                              border: '1px solid rgba(0,184,148,0.3)',
                              borderRadius: 20,
                              fontSize: 11,
                              padding: '2px 8px',
                              fontWeight: 700,
                            }}>● Live</span>
                          </div>
                          <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: 12, color: 'var(--text-tertiary)', flexWrap: 'wrap' }}>
                            {book.genre && <span>🏷️ {book.genre}</span>}
                            {book.isbn && <span>📎 ISBN: {book.isbn}</span>}
                            {book.publication_date && <span>📅 {formatDate(book.publication_date)}</span>}
                            {book.print_partner && <span>🖨️ {book.print_partner}</span>}
                          </div>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 16, textAlign: 'right' }}>
                          <div>MRP {formatCurrency(book.mrp)}</div>
                          <div>{book.available_on?.join(', ') || '—'}</div>
                        </div>
                      </div>

                      {/* Royalty Stats */}
                      <div className="grid-4" style={{ marginTop: 16 }}>
                        <div style={{ background: 'var(--bg-surface-2)', borderRadius: 'var(--radius-md)', padding: '12px 16px' }}>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>Copies Sold</div>
                          <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{book.total_copies_sold.toLocaleString()}</div>
                        </div>
                        <div style={{ background: 'var(--bg-surface-2)', borderRadius: 'var(--radius-md)', padding: '12px 16px' }}>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>Total Earned</div>
                          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--brand-success)' }}>{formatCurrency(book.total_royalty_earned)}</div>
                        </div>
                        <div style={{ background: 'var(--bg-surface-2)', borderRadius: 'var(--radius-md)', padding: '12px 16px' }}>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>Royalty Paid</div>
                          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--brand-primary-light)' }}>{formatCurrency(book.royalty_paid)}</div>
                        </div>
                        <div style={{ background: 'var(--bg-surface-2)', borderRadius: 'var(--radius-md)', padding: '12px 16px' }}>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>Pending</div>
                          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: book.royalty_pending > 0 ? 'var(--priority-medium)' : 'var(--text-secondary)' }}>
                            {formatCurrency(book.royalty_pending)}
                          </div>
                        </div>
                      </div>

                      {/* Royalty per copy info */}
                      {book.author_royalty_per_copy && (
                        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-tertiary)', display: 'flex', gap: 20 }}>
                          <span>Royalty/copy: <strong style={{ color: 'var(--text-secondary)' }}>{formatCurrency(book.author_royalty_per_copy)}</strong></span>
                          {book.last_royalty_payout_date && (
                            <span>Last payout: <strong style={{ color: 'var(--text-secondary)' }}>{formatDate(book.last_royalty_payout_date)}</strong></span>
                          )}
                        </div>
                      )}

                      {/* Raise a query button */}
                      <div style={{ marginTop: 14 }} onClick={(e) => e.stopPropagation()}>
                        <a
                          href={`/author/tickets/new?bookId=${book.id}`}
                          className="btn btn-secondary btn-sm"
                        >
                          🎫 Raise a query about this book
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* In Production Books */}
            {inProduction.length > 0 && (
              <div className="fade-in">
                <h3 style={{ marginBottom: 16 }}>⚙️ In Production ({inProduction.length})</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {inProduction.map((book) => (
                    <div key={book.id} className="card" id={`book-prod-${book.id}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 style={{ fontSize: '1rem' }}>{book.title}</h3>
                          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>
                            {book.genre && <span>🏷️ {book.genre} · </span>}
                            {book.isbn && <span>ISBN: {book.isbn}</span>}
                          </div>
                        </div>
                        <span style={{ fontSize: 12, color: 'var(--priority-medium)', fontWeight: 600 }}>
                          {book.status}
                        </span>
                      </div>
                      <div style={{ marginTop: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 6 }}>
                          <span>Production Progress</span>
                          <span>{getProductionStagePercent(book.status)}%</span>
                        </div>
                        <div className="progress-bar">
                          <div className="progress-fill" style={{ width: `${getProductionStagePercent(book.status)}%` }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: 'var(--text-tertiary)' }}>
                          <span>Manuscript Received</span>
                          <span>Published & Live</span>
                        </div>
                      </div>
                      <div style={{ marginTop: 14 }}>
                        <a
                          href={`/author/tickets/new?bookId=${book.id}`}
                          className="btn btn-secondary btn-sm"
                        >
                          🎫 Ask about production status
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
