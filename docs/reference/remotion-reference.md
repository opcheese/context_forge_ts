# Remotion Reference Guide

> **Purpose:** Comprehensive reference for subagents working on the ContextForge video tutorials pipeline.
> Based on Remotion v4.0.431 (latest as of March 2026) and the official LLM system prompt at `remotion.dev/llms.txt`.

---

## Table of Contents

1. [Installation & Project Setup](#installation--project-setup)
2. [Project Structure](#project-structure)
3. [Composition Registration](#composition-registration)
4. [Core Hooks](#core-hooks)
5. [Animation Utilities](#animation-utilities)
6. [Media Components](#media-components)
7. [Layout & Timing Components](#layout--timing-components)
8. [Transitions](#transitions)
9. [Static Files](#static-files)
10. [CLI Commands](#cli-commands)
11. [Rules & Constraints](#rules--constraints)
12. [Common Patterns](#common-patterns)

---

## Installation & Project Setup

### Scaffold a new project

```bash
npx create-video@latest my-video --blank
cd my-video
npm install   # or pnpm install
npm start     # opens Remotion Studio at localhost:3000
```

The `--blank` flag gives a minimal scaffold without example code.

### Install in an existing project

```bash
pnpm add remotion @remotion/cli @remotion/media
```

Optional packages:
- `@remotion/transitions` — scene transitions (fade, wipe, slide)
- `@remotion/gif` — animated GIF support
- `@remotion/tailwind` — TailwindCSS integration
- `@remotion/player` — embed video in React apps
- `@remotion/renderer` — server-side rendering APIs

### Required files for brownfield install

Create a `remotion/` directory (or `src/`) with three files:

1. `index.ts` — entry point, calls `registerRoot()`
2. `Root.tsx` — registers `<Composition>` components
3. Your video components

---

## Project Structure

```
my-video/
├── src/
│   ├── index.ts          # Entry point — registerRoot()
│   ├── Root.tsx           # Composition registry
│   └── MyComp.tsx         # Video component(s)
├── public/                # Static assets (audio, video, images)
├── remotion.config.ts     # CLI/render config overrides
├── package.json
└── tsconfig.json
```

### Entry point (`src/index.ts`)

```ts
import { registerRoot } from 'remotion';
import { Root } from './Root';

registerRoot(Root);
```

**Important:** `registerRoot()` must live in a separate file from your compositions. It should only be called once (React Fast Refresh re-executes the file).

---

## Composition Registration

### Root file (`src/Root.tsx`)

```tsx
import { Composition } from 'remotion';
import { MyComp } from './MyComp';

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="MyComp"
        component={MyComp}
        durationInFrames={120}
        width={1920}
        height={1080}
        fps={30}
        defaultProps={{}}
      />
    </>
  );
};
```

### `<Composition>` props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `id` | `string` | Yes | `"MyComp"` | Unique ID (letters, numbers, hyphens). Used in render CLI. |
| `component` | `React.FC` | Yes* | — | The React component to render |
| `lazyComponent` | `() => Promise` | Yes* | — | Lazy-loaded alternative (reduces startup time) |
| `durationInFrames` | `number` | Yes | — | Total frames |
| `fps` | `number` | Yes | `30` | Frame rate |
| `width` | `number` | Yes | `1920` | Video width in pixels |
| `height` | `number` | Yes | `1080` | Video height in pixels |
| `defaultProps` | `object` | No | `{}` | Must be JSON-serializable. Must match component's expected props. |
| `calculateMetadata` | `function` | No | — | Dynamic metadata (see below) |
| `schema` | `ZodSchema` | No | — | Zod schema for visual editing in Studio |

*Either `component` or `lazyComponent` is required, not both.

### Dynamic metadata with `calculateMetadata`

Use when duration, dimensions, or props depend on external data:

```tsx
<Composition
  id="DynamicVideo"
  component={MyVideo}
  calculateMetadata={async ({ props, abortSignal }) => {
    const data = await fetch('https://api.example.com/video-config', { signal: abortSignal });
    const config = await data.json();
    return {
      durationInFrames: config.frames,
      fps: 30,
      width: 1920,
      height: 1080,
      props: { ...props, data: config },
    };
  }}
  defaultProps={{ data: null }}
/>
```

The function runs once per render. Can override: `durationInFrames`, `width`, `height`, `fps`, `defaultCodec`, and `props`.

### Organizing with `<Folder>`

```tsx
import { Composition, Folder } from 'remotion';

export const Root: React.FC = () => {
  return (
    <>
      <Folder name="tutorials">
        <Composition id="CreateBlock" ... />
        <Composition id="SkillExport" ... />
      </Folder>
    </>
  );
};
```

Folders are visual-only (Remotion Studio sidebar). No effect on rendering.

---

## Core Hooks

### `useCurrentFrame()`

Returns the current frame number (0-indexed).

```tsx
import { useCurrentFrame } from 'remotion';

export const MyComp: React.FC = () => {
  const frame = useCurrentFrame();
  return <div>Frame {frame}</div>;
};
```

**Inside a `<Sequence>`:** Returns the frame **relative to the Sequence start** (resets to 0). To get the absolute frame, call `useCurrentFrame()` outside the Sequence and pass it down as a prop.

### `useVideoConfig()`

Returns composition metadata:

```tsx
import { useVideoConfig } from 'remotion';

const { fps, durationInFrames, width, height, id } = useVideoConfig();
```

| Field | Type | Description |
|-------|------|-------------|
| `fps` | `number` | Frame rate |
| `durationInFrames` | `number` | Total frames (or Sequence duration if nested) |
| `width` | `number` | Composition width |
| `height` | `number` | Composition height |
| `id` | `string` | Composition ID |
| `defaultProps` | `object` | Default props from Composition |
| `props` | `object` | Resolved props (v4.0.0+) |

---

## Animation Utilities

### `interpolate()`

Maps one range of values to another. The primary animation primitive.

```tsx
import { interpolate, useCurrentFrame } from 'remotion';

const frame = useCurrentFrame();

// Fade in over 30 frames
const opacity = interpolate(frame, [0, 30], [0, 1], {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
});

// Slide from bottom
const translateY = interpolate(frame, [0, 30], [100, 0], {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
});
```

**Parameters:**
1. `value` — the input number (usually `frame`)
2. `inputRange` — array of ascending numbers
3. `outputRange` — array of corresponding output values
4. `options` — optional config object

**Options:**
| Option | Values | Default | Description |
|--------|--------|---------|-------------|
| `extrapolateLeft` | `"extend"`, `"clamp"`, `"wrap"`, `"identity"` | `"extend"` | Behavior below input range |
| `extrapolateRight` | `"extend"`, `"clamp"`, `"wrap"`, `"identity"` | `"extend"` | Behavior above input range |
| `easing` | `(t: number) => number` | linear | Easing function |

**Best practice:** Always add `extrapolateLeft: 'clamp', extrapolateRight: 'clamp'` unless you specifically need extrapolation.

**Multi-point interpolation** (since v2.0):

```tsx
// Fade in, hold, fade out
const opacity = interpolate(frame, [0, 20, 40, 60], [0, 1, 1, 0], {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
});
```

### `spring()`

Physics-based animation. Returns a value that animates from `from` to `to` (default 0→1).

```tsx
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';

const frame = useCurrentFrame();
const { fps } = useVideoConfig();

const scale = spring({
  fps,
  frame,
  config: {
    damping: 200,
  },
});
```

**Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `fps` | `number` | Required | From `useVideoConfig()` |
| `frame` | `number` | Required | From `useCurrentFrame()` |
| `from` | `number` | `0` | Start value |
| `to` | `number` | `1` | End value |
| `config.damping` | `number` | `10` | Deceleration. Higher = less bounce. Use `200` for smooth, no-bounce. |
| `config.mass` | `number` | `1` | Lower = faster animation |
| `config.stiffness` | `number` | `100` | Higher = more bounce |
| `config.overshootClamping` | `boolean` | `false` | Prevent overshooting target |
| `durationInFrames` | `number` | — | Stretch animation to exact duration |
| `delay` | `number` | `0` | Frames to wait before starting |
| `reverse` | `boolean` | `false` | Play backwards |

**Suggested default config:** `{ damping: 200 }` for smooth, non-bouncy animations.

### `interpolateColors()`

Maps value ranges to colors. Returns `rgba()` string.

```tsx
import { interpolateColors, useCurrentFrame } from 'remotion';

const frame = useCurrentFrame();
const color = interpolateColors(frame, [0, 50], ['#ff0000', '#0000ff']);
```

Supports: named colors, hex, rgb/rgba, hsl/hsla.

### `random()`

Deterministic random number generator. **Must be used instead of `Math.random()`** (Remotion requires deterministic rendering).

```tsx
import { random } from 'remotion';

const value = random('my-seed');  // Returns 0-1, same every render
const value2 = random('seed-2');  // Different seed = different value
```

---

## Media Components

### `<Video>` / `<OffthreadVideo>`

**`<Video>`** (from `@remotion/media`) — uses browser `<video>` playback:

```tsx
import { Video } from '@remotion/media';

<Video
  src={staticFile('background.mp4')}
  style={{ width: '100%' }}
  volume={0.5}
  trimBefore={30}    // skip first 30 frames
  trimAfter={150}    // stop after 150 frames
  playbackRate={1}
/>
```

**`<OffthreadVideo>`** (from `remotion`) — extracts exact frames via FFmpeg during rendering. Better quality for production renders, but **incompatible with client-side rendering**.

```tsx
import { OffthreadVideo, staticFile } from 'remotion';

<OffthreadVideo
  src={staticFile('capture.webm')}
  volume={0.5}
  playbackRate={1}
  transparent={false}   // set true for alpha channel (slower)
/>
```

Supported codecs: H.264, H.265, VP8, VP9, AV1, ProRes.

### `<Audio>`

```tsx
import { Audio } from '@remotion/media';

<Audio
  src={staticFile('narration.wav')}
  volume={1}           // 0-1, or (frame) => number for dynamic volume
  trimBefore={0}       // skip N frames of audio from start
  trimAfter={150}      // stop after N frames
  playbackRate={1}     // 0.5 = slow, 2 = fast
  muted={false}
  loop={false}
/>
```

### `<Img>`

```tsx
import { Img, staticFile } from 'remotion';

<Img
  src={staticFile('screenshot.png')}
  style={{ width: '100%' }}
/>
```

Built-in retry with exponential backoff (default 2 retries). Max resolution: 539 megapixels (Chrome limit).

### `<Gif>`

Requires `@remotion/gif` package:

```tsx
import { Gif } from '@remotion/gif';

<Gif
  src="https://media.giphy.com/media/l0MYd5y8e1t0m/giphy.gif"
  style={{ width: '100%' }}
/>
```

---

## Layout & Timing Components

### `<AbsoluteFill>`

Full-screen absolutely positioned `<div>` with flexbox. Use for layering.

```tsx
import { AbsoluteFill } from 'remotion';

<AbsoluteFill>
  <AbsoluteFill style={{ backgroundColor: '#000' }}>
    {/* Background layer */}
  </AbsoluteFill>
  <AbsoluteFill>
    {/* Foreground layer — rendered on top */}
  </AbsoluteFill>
</AbsoluteFill>
```

**Last child renders on top.** Supports `style`, `className`, and `ref`.

### `<Sequence>`

Time-shifts child rendering. Children see frame 0 when the Sequence starts.

```tsx
import { Sequence } from 'remotion';

<Sequence from={30} durationInFrames={60}>
  <MyComponent />  {/* useCurrentFrame() returns 0 at global frame 30 */}
</Sequence>
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `from` | `number` | `0` | Frame where children appear |
| `durationInFrames` | `number` | `Infinity` | How long children are mounted |
| `layout` | `"absolute-fill"` \| `"none"` | `"absolute-fill"` | Wrapper style |
| `name` | `string` | — | Label in Studio timeline |
| `style` | `CSSProperties` | — | Custom styles on wrapper |
| `premountFor` | `number` | — | Pre-render N frames before visible |
| `postmountFor` | `number` | — | Keep mounted N frames after end |

**Nesting:** Sequences cascade. A Sequence at frame 30 inside one at frame 60 = starts at frame 90.

**Negative `from`:** Starts immediately but skips the first `|from|` frames of content.

### `<Series>`

Sequential display without manual `from` calculations:

```tsx
import { Series } from 'remotion';

<Series>
  <Series.Sequence durationInFrames={60}>
    <Intro />
  </Series.Sequence>
  <Series.Sequence durationInFrames={90}>
    <MainContent />
  </Series.Sequence>
  <Series.Sequence durationInFrames={60} offset={-10}>
    <Outro />  {/* Starts 10 frames earlier — overlaps with MainContent */}
  </Series.Sequence>
</Series>
```

`<Series.Sequence>` has no `from` prop. Uses `durationInFrames` and optional `offset` (positive = gap, negative = overlap). Only the **last** sequence can use `Infinity` for duration.

---

## Transitions

Requires `@remotion/transitions` (v4.0.53+).

### `<TransitionSeries>`

Like `<Series>` but with animated transitions between scenes:

```tsx
import { TransitionSeries, linearTiming, springTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { wipe } from '@remotion/transitions/wipe';
import { slide } from '@remotion/transitions/slide';

<TransitionSeries>
  <TransitionSeries.Sequence durationInFrames={60}>
    <SceneA />
  </TransitionSeries.Sequence>
  <TransitionSeries.Transition
    timing={springTiming({ config: { damping: 200 } })}
    presentation={fade()}
  />
  <TransitionSeries.Sequence durationInFrames={60}>
    <SceneB />
  </TransitionSeries.Sequence>
  <TransitionSeries.Transition
    timing={linearTiming({ durationInFrames: 30 })}
    presentation={slide({ direction: 'from-left' })}
  />
  <TransitionSeries.Sequence durationInFrames={60}>
    <SceneC />
  </TransitionSeries.Sequence>
</TransitionSeries>
```

### Available presentations

| Import | Effect |
|--------|--------|
| `@remotion/transitions/fade` | `fade()` — crossfade opacity |
| `@remotion/transitions/wipe` | `wipe()` — wipe reveal |
| `@remotion/transitions/slide` | `slide({ direction })` — push slide. Directions: `from-left`, `from-right`, `from-top`, `from-bottom` |
| `@remotion/transitions/flip` | `flip()` — 3D flip |
| `@remotion/transitions/clock-wipe` | `clockWipe()` — radial clock wipe |

### Timing functions

| Function | Usage |
|----------|-------|
| `linearTiming({ durationInFrames: 30 })` | Fixed duration, linear easing |
| `springTiming({ config: { damping: 200 } })` | Physics-based duration |

### Rules

1. Transitions cannot exceed adjacent sequence durations
2. No consecutive transitions
3. No consecutive overlays
4. Transitions and overlays cannot be adjacent
5. At least one sequence must surround any transition

**Duration calculation:** Sum of all sequence durations minus sum of transition durations.

---

## Static Files

### `staticFile()`

References files in the `public/` directory:

```tsx
import { staticFile } from 'remotion';

const video = staticFile('capture.webm');      // → public/capture.webm
const audio = staticFile('audio/intro.wav');    // → public/audio/intro.wav
const image = staticFile('assets/bg.png');      // → public/assets/bg.png
```

**Rules:**
- The `public/` folder must be at the same level as `package.json`
- Since v4.0, filenames are auto-encoded with `encodeURIComponent`
- Use `staticFile()` instead of raw strings — handles subdirectory deployment

### Related APIs

- `getStaticFiles()` — list all files in `public/`
- `watchStaticFile()` — watch for file changes

---

## CLI Commands

### `npx remotion studio`

Start the development preview server:

```bash
npx remotion studio                        # auto-detect entry point
npx remotion studio src/index.ts           # explicit entry point
npx remotion studio --port 3001            # custom port
npx remotion studio --no-open              # don't open browser
```

### `npx remotion render`

Render a composition to video:

```bash
# Basic render
npx remotion render MyComp

# Full options
npx remotion render src/index.ts MyComp out/video.mp4

# With custom props (use file on Windows)
npx remotion render MyComp --props='{"title":"Hello"}'
```

**Key flags:**

| Flag | Description | Example |
|------|-------------|---------|
| `--codec` | Output codec | `h264` (default for .mp4), `vp8`, `prores` |
| `--crf` | Quality (lower = better) | `18` |
| `--fps` | Override frame rate | `30` |
| `--width` / `--height` | Override dimensions | `1920` / `1080` |
| `--frames` | Render subset of frames | `0-59` |
| `--scale` | Scale output resolution (1-16x) | `1.5` |
| `--concurrency` | Parallel frame renders | `4` |
| `--muted` | No audio in output | — |
| `--video-bitrate` | Video bitrate | `5M` |
| `--audio-bitrate` | Audio bitrate | `128k` |
| `--jpeg-quality` | JPEG quality (0-100) | `80` |
| `--hardware-acceleration` | GPU encoding | — |
| `--separate-audio-to` | Extract audio to separate file | `out/audio.mp3` |
| `--props` | Pass JSON props | `'{"key":"val"}'` |
| `--output` / `-o` | Output path | `dist/video.mp4` |
| `--overwrite` | Overwrite existing (default: yes) | — |
| `--log` | Log level | `error`, `warn`, `info`, `verbose` |

### `npx remotion still`

Render a single frame as an image:

```bash
npx remotion still MyComp                         # default: frame 0, PNG
npx remotion still MyComp out/thumb.png --frame=60  # specific frame
npx remotion still MyComp --image-format=jpeg --jpeg-quality=90
npx remotion still MyComp --scale=2               # 2x resolution
```

### `npx remotion compositions`

List all registered compositions:

```bash
npx remotion compositions src/index.ts
```

---

## Rules & Constraints

### Determinism

Remotion requires all code to be **deterministic** — the same frame must always render identically.

- **NO `Math.random()`** — use `random('seed')` from `remotion` instead
- **NO `Date.now()`** — use frame numbers for time
- **NO non-deterministic side effects** in render

### Props serialization

All `defaultProps` must be JSON-serializable. No functions, classes, or complex objects. Exception: `<Player>` component accepts functions.

### FFmpeg

FFmpeg is bundled with Remotion since v4.0. Do not install separately. The old `ffmpegExecutable` and `ensureFfmpeg()` APIs are removed.

### Import paths (v4.0+)

```tsx
// Core
import { useCurrentFrame, useVideoConfig, interpolate, spring, random,
         AbsoluteFill, Sequence, Series, Composition, Folder,
         Img, OffthreadVideo, staticFile, registerRoot } from 'remotion';

// Media (Audio, Video)
import { Audio, Video } from '@remotion/media';

// Transitions
import { TransitionSeries, linearTiming, springTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';
import { wipe } from '@remotion/transitions/wipe';

// GIF
import { Gif } from '@remotion/gif';
```

### Node.js minimum

Node.js 16+ required. We use Node 20+.

---

## Common Patterns

### Fade-in text overlay

```tsx
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';

export const FadeInText: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <h1 style={{ opacity, fontSize: 80, color: 'white' }}>{text}</h1>
    </AbsoluteFill>
  );
};
```

### Spring-animated entry

```tsx
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';

export const SpringEntry: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({ fps, frame, config: { damping: 200 } });
  const translateY = interpolate(progress, [0, 1], [50, 0]);
  const opacity = interpolate(progress, [0, 1], [0, 1]);

  return (
    <AbsoluteFill style={{ opacity, transform: `translateY(${translateY}px)` }}>
      {children}
    </AbsoluteFill>
  );
};
```

### Sequential segments from data

```tsx
import { Series, AbsoluteFill } from 'remotion';
import { Audio } from '@remotion/media';

interface Segment {
  id: string;
  durationFrames: number;
  audioFile: string;
  videoFile: string;
}

export const Tutorial: React.FC<{ segments: Segment[] }> = ({ segments }) => {
  return (
    <AbsoluteFill>
      <Series>
        {segments.map((seg) => (
          <Series.Sequence key={seg.id} durationInFrames={seg.durationFrames}>
            <OffthreadVideo src={staticFile(seg.videoFile)} />
            <Audio src={staticFile(seg.audioFile)} />
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  );
};
```

### Transitions between scenes

```tsx
import { TransitionSeries, springTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';

export const WithTransitions: React.FC<{ segments: Segment[] }> = ({ segments }) => {
  return (
    <TransitionSeries>
      {segments.flatMap((seg, i) => {
        const items = [
          <TransitionSeries.Sequence key={seg.id} durationInFrames={seg.durationFrames}>
            <SegmentView segment={seg} />
          </TransitionSeries.Sequence>,
        ];
        if (i < segments.length - 1) {
          items.push(
            <TransitionSeries.Transition
              key={`${seg.id}-transition`}
              timing={springTiming({ config: { damping: 200 } })}
              presentation={fade()}
            />
          );
        }
        return items;
      })}
    </TransitionSeries>
  );
};
```

### Async data loading with `delayRender`

```tsx
import { useCallback, useEffect, useState } from 'react';
import { continueRender, delayRender } from 'remotion';

export const DataDriven: React.FC = () => {
  const [data, setData] = useState(null);
  const [handle] = useState(() => delayRender('Loading data'));

  useEffect(() => {
    fetch('https://api.example.com/data')
      .then((res) => res.json())
      .then((d) => {
        setData(d);
        continueRender(handle);
      })
      .catch((err) => cancelRender(err));
  }, [handle]);

  if (!data) return null;
  return <div>{JSON.stringify(data)}</div>;
};
```

**Timeout:** Must call `continueRender()` within 30 seconds or render fails. Prefer `calculateMetadata` for data fetching when possible (runs once, not per concurrency).

### Dynamic composition duration from audio

```tsx
<Composition
  id="Tutorial"
  component={Tutorial}
  calculateMetadata={async ({ props }) => {
    // Sum audio durations to get total frames
    const totalSeconds = props.segments.reduce((s, seg) => s + seg.audioDuration, 0);
    return {
      durationInFrames: Math.ceil(totalSeconds * 30),
      fps: 30,
      width: 1920,
      height: 1080,
    };
  }}
  defaultProps={{ segments: [] }}
/>
```

---

## Sources

- [Remotion Official Docs](https://www.remotion.dev/docs/api)
- [Remotion LLM System Prompt](https://www.remotion.dev/llms.txt) — canonical reference for AI code generation
- [Remotion GitHub](https://github.com/remotion-dev/remotion)
- [Remotion npm](https://www.npmjs.com/package/remotion) — v4.0.431
- [Creating a new project](https://www.remotion.dev/docs/)
- [Installing in existing project](https://www.remotion.dev/docs/brownfield)
- [CLI Reference](https://www.remotion.dev/docs/cli)
- [@remotion/transitions](https://www.remotion.dev/docs/transitions)
- [v4.0 Migration Guide](https://www.remotion.dev/docs/4-0-migration)
