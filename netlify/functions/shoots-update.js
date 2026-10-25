import { getStore } from '@netlify/blobs';
import { requireAdmin } from '../lib/auth.js';
import { updateManifest, checkTitle, checkDate } from '../lib/manifest.js';
import { forgetPhotos } from '../lib/cache.js';

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

  const { shootId, title, date, coverPhoto, featuredPhotos, photoKeys, deletePhotoKey, hidden, archived } = body;

  if (!shootId) {
    return new Response('A shootId is required.', { status: 400 });
  }
  const invalid = (title !== undefined && checkTitle(title)) || checkDate(date);
  if (invalid) {
    return new Response(invalid, { status: 400 });
  }

  const shootsStore = getStore('shoots', { consistency: 'strong' });

  // This shoot is only ever touched from the admin page, but this endpoint IS
  // called from several UI actions (archive, hide, edit, photo delete) that
  // can overlap in time, so the change is applied through updateManifest.
  let shoot;
  const { response } = await updateManifest(shootsStore, manifest => {
    const shootIndex = manifest.findIndex(s => s.id === shootId);
    if (shootIndex === -1) {
      return new Response('Shoot not found.', { status: 404 });
    }

    shoot = manifest[shootIndex];

    if (title !== undefined) shoot.title = title.trim();
    if (date !== undefined) shoot.date = date;
    if (coverPhoto !== undefined) shoot.coverPhoto = coverPhoto;
    if (featuredPhotos !== undefined) shoot.featuredPhotos = featuredPhotos;
    if (photoKeys !== undefined) shoot.photoKeys = photoKeys;
    if (hidden !== undefined) shoot.hidden = hidden;
    if (archived !== undefined) shoot.archived = archived;

    if (deletePhotoKey) {
      shoot.photoKeys = shoot.photoKeys.filter(k => k !== deletePhotoKey);
      if (shoot.coverPhoto === deletePhotoKey) {
        shoot.coverPhoto = shoot.photoKeys[0] || null;
      }
      if (shoot.featuredPhotos) {
        shoot.featuredPhotos = shoot.featuredPhotos.filter(k => k !== deletePhotoKey);
      }
    }
  });
  if (response) return response;

  // Only remove the photo file once the manifest no longer points at it, so a
  // failed save never leaves the gallery showing a missing photo.
  if (deletePhotoKey) {
    await shootsStore.delete(deletePhotoKey);
    await forgetPhotos([deletePhotoKey]);
  }

  return new Response(JSON.stringify({ ok: true, shoot }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
