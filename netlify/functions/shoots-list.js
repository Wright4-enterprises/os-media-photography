import { getStore } from '@netlify/blobs';

export default async (req, context) => {
  const shootsStore = getStore('shoots');

  const manifestRaw = await shootsStore.get('manifest.json');
  const manifest = manifestRaw ? JSON.parse(manifestRaw) : [];

  // Turn stored photo keys into URLs the gallery page can use as <img src>
  const shoots = manifest.map(shoot => ({
    id: shoot.id,
    title: shoot.title,
    date: shoot.date,
    photos: shoot.photoKeys.map(key => `/.netlify/functions/photo?key=${encodeURIComponent(key)}`)
  }));

  return new Response(JSON.stringify({ shoots }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60'
    }
  });
};
