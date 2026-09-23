import { useState, useEffect } from 'react';
import { isMobileDevice } from '../services/proctoringService';

const STORAGE_KEY = 'examfriendly_device_view_mode';

export function useDeviceMode() {
  const [windowWidth, setWindowWidth] = useState<number>(() => {
    return typeof window !== 'undefined' ? window.innerWidth : 1024;
  });

  const [isTouchDevice, setIsTouchDevice] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return isMobileDevice();
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Clear legacy manual override preference so device switching is 100% automatic
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (_) {}

    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      setIsTouchDevice(isMobileDevice());
    };

    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('orientationchange', handleResize, { passive: true });

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  // Purely automatic detection based on viewport width (< 768px) and mobile user-agent/touch
  const isMobile = windowWidth < 768 || isTouchDevice;

  return {
    isMobile,
    isMobileScreen: isMobile,
    windowWidth,
  };
}
