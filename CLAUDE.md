# Notes for Claude

The live site for OS Media, Owen's photography business, at
osmediaphotography.com. Oscar runs the site and the code; Owen is the
photographer and uses the admin page to add shoots. Oscar isn't a developer:
explain things in plain words, and say exactly what he needs to click.

## How it's built
- Plain HTML pages, no build step. Netlify publishes the whole repo folder
  (`publish = "."`), so any new file in the repo is public on the live site
  unless `netlify.toml` blocks it. Block anything that isn't meant for
  visitors (docs, config, scripts).
- Backend: Netlify Functions in `netlify/functions/`, shared code in
  `netlify/lib/`. Photos and the shoot list live in Netlify Blobs.
- Logins: Netlify Identity, invite only. Saving (add, edit, delete shoots)
  needs the `admin` role on the account (Identity > Users > the user >
  Roles). `ADMIN_EMAILS` has been deleted; the role is the only way in. Other
  roles on the accounts (host, photographer) are just labels the code
  doesn't use - leave them alone.
- Pushing to `main` deploys straight to the live site.

## Changes that can lock someone out or break the live site
Logins, admin access, environment variables, redirects, saving or deleting
data, DNS. Before suggesting one:
1. Find the way to test it where only Oscar is affected if it goes wrong,
   never Owen. Example: to drop the email list, remove Oscar's email first
   and test the role on his account while Owen is still covered.
2. Set up the rollback before the change, not after (copy the old value,
   know which deploy to republish).
3. Say exactly what each test proves and what it doesn't. A test that passes
   through the old path doesn't prove the new one.
4. Remember Netlify only reads environment variable changes on the next
   deploy, and a logged-in user keeps their old roles until they log out and
   back in (or their login refreshes, within an hour).
