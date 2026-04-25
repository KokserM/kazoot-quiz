import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { fetchUsage } from '../lib/api';
import { isSupabaseConfigured, signInWithGoogle, signOut, supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [usage, setUsage] = useState(null);
  const [authError, setAuthError] = useState('');

  const accessToken = session?.access_token || null;
  const user = session?.user || null;

  useEffect(() => {
    if (!supabase) {
      return undefined;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session || null);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession || null);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!accessToken) {
      setUsage(null);
      return;
    }

    fetchUsage(accessToken)
      .then((payload) => setUsage(payload.usage))
      .catch(() => setUsage(null));
  }, [accessToken]);

  const value = useMemo(
    () => ({
      accessToken,
      authError,
      clearAuthError: () => setAuthError(''),
      isConfigured: isSupabaseConfigured,
      refreshUsage: async () => {
        if (!accessToken) {
          setUsage(null);
          return null;
        }
        const payload = await fetchUsage(accessToken);
        setUsage(payload.usage);
        return payload.usage;
      },
      signIn: async () => {
        setAuthError('');
        try {
          await signInWithGoogle();
        } catch (error) {
          setAuthError(error.message);
        }
      },
      signOut,
      usage,
      user,
    }),
    [accessToken, authError, usage, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
