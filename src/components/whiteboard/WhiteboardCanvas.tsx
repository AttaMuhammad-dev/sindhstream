/**
 * High-Performance Layered HTML5 Canvas for AIRWRITE AI
 * Features:
 * - Infinite-feeling viewport with Zoom (0.25x - 4x) & Pan
 * - Stroke & shape drawing (pen, highlighter, eraser, line, arrow, rect, circle)
 * - Freehand automatic shape recognition
 * - Text tool: in-place editable labels in world coordinates
 * - Select tool: hit-testing, visual selection bounding box & live drag-to-move
 * - Ruled lined paper background with left margin (teacher & student notebook)
 * - Seamless Touchless Air Writing mapped through viewport coordinate space
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { DrawingStroke, DrawingTool, Point2D, HandTrackingState, WhiteboardPage } from '../../types';
import {
  setupHighDpiCanvas,
  drawCanvasBackground,
  drawStrokeOnCanvas,
  drawSelectionBox,
} from '../../utils/canvasRenderer';
import {
  screenToWorld,
  worldToScreen,
  isPointInStroke,
  moveStroke,
} from '../../utils/coordinateTransforms';
import { recognizeShape } from '../../utils/shapeRecognition';

interface WhiteboardCanvasProps {
  page: WhiteboardPage;
  selectedTool: DrawingTool;
  selectedColor: string;
  brushSize: number;
  trackingState: HandTrackingState;
  onCommitStroke: (stroke: DrawingStroke) => void;
  onUpdateStroke: (stroke: DrawingStroke) => void;
  selectedStrokeId: string | null;
  onSelectStroke: (id: string | null) => void;
  width: number;
  height: number;
  isVirtualMode: boolean;
  zoom: number;
  pan: { x: number; y: number };
  onUpdateTransform: (pan: { x: number; y: number }, zoom: number) => void;
  autoShapeRecognition?: boolean;
}

export const WhiteboardCanvas: React.FC<WhiteboardCanvasProps> = ({
  page,
  selectedTool,
  selectedColor,
  brushSize,
  trackingState,
  onCommitStroke,
  onUpdateStroke,
  selectedStrokeId,
  onSelectStroke,
  width,
  height,
  isVirtualMode,
  zoom,
  pan,
  onUpdateTransform,
  autoShapeRecognition = true,
}) => {
  // Layer 1: Background canvas (grid / ruled / dots / blueprint)
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  // Layer 2: Base canvas for completed strokes
  const baseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  // Layer 3: Overlay canvas for active strokes, selection bounding boxes, air pointer, laser trails
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Active stroke in progress (stored in world coordinates)
  const currentStrokeRef = useRef<DrawingStroke | null>(null);
  const isPointerDownRef = useRef(false);
  const pointerStartScreenRef = useRef<Point2D>({ x: 0, y: 0 });

  // Panning interaction state
  const isPanningRef = useRef(false);
  const lastPanStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const previousGesturePanPointRef = useRef<Point2D | null>(null);

  // Object dragging state for 'select' tool
  const isDraggingObjectRef = useRef(false);
  const dragStartWorldRef = useRef<Point2D>({ x: 0, y: 0 });
  const draggingStrokeInitialRef = useRef<DrawingStroke | null>(null);

  // Inline text editing state
  const [activeTextInput, setActiveTextInput] = useState<{
    worldX: number;
    worldY: number;
    screenX: number;
    screenY: number;
    value: string;
  } | null>(null);
  const textInputRef = useRef<HTMLTextAreaElement | null>(null);

  // Laser trail points for PRESENTATION mode
  const laserTrailRef = useRef<{ x: number; y: number; time: number }[]>([]);

  // Spacebar tracking for quick panning
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !activeTextInput && (e.target as HTMLElement).tagName !== 'INPUT' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
        setIsSpacePressed(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [activeTextInput]);

  // Focus inline text input when activated
  useEffect(() => {
    if (activeTextInput && textInputRef.current) {
      textInputRef.current.focus();
    }
  }, [activeTextInput]);

  // Redraw Background Canvas when background, size, pan, or zoom changes
  useEffect(() => {
    if (!bgCanvasRef.current) return;
    const canvas = bgCanvasRef.current;
    const setup = setupHighDpiCanvas(canvas, width, height);
    if (!setup) return;

    drawCanvasBackground(setup.ctx, width, height, page.background || 'ruled', pan, zoom);
  }, [page.background, width, height, pan, zoom]);

  // Redraw Base Canvas when strokes, pan, or zoom changes
  useEffect(() => {
    if (!baseCanvasRef.current) return;
    const canvas = baseCanvasRef.current;
    const setup = setupHighDpiCanvas(canvas, width, height);
    if (!setup) return;

    setup.ctx.clearRect(0, 0, width, height);
    setup.ctx.save();
    setup.ctx.translate(pan.x, pan.y);
    setup.ctx.scale(zoom, zoom);

    for (const stroke of page.strokes) {
      drawStrokeOnCanvas(setup.ctx, stroke);
    }

    setup.ctx.restore();
  }, [page.strokes, page.id, width, height, pan, zoom]);

  // Setup overlay canvas resolution
  useEffect(() => {
    if (!overlayCanvasRef.current) return;
    setupHighDpiCanvas(overlayCanvasRef.current, width, height);
    renderOverlay();
  }, [width, height, zoom, pan, selectedStrokeId]);

  // Render Overlay (active stroke, laser trail, selection handles)
  const renderOverlay = useCallback(() => {
    if (!overlayCanvasRef.current) return;
    const ctx = overlayCanvasRef.current.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // 1. Render active in-progress stroke
    if (currentStrokeRef.current && currentStrokeRef.current.points.length > 0) {
      drawStrokeOnCanvas(ctx, currentStrokeRef.current);
      if (currentStrokeRef.current.tool === 'eraser') {
        const latestPoint = currentStrokeRef.current.points[currentStrokeRef.current.points.length - 1];
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = 'rgba(248, 113, 113, 0.95)';
        ctx.lineWidth = 2 / zoom;
        ctx.setLineDash([4 / zoom, 3 / zoom]);
        ctx.beginPath();
        ctx.arc(latestPoint.x, latestPoint.y, Math.max(8, brushSize * 2), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    // 2. Render Selection Bounding Box & Handles
    if (selectedStrokeId) {
      const selected = page.strokes.find((s) => s.id === selectedStrokeId);
      if (selected) {
        drawSelectionBox(ctx, selected);
      }
    }

    ctx.restore();

    // 3. Render Laser Trail in screen coordinates
    if (trackingState.interactionState === 'PRESENTATION') {
      const now = performance.now();
      const trail = laserTrailRef.current.filter((p) => now - p.time <= 500);
      laserTrailRef.current = trail;

      if (trail.length > 1) {
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (let i = 1; i < trail.length; i++) {
          const age = (now - trail[i].time) / 500;
          const alpha = (1 - age) * 0.9;
          ctx.strokeStyle = `rgba(239, 68, 68, ${alpha})`;
          ctx.lineWidth = brushSize * 1.5 * (1 - age);
          ctx.beginPath();
          ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
          ctx.lineTo(trail[i].x, trail[i].y);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
  }, [width, height, pan, zoom, brushSize, selectedStrokeId, page.strokes, trackingState.interactionState]);

  // Commit text input to stroke
  const commitTextInput = () => {
    if (!activeTextInput) return;
    const trimmed = activeTextInput.value.trim();
    if (trimmed.length > 0) {
      const textStroke: DrawingStroke = {
        id: `text_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        tool: 'text',
        color: selectedColor,
        size: brushSize,
        fontSize: Math.max(16, brushSize * 4.5),
        opacity: 1,
        points: [{ x: activeTextInput.worldX, y: activeTextInput.worldY }],
        text: trimmed,
        createdAt: Date.now(),
      };
      onCommitStroke(textStroke);
    }
    setActiveTextInput(null);
  };

  // Mouse Wheel: Smooth Zoom centered on pointer
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const cursorScreenX = e.clientX - rect.left;
    const cursorScreenY = e.clientY - rect.top;

    // Detect trackpad pinch vs wheel
    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
    const newZoom = Math.max(0.25, Math.min(4.0, zoom * zoomFactor));

    // Keep point under cursor invariant:
    // (cursor - pan) / zoom = (cursor - newPan) / newZoom
    // newPan = cursor - (cursor - pan) * (newZoom / zoom)
    const newPanX = cursorScreenX - (cursorScreenX - pan.x) * (newZoom / zoom);
    const newPanY = cursorScreenY - (cursorScreenY - pan.y) * (newZoom / zoom);

    onUpdateTransform({ x: newPanX, y: newPanY }, newZoom);
  };

  // Pointer Down
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    pointerStartScreenRef.current = { x: screenX, y: screenY };
    isPointerDownRef.current = true;

    // Check if middle click or Pan tool or spacebar held -> Start Pan
    const isPanMode = selectedTool === 'pan' || isSpacePressed || e.button === 1;
    if (isPanMode) {
      isPanningRef.current = true;
      lastPanStartRef.current = { x: screenX - pan.x, y: screenY - pan.y };
      return;
    }

    const worldPt = screenToWorld({ x: screenX, y: screenY }, pan, zoom);

    // 1. Text Tool -> Open inline text editor
    if (selectedTool === 'text') {
      if (activeTextInput) {
        commitTextInput();
      }
      setActiveTextInput({
        worldX: worldPt.x,
        worldY: worldPt.y,
        screenX,
        screenY,
        value: '',
      });
      return;
    }

    // 2. Select Tool -> Hit-test existing strokes
    if (selectedTool === 'select') {
      // If we clicked on an already selected stroke, start dragging it
      if (selectedStrokeId) {
        const selected = page.strokes.find((s) => s.id === selectedStrokeId);
        if (selected && isPointInStroke(worldPt, selected, 16 / zoom)) {
          isDraggingObjectRef.current = true;
          dragStartWorldRef.current = worldPt;
          draggingStrokeInitialRef.current = selected;
          return;
        }
      }

      // Find top-most stroke under cursor (reverse order)
      let hitId: string | null = null;
      for (let i = page.strokes.length - 1; i >= 0; i--) {
        const s = page.strokes[i];
        if (isPointInStroke(worldPt, s, 16 / zoom)) {
          hitId = s.id;
          break;
        }
      }

      onSelectStroke(hitId);
      if (hitId) {
        const hitStroke = page.strokes.find((s) => s.id === hitId);
        if (hitStroke) {
          isDraggingObjectRef.current = true;
          dragStartWorldRef.current = worldPt;
          draggingStrokeInitialRef.current = hitStroke;
        }
      }
      renderOverlay();
      return;
    }

    // 3. Freehand / Shape Drawing Tools
    onSelectStroke(null);
    currentStrokeRef.current = {
      id: `stroke_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      tool: selectedTool,
      color: selectedColor,
      size: brushSize,
      width: brushSize,
      opacity: selectedTool === 'highlighter' ? 0.35 : 1,
      points: [{ x: worldPt.x, y: worldPt.y, pressure: e.pressure || 1, time: performance.now() }],
      createdAt: Date.now(),
    };

    renderOverlay();
  };

  // Pointer Move
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isPointerDownRef.current) return;
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    // Handle Active Panning
    if (isPanningRef.current) {
      const newPanX = screenX - lastPanStartRef.current.x;
      const newPanY = screenY - lastPanStartRef.current.y;
      onUpdateTransform({ x: newPanX, y: newPanY }, zoom);
      return;
    }

    const worldPt = screenToWorld({ x: screenX, y: screenY }, pan, zoom);

    // Handle Active Object Dragging in 'select' mode
    if (isDraggingObjectRef.current && draggingStrokeInitialRef.current) {
      const dx = worldPt.x - dragStartWorldRef.current.x;
      const dy = worldPt.y - dragStartWorldRef.current.y;
      const moved = moveStroke(draggingStrokeInitialRef.current, dx, dy);
      onUpdateStroke(moved);
      renderOverlay();
      return;
    }

    // Handle In-Progress Stroke Drawing
    if (!currentStrokeRef.current) return;

    const isShape = ['line', 'arrow', 'rect', 'circle', 'triangle', 'ellipse', 'diamond', 'pentagon', 'hexagon', 'star', 'trapezoid', 'parallelogram'].includes(selectedTool);
    if (isShape) {
      const startPoint = currentStrokeRef.current.points[0];
      currentStrokeRef.current.points = [
        startPoint,
        { x: worldPt.x, y: worldPt.y, pressure: e.pressure || 1, time: performance.now() },
      ];
    } else {
      currentStrokeRef.current.points.push({
        x: worldPt.x,
        y: worldPt.y,
        pressure: e.pressure || 1,
        time: performance.now(),
      });
    }

    renderOverlay();
  };

  // Pointer Up
  const handlePointerUp = () => {
    isPointerDownRef.current = false;
    isPanningRef.current = false;
    isDraggingObjectRef.current = false;
    draggingStrokeInitialRef.current = null;

    if (!currentStrokeRef.current) return;

    let finalStroke = currentStrokeRef.current;

    // Freehand geometric shape recognition if enabled and tool is pen
    if (autoShapeRecognition && finalStroke.tool === 'pen' && finalStroke.points.length >= 6) {
      const recognized = recognizeShape(finalStroke);
      if (recognized) {
        finalStroke = {
          ...finalStroke,
          tool: recognized.shape,
          points: recognized.fittedPoints,
        };
      }
    }

    if (finalStroke.points.length > 0) {
      onCommitStroke(finalStroke);
    }
    currentStrokeRef.current = null;
    renderOverlay();
  };

  // Handle Air Writing from Hand Tracking State
  useEffect(() => {
    if (!trackingState.isTrackingActive && !isVirtualMode) return;
    const screenPoint = trackingState.smoothedPoint || trackingState.rawPoint;
    if (!screenPoint) {
      previousGesturePanPointRef.current = null;
      if (currentStrokeRef.current) {
        onCommitStroke(currentStrokeRef.current);
        currentStrokeRef.current = null;
        renderOverlay();
      }
      return;
    }

    if (trackingState.isPanning) {
      if (currentStrokeRef.current) {
        onCommitStroke(currentStrokeRef.current);
        currentStrokeRef.current = null;
        renderOverlay();
      }
      const previousPoint = previousGesturePanPointRef.current;
      if (previousPoint) {
        onUpdateTransform({
          x: pan.x + screenPoint.x - previousPoint.x,
          y: pan.y + screenPoint.y - previousPoint.y,
        }, zoom);
      }
      previousGesturePanPointRef.current = screenPoint;
      return;
    }

    previousGesturePanPointRef.current = null;

    // Convert screen point to canvas world coordinates
    const worldPoint = screenToWorld(screenPoint, pan, zoom);

    // Laser Pointer in PRESENTATION mode
    if (trackingState.interactionState === 'PRESENTATION' || selectedTool === 'laser') {
      laserTrailRef.current.push({ x: screenPoint.x, y: screenPoint.y, time: performance.now() });
      renderOverlay();
      return;
    }

    // Air Pen Down / Drawing
    const isDrawingState = trackingState.isPenDown ?? (trackingState.interactionState === 'WRITING');

    if (isDrawingState) {
      const pointsToFeed = (trackingState.interpolatedPoints && trackingState.interpolatedPoints.length > 0)
        ? trackingState.interpolatedPoints
        : [screenPoint];

      if (!currentStrokeRef.current) {
        currentStrokeRef.current = {
          id: `air_stroke_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          tool: selectedTool === 'select' || selectedTool === 'pan' ? 'pen' : selectedTool,
          color: selectedColor,
          size: brushSize,
          width: brushSize,
          opacity: selectedTool === 'highlighter' ? 0.35 : 1,
          points: pointsToFeed.map((pt) => {
            const wPt = screenToWorld(pt, pan, zoom);
            return { x: wPt.x, y: wPt.y, pressure: pt.pressure ?? 1, time: pt.time ?? performance.now() };
          }),
          createdAt: Date.now(),
        };
      } else {
        const isShape = ['line', 'arrow', 'rect', 'circle', 'triangle', 'ellipse', 'diamond', 'pentagon', 'hexagon', 'star', 'trapezoid', 'parallelogram'].includes(selectedTool);
        if (isShape) {
          const startPt = currentStrokeRef.current.points[0];
          currentStrokeRef.current.points = [
            startPt,
            { x: worldPoint.x, y: worldPoint.y, pressure: 1, time: performance.now() },
          ];
        } else {
          for (const pt of pointsToFeed) {
            const wPt = screenToWorld(pt, pan, zoom);
            currentStrokeRef.current.points.push({
              x: wPt.x,
              y: wPt.y,
              pressure: pt.pressure ?? 1,
              time: pt.time ?? performance.now(),
            });
          }
        }
      }
      renderOverlay();
    } else {
      // Pen Up: finalize active stroke safely
      if (currentStrokeRef.current) {
        let finalStroke = currentStrokeRef.current;
        if (autoShapeRecognition && finalStroke.tool === 'pen' && finalStroke.points.length >= 6) {
          const recognized = recognizeShape(finalStroke);
          if (recognized) {
            finalStroke = {
              ...finalStroke,
              tool: recognized.shape,
              points: recognized.fittedPoints,
            };
          }
        }
        if (finalStroke.points.length > 0) {
          onCommitStroke(finalStroke);
        }
        currentStrokeRef.current = null;
        renderOverlay();
      }
    }
  }, [
    trackingState.smoothedPoint,
    trackingState.rawPoint,
    trackingState.interactionState,
    trackingState.isPinching,
    trackingState.isTrackingActive,
    trackingState.isPanning,
    isVirtualMode,
    selectedTool,
    selectedColor,
    brushSize,
    pan,
    zoom,
    onUpdateTransform,
    autoShapeRecognition,
    onCommitStroke,
    renderOverlay,
  ]);

  const activePoint = trackingState.smoothedPoint || trackingState.rawPoint;

  // Determine cursor based on active mode
  const cursorClass = isSpacePressed || selectedTool === 'pan'
    ? 'cursor-grab active:cursor-grabbing'
    : selectedTool === 'select'
    ? 'cursor-default'
    : selectedTool === 'text'
    ? 'cursor-text'
    : 'cursor-crosshair';

  return (
    <div className={`relative w-full h-full overflow-hidden select-none ${cursorClass}`}>
      {/* Background Layer: Renders crisp infinite grid / ruled paper */}
      <canvas
        ref={bgCanvasRef}
        className="absolute inset-0 z-0 pointer-events-none"
        data-testid="whiteboard-canvas-background"
      />

      {/* Base Canvas (Layer 1): Renders completed vector strokes */}
      <canvas
        ref={baseCanvasRef}
        className="absolute inset-0 z-10 pointer-events-none"
        data-testid="whiteboard-canvas-base"
      />

      {/* Overlay Canvas (Layer 2): Handles pointer events, active strokes, and selection box */}
      <canvas
        ref={overlayCanvasRef}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="absolute inset-0 z-20 touch-none"
        data-testid="whiteboard-canvas"
      />

      {/* Inline Text Input Overlay in World Coordinates */}
      {activeTextInput && (
        <div
          className="absolute z-35"
          style={{
            left: `${activeTextInput.screenX}px`,
            top: `${activeTextInput.screenY}px`,
          }}
        >
          <div className="flex flex-col bg-[#0B1222]/95 border border-cyan-500/80 rounded-lg p-2 shadow-2xl backdrop-blur-md min-w-[200px]">
            <textarea
              ref={textInputRef}
              value={activeTextInput.value}
              onChange={(e) => setActiveTextInput({ ...activeTextInput, value: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  commitTextInput();
                } else if (e.key === 'Escape') {
                  setActiveTextInput(null);
                }
              }}
              placeholder="Type notes or equations..."
              className="bg-transparent text-white font-sans text-sm outline-none resize-none placeholder-slate-500"
              style={{ color: selectedColor }}
              rows={2}
            />
            <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-[10px] text-slate-400">
              <span>Enter to add · Esc to cancel</span>
              <button
                onClick={commitTextInput}
                className="px-2 py-0.5 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium cursor-pointer"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live Air Pointer HUD (Layer 3): Follows tracked finger */}
      {(trackingState.isTrackingActive || isVirtualMode) && activePoint && (
        <div
          className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-1/2 transition-transform duration-75 flex items-center justify-center"
          style={{
            left: `${activePoint.x}px`,
            top: `${activePoint.y}px`,
          }}
        >
          {trackingState.interactionState === 'PRESENTATION' ? (
            <div className="w-6 h-6 rounded-full bg-rose-500/30 border-2 border-rose-400 shadow-[0_0_16px_rgba(244,63,94,1)] flex items-center justify-center animate-pulse">
              <div className="w-2 h-2 rounded-full bg-rose-400" />
            </div>
          ) : (
            <div
              className={`w-6 h-6 rounded-full border-2 transition-all duration-75 flex items-center justify-center ${
                trackingState.interactionState === 'WRITING'
                  ? 'border-cyan-300 bg-cyan-400/25 shadow-[0_0_16px_rgba(6,182,212,0.9)] scale-110'
                  : trackingState.interactionState === 'PAUSED'
                  ? 'border-amber-400 bg-amber-400/15'
                  : trackingState.interactionState === 'SELECTING'
                  ? 'border-purple-400 bg-purple-400/20'
                  : 'border-cyan-400/80 shadow-[0_0_8px_rgba(6,182,212,0.5)]'
              }`}
            >
              <div
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  trackingState.interactionState === 'WRITING' ? 'bg-cyan-200' : 'bg-transparent'
                }`}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
