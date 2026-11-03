/**
 * Local geometric recognizer for freehand and air-drawn whiteboard strokes.
 * It deliberately prefers leaving uncertain writing untouched over snapping
 * letters and diagrams to an unrelated shape.
 */

import { Point2D, DrawingStroke, DrawingTool } from '../types';

export interface RecognizedShape {
  shape: DrawingTool;
  confidence: number;
  fittedPoints: Point2D[];
}

type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

const distance = (a: Point2D, b: Point2D) => Math.hypot(a.x - b.x, a.y - b.y);

function getBounds(points: Point2D[]): Bounds {
  return points.reduce((bounds, point) => ({
    minX: Math.min(bounds.minX, point.x),
    minY: Math.min(bounds.minY, point.y),
    maxX: Math.max(bounds.maxX, point.x),
    maxY: Math.max(bounds.maxY, point.y),
  }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
}

function pathLength(points: Point2D[]): number {
  let length = 0;
  for (let i = 1; i < points.length; i++) length += distance(points[i - 1], points[i]);
  return length;
}

function removeNearDuplicates(points: Point2D[], minimumGap: number): Point2D[] {
  const result: Point2D[] = [];
  for (const point of points) {
    if (!result.length || distance(result[result.length - 1], point) >= minimumGap) result.push(point);
  }
  return result;
}

function distanceToSegment(point: Point2D, start: Point2D, end: Point2D): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const denominator = Math.max(1, dx * dx + dy * dy);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / denominator));
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}

function simplifyOpen(points: Point2D[], tolerance: number): Point2D[] {
  if (points.length <= 2) return points;
  let farthest = tolerance;
  let index = -1;
  for (let i = 1; i < points.length - 1; i++) {
    const deviation = distanceToSegment(points[i], points[0], points[points.length - 1]);
    if (deviation > farthest) {
      farthest = deviation;
      index = i;
    }
  }
  if (index < 0) return [points[0], points[points.length - 1]];
  const left = simplifyOpen(points.slice(0, index + 1), tolerance);
  const right = simplifyOpen(points.slice(index), tolerance);
  return [...left.slice(0, -1), ...right];
}

/** Simplify a closed loop without letting RDP collapse its matching endpoints. */
function simplifyClosed(points: Point2D[], tolerance: number): Point2D[] {
  const loop = [...points];
  if (distance(loop[0], loop[loop.length - 1]) < tolerance) loop.pop();
  if (loop.length < 3) return loop;

  let farthestIndex = 1;
  let farthestDistance = 0;
  for (let i = 1; i < loop.length; i++) {
    const candidate = distance(loop[0], loop[i]);
    if (candidate > farthestDistance) {
      farthestDistance = candidate;
      farthestIndex = i;
    }
  }

  const firstHalf = simplifyOpen(loop.slice(0, farthestIndex + 1), tolerance);
  const secondHalf = simplifyOpen([...loop.slice(farthestIndex), loop[0]], tolerance);
  const vertices = removeNearDuplicates([...firstHalf.slice(0, -1), ...secondHalf.slice(0, -1)], tolerance * 0.55);
  if (vertices.length > 1 && distance(vertices[0], vertices[vertices.length - 1]) < tolerance) vertices.pop();
  return vertices;
}

function polygonArea(points: Point2D[]): number {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    area += current.x * next.y - next.x * current.y;
  }
  return Math.abs(area) / 2;
}

function isConvex(points: Point2D[]): boolean {
  let sign = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const c = points[(i + 2) % points.length];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) < 0.001) continue;
    const nextSign = Math.sign(cross);
    if (sign && nextSign !== sign) return false;
    sign = nextSign;
  }
  return sign !== 0;
}

function getEdges(points: Point2D[]) {
  return points.map((point, index) => {
    const next = points[(index + 1) % points.length];
    const dx = next.x - point.x;
    const dy = next.y - point.y;
    const length = Math.hypot(dx, dy);
    return { length, ux: dx / Math.max(1, length), uy: dy / Math.max(1, length) };
  });
}

function classifyQuadrilateral(points: Point2D[]): DrawingTool {
  const edges = getEdges(points);
  const parallel = (a: number, b: number) => Math.abs(edges[a].ux * edges[b].uy - edges[a].uy * edges[b].ux) < 0.24;
  const parallelPairs = [parallel(0, 2), parallel(1, 3)];
  const rightAngles = edges.every((edge, index) => {
    const next = edges[(index + 1) % edges.length];
    return Math.abs(edge.ux * next.ux + edge.uy * next.uy) < 0.29;
  });
  const sideLengths = edges.map((edge) => edge.length);
  const meanSide = sideLengths.reduce((sum, length) => sum + length, 0) / sideLengths.length;
  const similarSides = sideLengths.every((length) => Math.abs(length - meanSide) / meanSide < 0.23);

  if (rightAngles) return 'rect';
  if (parallelPairs[0] && parallelPairs[1]) return similarSides ? 'diamond' : 'parallelogram';
  if (parallelPairs[0] || parallelPairs[1]) return 'trapezoid';
  return 'parallelogram';
}

