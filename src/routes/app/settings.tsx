/**
 * Settings page for configuring LLM providers.
 */

import { useState, useEffect } from "react"
import { useQuery } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { createFileRoute } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import { DebouncedButton } from "@/components/ui/debounced-button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { openrouter, ollama, routerai } from "@/lib/llm"
import { openrouter as openrouterSettings, ollama as ollamaSettings, compression as compressionSettings, routerai as routeraiSettings, type CompressionProvider } from "@/lib/llm/settings"
import { github as githubSettings, gitlab as gitlabSettings } from "@/lib/git-export/settings"
import { checkConnection as ghCheckConnection, checkRepo as ghCheckRepo } from "@/lib/git-export/github"
import { checkConnection as glCheckConnection, checkRepo as glCheckRepo } from "@/lib/git-export/gitlab"

type HealthState = "idle" | "checking" | "ok" | "error"

function StatusDot({ status }: { status: HealthState }) {
  if (status === "idle") return null
  if (status === "checking") return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="w-2 h-2 rounded-full bg-muted-foreground animate-pulse" />
      Checking...
    </span>
  )
  if (status === "ok") return (
    <span className="inline-flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
      <span className="w-2 h-2 rounded-full bg-green-500" />
      Connected
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
      <span className="w-2 h-2 rounded-full bg-red-500" />
      Offline
    </span>
  )
}

// Helper to get initial masked API key
function getInitialApiKeyDisplay(): string {
  const key = openrouterSettings.getApiKey()
  return key ? "sk-****" + key.slice(-4) : ""
}

