// Checks the Netlify Identity token on an admin request.
// Decoding the token is not enough - anyone can make one up. Netlify checks
// the token itself before the function runs and, when it's real, passes the
// logged-in user in globalThis.netlifyIdentityContext. If that isn't there we
// ask this site's Identity service directly, which only answers with a user
// if the token is real, unexpired and was signed by this site.
// Returns null when the request is allowed, or a 401/403 Response to send back.
// (See isAdmin below for who is allowed.)
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

  return isAdmin(user) ? null : new Response('Forbidden - this account is not an admin.', { status: 403 });
}

// Who counts as an admin:
//  1. Anyone given the "admin" role in Netlify (Identity > Users > the user >
//     Roles). Roles stay with the account even if its email changes, and
//     only someone logged into Netlify can set them - users can't give
//     themselves one.
//  2. Anyone listed in the ADMIN_EMAILS environment variable (comma
//     separated). This is the older way and still works so nothing breaks
//     while moving to roles.
// If ADMIN_EMAILS isn't set at all, only the "admin" role gets in.
export function isAdmin(user) {
  const roles = (user && user.app_metadata && user.app_metadata.roles) || [];
  if (roles.some(r => String(r).trim().toLowerCase() === 'admin')) return true;

  const allowed = (process.env.ADMIN_EMAILS || '')
    .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  return allowed.includes(String((user && user.email) || '').toLowerCase());
}
