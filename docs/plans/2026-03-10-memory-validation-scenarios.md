# ContextForge Memory & Validation: Reference Scenarios

Date: 2026-03-10

## Purpose

Four reference scenarios exploring how ContextForge's proposed memory system and validation pipeline work across different domains. These inform design decisions about data model, UI, and starter templates.

## Design Decisions (established before scenarios)

- **Memory is separate from blocks** — blocks = workspace (documents), memory = knowledge store (index cards)
- **User-defined memory types** via Memory Schemas with starter templates
- **Lightweight entries:** `{ type, title, content, tags }` (YAGNI)
- **Bottom drawer UI** for memory inventory (collapsed/peek/full states)
- **Validation = checklists** on workflow steps (acceptance criteria, required artifacts, must-answer questions)
- **Validation reads from memory** but doesn't write to it (orthogonal with read dependency)
- **A single Memory block** in PERMANENT zone renders relevant entries into LLM context

---

## Scenario 1: PM — Marina's Blockchain Loyalty Platform

**Who:** Marina, product manager. First blockchain project — she's learning the domain while designing the product.

**Project:** Loyalty platform for a retail chain, built on blockchain. Stakeholders include the CTO (pro-blockchain), CFO (skeptical of costs), and the retail ops team (need simplicity).

### Memory Types

| Type | Purpose | Example entries |
|------|---------|-----------------|
| `learning` | Domain concepts she's absorbing | "Gas fees — cost per transaction on-chain. Our target: <$0.01/txn. L2 rollups solve this." |
| `decision` | Choices made with rationale | "Use Polygon L2, not Ethereum mainnet. Reason: gas fees 100x cheaper, sufficient for loyalty points." |
| `stakeholder` | People and their positions | "CFO Andrei — skeptical of blockchain. Cares about: cost per txn, regulatory risk, fallback plan." |
| `tension` | Unresolved conflicts | "CTO wants on-chain point transfers. Retail ops says customers won't install a wallet app." |

### Session: Writing the IRD (Initial Requirements Document)

Marina loads "PM Document" session template:
- PERMANENT: PM persona system prompt
- STABLE: project brief, competitive analysis
- WORKING: IRD draft in progress

**Memory block renders:**

```
Project Memory (23 entries)
  learning (7)      -- "gas fees", "L2 rollups", "smart contracts" highlighted
  decision (5)      -- "Polygon L2", "custodial wallets" highlighted
  stakeholder (4)   -- all highlighted (IRD is for all stakeholders)
  tension (7)       -- "wallet UX" tension highlighted
```

**During the session:**

LLM drafts a section about "decentralized point redemption." Marina corrects:

> "Don't use 'decentralized' in stakeholder-facing docs. Andrei will flag it as risk. Say 'distributed ledger' and focus on the audit trail benefit, not the tech."

She opens the drawer, updates `stakeholder:andrei`:
```
Vocabulary: avoid "decentralized", "crypto", "token".
Use: "distributed ledger", "digital points", "audit trail".
```

And adds a new entry:
```
Type: learning
Title: Stakeholder communication framing
Content: Technical blockchain terms scare non-technical stakeholders.
         Reframe everything as business benefits:
         - "Immutable" → "tamper-proof audit trail"
         - "Smart contract" → "automated business rule"
         - "Gas fee" → "transaction processing cost"
Tags: #communication #stakeholders #blockchain
```

**Tension surfaces:**

The IRD needs to specify the point transfer mechanism. CTO wants peer-to-peer on-chain transfers. Retail ops says customers won't use wallet apps.

```
Type: tension
Title: Point transfer UX — on-chain vs custodial
Content: CTO wants on-chain P2P transfers (true to blockchain ethos).
         Retail ops needs phone-number-based transfers (customer simplicity).
         Possible compromise: custodial wallets with phone-number lookup,
         on-chain settlement behind the scenes.
Tags: #transfer #ux #cto #retail-ops
```

**Tension resolves next session:**

Marina discusses with CTO, agrees on custodial approach. She:
1. Changes tension to `decision`:
```
Type: decision
Title: Custodial wallets with phone-number transfers
Content: Customers get custodial wallets (no seed phrases, no app install).
         Transfer by phone number. On-chain settlement invisible to user.
         CTO accepted: "blockchain benefits without blockchain UX."
Tags: #transfer #ux #decided
```
2. Original tension archived (or deleted — lightweight, YAGNI).

### What this scenario reveals

