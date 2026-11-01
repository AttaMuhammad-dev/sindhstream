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

/**
 * Analyzes a freehand stroke and recognizes if it represents a circle, rectangle, line, or arrow
 */
export function recognizeShape(stroke: DrawingStroke): RecognizedShape | null {
  if (stroke.points.length < 3) return null;
  if (['text', 'eraser', 'highlighter'].includes(stroke.tool)) return null;

  // 1. Test circle fit
  const circleTest = testCircleFit(stroke.points);
  if (circleTest.isCircle && circleTest.confidence > 0.72) {
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
