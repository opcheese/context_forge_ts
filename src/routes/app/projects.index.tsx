/**
 * Projects list page - Browse and manage projects.
 */

import { useState } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery, useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { Button } from "@/components/ui/button"
import type { Id } from "../../../convex/_generated/dataModel"

// Format relative time
function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)

  if (seconds < 60) return "just now"
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

// Create project dialog
function CreateProjectDialog({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const createProject = useMutation(api.projects.create)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      await createProject({
        name: name.trim(),
        description: description.trim() || undefined,
      })
      setName("")
      setDescription("")
      onClose()
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background border border-border rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-4">Create New Project</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="project-name" className="block text-sm font-medium mb-1">
              Name
            </label>
            <input
              id="project-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Game Design Project"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="project-description" className="block text-sm font-medium mb-1">
              Description (optional)
            </label>
            <textarea
              id="project-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the project..."
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || isLoading}>
              {isLoading ? "Creating..." : "Create Project"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Project card component
function ProjectCard({
  project,
  onDelete,
}: {
  project: {
    _id: Id<"projects">
    name: string
    description?: string
    currentStep?: number
    createdAt: number
    updatedAt: number
    sessionCount: number
  }
  onDelete: () => void
}) {
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <Link
            to="/app/projects/$projectId"
            params={{ projectId: project._id }}
            className="font-semibold text-lg truncate hover:underline"
          >
            {project.name}
          </Link>
          {project.description && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {project.description}
            </p>
          )}
        </div>
        <div className="text-xs text-muted-foreground whitespace-nowrap">
          {formatTimeAgo(project.updatedAt)}
        </div>
      </div>

      {/* Stats */}
      <div className="mt-3 flex gap-2 flex-wrap">
        <span className="text-xs px-2 py-1 rounded-md bg-muted">
          {project.sessionCount} session{project.sessionCount !== 1 ? "s" : ""}
        </span>
        {project.currentStep !== undefined && (
          <span className="text-xs px-2 py-1 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
            Step {project.currentStep}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="mt-4 pt-3 border-t border-border flex gap-2">
        <Link to="/app/projects/$projectId" params={{ projectId: project._id }}>
          <Button variant="outline" size="sm">
            Open
          </Button>
        </Link>
        {showConfirmDelete ? (
          <>
            <Button variant="destructive" size="sm" onClick={onDelete}>
              Confirm Delete
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowConfirmDelete(false)}
            >
              Cancel
            </Button>
          </>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowConfirmDelete(true)}
            className="text-destructive hover:text-destructive"
          >
            Delete
          </Button>
        )}
      </div>
    </div>
  )
}

// Main projects page
function ProjectsIndexPage() {
  const projects = useQuery(api.projects.list)
  const removeProject = useMutation(api.projects.remove)
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  const handleDelete = async (id: Id<"projects">) => {
    await removeProject({ id })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="text-muted-foreground mt-1">
            Organize related sessions into projects
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          + New Project
        </Button>
      </div>

      {projects === undefined ? (
        <div className="text-center py-12 text-muted-foreground">Loading projects...</div>
      ) : projects.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border rounded-lg">
          <h3 className="text-lg font-medium mb-2">No projects yet</h3>
          <p className="text-muted-foreground mb-4">
            Create a project to organize your sessions and track workflow progress.
          </p>
          <Button onClick={() => setShowCreateDialog(true)}>
            Create Your First Project
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {projects.map((project) => (
            <ProjectCard
              key={project._id}
              project={project}
              onDelete={() => handleDelete(project._id)}
            />
          ))}
        </div>
      )}

      <CreateProjectDialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
      />
    </div>
  )
}

export const Route = createFileRoute("/app/projects/")({
  component: ProjectsIndexPage,
})
