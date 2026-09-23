import React from 'react';
import { User } from '../../types';
import { ExamFriendlyLogo } from '../ExamFriendlyLogo';
import { 
  ShieldCheck, 
  LogOut, 
  Bell,
  Sparkles
} from 'lucide-react';
import { motion } from 'motion/react';

export interface MobileTabItem {
  id: string;
  label: string;
  icon: React.ElementType;
  badge?: number | string;
}

interface MobileAppShellProps {
  currentUser: User | null;
  onLogout?: () => void;
  activeTab: string;
  tabs: MobileTabItem[];
  onSelectTab?: (tabId: string) => void;
  onTabChange?: (tabId: string) => void;
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  onToggleDesktopView?: () => void;
  headerAction?: React.ReactNode;
}

export const MobileAppShell: React.FC<MobileAppShellProps> = ({
  currentUser,
  onLogout,
  activeTab,
  tabs,
  onSelectTab,
  onTabChange,
  children,
  title,
  subtitle,
  headerAction,
}) => {
  const handleTabClick = (id: string) => {
    if (typeof onTabChange === 'function') onTabChange(id);
    if (typeof onSelectTab === 'function') onSelectTab(id);
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans pb-20 select-none">
      {/* 1. Sleek Mobile Native App Header */}
      <header className="sticky top-0 z-40 bg-[#0B1528] text-white border-b border-sky-900/40 shadow-sm px-3.5 py-2.5 flex items-center justify-between">
        {/* Left: Brand & Mobile App Badge */}
        <div className="flex items-center gap-2">
          <div className="bg-white p-1 rounded-lg shadow-xs flex items-center justify-center shrink-0">
            <ExamFriendlyLogo size="sm" showTagline={false} />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-white text-xs tracking-tight">
                {title || 'ExamFriendly'}
              </span>
              <span className="px-1.5 py-0.2 text-[9px] font-bold bg-sky-500/20 text-sky-300 rounded border border-sky-400/30 uppercase tracking-wide">
                App
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-medium truncate max-w-[140px]">
              {subtitle || (currentUser ? (currentUser.Role === 'teacher' ? 'Faculty Terminal' : 'Student Terminal') : 'Digital Exam Terminal')}
            </span>
          </div>
        </div>

        {/* Right: User Chip & Switcher */}
        <div className="flex items-center gap-1.5">
          {headerAction}

          {currentUser ? (
            <div className="flex items-center gap-1.5 pl-1.5 border-l border-slate-800">
              <div
                className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold ${
                  currentUser.Role === 'teacher'
                    ? 'bg-orange-500/20 text-[#f25f22] border border-orange-500/30'
                    : 'bg-sky-500/20 text-[#009fe3] border border-sky-500/30'
                }`}
              >
                {currentUser.Role === 'teacher' ? 'F' : 'S'}
              </div>
              <motion.button
                whileTap={{ scale: 0.9 }}
                type="button"
                onClick={onLogout}
                className="p-1.5 text-slate-400 hover:text-rose-400 rounded-md"
                title="Log Out"
                aria-label="Log Out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </motion.button>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-2 py-0.5 rounded-full font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Live</span>
            </div>
          )}
        </div>
      </header>

      {/* 2. Main Mobile Content Feed */}
      <main className="flex-1 w-full max-w-lg mx-auto overflow-x-hidden">
        {children}
      </main>

      {/* 3. Fixed Native Mobile Bottom Tab Bar */}
      {tabs.length > 0 && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-2 py-1.5 max-w-lg mx-auto">
          <div className="flex items-center justify-around">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTabClick(tab.id)}
                  className="relative flex-1 py-1 px-1 flex flex-col items-center justify-center transition-colors min-h-[44px]"
                >
                  {isActive && (
                    <motion.div
                      layoutId="mobileActiveTab"
                      className="absolute inset-0 bg-sky-50 rounded-xl -z-10"
                      transition={{ type: 'spring', stiffness: 450, damping: 30 }}
                    />
                  )}

                  <div className="relative">
                    <Icon
                      className={`w-5 h-5 transition-transform duration-150 ${
                        isActive
                          ? 'text-sky-600 scale-110'
                          : 'text-slate-400 hover:text-slate-600'
                      }`}
                    />
                    {tab.badge !== undefined && Number(tab.badge) > 0 && (
                      <span className="absolute -top-1 -right-2 px-1.5 py-0.2 min-w-[16px] text-center text-[9px] font-bold bg-rose-500 text-white rounded-full shadow-xs">
                        {tab.badge}
                      </span>
                    )}
                  </div>

                  <span
                    className={`text-[10px] mt-0.5 font-medium leading-tight ${
                      isActive ? 'text-sky-700 font-bold' : 'text-slate-500'
                    }`}
                  >
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
};
