import { createFileRoute } from "@tanstack/react-router";
import { SignInForm } from "@/components/AuthForms";

export const Route = createFileRoute("/signin")({
  head: () => ({
    meta: [
      { title: "Sign In - CommunityHub" },
      { name: "description", content: "Sign in to your CommunityHub account." },
    ],
  }),
  component: SignInPage,
});

function SignInPage() {
  return (
    <div className="mx-auto grid min-h-screen max-w-xl content-center px-4 py-12 md:px-10">
      <SignInForm />
    </div>
  );
}
