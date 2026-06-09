import { useState, useRef, useEffect, useCallback } from "react"
import { useQuery, useMutation } from "convex/react"
import { useNavigate } from "@tanstack/react-router"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"
import { AnimatePresence, motion } from "framer-motion"
import { useSession } from "@/contexts/SessionContext"
import { diffWords } from "diff"
import type { Change } from "diff"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { ChevronRight } from "lucide-react"
import { dialogOverlay, dialogContent } from "@/lib/motion"
import { checkForUpdates } from "@/lib/git-export/sync"
import { getProviderSettings, pushWithProvider } from "@/lib/git-export/adapter"
import { github, gitlab } from "@/lib/git-export/settings"
import { renderAnchorJson, buildBaseFilePath, uniqueFilename } from "@/lib/git-export/markdown"
import { ProviderSelector, RepoFormFields, ContextModeBadge } from "./GitExportShared"
import { extractBlockTitle } from "@/lib/skills/titleExtractor"
import { BLOCK_TYPE_METADATA } from "@/lib/blockTypes"
import type { BlockType } from "@/lib/blockTypes"
import type { GitProviderType } from "@/lib/git-export/adapter"
import type { SyncChange, SyncResult } from "@/lib/git-export/sync"

// ── Constants ─────────────────────────────────────────────────────────────────

const ZONE_ORDER: Record<string, number> = { PERMANENT: 0, STABLE: 1, WORKING: 2 }
const ZONE_LABEL: Record<string, string> = { PERMANENT: "Permanent", STABLE: "Stable" }

interface BlockData {
  content: string
  type: string
  typeIndex: number
  refBlockId?: string
}

// ── DiffView ──────────────────────────────────────────────────────────────────

