// HTTP session cookie helpers for opaque Redis-backed tokens.

const SESSION_COOKIE_NAME = 'ag_session';

function sessionCookieAttributes() {
  const parts = ['Path=/', 'HttpOnly', 'SameSite=Lax'];
  if (process.env.NODE_ENV === 'production') {
    parts.push('Secure');
  }
  return parts.join('; ');
}

/**
 * Parse a raw `Cookie` header into a plain name → value map.
 * Values are URL-decoded when possible.
 */
function parseCookies(cookieHeader) {
  if (!cookieHeader || typeof cookieHeader !== 'string') {
    return {};
  }

  const cookies = {};
  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;

    const name = trimmed.slice(0, eq).trim();
    const rawValue = trimmed.slice(eq + 1).trim();
    if (!name) continue;

    try {
      cookies[name] = decodeURIComponent(rawValue);
    } catch {
      cookies[name] = rawValue;
    }
  }

  return cookies;
}

function getSessionTokenFromRequest(req) {
  const header = req?.headers?.cookie;
  const cookies = parseCookies(header);
  return cookies[SESSION_COOKIE_NAME];
}

function setSessionCookie(res, token) {
  const attrs = sessionCookieAttributes();
  res.append('Set-Cookie', `${SESSION_COOKIE_NAME}=${token}; ${attrs}`);
}

function clearSessionCookie(res) {
  const attrs = sessionCookieAttributes();
  res.append('Set-Cookie', `${SESSION_COOKIE_NAME}=; ${attrs}; Max-Age=0`);
}

module.exports = {
  SESSION_COOKIE_NAME,
  parseCookies,
  getSessionTokenFromRequest,
  setSessionCookie,
  clearSessionCookie,
};
