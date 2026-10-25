// Shared read-modify-write for manifest.json (the list of every shoot).
//
// Netlify Blobs has no locking, so two overlapping writes can silently
// clobber each other ("last write wins"). Each write is made conditional on
// the manifest not having changed since we read it (onlyIfMatch on its etag);
// if someone else wrote in between, we wait a moment and try again, waiting a
// little longer each time (with some randomness so two retries don't collide
// again).
//
// `change(manifest)` edits the array in place. It can return a Response to
// stop early (e.g. 404 when the shoot isn't there) without writing anything.
// Returns { manifest } on success, or { response } to send back as-is.
const MAX_ATTEMPTS = 8;

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function updateManifest(store, change) {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await wait(Math.min(1000, 40 * 2 ** attempt) * (0.5 + Math.random()));
    }

    const { data: manifestRaw, etag } = await store.getWithMetadata('manifest.json');
    const manifest = manifestRaw ? JSON.parse(manifestRaw) : [];

    const stop = await change(manifest);
    if (stop instanceof Response) return { response: stop };

    const writeOpts = etag ? { onlyIfMatch: etag } : { onlyIfNew: true };
    const { modified } = await store.set('manifest.json', JSON.stringify(manifest), writeOpts);
    if (modified) return { manifest };
  }

  return {
    response: new Response('Could not save — too many conflicting updates happening at once. Please try again.', { status: 409 })
  };
}

// Limits for what Owen can type, checked on the server as well as in the
// admin form so the API can't be used to store oversized or odd values.
export const MAX_TITLE_LENGTH = 100;

export function checkTitle(title) {
  if (typeof title !== 'string' || !title.trim()) return 'A shoot needs a title.';
  if (title.trim().length > MAX_TITLE_LENGTH) return `Shoot titles can be at most ${MAX_TITLE_LENGTH} characters.`;
  return null;
}

export function checkDate(date) {
  if (date === undefined || date === null || date === '') return null;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) {
    return 'The date must look like 2026-10-24.';
  }
  return null;
}

// Photo keys look like "<shoot-id>/<name>.jpg". Anything else (including
// "manifest.json") is refused so an upload can never overwrite the list.
export function isPhotoKey(key) {
  return typeof key === 'string' && key.length <= 200 && /^[a-z0-9-]+\/[A-Za-z0-9_-]+\.jpg$/.test(key);
}

// Cache tag for one shoot's photos, so they can be cleared from Netlify's CDN
// when photos are deleted.
export function shootCacheTag(key) {
  return 'shoot-' + String(key).split('/')[0];
}
