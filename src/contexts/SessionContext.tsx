/**
 * Session context for managing the current session.
 *
 * Provides session state and methods to create/switch sessions.
 * Session ID is persisted to localStorage.
 */

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import { useMutation, useQuery } from "convex/react"
import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"

// Local storage key for session ID
const SESSION_STORAGE_KEY = "contextforge-session-id"

interface SessionContextValue {
  // Current session ID (null if no session selected)
  sessionId: Id<"sessions"> | null
  // Whether we're loading/creating the initial session
  isLoading: boolean
  // Create a new session and switch to it
  createSession: (name?: string) => Promise<Id<"sessions">>
  // Switch to a different session
  switchSession: (id: Id<"sessions">) => void
  // Clear session (for testing)
  clearSession: () => void
}

const SessionContext = createContext<SessionContextValue | null>(null)

// Provider component
export function SessionProvider({ children }: { children: ReactNode }) {
  const [sessionId, setSessionId] = useState<Id<"sessions"> | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const createSessionMutation = useMutation(api.sessions.create)
  const sessions = useQuery(api.sessions.list)

  // Initialize session on mount
  useEffect(() => {
    const initSession = async () => {
      // Check localStorage for existing session ID
      const storedId = localStorage.getItem(SESSION_STORAGE_KEY)

      if (storedId) {
        // Verify the stored session still exists
        const exists = sessions?.some((s) => s._id === storedId)
        if (exists) {
          setSessionId(storedId as Id<"sessions">)
          setIsLoading(false)
          return
        }
      }

      // If we have sessions loaded and no valid stored session, wait for user to select
      if (sessions !== undefined) {
        setIsLoading(false)
      }
    }

    initSession()
  }, [sessions])

  // Persist session ID to localStorage
  useEffect(() => {
    if (sessionId) {
      localStorage.setItem(SESSION_STORAGE_KEY, sessionId)
    }
  }, [sessionId])

  // Create a new session
  const createSession = useCallback(
    async (name?: string) => {
      const id = await createSessionMutation({ name })
      setSessionId(id)
      return id
    },
    [createSessionMutation]
  )

  // Switch to a different session
  const switchSession = useCallback((id: Id<"sessions">) => {
    // Update localStorage synchronously to avoid race conditions with navigation
    localStorage.setItem(SESSION_STORAGE_KEY, id)
    setSessionId(id)
  }, [])

  // Clear session (for testing)
  const clearSession = useCallback(() => {
    localStorage.removeItem(SESSION_STORAGE_KEY)
    setSessionId(null)
  }, [])

  return (
    <SessionContext.Provider
      value={{
        sessionId,
        isLoading,
        createSession,
        switchSession,
        clearSession,
      }}
    >
      {children}
    </SessionContext.Provider>
  )
}

// Hook to access session context
export function useSession() {
  const context = useContext(SessionContext)
  if (!context) {
    throw new Error("useSession must be used within a SessionProvider")
  }
  return context
}

// Hook that throws if no session is selected (for components that require a session)
export function useRequiredSession(): Id<"sessions"> {
  const { sessionId } = useSession()
  if (!sessionId) {
    throw new Error("No session selected. Please create or select a session first.")
  }
  return sessionId
}
