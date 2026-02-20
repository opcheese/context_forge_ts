import { useState, useEffect, useCallback, useRef } from "react"
import { useAction } from "convex/react"
import { api } from "../../convex/_generated/api"

interface UsageWindow {
  utilization: number
  resetsAt: string
  resetsIn: string
}

interface SubscriptionUsage {
  fiveHour: UsageWindow
  sevenDay: UsageWindow
  loading: boolean
  error: string | null
}

const POLL_INTERVAL_MS = 60_000

function formatResetsIn(resetsAt: string): string {
  if (!resetsAt) return ""
  const diff = new Date(resetsAt).getTime() - Date.now()
  if (diff <= 0) return "now"
  const minutes = Math.floor(diff / 60_000)
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  if (hours > 0) return `${hours}h ${remainingMinutes}m`
  return `${remainingMinutes}m`
}

export function useSubscriptionUsage(enabled: boolean): SubscriptionUsage {
  const getUsage = useAction(api.claudeNode.getSubscriptionUsage)
  const [data, setData] = useState<{
    fiveHour: { utilization: number; resetsAt: string }
    sevenDay: { utilization: number; resetsAt: string }
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchUsage = useCallback(async () => {
    try {
      const result = await getUsage()
      if ("error" in result) {
        setError(result.error as string)
      } else {
        setData(result as { fiveHour: { utilization: number; resetsAt: string }; sevenDay: { utilization: number; resetsAt: string } })
        setError(null)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [getUsage])

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }

    fetchUsage()
    intervalRef.current = setInterval(fetchUsage, POLL_INTERVAL_MS)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [enabled, fetchUsage])

  // Recompute resetsIn every 30s
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!enabled || !data) return
    const timer = setInterval(() => setTick((t) => t + 1), 30_000)
    return () => clearInterval(timer)
  }, [enabled, data])

  const empty: UsageWindow = { utilization: 0, resetsAt: "", resetsIn: "" }

  if (!data) {
    return { fiveHour: empty, sevenDay: empty, loading, error }
  }

  return {
    fiveHour: {
      utilization: data.fiveHour.utilization,
      resetsAt: data.fiveHour.resetsAt,
      resetsIn: formatResetsIn(data.fiveHour.resetsAt),
    },
    sevenDay: {
      utilization: data.sevenDay.utilization,
      resetsAt: data.sevenDay.resetsAt,
      resetsIn: formatResetsIn(data.sevenDay.resetsAt),
    },
    loading,
    error,
  }
}
