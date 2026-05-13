import { createFileRoute } from "@tanstack/react-router";
<<<<<<< HEAD
=======
import { createServerSupabaseClient } from "@/lib/supabase";
>>>>>>> 47c9fa39887d48791079b62c46f4846b626d0449
import { json, validatePassword } from "@/lib/server/auth";

export const Route = createFileRoute("/api/auth/reset-password")({
  // @ts-ignore - server handlers supported by TanStack Start plugin
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        let body: { identifier?: unknown; password?: unknown };
        try {
          body = await request.json();
        } catch {
          return json({ error: "Invalid JSON." }, { status: 400 });
        }

<<<<<<< HEAD
        const password = typeof body.password === "string" ? body.password : "";
        const passwordError = validatePassword(password);
        if (passwordError) return json({ error: passwordError }, { status: 400 });

        return json(
          { error: "Password resets are handled by Supabase Auth. Use the Supabase password recovery flow." },
          { status: 410 },
        );
=======
        const identifier = typeof body.identifier === "string" ? body.identifier.trim().toLowerCase() : "";
        const password = typeof body.password === "string" ? body.password : "";
        if (!identifier) return json({ error: "Email or username is required." }, { status: 400 });
        const passwordProblem = validatePassword(password);
        if (passwordProblem) return json({ error: passwordProblem }, { status: 400 });

        const supabase = createServerSupabaseClient();
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("user_id,email,username")
          .or(`email.eq.${identifier},username.eq.${identifier}`)
          .maybeSingle();

        if (profileError) return json({ error: profileError.message }, { status: 400 });
        if (!profile) return json({ error: "No account was found for that email or username." }, { status: 404 });

        const { error } = await supabase.auth.admin.updateUserById(profile.user_id, { password });
        if (error) return json({ error: error.message }, { status: 400 });
        return json({ ok: true });
>>>>>>> 47c9fa39887d48791079b62c46f4846b626d0449
      },
    },
  },
});
