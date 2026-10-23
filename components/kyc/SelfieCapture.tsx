'use client';

import { useEffect, useRef, useState } from 'react';
import Image from '@/components/AppImage';
import { Camera, Loader2, RefreshCw, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { toDocValue, useDocPreview, type DocValue } from './DocumentUpload';

const CAMERA_ERRORS: Record<string, string> = {
  NotAllowedError: 'Camera access is blocked. Allow it in your browser settings, or upload a photo instead.',
  NotFoundError: 'No camera found on this device — upload a photo instead.',
  NotReadableError: 'Your camera is in use by another app. Close it and try again.',
  OverconstrainedError: 'Your camera couldn\'t start — upload a photo instead.',
};

interface SelfieCaptureProps {
  value: DocValue;
  onChange: (value: DocValue) => void;
}

/** Live front-camera selfie with a face guide; falls back to picking a photo */
export default function SelfieCapture({ value, onChange }: SelfieCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preview = useDocPreview(value);

  // Show the live camera, and always release it when it's no longer needed
  useEffect(() => {
    const video = videoRef.current;
    if (video && stream) {
      video.srcObject = stream;
      void video.play().catch(() => undefined);
    }
    return () => stream?.getTracks().forEach(track => track.stop());
  }, [stream]);

  const start = async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(window.isSecureContext
        ? 'This browser can\'t open the camera — upload a photo instead.'
        : 'The camera only works over HTTPS (or on localhost). Upload a photo instead.');
      return;
    }
    setStarting(true);
    try {
      setStream(await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      }));
    } catch (err) {
      setError(CAMERA_ERRORS[err instanceof DOMException ? err.name : ''] || 'Couldn\'t open the camera — upload a photo instead.');
    } finally {
      setStarting(false);
    }
  };

  const capture = () => {
    const video = videoRef.current;
    if (!video?.videoWidth) return;
    const scale = Math.min(1, 1280 / video.videoWidth);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(blob => {
      if (!blob) {
        toast.error('Couldn\'t take the photo — try again');
        return;
      }
      const file = new File([blob], 'selfie.jpg', { type: 'image/jpeg' });
      onChange({ file, preview: URL.createObjectURL(file) });
      setStream(null);
    }, 'image/jpeg', 0.9);
  };

  return (
    <div>
      <div className="kv-selfie">
        {value ? (
          preview
            ? <Image src={preview} alt="Your selfie" fill sizes="360px" unoptimized />
            : <div className="kv-selfie-empty"><Loader2 size={26} className="ln-spin" aria-label="Loading your selfie" /></div>
        ) : stream ? (
          <>
            <video ref={videoRef} playsInline muted autoPlay aria-label="Camera preview" />
            <span className="kv-selfie-guide" aria-hidden="true" />
          </>
        ) : (
          <div className="kv-selfie-empty">
            <Camera size={34} aria-hidden="true" />
            <span>{error || 'We compare this with the photo on your ID.'}</span>
          </div>
        )}
      </div>

      <div className="kv-selfie-actions">
        {value ? (
          <button type="button" className="ln-btn ln-btn-ghost" onClick={() => { onChange(null); void start(); }}>
            <RefreshCw size={16} aria-hidden="true" /> Retake
          </button>
        ) : stream ? (
          <>
            <button type="button" className="ln-btn ln-btn-primary" onClick={capture}>
              <Camera size={17} aria-hidden="true" /> Take photo
            </button>
            <button type="button" className="ln-btn ln-btn-ghost" onClick={() => setStream(null)}>Cancel</button>
          </>
        ) : (
          <button type="button" className="ln-btn ln-btn-primary" onClick={start} disabled={starting}>
            {starting ? <Loader2 size={17} className="ln-spin" aria-hidden="true" /> : <Camera size={17} aria-hidden="true" />}
            Open camera
          </button>
        )}
        {!stream && (
          <label className="ln-btn ln-btn-ghost">
            <input
              type="file"
              accept="image/*"
              capture="user"
              hidden
              onChange={e => {
                const picked = toDocValue(e.target.files?.[0], false);
                if (picked) onChange(picked);
                e.target.value = '';
              }}
            />
            <Upload size={16} aria-hidden="true" /> {value ? 'Use another photo' : 'Upload a photo'}
          </label>
        )}
      </div>
    </div>
  );
}
