import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "./supabase";
import type { User } from "@supabase/supabase-js";
import type { CapeTownRegion } from "./community";
import type { Json } from "./types/supabase";

export type UserLocation = {
  label: string;
  region: CapeTownRegion;
  coords?: { lat: number; lng: number };
};

export type UserProfile = {
  userId: string;
  username: string;
  email: string;
  role: UserRole;
  fullName?: string;
  permanentLocation: UserLocation;
  currentLocation?: UserLocation;
  createdAt: string;
  profilePicture?: string;
};

export type UserRole = "super_admin" | "regional_admin" | "community_moderator" | "verified_reporter" | "user";

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

async function profileHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Convert Supabase user to our UserProfile format
async function convertSupabaseUser(user: User): Promise<UserProfile | null> {
  try {
    const response = await fetch("/api/auth/profile", { headers: await profileHeaders() });
    const result = (await response.json().catch(() => ({}))) as { user?: UserProfile; error?: string };
    if (!response.ok || !result.user) throw new Error(result.error || "Profile not found.");
    return result.user;
  } catch (apiError) {
    console.error("Profile API lookup failed:", apiError);

    const { data: profile, error } = await supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!profile) throw new Error("No profile row exists for this signed-in user.");

    return {
      userId: user.id,
      username: profile.username,
      email: user.email!,
      role: profile.role ?? "user",
      fullName: profile.full_name || undefined,
      permanentLocation: profile.permanent_location as UserLocation,
      currentLocation: profile.current_location ? profile.current_location as UserLocation : undefined,
      createdAt: profile.created_at,
      profilePicture: profile.profile_picture || undefined,
    };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSupabaseUser = async (supabaseUser: User) => {
    try {
      const profile = await convertSupabaseUser(supabaseUser);
      setUser(profile);
      setError(null);
      return profile;
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : "Unable to load your profile.";
      setUser(null);
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const refresh = async () => {
    setLoading(true);
    try {
      const { data: { user: supabaseUser }, error: authError } = await supabase.auth.getUser();

      if (authError || !supabaseUser) {
        setUser(null);
        return;
      }

      await loadSupabaseUser(supabaseUser);
    } catch (nextError) {
      setUser(null);
      setError(nextError instanceof Error ? nextError.message : "Unable to restore your session.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setTimeout(() => {
          void loadSupabaseUser(session.user);
        }, 0);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setError(null);
        setLoading(false);
      }
    });

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
            permanent_location: input.permanentLocation,
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
          permanent_location: input.permanentLocation as unknown as Json,
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

      const profile = await loadSupabaseUser(data.user);
      return Boolean(profile);
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

      const updates: {
        username?: string;
        full_name?: string;
        current_location?: Json | null;
        permanent_location?: Json;
        profile_picture?: string;
        updated_at: string;
      } = { updated_at: new Date().toISOString() };

      if (patch.username) updates.username = patch.username;
      if (patch.fullName !== undefined) updates.full_name = patch.fullName;
      if (patch.currentLocation !== undefined) updates.current_location = patch.currentLocation as unknown as Json | null;
      if (patch.permanentLocation) updates.permanent_location = patch.permanentLocation as unknown as Json;
      if (patch.profilePicture !== undefined) updates.profile_picture = patch.profilePicture;

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

