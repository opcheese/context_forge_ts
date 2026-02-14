/**
 * Workflows list page - Browse and manage workflows.
 */

import { useState } from "react"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useQuery, useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { Button } from "@/components/ui/button"
import type { Id, Doc } from "../../../convex/_generated/dataModel"

// Format relative time
function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)

  if (seconds < 60) return "just now"
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

// Create workflow dialog
function CreateWorkflowDialog({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const createWorkflow = useMutation(api.workflows.create)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      await createWorkflow({
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
        <h2 className="text-lg font-semibold mb-4">Create New Workflow</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="workflow-name" className="block text-sm font-medium mb-1">
              Name
            </label>
            <input
              id="workflow-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="IRD Documentation Workflow"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="workflow-description" className="block text-sm font-medium mb-1">
              Description (optional)
            </label>
            <textarea
              id="workflow-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the purpose of this workflow..."
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || isLoading}>
              {isLoading ? "Creating..." : "Create Workflow"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Start workflow dialog
function StartWorkflowDialog({
  workflow,
  isOpen,
  onClose,
  onStarted,
}: {
  workflow: Doc<"workflows">
  isOpen: boolean
  onClose: () => void
  onStarted: (projectId: Id<"projects">) => void
}) {
  const [projectName, setProjectName] = useState("")
  const [projectDescription, setProjectDescription] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const startProject = useMutation(api.workflows.startProject)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      const result = await startProject({
        workflowId: workflow._id,
        projectName: projectName.trim(),
        projectDescription: projectDescription.trim() || undefined,
      })
      setProjectName("")
      setProjectDescription("")
      onClose()
      onStarted(result.projectId)
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background border border-border rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-2">Start Workflow</h2>
        <p className="text-sm text-muted-foreground mb-4">
          This will create a new project using the "{workflow.name}" workflow.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="project-name" className="block text-sm font-medium mb-1">
              Project Name
            </label>
            <input
              id="project-name"
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="My New Game Design"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="project-description" className="block text-sm font-medium mb-1">
              Project Description (optional)
            </label>
            <textarea
              id="project-description"
              value={projectDescription}
              onChange={(e) => setProjectDescription(e.target.value)}
              placeholder="Describe the project..."
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!projectName.trim() || isLoading}>
              {isLoading ? "Starting..." : "Start Project"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Workflow card component
function WorkflowCard({
  workflow,
  onStart,
  onDelete,
  onClone,
}: {
  workflow: Doc<"workflows">
  onStart: () => void
  onDelete: () => void
  onClone: () => void
}) {
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <Link
            to="/app/workflows/$workflowId"
            params={{ workflowId: workflow._id }}
            className="font-semibold text-lg truncate hover:underline"
          >
            {workflow.name}
          </Link>
          {workflow.description && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {workflow.description}
            </p>
          )}
        </div>
        <div className="text-xs text-muted-foreground whitespace-nowrap">
          {formatTimeAgo(workflow.updatedAt)}
        </div>
      </div>

      {/* Stats */}
      <div className="mt-3 flex gap-2 flex-wrap">
        <span className="text-xs px-2 py-1 rounded-md bg-muted">
          {workflow.steps.length} step{workflow.steps.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Steps preview */}
      {expanded && workflow.steps.length > 0 && (
        <div className="mt-3 space-y-1">
          <div className="text-xs font-medium text-muted-foreground mb-2">Steps:</div>
          {workflow.steps.map((step, index) => (
            <div
              key={index}
              className="text-xs p-2 rounded-md bg-muted/50 flex items-center gap-2"
            >
              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-medium">
                {index + 1}
              </span>
              <span className="font-medium">{step.name}</span>
              {step.templateId && (
                <span className="text-muted-foreground">(has template)</span>
              )}
              {step.carryForwardZones && step.carryForwardZones.length > 0 && (
                <span className="text-muted-foreground">
                  (carries: {step.carryForwardZones.join(", ")})
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="text-xs h-7"
        >
          {expanded ? "Hide Steps" : "Show Steps"}
        </Button>
      </div>

      {/* Actions */}
      <div className="mt-4 pt-3 border-t border-border flex gap-2 flex-wrap">
        <Button
          variant="default"
          size="sm"
          onClick={onStart}
          disabled={workflow.steps.length === 0}
        >
          Start Workflow
        </Button>
        <Link to="/app/workflows/$workflowId" params={{ workflowId: workflow._id }}>
          <Button variant="outline" size="sm">
            Edit
          </Button>
        </Link>
        <Button variant="ghost" size="sm" onClick={onClone}>
          Clone
        </Button>
        {showConfirmDelete ? (
          <>
            <Button variant="destructive" size="sm" onClick={onDelete}>
              Confirm
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

// Main workflows page
function WorkflowsIndexPage() {
  const workflows = useQuery(api.workflows.list)
  const removeWorkflow = useMutation(api.workflows.remove)
  const cloneWorkflow = useMutation(api.workflows.clone)
  const navigate = useNavigate()

  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [startingWorkflow, setStartingWorkflow] = useState<Doc<"workflows"> | null>(null)

  const handleDelete = async (id: Id<"workflows">) => {
    await removeWorkflow({ id })
  }

  const handleClone = async (workflow: Doc<"workflows">) => {
    await cloneWorkflow({
      workflowId: workflow._id,
      name: `${workflow.name} (Copy)`,
    })
  }

  const handleStarted = (projectId: Id<"projects">) => {
    navigate({ to: "/app/projects/$projectId", params: { projectId } })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Workflows</h1>
          <p className="text-muted-foreground mt-1">
            Define multi-step document creation pipelines
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          + New Workflow
        </Button>
      </div>

      {workflows === undefined ? (
        <div className="text-center py-12 text-muted-foreground">Loading workflows...</div>
      ) : workflows.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border rounded-lg">
          <h3 className="text-lg font-medium mb-2">No workflows yet</h3>
          <p className="text-muted-foreground mb-4">
            Create a workflow to define a multi-step document creation process.
          </p>
          <Button onClick={() => setShowCreateDialog(true)}>
            Create Your First Workflow
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {workflows.map((workflow) => (
            <WorkflowCard
              key={workflow._id}
              workflow={workflow}
              onStart={() => setStartingWorkflow(workflow)}
              onDelete={() => handleDelete(workflow._id)}
              onClone={() => handleClone(workflow)}
            />
          ))}
        </div>
      )}

      <CreateWorkflowDialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
      />

      {startingWorkflow && (
        <StartWorkflowDialog
          workflow={startingWorkflow}
          isOpen={true}
          onClose={() => setStartingWorkflow(null)}
          onStarted={handleStarted}
        />
      )}
    </div>
  )
}

export const Route = createFileRoute("/app/workflows/")({
  component: WorkflowsIndexPage,
})
