/**
 * Geometric Shape Recognition Engine for AIRWRITE AI
 * Analyzes freeform strokes to recognize intended circles, rectangles, lines, and arrows.
 */

import { Point2D, DrawingStroke, DrawingTool } from '../types';

export interface RecognizedShape {
  shape: DrawingTool;
  confidence: number;
  fittedPoints: Point2D[];
}

/**
 * Checks if a sequence of points approximates a straight line
 */
function testLineFit(points: Point2D[]): { isLine: boolean; confidence: number } {
  if (points.length < 2) return { isLine: false, confidence: 0 };
  const start = points[0];
  const end = points[points.length - 1];
  const chordLength = Math.hypot(end.x - start.x, end.y - start.y);

  if (chordLength < 15) return { isLine: false, confidence: 0 };

  // Calculate total path length
  let pathLength = 0;
  for (let i = 0; i < points.length - 1; i++) {
    pathLength += Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
  }

  // Ratio of chord to path length (straight line has ratio close to 1)
  const linearity = chordLength / Math.max(1, pathLength);
  return {
    isLine: linearity > 0.88,
    confidence: linearity,
  };
}

/**
 * Checks if a sequence of points approximates a closed circle or ellipse
 */
function testCircleFit(points: Point2D[]): { isCircle: boolean; confidence: number; center: Point2D; radius: number } {
  if (points.length < 8) return { isCircle: false, confidence: 0, center: { x: 0, y: 0 }, radius: 0 };

  const start = points[0];
  const end = points[points.length - 1];
  const closeGap = Math.hypot(end.x - start.x, end.y - start.y);

  // Compute centroid
  let sumX = 0;
  let sumY = 0;
  for (const pt of points) {
    sumX += pt.x;
    sumY += pt.y;
  }
  const center = { x: sumX / points.length, y: sumY / points.length };

  // Calculate average radius and variance
  const radii = points.map((p) => Math.hypot(p.x - center.x, p.y - center.y));
  const avgRadius = radii.reduce((acc, r) => acc + r, 0) / radii.length;

  if (avgRadius < 15) return { isCircle: false, confidence: 0, center, radius: avgRadius };

  // Endpoints should be reasonably close compared to perimeter
  const closureRatio = closeGap / (avgRadius * 2);

  const variance = radii.reduce((acc, r) => acc + Math.pow(r - avgRadius, 2), 0) / radii.length;
  const stdDev = Math.sqrt(variance);
  const circularity = 1 - stdDev / avgRadius;

  const isCircle = circularity > 0.72 && closureRatio < 0.6;
  return {
    isCircle,
    confidence: Math.max(0, Math.min(1, circularity)),
    center,
    radius: avgRadius,
  };
}

/**
 * Checks if a sequence of points approximates a rectangle
 */
function testRectFit(points: Point2D[]): { isRect: boolean; confidence: number; start: Point2D; end: Point2D } {
  if (points.length < 10) return { isRect: false, confidence: 0, start: { x: 0, y: 0 }, end: { x: 0, y: 0 } };

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  const width = maxX - minX;
  const height = maxY - minY;

  if (width < 25 || height < 25) {
    return { isRect: false, confidence: 0, start: { x: minX, y: minY }, end: { x: maxX, y: maxY } };
  }

  const perimeter = 2 * (width + height);
  let pathLength = 0;
  for (let i = 0; i < points.length - 1; i++) {
    pathLength += Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
  }

  const start = points[0];
  const end = points[points.length - 1];
  const closeGap = Math.hypot(end.x - start.x, end.y - start.y);

  // Closed loop with perimeter close to bounding box perimeter
  const lengthMatch = Math.abs(pathLength - perimeter) / perimeter;
  const isRect = lengthMatch < 0.28 && closeGap < Math.min(width, height) * 0.55;

  return {
    isRect,
    confidence: Math.max(0, 1 - lengthMatch),
    start: { x: minX, y: minY },
    end: { x: maxX, y: maxY },
  };
}

