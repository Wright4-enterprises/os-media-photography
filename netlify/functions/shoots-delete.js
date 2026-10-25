import { getStore } from '@netlify/blobs';
import { requireAdmin } from '../lib/auth.js';
import { updateManifest } from '../lib/manifest.js';
import { forgetPhotos } from '../lib/cache.js';

export default async (req, context) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Only a logged-in Netlify Identity user (i.e. Owen) can delete a shoot.
  const denied = await requireAdmin(req);
  if (denied) return denied;

  let body;
  try {
    body = await req.json();
  } catch (e) {
    return new Response('Invalid request body.', { status: 400 });
  }

  const { shootId } = body;
  if (!shootId) {
    return new Response('A shootId is required.', { status: 400 });
  }

  const shootsStore = getStore('shoots', { consistency: 'strong' });

  let photoKeysToDelete = [];
  const { response } = await updateManifest(shootsStore, manifest => {
    const shootIndex = manifest.findIndex(s => s.id === shootId);
    if (shootIndex === -1) {
      return new Response('Shoot not found.', { status: 404 });
    }
    photoKeysToDelete = manifest[shootIndex].photoKeys || [];
    manifest.splice(shootIndex, 1);
  });
  if (response) return response;

  // Delete every photo blob belonging to this shoot (safe to do after the
  // manifest write - the shoot is already gone from the list either way).
  for (const key of photoKeysToDelete) {
    await shootsStore.delete(key);
  }
  await forgetPhotos(photoKeysToDelete);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
