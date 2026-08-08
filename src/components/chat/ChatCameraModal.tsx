import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, CircleNotch, X } from '@phosphor-icons/react';

interface ChatCameraModalProps {
  open: boolean;
  onClose: () => void;
  onCapture: (imageData: string) => void;
}

export const ChatCameraModal: React.FC<ChatCameraModalProps> = ({ open, onClose, onCapture }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (!open) {
      stopCamera();
      setError(null);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch {
        setError('Camera access denied or unavailable. Allow camera permission and try again.');
      }
    })();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [open, stopCamera]);

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    setCapturing(true);
    try {
      const maxWidth = 960;
      const scale = Math.min(1, maxWidth / video.videoWidth);
      const width = Math.round(video.videoWidth * scale);
      const height = Math.round(video.videoHeight * scale);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not capture photo');

      ctx.drawImage(video, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
      onCapture(dataUrl);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Capture failed');
    } finally {
      setCapturing(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="ops-card w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between border-b border-ops-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Camera size={16} weight="regular" className="text-brand" aria-hidden />
            <h3 className="text-sm font-semibold text-ops-text">Live camera</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-ops-muted hover:bg-slate-100" aria-label="Close">
            <X size={16} weight="regular" aria-hidden />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : (
            <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
              <video ref={videoRef} className="h-full w-full object-cover scale-x-[-1]" playsInline muted />
            </div>
          )}

          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="ops-btn-secondary flex-1 text-sm min-h-[40px]">
              Cancel
            </button>
            <button
              type="button"
              onClick={capture}
              disabled={Boolean(error) || capturing}
              className="ops-btn-primary flex-1 text-sm min-h-[40px]"
            >
              {capturing ? <CircleNotch size={16} weight="regular" className="animate-spin mx-auto" aria-hidden /> : 'Capture & send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
