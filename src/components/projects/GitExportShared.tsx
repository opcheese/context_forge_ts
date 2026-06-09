import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { GitProviderType } from "@/lib/git-export/adapter"

const CONTEXT_MODE_BADGE: Record<string, { label: string; className: string }> = {
  draft: {
    label: "draft",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  },
  validation: {
    label: "criteria",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300",
  },
}

export function ContextModeBadge({ contextMode }: { contextMode?: string }) {
  if (!contextMode || contextMode === "default") return null
  const badge = CONTEXT_MODE_BADGE[contextMode]
  if (!badge) return null
  return (
    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${badge.className}`}>
      {badge.label}
    </span>
  )
}

export function ProviderSelector({
  provider,
  setProvider,
}: {
  provider: GitProviderType
  setProvider: (p: GitProviderType) => void
}) {
  return (
    <div className="flex gap-2">
      {(["github", "gitlab"] as GitProviderType[]).map((p) => (
        <button
          key={p}
          onClick={() => setProvider(p)}
          className={`flex-1 py-1.5 text-sm rounded-md border transition-colors ${
            provider === p
              ? "border-primary bg-primary/10 text-primary font-medium"
              : "border-border text-muted-foreground hover:border-foreground/30"
          }`}
        >
          {p === "github" ? "GitHub" : "GitLab"}
        </button>
      ))}
    </div>
  )
}

export function RepoFormFields({
  provider,
  repoUrl,
  setRepoUrl,
  folder,
  setFolder,
  branch,
  setBranch,
  idPrefix,
}: {
  provider: GitProviderType
  repoUrl: string
  setRepoUrl: (v: string) => void
  folder: string
  setFolder: (v: string) => void
  branch: string
  setBranch: (v: string) => void
  idPrefix: string
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-repo`}>Repository URL</Label>
        <Input
          id={`${idPrefix}-repo`}
          placeholder={
            provider === "github"
              ? "https://github.com/your-org/project-reviews"
              : "https://gitlab.com/your-org/project-reviews"
          }
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-folder`}>Folder in repo</Label>
          <Input
            id={`${idPrefix}-folder`}
            placeholder="team-reviews/q2"
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-branch`}>Branch</Label>
          <Input
            id={`${idPrefix}-branch`}
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
          />
        </div>
      </div>
    </div>
  )
}

export function ExportSuccessView({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div className="space-y-4">
      <div className="rounded-md bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-4">
        <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">
          Exported successfully!
        </p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary hover:underline break-all"
        >
          {url}
        </a>
      </div>
      <Button variant="outline" className="w-full" onClick={onClose}>
        Close
      </Button>
    </div>
  )
}
