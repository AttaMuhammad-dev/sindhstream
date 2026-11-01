import React, { useState } from 'react';
import {
  X,
  User,
  Mail,
  Shield,
  Cloud,
  RefreshCw,
  LogOut,
  CheckCircle2,
  AlertCircle,
  FileText,
  Key,
} from 'lucide-react';
import { type User as FirebaseUser } from 'firebase/auth';
import {
  logoutUser,
  updateUserProfile,
  getLocalDrafts,
} from '../../services/firebase';
import { UserRole } from '../../types';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: FirebaseUser;
  onForceSync: () => Promise<void>;
  cloudSyncStatus: 'synced' | 'saving' | 'offline_draft' | 'error';
  projectCount: number;
  userRole?: UserRole;
  onUpdateRole?: (role: UserRole) => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onForceSync,
  cloudSyncStatus,
  projectCount,
  userRole = 'teacher',
  onUpdateRole,
}) => {
  const [name, setName] = useState(currentUser.displayName || '');
  const [selectedRole, setSelectedRole] = useState<UserRole>(userRole);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const localDrafts = getLocalDrafts();
  const draftCount = Object.keys(localDrafts).length;

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      await updateUserProfile(name.trim(), selectedRole);
      onUpdateRole?.(selectedRole);
      setSuccessMsg(`Profile updated! Mode set to ${selectedRole === 'teacher' ? 'Teacher / Educator' : 'Student / Learner'}.`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTriggerSync = async () => {
    setIsSyncing(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      await onForceSync();
      setSuccessMsg('All projects and whiteboard vector strokes synced with Firebase Cloud.');
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Cloud sync failed. Local drafts remain protected.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
      onClose();
    } catch (err: any) {
      console.error('Logout error:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-md bg-[#0D1527] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-[#0A101D]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-500 text-white font-bold flex items-center justify-center text-xs shadow-md">
              {(currentUser.displayName || currentUser.email || 'U').charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">Account & Cloud Workspace</h3>
              <p className="text-[11px] text-slate-400">Authenticated Air-Writer</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Account Profile Details */}
          <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-cyan-400" />
                Email:
              </span>
              <span className="font-mono text-white text-xs">{currentUser.email}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-amber-400" />
                User ID:
              </span>
              <span className="font-mono text-[11px] text-slate-400">
                {currentUser.uid.slice(0, 12)}...
              </span>
            </div>
          </div>

          {/* Update Name & Role Form */}
          <form onSubmit={handleUpdateProfile} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Display Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                placeholder="Your Name"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Account Role</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedRole('teacher')}
                  className={`p-2 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                    selectedRole === 'teacher'
                      ? 'bg-blue-600 border-blue-500 text-white shadow-md'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <span>Teacher / Educator</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRole('student')}
                  className={`p-2 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                    selectedRole === 'student'
                      ? 'bg-emerald-600 border-emerald-500 text-white shadow-md'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <span>Student / Learner</span>
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={isSaving || !name.trim()}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 disabled:opacity-40 text-xs font-bold text-white rounded-lg transition-all cursor-pointer shadow-md"
              >
                {isSaving ? 'Saving Changes...' : 'Save Profile & Role'}
              </button>
            </div>
          </form>

          {/* Cloud Synchronization Status */}
          <div className="p-3.5 bg-gradient-to-br from-blue-950/40 to-slate-900 rounded-xl border border-blue-900/40 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Cloud className="w-4 h-4 text-cyan-400" />
                Cloud Synchronization
              </span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                  cloudSyncStatus === 'synced'
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                    : cloudSyncStatus === 'saving'
                    ? 'bg-blue-950 text-cyan-300 border-blue-800 animate-pulse'
                    : 'bg-amber-950 text-amber-300 border-amber-800'
                }`}
              >
                {cloudSyncStatus === 'synced' && 'Synced'}
                {cloudSyncStatus === 'saving' && 'Saving...'}
                {cloudSyncStatus === 'offline_draft' && 'Offline Draft'}
                {cloudSyncStatus === 'error' && 'Sync Error'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Cloud Projects</span>
                <span className="text-sm font-bold text-white font-mono">{projectCount}</span>
              </div>
              <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Local Draft Buffers</span>
                <span className="text-sm font-bold text-cyan-300 font-mono">{draftCount}</span>
              </div>
            </div>

            <button
              onClick={handleTriggerSync}
              disabled={isSyncing}
              className="w-full py-2 px-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 disabled:opacity-50 text-xs font-semibold text-white rounded-lg transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Synchronizing with Firebase...' : 'Force Cloud Sync'}</span>
            </button>
          </div>

          {/* Logout Action */}
          <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
            <span className="text-[11px] text-slate-500">Private session</span>
            <button
              onClick={handleLogout}
              className="py-1.5 px-3 rounded-lg text-xs font-semibold text-rose-400 hover:text-white hover:bg-rose-950/60 border border-rose-900/40 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
