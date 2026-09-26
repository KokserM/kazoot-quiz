const { createClient } = require('@supabase/supabase-js');

const PROFILE_ENSURE_TTL_MS = 1000 * 60 * 15;

function getBearerToken(req) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null;
  }

  return token;
}

class SupabaseAuthService {
  constructor({ config }) {
    this.config = config;
    this.client =
      config.supabaseUrl && config.supabaseServiceRoleKey
        ? createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
            auth: {
              autoRefreshToken: false,
              persistSession: false,
            },
          })
        : null;
    this.profileEnsureCache = new Map();
  }

  isConfigured() {
    return Boolean(this.client);
  }

  async getUserFromRequest(req) {
    if (!this.client) {
      return null;
    }

    const token = getBearerToken(req);
    if (!token) {
      return null;
    }

    const { data, error } = await this.client.auth.getUser(token);
    if (error || !data?.user) {
      return null;
    }

    const user = data.user;
    await this.ensureProfile(user);

    return {
      id: user.id,
      email: user.email || '',
      displayName: user.user_metadata?.full_name || user.user_metadata?.name || '',
      avatarUrl: user.user_metadata?.avatar_url || '',
    };
  }

  async ensureProfile(user) {
    if (!this.client || !user?.id || !user?.email) {
      return;
    }

    const cacheKey = `${user.id}:${user.email}:${user.user_metadata?.full_name || user.user_metadata?.name || ''}:${user.user_metadata?.avatar_url || ''}`;
    const lastEnsuredAt = this.profileEnsureCache.get(cacheKey) || 0;
    if (Date.now() - lastEnsuredAt < PROFILE_ENSURE_TTL_MS) {
      return;
    }

    const { error } = await this.client.from('profiles').upsert(
      {
        id: user.id,
        email: user.email,
        display_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
        avatar_url: user.user_metadata?.avatar_url || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
    if (error) {
      // Credit functions need the profile row; surface this instead of failing later.
      throw new Error(`Failed to save profile: ${error.message}`);
    }
    this.profileEnsureCache.set(cacheKey, Date.now());
  }

  // Deletes the Supabase user. profiles, credit grants, ledger and subscription rows
  // cascade; quiz_generations and payments keep the row with user_id set to null
  // (payments are accounting records).
  async deleteUser(userId) {
    if (!this.client) {
      throw new Error('Accounts are not configured.');
    }
    const { error } = await this.client.auth.admin.deleteUser(userId);
    if (error) {
      throw new Error(`Failed to delete user: ${error.message}`);
    }
    for (const key of this.profileEnsureCache.keys()) {
      if (key.startsWith(`${userId}:`)) this.profileEnsureCache.delete(key);
    }
  }
}

module.exports = {
  SupabaseAuthService,
  getBearerToken,
};
