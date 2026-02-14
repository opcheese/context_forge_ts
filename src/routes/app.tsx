/**
 * App layout route - wraps all /app/* routes with auth, session, and DnD providers.
 */

import { useState, useEffect } from "react"
import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router"
import { useQuery, Authenticated, Unauthenticated, AuthLoading } from "convex/react"
import { useAuthActions } from "@convex-dev/auth/react"
import { api } from "../../convex/_generated/api"
import type { Doc, Id } from "../../convex/_generated/dataModel"
import { Button } from "@/components/ui/button"
import { DndProvider } from "@/components/dnd"
import { SessionProvider, useSession } from "@/contexts/SessionContext"
import { SaveTemplateDialog, ApplyTemplateDialog } from "@/components/templates"
import { AddToProjectDialog } from "@/components/projects"

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
    navigate({ to: "/login", replace: true })
  }, [navigate])

  return null
}

// Session selector component with template actions
function SessionSelector() {
  const { sessionId, switchSession, createSession, isLoading } = useSession()
  const sessions = useQuery(api.sessions.list)
  const [showSaveTemplate, setShowSaveTemplate] = useState(false)
  const [showApplyTemplate, setShowApplyTemplate] = useState(false)
  const [showAddToProject, setShowAddToProject] = useState(false)

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
            switchSession(e.target.value as Id<"sessions">)
          }
        }}
        className="rounded-md border border-input bg-background px-2 py-1 text-sm"
      >
        <option value="" disabled>
          Select session...
        </option>
        {sessions.map((session: Doc<"sessions">) => (
          <option key={session._id} value={session._id}>
            {session.name ?? `Session ${session._id.slice(-6)}`}
          </option>
        ))}
      </select>
      <Button variant="outline" size="sm" onClick={handleCreateSession}>
        + New
      </Button>

      {/* Template actions - only show when session is selected */}
      {sessionId && (
        <>
          <div className="w-px h-6 bg-border" /> {/* Divider */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSaveTemplate(true)}
            title="Save current session as a reusable template"
          >
            Save Template
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowApplyTemplate(true)}
            title="Apply a template to this session"
          >
            Apply Template
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAddToProject(true)}
            title="Add this session to a project"
          >
            Add to Project
          </Button>

          <SaveTemplateDialog
            isOpen={showSaveTemplate}
            onClose={() => setShowSaveTemplate(false)}
            sessionId={sessionId}
            onSuccess={() => {
              // Could show a toast notification here
            }}
          />

          <ApplyTemplateDialog
            isOpen={showApplyTemplate}
            onClose={() => setShowApplyTemplate(false)}
            sessionId={sessionId}
            onSuccess={() => {
              // Could show a toast notification here
            }}
          />

          <AddToProjectDialog
            isOpen={showAddToProject}
            onClose={() => setShowAddToProject(false)}
            sessionId={sessionId}
            onSuccess={() => {
              // Could show a toast notification here
            }}
          />
        </>
      )}
    </div>
  )
}


// Header content for authenticated users (needs SessionContext)
function AuthenticatedHeader() {
  const { isDark, toggle } = useTheme()

  return (
    <div className="flex items-center gap-4">
      <SessionSelector />
      <Button variant="outline" size="sm" onClick={toggle}>
        {isDark ? "Light" : "Dark"}
      </Button>
      <UserMenu />
    </div>
  )
}

// Shared header component
function Header({ rightContent }: { rightContent: React.ReactNode }) {
  return (
    <header className="border-b border-border">
      <div className="mx-auto max-w-6xl px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link to="/app" className="hover:opacity-80">
            <h1 className="text-2xl font-bold text-foreground">ContextForge</h1>
          </Link>
          <nav className="flex items-center gap-4">
            <Link
              to="/app"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              activeProps={{ className: "text-foreground font-medium" }}
            >
              Home
            </Link>
            <Link
              to="/app/templates"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              activeProps={{ className: "text-foreground font-medium" }}
            >
              Templates
            </Link>
            <Link
              to="/app/projects"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              activeProps={{ className: "text-foreground font-medium" }}
            >
              Projects
            </Link>
            <Link
              to="/app/workflows"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              activeProps={{ className: "text-foreground font-medium" }}
            >
              Workflows
            </Link>
            <Link
              to="/app/settings"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              activeProps={{ className: "text-foreground font-medium" }}
            >
              Settings
            </Link>
          </nav>
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
      <main className="mx-auto max-w-6xl px-8 py-6">
        <Outlet />
      </main>
    </>
  )
}

// Unauthenticated user layout
function UnauthenticatedLayout() {
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
