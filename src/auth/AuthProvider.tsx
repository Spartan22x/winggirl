import { Session, User } from '@supabase/supabase-js';
import { PropsWithChildren, createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase, supabaseConfigured } from '@/src/lib/supabase';

const configurationError = () => new Error('Supabase is not configured. Copy .env.example to .env and add your project URL and public key.');

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null; session: Session | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null; session: Session | null }>;
  signInWithProvider: (provider: 'google' | 'apple' | 'facebook') => Promise<{ error: Error | null }>;
  signOut: () => Promise<{ error: Error | null }>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    user: session?.user ?? null,
    loading,
    signIn: async (email, password) => {
      if (!supabaseConfigured) return { error: configurationError(), session: null };
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      return { error, session: data.session };
    },
    signUp: async (email, password) => {
      if (!supabaseConfigured) return { error: configurationError(), session: null };
      const { data, error } = await supabase.auth.signUp({ email, password });
      return { error, session: data.session };
    },
    signInWithProvider: async (provider) => {
      if (!supabaseConfigured) return { error: configurationError() };
      const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: 'winggirl://auth/callback' } });
      return { error };
    },
    signOut: async () => {
      if (!supabaseConfigured) return { error: null };
      const { error } = await supabase.auth.signOut();
      return { error };
    },
  }), [loading, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}