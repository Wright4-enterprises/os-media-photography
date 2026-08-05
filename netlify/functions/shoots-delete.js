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

  const shootsStore = getStore('shoots');

  const manifestRaw = await shootsStore.get('manifest.json');
  const manifest = manifestRaw ? JSON.parse(manifestRaw) : [];

  const shoot = manifest.find(s => s.id === shootId);
  if (!shoot) {
    return new Response('Shoot not found.', { status: 404 });
  }

  // Delete every photo blob belonging to this shoot
  for (const key of shoot.photoKeys) {
    await shootsStore.delete(key);
  }

  // Remove the shoot from the manifest and save
  const updatedManifest = manifest.filter(s => s.id !== shootId);
  await shootsStore.set('manifest.json', JSON.stringify(updatedManifest));

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
