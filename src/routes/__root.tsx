/**
 * Root layout component for all routes.
 */

import { useState, useEffect } from "react"
import { createRootRoute, Link, Outlet } from "@tanstack/react-router"
import { TanStackRouterDevtools } from "@tanstack/router-devtools"
import { useQuery } from "convex/react"
import { api } from "../../convex/_generated/api"
import { Button } from "@/components/ui/button"
import { DndProvider } from "@/components/dnd"
import { SessionProvider, useSession } from "@/contexts/SessionContext"

// Simple theme toggle hook
function useTheme() {
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains("dark")
  )

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }, [isDark])

  return { isDark, toggle: () => setIsDark(!isDark) }
}

// Session selector component
function SessionSelector() {
  const { sessionId, switchSession, createSession, isLoading } = useSession()
  const sessions = useQuery(api.sessions.list)

  const handleCreateSession = async () => {
    const name = `Session ${(sessions?.length ?? 0) + 1}`
    await createSession(name)
  }

  if (isLoading || sessions === undefined) {
    return <span className="text-sm text-muted-foreground">Loading...</span>
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={sessionId ?? ""}
        onChange={(e) => {
          if (e.target.value) {
            switchSession(e.target.value as typeof sessionId)
          }
        }}
        className="rounded-md border border-input bg-background px-2 py-1 text-sm"
      >
        <option value="" disabled>
          Select session...
        </option>
        {sessions.map((session) => (
          <option key={session._id} value={session._id}>
            {session.name ?? `Session ${session._id.slice(-6)}`}
          </option>
        ))}
      </select>
      <Button variant="outline" size="sm" onClick={handleCreateSession}>
        + New
      </Button>
    </div>
  )
}

function RootLayoutContent() {
  const { isDark, toggle } = useTheme()

  return (
    <DndProvider>
      <div className="min-h-screen bg-background">
        <header className="border-b border-border">
          <div className="mx-auto max-w-6xl px-8 py-4 flex items-center justify-between">
            <Link to="/" className="hover:opacity-80">
              <h1 className="text-2xl font-bold text-foreground">ContextForge</h1>
            </Link>
            <div className="flex items-center gap-4">
              <SessionSelector />
              <Button variant="outline" size="sm" onClick={toggle}>
                {isDark ? "Light" : "Dark"}
              </Button>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-8 py-6">
          <Outlet />
        </main>
      </div>
      <TanStackRouterDevtools />
    </DndProvider>
  )
}

function RootLayout() {
  return (
    <SessionProvider>
      <RootLayoutContent />
    </SessionProvider>
  )
}

export const Route = createRootRoute({
  component: RootLayout,
})
