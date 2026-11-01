/**
 * Canvas Rendering Engine for AIRWRITE AI
 * High-DPI stroke rendering, quadratic bezier smoothing,
 * geometric shapes, text rendering, background patterns, and multi-format export.
 */

import { jsPDF } from 'jspdf';
import { DrawingStroke, WhiteboardPage, BackgroundStyle } from '../types';
import { getStrokeBoundingBox } from './coordinateTransforms';

/**
 * Configure canvas resolution for crisp Retina/HiDPI displays
 */
export function setupHighDpiCanvas(
  canvas: HTMLCanvasElement,
  width: number,
  height: number
): { ctx: CanvasRenderingContext2D; dpr: number } | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  ctx.scale(dpr, dpr);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  return { ctx, dpr };
}

/**
 * Renders the canvas background (blank, grid, ruled lined paper, dots, blueprint)
 * transformed by the current viewport pan and zoom.
 */
export function drawCanvasBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  style: BackgroundStyle,
  pan: { x: number; y: number } = { x: 0, y: 0 },
  zoom = 1.0
): void {
  ctx.save();

  // Base background fill
  const bgColor = style === 'blueprint' ? '#0A1628' : '#070B14';
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, width, height);

  if (style === 'blank') {
    ctx.restore();
    return;
  }

  const baseSpacing = 32;
  const scaledSpacing = baseSpacing * zoom;

  // Align grid to pan offset
  const startX = pan.x % scaledSpacing;
  const startY = pan.y % scaledSpacing;

  if (style === 'grid' || style === 'blueprint') {
    ctx.strokeStyle = style === 'blueprint' ? 'rgba(56, 189, 248, 0.12)' : 'rgba(51, 65, 85, 0.35)';
    ctx.lineWidth = 1;

    // Vertical lines
    for (let x = startX; x < width; x += scaledSpacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Horizontal lines
    for (let y = startY; y < height; y += scaledSpacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  } else if (style === 'ruled') {
    // Ruled lined paper for education & math notes: horizontal lines with distinct margin
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.22)';
    ctx.lineWidth = 1;

    // Horizontal ruled lines
    for (let y = startY; y < height; y += scaledSpacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Vertical left margin line (school legal pad style)
    const marginWorldX = 72;
    const marginScreenX = marginWorldX * zoom + pan.x;
    if (marginScreenX >= 0 && marginScreenX <= width) {
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.45)'; // Soft red margin line
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(marginScreenX, 0);
      ctx.lineTo(marginScreenX, height);
      ctx.stroke();
    }
  } else if (style === 'dots') {
    ctx.fillStyle = 'rgba(56, 189, 248, 0.3)';
    const dotRadius = Math.max(1, 1.2 * zoom);
    for (let x = startX; x < width; x += scaledSpacing) {
      for (let y = startY; y < height; y += scaledSpacing) {
        ctx.beginPath();
        ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  ctx.restore();
}

/**
 * Renders a single stroke, shape, or text onto the 2D context
 */
export function drawStrokeOnCanvas(
  ctx: CanvasRenderingContext2D,
  stroke: DrawingStroke
): void {
  const { tool, color, size, opacity, points, text, fontSize } = stroke;
  if (!points || points.length === 0) return;

  ctx.save();

  // 1. Text rendering
  if (tool === 'text') {
    const pt = points[0];
    const actualFontSize = fontSize || size * 5 || 24;
    ctx.font = `500 ${actualFontSize}px "Inter", -apple-system, sans-serif`;
    ctx.fillStyle = color || '#38BDF8';
    ctx.textBaseline = 'bottom';

    // Handle multiline text
    const lines = (text || '').split('\n');
    lines.forEach((line, i) => {
      ctx.fillText(line, pt.x, pt.y + i * (actualFontSize * 1.2));
    });

    ctx.restore();
    return;
  }

  // 2. Stroke / Highlighter / Eraser settings
  if (tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = 'rgba(0,0,0,1)';
    ctx.lineWidth = size * 2.5;
  } else if (tool === 'highlighter') {
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = color;
    ctx.globalAlpha = opacity || 0.35;
    ctx.lineWidth = size * 2.8;
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = color;
    ctx.globalAlpha = opacity || 1.0;
    ctx.lineWidth = size;
  }

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // 3. Render shapes vs freehand
  if (tool === 'line' && points.length >= 2) {
    const start = points[0];
    const end = points[points.length - 1];
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  } else if (tool === 'arrow' && points.length >= 2) {
    const start = points[0];
    const end = points[points.length - 1];
    drawArrow(ctx, start.x, start.y, end.x, end.y, size);
  } else if (tool === 'rect' && points.length >= 2) {
    const start = points[0];
    const end = points[points.length - 1];
    ctx.beginPath();
    ctx.strokeRect(
      Math.min(start.x, end.x),
      Math.min(start.y, end.y),
      Math.abs(end.x - start.x),
      Math.abs(end.y - start.y)
    );
  } else if (tool === 'circle' && points.length >= 2) {
    const start = points[0];
    const end = points[points.length - 1];
    const radius = Math.hypot(end.x - start.x, end.y - start.y) / 2;
    const centerX = (start.x + end.x) / 2;
    const centerY = (start.y + end.y) / 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    // Freeform handwriting with quadratic bezier interpolation
    if (points.length === 1) {
      ctx.beginPath();
      ctx.arc(points[0].x, points[0].y, size / 2, 0, Math.PI * 2);
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);

      for (let i = 1; i < points.length - 1; i++) {
        const xc = (points[i].x + points[i + 1].x) / 2;
        const yc = (points[i].y + points[i + 1].y) / 2;
        ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
      }

      // Final point
      const last = points[points.length - 1];
      ctx.lineTo(last.x, last.y);
      ctx.stroke();
    }
  }

  ctx.restore();
}

/**
 * Draws selection bounding box and corner handles around a selected stroke
 */
export function drawSelectionBox(
  ctx: CanvasRenderingContext2D,
  stroke: DrawingStroke
): void {
  const bbox = getStrokeBoundingBox(stroke);
  if (bbox.width <= 0 || bbox.height <= 0) return;

  ctx.save();
  ctx.strokeStyle = '#38BDF8';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 4]);

  // Dashed bounding rectangle
  ctx.strokeRect(bbox.minX, bbox.minY, bbox.width, bbox.height);

  // Corner and edge handles
  ctx.setLineDash([]);
  ctx.fillStyle = '#0284C7';
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1.5;

  const handleSize = 6;
  const handles = [
    { x: bbox.minX, y: bbox.minY },
    { x: bbox.maxX, y: bbox.minY },
    { x: bbox.minX, y: bbox.maxY },
    { x: bbox.maxX, y: bbox.maxY },
  ];

  for (const h of handles) {
    ctx.fillRect(h.x - handleSize / 2, h.y - handleSize / 2, handleSize, handleSize);
    ctx.strokeRect(h.x - handleSize / 2, h.y - handleSize / 2, handleSize, handleSize);
  }

  ctx.restore();
}

