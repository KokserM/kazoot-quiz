import React, { createContext, useContext, useEffect, useMemo, useReducer, useState } from 'react';
import { fetchUsage } from '../lib/api';
import { isSupabaseConfigured, signInWithGoogle, signOut, supabase } from '../lib/supabase';

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
    if (!supabase) {
      return undefined;
    }

    let isMounted = true;
    let hasAuthoritativeAuthEvent = false;

    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!isMounted) {
        return;
      }

      hasAuthoritativeAuthEvent =
        hasAuthoritativeAuthEvent || isAuthoritativeAuthEvent(event, nextSession);
      dispatchAuthState({ type: 'auth-event', event, session: nextSession || null });
    });

    supabase.auth
      .getSession()
      .then(({ data: sessionData }) => {
        if (!isMounted || hasAuthoritativeAuthEvent) {
          return;
        }

        dispatchAuthState({ type: 'initial-session', session: sessionData.session || null });
      })
      .catch(() => {
        if (!isMounted || hasAuthoritativeAuthEvent) {
          return;
        }

        dispatchAuthState({ type: 'initial-session', session: null });
      });

    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }

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
      isAuthLoading,
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
      signOut: async () => {
        setUsage(null);
        setAuthError('');
        await signOut();
      },
      usage,
      user,
    }),
    [accessToken, authError, isAuthLoading, usage, user]
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
