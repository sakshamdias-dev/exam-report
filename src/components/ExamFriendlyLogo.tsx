import React, { useState } from 'react';

interface ExamFriendlyLogoProps {
  className?: string;
  showTagline?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'light-bg' | 'dark-bg' | 'nav';
}

export const ExamFriendlyLogo: React.FC<ExamFriendlyLogoProps> = ({
  className = '',
  showTagline = true,
  size = 'md',
  variant = 'light-bg',
}) => {
  const [imgError, setImgError] = useState(false);

  // Height presets for ef_logo.png
  const sizeClasses = {
    sm: 'h-8 sm:h-9 max-h-9',
    md: 'h-12 sm:h-14 max-h-14',
    lg: 'h-16 sm:h-18 max-h-18',
    xl: 'h-20 sm:h-24 max-h-24',
  };

  const textClasses = {
    sm: 'text-xs',
    md: 'text-base sm:text-lg',
    lg: 'text-xl sm:text-2xl',
    xl: 'text-2xl sm:text-3xl',
  };

  return (
    <div className={`inline-flex flex-col items-center select-none ${className}`}>
      {/* ef_logo.png placeholder in code as requested */}
      {!imgError ? (
        <img
          src="/ef_logo.png"
          alt="ef_logo.png"
          className={`${sizeClasses[size]} w-auto object-contain drop-shadow-2xs`}
          loading="eager"
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
        />
      ) : (
        /* Fallback placeholder badge when ef_logo.png is awaiting user upload */
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-mono font-bold tracking-tight ${
          variant === 'dark-bg'
            ? 'bg-slate-900 border-sky-600/40 text-white'
            : 'bg-white border-slate-300 text-slate-900 shadow-2xs'
        }`}>
          <span className="text-[#009fe3]">ef</span>
          <span className="text-[#f25f22]">_logo.png</span>
        </div>
      )}

      {showTagline && size !== 'sm' && variant !== 'nav' && (
        <p className={`text-[11px] sm:text-xs font-semibold tracking-tight mt-1.5 ${variant === 'dark-bg' ? 'text-slate-300' : 'text-slate-700'} text-center whitespace-nowrap`}>
          Unlock Your Potential with Exam Friendly Tutorials
        </p>
      )}
    </div>
  );
};
