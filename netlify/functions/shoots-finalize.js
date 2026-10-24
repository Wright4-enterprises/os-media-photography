import { getStore } from '@netlify/blobs';
import { requireAdmin } from '../lib/auth.js';
import { updateManifest, checkTitle, checkDate, isPhotoKey } from '../lib/manifest.js';

// Second step of adding a shoot: the photos have already been uploaded one at
// a time (photo-upload), this adds the shoot to the manifest.
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

  const { title, date, photoKeys } = body;
  if (!Array.isArray(photoKeys) || photoKeys.length === 0 || !photoKeys.every(isPhotoKey)) {
    return new Response('A title and at least one photo are required.', { status: 400 });
  }
  const invalid = checkTitle(title) || checkDate(date);
  if (invalid) {
    return new Response(invalid, { status: 400 });
  }

  const shootsStore = getStore('shoots', { consistency: 'strong' });

  const slug = title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const shootId = `${slug || 'shoot'}-${Date.now()}`;

  const { response } = await updateManifest(shootsStore, manifest => {
    // If the same upload is finalized twice (e.g. a retry after the first
    // reply got lost), don't add the shoot a second time.
    const existing = manifest.find(s => s.photoKeys && s.photoKeys[0] === photoKeys[0]);
    if (existing) {
      return new Response(JSON.stringify({ ok: true, shootId: existing.id }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    manifest.unshift({
      id: shootId,
      title: title.trim(),
      // Owen is in Perth; the server runs in UTC, so a missing date would
      // otherwise be "yesterday" before 8am. The admin form always sends one.
      date: date || new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Perth' }),
      photoKeys
    });
  });
  if (response) return response;

  return new Response(JSON.stringify({ ok: true, shootId }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
