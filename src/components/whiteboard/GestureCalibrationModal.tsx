import React from 'react';
import { X, Hand, Sliders, CheckCircle2, ZoomIn, ArrowLeftRight, Settings2 } from 'lucide-react';
import { UserSettings, HandTrackingState, GestureAction } from '../../types';

interface GestureCalibrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: UserSettings;
  onUpdateSettings: (settings: UserSettings) => void;
  trackingState: HandTrackingState;
}

const GESTURE_GUIDES = [
  {
    id: 'pinch',
    title: 'Pinch to Write',
    gestureKey: 'pinch',
    instruction: 'Touch your index finger and thumb together in the air. Drag to write fluid strokes with adaptive smoothing.',
    shortcutBadge: 'Index + Thumb Pinch',
  },
  {
    id: 'pointing',
    title: 'Index Extended (Aim / Hover)',
    gestureKey: 'pointing',
    instruction: 'Extend your index finger while keeping other fingers relaxed to reposition the air pointer without marking.',
    shortcutBadge: 'Single Index Finger',
  },
  {
    id: 'open_palm',
    title: 'Open Palm (Pause / Pan)',
    gestureKey: 'open_palm',
    instruction: 'Show all 5 open fingers facing the camera to pause tracking, prevent accidental strokes, or pan.',
    shortcutBadge: '5 Open Fingers',
  },
  {
    id: 'closed_fist',
    title: 'Closed Fist (Presentation Laser)',
    gestureKey: 'closed_fist',
    instruction: 'Close all fingers into a gentle fist to project the glowing laser pointer trail on smartboards.',
    shortcutBadge: 'Closed Fist',
  },
  {
    id: 'swipe_left',
    title: 'Swipe Left (Previous Page)',
    gestureKey: 'swipe_left',
    instruction: 'Quick horizontal flick of your hand to the left to turn back to the previous whiteboard page.',
    shortcutBadge: 'Quick Flick Left',
  },
  {
    id: 'swipe_right',
    title: 'Swipe Right (Next Page)',
    gestureKey: 'swipe_right',
    instruction: 'Quick horizontal flick of your hand to the right to advance to the next whiteboard page.',
    shortcutBadge: 'Quick Flick Right',
  },
  {
    id: 'two_hand_zoom',
    title: 'Two-Hand Distance Zoom',
    gestureKey: 'two_hand_zoom',
    instruction: 'Raise both hands in camera view. Move hands apart to zoom in; bring hands together to zoom out.',
    shortcutBadge: '2 Hands Spread/Pinch',
  },
];

