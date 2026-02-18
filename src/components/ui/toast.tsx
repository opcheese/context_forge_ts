/**
 * Simple toast notification component.
 */

import { createContext, useContext, useState, useCallback, ReactNode } from "react"
import { X, CheckCircle2, AlertCircle, Info } from "lucide-react"
import { cn } from "@/lib/utils"

type ToastType = "success" | "error" | "info"

interface Toast {
  id: string
  type: ToastType
  message: string
  description?: string
}

interface ToastContextValue {
  toast: {
    success: (message: string, description?: string) => void
    error: (message: string, description?: string) => void
    info: (message: string, description?: string) => void
  }
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error("useToast must be used within ToastProvider")
  }
  return context
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((type: ToastType, message: string, description?: string) => {
    const id = Math.random().toString(36).slice(2)
    const toast: Toast = { id, type, message, description }

    setToasts((prev) => [...prev, toast])

    // Auto-remove after 5 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 5000)
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = {
    success: (message: string, description?: string) => addToast("success", message, description),
    error: (message: string, description?: string) => addToast("error", message, description),
    info: (message: string, description?: string) => addToast("info", message, description),
  }

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const icons = {
    success: CheckCircle2,
    error: AlertCircle,
    info: Info,
  }

  const colors = {
    success: "bg-green-300 dark:bg-green-900 text-green-900 dark:text-green-300",
    error: "bg-red-300 dark:bg-red-900 text-red-900 dark:text-red-300",
    info: "bg-blue-300 dark:bg-blue-900 text-blue-900 dark:text-blue-300",
  }

  const Icon = icons[toast.type]

  return (
    <div
      className={cn(
        "rounded-lg border p-3 shadow-lg animate-in slide-in-from-right duration-300",
        colors[toast.type]
      )}
    >
      <div className="flex items-start gap-2">
        <Icon className="w-4 h-4 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{toast.message}</p>
          {toast.description && (
            <p className="text-xs opacity-80 mt-0.5">{toast.description}</p>
          )}
        </div>
        <button
          onClick={() => onRemove(toast.id)}
          className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
