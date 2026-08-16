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
  coverPhoto: shoot.coverPhoto || shoot.photoKeys[0],
  photos: shoot.photoKeys.map(key => `/.netlify/functions/photo?key=${encodeURIComponent(key)}`),
  photoKeys: shoot.photoKeys,
  featuredPhotos: shoot.featuredPhotos || [],
  hidden: shoot.hidden || false,
  archived: shoot.archived || false
}));


  return new Response(JSON.stringify({ shoots }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=1'
    }
  });
};
