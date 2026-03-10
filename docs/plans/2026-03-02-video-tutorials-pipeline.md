# ContextForge Video Tutorials Pipeline — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a reproducible, code-driven pipeline that generates polished tutorial videos for ContextForge using Remotion (React video framework), Playwright (UI capture), and TTS (narration).

**Architecture:** Segment-based pipeline — each tutorial is defined as a JSON plan of segments. Each segment has narration text, UI actions, and timing. The pipeline: (1) generate TTS audio per segment → (2) measure durations → (3) capture UI actions with Playwright → (4) assemble in Remotion with overlays/subtitles → (5) render to MP4.

**Tech Stack:** Remotion 4.x, Playwright, vLLM-Omni + Qwen3-TTS (primary TTS) / Edge TTS (fallback), ffprobe, pnpm

**Reference docs:**
- Remotion API & patterns: [`docs/reference/remotion-reference.md`](../reference/remotion-reference.md) — complete guide for subagents (hooks, components, CLI, common patterns)

---

## Decisions Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Project location | `./contextforge-tutorials/` inside ContextForgeTS, gitignored | Co-located for convenience, separate deps |
| Capture target | Local dev (`localhost:5173`) | Fast iteration, no network latency |
| First tutorial | "Create a block" (~30-60s) | Pipeline template test — minimal content |
| TTS primary | vLLM-Omni + Qwen3-TTS-12Hz-1.7B (`localhost:8091`) | Local GPU, high quality, OpenAI-compatible API |
| TTS fallback | Edge TTS via `edge-tts-universal` npm package | Free, no GPU, no API key, decent quality |
| Visual style | Clean screen recording + overlays (step title, subtitles, cursor highlight) | Reusable components for all future tutorials |
| Login handling | Dual mode — capture login flow OR load saved `storageState` per segment flag | Some tutorials show login, most skip it |
| Resolution | 1920×1080 @ 30fps | Standard YouTube HD |

---

## Task 0: Project Scaffold

**Files:**
- Create: `contextforge-tutorials/package.json`
- Create: `contextforge-tutorials/tsconfig.json`
- Create: `contextforge-tutorials/src/index.ts`
- Create: `contextforge-tutorials/src/Root.tsx`
- Modify: `.gitignore` (add `contextforge-tutorials/`)

**Step 1: Add to .gitignore**

Add this line to the end of `/home/newub/w/ContextLibrary/ContextForgeTS/.gitignore`:
```
contextforge-tutorials/
```

**Step 2: Create directory**

```bash
mkdir -p contextforge-tutorials
cd contextforge-tutorials
```

**Step 3: Scaffold Remotion project**

```bash
npx create-video@latest . --template=blank
```

If `create-video` doesn't support `.` as target, scaffold to a temp name and move files.

**Step 4: Install additional dependencies**

```bash
cd contextforge-tutorials
pnpm add playwright edge-tts-universal get-audio-duration
pnpm exec playwright install chromium
```

**Step 5: Create directory structure**

```bash
mkdir -p scripts plans audio assets auth dist src/compositions src/components src/lib
```

**Step 6: Verify Remotion starts**

```bash
pnpm start
```

Expected: Remotion Studio opens at `localhost:3000`, shows blank composition.

**Step 7: Commit**

```bash
cd ..
git add .gitignore
git commit -m "chore: gitignore contextforge-tutorials"
```

Note: The tutorials project itself is NOT committed (gitignored). Only the .gitignore change is committed.

---

## Task 1: Tutorial Plan Schema + First Plan

**Files:**
- Create: `contextforge-tutorials/src/lib/types.ts`
- Create: `contextforge-tutorials/plans/create-block.json`

**Step 1: Define the segment schema**

Create `src/lib/types.ts`:

