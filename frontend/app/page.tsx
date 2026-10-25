'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getUser } from './lib/utils';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const user = getUser();
    if (!user) {
      router.replace('/login');
    } else {
      router.replace(user.role === 'admin' ? '/admin' : '/author');
    }
  }, [router]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      color: 'var(--text-secondary)',
    }}>
      <div className="spinner" />
      <span>Loading BookLeaf...</span>
    </div>
  );
}
