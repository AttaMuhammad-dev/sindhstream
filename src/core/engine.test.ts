import test from 'node:test';
import assert from 'node:assert/strict';
import { OneEuroFilter, PointOneEuroFilter } from './oneEuroFilter';
import { AirWriteStateMachine } from './stateMachine';
import { GestureEngine } from './gestureEngine';
import { HandLandmark, UserSettings, GestureBindingConfig } from '../types';

test('OneEuroFilter dampens jitter when speed is low and adapts cutoff at high speed', () => {
  const filter = new OneEuroFilter(1.0, 0.007);
  let time = 1000;

  // Step 1: Low speed noisy values around 100
  const f1 = filter.filter(100, time);
  time += 16;
  const f2 = filter.filter(100.4, time);
  time += 16;
  const f3 = filter.filter(99.6, time);

  // The filtered values should be closely clamped around 100
  assert.ok(Math.abs(f2 - 100) < 0.4);
  assert.ok(Math.abs(f3 - 100) < 0.4);

  // Step 2: Sudden high speed jump to 200
  time += 16;
  const fHigh = filter.filter(200, time);
  // High speed should adapt cutoff dynamically so movement responds quickly
  assert.ok(fHigh > 105);
});

test('PointOneEuroFilter filters 2D points accurately', () => {
  const pointFilter = new PointOneEuroFilter(1.0, 0.007);
  const p1 = pointFilter.filter({ x: 50, y: 50 }, 1000);
  assert.equal(p1.x, 50);
  assert.equal(p1.y, 50);

  const p2 = pointFilter.filter({ x: 51, y: 49 }, 1016);
  assert.ok(Math.abs(p2.x - 50.5) < 0.5);
  assert.ok(Math.abs(p2.y - 49.5) < 0.5);
});

test('AirWriteStateMachine defines exact transitions between all 6 states', () => {
  const sm = new AirWriteStateMachine('IDLE');
  assert.equal(sm.getState(), 'IDLE');
  assert.equal(sm.canDraw(), false);

  // IDLE -> TRACKING
  let res = sm.transition('HAND_DETECTED');
  assert.equal(res.allowed, true);
  assert.equal(sm.getState(), 'TRACKING');
  assert.equal(sm.canHoverAim(), true);

  // TRACKING -> WRITING (Pen down)
  res = sm.transition('PEN_DOWN');
  assert.equal(res.allowed, true);
  assert.equal(sm.getState(), 'WRITING');
  assert.equal(sm.canDraw(), true);

  // WRITING -> TRACKING (Pen up)
  res = sm.transition('PEN_UP');
  assert.equal(res.allowed, true);
  assert.equal(sm.getState(), 'TRACKING');
  assert.equal(sm.canDraw(), false);

  // TRACKING -> PAUSED (Open palm)
  res = sm.transition('TRIGGER_PAUSE');
  assert.equal(res.allowed, true);
  assert.equal(sm.getState(), 'PAUSED');
  assert.equal(sm.isPaused(), true);

  // PAUSED -> TRACKING (Resume)
  res = sm.transition('RESUME_TRACKING');
  assert.equal(res.allowed, true);
  assert.equal(sm.getState(), 'TRACKING');

  // TRACKING -> PRESENTATION (Fist)
  res = sm.transition('TRIGGER_PRESENTATION');
  assert.equal(res.allowed, true);
  assert.equal(sm.getState(), 'PRESENTATION');
  assert.equal(sm.isPresentation(), true);

  // PRESENTATION -> TRACKING
  res = sm.transition('EXIT_PRESENTATION');
  assert.equal(res.allowed, true);
  assert.equal(sm.getState(), 'TRACKING');

  // TRACKING -> SELECTING
  res = sm.transition('TRIGGER_SELECTION');
  assert.equal(res.allowed, true);
  assert.equal(sm.getState(), 'SELECTING');
  assert.equal(sm.canErase(), true);

  // Safe termination: HAND_LOST transitions to IDLE
  res = sm.transition('HAND_LOST');
  assert.equal(res.allowed, true);
  assert.equal(sm.getState(), 'IDLE');
});

