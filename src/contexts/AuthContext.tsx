import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';

import { supabase } from '../lib/supabase';
import { setAuthToken, clearAuthToken } from '../api/client';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type GoogleSigninModule = typeof import('@react-native-google-signin/google-signin');

let googleSigninModulePromise: Promise<GoogleSigninModule> | null = null;
let googleSigninConfigured = false;

async function loadGoogleSigninModule() {
  if (!googleSigninModulePromise) {
    googleSigninModulePromise = import('@react-native-google-signin/google-signin');
  }
  try {
    return await googleSigninModulePromise;
  } catch (error) {
    googleSigninModulePromise = null;
    throw error;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.access_token) {
        setAuthToken(session.access_token);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.access_token) {
        setAuthToken(session.access_token);
      } else {
        clearAuthToken();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) throw error;
  };

  const signInWithGoogle = async () => {
    if (!process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID) {
      throw new Error('Google sign-in is not configured. Please set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.');
    }

    const { GoogleSignin, isErrorWithCode, statusCodes } = await loadGoogleSigninModule().catch(() => {
      throw new Error('Google sign-in requires a custom Expo development build. Expo Go cannot load this native module.');
    });

    if (!googleSigninConfigured) {
      GoogleSignin.configure({
        webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
        scopes: ['email', 'profile'],
      });
      googleSigninConfigured = true;
    }

    try {
      const hasPlayServices = await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });
      if (!hasPlayServices) {
        throw new Error('Google sign-in is unavailable. Please update Google Play Services.');
      }
    } catch (error) {
      if (isErrorWithCode(error) && error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        throw new Error('Google sign-in is unavailable. Please update Google Play Services.');
      }
      throw error;
    }

    const response = await GoogleSignin.signIn();
    if (response.type === 'cancelled') {
      return;
    }
    if (response.type !== 'success' || !response.data.idToken) {
      throw new Error('Google did not return an ID token');
    }

    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: response.data.idToken,
    });

    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    try {
      const { GoogleSignin } = await loadGoogleSigninModule();
      await GoogleSignin.signOut();
    } catch {
      // Supabase sign-out is the source of truth; Google sign-out is best effort.
    }
  };

  return (
    <AuthContext.Provider
      value={{ session, user, loading, signIn, signUp, signInWithGoogle, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