function distanceToSegment(point: Point2D, start: Point2D, end: Point2D): number {
  const dx = end.x - start.x, dy = end.y - start.y;
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / Math.max(1, dx * dx + dy * dy)));
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}

function simplify(points: Point2D[], tolerance: number): Point2D[] {
  if (points.length <= 2) return points;
  let farthest = 0, index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const distance = distanceToSegment(points[i], points[0], points[points.length - 1]);
    if (distance > farthest) { farthest = distance; index = i; }
  }
  if (farthest <= tolerance) return [points[0], points[points.length - 1]];
  const left = simplify(points.slice(0, index + 1), tolerance);
  const right = simplify(points.slice(index), tolerance);
  return [...left.slice(0, -1), ...right];
}

/**
 * Analyzes a freehand stroke and recognizes if it represents a circle, rectangle, line, or arrow
 */
export function recognizeShape(stroke: DrawingStroke): RecognizedShape | null {
  if (stroke.points.length < 3) return null;
  if (['text', 'eraser', 'highlighter'].includes(stroke.tool)) return null;

  // A loose closure tolerance turns many hooked letters and scribbles into
  // circles. Require a genuinely closed, round trace before snapping.
  const circleTest = testCircleFit(stroke.points);
  const first = stroke.points[0];
  const last = stroke.points[stroke.points.length - 1];
  const diagonal = Math.hypot(last.x - first.x, last.y - first.y);
  const strokeBounds = stroke.points.reduce((b, p) => ({
    minX: Math.min(b.minX, p.x), maxX: Math.max(b.maxX, p.x),
    minY: Math.min(b.minY, p.y), maxY: Math.max(b.maxY, p.y),
  }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
  const strokeWidth = strokeBounds.maxX - strokeBounds.minX;
  const strokeHeight = strokeBounds.maxY - strokeBounds.minY;
  const aspect = Math.min(strokeWidth, strokeHeight) / Math.max(strokeWidth, strokeHeight, 1);
  if (circleTest.isCircle && circleTest.confidence > 0.82 && diagonal < circleTest.radius * 0.55 && aspect > 0.72) {
    const { center, radius } = circleTest;
    return {
      shape: 'circle',
      confidence: circleTest.confidence,
      fittedPoints: [
        { x: center.x - radius, y: center.y - radius },
        { x: center.x + radius, y: center.y + radius },
      ],
    };
  }

  // A triangle is a closed trace with three dominant corners. Use perimeter
  // and closure checks so ordinary letters and open zigzags remain freehand.
  const closed = diagonal < Math.min(strokeWidth, strokeHeight) * 0.28;
  if (closed && stroke.points.length >= 8) {
    const trace = [...stroke.points];
    trace[trace.length - 1] = trace[0];
    const vertices = simplify(trace, Math.max(5, Math.hypot(strokeWidth, strokeHeight) * 0.045));
    const uniqueVertices = vertices.slice(0, -1);
    if (uniqueVertices.length >= 3 && uniqueVertices.length <= 6) {
      const shape: DrawingTool | null = uniqueVertices.length === 3 ? 'triangle' : uniqueVertices.length === 5 ? 'pentagon' : uniqueVertices.length === 6 ? 'hexagon' : null;
      if (shape) return { shape, confidence: 0.82, fittedPoints: uniqueVertices };
    }
  }

  // 2. Test rectangle fit
  const rectTest = testRectFit(stroke.points);
  if (rectTest.isRect && rectTest.confidence > 0.7) {
    return {
      shape: 'rect',
      confidence: rectTest.confidence,
      fittedPoints: [rectTest.start, rectTest.end],
    };
  }

  // 3. Test line fit
  const lineTest = testLineFit(stroke.points);
  if (lineTest.isLine && lineTest.confidence > 0.88) {
    const start = stroke.points[0];
    const end = stroke.points[stroke.points.length - 1];
    return {
      shape: 'line',
      confidence: lineTest.confidence,
      fittedPoints: [start, end],
    };
  }

  return null;
}
