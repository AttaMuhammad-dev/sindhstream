import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  DrawingTool,
  DrawingStroke,
  Project,
  UserSettings,
  HandTrackingState,
  WhiteboardPage,
  BackgroundStyle,
} from '../../types';
import { drawStrokeOnCanvas, exportStrokesToSvg, exportWhiteboardToPdf } from '../../utils/canvasRenderer';
import { getStrokeBoundingBox } from '../../utils/coordinateTransforms';
import { handTracker } from '../../services/handTrackingService';
import { recognizeHandwritingFromCanvas } from '../../services/aiEducationalService';
import { WhiteboardCanvas } from './WhiteboardCanvas';
import { WebcamHUD } from './WebcamHUD';
import { AIAssistantDrawer } from './AIAssistantDrawer';
import { GestureCalibrationModal } from './GestureCalibrationModal';
import { ClearConfirmModal } from './ClearConfirmModal';
import { PresentationOverlay } from './PresentationOverlay';
import {
  MousePointer,
  Hand as HandIcon,
  Pen,
  Highlighter,
  Eraser,
  Minus,
  ArrowRight,
  Square,
  Circle,
  Triangle,
  Type,
  Flame,
  Sparkles,
  Tv,
  Undo2,
  Redo2,
  Trash2,
  Download,
  ChevronLeft,
  ChevronRight,
  Plus,
  FileCode,
  FileText,
  Check,
  Maximize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Wand2,
} from 'lucide-react';

