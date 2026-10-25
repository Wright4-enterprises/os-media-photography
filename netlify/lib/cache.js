import { shootCacheTag } from './manifest.js';

// Clears deleted photos from Netlify's CDN so they stop being served.
// This is the same call @netlify/functions' purgeCache() makes; Netlify gives
// every function SITE_ID and NETLIFY_PURGE_API_TOKEN, so no extra setup.
// A failure here must never fail the delete itself, so it is only logged:
// the worst case is a deleted photo staying reachable at its old link.
export async function forgetPhotos(keys) {
  const tags = [...new Set(keys.filter(Boolean).map(shootCacheTag))];
  const token = process.env.NETLIFY_PURGE_API_TOKEN;
  const siteID = process.env.SITE_ID;
  if (!tags.length || !token || !siteID) return;

  try {
    const res = await fetch('https://api.netlify.com/api/v1/purge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf8', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ site_id: siteID, cache_tags: tags })
    });
    if (!res.ok) console.error('Could not clear deleted photos from the CDN cache: status', res.status);
  } catch (e) {
    console.error('Could not clear deleted photos from the CDN cache:', e);
  }
}
