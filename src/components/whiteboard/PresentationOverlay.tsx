/**
 * PresentationOverlay for AIRWRITE AI
 * Fullscreen Touchless Presentation Mode with:
 * - Real Fullscreen API integration
 * - Gesture-based slide navigation (Air Swipe Left / Right)
 * - Laser pointer effect with glowing beam and trail
 * - Live handwritten annotations layer with pen, highlighter, and color picker
 * - Clear annotation controls
 * - Escape key listener & exit controls
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { WhiteboardPage, HandTrackingState, DrawingStroke, Point2D } from '../../types';
import {
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  Flame,
  PenTool,
  Highlighter,
  Trash2,
  X,
  Radio,
  Sparkles,
  Undo2,
  Lock,
} from 'lucide-react';

interface PresentationOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  pages: WhiteboardPage[];
  initialPageIndex?: number;
  trackingState: HandTrackingState;
  presentationTitle?: string;
  isLiveBroadcast?: boolean;
  onSlideChange?: (newIndex: number) => void;
  userRole?: 'teacher' | 'student';
  canAnnotate?: boolean;
}

export const PresentationOverlay: React.FC<PresentationOverlayProps> = ({
  isOpen,
  onClose,
  pages,
  initialPageIndex = 0,
  trackingState,
  presentationTitle = 'Classroom Presentation',
  isLiveBroadcast = false,
  onSlideChange,
  userRole = 'teacher',
  canAnnotate = true,
}) => {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(initialPageIndex);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTool, setActiveTool] = useState<'laser' | 'pen' | 'highlighter'>('laser');
  const [annotationColor, setAnnotationColor] = useState('#EF4444');
  const [annotationsBySlide, setAnnotationsBySlide] = useState<Record<number, DrawingStroke[]>>({});
  const [gestureFeedback, setGestureFeedback] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const slideCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const annotationCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const laserCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Mouse / Pointer fallback for laser
  const mouseLaserPosRef = useRef<{ x: number; y: number } | null>(null);

  // Laser trail points
  const laserTrailRef = useRef<{ x: number; y: number; time: number }[]>([]);
  // Drawing current annotation stroke
  const isDrawingRef = useRef(false);
  const currentPointsRef = useRef<Point2D[]>([]);

  const activePage = pages[currentSlideIndex] || pages[0] || { id: 'p0', title: 'Slide 1', strokes: [] };
  const currentAnnotations = annotationsBySlide[currentSlideIndex] || [];

  // Sync initial index
  useEffect(() => {
    setCurrentSlideIndex(initialPageIndex);
  }, [initialPageIndex]);

  // Request fullscreen on open if possible
  useEffect(() => {
    if (isOpen) {
      const el = containerRef.current || document.documentElement;
      if (el.requestFullscreen && !document.fullscreenElement) {
        el.requestFullscreen().catch(() => {
          // Fullscreen may be blocked by browser user gesture policies
        });
      }
    }
  }, [isOpen]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  // Slide navigation
  const goToNextSlide = useCallback(() => {
    if (currentSlideIndex < pages.length - 1) {
      const next = currentSlideIndex + 1;
      setCurrentSlideIndex(next);
      onSlideChange?.(next);
      setGestureFeedback(`Slide ${next + 1} of ${pages.length}`);
      setTimeout(() => setGestureFeedback(null), 1500);
    }
  }, [currentSlideIndex, pages.length, onSlideChange]);

  const goToPrevSlide = useCallback(() => {
    if (currentSlideIndex > 0) {
      const prev = currentSlideIndex - 1;
      setCurrentSlideIndex(prev);
      onSlideChange?.(prev);
      setGestureFeedback(`Slide ${prev + 1} of ${pages.length}`);
      setTimeout(() => setGestureFeedback(null), 1500);
    }
  }, [currentSlideIndex, pages.length, onSlideChange]);

  // Gesture slide navigation (Air Swipe)
  const lastGestureRef = useRef<string>('');
  useEffect(() => {
    if (!isOpen) return;
    const g = trackingState.gesture;
    if (g === lastGestureRef.current) return;
    lastGestureRef.current = g;

    if (g === 'swipe_right') {
      goToNextSlide();
    } else if (g === 'swipe_left') {
      goToPrevSlide();
    }
  }, [isOpen, trackingState.gesture, goToNextSlide, goToPrevSlide]);

  // Keyboard navigation & Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        goToNextSlide();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        goToPrevSlide();
      } else if (e.key === 'Escape') {
        if (document.fullscreenElement) {
          document.exitFullscreen?.().catch(() => {});
        }
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, goToNextSlide, goToPrevSlide, onClose]);

  // Render base slide canvas
  const renderSlide = useCallback(() => {
    const canvas = slideCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);

    // High-contrast clean dark presentation background
    ctx.fillStyle = '#090D16';
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Subtle presentation grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    const step = 40;
    for (let x = 0; x < rect.width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, rect.height);
      ctx.stroke();
    }
    for (let y = 0; y < rect.height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(rect.width, y);
      ctx.stroke();
    }

    // Render slide strokes
    const strokes = activePage.strokes || [];
    strokes.forEach((stroke) => {
      if (stroke.points.length < 2) return;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.strokeStyle = stroke.color || '#38BDF8';
      ctx.lineWidth = (stroke.width || 3) * 1.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (stroke.tool === 'highlighter') {
        ctx.globalAlpha = 0.45;
        ctx.lineWidth = 24;
      }
      ctx.stroke();
      ctx.restore();
    });
  }, [activePage]);

  // Render annotation canvas
  const renderAnnotations = useCallback(() => {
    const canvas = annotationCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);

    currentAnnotations.forEach((stroke) => {
      if (stroke.points.length < 2) return;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.tool === 'highlighter' ? 24 : 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (stroke.tool === 'highlighter') {
        ctx.globalAlpha = 0.5;
      }
      ctx.stroke();
      ctx.restore();
    });
  }, [currentAnnotations]);

  // Render on slide or annotation change
  useEffect(() => {
    if (!isOpen) return;
    renderSlide();
    renderAnnotations();
  }, [isOpen, currentSlideIndex, activePage, renderSlide, renderAnnotations]);

  // Resize handler
  useEffect(() => {
    if (!isOpen) return;
    const handleResize = () => {
      renderSlide();
      renderAnnotations();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen, renderSlide, renderAnnotations]);

  // Laser beam loop
  useEffect(() => {
    if (!isOpen) return;
    const canvas = laserCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const loop = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
      }
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, rect.width, rect.height);

      const now = performance.now();
      const pointerPt = trackingState.smoothedPoint || trackingState.rawPoint;
      let screenX = 0;
      let screenY = 0;
      let hasLaser = false;

      if (pointerPt) {
        screenX = pointerPt.x * rect.width;
        screenY = pointerPt.y * rect.height;
        hasLaser = true;
      } else if (mouseLaserPosRef.current) {
        screenX = mouseLaserPosRef.current.x;
        screenY = mouseLaserPosRef.current.y;
        hasLaser = true;
      }

      // If laser is enabled and point exists
      if (activeTool === 'laser' && hasLaser) {
        laserTrailRef.current.push({ x: screenX, y: screenY, time: now });

        // Keep trail within last 350ms
        laserTrailRef.current = laserTrailRef.current.filter((p) => now - p.time < 350);

        // Draw glowing laser trail
        if (laserTrailRef.current.length > 1) {
          ctx.beginPath();
          ctx.moveTo(laserTrailRef.current[0].x, laserTrailRef.current[0].y);
          for (let i = 1; i < laserTrailRef.current.length; i++) {
            ctx.lineTo(laserTrailRef.current[i].x, laserTrailRef.current[i].y);
          }
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.45)';
          ctx.lineWidth = 4;
          ctx.lineCap = 'round';
          ctx.stroke();
        }

        // Draw glowing laser dot
        const grad = ctx.createRadialGradient(screenX, screenY, 2, screenX, screenY, 28);
        grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
        grad.addColorStop(0.2, 'rgba(255, 50, 50, 0.95)');
        grad.addColorStop(0.6, 'rgba(239, 68, 68, 0.4)');
        grad.addColorStop(1, 'rgba(239, 68, 68, 0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(screenX, screenY, 28, 0, Math.PI * 2);
        ctx.fill();

        // High intensity center core
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(screenX, screenY, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isOpen, activeTool, trackingState.smoothedPoint, trackingState.rawPoint]);

  // Air writing for annotations when tool is pen or highlighter
  useEffect(() => {
    if (!isOpen || activeTool === 'laser') return;
    const canvas = annotationCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const pointerPt = trackingState.smoothedPoint || trackingState.rawPoint;
    const isAirDrawing = trackingState.isPinching || trackingState.interactionState === 'WRITING';

    if (isAirDrawing && pointerPt) {
      const pt: Point2D = {
        x: pointerPt.x * rect.width,
        y: pointerPt.y * rect.height,
        time: Date.now(),
      };
      if (!isDrawingRef.current) {
        isDrawingRef.current = true;
        currentPointsRef.current = [pt];
      } else {
        currentPointsRef.current.push(pt);
      }
    } else if (isDrawingRef.current) {
      // Finished stroke
      isDrawingRef.current = false;
      if (currentPointsRef.current.length > 1) {
        const stroke: DrawingStroke = {
          id: `ann_${Date.now()}`,
          tool: activeTool === 'highlighter' ? 'highlighter' : 'pen',
          color: annotationColor,
          size: activeTool === 'highlighter' ? 24 : 4,
          width: activeTool === 'highlighter' ? 24 : 4,
          opacity: activeTool === 'highlighter' ? 0.5 : 1,
          points: [...currentPointsRef.current],
          createdAt: Date.now(),
        };
        setAnnotationsBySlide((prev) => ({
          ...prev,
          [currentSlideIndex]: [...(prev[currentSlideIndex] || []), stroke],
        }));
      }
      currentPointsRef.current = [];
    }
  }, [
    isOpen,
    activeTool,
    trackingState.isPinching,
    trackingState.interactionState,
    trackingState.smoothedPoint,
    trackingState.rawPoint,
    annotationColor,
    currentSlideIndex,
  ]);

  // Mouse fallback drawing for annotations
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeTool === 'laser') return;
    const canvas = annotationCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const pt: Point2D = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      time: Date.now(),
    };
    isDrawingRef.current = true;
    currentPointsRef.current = [pt];
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || activeTool === 'laser') return;
    const canvas = annotationCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const pt: Point2D = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      time: Date.now(),
    };
    currentPointsRef.current.push(pt);

    // Live feedback on annotation canvas
    const ctx = canvas.getContext('2d');
    if (ctx && currentPointsRef.current.length > 1) {
      const pts = currentPointsRef.current;
      const last = pts[pts.length - 2];
      const cur = pts[pts.length - 1];
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(cur.x, cur.y);
      ctx.strokeStyle = annotationColor;
      ctx.lineWidth = activeTool === 'highlighter' ? 24 : 4;
      ctx.lineCap = 'round';
      if (activeTool === 'highlighter') ctx.globalAlpha = 0.5;
      ctx.stroke();
      ctx.restore();
    }
  };

  const handleMouseUp = () => {
    if (!isDrawingRef.current || activeTool === 'laser') return;
    isDrawingRef.current = false;
    if (currentPointsRef.current.length > 1) {
      const stroke: DrawingStroke = {
        id: `ann_${Date.now()}`,
        tool: activeTool === 'highlighter' ? 'highlighter' : 'pen',
        color: annotationColor,
        size: activeTool === 'highlighter' ? 24 : 4,
        width: activeTool === 'highlighter' ? 24 : 4,
        opacity: activeTool === 'highlighter' ? 0.5 : 1,
        points: [...currentPointsRef.current],
        createdAt: Date.now(),
      };
      setAnnotationsBySlide((prev) => ({
        ...prev,
        [currentSlideIndex]: [...(prev[currentSlideIndex] || []), stroke],
      }));
    }
    currentPointsRef.current = [];
  };

  // Clear annotations on current slide
  const handleClearAnnotations = () => {
    setAnnotationsBySlide((prev) => ({
      ...prev,
      [currentSlideIndex]: [],
    }));
  };

  // Undo last annotation stroke on current slide
  const handleUndoAnnotation = () => {
    setAnnotationsBySlide((prev) => {
      const current = prev[currentSlideIndex] || [];
      if (current.length === 0) return prev;
      return {
        ...prev,
        [currentSlideIndex]: current.slice(0, -1),
      };
    });
  };

  const handleContainerMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      mouseLaserPosRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
  };

  if (!isOpen) return null;

  const isDrawingAllowed = userRole === 'teacher' || canAnnotate;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleContainerMouseMove}
      className="fixed inset-0 z-50 bg-[#070B14] text-slate-100 flex flex-col select-none overflow-hidden"
    >
      {/* Top Floating Header */}
      <div className="absolute top-4 left-6 right-6 flex items-center justify-between z-20 pointer-events-none">
        <div className="flex items-center gap-3 bg-slate-900/85 backdrop-blur-md px-4 py-2 rounded-xl border border-slate-700/80 shadow-2xl pointer-events-auto">
          {isLiveBroadcast ? (
            <div className="flex items-center gap-2 px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-semibold animate-pulse">
              <Radio className="w-3 h-3 text-rose-400" />
              <span>LIVE CLASSROOM BROADCAST</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-cyan-400 font-semibold text-xs tracking-wider uppercase">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Touchless Presentation Mode</span>
            </div>
          )}
          <span className="text-slate-500">|</span>
          <span className="text-sm font-medium text-slate-200 truncate max-w-sm">
            {presentationTitle}
          </span>
          <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
            Slide {currentSlideIndex + 1} / {pages.length}
          </span>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20 uppercase">
            {userRole}
          </span>
        </div>

        {/* Exit & Fullscreen Toggles */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={toggleFullscreen}
            className="p-2.5 rounded-xl bg-slate-900/85 backdrop-blur-md border border-slate-700/80 hover:bg-slate-800 text-slate-300 hover:text-white transition-all shadow-xl cursor-pointer"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={() => {
              if (document.fullscreenElement) {
                document.exitFullscreen?.().catch(() => {});
              }
              onClose();
            }}
            className="px-3 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 hover:text-white transition-all text-xs font-semibold flex items-center gap-1.5 shadow-xl cursor-pointer"
            title="Exit Presentation Mode (Esc)"
          >
            <X className="w-4 h-4" />
            <span>Exit Presentation</span>
          </button>
        </div>
      </div>

      {/* Center Canvas Viewport */}
      <div className="relative flex-1 w-full h-full flex items-center justify-center overflow-hidden">
        {/* Layer 1: Base Slide Content */}
        <canvas ref={slideCanvasRef} className="absolute inset-0 w-full h-full" />

        {/* Layer 2: Live Annotations Layer */}
        <canvas
          ref={annotationCanvasRef}
          onMouseDown={isDrawingAllowed ? handleMouseDown : undefined}
          onMouseMove={isDrawingAllowed ? handleMouseMove : undefined}
          onMouseUp={isDrawingAllowed ? handleMouseUp : undefined}
          className={`absolute inset-0 w-full h-full ${
            activeTool === 'laser' || !isDrawingAllowed ? 'pointer-events-none' : 'cursor-crosshair'
          }`}
        />

        {/* Layer 3: Laser Pointer Aura */}
        <canvas ref={laserCanvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

        {/* Gesture feedback HUD */}
        {gestureFeedback && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 text-sm font-medium backdrop-blur-md animate-bounce shadow-2xl pointer-events-none z-30">
            {gestureFeedback}
          </div>
        )}

        {/* Left / Right Slide Click Navigators */}
        {currentSlideIndex > 0 && (
          <button
            onClick={goToPrevSlide}
            className="absolute left-6 top-1/2 -translate-y-1/2 p-3.5 rounded-full bg-slate-900/70 hover:bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-white backdrop-blur-md transition-all shadow-2xl hover:scale-110 cursor-pointer z-20"
            title="Previous Slide (Swipe Left / Left Arrow)"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {currentSlideIndex < pages.length - 1 && (
          <button
            onClick={goToNextSlide}
            className="absolute right-6 top-1/2 -translate-y-1/2 p-3.5 rounded-full bg-slate-900/70 hover:bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-white backdrop-blur-md transition-all shadow-2xl hover:scale-110 cursor-pointer z-20"
            title="Next Slide (Swipe Right / Right Arrow)"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Bottom Floating Control Dock */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-slate-900/90 backdrop-blur-xl px-5 py-3 rounded-2xl border border-slate-700/80 shadow-2xl z-30">
        {/* Slide navigation controls */}
        <div className="flex items-center gap-1.5 pr-3 border-r border-slate-700/70">
          <button
            onClick={goToPrevSlide}
            disabled={currentSlideIndex === 0}
            className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
            title="Previous Slide"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono font-medium text-slate-300 px-2 min-w-[70px] text-center">
            {currentSlideIndex + 1} / {pages.length}
          </span>
          <button
            onClick={goToNextSlide}
            disabled={currentSlideIndex === pages.length - 1}
            className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
            title="Next Slide"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Laser Tool */}
        <div className="flex items-center gap-1.5 px-2 border-r border-slate-700/70">
          <button
            onClick={() => setActiveTool('laser')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTool === 'laser'
                ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30 font-semibold'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
            title="Laser Pointer (Follows hand or mouse pointer with glowing beam)"
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Laser</span>
          </button>

          {isDrawingAllowed ? (
            <>
              <button
                onClick={() => setActiveTool('pen')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTool === 'pen'
                    ? 'bg-cyan-500 text-slate-950 font-semibold shadow-lg shadow-cyan-500/30'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
                title="Handwritten Pen Annotation"
              >
                <PenTool className="w-3.5 h-3.5" />
                <span>Pen</span>
              </button>

              <button
                onClick={() => setActiveTool('highlighter')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTool === 'highlighter'
                    ? 'bg-amber-400 text-slate-950 font-semibold shadow-lg shadow-amber-400/30'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
                title="Highlighter Annotation"
              >
                <Highlighter className="w-3.5 h-3.5" />
                <span>Highlight</span>
              </button>
            </>
          ) : (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-mono">
              <Lock className="w-3 h-3 text-amber-400" />
              <span>View-Only Mode</span>
            </div>
          )}
        </div>

        {/* Color picker for annotations (when drawing enabled) */}
        {isDrawingAllowed && activeTool !== 'laser' && (
          <div className="flex items-center gap-1.5 px-2 border-r border-slate-700/70">
            {['#EF4444', '#F59E0B', '#10B981', '#38BDF8', '#FFFFFF'].map((c) => (
              <button
                key={c}
                onClick={() => setAnnotationColor(c)}
                className={`w-5 h-5 rounded-full border transition-all cursor-pointer ${
                  annotationColor === c ? 'scale-125 border-white ring-2 ring-white/40' : 'border-slate-600'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        )}

        {/* Clear & Undo annotations controls */}
        {isDrawingAllowed && (
          <div className="flex items-center gap-1 pr-2 border-r border-slate-700/70">
            <button
              onClick={handleUndoAnnotation}
              disabled={currentAnnotations.length === 0}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
              title="Undo Last Ink Stroke"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleClearAnnotations}
              disabled={currentAnnotations.length === 0}
              className="p-2 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
              title="Clear All Ink Annotations on this Slide"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Air Gesture Indicator */}
        <div className="hidden md:flex items-center gap-2 pl-1 text-[11px] text-slate-400 font-mono">
          <span>Air Gestures:</span>
          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700">
            Swipe 👈/👉 Slide
          </span>
          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-rose-300 border border-slate-700">
            Point/Laser
          </span>
        </div>
      </div>
    </div>
  );
};
