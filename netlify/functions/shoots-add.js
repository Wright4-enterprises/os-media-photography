import { getStore } from '@netlify/blobs';

export default async (req, context) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Only a logged-in Netlify Identity user (i.e. Owen) can add a shoot.
const authHeader = req.headers.get('authorization');
if (!authHeader || !authHeader.startsWith('Bearer ')) {
  return new Response('Unauthorized - please log in.', { status: 401 });
}
const token = authHeader.split(' ')[1];

let user;
try {
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
  user = payload;
} catch (e) {
  return new Response('Unauthorized - invalid token.', { status: 401 });
}


  let body;
  try {
    body = await req.json();
  } catch (e) {
    return new Response('Invalid request body.', { status: 400 });
  }

  const { title, date, photos } = body;
  if (!title || !Array.isArray(photos) || photos.length === 0) {
    return new Response('A shoot needs a title and at least one photo.', { status: 400 });
  }

 const shootsStore = getStore('shoots', { consistency: 'strong' });


  // Build a URL-safe id from the title + timestamp so two shoots never collide.
  const slug = title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const shootId = `${slug}-${Date.now()}`;

  // Save each photo as its own blob, e.g. shoots/my-shoot-123/0.jpg
  const photoPaths = [];
  for (let i = 0; i < photos.length; i++) {
    const dataUrl = photos[i];
    const base64 = dataUrl.split(',')[1] || dataUrl;
    const buffer = Buffer.from(base64, 'base64');
    const key = `${shootId}/${i}.jpg`;
    await shootsStore.set(key, buffer);
    photoPaths.push(key);
  }

  // Update the manifest (the index of all shoots)
  const manifestRaw = await shootsStore.get('manifest.json');
  const manifest = manifestRaw ? JSON.parse(manifestRaw) : [];

  manifest.unshift({
    id: shootId,
    title,
    date: date || new Date().toISOString().slice(0, 10),
    photoKeys: photoPaths
  });

  await shootsStore.set('manifest.json', JSON.stringify(manifest));

  return new Response(JSON.stringify({ ok: true, shootId }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
