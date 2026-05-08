import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { UserLocation, UserProfile } from "@/lib/server/auth";

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
  login: (identifier: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  updateProfile: (patch: ProfilePatch) => Promise<boolean>;
  clearError: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function readAuthResponse(response: Response) {
  const data = (await response.json().catch(() => ({}))) as { user?: UserProfile; error?: string };
  if (!response.ok) throw new Error(data.error || "Authentication request failed.");
  return data.user ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/auth/profile", { credentials: "include" });
      if (response.status === 401) {
        setUser(null);
        return;
      }
      setUser(await readAuthResponse(response));
    } catch (nextError) {
      setUser(null);
      setError(nextError instanceof Error ? nextError.message : "Unable to restore your session.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const signup = async (input: AuthInput) => {
    setError(null);
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(input),
      });
      setUser(await readAuthResponse(response));
      return true;
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Sign up failed.");
      return false;
    }
  };

  const login = async (identifier: string, password: string) => {
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ identifier, password }),
      });
      setUser(await readAuthResponse(response));
      return true;
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Sign in failed.");
      return false;
    }
  };

  const logout = async () => {
    setError(null);
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => undefined);
    setUser(null);
  };

  const updateProfile = async (patch: ProfilePatch) => {
    setError(null);
    try {
      const response = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(patch),
      });
      setUser(await readAuthResponse(response));
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
