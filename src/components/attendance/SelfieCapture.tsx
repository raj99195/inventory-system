import { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  Camera,
  CameraResultType,
  CameraSource,
  CameraDirection,
} from '@capacitor/camera';
import { Camera as CameraIcon, RotateCcw, Loader2, AlertCircle } from 'lucide-react';

const isNative = Capacitor.isNativePlatform();

interface SelfieCaptureProps {
  onCapture?: (dataUrl: string | null) => void;
  watermark?: string;
  disabled?: boolean;
}

export function SelfieCapture(props: SelfieCaptureProps) {
  return isNative ? <NativeCapture {...props} /> : <WebCapture {...props} />;
}

// ─── Watermark helper ──────────────────────────────────────────

async function watermarkDataUrl(
  dataUrl: string,
  watermark: string
): Promise<string> {
  const img = new Image();
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error('Watermark: image load failed'));
    img.src = dataUrl;
  });

  const size = 720;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Watermark: canvas 2D context unavailable');

  const src = Math.min(img.width, img.height);
  const sx = (img.width - src) / 2;
  const sy = (img.height - src) / 2;
  ctx.drawImage(img, sx, sy, src, src, 0, 0, size, size);

  const dtStr = new Date().toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  const barH = 100;
  ctx.fillStyle = 'rgba(61,40,23,0.78)';
  ctx.fillRect(0, size - barH, size, barH);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px Inter, sans-serif';
  ctx.fillText(dtStr, 20, size - barH + 34);
  ctx.font = '18px Inter, sans-serif';
  ctx.fillStyle = '#FED7AA';
  ctx.fillText((watermark || '').slice(0, 60), 20, size - barH + 66);
  ctx.fillStyle = '#F97316';
  ctx.font = 'bold 14px Inter, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('STEMmantra', size - 20, size - barH + 34);
  ctx.textAlign = 'left';

  return canvas.toDataURL('image/jpeg', 0.85);
}

// ══════════════════════════════════════════════════════════════
// NATIVE (Android) — Capacitor Camera
// ══════════════════════════════════════════════════════════════

function NativeCapture({
  onCapture,
  watermark = '',
  disabled,
}: SelfieCaptureProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasAutoStartedRef = useRef(false);

  const capture = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const perms = await Camera.checkPermissions();
      if (perms.camera !== 'granted') {
        const req = await Camera.requestPermissions({
          permissions: ['camera'],
        });
        if (req.camera !== 'granted') {
          setError(
            'Camera permission denied. Enable it in Settings → Apps → STEMmantra → Permissions.'
          );
          setBusy(false);
          return;
        }
      }

      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
        direction: CameraDirection.Front,
        saveToGallery: false,
        correctOrientation: true,
      });

      if (!image.dataUrl) throw new Error('Camera returned no data');
      const stamped = await watermarkDataUrl(image.dataUrl, watermark);
      setPreview(stamped);
      onCapture?.(stamped);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const lower = msg.toLowerCase();
      if (lower.includes('cancel') || lower.includes('user denied')) {
        // silent
      } else {
        setError(msg || 'Camera failed');
      }
    } finally {
      setBusy(false);
    }
  }, [onCapture, watermark]);

  useEffect(() => {
    if (hasAutoStartedRef.current) return;
    hasAutoStartedRef.current = true;
    const t = setTimeout(() => {
      void capture();
    }, 300);
    return () => clearTimeout(t);
  }, [capture]);

  const retake = () => {
    setPreview(null);
    onCapture?.(null);
    void capture();
  };

  if (error) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-red-200 bg-red-50 p-6 text-center">
        <AlertCircle className="w-6 h-6 text-red-600 mx-auto" />
        <div className="text-red-600 font-semibold text-sm mt-2">Camera error</div>
        <div className="text-red-500 text-xs mt-1">{error}</div>
        <button onClick={capture} className="btn-primary mt-3">
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
          <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-white p-6 text-center">
            {busy ? (
              <>
                <Loader2 className="w-8 h-8 animate-spin text-white" />
                <div className="text-sm text-white/80">Opening front camera…</div>
              </>
            ) : (
              <>
                <CameraIcon className="w-12 h-12 text-white/70" />
                <div className="text-sm text-white/80">Camera closed. Tap retake.</div>
              </>
            )}
          </div>
        )}
      </div>
      <div className="mt-4 flex gap-2 justify-center">
        {preview ? (
          <button type="button" className="btn-secondary" onClick={retake} disabled={disabled || busy}>
            <RotateCcw className="w-4 h-4" />
            Retake
          </button>
        ) : (
          !busy && (
            <button type="button" className="btn-primary" onClick={capture} disabled={disabled}>
              <CameraIcon className="w-4 h-4" />
              Open Camera
            </button>
          )
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// WEB (dev) — live getUserMedia preview
// ══════════════════════════════════════════════════════════════

function WebCapture({
  onCapture,
  watermark = '',
  disabled,
}: SelfieCaptureProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mountedRef = useRef(true);
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

    try {
      setStarting(true);
      const s = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 720 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      // If unmounted while awaiting stream, kill it and bail
      if (!mountedRef.current) {
        s.getTracks().forEach((t) => t.stop());
        return;
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
        if (name === 'AbortError' || name === 'NotAllowedError') {
          // AbortError = unmounted mid-play; NotAllowed = user gesture missing
          // Both benign — don't set error.
          return;
        }
        throw playErr;
      }
    } catch (e) {
      if (!mountedRef.current) return;
      setError(e instanceof Error ? e.message : 'Camera access denied');
    } finally {
      if (mountedRef.current) setStarting(false);
    }
  }, [stopCamera]);

  useEffect(() => {
    mountedRef.current = true;
    void startCamera();
    return () => {
      mountedRef.current = false;
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
      setTimeout(capture, 250);
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