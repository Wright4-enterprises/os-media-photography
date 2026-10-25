import { getStore } from '@netlify/blobs';
import { shootCacheTag } from '../lib/manifest.js';

export default async (req, context) => {
  const url = new URL(req.url);
  const key = url.searchParams.get('key');

  if (!key) {
    return new Response('Missing photo key.', { status: 400 });
  }
  // Every photo lives under a shoot folder ("<shoot-id>/0.jpg"); this stops
  // the manifest or anything else in the store being served as a "photo".
  // Deliberately looser than isPhotoKey so photos saved before that check
  // existed keep working.
  if (!key.includes('/')) {
    return new Response('Photo not found.', { status: 404 });
  }

  const shootsStore = getStore('shoots');
  const data = await shootsStore.get(key, { type: 'arrayBuffer' });

  if (!data) {
    return new Response('Photo not found.', { status: 404 });
  }

  // Photo keys are never reused, so a photo at a given key never changes.
  // Browsers keep it for a year, and Netlify's CDN keeps it ("durable") so
  // repeat views don't run this function again. Deleting a photo clears its
  // shoot's cache tag (see netlify/lib/cache.js); the CDN copy is also capped
  // at 30 days so a deleted photo can't linger longer even if that fails.
  return new Response(data, {
    status: 200,
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Netlify-CDN-Cache-Control': 'public, durable, max-age=2592000',
      'Netlify-Cache-Tag': shootCacheTag(key),
      'X-Content-Type-Options': 'nosniff'
    }
  });
};
