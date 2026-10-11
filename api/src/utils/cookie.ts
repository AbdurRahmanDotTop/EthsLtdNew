import { Context } from 'hono';

export function getCookieDomain(c: Context): string | undefined {
  const origin = c.req.header('origin') || c.req.header('referer') || '';
  if (origin.includes('ethsltd.com')) {
    return '.ethsltd.com';
  }
  return undefined; // Let the browser use the default domain for localhost/dev
}

export function getAuthCookieOptions(c: Context) {
  const isSecure = c.req.url.startsWith('https://') || c.req.header('x-forwarded-proto') === 'https';
  
  return {
    path: '/',
    secure: isSecure,
    sameSite: isSecure ? 'None' : 'Lax',
    domain: getCookieDomain(c),
  } as const;
}

export function clearAuthCookies(c: Context) {
  import('hono/cookie').then(({ deleteCookie }) => {
    const isSecure = c.req.url.startsWith('https://') || c.req.header('x-forwarded-proto') === 'https';
    const baseOpts = { path: '/', secure: isSecure, sameSite: isSecure ? 'None' : 'Lax' } as const;
    
    // Clear the main cookie
    deleteCookie(c, 'ethsltd_session', { ...baseOpts, domain: '.ethsltd.com' });
    
    // Clear possible duplicates that cause infinite logout loops
    deleteCookie(c, 'ethsltd_session', { ...baseOpts, domain: 'ethsltd.com' });
    deleteCookie(c, 'ethsltd_session', { ...baseOpts, domain: 'www.ethsltd.com' });
    deleteCookie(c, 'ethsltd_session', { ...baseOpts }); // Host-only
  });
}
