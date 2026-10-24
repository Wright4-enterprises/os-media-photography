// Checks the Netlify Identity token on an admin request.
// Decoding the token is not enough - anyone can make one up. Netlify checks
// the token itself before the function runs and, when it's real, passes the
// logged-in user in globalThis.netlifyIdentityContext. If that isn't there we
// ask this site's Identity service directly, which only answers with a user
// if the token is real, unexpired and was signed by this site.
// Returns null when the request is allowed, or a 401/403 Response to send back.
export async function requireAdmin(req) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response('Unauthorized - please log in.', { status: 401 });
  }

  const identity = globalThis.netlifyIdentityContext || null;
  let user = identity && identity.user ? identity.user : null;

  if (!user) {
    let status = 'no answer';
    try {
      const base = identity && identity.url
        ? identity.url.replace(/\/$/, '')
        : new URL('/.netlify/identity', req.url).href;
      const res = await fetch(base + '/user', { headers: { Authorization: authHeader } });
      status = res.status;
      if (res.ok) user = await res.json();
    } catch (e) {
      status = 'unreachable';
    }
    if (!user) {
      return new Response(`Unauthorized - please log in again. (login check: ${status})`, { status: 401 });
    }
  }

  // Optional extra lock: set ADMIN_EMAILS (comma separated) in the Netlify
  // site settings to allow only those logins, even if someone else gets an
  // Identity account on this site.
  const allowed = (process.env.ADMIN_EMAILS || '')
    .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  if (allowed.length && !allowed.includes(String(user.email || '').toLowerCase())) {
    return new Response('Forbidden - this account is not an admin.', { status: 403 });
  }

  return null;
}
