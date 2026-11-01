/**
 * GestEra camera lifecycle and gesture pipeline.
 * MediaPipe inference runs in a module worker so it does not block the board UI.
 */

import type { HandTrackingState, UserSettings, Point2D } from '../types';
import { GestureEngine, type GestureEngineResult } from '../core/gestureEngine';
import type { HandTrackingWorkerRequest, HandTrackingWorkerResponse } from './handTrackingProtocol';

export type HandTrackingCallback = (state: HandTrackingState, result?: GestureEngineResult) => void;

const DEFAULT_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const MAX_INFERENCE_FPS = 24;
const INFERENCE_WIDTH = 640;

class HandTrackingService {
  private worker: Worker | null = null;
  private loadModelPromise: Promise<boolean> | null = null;
  private resolveModelLoad: ((loaded: boolean) => void) | null = null;
  private modelLoadTimeout: ReturnType<typeof setTimeout> | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private animationFrameId: number | null = null;
  private callbacks: Set<HandTrackingCallback> = new Set();
  private settings: UserSettings | null = null;
  private canvasDimensions = { width: 1400, height: 850 };
  private frameInFlight = false;
  private workerConfidence = 0.55;
  private lastVideoTime = -1;
  private lastFrameTimestamp = 0;
  private lastFrameSentAt = 0;
  private fpsWindowStart = performance.now();
  private fpsFrameCount = 0;
  private currentFps = 0;

  public engine = new GestureEngine();

  public state: HandTrackingState = {
    isSupported: typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia,
    isModelLoaded: false,
    isTrackingActive: false,
    cameraStatus: 'idle',
    detectedHand: 'None',
    confidence: 0,
    gesture: 'none',
    interactionState: 'IDLE',
    rawPoint: null,
    smoothedPoint: null,
    pinchDistance: 1,
    isPinching: false,
    isPenDown: false,
    fps: 0,
    dominantHand: 'Right',
  };

  public subscribe(cb: HandTrackingCallback): () => void {
    this.callbacks.add(cb);
    cb({ ...this.state });
    return () => this.callbacks.delete(cb);
  }

  private notify(result?: GestureEngineResult) {
    this.callbacks.forEach((cb) => cb({ ...this.state }, result));
  }

  private setLoadError(message: string) {
    if (this.modelLoadTimeout) clearTimeout(this.modelLoadTimeout);
    this.modelLoadTimeout = null;
    this.worker?.terminate();
    this.worker = null;
    this.state.isModelLoaded = false;
    this.state.isTrackingActive = false;
    this.state.cameraStatus = 'error';
    this.state.errorMessage = message;
    this.resolveModelLoad?.(false);
    this.resolveModelLoad = null;
    this.notify();
  }

  private handleWorkerMessage(message: HandTrackingWorkerResponse) {
    if (message.type === 'ready') {
      if (this.modelLoadTimeout) clearTimeout(this.modelLoadTimeout);
      this.modelLoadTimeout = null;
      this.state.isModelLoaded = true;
      delete this.state.errorMessage;
      this.resolveModelLoad?.(true);
      this.resolveModelLoad = null;
      this.notify();
      return;
    }

    if (message.type === 'error') {
      if (message.fatal) {
        this.handleWorkerFailure(message.message || 'Could not load the hand-tracking model. Check your connection and try again.');
      } else {
        this.frameInFlight = false;
        console.warn('GestEra skipped a camera frame:', message.message);
      }
      return;
    }

    this.frameInFlight = false;
    const now = message.timestamp;
    this.fpsFrameCount += 1;
    if (now - this.fpsWindowStart >= 1000) {
      this.currentFps = Math.round((this.fpsFrameCount * 1000) / (now - this.fpsWindowStart));
      this.fpsFrameCount = 0;
      this.fpsWindowStart = now;
    }

    const settings = this.settings;
    if (!settings) return;

    const hands = [...message.hands];
    const preferredHandIndex = hands.findIndex((hand) => hand.handedness === settings.dominantHand);
    if (preferredHandIndex > 0) hands.unshift(hands.splice(preferredHandIndex, 1)[0]);

    const primaryHand = hands[0];
    const landmarks = hands.map((hand) => hand.landmarks);
    const engineResult = this.engine.processFrame(
      landmarks,
      this.canvasDimensions.width,
      this.canvasDimensions.height,
      settings,
      now
    );

    this.state = {
      ...this.state,
      detectedHand: primaryHand?.handedness === 'Left' || primaryHand?.handedness === 'Right'
        ? primaryHand.handedness
        : 'None',
      confidence: Math.round((primaryHand?.confidence ?? 0) * 100),
      gesture: engineResult.gesture,
      interactionState: engineResult.interactionState,
      rawPoint: engineResult.rawPoint,
      smoothedPoint: engineResult.smoothedPoint,
      interpolatedPoints: engineResult.interpolatedPoints,
      pinchDistance: engineResult.pinchDistance,
      isPinching: engineResult.isPinching,
      isPenDown: engineResult.isPenDown,
      zoomScaleDelta: engineResult.zoomScaleDelta,
      fps: this.currentFps,
      errorMessage: undefined,
    };

    this.notify(engineResult);
  }

