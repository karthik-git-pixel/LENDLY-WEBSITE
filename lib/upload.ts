import { supabase } from './supabase';

/**
 * Uploads go to Supabase Storage (public "media" bucket for photos, private
 * "print-docs" bucket for print jobs). If Cloudinary is configured, photos
 * go there instead via a signed upload.
 */
const CLOUDINARY_CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

export type ImageFolder = 'products' | 'avatar' | 'cover';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;

/**
 * Fast client-side image compression using HTML5 Canvas & WebP encoding.
 * Reduces 5MB-15MB raw phone camera photos down to ~50KB-150KB in milliseconds.
 */
export async function compressImage(
  file: File,
  options?: { maxWidth?: number; maxHeight?: number; quality?: number }
): Promise<File> {
  // If not an image, or is SVG/GIF, return as is
  if (typeof window === 'undefined' || !file.type.startsWith('image/') || file.type === 'image/svg+xml' || file.type === 'image/gif') {
    return file;
  }

  const maxWidth = options?.maxWidth || 1200;
  const maxHeight = options?.maxHeight || 1200;
  const quality = options?.quality || 0.82;

  // Skip compression if already tiny (< 80KB)
  if (file.size < 80 * 1024) {
    return file;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;

        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve(file);
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob || blob.size >= file.size) {
              return resolve(file);
            }
            const extension = blob.type === 'image/webp' ? '.webp' : '.jpg';
            const fileName = file.name.replace(/\.[^/.]+$/, '') + extension;
            resolve(new File([blob], fileName, { type: blob.type || 'image/jpeg', lastModified: Date.now() }));
          },
          'image/webp',
          quality
        );
      };
      img.onerror = () => resolve(file);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

function presetFor(folder: ImageFolder) {
  if (folder === 'avatar') return { maxWidth: 400, maxHeight: 400, quality: 0.85 };
  if (folder === 'cover') return { maxWidth: 1400, maxHeight: 600, quality: 0.82 };
  return { maxWidth: 1200, maxHeight: 1200, quality: 0.82 };
}

function uniqueName(file: File): string {
  const ext = (file.name.match(/\.([a-z0-9]+)$/i)?.[1] || file.type.split('/')[1] || 'bin').toLowerCase();
  const base = file.name
    .replace(/\.[^/.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'file';
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${base}.${ext}`;
}

async function accessToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('You must be logged in to upload files');
  return session.access_token;
}

async function uploadToCloudinary(file: File, folder: string): Promise<string> {
  const token = await accessToken();
  const signRes = await fetch('/api/cloudinary/sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ folder }),
  });
  if (!signRes.ok) {
    const errorData = await signRes.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to get upload signature');
  }
  const { signature, timestamp, apiKey, folder: signedFolder } = await signRes.json();

  const formData = new FormData();
  formData.append('file', file);
  if (signedFolder) formData.append('folder', signedFolder);
  formData.append('signature', signature);
  formData.append('timestamp', String(timestamp));
  formData.append('api_key', apiKey);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, { method: 'POST', body: formData });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.secure_url;
}

/** Uploads a photo and returns its public URL */
export async function uploadImage(file: File, userId: string, folder: ImageFolder = 'products'): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error(`${file.name} is not an image`);
  const optimized = await compressImage(file, presetFor(folder));
  if (optimized.size > MAX_IMAGE_BYTES) throw new Error(`${file.name} is larger than 10 MB`);

  if (CLOUDINARY_CLOUD_NAME) {
    return uploadToCloudinary(optimized, `lendly/${userId}/${folder}`);
  }

  const path = `${userId}/${folder}/${uniqueName(optimized)}`;
  const { error } = await supabase.storage.from('media').upload(path, optimized, {
    cacheControl: '31536000',
    contentType: optimized.type || 'image/jpeg',
    upsert: false,
  });
  if (error) {
    if (/bucket not found/i.test(error.message)) {
      throw new Error('Storage is not set up yet — run supabase/schema.sql in the Supabase SQL editor.');
    }
    throw new Error(error.message || 'Upload failed');
  }
  return supabase.storage.from('media').getPublicUrl(path).data.publicUrl;
}

export interface UploadedDocument {
  path: string;
  name: string;
  size: number;
  type: string;
}

/** Stores a document for a print shop; only the shop and the uploader can open it */
export async function uploadPrintDocument(file: File, providerId: string, buyerId: string): Promise<UploadedDocument> {
  const processed = file.type.startsWith('image/')
    ? await compressImage(file, { maxWidth: 2400, maxHeight: 2400, quality: 0.9 })
    : file;
  if (processed.size > MAX_DOCUMENT_BYTES) throw new Error(`${file.name} is larger than 25 MB`);

  const path = `${providerId}/${buyerId}/${uniqueName(processed)}`;
  const { error } = await supabase.storage.from('print-docs').upload(path, processed, {
    contentType: processed.type || 'application/octet-stream',
    upsert: false,
  });
  if (error) throw new Error(error.message || 'Upload failed');
  return { path, name: file.name, size: file.size, type: file.type || 'application/octet-stream' };
}

/** Short-lived link to a print document */
export async function getPrintDocumentUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from('print-docs').createSignedUrl(path, 60 * 60);
  if (error || !data) throw new Error(error?.message || 'Could not open the document');
  return data.signedUrl;
}
