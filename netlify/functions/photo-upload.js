import { getStore } from '@netlify/blobs';
import { requireAdmin } from '../lib/auth.js';

export default async (req, context) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Only a logged-in Netlify Identity user (i.e. Owen) can do this.
  const denied = await requireAdmin(req);
  if (denied) return denied;

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
