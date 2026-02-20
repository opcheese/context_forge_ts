interface OpenRouterCostProps {
  sessionCost: number
}

function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`
  if (cost < 1) return `$${cost.toFixed(3)}`
  return `$${cost.toFixed(2)}`
}

export function OpenRouterCost({ sessionCost }: OpenRouterCostProps) {
  if (sessionCost <= 0) return null

  return (
    <span
      className="text-xs px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
      title={`OpenRouter session cost: $${sessionCost.toFixed(6)}`}
    >
      {formatCost(sessionCost)}
    </span>
  )
}
