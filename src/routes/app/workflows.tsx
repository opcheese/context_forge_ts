/**
 * Workflows layout route - wraps all /app/workflows/* routes.
 */

import { createFileRoute, Outlet } from "@tanstack/react-router"

function WorkflowsLayout() {
  return <Outlet />
}

export const Route = createFileRoute("/app/workflows")({
  component: WorkflowsLayout,
})
