// Checks the Netlify Identity token on an admin request.
// Decoding the token is not enough - anyone can make one up. Instead we hand
// it to this site's own Identity service, which only answers with a user if
// the token is real, unexpired and was signed by this site.
// Returns null when the request is allowed, or a 401/403 Response to send back.
export async function requireAdmin(req) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response('Unauthorized - please log in.', { status: 401 });
  }

  let user;
  try {
    const identityUrl = new URL('/.netlify/identity/user', req.url);
    const res = await fetch(identityUrl, { headers: { Authorization: authHeader } });
    if (!res.ok) {
      return new Response('Unauthorized - please log in again.', { status: 401 });
    }
    user = await res.json();
  } catch (e) {
    return new Response('Unauthorized - could not check your login.', { status: 401 });
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