test('GestureEngine pen-down/pen-up hysteresis prevents boundary chatter', () => {
  const engine = new GestureEngine();
  const mockSettings: UserSettings = {
    dominantHand: 'Right',
    pinchSensitivity: 0.05,
    smoothingFactor: 0.35,
    oneEuroMinCutoff: 1.0,
    oneEuroBeta: 0.007,
    mirrorWebcam: true,
    showLandmarks: true,
    showWebcamHUD: true,
    cameraResolution: '720p',
    academicLevel: 'Undergraduate',
    hapticFeedback: true,
    autoSaveInterval: 15,
    gestureBindings: {
      pinchAction: 'draw',
      pointingAction: 'aim_hover',
      openPalmAction: 'pause',
      closedFistAction: 'laser_presentation',
      swipeLeftAction: 'prev_page',
      swipeRightAction: 'next_page',
      twoHandZoomAction: 'zoom',
      vSignAction: 'erase_select',
      thumbsUpAction: 'ai_solve',
      pinchTriggerMode: 'thumb_index',
      hysteresisRatio: 1.35,
      swipeVelocityThreshold: 0.8,
      cooldownMs: 350,
      twoHandZoomSensitivity: 1.0,
    },
  };

  // Build landmarks where wrist is at (0.5, 0.8), middle MCP at (0.5, 0.58) (refScale 0.22)
  const pinchLandmarks: HandLandmark[] = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  pinchLandmarks[0] = { x: 0.5, y: 0.8, z: 0 };  // Wrist
  pinchLandmarks[9] = { x: 0.5, y: 0.58, z: 0 }; // Middle MCP (distance 0.22 = refScale)
  pinchLandmarks[5] = { x: 0.5, y: 0.6, z: 0 };  // Index MCP
  pinchLandmarks[6] = { x: 0.5, y: 0.5, z: 0 };  // Index PIP
  pinchLandmarks[4] = { x: 0.5, y: 0.3, z: 0 };  // Thumb tip
  pinchLandmarks[8] = { x: 0.52, y: 0.31, z: 0 }; // Index tip close (dist ~0.022)

  const r1 = engine.processFrame([pinchLandmarks], 1200, 800, mockSettings, 1000);
  assert.equal(r1.isPenDown, true);
  assert.equal(r1.strokeStarted, true);
  assert.equal(r1.interactionState, 'WRITING');

  // Slightly open fingers into hysteresis gap: distance 0.058 (between 0.050 and 0.0675)
  pinchLandmarks[8] = { x: 0.558, y: 0.3, z: 0 };
  const r2 = engine.processFrame([pinchLandmarks], 1200, 800, mockSettings, 1016);
  // Due to hysteresis, pen remains down!
  assert.equal(r2.isPenDown, true);

  // Open fingers beyond exit threshold (0.05 * 1.35 = 0.0675)
  pinchLandmarks[8] = { x: 0.58, y: 0.3, z: 0 };
  const r3 = engine.processFrame([pinchLandmarks], 1200, 800, mockSettings, 1032);
  assert.equal(r3.isPenDown, false);
  assert.equal(r3.strokeTerminated, true);
  assert.equal(r3.interactionState, 'TRACKING');
});

test('GestureEngine detects v_sign (Peace Sign) and thumbs_up gestures accurately', () => {
  const engine = new GestureEngine();
  const mockSettings: UserSettings = {
    dominantHand: 'Right',
    pinchSensitivity: 0.05,
    smoothingFactor: 0.35,
    oneEuroMinCutoff: 1.0,
    oneEuroBeta: 0.007,
    mirrorWebcam: true,
    showLandmarks: true,
    showWebcamHUD: true,
    cameraResolution: '720p',
    academicLevel: 'Undergraduate',
    hapticFeedback: true,
    autoSaveInterval: 15,
    gestureBindings: {
      pinchAction: 'draw',
      pointingAction: 'aim_hover',
      vSignAction: 'erase_select',
      thumbsUpAction: 'ai_solve',
      openPalmAction: 'pause',
      closedFistAction: 'laser_presentation',
      swipeLeftAction: 'prev_page',
      swipeRightAction: 'next_page',
      twoHandZoomAction: 'zoom',
      pinchTriggerMode: 'thumb_index',
      hysteresisRatio: 1.35,
      swipeVelocityThreshold: 0.8,
      cooldownMs: 350,
      twoHandZoomSensitivity: 0.008,
    },
  };

  // Build landmarks for V-sign: Index & Middle extended upward, Ring & Pinky curled
  const vSignLandmarks: HandLandmark[] = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  vSignLandmarks[0] = { x: 0.5, y: 0.8, z: 0 };  // Wrist
  vSignLandmarks[9] = { x: 0.5, y: 0.58, z: 0 }; // Middle MCP
  vSignLandmarks[4] = { x: 0.45, y: 0.6, z: 0 }; // Thumb curled in
  // Index extended
  vSignLandmarks[5] = { x: 0.45, y: 0.6, z: 0 };
  vSignLandmarks[6] = { x: 0.45, y: 0.45, z: 0 };
  vSignLandmarks[8] = { x: 0.42, y: 0.25, z: 0 };
  // Middle extended
  vSignLandmarks[9] = { x: 0.52, y: 0.58, z: 0 };
  vSignLandmarks[10] = { x: 0.52, y: 0.45, z: 0 };
  vSignLandmarks[12] = { x: 0.54, y: 0.25, z: 0 };
  // Ring curled
  vSignLandmarks[13] = { x: 0.58, y: 0.6, z: 0 };
  vSignLandmarks[14] = { x: 0.58, y: 0.65, z: 0 };
  vSignLandmarks[16] = { x: 0.58, y: 0.68, z: 0 };
  // Pinky curled
  vSignLandmarks[17] = { x: 0.64, y: 0.65, z: 0 };
  vSignLandmarks[18] = { x: 0.64, y: 0.7, z: 0 };
  vSignLandmarks[20] = { x: 0.64, y: 0.72, z: 0 };

  const resV = engine.processFrame([vSignLandmarks], 1200, 800, mockSettings, 1000);
  assert.equal(resV.gesture, 'v_sign');
  assert.equal(resV.mappedAction, 'erase_select');
});