interface WhiteboardWorkspaceProps {
  project: Project;
  onSaveProject: (project: Project) => void;
  settings: UserSettings;
  onUpdateSettings: (settings: UserSettings) => void;
  trackingState: HandTrackingState;
  onToggleCamera: () => void;
  onOpenCalibration: () => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

const COLOR_PALETTE = [
  { name: 'Electric Cyan', hex: '#38BDF8' },
  { name: 'Cobalt Blue', hex: '#3B82F6' },
  { name: 'Chalk White', hex: '#FFFFFF' },
  { name: 'Neon Amber', hex: '#F59E0B' },
  { name: 'Emerald', hex: '#10B981' },
  { name: 'Coral Red', hex: '#EF4444' },
  { name: 'Laser Violet', hex: '#A855F7' },
];

export const WhiteboardWorkspace: React.FC<WhiteboardWorkspaceProps> = ({
  project,
  onSaveProject,
  settings,
  onUpdateSettings,
  trackingState,
  onToggleCamera,
  onOpenCalibration,
  videoRef,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Active page
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const pages = project.pages || [{ id: 'p1', title: 'Page 1', strokes: [], background: 'ruled' }];
  const activePage = pages[currentPageIndex] || pages[0];

  // Tool states
  const [selectedTool, setSelectedTool] = useState<DrawingTool>('pen');
  const lastInkToolRef = useRef<DrawingTool>('pen');
  const [selectedColor, setSelectedColor] = useState('#38BDF8');
  const [brushSize, setBrushSize] = useState(4);
  const [autoShapeRecognition, setAutoShapeRecognition] = useState(true);

  // Selection & Object Manipulation
  const [selectedStrokeId, setSelectedStrokeId] = useState<string | null>(null);

  // Undo / Redo history
  const [undoStack, setUndoStack] = useState<DrawingStroke[][]>([]);
  const [redoStack, setRedoStack] = useState<DrawingStroke[][]>([]);

  // Viewport Zoom & Pan
  const [zoom, setZoom] = useState(1.0);
  const zoomRef = useRef(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // Modals & UI States
  const [isVirtualMode, setIsVirtualMode] = useState(false);
  const [isCalibrationOpen, setIsCalibrationOpen] = useState(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [isAIDrawerOpen, setIsAIDrawerOpen] = useState(false);
  const [isPresentationOpen, setIsPresentationOpen] = useState(false);
  const [saveToast, setSaveToast] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [gestureFeedback, setGestureFeedback] = useState<string | null>(null);
  const [smartInkStatus, setSmartInkStatus] = useState<string | null>(null);
  const handledSmartInkIdsRef = useRef(new Set<string>());
  const activePageIdRef = useRef(activePage.id);
  const activeStrokesRef = useRef(activePage.strokes);
  activePageIdRef.current = activePage.id;
  activeStrokesRef.current = activePage.strokes;
  const gestureFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isToolbarCollapsed, setIsToolbarCollapsed] = useState(false);

  // Canvas Dimensions
  const [dimensions, setDimensions] = useState({ width: 1400, height: 850 });

  // Update canvas sizing on window resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        const width = Math.max(800, clientWidth);
        const height = Math.max(600, clientHeight);
        setDimensions({ width, height });
        handTracker.updateCanvasDimensions(width, height);
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    const observer = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(updateSize);
    if (containerRef.current) observer?.observe(containerRef.current);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, []);

  // Update Viewport transform handler
  const handleUpdateTransform = useCallback((newPan: { x: number; y: number }, newZoom: number) => {
    zoomRef.current = newZoom;
    setPan(newPan);
    setZoom(newZoom);
  }, []);

  // Zoom around the center of the current view so the board stays predictable.
  const applyZoomFactor = useCallback((factor: number) => {
    const currentZoom = zoomRef.current;
    const nextZoom = Math.max(0.25, Math.min(4, +(currentZoom * factor).toFixed(3)));
    const scale = nextZoom / currentZoom;
    zoomRef.current = nextZoom;
    setZoom(nextZoom);
    setPan((currentPan) => ({
      x: dimensions.width / 2 - (dimensions.width / 2 - currentPan.x) * scale,
      y: dimensions.height / 2 - (dimensions.height / 2 - currentPan.y) * scale,
    }));
  }, [dimensions.height, dimensions.width]);

  const handleZoomIn = useCallback(() => applyZoomFactor(1.2), [applyZoomFactor]);
  const handleZoomOut = useCallback(() => applyZoomFactor(1 / 1.2), [applyZoomFactor]);

  const showGestureFeedback = useCallback((message: string) => {
    setGestureFeedback(message);
    if (gestureFeedbackTimerRef.current) clearTimeout(gestureFeedbackTimerRef.current);
    gestureFeedbackTimerRef.current = setTimeout(() => setGestureFeedback(null), 1800);
  }, []);

  useEffect(() => () => {
    if (gestureFeedbackTimerRef.current) clearTimeout(gestureFeedbackTimerRef.current);
  }, []);

  const handleResetZoom = () => {
    zoomRef.current = 1;
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  };

  // Undo / Redo
  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setRedoStack((prev) => [...prev, activePage.strokes]);
    setUndoStack((prev) => prev.slice(0, prev.length - 1));
    setSelectedStrokeId(null);

    const updatedPages = pages.map((page, idx) =>
      idx === currentPageIndex ? { ...page, strokes: previous } : page
    );
    onSaveProject({ ...project, pages: updatedPages });
  }, [undoStack, activePage, pages, currentPageIndex, project, onSaveProject]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((prev) => [...prev, activePage.strokes]);
    setRedoStack((prev) => prev.slice(0, prev.length - 1));
    setSelectedStrokeId(null);

    const updatedPages = pages.map((page, idx) =>
      idx === currentPageIndex ? { ...page, strokes: next } : page
    );
    onSaveProject({ ...project, pages: updatedPages });
  }, [redoStack, activePage, pages, currentPageIndex, project, onSaveProject]);

  // Gesture actions are edge-triggered: a held fist or palm cannot repeat a
  // destructive/page action every frame. Continuous actions stay in the engine.
  const lastActionKeyRef = useRef('none');
  const lastGestureActionTimeRef = useRef(Number.NEGATIVE_INFINITY);

  useEffect(() => {
    const gesture = trackingState.gesture;
    const action = handTracker.engine.resolveAction(gesture, settings.gestureBindings);
    if (gesture === 'none') {
      lastActionKeyRef.current = 'none';
      return;
    }

    if (
      action === 'draw' ||
      action === 'aim_hover' ||
      action === 'pause' ||
      action === 'pan' ||
      action === 'laser_presentation' ||
      (action === 'zoom' && gesture === 'two_hand_zoom')
    ) {
      lastActionKeyRef.current = 'none';
      return;
    }

    const actionKey = `${gesture}:${action}`;
    if (action === 'none' || actionKey === lastActionKeyRef.current) return;

    // Keep a discrete gesture stable for three camera frames. This must be a
    // timer: the gesture string often stays identical between frames, so a
    // frame-count check inside this effect would never reach its threshold.
    const cooldown = settings.gestureBindings?.cooldownMs ?? 350;
    const elapsedSinceAction = performance.now() - lastGestureActionTimeRef.current;
    const actionDelay = Math.max(130, cooldown - elapsedSinceAction);
    const actionTimer = setTimeout(() => {
      if (actionKey === lastActionKeyRef.current) return;
      const now = performance.now();
      lastGestureActionTimeRef.current = now;
      lastActionKeyRef.current = actionKey;

      if (action === 'undo') {
        handleUndo();
        showGestureFeedback(`Gesture: ${gesture.toUpperCase()} · Undo`);
      } else if (action === 'redo') {
        handleRedo();
        showGestureFeedback(`Gesture: ${gesture.toUpperCase()} · Redo`);
      } else if (action === 'erase_select') {
        if (selectedTool === 'eraser') {
          const restoredTool = lastInkToolRef.current === 'highlighter' ? 'highlighter' : 'pen';
          setSelectedTool(restoredTool);
          showGestureFeedback(`V-sign · ${restoredTool === 'highlighter' ? 'Marker' : 'Pen'} selected`);
        } else {
          if (selectedTool === 'pen' || selectedTool === 'highlighter') lastInkToolRef.current = selectedTool;
          setSelectedTool('eraser');
          showGestureFeedback('V-sign · Eraser selected');
        }
      } else if (action === 'ai_solve') {
        setIsAIDrawerOpen(true);
        showGestureFeedback(`Gesture: ${gesture.toUpperCase()} · AI solver`);
      } else if (action === 'clear_board') {
        setIsClearModalOpen(true);
        showGestureFeedback(`Gesture: ${gesture.toUpperCase()} · Confirm clear`);
      } else if (action === 'prev_page') {
        setCurrentPageIndex((prev) => {
          const next = Math.max(0, prev - 1);
          showGestureFeedback(`Previous page · ${next + 1} of ${pages.length}`);
          return next;
        });
      } else if (action === 'next_page') {
        setCurrentPageIndex((prev) => {
          const next = Math.min(pages.length - 1, prev + 1);
          showGestureFeedback(`Next page · ${next + 1} of ${pages.length}`);
          return next;
        });
      } else if (action === 'zoom_in' || action === 'zoom') {
        handleZoomIn();
        showGestureFeedback(`Gesture: ${gesture.toUpperCase()} · Zoom in`);
      } else if (action === 'zoom_out') {
        handleZoomOut();
        showGestureFeedback(`Gesture: ${gesture.toUpperCase()} · Zoom out`);
      } else if (action === 'next_color') {
        const currentIndex = COLOR_PALETTE.findIndex((color) => color.hex.toLowerCase() === selectedColor.toLowerCase());
        const nextColor = COLOR_PALETTE[(currentIndex + 1 + COLOR_PALETTE.length) % COLOR_PALETTE.length];
        setSelectedColor(nextColor.hex);
        showGestureFeedback(`Pinky · ${nextColor.name}`);
      }
    }, actionDelay);

    return () => clearTimeout(actionTimer);
  }, [
    trackingState.gesture,
    settings.gestureBindings,
    pages.length,
    handleUndo,
    handleRedo,
    handleZoomIn,
    handleZoomOut,
    showGestureFeedback,
    selectedTool,
    selectedColor,
  ]);

  // Two-hand zoom is a continuous action; scale in proportion to frame-to-frame
  // hand separation changes and keep the view centered while it moves.
  const twoHandAction = handTracker.engine.resolveAction('two_hand_zoom', settings.gestureBindings);
  useEffect(() => {
    const delta = trackingState.zoomScaleDelta ?? 0;
    if (trackingState.gesture !== 'two_hand_zoom' || twoHandAction !== 'zoom' || delta === 0) return;
    const sensitivity = settings.gestureBindings?.twoHandZoomSensitivity ?? 0.008;
    const boundedDelta = Math.max(-0.06, Math.min(0.06, delta));
    applyZoomFactor(Math.exp(boundedDelta * 2.4 * sensitivity / 0.008));
  }, [trackingState.gesture, trackingState.zoomScaleDelta, twoHandAction, settings.gestureBindings?.twoHandZoomSensitivity, applyZoomFactor]);

  // Stroke commit helper
  const handleCommitStroke = useCallback(
    (stroke: DrawingStroke) => {
      setUndoStack((prev) => [...prev, activePage.strokes]);
      setRedoStack([]);

      const newStrokes = [...activePage.strokes, stroke];
      const updatedPages = pages.map((page, idx) =>
        idx === currentPageIndex ? { ...page, strokes: newStrokes } : page
      );

      onSaveProject({
        ...project,
        pages: updatedPages,
      });
    },
    [activePage, pages, currentPageIndex, project, onSaveProject]
  );

  // Convert a just-finished ink group into editable text after a brief pause.
  // The source ink remains on the board, so a low-confidence guess never
  // replaces the student's original work.
  useEffect(() => {
    if (settings.smartHandwriting === false || trackingState.isPenDown || trackingState.interactionState === 'WRITING') return;

    const now = Date.now();
    const candidates = activePage.strokes.filter((stroke) =>
      now - stroke.createdAt <= 6500 &&
      !handledSmartInkIdsRef.current.has(stroke.id) &&
      ['pen', 'highlighter'].includes(stroke.tool)
    ).sort((a, b) => a.createdAt - b.createdAt);
    // Only recognize the latest phrase. Including every recent doodle from
    // the last several seconds makes the model see overlapping scribbles.
    let phraseStart = Math.max(0, candidates.length - 1);
    for (let i = candidates.length - 1; i > 0; i--) {
      if (candidates[i].createdAt - candidates[i - 1].createdAt > 2600) break;
      phraseStart = i - 1;
    }
    const recentInk = candidates.slice(phraseStart);
    if (recentInk.length === 0) return;

    let cancelled = false;
    const pageId = activePage.id;
    const capturedIds = recentInk.map((stroke) => stroke.id);
    const timeoutId = setTimeout(async () => {
      capturedIds.forEach((id) => handledSmartInkIdsRef.current.add(id));

      const bounds = recentInk.map(getStrokeBoundingBox);
      const minX = Math.min(...bounds.map((box) => box.minX));
      const minY = Math.min(...bounds.map((box) => box.minY));
      const maxX = Math.max(...bounds.map((box) => box.maxX));
      const maxY = Math.max(...bounds.map((box) => box.maxY));
      const padding = 24;
      const scale = Math.min(1, 1400 / Math.max(1, maxX - minX), 500 / Math.max(1, maxY - minY));
      const snapshot = document.createElement('canvas');
      snapshot.width = Math.max(120, Math.ceil((maxX - minX + padding * 2) * scale));
      snapshot.height = Math.max(96, Math.ceil((maxY - minY + padding * 2) * scale));
      const context = snapshot.getContext('2d');
      if (!context) return;

      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, snapshot.width, snapshot.height);
      context.save();
      context.scale(scale, scale);
      context.translate(padding - minX, padding - minY);
      for (const stroke of recentInk) {
        drawStrokeOnCanvas(context, {
          ...stroke,
          color: '#111827',
          opacity: 1,
          points: stroke.points.map((point) => ({ ...point })),
        });
      }
      context.restore();
      setSmartInkStatus('Reading handwriting…');

      try {
        const result = await recognizeHandwritingFromCanvas(snapshot, project.subject);
        if (cancelled || activePageIdRef.current !== pageId) return;
        if (!capturedIds.every((id) => activeStrokesRef.current.some((stroke) => stroke.id === id))) return;

        const text = result.transcription?.trim();
        if (!result.success || result.isSimulated || !text || /unable to detect|no readable writing/i.test(text)) {
          setSmartInkStatus('Gemini could not read clear text from that stroke. Your original ink is safe.');
          showGestureFeedback('Smart Ink could not read clear text; original ink kept');
          return;
        }

        const fontSize = 24;
        const baseline = maxY + fontSize + 12 > dimensions.height - 12
          ? Math.max(fontSize + 6, minY - 10)
          : maxY + fontSize + 12;
        handleCommitStroke({
          id: `smart_text_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          tool: 'text',
          color: selectedColor,
          size: fontSize,
          fontSize,
          opacity: 1,
          text,
          points: [{ x: Math.max(12, minX), y: baseline }],
          createdAt: Date.now(),
        });
        const confidence = Math.round(Math.max(0, Math.min(1, result.confidence)) * 100);
        const needsReview = result.needsConfirmation || confidence < 88;
        setSmartInkStatus(needsReview
          ? `AI text added (${confidence}% confidence) · review it; original ink kept`
          : 'Editable text added · original ink kept');
        showGestureFeedback(needsReview ? `Smart Ink · text added for review (${confidence}%)` : 'Smart Ink · text recognized');
      } catch (error) {
        if (cancelled || activePageIdRef.current !== pageId) return;
        const message = error instanceof Error ? error.message : 'AI handwriting recognition failed.';
        const statusCode = message.match(/\b(401|403|404|413|429|500|502|503|504)\b/)?.[1];
        const usefulMessage = message.slice(0, 180);
        setSmartInkStatus(message.includes('GEMINI_API_KEY')
          ? 'Gemini key is missing on this deployment. Redeploy after adding GEMINI_API_KEY.'
          : statusCode === '413'
          ? 'Gemini request image was too large. Original ink is safe.'
          : statusCode === '401' || statusCode === '403'
          ? 'Gemini rejected the API key or its permissions. Check the key in Vercel.'
          : statusCode === '429'
          ? 'Gemini quota or rate limit reached. Wait briefly and try again.'
          : `Gemini error: ${usefulMessage}. Original ink is safe.`);
        showGestureFeedback('Smart Ink could not read this phrase; original ink kept');
      }
    }, 1800);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [
    activePage.id,
    activePage.strokes,
    dimensions.height,
    handleCommitStroke,
    project.subject,
    settings.smartHandwriting,
    showGestureFeedback,
    selectedColor,
    trackingState.interactionState,
    trackingState.isPenDown,
  ]);

  // Stroke update helper (for moving selected objects)
  const handleUpdateStroke = useCallback(
    (updatedStroke: DrawingStroke) => {
      const newStrokes = activePage.strokes.map((s) =>
        s.id === updatedStroke.id ? updatedStroke : s
      );
      const updatedPages = pages.map((page, idx) =>
        idx === currentPageIndex ? { ...page, strokes: newStrokes } : page
      );
      onSaveProject({
        ...project,
        pages: updatedPages,
      });
    },
    [activePage, pages, currentPageIndex, project, onSaveProject]
  );

  // Delete selected stroke
  const handleDeleteSelected = useCallback(() => {
    if (!selectedStrokeId) return;
    setUndoStack((prev) => [...prev, activePage.strokes]);
    setRedoStack([]);

    const newStrokes = activePage.strokes.filter((s) => s.id !== selectedStrokeId);
    setSelectedStrokeId(null);

    const updatedPages = pages.map((page, idx) =>
      idx === currentPageIndex ? { ...page, strokes: newStrokes } : page
    );
    onSaveProject({ ...project, pages: updatedPages });
  }, [selectedStrokeId, activePage, pages, currentPageIndex, project, onSaveProject]);

  // Clear current page
  const handleClearConfirmed = () => {
    if (activePage.strokes.length === 0) return;
    setUndoStack((prev) => [...prev, activePage.strokes]);
    setRedoStack([]);
    setSelectedStrokeId(null);

    const updatedPages = pages.map((page, idx) =>
      idx === currentPageIndex ? { ...page, strokes: [] } : page
    );
    onSaveProject({ ...project, pages: updatedPages });
  };

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input or textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      // Ctrl/Cmd + Z: Undo
      if (cmdOrCtrl && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        handleUndo();
        return;
      }

      // Ctrl/Cmd + Shift + Z or Ctrl + Y: Redo
      if (
        (cmdOrCtrl && e.shiftKey && (e.key === 'z' || e.key === 'Z')) ||
        (cmdOrCtrl && (e.key === 'y' || e.key === 'Y'))
      ) {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Ctrl/Cmd + S: Save
      if (cmdOrCtrl && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        handleSaveNow();
        return;
      }

      // Delete or Backspace: Remove selected object
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedStrokeId) {
          e.preventDefault();
          handleDeleteSelected();
        }
        return;
      }

      // Escape: Deselect or exit interaction
      if (e.key === 'Escape') {
        setSelectedStrokeId(null);
        setIsClearModalOpen(false);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, handleDeleteSelected, selectedStrokeId]);

  // Page management
  const handleAddPage = () => {
    const newPage: WhiteboardPage = {
      id: `p_${Date.now()}`,
      title: `Page ${pages.length + 1}`,
      background: activePage.background || 'ruled',
      strokes: [],
    };
    const updatedPages = [...pages, newPage];
    onSaveProject({ ...project, pages: updatedPages });
    setCurrentPageIndex(updatedPages.length - 1);
  };

  const handleDeletePage = () => {
    if (pages.length <= 1) return;
    const updatedPages = pages.filter((_, idx) => idx !== currentPageIndex);
    const nextIdx = Math.max(0, currentPageIndex - 1);
    onSaveProject({ ...project, pages: updatedPages });
    setCurrentPageIndex(nextIdx);
  };

  // Background style change
  const handleChangeBackground = (bg: BackgroundStyle) => {
    const updatedPages = pages.map((p, idx) =>
      idx === currentPageIndex ? { ...p, background: bg } : p
    );
    onSaveProject({ ...project, pages: updatedPages });
  };

  // Export handlers
  const handleExportPng = () => {
    const canvasStage = containerRef.current;
    const backgroundCanvas = canvasStage?.querySelector<HTMLCanvasElement>('[data-testid="whiteboard-canvas-background"]');
    const baseCanvas = canvasStage?.querySelector<HTMLCanvasElement>('[data-testid="whiteboard-canvas-base"]');
    const overlayCanvas = canvasStage?.querySelector<HTMLCanvasElement>('[data-testid="whiteboard-canvas"]');
    if (!backgroundCanvas || !baseCanvas || !overlayCanvas) return;
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = baseCanvas.width;
    exportCanvas.height = baseCanvas.height;
    const exportContext = exportCanvas.getContext('2d');
    if (!exportContext) return;
    exportContext.drawImage(backgroundCanvas, 0, 0);
    exportContext.drawImage(baseCanvas, 0, 0);
    exportContext.drawImage(overlayCanvas, 0, 0);
    const url = exportCanvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.title.replace(/\s+/g, '_')}_page${currentPageIndex + 1}.png`;
    a.click();
  };

  const handleExportPdf = async () => {
    try {
      setIsExportingPdf(true);
      await exportWhiteboardToPdf(pages, project.title, dimensions.width, dimensions.height);
    } catch (err) {
      console.error('PDF export error:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExportSvg = () => {
    const svgStr = exportStrokesToSvg(activePage.strokes, dimensions.width, dimensions.height);
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.title.replace(/\s+/g, '_')}_page${currentPageIndex + 1}.svg`;
    a.click();
  };

  const handleSaveNow = () => {
    onSaveProject(project);
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2000);
  };

  // State mode styling
  const stateColors: Record<HandTrackingState['interactionState'], string> = {
    IDLE: 'bg-slate-800 text-slate-300 border-slate-700',
    TRACKING: 'bg-blue-950/80 text-cyan-300 border-cyan-700/80',
    WRITING: 'bg-cyan-950 text-cyan-200 border-cyan-500 font-bold animate-pulse',
    SELECTING: 'bg-purple-950 text-purple-200 border-purple-500',
    PAUSED: 'bg-amber-950 text-amber-200 border-amber-600',
    PRESENTATION: 'bg-rose-950 text-rose-200 border-rose-500',
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-61px)] relative overflow-hidden bg-[#070B14]">
      {/* Top Workspace Ribbon */}
      <div className="flex items-center justify-between px-6 py-2.5 bg-[#0A101D] border-b border-slate-800/80 z-20 text-xs">
        {/* Project Title & Subject */}
        <div className="flex items-center gap-3">
          <span className="font-bold text-white tracking-tight">{project.title}</span>
          <span className="text-slate-500 font-mono">·</span>
          <span className="text-cyan-400 font-medium">{project.subject}</span>
          <span className="text-slate-500 font-mono">·</span>
          <span className="text-slate-400">
            Page {currentPageIndex + 1} of {pages.length}
          </span>
        </div>

        {/* Center: Live Gesture Indicator & Interaction Mode */}
        <div className="flex items-center gap-2">
          {/* Interaction State Badge */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-mono tracking-wide ${
              stateColors[trackingState.interactionState] || stateColors.IDLE
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                trackingState.interactionState === 'WRITING'
                  ? 'bg-cyan-400 animate-ping'
                  : trackingState.interactionState === 'PRESENTATION'
                  ? 'bg-rose-400 animate-pulse'
                  : trackingState.interactionState === 'PAUSED'
                  ? 'bg-amber-400'
                  : 'bg-cyan-400'
              }`}
            />
            <span>MODE: {trackingState.isPanning ? 'PANNING' : trackingState.interactionState}</span>
          </div>

          {/* Gesture Badge */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300">
            <HandIcon className="w-3 h-3 text-cyan-400" />
            <span className="uppercase">{trackingState.gesture}</span>
          </div>

          {trackingState.zoomScaleDelta !== undefined && Math.abs(trackingState.zoomScaleDelta) > 0.005 && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-blue-900/60 border border-cyan-500/50 text-[10px] text-cyan-300 font-mono animate-in fade-in">
              <ZoomIn className="w-3 h-3" />
              <span>ZOOM {trackingState.zoomScaleDelta > 0 ? '+' : '-'}</span>
            </div>
          )}
        </div>

        {/* Right Controls: Save, Export, AI Assistant Trigger */}
        <div className="flex items-center gap-2">
          {saveToast && (
            <span className="flex items-center gap-1 text-[11px] text-cyan-400 bg-cyan-950/60 border border-cyan-800/60 px-2 py-0.5 rounded animate-in fade-in">
              <Check className="w-3 h-3" /> Saved
            </span>
          )}

          <button
            onClick={handleSaveNow}
            className="px-3 py-1.5 text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Save Project (Ctrl+S)"
          >
            Save
          </button>

          {/* Export PNG */}
          <button
            onClick={handleExportPng}
            className="px-2.5 py-1.5 text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
            title="Export as PNG"
            aria-label="Export PNG"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">PNG</span>
          </button>

          {/* Export PDF */}
          <button
            onClick={handleExportPdf}
            disabled={isExportingPdf}
            className="px-2.5 py-1.5 text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-40"
            title="Export Multi-page Notes as PDF"
            aria-label="Export PDF"
          >
            <FileText className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden sm:inline">{isExportingPdf ? 'Exporting...' : 'PDF'}</span>
          </button>

          {/* Export SVG */}
          <button
            onClick={handleExportSvg}
            className="px-2.5 py-1.5 text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
            title="Export as SVG"
            aria-label="Export SVG"
          >
            <FileCode className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">SVG</span>
          </button>

          {/* Fullscreen Presentation Mode Button */}
          <button
            onClick={() => setIsPresentationOpen(true)}
            className="px-3 py-1.5 font-medium text-rose-300 hover:text-white bg-rose-950/50 hover:bg-rose-900/60 border border-rose-700/60 rounded-lg transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
            title="Start Fullscreen Presentation with Gestures & Laser Pointer"
          >
            <Tv className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden sm:inline">Present</span>
          </button>

          <button
            onClick={() => setIsAIDrawerOpen(true)}
            className="px-3 py-1.5 font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 rounded-lg transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Tutor & Solver</span>
          </button>
        </div>
      </div>

      {/* Workspace Body: Tools Palette on Left + Layered Canvas Stage */}
      <div className="flex-1 flex relative overflow-hidden" ref={containerRef}>
        {/* Floating Tool Palette on Left (Collapsible) */}
        <div
          className={`absolute top-4 left-4 z-30 transition-all duration-200 bg-[#0B1222]/95 backdrop-blur-md border border-slate-800 rounded-xl shadow-2xl max-h-[calc(100vh-8.5rem)] overflow-y-auto scrollbar-thin ${
            isToolbarCollapsed ? 'p-1.5' : 'p-2 flex flex-col gap-2'
          }`}
        >
          {/* Header Toggle */}
          <div className="flex items-center justify-between pb-1">
            {!isToolbarCollapsed && (
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 px-1">Tools</span>
            )}
            <button
              onClick={() => setIsToolbarCollapsed(!isToolbarCollapsed)}
              className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800/80 cursor-pointer"
              title={isToolbarCollapsed ? 'Expand Toolbar' : 'Collapse Toolbar'}
              aria-label={isToolbarCollapsed ? 'Expand Toolbar' : 'Collapse Toolbar'}
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {!isToolbarCollapsed && (
            <>
              {/* Primary Drawing & Selection Tools */}
              <div className="flex flex-col gap-1 pb-2 border-b border-slate-800">
                {[
                  { id: 'select', icon: MousePointer, label: 'Select / Move (Click or drag)' },
                  { id: 'pan', icon: HandIcon, label: 'Pan Canvas (Space + drag)' },
                  { id: 'pen', icon: Pen, label: 'Pen' },
                  { id: 'highlighter', icon: Highlighter, label: 'Highlighter' },
                  { id: 'eraser', icon: Eraser, label: 'Eraser' },
                  { id: 'text', icon: Type, label: 'Text Note (Click canvas)' },
                  { id: 'line', icon: Minus, label: 'Straight Line' },
                  { id: 'arrow', icon: ArrowRight, label: 'Vector Arrow' },
                  { id: 'rect', icon: Square, label: 'Rectangle' },
                  { id: 'circle', icon: Circle, label: 'Circle' },
                  { id: 'triangle', icon: Triangle, label: 'Triangle' },
                  { id: 'ellipse', icon: Circle, label: 'Ellipse' },
                  { id: 'diamond', icon: Square, label: 'Diamond' },
                  { id: 'pentagon', icon: Square, label: 'Pentagon' },
                  { id: 'hexagon', icon: Square, label: 'Hexagon' },
                  { id: 'star', icon: Sparkles, label: 'Star' },
                  { id: 'trapezoid', icon: Square, label: 'Trapezoid' },
                  { id: 'parallelogram', icon: Square, label: 'Parallelogram' },
                  { id: 'laser', icon: Flame, label: 'Laser Pointer' },
                ].map((tool) => {
                  const Icon = tool.icon;
                  const isSelected = selectedTool === tool.id;
                  return (
                    <button
                      key={tool.id}
                      onClick={() => {
                        setSelectedTool(tool.id as DrawingTool);
                        if (tool.id === 'pen' || tool.id === 'highlighter') {
                          lastInkToolRef.current = tool.id as DrawingTool;
                        }
                        if (tool.id !== 'select') {
                          setSelectedStrokeId(null);
                        }
                      }}
                      className={`p-2 rounded-lg transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                      }`}
                      title={tool.label}
                      aria-label={tool.label}
                    >
                      <Icon className="w-4 h-4" />
                    </button>
                  );
                })}
              </div>

              {/* Auto-Shape Snapping Toggle */}
              <div className="flex flex-col items-center py-1 border-b border-slate-800">
                <button
                  onClick={() => setAutoShapeRecognition(!autoShapeRecognition)}
                  className={`p-1.5 rounded-lg text-[10px] font-mono flex items-center gap-1 transition-colors cursor-pointer ${
                    autoShapeRecognition
                      ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-700/80'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                  title="Auto-fit freehand lines, circles, ellipses, triangles, rectangles, diamonds, parallelograms, trapezoids, pentagons, hexagons and stars"
                  aria-pressed={autoShapeRecognition}
                >
                  <Wand2 className="w-3 h-3 text-cyan-400" />
                  <span className="text-[9px]">Shapes</span>
                </button>
              </div>

              {/* Color Palette Swatches */}
              <div className="flex flex-col gap-1.5 items-center py-2 border-b border-slate-800">
                {COLOR_PALETTE.map((c) => (
                  <button
                    key={c.hex}
                    onClick={() => setSelectedColor(c.hex)}
                    className={`w-5 h-5 rounded-full transition-all cursor-pointer ${
                      selectedColor === c.hex
                        ? 'ring-2 ring-cyan-400 ring-offset-2 ring-offset-slate-900 scale-110'
                        : 'opacity-70 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: c.hex }}
                    title={c.name}
                    aria-label={c.name}
                  />
                ))}
              </div>

              {/* Stroke Width Selector */}
              <div className="flex flex-col items-center gap-1 py-1">
                <span className="text-[10px] text-slate-500 font-mono">{brushSize}px</span>
                <input
                  type="range"
                  min="2"
                  max="28"
                  step="2"
                  value={brushSize}
                  onChange={(e) => setBrushSize(parseInt(e.target.value, 10))}
                  className="w-16 accent-cyan-400 rotate-[-90deg] my-6 cursor-pointer"
                  title={`Stroke width: ${brushSize}px`}
                  aria-label="Stroke width"
                />
              </div>

              {/* Undo, Redo, Delete Selected, Clear */}
              <div className="flex flex-col gap-1 pt-2 border-t border-slate-800">
                <button
                  onClick={handleUndo}
                  disabled={undoStack.length === 0}
                  className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-30 cursor-pointer"
                  title="Undo (Ctrl+Z)"
                  aria-label="Undo"
                >
                  <Undo2 className="w-4 h-4" />
                </button>
                <button
                  onClick={handleRedo}
                  disabled={redoStack.length === 0}
                  className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-30 cursor-pointer"
                  title="Redo (Ctrl+Y or Ctrl+Shift+Z)"
                  aria-label="Redo"
                >
                  <Redo2 className="w-4 h-4" />
                </button>

                {selectedStrokeId && (
                  <button
                    onClick={handleDeleteSelected}
                    className="p-2 rounded-lg text-amber-400 hover:bg-amber-950/40 cursor-pointer"
                    title="Delete Selected Object (Delete/Backspace)"
                    aria-label="Delete Selected Object"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}

                <button
                  onClick={() => setIsClearModalOpen(true)}
                  className="p-2 rounded-lg text-rose-400/80 hover:text-rose-400 hover:bg-rose-950/40 cursor-pointer"
                  title="Clear Page Canvas"
                  aria-label="Clear Canvas"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>

        {/* Live Gesture Toast Overlay */}
        {gestureFeedback && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 px-4 py-2 bg-blue-950/90 text-cyan-200 border border-cyan-500/60 rounded-full shadow-2xl backdrop-blur-md text-xs font-mono font-medium flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
            <HandIcon className="w-4 h-4 text-cyan-400" />
            <span>{gestureFeedback}</span>
          </div>
        )}

        {smartInkStatus && (
          <div
            role="status"
            aria-live="polite"
            className="absolute top-14 left-1/2 -translate-x-1/2 z-40 max-w-[min(92vw,36rem)] px-3 py-2 bg-slate-950/95 text-slate-200 border border-slate-700 rounded-xl shadow-xl text-xs flex items-center gap-3"
          >
            <span>{smartInkStatus}</span>
            <button
              type="button"
              onClick={() => setSmartInkStatus(null)}
              className="text-slate-400 hover:text-white"
              aria-label="Dismiss Smart Ink status"
            >
              ×
            </button>
          </div>
        )}

        {/* Presentation State Alert Banner */}
        {trackingState.interactionState === 'PRESENTATION' && (
          <div className="absolute top-4 right-1/4 z-40 px-3.5 py-1.5 bg-rose-950/90 text-rose-200 border border-rose-500/80 rounded-full shadow-2xl backdrop-blur-md text-xs font-mono flex items-center gap-2 animate-pulse">
            <Flame className="w-3.5 h-3.5 text-rose-400" />
            <span>Presentation Laser Active</span>
          </div>
        )}

        {/* Layered High-Performance Canvas Stage */}
        <WhiteboardCanvas
          page={activePage}
          selectedTool={selectedTool}
          selectedColor={selectedColor}
          brushSize={brushSize}
          trackingState={trackingState}
          onCommitStroke={handleCommitStroke}
          onUpdateStroke={handleUpdateStroke}
          selectedStrokeId={selectedStrokeId}
          onSelectStroke={setSelectedStrokeId}
          width={dimensions.width}
          height={dimensions.height}
          isVirtualMode={isVirtualMode}
          zoom={zoom}
          pan={pan}
          onUpdateTransform={handleUpdateTransform}
          autoShapeRecognition={autoShapeRecognition}
        />

        {/* Bottom Page Navigation Bar & Background choice */}
        <div className="absolute bottom-4 left-2 sm:left-24 z-20 max-w-[calc(100vw-1rem)] sm:max-w-[calc(100vw-22rem)] overflow-x-auto scrollbar-none flex items-center gap-2 sm:gap-3 px-2.5 sm:px-3 py-1.5 bg-[#0B1222]/95 backdrop-blur-md border border-slate-800 rounded-xl shadow-lg text-xs text-slate-300">
          <button
            onClick={() => {
              setSelectedStrokeId(null);
              setCurrentPageIndex((prev) => Math.max(0, prev - 1));
            }}
            disabled={currentPageIndex === 0}
            className="p-1 rounded hover:bg-slate-800 disabled:opacity-30 cursor-pointer"
            aria-label="Previous Page"
            title="Previous Page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-mono text-slate-200">
            {currentPageIndex + 1} / {pages.length}
          </span>
          <button
            onClick={() => {
              setSelectedStrokeId(null);
              setCurrentPageIndex((prev) => Math.min(pages.length - 1, prev + 1));
            }}
            disabled={currentPageIndex === pages.length - 1}
            className="p-1 rounded hover:bg-slate-800 disabled:opacity-30 cursor-pointer"
            aria-label="Next Page"
            title="Next Page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={handleAddPage}
            className="p-1 rounded hover:bg-slate-800 text-cyan-400 cursor-pointer"
            title="Add Page"
            aria-label="Add Page"
          >
            <Plus className="w-4 h-4" />
          </button>

          {pages.length > 1 && (
            <button
              onClick={handleDeletePage}
              className="p-1 rounded hover:bg-slate-800 text-rose-400 cursor-pointer"
              title="Delete Current Page"
              aria-label="Delete Current Page"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          <span className="text-slate-600">|</span>

          {/* Background choice: blank, grid, ruled paper, dots, blueprint */}
          <div className="flex items-center gap-1 text-[11px]">
            <span className="text-slate-400">Background:</span>
            {(['ruled', 'grid', 'blank', 'dots', 'blueprint'] as const).map((bg) => (
              <button
                key={bg}
                onClick={() => handleChangeBackground(bg)}
                className={`px-2 py-0.5 rounded capitalize cursor-pointer ${
                  activePage.background === bg
                    ? 'bg-blue-600 text-white font-medium shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
                title={`Switch to ${bg} background`}
              >
                {bg === 'ruled' ? 'Ruled Lined' : bg}
              </button>
            ))}
          </div>
          <span className="text-slate-600">|</span>

          {/* Zoom & Viewport Controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleZoomOut}
              className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 cursor-pointer"
              title="Zoom Out (-)"
              aria-label="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>

            <span className="font-mono text-[11px] text-cyan-300 w-11 text-center font-medium">
              {Math.round(zoom * 100)}%
            </span>

            <button
              onClick={handleZoomIn}
              className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 cursor-pointer"
              title="Zoom In (+)"
              aria-label="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={handleResetZoom}
              className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 cursor-pointer"
              title="Reset View (100% and Center)"
              aria-label="Reset View"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Real-Time Webcam HUD in bottom right */}
        <WebcamHUD
          trackingState={trackingState}
          settings={settings}
          videoRef={videoRef}
          onToggleCamera={onToggleCamera}
          onOpenCalibration={() => setIsCalibrationOpen(true)}
          onToggleMirror={() => onUpdateSettings({ ...settings, mirrorWebcam: !settings.mirrorWebcam })}
          isVirtualMode={isVirtualMode}
          onToggleVirtualMode={() => {
            const nextMode = !isVirtualMode;
            setIsVirtualMode(nextMode);
            if (nextMode) {
              handTracker.simulateGesture({ x: 400, y: 300 }, 'pointing', false);
            }
          }}
        />
      </div>

      {/* AI Assistant Drawer */}
      <AIAssistantDrawer
        isOpen={isAIDrawerOpen}
        onClose={() => setIsAIDrawerOpen(false)}
        canvasRef={{ current: containerRef.current?.querySelector<HTMLCanvasElement>('[data-testid="whiteboard-canvas-base"]') || null }}
        currentSubject={project.subject}
        onInsertText={(text: string) => {
          const newStroke: DrawingStroke = {
            id: `text_${Date.now()}`,
            tool: 'text',
            color: selectedColor || '#38BDF8',
            size: 22,
            opacity: 1,
            text,
            points: [{ x: 120, y: 160 }],
            createdAt: Date.now(),
          };
          handleCommitStroke(newStroke);
        }}
      />

      {/* Gesture Calibration & Guide Modal */}
      <GestureCalibrationModal
        isOpen={isCalibrationOpen}
        onClose={() => setIsCalibrationOpen(false)}
        settings={settings}
        onUpdateSettings={onUpdateSettings}
        trackingState={trackingState}
      />

      {/* Clear Page Confirmation Modal */}
      <ClearConfirmModal
        isOpen={isClearModalOpen}
        pageNumber={currentPageIndex + 1}
        strokeCount={activePage.strokes.length}
        onConfirm={handleClearConfirmed}
        onClose={() => setIsClearModalOpen(false)}
      />

      {/* Fullscreen Touchless Presentation Overlay */}
      <PresentationOverlay
        isOpen={isPresentationOpen}
        onClose={() => setIsPresentationOpen(false)}
        pages={pages}
        initialPageIndex={currentPageIndex}
        trackingState={trackingState}
        presentationTitle={project.title}
        onSlideChange={(newIdx) => setCurrentPageIndex(newIdx)}
      />
    </div>
  );
};
