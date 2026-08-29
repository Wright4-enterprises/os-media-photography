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

 const { shootId, title, date, coverPhoto, featuredPhotos, photoKeys, deletePhotoKey, hidden, archived } = body;

  if (!shootId) {
    return new Response('A shootId is required.', { status: 400 });
  }

  const shootsStore = getStore('shoots', { consistency: 'strong' });

  if (deletePhotoKey) {
    await shootsStore.delete(deletePhotoKey);
  }

  // Netlify Blobs has no built-in locking: two overlapping writes to the same
  // manifest.json can silently clobber each other ("last write wins"). This
  // shoot is only ever touched from the admin page, but this endpoint IS
  // called from multiple UI actions (archive, hide, edit, photo-delete-undo)
  // that can legitimately overlap in time. Guard with an optimistic-concurrency
  // retry loop: read the manifest + its etag, apply the change, write back
  // ONLY if nobody else wrote in the meantime (onlyIfMatch); if someone did,
  // re-read the now-current manifest and re-apply our change on top of it.
  let shoot;
  const MAX_ATTEMPTS = 8;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const { data: manifestRaw, etag } = await shootsStore.getWithMetadata('manifest.json');
    const manifest = manifestRaw ? JSON.parse(manifestRaw) : [];

    const shootIndex = manifest.findIndex(s => s.id === shootId);
    if (shootIndex === -1) {
      return new Response('Shoot not found.', { status: 404 });
    }

    shoot = manifest[shootIndex];

    if (title !== undefined) shoot.title = title;
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

    manifest[shootIndex] = shoot;

    const writeOpts = etag ? { onlyIfMatch: etag } : { onlyIfNew: true };
    const { modified } = await shootsStore.set('manifest.json', JSON.stringify(manifest), writeOpts);
    if (modified) break;
    // Someone else wrote manifest.json between our read and our write.
    // Loop again: re-read the fresh manifest and re-apply this change on top of it.
    if (attempt === MAX_ATTEMPTS - 1) {
      return new Response('Could not save — too many conflicting updates happening at once. Please try again.', { status: 409 });
    }
  }

  return new Response(JSON.stringify({ ok: true, shoot }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
