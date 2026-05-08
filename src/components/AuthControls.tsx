import { Link } from "@tanstack/react-router";
import { LogOut, UserRound } from "lucide-react";
import { useAuth } from "@/lib/auth";

export function AuthControls() {
  const { user, loading, logout } = useAuth();

  if (loading) {
    return (
      <div className="h-9 w-24 animate-pulse rounded-lg border border-border bg-secondary/60" aria-label="Loading session" />
    );
  }

  if (!user) {
    return (
      <Link
        to="/signin"
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-semibold text-foreground shadow-card hover:bg-secondary"
      >
        <UserRound className="h-3.5 w-3.5" /> Sign in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <Link
        to="/profile"
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-2.5 text-xs font-semibold text-foreground shadow-card hover:bg-secondary"
      >
        {user.profilePicture ? (
          <img src={user.profilePicture} alt="" className="h-5 w-5 rounded-full object-cover" />
        ) : (
          <UserRound className="h-3.5 w-3.5" />
        )}
        <span className="hidden sm:inline">@{user.username}</span>
      </Link>
      <button
        type="button"
        onClick={() => void logout()}
        className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-card text-muted-foreground shadow-card hover:bg-secondary hover:text-foreground"
        aria-label="Sign out"
      >
        <LogOut className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
