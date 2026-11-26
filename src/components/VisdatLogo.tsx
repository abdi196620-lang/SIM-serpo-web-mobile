import React, { useState } from 'react';

interface VisdatLogoProps {
  className?: string;
  compact?: boolean;
  variant?: 'color' | 'light';
}

export const VisdatLogo: React.FC<VisdatLogoProps> = ({
  className = 'h-9 w-auto',
  compact = false,
  variant = 'color',
}) => {
  const [imgError, setImgError] = useState(false);

  if (variant === 'light' || imgError) {
    return (
      <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
        <svg
          viewBox="0 0 44 40"
          className="h-full w-auto shrink-0"
          aria-hidden="true"
        >
          <polygon points="2,4 13,4 22,26 31,4 42,4 22,38" fill="#E61E25" />
          <polygon
            points="14,4 22,21 32,2 37,2 22,28 11,4"
            fill={variant === 'light' ? '#FFFFFF' : '#0A4B8F'}
          />
        </svg>
        {!compact && (
          <div className="leading-[0.95] font-display-italic uppercase tracking-tight">
            <span
              className={`block text-[13px] ${
                variant === 'light' ? 'text-white' : 'text-[#0A4B8F]'
              }`}
            >
              VISDAT
            </span>
            <span
              className={`block text-[10px] font-bold tracking-wide ${
                variant === 'light' ? 'text-white/85' : 'text-[#0A4B8F]'
              }`}
            >
              TEKNIK UTAMA
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <img
      src="/assets/aistudio/logovisdat_56e98314.png"
      alt="VISDAT TEKNIK UTAMA"
      referrerPolicy="no-referrer"
      onError={() => setImgError(true)}
      className={`object-contain select-none ${className}`}
    />
  );
};
