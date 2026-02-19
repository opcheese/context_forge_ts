# User Research Synthesis — 2026-02-19

## Context

ContextForge has shipped all core features (slices 1-5.9) and significant polish. Before deciding what to build next, we synthesized all available user feedback and market context to ground prioritization in evidence rather than builder instinct.

## Data Sources

- Developer (product owner) expressed needs and daily usage patterns
- PM feedback batch: 7 items from structured testing session (Russian, translated)
- PM behavioral patterns observed over multiple sessions
- Market analysis: MCP, OpenAI, agent frameworks, context window trends

---

## Personas

### Persona 1: "The Craftsman" (Developer / Power User)

**Who:** Technical founder using ContextForge daily for real work. Deep understanding of LLMs, context windows, and caching. Runs multiple sessions simultaneously. Has all providers configured.

**Jobs to be done:**
- Manage complex, evolving reference material across related sessions
- Get maximum quality from LLM interactions through careful context curation
- Iterate on prompts/guidelines and have changes propagate

**Key pain points:**
- Content drift across sessions (same guideline diverges in different sessions)
- Token budgets don't inform decisions (numbers exist but don't guide action)

**What they value:** Elegance, architectural integrity, tools that compose naturally.

### Persona 2: "The Workflow User" (PM / Non-Technical)

**Who:** Non-technical knowledge worker using ContextForge for structured document creation. Follows workflows, doesn't build them. Needs guidance, not flexibility.

**Jobs to be done:**
- Follow a multi-step workflow to produce documents (skills, specs, guides)
- Include the right reference material without understanding zones/tokens
- Iterate on outputs with LLM without losing context

**Key pain points:**
- Doesn't understand the zone model intuitively
- Can't figure out workflows without hand-holding
- Templates capture junk from WORKING zone
- Can't reference other files during brainstorm

**What they value:** Clear paths, sensible defaults, not having to think about plumbing.

**Critical observation:** 5 of 7 PM feedback items were about workflow friction, not missing features. The PM doesn't need more capabilities — they need the existing ones to be more guided and forgiving.

### Persona 3: "The Explorer" (Hypothetical OSS User)

**Who:** Developer who finds ContextForge on GitHub, wants to try it for their own LLM workflow.

**Predicted pain points:**
- "I only have an OpenAI key" — OpenRouter requires a separate account
- "What is this tool actually for?" — README explains *what* not *why*
- Setup requires Convex account + provider config — high barrier

**Status:** Hypothetical. No evidence this persona exists yet. Build for Personas 1 and 2 first.

---

## Themes

### Theme 1: Built for Persona 1, needs Persona 2

Every feature works well for someone who understands the model. The PM's feedback is almost entirely about missing guardrails and guidance, not missing features. The path wasn't obvious, defaults were wrong, the modal blocked natural flow, they needed a way to experiment without consequences.

**Implication:** Highest-impact work for Persona 2 is making existing features more forgiving, not building new ones.

### Theme 2: Linked blocks solves a real Persona 1 problem; Persona 2 benefits indirectly

The PM never asked for linked blocks. They asked for "shared files across workflow levels" — related but simpler. Linked blocks is architecturally elegant and solves content drift, but the PM's version of this need is: "when I start a new workflow step, my guidelines should already be there and up to date."

**Implication:** Linked blocks is correct. But the Persona 2 benefit should be invisible — it should "just happen" via workflow carry-forward, not require manual linking.

### Theme 3: Token budgets are decorative

Both personas see token numbers but neither acts on them. The Craftsman knows they're placeholders. The Workflow User probably ignores them entirely.

**Implication:** Two different fixes:
- Persona 1: Configurable budgets, warnings that suggest actions ("Compress 3 blocks to free 12K tokens"), model-aware defaults
- Persona 2: Hide complexity. Show "Context: 60% full" instead of "23.4K / 50K". Suggest actions in plain language.

### Theme 4: Provider breadth matters for Persona 3, not Personas 1 & 2

OpenRouter already gives access to 100+ models including OpenAI. Adding a direct OpenAI provider removes "create an OpenRouter account" friction but adds zero capability.

**Implication:** Direct OpenAI provider is a growth/adoption play, not a product value play. Only if actively growing the user base.

### Theme 5: MCP and agents are a distraction

MCP is about giving LLMs access to external tools. ContextForge is about giving humans control over what context goes into LLM interactions. Complementary but different. Agent frameworks solve autonomous multi-step workflows; ContextForge's workflows are human-directed.

**Implication:** Don't chase. The defensible niche is "best tool for humans curating LLM context." Make that excellent.

---

## Opportunity Ranking

| # | Opportunity | Personas | Frequency | Severity | Evidence | Verdict |
|---|-------------|----------|-----------|----------|----------|---------|
| 1 | Linked blocks | P1 direct, P2 via workflows | Daily | High | Strong — expressed, designed | **Build now** |
| 2 | Token budgets: make useful | P1 direct, P2 simplified | Every session | Medium | Medium — stated | **Build next** |
| 3 | Template zone filtering | P2 direct | Every template save | Medium | Strong — PM request | **Build soon** (1 day) |
| 4 | Onboarding / guided flows | P2, P3 | First-use | High | Strong — 5/7 items | **Plan carefully** |
| 5 | Direct OpenAI provider | P3 only | One-time | Low | Weak — hypothetical | **Later** |
| 6 | Marketplace improvements | P3 | Occasional | Low | Weak — no user base yet | **Later** — backend exists, grow users first |
| 7 | MCP integration | None | N/A | N/A | None | **Don't build** |
| 8 | Agent/autonomous features | None | N/A | N/A | None | **Don't build** |

---

## Strategic Recommendations

1. **Build for users you have** (Personas 1 and 2), not hypothetical users (Persona 3).
2. **Linked blocks is the right anchor** — with the caveat that Persona 2 benefits should come through automatic workflow carry-forward, not manual linking.
3. **Deepen the core, don't chase trends.** MCP, agents, and direct OpenAI add complexity without serving current users.
4. **Next after linked blocks:** make token budgets actionable, then template zone filtering.
5. **Explicitly won't build:** MCP integration, agent features, direct OpenAI/Anthropic providers, full design system overhaul. Marketplace backend exists — defer UI polish until user base grows.
