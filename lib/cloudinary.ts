import { auth } from './firebase';

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

if (!CLOUD_NAME) {
  throw new Error("Missing env variable: NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME");
}

/**
 * Get the current user's Firebase Auth ID token for authenticated API calls.
 */
async function getAuthToken(): Promise<string> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('You must be logged in to upload images');
  }
  return currentUser.getIdToken();
}

/**
 * Fast client-side image compression using HTML5 Canvas & WebP encoding.
 * Reduces 5MB-15MB raw phone camera photos down to ~50KB-150KB in milliseconds,
 * speeding up upload times by up to 50x.
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
            const compressedFile = new File([blob], fileName, {
              type: blob.type || 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressedFile);
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

function getSubfolderPreset(subfolder: string): { maxWidth: number; maxHeight: number; quality: number } {
  if (subfolder.includes('avatar')) {
    return { maxWidth: 400, maxHeight: 400, quality: 0.85 };
  }
  if (subfolder.includes('cover')) {
    return { maxWidth: 1400, maxHeight: 600, quality: 0.82 };
  }
  return { maxWidth: 1200, maxHeight: 1200, quality: 0.82 };
}

export async function uploadImageToCloudinary(
  file: File,
  userId: string,
  subfolder: string = 'products'
): Promise<string> {
  const [token, optimizedFile] = await Promise.all([
    getAuthToken(),
    compressImage(file, getSubfolderPreset(subfolder)),
  ]);

  const formData = new FormData();
  formData.append('file', optimizedFile);
  formData.append('folder', `ASHMITH_RCART/${userId}/${subfolder}`);

  // Fetch upload signature
  const signRes = await fetch('/api/cloudinary/sign', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      folder: `ASHMITH_RCART/${userId}/${subfolder}`,
    }),
  });

  if (!signRes.ok) {
    const errorData = await signRes.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to get upload signature');
  }

  const { signature, timestamp, apiKey } = await signRes.json();

  formData.append('signature', signature);
  formData.append('timestamp', timestamp.toString());
  formData.append('api_key', apiKey);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: 'POST', body: formData }
  );

  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.secure_url;
}

export async function uploadDocumentToCloudinary(
  file: File,
  userId: string,
  subfolder: string = 'print_documents'
): Promise<{ url: string; name: string; size: number; type: string }> {
  const token = await getAuthToken();
  const isImage = file.type.startsWith('image/');
  const processedFile = isImage ? await compressImage(file, { maxWidth: 2400, maxHeight: 2400, quality: 0.9 }) : file;

  const formData = new FormData();
  formData.append('file', processedFile);
  formData.append('folder', `ASHMITH_RCART/${userId}/${subfolder}`);

  const signRes = await fetch('/api/cloudinary/sign', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      folder: `ASHMITH_RCART/${userId}/${subfolder}`,
    }),
  });

  if (!signRes.ok) {
    const errorData = await signRes.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to get upload signature');
  }

  const { signature, timestamp, apiKey } = await signRes.json();

  formData.append('signature', signature);
  formData.append('timestamp', timestamp.toString());
  formData.append('api_key', apiKey);

  // Use auto endpoint for automatic detection of images & PDFs
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`,
    { method: 'POST', body: formData }
  );

  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return {
    url: data.secure_url,
    name: file.name,
    size: file.size,
    type: file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream'),
  };
}

export function getCloudinaryUrl(publicId: string, transforms: string = 'w_400,h_400,c_fill,q_auto'): string {
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${transforms}/${publicId}`;
}