  private handleWorkerFailure(message: string) {
    console.error('GestEra hand-tracking worker failed:', message);
    this.stopCameraResources();
    this.setLoadError(message || 'The hand-tracking worker stopped unexpectedly.');
  }

  /** Load the versioned, app-bundled MediaPipe runtime in a dedicated worker. */
  public async loadModel(): Promise<boolean> {
    if (this.worker && this.state.isModelLoaded) return true;
    if (this.loadModelPromise) return this.loadModelPromise;

    const pending = new Promise<boolean>((resolve) => {
      this.resolveModelLoad = resolve;
      try {
        const worker = new Worker(new URL('./handTracking.worker.ts', import.meta.url), { type: 'module' });
        this.worker = worker;
        worker.onmessage = (event: MessageEvent<HandTrackingWorkerResponse>) => this.handleWorkerMessage(event.data);
        worker.onerror = (event) => this.handleWorkerFailure(event.message);

        const modelUrl = import.meta.env.VITE_HAND_MODEL_URL || DEFAULT_MODEL_URL;
        const wasmRoot = `${import.meta.env.BASE_URL}mediapipe/wasm`;
        const request: HandTrackingWorkerRequest = {
          type: 'init',
          wasmRoot,
          modelUrl,
          confidence: this.workerConfidence,
        };
        worker.postMessage(request);
        this.modelLoadTimeout = setTimeout(() => {
          this.handleWorkerFailure('Hand tracking took too long to load. Check the internet connection and try again.');
        }, 45_000);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not start the hand-tracking worker.';
        this.setLoadError(message);
      }
    });

    this.loadModelPromise = pending;
    try {
      return await pending;
    } finally {
      if (this.loadModelPromise === pending) this.loadModelPromise = null;
    }
  }

  /** Call after preference edits so active camera inference immediately uses them. */
  public updateSettings(settings: UserSettings) {
    const confidence = settings.handDetectionConfidence ?? 0.55;
    const confidenceChanged = this.workerConfidence !== confidence;
    this.settings = settings;
    this.state.dominantHand = settings.dominantHand;
    const effectiveCutoff = settings.oneEuroMinCutoff * (0.35 + settings.smoothingFactor * 1.3);
    this.engine.updateFilterParams(effectiveCutoff, settings.oneEuroBeta);
    this.workerConfidence = confidence;
    if (confidenceChanged && this.worker && this.state.isModelLoaded) {
      const request: HandTrackingWorkerRequest = { type: 'confidence', value: this.workerConfidence };
      this.worker.postMessage(request);
    }
  }

