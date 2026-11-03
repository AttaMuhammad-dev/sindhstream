/**
 * Gesture Recognition & Geometry Math for Air Writing
 * Decoupled from DOM and framework components for testability.
 */

import { HandGesture, HandLandmark, Point2D } from '../types';

export const MEDIAPIPE_LANDMARKS = {
  WRIST: 0,
  THUMB_CMC: 1,
  THUMB_MCP: 2,
  THUMB_IP: 3,
  THUMB_TIP: 4,
  INDEX_FINGER_MCP: 5,
  INDEX_FINGER_PIP: 6,
  INDEX_FINGER_DIP: 7,
  INDEX_FINGER_TIP: 8,
  MIDDLE_FINGER_MCP: 9,
  MIDDLE_FINGER_PIP: 10,
  MIDDLE_FINGER_DIP: 11,
  MIDDLE_FINGER_TIP: 12,
  RING_FINGER_MCP: 13,
  RING_FINGER_PIP: 14,
  RING_FINGER_DIP: 15,
  RING_FINGER_TIP: 16,
  PINKY_MCP: 17,
  PINKY_PIP: 18,
  PINKY_DIP: 19,
  PINKY_TIP: 20,
} as const;

/**
 * 2D Euclidean Distance between two normalized points
 */
export function calculateDistance(
  p1: { x: number; y: number },
  p2: { x: number; y: number }
): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.hypot(dx, dy);
}

/**
 * 3D Euclidean Distance when z-depth is available
 */
