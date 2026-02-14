/**
 * Projects layout route - wraps all /app/projects/* routes.
 */

import { createFileRoute, Outlet } from "@tanstack/react-router"

function ProjectsLayout() {
  return <Outlet />
}

export const Route = createFileRoute("/app/projects")({
  component: ProjectsLayout,
})