/**
 * Helper to draw a clean vector arrow with arrowhead
 */
function drawArrow(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  strokeWidth: number
): void {
  const headlen = Math.max(12, strokeWidth * 3.5);
  const angle = Math.atan2(toY - fromY, toX - fromX);

  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.stroke();

  // Arrowhead
  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(
    toX - headlen * Math.cos(angle - Math.PI / 6),
    toY - headlen * Math.sin(angle - Math.PI / 6)
  );
  ctx.moveTo(toX, toY);
  ctx.lineTo(
    toX - headlen * Math.cos(angle + Math.PI / 6),
    toY - headlen * Math.sin(angle + Math.PI / 6)
  );
  ctx.stroke();
}

/**
 * Redraw entire stroke stack onto canvas with viewport transformation
 */
export function redrawCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  strokes: DrawingStroke[],
  pan: { x: number; y: number } = { x: 0, y: 0 },
  zoom = 1.0,
  currentStroke?: DrawingStroke | null,
  selectedStrokeId?: string | null
): void {
  ctx.clearRect(0, 0, width, height);

  ctx.save();
  ctx.translate(pan.x, pan.y);
  ctx.scale(zoom, zoom);

  for (const stroke of strokes) {
    drawStrokeOnCanvas(ctx, stroke);
  }

  if (currentStroke && currentStroke.points.length > 0) {
    drawStrokeOnCanvas(ctx, currentStroke);
  }

  if (selectedStrokeId) {
    const selected = strokes.find((s) => s.id === selectedStrokeId);
    if (selected) {
      drawSelectionBox(ctx, selected);
    }
  }

  ctx.restore();
}

/**
 * Export canvas strokes to SVG string
 */
export function exportStrokesToSvg(
  strokes: DrawingStroke[],
  width: number,
  height: number
): string {
  const elements = strokes.map((s) => {
    if (s.tool === 'text') {
      const pt = s.points[0] || { x: 20, y: 40 };
      const fSize = s.fontSize || s.size * 5 || 24;
      return `<text x="${pt.x}" y="${pt.y}" fill="${s.color}" font-size="${fSize}" font-family="sans-serif">${s.text || ''}</text>`;
    }
    if (s.points.length < 2) return '';
    const pointsStr = s.points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const opacity = s.tool === 'highlighter' ? '0.35' : (s.opacity || 1).toString();
    return `<polyline points="${pointsStr}" fill="none" stroke="${s.color}" stroke-width="${s.size}" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}" />`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="100%" height="100%" fill="#070B14"/>
  ${elements.join('\n  ')}
</svg>`;
}

/**
 * Exports all pages or current page of a whiteboard project to a high-resolution PDF
 */
export async function exportWhiteboardToPdf(
  pages: WhiteboardPage[],
  projectTitle: string,
  width = 1600,
  height = 900
): Promise<void> {
  const pdf = new jsPDF({
    orientation: width > height ? 'landscape' : 'portrait',
    unit: 'px',
    format: [width, height],
  });

  // Offscreen canvas for rendering crisp vector/raster pages
  const offscreen = document.createElement('canvas');
  offscreen.width = width;
  offscreen.height = height;
  const ctx = offscreen.getContext('2d');
  if (!ctx) return;

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    if (i > 0) {
      pdf.addPage([width, height], width > height ? 'landscape' : 'portrait');
    }

    // Render page background
    drawCanvasBackground(ctx, width, height, page.background || 'ruled', { x: 0, y: 0 }, 1.0);

    // Render strokes
    for (const stroke of page.strokes) {
      drawStrokeOnCanvas(ctx, stroke);
    }

    // Header badge
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '14px "Inter", sans-serif';
    ctx.fillText(`${projectTitle} · ${page.title || `Page ${i + 1}`}`, 24, 30);
    ctx.restore();

    const dataUrl = offscreen.toDataURL('image/jpeg', 0.95);
    pdf.addImage(dataUrl, 'JPEG', 0, 0, width, height);
  }

  const filename = `${projectTitle.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_notes.pdf`;
  pdf.save(filename);
}
