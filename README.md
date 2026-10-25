# OS Media — Setup Guide

## 1. Create the GitHub repo
1. Go to your `wright4-enterprises` organization on GitHub.
2. Click **New repository**.
3. Name it `os-media-photography`, set it to **Private**, and create it (don't
   add a README/gitignore — this folder already has everything).
4. On the empty repo page, click **uploading an existing file**.
5. Drag this entire folder's contents in (all the files and the `images` and
   `netlify` folders together) and commit.

## 2. Connect this repo to your existing Netlify site
Since the site is already live at osmediaphotography.com, you don't need to
create a new Netlify site — just link the existing one to this repo so it
deploys automatically from now on:
1. Open the site in Netlify.
2. Go to **Site configuration → Build & deploy → Link repository**
   (sometimes shown as "Link site to Git").
3. Choose GitHub, then pick `wright4-enterprises/os-media-photography`.
4. Leave the build settings as detected (publish directory `.`,
   functions directory `netlify/functions`) and save.

From this point on, any update to the code (pushed to GitHub) automatically
redeploys the live site — no more dragging files onto Netlify.

## 3. Turn on Netlify Identity (this is what lets Owen log in)
1. In the Netlify dashboard for the site, go to **Site configuration → Identity**.
2. Click **Enable Identity**.
3. Under **Registration**, set it to **Invite only** (so random people can't
   sign themselves up).
4. Under **Identity → Invite users**, enter Owen's email address and send
   the invite. He'll get an email to set a password.

## 4. Try it out
- Go to `osmediaphotography.com/admin.html`
- Log in with the invited account
- Add a shoot (name, date, photos)
- Check `osmediaphotography.com/gallery.html` — the new shoot should appear
  as its own album, separate from every other shoot

## How it all fits together
- `index.html` — the homepage
- `gallery.html` — the full shoot-by-shoot archive, one album per shoot
- `admin.html` — where Owen adds new shoots (no coding, just a form)
- `netlify/functions/` — the backend: stores photos, keeps the list of
  shoots, and serves images back to the gallery page
- `netlify/lib/` — shared code for the functions: the login check
  (`auth.js`), safe saving of the shoot list (`manifest.js`) and clearing
  deleted photos from the CDN (`cache.js`)
- `scripts/backup-photos.mjs` — downloads every photo to your computer

Whenever Owen adds a shoot through the admin page, it's saved permanently
(via Netlify Blobs) and shows up on the gallery automatically — nothing
about the code ever needs to change for a new shoot.

## Admin access
Only accounts invited under **Identity → Users** can log in. To lock the admin
page to specific accounts as well, set the environment variable
`ADMIN_EMAILS` (Project configuration → Environment variables) to a
comma-separated list, e.g. `osmedia1@outlook.com, oscar@wright4.com.au`.
It takes effect on the next deploy. Keep **Registration** set to
**Invite only**.

## Backups
The photos only live in Netlify Blobs, so take a copy now and then:

```
npm install
NETLIFY_SITE_ID=<site id> NETLIFY_AUTH_TOKEN=<token> node scripts/backup-photos.mjs
```

The site ID is under Project configuration → General; make a personal access
token under User settings → Applications. Files are saved to `backups/<date>/`
(ignored by git).

## If a deploy breaks the site
Netlify keeps every deploy. Go to **Deploys**, open the last good one and
click **Publish deploy** to roll back instantly, then fix the code and push
again.
