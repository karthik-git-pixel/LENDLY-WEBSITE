'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { FileText, ImagePlus, Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { getKycDocumentUrl } from '@/lib/upload';

/** A document picked in this session (file), or one already in the private bucket (path) */
export type DocValue = { file: File; preview: string } | { path: string; preview?: string } | null;

const MAX_BYTES = 10 * 1024 * 1024;

export function isPdfDoc(value: DocValue): boolean {
  if (!value) return false;
  return 'file' in value ? value.file.type === 'application/pdf' : /\.pdf$/i.test(value.path);
}

/** Something to show for a document: its local preview, or a short-lived link to the stored copy */
export function useDocPreview(value: DocValue): string | null {
  const path = value && !('file' in value) && !value.preview && !isPdfDoc(value) ? value.path : null;
  const [signed, setSigned] = useState<{ path: string; url: string } | null>(null);

  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    getKycDocumentUrl(path).then(url => { if (!cancelled) setSigned({ path, url }); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [path]);

  if (!value) return null;
  if (value.preview) return value.preview;
  return signed && signed.path === path ? signed.url : null;
}

/** Checks a picked file; returns it as a document value or null (with a toast) */
export function toDocValue(file: File | undefined, allowPdf: boolean): DocValue {
  if (!file) return null;
  const isImage = file.type.startsWith('image/');
  if (!isImage && !(allowPdf && file.type === 'application/pdf')) {
    toast.error(allowPdf ? 'Choose a photo or a PDF' : 'Choose a photo');
    return null;
  }
  if (file.size > MAX_BYTES) {
    toast.error('That file is larger than 10 MB');
    return null;
  }
  return { file, preview: isImage ? URL.createObjectURL(file) : '' };
}

interface DocumentUploadProps {
  label: string;
  value: DocValue;
  onChange: (value: DocValue) => void;
}

/** One side of an ID: tap to take a photo or pick a file, with a preview once chosen */
export default function DocumentUpload({ label, value, onChange }: DocumentUploadProps) {
  const preview = useDocPreview(value);

  if (!value) {
    return (
      <label className="kv-doc">
        <input
          type="file"
          accept="image/*,application/pdf"
          hidden
          onChange={e => {
            const picked = toDocValue(e.target.files?.[0], true);
            if (picked) onChange(picked);
            e.target.value = '';
          }}
        />
        <ImagePlus size={24} aria-hidden="true" />
        <strong>{label}</strong>
        <em>Photo or PDF · up to 10 MB</em>
      </label>
    );
  }

  return (
    <div className="kv-doc has-file">
      {isPdfDoc(value) ? (
        <span className="kv-doc-file">
          <FileText size={26} aria-hidden="true" />
          {'file' in value ? value.file.name : 'PDF on file'}
        </span>
      ) : preview ? (
        <Image src={preview} alt={`${label} of your ID`} fill sizes="(max-width: 640px) 50vw, 300px" unoptimized />
      ) : (
        <Loader2 size={22} className="ln-spin" aria-label="Loading preview" />
      )}
      <span className="kv-doc-tag">{label}</span>
      <button type="button" className="kv-doc-remove" aria-label={`Remove ${label.toLowerCase()} photo`} onClick={() => onChange(null)}>
        <X size={14} />
      </button>
    </div>
  );
}
