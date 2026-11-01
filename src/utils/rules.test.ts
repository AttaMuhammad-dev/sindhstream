import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDistance,
  checkPinchGesture,
  smoothCoordinates,
  classifyHandGesture,
  mapCameraToCanvas,
} from './gestureMath';
import { exportStrokesToSvg } from './canvasRenderer';
import { HandLandmark, DrawingStroke } from '../types';

test('calculateDistance computes correct 2D Euclidean distance', () => {
  const p1 = { x: 0, y: 0 };
  const p2 = { x: 3, y: 4 };
  assert.equal(calculateDistance(p1, p2), 5);

  const p3 = { x: 1, y: 1 };
  const p4 = { x: 1, y: 1 };
  assert.equal(calculateDistance(p3, p4), 0);
});

test('checkPinchGesture detects pinch within threshold', () => {
  const thumb = { x: 0.5, y: 0.5 };
  const indexClose = { x: 0.52, y: 0.51 }; // distance ~0.022 < 0.05
  const indexFar = { x: 0.65, y: 0.65 };   // distance ~0.21 > 0.05

  const resultPinch = checkPinchGesture(thumb, indexClose, 0.05);
  assert.equal(resultPinch.isPinching, true);
  assert.ok(resultPinch.distance < 0.05);

  const resultFar = checkPinchGesture(thumb, indexFar, 0.05);
  assert.equal(resultFar.isPinching, false);
  assert.ok(resultFar.distance > 0.05);
});

test('smoothCoordinates interpolates points using exponential moving average', () => {
  const prev = { x: 100, y: 100 };
  const next = { x: 200, y: 200 };
  const smoothed = smoothCoordinates(prev, next, 0.5);

  // With alpha=0.5: 100 * 0.5 + 200 * 0.5 = 150
  assert.equal(smoothed.x, 150);
  assert.equal(smoothed.y, 150);

  // If prev is null, returns raw next
  const first = smoothCoordinates(null, next, 0.5);
  assert.equal(first.x, 200);
  assert.equal(first.y, 200);
});

test('mapCameraToCanvas maps normalized point to screen canvas coordinates', () => {
  const canvasWidth = 1200;
  const canvasHeight = 800;

  // Normalized (0.2, 0.5) with mirror=true -> x = (1 - 0.2) * 1200 = 960, y = 400
  const mappedMirrored = mapCameraToCanvas({ x: 0.2, y: 0.5 }, canvasWidth, canvasHeight, true);
  assert.equal(mappedMirrored.x, 960);
  assert.equal(mappedMirrored.y, 400);

  // Normalized (0.2, 0.5) with mirror=false -> x = 0.2 * 1200 = 240, y = 400
  const mappedDirect = mapCameraToCanvas({ x: 0.2, y: 0.5 }, canvasWidth, canvasHeight, false);
  assert.equal(mappedDirect.x, 240);
  assert.equal(mappedDirect.y, 400);
});

test('classifyHandGesture identifies pinch gesture when thumb and index are close', () => {
  // Generate a mock 21-landmark array
  const mockLandmarks: HandLandmark[] = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  
  // Set thumb tip and index tip close
  mockLandmarks[4] = { x: 0.5, y: 0.5, z: 0 };
  mockLandmarks[8] = { x: 0.51, y: 0.51, z: 0 };

  const gesture = classifyHandGesture(mockLandmarks, 0.05);
  assert.equal(gesture, 'pinch');
});

test('exportStrokesToSvg produces valid SVG markup containing stroke paths', () => {
  const strokes: DrawingStroke[] = [
    {
      id: 'test-1',
      tool: 'pen',
      color: '#38BDF8',
      size: 4,
      opacity: 1,
      points: [{ x: 10, y: 10 }, { x: 20, y: 20 }, { x: 30, y: 40 }],
      createdAt: Date.now(),
    }
  ];

  const svg = exportStrokesToSvg(strokes, 800, 600);
  assert.ok(svg.includes('<svg'));
  assert.ok(svg.includes('polyline'));
  assert.ok(svg.includes('#38BDF8'));
  assert.ok(svg.includes('points="10.0,10.0 20.0,20.0 30.0,40.0"'));
});

