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

  const { shootId, title, date, coverPhoto, featuredPhotos, photoKeys, deletePhotoKey } = body;
  if (!shootId) {
    return new Response('A shootId is required.', { status: 400 });
  }

  const shootsStore = getStore('shoots');

  const manifestRaw = await shootsStore.get('manifest.json');
  const manifest = manifestRaw ? JSON.parse(manifestRaw) : [];

  const shootIndex = manifest.findIndex(s => s.id === shootId);
  if (shootIndex === -1) {
    return new Response('Shoot not found.', { status: 404 });
  }

  const shoot = manifest[shootIndex];

  if (title !== undefined) shoot.title = title;
  if (date !== undefined) shoot.date = date;
  if (coverPhoto !== undefined) shoot.coverPhoto = coverPhoto;
  if (featuredPhotos !== undefined) shoot.featuredPhotos = featuredPhotos;
  if (photoKeys !== undefined) shoot.photoKeys = photoKeys;

  if (deletePhotoKey) {
    await shootsStore.delete(deletePhotoKey);
    shoot.photoKeys = shoot.photoKeys.filter(k => k !== deletePhotoKey);
    if (shoot.coverPhoto === deletePhotoKey) {
      shoot.coverPhoto = shoot.photoKeys[0] || null;
    }
    if (shoot.featuredPhotos) {
      shoot.featuredPhotos = shoot.featuredPhotos.filter(k => k !== deletePhotoKey);
    }
  }

  manifest[shootIndex] = shoot;
  await shootsStore.set('manifest.json', JSON.stringify(manifest));

  return new Response(JSON.stringify({ ok: true, shoot }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
