import { createRoot } from 'react-dom/client';
import { BackofficeApp } from './BackofficeApp';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { registerMapsQuotaListeners } from '../../utils/mapsQuota';
import '../../index.css';

registerMapsQuotaListeners();

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <BackofficeApp />
  </ErrorBoundary>
);
