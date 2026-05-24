// Lazy loaders for MediaPipe Tasks Vision. Browser-only.
import {
  FilesetResolver,
  ImageSegmenter,
  FaceDetector,
  type ImageSegmenterResult,
  type FaceDetectorResult,
} from "@mediapipe/tasks-vision";

const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";

let segmenter: ImageSegmenter | null = null;
let segmenterPromise: Promise<ImageSegmenter> | null = null;

export async function getSegmenter(): Promise<ImageSegmenter> {
  if (segmenter) return segmenter;
  if (segmenterPromise) return segmenterPromise;
  segmenterPromise = (async () => {
    const filesets = await FilesetResolver.forVisionTasks(WASM_BASE);
    const s = await ImageSegmenter.createFromOptions(filesets, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite",
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      outputCategoryMask: true,
      outputConfidenceMasks: false,
    });
    segmenter = s;
    return s;
  })();
  return segmenterPromise;
}

let detector: FaceDetector | null = null;
let detectorPromise: Promise<FaceDetector> | null = null;

export async function getFaceDetector(): Promise<FaceDetector> {
  if (detector) return detector;
  if (detectorPromise) return detectorPromise;
  detectorPromise = (async () => {
    const filesets = await FilesetResolver.forVisionTasks(WASM_BASE);
    const d = await FaceDetector.createFromOptions(filesets, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite",
        delegate: "GPU",
      },
      runningMode: "VIDEO",
    });
    detector = d;
    return d;
  })();
  return detectorPromise;
}

export type { ImageSegmenterResult, FaceDetectorResult };
