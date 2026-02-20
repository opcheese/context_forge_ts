/**
 * Root layout component - minimal shell for all routes.
 */

import { createRootRoute, Outlet, Link } from "@tanstack/react-router"
import { TanStackRouterDevtools } from "@tanstack/router-devtools"
import { ToastProvider } from "@/components/ui/toast"

function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-foreground mb-2">404</h1>
        <p className="text-xl text-muted-foreground mb-1">Page not found</p>
        <p className="text-sm text-muted-foreground mb-6">
          The page you're looking for doesn't exist.
        </p>
        <Link to="/" className="text-sm text-primary hover:underline">
          Back to home
        </Link>
      </div>
    </div>
  )
}

function RootErrorComponent({ error }: { error: Error }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-foreground mb-2">Something went wrong</h1>
        <p className="text-sm text-muted-foreground mb-6">
          An unexpected error occurred. Try refreshing the page.
        </p>
        {import.meta.env.DEV && (
          <pre className="text-xs text-destructive bg-destructive/10 rounded p-3 max-w-lg mx-auto mb-6 text-left overflow-auto">
            {error.message}
          </pre>
        )}
        <Link to="/" className="text-sm text-primary hover:underline">
          Back to home
        </Link>
      </div>
    </div>
  )
}

function RootLayout() {
  return (
    <ToastProvider>
      <div className="min-h-screen bg-background">
        <Outlet />
      </div>
      {import.meta.env.DEV && <TanStackRouterDevtools />}
    </ToastProvider>
  )
}

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFound,
  errorComponent: RootErrorComponent,
})
