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

  const manifestRaw = await shootsStore.get('manifest.json');
  const manifest = manifestRaw ? JSON.parse(manifestRaw) : [];

  manifest.unshift({
    id: shootId,
    title,
    date: date || new Date().toISOString().slice(0, 10),
    photoKeys
  });

  await shootsStore.set('manifest.json', JSON.stringify(manifest));

  return new Response(JSON.stringify({ ok: true, shootId }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
