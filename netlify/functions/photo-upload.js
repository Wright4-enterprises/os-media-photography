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

  const { key, photo } = body;
  if (!key || !photo) {
    return new Response('A key and photo are required.', { status: 400 });
  }

  const shootsStore = getStore('shoots', { consistency: 'strong' });

  const base64 = photo.split(',')[1] || photo;
  const buffer = Buffer.from(base64, 'base64');
  await shootsStore.set(key, buffer);

  return new Response(JSON.stringify({ ok: true, key }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
