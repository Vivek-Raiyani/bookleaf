'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '../../components/Sidebar';
import { admin, type User, type Book } from '../../lib/api';
import { getUser, getInitials, formatDate, formatCurrency, getBookStatusColor } from '../../lib/utils';

export default function AdminAuthorsPage() {
  const router = useRouter();
  const [authors, setAuthors] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedAuthor, setSelectedAuthor] = useState<User | null>(null);
  const [authorBooks, setAuthorBooks] = useState<Book[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(false);

  useEffect(() => {
    const currentUser = getUser();
    if (!currentUser || currentUser.role !== 'admin') {
      router.replace('/login');
      return;
    }
    admin.getAuthors()
      .then(setAuthors)
      .catch((err) => console.warn('Failed to load authors', err))
      .finally(() => setLoading(false));
  }, [router]);

  const handleSelectAuthor = async (author: User) => {
    setSelectedAuthor(author);
    setLoadingBooks(true);
    try {
      const books = await admin.getAuthorBooks(author.id);
      setAuthorBooks(books);
    } catch (e) {
      console.warn('Failed to fetch author books', e);
    } finally {
      setLoadingBooks(false);
    }
  };

  const filteredAuthors = authors.filter((a) => {
    const term = search.toLowerCase();
    return (
      a.name.toLowerCase().includes(term) ||
      a.email.toLowerCase().includes(term) ||
      (a.city && a.city.toLowerCase().includes(term))
    );
  });

  return (
    <div className="layout">
      <Sidebar role="admin" />
      <main className="main-content">
        <div className="page-header fade-in">
          <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1>Authors Directory</h1>
              <p>View registered authors, their published catalog, sales, and contact details.</p>
            </div>
            <div style={{ minWidth: 260 }}>
              <input
                className="input"
                type="text"
                placeholder="Search authors by name, email, city..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="page-loader">
            <div className="spinner" />
            <span>Loading authors...</span>
          </div>
        ) : filteredAuthors.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">👥</div>
            <h3>No authors found</h3>
            <p>Try adjusting your search criteria.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: selectedAuthor ? '1fr 400px' : '1fr', gap: 24 }}>
            {/* Authors Table */}
            <div className="card fade-in" style={{ padding: 0 }}>
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Author</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Location</th>
                      <th>Joined</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAuthors.map((author) => {
                      const isSelected = selectedAuthor?.id === author.id;
                      return (
                        <tr
                          key={author.id}
                          style={{
                            background: isSelected ? 'rgba(99, 102, 241, 0.08)' : undefined,
                            cursor: 'pointer',
                          }}
                          onClick={() => handleSelectAuthor(author)}
                        >
                          <td>
                            <div className="flex items-center gap-3">
                              <div className="user-avatar" style={{ width: 32, height: 32, fontSize: 13 }}>
                                {getInitials(author.name)}
                              </div>
                              <span style={{ fontWeight: 600 }}>{author.name}</span>
                            </div>
                          </td>
                          <td style={{ color: 'var(--text-secondary)' }}>{author.email}</td>
                          <td style={{ color: 'var(--text-secondary)' }}>{author.phone || '—'}</td>
                          <td>
                            {author.city ? (
                              <span className="badge badge-secondary">{author.city}</span>
                            ) : (
                              <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                            )}
                          </td>
                          <td style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>
                            {formatDate(author.joined_date)}
                          </td>
                          <td>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectAuthor(author);
                              }}
                            >
                              View Catalog →
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Author Catalog Drawer / Detail Panel */}
            {selectedAuthor && (
              <div className="card fade-in" style={{ padding: 20 }}>
                <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
                  <div className="flex items-center gap-3">
                    <div className="user-avatar" style={{ width: 40, height: 40, fontSize: 15 }}>
                      {getInitials(selectedAuthor.name)}
                    </div>
                    <div>
                      <h3 style={{ fontSize: 16, margin: 0 }}>{selectedAuthor.name}</h3>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{selectedAuthor.email}</span>
                    </div>
                  </div>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setSelectedAuthor(null)}
                    style={{ padding: '4px 8px' }}
                  >
                    ✕
                  </button>
                </div>

                <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    📍 {selectedAuthor.city || 'India'} • 📞 {selectedAuthor.phone || 'No phone'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                    Member since {formatDate(selectedAuthor.joined_date)}
                  </div>
                </div>

                <h4 style={{ fontSize: 14, marginBottom: 12 }}>
                  Books Catalog ({authorBooks.length})
                </h4>

                {loadingBooks ? (
                  <div style={{ textAlign: 'center', padding: 20 }}>
                    <div className="spinner" style={{ width: 18, height: 18, margin: '0 auto 8px' }} />
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Loading books...</span>
                  </div>
                ) : authorBooks.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>No books in catalog.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 400, overflowY: 'auto' }}>
                    {authorBooks.map((book) => (
                      <div
                        key={book.id}
                        style={{
                          padding: 12,
                          background: 'var(--bg-secondary)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 'var(--radius-md)',
                        }}
                      >
                        <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
                          <span style={{ fontWeight: 600, fontSize: 13 }}>{book.title}</span>
                          <span
                            className="badge badge-secondary"
                            style={{ fontSize: 10, color: getBookStatusColor(book.status) }}
                          >
                            {book.status}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6 }}>
                          ISBN: {book.isbn || 'Pending'} • Genre: {book.genre || 'General'}
                        </div>
                        <div className="flex justify-between" style={{ fontSize: 12 }}>
                          <span>{book.total_copies_sold} copies sold</span>
                          <span style={{ color: 'var(--brand-success)', fontWeight: 600 }}>
                            {formatCurrency(book.total_royalty_earned)} earned
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
