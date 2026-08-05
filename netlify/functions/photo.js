import { getStore } from '@netlify/blobs';

export default async (req, context) => {
  const url = new URL(req.url);
  const key = url.searchParams.get('key');

  if (!key) {
    return new Response('Missing photo key.', { status: 400 });
  }

  const shootsStore = getStore('shoots');
  const data = await shootsStore.get(key, { type: 'arrayBuffer' });

  if (!data) {
    return new Response('Photo not found.', { status: 404 });
  }

  return new Response(data, {
    status: 200,
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=31536000, immutable'
    }
  });
};
