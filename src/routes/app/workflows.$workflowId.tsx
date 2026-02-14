/**
 * Workflow Editor - Edit workflow steps and configuration.
 */

import { useState } from "react"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useQuery, useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { Button } from "@/components/ui/button"
import type { Id, Doc } from "../../../convex/_generated/dataModel"

type Zone = "PERMANENT" | "STABLE" | "WORKING"

// Edit workflow metadata dialog
function EditWorkflowDialog({
  workflow,
  isOpen,
  onClose,
}: {
  workflow: Doc<"workflows">
  isOpen: boolean
  onClose: () => void
}) {
  const [name, setName] = useState(workflow.name)
  const [description, setDescription] = useState(workflow.description ?? "")
  const [isLoading, setIsLoading] = useState(false)

  const updateWorkflow = useMutation(api.workflows.update)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      await updateWorkflow({
        id: workflow._id,
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
        <h2 className="text-lg font-semibold mb-4">Edit Workflow</h2>

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

// Add/Edit step dialog
function StepDialog({
  isOpen,
  onClose,
  existingStep,
  onSave,
}: {
  isOpen: boolean
  onClose: () => void
  existingStep?: {
    name: string
    description?: string
    templateId?: Id<"templates">
    carryForwardZones?: Zone[]
  }
  onSave: (step: {
    name: string
    description?: string
    templateId?: Id<"templates">
    carryForwardZones?: Zone[]
  }) => Promise<void>
}) {
  const [name, setName] = useState(existingStep?.name ?? "")
  const [description, setDescription] = useState(existingStep?.description ?? "")
  const [templateId, setTemplateId] = useState<Id<"templates"> | "">(
    existingStep?.templateId ?? ""
  )
  const [carryForward, setCarryForward] = useState<Zone[]>(
    existingStep?.carryForwardZones ?? []
  )
  const [isLoading, setIsLoading] = useState(false)

  const templates = useQuery(api.templates.list)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || undefined,
        templateId: templateId || undefined,
        carryForwardZones: carryForward.length > 0 ? carryForward : undefined,
      })
      setName("")
      setDescription("")
      setTemplateId("")
      setCarryForward([])
      onClose()
    } finally {
      setIsLoading(false)
    }
  }

  const toggleZone = (zone: Zone) => {
    if (carryForward.includes(zone)) {
      setCarryForward(carryForward.filter((z) => z !== zone))
    } else {
      setCarryForward([...carryForward, zone])
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background border border-border rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-4">
          {existingStep ? "Edit Step" : "Add Step"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="step-name" className="block text-sm font-medium mb-1">
              Step Name
            </label>
            <input
              id="step-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="IRD Creation"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="step-description" className="block text-sm font-medium mb-1">
              Description (optional)
            </label>
            <textarea
              id="step-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What happens in this step..."
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
            />
          </div>

          <div>
            <label htmlFor="step-template" className="block text-sm font-medium mb-1">
              Template (optional)
            </label>
            <select
              id="step-template"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value as Id<"templates"> | "")}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">No template</option>
              {templates?.map((template) => (
                <option key={template._id} value={template._id}>
                  {template.name} ({template.blocks.length} blocks)
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              Template blocks and system prompt will be loaded when starting this step.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Carry Forward from Previous Step
            </label>
            <div className="flex gap-2">
              {(["PERMANENT", "STABLE", "WORKING"] as Zone[]).map((zone) => (
                <button
                  key={zone}
                  type="button"
                  onClick={() => toggleZone(zone)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    carryForward.includes(zone)
                      ? zone === "PERMANENT"
                        ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                        : zone === "STABLE"
                          ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                          : "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {zone}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Selected zones will be copied from the previous step's session.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || isLoading}>
              {isLoading ? "Saving..." : existingStep ? "Save Changes" : "Add Step"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Step card component
function StepCard({
  step,
  index,
  totalSteps,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  step: {
    name: string
    description?: string
    templateId?: Id<"templates">
    carryForwardZones?: Zone[]
    template?: Doc<"templates"> | null
  }
  index: number
  totalSteps: number
  onEdit: () => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">
          {index + 1}
        </div>
        <div className="flex-1">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-medium">{step.name}</h3>
              {step.description && (
                <p className="text-sm text-muted-foreground mt-1">{step.description}</p>
              )}
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={onMoveUp}
                disabled={index === 0}
                className="h-8 w-8 p-0"
              >
                ↑
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onMoveDown}
                disabled={index === totalSteps - 1}
                className="h-8 w-8 p-0"
              >
                ↓
              </Button>
            </div>
          </div>

          <div className="mt-2 flex gap-2 flex-wrap">
            {step.template ? (
              <span className="text-xs px-2 py-1 rounded-md bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                Template: {step.template.name}
              </span>
            ) : step.templateId ? (
              <span className="text-xs px-2 py-1 rounded-md bg-muted text-muted-foreground">
                Template (not found)
              </span>
            ) : null}
            {step.carryForwardZones && step.carryForwardZones.length > 0 && (
              <span className="text-xs px-2 py-1 rounded-md bg-muted">
                Carries: {step.carryForwardZones.join(", ")}
              </span>
            )}
          </div>

          <div className="mt-3 flex gap-2">
            <Button variant="outline" size="sm" onClick={onEdit}>
              Edit
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
                Remove
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Main workflow editor
function WorkflowEditor() {
  const { workflowId } = Route.useParams()
  const navigate = useNavigate()

  const workflow = useQuery(api.workflows.get, { id: workflowId as Id<"workflows"> })
  const addStep = useMutation(api.workflows.addStep)
  const updateStep = useMutation(api.workflows.updateStep)
  const removeStep = useMutation(api.workflows.removeStep)
  const reorderSteps = useMutation(api.workflows.reorderSteps)
  const removeWorkflow = useMutation(api.workflows.remove)

  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showAddStep, setShowAddStep] = useState(false)
  const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null)

  const handleAddStep = async (step: {
    name: string
    description?: string
    templateId?: Id<"templates">
    carryForwardZones?: Zone[]
  }) => {
    await addStep({
      workflowId: workflowId as Id<"workflows">,
      name: step.name,
      description: step.description,
      templateId: step.templateId,
      carryForwardZones: step.carryForwardZones,
    })
  }

  const handleUpdateStep = async (
    stepIndex: number,
    step: {
      name: string
      description?: string
      templateId?: Id<"templates">
      carryForwardZones?: Zone[]
    }
  ) => {
    await updateStep({
      workflowId: workflowId as Id<"workflows">,
      stepIndex,
      name: step.name,
      description: step.description,
      templateId: step.templateId,
      carryForwardZones: step.carryForwardZones,
    })
  }

  const handleRemoveStep = async (stepIndex: number) => {
    await removeStep({
      workflowId: workflowId as Id<"workflows">,
      stepIndex,
    })
  }

  const handleMoveStep = async (fromIndex: number, toIndex: number) => {
    await reorderSteps({
      workflowId: workflowId as Id<"workflows">,
      fromIndex,
      toIndex,
    })
  }

  const handleDeleteWorkflow = async () => {
    await removeWorkflow({ id: workflowId as Id<"workflows"> })
    navigate({ to: "/app/workflows" })
  }

  if (workflow === undefined) {
    return <div className="text-center py-12 text-muted-foreground">Loading workflow...</div>
  }

  if (workflow === null) {
    return (
      <div className="text-center py-12">
        <h2 className="text-lg font-medium mb-2">Workflow not found</h2>
        <Link to="/app/workflows">
          <Button variant="outline">Back to Workflows</Button>
        </Link>
      </div>
    )
  }

  const editingStep = editingStepIndex !== null ? workflow.steps[editingStepIndex] : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link to="/app/workflows" className="hover:text-foreground">
              Workflows
            </Link>
            <span>/</span>
          </div>
          <h1 className="text-2xl font-bold">{workflow.name}</h1>
          {workflow.description && (
            <p className="text-muted-foreground mt-1">{workflow.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowEditDialog(true)}>
            Edit Info
          </Button>
        </div>
      </div>

      {/* Steps */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Steps ({workflow.steps.length})</h2>
          <Button onClick={() => setShowAddStep(true)}>
            + Add Step
          </Button>
        </div>

        {workflow.steps.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-border rounded-lg">
            <p className="text-muted-foreground mb-4">
              This workflow has no steps yet. Add steps to define your document creation process.
            </p>
            <Button onClick={() => setShowAddStep(true)}>
              Add First Step
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {workflow.steps.map((step, index) => (
              <StepCard
                key={index}
                step={step}
                index={index}
                totalSteps={workflow.steps.length}
                onEdit={() => setEditingStepIndex(index)}
                onDelete={() => handleRemoveStep(index)}
                onMoveUp={() => handleMoveStep(index, index - 1)}
                onMoveDown={() => handleMoveStep(index, index + 1)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Danger zone */}
      <div className="pt-6 border-t border-border">
        <h3 className="text-sm font-medium text-destructive mb-2">Danger Zone</h3>
        <Button variant="destructive" size="sm" onClick={handleDeleteWorkflow}>
          Delete Workflow
        </Button>
      </div>

      {/* Dialogs */}
      {showEditDialog && (
        <EditWorkflowDialog
          workflow={workflow}
          isOpen={showEditDialog}
          onClose={() => setShowEditDialog(false)}
        />
      )}

      <StepDialog
        isOpen={showAddStep}
        onClose={() => setShowAddStep(false)}
        onSave={handleAddStep}
      />

      {editingStep && (
        <StepDialog
          isOpen={editingStepIndex !== null}
          onClose={() => setEditingStepIndex(null)}
          existingStep={editingStep}
          onSave={(step) => handleUpdateStep(editingStepIndex!, step)}
        />
      )}
    </div>
  )
}

export const Route = createFileRoute("/app/workflows/$workflowId")({
  component: WorkflowEditor,
})