1. **`learning` type is essential for unfamiliar domains** — Marina needs to accumulate blockchain knowledge across sessions. Without it, she re-explains context every time.
2. **`open_question` → `decision` lifecycle** — tensions and questions resolve into decisions. The type change IS the resolution. No workflow engine needed.
3. **Stakeholder entries calibrate tone** — "Don't say decentralized to Andrei" is a tiny entry with outsized impact. Similar to voice notes in fiction.
4. **Full project memory must be visible** — Marina needs to see ALL decisions when drafting the IRD, not just today's. Drawer must show full project, not session-scoped.

---

## Scenario 2: Game Designer — Yuki's Derivation Chain Pipeline

**Who:** Yuki, narrative game designer using the derivation chain pipeline (8 levels, L0-L7). Designing a branching-narrative mystery game.

**Project:** "Glass House" — a mystery game where player choices affect which suspects become available and which evidence is discoverable. Uses the derivation chain pipeline where each level derives from the previous.

### Pipeline Context

Based on the derivation chain pipeline from `pipeline-kit/PIPELINE.md`:
- **L0 Concept Seed** → L1 Core Pillars → L2 World Foundation → L3 Systems Design → L4 Narrative Framework → L5 Content Specs → L6 Production Guides → **L7 QA & Polish**
- Each level has entry questions (pre-validation) and produces artifacts
- Conflict Resolution sessions (C##) resolve tensions between levels
- Validation sessions (V##) verify coherence

### Memory Types

| Type | Purpose | Example entries |
|------|---------|-----------------|
| `lore_rule` | Established world facts | "Glass House has exactly 7 rooms. Each room connects to exactly 2 others (ring topology)." |
| `mechanic` | Game system decisions | "Evidence collection: player can hold max 3 evidence items. Must discard to pick up new." |
| `conflict_resolution` | Resolved cross-level conflicts | "C01: L3 wanted 12 suspects, L4 needs branching per suspect. Resolved: 6 suspects, 2 hidden." |
| `tension` | Unresolved design conflicts | "L5 needs 40 dialogue trees but L3's evidence system only supports 3 items — combinatorial explosion." |

### Session: L4 Narrative Framework

Yuki loads "Pipeline Level" session template:
- PERMANENT: game design advisor persona
- STABLE: L0-L3 summaries (derived from previous levels), pipeline rules
- WORKING: L4 narrative framework draft

**Memory block renders:**

```
Project Memory (34 entries)
  lore_rule (8)           -- "7 rooms ring topology", "1920s setting" highlighted
  mechanic (6)            -- "evidence cap: 3 items", "suspect availability" highlighted
  conflict_resolution (3) -- C01 highlighted (directly affects L4)
  tension (5)             -- "dialogue tree explosion" highlighted
```

**Pipeline validation as checklist:**

L4 entry questions (pre-checklist, from pipeline definition):
```
L4 Entry Checklist:
[x] L3 Systems Design complete and validated
[x] Core mechanics finalized (evidence, suspect, room systems)
[x] Conflict resolutions C01-C03 incorporated
[ ] All L3 mechanics have narrative hooks identified
```

The unchecked item surfaces a gap — Yuki needs to go back and identify narrative hooks before proceeding.

**During the session:**

LLM proposes a linear narrative with fixed suspect reveal order. Yuki corrects:

> "No. The whole point is player-driven discovery. The room they enter first determines which suspects are available. It's emergent from the topology, not scripted."

Adds to memory:
```
Type: lore_rule
Title: Emergent suspect availability
Content: Suspect availability is determined by room visit order.
         Each room "unlocks" its associated suspect(s).
         No scripted reveal sequence — it's emergent from player movement.
Tags: #suspects #narrative #L4 #foundational
```

**Cross-level tension:**

L5 content specs need 40+ dialogue trees (6 suspects x 7 rooms x varying evidence states). But L3's evidence cap of 3 items still creates combinatorial explosion.

```
Type: tension
Title: Dialogue tree combinatorial explosion
Content: 6 suspects x 3 evidence slots x variable evidence = hundreds of dialogue variants.
         Options:
         a) Reduce to key evidence only (3-4 items matter per suspect)
         b) Tiered responses (generic → specific based on evidence count)
         c) Procedural dialogue assembly from fragments
         Need C04 conflict resolution session.
Tags: #L4 #L5 #dialogue #scaling
```

Yuki schedules a conflict resolution session (C04). After resolving, the tension becomes:
```
Type: conflict_resolution
Title: C04 — Dialogue scaling via tiered responses
Content: Option (b) selected. Each suspect has 3 dialogue tiers:
         Tier 1 (0-1 evidence): generic deflection
         Tier 2 (2 evidence): hints and partial reveals
         Tier 3 (3 evidence, correct items): full confession/reveal
         Reduces dialogue trees from 400+ to 18 (6 suspects x 3 tiers).
Tags: #dialogue #scaling #L4 #L5 #resolved
```

### What this scenario reveals

1. **Pipeline levels define context loading** — what goes into STABLE zone depends on which level Yuki is working on. Memory entries tagged by level make this filterable.
2. **Validation is built into the pipeline** — entry questions = pre-checklist, coherence checks = post-checklist. Validation isn't separate, it's part of the workflow.
3. **Memory as distilled decisions across levels** — L4 doesn't re-read all of L3. It reads the memory entries that summarize L3's decisions. Memory is the compression layer.
4. **Conflict resolution is a side-session** — C04 is a separate session that reads tensions, resolves them, and writes `conflict_resolution` entries. The workflow is: tension → resolution session → resolved entry.
5. **Tensions as first-class entries** — They're not bugs or todos. They're design artifacts that drive the next session's agenda.

---

## Scenario 3: Book Writer — Sasha's Sci-Fi Novel

**Who:** Sasha, writing a hard sci-fi novel about a generation ship. 6 months in, 40 chapters planned, 18 drafted.

**Project:** "The Cartographer's Wake" — multi-POV generation ship story. Three timelines (launch, mid-voyage, arrival). Hard science constraints (no FTL, realistic biology). Publisher deadline in 4 months.

### Memory Types

| Type | Purpose | Example entries |
|------|---------|-----------------|
| `character` | Who they are, arc, voice notes | "Lien — chief cartographer, POV ch 1-8, speaks in clipped sentences, arc: duty->doubt->sacrifice" |
| `place` | Setting details, sensory palette | "Deck 7 Observatory — zero-g glass dome, smells of recycled air and warm metal, stars visible" |
| `lore_rule` | Hard-science constraints | "Ship max acceleration 0.3g sustained. No artificial gravity — spin sections only." |
| `plot_thread` | Active story threads | "Lien's maps show a navigation error — seeded ch 3, must resolve by ch 22" |
| `timeline` | Chronological anchors | "Year 47: water recycler failure -> rationing begins -> Deck 12 sealed" |
| `voice_note` | Stylistic decisions | "POV-Lien chapters use present tense. POV-Renn chapters use past." |
| `tension` | Unresolved contradictions | "Ch 14 says spin section is 200m radius, ch 6 implies 150m — need to reconcile" |

### Session: Drafting Chapter 19 (Renn's mutiny speech)

Sasha loads "Chapter Draft" session template:
- PERMANENT: novel assistant persona
- STABLE: chapter outline for ch 19, previous chapter summary
- WORKING: empty draft space

**Memory block renders:**

```
Project Memory (47 entries)
  character (8)    -- Renn, Lien, Okafor highlighted (tagged #ch19)
  place (6)        -- Cargo Bay 3 highlighted
  lore_rule (9)    -- "no comms between spin sections during rotation shift"
  plot_thread (7)  -- "Renn's faction" thread highlighted
  timeline (5)
  voice_note (4)   -- "POV-Renn: past tense, longer sentences, metaphors from engineering"
  tension (8)      -- "spin radius contradiction" still open
```

Sasha pins 3 entries to force-include them in context:
- `character:Renn` — full profile
- `plot_thread:mutiny_arc` — seeded clues and payoff timeline
- `voice_note:renn_voice` — tense/style guide

**During the session:**

LLM drafts Renn's speech. Sasha reads it.

> "Too eloquent. Renn is an engineer, not a politician. He'd use technical metaphors — pressure valves, structural failure, load-bearing walls. Also he wouldn't say 'we deserve better', he'd say 'the numbers don't work.'"

Sasha opens the drawer, edits `character:Renn`:
```
Speech patterns: technical metaphors (pressure, load, structural).
Never appeals to emotion — argues from data and engineering logic.
"The numbers don't work" > "we deserve better"
```

**Tension surfaces during drafting:**

LLM references Okafor being in the cargo bay, but Sasha remembers writing her into the med bay in ch 18.

```
Type: tension
Title: Okafor location ch18->ch19
Content: Ch 18 ends with Okafor in med bay treating burns.
         Ch 19 draft has her in cargo bay for Renn's speech.
         Need transition or time skip.
Tags: #okafor #continuity #ch18 #ch19
```

### What this scenario reveals

1. **Fiction memory types are deeply domain-specific** — `character`, `place`, `lore_rule` have no analog in PM or game design. Starter template: "Fiction" provides these defaults.
2. **Memory as continuity engine** — The #1 pain point for long-form fiction is contradictions across chapters. Tensions catch these in real-time. The `timeline` type provides chronological ground truth.
3. **Voice notes are calibration, not content** — They tell the LLM *how* to write, not *what* to write. Small entries, huge impact.
4. **Pinning = manual relevance override** — Auto-selection gets 80% right, but Sasha knows which memories matter for *this* chapter.
5. **Entry editing IS the workflow** — Sasha corrects the LLM, then immediately edits the memory entry. No extraction step, no staging area.
6. **Cross-chapter search is essential** — "Where did I establish the spin radius?" needs full-text search across all entries, filtered by type or tag.

---

## Scenario 4: System Architect — Dmitri's Event-Driven Platform

**Who:** Dmitri, principal architect at a fintech startup. Designing an event-driven payment processing platform. Team of 12 engineers across 4 squads.

**Project:** Migration from monolith to event-driven microservices on AWS. 14 services planned, 5 deployed, 9 in design/build. Compliance requirements (PCI-DSS, SOC2). 6-month roadmap.

### Memory Types

| Type | Purpose | Example entries |
|------|---------|-----------------|
| `service` | Service contract, ownership, dependencies | "payment-gateway — owns charge/refund flows, publishes PaymentCompleted, subscribes to FraudCheckResult, squad: Payments, runtime: ECS Fargate" |
| `event` | Event schema, producers, consumers | "PaymentCompleted v3 — produced by payment-gateway, consumed by ledger-service, notification-service, analytics. Schema: {paymentId, amount, currency, merchantId, timestamp}" |
| `decision` | ADRs (Architecture Decision Records) | "ADR-007: Use EventBridge over SNS+SQS for cross-domain events. Reason: schema registry, content-based filtering, archive/replay." |
| `constraint` | Non-negotiable requirements | "PCI-DSS: card data never persists outside payment-gateway. All inter-service communication uses tokenized references." |
| `infra_pattern` | Reusable infrastructure patterns | "Dead letter queue pattern: every SQS consumer gets a DLQ with 3 retries, alarm at >0 messages, Lambda for reprocessing." |
| `tension` | Unresolved architecture conflicts | "ledger-service needs synchronous balance check but we committed to async-first. Saga vs. dual-write vs. CQRS read model?" |
| `squad_context` | Team-specific knowledge | "Squad Payments: 3 engineers, strong on Go, weak on IaC. Shield from CDK complexity — give them pre-built constructs." |

### Session: Designing the Refund Service

Dmitri loads "Service Design" session template:
- PERMANENT: architecture advisor persona
- STABLE: platform event catalog (auto-generated from `event` entries), service dependency map
- WORKING: refund service design doc in progress

**Memory block renders:**

```
Project Memory (63 entries)
  service (5/14)   -- payment-gateway, ledger-service highlighted (direct dependencies)
  event (12)       -- PaymentCompleted, RefundRequested highlighted
  decision (9)     -- ADR-007 (EventBridge), ADR-003 (saga pattern) highlighted
  constraint (6)   -- PCI-DSS tokenization, SLA: refund < 30s highlighted
  infra_pattern (4) -- DLQ pattern, circuit breaker highlighted
  tension (8)      -- "sync balance check" still open
  squad_context (4) -- Squad Payments highlighted (owners)
```

Dmitri pins:
- `service:payment-gateway` — contract and event list
- `decision:ADR-003` — saga pattern for multi-step flows
- `constraint:pci-tokenization` — hard boundary

**During the session:**

LLM proposes a refund flow with direct DB read from payment-gateway's database.

> "No. Services never read each other's databases. That's the whole point. Refund-service subscribes to PaymentCompleted events and maintains its own read model. Add this as a constraint."

Dmitri opens the drawer, adds:
```
Type: constraint
Title: No cross-service DB access
Content: Services NEVER read another service's database directly.
         Each service maintains its own read model from events.
         This is non-negotiable — it's the core architectural boundary.
Tags: #data-ownership #microservices #foundational
```

**LLM proposes retry logic inline in the handler:**

> "We have a pattern for this. Use the DLQ pattern from infra_patterns. Don't reinvent it."

Dmitri doesn't need to re-explain — the pinned `infra_pattern:dlq` entry already has the full specification. The LLM regenerates using the established pattern.

**Tension surfaces:**

The refund flow needs to verify the current ledger balance before processing. But ADR-007 says async-first.

```
Type: tension
Title: Refund balance verification — sync vs async
Content: Refund-service needs current balance from ledger before processing.
         Options:
         a) Sync API call to ledger-service (violates async-first)
         b) CQRS read model in refund-service (eventual consistency risk)
         c) Saga with reservation pattern (complex but correct)
         Related: existing tension "sync balance check" from ledger design
Tags: #refund #ledger #consistency #saga
```

**After resolving (next session):**

Dmitri picks option (c), resolves both tensions, and creates:
```
Type: decision
Title: ADR-012: Reservation saga for balance-dependent operations
Content: Any operation requiring current balance uses a reservation saga:
         1. Request reservation -> ledger-service
         2. Ledger publishes ReservationConfirmed/ReservationDenied
         3. Proceed or compensate based on response
         Timeout: 5s -> auto-compensate
         Applies to: refund-service, payout-service, transfer-service
Tags: #saga #consistency #ledger #foundational
```

### What this scenario reveals

1. **Events are first-class memory** — In event-driven systems, the event catalog IS the architecture. An `event` type with schema, producers, consumers replaces diagrams that go stale.
2. **Constraints prevent repeated mistakes** — "No cross-service DB access" was explained once, stored as a constraint, never violated again. Small entries, huge leverage.
3. **Infra patterns = reusable building blocks** — DLQ pattern, circuit breaker, saga template. The LLM applies them consistently without re-explanation. Similar to `voice_note` in fiction — calibration, not content.
4. **Tensions link across services** — The balance check tension appeared in both ledger and refund design sessions. Tags + cross-entry references surface the full picture.
5. **Decisions (ADRs) are the output of resolved tensions** — `tension` -> `decision` lifecycle is the same as Marina's `open_question` -> `decision`. Universal pattern.
6. **Squad context prevents impractical designs** — The LLM doesn't know team capabilities. `squad_context` entries calibrate suggestions to what each team can actually build.
7. **Memory as living documentation** — Event catalog, service contracts, and ADRs in memory replace the wiki pages that nobody updates. Entries stay current because they're used every session.

---

## Cross-Scenario Analysis

### Memory types by domain

| Finding | PM (Marina) | Game Designer (Yuki) | Book Writer (Sasha) | System Architect (Dmitri) |
|---------|-------------|---------------------|---------------------|--------------------------|
| Type count | 4 | 4 | 7 | 7 |
| `tension` type | Yes | Yes | Yes | Yes |
| `decision`/`lore_rule` | decision | lore_rule | lore_rule | decision |
| Domain-specific | learning, stakeholder | mechanic, conflict_res | character, place, voice_note, plot_thread, timeline | service, event, infra_pattern, constraint, squad_context |
| Entry-to-entry links | Rare | By level | By chapter | By service dependency + tag |
| Validation style | Deliverable criteria | Pipeline entry/exit | Continuity checks | Service design checklist |

### Universal patterns

1. **`tension` is universal** — every domain has unresolved contradictions. Include in all starter templates.
2. **Tension -> resolution lifecycle** — tensions resolve into decisions, lore rules, conflict resolutions. The type change IS the resolution. No workflow engine needed.
3. **Drawer shows full project memory** — never session-scoped. All four users need cross-session visibility.
4. **User-defined types with starter templates** — PM needs 4 types, fiction needs 7. No single schema works.
5. **Pinning = manual relevance override** — essential for game design and fiction, useful for PM and architecture.
6. **Tags create cross-cutting views** — `#ch19`, `#L3`, `#stakeholder:board`, `#saga` all slice differently than types.
7. **Search across all entries** — full-text + filtered by type/tag. The drawer needs a search bar.
8. **Entry editing is lightweight** — open, edit, save. No approval workflow, no staging.
9. **Small calibration entries have outsized impact** — voice notes, stakeholder vocabulary, squad capabilities, constraints. Tiny entries that prevent entire categories of mistakes.
10. **Memory replaces stale documentation** — entries stay current because they're used every session, unlike wikis that rot.

### Starter templates

| Template | Types included |
|----------|---------------|
| General | `note`, `decision`, `tension` |
| Fiction | `character`, `place`, `lore_rule`, `plot_thread`, `timeline`, `voice_note`, `tension` |
| PM | `learning`, `decision`, `stakeholder`, `tension` |
| Game Design | `lore_rule`, `mechanic`, `conflict_resolution`, `tension` |
| System Architecture | `service`, `event`, `decision`, `constraint`, `infra_pattern`, `tension`, `squad_context` |
| Dev (software project) | `decision`, `constraint`, `pattern`, `tension` |