function DiffView({ before, after }: { before: string; after: string }) {
  const parts: Change[] = diffWords(before, after)
  return (
    <div className="grid grid-cols-2 border border-border rounded overflow-hidden text-sm mt-2">
      <div className="p-3 border-r border-border">
        <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Current</div>
        <div className="whitespace-pre-wrap leading-relaxed">
          {parts.map((part, i) => {
            if (part.added) return null
            return (
              <span key={i} className={part.removed ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 line-through" : undefined}>
                {part.value}
              </span>
            )
          })}
        </div>
      </div>
      <div className="p-3">
        <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Remote</div>
        <div className="whitespace-pre-wrap leading-relaxed">
          {parts.map((part, i) => {
            if (part.removed) return null
            return (
              <span key={i} className={part.added ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" : undefined}>
                {part.value}
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatSyncedAt(ts: number): string {
  const diff = Date.now() - ts
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

// ── SessionBlockPicker ────────────────────────────────────────────────────────
// Renders one session's block list with checkboxes, used in both export and add-blocks views.

interface SessionBlockPickerProps {
  session: { _id: Id<"sessions">; name?: string }
  excludeIds: Set<string>
  selectedIds: Set<string>
  onToggle: (id: string) => void
  onBulkToggle: (ids: string[], select: boolean) => void
  onBlockData: (id: string, data: BlockData) => void
}

function SessionBlockPicker({ session, excludeIds, selectedIds, onToggle, onBulkToggle, onBlockData }: SessionBlockPickerProps) {
  const blocks = useQuery(api.blocks.list, { sessionId: session._id })
  const [showOtherZones, setShowOtherZones] = useState(false)

  useEffect(() => {
    if (!blocks) return
    const typeCounters: Record<string, number> = {}
    const sorted = [...blocks].sort((a, b) => {
      const zd = (ZONE_ORDER[a.zone] ?? 9) - (ZONE_ORDER[b.zone] ?? 9)
      return zd !== 0 ? zd : a.position - b.position
    })
    for (const block of sorted) {
      const idx = typeCounters[block.type] ?? 0
      typeCounters[block.type] = idx + 1
      onBlockData(block._id, { content: block.content, type: block.type, typeIndex: idx, refBlockId: block.refBlockId as string | undefined })
    }
  }, [blocks, onBlockData])

  if (!blocks) return <p className="text-xs text-muted-foreground">Loading...</p>

  const available = blocks.filter((b) => !excludeIds.has(b._id) && !(b.refBlockId && excludeIds.has(b.refBlockId as string)))
  if (available.length === 0) {
    return session.name
      ? <p className="text-xs text-muted-foreground italic">All blocks already linked</p>
      : null
  }

  const working = available.filter((b) => b.zone === "WORKING").sort((a, b) => a.position - b.position)
  const others = available.filter((b) => b.zone !== "WORKING")
  const otherGrouped = (["PERMANENT", "STABLE"] as const)
    .map((zone) => ({ zone, items: others.filter((b) => b.zone === zone).sort((a, b) => a.position - b.position) }))
    .filter((g) => g.items.length > 0)

  const workingIds = working.map((b) => b._id)
  const allWorkingSelected = workingIds.length > 0 && workingIds.every((id) => selectedIds.has(id))

  const renderRow = (block: NonNullable<typeof blocks>[number], i: number) => {
    const title = extractBlockTitle(block.content, block.type, i)
    const typeMeta = BLOCK_TYPE_METADATA[block.type as BlockType]
    const isRef = !!block.refBlockId
    return (
      <label key={block._id} className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={selectedIds.has(block._id)}
          onChange={() => onToggle(block._id)}
          className="rounded"
        />
        <span className="text-sm text-foreground truncate max-w-[220px]">{title}</span>
        <span className="text-xs text-muted-foreground shrink-0">{typeMeta?.displayName ?? block.type}</span>
        {isRef && <span className="text-xs text-muted-foreground shrink-0" title="Shared block — exports as one file with its original">linked</span>}
        <ContextModeBadge contextMode={block.contextMode} />
      </label>
    )
  }

  return (
    <div className="space-y-1">
      {session.name && (
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{session.name}</p>
          {workingIds.length > 0 && (
            <button onClick={() => onBulkToggle(workingIds, !allWorkingSelected)} className="text-xs text-primary hover:underline">
              {allWorkingSelected ? "Deselect all" : "Select all"}
            </button>
          )}
        </div>
      )}
      {working.length === 0
        ? <p className="text-xs text-muted-foreground pl-1">No blocks in Working zone</p>
        : working.map((b, i) => renderRow(b, i))}
      {otherGrouped.length > 0 && (
        <div className="mt-2 pt-1">
          <button onClick={() => setShowOtherZones(!showOtherZones)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground w-full">
            <ChevronRight className={`h-3 w-3 transition-transform ${showOtherZones ? "rotate-90" : ""}`} />
            Permanent & Stable ({others.length})
          </button>
          {showOtherZones && (
            <div className="mt-2 space-y-3">
              {otherGrouped.map(({ zone, items }) => (
                <div key={zone}>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1">{ZONE_LABEL[zone]}</p>
                  <div className="space-y-1">{items.map((b, i) => renderRow(b, i))}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── ProjectBlockList ──────────────────────────────────────────────────────────
// Project-mode block picker: iterates all project sessions.

interface ProjectBlockListProps {
  projectId: Id<"projects">
  excludeIds: Set<string>
  selectedIds: Set<string>
  onToggle: (id: string) => void
  onBulkToggle: (ids: string[], select: boolean) => void
  onBlockData: (id: string, data: BlockData) => void
}

function ProjectBlockList({ projectId, excludeIds, selectedIds, onToggle, onBulkToggle, onBlockData }: ProjectBlockListProps) {
  const project = useQuery(api.projects.get, { id: projectId })
  if (!project) return <p className="text-sm text-muted-foreground">Loading project...</p>
  if (project.sessions.length === 0) return <p className="text-sm text-muted-foreground">No sessions in this project.</p>
  return (
    <div className="border border-border rounded-md divide-y divide-border">
      {project.sessions.map((session) => (
        <div key={session._id} className="p-3">
          <SessionBlockPicker
            session={session}
            excludeIds={excludeIds}
            selectedIds={selectedIds}
            onToggle={onToggle}
            onBulkToggle={onBulkToggle}
            onBlockData={onBlockData}
          />
        </div>
      ))}
    </div>
  )
}



// ── Main dialog ───────────────────────────────────────────────────────────────

interface SyncDialogProps {
  isOpen: boolean
  onClose: () => void
  projectId?: string
  sessionId?: Id<"sessions">
}

export function SyncDialog({ isOpen, onClose, projectId, sessionId }: SyncDialogProps) {
  const navigate = useNavigate()
  const { switchSession } = useSession()

  // ── Queries ────────────────────────────────────────────────────────────────

  const syncMappingByProject = useQuery(
    api.syncMappings.getSyncMapping,
    !sessionId && projectId ? { projectId: projectId as Id<"projects"> } : "skip"
  )
  const syncMappingBySession = useQuery(
    api.syncMappings.getSyncMappingBySession,
    sessionId ? { sessionId } : "skip"
  )
  const syncMapping = sessionId ? syncMappingBySession : syncMappingByProject

  const syncedBlockIds = syncMapping?.blocks.map((b) => b.blockId as Id<"blocks">) ?? []
  const convexBlocksRaw = useQuery(api.blocks.getMany, syncedBlockIds.length > 0 ? { ids: syncedBlockIds } : "skip")
  const convexBlocks = (convexBlocksRaw ?? []) as Array<{ _id: string; content: string; type: string; sessionId: Id<"sessions">; updatedAt: number; contentHash?: string }>
  const isBlocksLoading = syncedBlockIds.length > 0 && convexBlocksRaw === undefined

  // ── Sync check state ───────────────────────────────────────────────────────

  const [isChecking, setIsChecking] = useState(false)
  const [result, setResult] = useState<SyncResult | null>(null)
  const [checkError, setCheckError] = useState<string | null>(null)
  const [expandedDiffs, setExpandedDiffs] = useState<Set<string>>(new Set())
  const [accepting, setAccepting] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const [reexporting, setReexporting] = useState<string | null>(null)
  const [reexportResults, setReexportResults] = useState<Map<string, { commitUrl: string; branch: string }>>(new Map())
  const [reexportError, setReexportError] = useState<{ blockId: string; message: string } | null>(null)

  // ── Export (initial) state ─────────────────────────────────────────────────

  const [exportProvider, setExportProvider] = useState<GitProviderType>("github")
  const [exportRepoUrl, setExportRepoUrl] = useState(() => getProviderSettings("github").getDefaultRepoUrl())
  const [exportBranch, setExportBranch] = useState("main")
  const [exportFolder, setExportFolder] = useState(() => getProviderSettings("github").getDefaultFolder())
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const exportSelectedIds = useRef<Set<string>>(new Set())
  const [exportSelectedCount, setExportSelectedCount] = useState(0)
  const exportBlockDataRef = useRef<Map<string, BlockData>>(new Map())

  // ── Tab state (when mapping exists) ───────────────────────────────────────

  const [activeTab, setActiveTab] = useState<"sync" | "add" | "settings">("sync")

  // ── Add-blocks state ───────────────────────────────────────────────────────

  const addSelectedIds = useRef<Set<string>>(new Set())
  const [addSelectedCount, setAddSelectedCount] = useState(0)
  const addBlockDataRef = useRef<Map<string, BlockData>>(new Map())
  const [isAddExporting, setIsAddExporting] = useState(false)
  const [addExportError, setAddExportError] = useState<string | null>(null)
  const [addExportSuccess, setAddExportSuccess] = useState(false)

  // ── Settings state ─────────────────────────────────────────────────────────

  const [settingsProvider, setSettingsProvider] = useState<GitProviderType>("github")
  const [settingsRepoUrl, setSettingsRepoUrl] = useState("")
  const [settingsBranch, setSettingsBranch] = useState("main")
  const [settingsFolder, setSettingsFolder] = useState("")
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  const [settingsError, setSettingsError] = useState<string | null>(null)
  const [settingsSaved, setSettingsSaved] = useState(false)

  // ── Import state ───────────────────────────────────────────────────────────


  // ── Mutations ──────────────────────────────────────────────────────────────

  const updateBlock = useMutation(api.blocks.update)
  const setRejectedContent = useMutation(api.syncMappings.setRejectedContent)
  const clearRejectedContent = useMutation(api.syncMappings.clearRejectedContent)
  const removeSyncBlock = useMutation(api.syncMappings.removeSyncBlock)
  const touchLastSyncedAt = useMutation(api.syncMappings.touchLastSyncedAt)
  const upsertSyncMapping = useMutation(api.syncMappings.upsertSyncMapping)
  const upsertSyncBlock = useMutation(api.syncMappings.upsertSyncBlock)

  // Initialise settings form from syncMapping when it first loads
  useEffect(() => {
    if (!syncMapping) return
    setSettingsProvider(syncMapping.provider)
    setSettingsRepoUrl(syncMapping.repoUrl)
    setSettingsBranch(syncMapping.branch)
    setSettingsFolder(syncMapping.folder)
  }, [syncMapping?.provider, syncMapping?.repoUrl, syncMapping?.branch, syncMapping?.folder])

  // ── Callbacks for block pickers ────────────────────────────────────────────

  const findLinkedIds = useCallback((id: string, dataMap: Map<string, BlockData>): string[] => {
    const data = dataMap.get(id)
    const canonicalId = data?.refBlockId ?? id
    const related: string[] = []
    for (const [bid, bdata] of dataMap) {
      if (bid === id) continue
      if (bid === canonicalId || bdata.refBlockId === canonicalId) related.push(bid)
    }
    return related
  }, [])

  const handleExportToggle = useCallback((id: string) => {
    const s = exportSelectedIds.current
    const adding = !s.has(id)
    adding ? s.add(id) : s.delete(id)
    findLinkedIds(id, exportBlockDataRef.current).forEach((lid) => adding ? s.add(lid) : s.delete(lid))
    setExportSelectedCount(s.size)
  }, [findLinkedIds])

  const handleExportBulkToggle = useCallback((ids: string[], select: boolean) => {
    const s = exportSelectedIds.current
    ids.forEach((id) => {
      select ? s.add(id) : s.delete(id)
      findLinkedIds(id, exportBlockDataRef.current).forEach((lid) => select ? s.add(lid) : s.delete(lid))
    })
    setExportSelectedCount(s.size)
  }, [findLinkedIds])

  const handleExportBlockData = useCallback((id: string, data: BlockData) => {
    exportBlockDataRef.current.set(id, data)
  }, [])

  const handleAddToggle = useCallback((id: string) => {
    const s = addSelectedIds.current
    const adding = !s.has(id)
    adding ? s.add(id) : s.delete(id)
    findLinkedIds(id, addBlockDataRef.current).forEach((lid) => adding ? s.add(lid) : s.delete(lid))
    setAddSelectedCount(s.size)
  }, [findLinkedIds])

  const handleAddBulkToggle = useCallback((ids: string[], select: boolean) => {
    const s = addSelectedIds.current
    ids.forEach((id) => {
      select ? s.add(id) : s.delete(id)
      findLinkedIds(id, addBlockDataRef.current).forEach((lid) => select ? s.add(lid) : s.delete(lid))
    })
    setAddSelectedCount(s.size)
  }, [findLinkedIds])

  const handleAddBlockData = useCallback((id: string, data: BlockData) => {
    addBlockDataRef.current.set(id, data)
  }, [])

  // ── Export helpers ─────────────────────────────────────────────────────────

  const buildFiles = (
    selectedSet: Set<string>,
    dataRef: Map<string, BlockData>,
    folder: string
  ): { path: string; content: string; blockId: string }[] => {
    const files: { path: string; content: string; blockId: string }[] = []
    const usedPaths = new Set<string>()
    const processedCanonicals = new Set<string>()
    for (const blockId of selectedSet) {
      const data = dataRef.get(blockId)
      if (!data) continue
      // Ref blocks are deduplicated: export only the canonical once
      const canonicalId = data.refBlockId ?? blockId
      if (processedCanonicals.has(canonicalId)) continue
      processedCanonicals.add(canonicalId)
      const effectiveData = data.refBlockId ? (dataRef.get(data.refBlockId) ?? data) : data
      const effectiveId = data.refBlockId ?? blockId
      const basePath = buildBaseFilePath({ content: effectiveData.content, blockType: effectiveData.type, typeIndex: effectiveData.typeIndex, folder })
      const path = uniqueFilename(basePath, ".md", usedPaths)
      usedPaths.add(path)
      files.push({ path, blockId: effectiveId, content: effectiveData.content })
    }
    return files
  }

  const pushAndRecord = async (
    provider: GitProviderType,
    repoUrl: string,
    branch: string,
    folder: string,
    files: { path: string; content: string; blockId: string }[],
    commitMessage: string
  ) => {
    if (!projectId) throw new Error("Project required for Git sync.")
    const pat = getProviderSettings(provider).getPat()
    if (!pat) throw new Error(`${provider === "github" ? "GitHub" : "GitLab"} token not configured. Set it in Settings → Git Integration.`)

    const effectiveBranch = branch.trim() || (provider === "github" ? "main" : "master")
    const now = new Date().toISOString()
    const anchorFiles = files.map((f) => ({
      path: `.contextforge/meta/${f.blockId}.json`,
      content: renderAnchorJson({ blockId: f.blockId, path: f.path, exportedAt: now }),
    }))

    await pushWithProvider(provider, {
      repoUrl: repoUrl.trim(), pat, branch: effectiveBranch,
      files: [...files.map((f) => ({ path: f.path, content: f.content })), ...anchorFiles],
      commitMessage,
    })

    const mappingId = await upsertSyncMapping({
      projectId: projectId as Id<"projects">, provider,
      repoUrl: repoUrl.trim(), branch: effectiveBranch, folder,
    })

    for (const file of files) {
      await upsertSyncBlock({ syncMappingId: mappingId, blockId: file.blockId as Id<"blocks">, path: file.path })
    }
  }

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleInitialExport = async () => {
    if (exportSelectedIds.current.size === 0) { setExportError("Select at least one block."); return }
    if (!exportRepoUrl.trim()) { setExportError("Repository URL is required."); return }
    setIsExporting(true); setExportError(null)
    try {
      const files = buildFiles(exportSelectedIds.current, exportBlockDataRef.current, exportFolder)
      await pushAndRecord(exportProvider, exportRepoUrl, exportBranch, exportFolder, files, "ContextForge: initial export")
      // syncMapping will update via Convex reactivity — dialog transitions automatically
    } catch (e) {
      setExportError(e instanceof Error ? e.message : String(e))
    } finally {
      setIsExporting(false)
    }
  }

  const handleAddBlocks = async () => {
    if (!syncMapping) return
    if (addSelectedIds.current.size === 0) { setAddExportError("Select at least one block."); return }
    setIsAddExporting(true); setAddExportError(null); setAddExportSuccess(false)
    try {
      const files = buildFiles(addSelectedIds.current, addBlockDataRef.current, syncMapping.folder)
      await pushAndRecord(syncMapping.provider, syncMapping.repoUrl, syncMapping.branch, syncMapping.folder, files, "ContextForge: add blocks")
      addSelectedIds.current = new Set()
      setAddSelectedCount(0)
      setAddExportSuccess(true)
      setActiveTab("sync")
    } catch (e) {
      setAddExportError(e instanceof Error ? e.message : String(e))
    } finally {
      setIsAddExporting(false)
    }
  }

  const handleSaveSettings = async () => {
    if (!syncMapping || !projectId) return
    if (!settingsRepoUrl.trim()) { setSettingsError("Repository URL is required."); return }

    const pat = getProviderSettings(settingsProvider).getPat()
    if (!pat) {
      setSettingsError(`${settingsProvider === "github" ? "GitHub" : "GitLab"} token not configured. Set it in Settings → Git Integration.`)
      return
    }

    setIsSavingSettings(true); setSettingsError(null); setSettingsSaved(false)

    const effectiveBranch = settingsBranch.trim() || (settingsProvider === "github" ? "main" : "master")
    const newFolder = settingsFolder.trim()
    const folderChanged = syncMapping.folder !== newFolder

    try {
      // Re-export all synced blocks to the new repo/branch/folder
      const files: { path: string; content: string; blockId: string }[] = []

      for (const sb of syncMapping.blocks) {
        const blockId = sb.blockId as string
        const block = convexByBlockId.get(blockId)
        if (!block) continue

        // Recompute path if folder changed, otherwise keep existing path
        let newPath = sb.path
        if (folderChanged) {
          const oldPrefix = syncMapping.folder ? `${syncMapping.folder}/` : ""
          const filename = sb.path.startsWith(oldPrefix) ? sb.path.slice(oldPrefix.length) : sb.path
          newPath = newFolder ? `${newFolder}/${filename}` : filename
        }

        files.push({ path: newPath, content: block.content, blockId })
      }

      if (files.length > 0) {
        const now = new Date().toISOString()
        const anchorFiles = files.map((f) => ({
          path: `.contextforge/meta/${f.blockId}.json`,
          content: renderAnchorJson({ blockId: f.blockId, path: f.path, exportedAt: now }),
        }))
        await pushWithProvider(settingsProvider, {
          repoUrl: settingsRepoUrl.trim(),
          pat,
          branch: effectiveBranch,
          files: [...files.map((f) => ({ path: f.path, content: f.content })), ...anchorFiles],
          commitMessage: "ContextForge: update repository settings",
        })
      }

      // Update mapping in Convex
      const mappingId = await upsertSyncMapping({
        projectId: projectId as Id<"projects">,
        provider: settingsProvider,
        repoUrl: settingsRepoUrl.trim(),
        branch: effectiveBranch,
        folder: newFolder,
      })

      // Update stored paths if folder changed
      if (folderChanged) {
        for (const f of files) {
          await upsertSyncBlock({
            syncMappingId: mappingId,
            blockId: f.blockId as Id<"blocks">,
            path: f.path,
          })
        }
      }

      setSettingsSaved(true)
    } catch (e) {
      setSettingsError(e instanceof Error ? e.message : String(e))
    } finally {
      setIsSavingSettings(false)
    }
  }

  const handleCheck = async () => {
    if (!syncMapping) return
    setIsChecking(true); setCheckError(null)
    try {
      const syncResult = await checkForUpdates(
        { provider: syncMapping.provider, repoUrl: syncMapping.repoUrl, branch: syncMapping.branch },
        syncMapping.blocks.map((b) => ({ blockId: b.blockId as string, path: b.path, rejectedRemoteContent: b.rejectedRemoteContent })),
        convexBlocks
      )
      setResult(syncResult)
      await touchLastSyncedAt({ projectId: syncMapping.projectId })
      if (syncResult.changes.length <= 3) setExpandedDiffs(new Set(syncResult.changes.map((c) => c.blockId)))
    } catch (e) {
      setCheckError(e instanceof Error ? e.message : String(e))
    } finally {
      setIsChecking(false)
    }
  }

  const handleAccept = async (change: SyncChange) => {
    if (!syncMapping) return
    setAccepting(change.blockId)
    try {
      await updateBlock({ id: change.blockId as Id<"blocks">, content: change.remoteContent })
      await clearRejectedContent({ blockId: change.blockId as Id<"blocks"> })
      await touchLastSyncedAt({ projectId: syncMapping.projectId })
      // Sync the stored content hash so the block doesn't appear as "edited locally"
      const sb = syncMapping.blocks.find((b) => b.blockId === change.blockId)
      if (sb) await upsertSyncBlock({ syncMappingId: syncMapping._id, blockId: change.blockId as Id<"blocks">, path: sb.path })
      setResult((prev) => prev ? { ...prev, changes: prev.changes.filter((c) => c.blockId !== change.blockId) } : null)
      setExpandedDiffs((prev) => { const next = new Set(prev); next.delete(change.blockId); return next })
    } finally {
      setAccepting(null)
    }
  }

  const handleReject = async (change: SyncChange) => {
    setRejecting(change.blockId)
    try {
      await setRejectedContent({ blockId: change.blockId as Id<"blocks">, content: change.remoteContent })
      setResult((prev) => prev ? { ...prev, changes: prev.changes.filter((c) => c.blockId !== change.blockId) } : null)
      setExpandedDiffs((prev) => { const next = new Set(prev); next.delete(change.blockId); return next })
    } finally {
      setRejecting(null)
    }
  }

  const handleRemove = async (blockId: string) => {
    setRemoving(blockId)
    try { await removeSyncBlock({ blockId: blockId as Id<"blocks"> }) }
    finally { setRemoving(null) }
  }

  const handleReexport = async (blockId: string, path: string) => {
    if (!syncMapping) return
    const block = convexByBlockId.get(blockId)
    if (!block) return
    const pat = getProviderSettings(syncMapping.provider).getPat()
    if (!pat) { setReexportError({ blockId, message: "PAT not configured. Set it in Settings → Git Integration." }); return }
    setReexporting(blockId); setReexportError(null)
    try {
      const pushResult = await pushWithProvider(syncMapping.provider, {
        repoUrl: syncMapping.repoUrl, pat, branch: syncMapping.branch,
        files: [
          { path, content: block.content },
          { path: `.contextforge/meta/${blockId}.json`, content: renderAnchorJson({ blockId, path, exportedAt: new Date().toISOString() }) },
        ],
        commitMessage: `ContextForge: restore ${path}`,
      })
      const commitUrl = syncMapping.provider === "github"
        ? `${pushResult.repoUrl}/commit/${pushResult.commitSha}`
        : `${pushResult.repoUrl}/-/commit/${pushResult.commitSha}`
      await upsertSyncBlock({ syncMappingId: syncMapping._id, blockId: blockId as Id<"blocks">, path })
      setReexportResults((prev) => new Map(prev).set(path, { commitUrl, branch: syncMapping.branch }))
    } catch (e) {
      setReexportError({ blockId, message: e instanceof Error ? e.message : String(e) })
    } finally {
      setReexporting(null)
    }
  }

  const handleOpenBlock = (sid: Id<"sessions">, blockId: string) => {
    switchSession(sid)
    navigate({ to: "/app/blocks/$blockId", params: { blockId } })
    onClose()
  }

  const handleClose = () => {
    setResult(null); setCheckError(null)
    setExpandedDiffs(new Set())
    setReexportResults(new Map()); setReexportError(null)
    setActiveTab("sync")
    setAddExportSuccess(false); setSettingsSaved(false)
    exportSelectedIds.current = new Set(); setExportSelectedCount(0)
    addSelectedIds.current = new Set(); setAddSelectedCount(0)
    onClose()
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const convexByBlockId = new Map(convexBlocks.map((b) => [b._id, b]))
  const changesByBlockId = new Map(result?.changes.map((c) => [c.blockId, c]) ?? [])
  const notFoundPaths = new Set(result?.notFound ?? [])
  const syncedExcludeIds = new Set((syncMapping?.blocks ?? []).map((b) => b.blockId as string))
  const pendingChanges = result?.changes.length ?? 0
  const pendingNotFound = result?.notFound.length ?? 0

  // ── Render ─────────────────────────────────────────────────────────────────

  const hasTabs = syncMapping !== null && syncMapping !== undefined
  const noProject = sessionId && !projectId
  const showContent = !noProject && (!sessionId || projectId)

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          initial={dialogOverlay.initial} animate={dialogOverlay.animate}
          exit={dialogOverlay.exit} transition={dialogOverlay.transition}
          onClick={handleClose}
        >
          <motion.div
            className="bg-background border border-border rounded-lg shadow-xl w-full max-w-2xl flex flex-col overflow-hidden"
            style={{ height: "85vh" }}
            initial={dialogContent.initial} animate={dialogContent.animate}
            exit={dialogContent.exit} transition={dialogContent.transition}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Header ──────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 shrink-0">
              <h2 className="text-lg font-semibold">Git Sync</h2>
              <button onClick={handleClose} className="text-muted-foreground hover:text-foreground text-xl leading-none" aria-label="Close">×</button>
            </div>

            {/* ── Tab bar (only when mapping is configured) ────────────────── */}
            {hasTabs && (
              <div className="flex border-b border-border px-6 shrink-0">
                {(["sync", "add", "settings"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                      activeTab === tab
                        ? "border-primary text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tab === "sync" ? "Synced files" : tab === "add" ? "Add blocks" : "Repository"}
                  </button>
                ))}
              </div>
            )}

            {/* ── Scrollable content ───────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

              {/* No project linked (session mode) */}
              {noProject && (
                <p className="text-sm text-muted-foreground">Add this session to a project to enable Git sync.</p>
              )}

              {/* No PAT configured */}
              {showContent && !github.isConfigured() && !gitlab.isConfigured() && (
                <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                  <p className="text-sm text-muted-foreground">No Git provider configured.</p>
                  <p className="text-xs text-muted-foreground">Add a GitHub or GitLab token in Settings to use Git Sync.</p>
                  <a href="/app/settings" onClick={handleClose} className="text-sm text-primary hover:underline">Open Settings →</a>
                </div>
              )}

              {/* Loading */}
              {showContent && (github.isConfigured() || gitlab.isConfigured()) && syncMapping === undefined && (
                <p className="text-sm text-muted-foreground">Loading...</p>
              )}

              {/* ── INITIAL EXPORT (no mapping) ────────────────────────────── */}
              {showContent && (github.isConfigured() || gitlab.isConfigured()) && syncMapping === null && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Link blocks to a Git repository. They'll be exported as Markdown files and can be synced across devices.
                  </p>

                  <div className="space-y-2">
                    <Label>Blocks to export</Label>
                    {sessionId ? (
                      <div className="border border-border rounded-md p-3">
                        <SessionBlockPicker
                          session={{ _id: sessionId }}
                          excludeIds={new Set()}
                          selectedIds={exportSelectedIds.current}
                          onToggle={handleExportToggle}
                          onBulkToggle={handleExportBulkToggle}
                          onBlockData={handleExportBlockData}
                        />
                      </div>
                    ) : (
                      <ProjectBlockList
                        projectId={projectId as Id<"projects">}
                        excludeIds={new Set()}
                        selectedIds={exportSelectedIds.current}
                        onToggle={handleExportToggle}
                        onBulkToggle={handleExportBulkToggle}
                        onBlockData={handleExportBlockData}
                      />
                    )}
                  </div>

                  <ProviderSelector provider={exportProvider} setProvider={(p) => {
                    setExportProvider(p)
                    setExportBranch(p === "github" ? "main" : "master")
                    setExportRepoUrl(getProviderSettings(p).getDefaultRepoUrl())
                    setExportFolder(getProviderSettings(p).getDefaultFolder())
                  }} />
                  <RepoFormFields
                    provider={exportProvider}
                    repoUrl={exportRepoUrl} setRepoUrl={setExportRepoUrl}
                    folder={exportFolder} setFolder={setExportFolder}
                    branch={exportBranch} setBranch={setExportBranch}
                    idPrefix="export"
                  />

                  {exportError && <p className="text-sm text-red-600 dark:text-red-400">{exportError}</p>}

                  <div className="flex justify-end items-center pt-1">
                    <Button onClick={handleInitialExport} disabled={isExporting || exportSelectedCount === 0}>
                      {isExporting ? "Exporting..." : exportSelectedCount > 0 ? `Export & link (${exportSelectedCount})` : "Export & link"}
                    </Button>
                  </div>
                </div>
              )}


              {/* ── TAB: SYNCED FILES ──────────────────────────────────────── */}
              {hasTabs && activeTab === "sync" && (
                <div className="space-y-3">
                  {/* PAT missing for current provider */}
                  {!getProviderSettings(syncMapping.provider).getPat() && (
                    <div className="flex items-center justify-between gap-3 rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-3 py-2">
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        {syncMapping.provider === "github" ? "GitHub" : "GitLab"} token is not configured — sync actions will fail.
                      </p>
                      <a href="/app/settings" onClick={handleClose} className="text-xs text-amber-700 dark:text-amber-400 hover:underline shrink-0">Open Settings →</a>
                    </div>
                  )}
                  {/* Repo info + Check button */}
                  <div className="flex items-center justify-between gap-3">
                    {(() => {
                      const lastSyncedAt = syncMapping.lastSyncedAt
                        ?? (syncMapping.blocks.length > 0
                          ? Math.max(...syncMapping.blocks.map((b) => b.syncedAt ?? 0)) || undefined
                          : undefined)
                      return (
                        <p className="text-xs text-muted-foreground truncate">
                          {syncMapping.provider === "github" ? "GitHub" : "GitLab"}: {syncMapping.repoUrl}
                          {syncMapping.branch ? ` · ${syncMapping.branch}` : ""}
                          {lastSyncedAt && (
                            <span title={new Date(lastSyncedAt).toLocaleString()}>
                              {" · "}synced {formatSyncedAt(lastSyncedAt)}
                            </span>
                          )}
                        </p>
                      )
                    })()}
                    <Button size="sm" variant="outline" onClick={handleCheck} disabled={isChecking || isBlocksLoading} className="shrink-0">
                      {isChecking ? "Checking…" : "Check for updates"}
                    </Button>
                  </div>

                  {checkError && <p className="text-sm text-red-600 dark:text-red-400">{checkError}</p>}

                  {result !== null && (pendingChanges > 0 || pendingNotFound > 0) && (
                    <p className="text-xs text-muted-foreground">
                      {pendingChanges > 0 && <span>{pendingChanges} block{pendingChanges !== 1 ? "s" : ""} changed</span>}
                      {pendingChanges > 0 && pendingNotFound > 0 && <span> · </span>}
                      {pendingNotFound > 0 && <span>{pendingNotFound} not found in repo</span>}
                    </p>
                  )}
                  {result !== null && pendingChanges === 0 && pendingNotFound === 0 && (
                    <p className="text-xs text-muted-foreground">Everything is up to date.</p>
                  )}
                  {addExportSuccess && <p className="text-xs text-green-600 dark:text-green-400">Blocks exported and linked.</p>}

                  {syncMapping.blocks.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">
                      {sessionId ? "No blocks from this session are linked yet." : "No blocks linked to this repo yet."}
                    </p>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                        {syncMapping.blocks.length} file{syncMapping.blocks.length !== 1 ? "s" : ""}
                      </p>
                      {syncMapping.blocks.map((sb) => {
                        const blockId = sb.blockId as string
                        const block = convexByBlockId.get(blockId)
                        const blockTitle = block ? extractBlockTitle(block.content, block.type, 0) : null
                        const change = changesByBlockId.get(blockId)
                        const isNotFound = notFoundPaths.has(sb.path) && !reexportResults.has(sb.path)
                        const pushResult = reexportResults.get(sb.path)
                        const isDeleted = !block
                        const isExpanded = expandedDiffs.has(blockId)
                        const isLocallyModified = !isDeleted && !isNotFound && !change &&
                          (sb.syncedContentHash
                            ? block.contentHash !== sb.syncedContentHash
                            : block.updatedAt > (sb.syncedAt ?? 0))

                        let icon = <span className="shrink-0 text-green-500 text-sm">✓</span>
                        if (isNotFound) icon = <span className="shrink-0 text-yellow-500 text-sm" title="Not found in repo">⚠</span>
                        else if (change) icon = <span className="shrink-0 text-blue-500 text-sm" title="Changed in repo">↕</span>
                        else if (isLocallyModified) icon = <span className="shrink-0 text-amber-500 text-sm" title="Edited locally, not yet pushed">✎</span>

                        return (
                          <div key={blockId} className="rounded-md border border-border px-3 py-2.5">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0 space-y-0.5">
                                <div className="flex items-center gap-2 min-w-0">
                                  {icon}
                                  <span className="text-xs text-muted-foreground truncate font-mono">{sb.path}</span>
                                </div>
                                <div className="pl-5 text-xs text-muted-foreground">
                                  {isDeleted ? <span className="italic text-red-400">Block deleted</span> : <span className="truncate">{blockTitle}</span>}
                                  {!sessionId && block && (
                                    <button onClick={() => handleOpenBlock(block.sessionId, blockId)} className="ml-1 opacity-60 hover:opacity-100 hover:text-primary transition-opacity">
                                      · open block
                                    </button>
                                  )}
                                  {isLocallyModified && <span className="ml-1 text-amber-600 dark:text-amber-400">· edited locally</span>}
                                  {isNotFound && <span className="ml-1 text-yellow-600 dark:text-yellow-400">· not found in repo</span>}
                                  {change && !isExpanded && <span className="ml-1 text-blue-600 dark:text-blue-400">· changed in repo</span>}
                                  {pushResult && (
                                    <span className="ml-1">
                                      · pushed to <span className="font-medium">{pushResult.branch}</span>
                                      {" · "}
                                      <a href={pushResult.commitUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">view commit</a>
                                    </span>
                                  )}
                                </div>
                                {reexportError?.blockId === blockId && <p className="pl-5 text-xs text-red-500">{reexportError.message}</p>}
                              </div>
                              <div className="flex items-center gap-2 shrink-0 mt-0.5">
                                {change && (
                                  <>
                                    <button
                                      onClick={() => setExpandedDiffs((prev) => { const next = new Set(prev); isExpanded ? next.delete(blockId) : next.add(blockId); return next })}
                                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                      {isExpanded ? "Hide diff" : "Show diff"}
                                    </button>
                                    <Button size="sm" variant="outline" className="h-6 px-2 text-xs" disabled={rejecting === blockId} onClick={() => handleReject(change)}>
                                      {rejecting === blockId ? "…" : "Reject"}
                                    </Button>
                                    <Button size="sm" className="h-6 px-2 text-xs" disabled={accepting === blockId} onClick={() => handleAccept(change)}>
                                      {accepting === blockId ? "…" : "Accept"}
                                    </Button>
                                  </>
                                )}
                                {isLocallyModified && (
                                  <button onClick={() => handleReexport(blockId, sb.path)} disabled={reexporting === blockId} className="text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 disabled:opacity-50 transition-colors">
                                    {reexporting === blockId ? "Pushing…" : "Push"}
                                  </button>
                                )}
                                {isNotFound && !isDeleted && (
                                  <button onClick={() => handleReexport(blockId, sb.path)} disabled={reexporting === blockId} className="text-xs text-yellow-600 dark:text-yellow-400 hover:text-yellow-700 dark:hover:text-yellow-300 disabled:opacity-50 transition-colors">
                                    {reexporting === blockId ? "Pushing…" : "Re-export"}
                                  </button>
                                )}
                                <button onClick={() => handleRemove(blockId)} disabled={removing === blockId} className="text-xs text-muted-foreground hover:text-red-500 disabled:opacity-50 transition-colors" title="Remove from sync">
                                  {removing === blockId ? "…" : "Remove"}
                                </button>
                              </div>
                            </div>
                            {change && isExpanded && <DiffView before={change.currentContent} after={change.remoteContent} />}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB: ADD BLOCKS ───────────────────────────────────────── */}
              {hasTabs && activeTab === "add" && (
                <div className="space-y-4">
                  {sessionId ? (
                    <div className="border border-border rounded-md p-3">
                      <SessionBlockPicker
                        session={{ _id: sessionId }}
                        excludeIds={syncedExcludeIds}
                        selectedIds={addSelectedIds.current}
                        onToggle={handleAddToggle}
                        onBulkToggle={handleAddBulkToggle}
                        onBlockData={handleAddBlockData}
                      />
                    </div>
                  ) : (
                    <ProjectBlockList
                      projectId={projectId as Id<"projects">}
                      excludeIds={syncedExcludeIds}
                      selectedIds={addSelectedIds.current}
                      onToggle={handleAddToggle}
                      onBulkToggle={handleAddBulkToggle}
                      onBlockData={handleAddBlockData}
                    />
                  )}
                  {addExportError && <p className="text-sm text-red-600 dark:text-red-400">{addExportError}</p>}
                  <div className="flex justify-end">
                    <Button onClick={handleAddBlocks} disabled={isAddExporting || addSelectedCount === 0}>
                      {isAddExporting ? "Exporting..." : addSelectedCount > 0 ? `Export & link (${addSelectedCount})` : "Export & link"}
                    </Button>
                  </div>
                </div>
              )}

              {/* ── TAB: REPOSITORY SETTINGS ──────────────────────────────── */}
              {hasTabs && activeTab === "settings" && (
                <div className="space-y-4">
                  {/* Current binding (read-only) */}
                  <div className="rounded-md border border-border bg-muted/30 px-4 py-3 space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Current binding</p>
                    <p className="text-sm font-medium">{syncMapping.provider === "github" ? "GitHub" : "GitLab"}</p>
                    <p className="text-xs text-muted-foreground break-all">{syncMapping.repoUrl}</p>
                    <p className="text-xs text-muted-foreground">
                      branch: <span className="font-mono">{syncMapping.branch}</span>
                      {syncMapping.folder && <> · folder: <span className="font-mono">{syncMapping.folder}</span></>}
                    </p>
                  </div>

                  <p className="text-xs text-muted-foreground">Change repository:</p>

                  <ProviderSelector provider={settingsProvider} setProvider={(p) => {
                    setSettingsProvider(p)
                    if (p === syncMapping.provider) {
                      setSettingsRepoUrl(syncMapping.repoUrl)
                      setSettingsBranch(syncMapping.branch)
                      setSettingsFolder(syncMapping.folder)
                    } else {
                      setSettingsBranch(p === "github" ? "main" : "master")
                      setSettingsRepoUrl(getProviderSettings(p).getDefaultRepoUrl())
                      setSettingsFolder(getProviderSettings(p).getDefaultFolder())
                    }
                  }} />
                  <RepoFormFields
                    provider={settingsProvider}
                    repoUrl={settingsRepoUrl} setRepoUrl={setSettingsRepoUrl}
                    folder={settingsFolder} setFolder={setSettingsFolder}
                    branch={settingsBranch} setBranch={setSettingsBranch}
                    idPrefix="settings"
                  />
                  {settingsError && <p className="text-sm text-red-600 dark:text-red-400">{settingsError}</p>}
                  {settingsSaved && <p className="text-sm text-green-600 dark:text-green-400">Saved.</p>}
                  <div className="flex justify-end">
                    <Button onClick={handleSaveSettings} disabled={isSavingSettings}>
                      {isSavingSettings ? "Pushing files..." : "Save & push"}
                    </Button>
                  </div>
                </div>
              )}

            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
