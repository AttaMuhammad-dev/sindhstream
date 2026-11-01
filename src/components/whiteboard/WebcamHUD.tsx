import React, { useRef, useState } from 'react';
import { HandTrackingState, UserSettings } from '../../types';
import {
  Video,
  VideoOff,
  Maximize2,
  Minimize2,
  RefreshCw,
  Sliders,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  MousePointer,
} from 'lucide-react';

interface WebcamHUDProps {
  trackingState: HandTrackingState;
  settings: UserSettings;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onToggleCamera: () => void;
  onOpenCalibration: () => void;
  onToggleMirror: () => void;
  isVirtualMode: boolean;
  onToggleVirtualMode: () => void;
}

export const WebcamHUD: React.FC<WebcamHUDProps> = ({
  trackingState,
  settings,
  videoRef,
  onToggleCamera,
  onOpenCalibration,
  onToggleMirror,
  isVirtualMode,
  onToggleVirtualMode,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);

  return (
    <div
      className={`absolute bottom-5 right-5 z-30 transition-all duration-200 select-none ${
        isMinimized ? 'w-44' : 'w-72 sm:w-80'
      }`}
    >
      <div className="bg-[#0B1222]/95 border border-slate-800 rounded-xl shadow-2xl backdrop-blur-md overflow-hidden text-slate-200">
        {/* HUD Header */}
        <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-900/90 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                trackingState.isTrackingActive
                  ? 'bg-cyan-400 animate-pulse'
                  : isVirtualMode
                  ? 'bg-amber-400'
                  : 'bg-slate-600'
              }`}
            />
            <span className="text-xs font-semibold tracking-tight text-white">
              {trackingState.isTrackingActive
                ? 'Air Vision HUD'
                : isVirtualMode
                ? 'Virtual Stylus'
                : 'Touchless Camera'}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={onOpenCalibration}
              className="p-1 rounded text-slate-400 hover:text-cyan-300 hover:bg-slate-800 transition-colors"
              title="Calibration & Gestures"
              aria-label="Calibrate gestures"
            >
              <Sliders className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title={isMinimized ? 'Expand' : 'Minimize'}
              aria-label={isMinimized ? 'Expand HUD' : 'Minimize HUD'}
            >
              {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Video Surface / Status View */}
        {!isMinimized && (
          <div className="relative bg-black/60 aspect-[4/3] flex items-center justify-center overflow-hidden">
            <video
              ref={videoRef}
              playsInline
              muted
              className={`w-full h-full object-cover transition-transform ${
                settings.mirrorWebcam ? 'scale-x-[-1]' : ''
              } ${trackingState.isTrackingActive ? 'block' : 'hidden'}`}
            />

            {/* Inactive or Error Overlay */}
            {!trackingState.isTrackingActive && (
              <div className="p-4 text-center space-y-2.5">
                {trackingState.cameraStatus === 'error' ? (
                  <>
                    <AlertCircle className="w-7 h-7 text-rose-400 mx-auto" />
                    <p className="text-xs text-slate-200 font-medium">Camera or hand tracking could not start</p>
                    <p className="text-[11px] text-slate-400 leading-tight">
                      {trackingState.errorMessage || 'Check the camera connection and internet access, then try again.'}
                    </p>
                  </>
                ) : trackingState.cameraStatus === 'denied' ? (
                  <>
                    <AlertCircle className="w-7 h-7 text-amber-400 mx-auto" />
                    <p className="text-xs text-slate-300 font-medium">Camera Access Denied</p>
                    <p className="text-[11px] text-slate-400 leading-tight">
                      Use browser settings to allow camera or switch to the Virtual Air Stylus mode below.
                    </p>
                  </>
                ) : trackingState.cameraStatus === 'requesting' ? (
                  <>
                    <RefreshCw className="w-7 h-7 text-cyan-400 animate-spin mx-auto" />
                    <p className="text-xs text-slate-300 font-medium">Requesting Camera & Vision Task...</p>
                    <p className="text-[11px] text-slate-400">Please grant camera permission in browser prompt.</p>
                  </>
                ) : (
                  <>
                    <VideoOff className="w-7 h-7 text-slate-500 mx-auto" />
                    <p className="text-xs text-slate-300 font-medium">Touchless Camera Inactive</p>
                    <p className="text-[11px] text-slate-400">
                      Start webcam to write in the air using finger gestures or use stylus/mouse.
                    </p>
                  </>
                )}

                <div className="pt-1 flex items-center justify-center gap-2">
                  <button
                    onClick={onToggleCamera}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-500 transition-colors shadow"
                  >
                    {trackingState.isTrackingActive ? 'Stop Camera' : 'Start Camera'}
                  </button>
                  <button
                    onClick={onToggleVirtualMode}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                      isVirtualMode
                        ? 'bg-amber-950/60 border-amber-600 text-amber-300'
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <span className="flex items-center gap-1">
                      <MousePointer className="w-3 h-3" />
                      {isVirtualMode ? 'Virtual On' : 'Virtual Mode'}
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* Gesture & Interaction State feedback badge over video when active */}
            {trackingState.isTrackingActive && (
              <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 bg-black/70 backdrop-blur-md rounded text-[11px] text-cyan-300 font-mono border border-cyan-500/30">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    trackingState.interactionState === 'WRITING' ? 'bg-cyan-400 animate-ping' : 'bg-blue-400'
                  }`}
                />
                <span className="uppercase font-bold">{trackingState.interactionState}</span>
                <span className="text-slate-400">·</span>
                <span className="uppercase">{trackingState.gesture}</span>
              </div>
            )}

            {/* Handedness & FPS */}
            {trackingState.isTrackingActive && (
              <div className="absolute top-2 right-2 px-2 py-1 bg-black/70 backdrop-blur-md rounded text-[10px] text-slate-300 font-mono">
                {trackingState.detectedHand} · {trackingState.fps} FPS
              </div>
            )}

            {/* Pinch Distance Bar Overlay */}
            {trackingState.isTrackingActive && (
              <div className="absolute bottom-2 left-2 right-2">
                <div className="flex items-center justify-between text-[10px] text-slate-300 mb-0.5 font-mono">
                  <span>Pinch: {(trackingState.pinchDistance * 100).toFixed(0)}%</span>
                  <span className={trackingState.isPinching ? 'text-cyan-300 font-bold' : 'text-slate-400'}>
                    {trackingState.isPinching ? 'WRITING' : 'HOVER'}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-black/60 rounded-full overflow-hidden border border-white/10">
                  <div
                    className={`h-full transition-all duration-75 ${
                      trackingState.isPinching ? 'bg-cyan-400' : 'bg-blue-600'
                    }`}
                    style={{ width: `${Math.min(100, trackingState.pinchDistance * 500)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* HUD Quick Bar Footer */}
        <div className="px-3 py-2 bg-slate-900/95 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800">
          <div className="flex items-center gap-2">
            <span>Hand: <strong className="text-slate-200">{trackingState.detectedHand}</strong></span>
            <span>·</span>
            <span>Conf: <strong className="text-slate-200">{trackingState.confidence}%</strong></span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={onToggleMirror}
              className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
              title="Mirror image horizontally"
            >
              {settings.mirrorWebcam ? 'Mirrored' : 'Direct'}
            </button>
            <button
              onClick={onToggleCamera}
              className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
            >
              {trackingState.isTrackingActive ? 'Turn Off' : 'Turn On'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
