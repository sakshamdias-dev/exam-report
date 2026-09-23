/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Role, User, Exam } from './types';
import { Navbar } from './components/Navbar';
import { LandingScreen } from './components/LandingScreen';
import { AuthModal } from './components/AuthModal';
import { StudentDashboard } from './components/Student/StudentDashboard';
import { ExamRoom } from './components/Student/ExamRoom';
import { TeacherDashboard } from './components/Teacher/TeacherDashboard';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useDeviceMode } from './hooks/useDeviceMode';
import { MobileAppShell } from './components/Mobile/MobileAppShell';
import { MobileLandingScreen } from './components/Mobile/MobileLandingScreen';
import { MobileStudentDashboard } from './components/Mobile/MobileStudentDashboard';
import { MobileTeacherDashboard } from './components/Mobile/MobileTeacherDashboard';
import { 
  GraduationCap, 
  School, 
  Sparkles, 
  Calendar, 
  Award, 
  Camera, 
  UserCheck, 
  Radio, 
  MessageSquareQuote 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const { isMobile } = useDeviceMode();

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('exam_portal_current_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [activeExam, setActiveExam] = useState<Exam | null>(null);

  // Modals state
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authInitialRole, setAuthInitialRole] = useState<Role>('student');
  const [refreshKey, setRefreshKey] = useState(0);

  // Mobile navigation tabs state
  const [mobileLandingTab, setMobileLandingTab] = useState('welcome');
  const [mobileStudentTab, setMobileStudentTab] = useState('exams');
  const [mobileTeacherTab, setMobileTeacherTab] = useState('exams');

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('exam_portal_current_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('exam_portal_current_user');
    }
  }, [currentUser]);

  const handleSelectRole = (role: Role) => {
    setAuthInitialRole(role);
    setAuthModalOpen(true);
  };

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    setActiveExam(null);
    setMobileStudentTab('exams');
    setMobileTeacherTab('exams');
  };

  const handleLogout = () => {
    if (activeExam) {
      if (!window.confirm('You are in an active examination room. Are you sure you want to log out?')) {
        return;
      }
    }
    setCurrentUser(null);
    setActiveExam(null);
    setMobileLandingTab('welcome');
    localStorage.removeItem('exam_portal_current_user');
  };

  // Mobile Bottom Navigation Tabs Configuration
  const landingTabs = [
    { id: 'welcome', label: 'Portal', icon: Sparkles },
    { id: 'student', label: 'Candidate', icon: GraduationCap },
    { id: 'teacher', label: 'Faculty', icon: School },
  ];

  const studentTabs = [
    { id: 'exams', label: 'Exams', icon: Calendar },
    { id: 'results', label: 'Results', icon: Award },
    { id: 'scanner', label: 'Scan PDF', icon: Camera },
    { id: 'profile', label: 'Profile', icon: UserCheck },
  ];

  const teacherTabs = [
    { id: 'exams', label: 'Exams', icon: Calendar },
    { id: 'submissions', label: 'Marking', icon: Award },
    { id: 'proctor', label: 'Proctor', icon: Radio },
    { id: 'doubts', label: 'Doubts', icon: MessageSquareQuote },
  ];

  const handleMobileLandingTabChange = (tabId: string) => {
    setMobileLandingTab(tabId);
    if (tabId === 'student') {
      handleSelectRole('student');
    } else if (tabId === 'teacher') {
      handleSelectRole('teacher');
    }
  };

  return (
    <ErrorBoundary fallbackTitle="Application encountered an error" fallbackMessage="You can refresh your examination session.">
      <div className="min-h-screen bg-[#F8FAFC] text-slate-800 flex flex-col font-sans selection:bg-sky-500 selection:text-white">
        
        {/* Active Exam Mode - Full Screen On Both Mobile & Desktop for Maximum Focus */}
        {activeExam && currentUser ? (
          <ExamRoom
            exam={activeExam}
            currentUser={currentUser}
            onExit={() => setActiveExam(null)}
            onSubmitted={() => {
              setActiveExam(null);
              setRefreshKey((k) => k + 1);
            }}
          />
        ) : isMobile ? (
          /* ========================================================= */
          /* MOBILE APP INTERFACE (Specially Crafted for Mobile Viewers) */
          /* ========================================================= */
          <div className="w-full flex-1 flex flex-col">
            {!currentUser ? (
              <MobileAppShell
                title="ExamFriendly"
                subtitle="Assessment Terminal"
                currentUser={null}
                tabs={landingTabs}
                activeTab={mobileLandingTab}
                onTabChange={handleMobileLandingTabChange}
                onSelectTab={handleMobileLandingTabChange}
              >
                <MobileLandingScreen
                  onSelectRole={handleSelectRole}
                />
              </MobileAppShell>
            ) : currentUser.Role === 'student' ? (
              <MobileAppShell
                title="Candidate Portal"
                subtitle={currentUser.Name || currentUser.UserId}
                currentUser={currentUser}
                onLogout={handleLogout}
                tabs={studentTabs}
                activeTab={mobileStudentTab}
                onTabChange={setMobileStudentTab}
                onSelectTab={setMobileStudentTab}
              >
                <MobileStudentDashboard
                  key={refreshKey}
                  currentUser={currentUser}
                  onEnterExam={(exam) => setActiveExam(exam)}
                  onLogout={handleLogout}
                  activeTab={mobileStudentTab}
                  onTabChange={setMobileStudentTab}
                  onSelectTab={setMobileStudentTab}
                />
              </MobileAppShell>
            ) : (
              <MobileAppShell
                title="Faculty Console"
                subtitle={currentUser.Name || currentUser.UserId}
                currentUser={currentUser}
                onLogout={handleLogout}
                tabs={teacherTabs}
                activeTab={mobileTeacherTab}
                onTabChange={setMobileTeacherTab}
                onSelectTab={setMobileTeacherTab}
              >
                <MobileTeacherDashboard
                  key={refreshKey}
                  currentUser={currentUser}
                  onLogout={handleLogout}
                  activeTab={mobileTeacherTab}
                  onTabChange={setMobileTeacherTab}
                  onSelectTab={setMobileTeacherTab}
                />
              </MobileAppShell>
            )}
          </div>
        ) : (
          /* ========================================================= */
          /* DESKTOP WEB INTERFACE                                     */
          /* ========================================================= */
          <div className="w-full flex-1 flex flex-col">
            {/* Universal Top Header */}
            <Navbar
              currentUser={currentUser}
              onLogout={handleLogout}
            />

            {/* Main Desktop Content Area with Smooth Page Transition */}
            <main className="flex-1">
              <AnimatePresence mode="wait">
                {!currentUser ? (
                  <motion.div
                    key="landing"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                  >
                    <LandingScreen
                      onSelectRole={handleSelectRole}
                    />
                  </motion.div>
                ) : currentUser.Role === 'student' ? (
                  <motion.div
                    key="student"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                  >
                    <StudentDashboard
                      key={refreshKey}
                      currentUser={currentUser}
                      onEnterExam={(exam) => setActiveExam(exam)}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="teacher"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                  >
                    <TeacherDashboard
                      key={refreshKey}
                      currentUser={currentUser}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </main>
          </div>
        )}

        {/* Authentication Modal */}
        <AuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          initialRole={authInitialRole}
          onSuccess={handleLoginSuccess}
        />
      </div>
    </ErrorBoundary>
  );
}