```ts
export interface TutorialSegment {
  id: string
  title: string
  narrationText: string
  actions: SegmentAction[]
  /** Filled by TTS pipeline — seconds */
  audioDuration?: number
  /** Filled by TTS pipeline — path relative to project root */
  audioFile?: string
  /** Filled by capture pipeline — path relative to project root */
  videoFile?: string
  /** Whether to show login flow or load saved auth state */
  captureLogin?: boolean
}

export interface SegmentAction {
  /** Human-readable description */
  description: string
  /** Playwright selector */
  selector: string
  /** Action type */
  type: "click" | "fill" | "wait" | "screenshot" | "scroll"
  /** Value for fill actions */
  value?: string
  /** Milliseconds to wait after action for visual buffer */
  pauseAfter?: number
}

export interface TutorialPlan {
  id: string
  title: string
  description: string
  segments: TutorialSegment[]
}
```

**Step 2: Write the first tutorial plan**

Create `plans/create-block.json`:

```json
{
  "id": "create-block",
  "title": "How to Create a Block in ContextForge",
  "description": "Pipeline template tutorial — create a single block in the Working zone.",
  "segments": [
    {
      "id": "intro",
      "title": "Welcome",
      "narrationText": "Welcome to ContextForge. In this quick tutorial, you'll learn how to create your first block.",
      "actions": [],
      "captureLogin": true
    },
    {
      "id": "navigate",
      "title": "Open a Session",
      "narrationText": "After logging in, you'll see the session view with three zones: Permanent, Stable, and Working.",
      "actions": [
        {
          "description": "Wait for session to load",
          "selector": "[data-zone='working']",
          "type": "wait",
          "pauseAfter": 1500
        }
      ]
    },
    {
      "id": "create-block",
      "title": "Create a Block",
      "narrationText": "Click the plus button in the Working zone to create a new block. Give it a name and start typing your content.",
      "actions": [
        {
          "description": "Click add block in Working zone",
          "selector": "[data-zone='working'] [data-action='add-block']",
          "type": "click",
          "pauseAfter": 800
        },
        {
          "description": "Type block content",
          "selector": "[data-testid='block-editor'] textarea",
          "type": "fill",
          "value": "# My First Block\n\nThis is a context block for my project.",
          "pauseAfter": 1500
        }
      ]
    },
    {
      "id": "outro",
      "title": "Done",
      "narrationText": "That's it! You've created your first block. Blocks are the building blocks of your context library.",
      "actions": []
    }
  ]
}
```

> **Note:** The selectors above are placeholders. We'll need to verify actual selectors against the running app in Task 4. Add `data-testid` attributes to the ContextForge app if needed.

**Step 3: Commit (local only — this is in the gitignored project)**

No git commit needed — the tutorials project is gitignored.

---

## Task 2: TTS Generation Script

**Files:**
- Create: `contextforge-tutorials/scripts/generate-tts.ts`
- Create: `contextforge-tutorials/scripts/tts-vllm.ts`
- Create: `contextforge-tutorials/scripts/tts-edge.ts`

**Step 1: Create the vLLM TTS client**

Create `scripts/tts-vllm.ts`:

```ts
import fs from "fs/promises"

const VLLM_URL = process.env.VLLM_TTS_URL || "http://localhost:8091"

export async function generateVllmTts(
  text: string,
  outputPath: string,
  voice = "vivian"
): Promise<void> {
  const res = await fetch(`${VLLM_URL}/v1/audio/speech`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input: text,
      voice,
      language: "English",
      response_format: "wav",
    }),
  })

  if (!res.ok) {
    throw new Error(`vLLM TTS failed: ${res.status} ${await res.text()}`)
  }

  const buffer = Buffer.from(await res.arrayBuffer())
  await fs.writeFile(outputPath, buffer)
}
```

**Step 2: Create the Edge TTS fallback client**

Create `scripts/tts-edge.ts`:

