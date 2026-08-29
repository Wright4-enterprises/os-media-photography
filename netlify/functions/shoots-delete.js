import { getStore } from '@netlify/blobs';

export default async (req, context) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Only a logged-in Netlify Identity user (i.e. Owen) can delete a shoot.
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response('Unauthorized - please log in.', { status: 401 });
  }
  const token = authHeader.split(' ')[1];

  try {
    JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
  } catch (e) {
    return new Response('Unauthorized - invalid token.', { status: 401 });
  }

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

  // Optimistic-concurrency retry: Netlify Blobs has no locking, so a plain
  // read-modify-write here can silently lose a concurrent change made by
  // another action (archive, hide, add-photos) on the same manifest.json.
  const MAX_ATTEMPTS = 8;
  let photoKeysToDelete = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const { data: manifestRaw, etag } = await shootsStore.getWithMetadata('manifest.json');
    const manifest = manifestRaw ? JSON.parse(manifestRaw) : [];

    const shoot = manifest.find(s => s.id === shootId);
    if (!shoot) {
      return new Response('Shoot not found.', { status: 404 });
    }
    photoKeysToDelete = shoot.photoKeys;

    const updatedManifest = manifest.filter(s => s.id !== shootId);
    const writeOpts = etag ? { onlyIfMatch: etag } : { onlyIfNew: true };
    const { modified } = await shootsStore.set('manifest.json', JSON.stringify(updatedManifest), writeOpts);
    if (modified) break;
    if (attempt === MAX_ATTEMPTS - 1) {
      return new Response('Could not save — too many conflicting updates happening at once. Please try again.', { status: 409 });
    }
  }

  // Delete every photo blob belonging to this shoot (safe to do after the
  // manifest write - the shoot is already gone from the list either way).
  for (const key of photoKeysToDelete) {
    await shootsStore.delete(key);
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
