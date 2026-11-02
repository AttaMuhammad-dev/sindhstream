/**
 * Centralized Gesture Engine and Air-Writing Pipeline
 * Integrates gesture classification, One Euro Filter adaptive smoothing,
 * hysteresis pen-down/pen-up detection, dynamic interpolation, and state machine orchestration.
 */

import {
  HandGesture,
  HandLandmark,
  Point2D,
  UserSettings,
  GestureBindingConfig,
  GestureAction,
  InteractionState,
} from '../types';
import { PointOneEuroFilter } from './oneEuroFilter';
import { AirWriteStateMachine } from './stateMachine';
import { calculateDistance, isFingerExtended, MEDIAPIPE_LANDMARKS } from '../utils/gestureMath';

export interface GestureEngineResult {
  gesture: HandGesture;
  mappedAction: GestureAction;
  interactionState: InteractionState;
  rawPoint: Point2D | null;
  smoothedPoint: Point2D | null;
  interpolatedPoints: Point2D[];
  pinchDistance: number;
  isPinching: boolean;
  isPenDown: boolean;
  isPanning: boolean;
  strokeStarted: boolean;
  strokeTerminated: boolean;
  zoomScaleDelta?: number;
}

export class GestureEngine {
  private stateMachine: AirWriteStateMachine;
  private oneEuroFilter: PointOneEuroFilter;
  private previousPoint: Point2D | null = null;
  private isCurrentlyPenDown = false;
  private lastGestureTimestamp = 0;
  private lastSwipeCheckTime = 0;
  private recentXPositions: { x: number; time: number }[] = [];
  private lastTwoHandDistance: number | null = null;

  constructor(settings?: UserSettings) {
    this.stateMachine = new AirWriteStateMachine('IDLE');
    const minCutoff = settings?.oneEuroMinCutoff ?? 1.0;
    const beta = settings?.oneEuroBeta ?? 0.007;
    this.oneEuroFilter = new PointOneEuroFilter(minCutoff, beta);
  }

  public getStateMachine(): AirWriteStateMachine {
    return this.stateMachine;
  }

  public updateFilterParams(minCutoff: number, beta: number): void {
    this.oneEuroFilter.updateParameters(minCutoff, beta);
  }

  /**
   * Reset the engine when tracking is lost
   */
  public reset(): void {
    this.stateMachine.reset();
    this.oneEuroFilter.reset();
    this.previousPoint = null;
    this.isCurrentlyPenDown = false;
    this.recentXPositions = [];
    this.lastTwoHandDistance = null;
  }

