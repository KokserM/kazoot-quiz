// The Supabase client (~45 kB gzipped) is loaded after first paint, so the
// landing page doesn't wait for it.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

let clientPromise = null;

export function getSupabase() {
  if (!isSupabaseConfigured) {
    return Promise.resolve(null);
  }
  clientPromise =
    clientPromise ||
    import('@supabase/supabase-js').then(({ createClient }) => createClient(supabaseUrl, supabaseAnonKey));
  return clientPromise;
}

export function getOAuthRedirectTo({ origin = window.location.origin, pathname = window.location.pathname } = {}) {
  const returnPath = pathname && pathname !== '/' ? pathname : '/account';
  return `${origin}${returnPath}`;
}

export async function signInWithGoogle() {
  const supabase = await getSupabase();
  if (!supabase) {
    throw new Error('Sign-in is not configured.');
  }
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: getOAuthRedirectTo() },
  });
  if (error) {
    throw error;
  }
}

export async function signOut() {
  const supabase = await getSupabase();
  await supabase?.auth.signOut();
}
