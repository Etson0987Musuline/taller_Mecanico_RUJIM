// No modifica el cliente administrativo compartido ni conserva tokens de Auth.
async function verificarPasswordSupabase(email, password, uid) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_PUBLIC_KEY)
    throw new Error('AUTH_CONFIG');
  let response;
  try {
    response = await fetch(`${process.env.SUPABASE_URL.replace(/\/$/, '')}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: process.env.SUPABASE_PUBLIC_KEY },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(15000),
    });
    if (response.status === 429 || response.status >= 500) throw new Error('AUTH_UNAVAILABLE');
    if (!response.ok) return false;
    const { user, access_token } = await response.json();
    return Boolean(access_token && user?.id === uid && user.email_confirmed_at &&
      user.email?.trim().toLowerCase() === email.trim().toLowerCase());
  } catch {
    throw new Error('AUTH_UNAVAILABLE');
  }
}
module.exports = { verificarPasswordSupabase };
