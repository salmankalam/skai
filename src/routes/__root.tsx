import { Outlet, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import appCss from "../index.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "SK-AI" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  notFoundComponent: NotFoundComponent,
  component: RootComponent,
});

function NotFoundComponent() {
  return (
    <div className="flex h-screen items-center justify-center bg-zinc-950 text-zinc-100">
      <div className="text-center">
        <p className="text-2xl font-semibold">404</p>
        <p className="mt-2 text-sm text-zinc-400">Page not found</p>
        <a href="/" className="mt-4 inline-block text-sm text-violet-400 hover:text-violet-300">
          Back to chat
        </a>
      </div>
    </div>
  );
}

function RootComponent() {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <Outlet />
        <Scripts />
      </body>
    </html>
  );
}
