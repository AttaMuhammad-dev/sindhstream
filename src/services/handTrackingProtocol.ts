import type { HandLandmark } from '../types';

export type TrackedHand = {
  landmarks: HandLandmark[];
  handedness: 'Left' | 'Right' | 'Unknown';
  confidence: number;
};

export type HandTrackingWorkerRequest =
  | { type: 'init'; wasmRoot: string; modelUrl: string; confidence: number }
  | { type: 'frame'; bitmap: ImageBitmap; timestamp: number }
  | { type: 'confidence'; value: number }
  | { type: 'close' };

export type HandTrackingWorkerResponse =
  | { type: 'ready' }
  | { type: 'result'; hands: TrackedHand[]; timestamp: number }
  | { type: 'error'; message: string; fatal?: boolean };
