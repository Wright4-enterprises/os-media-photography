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

  const { shootId, photos } = body;
  if (!shootId || !Array.isArray(photos) || photos.length === 0) {
    return new Response('A shootId and at least one photo are required.', { status: 400 });
  }

  const shootsStore = getStore('shoots');

  const manifestRaw = await shootsStore.get('manifest.json');
  const manifest = manifestRaw ? JSON.parse(manifestRaw) : [];

  const shootIndex = manifest.findIndex(s => s.id === shootId);
  if (shootIndex === -1) {
    return new Response('Shoot not found.', { status: 404 });
  }

  const shoot = manifest[shootIndex];
  const startIndex = shoot.photoKeys.length;

  for (let i = 0; i < photos.length; i++) {
    const dataUrl = photos[i];
    const base64 = dataUrl.split(',')[1] || dataUrl;
    const buffer = Buffer.from(base64, 'base64');
    const key = `${shootId}/${startIndex + i}.jpg`;
    await shootsStore.set(key, buffer);
    shoot.photoKeys.push(key);
  }

  manifest[shootIndex] = shoot;
  await shootsStore.set('manifest.json', JSON.stringify(manifest));

  return new Response(JSON.stringify({ ok: true, shoot }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