  /**
   * Evaluates hand landmarks to classify current hand gesture
   */
  public classifyGestures(
    landmarksList: HandLandmark[][],
    settings: UserSettings,
    currentTime = performance.now()
  ): { gesture: HandGesture; pinchDistance: number; isPinching: boolean; zoomDelta?: number } {
    if (!landmarksList || landmarksList.length === 0 || !landmarksList[0] || landmarksList[0].length < 21) {
      return { gesture: 'none', pinchDistance: 1, isPinching: false };
    }

    // Two hands always take precedence, so a second hand can never accidentally
    // turn a zoom movement into a single-hand pinch or page action.
    if (landmarksList.length >= 2 && landmarksList[1] && landmarksList[1].length >= 21) {
      const h1Wrist = landmarksList[0][MEDIAPIPE_LANDMARKS.WRIST];
      const h2Wrist = landmarksList[1][MEDIAPIPE_LANDMARKS.WRIST];
      const currentHandDistance = calculateDistance(h1Wrist, h2Wrist);

      let zoomDelta = 0;
      if (this.lastTwoHandDistance !== null) {
        zoomDelta = currentHandDistance - this.lastTwoHandDistance;
      }
      this.lastTwoHandDistance = currentHandDistance;

      const zoomThreshold = settings.gestureBindings?.twoHandZoomSensitivity ?? 0.008;
      return {
        gesture: 'two_hand_zoom',
        pinchDistance: 1,
        isPinching: false,
        zoomDelta: Math.abs(zoomDelta) >= zoomThreshold ? zoomDelta : 0,
      };
    } else {
      this.lastTwoHandDistance = null;
    }

    const landmarks = landmarksList[0];
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

    // Scale-invariant palm normalization: ensures consistent pinch detection across any distance from camera
    const handScale = Math.max(0.06, calculateDistance(wrist, middleMcp));

    // Choose pinch fingers based on user trigger mode:
    let tip1 = thumbTip;
    let tip2 = indexTip;
    if (settings.gestureBindings?.pinchTriggerMode === 'thumb_middle') {
      tip2 = middleTip;
    }

    // 3D-aware distance
    const dx = tip1.x - tip2.x;
    const dy = tip1.y - tip2.y;
    const dz = ((tip1.z || 0) - (tip2.z || 0)) * 0.4;
    const rawPinchDistance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const pinchDistance = rawPinchDistance * (0.22 / handScale);

    // Hysteresis: If already drawing, hold pinch until exit threshold
    const hysteresis = settings.gestureBindings?.hysteresisRatio ?? 1.35;
    const indexExt = isFingerExtended(indexTip, indexPip, indexMcp, wrist);
    const middleExt = isFingerExtended(middleTip, middlePip, middleMcp, wrist);
    const ringExt = isFingerExtended(ringTip, ringPip, ringMcp, wrist);
    const pinkyExt = isFingerExtended(pinkyTip, pinkyPip, pinkyMcp, wrist);
    const thumbExt = calculateDistance(wrist, thumbTip) > calculateDistance(wrist, thumbIp) * 1.08 &&
                     calculateDistance(thumbMcp, thumbTip) > calculateDistance(thumbMcp, thumbIp) * 1.15;
    const extendedFingers = [indexExt, middleExt, ringExt, pinkyExt].filter(Boolean).length;
    const isOpenPalm = extendedFingers === 4 && thumbExt;

    const effectiveThreshold = this.isCurrentlyPenDown
      ? settings.pinchSensitivity * hysteresis
      : settings.pinchSensitivity;
    const pinchMode = settings.gestureBindings?.pinchTriggerMode ?? 'thumb_index';
    const isIndexHold = indexExt && !middleExt && !ringExt && !pinkyExt;
    const isPinching = pinchMode === 'index_hold' ? isIndexHold : pinchDistance <= effectiveThreshold;

    // Swipes require an open palm, which separates intentional page flicks
    // from normal pointer movement and air-writing strokes.
    if (isOpenPalm) {
      this.recentXPositions.push({ x: indexTip.x, time: currentTime });
      this.recentXPositions = this.recentXPositions.filter((p) => currentTime - p.time <= 350);
    } else {
      this.recentXPositions = [];
    }

    const cooldown = settings.gestureBindings?.cooldownMs ?? 350;
    const canTriggerSwipe = currentTime - this.lastGestureTimestamp > cooldown;

    if (isOpenPalm && canTriggerSwipe && this.recentXPositions.length >= 4) {
      const oldest = this.recentXPositions[0];
      const newest = this.recentXPositions[this.recentXPositions.length - 1];
      const dt = (newest.time - oldest.time) / 1000;
      const swipeDx = newest.x - oldest.x;
      const velocity = dt > 0 ? swipeDx / dt : 0;
      const swipeThreshold = settings.gestureBindings?.swipeVelocityThreshold ?? 0.8;

      // Note: in mirrored mode, moving hand right moves x on screen left
      if (Math.abs(velocity) >= swipeThreshold && Math.abs(swipeDx) > 0.12) {
        this.lastGestureTimestamp = currentTime;
        this.recentXPositions = [];

        if (velocity < 0) {
          return {
            gesture: settings.mirrorWebcam ? 'swipe_right' : 'swipe_left',
            pinchDistance,
            isPinching: false,
          };
        } else {
          return {
            gesture: settings.mirrorWebcam ? 'swipe_left' : 'swipe_right',
            pinchDistance,
            isPinching: false,
          };
        }
      }
    }

    // 2. Pinch (Write) takes precedence
    if (isPinching) {
      return { gesture: 'pinch', pinchDistance, isPinching: true };
    }

    // 3. Open Palm (All 4 non-thumb fingers extended outward)
    if (isOpenPalm) {
      return { gesture: 'open_palm', pinchDistance, isPinching: false };
    }

    // 4. Peace / V-Sign: Index and Middle extended, Ring and Pinky curled
    if (indexExt && middleExt && !ringExt && !pinkyExt) {
      return { gesture: 'v_sign', pinchDistance, isPinching: false };
    }

    // 5. Thumbs Up: Thumb pointing upward, other 4 fingers curled
    if (thumbExt && thumbTip.y < wrist.y - 0.08 && !indexExt && !middleExt && !ringExt && !pinkyExt) {
      return { gesture: 'thumbs_up', pinchDistance, isPinching: false };
    }

    // 6. Closed Fist (All 4 non-thumb fingers curled)
    if (extendedFingers === 0) {
      return { gesture: 'closed_fist', pinchDistance, isPinching: false };
    }

    // 7. Index Extended (Aim / Hover)
    if (indexExt && !middleExt && !ringExt && !pinkyExt) {
      return { gesture: 'pointing', pinchDistance, isPinching: false };
    }

    return { gesture: 'none', pinchDistance, isPinching: false };
  }

