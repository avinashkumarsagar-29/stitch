"use client";

import { useEffect, useRef, useState } from "react";
import { showToast } from "./Toast";
import { authFetch, getCurrentUser } from "./profileStorage";
import { API_URL } from "@/app/config";

// A4 Paper Detection using adaptive threshold + connected component labeling on downsampled grid
function detectA4Paper(canvas: HTMLCanvasElement): { longerEdgePixels: number } | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const width = canvas.width;
  const height = canvas.height;
  
  let imgData;
  try {
    imgData = ctx.getImageData(0, 0, width, height);
  } catch (e) {
    console.error("Failed to read image data for A4 detection:", e);
    return null;
  }
  const data = imgData.data;

  // 1. Find max brightness to calculate adaptive threshold
  let maxBrightness = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
    if (brightness > maxBrightness) {
      maxBrightness = brightness;
    }
  }

  // A4 paper is bright/white; we want adaptive thresholding to find it
  const threshold = Math.max(150, maxBrightness * 0.78);

  // 2. Downsample to 160x120 for fast connected component labeling
  const sw = 160;
  const sh = 120;
  const binary = new Uint8Array(sw * sh);
  const xRatio = width / sw;
  const yRatio = height / sh;

  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const origX = Math.floor(x * xRatio);
      const origY = Math.floor(y * yRatio);
      const origIdx = (origY * width + origX) * 4;
      const r = data[origIdx];
      const g = data[origIdx + 1];
      const b = data[origIdx + 2];
      const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
      
      const isWhite = brightness > threshold && Math.abs(r - g) < 40 && Math.abs(g - b) < 40;
      binary[y * sw + x] = isWhite ? 1 : 0;
    }
  }

  // 3. BFS Connected Component Labeling
  const visited = new Uint8Array(sw * sh);
  const queue = new Int32Array(sw * sh);
  const components: Array<{ minX: number; maxX: number; minY: number; maxY: number; count: number }> = [];

  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const idx = y * sw + x;
      if (binary[idx] === 1 && visited[idx] === 0) {
        let head = 0;
        let tail = 0;
        queue[tail++] = idx;
        visited[idx] = 1;

        let minX = x;
        let maxX = x;
        let minY = y;
        let maxY = y;
        let count = 0;

        while (head < tail) {
          const curr = queue[head++];
          const cx = curr % sw;
          const cy = Math.floor(curr / sw);
          count++;

          if (cx < minX) minX = cx;
          if (cx > maxX) maxX = cx;
          if (cy < minY) minY = cy;
          if (cy > maxY) maxY = cy;

          const neighbors = [
            curr - 1,
            curr + 1,
            curr - sw,
            curr + sw
          ];

          for (let n = 0; n < neighbors.length; n++) {
            const nIdx = neighbors[n];
            const nx = nIdx % sw;
            const ny = Math.floor(nIdx / sw);

            if (nx >= 0 && nx < sw && ny >= 0 && ny < sh) {
              if (binary[nIdx] === 1 && visited[nIdx] === 0) {
                visited[nIdx] = 1;
                queue[tail++] = nIdx;
              }
            }
          }
        }

        if (count > 150) {
          components.push({ minX, maxX, minY, maxY, count });
        }
      }
    }
  }

  // 4. Analyze components for A4 aspect ratio (210/297 = 0.707)
  let bestComponent = null;
  let bestScore = Infinity;

  for (const comp of components) {
    const w = comp.maxX - comp.minX;
    const h = comp.maxY - comp.minY;
    if (w < 10 || h < 10) continue;

    const longer = Math.max(w, h);
    const shorter = Math.min(w, h);
    const ratio = shorter / longer;
    const diff = Math.abs(ratio - 0.707);

    if (diff < 0.15) {
      if (diff < bestScore) {
        bestScore = diff;
        bestComponent = comp;
      }
    }
  }

  if (bestComponent) {
    const comp = bestComponent;
    const w = (comp.maxX - comp.minX) * xRatio;
    const h = (comp.maxY - comp.minY) * yRatio;
    const longerEdgePixels = Math.max(w, h);
    return { longerEdgePixels };
  }

  return null;
}

// Ramanujan's first ellipse perimeter approximation: C ≈ pi * [3(a+b) - sqrt((3a+b)*(a+3b))]
function calculateEllipseCircumference(a: number, b: number): number {
  return Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
}

type BodyScannerModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onAutofill: (measurements: {
    chest: string;
    waist: string;
    hip: string;
    shoulder: string;
    inseam: string;
    height: string;
    sleeve: string;
  }) => void;
};

type Landmark = {
  x: number;
  y: number;
  z: number;
  visibility: number;
};

