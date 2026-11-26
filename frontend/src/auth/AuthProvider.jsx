import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../lib/api.js';
import { supabase } from '../lib/supabaseClient.js';
import { queryClient } from '../lib/queryClient.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
      setProfile(null);
      return null;
    }

    try {
      const response = await apiFetch('/auth/me');
      setProfile(response.data);
      return response.data;
    } catch {
      await supabase.auth.signOut();
      setProfile(null);
      return null;
    }
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession()
      .then(async ({ data: { session }, error }) => {
        if (!active) return;
        if (error || !session) {
          setProfile(null);
          setIsLoading(false);
          return;
        }
        try {
          const response = await apiFetch('/auth/me');
          if (active) setProfile(response.data);
        } catch {
          await supabase.auth.signOut();
          if (active) setProfile(null);
        } finally {
          if (active) setIsLoading(false);
        }
      })
      .catch(() => { if (active) setIsLoading(false); });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      // Drop every cached API response so the next account never sees this one's data.
      if (event === 'SIGNED_OUT') { setProfile(null); queryClient.clear(); }
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (credentials) => {
    const response = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    const { session, profile: nextProfile } = response.data;
    const { error } = await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
    if (error) throw new Error('Unable to establish your session. Please sign in again.');
    setProfile(nextProfile);
    return nextProfile;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    queryClient.clear();
  }, []);

  const value = useMemo(() => ({ profile, setProfile, isLoading, signIn, signOut, refreshProfile }), [
    profile, isLoading, signIn, signOut, refreshProfile,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider.');
  return context;
}