function fitRoundedShape(points: Point2D[], bounds: Bounds): { shape: DrawingTool; confidence: number } | null {
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  if (width < 22 || height < 22) return null;

  const center = { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 };
  const rx = width / 2;
  const ry = height / 2;
  const normalizedRadii = points.map((point) => Math.hypot((point.x - center.x) / rx, (point.y - center.y) / ry));
  const mean = normalizedRadii.reduce((sum, radius) => sum + radius, 0) / normalizedRadii.length;
  const variance = normalizedRadii.reduce((sum, radius) => sum + (radius - mean) ** 2, 0) / normalizedRadii.length;
  const circularity = Math.max(0, 1 - Math.sqrt(variance) / Math.max(0.001, mean));
  if (circularity < 0.89) return null;

  const aspect = Math.min(width, height) / Math.max(width, height);
  return {
    shape: aspect > 0.84 ? 'circle' : 'ellipse',
    confidence: Math.min(0.98, circularity),
  };
}

function fitPolygon(points: Point2D[], bounds: Bounds, diagonal: number): RecognizedShape | null {
  const tolerance = Math.max(4, diagonal * 0.025);
  const vertices = simplifyClosed(points, tolerance);
  if (vertices.length < 3 || vertices.length > 12) return null;
  if (vertices.length <= 6 && !isConvex(vertices)) return null;

  const boxArea = Math.max(1, (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY));
  if (polygonArea(vertices) / boxArea < 0.36) return null;

  let shape: DrawingTool | null = null;
  if (vertices.length === 3) shape = 'triangle';
  else if (vertices.length === 4) shape = classifyQuadrilateral(vertices);
  else if (vertices.length === 5) shape = 'pentagon';
  else if (vertices.length === 6) shape = 'hexagon';

  if (!shape) return null;
  return { shape, confidence: shape === 'triangle' || shape === 'pentagon' || shape === 'hexagon' ? 0.86 : 0.8, fittedPoints: vertices };
}

function fitStar(points: Point2D[], bounds: Bounds, diagonal: number): RecognizedShape | null {
  const vertices = simplifyClosed(points, Math.max(4, diagonal * 0.022));
  if (vertices.length < 8 || vertices.length > 12 || polygonArea(vertices) / Math.max(1, (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY)) < 0.24) return null;

  const cx = vertices.reduce((sum, point) => sum + point.x, 0) / vertices.length;
  const cy = vertices.reduce((sum, point) => sum + point.y, 0) / vertices.length;
  const radii = vertices.map((point) => Math.hypot(point.x - cx, point.y - cy));
  const mean = radii.reduce((sum, radius) => sum + radius, 0) / radii.length;
  const alternatingStrength = Math.abs(radii.reduce((sum, radius, index) => sum + (index % 2 ? -radius : radius), 0) / radii.length) / Math.max(1, mean);
  const ellipseNormalized = points.map((point) => Math.hypot(
    (point.x - (bounds.minX + bounds.maxX) / 2) / Math.max(1, (bounds.maxX - bounds.minX) / 2),
    (point.y - (bounds.minY + bounds.maxY) / 2) / Math.max(1, (bounds.maxY - bounds.minY) / 2),
  ));
  const normalizedMean = ellipseNormalized.reduce((sum, radius) => sum + radius, 0) / ellipseNormalized.length;
  const normalizedVariance = ellipseNormalized.reduce((sum, radius) => sum + (radius - normalizedMean) ** 2, 0) / ellipseNormalized.length;
  const roundedness = 1 - Math.sqrt(normalizedVariance) / Math.max(0.001, normalizedMean);
  if (alternatingStrength < 0.19 || roundedness > 0.86) return null;
  return { shape: 'star', confidence: Math.min(0.92, 0.72 + alternatingStrength), fittedPoints: vertices };
}

/**
 * Recognize common shapes while preserving open writing. The order matters:
 * closed polygons are checked before roundness so triangular outlines do not
 * get incorrectly snapped into circles.
 */
export function recognizeShape(stroke: DrawingStroke): RecognizedShape | null {
  const rawPoints = stroke.points;
  if (rawPoints.length < 4 || ['text', 'eraser', 'highlighter'].includes(stroke.tool)) return null;

  const points = removeNearDuplicates(rawPoints, 1.5);
  if (points.length < 4) return null;
  const bounds = getBounds(points);
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const diagonal = Math.hypot(width, height);
  if (diagonal < 28) return null;

  const first = points[0];
  const last = points[points.length - 1];
  const gap = distance(first, last);
  const length = pathLength(points);
  const closed = gap <= Math.max(20, diagonal * 0.16) && length >= diagonal * 1.65;

  if (closed) {
    const polygon = fitPolygon(points, bounds, diagonal);
    if (polygon) return polygon;

    const rounded = fitRoundedShape(points, bounds);
    if (rounded) {
      return {
        ...rounded,
        fittedPoints: [
          { x: bounds.minX, y: bounds.minY },
          { x: bounds.maxX, y: bounds.maxY },
        ],
      };
    }

    const star = fitStar(points, bounds, diagonal);
    if (star) return star;
  }

  const chord = distance(first, last);
  const linearity = chord / Math.max(1, length);
  if (chord > 24 && linearity > 0.94) {
    return { shape: 'line', confidence: linearity, fittedPoints: [first, last] };
  }

  return null;
}
