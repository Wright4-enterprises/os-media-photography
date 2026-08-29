import { getStore } from '@netlify/blobs';

export default async (req, context) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

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

  const { title, date, photoKeys } = body;
  if (!title || !Array.isArray(photoKeys) || photoKeys.length === 0) {
    return new Response('A title and at least one photo key are required.', { status: 400 });
  }

  const shootsStore = getStore('shoots', { consistency: 'strong' });

  const slug = title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const shootId = `${slug}-${Date.now()}`;

  // Optimistic-concurrency retry: see shoots-update.js for why this matters -
  // Netlify Blobs has no locking, so a plain read-modify-write can silently
  // drop a concurrent change made by another action on the same manifest.json.
  const MAX_ATTEMPTS = 8;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const { data: manifestRaw, etag } = await shootsStore.getWithMetadata('manifest.json');
    const manifest = manifestRaw ? JSON.parse(manifestRaw) : [];

    manifest.unshift({
      id: shootId,
      title,
      date: date || new Date().toISOString().slice(0, 10),
      photoKeys
    });

    const writeOpts = etag ? { onlyIfMatch: etag } : { onlyIfNew: true };
    const { modified } = await shootsStore.set('manifest.json', JSON.stringify(manifest), writeOpts);
    if (modified) break;
    if (attempt === MAX_ATTEMPTS - 1) {
      return new Response('Could not save — too many conflicting updates happening at once. Please try again.', { status: 409 });
    }
  }

  return new Response(JSON.stringify({ ok: true, shootId }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