  public async startTracking(
    videoEl: HTMLVideoElement,
    settings: UserSettings,
    canvasDimensions: { width: number; height: number }
  ): Promise<boolean> {
    if (this.state.isTrackingActive || this.state.cameraStatus === 'requesting') return false;
    this.videoElement = videoEl;
    this.updateSettings(settings);
    this.canvasDimensions = canvasDimensions;
    this.state.errorMessage = undefined;
    this.engine.reset();
    this.state.cameraStatus = 'requesting';
    this.notify();

    if (!navigator.mediaDevices?.getUserMedia) {
      this.state.cameraStatus = 'error';
      this.state.errorMessage = 'Camera access requires a modern browser on localhost or HTTPS.';
      this.notify();
      return false;
    }

    if (!(await this.loadModel())) return false;

    try {
      const constraints: MediaStreamConstraints = {
        audio: false,
        video: {
          width: { ideal: settings.cameraResolution === '1080p' ? 1920 : settings.cameraResolution === '480p' ? 640 : 1280 },
          height: { ideal: settings.cameraResolution === '1080p' ? 1080 : settings.cameraResolution === '480p' ? 480 : 720 },
          frameRate: { ideal: 30, max: 30 },
          facingMode: 'user',
        },
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      const openedStream = this.stream;
      openedStream.getVideoTracks().forEach((track) => {
        track.addEventListener('ended', () => {
          if (this.stream !== openedStream || !this.state.isTrackingActive) return;
          this.stopCameraResources();
          this.state.cameraStatus = 'error';
          this.state.errorMessage = 'The camera feed ended. Reconnect the camera and try again.';
          this.notify();
        });
      });
      videoEl.srcObject = this.stream;
      videoEl.muted = true;
      videoEl.playsInline = true;
      await videoEl.play();

      this.lastVideoTime = -1;
      this.lastFrameSentAt = 0;
      this.lastFrameTimestamp = 0;
      this.frameInFlight = false;
      this.fpsWindowStart = performance.now();
      this.fpsFrameCount = 0;
      this.currentFps = 0;
      this.state.cameraStatus = 'active';
      this.state.isTrackingActive = true;
      this.notify();
      this.startDetectionLoop();
      return true;
    } catch (error) {
      const cameraError = error as DOMException;
      this.stopCameraResources();
      this.state.cameraStatus = cameraError.name === 'NotAllowedError' || cameraError.name === 'PermissionDeniedError'
        ? 'denied'
        : 'error';
      this.state.isTrackingActive = false;
      this.state.errorMessage = this.state.cameraStatus === 'denied'
        ? 'Camera permission was denied. Allow camera access in your browser, then try again.'
        : cameraError.message || 'Unable to open the camera feed.';
      this.notify();
      return false;
    }
  }

  private startDetectionLoop() {
    const loop = (frameTime: number) => {
      const video = this.videoElement;
      const worker = this.worker;
      if (!this.state.isTrackingActive || !video || !worker) return;

      const ready = video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
      const newVideoFrame = video.currentTime !== this.lastVideoTime;
      const due = frameTime - this.lastFrameSentAt >= 1000 / MAX_INFERENCE_FPS;

      if (ready && newVideoFrame && due && !this.frameInFlight) {
        this.frameInFlight = true;
        this.lastVideoTime = video.currentTime;
        this.lastFrameSentAt = frameTime;
        this.lastFrameTimestamp = Math.max(performance.now(), this.lastFrameTimestamp + 1);

        void createImageBitmap(video, { resizeWidth: INFERENCE_WIDTH, resizeQuality: 'high' })
          .then((bitmap) => {
            if (!this.state.isTrackingActive || this.worker !== worker) {
              bitmap.close();
              this.frameInFlight = false;
              return;
            }
            const request: HandTrackingWorkerRequest = {
              type: 'frame',
              bitmap,
              timestamp: this.lastFrameTimestamp,
            };
            worker.postMessage(request, [bitmap]);
          })
          .catch((error) => {
            this.frameInFlight = false;
            console.warn('GestEra could not prepare a camera frame:', error);
          });
      }

      this.animationFrameId = requestAnimationFrame(loop);
    };

    this.animationFrameId = requestAnimationFrame(loop);
  }

  private stopCameraResources() {
    this.state.isTrackingActive = false;
    if (this.animationFrameId !== null) cancelAnimationFrame(this.animationFrameId);
    this.animationFrameId = null;
    this.frameInFlight = false;
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.videoElement) {
      this.videoElement.pause();
      this.videoElement.srcObject = null;
    }
  }

  public stopTracking() {
    this.stopCameraResources();
    this.state.cameraStatus = 'idle';
    this.state.detectedHand = 'None';
    this.state.confidence = 0;
    this.state.gesture = 'none';
    this.state.interactionState = 'IDLE';
    this.state.rawPoint = null;
    this.state.smoothedPoint = null;
    this.state.interpolatedPoints = [];
    this.state.pinchDistance = 1;
    this.state.isPinching = false;
    this.state.isPenDown = false;
    this.state.zoomScaleDelta = undefined;
    this.state.fps = 0;
    this.engine.reset();
    this.notify();
  }

  /** For virtual stylus demonstrations and devices without camera access. */
  public simulateGesture(point: Point2D | null, gesture: HandTrackingState['gesture'], isPinching = false) {
    let interactionState: HandTrackingState['interactionState'] = 'TRACKING';
    if (isPinching || gesture === 'pinch') interactionState = 'WRITING';
    else if (gesture === 'open_palm') interactionState = 'PAUSED';
    else if (gesture === 'closed_fist') interactionState = 'PRESENTATION';
    else if (!point) interactionState = 'IDLE';

    this.state = {
      ...this.state,
      detectedHand: 'Right',
      confidence: 99,
      gesture,
      interactionState,
      rawPoint: point,
      smoothedPoint: point,
      pinchDistance: isPinching ? 0.02 : 0.08,
      isPinching,
      isPenDown: isPinching,
      fps: 60,
    };

    const simEngineResult: GestureEngineResult = {
      gesture,
      mappedAction: isPinching ? 'draw' : gesture === 'open_palm' ? 'pause' : 'aim_hover',
      interactionState,
      rawPoint: point,
      smoothedPoint: point,
      interpolatedPoints: point ? [point] : [],
      pinchDistance: isPinching ? 0.02 : 0.08,
      isPinching,
      isPenDown: isPinching,
      strokeStarted: isPinching,
      strokeTerminated: !isPinching,
    };

    this.notify(simEngineResult);
  }
}

export const handTracker = new HandTrackingService();
