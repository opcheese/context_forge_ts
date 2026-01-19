# Design by Contract (DbC) for Convex

Proposal for porting the Python context_manager DbC patterns to ContextForgeTS.

---

## Python Implementation Summary

The Python library uses a decorator-based DbC system:

```python
# Contract class defines rules
class ZoneContract:
    @staticmethod
    def preconditions(self, name, budget_tokens, ...):
        assert budget_tokens > 0, "Budget must be positive"

    @staticmethod
    def postconditions(self, result, old_state):
        assert self.total_tokens == 0, "New zone starts empty"

    @staticmethod
    def invariants(self):
        assert self.total_tokens <= self.budget_tokens, "Budget not exceeded"
        block_sum = sum(b.current_tokens for b in self.blocks)
        assert block_sum == self.total_tokens, "Token sum matches"

# Decorator applies contracts
@with_contracts(enabled=True)
async def add(self, content):
    # Implementation
```

**Key patterns:**
1. **Preconditions** - Validate inputs before execution
2. **Postconditions** - Verify results and state changes after execution
3. **Invariants** - Rules that must always be true
4. **State capture** - Snapshot state before execution for comparison
5. **Contract registry** - Central lookup of contracts by method name

---

## Convex Considerations

Convex differs from typical Python backends:

| Aspect | Python | Convex |
|--------|--------|--------|
| Function wrapping | Custom decorators | `query()`, `mutation()`, `action()` wrappers |
| Input validation | Runtime assertions | `v.*` validators (compile-time + runtime) |
| Database access | ORM/direct | `ctx.db` with typed queries |
| State | In-memory objects | Database documents |
| Transactions | Manual | Automatic (mutations are transactional) |

**Convex advantages:**
- Validators already provide precondition-like input checking
- Transactions ensure atomic state changes
- TypeScript provides compile-time type safety

**Challenges:**
- No decorator syntax like Python's `@with_contracts`
- State is in database, not in-memory objects
- Need to query before/after to compare state

---

## Proposed Implementation

### Level 1: Validator-Based Preconditions (Already Have)

Convex validators are preconditions:

```typescript
// convex/blocks.ts
export const create = mutation({
  args: {
    sessionId: v.id("sessions"),      // Must be valid session ID
    content: v.string(),               // Must be string
    zone: zoneValidator,               // Must be PERMANENT|STABLE|WORKING
  },
  handler: async (ctx, args) => {
    // If we get here, preconditions passed
  },
})
```

**Already enforced:**
- Type validation
- Enum membership
- ID reference validity

### Level 2: Custom Preconditions

For business logic preconditions that validators can't express:

```typescript
// convex/lib/contracts.ts
import type { MutationCtx, QueryCtx } from "../_generated/server"

export class ContractViolationError extends Error {
  constructor(
    public contract: string,
    public violation: string,
    public context?: Record<string, unknown>
  ) {
    super(`Contract "${contract}" violated: ${violation}`)
    this.name = "ContractViolationError"
  }
}

// Precondition helper
export function require(
  condition: boolean,
  contract: string,
  message: string
): asserts condition {
  if (!condition) {
    throw new ContractViolationError(contract, message)
  }
}

// Usage in mutation
export const move = mutation({
  args: {
    id: v.id("blocks"),
    zone: zoneValidator,
  },
  handler: async (ctx, args) => {
    const block = await ctx.db.get(args.id)

    // Preconditions
    require(block !== null, "MoveBlock", `Block ${args.id} not found`)
    require(
      block.zone !== "PERMANENT",
      "MoveBlock",
      "Cannot move block out of PERMANENT zone (immutable)"
    )

    // ... rest of implementation
  },
})
```

### Level 3: Postconditions with State Capture

For verifying state changes:

```typescript
// convex/lib/contracts.ts

interface StateSnapshot {
  blockCount: number
  totalTokens: number
  zoneBlocks: Record<string, number>
}

export async function captureState(
  ctx: QueryCtx | MutationCtx,
  sessionId: Id<"sessions">
): Promise<StateSnapshot> {
  const blocks = await ctx.db
    .query("blocks")
    .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
    .collect()

  const zoneBlocks: Record<string, number> = { PERMANENT: 0, STABLE: 0, WORKING: 0 }
  let totalTokens = 0

  for (const block of blocks) {
    zoneBlocks[block.zone]++
    totalTokens += block.tokens ?? 0
  }

  return {
    blockCount: blocks.length,
    totalTokens,
    zoneBlocks,
  }
}

export function ensurePostcondition(
  condition: boolean,
  contract: string,
  message: string,
  oldState?: StateSnapshot,
  newState?: StateSnapshot
): void {
  if (!condition) {
    throw new ContractViolationError(contract, message, {
      oldState,
      newState,
    })
  }
}

// Usage
export const deleteBlock = mutation({
  args: { id: v.id("blocks") },
  handler: async (ctx, args) => {
    const block = await ctx.db.get(args.id)
    require(block !== null, "DeleteBlock", "Block not found")

    const oldState = await captureState(ctx, block.sessionId)

    await ctx.db.delete(args.id)

    // Postcondition: block count decreased by 1
    const newState = await captureState(ctx, block.sessionId)
    ensurePostcondition(
      newState.blockCount === oldState.blockCount - 1,
      "DeleteBlock",
      `Expected ${oldState.blockCount - 1} blocks, got ${newState.blockCount}`,
      oldState,
      newState
    )
  },
})
```