```ts
import fs from "fs/promises"

export async function generateEdgeTts(
  text: string,
  outputPath: string,
  voice = "en-US-AndrewMultilingualNeural"
): Promise<void> {
  // Dynamic import — edge-tts-universal
  const { Communicate } = await import("edge-tts-universal")

  const communicate = new Communicate(text, { voice, rate: "+0%", volume: "+0%" })

  const buffers: Buffer[] = []
  for await (const chunk of communicate.stream()) {
    if (chunk.type === "audio" && chunk.data) {
      buffers.push(chunk.data)
    }
  }

  await fs.writeFile(outputPath, Buffer.concat(buffers))
}
```

**Step 3: Create the orchestrator script**

Create `scripts/generate-tts.ts`:

```ts
import fs from "fs/promises"
import path from "path"
import { execSync } from "child_process"
import type { TutorialPlan } from "../src/lib/types"
import { generateVllmTts } from "./tts-vllm"
import { generateEdgeTts } from "./tts-edge"

const TTS_PROVIDER = process.env.TTS_PROVIDER || "vllm" // "vllm" | "edge"

function getAudioDuration(filePath: string): number {
  const result = execSync(
    `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
    { encoding: "utf-8" }
  )
  return parseFloat(result.trim())
}

async function main() {
  const planPath = process.argv[2]
  if (!planPath) {
    console.error("Usage: tsx scripts/generate-tts.ts plans/create-block.json")
    process.exit(1)
  }

  const plan: TutorialPlan = JSON.parse(await fs.readFile(planPath, "utf-8"))
  const audioDir = path.join("audio", plan.id)
  await fs.mkdir(audioDir, { recursive: true })

  const generate = TTS_PROVIDER === "vllm" ? generateVllmTts : generateEdgeTts
  console.log(`Using TTS provider: ${TTS_PROVIDER}`)

  for (const segment of plan.segments) {
    const audioFile = path.join(audioDir, `${segment.id}.wav`)
    console.log(`Generating: ${segment.id} → ${audioFile}`)

    await generate(segment.narrationText, audioFile)

    const duration = getAudioDuration(audioFile)
    segment.audioDuration = duration
    segment.audioFile = audioFile
    console.log(`  Duration: ${duration.toFixed(2)}s`)
  }

  // Write updated plan with durations back
  const outPath = planPath.replace(".json", "-timed.json")
  await fs.writeFile(outPath, JSON.stringify(plan, null, 2))
  console.log(`\nTimed plan written to: ${outPath}`)
}

main().catch(console.error)
```

**Step 4: Test with Edge TTS (no GPU needed)**

```bash
cd contextforge-tutorials
TTS_PROVIDER=edge npx tsx scripts/generate-tts.ts plans/create-block.json
```

Expected:
- Creates `audio/create-block/intro.wav`, `navigate.wav`, `create-block.wav`, `outro.wav`
- Creates `plans/create-block-timed.json` with `audioDuration` and `audioFile` filled in
- Each segment prints duration in seconds

**Step 5: Test with vLLM (when server is running)**

```bash
TTS_PROVIDER=vllm npx tsx scripts/generate-tts.ts plans/create-block.json
```

Expected: Same output, different voice quality.

---

## Task 3: Playwright Capture Script

**Files:**
- Create: `contextforge-tutorials/scripts/login.ts`
- Create: `contextforge-tutorials/scripts/capture.ts`

**Step 1: Create the login helper**

Create `scripts/login.ts`:

```ts
import { chromium, type BrowserContext, type Browser } from "playwright"
import fs from "fs/promises"
import path from "path"

const APP_URL = process.env.APP_URL || "http://localhost:5173"
const AUTH_FILE = path.join("auth", "storageState.json")

/**
 * Create a browser context with auth.
 * If captureLogin=true, performs login and records it.
 * Otherwise loads saved state.
 */
