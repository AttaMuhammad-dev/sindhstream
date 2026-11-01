import React, { useState } from 'react';
import {
  X,
  Server,
  Database,
  Key,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Terminal,
  Copy,
  Check,
} from 'lucide-react';
import { testConnection, isFirebaseConfigured } from '../../services/firebase';
import firebaseConfig from '../../../firebase-applet-config.json';

interface FirebaseSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FirebaseSetupModal: React.FC<FirebaseSetupModalProps> = ({ isOpen, onClose }) => {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ connected: boolean; message?: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const isConfigured = isFirebaseConfigured();

  const handleRunDiagnostic = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testConnection();
      setTestResult(res);
    } catch (err: any) {
      setTestResult({ connected: false, message: err.message || 'Connection failed' });
    } finally {
      setTesting(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-2xl bg-[#0D1527] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-[#0A101D]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white shadow-md">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">
                Firebase Cloud Database Setup & Verification
              </h3>
              <p className="text-[11px] text-slate-400">
                Firestore &bull; Authentication &bull; Cloud Vector Stroke Persistence
              </p>
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
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Status Banner */}
          <div
            className={`p-4 rounded-xl border flex items-start justify-between gap-3 ${
              isConfigured
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                : 'bg-amber-950/40 border-amber-500/40 text-amber-200'
            }`}
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-bold text-xs">
                  {isConfigured ? 'Firebase Provisioned & Ready' : 'Firebase Configuration Pending'}
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Connected Project:{' '}
                <strong className="text-white font-mono">{firebaseConfig.projectId || 'effortless-rigging-k6rpq'}</strong>
              </p>
              <p className="text-[11px] text-slate-400">
                Firestore Database ID:{' '}
                <span className="font-mono text-cyan-300">{firebaseConfig.firestoreDatabaseId}</span>
              </p>
            </div>

            <button
              onClick={handleRunDiagnostic}
              disabled={testing}
              className="py-1.5 px-3 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg text-xs font-semibold text-white transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
              <span>{testing ? 'Testing...' : 'Test Connection'}</span>
            </button>
          </div>

          {testResult && (
            <div
              className={`p-3 rounded-xl border text-xs font-mono flex items-center gap-2 ${
                testResult.connected
                  ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                  : 'bg-rose-950/60 border-rose-500/50 text-rose-300'
              }`}
            >
              <Terminal className="w-4 h-4 shrink-0" />
              <span>
                {testResult.connected
                  ? 'SUCCESS: Firestore server responded. Cloud path is active and verified.'
                  : `ERROR: ${testResult.message}`}
              </span>
            </div>
          )}

          {/* Setup Guide Steps */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Firebase Setup & Configuration Instructions
            </h4>

            <div className="space-y-2 text-xs">
              {/* Step 1 */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-cyan-400">1. Firebase Console Project</span>
                  <a
                    href="https://console.firebase.google.com"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-cyan-300"
                  >
                    <span>Console</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  Ensure your Firebase project exists. The active project ID is{' '}
                  <code className="bg-slate-900 px-1.5 py-0.5 rounded text-cyan-300 font-mono">
                    {firebaseConfig.projectId}
                  </code>
                  .
                </p>
              </div>

              {/* Step 2 */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
                <span className="font-bold text-cyan-400">2. Enable Authentication Providers</span>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  Under <strong className="text-white">Authentication &rarr; Sign-in method</strong>, enable{' '}
                  <strong className="text-cyan-300">Email/Password</strong> and{' '}
                  <strong className="text-cyan-300">Google</strong>. This allows users to register, log in, recover
                  passwords, and own private projects.
                </p>
              </div>

              {/* Step 3 */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
                <span className="font-bold text-cyan-400">3. Firestore Database & Security Rules</span>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  Our security rules enforce Zero-Trust Attribute-Based Access Control (ABAC). Users can only read, write,
                  and list their own private projects, board vector strokes, and AI interaction logs.
                </p>
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                  <span>Rules file: <code className="text-white font-mono">firestore.rules</code></span>
                  <span className="text-emerald-400 font-mono text-[10px]">Deployed via Fax RPC</span>
                </div>
              </div>

              {/* Step 4 */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
                <span className="font-bold text-cyan-400">4. Local Offline Draft Recovery</span>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  If network disconnects or synchronization fails, GestEra automatically retains local recovery
                  drafts with full structured vector strokes so no user work is ever lost.
                </p>
              </div>
            </div>
          </div>

          {/* Config inspection snippet */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Configuration JSON (firebase-applet-config.json):</span>
              <button
                onClick={() => copyToClipboard(JSON.stringify(firebaseConfig, null, 2), 'config')}
                className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 cursor-pointer"
              >
                {copiedKey === 'config' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedKey === 'config' ? 'Copied' : 'Copy Config'}</span>
              </button>
            </div>
            <pre className="p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-[11px] text-cyan-200 overflow-x-auto max-h-40">
              {JSON.stringify(firebaseConfig, null, 2)}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800/80 bg-[#0A101D] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