### Level 4: Invariants

Invariants should be checked after every mutation. We can create a wrapper:

```typescript
// convex/lib/contracts.ts

export interface InvariantCheck {
  name: string
  check: (ctx: MutationCtx, sessionId: Id<"sessions">) => Promise<boolean>
  message: (ctx: MutationCtx, sessionId: Id<"sessions">) => Promise<string>
}

export const SESSION_INVARIANTS: InvariantCheck[] = [
  {
    name: "BLOCK_COUNT_MATCHES_ZONES",
    check: async (ctx, sessionId) => {
      const blocks = await ctx.db
        .query("blocks")
        .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
        .collect()

      const byZone = { PERMANENT: 0, STABLE: 0, WORKING: 0 }
      for (const b of blocks) byZone[b.zone as keyof typeof byZone]++

      return (
        byZone.PERMANENT + byZone.STABLE + byZone.WORKING === blocks.length
      )
    },
    message: async () => "Block count doesn't match zone totals",
  },
  {
    name: "POSITIONS_ARE_SEQUENTIAL",
    check: async (ctx, sessionId) => {
      for (const zone of ["PERMANENT", "STABLE", "WORKING"] as const) {
        const blocks = await ctx.db
          .query("blocks")
          .withIndex("by_session_zone", (q) =>
            q.eq("sessionId", sessionId).eq("zone", zone)
          )
          .collect()

        const positions = blocks.map((b) => b.position).sort((a, b) => a - b)
        // Check for gaps (allowing fractional positions)
        // For strict sequential: positions[i] === i
      }
      return true
    },
    message: async () => "Position gaps detected in zone",
  },
  {
    name: "NO_ORPHAN_BLOCKS",
    check: async (ctx, sessionId) => {
      const session = await ctx.db.get(sessionId)
      return session !== null
    },
    message: async () => "Blocks exist for non-existent session",
  },
]

export async function checkInvariants(
  ctx: MutationCtx,
  sessionId: Id<"sessions">,
  invariants: InvariantCheck[] = SESSION_INVARIANTS
): Promise<void> {
  for (const inv of invariants) {
    const passed = await inv.check(ctx, sessionId)
    if (!passed) {
      const message = await inv.message(ctx, sessionId)
      throw new ContractViolationError(inv.name, message)
    }
  }
}
```

### Level 5: Contract-Wrapped Mutations

A higher-order function that wraps mutations with full DbC:

```typescript
// convex/lib/contracts.ts

interface ContractedMutationOptions<Args, Result> {
  args: Args
  preconditions?: (ctx: MutationCtx, args: Args) => Promise<void>
  handler: (ctx: MutationCtx, args: Args) => Promise<Result>
  postconditions?: (
    ctx: MutationCtx,
    args: Args,
    result: Result,
    oldState: StateSnapshot
  ) => Promise<void>
  getSessionId: (args: Args) => Id<"sessions">
  checkInvariants?: boolean
}

export function contractedMutation<Args, Result>(
  options: ContractedMutationOptions<Args, Result>
) {
  return mutation({
    args: options.args,
    handler: async (ctx, args) => {
      // 1. Run preconditions
      if (options.preconditions) {
        await options.preconditions(ctx, args)
      }

      // 2. Capture old state
      const sessionId = options.getSessionId(args)
      const oldState = await captureState(ctx, sessionId)

      // 3. Execute handler
      const result = await options.handler(ctx, args)

      // 4. Run postconditions
      if (options.postconditions) {
        await options.postconditions(ctx, args, result, oldState)
      }

      // 5. Check invariants
      if (options.checkInvariants !== false) {
        await checkInvariants(ctx, sessionId)
      }

      return result
    },
  })
}
```

**Usage:**

```typescript
// convex/blocks.ts
import { contractedMutation, require } from "./lib/contracts"

export const move = contractedMutation({
  args: {
    id: v.id("blocks"),
    zone: zoneValidator,
  },

  preconditions: async (ctx, args) => {
    const block = await ctx.db.get(args.id)
    require(block !== null, "MoveBlock.PRE", "Block not found")
    require(
      block.zone !== "PERMANENT",
      "MoveBlock.PRE",
      "Cannot move from PERMANENT zone"
    )
  },

  handler: async (ctx, args) => {
    const block = await ctx.db.get(args.id)!
    const position = await getNextPosition(ctx, block.sessionId, args.zone)

    await ctx.db.patch(args.id, {
      zone: args.zone,
      position,
      updatedAt: Date.now(),
    })

    return args.id
  },

  postconditions: async (ctx, args, result, oldState) => {
    const block = await ctx.db.get(args.id)
    ensurePostcondition(
      block?.zone === args.zone,
      "MoveBlock.POST",
      `Block zone should be ${args.zone}, got ${block?.zone}`
    )
  },

  getSessionId: async (ctx, args) => {
    const block = await ctx.db.get(args.id)
    return block!.sessionId
  },

  checkInvariants: true,
})
```

