# CIRCLES Framework Reference Card

The CIRCLES method (Lewis C. Lin) structures product thinking from problem to recommendation.
Use it to prevent the most common PM failure: jumping to solutions before understanding the problem.

## Framework Steps

| Step | Key Questions | Anti-Pattern |
|------|--------------|-------------|
| **C**omprehend the Situation | What is the product/feature? What problem does it solve? Who asked for this and why? What context or constraints exist? | Jumping to solutions before understanding the situation |
| **I**dentify the Customer | Who are the users? Which segment matters most right now? Who is NOT a target user? What do we know vs. assume about them? | Assuming "everyone" is the customer |
| **R**eport Customer Needs | What are their top 3 pain points? What workarounds do they currently use? What would "done" look like for them? | Listing features instead of needs (e.g., "needs a dashboard" vs. "needs to see status at a glance") |
| **C**ut Through Prioritization | Which needs are must-have vs. nice-to-have? What is the appetite (time budget)? What happens if we build nothing? | Treating all needs as equal priority; no explicit ranking |
| **L**ist Solutions | What are 2-3 different approaches? What are the tradeoffs of each? Which is the simplest that addresses must-haves? | Committing to the first idea without exploring alternatives |
| **E**valuate Tradeoffs | Cost vs. benefit for each approach? Technical feasibility? User impact? Reversibility? | Ignoring constraints (time, team size, tech debt, dependencies) |
| **S**ummarize | One-paragraph recommendation. Which approach and why. What we are explicitly NOT doing and why. | Vague summary without a clear recommendation or next step |

## How to Use

### At L0 (Brief)

Walk through all 7 steps sequentially. The goal is a one-page brief, not a detailed spec.

- **Spend most time on C, I, and R** -- the problem space. These three steps determine whether the rest of the framework produces useful output or polished nonsense.
- **L, E, S are lighter at brief stage** -- they deepen during IRD (L1). At L0, "List Solutions" might be a few bullet points; "Evaluate Tradeoffs" might be a sentence per option.
- A good L0 brief answers: "Should we invest time specifying this further?" If the answer is no, CIRCLES saved you from writing a full spec for something that won't ship.

### Quick Diagnostics

| Symptom | Likely Skipped Step |
|---------|-------------------|
| Stakeholder keeps changing requirements | C -- situation not comprehended; hidden context |
| Team debates features endlessly | R -- needs not grounded in user reality |
| Scope creeps every sprint | C -- no explicit appetite or time budget |
| Solution feels over-engineered | I -- building for too many customer segments |
| Nobody can explain why we chose this approach | E and S -- tradeoffs not evaluated, recommendation not articulated |

### Pairing with Other Frameworks

- Use **EARS** (see ears-reference) to convert needs from step R into testable requirements at L1.
- Use **RICE/ICE** scoring inside step C (Cut) when you have more than 5 competing needs.
- Use **Jobs-to-be-Done** language in step R to keep needs outcome-oriented.
