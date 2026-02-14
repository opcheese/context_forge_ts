/**
 * Project Dashboard - View and manage a single project.
 */

import { useState } from "react"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useQuery, useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { Button } from "@/components/ui/button"
import { useSession } from "@/contexts/SessionContext"
import type { Id, Doc } from "../../../convex/_generated/dataModel"

// Format relative time
function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)

  if (seconds < 60) return "just now"
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

// Edit project dialog
function EditProjectDialog({
  project,
  isOpen,
  onClose,
}: {
  project: Doc<"projects">
  isOpen: boolean
  onClose: () => void
}) {
  const [name, setName] = useState(project.name)
  const [description, setDescription] = useState(project.description ?? "")
  const [isLoading, setIsLoading] = useState(false)

  const updateProject = useMutation(api.projects.update)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      await updateProject({
        id: project._id,
        name: name.trim(),
        description: description.trim() || undefined,
      })
      onClose()
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background border border-border rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-4">Edit Project</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="edit-name" className="block text-sm font-medium mb-1">
              Name
            </label>
            <input
              id="edit-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="edit-description" className="block text-sm font-medium mb-1">
              Description
            </label>
            <textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || isLoading}>
              {isLoading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Create session dialog
function CreateSessionDialog({
  projectId,
  isOpen,
  onClose,
  onCreated,
}: {
  projectId: Id<"projects">
  isOpen: boolean
  onClose: () => void
  onCreated: (sessionId: Id<"sessions">) => void
}) {
  const [name, setName] = useState("")
  const [selectedTemplateId, setSelectedTemplateId] = useState<Id<"templates"> | "">("")
  const [isLoading, setIsLoading] = useState(false)

  const templates = useQuery(api.templates.list)
  const createSession = useMutation(api.projects.createSession)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      const sessionId = await createSession({
        projectId,
        name: name.trim() || undefined,
        templateId: selectedTemplateId || undefined,
      })
      setName("")
      setSelectedTemplateId("")
      onClose()
      onCreated(sessionId)
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background border border-border rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-4">Create Session in Project</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="session-name" className="block text-sm font-medium mb-1">
              Session Name (optional)
            </label>
            <input
              id="session-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Step 1: Initial Brainstorm"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="template-select" className="block text-sm font-medium mb-1">
              Start from Template (optional)
            </label>
            <select
              id="template-select"
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value as Id<"templates"> | "")}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Start empty</option>
              {templates?.map((template) => (
                <option key={template._id} value={template._id}>
                  {template.name} ({template.blocks.length} blocks)
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Creating..." : "Create Session"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Session card within project
function SessionCard({
  session,
  onOpen,
  onRemove,
}: {
  session: Doc<"sessions">
  onOpen: () => void
  onRemove: () => void
}) {
  const [showConfirmRemove, setShowConfirmRemove] = useState(false)

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {session.stepNumber !== undefined && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                Step {session.stepNumber}
              </span>
            )}
            <h3 className="font-medium truncate">
              {session.name ?? `Session ${session._id.slice(-6)}`}
            </h3>
          </div>
          {session.systemPrompt && (
            <p className="text-xs text-muted-foreground mt-1 truncate">
              System: {session.systemPrompt.slice(0, 50)}...
            </p>
          )}
        </div>
        <div className="text-xs text-muted-foreground whitespace-nowrap">
          {session.updatedAt ?? session.createdAt
            ? formatTimeAgo(session.updatedAt ?? session.createdAt!)
            : ""}
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <Button variant="outline" size="sm" onClick={onOpen}>
          Open
        </Button>
        {showConfirmRemove ? (
          <>
            <Button variant="destructive" size="sm" onClick={onRemove}>
              Confirm
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowConfirmRemove(false)}
            >
              Cancel
            </Button>
          </>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowConfirmRemove(true)}
            className="text-muted-foreground"
          >
            Remove from Project
          </Button>
        )}
      </div>
    </div>
  )
}

