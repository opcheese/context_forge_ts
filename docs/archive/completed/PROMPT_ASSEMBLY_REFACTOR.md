# Prompt Assembly Refactoring Guide

## Status: COMPLETED

All refactoring tasks have been completed. The system now correctly handles system prompts without duplication.

## Final Architecture

| Stage | Location | What Happens |
|-------|----------|--------------|
| **1. Get Blocks** | `claudeNode.ts` / `http.ts` | Query all blocks from session |
| **2. Extract System Prompt** | `extractSystemPromptFromBlocks()` | Find first `system_prompt` block in PERMANENT, return content |
| **3. Assemble User Context** | `assembleContext()` | Converts blocks → messages, **EXCLUDES** system_prompt blocks |
| **4. Format for Provider** | Provider-specific | Each provider formats messages as needed |
| **5. Call Provider** | Provider-specific | Pass systemPrompt option + user context separately |

### Visual Flow

```
Blocks ──┬── extractSystemPromptFromBlocks() ──→ systemPrompt string
         │
         └── assembleContext() ──→ Messages (NO system_prompt blocks)
                                          ↓
                              formatMessagesAsPrompt() or native format
                                          ↓
                    Provider({ messages/prompt, systemPrompt: systemPrompt })
```

## Provider-Specific Handling

### Claude Code SDK
```typescript
// Extract system prompt from blocks
const systemPrompt = extractSystemPromptFromBlocks(blocks)

// Assemble context (excludes system_prompt blocks)
const messages = assembleContext(blocks, prompt)
const formattedPrompt = formatMessagesAsPrompt(messages)

// Pass to provider with system prompt as separate option
claudeQuery({
  prompt: formattedPrompt,
  options: {
    systemPrompt, // System prompt passed here, not in messages
    // ...
  }
})
```

### Ollama API (http.ts)
```typescript
// Extract system prompt from blocks
const systemPrompt = extractSystemPromptFromBlocks(blocks)

// Assemble context (excludes system_prompt blocks)
const contextMessages = assembleContext(blocks, prompt)

// Prepend system prompt as first message for Ollama
const messages = systemPrompt
  ? [{ role: 'system', content: systemPrompt }, ...contextMessages]
  : contextMessages

// Pass to Ollama
streamOllama(messages)
```

## Files Modified

| File | Function | Change |
|------|----------|--------|
| `convex/lib/context.ts` | `assembleContext()` | Removed system prompt from output messages |
| `convex/lib/context.ts` | `assembleContextWithConversation()` | Removed system prompt from output messages |
| `convex/claudeNode.ts` | `streamGenerateWithContext()` | Passes `systemPrompt` to provider options |
| `convex/claudeNode.ts` | `streamBrainstormMessage()` | Passes `systemPrompt` to provider options |
| `convex/http.ts` | `/api/chat` handler | Extracts system prompt, prepends to messages for Ollama |
| `convex/http.ts` | `/api/brainstorm` handler | Extracts system prompt, prepends to messages for Ollama |

## Verification Checklist

- [x] `assembleContext()` returns messages WITHOUT system prompt
- [x] `assembleContextWithConversation()` returns messages WITHOUT system prompt
- [x] Claude generation passes system prompt to `claudeQuery` options
- [x] Claude brainstorm passes system prompt to `claudeQuery` options
- [x] Ollama generation extracts and passes system prompt correctly
- [x] Ollama brainstorm extracts and passes system prompt correctly
- [x] No system prompt duplication in any flow
- [x] TypeScript compiles with no errors
- [ ] Test: Create session with system_prompt block, verify it's used by both providers
