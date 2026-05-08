import { createFileRoute } from "@tanstack/react-router";
import { SignUpForm } from "@/components/AuthForms";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Sign Up - CommunityHub" },
      { name: "description", content: "Create your CommunityHub account." },
    ],
  }),
  component: SignUpPage,
});

function SignUpPage() {
  return (
    <div className="mx-auto grid min-h-screen max-w-xl content-center px-4 py-12 md:px-10">
      <SignUpForm />
    </div>
  );
}