// Viewport & Coordinate Transform Tests
import {
  screenToWorld,
  worldToScreen,
  getStrokeBoundingBox,
  isPointInStroke,
  moveStroke,
} from './coordinateTransforms';
import { recognizeShape } from './shapeRecognition';

test('screenToWorld and worldToScreen map coordinates reversibly across pan and zoom', () => {
  const pan = { x: 150, y: -80 };
  const zoom = 1.5;

  const screenOriginal = { x: 450, y: 370 };
  const world = screenToWorld(screenOriginal, pan, zoom);

  // worldX = (450 - 150) / 1.5 = 200
  // worldY = (370 - (-80)) / 1.5 = 300
  assert.equal(world.x, 200);
  assert.equal(world.y, 300);

  const screenBack = worldToScreen(world, pan, zoom);
  assert.equal(screenBack.x, screenOriginal.x);
  assert.equal(screenBack.y, screenOriginal.y);
});

test('getStrokeBoundingBox and isPointInStroke perform accurate hit-testing', () => {
  const stroke: DrawingStroke = {
    id: 's-rect',
    tool: 'rect',
    color: '#38BDF8',
    size: 4,
    opacity: 1,
    points: [{ x: 100, y: 100 }, { x: 300, y: 200 }],
    createdAt: Date.now(),
  };

  const bbox = getStrokeBoundingBox(stroke);
  assert.ok(bbox.width >= 200);
  assert.ok(bbox.height >= 100);

  // Point right on the top edge (150, 100) should hit
  assert.equal(isPointInStroke({ x: 150, y: 100 }, stroke, 10), true);

  // Point far outside (500, 500) should miss
  assert.equal(isPointInStroke({ x: 500, y: 500 }, stroke, 10), false);
});

test('moveStroke translates all points accurately by dx and dy', () => {
  const stroke: DrawingStroke = {
    id: 's-line',
    tool: 'line',
    color: '#FFFFFF',
    size: 2,
    opacity: 1,
    points: [{ x: 50, y: 50 }, { x: 150, y: 150 }],
    createdAt: Date.now(),
  };

  const moved = moveStroke(stroke, 25, -10);
  assert.equal(moved.points[0].x, 75);
  assert.equal(moved.points[0].y, 40);
  assert.equal(moved.points[1].x, 175);
  assert.equal(moved.points[1].y, 140);
});

test('recognizeShape identifies circle from closed circular points', () => {
  // Generate points in a circle centered at (200, 200) with radius 50
  const points = [];
  const count = 20;
  for (let i = 0; i <= count; i++) {
    const angle = (i / count) * Math.PI * 2;
    points.push({
      x: 200 + Math.cos(angle) * 50,
      y: 200 + Math.sin(angle) * 50,
    });
  }

  const freehandCircle: DrawingStroke = {
    id: 'freehand-c',
    tool: 'pen',
    color: '#38BDF8',
    size: 4,
    opacity: 1,
    points,
    createdAt: Date.now(),
  };

  const recognized = recognizeShape(freehandCircle);
  assert.ok(recognized !== null);
  assert.equal(recognized?.shape, 'circle');
  assert.ok((recognized?.confidence || 0) > 0.7);
});

test('recognizeShape identifies straight line from collinear points', () => {
  const points = [
    { x: 100, y: 100 },
    { x: 150, y: 150 },
    { x: 200, y: 200 },
    { x: 250, y: 250 },
    { x: 300, y: 300 },
  ];

  const freehandLine: DrawingStroke = {
    id: 'freehand-l',
    tool: 'pen',
    color: '#38BDF8',
    size: 4,
    opacity: 1,
    points,
    createdAt: Date.now(),
  };

  const recognized = recognizeShape(freehandLine);
  assert.ok(recognized !== null);
  assert.equal(recognized?.shape, 'line');
  assert.ok((recognized?.confidence || 0) > 0.85);
});