export const GestureCalibrationModal: React.FC<GestureCalibrationModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  trackingState,
}) => {
  if (!isOpen) return null;

  const handleUpdateBinding = (key: keyof UserSettings['gestureBindings'], action: GestureAction) => {
    onUpdateSettings({
      ...settings,
      gestureBindings: {
        ...settings.gestureBindings,
        [key]: action,
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-3xl bg-[#0F172A] border border-slate-800 rounded-xl shadow-2xl p-6 text-slate-100 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-600/20 text-cyan-400">
              <Hand className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Air Gesture Calibration & Bindings</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Centralized classification system with configurable bindings and One Euro Filter tuning
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Close calibration"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live HUD Status & Sensitivity Tester */}
        <div className="mt-5 p-4 rounded-xl bg-slate-900/90 border border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Live Engine HUD</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm font-medium text-white">State:</span>
                <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-blue-950 text-cyan-300 border border-cyan-800 font-mono">
                  {trackingState.interactionState}
                </span>
                <span className="text-sm font-medium text-white ml-2">Gesture:</span>
                <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-cyan-950 text-cyan-300 border border-cyan-800/60 font-mono">
                  {trackingState.gesture}
                </span>
                <span className="text-xs text-slate-400">
                  · Hand: <strong className="text-slate-200">{trackingState.detectedHand}</strong>
                </span>
              </div>
            </div>

            {/* Live Pinch Distance Meter */}
            <div className="w-full sm:w-56">
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Pinch Distance:</span>
                <span className="font-mono text-cyan-300">
                  {(trackingState.pinchDistance * 100).toFixed(1)}%
                </span>
              </div>
              <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-75 ${
                    trackingState.isPinching ? 'bg-cyan-400' : 'bg-blue-600'
                  }`}
                  style={{ width: `${Math.min(100, trackingState.pinchDistance * 500)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Interactive Calibration Sliders */}
          <div className="pt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-300 font-medium">Pinch Sensitivity</span>
                <span className="font-mono text-cyan-300">{(settings.pinchSensitivity * 1000).toFixed(0)}</span>
              </div>
              <input
                type="range"
                min="0.02"
                max="0.10"
                step="0.005"
                value={settings.pinchSensitivity}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, pinchSensitivity: parseFloat(e.target.value) })
                }
                className="w-full accent-cyan-400 bg-slate-800 rounded-lg h-1.5 cursor-pointer"
              />
              <p className="text-[10px] text-slate-500 mt-1">Hysteresis enter: {settings.pinchSensitivity.toFixed(3)}, exit: {(settings.pinchSensitivity * 1.35).toFixed(3)}</p>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-300 font-medium">1€ Filter Min Cutoff</span>
                <span className="font-mono text-cyan-300">{settings.oneEuroMinCutoff.toFixed(1)} Hz</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="3.0"
                step="0.1"
                value={settings.oneEuroMinCutoff}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, oneEuroMinCutoff: parseFloat(e.target.value) })
                }
                className="w-full accent-cyan-400 bg-slate-800 rounded-lg h-1.5 cursor-pointer"
              />
              <p className="text-[10px] text-slate-500 mt-1">Lower = tighter jitter filter at low speeds.</p>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-300 font-medium">1€ Filter Speed Beta</span>
                <span className="font-mono text-cyan-300">{settings.oneEuroBeta.toFixed(3)}</span>
              </div>
              <input
                type="range"
                min="0.001"
                max="0.025"
                step="0.001"
                value={settings.oneEuroBeta}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, oneEuroBeta: parseFloat(e.target.value) })
                }
                className="w-full accent-cyan-400 bg-slate-800 rounded-lg h-1.5 cursor-pointer"
              />
              <p className="text-[10px] text-slate-500 mt-1">Higher = zero lag when moving quickly.</p>
            </div>
          </div>
        </div>

        {/* Configurable Gesture Bindings Section */}
        <div className="mt-5 p-4 rounded-xl bg-slate-900/70 border border-slate-800">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-1.5">
            <Settings2 className="w-3.5 h-3.5 text-cyan-400" />
            Configurable Gesture Bindings
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
              <span className="text-slate-300 font-medium">Open Palm</span>
              <select
                value={settings.gestureBindings.openPalmAction}
                onChange={(e) => handleUpdateBinding('openPalmAction', e.target.value as GestureAction)}
                className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-cyan-300 text-xs"
              >
                <option value="pause">Pause / Freeze</option>
                <option value="erase_select">Erase / Select</option>
                <option value="clear_board">Clear Board</option>
                <option value="aim_hover">Aim Hover</option>
              </select>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
              <span className="text-slate-300 font-medium">Closed Fist</span>
              <select
                value={settings.gestureBindings.closedFistAction}
                onChange={(e) => handleUpdateBinding('closedFistAction', e.target.value as GestureAction)}
                className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-cyan-300 text-xs"
              >
                <option value="laser_presentation">Laser Pointer</option>
                <option value="clear_board">Clear Canvas</option>
                <option value="pause">Pause</option>
              </select>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
              <span className="text-slate-300 font-medium">Swipe Left</span>
              <select
                value={settings.gestureBindings.swipeLeftAction}
                onChange={(e) => handleUpdateBinding('swipeLeftAction', e.target.value as GestureAction)}
                className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-cyan-300 text-xs"
              >
                <option value="prev_page">Previous Page</option>
                <option value="undo">Undo Stroke</option>
              </select>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
              <span className="text-slate-300 font-medium">Swipe Right</span>
              <select
                value={settings.gestureBindings.swipeRightAction}
                onChange={(e) => handleUpdateBinding('swipeRightAction', e.target.value as GestureAction)}
                className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-cyan-300 text-xs"
              >
                <option value="next_page">Next Page</option>
                <option value="redo">Redo Stroke</option>
              </select>
            </div>
          </div>
        </div>

        {/* 7 Gestures Reference Cards */}
        <div className="mt-5 space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Recognized Touchless Gestures (7 Patterns)
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {GESTURE_GUIDES.map((g) => {
              const isActive = trackingState.gesture === g.gestureKey;
              return (
                <div
                  key={g.id}
                  className={`p-3 rounded-xl border transition-all ${
                    isActive
                      ? 'bg-blue-950/60 border-cyan-500 ring-1 ring-cyan-500/40'
                      : 'bg-slate-900/60 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-white">{g.title}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      {g.shortcutBadge}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">{g.instruction}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Close */}
        <div className="flex items-center justify-end mt-6 pt-4 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-500 transition-colors cursor-pointer"
          >
            Apply & Close
          </button>
        </div>
      </div>
    </div>
  );
};
