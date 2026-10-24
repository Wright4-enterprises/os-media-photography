// Downloads every photo and the shoot list from Netlify Blobs to a folder on
// your computer, so there's a copy outside Netlify.
//
// Run it from the project folder:
//   npm install
//   NETLIFY_SITE_ID=<site id> NETLIFY_AUTH_TOKEN=<token> node scripts/backup-photos.mjs
//
// Site ID: Netlify > Project configuration > General > Project information.
// Token: Netlify > User settings > Applications > Personal access tokens.
// Photos are saved to backups/<date>/, keeping their folder names.
import { getStore } from '@netlify/blobs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const siteID = process.env.NETLIFY_SITE_ID;
const token = process.env.NETLIFY_AUTH_TOKEN;
if (!siteID || !token) {
  console.error('Set NETLIFY_SITE_ID and NETLIFY_AUTH_TOKEN first (see the top of this file).');
  process.exit(1);
}

const store = getStore({ name: 'shoots', siteID, token });
const outDir = join('backups', new Date().toISOString().slice(0, 10));

const { blobs } = await store.list();
let saved = 0;
for (const { key } of blobs) {
  const data = await store.get(key, { type: 'arrayBuffer' });
  if (!data) continue;
  const file = join(outDir, key);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, Buffer.from(data));
  saved++;
  if (saved % 25 === 0) console.log(`${saved} of ${blobs.length} saved...`);
}
console.log(`Done: ${saved} files saved to ${outDir}`);
