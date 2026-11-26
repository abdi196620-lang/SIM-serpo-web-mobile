import { createRoot } from 'react-dom/client';
import { TeknisiApp } from './TeknisiApp';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { registerMapsQuotaListeners } from '../../utils/mapsQuota';
import '../../index.css';

registerMapsQuotaListeners();

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <TeknisiApp />
  </ErrorBoundary>
);
