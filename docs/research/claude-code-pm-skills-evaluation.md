# Claude Code Skills for Project Management: Honest Evaluation

## TL;DR
A curated, quality-vetted guide to Claude Code skills useful for PM work. We read the actual SKILL.md files and evaluated substance, domain expertise, methodology, and writing quality. Many community skills are thin LLM-generated wrappers — this guide separates wheat from chaff.

## Evaluation Criteria
- **Substance**: Is this a real methodology or a thin prompt wrapper?
- **Domain expertise**: Does it show practitioner knowledge or generic LLM fluff?
- **Methodology**: Are the frameworks correctly implemented and sound?
- **Writing quality**: Human-authored expertise vs LLM-generated slop?
- **Usefulness**: Would an experienced PM (5+ years) find this valuable?

## Tier 1: Genuinely Excellent (Worth Installing Immediately)

### rjs/shaping-skills — 9/10
**URL**: https://github.com/rjs/shaping-skills
**Skills**: shaping, breadboarding, breadboard-reflection
**Lines**: ~800-900 across all files

By someone who deeply understands Shape Up methodology. Every line does work — no filler. The notation system (R for requirements, A/B/C for shapes) is precise and internally consistent. The "flagged unknown" concept (marking mechanisms you know WHAT but not HOW, which automatically fail fit checks) shows genuine methodological rigor.

Key strengths:
- Binary fit checks prevent false confidence — no "partial" status allowed
- Anti-tautology rule: "R states the need, S describes the mechanism — if they say the same thing, the shape part isn't adding information"
- Multi-level consistency principle (changes ripple between docs)
- Chunking policy ("never more than 9 top-level requirements") shows cognitive load awareness
- The author is transparent about where LLM helped (README) vs didn't (SKILL.md files)

**Best for**: Early project scoping, problem definition, solution shaping
**Skip if**: You don't use Shape Up methodology

### anthropics/knowledge-work-plugins (Product Management plugin) — 8/10
**URL**: https://github.com/anthropics/knowledge-work-plugins
**Skills**: feature-spec, roadmap-management, user-research-synthesis, competitive-analysis, stakeholder-comms, metrics-tracking
**Lines**: ~3000-4000 across PM plugin

Anthropic's official PM toolkit. Comprehensive and correct. The advice reflects genuine operational experience: "engineers spend 60-70% of time on planned feature work", "Cancel standup if there is nothing to sync on. Respect people's time." The roadmap skill covers 4 frameworks (Now/Next/Later, Quarterly Themes, OKR-Aligned, Timeline/Gantt) with honest guidance on when each works.

Key strengths:
- Each skill covers its domain with structured thoroughness
- Practical wisdom: "A comparison that always shows you winning is not credible"
- "Do not solve capacity problems by pretending people can do more — solve by cutting scope"
- Audience-specific stakeholder comms templates (exec vs engineering vs cross-functional)
- User research synthesis with qual-quant integration methodology

**Best for**: Day-to-day PM reference, structured templates, stakeholder communication
**Skip if**: You need deep methodology in any single area (this is wide, not deep)

### deanpeters/Product-Manager-Skills (Top 5 skills) — A to A-
**URL**: https://github.com/deanpeters/Product-Manager-Skills
**Stars**: 31 | **Skills total**: 42 | **License**: CC BY-NC-SA 4.0

NOT all 42 skills are equal. The top 5 are genuinely excellent, the rest range from decent to thin. Here are the ones worth installing:

#### prd-development — Grade A (~650 lines)
The most comprehensive skill in the set. 8 phases across 2-4 days with specific time allocations. Orchestrates proto-persona, problem-statement, epic-hypothesis, and user-story skills into a coherent end-to-end PRD workshop. The worked example (onboarding checklist for small business owners) is realistic and internally consistent. References Martin Eriksson, Marty Cagan, and Amazon's Working Backwards. The fast track / typical / complex timeline distinctions show practical experience.

#### epic-breakdown-advisor — Grade A (~575 lines)
Implements Richard Lawrence's Humanizing Work methodology as an interactive facilitated session. 9 splitting patterns applied sequentially with diagnostic questions and right/wrong examples. The "meta-pattern" (identify core complexity → list variations → reduce to one complete slice → make others separate stories) is a genuine insight. The distinction between "thin end-to-end slices" (correct) and "step-by-step splitting" (incorrect) is subtle but critical — most generic advice gets this wrong. Cynefin domain consideration is a sophisticated touch.

#### discovery-process — Grade A (~325 lines)
A 6-phase workflow (Frame Problem → Research Planning → Conduct Research → Synthesize → Generate & Validate → Decide & Document) with 2-4 week timeline. Phase 3 emphasizes past behavior over hypotheticals. Phase 4 uses affinity mapping with saturation criteria ("same pain points emerge across 3+ interviews"). Forces a GO/PIVOT/KILL decision at the end — prevents "discovery theater" where research never leads to action. References Teresa Torres, Rob Fitzpatrick (The Mom Test), and Marty Cagan.

#### customer-journey-map — Grade A- (~425 lines)
Covers 5 stages × 6 vertical dimensions including KPIs and business goals alongside emotional mapping. Goes beyond basic UX-only journey mapping. Quality checks are specific: "Not 'social media' but 'LinkedIn Ads,' 'Twitter mentions'". NNGroup framework correctly implemented.

#### user-story-mapping — Grade A- (~375 lines)
Thorough Jeff Patton implementation with horizontal (activities → steps → tasks) and vertical (priority/releases) structure. The pitfall "activities are user behaviors, not features" reflects genuine understanding. ASCII diagram of map structure is practical.