export default function BodyScannerModal({ isOpen, onClose, onAutofill }: BodyScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadStatus, setLoadStatus] = useState("Loading AI scanner model...");
  const [cameraActive, setCameraActive] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [calibrationHeightFt, setCalibrationHeightFt] = useState(5);
  const [calibrationHeightIn, setCalibrationHeightIn] = useState(7);
  
  // Capture flow multi-step
  const [step, setStep] = useState<"front" | "side" | "results">("front");
  const [scaleFactor, setScaleFactor] = useState<number | null>(null);
  const [frontLandmarks, setFrontLandmarks] = useState<Landmark[] | null>(null);
  const [sideLandmarks, setSideLandmarks] = useState<Landmark[] | null>(null);

  const [rawResults, setRawResults] = useState<{
    chest: number;
    waist: number;
    hip: number;
    shoulder: number;
    inseam: number;
    height: number;
    sleeve: number;
  } | null>(null);

  const [calibrationFactors, setCalibrationFactors] = useState<{
    chest: number;
    waist: number;
    hip: number;
    shoulder: number;
    inseam: number;
    sleeve: number;
  }>({
    chest: 1.0,
    waist: 1.0,
    hip: 1.0,
    shoulder: 1.0,
    inseam: 1.0,
    sleeve: 1.0,
  });

  const [isMidasLoading, setIsMidasLoading] = useState(false);

  // Derive calibrated results on the fly
  const results = rawResults ? {
    chest: Number((rawResults.chest * calibrationFactors.chest).toFixed(1)),
    waist: Number((rawResults.waist * calibrationFactors.waist).toFixed(1)),
    hip: Number((rawResults.hip * calibrationFactors.hip).toFixed(1)),
    shoulder: Number((rawResults.shoulder * calibrationFactors.shoulder).toFixed(1)),
    inseam: Number((rawResults.inseam * calibrationFactors.inseam).toFixed(1)),
    sleeve: Number((rawResults.sleeve * calibrationFactors.sleeve).toFixed(1)),
    height: rawResults.height,
  } : null;

  // Calibrate UI inputs
  const [showCalibrateForm, setShowCalibrateForm] = useState(false);
  const [actualChest, setActualChest] = useState("");
  const [actualWaist, setActualWaist] = useState("");
  const [actualHip, setActualHip] = useState("");
  const [actualShoulder, setActualShoulder] = useState("");
  const [actualInseam, setActualInseam] = useState("");
  const [actualSleeve, setActualSleeve] = useState("");
  const [isSubmittingCalibrate, setIsSubmittingCalibrate] = useState(false);

  // Prefill actual inputs when results are generated
  useEffect(() => {
    if (results) {
      setActualChest(String(results.chest));
      setActualWaist(String(results.waist));
      setActualHip(String(results.hip));
      setActualShoulder(String(results.shoulder));
      setActualInseam(String(results.inseam));
      setActualSleeve(String(results.sleeve));
    }
  }, [rawResults]);

  const requestRef = useRef<number | null>(null);
  const activeStreamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<any>(null);
  const isCountingDownRef = useRef(false);
  const midasSessionRef = useRef<any>(null);

  const currentUser = getCurrentUser();
  const userId = currentUser?.id;

  // Fetch saved user calibrationFactors on mount/open
  useEffect(() => {
    if (isOpen && userId) {
      const fetchCalibration = async () => {
        try {
          const response = await authFetch(`${API_URL}/api/users/${userId}/measurements`);
          if (response.ok) {
            const data = await response.json();
            if (data && data.measurements && data.measurements.calibrationFactors) {
              const factors = data.measurements.calibrationFactors;
              setCalibrationFactors({
                chest: factors.chest !== undefined ? factors.chest : 1.0,
                waist: factors.waist !== undefined ? factors.waist : 1.0,
                hip: factors.hip !== undefined ? factors.hip : 1.0,
                shoulder: factors.shoulder !== undefined ? factors.shoulder : 1.0,
                inseam: factors.inseam !== undefined ? factors.inseam : 1.0,
                sleeve: factors.sleeve !== undefined ? factors.sleeve : 1.0,
              });
            }
          }
        } catch (e) {
          console.error("Failed to load user calibration factors", e);
        }
      };
      fetchCalibration();
    }
  }, [isOpen, userId]);

  // Load MediaPipe dynamically to avoid Next.js SSR issues
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;

    async function initMediaPipe() {
      try {
        setLoadStatus("Downloading AI pose landmarker model...");
        const vision = await import("@mediapipe/tasks-vision");
        const filesetResolver = await vision.FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm"
        );
        
        const landmarker = await vision.PoseLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numPoses: 1
        });

        if (isMounted) {
          landmarkerRef.current = landmarker;
          setIsLoaded(true);
          setLoadStatus("AI engine ready. Starting camera...");
          startCamera();
        }
      } catch (err) {
        console.error("Failed to load MediaPipe PoseLandmarker:", err);
        if (isMounted) {
          setLoadStatus("Failed to load AI scanner. Please check your connection.");
          showToast("Failed to initialize body scanning models.", "error");
        }
      }
    }

    initMediaPipe();

    return () => {
      isMounted = false;
      stopCamera();
      if (landmarkerRef.current) {
        try {
          landmarkerRef.current.close();
        } catch (e) {
          console.error(e);
        }
      }
    };
  }, [isOpen]);

  const startCamera = async () => {
    try {
      if (activeStreamRef.current) {
        stopCamera();
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
        },
        audio: false,
      });

      activeStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setCameraActive(true);
          // Start detection loop once video starts playing
          requestRef.current = requestAnimationFrame(detectLoop);
        };
      }
    } catch (err) {
      console.error("Camera access error:", err);
      setLoadStatus("Camera access denied. Please grant webcam permissions.");
      showToast("Webcam access is required for body measurement scanning.", "error");
    }
  };

  const stopCamera = () => {
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }
    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach((track) => track.stop());
      activeStreamRef.current = null;
    }
    setCameraActive(false);
  };

  const distance3D = (p1: Landmark, p2: Landmark) => {
    return Math.sqrt(
      Math.pow(p1.x - p2.x, 2) +
      Math.pow(p1.y - p2.y, 2) +
      Math.pow(p1.z - p2.z, 2)
    );
  };

  const calculateEllipseCircumference = (a: number, b: number) => {
    // Ramanujan approximation
    const h = Math.pow(a - b, 2) / Math.pow(a + b, 2);
    return Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
  };

  const calculateMeasurements = (
    frontLms: Landmark[],
    scale: number,
    depthMap: { chest: number; waist: number; hip: number } | null
  ) => {
    const leftShoulder = frontLms[11];
    const rightShoulder = frontLms[12];
    const leftElbow = frontLms[13];
    const leftWrist = frontLms[15];
    const leftHip = frontLms[23];
    const rightHip = frontLms[24];
    const leftAnkle = frontLms[27];

    const heightInInches = calibrationHeightFt * 12 + calibrationHeightIn;

    // 1. Shoulder width (Acromion contour padding factor 1.15)
    const shoulderJointDist = distance3D(leftShoulder, rightShoulder);
    const shoulderWidth = shoulderJointDist * scale * 1.15;

    // 2. Chest circumference (Ramanujan ellipse formula if depth available, fallback to 2.35 multiplier)
    const chestWidth = shoulderJointDist * scale;
    let chestCircumference = chestWidth * 2.35;
    if (depthMap && depthMap.chest > 0) {
      const a = chestWidth / 2;
      const b = depthMap.chest / 2;
      chestCircumference = calculateEllipseCircumference(a, b);
    }

    // 3. Waist circumference (Ramanujan ellipse formula if depth available, fallback to 2.2 multiplier)
    const leftWaist: Landmark = {
      x: (leftShoulder.x + leftHip.x) / 2,
      y: (leftShoulder.y + leftHip.y) / 2,
      z: (leftShoulder.z + leftHip.z) / 2,
      visibility: 1
    };
    const rightWaist: Landmark = {
      x: (rightShoulder.x + rightHip.x) / 2,
      y: (rightShoulder.y + rightHip.y) / 2,
      z: (rightShoulder.z + rightHip.z) / 2,
      visibility: 1
    };
    const waistJointDist = distance3D(leftWaist, rightWaist);
    const waistWidth = waistJointDist * scale;
    let waistCircumference = waistWidth * 2.2;
    if (depthMap && depthMap.waist > 0) {
      const a = waistWidth / 2;
      const b = depthMap.waist / 2;
      waistCircumference = calculateEllipseCircumference(a, b);
    }

    // 4. Hip circumference (Ramanujan ellipse formula if depth available, fallback to 2.45 multiplier)
    const hipJointDist = distance3D(leftHip, rightHip);
    const hipWidth = hipJointDist * scale;
    let hipCircumference = hipWidth * 2.45;
    if (depthMap && depthMap.hip > 0) {
      const a = hipWidth / 2;
      const b = depthMap.hip / 2;
      hipCircumference = calculateEllipseCircumference(a, b);
    }

    // 5. Sleeve length (Shoulder joint -> elbow -> wrist + cuff overlap padding 1.5 inches)
    const sleeveLength = (distance3D(leftShoulder, leftElbow) + distance3D(leftElbow, leftWrist)) * scale + 1.5;

    // 6. Inseam (Hip joint to ankle joint * crotch-level adjustment ratio 0.88)
    const inseam = distance3D(leftHip, leftAnkle) * scale * 0.88;

    return {
      chest: Number(chestCircumference.toFixed(1)),
      waist: Number(waistCircumference.toFixed(1)),
      hip: Number(hipCircumference.toFixed(1)),
      shoulder: Number(shoulderWidth.toFixed(1)),
      inseam: Number(inseam.toFixed(1)),
      height: Number(heightInInches.toFixed(1)),
      sleeve: Number(sleeveLength.toFixed(1)),
    };
  };

  const drawSkeleton = (ctx: CanvasRenderingContext2D, landmarks: Landmark[]) => {
    // Drawing connection helper
    const drawLine = (p1Idx: number, p2Idx: number, color = "#c322f4", width = 3) => {
      const p1 = landmarks[p1Idx];
      const p2 = landmarks[p2Idx];
      if (p1 && p2 && p1.visibility > 0.5 && p2.visibility > 0.5) {
        ctx.beginPath();
        ctx.moveTo(p1.x * ctx.canvas.width, p1.y * ctx.canvas.height);
        ctx.lineTo(p2.x * ctx.canvas.width, p2.y * ctx.canvas.height);
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.shadowBlur = 0; // Reset
      }
    };

    // Draw lines
    drawLine(11, 12, "#c322f4", 4); // Shoulders
    drawLine(11, 13); // Left shoulder to elbow
    drawLine(13, 15); // Left elbow to wrist
    drawLine(12, 14); // Right shoulder to elbow
    drawLine(14, 16); // Right elbow to wrist

    drawLine(11, 23); // Left shoulder to hip
    drawLine(12, 24); // Right shoulder to hip
    drawLine(23, 24, "#c322f4", 4); // Hips

    drawLine(23, 25); // Left hip to knee
    drawLine(25, 27); // Left knee to ankle
    drawLine(27, 29); // Left ankle to heel
    drawLine(24, 26); // Right hip to knee
    drawLine(26, 28); // Right knee to ankle
    drawLine(28, 30); // Right ankle to heel

    // Draw joints
    landmarks.forEach((lm, idx) => {
      // Draw key landmarks: nose, shoulders, elbows, wrists, hips, knees, ankles
      const keyIndices = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28, 29, 30];
      if (keyIndices.includes(idx) && lm.visibility > 0.5) {
        ctx.beginPath();
        ctx.arc(lm.x * ctx.canvas.width, lm.y * ctx.canvas.height, 6, 0, 2 * Math.PI);
        ctx.fillStyle = idx === 0 ? "#e11d48" : "#00f0ff"; // Red for nose, cyan for joints
        ctx.shadowColor = idx === 0 ? "#e11d48" : "#00f0ff";
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    });
  };

  const detectLoop = () => {
    if (!videoRef.current || !canvasRef.current || !landmarkerRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (ctx && video.readyState >= 2) {
      // Setup canvas dimension
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      // Draw original video frame
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Perform Pose Landmark detection
      const resultsData = landmarkerRef.current.detectForVideo(video, performance.now());

      if (resultsData && resultsData.landmarks && resultsData.landmarks.length > 0) {
        const poseLandmarks = resultsData.landmarks[0] as Landmark[];
        
        // Draw Pose Overlay
        drawSkeleton(ctx, poseLandmarks);

        let canTrigger = false;

        if (step === "front") {
          // Verify key joints visibility for auto-trigger on frontal view
          const requiredIndices = [11, 12, 23, 24, 27, 28, 0]; // shoulders, hips, ankles, nose
          canTrigger = requiredIndices.every(
            (idx) => poseLandmarks[idx] && poseLandmarks[idx].visibility > 0.65
          );
        } else if (step === "side") {
          // Verify key joints visibility for either left or right side facing camera
          const leftSide = [11, 23, 27];
          const rightSide = [12, 24, 28];
          const leftVisible = leftSide.every(
            (idx) => poseLandmarks[idx] && poseLandmarks[idx].visibility > 0.65
          );
          const rightVisible = rightSide.every(
            (idx) => poseLandmarks[idx] && poseLandmarks[idx].visibility > 0.65
          );
          canTrigger = leftVisible || rightVisible;
        }

        if (canTrigger) {
          if (!rawResults && !isCountingDownRef.current) {
            // Trigger automatic measurements capture countdown
            isCountingDownRef.current = true;
            triggerCountdown(poseLandmarks);
          }
        } else {
          // If body goes out of frame, reset countdown
          if (isCountingDownRef.current) {
            isCountingDownRef.current = false;
            setCountdown(null);
          }
        }
      }
    }

    requestRef.current = requestAnimationFrame(detectLoop);
  };

  const triggerCountdown = (landmarksSnapshot: Landmark[]) => {
    let count = 3;
    setCountdown(count);

    const intervalId = setInterval(async () => {
      count--;
      if (count > 0) {
        setCountdown(count);
      } else {
        clearInterval(intervalId);
        setCountdown(null);

        if (step === "front") {
          setFrontLandmarks(landmarksSnapshot);

          const canvas = canvasRef.current;
          let a4Scale: number | null = null;
          if (canvas) {
            const detected = detectA4Paper(canvas);
            if (detected) {
              a4Scale = (11.6929 * canvas.height) / detected.longerEdgePixels;
            }
          }

          const nose = landmarksSnapshot[0];
          const leftHeel = landmarksSnapshot[29];
          const rightHeel = landmarksSnapshot[30];
          const averageHeelsY = (leftHeel.y + rightHeel.y) / 2;
          const noseY = nose.y;
          const landmarkHeight = Math.abs(averageHeelsY - noseY);
          const estimatedFullLandmarkHeight = landmarkHeight / 0.82;
          
          const heightInInches = calibrationHeightFt * 12 + calibrationHeightIn;
          const heightScale = heightInInches / estimatedFullLandmarkHeight;

          let finalScale = heightScale;
          if (a4Scale !== null) {
            finalScale = (heightScale + a4Scale) / 2;
            showToast("A4 reference detected! Calibrated scale factor.", "success");
          } else {
            showToast("A4 paper not detected. Using height-only calibration.", "success");
          }

          setScaleFactor(finalScale);
          isCountingDownRef.current = false;
          setStep("side");
          showToast("Front view captured! Turn 90 degrees for side profile.", "success");

        } else if (step === "side") {
          setSideLandmarks(landmarksSnapshot);
          const currentScale = scaleFactor || 1.0;

          const canvas = canvasRef.current;
          let depthMap: { chest: number; waist: number; hip: number } | null = null;
          if (canvas) {
            const sideCanvas = document.createElement("canvas");
            sideCanvas.width = canvas.width;
            sideCanvas.height = canvas.height;
            const sideCtx = sideCanvas.getContext("2d");
            sideCtx?.drawImage(canvas, 0, 0);

            depthMap = await runMidasInference(sideCanvas, landmarksSnapshot, currentScale);
          }

          stopCamera();

          if (frontLandmarks) {
            const computed = calculateMeasurements(frontLandmarks, currentScale, depthMap);
            setRawResults(computed);
            setStep("results");
            showToast("Measurements captured successfully!", "success");
          } else {
            showToast("Error: Front landmarks missing.", "error");
            handleRecapture();
          }
          isCountingDownRef.current = false;
        }
      }
    }, 1000);
  };

  const runMidasInference = async (
    sideCanvas: HTMLCanvasElement,
    sideLms: Landmark[],
    scale: number
  ) => {
    try {
      setIsMidasLoading(true);
      setLoadStatus("Loading depth estimation model...");
      
      const ort = await import("onnxruntime-web");
      ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.1/dist/";

      let session = midasSessionRef.current;
      if (!session) {
        const modelUrl = "https://huggingface.co/Heliosoph/midas-small-onnx/resolve/main/model.onnx";
        session = await ort.InferenceSession.create(modelUrl);
        midasSessionRef.current = session;
      }

      setLoadStatus("Estimating monocular depth map...");

      const size = 256;
      const resizeCanvas = document.createElement("canvas");
      resizeCanvas.width = size;
      resizeCanvas.height = size;
      const rCtx = resizeCanvas.getContext("2d");
      if (!rCtx) throw new Error("Could not get 2d context for resize canvas");
      rCtx.drawImage(sideCanvas, 0, 0, size, size);

      const imgData = rCtx.getImageData(0, 0, size, size);
      const data = imgData.data;

      // NCHW shape: [1, 3, 256, 256]
      const inputBuffer = new Float32Array(1 * 3 * size * size);
      const mean = [0.485, 0.456, 0.406];
      const std = [0.229, 0.224, 0.225];

      for (let i = 0; i < size * size; i++) {
        const r = data[i * 4] / 255.0;
        const g = data[i * 4 + 1] / 255.0;
        const b = data[i * 4 + 2] / 255.0;

        // BGR order for Heliosoph midas-small-onnx
        inputBuffer[i] = (b - mean[2]) / std[2];
        inputBuffer[size * size + i] = (g - mean[1]) / std[1];
        inputBuffer[2 * size * size + i] = (r - mean[0]) / std[0];
      }

      const inputTensor = new ort.Tensor("float32", inputBuffer, [1, 3, size, size]);
      const feeds = { [session.inputNames[0]]: inputTensor };
      const outputMap = await session.run(feeds);
      const outputTensor = outputMap[session.outputNames[0]];
      const depthData = outputTensor.data as Float32Array;

      // Sample depth map at chest, waist, and hip rows to find thickness
      const isLeft = (sideLms[11]?.visibility || 0) > (sideLms[12]?.visibility || 0);
      const sideShoulder = isLeft ? sideLms[11] : sideLms[12];
      const sideHip = isLeft ? sideLms[23] : sideLms[24];

      if (!sideShoulder || !sideHip) throw new Error("Could not find side landmarks");

      const chestY = sideShoulder.y + (sideHip.y - sideShoulder.y) * 0.15;
      const waistY = (sideShoulder.y + sideHip.y) / 2;
      const hipY = sideHip.y;

      const chestX = sideShoulder.x;
      const waistX = (sideShoulder.x + sideHip.x) / 2;
      const hipX = sideHip.x;

      const getSpan = (yNorm: number, xCenterNorm: number) => {
        const yPixel = Math.max(0, Math.min(255, Math.round(yNorm * size)));
        const xCenterPixel = Math.max(0, Math.min(255, Math.round(xCenterNorm * size)));
        const rowStart = yPixel * size;
        const rowDepths = new Float32Array(size);
        for (let col = 0; col < size; col++) {
          rowDepths[col] = depthData[rowStart + col];
        }

        let minVal = 999999;
        let maxVal = -999999;
        for (let col = 0; col < size; col++) {
          const val = rowDepths[col];
          if (val < minVal) minVal = val;
          if (val > maxVal) maxVal = val;
        }

        if (maxVal - minVal < 0.01) return 0;

        const threshold = minVal + 0.3 * (maxVal - minVal);
        
        let left = xCenterPixel;
        while (left > 0 && rowDepths[left] > threshold) {
          left--;
        }
        let right = xCenterPixel;
        while (right < 255 && rowDepths[right] > threshold) {
          right++;
        }

        const spanNormalized = (right - left) / size;
        const spanInches = spanNormalized * scale;
        
        if (spanInches >= 4 && spanInches <= 22) {
          return spanInches;
        }
        return 0;
      };

      const chestDepth = getSpan(chestY, chestX);
      const waistDepth = getSpan(waistY, waistX);
      const hipDepth = getSpan(hipY, hipX);

      setIsMidasLoading(false);
      return { chest: chestDepth, waist: waistDepth, hip: hipDepth };
    } catch (e) {
      console.error("MiDaS depth estimation failed:", e);
      setIsMidasLoading(false);
      return null;
    }
  };

  const handleSkipSide = () => {
    if (isCountingDownRef.current) {
      isCountingDownRef.current = false;
      setCountdown(null);
    }
    stopCamera();
    const currentScale = scaleFactor || 1.0;
    if (frontLandmarks) {
      const computed = calculateMeasurements(frontLandmarks, currentScale, null);
      setRawResults(computed);
      setStep("results");
      showToast("Side scan skipped. Used standard multipliers.", "success");
    } else {
      showToast("Error: Front landmarks missing.", "error");
      handleRecapture();
    }
  };

  const handleRecapture = () => {
    setRawResults(null);
    setFrontLandmarks(null);
    setSideLandmarks(null);
    setScaleFactor(null);
    setStep("front");
    isCountingDownRef.current = false;
    startCamera();
  };

  const handleAutofillClick = () => {
    if (!results) return;
    onAutofill({
      chest: String(results.chest),
      waist: String(results.waist),
      hip: String(results.hip),
      shoulder: String(results.shoulder),
      inseam: String(results.inseam),
      height: String(results.height),
      sleeve: String(results.sleeve),
    });
    onClose();
  };

  const handleSaveCalibration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !rawResults) {
      showToast("Please log in to save calibration factors.", "error");
      return;
    }

    setIsSubmittingCalibrate(true);
    try {
      const response = await authFetch(`${API_URL}/api/users/${userId}/measurements/calibrate`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aiEstimates: {
            chest: rawResults.chest,
            waist: rawResults.waist,
            hip: rawResults.hip,
            shoulder: rawResults.shoulder,
            inseam: rawResults.inseam,
            sleeve: rawResults.sleeve,
          },
          actualValues: {
            chest: actualChest ? Number(actualChest) : undefined,
            waist: actualWaist ? Number(actualWaist) : undefined,
            hip: actualHip ? Number(actualHip) : undefined,
            shoulder: actualShoulder ? Number(actualShoulder) : undefined,
            inseam: actualInseam ? Number(actualInseam) : undefined,
            sleeve: actualSleeve ? Number(actualSleeve) : undefined,
          }
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data && data.calibrationFactors) {
          setCalibrationFactors(data.calibrationFactors);
        }
        showToast("Calibration saved — future scans will be more accurate", "success");
        setShowCalibrateForm(false);
      } else {
        const errorData = await response.json();
        showToast(errorData.message || "Failed to save calibration.", "error");
      }
    } catch (err) {
      console.error("Save calibration error:", err);
      showToast("An error occurred while saving calibration.", "error");
    } finally {
      setIsSubmittingCalibrate(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 font-sans animate-fade-in">
      <div className="relative w-full max-w-4xl overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-2xl flex flex-col md:flex-row max-h-[90vh]">
        {/* Left column: Video & Scanning HUD */}
        <div className="flex-1 bg-slate-950 relative flex items-center justify-center p-4 min-h-[300px] md:min-h-[450px]">
          {/* Invisible helper video tag */}
          <video
            ref={videoRef}
            playsInline
            muted
            className="hidden"
          />

          {/* Canvas scanner feed */}
          <canvas
            ref={canvasRef}
            className="w-full h-auto max-h-[60vh] md:max-h-[75vh] object-contain rounded-2xl border border-slate-800 shadow-inner z-10"
          />

          {/* Countdown Indicator Overlay */}
          {countdown !== null && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/40">
              <div className="h-24 w-24 rounded-full bg-[#c322f4]/80 text-white font-black text-4xl flex items-center justify-center animate-bounce shadow-lg border-2 border-white">
                {countdown}
              </div>
              <p className="text-white text-xs font-bold uppercase tracking-widest mt-4">Hold still... Capturing Pose</p>
            </div>
          )}

          {/* Guide Silhouette Overlay / Loading */}
          {!cameraActive && !isMidasLoading && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-center p-6 text-slate-400 bg-slate-950/80">
              <span className="text-4xl animate-pulse">📷</span>
              <p className="mt-4 text-sm font-semibold">{loadStatus}</p>
            </div>
          )}

          {/* MiDaS Processing Overlay */}
          {isMidasLoading && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center text-center p-6 text-slate-200 bg-slate-950/95">
              <span className="text-4xl animate-spin mb-4">⌛</span>
              <p className="text-sm font-extrabold tracking-wide uppercase text-purple-400">Processing scan depth</p>
              <p className="text-[11px] text-slate-400 mt-2">{loadStatus}</p>
            </div>
          )}

          {/* Step guidance messages */}
          {cameraActive && !results && countdown === null && !isMidasLoading && (
            <div className="absolute top-6 left-6 right-6 z-20 bg-slate-900/95 text-white text-[11px] font-bold px-4 py-3 rounded-2xl border border-slate-800 shadow-lg flex flex-col gap-1 leading-snug animate-fade-in">
              <div className="flex items-center gap-1.5 font-black text-[10px] text-[#c322f4] uppercase tracking-wider">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Step {step === "front" ? "1: Frontal Profile" : "2: Side Profile"}
              </div>
              <p className="mt-1 font-medium text-slate-200">
                {step === "front" 
                  ? "Hold an A4 paper flat against your chest, arms slightly out (A-pose)"
                  : "Turn 90 degrees to a side profile, stand still (full body in frame)"}
              </p>
            </div>
          )}
        </div>

        {/* Right column: Form configurations and Results dashboard */}
        <div className="w-full md:w-[340px] flex flex-col justify-between border-t md:border-t-0 md:border-l border-gray-100 bg-slate-50 p-6 overflow-y-auto">
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-gray-950 flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[#c322f4]" />
                Body Scanner AI
              </h3>
              <p className="text-[11px] text-gray-500 mt-1 leading-snug">
                Detect landmarks, calibrate with A4 paper, and perform monocular depth estimation.
              </p>
            </div>

            {/* Height input for calibration (only visible before capture) */}
            {!results && (
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-[#c322f4] block">
                  ⚙️ Height Calibration
                </label>
                <p className="text-[10px] text-gray-500 leading-snug">
                  Calibrate the camera scale factor by inputting your exact height.
                </p>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-[9px] font-bold text-gray-400 block mb-1">Feet</label>
                    <select
                      value={calibrationHeightFt}
                      onChange={(e) => setCalibrationHeightFt(Number(e.target.value))}
                      className="w-full h-10 rounded-xl border border-gray-200 bg-slate-50 px-2.5 text-xs font-semibold text-gray-800 outline-none"
                    >
                      {[3, 4, 5, 6, 7].map((f) => (
                        <option key={f} value={f}>{f} ft</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-gray-400 block mb-1">Inches</label>
                    <select
                      value={calibrationHeightIn}
                      onChange={(e) => setCalibrationHeightIn(Number(e.target.value))}
                      className="w-full h-10 rounded-xl border border-gray-200 bg-slate-50 px-2.5 text-xs font-semibold text-gray-800 outline-none"
                    >
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => (
                        <option key={i} value={i}>{i} in</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Skip Side Scan option if side profile scan is running */}
            {cameraActive && !results && step === "side" && (
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-[#c322f4] block">
                  🔄 Side Profile Scan
                </label>
                <p className="text-[10px] text-gray-500 leading-normal">
                  The scanner is waiting for your side profile landmarks. If you prefer to skip monocular depth scanning:
                </p>
                <button
                  type="button"
                  onClick={handleSkipSide}
                  className="w-full h-10 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-xs font-bold text-purple-700 transition-colors cursor-pointer"
                >
                  Skip Side Scan & Calculate ➔
                </button>
              </div>
            )}

            {/* Calculated Results table */}
            {results && (
              <div className="space-y-4 animate-fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">
                    🟢 Scan Complete
                  </span>
                  <button
                    onClick={handleRecapture}
                    className="text-[10px] font-bold text-purple-600 hover:underline"
                  >
                    Recapture 🔄
                  </button>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
                  <div className="p-3 bg-slate-900 text-white flex justify-between items-center text-xs font-extrabold">
                    <span>Tailoring Metric</span>
                    <span>Computed Size</span>
                  </div>
                  <ResultRow label="Shoulder Width" value={`${results.shoulder} in`} />
                  <ResultRow label="Chest Circumference" value={`${results.chest} in`} />
                  <ResultRow label="Waist Circumference" value={`${results.waist} in`} />
                  <ResultRow label="Hip Circumference" value={`${results.hip} in`} />
                  <ResultRow label="Sleeve Length" value={`${results.sleeve} in`} />
                  <ResultRow label="Inseam" value={`${results.inseam} in`} />
                  <ResultRow label="Height" value={`${results.height} in`} />
                </div>

                {/* Collapsible fine-tuning form */}
                <div className="border-t border-gray-200 pt-4 mt-2">
                  <button
                    type="button"
                    onClick={() => setShowCalibrateForm(!showCalibrateForm)}
                    className="w-full text-left flex justify-between items-center text-xs font-bold text-slate-700 hover:text-[#c322f4] transition-colors"
                  >
                    <span>🎯 Fine-tune measurements?</span>
                    <span>{showCalibrateForm ? "▲" : "▼"}</span>
                  </button>
                  
                  {showCalibrateForm && (
                    <form onSubmit={handleSaveCalibration} className="mt-3 space-y-3 bg-white p-3.5 rounded-2xl border border-gray-100 shadow-inner animate-fade-in">
                      <p className="text-[10px] text-gray-500 leading-normal mb-1">
                        Enter your actual tape measurements below. We will calculate correction factors to automatically improve future scans.
                      </p>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[9px] font-bold text-gray-400 block mb-0.5">Chest (in)</label>
                          <input
                            type="number"
                            step="0.1"
                            placeholder="e.g. 38.0"
                            value={actualChest}
                            onChange={(e) => setActualChest(e.target.value)}
                            className="w-full h-8 rounded-lg border border-gray-200 bg-slate-50 px-2 text-xs font-semibold text-gray-800 outline-none focus:border-[#c322f4]"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-gray-400 block mb-0.5">Waist (in)</label>
                          <input
                            type="number"
                            step="0.1"
                            placeholder="e.g. 32.0"
                            value={actualWaist}
                            onChange={(e) => setActualWaist(e.target.value)}
                            className="w-full h-8 rounded-lg border border-gray-200 bg-slate-50 px-2 text-xs font-semibold text-gray-800 outline-none focus:border-[#c322f4]"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-gray-400 block mb-0.5">Hip (in)</label>
                          <input
                            type="number"
                            step="0.1"
                            placeholder="e.g. 40.0"
                            value={actualHip}
                            onChange={(e) => setActualHip(e.target.value)}
                            className="w-full h-8 rounded-lg border border-gray-200 bg-slate-50 px-2 text-xs font-semibold text-gray-800 outline-none focus:border-[#c322f4]"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-gray-400 block mb-0.5">Shoulder (in)</label>
                          <input
                            type="number"
                            step="0.1"
                            placeholder="Optional"
                            value={actualShoulder}
                            onChange={(e) => setActualShoulder(e.target.value)}
                            className="w-full h-8 rounded-lg border border-gray-200 bg-slate-50 px-2 text-xs font-semibold text-gray-800 outline-none focus:border-[#c322f4]"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-gray-400 block mb-0.5">Sleeve (in)</label>
                          <input
                            type="number"
                            step="0.1"
                            placeholder="Optional"
                            value={actualSleeve}
                            onChange={(e) => setActualSleeve(e.target.value)}
                            className="w-full h-8 rounded-lg border border-gray-200 bg-slate-50 px-2 text-xs font-semibold text-gray-800 outline-none focus:border-[#c322f4]"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-gray-400 block mb-0.5">Inseam (in)</label>
                          <input
                            type="number"
                            step="0.1"
                            placeholder="Optional"
                            value={actualInseam}
                            onChange={(e) => setActualInseam(e.target.value)}
                            className="w-full h-8 rounded-lg border border-gray-200 bg-slate-50 px-2 text-xs font-semibold text-gray-800 outline-none focus:border-[#c322f4]"
                          />
                        </div>
                      </div>
                      
                      <button
                        type="submit"
                        disabled={isSubmittingCalibrate}
                        className="w-full h-8 rounded-lg bg-slate-900 hover:bg-[#c322f4] disabled:bg-gray-300 text-white text-[10px] font-bold uppercase tracking-wider transition-colors shadow-sm cursor-pointer mt-1"
                      >
                        {isSubmittingCalibrate ? "Saving..." : "Save Calibration Factors"}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            )}

            {/* Instruction Checklist */}
            {!results && (
              <div className="text-[10px] text-gray-500 bg-slate-100/50 p-4 rounded-2xl border border-dashed border-gray-200 space-y-2 leading-relaxed">
                <p className="font-extrabold text-gray-700 uppercase tracking-wider block mb-1 text-[9px]">Instructions:</p>
                {step === "front" ? (
                  <>
                    <div className="flex gap-2">
                      <span>📄</span>
                      <span className="font-semibold text-gray-700">A4 Paper: Hold an A4 paper flat against your chest, arms slightly out (A-pose).</span>
                    </div>
                    <div className="flex gap-2">
                      <span>📐</span>
                      <span>Stand 6 to 8 feet away from your webcam.</span>
                    </div>
                    <div className="flex gap-2">
                      <span>🧍</span>
                      <span>Ensure your entire body (head, arms, hips, feet) is visible in the frame.</span>
                    </div>
                    <div className="flex gap-2">
                      <span>⚡</span>
                      <span>The AI will detect your pose and countdown 3 seconds automatically to capture.</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex gap-2">
                      <span>🧍</span>
                      <span className="font-semibold text-gray-700">Side view: Turn 90 degrees to side profile (left or right side facing webcam).</span>
                    </div>
                    <div className="flex gap-2">
                      <span>⚡</span>
                      <span>Ensure side profile shoulder, hip, and ankle are in frame. Countdown triggers automatically.</span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="pt-6 border-t border-gray-100 mt-6 flex gap-2">
            {results ? (
              <button
                type="button"
                onClick={handleAutofillClick}
                className="flex-1 h-11 rounded-xl bg-gradient-to-r from-[#d779f4] to-[#c322f4] text-xs font-bold text-white shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer text-center"
              >
                Autofill Details & Close
              </button>
            ) : (
              <button
                type="button"
                disabled
                className="flex-1 h-11 rounded-xl bg-gray-200 text-xs font-bold text-gray-400 cursor-not-allowed text-center"
              >
                Waiting for Scan...
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                stopCamera();
                onClose();
              }}
              className="h-11 px-4 rounded-xl bg-white border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center px-4 py-3 text-xs">
      <span className="font-semibold text-gray-500">{label}</span>
      <span className="font-extrabold text-gray-900">{value}</span>
    </div>
  );
}