export async function createAuthContext(
  browser: Browser,
  options: {
    captureLogin?: boolean
    recordVideo?: { dir: string; size: { width: number; height: number } }
  } = {}
): Promise<BrowserContext> {
  const { captureLogin = false, recordVideo } = options

  if (!captureLogin) {
    // Load saved auth state
    try {
      await fs.access(AUTH_FILE)
      return browser.newContext({
        storageState: AUTH_FILE,
        viewport: { width: 1920, height: 1080 },
        ...(recordVideo && { recordVideo }),
      })
    } catch {
      console.warn("No saved auth state found, performing login...")
    }
  }

  // Perform login flow
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    ...(recordVideo && { recordVideo }),
  })

  const page = await context.newPage()
  await page.goto(APP_URL)

  // TODO: Adjust selectors to match actual ContextForge login form
  await page.waitForSelector("[data-testid='login-form']", { timeout: 10000 })
  await page.fill("[data-testid='email-input']", "test@contextforge.com")
  await page.fill("[data-testid='password-input']", "TestUser123!")
  await page.click("[data-testid='login-button']")
  await page.waitForSelector("[data-zone]", { timeout: 15000 })

  // Save auth state for future runs
  await fs.mkdir("auth", { recursive: true })
  await context.storageState({ path: AUTH_FILE })
  console.log(`Auth state saved to ${AUTH_FILE}`)

  return context
}

/**
 * One-time helper: login and save state without recording.
 */
export async function saveAuthState(): Promise<void> {
  const browser = await chromium.launch({ headless: false })
  const context = await createAuthContext(browser, { captureLogin: true })
  await context.close()
  await browser.close()
  console.log("Auth state saved. Future captures will reuse it.")
}
```

**Step 2: Create the capture orchestrator**

Create `scripts/capture.ts`:

```ts
import { chromium } from "playwright"
import fs from "fs/promises"
import path from "path"
import type { TutorialPlan, SegmentAction } from "../src/lib/types"
import { createAuthContext, saveAuthState } from "./login"

const APP_URL = process.env.APP_URL || "http://localhost:5173"

async function executeAction(
  page: import("playwright").Page,
  action: SegmentAction
): Promise<void> {
  switch (action.type) {
    case "click":
      await page.locator(action.selector).click()
      break
    case "fill":
      await page.locator(action.selector).fill(action.value || "")
      break
    case "wait":
      await page.waitForSelector(action.selector, { timeout: 10000 })
      break
    case "screenshot":
      // Screenshots captured automatically via video
      break
    case "scroll":
      await page.locator(action.selector).scrollIntoViewIfNeeded()
      break
  }

  if (action.pauseAfter) {
    await page.waitForTimeout(action.pauseAfter)
  }
}

async function main() {
  const planPath = process.argv[2]
  if (!planPath) {
    console.error("Usage: tsx scripts/capture.ts plans/create-block-timed.json")
    process.exit(1)
  }

  // Check if just saving auth
  if (process.argv[2] === "--save-auth") {
    await saveAuthState()
    return
  }

  const plan: TutorialPlan = JSON.parse(await fs.readFile(planPath, "utf-8"))
  const assetDir = path.join("assets", plan.id)
  await fs.mkdir(assetDir, { recursive: true })

  const browser = await chromium.launch({
    headless: false,
    slowMo: 300, // Slow enough for video capture to look natural
  })

  for (const segment of plan.segments) {
    const segmentDir = path.join(assetDir, segment.id)
    await fs.mkdir(segmentDir, { recursive: true })

    console.log(`Capturing: ${segment.id}`)

    const context = await createAuthContext(browser, {
      captureLogin: segment.captureLogin,
      recordVideo: {
        dir: segmentDir,
        size: { width: 1920, height: 1080 },
      },
    })

    const page = await context.newPage()

    // Navigate if not a login segment (login helper already navigates)
    if (!segment.captureLogin) {
      await page.goto(APP_URL)
      await page.waitForSelector("[data-zone]", { timeout: 15000 })
    }

    // Execute segment actions
    for (const action of segment.actions) {
      console.log(`  Action: ${action.description}`)
      await executeAction(page, action)
    }

    // Hold for remaining audio duration (visual buffer)
    const holdTime = ((segment.audioDuration || 3) * 1000) - 500
    if (holdTime > 0) {
      await page.waitForTimeout(holdTime)
    }

    // Finalize video
    await page.close()
    const videoPath = await page.video()?.path()
    if (videoPath) {
      const finalPath = path.join(segmentDir, "capture.webm")
      await fs.rename(videoPath, finalPath)
      segment.videoFile = finalPath
      console.log(`  Saved: ${finalPath}`)
    }

    await context.close()
  }

  await browser.close()

  // Write updated plan with video paths
  const outPath = planPath.replace(".json", "-captured.json")
  await fs.writeFile(outPath, JSON.stringify(plan, null, 2))
  console.log(`\nCaptured plan written to: ${outPath}`)
}

