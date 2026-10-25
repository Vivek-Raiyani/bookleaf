'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Sidebar from '../../../components/Sidebar';
import { tickets, books, type Book } from '../../../lib/api';
import { getUser } from '../../../lib/utils';

function NewTicketForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedBookId = searchParams.get('bookId');

  const [myBooks, setMyBooks] = useState<Book[]>([]);
  const [bookId, setBookId] = useState<string>(preselectedBookId || '');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingBooks, setFetchingBooks] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const currentUser = getUser();
    if (!currentUser || currentUser.role === 'admin') {
      router.replace(currentUser?.role === 'admin' ? '/admin' : '/login');
      return;
    }
    books.getMyBooks()
      .then(setMyBooks)
      .catch((err) => {
        console.warn('Failed to load books for ticket dropdown:', err?.message || err);
      })
      .finally(() => setFetchingBooks(false));
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (subject.trim().length < 5) {
      setError('Subject must be at least 5 characters.');
      return;
    }
    if (description.trim().length < 10) {
      setError('Description must be at least 10 characters.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const ticket = await tickets.create({
        book_id: bookId || null,
        subject: subject.trim(),
        description: description.trim(),
      });
      setSuccess(true);
      setTimeout(() => router.push(`/author/tickets/${ticket.id}`), 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit ticket');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <div style={{ fontSize: '3rem', marginBottom: 16 }}>✅</div>
        <h2 className="gradient-text">Query Submitted!</h2>
        <p>Our team will review your request and respond within 24–48 hours.</p>
        <p style={{ fontSize: 13, marginTop: 8, color: 'var(--text-tertiary)' }}>
          Redirecting to your ticket...
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      <div className="card fade-in">
        <h2 style={{ marginBottom: 6 }}>Submit a Support Query</h2>
        <p style={{ marginBottom: 28, fontSize: 13 }}>
          Tell us what you need help with. Our team will respond within 24–48 hours.
        </p>

        {error && <div className="alert alert-error"><span>⚠️</span> {error}</div>}

        <form onSubmit={handleSubmit}>
          {/* Book Selection */}
          <div className="form-group">
            <label className="form-label">Regarding which book?</label>
            <select
              id="book-select"
              className="form-select"
              value={bookId}
              onChange={(e) => setBookId(e.target.value)}
              disabled={fetchingBooks}
            >
              <option value="">General / Account Level Query</option>
              {myBooks.map((book) => (
                <option key={book.id} value={book.id}>
                  {book.title} — {book.status}
                </option>
              ))}
            </select>
            <span className="form-error" style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>
              Leave blank for general account queries (not specific to any book)
            </span>
          </div>

          {/* Subject */}
          <div className="form-group">
            <label className="form-label">Subject *</label>
            <input
              id="subject-input"
              className="form-input"
              type="text"
              placeholder="e.g., Royalty payment not received for Q3"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              maxLength={200}
              minLength={5}
            />
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              {subject.length}/200
            </span>
          </div>

          {/* Description */}
          <div className="form-group">
            <label className="form-label">Description *</label>
            <textarea
              id="description-input"
              className="form-textarea"
              placeholder="Please describe your issue in detail. Include relevant dates, amounts, or any error messages you've seen. The more context you provide, the faster we can help."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              minLength={10}
              rows={6}
            />
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              {description.length} characters · minimum 10
            </span>
          </div>

          {/* File Attachment (UI only) */}
          <div className="form-group">
            <label className="form-label">Attachments (optional)</label>
            <div style={{
              border: '2px dashed var(--border-color-strong)',
              borderRadius: 'var(--radius-md)',
              padding: '24px',
              textAlign: 'center',
              cursor: 'not-allowed',
              opacity: 0.6,
            }}>
              <div style={{ fontSize: '1.5rem', marginBottom: 6 }}>📎</div>
              <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
                Drag & drop files here, or click to browse
              </p>
              <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                PNG, JPG, PDF up to 10MB (coming soon)
              </p>
            </div>
          </div>

          {/* Tips */}
          <div className="alert alert-info" style={{ marginBottom: 20 }}>
            <span>💡</span>
            <div>
              <strong>Pro tip:</strong> For printing quality issues, prepare photos of the defective copies.
              For royalty questions, include the quarter and approximate expected amount.
            </div>
          </div>

          <div className="flex gap-3">
            <button
              id="submit-ticket-btn"
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={loading}
            >
              {loading ? (
                <><span className="spinner" style={{ width: 16, height: 16 }} /> Submitting...</>
              ) : (
                '📤 Submit Query'
              )}
            </button>
            <a href="/author/tickets" className="btn btn-secondary btn-lg">Cancel</a>
          </div>
        </form>
      </div>

      {/* What happens next */}
      <div className="card fade-in" style={{ marginTop: 20 }}>
        <h4 style={{ marginBottom: 14 }}>What happens next?</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
          {[
            { step: '1', icon: '🤖', text: 'Your query is automatically classified and prioritized by our AI system.' },
            { step: '2', icon: '👤', text: 'A member of our support team is assigned and reviews your case.' },
            { step: '3', icon: '✉️', text: 'You receive a personalized response within 24–48 hours.' },
            { step: '4', icon: '✅', text: 'We follow up until your issue is fully resolved.' },
          ].map((item) => (
            <div key={item.step} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ fontSize: '1.2rem' }}>{item.icon}</span>
              <span style={{ color: 'var(--text-secondary)' }}>{item.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function NewTicketPage() {
  return (
    <div className="layout">
      <Sidebar role="author" />
      <main className="main-content">
        <div className="page-header fade-in">
          <h1>Submit a Support Query</h1>
          <p>We're here to help — typically respond within 24–48 hours.</p>
        </div>
        <Suspense fallback={<div className="page-loader"><div className="spinner" /></div>}>
          <NewTicketForm />
        </Suspense>
      </main>
    </div>
  );
}
