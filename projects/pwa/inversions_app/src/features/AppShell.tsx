import React from 'react';
import { MainDashboard } from './dashboard/MainDashboard';

export const AppShell: React.FC = () => {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      <nav
        style={{
          background: 'var(--color-surface)',
          borderBottom: '1px solid var(--color-border)',
          padding: '0 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '2rem',
          minHeight: '56px',
        }}
      >
        <div style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
          Inversiones PWA v1.0
        </div>
      </nav>

      <div style={{ padding: '1.5rem' }}>
        <MainDashboard />
      </div>
    </div>
  );
};
