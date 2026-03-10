# TTS Voice Consistency for Video Tutorials — Research Report

**Date:** 2026-03-02
**Context:** ContextForge video tutorial pipeline needs consistent voice across multiple audio segments with accurate per-segment timing.

---

## The Problem

When generating TTS per-segment (for accurate timing), the voice characteristics vary between calls — different pitch, pace, emotion. When generating as a single batch (for consistency), splitting the audio back into segments is unreliable.

---

## Option 1: Qwen3-TTS Voice Cloning (Base Model)

**How it works:** Generate a "golden" reference clip. Use the Base model with `ref_audio` + `ref_text` parameters for all subsequent generations. The model clones the voice characteristics from the reference.

**Setup:**
- Requires running the **Base** model variant: `Qwen/Qwen3-TTS-12Hz-1.7B-Base`
- Separate server from CustomVoice (different model weights)
- Same vLLM-Omni infrastructure we already have

**API:**
```json
{
  "input": "Text to synthesize",
  "task_type": "Base",
  "ref_audio": "data:audio/wav;base64,...",
  "ref_text": "Transcript of reference audio",
  "response_format": "wav"
}
```

**Pros:**
- Per-segment generation → accurate timing (no splitting needed)
- Voice locked to reference clip → consistent across segments
- Already have vLLM-Omni infrastructure
- 1.7B params, fits easily on RTX 5090 alongside CustomVoice

**Cons:**
- Need to run a second vLLM server (port 8092) or swap models
- Must send base64-encoded reference audio with every request (~6KB overhead for a 6s clip)
- Quality depends on reference clip quality

**Verdict:** Best fit for our use case. Per-segment timing + voice consistency. Minimal infrastructure change.

---

## Option 2: Qwen3-ForcedAligner (Post-hoc Timestamps)

**What it is:** A separate 0.6B model ([Qwen/Qwen3-ForcedAligner-0.6B](https://huggingface.co/Qwen/Qwen3-ForcedAligner-0.6B)) that aligns text to audio and returns word-level timestamps.

**How it solves our problem:** Generate one combined audio file (consistent voice). Run the ForcedAligner on it to get exact word boundaries. Split at sentence boundaries using timestamps instead of silence detection.

**API:**
```python
from qwen_asr import Qwen3ForcedAligner

model = Qwen3ForcedAligner.from_pretrained("Qwen/Qwen3-ForcedAligner-0.6B")
results = model.align(audio="combined.wav", text="Full transcript", language="English")
# results[0][i].text, .start_time, .end_time — per word
```

**Accuracy:** ~37.5ms for English (very precise).

**Pros:**
- Word-level timestamps → precise splitting at any boundary
- Small model (0.6B), negligible VRAM
- Stays in Qwen ecosystem
- Could also generate subtitles with exact word timing

**Cons:**
- Requires Python (qwen_asr package) — breaks our all-TypeScript pipeline
- Additional model to download and manage
- Two-step process: generate combined → align → split
- Requires the `qwen_asr` Python package, separate from vLLM-Omni

**Verdict:** Powerful for subtitle generation. Overkill for just splitting audio, but valuable if we want word-timed subtitles in the future.

---

## Option 3: Microsoft VibeVoice-1.5B

**What it is:** Microsoft's open-source TTS ([GitHub](https://github.com/microsoft/VibeVoice)) supporting up to 90 minutes continuous generation with consistent speaker identity.

**Key specs:**
- 3B parameters (BF16) — based on Qwen2.5-1.5B + diffusion head
- Up to 4 speakers, 90 minutes continuous
- 64K token context length
- Languages: English and Chinese only

**Critical issues for us:**
1. **TTS code was removed from the repo** (2025-09-05). Only ASR and Realtime models have inference code available. The 1.5B TTS model weights are on HuggingFace but the inference code is gone.
2. **"Research purposes only"** — Microsoft explicitly warns against commercial use without testing
3. **No voice cloning** — supports pre-defined speakers only
4. **Adds audible AI disclaimer** to generated audio and imperceptible watermarks
5. **No vLLM integration** — would need a completely separate Python inference pipeline
6. **No word-level timestamps** from TTS output

**Pros:**
- 90-minute continuous generation with perfect consistency
- Multi-speaker support (useful for future dialog tutorials)

**Cons:**
- TTS inference code removed from repo — cannot actually run it
- Watermarks and AI disclaimers injected into audio
- No voice cloning, no word timestamps
- Research-only license concerns
- Completely separate infrastructure from what we have

**Verdict:** Not viable. Code removed, watermarks injected, research-only. Dead end.

---

## Option 4: Hybrid — Per-segment + `instructions` (Current Approach)

**What we have now:** Per-segment generation with Qwen3-TTS CustomVoice + `instructions` parameter for style consistency.

**Pros:**
- Already working
- Accurate per-segment timing
- No additional models or servers

**Cons:**
- Voice still varies slightly between calls despite instructions
- No guarantee of consistency across re-generations

---

## Recommendation

**Primary: Option 1 (Voice Cloning with Base model)**

This is the standard industry approach and fits our infrastructure perfectly:
1. Generate one "golden" reference clip with desired voice/tone
2. Start Base model server on port 8092
3. All segment generations use `ref_audio` → locked voice characteristics
4. Per-segment generation → accurate timing, no splitting

**Secondary: Option 2 (ForcedAligner) — add later for subtitles**

When we want word-timed subtitles instead of the current word-reveal approximation, the ForcedAligner gives us exact timestamps. Worth adding as a post-processing step in a future iteration.

**Skip: Option 3 (VibeVoice)** — code removed, watermarks, not viable.

---

## Sources

- [Qwen3-TTS GitHub](https://github.com/QwenLM/Qwen3-TTS)
- [Qwen team on consistent voice](https://x.com/Alibaba_Qwen/status/2015073927564025899)
- [Qwen3-ForcedAligner-0.6B](https://huggingface.co/Qwen/Qwen3-ForcedAligner-0.6B)
- [Qwen3-TTS guide (DEV.to)](https://dev.to/czmilo/qwen3-tts-the-complete-2026-guide-to-open-source-voice-cloning-and-ai-speech-generation-1in6)
- [Microsoft VibeVoice GitHub](https://github.com/microsoft/VibeVoice)
- [VibeVoice-1.5B HuggingFace](https://huggingface.co/microsoft/VibeVoice-1.5B)
- [vLLM-Omni Qwen3-TTS docs](https://docs.vllm.ai/projects/vllm-omni/en/latest/user_guide/examples/online_serving/qwen3_tts/)
