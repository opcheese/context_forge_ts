import { useState, useEffect } from "react"
import { useQuery, useMutation } from "convex/react"
import { getProviderSettings, pushWithProvider } from "./adapter"
import type { GitProviderType } from "./adapter"
import { renderAnchorJson } from "./markdown"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"

export function useGitExportForm({
  projectId,
  onClose,
}: {
  projectId?: string
  onClose: () => void
}) {
  const [provider, setProvider] = useState<GitProviderType>("github")
  const [repoUrl, setRepoUrl] = useState(() => {
    const s = getProviderSettings("github")
    return projectId ? s.getProjectRepoUrl(projectId) : s.getDefaultRepoUrl()
  })
  const [folder, setFolder] = useState(() => {
    const s = getProviderSettings("github")
    return projectId ? s.getProjectFolder(projectId) : s.getDefaultFolder()
  })
  const [branch, setBranch] = useState("main")
  const [isLoading, setIsLoading] = useState(false)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const settings = getProviderSettings(provider)

  const syncMapping = useQuery(
    api.syncMappings.getSyncMapping,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip"
  )
  const upsertSyncMapping = useMutation(api.syncMappings.upsertSyncMapping)
  const upsertSyncBlock = useMutation(api.syncMappings.upsertSyncBlock)

  useEffect(() => {
    const s = getProviderSettings(provider)
    setRepoUrl(projectId ? s.getProjectRepoUrl(projectId) : s.getDefaultRepoUrl())
    setFolder(projectId ? s.getProjectFolder(projectId) : s.getDefaultFolder())
    setBranch(provider === "github" ? "main" : "master")
  }, [provider, projectId])

  const exportFiles = async (
    files: { path: string; content: string; blockId: string }[],
    commitMessage: string
  ) => {
    const pat = settings.getPat()
    if (!pat) {
      setError(
        `${provider === "github" ? "GitHub" : "GitLab"} token not configured. Set it in Settings → Git Integration.`
      )
      return
    }
    if (!repoUrl.trim()) {
      setError("Repository URL is required.")
      return
    }
    if (files.length === 0) {
      setError("Select at least one block.")
      return
    }

    setIsLoading(true)
    setError(null)

    const effectiveBranch = branch.trim() || (provider === "github" ? "main" : "master")

    // For blocks already in Convex syncBlocks, use the canonical (stored) path
    const syncBlocksByBlockId = new Map(
      (syncMapping?.blocks ?? []).map((b) => [b.blockId as string, b.path])
    )
    const resolvedFiles = files.map((file) => {
      const canonicalPath = syncBlocksByBlockId.get(file.blockId)
      return canonicalPath ? { ...file, path: canonicalPath } : file
    })

    // Build anchor files for .contextforge/meta/
    const now = new Date().toISOString()
    const anchorFiles = resolvedFiles.map((file) => ({
      path: `.contextforge/meta/${file.blockId}.json`,
      content: renderAnchorJson({ blockId: file.blockId, path: file.path, exportedAt: now }),
    }))

    try {
      const result = await pushWithProvider(provider, {
        repoUrl: repoUrl.trim(),
        pat,
        branch: effectiveBranch,
        files: [
          ...resolvedFiles.map((f) => ({ path: f.path, content: f.content })),
          ...anchorFiles,
        ],
        commitMessage,
      })

      if (projectId) {
        settings.setProjectRepoUrl(projectId, repoUrl.trim())
        settings.setProjectFolder(projectId, folder)

        const mappingId = await upsertSyncMapping({
          projectId: projectId as Id<"projects">,
          provider,
          repoUrl: repoUrl.trim(),
          branch: effectiveBranch,
          folder,
        })

        for (const file of resolvedFiles) {
          await upsertSyncBlock({
            syncMappingId: mappingId,
            blockId: file.blockId as Id<"blocks">,
            path: file.path,
          })
        }
      }

      setResultUrl(result.repoUrl)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    setResultUrl(null)
    setError(null)
    onClose()
  }

  return {
    provider,
    setProvider,
    repoUrl,
    setRepoUrl,
    folder,
    setFolder,
    branch,
    setBranch,
    isLoading,
    resultUrl,
    error,
    exportFiles,
    handleClose,
  }
}
