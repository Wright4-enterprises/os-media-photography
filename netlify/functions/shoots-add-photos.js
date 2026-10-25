import { getStore } from '@netlify/blobs';
import { requireAdmin } from '../lib/auth.js';
import { updateManifest, isPhotoKey } from '../lib/manifest.js';

// Adds already-uploaded photos (see photo-upload) to an existing shoot.
// Photos used to be sent here in one request, which broke once they added up
// to more than the ~6 MB request limit, and reused keys after a delete
// (overwriting an existing photo). Uploading separately with unique keys
// fixes both.
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

  const { shootId, photoKeys } = body;
  if (!shootId || !Array.isArray(photoKeys) || photoKeys.length === 0 || !photoKeys.every(isPhotoKey)) {
    return new Response('A shootId and at least one uploaded photo are required.', { status: 400 });
  }

  const shootsStore = getStore('shoots', { consistency: 'strong' });

  let shoot;
  const { response } = await updateManifest(shootsStore, manifest => {
    shoot = manifest.find(s => s.id === shootId);
    if (!shoot) {
      return new Response('Shoot not found.', { status: 404 });
    }
    // Skip keys already on the shoot, so a retried request doesn't add the
    // same photos twice.
    const newKeys = photoKeys.filter(k => !shoot.photoKeys.includes(k));
    shoot.photoKeys = [...shoot.photoKeys, ...newKeys];
  });
  if (response) return response;

  return new Response(JSON.stringify({ ok: true, shoot }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
