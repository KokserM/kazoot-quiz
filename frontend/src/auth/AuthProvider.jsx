import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { fetchUsage } from '../lib/api';
import { getSupabase, isSupabaseConfigured, signInWithGoogle, signOut } from '../lib/supabase';

const AuthContext = createContext(null);

export const INITIAL_AUTH_STATE = {
  hasAuthoritativeAuthEvent: false,
  isAuthLoading: true,
  session: null,
};

export function isAuthoritativeAuthEvent(event, session) {
  return event !== 'INITIAL_SESSION' || Boolean(session);
}

export function reduceAuthSessionState(state, action) {
  if (action.type === 'auth-event') {
    const hasAuthoritativeAuthEvent =
      state.hasAuthoritativeAuthEvent || isAuthoritativeAuthEvent(action.event, action.session);

    return {
      hasAuthoritativeAuthEvent,
      isAuthLoading: false,
      session: action.session || null,
    };
  }

  if (action.type === 'initial-session') {
    if (state.hasAuthoritativeAuthEvent) {
      return {
        ...state,
        isAuthLoading: false,
      };
    }

    return {
      ...state,
      isAuthLoading: false,
      session: action.session || null,
    };
  }

  return state;
}

export function AuthProvider({ children }) {
  const [authState, dispatchAuthState] = useReducer(
    reduceAuthSessionState,
    isSupabaseConfigured
      ? INITIAL_AUTH_STATE
      : {
          ...INITIAL_AUTH_STATE,
          isAuthLoading: false,
        }
  );
  const [usage, setUsage] = useState(null);
  const [authError, setAuthError] = useState('');

  const { isAuthLoading, session } = authState;
  const accessToken = session?.access_token || null;
  const user = session?.user || null;

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return undefined;
    }

    let isMounted = true;
    let hasAuthoritativeAuthEvent = false;
    let subscription = null;

    getSupabase().then((supabase) => {
      if (!isMounted || !supabase) {
        return;
      }

      const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
        if (!isMounted) {
          return;
        }
        hasAuthoritativeAuthEvent = hasAuthoritativeAuthEvent || isAuthoritativeAuthEvent(event, nextSession);
        dispatchAuthState({ type: 'auth-event', event, session: nextSession || null });
      });
      subscription = data.subscription;

      supabase.auth
        .getSession()
        .then(({ data: sessionData }) => {
          if (isMounted && !hasAuthoritativeAuthEvent) {
            dispatchAuthState({ type: 'initial-session', session: sessionData.session || null });
          }
        })
        .catch(() => {
          if (isMounted && !hasAuthoritativeAuthEvent) {
            dispatchAuthState({ type: 'initial-session', session: null });
          }
        });
    }, () => {
      if (isMounted) dispatchAuthState({ type: 'initial-session', session: null });
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const tokenRef = useRef(accessToken);
  tokenRef.current = accessToken;

  // Stable identity so effects that poll usage don't restart on every render.
  const refreshUsage = useCallback(async () => {
    const token = tokenRef.current;
    if (!token) {
      setUsage(null);
      return null;
    }
    const payload = await fetchUsage(token);
    if (tokenRef.current === token) {
      setUsage(payload.usage);
    }
    return payload.usage;
  }, []);

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }
    if (!accessToken) {
      setUsage(null);
      return;
    }
    refreshUsage().catch(() => setUsage(null));
  }, [accessToken, isAuthLoading, refreshUsage]);

  const signIn = useCallback(async () => {
    setAuthError('');
    try {
      await signInWithGoogle();
    } catch (error) {
      setAuthError(error.message || 'Sign-in failed. Please try again.');
    }
  }, []);

  const doSignOut = useCallback(async () => {
    setUsage(null);
    setAuthError('');
    await signOut();
  }, []);

  const clearAuthError = useCallback(() => setAuthError(''), []);

  const value = useMemo(
    () => ({
      accessToken,
      authError,
      clearAuthError,
      isConfigured: isSupabaseConfigured,
      isAuthLoading,
      refreshUsage,
      signIn,
      signOut: doSignOut,
      usage,
      user,
    }),
    [accessToken, authError, clearAuthError, doSignOut, isAuthLoading, refreshUsage, signIn, usage, user]
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