  /**
   * Process a single video frame with hand landmarks through the full pipeline
   */
  public processFrame(
    landmarksList: HandLandmark[][],
    canvasWidth: number,
    canvasHeight: number,
    settings: UserSettings,
    currentTime = performance.now()
  ): GestureEngineResult {
    // If no landmarks detected, terminate active stroke cleanly and transition to IDLE
    if (!landmarksList || landmarksList.length === 0 || !landmarksList[0] || landmarksList[0].length < 21) {
      const strokeTerminated = this.isCurrentlyPenDown;
      this.isCurrentlyPenDown = false;
      this.previousPoint = null;
      this.oneEuroFilter.reset();
      this.stateMachine.transition('HAND_LOST');

      return {
        gesture: 'none',
        mappedAction: 'none',
        interactionState: this.stateMachine.getState(),
        rawPoint: null,
        smoothedPoint: null,
        interpolatedPoints: [],
        pinchDistance: 1,
        isPinching: false,
        isPenDown: false,
        isPanning: false,
        strokeStarted: false,
        strokeTerminated,
      };
    }

    // Hand is present
    if (this.stateMachine.getState() === 'IDLE') {
      this.stateMachine.transition('HAND_DETECTED');
    }

    // 1. Classify Gestures
    const { gesture, pinchDistance, isPinching, zoomDelta } = this.classifyGestures(
      landmarksList,
      settings,
      currentTime
    );

    // 2. Map Gesture to Action via Configurable Bindings
    const mappedAction = this.resolveAction(gesture, settings.gestureBindings);

    const state = this.stateMachine.getState();
    if (
      (state === 'PAUSED' && mappedAction !== 'pause') ||
      (state === 'PRESENTATION' && mappedAction !== 'laser_presentation') ||
      (state === 'SELECTING' && mappedAction !== 'erase_select')
    ) {
      this.stateMachine.transition('RESUME_TRACKING');
    }

    // Pen state follows the configured action. The classifier itself applies
    // pinch hysteresis, while other gestures can also be deliberately bound to draw.
    let strokeStarted = false;
    let strokeTerminated = false;
    const shouldPenDown = mappedAction === 'draw' && gesture !== 'none';

    if (!this.isCurrentlyPenDown && shouldPenDown) {
      this.isCurrentlyPenDown = true;
      strokeStarted = true;
      this.stateMachine.transition('PEN_DOWN');
    } else if (this.isCurrentlyPenDown && !shouldPenDown) {
      this.isCurrentlyPenDown = false;
      strokeTerminated = true;
      this.stateMachine.transition('PEN_UP');
    }

    // Update state transitions for other actions
    if (mappedAction === 'pause') {
      this.stateMachine.transition('TRIGGER_PAUSE');
    } else if (mappedAction === 'laser_presentation') {
      this.stateMachine.transition('TRIGGER_PRESENTATION');
    } else if (mappedAction === 'erase_select') {
      this.stateMachine.transition('TRIGGER_SELECTION');
    } else if (mappedAction === 'aim_hover' && this.stateMachine.isPaused()) {
      this.stateMachine.transition('RESUME_TRACKING');
    }

    // 4. Map fingertip / contact centroid to Canvas coordinates
    const indexTip = landmarksList[0][MEDIAPIPE_LANDMARKS.INDEX_FINGER_TIP];
    const thumbTip = landmarksList[0][MEDIAPIPE_LANDMARKS.THUMB_TIP];

    // When writing, smoothly blend towards contact centroid to eliminate pinch hop
    const contactX = indexTip.x * 0.65 + thumbTip.x * 0.35;
    const contactY = indexTip.y * 0.65 + thumbTip.y * 0.35;
    const pinchContactActive = this.isCurrentlyPenDown && isPinching &&
      settings.gestureBindings?.pinchTriggerMode !== 'index_hold';
    const targetX = pinchContactActive ? contactX : indexTip.x;
    const targetY = pinchContactActive ? contactY : indexTip.y;

    const rawX = settings.mirrorWebcam ? (1 - targetX) * canvasWidth : targetX * canvasWidth;
    const rawY = targetY * canvasHeight;

    const rawPoint: Point2D = {
      x: Math.max(0, Math.min(canvasWidth, rawX)),
      y: Math.max(0, Math.min(canvasHeight, rawY)),
      pressure: Math.max(
        0.2,
        Math.min(1.0, 1.0 - pinchDistance / Math.max(0.01, settings.pinchSensitivity * (settings.gestureBindings?.hysteresisRatio ?? 1.35)))
      ),
      time: currentTime,
    };

    // 5. Adaptive Smoothing via One Euro Filter
    const smoothedPoint = this.oneEuroFilter.filter(rawPoint, currentTime);

    // 6. Distance-based interpolation to eliminate jagged lines during fast air handwriting
    const interpolatedPoints: Point2D[] = [];
    if (this.isCurrentlyPenDown) {
      if (this.previousPoint) {
        const dX = smoothedPoint.x - this.previousPoint.x;
        const dY = smoothedPoint.y - this.previousPoint.y;
        const dist = Math.hypot(dX, dY);
        const maxStep = 8; // Max distance between adjacent points in pixels for ultra-smooth curves

        if (dist > maxStep && dist < 350) {
          // Linear subdivision between previous and current smoothed point
          const steps = Math.floor(dist / maxStep);
          for (let i = 1; i < steps; i++) {
            const t = i / steps;
            interpolatedPoints.push({
              x: this.previousPoint.x + dX * t,
              y: this.previousPoint.y + dY * t,
              pressure: smoothedPoint.pressure,
              time: currentTime,
            });
          }
        }
      }
      interpolatedPoints.push(smoothedPoint);
      this.previousPoint = smoothedPoint;
    } else {
      this.previousPoint = null;
    }

    return {
      gesture,
      mappedAction,
      interactionState: this.stateMachine.getState(),
      rawPoint,
      smoothedPoint,
      interpolatedPoints,
      pinchDistance,
      isPinching,
      isPenDown: this.isCurrentlyPenDown,
      isPanning: mappedAction === 'pan',
      strokeStarted,
      strokeTerminated,
      zoomScaleDelta: zoomDelta,
    };
  }

