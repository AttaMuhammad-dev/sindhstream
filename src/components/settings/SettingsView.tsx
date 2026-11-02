import React, { useState } from 'react';
import { UserSettings, GestureAction } from '../../types';
import { DEFAULT_SETTINGS } from '../../utils/storage';
import {
  Sliders,
  Hand,
  Video,
  Sparkles,
  Keyboard,
  RotateCcw,
  Check,
  Eye,
  Zap,
} from 'lucide-react';

const GESTURE_ACTION_OPTIONS: { value: GestureAction; label: string }[] = [
  { value: 'draw', label: 'Draw while held' },
  { value: 'aim_hover', label: 'Move pointer only' },
  { value: 'pause', label: 'Pause / resume tracking' },
  { value: 'laser_presentation', label: 'Presentation laser' },
  { value: 'erase_select', label: 'Eraser / select mode' },
  { value: 'prev_page', label: 'Previous page' },
  { value: 'next_page', label: 'Next page' },
  { value: 'undo', label: 'Undo last change' },
  { value: 'redo', label: 'Redo last change' },
  { value: 'clear_board', label: 'Clear page (confirm)' },
  { value: 'zoom', label: 'Two-hand zoom' },
  { value: 'zoom_in', label: 'Zoom in' },
  { value: 'zoom_out', label: 'Zoom out' },
  { value: 'ai_solve', label: 'Open AI solver' },
  { value: 'pan', label: 'Drag / pan board while held' },
  { value: 'none', label: 'Do nothing' },
];

const ActionOptions = () => (
  <>
    {GESTURE_ACTION_OPTIONS.map((option) => (
      <option key={option.value} value={option.value}>{option.label}</option>
    ))}
  </>
);

