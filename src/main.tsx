import { createRoot } from 'react-dom/client';
import { PortalApp } from './PortalApp.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <PortalApp />
  </ErrorBoundary>
);
