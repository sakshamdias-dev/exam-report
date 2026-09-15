import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  Mic, 
  Monitor, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Smartphone, 
  Loader2, 
  Volume2,
  Lock,
  ArrowRight,
  Sparkles,
  Info
} from 'lucide-react';
import { isMobileDevice, supportsDisplayMedia, AudioMeter } from '../../services/proctoringService';
import { ExamFriendlyLogo } from '../ExamFriendlyLogo';

interface ProctoringSetupModalProps {
  isOpen: boolean;
  examTitle: string;
  studentName: string;
  studentId: string;
  onComplete: (cameraStream: MediaStream, screenStream: MediaStream | null, audioMeter: AudioMeter | null) => void;
  onCancel: () => void;
}

export const ProctoringSetupModal: React.FC<ProctoringSetupModalProps> = ({
  isOpen,
  examTitle,
  studentName,
  studentId,
  onComplete,
  onCancel,
}) => {
  const isMobile = isMobileDevice();
  const screenShareSupported = supportsDisplayMedia();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [audioMeter, setAudioMeter] = useState<AudioMeter | null>(null);
  const [micVolume, setMicVolume] = useState<number>(0);

  const [cameraLoading, setCameraLoading] = useState(false);
  const [screenLoading, setScreenLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const screenPreviewRef = useRef<HTMLVideoElement | null>(null);
  const audioIntervalRef = useRef<any>(null);

  // Clean up streams if user closes modal before completion
  useEffect(() => {
    return () => {
      if (audioIntervalRef.current) clearInterval(audioIntervalRef.current);
      if (audioMeter) audioMeter.destroy();
    };
  }, []);

  // Monitor mic volume
  useEffect(() => {
    if (audioMeter) {
      audioIntervalRef.current = setInterval(() => {
        setMicVolume(audioMeter.getVolumeLevel());
      }, 100);
    }
    return () => {
      if (audioIntervalRef.current) clearInterval(audioIntervalRef.current);
    };
  }, [audioMeter]);

  // Attach camera stream to video preview element
  useEffect(() => {
    if (videoPreviewRef.current && cameraStream) {
      videoPreviewRef.current.srcObject = cameraStream;
    }
  }, [cameraStream, step]);

  // Attach screen stream to preview element
  useEffect(() => {
    if (screenPreviewRef.current && screenStream) {
      screenPreviewRef.current.srcObject = screenStream;
    }
  }, [screenStream, step]);

  if (!isOpen) return null;

  // Step 1: Request Camera + Mic
  const handleRequestCameraMic = async () => {
    setCameraLoading(true);
    setErrorMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      setCameraStream(stream);
      const meter = new AudioMeter(stream);
      setAudioMeter(meter);

      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
      }

      // Automatically advance or allow student to check
      if (screenShareSupported) {
        setStep(2);
      } else {
        // Mobile or unsupported: go straight to Step 3 (Confirmation)
        setStep(3);
      }
    } catch (err: any) {
      console.error('Camera/Mic permission error:', err);
      setErrorMsg(
        'Camera and Microphone access is mandatory for proctored examination. Please grant permissions in your browser bar.'
      );
    } finally {
      setCameraLoading(false);
    }
  };

  // Step 2: Request Screen Sharing (Desktop)
  const handleRequestScreenShare = async () => {
    setScreenLoading(true);
    setErrorMsg(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        throw new Error('Screen sharing API not available on this browser.');
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor', // Prefer entire monitor
        } as any,
        audio: false,
      });

      setScreenStream(stream);

      // Handle user stopping screen share from browser floating toolbar
      stream.getVideoTracks()[0].onended = () => {
        setScreenStream(null);
        setErrorMsg('Screen sharing was disconnected. Please re-enable screen sharing to continue.');
      };

      if (screenPreviewRef.current) {
        screenPreviewRef.current.srcObject = stream;
      }

      setStep(3);
    } catch (err: any) {
      console.error('Screen sharing error:', err);
      if (err.name === 'NotAllowedError') {
        setErrorMsg('Screen sharing was cancelled. You must share your entire screen to take the exam.');
      } else {
        setErrorMsg(`Unable to start screen sharing: ${err.message || 'Unknown error'}`);
      }
    } finally {
      setScreenLoading(false);
    }
  };

  // Final confirmation
  const handleFinalSubmit = () => {
    if (!cameraStream) {
      setErrorMsg('Camera and Microphone must be active.');
      return;
    }
    if (screenShareSupported && !screenStream) {
      setErrorMsg('Screen sharing must be active on desktop devices.');
      return;
    }

    onComplete(cameraStream, screenStream, audioMeter);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto font-sans animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-white border border-sky-200 rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#0B1528] via-[#0F1E36] to-[#0B1528] text-white p-5 sm:p-6 border-b border-sky-900/60 relative">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-white p-1.5 rounded-xl shadow-xs shrink-0">
                <ExamFriendlyLogo size="sm" showTagline={false} />
              </div>
              <div>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold bg-sky-950 text-sky-300 rounded border border-sky-700/50">
                  <ShieldCheck className="w-3 h-3 text-[#009fe3]" />
                  Live Invigilation Check
                </span>
                <h2 className="text-base sm:text-lg font-bold text-white mt-0.5">
                  Proctoring Setup &amp; Verification
                </h2>
              </div>
            </div>
            <span className="hidden sm:block text-xs font-mono text-slate-300">
              Step {step} of {screenShareSupported ? 3 : 2}
            </span>
          </div>

          {/* Stepper Progress Bar */}
          <div className="grid grid-cols-3 gap-2 mt-4">
            <div className={`h-1.5 rounded-full transition-all ${step >= 1 ? 'bg-[#009fe3]' : 'bg-slate-700'}`} />
            <div className={`h-1.5 rounded-full transition-all ${step >= 2 ? 'bg-[#009fe3]' : 'bg-slate-700'}`} />
            <div className={`h-1.5 rounded-full transition-all ${step >= 3 ? 'bg-[#009fe3]' : 'bg-slate-700'}`} />
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          {/* Candidate & Exam Pill */}
          <div className="p-3 rounded-2xl bg-sky-50/70 border border-sky-200/80 flex items-center justify-between text-xs">
            <div>
              <div className="font-bold text-slate-900">{studentName || studentId}</div>
              <div className="text-[11px] text-slate-500 font-mono">Roll / ID: {studentId}</div>
            </div>
            <div className="text-right">
              <div className="font-semibold text-sky-900">{examTitle || 'Active Exam'}</div>
              <div className="text-[10px] text-slate-500">Live Surveillance Required</div>
            </div>
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">{errorMsg}</div>
            </div>
          )}

          {/* STEP 1: Camera & Mic */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="text-center space-y-1">
                <h3 className="text-base font-bold text-slate-900">Step 1: Webcam &amp; Microphone Access</h3>
                <p className="text-xs text-slate-600">
                  Your front camera and microphone will stream continuously to the teacher's proctoring portal during the examination.
                </p>
              </div>

              {/* Video Preview Box */}
              <div className="relative w-full aspect-video bg-slate-900 rounded-2xl overflow-hidden border border-slate-300 flex items-center justify-center">
                {cameraStream ? (
                  <>
                    <video
                      ref={videoPreviewRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover mirror-mode"
                    />
                    {/* Live Mic Indicator Overlay */}
                    <div className="absolute bottom-3 left-3 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-sky-400/30 flex items-center gap-2">
                      <Mic className="w-3.5 h-3.5 text-emerald-400" />
                      <div className="w-16 h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-400 to-amber-400 transition-all duration-75"
                          style={{ width: `${Math.min(100, micVolume * 1.5)}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-mono text-emerald-300 font-bold">
                        {micVolume > 5 ? 'Active' : 'Mic Ready'}
                      </span>
                    </div>
                    <div className="absolute top-3 right-3 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shadow-xs">
                      <CheckCircle2 className="w-3 h-3" />
                      Camera &amp; Mic Verified
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center p-6 text-center text-slate-400 space-y-2">
                    <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-sky-400">
                      <Camera className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-semibold text-slate-300">Camera preview will appear here</span>
                    <span className="text-[11px] text-slate-500 max-w-xs">
                      Please ensure your face is well-lit and centered in frame.
                    </span>
                  </div>
                )}
              </div>

              {!cameraStream ? (
                <button
                  type="button"
                  onClick={handleRequestCameraMic}
                  disabled={cameraLoading}
                  className="w-full py-3.5 rounded-2xl bg-[#009fe3] hover:bg-[#0284c7] text-white text-sm font-bold shadow-md shadow-sky-500/20 flex items-center justify-center gap-2 transition-all min-h-[46px]"
                >
                  {cameraLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Requesting Camera &amp; Mic Permissions...</span>
                    </>
                  ) : (
                    <>
                      <Camera className="w-4 h-4" />
                      <Mic className="w-4 h-4" />
                      <span>Enable Camera &amp; Microphone</span>
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => (screenShareSupported ? setStep(2) : setStep(3))}
                  className="w-full py-3.5 rounded-2xl bg-[#009fe3] hover:bg-[#0284c7] text-white text-sm font-bold shadow-md shadow-sky-500/20 flex items-center justify-center gap-2 transition-all min-h-[46px]"
                >
                  <span>Proceed to Next Step</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {/* STEP 2: Screen Sharing (Desktop) */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="text-center space-y-1">
                <h3 className="text-base font-bold text-slate-900">Step 2: Entire Screen Sharing</h3>
                <p className="text-xs text-slate-600">
                  Select <strong>"Entire Screen"</strong> in the browser prompt so the invigilator can monitor your examination workspace.
                </p>
              </div>

              {/* Screen Preview Box */}
              <div className="relative w-full aspect-video bg-slate-900 rounded-2xl overflow-hidden border border-slate-300 flex items-center justify-center">
                {screenStream ? (
                  <>
                    <video
                      ref={screenPreviewRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute top-3 right-3 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shadow-xs">
                      <CheckCircle2 className="w-3 h-3" />
                      Screen Sharing Active
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center p-6 text-center text-slate-400 space-y-2">
                    <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-orange-400">
                      <Monitor className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-semibold text-slate-300">Live screen stream preview</span>
                    <span className="text-[11px] text-slate-500 max-w-xs">
                      Click the button below and choose "Entire Screen" to share.
                    </span>
                  </div>
                )}
              </div>

              {!screenStream ? (
                <button
                  type="button"
                  onClick={handleRequestScreenShare}
                  disabled={screenLoading}
                  className="w-full py-3.5 rounded-2xl bg-[#f25f22] hover:bg-[#ea580c] text-white text-sm font-bold shadow-md shadow-orange-500/20 flex items-center justify-center gap-2 transition-all min-h-[46px]"
                >
                  {screenLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Opening Screen Share Prompt...</span>
                    </>
                  ) : (
                    <>
                      <Monitor className="w-4 h-4" />
                      <span>Select Entire Screen to Share</span>
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="w-full py-3.5 rounded-2xl bg-[#009fe3] hover:bg-[#0284c7] text-white text-sm font-bold shadow-md shadow-sky-500/20 flex items-center justify-center gap-2 transition-all min-h-[46px]"
                >
                  <span>Proceed to Final Verification</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {/* STEP 3: Final Verification & Rules Agreement */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="text-center space-y-1">
                <h3 className="text-base font-bold text-slate-900">
                  Step {screenShareSupported ? '3' : '2'}: Invigilation Verification Ready
                </h3>
                <p className="text-xs text-slate-600">
                  Review your active feeds and confirm rules compliance before starting the exam.
                </p>
              </div>

              {/* Status checklist card */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-semibold text-slate-800">
                    <Camera className="w-4 h-4 text-[#009fe3]" />
                    <span>Candidate Webcam Video Feed</span>
                  </div>
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Live &amp; Streaming
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-semibold text-slate-800">
                    <Mic className="w-4 h-4 text-[#009fe3]" />
                    <span>Audio &amp; Ambient Noise Meter</span>
                  </div>
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Transmitting
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-semibold text-slate-800">
                    {isMobile ? (
                      <Smartphone className="w-4 h-4 text-[#f25f22]" />
                    ) : (
                      <Monitor className="w-4 h-4 text-[#f25f22]" />
                    )}
                    <span>
                      {isMobile
                        ? 'Mobile Device Guard (Front Cam + Viewport Lock)'
                        : 'Desktop Screen Share Feed'}
                    </span>
                  </div>
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {isMobile ? 'Mobile Mode Active' : 'Screen Streaming'}
                  </span>
                </div>
              </div>

              {/* Mobile Note if Mobile */}
              {isMobile && (
                <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                  <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <strong>Mobile Browser Notice:</strong> Mobile operating systems restrict third-party screen sharing in web browsers. Your front camera, microphone, and aggressive app-switching detection are actively invigilating your session.
                  </div>
                </div>
              )}

              {/* Strict Anti-Cheat Warning Notice */}
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-rose-700">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Strict Unfair Means Policy</span>
                </div>
                <p className="text-[11px] leading-relaxed text-rose-800">
                  The faculty invigilator is actively watching all live feeds. Tab switches, secondary devices, or looking away from the camera are flagged immediately. The teacher has full authority to <strong>instantaneously block or disqualify</strong> your submission.
                </p>
              </div>

              {/* Start Exam Button */}
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-4 py-3 rounded-2xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold transition-all min-h-[46px]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleFinalSubmit}
                  className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-[#009fe3] to-[#0284c7] hover:from-[#0284c7] hover:to-[#0369a1] text-white text-sm font-bold shadow-md shadow-sky-500/25 flex items-center justify-center gap-2 transition-all min-h-[46px]"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Start Proctored Examination</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
