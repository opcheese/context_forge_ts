# GATE: GO / PIVOT / KILL

**Project:** [name]
**Date:** [date]
**Decision maker:** [who has authority]

## Summary

### Brief (L0)
[2-3 sentence summary: problem, customer, appetite]

### IRD (L1)
[2-3 sentence summary: requirement count, key functional areas, critical NFRs]

## Evidence Assessment

| Factor | Evidence | Confidence |
|--------|----------|-----------|
| Problem exists | [what data/research supports this?] | HIGH / MEDIUM / LOW |
| Target users identified | [how specific is the customer segment?] | HIGH / MEDIUM / LOW |
| Solution feasible | [technical feasibility within appetite?] | HIGH / MEDIUM / LOW |
| Market opportunity | [competitive landscape, timing] | HIGH / MEDIUM / LOW |
| Team capacity | [do we have the people and skills?] | HIGH / MEDIUM / LOW |

## Risk Assessment
- **Technical risk:** [what could go wrong technically?]
- **Market risk:** [what if users don't want this?]
- **Resource risk:** [what if it takes longer than the appetite?]

## Decision Criteria

- [ ] Problem is validated with evidence (not just opinion)
- [ ] Customer segment is specific enough to find and talk to
- [ ] Appetite is realistic given requirements scope
- [ ] Requirements are testable (EARS syntax, not vague)
- [ ] No fatal competitive overlap (or clear differentiation)
- [ ] Team has capacity within the appetite timeframe

## Decision

**[ ] GO** — Proceed to L2 (Personas). Rationale: [why]

**[ ] PIVOT** — Change direction before proceeding. What changes: [specific changes to brief/IRD/approach]. Then re-run GATE.

**[ ] KILL** — Stop this project. Rationale: [why]. What to do instead: [redirect energy where?]

---

## How to Use This Template

1. **Fill Summary from existing artifacts.** Do not rewrite the Brief or IRD here. Summarize them in 2-3 sentences each.
2. **Be honest in Evidence Assessment.** LOW confidence is not a failure — it is information. A GO with LOW confidence flags mean you need to validate early in L2.
3. **Check every Decision Criteria box or explain why not.** Unchecked boxes are not blockers by default, but each needs a conscious acknowledgment.
4. **One decision per GATE.** Do not combine "GO but also pivot this part". Either GO as-is, or PIVOT first and re-run.

## Confidence Calibration

| Level | Meaning |
|-------|---------|
| HIGH | Direct evidence: user interviews, analytics data, proven technology |
| MEDIUM | Indirect evidence: analogous products, team experience, market reports |
| LOW | Assumption or gut feel: no direct data, untested hypothesis |

## When to PIVOT vs. KILL

**PIVOT** when:
- The problem is real but the approach is wrong
- The customer segment needs narrowing or shifting
- The appetite needs adjusting (up or down) and that is acceptable
- Requirements revealed a better framing of the problem

**KILL** when:
- The problem is not validated and cannot be validated cheaply
- The market has moved (competitor shipped, regulation changed)
- Team capacity does not exist within any reasonable appetite
- The opportunity cost is too high — other projects matter more

## Next Step

- **After GO:** Proceed to L2 — Personas & Scenarios. Carry forward all Open Questions and LOW-confidence items as validation targets.
- **After PIVOT:** Update the Brief and/or IRD with the specific changes noted. Then re-run this GATE.
- **After KILL:** Document the rationale. Archive the Brief and IRD for future reference. Redirect team energy.
