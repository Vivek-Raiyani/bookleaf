'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '../lib/api';
import { saveUser, getUser } from '../lib/utils';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeDemo, setActiveDemo] = useState<string | null>(null);

  useEffect(() => {
    // Redirect if already logged in
    const user = getUser();
    if (user) {
      router.replace(user.role === 'admin' ? '/admin' : '/author');
    }
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await auth.login(email, password);
      localStorage.setItem('bookleaf_token', data.access_token);
      saveUser({ id: data.user_id, name: data.name, role: data.role });
      router.replace(data.role === 'admin' ? '/admin' : '/author');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const loginWithDemo = async (demoEmail: string, demoPass: string, label: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setActiveDemo(label);
    setError('');
    setLoading(true);
    try {
      const data = await auth.login(demoEmail, demoPass);
      localStorage.setItem('bookleaf_token', data.access_token);
      saveUser({ id: data.user_id, name: data.name, role: data.role });
      router.replace(data.role === 'admin' ? '/admin' : '/author');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const demoAccounts = [
    { label: 'Admin', email: 'admin@bookleaf.com', password: 'admin123', icon: '👑' },
    { label: 'Priya Sharma', email: 'priya.sharma@email.com', password: 'author123', icon: '✍️' },
    { label: 'Rohit Kapoor', email: 'rohit.kapoor@email.com', password: 'author123', icon: '📚' },
    { label: 'Sneha Kulkarni', email: 'sneha.kulkarni@email.com', password: 'author123', icon: '📖' },
  ];

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      background: 'radial-gradient(ellipse at top left, rgba(108,92,231,0.15) 0%, transparent 50%), radial-gradient(ellipse at bottom right, rgba(253,121,168,0.1) 0%, transparent 50%), var(--bg-page)',
    }}>
      <div style={{ width: '100%', maxWidth: 420 }} className="fade-in">
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>📖</div>
          <h1 className="gradient-text" style={{ fontSize: '1.8rem', marginBottom: 4 }}>BookLeaf</h1>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>Author Support & Communication Portal</p>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: '32px 36px' }}>
          <h2 style={{ marginBottom: 4 }}>Welcome back</h2>
          <p style={{ marginBottom: 24, fontSize: 13 }}>Sign in to your account</p>

          {error && (
            <div className="alert alert-error">
              <span>⚠️</span> {error}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                id="email-input"
                className="form-input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                id="password-input"
                className="form-input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <button
              id="login-btn"
              type="submit"
              className="btn btn-primary w-full btn-lg"
              disabled={loading}
              style={{ marginTop: 8 }}
            >
              {loading ? (
                <><span className="spinner" style={{ width: 16, height: 16 }} /> Signing in...</>
              ) : (
                '→ Sign In'
              )}
            </button>
          </form>
        </div>

        {/* Demo Accounts */}
        <div style={{ marginTop: 20 }}>
          <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 12 }}>
            Instant 1-Click Demo Login
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {demoAccounts.map((acc) => (
              <button
                key={acc.label}
                type="button"
                className={`btn btn-secondary`}
                disabled={loading}
                style={{
                  fontSize: 12,
                  borderColor: activeDemo === acc.label ? 'var(--brand-primary)' : undefined,
                  color: activeDemo === acc.label ? 'var(--brand-primary-light)' : undefined,
                }}
                onClick={() => loginWithDemo(acc.email, acc.password, acc.label)}
                id={`demo-${acc.label.toLowerCase().replace(' ', '-')}`}
              >
                {acc.icon} {acc.label}
              </button>
            ))}
          </div>
          <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-tertiary)', marginTop: 10 }}>
            All author passwords: <code style={{ background: 'var(--bg-surface-2)', padding: '1px 5px', borderRadius: 4 }}>author123</code>
          </p>
        </div>
      </div>
    </div>
  );
}
