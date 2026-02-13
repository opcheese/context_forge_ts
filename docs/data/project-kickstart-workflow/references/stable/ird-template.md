# Initial Requirements Document (IRD)

**Project:** [from Brief]
**Appetite:** [from Brief]
**Date:** [date]
**Status:** DRAFT / REVIEWED / APPROVED

## Context
[One paragraph summary of the Brief. Problem, customer segment, chosen approach.]

## Functional Requirements

### [User Goal 1: e.g., "Account Management"]

| ID | EARS Pattern | Requirement | Priority | Notes |
|----|-------------|-------------|----------|-------|
| FR-001 | Ubiquitous | The system shall [action] | Must | |
| FR-002 | Event-driven | WHEN [event], the system shall [action] | Must | |
| FR-003 | Conditional | IF [condition], THEN the system shall [action] | Should | |

### [User Goal 2: e.g., "Content Discovery"]

| ID | EARS Pattern | Requirement | Priority | Notes |
|----|-------------|-------------|----------|-------|
| FR-004 | ... | ... | ... | |

[Add sections per user goal. Group by what the user is trying to do, NOT by system component.]

## Non-Functional Requirements

| ID | Category | Requirement | Priority |
|----|----------|-------------|----------|
| NFR-001 | Performance | [EARS pattern] | Must |
| NFR-002 | Security | [EARS pattern] | Must |
| NFR-003 | Accessibility | [EARS pattern] | Should |
| NFR-004 | Reliability | [EARS pattern] | Should |

## Constraints & Assumptions
- [Technical constraints: platform, integrations, existing systems]
- [Business constraints: budget, timeline, compliance]
- [Assumptions: mark each with [ASSUMPTION] — to be validated during L2/L3]

## Out of Scope
[Explicit list of what this project will NOT do. Be specific — "no admin dashboard" not "limited admin features".]

## Open Questions
[Carried from Brief + new questions that emerged during requirements analysis]

---

## How to Use This Template

1. **Start from the Brief.** Copy Project, Appetite, and Context directly. The IRD refines, it does not reinvent.
2. **Group by user goal, not system component.** "Checkout Flow" not "Payment Module". This keeps requirements user-centered.
3. **Use EARS patterns consistently.** Every requirement should follow one of the five patterns:
   - **Ubiquitous:** The system shall [action]. (Always true)
   - **Event-driven:** WHEN [event], the system shall [action].
   - **Conditional:** IF [condition], THEN the system shall [action].
   - **State-driven:** WHILE [state], the system shall [action].
   - **Optional:** WHERE [feature], the system shall [action].
4. **Assign priorities using MoSCoW.** Must / Should / Could / Won't. Tie priorities to the appetite.
5. **Mark assumptions explicitly.** Every [ASSUMPTION] tag is a risk that needs validation.

## EARS Pattern Quick Reference

| Pattern | Template | Use When |
|---------|----------|----------|
| Ubiquitous | The system shall [action] | Behavior is always active |
| Event-driven | WHEN [event], the system shall [action] | Triggered by a specific event |
| Conditional | IF [condition], THEN the system shall [action] | Depends on a system state |
| State-driven | WHILE [state], the system shall [action] | Active during a state |
| Optional | WHERE [feature is included], the system shall [action] | Only if feature is present |

## Quality Checklist

Before proceeding to the GATE decision, verify:

- [ ] Every FR uses a recognized EARS pattern
- [ ] Requirements are testable — you can write a pass/fail condition for each
- [ ] IDs are sequential and traceable (FR-001, FR-002, NFR-001, etc.)
- [ ] Priorities reflect the appetite (not everything is "Must")
- [ ] NFRs include at least performance, security, and reliability
- [ ] Constraints separate facts from assumptions
- [ ] Out of Scope is specific and actionable
- [ ] Open Questions from Brief are addressed or carried forward

## Common Pitfalls

- **Mixing requirements and design.** "Use PostgreSQL" is a design decision, not a requirement. "Data shall persist across sessions" is a requirement.
- **Untestable requirements.** "The system shall be fast" is not testable. "WHEN a user submits a search, the system shall return results within 2 seconds" is.
- **Priority inflation.** If every requirement is "Must", priorities are meaningless. The appetite constrains what is truly must-have.
- **Missing NFRs.** Functional requirements get attention; NFRs get forgotten. Security and performance issues found late are expensive.
- **Orphan assumptions.** Every [ASSUMPTION] needs a plan to validate it. Unvalidated assumptions become surprises.

## Next Step

When this IRD is complete, run the **GATE decision** to determine GO / PIVOT / KILL before investing in L2 (Personas & Scenarios).
