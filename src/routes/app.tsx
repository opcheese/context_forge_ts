/**
 * App layout route - wraps all /app/* routes with auth, session, and DnD providers.
 */

import { useState, useEffect } from "react"
import { motion, LayoutGroup } from "framer-motion"
import { springs } from "@/lib/motion"
import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router"
import { useQuery, Authenticated, Unauthenticated, AuthLoading } from "convex/react"
import { useAuthActions } from "@convex-dev/auth/react"
import { api } from "../../convex/_generated/api"
import type { Doc, Id } from "../../convex/_generated/dataModel"
import { Button } from "@/components/ui/button"
import { DndProvider } from "@/components/dnd"
import { SessionProvider, useSession } from "@/contexts/SessionContext"
import { SessionDropdown } from "@/components/sessions/SessionDropdown"
import { Anvil, Sun, Moon } from "lucide-react"

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
    localStorage.setItem("theme", isDark ? "dark" : "light")
  }, [isDark])

  return { isDark, toggle: () => setIsDark(!isDark) }
}

// User menu component
function UserMenu() {
  const { signOut } = useAuthActions()
  const [isSigningOut, setIsSigningOut] = useState(false)

  const handleSignOut = async () => {
    setIsSigningOut(true)
    try {
      await signOut()
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleSignOut}
      disabled={isSigningOut}
    >
      {isSigningOut ? "Signing out..." : "Sign Out"}
    </Button>
  )
}

// Auth redirect handler - redirects unauthenticated users to login
function AuthRedirect() {
  const navigate = useNavigate()

  useEffect(() => {
    navigate({ to: "/app/login", replace: true })
  }, [navigate])

  return null
}

// Session selector component (just the dropdown)
function SessionSelector() {
  const { sessionId, switchSession, createSession, clearSession, isLoading } = useSession()
  const sessions = useQuery(api.sessions.list)

  const handleCreateSession = async () => {
    const name = `Session ${(sessions?.length ?? 0) + 1}`
    await createSession(name)
  }

  const handleSessionDeleted = (deletedId: Id<"sessions">, remaining: Doc<"sessions">[]) => {
    if (deletedId === sessionId) {
      if (remaining.length > 0) {
        switchSession(remaining[0]._id)
      } else {
        clearSession()
      }
    }
  }

  if (isLoading || sessions === undefined) {
    return <span className="text-sm text-muted-foreground">Loading...</span>
  }

  return (
    <SessionDropdown
      sessions={sessions}
      currentSessionId={sessionId}
      onSelectSession={switchSession}
      onCreateSession={handleCreateSession}
      onSessionDeleted={handleSessionDeleted}
      isLoading={isLoading}
    />
  )
}


// Header content for authenticated users (needs SessionContext)
function AuthenticatedHeader() {
  const { isDark, toggle } = useTheme()

  return (
    <div className="flex items-center gap-3">
      <SessionSelector />
      <div className="w-px h-5 bg-border" />
      <button
        onClick={toggle}
        className="w-8 h-8 rounded-lg border border-border bg-background hover:bg-accent flex items-center justify-center transition-colors"
        aria-label="Toggle theme"
      >
        {isDark ? <Sun className="w-3.5 h-3.5 text-muted-foreground" /> : <Moon className="w-3.5 h-3.5 text-muted-foreground" />}
      </button>
      <UserMenu />
    </div>
  )
}

// Nav link with animated sliding underline indicator
function NavLink({ to, children, exact }: { to: string; children: React.ReactNode; exact?: boolean }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const isActive = exact
    ? pathname === to
    : pathname.startsWith(to) && (to !== "/app" || pathname === "/app" || pathname === "/app/")

  return (
    <Link
      to={to}
      className={`relative text-sm py-1 transition-colors ${isActive ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground"}`}
    >
      {children}
      {isActive && (
        <motion.div
          className="absolute -bottom-[13px] left-0 right-0 h-[2px] bg-foreground"
          layoutId="nav-indicator"
          transition={springs.snappy}
        />
      )}
    </Link>
  )
}

// Shared header component
function Header({ rightContent }: { rightContent: React.ReactNode }) {
  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-30">
      <div className="mx-auto max-w-6xl px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link to="/app" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <div className="w-7 h-7 rounded-lg bg-foreground/5 border border-border flex items-center justify-center">
              <Anvil className="w-4 h-4 text-foreground/70" />
            </div>
            <span className="text-lg font-bold tracking-tight">ContextForge</span>
          </Link>
          <LayoutGroup>
            <nav className="flex items-center gap-5">
              <NavLink to="/app" exact>Home</NavLink>
              <NavLink to="/app/templates">Templates</NavLink>
              <NavLink to="/app/projects">Projects</NavLink>
              <NavLink to="/app/workflows">Workflows</NavLink>
              <NavLink to="/app/marketplace">Marketplace</NavLink>
              <NavLink to="/app/settings">Settings</NavLink>
            </nav>
          </LayoutGroup>
        </div>
        {rightContent}
      </div>
    </header>
  )
}

function AppLayout() {
  return (
    <SessionProvider>
      <DndProvider>
        <AuthLoading>
          <LoadingLayout />
        </AuthLoading>
        <Authenticated>
          <AuthenticatedLayout />
        </Authenticated>
        <Unauthenticated>
          <UnauthenticatedLayout />
        </Unauthenticated>
      </DndProvider>
    </SessionProvider>
  )
}

// Loading state layout
function LoadingLayout() {
  return (
    <>
      <Header rightContent={<span className="text-muted-foreground text-sm">Loading...</span>} />
      <main className="mx-auto max-w-6xl px-8 py-6">
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </main>
    </>
  )
}

// Authenticated user layout
function AuthenticatedLayout() {
  return (
    <>
      <Header rightContent={<AuthenticatedHeader />} />
      <motion.main
        className="mx-auto max-w-6xl px-8 py-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={springs.smooth}
      >
        <Outlet />
      </motion.main>
    </>
  )
}

// Unauthenticated user layout — renders login page directly, redirects otherwise
function UnauthenticatedLayout() {
  const { location } = useRouterState()
  const isLoginPage = location.pathname === "/app/login"

  if (isLoginPage) {
    return <Outlet />
  }

  return (
    <>
      <Header rightContent={<span className="text-muted-foreground text-sm">Redirecting...</span>} />
      <main className="mx-auto max-w-6xl px-8 py-6">
        <AuthRedirect />
      </main>
    </>
  )
}

export const Route = createFileRoute("/app")({
  component: AppLayout,
})
