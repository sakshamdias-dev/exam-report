import React from 'react';

interface ExamFriendlyLogoProps {
  className?: string;
  showTagline?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'light-bg' | 'dark-bg';
}

export const ExamFriendlyLogo: React.FC<ExamFriendlyLogoProps> = ({
  className = '',
  showTagline = true,
  size = 'md',
  variant = 'light-bg',
}) => {
  // Height presets
  const sizeClasses = {
    sm: 'h-8',
    md: 'h-11',
    lg: 'h-16',
    xl: 'h-24',
  };

  const taglineColor = variant === 'dark-bg' ? 'text-slate-300' : 'text-slate-800';

  return (
    <div className={`inline-flex flex-col items-center select-none ${className}`}>
      {/* Main Logo Container */}
      <div className={`flex items-center gap-1 sm:gap-1.5 ${sizeClasses[size]}`}>
        {/* Left: EXAM with Top and Bottom Deep Sky Blue Bars */}
        <div className="flex flex-col justify-between h-full py-0.5 relative px-1 sm:px-2">
          {/* Top Blue Bar */}
          <div className="w-full h-1 sm:h-1.5 bg-[#009fe3] rounded-full shadow-xs" />
          
          {/* "exam" text */}
          <span className="font-extrabold text-[#009fe3] tracking-wider text-xl sm:text-2xl md:text-3xl leading-none font-sans lowercase px-1 my-auto flex items-center justify-center">
            exam
          </span>

          {/* Bottom Blue Bar */}
          <div className="w-full h-1 sm:h-1.5 bg-[#009fe3] rounded-full shadow-xs" />
        </div>

        {/* Right: Solid Vibrant Orange Box with White FRIENDLY text */}
        <div className="bg-[#f25f22] text-white px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-sm sm:rounded-md flex items-center justify-center shadow-xs h-full min-w-[90px] sm:min-w-[130px]">
          <span 
            className="text-white text-lg sm:text-2xl md:text-3xl tracking-widest font-black uppercase italic leading-none"
            style={{ fontFamily: "'Caveat', 'Plus Jakarta Sans', cursive, sans-serif" }}
          >
            FRIENDLY
          </span>
        </div>
      </div>

      {/* Subtitle Tagline */}
      {showTagline && size !== 'sm' && (
        <p className={`text-[10px] sm:text-xs font-semibold tracking-tight mt-1.5 ${taglineColor} text-center whitespace-nowrap`}>
          Unlock Your Potential with Exam Friendly Tutorials
        </p>
      )}
    </div>
  );
};