  /**
   * Resolve configurable bindings to actions
   */
  public resolveAction(
    gesture: HandGesture,
    bindings?: GestureBindingConfig
  ): GestureAction {
    if (!bindings) {
      switch (gesture) {
        case 'none':
          return 'none';
        case 'pinch':
          return 'draw';
        case 'v_sign':
          return 'erase_select';
        case 'thumbs_up':
          return 'ai_solve';
        case 'open_palm':
          return 'pan';
        case 'closed_fist':
          return 'pause';
        case 'swipe_left':
          return 'prev_page';
        case 'swipe_right':
          return 'next_page';
        case 'two_hand_zoom':
          return 'zoom';
        case 'pointing':
          return 'laser_presentation';
        default:
          return 'aim_hover';
      }
    }

    switch (gesture) {
      case 'none':
        return 'none';
      case 'pinch':
        return bindings.pinchAction;
      case 'v_sign':
        return bindings.vSignAction || 'erase_select';
      case 'thumbs_up':
        return bindings.thumbsUpAction || 'ai_solve';
      case 'open_palm':
        return bindings.openPalmAction;
      case 'closed_fist':
        return bindings.closedFistAction;
      case 'swipe_left':
        return bindings.swipeLeftAction;
      case 'swipe_right':
        return bindings.swipeRightAction;
      case 'two_hand_zoom':
        return bindings.twoHandZoomAction;
      case 'pointing':
      default:
        return bindings.pointingAction;
    }
  }
}
