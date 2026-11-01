import React, { useState } from 'react';
import { AppView, UserRole } from '../../types';
import {
  Sparkles,
  Plus,
  Video,
  VideoOff,
  Cloud,
  CloudOff,
  CheckCircle2,
  RefreshCw,
  GraduationCap,
  Menu,
  X,
  LayoutDashboard,
  PenTool,
  FolderKanban,
  Tv,
  Bot,
  Settings,
} from 'lucide-react';
import { type User as FirebaseUser } from 'firebase/auth';

interface AppHeaderProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  onNewBoard: () => void;
  isCameraActive: boolean;
  onToggleCamera: () => void;
  currentUser: FirebaseUser | null;
  cloudSyncStatus: 'synced' | 'saving' | 'offline_draft' | 'error';
  onOpenAuth: () => void;
  onOpenProfile: () => void;
  onOpenSetupGuide: () => void;
  userRole?: UserRole;
  onToggleRole?: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  currentView,
  onNavigate,
  onNewBoard,
  isCameraActive,
  onToggleCamera,
  currentUser,
  cloudSyncStatus,
  onOpenAuth,
  onOpenProfile,
  onOpenSetupGuide,
  userRole,
  onToggleRole,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header className="px-4 sm:px-6 py-3 bg-[#090E1A]/95 border-b border-slate-800/80 backdrop-blur-md sticky top-0 z-40">
      <div className="flex items-center justify-between gap-3 sm:gap-6">
        {/* Zone 1: Single text element wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => {
              onNavigate('dashboard');
              setIsMobileMenuOpen(false);
            }}
            className="text-base sm:text-lg font-bold tracking-tight text-white hover:text-cyan-400 transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 rounded"
            aria-label="GestEra Dashboard"
          >
            <span className="w-2.5 h-2.5 rounded-sm bg-gradient-to-tr from-blue-600 to-cyan-400" />
            <span>GestEra</span>
          </button>
        </div>

        {/* Zone 2: Clean single-line text navigation links (desktop) */}
        <nav className="hidden lg:flex items-center gap-6 xl:gap-7 text-sm font-medium text-slate-400">
          <button
            onClick={() => onNavigate('dashboard')}
            className={`hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              currentView === 'dashboard' ? 'text-cyan-400 font-semibold' : ''
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => onNavigate('workspace')}
            className={`hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              currentView === 'workspace' ? 'text-cyan-400 font-semibold' : ''
            }`}
          >
            Whiteboard
          </button>
          <button
            onClick={() => onNavigate('projects')}
            className={`hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              currentView === 'projects' ? 'text-cyan-400 font-semibold' : ''
            }`}
          >
            Projects
          </button>
          <button
            onClick={() => onNavigate('classroom')}
            className={`hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 ${
              currentView === 'classroom' ? 'text-cyan-400 font-semibold' : ''
            }`}
          >
            <span>Classroom</span>
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">Live</span>
          </button>
          <button
            onClick={() => onNavigate('ai-tutor')}
            className={`hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              currentView === 'ai-tutor' ? 'text-cyan-400 font-semibold' : ''
            }`}
          >
            AI Tutor
          </button>
          <button
            onClick={() => onNavigate('settings')}
            className={`hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              currentView === 'settings' ? 'text-cyan-400 font-semibold' : ''
            }`}
          >
            Settings
          </button>
        </nav>

        {/* Zone 3: Cloud Auth, Camera & Primary Action */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {/* Firebase Cloud Sync / Auth Button */}
          {currentUser ? (
            <button
              onClick={onOpenProfile}
              className="px-2 sm:px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700/80 hover:border-slate-600 text-xs text-slate-200 flex items-center gap-1.5 sm:gap-2 cursor-pointer transition-colors"
              title={`Signed in as ${currentUser.email}. Click for Cloud Sync details.`}
            >
              <div className="relative">
                <Cloud className="w-3.5 h-3.5 text-cyan-400" />
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ${
                    cloudSyncStatus === 'synced'
                      ? 'bg-emerald-400 ring-1 ring-emerald-500'
                      : cloudSyncStatus === 'saving'
                      ? 'bg-cyan-400 animate-ping'
                      : 'bg-amber-400'
                  }`}
                />
              </div>
              <span className="hidden md:inline font-medium text-xs max-w-[90px] xl:max-w-[120px] truncate text-slate-200">
                {currentUser.displayName || currentUser.email?.split('@')[0]}
              </span>
            </button>
          ) : (
            <button
              onClick={onOpenAuth}
              className="px-2 sm:px-2.5 py-1.5 rounded-lg bg-slate-900/80 border border-slate-700/70 hover:border-cyan-500/50 text-xs text-slate-300 hover:text-white flex items-center gap-1.5 cursor-pointer transition-colors"
              title="Sign in with Firebase to enable cloud synchronization"
            >
              <Cloud className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline">Sync</span>
            </button>
          )}

          {/* Role Toggle Pill */}
          {userRole && onToggleRole && (
            <button
              onClick={onToggleRole}
              className={`px-2 sm:px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all ${
                userRole === 'teacher'
                  ? 'bg-blue-950/70 border-blue-500/60 text-blue-300 hover:bg-blue-900/60'
                  : 'bg-emerald-950/70 border-emerald-500/60 text-emerald-300 hover:bg-emerald-900/60'
              }`}
              title={`Active Mode: ${userRole === 'teacher' ? 'Teacher (Click to switch to Student)' : 'Student (Click to switch to Teacher)'}`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span className="capitalize hidden sm:inline">{userRole}</span>
            </button>
          )}

          {/* Camera Toggle */}
          <button
            onClick={onToggleCamera}
            className={`px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-lg border transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
              isCameraActive
                ? 'bg-blue-950/60 border-cyan-500/50 text-cyan-300 hover:bg-blue-900/60'
                : 'bg-slate-900/80 border-slate-700/60 text-slate-300 hover:bg-slate-800'
            }`}
            title={isCameraActive ? 'Turn off Air Camera' : 'Turn on Air Camera'}
            aria-label={isCameraActive ? 'Turn off camera' : 'Turn on camera'}
          >
            {isCameraActive ? (
              <>
                <Video className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden md:inline">Air Cam</span>
              </>
            ) : (
              <>
                <VideoOff className="w-3.5 h-3.5 text-slate-400" />
                <span className="hidden md:inline">Air Cam</span>
              </>
            )}
          </button>

          {/* New Board Action */}
          <button
            onClick={onNewBoard}
            className="px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-600 rounded-lg hover:from-blue-500 hover:to-cyan-500 transition-all shadow-md shadow-blue-950/40 whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            aria-label="Create New Whiteboard"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Board</span>
          </button>

          {/* Mobile Menu Hamburger Toggle */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/80 transition-colors cursor-pointer border border-slate-800"
            aria-label={isMobileMenuOpen ? 'Close Navigation Menu' : 'Open Navigation Menu'}
          >
            {isMobileMenuOpen ? <X className="w-5 h-5 text-cyan-400" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Dropdown */}
      {isMobileMenuOpen && (
        <div className="lg:hidden mt-3 pt-3 border-t border-slate-800/80 grid grid-cols-2 gap-2 animate-fadeIn">
          <button
            onClick={() => {
              onNavigate('dashboard');
              setIsMobileMenuOpen(false);
            }}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
              currentView === 'dashboard'
                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                : 'text-slate-300 hover:bg-slate-800/60'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Dashboard</span>
          </button>

          <button
            onClick={() => {
              onNavigate('workspace');
              setIsMobileMenuOpen(false);
            }}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
              currentView === 'workspace'
                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                : 'text-slate-300 hover:bg-slate-800/60'
            }`}
          >
            <PenTool className="w-4 h-4" />
            <span>Whiteboard</span>
          </button>

          <button
            onClick={() => {
              onNavigate('projects');
              setIsMobileMenuOpen(false);
            }}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
              currentView === 'projects'
                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                : 'text-slate-300 hover:bg-slate-800/60'
            }`}
          >
            <FolderKanban className="w-4 h-4" />
            <span>Projects</span>
          </button>

          <button
            onClick={() => {
              onNavigate('classroom');
              setIsMobileMenuOpen(false);
            }}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
              currentView === 'classroom'
                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                : 'text-slate-300 hover:bg-slate-800/60'
            }`}
          >
            <Tv className="w-4 h-4" />
            <span>Classroom</span>
          </button>

          <button
            onClick={() => {
              onNavigate('ai-tutor');
              setIsMobileMenuOpen(false);
            }}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
              currentView === 'ai-tutor'
                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                : 'text-slate-300 hover:bg-slate-800/60'
            }`}
          >
            <Bot className="w-4 h-4" />
            <span>AI Tutor</span>
          </button>

          <button
            onClick={() => {
              onNavigate('settings');
              setIsMobileMenuOpen(false);
            }}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
              currentView === 'settings'
                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                : 'text-slate-300 hover:bg-slate-800/60'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </button>
        </div>
      )}
    </header>
  );
};
