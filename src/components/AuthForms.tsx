import { Link, useNavigate } from "@tanstack/react-router";
import { LockKeyhole, UserPlus, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { LocationPicker } from "@/components/LocationPicker";
import { useAuth, type UserLocation } from "@/lib/auth";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const passwordRules = [
  { label: "At least 8 characters", test: (value: string) => value.length >= 8 },
  { label: "One uppercase letter", test: (value: string) => /[A-Z]/.test(value) },
  { label: "One lowercase letter", test: (value: string) => /[a-z]/.test(value) },
  { label: "One number", test: (value: string) => /\d/.test(value) },
  { label: "One symbol, like ! @ # $ %", test: (value: string) => /[^A-Za-z0-9]/.test(value) },
];

function passwordError(password: string) {
  const missing = passwordRules.filter((rule) => !rule.test(password));
  if (missing.length === 0) return null;
  return `Password is too weak. Add: ${missing.map((rule) => rule.label.toLowerCase()).join(", ")}.`;
}

function PasswordGuide({ password }: { password: string }) {
  return (
    <div className="rounded-xl border border-border bg-secondary/35 px-3 py-2">
      <div className="text-xs font-semibold text-foreground">Password must contain:</div>
      <div className="mt-2 grid gap-1 text-xs">
        {passwordRules.map((rule) => {
          const passed = rule.test(password);
          return (
            <div key={rule.label} className={passed ? "text-emerald-600" : "text-muted-foreground"}>
              {passed ? "OK" : "-"} {rule.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SignUpForm() {
  const { signup, error, clearError } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [permanentLocation, setPermanentLocation] = useState<UserLocation | null>(null);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const emailProblem = useMemo(() => {
    if (!email.trim()) return null;
    return EMAIL_PATTERN.test(email.trim()) ? null : "Enter a proper email address, for example name@example.com.";
  }, [email]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    clearError();
    setLocalError(null);
    if (!/^[a-zA-Z0-9_]{3,24}$/.test(username.trim())) {
      setLocalError("Username must be 3-24 characters and can only use letters, numbers, or underscores.");
      return;
    }
    if (!EMAIL_PATTERN.test(email.trim())) {
      setLocalError("Please enter a proper email address, for example name@example.com.");
      return;
    }
    const weakPassword = passwordError(password);
    if (weakPassword) {
      setLocalError(weakPassword);
      return;
    }
    if (!permanentLocation) {
      setLocalError("Permanent location is required so your default community feed can be personalized.");
      return;
    }
    setBusy(true);
    const ok = await signup({ username, email, password, fullName, permanentLocation });
    setBusy(false);
    if (ok) await navigate({ to: "/profile" });
  };

  return (
    <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
        <UserPlus className="h-5 w-5 text-primary" /> Create account
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">Choose a username, secure password, and permanent home location.</p>
      <div className="mt-4 grid gap-3">
        <TextInput value={username} onChange={setUsername} label="Username" autoComplete="username" required />
        <TextInput value={email} onChange={setEmail} label="Email" type="email" autoComplete="email" required hint={emailProblem} />
        <TextInput value={fullName} onChange={setFullName} label="Full name" autoComplete="name" />
        <TextInput value={password} onChange={setPassword} label="Password" type="password" autoComplete="new-password" required />
        <PasswordGuide password={password} />
        <LocationPicker value={permanentLocation} onChange={setPermanentLocation} label="Permanent location" required />
      </div>
      {(localError || error) && <p className="mt-3 text-xs font-semibold text-destructive">{localError || error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        <LockKeyhole className="h-4 w-4" /> {busy ? "Creating account..." : "Create account"}
      </button>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        Already have an account? <Link to="/signin" className="font-semibold text-primary">Sign in</Link>
      </p>
    </form>
  );
}

export function SignInForm() {
  const { login, error, clearError } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const emailProblem = useMemo(() => {
    const value = email.trim();
    if (!value) return null;
    return EMAIL_PATTERN.test(value) ? null : "That email does not look right. Use something like name@example.com.";
  }, [email]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    clearError();
    setLocalError(null);
    const value = email.trim();
    if (!value) {
      setLocalError("Email is required.");
      return;
    }
    if (!EMAIL_PATTERN.test(value)) {
      setLocalError("Please enter a proper email address, for example name@example.com.");
      return;
    }
    if (!password) {
      setLocalError("Password is required.");
      return;
    }
    setBusy(true);
    const ok = await login(email, password);
    setBusy(false);
    if (ok) await navigate({ to: "/profile" });
  };

  return (
    <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
        <UserRound className="h-5 w-5 text-primary" /> Sign in
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">Enter your email address and password.</p>
      <div className="mt-4 grid gap-3">
        <TextInput value={email} onChange={setEmail} label="Email" type="email" autoComplete="email" required hint={emailProblem} />
        <TextInput value={password} onChange={setPassword} label="Password" type="password" autoComplete="current-password" required />
      </div>
      {(localError || error) && <p className="mt-3 text-xs font-semibold text-destructive">{localError || error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        <LockKeyhole className="h-4 w-4" /> {busy ? "Signing in..." : "Sign in"}
      </button>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        New here? <Link to="/signup" className="font-semibold text-primary">Create an account</Link>
      </p>
    </form>
  );
}

function TextInput({
  value,
  onChange,
  label,
  type = "text",
  autoComplete,
  required = false,
  hint,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  hint?: string | null;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-muted-foreground">{label}{required ? " *" : ""}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        autoComplete={autoComplete}
        required={required}
        className={`mt-1.5 w-full rounded-xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring ${
          hint ? "border-destructive" : "border-border"
        }`}
      />
      {hint && <span className="mt-1 block text-xs font-semibold text-destructive">{hint}</span>}
    </label>
  );
}