interface SettingsViewProps {
  settings: UserSettings;
  onUpdateSettings: (settings: UserSettings) => void;
  onOpenCalibration: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
  onOpenCalibration,
}) => {
  const [savedToast, setSavedToast] = useState(false);

  const update = (partial: Partial<UserSettings>) => {
    onUpdateSettings({ ...settings, ...partial });
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2000);
  };

  const handleReset = () => {
    onUpdateSettings(DEFAULT_SETTINGS);
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2000);
  };

  return (
    <div className="flex-1 overflow-y-auto px-6 py-8 max-w-5xl mx-auto w-full space-y-8 text-slate-100">
      {/* Page Title */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">System & Air Settings</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure MediaPipe hand tracking, pinch thresholds, and AI Tutor academic profile
          </p>
        </div>

        <div className="flex items-center gap-3">
          {savedToast && (
            <span className="flex items-center gap-1.5 text-xs text-cyan-400 bg-cyan-950/60 border border-cyan-800/80 px-2.5 py-1 rounded-lg animate-in fade-in">
              <Check className="w-3.5 h-3.5" /> Preferences Saved
            </span>
          )}
          <button
            onClick={handleReset}
            className="px-3.5 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>
        </div>
      </div>

      {/* Section 1: Air Tracking & Gesture Sensitivity */}
      <section className="p-6 rounded-2xl bg-[#0F172A] border border-slate-800 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-600/20 text-cyan-400">
              <Hand className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Touchless Hand Tracking & Sensitivity</h2>
              <p className="text-xs text-slate-400">Calibrate pinch detection and finger tracking geometry</p>
            </div>
          </div>

          <button
            onClick={onOpenCalibration}
            className="px-3 py-1.5 text-xs font-semibold text-cyan-400 bg-blue-950/60 border border-cyan-800/80 rounded-lg hover:bg-blue-900/60 transition-colors cursor-pointer"
          >
            Live Gesture Tester
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          {/* Dominant Hand */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Dominant Writing Hand
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['Right', 'Left'] as const).map((hand) => (
                <button
                  key={hand}
                  type="button"
                  onClick={() => update({ dominantHand: hand })}
                  className={`py-2 px-3 text-xs font-medium rounded-lg border text-center transition-all cursor-pointer ${
                    settings.dominantHand === hand
                      ? 'bg-blue-600 border-cyan-400 text-white shadow-sm'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {hand} Handed
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">
              Optimizes landmark classification for your natural writing orientation.
            </p>
          </div>

          {/* Pinch Sensitivity Threshold */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-semibold text-slate-300 uppercase tracking-wider">
                Pinch Distance Threshold
              </span>
              <span className="font-mono text-cyan-400 font-bold">
                {(settings.pinchSensitivity * 1000).toFixed(0)}
              </span>
            </div>
            <input
              type="range"
              min="0.02"
              max="0.10"
              step="0.005"
              value={settings.pinchSensitivity}
              onChange={(e) => update({ pinchSensitivity: parseFloat(e.target.value) })}
              className="w-full accent-cyan-400 bg-slate-800 rounded-lg h-2 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>Tighter Pinch (0.02)</span>
              <span>Easier Trigger (0.10)</span>
            </div>
          </div>

          {/* MediaPipe Detection Confidence */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-semibold text-slate-300 uppercase tracking-wider">
                Hand Recognition Confidence
              </span>
              <span className="font-mono text-cyan-400 font-bold">
                {Math.round((settings.handDetectionConfidence ?? 0.55) * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0.30"
              max="0.90"
              step="0.05"
              value={settings.handDetectionConfidence ?? 0.55}
              onChange={(e) => update({ handDetectionConfidence: parseFloat(e.target.value) })}
              className="w-full accent-cyan-400 bg-slate-800 rounded-lg h-2 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>More responsive · may pick up noise</span>
              <span>More selective</span>
            </div>
          </div>

          {/* Smoothing Factor */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-semibold text-slate-300 uppercase tracking-wider">
                Stroke Jitter Smoothing
              </span>
              <span className="font-mono text-cyan-400 font-bold">
                {Math.round((1 - settings.smoothingFactor) * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0.15"
              max="0.85"
              step="0.05"
              value={settings.smoothingFactor}
              onChange={(e) => update({ smoothingFactor: parseFloat(e.target.value) })}
              className="w-full accent-cyan-400 bg-slate-800 rounded-lg h-2 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>Ultra Smooth (High EMA)</span>
              <span>Raw Instant (No Filter)</span>
            </div>
          </div>

          {/* 1€ Filter Parameters */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-semibold text-slate-300 uppercase tracking-wider">
                1€ Filter Min Cutoff (Jitter)
              </span>
              <span className="font-mono text-cyan-400 font-bold">
                {settings.oneEuroMinCutoff.toFixed(1)} Hz
              </span>
            </div>
            <input
              type="range"
              min="0.2"
              max="3.0"
              step="0.1"
              value={settings.oneEuroMinCutoff}
              onChange={(e) => update({ oneEuroMinCutoff: parseFloat(e.target.value) })}
              className="w-full accent-cyan-400 bg-slate-800 rounded-lg h-2 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>0.2 Hz (Ultra Stable)</span>
              <span>3.0 Hz (Loose)</span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-semibold text-slate-300 uppercase tracking-wider">
                1€ Filter Speed Beta (Latency)
              </span>
              <span className="font-mono text-cyan-400 font-bold">
                {settings.oneEuroBeta.toFixed(3)}
              </span>
            </div>
            <input
              type="range"
              min="0.001"
              max="0.025"
              step="0.001"
              value={settings.oneEuroBeta}
              onChange={(e) => update({ oneEuroBeta: parseFloat(e.target.value) })}
              className="w-full accent-cyan-400 bg-slate-800 rounded-lg h-2 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>0.001 (Slow response)</span>
              <span>0.025 (Ultra-fast responsive)</span>
            </div>
          </div>

          {/* Toggle Switches */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900 border border-slate-800">
              <div>
                <div className="text-xs font-medium text-slate-200">Mirror Webcam Feed</div>
                <div className="text-[11px] text-slate-500">Natural mirror image behavior</div>
              </div>
              <input
                type="checkbox"
                checked={settings.mirrorWebcam}
                onChange={(e) => update({ mirrorWebcam: e.target.checked })}
                className="accent-cyan-400 w-4 h-4 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900 border border-slate-800">
              <div>
                <div className="text-xs font-medium text-slate-200">Render Hand Skeleton</div>
                <div className="text-[11px] text-slate-500">Visual landmark nodes on video HUD</div>
              </div>
              <input
                type="checkbox"
                checked={settings.showLandmarks}
                onChange={(e) => update({ showLandmarks: e.target.checked })}
                className="accent-cyan-400 w-4 h-4 cursor-pointer"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Camera & Video Feed */}
      <section className="p-6 rounded-2xl bg-[#0F172A] border border-slate-800 space-y-6">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-cyan-600/20 text-cyan-400">
            <Video className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Camera & Video Processing</h2>
            <p className="text-xs text-slate-400">Hardware input resolution and device options</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Camera Resolution
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['720p', '1080p', '480p'] as const).map((res) => (
                <button
                  key={res}
                  type="button"
                  onClick={() => update({ cameraResolution: res })}
                  className={`py-2 px-3 text-xs font-medium rounded-lg border text-center transition-all cursor-pointer ${
                    settings.cameraResolution === res
                      ? 'bg-blue-600 border-cyan-400 text-white'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {res}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">
              720p HD is a balanced choice for the 24 FPS camera tracker.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Auto-Save Interval
            </label>
            <select
              value={settings.autoSaveInterval}
              onChange={(e) => update({ autoSaveInterval: parseInt(e.target.value, 10) })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 cursor-pointer"
            >
              <option value={5}>Every 5 seconds</option>
              <option value={15}>Every 15 seconds (Recommended)</option>
              <option value={30}>Every 30 seconds</option>
              <option value={60}>Every 60 seconds</option>
            </select>
          </div>
        </div>
      </section>

      {/* Section 3: AI Tutor Academic Profile */}
      <section className="p-6 rounded-2xl bg-[#0F172A] border border-slate-800 space-y-6">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-purple-600/20 text-purple-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">AI Tutor Pedagogy & Level</h2>
            <p className="text-xs text-slate-400">Target depth of derivations and educational feedback</p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            Target Academic Level
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(['High School', 'Undergraduate', 'Advanced AP/College'] as const).map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => update({ academicLevel: lvl })}
                className={`p-3 text-left rounded-lg border transition-all cursor-pointer ${
                  settings.academicLevel === lvl
                    ? 'bg-blue-950/60 border-cyan-500 text-white ring-1 ring-cyan-500/40'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="text-xs font-bold text-slate-200">{lvl}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {lvl === 'High School'
                    ? 'Intuitive step-by-step guidance with analogies'
                    : lvl === 'Undergraduate'
                    ? 'Rigorous proofs and standard university notation'
                    : 'Theoretical precision with research-grade depth'}
                </div>
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/70 border border-slate-800 cursor-pointer">
          <div>
            <span className="block text-sm font-semibold text-slate-100">Smart handwriting conversion</span>
            <span className="block mt-1 text-xs text-slate-400">
              After you finish a short phrase, Gemini converts clear ink to editable text. Unclear writing stays as ink for review.
            </span>
          </div>
          <input
            type="checkbox"
            checked={settings.smartHandwriting !== false}
            onChange={(e) => update({ smartHandwriting: e.target.checked })}
            className="h-4 w-4 shrink-0 accent-cyan-400 cursor-pointer"
            aria-label="Enable smart handwriting conversion"
          />
        </label>
      </section>

      {/* Section 4: Customizable Gesture Actions & Bindings */}
      <section className="p-6 rounded-2xl bg-[#0F172A] border border-slate-800 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-600/20 text-emerald-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Customizable Gesture Controls & Action Mapping</h2>
              <p className="text-xs text-slate-400">Map touchless air gestures to any action of your choice with micro-precision</p>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase font-mono text-slate-400">Presets:</span>
            <button
              type="button"
              onClick={() =>
                update({
                  gestureBindings: {
                    pinchAction: 'draw',
                    pointingAction: 'laser_presentation',
                    vSignAction: 'erase_select',
                    thumbsUpAction: 'ai_solve',
                    openPalmAction: 'pan',
                    closedFistAction: 'pause',
                    swipeLeftAction: 'prev_page',
                    swipeRightAction: 'next_page',
                    twoHandZoomAction: 'zoom',
                    pinchTriggerMode: 'thumb_index',
                    hysteresisRatio: 1.35,
                    swipeVelocityThreshold: 0.8,
                    cooldownMs: 350,
                    twoHandZoomSensitivity: 0.008,
                  },
                })
              }
              className="px-2.5 py-1 text-[11px] font-medium bg-slate-900 border border-slate-700 hover:border-cyan-500 text-slate-300 rounded cursor-pointer transition-colors"
            >
              Default
            </button>
            <button
              type="button"
              onClick={() =>
                update({
                  gestureBindings: {
                    pinchAction: 'laser_presentation',
                    pointingAction: 'aim_hover',
                    vSignAction: 'erase_select',
                    thumbsUpAction: 'next_page',
                    openPalmAction: 'pause',
                    closedFistAction: 'laser_presentation',
                    swipeLeftAction: 'prev_page',
                    swipeRightAction: 'next_page',
                    twoHandZoomAction: 'zoom',
                    pinchTriggerMode: 'thumb_index',
                    hysteresisRatio: 1.4,
                    swipeVelocityThreshold: 0.7,
                    cooldownMs: 300,
                    twoHandZoomSensitivity: 0.006,
                  },
                })
              }
              className="px-2.5 py-1 text-[11px] font-medium bg-slate-900 border border-slate-700 hover:border-cyan-500 text-slate-300 rounded cursor-pointer transition-colors"
            >
              College Lecturer
            </button>
            <button
              type="button"
              onClick={() =>
                update({
                  gestureBindings: {
                    pinchAction: 'draw',
                    pointingAction: 'aim_hover',
                    vSignAction: 'undo',
                    thumbsUpAction: 'ai_solve',
                    openPalmAction: 'erase_select',
                    closedFistAction: 'undo',
                    swipeLeftAction: 'undo',
                    swipeRightAction: 'redo',
                    twoHandZoomAction: 'zoom',
                    pinchTriggerMode: 'thumb_index',
                    hysteresisRatio: 1.25,
                    swipeVelocityThreshold: 0.75,
                    cooldownMs: 220,
                    twoHandZoomSensitivity: 0.008,
                  },
                })
              }
              className="px-2.5 py-1 text-[11px] font-medium bg-slate-900 border border-slate-700 hover:border-cyan-500 text-slate-300 rounded cursor-pointer transition-colors"
            >
              Fast Proof & Solve
            </button>
          </div>
        </div>

        {/* Trigger posture */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200">Writing Trigger</span>
            <span className="text-[10px] font-mono text-cyan-400">Ergonomics</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {[
              { id: 'thumb_index', title: 'Index + Thumb Pinch', desc: 'Standard precision stylus pinch' },
              { id: 'thumb_middle', title: 'Middle + Thumb Pinch', desc: 'Relaxed tripod finger grip' },
              { id: 'index_hold', title: 'Hold Index to Draw', desc: 'Keep other fingers curled to write' },
            ].map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() =>
                  update({
                    gestureBindings: {
                      ...settings.gestureBindings,
                      pinchTriggerMode: mode.id as any,
                    },
                  })
                }
                className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                  (settings.gestureBindings?.pinchTriggerMode || 'thumb_index') === mode.id
                    ? 'bg-blue-950/70 border-cyan-400 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="text-xs font-bold text-slate-200">{mode.title}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">{mode.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Action Selectors Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Pinch */}
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200">Pinch Contact</span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300">
                Draw
              </span>
            </div>
            <select
              value={settings.gestureBindings?.pinchAction || 'draw'}
              onChange={(e) =>
                update({
                  gestureBindings: {
                    ...settings.gestureBindings,
                    pinchAction: e.target.value as any,
                  },
                })
              }
              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-cyan-300 cursor-pointer"
            >
              <ActionOptions />
            </select>
          </div>

          {/* Pointing */}
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200">Index Extended</span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300">
                Aim
              </span>
            </div>
            <select
              value={settings.gestureBindings?.pointingAction || 'laser_presentation'}
              onChange={(e) =>
                update({
                  gestureBindings: {
                    ...settings.gestureBindings,
                    pointingAction: e.target.value as any,
                  },
                })
              }
              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-cyan-300 cursor-pointer"
            >
              <ActionOptions />
            </select>
          </div>

          {/* V-Sign / Peace Sign */}
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200">Peace / V-Sign (Index+Mid)</span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300">
                V-Sign
              </span>
            </div>
            <select
              value={settings.gestureBindings?.vSignAction || 'erase_select'}
              onChange={(e) =>
                update({
                  gestureBindings: {
                    ...settings.gestureBindings,
                    vSignAction: e.target.value as any,
                  },
                })
              }
              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-cyan-300 cursor-pointer"
            >
              <ActionOptions />
            </select>
          </div>

          {/* Thumbs Up */}
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200">Thumbs Up</span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                Thumbs Up
              </span>
            </div>
            <select
              value={settings.gestureBindings?.thumbsUpAction || 'ai_solve'}
              onChange={(e) =>
                update({
                  gestureBindings: {
                    ...settings.gestureBindings,
                    thumbsUpAction: e.target.value as any,
                  },
                })
              }
              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-cyan-300 cursor-pointer"
            >
              <ActionOptions />
            </select>
          </div>

          {/* Open Palm */}
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200">Open 5-Finger Palm</span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                Hold
              </span>
            </div>
            <select
              value={settings.gestureBindings?.openPalmAction || 'pan'}
              onChange={(e) =>
                update({
                  gestureBindings: {
                    ...settings.gestureBindings,
                    openPalmAction: e.target.value as any,
                  },
                })
              }
              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-cyan-300 cursor-pointer"
            >
              <ActionOptions />
            </select>
          </div>

          {/* Closed Fist */}
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200">Closed Fist</span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300">
                Fist
              </span>
            </div>
            <select
              value={settings.gestureBindings?.closedFistAction || 'pause'}
              onChange={(e) =>
                update({
                  gestureBindings: {
                    ...settings.gestureBindings,
                    closedFistAction: e.target.value as any,
                  },
                })
              }
              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-cyan-300 cursor-pointer"
            >
              <ActionOptions />
            </select>
          </div>

          {/* Swipe Left */}
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200">Swipe Left (Flick)</span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                Flick
              </span>
            </div>
            <select
              value={settings.gestureBindings?.swipeLeftAction || 'prev_page'}
              onChange={(e) =>
                update({
                  gestureBindings: {
                    ...settings.gestureBindings,
                    swipeLeftAction: e.target.value as any,
                  },
                })
              }
              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-cyan-300 cursor-pointer"
            >
              <ActionOptions />
            </select>
          </div>

          {/* Swipe Right */}
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200">Swipe Right (Flick)</span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                Flick
              </span>
            </div>
            <select
              value={settings.gestureBindings?.swipeRightAction || 'next_page'}
              onChange={(e) =>
                update({
                  gestureBindings: {
                    ...settings.gestureBindings,
                    swipeRightAction: e.target.value as any,
                  },
                })
              }
              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-cyan-300 cursor-pointer"
            >
              <ActionOptions />
            </select>
          </div>

          {/* Two-Hand Zoom */}
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200">Two-Hand Zoom</span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                2 Hands
              </span>
            </div>
            <select
              value={settings.gestureBindings?.twoHandZoomAction || 'zoom'}
              onChange={(e) =>
                update({
                  gestureBindings: {
                    ...settings.gestureBindings,
                    twoHandZoomAction: e.target.value as GestureAction,
                  },
                })
              }
              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-cyan-300 cursor-pointer"
            >
              <ActionOptions />
            </select>
          </div>
        </div>

        {/* Dynamics Sliders */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-2 border-t border-slate-800/80">
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-semibold text-slate-300 uppercase tracking-wider">
                Pinch Hysteresis Ratio
              </span>
              <span className="font-mono text-cyan-400 font-bold">
                {(settings.gestureBindings?.hysteresisRatio || 1.35).toFixed(2)}x
              </span>
            </div>
            <input
              type="range"
              min="1.15"
              max="1.60"
              step="0.05"
              value={settings.gestureBindings?.hysteresisRatio || 1.35}
              onChange={(e) =>
                update({
                  gestureBindings: {
                    ...settings.gestureBindings,
                    hysteresisRatio: parseFloat(e.target.value),
                  },
                })
              }
              className="w-full accent-cyan-400 bg-slate-800 rounded-lg h-2 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>1.15x (Strict Lift)</span>
              <span>1.60x (Forgiving Hold)</span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-semibold text-slate-300 uppercase tracking-wider">
                Swipe Velocity Threshold
              </span>
              <span className="font-mono text-cyan-400 font-bold">
                {settings.gestureBindings?.swipeVelocityThreshold?.toFixed(2) || '0.80'}
              </span>
            </div>
            <input
              type="range"
              min="0.3"
              max="1.5"
              step="0.05"
              value={settings.gestureBindings?.swipeVelocityThreshold || 0.8}
              onChange={(e) =>
                update({
                  gestureBindings: {
                    ...settings.gestureBindings,
                    swipeVelocityThreshold: parseFloat(e.target.value),
                  },
                })
              }
              className="w-full accent-cyan-400 bg-slate-800 rounded-lg h-2 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>0.3 (Very sensitive)</span>
              <span>1.5 (Deliberate fast flick)</span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-semibold text-slate-300 uppercase tracking-wider">
                Gesture Cooldown Buffer
              </span>
              <span className="font-mono text-cyan-400 font-bold">
                {settings.gestureBindings?.cooldownMs || 350} ms
              </span>
            </div>
            <input
              type="range"
              min="150"
              max="700"
              step="25"
              value={settings.gestureBindings?.cooldownMs || 350}
              onChange={(e) =>
                update({
                  gestureBindings: {
                    ...settings.gestureBindings,
                    cooldownMs: parseInt(e.target.value, 10),
                  },
                })
              }
              className="w-full accent-cyan-400 bg-slate-800 rounded-lg h-2 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>150 ms (Rapid)</span>
              <span>700 ms (Strict debouncing)</span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-semibold text-slate-300 uppercase tracking-wider">
                Two-Hand Zoom Trigger
              </span>
              <span className="font-mono text-cyan-400 font-bold">
                {(settings.gestureBindings?.twoHandZoomSensitivity ?? 0.008).toFixed(3)}
              </span>
            </div>
            <input
              type="range"
              min="0.003"
              max="0.025"
              step="0.001"
              value={settings.gestureBindings?.twoHandZoomSensitivity ?? 0.008}
              onChange={(e) =>
                update({
                  gestureBindings: {
                    ...settings.gestureBindings,
                    twoHandZoomSensitivity: parseFloat(e.target.value),
                  },
                })
              }
              className="w-full accent-cyan-400 bg-slate-800 rounded-lg h-2 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>More sensitive</span>
              <span>More deliberate</span>
            </div>
          </div>
        </div>
      </section>

      {/* Section 5: Keyboard Shortcuts Reference */}
      <section className="p-6 rounded-2xl bg-[#0F172A] border border-slate-800 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-emerald-600/20 text-emerald-400">
            <Keyboard className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Keyboard Shortcuts & Hotkeys</h2>
            <p className="text-xs text-slate-400">Quick controls when operating with a keyboard</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 flex justify-between items-center">
            <span className="text-slate-300">Undo / Redo</span>
            <span className="px-2 py-0.5 rounded bg-slate-800 text-cyan-300 font-mono text-[11px]">
              Ctrl+Z / Ctrl+Y
            </span>
          </div>
          <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 flex justify-between items-center">
            <span className="text-slate-300">Pan Canvas</span>
            <span className="px-2 py-0.5 rounded bg-slate-800 text-cyan-300 font-mono text-[11px]">
              Space + Drag
            </span>
          </div>
          <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 flex justify-between items-center">
            <span className="text-slate-300">Zoom Canvas</span>
            <span className="px-2 py-0.5 rounded bg-slate-800 text-cyan-300 font-mono text-[11px]">
              Ctrl + Scroll
            </span>
          </div>
          <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 flex justify-between items-center">
            <span className="text-slate-300">Delete Stroke</span>
            <span className="px-2 py-0.5 rounded bg-slate-800 text-rose-300 font-mono text-[11px]">
              Delete / Backspace
            </span>
          </div>
        </div>
      </section>
    </div>
  );
};
