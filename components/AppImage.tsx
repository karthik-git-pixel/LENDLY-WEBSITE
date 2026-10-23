import NextImage, { type ImageProps } from 'next/image';

/** Photos people upload; already compressed to WebP (≤ 1200px) before upload */
const UPLOADED = /^https:\/\/[^/]+\.supabase\.co\/storage\/v1\/object\/public\//;

/**
 * next/image, except uploaded photos skip the optimizer in local dev. Some ISPs
 * (NAT64/DNS64) resolve Supabase to 64:ff9b:: addresses, which the optimizer
 * treats as private and refuses to fetch. Production still optimizes them.
 */
export default function Image(props: ImageProps) {
  const skip = process.env.NODE_ENV === 'development' && typeof props.src === 'string' && UPLOADED.test(props.src);
  return <NextImage {...props} unoptimized={props.unoptimized || skip} />;
}
