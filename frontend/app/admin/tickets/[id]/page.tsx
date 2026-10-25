'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Sidebar from '../../../components/Sidebar';
import FormattedText from '../../../components/FormattedText';
import {
  admin,
  ai,
  type Ticket,
  type AIDraft,
  type AIClassification,
  type Book,
} from '../../../lib/api';
import {
  getStatusBadgeClass,
  getPriorityBadgeClass,
  getPriorityEmoji,
  formatDateTime,
  formatCurrency,
  formatDate,
  timeAgo,
  getUser,
  getInitials,
} from '../../../lib/utils';

const STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed'];
const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];
const CATEGORIES = [
  'Royalty & Payments',
  'ISBN & Metadata Issues',
  'Printing & Quality',
  'Distribution & Availability',
  'Book Status & Production Updates',
  'General Inquiry',
];

export default function AdminTicketDetail() {
  const params = useParams();
  const router = useRouter();
  const ticketId = params.id as string;

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [authorBooks, setAuthorBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'conversation' | 'notes'>('conversation');

  // Reply state
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [isAiDrafted, setIsAiDrafted] = useState(false);

  // Internal Note state
  const [noteText, setNoteText] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  // AI Draft Assistant state
  const [aiDraft, setAiDraft] = useState<AIDraft | null>(null);
  const [generatingDraft, setGeneratingDraft] = useState(false);
  const [draftError, setDraftError] = useState('');

  // AI Classification state
  const [reclassifying, setReclassifying] = useState(false);
  const [classificationMsg, setClassificationMsg] = useState('');

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [user, setUser] = useState<{ id: string; name: string; email?: string; role: string } | null>(null);

  const fetchTicket = async () => {
    try {
      const data = await admin.getTicket(ticketId);
      setTicket(data);
      if (data.author_id) {
        admin.getAuthorBooks(data.author_id)
          .then(setAuthorBooks)
          .catch((e) => console.warn('Failed to load author books', e));
      }
    } catch (e: unknown) {
      console.warn('Failed to fetch ticket:', e);
      setError('Could not load ticket details.');
    }
  };

  useEffect(() => {
    const currentUser = getUser();
    if (!currentUser || currentUser.role !== 'admin') {
      router.replace('/login');
      return;
    }
    setUser(currentUser);
    fetchTicket().finally(() => setLoading(false));
  }, [ticketId, router]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ticket?.messages, activeTab]);

  const handleStatusChange = async (newStatus: string) => {
    if (!ticket) return;
    try {
      const updated = await admin.updateStatus(ticket.id, newStatus);
      setTicket(updated);
    } catch (e) {
      alert('Failed to update status');
    }
  };

  const handlePriorityChange = async (newPriority: string) => {
    if (!ticket) return;
    try {
      const updated = await admin.updatePriority(ticket.id, newPriority);
      setTicket(updated);
    } catch (e) {
      alert('Failed to update priority');
    }
  };

  const handleCategoryChange = async (newCat: string) => {
    if (!ticket) return;
    try {
      const updated = await admin.updateCategory(ticket.id, newCat);
      setTicket(updated);
    } catch (e) {
      alert('Failed to update category');
    }
  };

  const handleAssignToMe = async () => {
    if (!ticket) return;
    try {
      const updated = await admin.assignToMe(ticket.id);
      setTicket(updated);
    } catch (e) {
      alert('Failed to assign ticket');
    }
  };

  const handleUnassign = async () => {
    if (!ticket) return;
    try {
      const updated = await admin.unassign(ticket.id);
      setTicket(updated);
    } catch (e) {
      alert('Failed to unassign ticket');
    }
  };

  // AI Draft Generation
  const handleGenerateAiDraft = async () => {
    if (!ticket) return;
    setGeneratingDraft(true);
    setDraftError('');
    try {
      const draftData = await ai.getDraft(ticket.id);
      setAiDraft(draftData);
    } catch (e: unknown) {
      setDraftError('Failed to generate AI draft. Please try again.');
    } finally {
      setGeneratingDraft(false);
    }
  };

  const handleInsertDraft = () => {
    if (!aiDraft) return;
    setReplyText(aiDraft.draft);
    setIsAiDrafted(true);
    setActiveTab('conversation');
  };

  // Re-classify ticket
  const handleReclassify = async () => {
    if (!ticket) return;
    setReclassifying(true);
    setClassificationMsg('');
    try {
      const result: AIClassification = await ai.classify(ticket.id);
      await fetchTicket();
      setClassificationMsg(`Classified as ${result.category} (${result.priority})`);
      setTimeout(() => setClassificationMsg(''), 4000);
    } catch (e) {
      setClassificationMsg('Classification failed');
    } finally {
      setReclassifying(false);
    }
  };

  // Send Reply
  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticket || !replyText.trim()) return;
    setSendingReply(true);
    try {
      const updated = await admin.reply(ticket.id, replyText.trim(), isAiDrafted);
      setTicket(updated);
      setReplyText('');
      setIsAiDrafted(false);
    } catch (e) {
      alert('Failed to send reply');
    } finally {
      setSendingReply(false);
    }
  };

  // Add Internal Note
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticket || !noteText.trim()) return;
    setAddingNote(true);
    try {
      const updated = await admin.addNote(ticket.id, noteText.trim());
      setTicket(updated);
      setNoteText('');
    } catch (e) {
      alert('Failed to add internal note');
    } finally {
      setAddingNote(false);
    }
  };

  if (loading) {
    return (
      <div className="layout">
        <Sidebar role="admin" />
        <main className="main-content">
          <div className="page-loader">
            <div className="spinner" />
            <span>Loading ticket details...</span>
          </div>
        </main>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="layout">
        <Sidebar role="admin" />
        <main className="main-content">
          <div className="card fade-in" style={{ textAlign: 'center', padding: '48px 24px' }}>
            <span style={{ fontSize: 40, marginBottom: 16, display: 'block' }}>⚠️</span>
            <h3>{error || 'Ticket not found'}</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>
              The ticket may have been removed or you do not have permission to view it.
            </p>
            <button className="btn btn-secondary" onClick={() => router.push('/admin/tickets')}>
              ← Back to Ticket Queue
            </button>
          </div>
        </main>
      </div>
    );
  }

  const selectedBook = authorBooks.find((b) => b.id === ticket.book_id);

  return (
    <div className="layout">
      <Sidebar role="admin" />
      <main className="main-content">
        {/* Top Breadcrumb & Controls Header */}
        <div className="page-header fade-in" style={{ marginBottom: 16 }}>
          <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: 12 }}>
            <div className="flex items-center gap-3">
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => router.push('/admin/tickets')}
              >
                ← Queue
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: 13, color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>
                    #{ticket.id.slice(0, 8)}
                  </span>
                  <span className={`badge ${getStatusBadgeClass(ticket.status)}`}>
                    {ticket.status}
                  </span>
                  <span className={`badge ${getPriorityBadgeClass(ticket.priority || 'Medium')}`}>
                    {getPriorityEmoji(ticket.priority || 'Medium')} {ticket.priority || 'Medium'}
                  </span>
                  {ticket.category && (
                    <span className="badge badge-primary">{ticket.category}</span>
                  )}
                </div>
                <h1 style={{ fontSize: 22, marginTop: 4, marginBottom: 0 }}>{ticket.subject}</h1>
              </div>
            </div>

            {/* Quick Status and Priority Selectors */}
            <div className="flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
              <select
                className="select"
                style={{ width: 'auto', padding: '6px 12px', fontSize: 13 }}
                value={ticket.status}
                onChange={(e) => handleStatusChange(e.target.value)}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    Status: {s}
                  </option>
                ))}
              </select>

              <select
                className="select"
                style={{ width: 'auto', padding: '6px 12px', fontSize: 13 }}
                value={ticket.priority || 'Medium'}
                onChange={(e) => handlePriorityChange(e.target.value)}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    Priority: {p}
                  </option>
                ))}
              </select>

              <select
                className="select"
                style={{ width: 'auto', padding: '6px 12px', fontSize: 13 }}
                value={ticket.category || 'General Inquiry'}
                onChange={(e) => handleCategoryChange(e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    Category: {c}
                  </option>
                ))}
              </select>

              {ticket.assigned_to === user?.id ? (
                <button className="btn btn-secondary btn-sm" onClick={handleUnassign}>
                  Assigned to You (Unassign)
                </button>
              ) : ticket.assigned_to ? (
                <button className="btn btn-secondary btn-sm" onClick={handleAssignToMe}>
                  Reassign to Me
                </button>
              ) : (
                <button className="btn btn-primary btn-sm" onClick={handleAssignToMe}>
                  Claim Ticket
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 2-Column Workspace */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) 340px',
            gap: 24,
            alignItems: 'start',
          }}
        >
          {/* Left Column: Conversation Thread & AI Assistant */}
          <div>
            {/* Tabs Bar */}
            <div
              style={{
                display: 'flex',
                gap: 8,
                borderBottom: '1px solid var(--border-color)',
                marginBottom: 20,
              }}
            >
              <button
                className={`tab-btn ${activeTab === 'conversation' ? 'active' : ''}`}
                onClick={() => setActiveTab('conversation')}
                style={{
                  padding: '10px 16px',
                  background: 'none',
                  border: 'none',
                  borderBottom: activeTab === 'conversation' ? '2px solid var(--brand-primary)' : '2px solid transparent',
                  color: activeTab === 'conversation' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span>💬 Author Thread</span>
                <span className="badge badge-secondary" style={{ fontSize: 11 }}>
                  {ticket.messages.length}
                </span>
              </button>
              <button
                className={`tab-btn ${activeTab === 'notes' ? 'active' : ''}`}
                onClick={() => setActiveTab('notes')}
                style={{
                  padding: '10px 16px',
                  background: 'none',
                  border: 'none',
                  borderBottom: activeTab === 'notes' ? '2px solid var(--brand-primary)' : '2px solid transparent',
                  color: activeTab === 'notes' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span>🔒 Internal Notes</span>
                <span className="badge badge-secondary" style={{ fontSize: 11 }}>
                  {ticket.notes.length}
                </span>
              </button>
            </div>

            {/* TAB 1: CONVERSATION */}
            {activeTab === 'conversation' && (
              <>
                {/* AI Assistant Banner / Generator */}
                <div
                  className="card fade-in"
                  style={{
                    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(168, 85, 247, 0.08) 100%)',
                    borderColor: 'rgba(99, 102, 241, 0.25)',
                    marginBottom: 20,
                    padding: 16,
                  }}
                >
                  <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: 10 }}>
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: 20 }}>✨</span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>
                          AI Response Assistant (RAG Grounded)
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          Drafts a tailored response using BookLeaf policies, tone guidelines & author data.
                        </div>
                      </div>
                    </div>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={handleGenerateAiDraft}
                      disabled={generatingDraft}
                      style={{
                        background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                        border: 'none',
                        boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
                      }}
                    >
                      {generatingDraft ? (
                        <>
                          <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                          <span>Consulting Knowledge Base...</span>
                        </>
                      ) : (
                        <span>✨ Generate AI Response Draft</span>
                      )}
                    </button>
                  </div>

                  {draftError && (
                    <div style={{ marginTop: 10, fontSize: 13, color: 'var(--priority-critical)' }}>
                      {draftError}
                    </div>
                  )}

                  {/* Generated AI Draft Preview */}
                  {aiDraft && (
                    <div
                      className="fade-in"
                      style={{
                        marginTop: 14,
                        padding: 14,
                        background: 'var(--bg-elevated)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                        <span style={{ fontSize: 12, color: 'var(--brand-primary-light)', fontWeight: 600 }}>
                          🤖 AI Suggested Response ({aiDraft.model_used})
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={handleInsertDraft}
                            style={{ fontSize: 12, padding: '4px 10px' }}
                          >
                            ✍️ Insert into Reply Box
                          </button>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={async () => {
                              setReplyText(aiDraft.draft);
                              setIsAiDrafted(true);
                              setSendingReply(true);
                              try {
                                const updated = await admin.reply(ticket.id, aiDraft.draft, true);
                                setTicket(updated);
                                setAiDraft(null);
                                setReplyText('');
                              } catch (e) {
                                alert('Failed to send response');
                              } finally {
                                setSendingReply(false);
                              }
                            }}
                            disabled={sendingReply}
                            style={{ fontSize: 12, padding: '4px 10px' }}
                          >
                            🚀 Send Directly to Author
                          </button>
                        </div>
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          lineHeight: 1.6,
                          color: 'var(--text-primary)',
                          background: 'var(--bg-secondary)',
                          padding: 14,
                          borderRadius: 'var(--radius-sm)',
                        }}
                      >
                        <FormattedText text={aiDraft.draft} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Messages List */}
                <div
                  className="card"
                  style={{
                    maxHeight: '520px',
                    overflowY: 'auto',
                    padding: 20,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 16,
                  }}
                >
                  {ticket.messages.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-tertiary)' }}>
                      No messages recorded yet.
                    </div>
                  ) : (
                    ticket.messages.map((msg) => {
                      const isAdmin = msg.sender_role === 'admin';
                      return (
                        <div
                          key={msg.id}
                          className="fade-in"
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: isAdmin ? 'flex-end' : 'flex-start',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              marginBottom: 4,
                              fontSize: 12,
                              color: 'var(--text-tertiary)',
                            }}
                          >
                            <span style={{ fontWeight: 600, color: isAdmin ? 'var(--brand-primary-light)' : 'var(--text-primary)' }}>
                              {msg.sender_name || (isAdmin ? 'BookLeaf Team' : ticket.author_name || 'Author')}
                            </span>
                            <span>•</span>
                            <span>{timeAgo(msg.created_at)}</span>
                            {msg.is_ai_draft && (
                              <span
                                className="badge"
                                style={{
                                  background: 'rgba(99, 102, 241, 0.15)',
                                  color: '#818cf8',
                                  fontSize: 10,
                                  padding: '2px 6px',
                                }}
                              >
                                ✨ AI Drafted
                              </span>
                            )}
                          </div>
                          <div
                            style={{
                              maxWidth: '82%',
                              padding: '14px 18px',
                              borderRadius: isAdmin ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                              background: isAdmin
                                ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(79, 70, 229, 0.25) 100%)'
                                : 'var(--bg-secondary)',
                              border: isAdmin
                                ? '1px solid rgba(99, 102, 241, 0.35)'
                                : '1px solid var(--border-color)',
                              color: 'var(--text-primary)',
                              fontSize: 14,
                              lineHeight: 1.65,
                            }}
                          >
                            <FormattedText text={msg.content} />
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Reply Composer */}
                <form onSubmit={handleSendReply} style={{ marginTop: 16 }}>
                  <div
                    className="card"
                    style={{
                      padding: 20,
                      border: isAiDrafted
                        ? '1px solid rgba(108, 92, 231, 0.45)'
                        : '1px solid var(--border-color)',
                      boxShadow: isAiDrafted
                        ? '0 0 24px rgba(108, 92, 231, 0.15)'
                        : 'none',
                      transition: 'all var(--transition)',
                    }}
                  >
                    <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
                      <div className="flex items-center gap-2">
                        <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                          Reply to {ticket.author_name || 'Author'}
                        </label>
                        {isAiDrafted && (
                          <span
                            className="badge badge-primary"
                            style={{ fontSize: 11, padding: '2px 8px' }}
                          >
                            ✨ AI Draft Loaded
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {isAiDrafted && (
                          <span style={{ fontSize: 11, color: 'var(--brand-primary-light)' }}>
                            Feel free to edit before sending
                          </span>
                        )}
                        {replyText && (
                          <button
                            type="button"
                            onClick={() => {
                              setReplyText('');
                              setIsAiDrafted(false);
                            }}
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: 11, padding: '2px 8px' }}
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>
                    <textarea
                      className="form-textarea"
                      rows={7}
                      style={{
                        minHeight: 160,
                        fontSize: 14,
                        lineHeight: 1.65,
                        fontFamily: 'inherit',
                      }}
                      placeholder="Type your response to the author... or click 'Generate AI Response Draft' above."
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      required
                    />
                    <div className="flex items-center justify-between" style={{ marginTop: 12 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                        Replying will notify the author and update status to In Progress.
                      </span>
                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={sendingReply || !replyText.trim()}
                      >
                        {sendingReply ? (
                          <>
                            <div className="spinner" style={{ width: 14, height: 14 }} />
                            <span>Sending...</span>
                          </>
                        ) : (
                          <span>Send Reply →</span>
                        )}
                      </button>
                    </div>
                  </div>
                </form>
              </>
            )}

            {/* TAB 2: INTERNAL NOTES */}
            {activeTab === 'notes' && (
              <div className="fade-in">
                <div
                  className="card"
                  style={{
                    maxHeight: '480px',
                    overflowY: 'auto',
                    padding: 20,
                    marginBottom: 16,
                  }}
                >
                  {ticket.notes.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-tertiary)' }}>
                      No internal notes yet. Use internal notes to coordinate with printing partners, finance, or other team members.
                    </div>
                  ) : (
                    ticket.notes.map((note) => (
                      <div
                        key={note.id}
                        style={{
                          marginBottom: 14,
                          padding: 12,
                          background: 'rgba(234, 179, 8, 0.05)',
                          border: '1px solid rgba(234, 179, 8, 0.2)',
                          borderRadius: 'var(--radius-md)',
                        }}
                      >
                        <div className="flex items-center justify-between" style={{ marginBottom: 6, fontSize: 12 }}>
                          <span style={{ fontWeight: 600, color: 'var(--priority-medium)' }}>
                            🔒 {note.author_name || 'Admin'}
                          </span>
                          <span style={{ color: 'var(--text-tertiary)' }}>{timeAgo(note.created_at)}</span>
                        </div>
                        <div style={{ fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                          {note.content}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Add Internal Note Form */}
                <form onSubmit={handleAddNote}>
                  <div className="card" style={{ padding: 16 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
                      🔒 Add Private Internal Note (Visible to Admins Only)
                    </label>
                    <textarea
                      className="form-textarea"
                      rows={4}
                      style={{ minHeight: 110, fontSize: 14, lineHeight: 1.6, fontFamily: 'inherit' }}
                      placeholder="e.g. Spoke with Jaipur print partner, batch #4402 reprinted today..."
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      required
                    />
                    <div className="flex items-center justify-end" style={{ marginTop: 12 }}>
                      <button
                        type="submit"
                        className="btn btn-secondary"
                        disabled={addingNote || !noteText.trim()}
                      >
                        {addingNote ? 'Saving...' : 'Save Internal Note'}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            )}
          </div>

          {/* Right Column: Author Context & AI Classification */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* AI Classification Widget */}
            <div className="card fade-in">
              <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>🤖 AI Classification</span>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleReclassify}
                  disabled={reclassifying}
                  style={{ fontSize: 11, padding: '3px 8px' }}
                >
                  {reclassifying ? 'Analyzing...' : 'Re-classify'}
                </button>
              </div>

              {classificationMsg && (
                <div style={{ fontSize: 12, color: 'var(--brand-success)', marginBottom: 10 }}>
                  {classificationMsg}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-secondary)' }}>Category:</span>
                  <span style={{ fontWeight: 600 }}>{ticket.ai_category || ticket.category || 'Unclassified'}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-secondary)' }}>Priority:</span>
                  <span className={`badge ${getPriorityBadgeClass(ticket.ai_priority || ticket.priority || 'Medium')}`}>
                    {getPriorityEmoji(ticket.ai_priority || ticket.priority || 'Medium')} {ticket.ai_priority || ticket.priority || 'Medium'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-secondary)' }}>Assigned:</span>
                  <span>{ticket.assigned_admin_name || 'Unassigned'}</span>
                </div>
              </div>
            </div>

            {/* Author Profile Card */}
            <div className="card fade-in">
              <div className="flex items-center gap-3" style={{ marginBottom: 16 }}>
                <div className="user-avatar" style={{ width: 44, height: 44, fontSize: 16 }}>
                  {getInitials(ticket.author_name || 'Author')}
                </div>
                <div>
                  <h3 style={{ fontSize: 15, margin: 0 }}>{ticket.author_name || 'Author'}</h3>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{ticket.author_email}</span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-secondary)' }}>Total Books:</span>
                  <span style={{ fontWeight: 600 }}>{authorBooks.length}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-secondary)' }}>Total Copies Sold:</span>
                  <span style={{ fontWeight: 600 }}>
                    {authorBooks.reduce((s, b) => s + b.total_copies_sold, 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-secondary)' }}>Royalty Earned:</span>
                  <span style={{ fontWeight: 600, color: 'var(--brand-success)' }}>
                    {formatCurrency(authorBooks.reduce((s, b) => s + b.total_royalty_earned, 0))}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-secondary)' }}>Royalty Pending:</span>
                  <span style={{ fontWeight: 600, color: 'var(--priority-high)' }}>
                    {formatCurrency(authorBooks.reduce((s, b) => s + b.royalty_pending, 0))}
                  </span>
                </div>
              </div>
            </div>

            {/* Book Context Card (If linked) */}
            {selectedBook && (
              <div className="card fade-in">
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                  Linked Book Context
                </span>
                <h4 style={{ fontSize: 15, marginTop: 6, marginBottom: 8 }}>{selectedBook.title}</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-secondary)' }}>ISBN:</span>
                    <span style={{ fontFamily: 'monospace' }}>{selectedBook.isbn || 'Pending'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-secondary)' }}>Status:</span>
                    <span className="badge badge-secondary">{selectedBook.status}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-secondary)' }}>Sales:</span>
                    <span>{selectedBook.total_copies_sold} copies</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-secondary)' }}>Print Partner:</span>
                    <span>{selectedBook.print_partner || 'Standard'}</span>
                  </div>
                  {selectedBook.available_on && selectedBook.available_on.length > 0 && (
                    <div style={{ marginTop: 6 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>
                        Available On:
                      </span>
                      <div className="flex gap-1" style={{ flexWrap: 'wrap' }}>
                        {selectedBook.available_on.map((p) => (
                          <span key={p} className="badge badge-secondary" style={{ fontSize: 10 }}>
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