main().catch(console.error)
```

**Step 3: Save initial auth state**

```bash
cd contextforge-tutorials
npx tsx scripts/capture.ts --save-auth
```

Expected: Opens browser, performs login, saves `auth/storageState.json`.

**Step 4: Run capture (after TTS is done)**

```bash
npx tsx scripts/capture.ts plans/create-block-timed.json
```

Expected: Captures `.webm` clips per segment in `assets/create-block/{segment-id}/capture.webm`.

---

## Task 4: Verify Selectors Against Running App

**Files:**
- Potentially modify: ContextForgeTS source to add `data-testid` attributes
- Modify: `plans/create-block.json` with correct selectors

**Step 1: Start local dev**

```bash
# In ContextForgeTS root
pnpm dev          # terminal 1
npx convex dev    # terminal 2
```

**Step 2: Inspect the app and note actual selectors**

Open `localhost:5173` in browser DevTools. For each action in the plan, find the real selector:
- Login form fields
- Zone containers
- "Add block" button per zone
- Block editor textarea/input

**Step 3: Update plan JSON with real selectors**

Update `plans/create-block.json` with verified selectors.

**Step 4: Add `data-testid` attributes to ContextForge if needed**

If key UI elements lack stable selectors, add `data-testid` props to the React components. Likely candidates:
- Login form: `data-testid="login-form"`, `data-testid="email-input"`, etc.
- Zone columns: `data-zone="permanent"`, `data-zone="stable"`, `data-zone="working"`
- Add block button: `data-testid="add-block-{zone}"`
- Block editor: `data-testid="block-editor"`

Commit these to the main ContextForge repo:
```bash
git add -A
git commit -m "feat: add data-testid attributes for tutorial capture"
```

---

## Task 5: Remotion Composition — Reusable Components

**Files:**
- Create: `contextforge-tutorials/src/lib/timing.ts`
- Create: `contextforge-tutorials/src/components/AppCapture.tsx`
- Create: `contextforge-tutorials/src/components/StepOverlay.tsx`
- Create: `contextforge-tutorials/src/components/Subtitle.tsx`

**Step 1: Timing utilities**

Create `src/lib/timing.ts`:

```ts
import type { TutorialPlan, TutorialSegment } from "./types"

export const FPS = 30

export interface SegmentTiming {
  segment: TutorialSegment
  startFrame: number
  durationFrames: number
}

export function computeTimings(plan: TutorialPlan): SegmentTiming[] {
  let cumulative = 0
  return plan.segments.map((segment) => {
    const durationSec = segment.audioDuration || 3
    const durationFrames = Math.ceil(durationSec * FPS)
    const timing = { segment, startFrame: cumulative, durationFrames }
    cumulative += durationFrames
    return timing
  })
}

export function totalFrames(plan: TutorialPlan): number {
  return plan.segments.reduce(
    (sum, s) => sum + Math.ceil((s.audioDuration || 3) * FPS),
    0
  )
}
```

**Step 2: App capture component**

Create `src/components/AppCapture.tsx`:

```tsx
import { OffthreadVideo, staticFile } from "remotion"

interface AppCaptureProps {
  videoFile: string
}

export const AppCapture: React.FC<AppCaptureProps> = ({ videoFile }) => {
  return (
    <OffthreadVideo
      src={staticFile(videoFile)}
      style={{ width: "100%", height: "100%" }}
    />
  )
}
```

**Step 3: Step overlay component**

Create `src/components/StepOverlay.tsx`:

```tsx
import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion"
import type React from "react"

