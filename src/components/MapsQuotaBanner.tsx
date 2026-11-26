import React, { useEffect, useState } from 'react';
import { GMP_QUOTA_EXCEEDED_EVENT } from '../utils/mapsQuota';

export const MapsQuotaBanner: React.FC = () => {
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  useEffect(() => {
    const handleQuotaExceeded = () => setQuotaExceeded(true);
    window.addEventListener(GMP_QUOTA_EXCEEDED_EVENT, handleQuotaExceeded);
    return () => {
      window.removeEventListener(GMP_QUOTA_EXCEEDED_EVENT, handleQuotaExceeded);
    };
  }, []);

  if (!quotaExceeded) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm w-full"
    >
      <span>
        Google Maps Platform quota reached. If you are the app owner, visit{' '}
        <a
          href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
          target="_blank"
          rel="noopener noreferrer"
          className="underline font-semibold text-amber-950 hover:text-amber-800"
        >
          maps developer site
        </a>{' '}
        for instructions to update your account.
      </span>
    </div>
  );
};