// Main project dashboard
function ProjectDashboard() {
  const { projectId } = Route.useParams()
  const navigate = useNavigate()
  const { switchSession } = useSession()

  const project = useQuery(api.projects.get, { id: projectId as Id<"projects"> })
  const removeSession = useMutation(api.projects.removeSession)
  const advanceStep = useMutation(api.workflows.advanceStep)

  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showCreateSession, setShowCreateSession] = useState(false)
  const [isAdvancing, setIsAdvancing] = useState(false)

  const handleOpenSession = (sessionId: Id<"sessions">) => {
    switchSession(sessionId)
    navigate({ to: "/app" })
  }

  const handleRemoveSession = async (sessionId: Id<"sessions">) => {
    await removeSession({ sessionId })
  }

  const handleAdvanceStep = async () => {
    if (!project || !project.workflow) return

    // Find the current step's session
    const currentStepSession = project.sessions.find(
      (s) => s.stepNumber === project.currentStep
    )
    if (!currentStepSession) return

    setIsAdvancing(true)
    try {
      const result = await advanceStep({
        projectId: project._id,
        previousSessionId: currentStepSession._id,
      })
      // Open the new session
      handleOpenSession(result.sessionId)
    } finally {
      setIsAdvancing(false)
    }
  }

  if (project === undefined) {
    return <div className="text-center py-12 text-muted-foreground">Loading project...</div>
  }

  if (project === null) {
    return (
      <div className="text-center py-12">
        <h2 className="text-lg font-medium mb-2">Project not found</h2>
        <Link to="/app/projects">
          <Button variant="outline">Back to Projects</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link to="/app/projects" className="hover:text-foreground">
              Projects
            </Link>
            <span>/</span>
          </div>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          {project.description && (
            <p className="text-muted-foreground mt-1">{project.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowEditDialog(true)}>
            Edit
          </Button>
          <Button onClick={() => setShowCreateSession(true)}>
            + Add Session
          </Button>
        </div>
      </div>

      {/* Workflow info (if linked) */}
      {project.workflow && (
        <div className="p-4 rounded-lg border border-border bg-muted/30">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">WORKFLOW</span>
              <Link
                to="/app/workflows/$workflowId"
                params={{ workflowId: project.workflow._id }}
                className="text-sm font-medium hover:underline"
              >
                {project.workflow.name}
              </Link>
            </div>
            {project.currentStep !== undefined &&
              project.currentStep < project.workflow.steps.length - 1 && (
                <Button
                  size="sm"
                  onClick={handleAdvanceStep}
                  disabled={isAdvancing}
                >
                  {isAdvancing ? "Advancing..." : "Next Step →"}
                </Button>
              )}
          </div>

          {/* Step progress indicator */}
          <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {project.workflow.steps.map((step, index) => {
              const isCompleted = (project.currentStep ?? 0) > index
              const isCurrent = project.currentStep === index

              return (
                <div key={index} className="flex items-center">
                  <div
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap ${
                      isCompleted
                        ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                        : isCurrent
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <span className="w-5 h-5 rounded-full flex items-center justify-center bg-white/20">
                      {isCompleted ? "✓" : index + 1}
                    </span>
                    {step.name}
                  </div>
                  {index < project.workflow!.steps.length - 1 && (
                    <div
                      className={`w-4 h-0.5 mx-1 ${
                        isCompleted ? "bg-green-500" : "bg-border"
                      }`}
                    />
                  )}
                </div>
              )
            })}
          </div>

          {project.currentStep === project.workflow.steps.length - 1 && (
            <div className="mt-2 text-xs text-green-600 dark:text-green-400">
              ✓ Workflow complete
            </div>
          )}
        </div>
      )}

      {/* Sessions */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Sessions ({project.sessions.length})</h2>
        {project.sessions.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-border rounded-lg">
            <p className="text-muted-foreground mb-4">
              No sessions in this project yet.
            </p>
            <Button onClick={() => setShowCreateSession(true)}>
              Create First Session
            </Button>
          </div>
        ) : (
          <div className="grid gap-3">
            {project.sessions.map((session) => (
              <SessionCard
                key={session._id}
                session={session}
                onOpen={() => handleOpenSession(session._id)}
                onRemove={() => handleRemoveSession(session._id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Dialogs */}
      {showEditDialog && (
        <EditProjectDialog
          project={project}
          isOpen={showEditDialog}
          onClose={() => setShowEditDialog(false)}
        />
      )}

      <CreateSessionDialog
        projectId={project._id}
        isOpen={showCreateSession}
        onClose={() => setShowCreateSession(false)}
        onCreated={handleOpenSession}
      />
    </div>
  )
}

export const Route = createFileRoute("/app/projects/$projectId")({
  component: ProjectDashboard,
})
