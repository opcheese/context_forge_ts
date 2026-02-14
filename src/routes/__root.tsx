/**
 * Root layout component - minimal shell for all routes.
 */

import { createRootRoute, Outlet } from "@tanstack/react-router"
import { TanStackRouterDevtools } from "@tanstack/router-devtools"
import { ToastProvider } from "@/components/ui/toast"

function RootLayout() {
  return (
    <ToastProvider>
      <div className="min-h-screen bg-background">
        <Outlet />
      </div>
      <TanStackRouterDevtools />
    </ToastProvider>
  )
}

export const Route = createRootRoute({
  component: RootLayout,
})
