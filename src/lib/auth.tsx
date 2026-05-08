import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "./supabase";
import type { User } from "@supabase/supabase-js";
import type { CapeTownRegion } from "./community";

export type UserLocation = {
  label: string;
  region: CapeTownRegion;
  coords?: { lat: number; lng: number };
};

export type UserProfile = {
  userId: string;
  username: string;
  email: string;
  fullName?: string;
  permanentLocation: UserLocation;
  currentLocation?: UserLocation;
  createdAt: string;
  profilePicture?: string;
};

type AuthInput = {
  username: string;
  email: string;
  password: string;
  fullName?: string;
  permanentLocation: UserLocation;
};

type ProfilePatch = {
  username?: string;
  fullName?: string;
  currentLocation?: UserLocation | null;
  permanentLocation?: UserLocation;
  changePermanentLocation?: boolean;
  profilePicture?: string;
};

type AuthContextValue = {
  user: UserProfile | null;
  loading: boolean;
  error: string | null;
  signup: (input: AuthInput) => Promise<boolean>;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  updateProfile: (patch: ProfilePatch) => Promise<boolean>;
  clearError: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

// Convert Supabase user to our UserProfile format
async function convertSupabaseUser(user: User): Promise<UserProfile | null> {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error || !profile) {
      console.error('Profile not found:', error);
      return null;
    }

    return {
      userId: user.id,
      username: profile.username,
      email: user.email!,
      fullName: profile.full_name || undefined,
      permanentLocation: profile.permanent_location as UserLocation,
      currentLocation: profile.current_location ? profile.current_location as UserLocation : undefined,
      createdAt: profile.created_at,
      profilePicture: profile.profile_picture || undefined,
    };
  } catch (error) {
    console.error('Error converting Supabase user:', error);
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const { data: { user: supabaseUser }, error: authError } = await supabase.auth.getUser();

      if (authError || !supabaseUser) {
        setUser(null);
        return;
      }

      const profile = await convertSupabaseUser(supabaseUser);
      setUser(profile);
    } catch (nextError) {
      setUser(null);
      setError(nextError instanceof Error ? nextError.message : "Unable to restore your session.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const profile = await convertSupabaseUser(session.user);
        setUser(profile);
        setError(null);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setError(null);
      }
      setLoading(false);
    });

    // Initial check
    refresh();

    return () => subscription.unsubscribe();
  }, []);

  const signup = async (input: AuthInput) => {
    setError(null);
    try {
      // Sign up with Supabase Auth
      const { data, error: authError } = await supabase.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          data: {
            username: input.username,
            full_name: input.fullName,
          }
        }
      });

      if (authError) throw authError;
      if (!data.user) throw new Error('Signup failed');

      // Wait a moment for the database trigger to create the profile
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Update profile with location data (trigger creates basic profile, we add location)
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          permanent_location: input.permanentLocation,
        })
        .eq('user_id', data.user.id);

      if (profileError) throw profileError;

      // Convert and set user
      const profile = await convertSupabaseUser(data.user);
      setUser(profile);
      return true;
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Sign up failed.");
      return false;
    }
  };

  const login = async (email: string, password: string) => {
    setError(null);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;
      if (!data.user) throw new Error('Login failed');

      // User will be set by the auth state change listener
      return true;
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Sign in failed.");
      return false;
    }
  };

  const logout = async () => {
    setError(null);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      // User will be cleared by the auth state change listener
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Logout failed.");
    }
  };

  const updateProfile = async (patch: ProfilePatch) => {
    setError(null);
    try {
      if (!user) throw new Error('Not authenticated');

      const updates: any = {};

      if (patch.username) updates.username = patch.username;
      if (patch.fullName !== undefined) updates.full_name = patch.fullName;
      if (patch.currentLocation !== undefined) updates.current_location = patch.currentLocation;
      if (patch.permanentLocation) updates.permanent_location = patch.permanentLocation;
      if (patch.profilePicture !== undefined) updates.profile_picture = patch.profilePicture;

      updates.updated_at = new Date().toISOString();

      const { error: updateError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('user_id', user.userId);

      if (updateError) throw updateError;

      // Refresh user data
      await refresh();
      return true;
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Profile update failed.");
      return false;
    }
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      error,
      signup,
      login,
      logout,
      refresh,
      updateProfile,
      clearError: () => setError(null),
    }),
    [user, loading, error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}

export type { UserLocation, UserProfile };
