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

export default function App() {
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
  };

  const handleLogout = () => {
    if (activeExam) {
      if (!window.confirm('You are in an active examination room. Are you sure you want to log out?')) {
        return;
      }
    }
    setCurrentUser(null);
    setActiveExam(null);
    localStorage.removeItem('exam_portal_current_user');
  };

  return (
    <ErrorBoundary fallbackTitle="Application encountered an error" fallbackMessage="You can refresh your examination session.">
      <div className="min-h-screen bg-[#F8FAFC] text-slate-800 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
        {/* Universal Top Header (Hidden only during dedicated Active Exam Room) */}
        {!activeExam && (
          <Navbar
            currentUser={currentUser}
            onLogout={handleLogout}
          />
        )}

        {/* Main Content Area */}
        <main className="flex-1">
          {activeExam && currentUser ? (
            /* Active Full-Screen Student Exam Console */
            <ExamRoom
              exam={activeExam}
              currentUser={currentUser}
              onExit={() => setActiveExam(null)}
              onSubmitted={() => {
                setActiveExam(null);
                setRefreshKey((k) => k + 1);
              }}
            />
          ) : !currentUser ? (
            /* Landing Screen with Student Portal & Teacher Console Cards */
            <LandingScreen
              onSelectRole={handleSelectRole}
            />
          ) : currentUser.Role === 'student' ? (
            /* Student Workspace */
            <StudentDashboard
              key={refreshKey}
              currentUser={currentUser}
              onEnterExam={(exam) => setActiveExam(exam)}
            />
          ) : (
            /* Teacher Workspace */
            <TeacherDashboard
              key={refreshKey}
              currentUser={currentUser}
            />
          )}
        </main>

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
