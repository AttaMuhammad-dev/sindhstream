/**
 * Coordinate transformations, Hit-Testing, and Stroke Bounding Box utilities
 * for AIRWRITE AI Infinite Canvas
 */

import { Point2D, DrawingStroke } from '../types';

export interface ViewportTransform {
  zoom: number;
  pan: { x: number; y: number };
}

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

/**
 * Converts screen/viewport coordinates to canvas world coordinates
 */
export function screenToWorld(
  screenPt: Point2D,
  pan: { x: number; y: number },
  zoom: number
): Point2D {
  const safeZoom = zoom <= 0 ? 1 : zoom;
  return {
    x: (screenPt.x - pan.x) / safeZoom,
    y: (screenPt.y - pan.y) / safeZoom,
    pressure: screenPt.pressure,
    time: screenPt.time,
  };
}

/**
 * Converts canvas world coordinates to screen/viewport coordinates
 */
export function worldToScreen(
  worldPt: Point2D,
  pan: { x: number; y: number },
  zoom: number
): Point2D {
  return {
    x: worldPt.x * zoom + pan.x,
    y: worldPt.y * zoom + pan.y,
    pressure: worldPt.pressure,
    time: worldPt.time,
  };
}

/**
 * Computes bounding box for a stroke or text element in world coordinates
 */
export function getStrokeBoundingBox(stroke: DrawingStroke): BoundingBox {
  if (stroke.tool === 'text') {
    const pt = stroke.points[0] || { x: 0, y: 0 };
    const fontSize = stroke.fontSize || stroke.size * 5 || 24;
    const textLen = (stroke.text || '').length;
    // Estimate width based on character count and font size
    const estWidth = Math.max(40, textLen * (fontSize * 0.58));
    const estHeight = fontSize * 1.3;
    return {
      minX: pt.x - 4,
      minY: pt.y - fontSize - 2,
      maxX: pt.x + estWidth + 4,
      maxY: pt.y + 4,
      width: estWidth + 8,
      height: estHeight + 6,
    };
  }

  if (stroke.tool === 'circle' && stroke.points.length >= 2) {
    const start = stroke.points[0];
    const end = stroke.points[stroke.points.length - 1];
    const radius = Math.hypot(end.x - start.x, end.y - start.y) / 2;
    const centerX = (start.x + end.x) / 2;
    const centerY = (start.y + end.y) / 2;
    const pad = stroke.size / 2;
    return {
      minX: centerX - radius - pad,
      minY: centerY - radius - pad,
      maxX: centerX + radius + pad,
      maxY: centerY + radius + pad,
      width: (radius + pad) * 2,
      height: (radius + pad) * 2,
    };
  }

  if (stroke.tool === 'rect' && stroke.points.length >= 2) {
    const start = stroke.points[0];
    const end = stroke.points[stroke.points.length - 1];
    const minX = Math.min(start.x, end.x);
    const maxX = Math.max(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const maxY = Math.max(start.y, end.y);
    const pad = stroke.size / 2;
    return {
      minX: minX - pad,
      minY: minY - pad,
      maxX: maxX + pad,
      maxY: maxY + pad,
      width: maxX - minX + pad * 2,
      height: maxY - minY + pad * 2,
    };
  }

  // Freeform or line / arrow
  if (!stroke.points || stroke.points.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }

  let minX = stroke.points[0].x;
  let maxX = stroke.points[0].x;
  let minY = stroke.points[0].y;
  let maxY = stroke.points[0].y;

  for (let i = 1; i < stroke.points.length; i++) {
    const pt = stroke.points[i];
    if (pt.x < minX) minX = pt.x;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.y > maxY) maxY = pt.y;
  }

  const pad = Math.max(4, stroke.size / 2);
  return {
    minX: minX - pad,
    minY: minY - pad,
    maxX: maxX + pad,
    maxY: maxY + pad,
    width: maxX - minX + pad * 2,
    height: maxY - minY + pad * 2,
  };
}

/**
 * Calculates perpendicular distance from a point to a line segment
 */
function distanceToSegment(p: Point2D, v: Point2D, w: Point2D): number {
  const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
  if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
}

/**
 * Hit test: checks if a world point intersects with a stroke
 */
export function isPointInStroke(
  point: Point2D,
  stroke: DrawingStroke,
  tolerance = 12
): boolean {
  const bbox = getStrokeBoundingBox(stroke);
  // Fast rejection by bounding box with expanded tolerance
  if (
    point.x < bbox.minX - tolerance ||
    point.x > bbox.maxX + tolerance ||
    point.y < bbox.minY - tolerance ||
    point.y > bbox.maxY + tolerance
  ) {
    return false;
  }

  // Text hit test: inside bounding box
  if (stroke.tool === 'text') {
    return (
      point.x >= bbox.minX - 4 &&
      point.x <= bbox.maxX + 4 &&
      point.y >= bbox.minY - 4 &&
      point.y <= bbox.maxY + 4
    );
  }

  // Circle hit test: point is near circumference
  if (stroke.tool === 'circle' && stroke.points.length >= 2) {
    const start = stroke.points[0];
    const end = stroke.points[stroke.points.length - 1];
    const radius = Math.hypot(end.x - start.x, end.y - start.y) / 2;
    const centerX = (start.x + end.x) / 2;
    const centerY = (start.y + end.y) / 2;
    const distToCenter = Math.hypot(point.x - centerX, point.y - centerY);
    const hitMargin = Math.max(tolerance, stroke.size);
    return Math.abs(distToCenter - radius) <= hitMargin;
  }

  // Rect hit test: point is near any of the 4 edges
  if (stroke.tool === 'rect' && stroke.points.length >= 2) {
    const start = stroke.points[0];
    const end = stroke.points[stroke.points.length - 1];
    const minX = Math.min(start.x, end.x);
    const maxX = Math.max(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const maxY = Math.max(start.y, end.y);
    const hitMargin = Math.max(tolerance, stroke.size);

    const nearLeft = Math.abs(point.x - minX) <= hitMargin && point.y >= minY && point.y <= maxY;
    const nearRight = Math.abs(point.x - maxX) <= hitMargin && point.y >= minY && point.y <= maxY;
    const nearTop = Math.abs(point.y - minY) <= hitMargin && point.x >= minX && point.x <= maxX;
    const nearBottom = Math.abs(point.y - maxY) <= hitMargin && point.x >= minX && point.x <= maxX;

    return nearLeft || nearRight || nearTop || nearBottom;
  }

  // Segments for lines, arrows, and freeform strokes
  const hitMargin = Math.max(tolerance, stroke.size / 2);
  for (let i = 0; i < stroke.points.length - 1; i++) {
    const dist = distanceToSegment(point, stroke.points[i], stroke.points[i + 1]);
    if (dist <= hitMargin) {
      return true;
    }
  }

  if (stroke.points.length === 1) {
    return Math.hypot(point.x - stroke.points[0].x, point.y - stroke.points[0].y) <= hitMargin;
  }

  return false;
}

/**
 * Translates all points of a stroke by (dx, dy)
 */
export function moveStroke(stroke: DrawingStroke, dx: number, dy: number): DrawingStroke {
  return {
    ...stroke,
    points: stroke.points.map((p) => ({
      ...p,
      x: p.x + dx,
      y: p.y + dy,
    })),
  };
}
