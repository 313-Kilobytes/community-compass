import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { AppSidebar, MenuNav } from "@/components/AppSidebar";
import { LanguageProvider } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { CartProvider } from "@/lib/cart";
import { ThemeProvider } from "@/lib/theme";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AuthProvider } from "@/lib/auth";
import { AuthControls } from "@/components/AuthControls";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#7C3AED" },
      { title: "Community Compass - Local Resource Network" },
      {
        name: "description",
        content: "Find local resources, community updates, emergency contacts, and practical support near you.",
      },
      { name: "author", content: "Community Compass" },
      { property: "og:title", content: "Community Compass - Local Resource Network" },
      {
        property: "og:description",
        content: "Find local resources, community updates, emergency contacts, and practical support near you.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
        <script
          type="text/javascript"
          dangerouslySetInnerHTML={{
            __html: `
              (function(d, t) {
                  var v = d.createElement(t), s = d.getElementsByTagName(t)[0];
                  v.onload = function() {
                    window.voiceflow.chat.load({
                      verify: { projectID: '69fd9a85370afbde9ec3224c' },
                      url: 'https://general-runtime.voiceflow.com',
                      voice: {
                        url: "https://runtime-api.voiceflow.com"
                      }
                    });
                  }
                  v.src = "https://cdn.voiceflow.com/widget-next/bundle.mjs"; v.type = "text/javascript"; s.parentNode.insertBefore(v, s);
              })(document, 'script');
            `,
          }}
        />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <LanguageProvider>
      <ThemeProvider>
        <AuthProvider>
          <CartProvider>
            <div className="flex min-h-screen w-full bg-background">
              <AppSidebar />
              <main className="flex-1 min-w-0 pb-8">
                <div className="relative z-40 flex min-h-16 flex-wrap items-center justify-end gap-2 px-3 pl-16 pt-3 md:min-h-20 md:px-6 md:pl-16 md:pt-5">
                  <AuthControls />
                  <ThemeToggle />
                  <LanguageSwitcher />
                </div>
                <Outlet />
              </main>
              <MenuNav />
            </div>
          </CartProvider>
        </AuthProvider>
      </ThemeProvider>
    </LanguageProvider>
  );
}