export function calculateDistance3D(p1: HandLandmark, p2: HandLandmark): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  const dz = (p1.z || 0) - (p2.z || 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Calculates dynamic palm scale reference (distance between wrist and middle finger MCP joint).
 * Standardizes pinch distance across different user distances from the webcam.
 */
export function calculateHandScale(wrist: HandLandmark, middleMcp: HandLandmark): number {
  return Math.max(0.06, calculateDistance(wrist, middleMcp));
}

/**
 * Determines whether thumb and index tips are pinched, with scale-invariant normalization
 */
export function checkPinchGesture(
  thumbTip: { x: number; y: number },
  indexTip: { x: number; y: number },
  threshold = 0.05,
  handScale?: number
): { isPinching: boolean; distance: number; normalizedDistance: number } {
  const rawDist = calculateDistance(thumbTip, indexTip);
  const refScale = 0.22;
  const scaleMultiplier = handScale ? refScale / Math.max(0.06, handScale) : 1;
  const normalizedDistance = rawDist * scaleMultiplier;
  return {
    isPinching: normalizedDistance <= threshold,
    distance: rawDist,
    normalizedDistance,
  };
}

/**
 * Exponential Moving Average (EMA) smoothing for jitter reduction in air strokes
 */
export function smoothCoordinates(
  previousPoint: Point2D | null,
  newPoint: Point2D,
  smoothingFactor = 0.35
): Point2D {
  if (!previousPoint) return newPoint;

  // Clamped factor: 0 = no movement, 1 = instant/raw
  const alpha = Math.max(0.05, Math.min(0.95, smoothingFactor));

  return {
    x: previousPoint.x * (1 - alpha) + newPoint.x * alpha,
    y: previousPoint.y * (1 - alpha) + newPoint.y * alpha,
    pressure: newPoint.pressure ?? 1,
    time: Date.now(),
  };
}

/**
 * Checks if a specific finger is extended relative to its MCP joint and wrist
 * Combines joint-relative distance and wrist distance to handle arbitrary hand angles.
 */
export function isFingerExtended(
  tip: HandLandmark,
  pip: HandLandmark,
  mcp: HandLandmark,
  wrist: HandLandmark
): boolean {
  const distWristToTip = calculateDistance3D(wrist, tip);
  const distWristToPip = calculateDistance3D(wrist, pip);
  const distMcpToTip = calculateDistance3D(mcp, tip);
  const distMcpToPip = calculateDistance3D(mcp, pip);

  // Compare the whole finger in 3D and require a clear margin. The old OR
  // condition classified bent fingers as extended when a curled tip happened
  // to point sideways or toward the camera.
  return distMcpToTip > distMcpToPip * 1.3 && distWristToTip > distWristToPip * 1.04;
}

/**
 * Checks if thumb is extended away from palm
 */
export function isThumbExtended(
  thumbTip: HandLandmark,
  thumbIp: HandLandmark,
  thumbMcp: HandLandmark,
  wrist: HandLandmark
): boolean {
  const distWristToTip = calculateDistance(wrist, thumbTip);
  const distWristToIp = calculateDistance(wrist, thumbIp);
  const distMcpToTip = calculateDistance(thumbMcp, thumbTip);
  const distMcpToIp = calculateDistance(thumbMcp, thumbIp);
  return distWristToTip > distWristToIp * 1.08 && distMcpToTip > distMcpToIp * 1.15;
}

/**
 * Classifies primary air-writing gestures:
 * 1. pinch: Thumb and Index tips close (< threshold)
 * 2. v_sign: Index & Middle extended, Ring & Pinky curled (Peace sign)
 * 3. thumbs_up: Thumb pointing upward, other 4 fingers curled
 * 4. open_palm: All 5 fingers extended outward
 * 5. closed_fist: All fingers curled into palm
 * 6. pointing: Only Index extended (aiming / hover)
 */
export function classifyHandGesture(
  landmarks: HandLandmark[],
  pinchThreshold = 0.055
): HandGesture {
  if (!landmarks || landmarks.length < 21) {
    return 'none';
  }

  const wrist = landmarks[MEDIAPIPE_LANDMARKS.WRIST];
  const thumbTip = landmarks[MEDIAPIPE_LANDMARKS.THUMB_TIP];
  const thumbIp = landmarks[MEDIAPIPE_LANDMARKS.THUMB_IP];
  const thumbMcp = landmarks[MEDIAPIPE_LANDMARKS.THUMB_MCP];

  const indexTip = landmarks[MEDIAPIPE_LANDMARKS.INDEX_FINGER_TIP];
  const indexPip = landmarks[MEDIAPIPE_LANDMARKS.INDEX_FINGER_PIP];
  const indexMcp = landmarks[MEDIAPIPE_LANDMARKS.INDEX_FINGER_MCP];

  const middleTip = landmarks[MEDIAPIPE_LANDMARKS.MIDDLE_FINGER_TIP];
  const middlePip = landmarks[MEDIAPIPE_LANDMARKS.MIDDLE_FINGER_PIP];
  const middleMcp = landmarks[MEDIAPIPE_LANDMARKS.MIDDLE_FINGER_MCP];

  const ringTip = landmarks[MEDIAPIPE_LANDMARKS.RING_FINGER_TIP];
  const ringPip = landmarks[MEDIAPIPE_LANDMARKS.RING_FINGER_PIP];
  const ringMcp = landmarks[MEDIAPIPE_LANDMARKS.RING_FINGER_MCP];

  const pinkyTip = landmarks[MEDIAPIPE_LANDMARKS.PINKY_TIP];
  const pinkyPip = landmarks[MEDIAPIPE_LANDMARKS.PINKY_PIP];
  const pinkyMcp = landmarks[MEDIAPIPE_LANDMARKS.PINKY_MCP];

  const handScale = calculateHandScale(wrist, middleMcp);
  const pinchDist = calculateDistance3D(thumbTip, indexTip) * (0.22 / handScale);
  const isPinch = pinchDist <= pinchThreshold;

  const indexExt = isFingerExtended(indexTip, indexPip, indexMcp, wrist);
  const middleExt = isFingerExtended(middleTip, middlePip, middleMcp, wrist);
  const ringExt = isFingerExtended(ringTip, ringPip, ringMcp, wrist);
  const pinkyExt = isFingerExtended(pinkyTip, pinkyPip, pinkyMcp, wrist);
  const thumbExt = isThumbExtended(thumbTip, thumbIp, thumbMcp, wrist);

  // 1. Pinch to draw takes precedence when drawing
  if (isPinch) {
    return 'pinch';
  }

  // 2. Open palm: 4 or 5 fingers extended
  const extendedCount = [indexExt, middleExt, ringExt, pinkyExt].filter(Boolean).length;
  if (extendedCount === 4 && thumbExt) {
    return 'open_palm';
  }

  // 3. Peace / V-Sign: Index and Middle extended, Ring and Pinky curled
  if (indexExt && middleExt && !ringExt && !pinkyExt) {
    return 'v_sign';
  }

  const thumbRestingOnPalm = calculateDistance3D(thumbTip, indexMcp) < handScale * 1.05;
  if (pinkyExt && !indexExt && !middleExt && !ringExt && (!thumbExt || thumbRestingOnPalm)) {
    return 'pinky_up';
  }

  // 4. Thumbs Up: Thumb extended upward, other 4 fingers curled
  if (thumbExt && thumbTip.y < wrist.y - 0.08 && !indexExt && !middleExt && !ringExt && !pinkyExt) {
    return 'thumbs_up';
  }

  // 5. Fist: No extended fingers
  if (!indexExt && !middleExt && !ringExt && !pinkyExt) {
    return 'closed_fist';
  }

  // 6. Pointing: Only Index extended
  if (indexExt && !middleExt && !ringExt && !pinkyExt) {
    return 'pointing';
  }

  return 'none';
}

/**
 * Maps normalized camera coordinates (0.0 to 1.0) to canvas pixel coordinates
 * with optional horizontal mirroring for natural intuitive handwriting
 */
export function mapCameraToCanvas(
  normalizedPoint: { x: number; y: number },
  canvasWidth: number,
  canvasHeight: number,
  mirror = true
): Point2D {
  const x = mirror ? (1 - normalizedPoint.x) * canvasWidth : normalizedPoint.x * canvasWidth;
  const y = normalizedPoint.y * canvasHeight;
  return {
    x: Math.max(0, Math.min(canvasWidth, x)),
    y: Math.max(0, Math.min(canvasHeight, y)),
  };
}