---

## Contract Categories for ContextForge

Based on the Python library, here are the contracts we should implement:

### Block Contracts

| Contract | Type | Rule |
|----------|------|------|
| BlockExists | PRE | Block ID must exist in database |
| BlockNotPermanent | PRE | Cannot modify PERMANENT zone blocks |
| BlockInOneZone | INV | Each block belongs to exactly one zone |
| PositionsSequential | INV | Positions within zone have no gaps |

### Session Contracts

| Contract | Type | Rule |
|----------|------|------|
| SessionExists | PRE | Session ID must exist |
| NoOrphanBlocks | INV | All blocks belong to existing session |

### Generation Contracts

| Contract | Type | Rule |
|----------|------|------|
| GenerationExists | PRE | Generation ID must exist |
| GenerationNotComplete | PRE | Cannot append to completed generation |
| TextOnlyGrows | INV | Generation text length never decreases |

### Budget Contracts (Future)

| Contract | Type | Rule |
|----------|------|------|
| ZoneBudgetNotExceeded | INV | Zone tokens ≤ zone budget |
| TotalBudgetNotExceeded | INV | Total tokens ≤ max budget |
| TokenSumMatches | INV | Sum of block tokens = zone total |

---

## Implementation Plan

### Phase 1: Core Infrastructure
- [ ] Create `convex/lib/contracts.ts`
- [ ] Implement `ContractViolationError`
- [ ] Implement `require()` helper
- [ ] Implement `captureState()` and `ensurePostcondition()`

### Phase 2: Apply to Existing Mutations
- [ ] Add preconditions to `blocks.move`
- [ ] Add preconditions to `blocks.reorder`
- [ ] Add postconditions to `blocks.create`
- [ ] Add postconditions to `blocks.remove`

### Phase 3: Invariants
- [ ] Implement invariant checkers
- [ ] Add invariant checks to mutations (dev mode only?)
- [ ] Create test suite for invariants

### Phase 4: contractedMutation Wrapper
- [ ] Implement wrapper function
- [ ] Migrate existing mutations
- [ ] Add performance toggle (disable in production?)

---

## Performance Considerations

DbC adds overhead:
- **State capture**: Extra queries before/after
- **Invariant checks**: Multiple queries per mutation

**Recommendations:**
1. **Development mode only**: Full checks in dev, minimal in prod
2. **Selective invariants**: Only check invariants affected by mutation
3. **Lazy evaluation**: Only capture state if postconditions defined
4. **Configurable**: Environment variable to toggle

```typescript
const DBC_ENABLED = process.env.NODE_ENV === "development"

export async function checkInvariants(...) {
  if (!DBC_ENABLED) return
  // ... checks
}
```

---

## Testing DbC

```typescript
// convex/tests/contracts.test.ts
import { convexTest } from "convex-test"
import { expect, test } from "vitest"

test("MoveBlock precondition: block must exist", async () => {
  const t = convexTest(schema)

  await expect(
    t.mutation(api.blocks.move, {
      id: "invalid_id" as Id<"blocks">,
      zone: "STABLE",
    })
  ).rejects.toThrow("Block not found")
})

test("MoveBlock precondition: cannot move from PERMANENT", async () => {
  const t = convexTest(schema)

  const sessionId = await t.mutation(api.sessions.create, {})
  const blockId = await t.mutation(api.blocks.create, {
    sessionId,
    content: "Test",
    type: "text",
    zone: "PERMANENT",
  })

  await expect(
    t.mutation(api.blocks.move, { id: blockId, zone: "STABLE" })
  ).rejects.toThrow("Cannot move from PERMANENT zone")
})

test("Invariant: block in exactly one zone", async () => {
  const t = convexTest(schema)
  // ... test that invariant holds after operations
})
```

---

## Summary

| Python Pattern | Convex Equivalent |
|----------------|-------------------|
| `@with_contracts` decorator | `contractedMutation()` wrapper |
| `assert` in preconditions | `require()` helper |
| State capture | `captureState()` query |
| `postconditions(result, old_state)` | `ensurePostcondition()` |
| `invariants()` | `checkInvariants()` |
| Contract registry | Direct import (TypeScript modules) |
| `ContractViolationError` | Same (ported class) |

The approach preserves the Python library's DbC philosophy while adapting to Convex's function-based architecture.
