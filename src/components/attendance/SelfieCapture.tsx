import { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Camera } from '@capacitor/camera';
import { Camera as CameraIcon, RotateCcw, Loader2, AlertCircle } from 'lucide-react';

const isNative = Capacitor.isNativePlatform();

interface SelfieCaptureProps {
  onCapture?: (dataUrl: string | null) => void;
  watermark?: string;
  disabled?: boolean;
}

export function SelfieCapture(props: SelfieCaptureProps) {
  return <WebCapture {...props} />;
}


function WebCapture({
  onCapture,
  watermark = '',
  disabled,
}: SelfieCaptureProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mountedRef = useRef(true);
  const requestRef = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);
  const [preview, setPreview] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) {
      try { videoRef.current.pause(); } catch { /* ignore */ }
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    // Guard against unmounted / already-running
    if (!mountedRef.current) return;
    // Stop any existing stream cleanly first
    stopCamera();
    const request = ++requestRef.current;

    try {
      setError(null);
      setStarting(true);
      if (isNative) {
        const permission = await Camera.checkPermissions();
        if (permission.camera !== 'granted') {
          const result = await Camera.requestPermissions({ permissions: ['camera'] });
          if (result.camera !== 'granted') throw new Error('Allow camera access in app settings to take a selfie.');
        }
      }
      if (!mountedRef.current || request !== requestRef.current) return;
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Live camera is unavailable. Use HTTPS or update Android System WebView.');
      const s = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { exact: 'user' },
          width: { ideal: 720 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      // If unmounted while awaiting stream, kill it and bail
      if (!mountedRef.current || request !== requestRef.current) {
        s.getTracks().forEach((t) => t.stop());
        return;
      }

      if (s.getVideoTracks()[0]?.getSettings().facingMode === 'environment') {
        s.getTracks().forEach(track => track.stop());
        throw new Error('Front camera could not be selected. Please check camera access and try again.');
      }
      streamRef.current = s;
      const v = videoRef.current;
      if (!v) {
        // Component gone — release stream
        s.getTracks().forEach((t) => t.stop());
        return;
      }

      v.srcObject = s;

      // play() returns a promise that rejects with AbortError when
      // the media is removed (e.g. React StrictMode unmount+remount).
      // Swallow that specific case; only surface real errors.
      try {
        await v.play();
      } catch (playErr) {
        const name = (playErr as DOMException)?.name;
        if (name === 'AbortError') {
          // AbortError = unmounted mid-play; NotAllowed = user gesture missing
          // Both benign — don't set error.
          return;
        }
        throw playErr;
      }
    } catch (e) {
      if (!mountedRef.current || request !== requestRef.current) return;
      stopCamera();
      setError((e as DOMException)?.name === 'OverconstrainedError' ? 'Front camera is unavailable. Check that this device has a working selfie camera.' : e instanceof Error ? e.message : 'Camera access denied');
    } finally {
      if (mountedRef.current && request === requestRef.current) setStarting(false);
    }
  }, [stopCamera]);

  useEffect(() => {
    mountedRef.current = true;
    void startCamera();
    return () => {
      mountedRef.current = false;
      requestRef.current++;
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const capture = () => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c) return;
    if (v.videoWidth === 0 || v.videoHeight === 0) {
      // Camera not ready yet — retry after a beat
      setError('Camera is not ready. Please try again.');
      stopCamera();
      return;
    }
    const size = Math.min(v.videoWidth, v.videoHeight);
    const sx = (v.videoWidth - size) / 2;
    const sy = (v.videoHeight - size) / 2;
    c.width = 720;
    c.height = 720;
    const ctx = c.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.translate(c.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(v, sx, sy, size, size, 0, 0, c.width, c.height);
    ctx.restore();

    const dtStr = new Date().toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
    const barH = 100;
    ctx.fillStyle = 'rgba(61,40,23,0.78)';
    ctx.fillRect(0, c.height - barH, c.width, barH);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px Inter, sans-serif';
    ctx.fillText(dtStr, 20, c.height - barH + 34);
    ctx.font = '18px Inter, sans-serif';
    ctx.fillStyle = '#FED7AA';
    ctx.fillText((watermark || '').slice(0, 60), 20, c.height - barH + 66);
    ctx.fillStyle = '#F97316';
    ctx.font = 'bold 14px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('STEMmantra', c.width - 20, c.height - barH + 34);
    ctx.textAlign = 'left';

    const dataUrl = c.toDataURL('image/jpeg', 0.85);
    setPreview(dataUrl);
    stopCamera();
    onCapture?.(dataUrl);
  };

  const retake = () => {
    setPreview(null);
    setError(null);
    onCapture?.(null);
    void startCamera();
  };

  if (error) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-red-200 bg-red-50 p-6 text-center">
        <AlertCircle className="w-6 h-6 text-red-600 mx-auto" />
        <div className="text-red-600 font-semibold text-sm mt-2">Camera error</div>
        <div className="text-red-500 text-xs mt-1">{error}</div>
        <button onClick={retake} className="btn-primary mt-3">
          <RotateCcw className="w-4 h-4" />
          Try again
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="relative aspect-square w-full max-w-md mx-auto rounded-2xl overflow-hidden bg-brand-choco">
        {preview ? (
          <img src={preview} alt="captured selfie" className="w-full h-full object-cover" />
        ) : (
          <>
            <video
              ref={videoRef}
              className="w-full h-full object-cover scale-x-[-1]"
              playsInline
              muted
              autoPlay
            />
            {starting && (
              <div className="absolute inset-0 flex items-center justify-center text-white bg-brand-choco/40">
                <Loader2 className="w-8 h-8 animate-spin text-white" />
              </div>
            )}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-8 border-2 border-white/50 rounded-full" />
            </div>
          </>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />

      <div className="mt-4 flex gap-2 justify-center">
        {preview ? (
          <button type="button" className="btn-secondary" onClick={retake} disabled={disabled}>
            <RotateCcw className="w-4 h-4" />
            Retake
          </button>
        ) : (
          <button
            type="button"
            className="btn-primary"
            onClick={capture}
            disabled={starting || disabled}
          >
            <CameraIcon className="w-4 h-4" />
            Capture Selfie
          </button>
        )}
      </div>
    </div>
  );
}