function OpenRouterSettings() {
  const [apiKey, setApiKey] = useState(getInitialApiKeyDisplay)
  const [model, setModel] = useState(() => openrouterSettings.getModel())
  const [isSaving, setIsSaving] = useState(false)
  const [saveResult, setSaveResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [savedApiKey, setSavedApiKey] = useState(getInitialApiKeyDisplay)
  const [savedModel, setSavedModel] = useState(() => openrouterSettings.getModel())
  const [health, setHealth] = useState<HealthState>(() =>
    openrouterSettings.getApiKey() ? "checking" : "idle"
  )

  const hasChanges = apiKey !== savedApiKey || model !== savedModel

  useEffect(() => { setSaveResult(null) }, [apiKey, model])

  useEffect(() => {
    if (!openrouterSettings.getApiKey()) return
    openrouter.checkHealth().then((r) => setHealth(r.ok ? "ok" : "error"))
  }, [])

  const handleSave = async () => {
    setIsSaving(true)
    setSaveResult(null)
    const keyToTest = apiKey.startsWith("sk-****") ? undefined : apiKey
    const result = await openrouter.checkHealth(keyToTest, model)
    if (!result.ok) {
      setIsSaving(false)
      setHealth("error")
      setSaveResult({ ok: false, message: result.error || "Connection failed" })
      return
    }
    if (apiKey && !apiKey.startsWith("sk-****")) {
      openrouterSettings.setApiKey(apiKey)
    }
    openrouterSettings.setModel(model)
    setSavedApiKey(apiKey)
    setSavedModel(model)
    setIsSaving(false)
    setHealth("ok")
    setSaveResult({ ok: true, message: "Saved!" })
    setTimeout(() => setSaveResult(null), 2000)
  }

  const handleClear = () => {
    openrouterSettings.clearApiKey()
    setApiKey("")
    setSavedApiKey("")
    setHealth("idle")
    setSaveResult(null)
  }

  return (
    <div className="rounded-lg border border-border p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">OpenRouter</h3>
          <p className="text-sm text-muted-foreground">
            Access Claude, GPT-4, Llama, and 100+ models via unified API
          </p>
        </div>
        <StatusDot status={health} />
      </div>

      <div className="grid gap-4">
        <div className="space-y-2">
          <Label htmlFor="openrouter-key">API Key</Label>
          <div className="flex gap-2">
            <Input
              id="openrouter-key"
              type="text"
              autoComplete="off"
              placeholder="sk-or-v1-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="flex-1 font-mono text-sm"
            />
            <Button variant="outline" size="sm" onClick={handleClear}>
              Clear
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Get your API key from{" "}
            <a
              href="https://openrouter.ai/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              openrouter.ai/keys
            </a>
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="openrouter-model">Model</Label>
          <Input
            id="openrouter-model"
            placeholder="anthropic/claude-sonnet-4"
            value={model}
            onChange={(e) => setModel(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            See{" "}
            <a
              href="https://openrouter.ai/models"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              available models
            </a>
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-2">
        <DebouncedButton onClick={handleSave} disabled={!hasChanges || isSaving} debounceMs={500}>
          {isSaving ? "Saving..." : "Save"}
        </DebouncedButton>
        {saveResult && (
          <span className={saveResult.ok ? "text-sm text-green-600 dark:text-green-400" : "text-sm text-red-600 dark:text-red-400"}>
            {saveResult.message}
          </span>
        )}
      </div>
    </div>
  )
}

function RouterAISettings() {
  const initialKey = () => { const s = routeraiSettings.getApiKey(); return s ? "sk-****" + s.slice(-4) : "" }
  const [apiKey, setApiKey] = useState(initialKey)
  const [baseUrl, setBaseUrl] = useState(() => routeraiSettings.getBaseUrl())
  const [model, setModel] = useState(() => routeraiSettings.getModel())
  const [isSaving, setIsSaving] = useState(false)
  const [saveResult, setSaveResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [savedApiKey, setSavedApiKey] = useState(initialKey)
  const [savedBaseUrl, setSavedBaseUrl] = useState(() => routeraiSettings.getBaseUrl())
  const [savedModel, setSavedModel] = useState(() => routeraiSettings.getModel())
  const [health, setHealth] = useState<HealthState>(() =>
    routeraiSettings.getApiKey() ? "checking" : "idle"
  )

  const hasChanges = apiKey !== savedApiKey || baseUrl !== savedBaseUrl || model !== savedModel

  useEffect(() => { setSaveResult(null) }, [apiKey, baseUrl, model])

  useEffect(() => {
    if (!routeraiSettings.getApiKey()) return
    routerai.checkHealth().then((r) => setHealth(r.ok ? "ok" : "error"))
  }, [])

  const handleSave = async () => {
    setIsSaving(true)
    setSaveResult(null)
    const keyToTest = apiKey.startsWith("sk-****") ? undefined : apiKey
    const result = await routerai.checkHealth(keyToTest, model)
    if (!result.ok) {
      setIsSaving(false)
      setHealth("error")
      setSaveResult({ ok: false, message: result.error || "Connection failed" })
      return
    }
    if (apiKey && !apiKey.startsWith("sk-****")) {
      routeraiSettings.setApiKey(apiKey)
    }
    routeraiSettings.setBaseUrl(baseUrl)
    routeraiSettings.setModel(model)
    setSavedApiKey(apiKey)
    setSavedBaseUrl(baseUrl)
    setSavedModel(model)
    setIsSaving(false)
    setHealth("ok")
    setSaveResult({ ok: true, message: "Saved!" })
    setTimeout(() => setSaveResult(null), 2000)
  }

  const handleClear = () => {
    routeraiSettings.clearApiKey()
    setApiKey("")
    setSavedApiKey("")
    setHealth("idle")
    setSaveResult(null)
  }

  return (
    <div className="rounded-lg border border-border p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">RouterAI</h3>
          <p className="text-sm text-muted-foreground">
            OpenAI-compatible model gateway with configurable tenant base URL
          </p>
        </div>
        <StatusDot status={health} />
      </div>

      <div className="grid gap-4">
        <div className="space-y-2">
          <Label htmlFor="routerai-key">API Key</Label>
          <div className="flex gap-2">
            <Input
              id="routerai-key"
              type="text"
              autoComplete="off"
              placeholder="sk-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="flex-1 font-mono text-sm"
            />
            <Button variant="outline" size="sm" onClick={handleClear}>
              Clear
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Get your API key from{" "}
            <a
              href="https://routerai.ru/settings/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              routerai.ru/settings/keys
            </a>
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="routerai-base-url">API Base URL</Label>
          <Input
            id="routerai-base-url"
            placeholder="https://routerai.ru/api/v1"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Default: https://routerai.ru/api/v1. Change only if connecting to a different RouterAI server
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="routerai-model">Model</Label>
          <Input
            id="routerai-model"
            placeholder="openai/gpt-4o-mini"
            value={model}
            onChange={(e) => setModel(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            See{" "}
            <a
              href="https://routerai.ru/models"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              available models
            </a>
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-2">
        <DebouncedButton onClick={handleSave} disabled={!hasChanges || isSaving} debounceMs={500}>
          {isSaving ? "Saving..." : "Save"}
        </DebouncedButton>
        {saveResult && (
          <span className={saveResult.ok ? "text-sm text-green-600 dark:text-green-400" : "text-sm text-red-600 dark:text-red-400"}>
            {saveResult.message}
          </span>
        )}
      </div>
    </div>
  )
}

function OllamaSettings() {
  const [url, setUrl] = useState(() => ollamaSettings.getUrl())
  const [model, setModel] = useState(() => ollamaSettings.getModel())
  const [isSaving, setIsSaving] = useState(false)
  const [saveResult, setSaveResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [savedUrl, setSavedUrl] = useState(() => ollamaSettings.getUrl())
  const [savedModel, setSavedModel] = useState(() => ollamaSettings.getModel())
  const [health, setHealth] = useState<HealthState>("checking")

  const hasChanges = url !== savedUrl || model !== savedModel

  useEffect(() => { setSaveResult(null) }, [url, model])

  useEffect(() => {
    const check = async () => {
      const result = await ollama.checkHealth()
      if (!result.ok) { setHealth("error"); return }
      try {
        const models = await ollama.listModels()
        const modelIds = models.map((m) => m.name)
        const normalizedModel = model.includes(":") ? model : `${model}:latest`
        if (modelIds.length > 0 && !modelIds.includes(model) && !modelIds.includes(normalizedModel)) {
          setHealth("error")
          return
        }
      } catch { /* skip model check if listing fails */ }
      setHealth("ok")
    }
    check()
  }, [])

  const handleSave = async () => {
    setIsSaving(true)
    setSaveResult(null)
    setHealth("checking")
    const result = await ollama.checkHealth(url)
    if (!result.ok) {
      setIsSaving(false)
      setHealth("error")
      setSaveResult({ ok: false, message: result.error || "Connection failed" })
      return
    }
    // Validate model exists in Ollama
    try {
      const models = await ollama.listModels(url)
      const modelIds = models.map((m) => m.name)
      const normalizedModel = model.includes(":") ? model : `${model}:latest`
      if (modelIds.length > 0 && !modelIds.includes(model) && !modelIds.includes(normalizedModel)) {
        setIsSaving(false)
        setHealth("error")
        setSaveResult({ ok: false, message: `Model "${model}" not found. Run: ollama pull ${model}` })
        return
      }
    } catch {
      // If listing fails, skip model check
    }
    ollamaSettings.setUrl(url)
    ollamaSettings.setModel(model)
    setSavedUrl(url)
    setSavedModel(model)
    setIsSaving(false)
    setHealth("ok")
    setSaveResult({ ok: true, message: "Saved!" })
    setTimeout(() => setSaveResult(null), 2000)
  }

  return (
    <div className="rounded-lg border border-border p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Ollama</h3>
          <p className="text-sm text-muted-foreground">
            Run LLMs locally on your machine or network
          </p>
        </div>
        <StatusDot status={health} />
      </div>

      <div className="grid gap-4">
        <div className="space-y-2">
          <Label htmlFor="ollama-url">Server URL</Label>
          <Input
            id="ollama-url"
            placeholder="http://localhost:11434"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Default: http://localhost:11434. For network access, use your machine's IP address.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ollama-model">Model</Label>
          <Input
            id="ollama-model"
            placeholder="llama3.2:latest"
            value={model}
            onChange={(e) => setModel(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Run <code className="bg-muted px-1 rounded">ollama list</code> to see available models
          </p>
        </div>

        <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            <strong>CORS Required:</strong> To access Ollama from a browser, start it with:
          </p>
          <code className="block mt-1 text-xs bg-amber-100 dark:bg-amber-900/50 px-2 py-1 rounded">
            OLLAMA_ORIGINS="*" ollama serve
          </code>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-2">
        <DebouncedButton onClick={handleSave} disabled={!hasChanges || isSaving} debounceMs={500}>
          {isSaving ? "Saving..." : "Save"}
        </DebouncedButton>
        {saveResult && (
          <span className={saveResult.ok ? "text-sm text-green-600 dark:text-green-400" : "text-sm text-red-600 dark:text-red-400"}>
            {saveResult.message}
          </span>
        )}
      </div>
    </div>
  )
}

function ClaudeCodeSettings() {
  return (
    <div className="rounded-lg border border-border p-6 space-y-4 opacity-60">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Claude Code</h3>
          <p className="text-sm text-muted-foreground">
            Use Claude via local Claude Code CLI
          </p>
        </div>
        <span className="text-sm text-muted-foreground">Backend Only</span>
      </div>

      <p className="text-sm text-muted-foreground">
        Claude Code runs on the backend and requires the Claude CLI to be installed.
        No configuration needed here.
      </p>
    </div>
  )
}

function CompressionProviderSettings() {
  const features = useQuery(api.features.getFlags)
  const claudeCodeEnabled = features?.claudeCodeEnabled ?? false

  const [provider, setProvider] = useState<CompressionProvider>(() => compressionSettings.getProvider())
  const [saved, setSaved] = useState(false)

  // Auto-switch away from claude-code if it becomes disabled
  useEffect(() => {
    if (features !== undefined && !claudeCodeEnabled && provider === "claude-code") {
      handleProviderChange("openrouter")
    }
  }, [claudeCodeEnabled, features])

  const handleProviderChange = (value: CompressionProvider) => {
    setProvider(value)
    compressionSettings.setProvider(value)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const allProviders: Array<{ value: CompressionProvider; label: string; description: string }> = [
    {
      value: "claude-code",
      label: "Claude Code (Recommended)",
      description: "Uses Claude Code CLI on the backend (fastest, most reliable)",
    },
    {
      value: "openrouter",
      label: "OpenRouter",
      description: "Uses OpenRouter API (requires API key configuration above)",
    },
    {
      value: "routerai",
      label: "RouterAI",
      description: "Uses RouterAI API (requires API key configuration above)",
    },
    {
      value: "ollama",
      label: "Ollama",
      description: "Uses local Ollama server (requires Ollama setup above)",
    },
  ]

  const providers = claudeCodeEnabled
    ? allProviders
    : allProviders.filter((p) => p.value !== "claude-code")

  return (
    <div className="rounded-lg border border-border p-6 space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Compression Provider</h3>
        <p className="text-sm text-muted-foreground">
          Choose which LLM provider to use for block compression
        </p>
      </div>

      <div className="space-y-3">
        <Label>Provider</Label>
        {providers.map((p) => (
          <div key={p.value} className="flex items-start space-x-3">
            <input
              type="radio"
              id={`provider-${p.value}`}
              name="compression-provider"
              value={p.value}
              checked={provider === p.value}
              onChange={(e) => handleProviderChange(e.target.value as CompressionProvider)}
              className="mt-1"
            />
            <div className="flex-1">
              <label
                htmlFor={`provider-${p.value}`}
                className="text-sm font-medium cursor-pointer"
              >
                {p.label}
              </label>
              <p className="text-xs text-muted-foreground mt-0.5">
                {p.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      {saved && (
        <p className="text-sm text-green-600 dark:text-green-400">
          Compression provider saved!
        </p>
      )}
    </div>
  )
}

function GitHubSettings() {
  const [pat, setPat] = useState(() => {
    const stored = githubSettings.getPat()
    return stored ? "ghp_****" + stored.slice(-4) : ""
  })
  const [repoUrl, setRepoUrl] = useState(() => githubSettings.getDefaultRepoUrl())
  const [folder, setFolder] = useState(() => githubSettings.getDefaultFolder())
  const [isSaving, setIsSaving] = useState(false)
  const [saveResult, setSaveResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [savedPat, setSavedPat] = useState(() => {
    const stored = githubSettings.getPat()
    return stored ? "ghp_****" + stored.slice(-4) : ""
  })
  const [savedRepoUrl, setSavedRepoUrl] = useState(() => githubSettings.getDefaultRepoUrl())
  const [savedFolder, setSavedFolder] = useState(() => githubSettings.getDefaultFolder())
  const [health, setHealth] = useState<HealthState>(() => githubSettings.getPat() ? "checking" : "idle")
  const [login, setLogin] = useState<string | null>(null)

  const hasChanges = pat !== savedPat || repoUrl !== savedRepoUrl || folder !== savedFolder

  useEffect(() => {
    const storedPat = githubSettings.getPat()
    if (!storedPat) return
    const storedRepoUrl = githubSettings.getDefaultRepoUrl()
    ;(async () => {
      try {
        const { login: ghLogin } = await ghCheckConnection(storedPat)
        if (storedRepoUrl) await ghCheckRepo(storedPat, storedRepoUrl)
        setLogin(ghLogin)
        setHealth("ok")
      } catch {
        setHealth("error")
      }
    })()
  }, [])

  useEffect(() => { setSaveResult(null) }, [pat, repoUrl, folder])

  const handleSave = async () => {
    const currentPat = pat.startsWith("ghp_****") ? githubSettings.getPat() : pat
    if (!currentPat) return
    setIsSaving(true)
    setSaveResult(null)
    setHealth("checking")
    try {
      const { login: ghLogin } = await ghCheckConnection(currentPat)
      if (repoUrl) await ghCheckRepo(currentPat, repoUrl)
      if (pat && !pat.startsWith("ghp_****")) githubSettings.setPat(pat)
      githubSettings.setDefaultRepoUrl(repoUrl)
      githubSettings.setDefaultFolder(folder)
      setSavedPat(pat)
      setSavedRepoUrl(repoUrl)
      setSavedFolder(folder)
      setLogin(ghLogin)
      setHealth("ok")
      setSaveResult({ ok: true, message: "Saved!" })
      setTimeout(() => setSaveResult(null), 2000)
    } catch (e) {
      setHealth("error")
      setSaveResult({ ok: false, message: e instanceof Error ? e.message : String(e) })
    } finally {
      setIsSaving(false)
    }
  }

  const handleClear = () => {
    githubSettings.clearPat()
    setPat("")
    setSavedPat("")
    setHealth("idle")
    setLogin(null)
    setSaveResult(null)
  }

  return (
    <div className="rounded-lg border border-border p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">GitHub</h3>
          <p className="text-sm text-muted-foreground">
            Export and sync project results with a GitHub repository
          </p>
        </div>
        <div className="flex items-center gap-2">
          {health === "ok" && login && (
            <span className="text-xs text-muted-foreground">@{login}</span>
          )}
          <StatusDot status={health} />
        </div>
      </div>

      <div className="grid gap-4">
        <div className="space-y-2">
          <Label htmlFor="github-pat">Personal Access Token</Label>
          <div className="flex gap-2">
            <Input
              id="github-pat"
              type="text"
              autoComplete="off"
              placeholder="ghp_..."
              value={pat}
              onChange={(e) => setPat(e.target.value)}
              className="flex-1 font-mono text-sm"
            />
            <Button variant="outline" size="sm" onClick={handleClear}>
              Clear
            </Button>
          </div>
          <div className="rounded-md bg-muted/50 border border-border p-3 space-y-1.5 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">How to get a token:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>
                Go to{" "}
                <span className="font-mono bg-muted px-1 rounded">
                  github.com → Settings → Developer settings → Personal access tokens → Tokens (classic)
                </span>
              </li>
              <li>Click <span className="font-medium">Generate new token (classic)</span></li>
              <li>
                Select the{" "}
                <code className="bg-muted px-1 rounded font-mono">repo</code>{" "}
                scope — required for both private and public repositories
              </li>
              <li>Copy the token — it is shown only once</li>
            </ol>
            <p className="text-amber-600 dark:text-amber-400 font-medium">
              Use <span className="font-mono">Tokens (classic)</span>, not Fine-grained tokens
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="github-repo">Default Repository URL</Label>
          <Input
            id="github-repo"
            placeholder="https://github.com/your-org/project-reviews"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            If set, Save will also verify repository access.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="github-folder">Default Folder in Repo</Label>
          <Input
            id="github-folder"
            placeholder="docs/context-forge"
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Optional. Leave empty to put files in repo root.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-2">
        <DebouncedButton onClick={handleSave} disabled={!pat || !hasChanges || isSaving} debounceMs={500}>
          {isSaving ? "Saving..." : "Save"}
        </DebouncedButton>
        {saveResult && (
          <span className={saveResult.ok ? "text-sm text-green-600 dark:text-green-400" : "text-sm text-red-600 dark:text-red-400"}>
            {saveResult.message}
          </span>
        )}
      </div>
    </div>
  )
}

function GitLabSettings() {
  const [pat, setPat] = useState(() => {
    const stored = gitlabSettings.getPat()
    return stored ? "glpat-****" + stored.slice(-4) : ""
  })
  const [instanceUrl, setInstanceUrl] = useState(() => gitlabSettings.getInstanceUrl())
  const [repoUrl, setRepoUrl] = useState(() => gitlabSettings.getDefaultRepoUrl())
  const [folder, setFolder] = useState(() => gitlabSettings.getDefaultFolder())
  const [isSaving, setIsSaving] = useState(false)
  const [saveResult, setSaveResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [savedPat, setSavedPat] = useState(() => {
    const stored = gitlabSettings.getPat()
    return stored ? "glpat-****" + stored.slice(-4) : ""
  })
  const [savedInstanceUrl, setSavedInstanceUrl] = useState(() => gitlabSettings.getInstanceUrl())
  const [savedRepoUrl, setSavedRepoUrl] = useState(() => gitlabSettings.getDefaultRepoUrl())
  const [savedFolder, setSavedFolder] = useState(() => gitlabSettings.getDefaultFolder())
  const [health, setHealth] = useState<HealthState>(() => gitlabSettings.getPat() ? "checking" : "idle")
  const [login, setLogin] = useState<string | null>(null)

  const hasChanges =
    pat !== savedPat ||
    instanceUrl !== savedInstanceUrl ||
    repoUrl !== savedRepoUrl ||
    folder !== savedFolder

  useEffect(() => {
    const storedPat = gitlabSettings.getPat()
    if (!storedPat) return
    const storedInstanceUrl = gitlabSettings.getInstanceUrl()
    const storedRepoUrl = gitlabSettings.getDefaultRepoUrl()
    ;(async () => {
      try {
        const { login: glLogin } = await glCheckConnection(storedPat, storedInstanceUrl)
        if (storedRepoUrl) await glCheckRepo(storedPat, storedRepoUrl)
        setLogin(glLogin)
        setHealth("ok")
      } catch {
        setHealth("error")
      }
    })()
  }, [])

  useEffect(() => { setSaveResult(null) }, [pat, instanceUrl, repoUrl, folder])

  const handleSave = async () => {
    const currentPat = pat.startsWith("glpat-****") ? gitlabSettings.getPat() : pat
    if (!currentPat) return
    setIsSaving(true)
    setSaveResult(null)
    setHealth("checking")
    try {
      const { login: glLogin } = await glCheckConnection(currentPat, instanceUrl)
      if (repoUrl) await glCheckRepo(currentPat, repoUrl)
      if (pat && !pat.startsWith("glpat-****")) gitlabSettings.setPat(pat)
      gitlabSettings.setInstanceUrl(instanceUrl)
      gitlabSettings.setDefaultRepoUrl(repoUrl)
      gitlabSettings.setDefaultFolder(folder)
      setSavedPat(pat)
      setSavedInstanceUrl(instanceUrl)
      setSavedRepoUrl(repoUrl)
      setSavedFolder(folder)
      setLogin(glLogin)
      setHealth("ok")
      setSaveResult({ ok: true, message: "Saved!" })
      setTimeout(() => setSaveResult(null), 2000)
    } catch (e) {
      setHealth("error")
      setSaveResult({ ok: false, message: e instanceof Error ? e.message : String(e) })
    } finally {
      setIsSaving(false)
    }
  }

  const handleClear = () => {
    gitlabSettings.clearPat()
    setPat("")
    setSavedPat("")
    setHealth("idle")
    setLogin(null)
    setSaveResult(null)
  }

  return (
    <div className="rounded-lg border border-border p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">GitLab</h3>
          <p className="text-sm text-muted-foreground">
            Export and sync project results with a GitLab repository
          </p>
        </div>
        <div className="flex items-center gap-2">
          {health === "ok" && login && (
            <span className="text-xs text-muted-foreground">@{login}</span>
          )}
          <StatusDot status={health} />
        </div>
      </div>

      <div className="grid gap-4">
        <div className="space-y-2">
          <Label htmlFor="gitlab-pat">Personal Access Token</Label>
          <div className="flex gap-2">
            <Input
              id="gitlab-pat"
              type="text"
              autoComplete="off"
              placeholder="glpat-..."
              value={pat}
              onChange={(e) => setPat(e.target.value)}
              className="flex-1 font-mono text-sm"
            />
            <Button variant="outline" size="sm" onClick={handleClear}>
              Clear
            </Button>
          </div>
          <div className="rounded-md bg-muted/50 border border-border p-3 space-y-1.5 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">How to get a token:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>
                Go to{" "}
                <span className="font-mono bg-muted px-1 rounded">
                  gitlab.com → top-right avatar → Edit profile → Access Tokens
                </span>
              </li>
              <li>Click <span className="font-medium">Add new token</span></li>
              <li>
                Select scope{" "}
                <code className="bg-muted px-1 rounded font-mono">api</code>
                {" "}— required for reading and writing files
              </li>
              <li>Copy the token — it is shown only once</li>
            </ol>
            <p className="text-amber-600 dark:text-amber-400 font-medium">
              For self-hosted GitLab — use your instance URL below, the steps are the same
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="gitlab-instance">Instance URL</Label>
          <Input
            id="gitlab-instance"
            placeholder="https://gitlab.com"
            value={instanceUrl}
            onChange={(e) => setInstanceUrl(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Change this for self-hosted GitLab instances.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="gitlab-repo">Default Repository URL</Label>
          <Input
            id="gitlab-repo"
            placeholder="https://gitlab.com/your-org/project-reviews"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            If set, Save will also verify repository access.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="gitlab-folder">Default Folder in Repo</Label>
          <Input
            id="gitlab-folder"
            placeholder="docs/context-forge"
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Optional. Leave empty to put files in repo root.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-2">
        <DebouncedButton onClick={handleSave} disabled={!pat || !hasChanges || isSaving} debounceMs={500}>
          {isSaving ? "Saving..." : "Save"}
        </DebouncedButton>
        {saveResult && (
          <span className={saveResult.ok ? "text-sm text-green-600 dark:text-green-400" : "text-sm text-red-600 dark:text-red-400"}>
            {saveResult.message}
          </span>
        )}
      </div>
    </div>
  )
}

function AccountSettings() {
  const user = useQuery(api.users.me)

  return (
    <div className="rounded-lg border border-border p-6 space-y-3">
      <div>
        <h3 className="text-lg font-semibold">Account</h3>
        <p className="text-sm text-muted-foreground">Your registered account information</p>
      </div>
      {user === undefined ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : user === null ? (
        <p className="text-sm text-muted-foreground">Not signed in</p>
      ) : (
        <div className="space-y-1 text-sm">
          <p><span className="text-muted-foreground">Email:</span> {user.email ?? "—"}</p>
          {user.name && <p><span className="text-muted-foreground">Name:</span> {user.name}</p>}
        </div>
      )}
    </div>
  )
}

const NAV_SECTIONS = [
  { id: "account", label: "Account" },
  { id: "llm", label: "LLM Providers" },
  { id: "compression", label: "Compression" },
  { id: "git", label: "Git Integration" },
] as const

function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Configure providers, integrations, and account
        </p>
      </div>

      <nav className="flex gap-1 flex-wrap border-b border-border pb-3">
        {NAV_SECTIONS.map(({ id, label }) => (
          <a
            key={id}
            href={`#${id}`}
            className="px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            {label}
          </a>
        ))}
      </nav>

      <div id="account" className="scroll-mt-20">
        <AccountSettings />
      </div>

      <div id="llm" className="space-y-4 scroll-mt-20">
        <h2 className="text-xl font-semibold">LLM Providers</h2>
        <p className="text-sm text-muted-foreground">
          API keys and settings are stored locally in your browser. They are never sent to our servers.
        </p>
        <div className="grid gap-4">
          <OpenRouterSettings />
          <RouterAISettings />
          <OllamaSettings />
          <ClaudeCodeSettings />
        </div>
      </div>

      <div id="compression" className="space-y-4 scroll-mt-20">
        <h2 className="text-xl font-semibold">Compression</h2>
        <CompressionProviderSettings />
      </div>

      <div id="git" className="space-y-4 scroll-mt-20">
        <h2 className="text-xl font-semibold">Git Integration</h2>
        <p className="text-sm text-muted-foreground">
          Share project results with teammates via Git. Tokens are stored locally and never sent to our servers.
        </p>
        <p className="text-xs text-muted-foreground">
          Windows only: if cloned files appear as modified without changes, add{" "}
          <code className="font-mono bg-muted px-1 rounded">* text=auto eol=lf</code>{" "}
          to your repo's <code className="font-mono bg-muted px-1 rounded">.gitattributes</code>.
        </p>
        <GitHubSettings />
        <GitLabSettings />
      </div>

      <div className="rounded-lg border border-border p-6 space-y-2">
        <h3 className="text-lg font-semibold">About</h3>
        <div className="text-sm text-muted-foreground space-y-1">
          <p>Commit: <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{__GIT_COMMIT__}</code></p>
          <p>Built: <span className="text-xs">{new Date(__BUILD_TIME__).toLocaleString()}</span></p>
        </div>
      </div>
    </div>
  )
}

export const Route = createFileRoute("/app/settings")({
  component: SettingsPage,
})
