/**
 * Maharashtra Police - e-CASEVAULT
 * Digital Case & Evidence Management System
 */

import React, { useState, useEffect } from 'react';
import { Diary3DAnimation } from './components/Diary3DAnimation';
import { LoginWindow } from './components/LoginWindow';
import { VaultDashboard } from './components/VaultDashboard';
import { Case3DReaderModal } from './components/Case3DReaderModal';
import { UserSession, CaseFile } from './types';
import { apiClient, getAuthToken, setAuthToken } from './services/apiClient';
import { LanguageProvider } from './context/LanguageContext';

type AppScreen = 'INTRO_3D' | 'LOGIN' | 'DASHBOARD';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[CaseVault ErrorBoundary Caught]", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#10223d] text-white flex items-center justify-center p-6">
          <div className="bg-white text-slate-900 rounded-2xl shadow-2xl p-8 max-w-md w-full text-center space-y-4 border border-slate-200">
            <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-900 flex items-center justify-center mx-auto text-xl font-bold">
              🛡️
            </div>
            <h2 className="text-lg font-bold text-slate-900">e-CASEVAULT Intranet Portal</h2>
            <p className="text-xs text-slate-600">
              The active docket view encountered an unexpected state issue and safely recovered.
            </p>
            <div className="p-3 bg-slate-100 rounded-lg text-left text-[11px] font-mono text-slate-700 break-all max-h-24 overflow-y-auto">
              {this.state.error?.message || "Render exception safely contained."}
            </div>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="w-full py-2.5 bg-[#17406a] hover:bg-[#112d4a] text-white text-xs font-bold rounded-xl cursor-pointer transition-colors shadow-xs"
            >
              Reload Safe Portal
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <AppContent />
      </LanguageProvider>
    </ErrorBoundary>
  );
}

function AppContent() {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('INTRO_3D');
  const [userSession, setUserSession] = useState<UserSession | null>(null);
  const [active3DCase, setActive3DCase] = useState<CaseFile | null>(null);

  // Phase 8: Session restoration on page load via /api/auth/me
  useEffect(() => {
    const token = getAuthToken();
    if (token) {
      apiClient
        .getCurrentUser()
        .then((res) => {
          if (res && res.success && res.user) {
            setUserSession(res.user);
            setCurrentScreen('DASHBOARD');
          } else {
            setAuthToken(null);
            setUserSession(null);
          }
        })
        .catch(() => {
          setAuthToken(null);
          setUserSession(null);
        });
    }
  }, []);

  // Transition from 3D Intro to Login Window
  const handleIntroComplete = () => {
    if (userSession) {
      setCurrentScreen('DASHBOARD');
    } else {
      setCurrentScreen('LOGIN');
    }
  };

  // Replay Intro Sequence from anywhere
  const handleReplayIntro = () => {
    setCurrentScreen('INTRO_3D');
  };

  // On successful login -> Go to Dashboard
  const handleLoginSuccess = (session: UserSession) => {
    setUserSession(session);
    setCurrentScreen('DASHBOARD');
  };

  // Logout -> Return to Login Window
  const handleLogout = async () => {
    await apiClient.logout();
    setUserSession(null);
    setCurrentScreen('LOGIN');
  };

  // Open 3D Diary Reader for any specific case
  const handleOpen3DViewer = (caseItem?: CaseFile) => {
    if (caseItem) {
      setActive3DCase(caseItem);
    }
  };

  return (
    <main className={`w-full min-h-screen bg-vault-stone text-slate-900 flex flex-col font-sans selection:bg-blue-900 selection:text-white ${currentScreen === 'DASHBOARD' ? 'overflow-y-auto' : 'h-screen overflow-hidden'}`}>
      {currentScreen === 'INTRO_3D' && (
        <Diary3DAnimation onAnimationComplete={handleIntroComplete} />
      )}

      {currentScreen === 'LOGIN' && (
        <LoginWindow
          onLoginSuccess={handleLoginSuccess}
          onBackToIntro={handleReplayIntro}
        />
      )}

      {currentScreen === 'DASHBOARD' && userSession && (
        <VaultDashboard
          session={userSession}
          onLogout={handleLogout}
          onOpen3DViewer={handleOpen3DViewer}
          onReplayIntro={handleReplayIntro}
        />
      )}

      {/* Interactive 3D Case Reader Modal */}
      {active3DCase && (
        <Case3DReaderModal
          caseItem={active3DCase}
          onClose={() => setActive3DCase(null)}
        />
      )}
    </main>
  );
}
