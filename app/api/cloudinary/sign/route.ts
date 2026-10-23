import { v2 as cloudinary } from 'cloudinary';
import { NextResponse } from 'next/server';
import { getErrorMessage } from '@/lib/error-utils';
import { verifyAuth, isNonEmptyString } from '@/lib/verify-auth';

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(request: Request) {
  try {
    // Verify authentication — only logged-in users can request upload signatures
    await verifyAuth(request);

    const { folder } = await request.json() as { folder?: string };

    // Sanitize folder to prevent path traversal attacks
    let sanitizedFolder = '';
    if (isNonEmptyString(folder)) {
      // Remove any path traversal sequences and restrict to alphanumeric, underscores, hyphens, slashes
      sanitizedFolder = folder
        .replace(/\.\./g, '')          // Remove ".." sequences
        .replace(/[^a-zA-Z0-9_\-\/]/g, '_')  // Only allow safe characters
        .replace(/\/+/g, '/')          // Collapse multiple slashes
        .replace(/^\/|\/$/g, '');      // Remove leading/trailing slashes

      if (sanitizedFolder.length > 200) {
        return NextResponse.json({ error: 'Folder path too long' }, { status: 400 });
      }
    }

    const timestamp = Math.round(new Date().getTime() / 1000);

    const signature = cloudinary.utils.api_sign_request(
      { timestamp, folder: sanitizedFolder || undefined },
      process.env.CLOUDINARY_API_SECRET!
    );

    return NextResponse.json({
      signature,
      timestamp,
      apiKey: process.env.CLOUDINARY_API_KEY,
      folder: sanitizedFolder || undefined,
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return NextResponse.json({ error: getErrorMessage(error, 'Failed to sign upload request') }, { status: 500 });
  }
}