interface StepOverlayProps {
  stepNumber: number
  title: string
}

export const StepOverlay: React.FC<StepOverlayProps> = ({ stepNumber, title }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const enter = spring({ fps, frame, config: { damping: 200 }, durationInFrames: 20 })
  const exit = frame > fps * 2
    ? interpolate(frame, [fps * 2, fps * 2 + 15], [1, 0], { extrapolateRight: "clamp" })
    : 1

  const opacity = enter * exit
  const translateY = interpolate(enter, [0, 1], [-20, 0])

  return (
    <div
      style={{
        position: "absolute",
        top: 40,
        left: 40,
        opacity,
        transform: `translateY(${translateY}px)`,
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div
        style={{
          background: "#6366f1",
          color: "white",
          borderRadius: "50%",
          width: 40,
          height: 40,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: "bold",
          fontSize: 18,
        }}
      >
        {stepNumber}
      </div>
      <div
        style={{
          background: "rgba(0,0,0,0.75)",
          color: "white",
          padding: "8px 16px",
          borderRadius: 8,
          fontSize: 24,
          fontFamily: "Inter, sans-serif",
        }}
      >
        {title}
      </div>
    </div>
  )
}
```

**Step 4: Subtitle component**

Create `src/components/Subtitle.tsx`:

```tsx
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion"
import type React from "react"

interface SubtitleProps {
  text: string
}

export const Subtitle: React.FC<SubtitleProps> = ({ text }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const opacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" })

  // Simple word reveal based on frame progress
  const words = text.split(" ")
  const totalDuration = fps * (text.length / 150) // ~150 wpm
  const wordsToShow = Math.ceil(
    interpolate(frame, [0, totalDuration], [0, words.length], {
      extrapolateRight: "clamp",
    })
  )

  return (
    <div
      style={{
        position: "absolute",
        bottom: 60,
        left: "50%",
        transform: "translateX(-50%)",
        opacity,
        background: "rgba(0,0,0,0.8)",
        color: "white",
        padding: "12px 24px",
        borderRadius: 8,
        fontSize: 22,
        fontFamily: "Inter, sans-serif",
        maxWidth: "80%",
        textAlign: "center",
        lineHeight: 1.4,
      }}
    >
      {words.slice(0, wordsToShow).join(" ")}
    </div>
  )
}
```

---

## Task 6: First Tutorial Composition

**Files:**
- Create: `contextforge-tutorials/src/compositions/CreateBlock.tsx`
- Modify: `contextforge-tutorials/src/Root.tsx`

**Step 1: Create the composition**

Create `src/compositions/CreateBlock.tsx`:

```tsx
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion"
import { AppCapture } from "../components/AppCapture"
import { StepOverlay } from "../components/StepOverlay"
import { Subtitle } from "../components/Subtitle"
import { computeTimings, FPS } from "../lib/timing"
import type { TutorialPlan } from "../lib/types"

interface CreateBlockProps {
  plan: TutorialPlan
}

export const CreateBlock: React.FC<CreateBlockProps> = ({ plan }) => {
  const timings = computeTimings(plan)

  return (
    <AbsoluteFill style={{ backgroundColor: "#0f0f0f" }}>
      {timings.map((t, i) => (
        <Sequence
          key={t.segment.id}
          from={t.startFrame}
          durationInFrames={t.durationFrames}
        >
          {/* Background video capture */}
          {t.segment.videoFile && (
            <AppCapture videoFile={t.segment.videoFile} />
          )}

          {/* Step number + title overlay */}
          <StepOverlay stepNumber={i + 1} title={t.segment.title} />

          {/* Subtitles */}
          <Subtitle text={t.segment.narrationText} />

          {/* Audio narration */}
          {t.segment.audioFile && (
            <Audio src={staticFile(t.segment.audioFile)} volume={1} />
          )}
        </Sequence>
      ))}
    </AbsoluteFill>
  )
}
```

**Step 2: Register composition in Root.tsx**

Update `src/Root.tsx`:

```tsx
import { Composition } from "remotion"
import { CreateBlock } from "./compositions/CreateBlock"
import { totalFrames, FPS } from "./lib/timing"
import createBlockPlan from "../plans/create-block-timed.json"

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="CreateBlock"
        component={CreateBlock}
        durationInFrames={totalFrames(createBlockPlan)}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ plan: createBlockPlan }}
      />
    </>
  );
}
```

**Step 3: Preview in Remotion Studio**

```bash
pnpm start
```

Expected: Remotion Studio shows the "CreateBlock" composition. Segments play sequentially with overlays and audio.

---

## Task 7: Build Script + Render

**Files:**
- Create: `contextforge-tutorials/scripts/build-all.sh`

**Step 1: Create the full pipeline script**

Create `scripts/build-all.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