test('GestureEngine detects two_hand_zoom when 2 hands distance changes', () => {
  const engine = new GestureEngine();
  const mockSettings: UserSettings = {
    dominantHand: 'Right',
    pinchSensitivity: 0.05,
    smoothingFactor: 0.35,
    oneEuroMinCutoff: 1.0,
    oneEuroBeta: 0.007,
    mirrorWebcam: true,
    showLandmarks: true,
    showWebcamHUD: true,
    cameraResolution: '720p',
    academicLevel: 'Undergraduate',
    hapticFeedback: true,
    autoSaveInterval: 15,
    gestureBindings: {
      pinchAction: 'draw',
      pointingAction: 'aim_hover',
      openPalmAction: 'pause',
      closedFistAction: 'laser_presentation',
      swipeLeftAction: 'prev_page',
      swipeRightAction: 'next_page',
      twoHandZoomAction: 'zoom',
      vSignAction: 'erase_select',
      thumbsUpAction: 'ai_solve',
      pinchTriggerMode: 'thumb_index',
      hysteresisRatio: 1.35,
      swipeVelocityThreshold: 0.8,
      cooldownMs: 350,
      twoHandZoomSensitivity: 1.0,
    },
  };

  const hand1: HandLandmark[] = Array.from({ length: 21 }, () => ({ x: 0.3, y: 0.5, z: 0 }));
  const hand2: HandLandmark[] = Array.from({ length: 21 }, () => ({ x: 0.7, y: 0.5, z: 0 }));

  // Frame 1
  engine.processFrame([hand1, hand2], 1200, 800, mockSettings, 1000);

  // Frame 2: Hands spread apart from 0.4 distance to 0.55 distance
  hand1[0] = { x: 0.2, y: 0.5, z: 0 };
  hand2[0] = { x: 0.75, y: 0.5, z: 0 };
  const rZoom = engine.processFrame([hand1, hand2], 1200, 800, mockSettings, 1032);

  assert.equal(rZoom.gesture, 'two_hand_zoom');
  assert.ok((rZoom.zoomScaleDelta || 0) > 0.01);
});

test('GestureEngine maps configurable bindings to intended actions', () => {
  const engine = new GestureEngine();
  const customBindings: GestureBindingConfig = {
    pinchAction: 'draw',
    pointingAction: 'aim_hover',
    openPalmAction: 'erase_select', // Rebound open palm to erase
    closedFistAction: 'clear_board', // Rebound fist to clear
    swipeLeftAction: 'undo',
    swipeRightAction: 'next_page',
    twoHandZoomAction: 'zoom',
    vSignAction: 'erase_select',
    thumbsUpAction: 'ai_solve',
    pinchTriggerMode: 'thumb_index',
    hysteresisRatio: 1.35,
    swipeVelocityThreshold: 0.8,
    cooldownMs: 350,
    twoHandZoomSensitivity: 1.0,
  };

  assert.equal(engine.resolveAction('open_palm', customBindings), 'erase_select');
  assert.equal(engine.resolveAction('closed_fist', customBindings), 'clear_board');
  assert.equal(engine.resolveAction('swipe_left', customBindings), 'undo');
  assert.equal(engine.resolveAction('pinch', customBindings), 'draw');
});
