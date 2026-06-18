"use client";

import { useEffect, useRef, useState } from "react";
import { showToast } from "./Toast";

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
  
  const [results, setResults] = useState<{
    chest: number;
    waist: number;
    hip: number;
    shoulder: number;
    inseam: number;
    height: number;
    sleeve: number;
  } | null>(null);

  const requestRef = useRef<number | null>(null);
  const activeStreamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<any>(null);
  const isCountingDownRef = useRef(false);

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

  const calculateMeasurements = (landmarks: Landmark[]) => {
    // MediaPipe Pose landmarks list indices:
    // 0: nose, 11: left shoulder, 12: right shoulder, 13: left elbow, 14: right elbow
    // 15: left wrist, 16: right wrist, 23: left hip, 24: right hip, 27: left ankle, 28: right ankle
    // 29: left heel, 30: right heel
    const nose = landmarks[0];
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const leftElbow = landmarks[13];
    const rightElbow = landmarks[14];
    const leftWrist = landmarks[15];
    const rightWrist = landmarks[16];
    const leftHip = landmarks[23];
    const rightHip = landmarks[24];
    const leftAnkle = landmarks[27];
    const rightAnkle = landmarks[28];
    const leftHeel = landmarks[29];
    const rightHeel = landmarks[30];

    const heightInInches = calibrationHeightFt * 12 + calibrationHeightIn;

    // Use vertical distance between nose and average heels to calibrate scale factor
    const averageHeelsY = (leftHeel.y + rightHeel.y) / 2;
    const noseY = nose.y;
    const landmarkHeight = Math.abs(averageHeelsY - noseY);

    // Anatomical approximation: nose-to-heel is roughly 82% of a person's total height
    const estimatedFullLandmarkHeight = landmarkHeight / 0.82;
    
    // Scale factor: inches per normalized unit
    const scale = heightInInches / estimatedFullLandmarkHeight;

    // 1. Shoulder width (Distance between shoulder joints + acromion contour padding factor 1.15)
    const shoulderJointDist = distance3D(leftShoulder, rightShoulder);
    const shoulderWidth = shoulderJointDist * scale * 1.15;

    // 2. Chest circumference (Upper torso width approximation * elliptical cross-section factor 2.35)
    const chestCircumference = shoulderJointDist * scale * 2.35;

    // 3. Waist circumference (Estimate midpoints between shoulders and hips, then measure distance * factor 2.2)
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
    const waistCircumference = waistJointDist * scale * 2.2;

    // 4. Hip circumference (Hip joint distance * elliptical cross-section factor 2.45)
    const hipJointDist = distance3D(leftHip, rightHip);
    const hipCircumference = hipJointDist * scale * 2.45;

    // 5. Sleeve length (Shoulder joint -> elbow -> wrist + cuff overlap padding 1.5 inches)
    const sleeveLength = (distance3D(leftShoulder, leftElbow) + distance3D(leftElbow, leftWrist)) * scale + 1.5;

    // 6. Inseam (Hip joint to ankle joint * crotch-level adjustment ratio 0.88)
    const hipToAnkleDist = distance3D(leftHip, leftAnkle);
    const inseam = hipToAnkleDist * scale * 0.88;

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

        // Verify key joints visibility for auto-trigger
        const requiredIndices = [11, 12, 23, 24, 27, 28, 0]; // shoulders, hips, ankles, nose
        const allVisible = requiredIndices.every(
          (idx) => poseLandmarks[idx] && poseLandmarks[idx].visibility > 0.65
        );

        if (allVisible) {
          if (!results && !isCountingDownRef.current) {
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

    const intervalId = setInterval(() => {
      count--;
      if (count > 0) {
        setCountdown(count);
      } else {
        clearInterval(intervalId);
        setCountdown(null);
        // Compute and save results!
        const computed = calculateMeasurements(landmarksSnapshot);
        setResults(computed);
        stopCamera();
        showToast("Measurements captured successfully!", "success");
      }
    }, 1000);
  };

  const handleRecapture = () => {
    setResults(null);
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

          {/* Guide Silhouette Overlay */}
          {!cameraActive && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-center p-6 text-slate-400 bg-slate-950/80">
              <span className="text-4xl animate-pulse">📷</span>
              <p className="mt-4 text-sm font-semibold">{loadStatus}</p>
            </div>
          )}

          {cameraActive && !results && countdown === null && (
            <div className="absolute top-6 left-6 z-20 bg-slate-900/90 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border border-slate-800 flex items-center gap-1.5 shadow-md">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Scan Active: Position full body
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
                Detect landmarks and calibrate measurements dynamically using Google MediaPipe.
              </p>
            </div>

            {/* Height input for calibration */}
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
              </div>
            )}

            {/* Instruction Checklist */}
            {!results && (
              <div className="text-[10px] text-gray-500 bg-slate-100/50 p-4 rounded-2xl border border-dashed border-gray-200 space-y-2 leading-relaxed">
                <p className="font-extrabold text-gray-700 uppercase tracking-wider block mb-1 text-[9px]">Instructions:</p>
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
