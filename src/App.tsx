import React, { lazy, Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { AppView, Project, UserSettings, HandTrackingState, UserRole } from './types';
import {
  getStoredProjects,
  saveProject,
  deleteProject,
  toggleProjectStar,
  getStoredSettings,
  saveStoredSettings,
  getStoredStats,
} from './utils/storage';
import { handTracker } from './services/handTrackingService';
import {
  auth,
  fetchUserProjectsFromCloud,
  saveProjectToCloud,
  deleteProjectFromCloud,
  renameProjectInCloud,
  saveUserPreferencesToCloud,
  saveLocalDraft,
  getLocalDrafts,
  clearLocalDraft,
  getUserProfile,
  updateUserProfile,
} from './services/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { AppHeader } from './components/layout/AppHeader';
import { Cloud, AlertCircle, RefreshCw, CheckCircle2 } from 'lucide-react';

const DashboardView = lazy(() => import('./components/dashboard/DashboardView').then((module) => ({ default: module.DashboardView })));
const WhiteboardWorkspace = lazy(() => import('./components/whiteboard/WhiteboardWorkspace').then((module) => ({ default: module.WhiteboardWorkspace })));
const ProjectsView = lazy(() => import('./components/projects/ProjectsView').then((module) => ({ default: module.ProjectsView })));
const ClassroomView = lazy(() => import('./components/classroom/ClassroomView').then((module) => ({ default: module.ClassroomView })));
const AITutorView = lazy(() => import('./components/ai-tutor/AITutorView').then((module) => ({ default: module.AITutorView })));
const SettingsView = lazy(() => import('./components/settings/SettingsView').then((module) => ({ default: module.SettingsView })));
const NewBoardModal = lazy(() => import('./components/whiteboard/NewBoardModal').then((module) => ({ default: module.NewBoardModal })));
const GestureCalibrationModal = lazy(() => import('./components/whiteboard/GestureCalibrationModal').then((module) => ({ default: module.GestureCalibrationModal })));
const AuthModal = lazy(() => import('./components/auth/AuthModal').then((module) => ({ default: module.AuthModal })));
const UserProfileModal = lazy(() => import('./components/auth/UserProfileModal').then((module) => ({ default: module.UserProfileModal })));
const FirebaseSetupModal = lazy(() => import('./components/auth/FirebaseSetupModal').then((module) => ({ default: module.FirebaseSetupModal })));

export default function App() {
  const [currentView, setCurrentView] = useState<AppView>('dashboard');
  const [projects, setProjects] = useState<Project[]>(() => getStoredProjects());
  const [activeProject, setActiveProject] = useState<Project>(() => {
    const stored = getStoredProjects();
    return stored[0] || {
      id: `proj_init_${Date.now()}`,
      title: 'GestEra Master Canvas',
      description: 'Educational air-drawn whiteboard notebook',
      subject: 'Mathematics',
      template: 'math_grid',
      tags: ['Air-Writing', 'STEM'],
      pages: [{ id: 'p1', title: 'Page 1', background: 'grid', strokes: [] }],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isStarred: true,
    };
  });
  const [settings, setSettings] = useState<UserSettings>(() => getStoredSettings());
  const [stats, setStats] = useState(() => getStoredStats());
  const [trackingState, setTrackingState] = useState<HandTrackingState>(handTracker.state);

  // Firebase Auth & Cloud Sync State
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<'synced' | 'saving' | 'offline_draft' | 'error'>('synced');
  const [localDraftCount, setLocalDraftCount] = useState<number>(0);

  // Account Role: Teacher vs Student
  const [userRole, setUserRole] = useState<UserRole>(() => {
    const saved = localStorage.getItem('airwrite_user_role');
    return (saved === 'teacher' || saved === 'student') ? (saved as UserRole) : 'teacher';
  });

  const handleUpdateUserRole = async (newRole: UserRole) => {
    setUserRole(newRole);
    localStorage.setItem('airwrite_user_role', newRole);
    if (currentUser) {
      await updateUserProfile(currentUser.displayName || 'Educator', newRole).catch(() => {});
    }
  };

  const handleToggleUserRole = () => {
    const nextRole: UserRole = userRole === 'teacher' ? 'student' : 'teacher';
    handleUpdateUserRole(nextRole);
  };

  // Modals
  const [isNewBoardOpen, setIsNewBoardOpen] = useState(false);
  const [isCalibrationOpen, setIsCalibrationOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isSetupGuideOpen, setIsSetupGuideOpen] = useState(false);

  // Hidden persistent video element for tracking
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Debounce timer ref for cloud saves
  const cloudSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Check local recovery drafts count on boot
  useEffect(() => {
    const drafts = getLocalDrafts();
    setLocalDraftCount(Object.keys(drafts).length);
  }, []);

  // Subscribe to hand tracking state updates
  useEffect(() => {
    const unsubscribe = handTracker.subscribe((state) => {
      setTrackingState(state);
    });
    return () => unsubscribe();
  }, []);

  // Listen for Firebase Auth changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        setCloudSyncStatus('saving');
        // Check user profile for persisted role
        getUserProfile(user.uid)
          .then((prof) => {
            if (prof && prof.role) {
              const r = prof.role === 'teacher' || prof.role === 'student' ? prof.role : 'teacher';
              setUserRole(r);
              localStorage.setItem('airwrite_user_role', r);
            }
          })
          .catch(() => {});

        try {
          // Fetch existing user projects from cloud
          const cloudProjects = await fetchUserProjectsFromCloud(user.uid);
          if (cloudProjects && cloudProjects.length > 0) {
            // Merge with local projects: cloud projects take precedence
            setProjects(cloudProjects);
            saveProject(cloudProjects[0]); // update local cache
            setActiveProject((prev) => {
              const matched = cloudProjects.find((p) => p.id === prev?.id);
              return matched || cloudProjects[0];
            });
          } else {
            // If user has local projects, seed them into the cloud!
            const currentLocal = getStoredProjects();
            for (const p of currentLocal) {
              await saveProjectToCloud(p, user.uid).catch((e) => console.warn('Cloud seed error:', e));
            }
          }

          // Check if any offline pending drafts exist to sync
          const drafts = getLocalDrafts();
          const draftEntries = Object.values(drafts);
          if (draftEntries.length > 0) {
            for (const d of draftEntries) {
              if (d.pendingCloudSync) {
                await saveProjectToCloud(d.project, user.uid).catch((e) => console.warn('Draft sync error:', e));
                clearLocalDraft(d.project.id);
              }
            }
          }

          setCloudSyncStatus('synced');
          setLocalDraftCount(0);
        } catch (err) {
          console.warn('Could not load user cloud projects on sign-in:', err);
          setCloudSyncStatus('offline_draft');
        }
      } else {
        setCloudSyncStatus('synced');
      }
    });

    return () => unsubscribe();
  }, []);

  // Save settings when modified
  const handleUpdateSettings = (newSettings: UserSettings) => {
    setSettings(newSettings);
    saveStoredSettings(newSettings);
    handTracker.updateSettings(newSettings);
    if (currentUser) {
      saveUserPreferencesToCloud(currentUser.uid, newSettings).catch((err) =>
        console.warn('Could not save preferences to cloud:', err)
      );
    }
  };

  // Toggle Camera
  const handleToggleCamera = async () => {
    if (trackingState.isTrackingActive) {
      handTracker.stopTracking();
    } else if (videoRef.current) {
      await handTracker.startTracking(videoRef.current, settings, {
        width: 1400,
        height: 850,
      });
    }
  };

  // Debounced cloud saving with local fallback
  const queueCloudSave = useCallback((projectToSave: Project) => {
    if (!currentUser) return;

    setCloudSyncStatus('saving');
    if (cloudSaveTimerRef.current) {
      clearTimeout(cloudSaveTimerRef.current);
    }

    cloudSaveTimerRef.current = setTimeout(async () => {
      try {
        await saveProjectToCloud(projectToSave, currentUser.uid);
        setCloudSyncStatus('synced');
      } catch (err) {
        console.warn('Cloud auto-save error, saved to local recovery draft:', err);
        setCloudSyncStatus('offline_draft');
        saveLocalDraft(projectToSave, true);
        const drafts = getLocalDrafts();
        setLocalDraftCount(Object.keys(drafts).length);
      }
    }, 1200); // 1.2s debounce
  }, [currentUser]);

  // Project actions
  const handleSaveProject = (updated: Project) => {
    // 1. Instant local persistence
    const nextList = saveProject(updated);
    setProjects(nextList);
    if (activeProject.id === updated.id) {
      setActiveProject(updated);
    }

    // 2. Debounced cloud synchronization
    queueCloudSave(updated);
  };

  const handleDeleteProject = (id: string) => {
    const nextList = deleteProject(id);
    setProjects(nextList);
    if (activeProject.id === id && nextList.length > 0) {
      setActiveProject(nextList[0]);
    }

    if (currentUser) {
      deleteProjectFromCloud(id, currentUser.uid).catch((err) =>
        console.warn('Cloud delete failed:', err)
      );
    }
  };

  const handleRenameProject = (id: string, newTitle: string) => {
    const target = projects.find((p) => p.id === id);
    if (!target) return;
    const updated = { ...target, title: newTitle, updatedAt: Date.now() };
    handleSaveProject(updated);

    if (currentUser) {
      renameProjectInCloud(id, newTitle, currentUser.uid).catch((err) =>
        console.warn('Cloud rename failed:', err)
      );
    }
  };

  const handleDuplicateProject = (id: string) => {
    const target = projects.find((p) => p.id === id);
    if (!target) return;
    const duplicated: Project = {
      ...target,
      id: `proj_${Date.now()}`,
      title: `${target.title} (Copy)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      pages: target.pages.map((pg, i) => ({
        ...pg,
        id: `pg_${Date.now()}_${i}`,
      })),
    };
    const nextList = saveProject(duplicated);
    setProjects(nextList);
    queueCloudSave(duplicated);
  };

  const handleToggleStar = (id: string) => {
    const nextList = toggleProjectStar(id);
    setProjects(nextList);
    if (activeProject.id === id) {
      setActiveProject((prev) => {
        const next = { ...prev, isStarred: !prev.isStarred };
        queueCloudSave(next);
        return next;
      });
    } else {
      const updated = nextList.find((p) => p.id === id);
      if (updated) queueCloudSave(updated);
    }
  };

  const handleOpenProject = (project: Project) => {
    setActiveProject(project);
    setCurrentView('workspace');
  };

  const handleCreateNewBoard = (proto: Partial<Project>) => {
    const newBoard: Project = {
      id: `proj_${Date.now()}`,
      title: proto.title || 'Untitled Whiteboard',
      description: proto.description || 'Created in GestEra',
      subject: proto.subject || 'Mathematics',
      template: proto.template || 'blank',
      tags: proto.tags || ['Air-Writing'],
      pages: proto.pages || [
        { id: `pg_${Date.now()}`, title: 'Page 1', background: 'grid', strokes: [] },
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isStarred: false,
    };
    const nextList = saveProject(newBoard);
    setProjects(nextList);
    setActiveProject(newBoard);
    setCurrentView('workspace');
    queueCloudSave(newBoard);
  };

  const handleStartBoardWithTopic = (subject: Project['subject'], title: string) => {
    handleCreateNewBoard({
      title,
      subject,
      template: 'math_grid',
      description: `Exploring ${subject} concepts with AI Tutor.`,
      tags: [subject, 'AI Tutor'],
    });
  };

  // Force Cloud Sync from User Profile
  const handleForceCloudSync = async () => {
    if (!currentUser) return;
    setCloudSyncStatus('saving');
    try {
      // Sync all current projects to cloud
      for (const p of projects) {
        await saveProjectToCloud(p, currentUser.uid);
      }
      // Re-fetch to ensure bidirectional alignment
      const cloudList = await fetchUserProjectsFromCloud(currentUser.uid);
      if (cloudList && cloudList.length > 0) {
        setProjects(cloudList);
      }
      setCloudSyncStatus('synced');
      setLocalDraftCount(0);
    } catch (err) {
      setCloudSyncStatus('offline_draft');
      throw err;
    }
  };

  return (
    <div
      className={`flex flex-col bg-[#070B14] text-slate-100 ${
        currentView === 'workspace' ? 'h-screen overflow-hidden' : 'min-h-screen'
      }`}
    >
      {/* Top Application Header */}
      <AppHeader
        currentView={currentView}
        onNavigate={setCurrentView}
        onNewBoard={() => setIsNewBoardOpen(true)}
        isCameraActive={trackingState.isTrackingActive}
        onToggleCamera={handleToggleCamera}
        currentUser={currentUser}
        cloudSyncStatus={cloudSyncStatus}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onOpenProfile={() => setIsProfileModalOpen(true)}
        onOpenSetupGuide={() => setIsSetupGuideOpen(true)}
        userRole={userRole}
        onToggleRole={handleToggleUserRole}
      />

      {/* Local Draft Recovery Notification Banner (if any pending offline drafts) */}
      {localDraftCount > 0 && currentUser && (
        <div className="bg-amber-950/80 border-b border-amber-600/50 px-6 py-2 text-xs text-amber-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Local Draft Recovery Active:</strong> {localDraftCount} whiteboard draft(s) stored safely on this
              device while offline.
            </span>
          </div>
          <button
            onClick={handleForceCloudSync}
            className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded text-xs transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Sync to Cloud Now</span>
          </button>
        </div>
      )}

      {/* Main View Router */}
      <main className="flex-1 flex flex-col">
        <Suspense fallback={<div className="flex-1 grid place-items-center text-sm text-slate-400">Loading GestEra…</div>}>
        {currentView === 'dashboard' && (
          <DashboardView
            projects={projects}
            stats={stats}
            onNavigate={setCurrentView}
            onOpenNewBoard={() => setIsNewBoardOpen(true)}
            onOpenProject={handleOpenProject}
            onToggleStar={handleToggleStar}
            onDeleteProject={handleDeleteProject}
            onDuplicateProject={handleDuplicateProject}
            onOpenCalibration={() => setIsCalibrationOpen(true)}
          />
        )}

        {currentView === 'workspace' && activeProject && (
          <WhiteboardWorkspace
            project={activeProject}
            onSaveProject={handleSaveProject}
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            trackingState={trackingState}
            onToggleCamera={handleToggleCamera}
            onOpenCalibration={() => setIsCalibrationOpen(true)}
            videoRef={videoRef}
          />
        )}

        {currentView === 'projects' && (
          <ProjectsView
            projects={projects}
            onOpenProject={handleOpenProject}
            onNewBoard={() => setIsNewBoardOpen(true)}
            onToggleStar={handleToggleStar}
            onDeleteProject={handleDeleteProject}
            onDuplicateProject={handleDuplicateProject}
            onRenameProject={handleRenameProject}
          />
        )}

        {currentView === 'classroom' && (
          <ClassroomView
            currentUser={currentUser}
            projects={projects}
            trackingState={trackingState}
            onOpenProject={handleOpenProject}
            onSaveProject={handleSaveProject}
            onOpenAuth={() => setIsAuthModalOpen(true)}
            userRole={userRole}
            onUpdateRole={handleUpdateUserRole}
          />
        )}

        {currentView === 'ai-tutor' && (
          <AITutorView
            onNavigate={setCurrentView}
            onStartBoardWithTopic={handleStartBoardWithTopic}
          />
        )}

        {currentView === 'settings' && (
          <SettingsView
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            onOpenCalibration={() => setIsCalibrationOpen(true)}
          />
        )}
        </Suspense>
      </main>

      {/* Modals */}
      {isNewBoardOpen && (
        <Suspense fallback={null}>
          <NewBoardModal isOpen onClose={() => setIsNewBoardOpen(false)} onCreate={handleCreateNewBoard} />
        </Suspense>
      )}
      {isCalibrationOpen && (
        <Suspense fallback={null}>
          <GestureCalibrationModal
            isOpen
            onClose={() => setIsCalibrationOpen(false)}
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            trackingState={trackingState}
          />
        </Suspense>
      )}
      {isAuthModalOpen && (
        <Suspense fallback={null}>
          <AuthModal
            isOpen
            onClose={() => setIsAuthModalOpen(false)}
            onOpenSetupGuide={() => {
              setIsAuthModalOpen(false);
              setIsSetupGuideOpen(true);
            }}
          />
        </Suspense>
      )}
      {currentUser && isProfileModalOpen && (
        <Suspense fallback={null}>
          <UserProfileModal
            isOpen
            onClose={() => setIsProfileModalOpen(false)}
            currentUser={currentUser}
            onForceSync={handleForceCloudSync}
            cloudSyncStatus={cloudSyncStatus}
            projectCount={projects.length}
            userRole={userRole}
            onUpdateRole={handleUpdateUserRole}
          />
        </Suspense>
      )}
      {isSetupGuideOpen && (
        <Suspense fallback={null}>
          <FirebaseSetupModal isOpen onClose={() => setIsSetupGuideOpen(false)} />
        </Suspense>
      )}
    </div>
  );
}
