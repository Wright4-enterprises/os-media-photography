import { getStore } from '@netlify/blobs';
import { requireAdmin } from '../lib/auth.js';
import { isPhotoKey } from '../lib/manifest.js';

// Uploads one photo. The admin page sends photos one per request because a
// function request body is capped at about 6 MB.
export default async (req, context) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Only a logged-in Netlify Identity user (i.e. Owen) can do this.
  const denied = await requireAdmin(req);
  if (denied) return denied;

  let body;
  try {
    body = await req.json();
  } catch (e) {
    return new Response('Invalid request body.', { status: 400 });
  }

  const { key, photo } = body;
  if (!isPhotoKey(key) || typeof photo !== 'string') {
    return new Response('A valid photo key and photo are required.', { status: 400 });
  }

  const base64 = photo.split(',')[1] || photo;
  const buffer = Buffer.from(base64, 'base64');

  // Photos are always served as JPEGs, so only accept JPEG data (it starts
  // with the bytes FF D8 FF). The admin page converts every photo to JPEG.
  if (buffer.length < 3 || buffer[0] !== 0xff || buffer[1] !== 0xd8 || buffer[2] !== 0xff) {
    return new Response('That file is not a JPEG photo.', { status: 400 });
  }

  // Re-uploading the same key (a retry after a dropped connection) just
  // overwrites it with the same photo, so retries are safe.
  const shootsStore = getStore('shoots', { consistency: 'strong' });
  await shootsStore.set(key, buffer);

  return new Response(JSON.stringify({ ok: true, key }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