**Best for**: Structured PM workshops and facilitation
**Skip**: The remaining 37 skills — user-story (B, basic), jobs-to-be-done (B+, correct but not deep), prioritization-advisor (B, framework selector not implementation guide), proto-persona (B+, decent but light)

## Tier 2: Good With Caveats

### levnikolaevich/claude-code-skills (2 of 101 skills) — 8.5/10 each
**URL**: https://github.com/levnikolaevich/claude-code-skills
**Stars**: 89 | **Skills total**: 101

The "101 skills" claim is inflated — many are thin delegation wrappers. But two skills are genuinely excellent:

#### ln-220-story-coordinator (~600 lines)
The most detailed skill in the repo. Five phases with auto-extraction of planning questions from Epic descriptions, frontend HTML scanning for acceptance criteria scenarios, INVEST scoring model (0-6 per story with specific criteria), and vertical slicing guidelines with good/bad examples. The "Database Creation Principle" explicitly calling out "Create user table" as a bad Story is exactly the mistake junior teams make. Token efficiency is explicitly designed for (metadata-only loading at orchestrator level).

#### ln-310-story-validator (~600 lines)
21 validation criteria organized into 8 groups with quantitative penalty points (CRITICAL=10, HIGH=5, MEDIUM=3, LOW=1, max 78). Anti-hallucination verification (checks RFC references, library versions). Auto-fix for all 21 criteria with deliberate fix order (Standards before YAGNI — you must ensure RFC compliance before cutting scope). The risk Impact × Probability matrix shows quantitative risk management experience.

**Caveat**: Both are tightly coupled to Linear. You'll need to adapt the methodology and strip the Linear-specific parts if you use a different tool.
**Skip**: The other 99 skills unless you use Linear and want the full pipeline.

### scopecraft/command (brainstorm-feature only) — 6/10
**URL**: https://github.com/scopecraft/command

The brainstorm-feature command has genuine PM voice and personality. Explicitly instructs Claude to be adversarial: "Be skeptical of 'nice to have' features", "Call out feature creep and over-engineering." The example session shows realistic pushback: "So you can't maintain a simple habit, but you think adding a feature will magically solve this?" The PRD principles are sharp: "Optimize for LLM understanding", "Avoid enterprise patterns."

**Best for**: If you want a brainstorming skill with healthy skepticism built in
**Caveat**: PM content is a thin layer on a large task management engineering tool

## Tier 3: Skip These

### automazeio/ccpm — 5/10
**URL**: https://github.com/automazeio/ccpm
Good engineering scaffolding (parallel agent orchestration via worktrees is clever), but the PM methodology is generic textbook stuff. The README is the biggest red flag — "89% less time", "5-8 parallel tasks", "up to 3x faster" with zero citations. Emoji-heavy, breathless marketing tone screams LLM-generated sales copy. The commands themselves are okay but unremarkable.

### codenamev/ai-software-architect — 4/10
**URL**: https://github.com/codenamev/ai-software-architect
Over-engineered framework that architectured itself more than it helps you architect your product. Has a literal instruction-counting tool (tools/lib/instruction-counter.js). The installation method comparison table with decision tree flowchart is exhaustive completeness that signals LLM generation. 120+ files, enormous surface area, thin actual architecture thinking.

### anthropics/skills — N/A for PM
**URL**: https://github.com/anthropics/skills
Anthropic's official skills showcase, but focused on creative/design work (algorithmic art, brand guidelines, canvas design, document manipulation). The internal-comms skill is the closest to PM territory but thin. Useful for understanding skill authoring patterns, not for PM work.

## Discovery Platforms

| Platform | URL | Notes |
|----------|-----|-------|
| SkillsMP | https://skillsmp.com/ | 25K+ skills from GitHub, searchable |
| skills.sh | https://skills.sh | 24K+ community skills |
| claude-plugins.dev | https://claude-plugins.dev/ | Community registry with CLI install |
| mcpmarket.com | https://mcpmarket.com/tools/skills/ | Curated listings |
| prodmgmt.world | https://www.prodmgmt.world/claude-code | 180+ PM-curated skills |
| ccforpms.com | https://ccforpms.com/ | Free PM course for Claude Code (15-25 hours) |

## Recommended Stack for PM Pipeline

For a project kickstart workflow (Brief → Requirements → Personas → Scenarios → Stories → Specs → Tasks):

| Phase | Recommended Skill | Source |
|-------|------------------|--------|
| Problem Definition | rjs/shaping | Tier 1 |
| Requirements (IRD) | anthropic/feature-spec | Tier 1 |
| Discovery | deanpeters/discovery-process | Tier 1 |
| Personas | deanpeters/proto-persona (B+) or anthropic/user-research-synthesis | Tier 1-2 |
| Scenarios | deanpeters/customer-journey-map | Tier 1 |
| Stories | deanpeters/user-story-mapping + epic-breakdown-advisor | Tier 1 |
| Solution Shape | rjs/breadboarding | Tier 1 |
| Story Quality | levnikolaevich/ln-310-story-validator (adapted) | Tier 2 |
| Task Decomposition | levnikolaevich/ln-220-story-coordinator (adapted) | Tier 2 |
| PRD (if full PRD needed) | deanpeters/prd-development | Tier 1 |

## Methodology Note

This evaluation was conducted in February 2026. We fetched and read actual SKILL.md files from each repository, not just README descriptions. Ratings reflect the quality of the skill content itself, not GitHub stars or marketing claims. Skills were evaluated against the standard of "would an experienced PM (5+ years) find this genuinely useful, or would it feel patronizing?"

---

*Evaluated as part of the ContextForge project — a context management platform for LLM interactions with first-class Claude Code skills support.*
*https://github.com/contextforge/ContextForgeTS*
