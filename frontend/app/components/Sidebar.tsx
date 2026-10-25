'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { getInitials, logout, getUser } from '../lib/utils';

interface NavItem {
  icon: string;
  label: string;
  href: string;
}

const authorNav: NavItem[] = [
  { icon: '🏠', label: 'Dashboard', href: '/author' },
  { icon: '📚', label: 'My Books', href: '/author/books' },
  { icon: '🎫', label: 'My Tickets', href: '/author/tickets' },
  { icon: '✉️', label: 'Submit Query', href: '/author/tickets/new' },
];

const adminNav: NavItem[] = [
  { icon: '📊', label: 'Dashboard', href: '/admin' },
  { icon: '🎟️', label: 'Ticket Queue', href: '/admin/tickets' },
  { icon: '👥', label: 'Authors', href: '/admin/authors' },
];

interface SidebarProps {
  role: 'author' | 'admin';
}

export default function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const [user, setUser] = useState<{ id: string; name: string; email?: string; role: string } | null>(null);

  useEffect(() => {
    setUser(getUser());
  }, []);

  const nav = role === 'admin' ? adminNav : authorNav;

  const isActive = (href: string) => {
    if (href === '/author' || href === '/admin') return pathname === href;
    return pathname.startsWith(href);
  };

  const displayName = user?.name || (role === 'admin' ? 'Admin' : 'User');
  const avatarInitials = user?.name ? getInitials(user.name) : (role === 'admin' ? 'A' : 'U');

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <h2>📖 BookLeaf</h2>
        <span>{role === 'admin' ? 'Admin Portal' : 'Author Portal'}</span>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {nav.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className={`nav-item ${isActive(item.href) ? 'active' : ''}`}
          >
            <span className="nav-item-icon">{item.icon}</span>
            {item.label}
          </a>
        ))}
      </nav>

      {/* User Info + Logout */}
      <div className="sidebar-bottom">
        <div className="sidebar-user">
          <div className="user-avatar" suppressHydrationWarning>
            {avatarInitials}
          </div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name truncate" suppressHydrationWarning>
              {displayName}
            </div>
            <div className="sidebar-user-role">{role}</div>
          </div>
        </div>
        <button
          className="nav-item mt-2"
          onClick={logout}
          style={{ color: 'var(--brand-danger)' }}
          id="logout-btn"
        >
          <span className="nav-item-icon">🚪</span>
          Logout
        </button>
      </div>
    </aside>
  );
}
