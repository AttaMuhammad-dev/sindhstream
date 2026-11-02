import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import type { HandLandmark } from '../types';
import type { HandTrackingWorkerRequest, HandTrackingWorkerResponse, TrackedHand } from './handTrackingProtocol';

type Category = { categoryName?: string; score?: number };
type LandmarkResult = {
  landmarks: HandLandmark[][];
  handedness?: Category[][];
  handednesses?: Category[][];
};

type WorkerScope = {
  addEventListener(type: 'message', listener: (event: MessageEvent<HandTrackingWorkerRequest>) => void): void;
  postMessage(message: HandTrackingWorkerResponse): void;
  close(): void;
};

const workerScope = self as unknown as WorkerScope;
let landmarker: HandLandmarker | null = null;
let confidenceThreshold = 0.55;

function post(message: HandTrackingWorkerResponse) {
  workerScope.postMessage(message);
}

async function createLandmarker(modelUrl: string, vision: Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>) {
  const options = {
    baseOptions: { modelAssetPath: modelUrl, delegate: 'GPU' as const },
    runningMode: 'VIDEO' as const,
    numHands: 2,
    minHandDetectionConfidence: confidenceThreshold,
    minHandPresenceConfidence: confidenceThreshold,
    minTrackingConfidence: confidenceThreshold,
  };

  try {
    return await HandLandmarker.createFromOptions(vision, options);
  } catch (gpuError) {
    console.warn('GestEra vision GPU initialization failed; retrying with CPU.', gpuError);
    return HandLandmarker.createFromOptions(vision, {
      ...options,
      baseOptions: { modelAssetPath: modelUrl, delegate: 'CPU' },
    });
  }
}

workerScope.addEventListener('message', async (event: MessageEvent<HandTrackingWorkerRequest>) => {
  const message = event.data;

  if (message.type === 'close') {
    landmarker?.close();
    landmarker = null;
    workerScope.close();
    return;
  }

  try {
    if (message.type === 'init') {
      confidenceThreshold = message.confidence;
      // This worker is a JavaScript module worker. Load MediaPipe's ES-module
      // WASM loader; the classic loader leaves ModuleFactory undefined here.
      const vision = await FilesetResolver.forVisionTasks(message.wasmRoot, true);
      landmarker = await createLandmarker(message.modelUrl, vision);
      post({ type: 'ready' });
      return;
    }

    if (message.type === 'confidence') {
      confidenceThreshold = message.value;
      if (landmarker) {
        await landmarker.setOptions({
          minHandDetectionConfidence: confidenceThreshold,
          minHandPresenceConfidence: confidenceThreshold,
          minTrackingConfidence: confidenceThreshold,
        });
      }
      return;
    }

    if (message.type === 'frame') {
      if (!landmarker) {
        message.bitmap.close();
        return;
      }

      const result = landmarker.detectForVideo(message.bitmap, message.timestamp) as LandmarkResult;
      message.bitmap.close();
      const classifications = result.handedness ?? result.handednesses ?? [];
      const hands: TrackedHand[] = result.landmarks.map((landmarks, index) => {
        const category = classifications[index]?.[0];
        const label = category?.categoryName;
        return {
          landmarks,
          handedness: label === 'Left' || label === 'Right' ? label : 'Unknown',
          confidence: category?.score ?? 0,
        };
      });

      post({ type: 'result', hands, timestamp: message.timestamp });
    }
  } catch (error) {
    if (message.type === 'frame') message.bitmap.close();
    post({
      type: 'error',
      message: error instanceof Error ? error.message : 'Hand tracking initialization failed.',
      fatal: message.type === 'init',
    });
  }
});

export {};