PLAN="${1:-plans/create-block.json}"
TTS_PROVIDER="${TTS_PROVIDER:-edge}"

echo "=== Step 1: Generate TTS ==="
npx tsx scripts/generate-tts.ts "$PLAN"

TIMED_PLAN="${PLAN%.json}-timed.json"

echo "=== Step 2: Capture UI ==="
npx tsx scripts/capture.ts "$TIMED_PLAN"

CAPTURED_PLAN="${TIMED_PLAN%-timed.json}-timed-captured.json"

echo "=== Step 3: Copy assets to public/ for Remotion ==="
# Remotion's staticFile() reads from public/
mkdir -p public/audio public/assets
cp -r audio/* public/audio/ 2>/dev/null || true
cp -r assets/* public/assets/ 2>/dev/null || true

echo "=== Step 4: Render video ==="
npx remotion render CreateBlock --output dist/create-block.mp4 --codec h264

echo "=== Done! ==="
echo "Output: dist/create-block.mp4"
```

**Step 2: Make executable**

```bash
chmod +x scripts/build-all.sh
```

**Step 3: Run end-to-end**

```bash
cd contextforge-tutorials
TTS_PROVIDER=edge ./scripts/build-all.sh plans/create-block.json
```

Expected: Full pipeline runs, produces `dist/create-block.mp4`.

**Step 4: Review output**

```bash
ffplay dist/create-block.mp4
```

---

## Task 8: Iterate on Quality

This is the manual polishing phase, not strictly code:

1. **Watch the rendered video** — check audio/visual sync
2. **Adjust timings** — modify `pauseAfter` values in plan JSON
3. **Tweak overlays** — adjust colors, positioning, animation timing
4. **Try different TTS voices** — compare vLLM voices vs Edge TTS voices
5. **Add cursor highlighting** if actions are hard to follow (future component)

---

## File Summary

```
contextforge-tutorials/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                        # Remotion entry
│   ├── Root.tsx                         # Composition registry
│   ├── compositions/
│   │   └── CreateBlock.tsx              # First tutorial
│   ├── components/
│   │   ├── AppCapture.tsx               # Video playback wrapper
│   │   ├── StepOverlay.tsx              # Step number + title badge
│   │   └── Subtitle.tsx                 # Word-reveal subtitles
│   └── lib/
│       ├── types.ts                     # Segment/plan types
│       └── timing.ts                    # Frame computation
├── scripts/
│   ├── generate-tts.ts                  # TTS orchestrator
│   ├── tts-vllm.ts                      # vLLM/Qwen3 TTS client
│   ├── tts-edge.ts                      # Edge TTS fallback client
│   ├── login.ts                         # Playwright auth helper
│   ├── capture.ts                       # Playwright capture orchestrator
│   └── build-all.sh                     # Full pipeline
├── plans/
│   └── create-block.json               # First tutorial plan
├── audio/                               # Generated TTS files
├── assets/                              # Playwright captures
├── auth/                                # Saved browser state
├── public/                              # Remotion static files (copies)
└── dist/                                # Rendered MP4 output
```
