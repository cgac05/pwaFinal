/**
 * src/features/AppShell.tsx
 * FIC: Contenedor principal de la aplicación con el dashboard como vista única
 */

import React from 'react';
import { MainDashboard } from './dashboard/MainDashboard';

/**
 * FIC: Shell principal que muestra el dashboard como vista única
 */
export const AppShell: React.FC = () => {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      <div style={{ padding: '1.5rem' }}>
        <MainDashboard />
      </div>
    </div>
  );
};
